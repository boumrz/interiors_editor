const{createHash}=require('node:crypto');const{basename}=require('node:path');
module.exports=function(source){
 const sha=createHash('sha256').update(source).digest('hex'),name=basename(this.resourcePath),namespace=source.match(/function\s+(stryNS_[A-Za-z0-9_$]+)\s*\(/)?.[1],localIDs=[...new Set([...source.matchAll(/stryMutAct_[A-Za-z0-9_$]+\(["'](\d+)["']\)/g)].map(match=>match[1]))];
 return source+`\n{const root=globalThis;const records=Reflect.get(root,"__interiorsScopedSubjects")??{};Reflect.set(root,"__interiorsScopedSubjects",records);Reflect.set(records,${JSON.stringify(name)},{sha:${JSON.stringify(sha)},instrumented:${!!namespace},localIDs:${JSON.stringify(localIDs)},readActive:()=>${namespace?`(${namespace}().activeMutant??null)`:'null'}});}\n`;
};
