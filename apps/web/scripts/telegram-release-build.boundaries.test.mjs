import assert from 'node:assert/strict';
import {test} from 'node:test';
import {createHash} from 'node:crypto';
import {readFileSync} from 'node:fs';
import {rspack} from '@rspack/core';
import {sealTelegramRelease,telegramPublicConfiguration,TelegramReleasePlugin} from './telegram-release-build.mjs';

const productionWorkflow = readFileSync(
  new URL('../../../.github/workflows/deploy.yml', import.meta.url),
  'utf8',
);

test('main validates and packages the exact Telegram target', () => {
  assert.match(productionWorkflow, /^on:\n  push:\n    branches: \[main\]$/m);
  const telegramBuild = productionWorkflow
    .split(/\n(?= {6}- )/)
    .find(step => step.includes('--config rspack.telegram.config.mjs'));
  assert.ok(telegramBuild, 'Expected the production Telegram build step');
  assert.match(telegramBuild, /^ +INTERIORS_EXACT_FLOOR_YAW: ['"]1['"]$/m);
  assert.match(productionWorkflow, /run-telegram-entry\.mjs/);
  assert.match(productionWorkflow, /run-telegram-runtime-ui\.mjs --grep 'TMA-'/);
  const legalProof = productionWorkflow
    .split(/\n(?= {6}- )/)
    .filter(step => step.includes('scripts/legal-document-delivery.test.mjs'));
  assert.equal(legalProof.length, 1);
  assert.match(legalProof[0], /--test-name-pattern '\^Telegram publishes the unmodified legal editions'/);
  assert.match(productionWorkflow, /frontend\.py package-telegram\s+--telegram /);
  assert.doesNotMatch(productionWorkflow, /\.github\/workflows\/(verify|telegram-quality)\.yml|gradlew|(?:pnpm |npm )run (?:build|test:e2e)\b|run-browser-[\w-]+\.mjs/);
});

test('production delivers only the commit-bound Telegram archive after the freshness check', () => {
  assert.match(productionWorkflow, /^concurrency:\n  group: interiors-production\n  cancel-in-progress: false$/m);
  assert.match(productionWorkflow, /^    environment:\n      name: production$/m);
  const artifacts = [...productionWorkflow.matchAll(/^ +name: ((?:telegram|frontend|catalog)-\$\{\{ github\.sha \}\})$/gm)];
  assert.deepEqual(artifacts.map(match => match[1]), [
    'telegram-${{ github.sha }}',
    'telegram-${{ github.sha }}',
  ]);
  const freshnessCheck = productionWorkflow.indexOf('git/ref/heads/main');
  const send = productionWorkflow.indexOf('"deploy-telegram $GITHUB_SHA $digest $size"');
  const smoke = productionWorkflow.indexOf('frontend.py smoke-telegram');
  assert.ok(freshnessCheck >= 0 && freshnessCheck < send && send < smoke);
  assert.match(productionWorkflow, /test "\$current" = "\$GITHUB_SHA"/);
  assert.match(productionWorkflow, /StrictHostKeyChecking=yes/);
  assert.match(productionWorkflow, /--receipt "\$RUNNER_TEMP\/interiors-release\/deployment-receipt\.json"/);
  assert.doesNotMatch(productionWorkflow, /frontend\.tar\.gz|catalog\.tar\.gz|project\.tar\b/);
});
const entry='/telegram.1234abcd.js';
const template=`<html><script src="${entry}"></script><script id="telegram-loaded-release" type="application/json">__TELEGRAM_RELEASE_CAPSULE__</script><script id="telegram-deployment" type="application/json">__TELEGRAM_DEPLOYMENT__</script>__TELEGRAM_FALLBACK_LINKS__</html>`;
const assets=new Map([[entry,Buffer.from('entry')],['/lazy.a.js',Buffer.from([1,2,3])]]);
const seal=(extra={})=>sealTelegramRelease({html:template,entryPath:entry,assets,configuration:telegramPublicConfiguration({}),...extra});
const sha=bytes=>createHash('sha256').update(bytes).digest('hex');
function pluginFixture({files=['telegram.1234abcd.js'],html=template,missingHtml=false,bufferHtml=false}={}){const emitted=new Map([...assets].map(([path,bytes])=>[path.slice(1),new rspack.sources.RawSource(bytes)]));if(!missingHtml)emitted.set('index.html',{source:()=>bufferHtml?Buffer.from(html):html,buffer:()=>Buffer.from(String(html))});let stage;const compilation={entrypoints:new Map([['telegram',{getFiles:()=>files}]]),hooks:{processAssets:{tap(options,callback){stage=options.stage;callback();}}},getAsset(name){const source=emitted.get(name);return source?{source}:undefined;},getAssets:()=>[...emitted].map(([name,source])=>({name,source})),updateAsset(name,source){assert.equal(name,'index.html');assert.equal(emitted.has(name),true);emitted.set(name,source);},emitAsset(name,source){assert.equal(emitted.has(name),false);emitted.set(name,source);}};return{emitted,apply(){new TelegramReleasePlugin(telegramPublicConfiguration({})).apply({hooks:{thisCompilation:{tap(_name,callback){callback(compilation);}}}});},stage:()=>stage};}

test('producer rejects invalid but present entry paths independently of asset membership and HTML linkage',()=>{for(const invalid of ['/prefixtelegram.1234abcd.js','/telegram.1234abcd.js.suffix','/telegram..js','/telegram.a/b.js','/telegram.1234abcdXjs','telegram.1234abcd.js']){const local=new Map(assets);local.set(invalid,Buffer.from('present invalid entry'));assert.throws(()=>seal({entryPath:invalid,html:template.replace(entry,invalid),assets:local}));}for(const valid of ['/telegram.A_-09.js','/telegram.z.js']){const local=new Map([[valid,Buffer.from('valid')]]);assert.equal(seal({entryPath:valid,html:template.replace(entry,valid),assets:local}).releaseSet.entryPath,valid);}});

test('same-size binary changes at an unchanged inventory address change release identity and every recorded digest is actual',()=>{const first=seal(),changed=new Map(assets);changed.set('/lazy.a.js',Buffer.from([1,9,3]));const second=seal({assets:changed});assert.notEqual(first.manifest.appBuildId,second.manifest.appBuildId);for(const release of [first,second]){const local=release===first?assets:changed;for(const [path,bytes]of local){const record=release.releaseSet.assets.find(row=>row.path===path);assert.equal(record.byteLength,bytes.byteLength);assert.equal(record.sha256,sha(bytes));}}assert.equal(first.releaseSet.assets.length,second.releaseSet.assets.length);assert.equal(first.manifest.appBuildId.length,16);});

test('every template marker and exact entry reference must occur once rather than zero or twice',()=>{for(const marker of ['__TELEGRAM_RELEASE_CAPSULE__','__TELEGRAM_DEPLOYMENT__','__TELEGRAM_FALLBACK_LINKS__',`src="${entry}"`]){for(const count of [0,2]){const html=template.replace(marker,count===0?'':marker+marker);assert.throws(()=>seal({html}));}}});

test('public configuration is immutable and script text safely roundtrips each dangerous literal',()=>{const values={INTERIORS_TELEGRAM_BOT_ID:'<&>\u2028\u2029',INTERIORS_TELEGRAM_ENVIRONMENT:'"</script>',INTERIORS_TELEGRAM_LINK:'',INTERIORS_WEB_URL:''},configuration=telegramPublicConfiguration(values);assert.equal(Object.isFrozen(configuration),true);values.INTERIORS_TELEGRAM_BOT_ID='changed';const output=seal({configuration});const scripts=[...output.html.matchAll(/<script id="(?:telegram-loaded-release|telegram-deployment)" type="application\/json">([^<]*)<\/script>/g)];assert.equal(scripts.length,2);const deployment=scripts[1][1];assert.equal(/[<>&\u2028\u2029]/u.test(deployment),false);assert.deepEqual(JSON.parse(deployment),configuration);assert.equal(configuration.botId,'<&>\u2028\u2029');});

test('actual release plugin accepts Buffer HTML and ignores non-entry prefix/suffix files at the late compilation stage',()=>{const fixture=pluginFixture({bufferHtml:true,files:['prefixtelegram.fake.js','telegram.fake.js.suffix','telegram.js','notes.map','telegram.1234abcd.js']});fixture.apply();assert.equal(fixture.stage(),rspack.Compilation.PROCESS_ASSETS_STAGE_REPORT);assert.deepEqual([...fixture.emitted.keys()].sort(),['index.html','lazy.a.js','release-manifest.json','release-set.json','telegram.1234abcd.js']);const set=JSON.parse(fixture.emitted.get('release-set.json').source()),manifest=JSON.parse(fixture.emitted.get('release-manifest.json').source()),html=fixture.emitted.get('index.html').source();assert.equal(set.entryPath,entry);assert.equal(set.appBuildId,manifest.appBuildId);assert.match(html,/data-telegram-entry="true"/);assert.equal(set.assets.find(row=>row.path==='/index.html').sha256,sha(html));assert.equal(set.assets.find(row=>row.path==='/lazy.a.js').sha256,sha(assets.get('/lazy.a.js')));});

test('release plugin refuses zero or multiple actual target entries before emitting metadata',()=>{for(const files of [[],['lazy.a.js'],['telegram.1234abcd.js','telegram.other.js']]){const fixture=pluginFixture({files});assert.throws(()=>fixture.apply());assert.equal(fixture.emitted.has('release-set.json'),false);assert.equal(fixture.emitted.has('release-manifest.json'),false);}});

test('release plugin refuses missing or nontext HTML while preserving the original compilation assets',()=>{for(const options of [{missingHtml:true},{html:42},{html:{}},{html:null}]){const fixture=pluginFixture(options),before=[...fixture.emitted.keys()];assert.throws(()=>fixture.apply());assert.deepEqual([...fixture.emitted.keys()],before);}});

test('release inventory neither mutates the caller assets nor includes phantom worker or release-set self entries',()=>{const before=[...assets].map(([p,b])=>[p,Buffer.from(b)]),out=seal();assert.deepEqual([...assets],before);assert.equal(assets.has('/index.html'),false);assert.equal(assets.has('/release-manifest.json'),false);assert.deepEqual(out.manifest.minimumCapabilities,['indexeddb']);assert.equal(out.releaseSet.assets.some(row=>row.path==='/sw.js'||row.path==='/manifest.webmanifest'||row.path==='/release-set.json'),false);for(const row of out.releaseSet.assets)assert.equal(/^[a-f0-9]{64}$/.test(row.sha256),true);});

test('entry path must start at the target root even when a nested asset and matching HTML exist',()=>{const nested='/nested/telegram.1234abcd.js';assert.throws(()=>seal({entryPath:nested,html:template.replace(entry,nested),assets:new Map([[nested,Buffer.from('present nested entry')]])}));});

test('pre-editor fallback contains named accessible actions for both configured safe destinations',()=>{const output=seal({configuration:telegramPublicConfiguration({INTERIORS_TELEGRAM_LINK:'https://t.me/example',INTERIORS_WEB_URL:'https://example.invalid/editor'})});const links=[...output.html.matchAll(/<a href="([^"]*)">([^<]*)<\/a>/g)].map(m=>({href:m[1],label:m[2]}));assert.deepEqual(links,[{href:'https://t.me/example',label:'Открыть в Telegram'},{href:'https://example.invalid/editor',label:'Открыть веб-редактор'}]);});

test('unsafe or absent fallback destinations leave the dedicated slot empty with no build placeholders',()=>{const html=template.replace('__TELEGRAM_FALLBACK_LINKS__','<section id="safe-fallback">__TELEGRAM_FALLBACK_LINKS__</section>');for(const[telegramURL,webURL]of[['javascript:alert(1)','https://user@example.invalid/'],['bad-link',''],['','']]){const output=seal({html,configuration:{botId:'',environment:'',telegramURL,webURL}});assert.equal(/<section id="safe-fallback">([^]*)<\/section>/.exec(output.html)?.[1],'');}});

test('an object with a plausible HTML toString still cannot replace the required string or Buffer source',()=>{const fixture=pluginFixture({html:{toString:()=>template}});assert.throws(()=>fixture.apply());assert.equal(fixture.emitted.has('release-set.json'),false);assert.equal(fixture.emitted.has('release-manifest.json'),false);});
