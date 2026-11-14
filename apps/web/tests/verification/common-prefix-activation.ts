import{beforeAll,beforeEach,expect}from'@rstest/core';
import'../../src/adapters/persistence/scoped-project-repository';
const runtime=Reflect.get(globalThis,'process'),env=runtime.env;
beforeAll(()=>{if(env.COMMON_PREFIX_FORCE_WORKER_ERROR==='1')throw new Error('COMMON_PREFIX_WORKER_NEGATIVE');});
beforeEach(async context=>{
 const fsName='node:fs',cryptoName='node:crypto';const fs=await import(fsName),cryptoModule=await import(cryptoName),marker=Reflect.get(globalThis,'__COMMON_PREFIX_SUBJECT__');
 const source=fs.readFileSync(env.COMMON_PREFIX_WORKSPACE+'/src/adapters/persistence/scoped-project-repository.ts'),sha=cryptoModule.createHash('sha256').update(source).digest('hex'),expected=Reflect.get(env,'__STRYKER_ACTIVE_MUTANT__')??null;
 const valid=!!marker&&marker.sha===sha&&marker.readActive()===expected&&(expected===null||marker.instrumented);
 const row={pid:runtime.pid,testId:context.task.id,key:JSON.stringify([context.task.filepath,expect.getState().currentTestName??context.task.name]),expectedId:expected,actualId:marker?.readActive()??null,filesystemSHA:sha,loadedSHA:marker?.sha??null,instrumented:marker?.instrumented??false,valid};
 fs.appendFileSync(env.COMMON_PREFIX_INVOCATION+'/activation.jsonl',JSON.stringify(row)+'\n');
 if(!valid)throw new Error('COMMON_PREFIX_ACTUAL_MODULE_INVALID');
});
