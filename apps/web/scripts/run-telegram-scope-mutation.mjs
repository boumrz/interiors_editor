import './check-runtime.mjs';
import { spawn } from 'node:child_process';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { once } from 'node:events';

// The parent owns fixtures even if a timed-out command worker is SIGKILLed.
const runRoot = await mkdtemp(join(tmpdir(), 'interiors-tma-scope-mutation-run-'));
const projectProtocol = process.argv[2] === '--project';
const configuration = projectProtocol ? 'stryker.telegram-project.config.mjs' : 'stryker.telegram-scope.config.mjs';
const child = spawn(process.execPath, [resolve('node_modules/@stryker-mutator/core/bin/stryker.js'), 'run', configuration, ...process.argv.slice(projectProtocol ? 3 : 2)], {
  env: { ...process.env, TMPDIR: runRoot, TMP: runRoot, TEMP: runRoot, INTERIORS_TMA_MUTATION_ROOT: runRoot },
  stdio: 'inherit'
});
const interrupt = () => child.kill('SIGINT');
process.on('SIGINT', interrupt);
try {
  const [code] = await once(child, 'exit');
  process.exitCode = code ?? 130;
} finally {
  process.off('SIGINT', interrupt);
  await rm(runRoot, { recursive: true, force: true });
}
