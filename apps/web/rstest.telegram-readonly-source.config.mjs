import { defineConfig } from '@rstest/core';
import base from './rstest.config.mjs';
export default defineConfig({
 ...base,
 pool: { maxWorkers: 1 },
 include: ['src/adapters/persistence/telegram-readonly-project-source.test.ts', 'src/adapters/persistence/telegram-readonly-project-snapshot.test.ts'],
 output: { distPath: { root: './reports/readonly-source/unit-build' } }
});
