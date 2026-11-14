import { defineConfig } from '@rstest/core';
import { withRspackConfig } from '@rstest/adapter-rspack';

export default defineConfig({
  extends: withRspackConfig({
    configPath: './rspack.config.mjs',
    nodeEnv: 'test'
  }),
  include: ['src/**/*.test.ts'],
  testEnvironment: 'node'
});
