import {readFileSync} from 'node:fs';
const lines=readFileSync('scripts/telegram-preview-server.mjs','utf8').split('\n');const cli=lines.findIndex((line,index)=>line==='if ('&&lines[index+1]?.includes('process.argv[1]'));if(cli<0)throw new Error('CLI boot boundary missing');
export default {
 commandRunner:{command:'node scripts/check-runtime.mjs && node --test scripts/telegram-release-build.test.mjs scripts/telegram-preview-server.test.mjs'},
 concurrency:3,coverageAnalysis:'off',inPlace:true,disableTypeChecks:'**/*.{ts,tsx}',
 jsonReporter:{fileName:'reports/mutation/telegram-entry-delivery-final.json'},
 mutate:['scripts/telegram-release-build.mjs',`scripts/telegram-preview-server.mjs:1-${cli}`],
 packageManager:'pnpm',reporters:['clear-text','json'],testRunner:'command',thresholds:{break:0,high:80,low:60},timeoutMS:10000
};
