import base from'./rspack.scoped-protocol-test.config.mjs';export default(env,args)=>({...base(env,args),entry:'./tests/verification/common-prefix-native-harness.ts'});
