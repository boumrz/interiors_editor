import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { createRequire } from 'node:module';
import { runInNewContext } from 'node:vm';
const require = createRequire(import.meta.url);
const loader = require('./telegram-readonly-subject-loader.cjs');
function append(context, name, source) {
 const output = loader.call({ cacheable() {}, resourcePath: `/fixture/${name}.ts` }, source);
 runInNewContext(`(()=>{${output}\n})()`, context);
 return createHash('sha256').update(source).digest('hex');
}
test('actual source markers retain both subject identities instead of overwriting one module', () => {
 const context = {};
 const main = append(context, 'telegram-readonly-project-source', 'const subject = "reader";');
 const helper = append(context, 'telegram-readonly-project-snapshot', 'const subject = "snapshot";');
 assert.deepEqual(Object.keys(context.__telegramReadonlySubjects).sort(), ['telegram-readonly-project-snapshot', 'telegram-readonly-project-source']);
 assert.equal(context.__telegramReadonlySubjects['telegram-readonly-project-source'].sha, main);
 assert.equal(context.__telegramReadonlySubjects['telegram-readonly-project-snapshot'].sha, helper);
 assert.equal(context.__telegramReadonlySubjects['telegram-readonly-project-source'].readActive(), null);
});
test('active mutation evidence comes from each lexical module namespace rather than an unrelated global marker', () => {
 const context = { __stryker__: { activeMutant: 'global-wrong' } };
 append(context, 'telegram-readonly-project-source', 'function stryNS_9fa48(){return {activeMutant:"17"}}');
 append(context, 'telegram-readonly-project-snapshot', 'function stryNS_9fa48(){return {activeMutant:"18"}}');
 assert.equal(context.__telegramReadonlySubjects['telegram-readonly-project-source'].instrumented, true);
 assert.equal(context.__telegramReadonlySubjects['telegram-readonly-project-source'].readActive(), '17');
 assert.equal(context.__telegramReadonlySubjects['telegram-readonly-project-snapshot'].readActive(), '18');
});
