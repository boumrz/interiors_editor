const { createHash } = require('node:crypto');
const { basename } = require('node:path');
module.exports = function(source) {
 this.cacheable(false);
 const key = basename(this.resourcePath, '.ts');
 if (!['telegram-readonly-project-source', 'telegram-readonly-project-snapshot'].includes(key)) throw new Error('Unknown readonly proof subject');
 const sha = process.env.TMA_READONLY_BAD_MARKER ? 'CONTROL_BAD_LOADED_SOURCE' : createHash('sha256').update(source).digest('hex');
 const localIDs=[...new Set([...source.matchAll(/stryMutAct_9fa48\(\s*["'](\d+)["']\s*\)/g)].map(match=>match[1]))];
 const instrumented = /function\s+stryNS_9fa48\s*\(/.test(source);
 return ';globalThis.__telegramReadonlySubjects??={};globalThis.__telegramReadonlySubjects['+JSON.stringify(key)+']={sha:'+JSON.stringify(sha)+',instrumented:'+instrumented+',localIDs:'+JSON.stringify(localIDs)+',readActive:()=>typeof stryNS_9fa48==="function"?(stryNS_9fa48().activeMutant??null):null};\n'+source;
};
