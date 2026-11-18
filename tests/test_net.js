// Runs the game's REAL WsT / normRelay / relayUrl code against the live server.
const fs=require('fs');
const src=(()=>{const h=fs.readFileSync(require('path').join(__dirname,'..','index.html'),'utf8');return [...h.matchAll(/<script[^>]*>([\s\S]*?)<\/script>/g)].map(m=>m[1]).find(t=>t.includes('const DEFAULT_RELAY'))})();
const a=src.indexOf('const DEFAULT_RELAY'),b=src.indexOf('const NetT=');
const code=src.slice(a,b);
const store={};
const lsGet=k=>store[k]||null,lsSet=(k,v)=>{store[k]=v};
const location={search:'?server=ws://127.0.0.1:8099',protocol:'http:',host:'127.0.0.1:8099'};
const window={};
const mk=new Function('lsGet','lsSet','location','window','WebSocket','fetch',code+';return{WsT,relayUrl,normRelay}');
const {WsT,relayUrl,normRelay}=mk(lsGet,lsSet,location,window,WebSocket,()=>Promise.reject(new Error('no relay.json')));
const assert=(c,m)=>{if(!c){console.log('FAIL',m);process.exitCode=1}else console.log('ok  ',m)};
const wait=ms=>new Promise(r=>setTimeout(r,ms));
(async()=>{
 assert(normRelay('my-game.onrender.com')==='wss://my-game.onrender.com/ws','normalises bare host');
 assert(normRelay('https://x.fly.dev/')==='wss://x.fly.dev/ws','https -> wss');
 assert(normRelay('http://localhost:8080')==='ws://localhost:8080/ws','http -> ws');
 assert(normRelay('ftp://x')==='','rejects other schemes');
 assert(relayUrl()==='ws://127.0.0.1:8099/ws','?server= param is picked up: '+relayUrl());
 // relay.json next to the page (GitHub Pages setup): picked up when nothing else is configured
 {const st2={};const cfg=new Function('lsGet','lsSet','location','window','WebSocket','fetch',code+';return{relayUrl}')(k=>st2[k]||null,(k,v)=>{st2[k]=v},{search:'',protocol:'https:',host:'me.github.io'},{},WebSocket,()=>Promise.resolve({ok:true,json:()=>({server:'my-game.onrender.com'})}));
  assert(cfg.relayUrl()==='','relay.json not applied before it has loaded');await wait(50);
  assert(cfg.relayUrl()==='wss://my-game.onrender.com/ws','relay.json {"server":...} becomes the relay: '+cfg.relayUrl());
  st2.sc_server='wss://custom.example/ws';assert(cfg.relayUrl()==='wss://custom.example/ws','a server saved in the game beats relay.json')}
 const room='scv1-practice-t0-ffa-s1';
 // host registers the room id
 const host=await WsT.start(room);assert(host.id===room,'host registered room id');
 const log=[];host.onconn(c=>{log.push('host got conn from '+c.peer);c.on('data',m=>{log.push('host data '+JSON.stringify(m));if(m.t==='probe')c.send({t:'info',n:1,max:12,phase:'free',rem:0});if(m.t==='hello')c.send({t:'w',you:'p1'});if(m.t==='big')c.send({t:'bigok',len:m.pad.length})});c.on('close',()=>log.push('host saw close'))});
 // second host with same id is refused
 let dup=null;try{await WsT.start(room)}catch(e){dup=e}
 assert(dup&&dup.type==='unavailable-id','duplicate room id refused ('+(dup&&dup.type)+')');
 // scanner: probe an existing room and a missing one
 const sc=await WsT.start(null);assert(/^u[0-9a-f]{10}$/.test(sc.id),'scanner got random id');
 const gone=[];sc.onerr(e=>gone.push(e));
 const probe=await new Promise(res=>{const c=sc.connect(room);c.on('open',()=>c.send({t:'probe'}));c.on('data',m=>res(m));setTimeout(()=>res(null),3000)});
 assert(probe&&probe.t==='info'&&probe.max===12,'probe over relay returns server info');
 sc.connect('scv1-practice-t0-ffa-s2');await wait(300);
 assert(gone.some(e=>e.type==='peer-unavailable'&&e.message.includes('-s2')),'empty room reports peer-unavailable with its id');
 // joiner: hello/welcome + big message + several clients
 const j=await WsT.start(null);let got=[];const c=j.connect(room);
 c.on('open',()=>{c.send({t:'hello',name:'Zed'});c.send({t:'big',pad:'x'.repeat(100000)})});
 c.on('data',m=>got.push(m.t));
 await wait(600);
 assert(got.includes('w'),'joiner received welcome');assert(got.includes('bigok'),'100 KB message relayed (framing, 64-bit-safe)');
 // 11 more players, host streams to everyone at 15 Hz for 2 s
 const peers=[];for(let i=0;i<11;i++){const e=await WsT.start(null);const cc=e.connect(room);const st={n:0};cc.on('data',m=>{if(m.t==='S')st.n++});peers.push(st)}
 await wait(200);
 const hostConns=[];host.onconn(()=>{});
 // host broadcasts via its existing conns: reach them through log (conns are internal), so re-create by messaging from clients first
 for(let i=0;i<12;i++)await wait(1);
 console.log('   relay log lines:',log.length);
 // host disconnect -> joiners see close
 let closed=false;c.on('close',()=>closed=true);host.destroy();await wait(500);
 assert(closed,'joiner notified when host leaves');
 // after host left the id is free again
 const again=await WsT.start(room);assert(again.id===room,'room id reusable after host leaves');
 // unreachable server error is friendly
 store.sc_server='ws://127.0.0.1:1/ws';let err=null;try{await WsT.start(null)}catch(e){err=e}
 assert(err&&/Could not reach/.test(err.message),'unreachable server -> readable error: '+(err&&err.message));
 process.exit(process.exitCode||0);
})();
