import {readFileSync} from 'node:fs';
const lines=readFileSync('src/app/telegram-editor-app.tsx','utf8').split('\n');
const at=marker=>{const index=lines.findIndex(line=>line.startsWith(marker));if(index<0)throw new Error(`Missing mutation boundary ${marker}`);return index+1;};
export default {
 commandRunner:{command:'node scripts/check-runtime.mjs && ./node_modules/.bin/rstest run --config rstest.config.mjs src/app/telegram-editor-app.test.ts'},
 concurrency:1,coverageAnalysis:'off',inPlace:true,disableTypeChecks:'**/*.{ts,tsx}',
 jsonReporter:{fileName:'reports/mutation/telegram-entry-session.json'},
 mutate:[`src/app/telegram-editor-app.tsx:${at('export function parseTelegramDeploymentConfiguration')}-${at('type WorkerState')-1}`,`src/app/telegram-editor-app.tsx:${at('export function createTelegramEntrySession')}-${at('export function TelegramEditorApp')-1}`],
 packageManager:'pnpm',reporters:['clear-text','json'],testRunner:'command',thresholds:{break:0,high:80,low:60},timeoutMS:10000
};
