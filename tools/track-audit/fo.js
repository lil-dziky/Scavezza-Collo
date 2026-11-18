// usage: node fo.js <trackIndex> m1 m2 ...  -> D-fraction (fo) of the point m metres after the start line, plus heading
const {TRACKS,build,SP}=require('./lib.js');
const i=+process.argv[2];globalThis.__D0=null;const T=build(TRACKS[i]);const D0=globalThis.__D0,s2=globalThis.__s2;
for(const m of process.argv.slice(3).map(Number)){const k=Math.round(m*12/SP)%T.N,q=T.pts[k],x=q[0]/s2,y=q[1]/s2;let bd=1e18,bi=0;for(let z=0;z<D0.length;z++){const d=(D0[z][0]-x)**2+(D0[z][1]-y)**2;if(d<bd){bd=d;bi=z}}console.log(m+'m -> fo',(bi/D0.length).toFixed(4))}
