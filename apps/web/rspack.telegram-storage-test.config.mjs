import sharedConfig from './rspack.shared.config.mjs';
import { rspack } from '@rspack/core';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

// Test-only native IndexedDB/Web Locks harness, never a product entry/release.
export default (environment, arguments_) => {
  const base = sharedConfig(environment, arguments_);
  return {
    ...base,
    entry: './tests/browser/telegram-storage-harness.ts',
    output: {
      ...base.output,
      path: join(tmpdir(), 'interiors-tma-storage-harness-default')
    },
    // No worker, release manifest or catalog packaging in this test fixture.
    plugins: [
      new rspack.HtmlRspackPlugin({
        template: './tests/browser/telegram-storage-harness.html',
        templateParameters: {
          activeMutant: JSON.stringify(process.env.__STRYKER_ACTIVE_MUTANT__ ?? null)
        }
      })
    ],
    devServer: {
      host: '127.0.0.1',
      port: 49177,
      historyApiFallback: false
    }
  };
};
