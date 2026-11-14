import './check-runtime.mjs';
import { spawn } from 'node:child_process';
import { once } from 'node:events';
import { mkdtemp, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { createTelegramPreviewServer } from './telegram-preview-server.mjs';
const root=await mkdtemp(join(tmpdir(),'interiors-tma-catalog-proof-'));
const output=join(root,'dist-telegram');
const catalogOrigin=process.env.TMA_CATALOG_ORIGIN ?? 'http://127.0.0.1:4174';
const catalogURL=new URL(catalogOrigin);
if(catalogURL.hostname!=='127.0.0.1'||catalogURL.protocol!=='http:')throw new Error('Use a read-only existing loopback catalog');
const response=await fetch(catalogOrigin+'/catalog-api/v1/catalogs/current',{headers:{Accept:'application/json'}});
if(!response.ok)throw new Error('Existing local published catalog is unavailable: '+response.status);
const publication=await response.json();
const environment={...process.env,INTERIORS_TELEGRAM_BOT_ID:'7342037359',INTERIORS_TELEGRAM_ENVIRONMENT:'production',INTERIORS_TELEGRAM_LINK:'https://t.me/example_test_bot',INTERIORS_WEB_URL:'https://example.invalid/editor',INTERIORS_TELEGRAM_OUTPUT:output,TMA_CATALOG_RESULT_DIR:join(root,'results'),TMA_CATALOG_REPORT:join(root,'report.json')};
async function run(args,extra={}){const child=spawn(process.execPath,args,{env:{...environment,...extra},stdio:'inherit'});const [code,signal]=await once(child,'exit');if(code!==0)throw new Error('Telegram catalog proof failed ('+(code??signal)+'); artifacts '+root);}
await run([resolve('node_modules/@rspack/cli/bin/rspack.js'),'build','--mode','production','--config','rspack.telegram-entry-verification.config.mjs']);
const preview=await createTelegramPreviewServer({directory:output,catalogOrigin});
await new Promise(done=>preview.server.listen(0,'127.0.0.1',done));
const origin='http://127.0.0.1:'+preview.server.address().port;
await writeFile(join(root,'fixture.json'),JSON.stringify({origin,output,catalogOrigin,catalogVersion:publication.catalogVersion,envelopeEtag:response.headers.get('etag'),assetCount:publication.assets.length,productionTarget:true,publishedSignedTestVector:true,historicalClock:true,physicalTelegram:false,controlPlaneReadOnly:true},null,2));
try{await run([resolve('node_modules/@playwright/test/cli.js'),'test','--config','playwright.telegram-catalog.config.mjs',...process.argv.slice(2)],{TMA_CATALOG_BASE_URL:origin});}finally{await preview.close();process.stdout.write('Telegram catalog proof artifacts: '+root+'\n');}
