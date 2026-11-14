import { expect, it } from "@rstest/core";
import { completeUnitPublicOperation } from "../../tests/verification/bounded-unit-public-observation";
import {
	type BrowserRegisteredRuntimeDependencies,
	createBrowserRegisteredRuntime,
} from "./browser-registered-runtime";
import type { ReleaseManifest, ReleaseStartupInput } from "./release-startup";

function startup(): ReleaseStartupInput & {
	readonly shellManifest: ReleaseManifest;
} {
	return {
		shellManifest: {
			version: 1,
			workerProtocolVersion: 1,
			appBuildId: "public-factory-admission",
			minimumCapabilities: ["indexeddb"],
			projectSchemas: { readable: [1], writable: [1] },
			assetSchemas: { readable: [1], writable: [1] },
			catalogSchemas: { readable: [1], writable: [1] },
		},
		hasControllingWorker: false,
		workerManifest: undefined,
		capabilities: { indexeddb: true, webgl2: true },
	};
}

// This public capability boundary cannot return an IDB connection, scope access,
// transaction, resource, or writer receipt. It observes whether authority was asked.
function unavailableNativeBoundary() {
	const calls = { opens: 0, locks: 0, projectIds: 0, startupReads: 0 };
	const values = new Map<string, string>();
	const dependencies: BrowserRegisteredRuntimeDependencies = {
		context: {
			indexedDb: {
				open() {
					calls.opens++;
					throw new Error("Controlled unavailable native IDB capability");
				},
			},
			locks: {
				request: async () => {
					calls.locks++;
					throw new Error("Controlled unavailable native lock capability");
				},
			},
			secureContext: true,
			crypto,
			sessionStorage: {
				getItem: (key) => values.get(key) ?? null,
				setItem: (key, value) => {
					values.set(key, value);
				},
			},
			readReleaseStartupInput: async () => {
				calls.startupReads++;
				return startup();
			},
		},
		ports: {
			checksum: { sha256: async () => "unused" },
			binaryChecksum: { sha256Bytes: async () => "unused" },
			clock: { now: () => "2026-11-06T00:00:00.000Z" },
			ids: {
				next: () => {
					calls.projectIds++;
					return "forbidden-project-id";
				},
			},
			storageEstimate: { estimateStorage: async () => ({}) },
		},
	};
	return { runtime: createBrowserRegisteredRuntime(dependencies), calls };
}

it("an unapproved public directory probe never asks for a native lock, connection or Project identity", async () => {
	const f = unavailableNativeBoundary();
	try {
		expect(
			await completeUnitPublicOperation(f.runtime.readDirectory()),
		).toEqual({ kind: "unavailable" });
		expect(f.calls).toEqual({
			opens: 0,
			locks: 0,
			projectIds: 0,
			startupReads: 0,
		});
	} finally {
		await completeUnitPublicOperation(f.runtime.dispose());
	}
});

it("the actual registered import route refuses before startup without parsing user bytes or asking for native authority", async () => {
	const f = unavailableNativeBoundary();
	try {
		// The real import route must reject before interpreting even malformed input.
		await completeUnitPublicOperation(
			expect(
				f.runtime.controller.importRegisteredPortableBackup(
					Uint8Array.of(80, 75),
				),
			).rejects.toThrow(),
		);
		expect(f.calls).toEqual({
			opens: 0,
			locks: 0,
			projectIds: 0,
			startupReads: 0,
		});
	} finally {
		await completeUnitPublicOperation(f.runtime.dispose());
	}
});

it("a compatible shell with unavailable native storage stays unable to admit registered imports", async () => {
	const f = unavailableNativeBoundary();
	try {
		expect(
			await completeUnitPublicOperation(
				f.runtime.releaseStartup.handshake(startup()),
			),
		).toEqual({
			kind: "read-only/exportable",
			recovery: {},
		});
		expect(f.calls).toEqual({
			opens: 0,
			locks: 1,
			projectIds: 0,
			startupReads: 1,
		});
		await completeUnitPublicOperation(
			expect(
				f.runtime.controller.importRegisteredPortableBackup(
					Uint8Array.of(80, 75),
				),
			).rejects.toThrow(),
		);
		expect(f.calls).toEqual({
			opens: 0,
			locks: 1,
			projectIds: 0,
			startupReads: 1,
		});
	} finally {
		await completeUnitPublicOperation(f.runtime.dispose());
	}
});
