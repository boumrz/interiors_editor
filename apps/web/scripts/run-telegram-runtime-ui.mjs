import './check-runtime.mjs';
import { spawn } from 'node:child_process';
import { once } from 'node:events';
import { createServer } from 'node:http';
import { mkdtemp, readFile, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve, sep } from 'node:path';

const runRoot = await mkdtemp(join(tmpdir(), 'interiors-tma-ui-proof-'));
const output = join(runRoot, 'dist');
const environment = { ...process.env, TMA_UI_RUN_ROOT: runRoot, TMA_UI_DIST_DIR: output, TMA_UI_OUTPUT_DIR: join(runRoot, 'results'), TMA_UI_REPORT: join(runRoot, 'report.json') };
async function run(arguments_, extra = {}) {
  const child = spawn(process.execPath, arguments_, { env: { ...environment, ...extra }, stdio: 'inherit' });
  const [code, signal] = await once(child, 'exit');
  if (code !== 0) throw new Error(`Isolated UI proof failed (${code ?? signal}); artifacts ${runRoot}`);
}
await run([resolve('node_modules/@rspack/cli/bin/rspack.js'), 'build', '--mode', 'development', '--config', 'rspack.telegram-runtime-ui-test.config.mjs']);
const server = createServer(async (request, response) => {
  try {
    const pathname = decodeURIComponent(new URL(request.url, 'http://127.0.0.1').pathname);
    const file = resolve(output, `.${pathname === '/' ? '/index.html' : pathname}`);
    if (!file.startsWith(`${output}${sep}`)) { response.writeHead(404).end(); return; }
    const bytes = await readFile(file);
    response.writeHead(200, { 'Content-Type': file.endsWith('.html') ? 'text/html' : file.endsWith('.js') ? 'text/javascript' : file.endsWith('.css') ? 'text/css' : 'application/octet-stream', 'Cache-Control': 'no-store' }).end(bytes);
  } catch { response.writeHead(404).end(); }
});
await new Promise((resolveListen) => server.listen(0, '127.0.0.1', resolveListen));
const address = server.address();
if (!address || typeof address === 'string') throw new Error('No isolated loopback port');
const baseURL = `http://127.0.0.1:${address.port}`;
await writeFile(join(runRoot, 'fixture.json'), JSON.stringify({ baseURL, output, syntheticScopes: true, signedLaunchProof: false, physicalTelegram: false }, null, 2));
try {
  await run([resolve('node_modules/@playwright/test/cli.js'), 'test', '--config', 'playwright.telegram-runtime-ui.config.mjs', ...process.argv.slice(2)], { TMA_UI_BASE_URL: baseURL });
} finally {
  server.closeAllConnections(); await new Promise((resolveClose) => server.close(resolveClose));
  process.stdout.write(`UI proof artifacts: ${runRoot}\n`);
}
