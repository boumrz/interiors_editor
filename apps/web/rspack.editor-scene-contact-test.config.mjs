import webConfig from './rspack.config.mjs';
import { rspack } from '@rspack/core';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
export default (environment, arguments_) => {
 const base = webConfig(environment, arguments_);
 return { ...base, entry: './tests/browser/editor-scene-contact-harness.tsx', output: { ...base.output, path: join(tmpdir(), 'interiors-editor-scene-contact-default') }, plugins: [new rspack.DefinePlugin({ __INTERIORS_TEST_SEAM__: 'false' }), new rspack.HtmlRspackPlugin({ template: './tests/browser/editor-scene-contact-harness.html', templateParameters: { activeMutant: JSON.stringify(process.env.__STRYKER_ACTIVE_MUTANT__ ?? null) } })] };
};
