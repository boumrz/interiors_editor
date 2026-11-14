import webConfig from './rspack.config.mjs';
import { rspack } from '@rspack/core';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
export default (environment, arguments_) => {
  const base = webConfig(environment, arguments_);
  return { ...base, entry: './tests/browser/browser-registered-project-harness.ts', output: { ...base.output, path: join(tmpdir(), 'interiors-browser-registered-project-unused-default') }, plugins: [new rspack.DefinePlugin({ __INTERIORS_TEST_SEAM__: 'false' }), new rspack.HtmlRspackPlugin({ template: './tests/browser/browser-registered-project-harness.html', templateParameters: { activeMutant: JSON.stringify(process.env.__STRYKER_ACTIVE_MUTANT__ ?? null) } })] };
};
