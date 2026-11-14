import { defineConfig } from '@rstest/core';
import { withRspackConfig } from '@rstest/adapter-rspack';
import { resolve } from 'node:path';
import base from './rstest.config.mjs';
if(!process.env.LOCAL_FILE_PROOF_INVOCATION)throw new Error('Use the owned proof runner');
const tests=JSON.parse(process.env.LOCAL_FILE_PROOF_TEST_FILES);
export default defineConfig({...base,extends:withRspackConfig({configPath:'./rspack.local-file-proof.config.mjs',nodeEnv:'test'}),include:tests,pool:{maxWorkers:1},setupFiles:['./tests/verification/local-file-activation.ts'],output:{distPath:{root:resolve(process.env.LOCAL_FILE_PROOF_INVOCATION,'build')}},reporters:['default',['json',{outputPath:resolve(process.env.LOCAL_FILE_PROOF_INVOCATION,'report.json')}]]});
