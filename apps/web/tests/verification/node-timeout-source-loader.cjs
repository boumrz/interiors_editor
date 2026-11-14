const crypto = require('node:crypto');
module.exports = function (source) {
 const key=this.resourcePath.replace(/\\/g,'/').split('/apps/web/')[1];
 const sha=crypto.createHash('sha256').update(source).digest('hex');
 const namespace=source.match(/function\s+(stryNS_[A-Za-z0-9_$]+)\s*\(/)?.[1];
 const read=namespace?`${namespace}().activeMutant??null`:'null';
 return source+`\n{const root=globalThis;const records=Reflect.get(root,'__NODE_TIMEOUT_SUBJECTS__')??{};Reflect.set(root,'__NODE_TIMEOUT_SUBJECTS__',records);Reflect.set(records,${JSON.stringify(key)},{sha:${JSON.stringify(sha)},instrumented:${!!namespace},readActive:()=>${read}}); }\n`;
};
