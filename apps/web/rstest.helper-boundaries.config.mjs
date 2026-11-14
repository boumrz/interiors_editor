import {defineConfig} from '@rstest/core';
import base from './rstest.config.mjs';
export default defineConfig({...base,setupFiles:['./reports/helper-boundaries/activation-proof.ts']});
