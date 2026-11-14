import './check-runtime.mjs';
import { spawn } from 'node:child_process';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { once } from 'node:events';
// This parent owns only its exact generated fixture root, including timed-out workers.
const root = await mkdtemp(join(tmpdir(), 'interiors-browser-registered-mutation-'));
const child = spawn(process.execPath, [resolve('node_modules/@stryker-mutator/core/bin/stryker.js'), 'run', 'stryker.browser-registered-storage.config.mjs', ...process.argv.slice(2)], {
  env: { ...process.env, TMPDIR: root, TMP: root, TEMP: root, INTERIORS_BROWSER_REGISTERED_MUTATION_ROOT: root, INTERIORS_BROWSER_REGISTERED_TEST_ROOT: root, BROWSER_REGISTERED_MUTATION_AUDIT: resolve('reports/browser-bootstrap/mutation-activation.jsonl') },
  stdio: 'inherit'
});
const interrupt = () => child.kill('SIGINT');
process.on('SIGINT', interrupt);
try {
  const [code] = await once(child, 'exit');
  process.exitCode = code ?? 130;
} finally {
  process.off('SIGINT', interrupt);
  await rm(root, { recursive: true, force: true });
}
