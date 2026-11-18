#!/usr/bin/env node
/*
 * Scavezza Collo — online relay server (zero dependencies, Node 16+).
 *
 *  - Serves the game at  /            (index.html sitting next to this file)
 *  - Relays online-mode traffic at /ws (WebSocket)
 *  - Health check at /health
 *
 * Every player connects OUT to this server over normal HTTPS/WSS (port 443), so it works behind
 * VPNs, Cloudflare WARP, hotel / school / mobile networks and different Wi-Fi: no NAT traversal,
 * no TURN, no open ports on anyone's PC. The server only forwards messages between players; the
 * driver who starts a server in the lobby still runs that room's rules, exactly as before.
 *
 * Environment:  PORT (default 8080) · MAX_PEERS (default 400) · MAX_PER_IP (default 40)
 */
'use strict';
const http = require('http'), fs = require('fs'), path = require('path'), crypto = require('crypto'), zlib = require('zlib');

const PORT = +process.env.PORT || 8080;
const MAX_PEERS = +process.env.MAX_PEERS || 400;
const MAX_PER_IP = +process.env.MAX_PER_IP || 40;
const MAX_MSG = 256 * 1024;
const GUID = '258EAFA5-E914-47DA-95CA-C5AB0DC85B11';
const HTML = path.join(__dirname, process.env.GAME_FILE || (fs.existsSync(path.join(__dirname, 'index.html')) ? 'index.html' : 'racing-game.html'));

// ---------------------------------------------------------------- static game page
let cache = { mtime: 0, raw: null, gz: null };
function loadPage() {
  let st;
  try { st = fs.statSync(HTML); } catch (e) { return null; }
  if (st.mtimeMs !== cache.mtime) {
    let h = fs.readFileSync(HTML, 'utf8');
    h = h.replace('<head>', '<head><script>window.SC_RELAY=1</script>');   // tells the game it is being served by its own relay
    const raw = Buffer.from(h, 'utf8');
    cache = { mtime: st.mtimeMs, raw, gz: zlib.gzipSync(raw, { level: 6 }) };
  }
  return cache;
}

const server = http.createServer((req, res) => {
  const url = req.url.split('?')[0];
  if (url === '/health') { res.writeHead(200, { 'content-type': 'text/plain', 'access-control-allow-origin': '*' }); return res.end('ok peers=' + peers.size); }
  if (url === '/' || url === '/index.html' || url === '/racing-game.html') {
    const p = loadPage();
    if (!p) { res.writeHead(500, { 'content-type': 'text/plain' }); return res.end('index.html is missing next to server.js'); }
    const gz = /\bgzip\b/.test(req.headers['accept-encoding'] || '');
    res.writeHead(200, { 'content-type': 'text/html; charset=utf-8', 'cache-control': 'no-cache', ...(gz ? { 'content-encoding': 'gzip' } : {}) });
    return res.end(gz ? p.gz : p.raw);
  }
  res.writeHead(404, { 'content-type': 'text/plain' }); res.end('not found');
});

// ---------------------------------------------------------------- tiny RFC 6455 WebSocket
function frame(op, payload) {
  const len = payload.length;
  let h;
  if (len < 126) h = Buffer.from([0x80 | op, len]);
  else if (len < 65536) { h = Buffer.alloc(4); h[0] = 0x80 | op; h[1] = 126; h.writeUInt16BE(len, 2); }
  else { h = Buffer.alloc(10); h[0] = 0x80 | op; h[1] = 127; h.writeBigUInt64BE(BigInt(len), 2); }
  return Buffer.concat([h, payload]);
}

