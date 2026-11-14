const {createHash}=require('node:crypto');
const {basename}=require('node:path');
module.exports=function(source){
 const sha=createHash('sha256').update(source).digest('hex');
 const name=basename(this.resourcePath);
 const instrumented=/function\s+stryNS_9fa48\s*\(/.test(source);
 return source+`\n{const root=globalThis;const records=Reflect.get(root,"__interiorsScopedSubjects")??{};Reflect.set(root,"__interiorsScopedSubjects",records);Reflect.set(records,${JSON.stringify(name)},{sha:${JSON.stringify(sha)},instrumented:${instrumented},readActive:()=>typeof stryNS_9fa48==="function"?(stryNS_9fa48().activeMutant??null):null});}\n`;
};
