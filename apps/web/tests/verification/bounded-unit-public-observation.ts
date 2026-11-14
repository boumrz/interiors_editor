import { expect } from "@rstest/core";

const schedule = globalThis.setTimeout,
	cancel = globalThis.clearTimeout;
/** Verification budget for controlled immediate ports; never a production deadline. */
export function completeUnitPublicOperation<T>(
	operation: T | PromiseLike<T>,
): Promise<T> {
	const observed = (async () => {
		let timer: ReturnType<typeof schedule> | undefined;
		try {
			const settled = await Promise.race([
				Promise.resolve(operation).then(
					(value) => ({ kind: "fulfilled" as const, value }),
					(reason) => ({ kind: "rejected" as const, reason }),
				),
				new Promise<{ kind: "pending" }>((resolve) => {
					timer = schedule(() => resolve({ kind: "pending" }), 250);
				}),
			]);
			if (settled.kind === "rejected") throw settled.reason;
			expect(settled.kind).toBe("fulfilled");
			if (settled.kind !== "fulfilled")
				throw new Error("Public unit operation did not complete");
			return settled.value;
		} finally {
			cancel(timer);
		}
	})();
	void observed.catch(() => undefined);
	return observed;
}
