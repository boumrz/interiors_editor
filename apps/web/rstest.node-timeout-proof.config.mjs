import { defineConfig } from '@rstest/core';
import { withRspackConfig } from '@rstest/adapter-rspack';
import { resolve } from 'node:path';
import base from './rstest.config.mjs';
if(!process.env.NODE_TIMEOUT_INVOCATION)throw new Error('Use the owned proof runner');
const tests=JSON.parse(process.env.NODE_TIMEOUT_TEST_FILES);
export default defineConfig({...base,extends:withRspackConfig({configPath:'./rspack.node-timeout-proof.config.mjs',nodeEnv:'test'}),include:tests,pool:{maxWorkers:1},setupFiles:['./tests/verification/node-timeout-activation.ts'],output:{distPath:{root:resolve(process.env.NODE_TIMEOUT_INVOCATION,'build')}},reporters:['default',['json',{outputPath:resolve(process.env.NODE_TIMEOUT_INVOCATION,'report.json')}]]});
