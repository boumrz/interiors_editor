import './check-runtime.mjs';
import { spawn } from 'node:child_process';
import { once } from 'node:events';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
const root = await mkdtemp(join(tmpdir(), 'interiors-tma-glb-bounds-mutation-'));
try {
  const child = spawn(process.execPath, [resolve('node_modules/@stryker-mutator/core/bin/stryker.js'), 'run', 'stryker.telegram-glb-bounds.config.mjs'], {
    stdio: 'inherit',
    env: { ...process.env, TMPDIR: root, TMP: root, TEMP: root, INTERIORS_TELEGRAM_GLB_BOUNDS_MUTATION_ROOT: root }
  });
  const [code, signal] = await once(child, 'exit');
  if (code !== 0) throw new Error(`GLB bounds mutation gate stopped (${code ?? signal})`);
} finally {
  await rm(root, { recursive: true, force: true });
}
