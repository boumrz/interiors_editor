import base from './rspack.scoped-protocol-test.config.mjs';
export default (environment, arguments_) => ({ ...base(environment, arguments_), entry: process.env.SCOPED_NATIVE_CONTROL === 'build' ? './tests/verification/owned-nonexistent-native-entry.ts' : './tests/verification/scoped-public-protocol-edges-harness.ts' });
