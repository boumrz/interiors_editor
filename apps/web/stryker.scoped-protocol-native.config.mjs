if(!process.env.INTERIORS_SCOPED_NATIVE_RUNROOT||process.env.SCOPED_MUTATION_SCOPE!=='shared')throw new Error('Use owned shared protocol proof wrapper');
export default{
 testRunner:'command',commandRunner:{command:'node scripts/run-scoped-protocol-checked.mjs'},coverageAnalysis:'off',
 mutate:['src/adapters/persistence/scoped-project-repository.ts','src/adapters/persistence/telegram-project-repository.ts','src/adapters/persistence/scoped-writer-lease.ts','src/adapters/persistence/telegram-writer-lease.ts'],
 inPlace:true,concurrency:1,disableTypeChecks:'{src,tests}/**/*.{ts,tsx}',reporters:['clear-text','json'],jsonReporter:{fileName:'reports/scoped-protocol-native/shared-full/mutation.json'},thresholds:{high:80,low:60,break:80},packageManager:'pnpm',dryRunTimeoutMinutes:5,timeoutFactor:1.5,timeoutMS:5000
};
