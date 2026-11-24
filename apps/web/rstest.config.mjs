import { defineConfig } from '@rstest/core';
import { withRspackConfig } from '@rstest/adapter-rspack';

export default defineConfig({
  extends: withRspackConfig({
    configPath: './rspack.shared.config.mjs',
    nodeEnv: 'test'
  }),
  include: [
    'src/app/**/*.test.ts',
    'src/domain/**/*.test.ts',
    'src/application/**/*.test.ts',
    'src/adapters/**/*.test.ts',
    'src/ui/**/*.test.tsx'
  ],
  testEnvironment: 'node'
});
