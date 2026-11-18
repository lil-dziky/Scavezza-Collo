const fs=require('fs');
const src=(()=>{const h=fs.readFileSync(require('path').join(__dirname,'..','index.html'),'utf8');return [...h.matchAll(/<script[^>]*>([\s\S]*?)<\/script>/g)].map(m=>m[1]).find(t=>t.includes('const DEFAULT_RELAY'))})();
const code=src.slice(src.indexOf('const DEFAULT_RELAY'),src.indexOf('const NetT='));
const store={};
function make(loc,win){return new Function('lsGet','lsSet','location','window','WebSocket',code+';return{WsT,relayUrl}')(k=>store[k]||null,(k,v)=>{store[k]=v},loc,win,WebSocket)}
// served by the relay itself: no config needed
const own=make({search:'',protocol:'http:',host:'127.0.0.1:8099'},{SC_RELAY:1});
console.log('default relay when served by the server ->',own.relayUrl());
const {WsT}=own;const wait=ms=>new Promise(r=>setTimeout(r,ms));
(async()=>{
 const room='scv1-race-t3-ffa-l3-s2';const host=await WsT.start(room);const hc=[];host.onconn(c=>{hc.push(c);c.on('data',()=>{})});
 const rx=[],lat=[];
 for(let i=0;i<11;i++){const e=await WsT.start(null);const c=e.connect(room);const st={n:0,lat:[]};c.on('data',m=>{if(m.t==='S'){st.n++;st.lat.push(Date.now()-m.ts)}});c.on('open',()=>{setInterval(()=>c.send({t:'st',s:{x:1,y:2,a:3,v:4,ts:Date.now()}}),66)});rx.push(st)}
 await wait(500);
 const t0=Date.now();const iv=setInterval(()=>{for(const c of hc)c.send({t:'S',ts:Date.now(),s:Object.fromEntries(Array.from({length:12},(_,i)=>['p'+i,{x:1.5,y:2.5,a:3,vx:4,vy:5,vf:6,w:7,l:2,n:'x'}]))})},66);
 await wait(4000);clearInterval(iv);
 const secs=(Date.now()-t0)/1000;
 const tot=rx.reduce((a,s)=>a+s.n,0),all=rx.flatMap(s=>s.lat).sort((a,b)=>a-b);
 console.log('11 clients, host streaming 15 Hz for',secs.toFixed(1),'s -> msgs received',tot,'(expected ~',Math.round(11*15*secs),') · latency p50',all[all.length>>1],'ms p99',all[Math.floor(all.length*.99)],'ms');
 console.log('every client got at least 90% of messages:',rx.every(s=>s.n>=0.9*15*secs));
 process.exit(0);
})();
