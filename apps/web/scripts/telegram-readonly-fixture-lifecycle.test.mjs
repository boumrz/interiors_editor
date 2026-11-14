import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { mkdtemp, rm } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { chromium } from '@playwright/test';
import { createReadonlyFixtureServer } from './telegram-readonly-fixture-server.mjs';

test('schema replacement drains snapshot transactions before close or deletion, including abort', async () => {
  const root = await mkdtemp('/tmp/tma-fixture-');
  const output = join(root, 'dist');
  let browser, server;
  try {
    await promisify(execFile)(process.execPath, [resolve('node_modules/@rspack/cli/bin/rspack.js'), 'build', '--mode', 'development', '--config', 'rspack.telegram-readonly-source-test.config.mjs'], { env: { ...process.env, TMA_READONLY_OUTPUT: output } });
    server = createReadonlyFixtureServer(output);
    await new Promise(done => server.listen(0, '127.0.0.1', done));
    browser = await chromium.launch({ channel: 'chrome', env: { ...process.env, TMPDIR: root, TMP: root, TEMP: root } });
    for (const abort of [false, true]) {
      const context = await browser.newContext();
      try {
        const page = await context.newPage();
        await page.goto(`http://127.0.0.1:${server.address().port}/`);
        await page.evaluate(() => window.__telegramReadonlySource.seed());
        await page.evaluate(abort => {
          const state = { status: 'pending', deletes: 0, closed: false, terminal: false, release: undefined };
          window.__fixtureLifecycle = state;
          const transact = IDBDatabase.prototype.transaction;
          const getAll = IDBObjectStore.prototype.getAll;
          const close = IDBDatabase.prototype.close;
          const remove = indexedDB.deleteDatabase.bind(indexedDB);
          let owned;
          IDBDatabase.prototype.transaction = function (...args) {
            const tx = Reflect.apply(transact, this, args);
            if (!owned && tx.mode === 'readonly') {
              owned = tx;
              let complete, failed;
              Object.defineProperty(tx, 'oncomplete', { set(handler) { complete = handler; } });
              Object.defineProperty(tx, 'onabort', { set(handler) { failed = handler; } });
              for (const type of ['complete', 'abort']) tx.addEventListener(type, event => {
                state.terminal = true;
                const handler = type === 'complete' ? complete : failed;
                if (handler) state.release = () => handler.call(tx, event);
              });
            }
            return tx;
          };
          IDBObjectStore.prototype.getAll = function (...args) {
            const request = Reflect.apply(getAll, this, args);
            if (abort && this.transaction === owned) request.addEventListener('success', () => owned.abort());
            return request;
          };
          IDBDatabase.prototype.close = function () {
            if (this === owned?.db) state.closed = true;
            return Reflect.apply(close, this, []);
          };
          indexedDB.deleteDatabase = name => { state.deletes += 1; return remove(name); };
          void window.__telegramReadonlySource.schemaFault('autoincrement').then(
            () => { state.status = 'fulfilled'; }, () => { state.status = 'rejected'; });
        }, abort);
        await page.waitForFunction(() => window.__fixtureLifecycle.status !== 'pending' || typeof window.__fixtureLifecycle.release === 'function');
        assert.deepEqual(await page.evaluate(() => {
          const { status, deletes, closed, terminal } = window.__fixtureLifecycle;
          return { status, deletes, closed, terminal };
        }), { status: 'pending', deletes: 0, closed: false, terminal: true });
        await page.evaluate(() => window.__fixtureLifecycle.release());
        await page.waitForFunction(() => window.__fixtureLifecycle.status !== 'pending');
        assert.deepEqual(await page.evaluate(() => {
          const { status, deletes, closed } = window.__fixtureLifecycle;
          return { status, deletes, closed };
        }), { status: abort ? 'rejected' : 'fulfilled', deletes: abort ? 0 : 1, closed: true });
      } finally { await context.close(); }
    }
  } finally {
    if (browser) await browser.close();
    if (server) { server.closeAllConnections(); await new Promise(done => server.close(done)); }
    await rm(root, { recursive: true, force: true });
  }
});
