import webConfig from './rspack.shared.config.mjs';
import { rspack } from '@rspack/core';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
export default (environment, arguments_) => {
  const base = webConfig(environment, arguments_);
  return { ...base, entry: './tests/browser/browser-registered-storage-harness.ts', output: { ...base.output, path: join(tmpdir(), 'interiors-browser-registered-storage-unused-default') }, plugins: [new rspack.HtmlRspackPlugin({ template: './tests/browser/browser-registered-storage-harness.html', templateParameters: { activeMutant: JSON.stringify(process.env.__STRYKER_ACTIVE_MUTANT__ ?? null) } })] };
};
