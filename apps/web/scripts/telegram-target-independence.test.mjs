import assert from 'node:assert/strict';
import {test} from 'node:test';
import {mkdtemp,copyFile,mkdir,symlink,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join,resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import {spawnSync} from 'node:child_process';

// A config-loading contract, not a replacement for an actual production build.
async function isolatedConfiguration(assertion) {
 const original=resolve(fileURLToPath(new URL('..',import.meta.url)));
 const directory=await mkdtemp(join(tmpdir(),'interiors-tma-config-no-pwa-'));
 try {
  await mkdir(join(directory,'scripts'));
  for(const name of ['package.json','rspack.config.mjs','rspack.telegram.config.mjs','scripts/check-runtime.mjs','scripts/telegram-release-build.mjs','scripts/telegram-sdk-asset.mjs']) await copyFile(join(original,name),join(directory,name));
  await symlink(join(original,'node_modules'),join(directory,'node_modules'),'dir');
  const child=spawnSync(process.execPath,['--input-type=module','-e',assertion],{cwd:directory,encoding:'utf8',timeout:30000,env:{...process.env,INTERIORS_TELEGRAM_OUTPUT:join(directory,'dist-telegram')}});
  assert.equal(child.signal,null,child.stderr);assert.equal(child.status,0,child.stderr||child.stdout);
 } finally { await rm(directory,{recursive:true,force:true}); }
}
test('Telegram configuration loads without browser entry, HTML, manifest or worker template',async()=>{
 await isolatedConfiguration(`import assert from 'node:assert/strict';import configure from './rspack.telegram.config.mjs';const target=configure({}, {mode:'production'});assert.deepEqual(target.entry,{telegram:'./src/telegram-main.tsx'});assert.equal(target.output.clean,false);assert.equal(target.plugins.some(plugin=>plugin.constructor.name==='InteriorsServiceWorkerPlugin'),false);assert.equal(target.plugins.some(plugin=>plugin.constructor.name==='TelegramReleasePlugin'),true);`);
});
test('browser compilation still requires its actual worker template',async()=>{
 await isolatedConfiguration(`import assert from 'node:assert/strict';import configure from './rspack.config.mjs';const target=configure({}, {mode:'production'});const worker=target.plugins.find(plugin=>plugin.constructor.name==='InteriorsServiceWorkerPlugin');assert.ok(worker);assert.throws(()=>worker.apply({}),{code:'ENOENT'});`);
});
