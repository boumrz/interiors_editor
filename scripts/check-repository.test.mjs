import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import test from 'node:test';
import { auditRepository } from './check-repository.mjs';

function fixture(t) {
  const cwd = mkdtempSync(join(tmpdir(), 'interiors-repository-check-'));
  t.after(() => rmSync(cwd, { recursive: true, force: true }));
  execFileSync('git', ['init', '--quiet', cwd]);
  return {
    cwd,
    write(path, value) {
      mkdirSync(dirname(join(cwd, path)), { recursive: true });
      writeFileSync(join(cwd, path), value);
    },
    stage(path, force = false) {
      execFileSync('git', ['add', ...(force ? ['--force'] : []), '--', path], { cwd });
    }
  };
}

test('checks source candidates while respecting ignores and safe environment examples', (t) => {
  const repo = fixture(t);
  repo.write('.gitignore', '.env\nnode_modules/\n');
  repo.write('.env', 'DATABASE_PASSWORD=local-only');
  repo.write('.env.example', 'DATABASE_PASSWORD=replace-me');
  repo.write('node_modules/dependency/index.js', 'generated dependency');
  repo.write('src/main.js', 'export const answer = 42;');
  const result = auditRepository({ cwd: repo.cwd });
  assert.deepEqual(result.issues, []);
  assert.equal(result.files, 3);
});

test('rejects environment files and private key filenames without reading their values into diagnostics', (t) => {
  const repo = fixture(t);
  repo.write('.env.production', 'PRIVATE_VALUE=do-not-display-this');
  repo.write('credentials/id_ed25519', 'do-not-display-this-either');
  const result = auditRepository({ cwd: repo.cwd });
  assert.equal(result.issues.length, 2);
  assert.ok(result.issues.every((issue) => issue.reason === 'sensitive-file'));
  assert.doesNotMatch(JSON.stringify(result), /do-not-display/);
});

test('checks exact staged bytes even after the working file has been cleaned', (t) => {
  const repo = fixture(t);
  const token = ['gh', 'p_', 'A'.repeat(36)].join('');
  repo.write('config.txt', token);
  repo.stage('config.txt');
  repo.write('config.txt', 'clean working content');
  assert.deepEqual(auditRepository({ cwd: repo.cwd }).issues, []);
  const result = auditRepository({ cwd: repo.cwd, staged: true });
  assert.deepEqual(result.issues, [{ path: 'config.txt', reason: 'secret:github-token' }]);
  assert.ok(!JSON.stringify(result).includes(token));
});

test('recognizes private key material in an otherwise ordinary source filename', (t) => {
  const repo = fixture(t);
  repo.write('config.txt', ['-----BEGIN OPENSSH ', 'PRIVATE KEY-----'].join(''));
  assert.deepEqual(auditRepository({ cwd: repo.cwd }).issues, [
    { path: 'config.txt', reason: 'secret:private-key' }
  ]);
});

test('a binary prefix cannot hide a plaintext credential', (t) => {
  const repo = fixture(t);
  repo.write('binary.dat', Buffer.concat([
    Buffer.from([0, 255]),
    Buffer.from(['AK', 'IA', 'A'.repeat(16)].join(''))
  ]));
  assert.deepEqual(auditRepository({ cwd: repo.cwd }).issues, [
    { path: 'binary.dat', reason: 'secret:aws-access-key' }
  ]);
});

test('rejects oversized files before trying to scan their contents', (t) => {
  const repo = fixture(t);
  repo.write('archive.bin', Buffer.alloc(21));
  assert.deepEqual(auditRepository({ cwd: repo.cwd, maxFileBytes: 20 }).issues, [
    { path: 'archive.bin', reason: 'file-too-large' }
  ]);
});

test('enforces a total repository budget across individually allowed files', (t) => {
  const repo = fixture(t);
  repo.write('first.bin', Buffer.alloc(11));
  repo.write('second.bin', Buffer.alloc(11));
  const result = auditRepository({ cwd: repo.cwd, maxFileBytes: 20, maxTotalBytes: 21 });
  assert.equal(result.bytes, 22);
  assert.deepEqual(result.issues, [{ path: '.', reason: 'repository-too-large' }]);
});

test('rejects generated local outputs even when forcibly staged', (t) => {
  const repo = fixture(t);
  repo.write('.gitignore', 'node_modules/\n');
  repo.write('node_modules/dependency/index.js', 'generated dependency');
  repo.stage('node_modules/dependency/index.js', true);
  assert.deepEqual(auditRepository({ cwd: repo.cwd, staged: true }).issues, [
    { path: 'node_modules/dependency/index.js', reason: 'local-output' }
  ]);
});

test('rejects merge-conflicted index entries', (t) => {
  const repo = fixture(t);
  const blob = execFileSync('git', ['hash-object', '-w', '--stdin'], {
    cwd: repo.cwd,
    input: 'conflicted value'
  }).toString().trim();
  execFileSync('git', ['update-index', '--index-info'], {
    cwd: repo.cwd,
    input: `100644 ${blob} 1\tconflict.txt\n100644 ${blob} 2\tconflict.txt\n`
  });
  assert.deepEqual(auditRepository({ cwd: repo.cwd, staged: true }).issues, [
    { path: 'conflict.txt', reason: 'unmerged-index' }
  ]);
});

test('project ignores preserve source and status documents while omitting local evidence copies', (t) => {
  const repo = fixture(t);
  repo.write('.gitignore', readFileSync(new URL('../.gitignore', import.meta.url)));
  const retained = [
    'apps/web/public/catalog/chair.glb',
    'apps/web/tests/fixture.json',
    'docs/progress/current-status.md',
    'docs/progress/release/evidence/README.md',
    '_bmad-output/planning-artifacts/evidence/accepted.json'
  ];
  const local = [
    '.env.production',
    '.pnpm-store/v11/index/cache.json',
    '.playwright-mcp/page.yml',
    'test-results/.last-run.json',
    'apps/web/dist-telegram/index.html',
    'apps/web/reports/readonly-source/native/run-example/native.log',
    'docs/progress/release/raw.tar.gz',
    'docs/progress/release/context/copied.ts',
    'docs/progress/release/report.json'
  ];
  for (const path of [...retained, ...local]) repo.write(path, 'fixture');
  const visible = execFileSync('git', ['ls-files', '--others', '--exclude-standard', '-z'], {
    cwd: repo.cwd
  }).toString().split('\0');
  for (const path of retained) assert.ok(visible.includes(path), `Must retain ${path}`);
  for (const path of local) assert.ok(!visible.includes(path), `Must ignore ${path}`);
});
