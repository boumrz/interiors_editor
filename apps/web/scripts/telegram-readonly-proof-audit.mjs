import { readFile } from 'node:fs/promises';
import { resolve, join, sep } from 'node:path';
import { isDeepStrictEqual } from 'node:util';

export const readonlyProofSetupError = /Build errors:|unable to locate|ERROR in |Module not found|Cannot find module|failed to compile|READONLY_PROOF_INVALID:|browserType\.launch:|Executable doesn't exist/i;

/** Verification infrastructure only: a parser success never establishes native product behavior. */
export async function auditReadonlyNativeProof({ runRoot, subjects, active, expectedCases, exitCode, text, allowFailurePrefix = false }) {
 if (!Number.isSafeInteger(expectedCases) || expectedCases <= 0) throw new Error('Declared native corpus size is required');
 if (exitCode !== 0 && exitCode !== 1) throw new Error('Unsupported native process exit cannot count as behavior');
 if (readonlyProofSetupError.test(text)) throw new Error('General build/setup failure cannot count as behavior');
 const report = JSON.parse(await readFile(join(runRoot, 'report.json'), 'utf8'));
 const attachments = [], testResults = [];
 function visit(suite) {
  for (const spec of suite.specs ?? []) for (const test of spec.tests ?? []) for (const result of test.results ?? []) {
   testResults.push({ title: spec.title, status: result.status, errors: result.errors, error: result.error });
   const markers = (result.attachments ?? []).filter(attachment => attachment.name === 'readonly-activation');
   if (markers.length !== 1) throw new Error('Every started case needs exactly one activation');
   attachments.push(markers[0]);
  }
  for (const child of suite.suites ?? []) visit(child);
 }
 for (const suite of report.suites ?? []) visit(suite);
 // Playwright reports this exact metadata after its declared first actual failure.
 // Retain the original errors in `report`; never exempt unknown process/setup errors.
 const stripAnsi = value => value.replace(/\u001b\[[0-9;]*m/g, '');
 const isKnownBehaviorStop = error => allowFailurePrefix && typeof active === 'string' && /^\d+$/.test(active) && exitCode === 1 && report.stats?.unexpected === 1 && typeof error?.message === 'string' && stripAnsi(error.message) === 'Testing stopped early after 1 maximum allowed failures.';
 if ((report.errors ?? []).some(error => !isKnownBehaviorStop(error)) || readonlyProofSetupError.test(JSON.stringify(report))) throw new Error('Reporter/setup errors invalidate native proof');
 const activations = [];
 for (const attachment of attachments) {
  if (attachment.contentType !== undefined && attachment.contentType !== 'application/json') throw new Error('Unexpected activation attachment type');
  let content;
  if (attachment.body !== undefined) {
   if (attachment.path !== undefined || typeof attachment.body !== 'string') throw new Error('Ambiguous activation attachment');
   content = Buffer.from(attachment.body, 'base64').toString('utf8');
  } else {
   const path = attachment.path && resolve(attachment.path);
   if (!path || !path.startsWith(resolve(runRoot) + sep)) throw new Error('Activation attachment escaped its owned output');
   content = await readFile(path, 'utf8');
  }
  const row = JSON.parse(content), actualKeys = Object.keys(row.actual ?? {}).sort(), expectedKeys = Object.keys(subjects).sort();
  if (row.valid !== true || row.title !== testResults[activations.length].title || !isDeepStrictEqual(row.expected, subjects) || row.active !== active || !isDeepStrictEqual(actualKeys, expectedKeys)) throw new Error('Incomplete or mismatched actual subject activation');
  for (const [key, expected] of Object.entries(subjects)) {
   if (!isDeepStrictEqual(row.actual[key], { ...expected, active: expected.instrumented ? active : null })) throw new Error('Actual module source/namespace mismatch');
  }
  activations.push(row);
 }
 if (!testResults.length || testResults.length > expectedCases || testResults.some(result => !['passed', 'failed', 'timedOut'].includes(result.status))) throw new Error('Skipped, interrupted or incomplete started corpus');
 if (testResults.some(result => result.status === 'timedOut')) throw new Error('Native timeout remains unproven and requires separate causality and terminal-ownership review');
 const failed = testResults.filter(result => result.status === 'failed');
 if (exitCode === 0) {
  if (failed.length || testResults.length !== expectedCases || report.stats?.skipped || report.stats?.flaky) throw new Error('Success requires the complete declared corpus');
 } else {
  if (!failed.length || failed.some(result => !result.error && !result.errors?.length)) throw new Error('Nonzero exit lacks an actual behavioral failure');
  if (testResults.length !== expectedCases && !allowFailurePrefix) throw new Error('Failure prefix was not explicitly allowed');
 }
 return { report, activations, testResults };
}
