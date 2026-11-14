import webConfig from './rspack.config.mjs';
import { rspack } from '@rspack/core';
import { isAbsolute } from 'node:path';

export default (environment, arguments_) => {
  const base = webConfig(environment, arguments_);
  const output = process.env.PREFS_DIST_DIR;
  const address = new URL(process.env.PREFS_BASE_URL);
  if (!output || !isAbsolute(output) || address.hostname !== '127.0.0.1') throw new Error('Use an isolated absolute output and loopback URL');
  return {
    ...base,
    entry: './tests/browser/drawing-preferences-harness.tsx',
    output: { ...base.output, path: output },
    plugins: [
      new rspack.DefinePlugin({ __INTERIORS_TEST_SEAM__: 'false' }),
      new rspack.HtmlRspackPlugin({ template: './tests/browser/drawing-preferences-harness.html', templateParameters: { activeMutant: JSON.stringify(process.env.__STRYKER_ACTIVE_MUTANT__ ?? null) } })
    ],
    devServer: { ...base.devServer, host: '127.0.0.1', port: Number(address.port), proxy: [], historyApiFallback: false }
  };
};
