import { execFileSync } from 'node:child_process';
import { lstatSync, readFileSync, readlinkSync } from 'node:fs';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

const MiB = 1024 * 1024;
const secretPatterns = [
  ['private-key', /-----BEGIN (?:RSA |OPENSSH |EC |DSA |ENCRYPTED )?PRIVATE KEY-----/],
  ['github-token', /\b(?:gh[pousr]_[A-Za-z0-9_]{30,}|github_pat_[A-Za-z0-9_]{30,})\b/],
  ['aws-access-key', /\b(?:AKIA|ASIA)[A-Z0-9]{16}\b/],
  ['telegram-bot-token', /\b\d{8,12}:[A-Za-z0-9_-]{30,}\b/],
  ['npm-auth-token', /\/\/[^\r\n=]+:_authToken\s*=\s*(?!\$\{)[A-Za-z0-9_-]{16,}/]
];

function pathIssue(path) {
  const name = path.split('/').at(-1);
  if (
    (name === '.env' || name.startsWith('.env.')) &&
    !['.env.example', '.env.sample', '.env.template'].includes(name)
  ) return 'sensitive-file';
  if (
    /(?:^|\/)(?:\.ssh|\.aws)(?:\/|$)/.test(path) ||
    /^(?:id_rsa|id_ed25519)(?:\.pub)?$/.test(name) ||
    /\.(?:pem|key|p12|pfx)$/i.test(name)
  ) return 'sensitive-file';
  if (
    /(?:^|\/)(?:node_modules|\.stryker-tmp|\.gradle|\.kotlin)(?:\/|$)/.test(path) ||
    /^(?:\.playwright-cli|\.playwright-mcp|test-results|output\/playwright)\//.test(path) ||
    /^apps\/web\/(?:dist|dist-telegram|test-results|playwright-report|reports\/(?:mutation|coverage))\//.test(path) ||
    /^apps\/catalog-control-plane\/build\//.test(path)
  ) return 'local-output';
}

// No credentials or offending source lines are included in the returned report.
// --staged reads blobs from Git's index, so cleaning a working file cannot hide
// a secret which would still be part of the next commit.
export function auditRepository({
  cwd = process.cwd(),
  staged = false,
  maxFileBytes = 50 * MiB,
  maxTotalBytes = 200 * MiB
} = {}) {
  const git = (args, options = {}) => execFileSync('git', args, {
    cwd,
    maxBuffer: Math.max(maxFileBytes + MiB, 10 * MiB),
    ...options
  });
  cwd = git(['rev-parse', '--show-toplevel']).toString().trim();
  const entries = new Map();
  const issues = [];
  if (staged) {
    for (const entry of git(['ls-files', '--stage', '-z']).toString().split('\0').filter(Boolean)) {
      const tab = entry.indexOf('\t');
      const [mode, oid, stage] = entry.slice(0, tab).split(' ');
      const path = entry.slice(tab + 1);
      const previous = entries.get(path);
      entries.set(path, { mode, oid, unmerged: stage !== '0' || previous?.unmerged });
    }
  } else {
    for (const path of git(['ls-files', '--cached', '--others', '--exclude-standard', '-z'])
      .toString().split('\0').filter(Boolean)) entries.set(path, {});
  }

  let bytes = 0;
  let files = 0;
  for (const [path, entry] of entries) {
    files += 1;
    if (entry.unmerged) {
      issues.push({ path, reason: 'unmerged-index' });
      continue;
    }
    const unsafe = pathIssue(path);
    if (unsafe) {
      issues.push({ path, reason: unsafe });
      continue;
    }
    let size;
    let read;
    if (staged) {
      if (!['100644', '100755', '120000'].includes(entry.mode)) {
        issues.push({ path, reason: 'unsupported-file-type' });
        continue;
      }
      size = Number(git(['cat-file', '-s', entry.oid]).toString().trim());
      read = () => git(['cat-file', 'blob', entry.oid]);
    } else {
      let stat;
      try { stat = lstatSync(resolve(cwd, path)); }
      catch (error) {
        if (error.code === 'ENOENT') { files -= 1; continue; }
        throw error;
      }
      if (!stat.isFile() && !stat.isSymbolicLink()) {
        issues.push({ path, reason: 'unsupported-file-type' });
        continue;
      }
      size = stat.size;
      read = () => stat.isSymbolicLink()
        ? Buffer.from(readlinkSync(resolve(cwd, path)))
        : readFileSync(resolve(cwd, path));
    }
    bytes += size;
    if (size > maxFileBytes) {
      issues.push({ path, reason: 'file-too-large' });
      continue;
    }
    // Scan ASCII credential markers in binary containers as well as text.
    const text = read().toString('latin1');
    for (const [name, pattern] of secretPatterns) {
      if (pattern.test(text)) issues.push({ path, reason: `secret:${name}` });
    }
  }
  if (bytes > maxTotalBytes) issues.push({ path: '.', reason: 'repository-too-large' });
  return { files, bytes, issues };
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  const arguments_ = process.argv.slice(2);
  if (arguments_.some((argument) => argument !== '--staged')) {
    process.stderr.write('Usage: node scripts/check-repository.mjs [--staged]\n');
    process.exitCode = 2;
  } else {
    try {
      const result = auditRepository({ staged: arguments_.includes('--staged') });
      process.stdout.write(`${result.files} candidate files; ${(result.bytes / MiB).toFixed(1)} MiB\n`);
      for (const issue of result.issues) {
        process.stderr.write(`${issue.reason}: ${JSON.stringify(issue.path)}\n`);
      }
      if (result.issues.length) process.exitCode = 1;
      else process.stdout.write('Repository content checks passed.\n');
    } catch {
      process.stderr.write('Repository content checks could not read the Git repository.\n');
      process.exitCode = 1;
    }
  }
}
