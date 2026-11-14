import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import base from './stryker.telegram-entry-session.config.mjs';
const report=JSON.parse(readFileSync('reports/mutation/telegram-entry-session.json','utf8'));
const file='src/app/telegram-editor-app.tsx',record=report.files[file];
if(createHash('sha256').update(readFileSync(file)).digest('hex')!==createHash('sha256').update(record.source).digest('hex'))throw new Error('Session source changed since baseline');
const ranges=[...new Set(record.mutants.filter(m=>m.status==='Survived').map(m=>`${file}:${m.location.start.line}-${m.location.end.line}`))];
export default {...base,mutate:ranges,jsonReporter:{fileName:'reports/mutation/telegram-entry-session-followup.json'}};
