import './check-runtime.mjs';
import { spawn } from 'node:child_process';
import { createServer } from 'node:http';
import { mkdtemp, readFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { basename, join, resolve } from 'node:path';
import { once } from 'node:events';

// Command-runner bridge: each Stryker mutant is compiled into a fresh test-only
// bundle and exercised by native Chromium IDB/Web Locks. No live dist/server.
const fixtureRoot = await mkdtemp(join(process.env.INTERIORS_BROWSER_REGISTERED_TEST_ROOT ?? tmpdir(), 'interiors-browser-registered-project-'));
let server;
async function run(executable, arguments_, environment = process.env) {
  const child = spawn(executable, arguments_, { env: environment, stdio: 'inherit' });
  const [code, signal] = await once(child, 'exit');
  if (code !== 0) throw new Error(`Browser storage check failed (${code ?? signal})`);
}
try {
  await run(process.execPath, [resolve('node_modules/@rspack/cli/bin/rspack.js'), 'build', '--mode', 'development', '--config', 'rspack.browser-registered-project-test.config.mjs', '--output-path', fixtureRoot]);
  server = createServer(async (request, response) => {
    if (request.method !== 'GET' && request.method !== 'HEAD') { response.writeHead(405).end(); return; }
    try {
      const pathname = new URL(request.url, 'http://127.0.0.1').pathname;
      const file = pathname === '/' ? 'index.html' : pathname.slice(1);
      if (!file || basename(file) !== file) { response.writeHead(404).end(); return; }
      const bytes = await readFile(join(fixtureRoot, file));
      response.writeHead(200, {
        'Content-Type': file.endsWith('.html') ? 'text/html' : file.endsWith('.js') ? 'text/javascript' : 'application/octet-stream',
        'Cache-Control': 'no-store'
      }).end(bytes);
    } catch { response.writeHead(404).end(); }
  });
  server.listen(0, '127.0.0.1');
  await once(server, 'listening');
  const address = server.address();
  if (!address || typeof address === 'string') throw new Error('No isolated test port');
  await run(process.execPath, [resolve('node_modules/@playwright/test/cli.js'), 'test', '--config', 'playwright.browser-registered-project.config.mjs', ...process.argv.slice(2)], {
    ...process.env,
    BROWSER_REGISTERED_PROJECT_BASE_URL: `http://127.0.0.1:${address.port}`,
    BROWSER_REGISTERED_PROJECT_OUTPUT_DIR: join(fixtureRoot, 'results')
  });
} finally {
  if (server) await new Promise((done) => { server.closeAllConnections(); server.close(done); });
  process.stdout.write(`Browser registered proof artifacts: ${fixtureRoot}\n`);
}
