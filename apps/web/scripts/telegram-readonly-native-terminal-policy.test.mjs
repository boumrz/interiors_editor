import { test } from 'node:test';
import assert from 'node:assert/strict';
import { rm, stat } from 'node:fs/promises';
import { spawn } from 'node:child_process';
import { once } from 'node:events';
import * as policy from './telegram-readonly-native-terminal-policy.mjs';

test('native browser temporary paths stay short even in a long workspace and TMPDIR', async () => {
  const previous = process.env.TMPDIR;
  process.env.TMPDIR = '/home/runner/work/interiors_editor/interiors_editor/apps/web/reports/readonly-source/native/run-long/tmp';
  let temporaryRoot;
  try {
    temporaryRoot = await policy.createReadonlyNativeTemporary();
    assert.equal((await stat(temporaryRoot)).isDirectory(), true);
    assert.ok(Buffer.byteLength(`${temporaryRoot}/com.google.Chrome.ABCDEF/SingletonSocket`) < 104);
    assert.ok(temporaryRoot.startsWith('/tmp/interiors-tma-ro-'));
    assert.equal((await stat(temporaryRoot)).mode & 0o777, 0o700);
  } finally {
    if (previous === undefined) delete process.env.TMPDIR;
    else process.env.TMPDIR = previous;
    if (temporaryRoot) await rm(temporaryRoot, { recursive: true, force: true });
  }
});

test('terminal scan owns only this invocation temporary profiles and recorded children', () => {
  const runRoot = '/workspace/reports/readonly-source/native/run-ABCDEF';
  const temporaryRoot = '/tmp/interiors-tma-ro-ABCDEF';
  const processes = [
    '11 1 1 node build',
    '12 1 1 chrome --user-data-dir=/tmp/interiors-tma-ro-ABCDEF/profile',
    '13 1 1 chrome --user-data-dir=/private/tmp/interiors-tma-ro-ABCDEF/aliased-profile',
    `14 1 1 chrome --user-data-dir=${runRoot}/tmp/old-profile`,
    '15 1 1 chrome --user-data-dir=/tmp/interiors-tma-ro-ABCDEF-other/profile',
    '16 1 1 chrome --user-data-dir=/tmp/another-invocation/profile'
  ].join('\n');
  assert.deepEqual(policy.readonlyOwnedProcesses(processes, { runRoot, temporaryRoot, pids: [11] }).map(row => row.pid), [11, 12, 13, 14]);
  assert.deepEqual(policy.readonlyOwnedProcesses(processes, { runRoot }).map(row => row.pid), [14]);
});

test('live terminal scan retains the separate temporary ownership boundary', async () => {
  const temporaryRoot = await policy.createReadonlyNativeTemporary();
  const child = spawn(process.execPath, ['-e', 'setInterval(() => {}, 1000)', `${temporaryRoot}/owned-profile`]);
  try {
    await once(child, 'spawn');
    const report = await policy.scanReadonlyTerminal('/workspace/reports/run-owned', [], { temporaryRoot });
    assert.equal(report.temporaryRoot, temporaryRoot);
    assert.ok(report.remaining.some(row => row.pid === child.pid));
  } finally {
    child.kill('SIGTERM');
    await once(child, 'close');
    await rm(temporaryRoot, { recursive: true, force: true });
  }
});
