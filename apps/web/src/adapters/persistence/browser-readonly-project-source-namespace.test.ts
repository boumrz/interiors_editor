import { expect, it } from "@rstest/core";
import {
	observeReadonlyPublicOperation,
	requireReadonlyNativeCleanup,
} from "../../../tests/verification/readonly-public-completion";
import {
	type BrowserReadonlyProjectSource,
	type BrowserReadonlyProjectSourceDependencies,
	createBrowserReadonlyProjectSource,
} from "./browser-readonly-project-source";

// An inert native capability boundary: it can refuse an open, never fabricate
// a connection, transaction, stored row, or observation authority.
function dependencies(storageNamespace: "legacy" | "browser-registered") {
	let opens = 0;
	const value: BrowserReadonlyProjectSourceDependencies = {
		storageNamespace,
		admitted: () => true,
		technical: {
			secureContext: true,
			indexedDb: {
				open() {
					opens++;
					throw new Error("Unexpected native open at construction boundary");
				},
			},
		},
		checksum: { sha256: async () => "unused" },
		binaryChecksum: { sha256Bytes: async () => "unused" },
		portable: {
			legacyEncoder: {
				encode: () => {
					throw new Error("Unused encoder");
				},
			},
			legacySmoke: { verify: async () => false },
			registeredWriter: {
				encode: async () => {
					throw new Error("Unused writer");
				},
			},
			registeredSmoke: { verify: async () => false },
		},
	};
	return { value, opens: () => opens };
}

for (const namespace of ["legacy", "browser-registered"] as const) {
	it(`a ${namespace} reader cannot lend observation authority to the other namespace on the same native factory`, async () => {
		const f = dependencies(namespace);
		const previous = createBrowserReadonlyProjectSource(f.value);
		let unexpected: BrowserReadonlyProjectSource | undefined;
		try {
			expect(() => {
				unexpected = createBrowserReadonlyProjectSource({
					...f.value,
					storageNamespace:
						namespace === "legacy" ? "browser-registered" : "legacy",
					previousSource: previous,
				});
			}).toThrow();
			expect(previous.signal.aborted).toBe(false);
			expect(f.opens()).toBe(0);
		} finally {
			if (unexpected)
				requireReadonlyNativeCleanup(
					await observeReadonlyPublicOperation(unexpected.dispose(), 250),
				);
			requireReadonlyNativeCleanup(
				await observeReadonlyPublicOperation(previous.dispose(), 250),
			);
		}
	});
}
