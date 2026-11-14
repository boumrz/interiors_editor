import { spawn } from 'node:child_process';
import { createServer } from 'node:http';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { basename, join, resolve } from 'node:path';
import { once } from 'node:events';

// Command-runner bridge: each Stryker mutant is compiled into a fresh test-only
// bundle and exercised by native Chromium IDB/Web Locks. No live dist/server.
const fixtureRoot = await mkdtemp(join(process.env.INTERIORS_TMA_MUTATION_ROOT ?? tmpdir(), 'interiors-editor-contact-'));
let server;
async function run(executable, arguments_, environment = process.env) {
  const child = spawn(executable, arguments_, { env: environment, stdio: 'inherit' });
  const [code, signal] = await once(child, 'exit');
  if (code !== 0) throw new Error(`Storage mutation check failed (${code ?? signal})`);
}
try {
  await run(process.execPath, [resolve('node_modules/@rspack/cli/bin/rspack.js'), 'build', '--mode', 'development', '--config', 'rspack.editor-contact-test.config.mjs', '--output-path', fixtureRoot]);
  server = createServer(async (request, response) => {
    try {
      const pathname = new URL(request.url, 'http://127.0.0.1').pathname;
      const file = pathname === '/' ? 'index.html' : pathname.slice(1);
      if (!file || basename(file) !== file) { response.writeHead(404).end(); return; }
      const bytes = await readFile(join(fixtureRoot, file));
      response.writeHead(200, {
        'Content-Type': file.endsWith('.html') ? 'text/html' : file.endsWith('.js') ? 'text/javascript' : file.endsWith('.css') ? 'text/css' : 'application/octet-stream',
        'Cache-Control': 'no-store'
      }).end(bytes);
    } catch { response.writeHead(404).end(); }
  });
  server.listen(0, '127.0.0.1');
  await once(server, 'listening');
  const address = server.address();
  if (!address || typeof address === 'string') throw new Error('No isolated test port');
  await run(process.execPath, [resolve('node_modules/@playwright/test/cli.js'), 'test', '--config', 'playwright.editor-contact.config.mjs', '--grep', process.env.EDITOR_CONTACT_GREP ?? 'CONTACT', ...(process.env.EDITOR_CONTACT_FAIL_FAST === '1' ? ['--max-failures=1'] : [])], {
    ...process.env,
    PLAYWRIGHT_CONTACT_BASE_URL: `http://127.0.0.1:${address.port}`,
    PLAYWRIGHT_CONTACT_OUTPUT_DIR: join(fixtureRoot, 'results')
  });
} finally {
  if (server) await new Promise((done) => { server.closeAllConnections(); server.close(done); });
  await rm(fixtureRoot, { recursive: true, force: true });
}
