import baseConfig from './rspack.shared.config.mjs';
import { rspack } from '@rspack/core';
import { resolve } from 'node:path';
export default (environment, arguments_) => {
 const base = baseConfig(environment, arguments_);
 const output = process.env.TMA_READONLY_OUTPUT;
 if (!output) throw new Error('Owned readonly source output is required');
 return { ...base, entry: './tests/browser/telegram-readonly-source-harness.ts', output: { ...base.output, path: output, filename: 'readonly.[contenthash:16].js' }, module: { ...base.module, rules: [{ test: /telegram-readonly-project-(source|snapshot)\.ts$/, enforce: 'pre', use: [resolve('tests/verification/telegram-readonly-subject-loader.cjs')] }, ...base.module.rules] }, plugins: [new rspack.DefinePlugin({ __INTERIORS_TEST_SEAM__: 'false' }), new rspack.HtmlRspackPlugin({ template: './tests/browser/telegram-readonly-source-harness.html', templateParameters: { activeMutant: JSON.stringify(process.env.__STRYKER_ACTIVE_MUTANT__ ?? null) } })] };
};
