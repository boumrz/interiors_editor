import base from './rspack.browser-readonly-project-test.config.mjs';
import {rspack} from '@rspack/core';
import {resolve} from 'node:path';
export default (env,args)=>{const original=base(env,args);if(!process.env.READER_PUBLIC_BUILD_OUTPUT)throw Error('READER_PUBLIC_PROOF_INVALID: owned build output required');return{...original,cache:false,entry:'./tests/verification/browser-readonly-public-regressions-entry.ts',output:{...original.output,path:resolve(process.env.READER_PUBLIC_BUILD_OUTPUT)},plugins:[new rspack.DefinePlugin({__INTERIORS_TEST_SEAM__:'false'}),new rspack.HtmlRspackPlugin({template:'./tests/verification/reader-public-regressions.html'})]};};
