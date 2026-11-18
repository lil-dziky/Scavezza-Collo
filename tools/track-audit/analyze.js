const {TRACKS,build,SP}=require('./lib.js');
const PXM=12;
function analyze(i){
  globalThis.__D0=null;const T=build(TRACKS[i]),N=T.N,m=k=>k*SP/PXM;
  const thr=1/(300*PXM);                 // corner where radius < 300 m
  const on=T.ks.map(k=>Math.abs(k)>thr);
  // find start at a non-corner sample
  let s0=on.indexOf(false);const cs=[];let k=0;
  while(k<N){const j=(s0+k)%N;if(!on[j]){k++;continue}let e=k;while(e<N&&on[(s0+e)%N])e++;cs.push([(s0+k)%N,e-k]);k=e}
  // merge corners separated by <8 samples (~27 m) with same sign
  const sg=(idx)=>Math.sign(T.ks[idx]);
  const merged=[];
  for(const c of cs){const last=merged[merged.length-1];
    if(last){const endLast=(last[0]+last[1])%N,gap=(c[0]-endLast+N)%N;
      if(gap<=8&&sg(c[0])===sg(last[0])){last[1]+=gap+c[1];continue}}
    merged.push(c.slice())}
  const out=merged.map(c=>{let ang=0,kmax=0,pk=c[0];for(let q=0;q<c[1];q++){const idx=(c[0]+q)%N;ang+=T.ks[idx]*SP;if(Math.abs(T.ks[idx])>kmax){kmax=Math.abs(T.ks[idx]);pk=idx}}
    let fo=null;if(globalThis.__D0){const q=T.pts[pk],x=q[0]/globalThis.__s2,y=q[1]/globalThis.__s2;let bd=1e18,bi=0;const D0=globalThis.__D0;for(let z=0;z<D0.length;z++){const d=(D0[z][0]-x)**2+(D0[z][1]-y)**2;if(d<bd){bd=d;bi=z}}fo=+(bi/D0.length).toFixed(4)}
    return{at:Math.round(m(c[0])),len:Math.round(m(c[1])),dir:ang>0?'R':'L',deg:Math.round(Math.abs(ang)*180/Math.PI),rmin:Math.round(1/kmax/PXM),f:+(c[0]/N).toFixed(3),fo,mid:Math.round(m(pk))}});
  // straights
  const st=T.ks.map(k=>Math.abs(k)*SP<.004);let s1=st.indexOf(false);const sr=[];k=0;
  while(k<N){const j=(s1+k)%N;if(!st[j]){k++;continue}let e=k;while(e<N&&st[(s1+e)%N])e++;sr.push({at:Math.round(m((s1+k)%N)),len:Math.round(m(e-k))});k=e}
  sr.sort((a,b)=>b.len-a.len);
  // clearance between distant parts of the lap (road edges + barrier gap): negative = overlap
  let clr=1e9,cw=null;{const G=new Map(),pt=T.pts,cs=800;for(let k=0;k<N;k++){const key=Math.floor(pt[k][0]/cs)+','+Math.floor(pt[k][1]/cs);if(!G.has(key))G.set(key,[]);G.get(key).push(k)}
   for(let k=0;k<N;k++){const gx=Math.floor(pt[k][0]/cs),gy=Math.floor(pt[k][1]/cs);for(let x=-1;x<=1;x++)for(let y=-1;y<=1;y++){const A=G.get((gx+x)+','+(gy+y));if(!A)continue;for(const j of A){if(j<=k)continue;const dd=Math.min(j-k,N-(j-k));if(dd<150)continue;const d=Math.hypot(pt[k][0]-pt[j][0],pt[k][1]-pt[j][1])-T.hw[k]-T.hw[j];if(d<clr){clr=d;cw=[Math.round(k*SP/PXM),Math.round(j*SP/PXM)]}}}}}
  return{clr:Math.round(clr),clrAt:cw,name:TRACKS[i].name,lenM:Math.round(m(N)),N,corners:out,straights:sr.slice(0,5),pit:{side:T.pitSide,e0:Math.round(m(T.e0s)),e1:Math.round(m(T.e1s)),lenM:Math.round(m(T.e1s-T.e0s))},hwMin:+(Math.min(...T.hw)/50*2).toFixed(1),hwMax:+(Math.max(...T.hw)/50*2).toFixed(1),gap:T.gap,rtol:TRACKS[i].rtol,rmin:TRACKS[i].rmin,kind:TRACKS[i].V?'V':TRACKS[i].D?'D':'P',rot:T.rot,pts:T.pts.filter((_,k)=>k%2==0).map(p=>[Math.round(p[0]),Math.round(p[1])]),hw:T.hw.filter((_,k)=>k%2==0).map(h=>Math.round(h))};
}
const all=[];for(let i=0;i<TRACKS.length;i++){try{all.push(analyze(i))}catch(e){all.push({name:TRACKS[i].name,err:String(e)})}}
require('fs').writeFileSync(process.argv[2]||'audit.json',JSON.stringify(all,null,1));
for(const a of all){if(a.err){console.log(a.name,'ERR',a.err);continue}
 const hp=a.corners.filter(c=>c.rmin<60).length;
 console.log(`${a.name} [clear ${a.clr}px @${a.clrAt}]: ${a.lenM} m, ${a.corners.length} corner groups (${hp} tight<60m), width ${a.hwMin}-${a.hwMax} cars, runoff gap ${a.gap}, kind ${a.kind}, rtol ${a.rtol||'-'} rmin ${a.rmin||'-'}, pit ${a.pit.lenM} m, longest straights ${a.straights.slice(0,3).map(s=>s.len).join('/')} m`)}
