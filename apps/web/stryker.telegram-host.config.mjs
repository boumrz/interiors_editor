if(!process.env.INTERIORS_TELEGRAM_HOST_MUTATION_ROOT)throw new Error('Use the owned Telegram host mutation wrapper');
export default {
 commandRunner:{command:'node scripts/check-runtime.mjs && ./node_modules/.bin/rstest run --config rstest.config.mjs src/adapters/telegram/host-environment.test.ts'},
 mutate:['src/adapters/telegram/host-environment.ts'],
 inPlace:true,concurrency:2,disableTypeChecks:'**/*.{ts,tsx}',coverageAnalysis:'off',
 jsonReporter:{fileName:'reports/mutation/telegram-host.json'},
 packageManager:'pnpm',testRunner:'command',reporters:['clear-text','json'],
 thresholds:{break:80,high:80,low:60},timeoutMS:10000
};
