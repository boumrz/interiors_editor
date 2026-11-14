import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, writeFile, rm } from 'node:fs/promises';
import { resolve, join } from 'node:path';
import { auditReadonlyNativeProof } from './telegram-readonly-proof-audit.mjs';

// Synthetic report parser controls only. These do not prove a native reader or a mutation detection.
const subjects = { 'telegram-readonly-project-source': { sha: 'a'.repeat(64), instrumented: true }, 'telegram-readonly-project-snapshot': { sha: 'b'.repeat(64), instrumented: true } };
async function fixture(t) {
 const parent = resolve('reports/readonly-source/proof-v2/audit-controls'); await mkdir(parent, { recursive: true });
 const root = await mkdtemp(join(parent, 'call-')); t.after(() => rm(root, { recursive: true, force: true }));
 const actual = Object.fromEntries(Object.entries(subjects).map(([key, value]) => [key, { ...value, active: '7' }]));
 const activation = { title: 'case-one', valid: true, expected: subjects, actual, active: '7' };
 const path = join(root, 'marker.json');
 const result = { status: 'passed', errors: [], attachments: [{ name: 'readonly-activation', path }] };
 const report = { errors: [], stats: { expected: 1, unexpected: 0, skipped: 0, flaky: 0 }, suites: [{ specs: [{ title: 'case-one', tests: [{ results: [result] }] }] }] };
 return { root, activation, report, result, path, async save() { await writeFile(path, JSON.stringify(activation)); await writeFile(join(root, 'report.json'), JSON.stringify(report)); }, audit(options = {}) { return auditReadonlyNativeProof({ runRoot: root, subjects, active: '7', expectedCases: 1, exitCode: 0, text: '', ...options }); } };
}
test('accepts a complete matching audit fixture with actual observations from both modules', async t => { const f = await fixture(t); await f.save(); const result = await f.audit(); assert.equal(result.testResults.length, 1); assert.equal(result.activations.length, 1); });
test('rejects passing output containing general build errors even if module markers passed', async t => { const f = await fixture(t); await f.save(); await assert.rejects(f.audit({ text: 'Build errors: unable to locate evidence-assets/model.glb' })); });
test('independently rejects a false valid flag with a mismatched actual module source', async t => { const f = await fixture(t); f.activation.actual['telegram-readonly-project-snapshot'].sha = 'wrong'; await f.save(); await assert.rejects(f.audit()); });
test('rejects global-only or stale local namespace evidence', async t => { const f = await fixture(t); f.activation.actual['telegram-readonly-project-source'].active = null; await f.save(); await assert.rejects(f.audit()); });
test('rejects skipped passing corpora and missing case activation', async t => { const f = await fixture(t); f.report.stats.skipped = 1; await f.save(); await assert.rejects(f.audit()); f.report.stats.skipped = 0; f.result.attachments = []; await f.save(); await assert.rejects(f.audit()); });
test('rejects a complete but smaller success corpus', async t => { const f = await fixture(t); await f.save(); await assert.rejects(f.audit({ expectedCases: 2 })); });
test('rejects attachment paths outside the owned invocation before reading them', async t => { const f = await fixture(t); f.result.attachments[0].path = resolve(f.root, '../outside.json'); await f.save(); await assert.rejects(f.audit()); });
test('a behavioral failure requires its own valid activation and an actual failed case', async t => { const f = await fixture(t); f.result.status = 'failed'; f.result.errors = [{ message: 'Expected current snapshot to be rejected' }]; f.report.stats = { expected: 0, unexpected: 1, skipped: 0, flaky: 0 }; await f.save(); const result = await f.audit({ exitCode: 1 }); assert.equal(result.testResults[0].status, 'failed'); f.result.status = 'passed'; await f.save(); await assert.rejects(f.audit({ exitCode: 1 })); });


test('accepts the actual inline-base64 body form emitted by pinned Playwright testInfo.attach', async t => { const f = await fixture(t); f.result.attachments = [{ name: 'readonly-activation', contentType: 'application/json', body: Buffer.from(JSON.stringify(f.activation)).toString('base64') }]; await f.save(); const result = await f.audit(); assert.equal(result.activations.length, 1); });

const canonicalStop = '\u001b[31mTesting stopped early after 1 maximum allowed failures.\u001b[39m';
async function stoppedFailure(t) {
 const f = await fixture(t);
 f.result.status = 'failed'; f.result.errors = [{ message: 'Expected corrupt creation receipt to stay unverified' }];
 f.report.errors = [{ message: canonicalStop }];
 f.report.stats = { expected: 0, unexpected: 1, skipped: 1, flaky: 0 };
 return f;
}
test('an active real failure may retain the exact ANSI Playwright maxFailures sentinel and an explicit unstarted suffix', async t => {
 const f = await stoppedFailure(t); await f.save();
 const result = await f.audit({ expectedCases: 2, exitCode: 1, allowFailurePrefix: true });
 assert.equal(result.testResults.length, 1); assert.equal(result.testResults[0].status, 'failed');
 assert.deepEqual(result.report.errors, [{ message: canonicalStop }]);
});
for (const variant of ['unknown-error', 'extra-error', 'baseline', 'nonnumeric-selector', 'unexpected-count', 'no-prefix-permit', 'zero-exit']) {
 test(`canonical stop exception refuses ${variant}`, async t => {
  const f = await stoppedFailure(t); const options = { expectedCases: 2, exitCode: 1, allowFailurePrefix: true };
  if (variant === 'unknown-error') f.report.errors[0].message = 'Testing stopped early after 1 maximum allowed failures. unrelated';
  if (variant === 'extra-error') f.report.errors.push({ message: 'Unexpected browser process exit' });
  if (variant === 'baseline') { options.active = null; f.activation.active = null; for (const actual of Object.values(f.activation.actual)) actual.active = null; }
  if (variant === 'nonnumeric-selector') { options.active = 'control'; f.activation.active = 'control'; for (const actual of Object.values(f.activation.actual)) actual.active = 'control'; }
  if (variant === 'unexpected-count') f.report.stats.unexpected = 2;
  if (variant === 'no-prefix-permit') options.allowFailurePrefix = false;
  if (variant === 'zero-exit') options.exitCode = 0;
  await f.save(); await assert.rejects(f.audit(options), /Reporter\/setup errors/);
 });
}

test('a timed-out Playwright case remains unproven even with a valid active module marker', async t => {
 const f = await stoppedFailure(t); f.result.status = 'timedOut'; f.result.errors = [{ message: 'Test timeout of 15000ms exceeded.' }];
 await f.save();
 await assert.rejects(f.audit({ expectedCases: 2, exitCode: 1, allowFailurePrefix: true }), /timeout.*unproven/i);
});

test('a named failed case cannot turn an unsupported process exit into behavioral evidence', async t => {
 const f = await fixture(t);
 f.result.status = 'failed'; f.result.errors = [{ message: 'Expected retained source' }];
 f.report.stats = { expected: 0, unexpected: 1, skipped: 0, flaky: 0 };
 await f.save();
 for (const exitCode of [2, 137, null, undefined]) await assert.rejects(f.audit({ exitCode }), /Unsupported native process exit/);
});
