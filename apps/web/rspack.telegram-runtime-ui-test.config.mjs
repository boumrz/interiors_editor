import sharedConfig from './rspack.shared.config.mjs';
import { rspack } from '@rspack/core';
import { isAbsolute, join, resolve } from 'node:path';
export default (environment, arguments_) => {
  const base = sharedConfig(environment, arguments_);
  const runRoot = process.env.TMA_UI_RUN_ROOT;
  const output = process.env.TMA_UI_DIST_DIR;
  if (!runRoot || !output || !isAbsolute(output) || resolve(output) !== join(resolve(runRoot), 'dist')) throw new Error('Use the isolated UI verification runner');
  return { ...base, entry: './tests/browser/telegram-runtime-ui-harness.tsx',
    output: { ...base.output, path: output, filename: 'runtime-ui.12345678.js' },
    optimization: { ...base.optimization, splitChunks: false },
    plugins: [new rspack.DefinePlugin({ __INTERIORS_TEST_SEAM__: 'false' }), new rspack.HtmlRspackPlugin({ template: './tests/browser/telegram-runtime-ui-harness.html', templateParameters: { activeMutant: JSON.stringify(process.env.__STRYKER_ACTIVE_MUTANT__ ?? null) } })]
  };
};
