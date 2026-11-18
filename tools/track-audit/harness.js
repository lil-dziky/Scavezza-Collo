const fs=require('fs');
const src=process.argv[2]||require('path').join(__dirname,'..','..','index.html');
const L=fs.readFileSync(src,'utf8').split('\n');
const idx=re=>L.findIndex(l=>re.test(l));
const a=idx(/^const TRACKS=\[/),b=idx(/^const TARGET_LEN=/),c=idx(/^function makeDecor/),d=idx(/^function build\(def\)/),e=idx(/^\/\/ ---------- menu/);
const code=`
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
const wrapA=d=>{while(d>Math.PI)d-=2*Math.PI;while(d<-Math.PI)d+=2*Math.PI;return d};
const ctx={createPattern(){return null}};
const document={createElement:()=>({width:0,height:0,getContext:()=>new Proxy({}, {get:(t,k)=>()=>{}})})};
function makeDecor(){return {}}
${L.slice(a,b).join('\n')}
${L.slice(b,c).join('\n')}
${L.slice(d,e).join('\n')}
module.exports={TRACKS,build,SP,CARW};
`;
let c2=code.replace('D=rectify(editLine(D,def),def);{const s2=def.len/len(D);','globalThis.__D0=D.map(p=>[p[0],p[1]]);D=rectify(editLine(D,def),def);{const s2=def.len/len(D);globalThis.__s2=s2;')
 .replace('D=rectify(editLine(D,def),def);{const s2=(def.len||TARGET_LEN)/len(D);','globalThis.__D0=D.map(p=>[p[0],p[1]]);D=rectify(editLine(D,def),def);{const s2=(def.len||TARGET_LEN)/len(D);globalThis.__s2=s2;');
fs.writeFileSync(require('path').join(__dirname,'lib.js'),c2);
