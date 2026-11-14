import './check-runtime.mjs';
import {spawn} from 'node:child_process';
import {once} from 'node:events';
import {createServer} from 'node:http';
import {mkdtemp,readFile,writeFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join,resolve,sep} from 'node:path';
import {createHash} from 'node:crypto';
const root=await mkdtemp(join(process.env.READONLY_LEAF_UI_PARENT_ROOT??tmpdir(),'interiors-readonly-leaf-dom-')),dist=join(root,'dist');
const sourceSHA=createHash('sha256').update(await readFile('src/ui/telegram-readonly-projects.tsx')).digest('hex');
const env={...process.env,READONLY_LEAF_UI_ROOT:root,READONLY_LEAF_UI_DIST:dist,READONLY_LEAF_UI_OUTPUT:join(root,'results'),READONLY_LEAF_UI_REPORT:join(root,'report.json'),READONLY_LEAF_UI_SOURCE_SHA:sourceSHA};
let running;
process.once('SIGTERM',()=>{running?.kill('SIGTERM');});
async function run(args){const p=spawn(process.execPath,args,{env,stdio:['ignore','pipe','pipe']});running=p;let output='';p.stdout.on('data',v=>{output+=v;process.stdout.write(v);});p.stderr.on('data',v=>{output+=v;process.stderr.write(v);});const[code,signal]=await once(p,'exit');running=undefined;await writeFile(join(root,args.includes('build')?'build.log':'native.log'),output);if(code!==0||/Build errors:|unable to locate|Module not found|Cannot resolve|\bERROR in\b/.test(output))throw new Error(`Readonly leaf proof failed ${code??signal}; ${root}`);}
await run([resolve('node_modules/@rspack/cli/bin/rspack.js'),'build','--mode','development','--config','rspack.telegram-readonly-projects-test.config.mjs']);
await writeFile(join(root,'fixture.json'),JSON.stringify({sourceSHA,uiPortDoubles:true,storedProjectProof:false,validArchiveProof:false,physicalTelegram:false},null,2));
if(process.argv.includes('--build-only')){process.stdout.write(`Readonly leaf UI artifacts: ${root}\n`);process.exit(0);}
const server=createServer(async(req,res)=>{try{const pathname=decodeURIComponent(new URL(req.url,'http://127.0.0.1').pathname),file=resolve(dist,`.${pathname==='/'?'/index.html':pathname}`);if(!file.startsWith(`${dist}${sep}`)){res.writeHead(404).end();return;}const bytes=await readFile(file);res.writeHead(200,{'Content-Type':file.endsWith('.html')?'text/html':file.endsWith('.js')?'text/javascript':file.endsWith('.css')?'text/css':'application/octet-stream','Cache-Control':'no-store'}).end(bytes);}catch{res.writeHead(404).end();}});
await new Promise(ok=>server.listen(0,'127.0.0.1',ok));const address=server.address();if(!address||typeof address==='string')throw new Error('No loopback port');env.READONLY_LEAF_UI_BASE_URL=`http://127.0.0.1:${address.port}`;
try{await run([resolve('node_modules/@playwright/test/cli.js'),'test','--config','playwright.telegram-readonly-projects.config.mjs',...process.argv.slice(2)]);}finally{server.closeAllConnections();await new Promise(ok=>server.close(ok));process.stdout.write(`Readonly leaf UI artifacts: ${root}\n`);}
