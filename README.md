# Scavezza Collo

A single-file 2D racing game (`index.html`): 23 circuits, 10 car classes, AI racing, pit stops and online
multiplayer. **No git, no build, no installs needed.**

```
index.html           the whole game
relay.json           where your online server lives (you edit this one line, see Step 3)
server.js            online relay + web server (no dependencies)
Dockerfile · render.yaml · package.json   deployment
tests/ · tools/      optional: relay tests, track analysis tools
```

Play offline: open `index.html` in a browser. Online mode needs a server (below), because browsers cannot
reliably connect to each other behind VPNs, WARP or strict Wi-Fi.

---

# Put it online (no git needed)

## Step 1 · Upload to GitHub (website only)
1. github.com → **+ → New repository** → name it (e.g. `scavezza-collo`) → **Public** → Create.
2. On the empty repo page click **uploading an existing file**.
3. Unzip this project and drag **everything inside the folder** into the page (`index.html`, `relay.json`,
   `server.js`, `package.json`, `Dockerfile`, `render.yaml`, `README.md`, and the `tests` and `tools` folders).
   Then press **Commit changes**.

## Step 2 · Start the online server (this is what makes ONLINE work)
1. render.com → sign up with GitHub (free, no card).
2. **New + → Web Service** → choose your repo.
3. Runtime **Node** · Build command *(leave empty)* · Start command `node server.js` · Instance type **Free** → **Create**.
4. After a minute you get a link like `https://scavezza-collo.onrender.com`.

**That link already is the whole game.** Open it, go to ONLINE → JOIN SERVER, and send the same link to your
friends. Nothing else to configure. (Free Render sleeps after ~15 min idle; the first visit after that takes
~30 s to wake up, then press REFRESH once.)

## Step 3 · Optional: also publish the game on GitHub Pages
Only if you want a `yourname.github.io/...` link. The game there still needs your Render server for ONLINE:
1. Repo → **Settings → Pages → Build and deployment → Deploy from a branch → `main` / `(root)` → Save**.
2. Repo → click `relay.json` → pencil icon → change it to
   `{ "server": "scavezza-collo.onrender.com" }` (your Render address) → **Commit changes**.
3. Wait a minute, open your Pages link. ONLINE now connects through your server.

Players can also paste a server address themselves under **CONNECTION** on the ONLINE screen, or open
`https://yourname.github.io/scavezza-collo/?server=scavezza-collo.onrender.com`.

**To update the game later:** open the repo → **Add file → Upload files** → drop the new `index.html` →
Commit. Render and Pages both update by themselves.

---

# About the server

Online mode used to connect players directly to each other (WebRTC). That breaks behind VPNs, Cloudflare
WARP, school/office/mobile Wi-Fi and most strict NATs, and the free relay servers that used to rescue those
connections have mostly gone away.

This folder fixes that. `server.js` is a small relay: **every player connects out to it over normal
`https`/`wss` (port 443)**, so it works through VPN/WARP/any Wi-Fi, with nothing to open or forward on
anyone's PC. It has **no dependencies** (just Node 16+).

It also serves the game itself, so the easiest setup is: deploy this folder, then everybody opens your URL.

> What it is, honestly: a relay. The driver who presses JOIN SERVER on an empty server still runs that
> room (lobby, grid, results), exactly as before, and the room closes when that driver leaves. The server
> only passes messages between players. It is not a dedicated simulation server.

## Other ways to host it
- **Your own PC, free, no signup:** `node server.js`, then `cloudflared tunnel --url http://localhost:8080`
  prints a public https link to share (your PC must stay on).
- **Fly.io / Railway / any VPS:** the included `Dockerfile` works as is (listens on `$PORT`).
- **Local test:** `node server.js`, open http://localhost:8080 in two tabs, ONLINE → JOIN SERVER in both.

## Details

- Endpoints: `/` game · `/ws` relay · `/health` returns `ok peers=N`.
- Env vars: `PORT`, `MAX_PEERS` (default 400 connected browsers), `MAX_PER_IP` (default 40),
  `GAME_FILE` (default `index.html`).
- When you update the game, replace `index.html` next to `server.js` (no restart needed).
- Limits: messages ≤256 KB, ~500 messages/s per connection, idle connections are pinged every 25 s.
- A 12-player room (the game's maximum) was load-tested locally at 15 updates/s each: ~1–3 ms relay latency.
  Real-world latency is then your players' ping to wherever you host it, so pick a region near them.
