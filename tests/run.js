// npm test: starts the server on a spare port, runs the relay tests against it, stops it.
const {spawn}=require('child_process'),path=require('path');
const root=path.join(__dirname,'..');
const srv=spawn(process.execPath,['server.js'],{cwd:root,env:{...process.env,PORT:'8099'},stdio:'ignore'});
const run=f=>new Promise(r=>spawn(process.execPath,[path.join(__dirname,f)],{stdio:'inherit'}).on('exit',r));
setTimeout(async()=>{const a=await run('test_net.js'),b=await run('test_load.js');srv.kill();process.exit(a||b?1:0)},800);
