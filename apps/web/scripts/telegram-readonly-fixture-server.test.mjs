import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createReadonlyFixtureServer } from './telegram-readonly-fixture-server.mjs';

async function fixture(t) {
 const root = await mkdtemp(join(tmpdir(), 'interiors-readonly-static-test-'));
 const output = join(root, 'dist'); await mkdir(output); await writeFile(join(output, 'index.html'), '<main>readonly fixture</main>'); await writeFile(join(root, 'outside.json'), '{"private":"fixture"}');
 const server = createReadonlyFixtureServer(output);
 await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
 t.after(async () => { server.closeAllConnections(); await new Promise(resolve => server.close(resolve)); await rm(root, { recursive: true, force: true }); });
 return `http://127.0.0.1:${server.address().port}`;
}
test('native fixture serves existing HTML only after reading its bytes', { timeout: 3000 }, async t => {
 const base = await fixture(t), response = await fetch(base);
 assert.equal(response.status, 200); assert.equal(await response.text(), '<main>readonly fixture</main>'); assert.equal(response.headers.get('cache-control'), 'no-store');
});
test('missing assets and escaped paths return 404 without a second header write or HTML fallback', { timeout: 3000 }, async t => {
 const base = await fixture(t);
 for (const path of ['/missing.js', '/favicon.ico', '/catalog-api/missing', '/%2e%2e%2foutside.json']) {
  const response = await fetch(base + path); assert.equal(response.status, 404); assert.equal(await response.text(), '');
 }
 const stillAlive = await fetch(base); assert.equal(stillAlive.status, 200);
});
