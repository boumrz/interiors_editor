// Verification only; application modules never import this helper.
export async function runFactoryTechnicalCleanup<T>(operation: () => T | Promise<T>): Promise<T> {
 try { return await operation(); }
 catch (cause) { throw new Error("SCOPED_PROOF_INVALID technical factory lock cleanup", { cause }); }
}
