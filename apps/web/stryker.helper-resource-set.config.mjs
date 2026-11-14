if(!process.env.INTERIORS_HELPER_BOUNDARY_ACTIVATION_ROOT)throw new Error('Use the isolated boundary proof wrapper');
export default {
 commandRunner:{command:'node scripts/check-runtime.mjs && ./node_modules/.bin/rstest run --config rstest.helper-boundaries.config.mjs src/application/browser-backup-representability.test.ts src/application/browser-backup-safety-boundaries.test.ts src/application/browser-backup-resource-set-boundaries.test.ts'},
 mutate:['src/application/browser-backup-representability.ts:289-317'],
 inPlace:true,concurrency:1,disableTypeChecks:'**/*.{ts,tsx}',coverageAnalysis:'off',
 jsonReporter:{fileName:'reports/helper-resource-set/mutation-targeted.json'},
 packageManager:'pnpm',testRunner:'command',reporters:['clear-text','json'],
 thresholds:{break:0,high:80,low:60},timeoutMS:10000
};