class Client {
  constructor(sock, ip) {
    this.sock = sock; this.ip = ip; this.id = null; this.links = new Map();   // "initiator:cid" -> peer Client
    this.buf = Buffer.alloc(0); this.frag = null; this.alive = Date.now(); this.dead = false;
    this.tokens = 600; this.tokT = Date.now();
    sock.on('data', d => this.onData(d));
    sock.on('close', () => this.drop());
    sock.on('error', () => this.drop());
    sock.setNoDelay(true);
  }
  raw(buf) { if (!this.dead && this.sock.writable) this.sock.write(buf); }
  send(o) { this.raw(frame(1, Buffer.from(JSON.stringify(o)))); }
  close(code) { if (this.dead) return; const b = Buffer.alloc(2); b.writeUInt16BE(code || 1000); this.raw(frame(8, b)); this.sock.end(); this.drop(); }
  onData(d) {
    this.buf = this.buf.length ? Buffer.concat([this.buf, d]) : d;
    if (this.buf.length > MAX_MSG * 2) return this.close(1009);
    for (;;) {
      const b = this.buf;
      if (b.length < 2) return;
      const fin = !!(b[0] & 0x80), op = b[0] & 15, masked = !!(b[1] & 0x80);
      let len = b[1] & 127, off = 2;
      if (len === 126) { if (b.length < 4) return; len = b.readUInt16BE(2); off = 4; }
      else if (len === 127) { if (b.length < 10) return; const big = b.readBigUInt64BE(2); if (big > BigInt(MAX_MSG)) return this.close(1009); len = Number(big); off = 10; }
      if (len > MAX_MSG) return this.close(1009);
      if (!masked) return this.close(1002);             // clients must mask
      if (b.length < off + 4 + len) return;
      const mask = b.subarray(off, off + 4), data = Buffer.from(b.subarray(off + 4, off + 4 + len));
      for (let i = 0; i < len; i++) data[i] ^= mask[i & 3];
      this.buf = b.subarray(off + 4 + len);
      if (op === 8) return this.close(1000);
      if (op === 9) { this.raw(frame(10, data)); continue; }
      if (op === 10) { this.alive = Date.now(); continue; }
      if (op === 1 || op === 0) {
        this.frag = op === 1 ? [data] : (this.frag ? (this.frag.push(data), this.frag) : null);
        if (!this.frag) continue;
        if (fin) { const msg = Buffer.concat(this.frag).toString('utf8'); this.frag = null; this.alive = Date.now(); this.onMsg(msg); }
      }
    }
  }
  onMsg(text) {
    const now = Date.now();                              // token bucket: 600 burst, 500 msgs/s sustained
    this.tokens = Math.min(600, this.tokens + (now - this.tokT) * 0.5); this.tokT = now;
    if (--this.tokens < 0) return this.close(1008);
    let m; try { m = JSON.parse(text); } catch (e) { return; }
    if (!m || typeof m.k !== 'string') return;
    switch (m.k) {
      case 'p': return this.send({ k: 'pp' });
      case 'reg': {
        if (this.id) return;
        let id = typeof m.id === 'string' ? m.id : '';
        if (id && !/^[A-Za-z0-9_-]{1,100}$/.test(id)) return this.send({ k: 'err', type: 'bad-id', message: 'Bad server id.' });
        if (!id) { do id = 'u' + crypto.randomBytes(5).toString('hex'); while (peers.has(id)); }
        if (peers.has(id)) return this.send({ k: 'err', type: 'unavailable-id', message: 'That server id is already taken.' });
        if (peers.size >= MAX_PEERS) return this.send({ k: 'err', type: 'busy', message: 'The server is full right now.' });
        this.id = id; peers.set(id, this); return this.send({ k: 'ok', id });
      }
      case 'c': {                                         // open a connection to peer m.to
        if (!this.id || typeof m.to !== 'string' || typeof m.cid !== 'string' || m.cid.length > 24) return;
        const t = peers.get(m.to);
        if (!t || t === this) return this.send({ k: 'np', to: m.to, cid: m.cid });
        if (this.links.size > 64) return;
        const key = this.id + ':' + m.cid;
        this.links.set(key, t); t.links.set(key, this);
        return t.send({ k: 'c', from: this.id, cid: m.cid });
      }
      case 'a': case 'd': case 'x': {                     // accept / data / close on an existing link
        if (!this.id || typeof m.to !== 'string' || typeof m.cid !== 'string') return;
        let key = this.id + ':' + m.cid, t = this.links.get(key);
        if (!t) { key = m.to + ':' + m.cid; t = this.links.get(key); }
        if (!t || peers.get(m.to) !== t) return;
        if (m.k === 'x') { this.links.delete(key); t.links.delete(key); }
        return t.send(m.k === 'd' ? { k: 'd', from: this.id, cid: m.cid, d: m.d } : { k: m.k, from: this.id, cid: m.cid });
      }
    }
  }
  drop() {
    if (this.dead) return; this.dead = true;
    for (const [key, t] of this.links) { t.links.delete(key); t.send({ k: 'x', from: this.id, cid: key.slice(key.indexOf(':') + 1) }); }
    this.links.clear();
    if (this.id && peers.get(this.id) === this) peers.delete(this.id);
    const n = (perIp.get(this.ip) || 1) - 1; if (n <= 0) perIp.delete(this.ip); else perIp.set(this.ip, n);
    try { this.sock.destroy(); } catch (e) { /* gone */ }
  }
}

const peers = new Map(), perIp = new Map(), all = new Set();

server.on('upgrade', (req, sock) => {
  const url = req.url.split('?')[0];
  const key = req.headers['sec-websocket-key'];
  if (url !== '/ws' || !key || String(req.headers.upgrade).toLowerCase() !== 'websocket') { sock.destroy(); return; }
  const ip = String(req.headers['x-forwarded-for'] || req.socket.remoteAddress || '').split(',')[0].trim();
  if ((perIp.get(ip) || 0) >= MAX_PER_IP) { sock.write('HTTP/1.1 429 Too Many Requests\r\nConnection: close\r\n\r\n'); sock.destroy(); return; }
  perIp.set(ip, (perIp.get(ip) || 0) + 1);
  const accept = crypto.createHash('sha1').update(key + GUID).digest('base64');
  sock.write('HTTP/1.1 101 Switching Protocols\r\nUpgrade: websocket\r\nConnection: Upgrade\r\nSec-WebSocket-Accept: ' + accept + '\r\n\r\n');
  const c = new Client(sock, ip); all.add(c); sock.on('close', () => all.delete(c));
});

// keep idle connections alive through proxies, drop dead ones
setInterval(() => {
  const now = Date.now();
  for (const c of all) { if (now - c.alive > 70000) c.close(1001); else c.raw(frame(9, Buffer.alloc(0))); }
}, 25000).unref();

server.listen(PORT, () => console.log('Scavezza Collo online server on port ' + PORT + '  ·  game at /  ·  relay at /ws'));
