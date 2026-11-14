if(!process.env.INTERIORS_HELPER_BOUNDARY_ACTIVATION_ROOT)throw new Error('Use the isolated boundary proof wrapper');
export default {
 commandRunner:{command:'node scripts/check-runtime.mjs && ./node_modules/.bin/rstest run --config rstest.helper-boundaries.config.mjs src/application/browser-backup-representability.test.ts src/application/browser-backup-safety-boundaries.test.ts src/application/browser-backup-resource-set-boundaries.test.ts src/application/browser-backup-plain-data-boundaries.test.ts'},
 mutate:['src/application/browser-backup-representability.ts:380-408','src/application/browser-backup-representability.ts:419-423'],
 inPlace:true,concurrency:1,disableTypeChecks:'**/*.{ts,tsx}',coverageAnalysis:'off',
 jsonReporter:{fileName:'reports/helper-plain-data/mutation-targeted.json'},
 packageManager:'pnpm',testRunner:'command',reporters:['clear-text','json'],
 thresholds:{break:0,high:80,low:60},timeoutMS:10000
};
