import { expect, it } from "@rstest/core";
import {
	DurableProjectRepository,
	MemoryVersionedProjectStore,
} from "../adapters/persistence/durable-project-repository";
import { FencedProjectRepository } from "../adapters/persistence/fenced-project-repository";
import { FflatePortableBackupDecoder } from "../adapters/portable-backup/fflate-portable-backup-decoder";
import { FflatePortableBackupEncoder } from "../adapters/portable-backup/fflate-portable-backup-encoder";
import { PortableBackupReadRenderSmokeCheck } from "../adapters/portable-backup/portable-backup-read-render-smoke";
import { createRegisteredRuntimePortablePorts } from "../adapters/portable-backup/registered-runtime-portable";
import { createBrowserReadonlyProjects } from "./browser-readonly-projects";
import { createBrowserRuntime } from "./browser-runtime";
import type { ReleaseStartupInput } from "./release-startup";
import { createSharedProjectController } from "./shared-project-controller";

const input = (): ReleaseStartupInput => ({
	capabilities: { indexeddb: true, webgl2: true },
	hasControllingWorker: false,
	workerManifest: undefined,
	shellManifest: {
		version: 1,
		workerProtocolVersion: 1,
		appBuildId: "readonly-outer",
		projectSchemas: { readable: [1, 2], writable: [2] },
		assetSchemas: { readable: [1], writable: [1] },
		catalogSchemas: { readable: [1], writable: [1] },
		minimumCapabilities: ["indexeddb", "webgl2"],
	},
});
function fixture() {
	let ids = 0,
		writerHandshakes = 0,
		opens = 0;
	const binaryChecksum = {
			sha256Bytes: async (bytes: Uint8Array) =>
				Array.from(
					new Uint8Array(
						await crypto.subtle.digest("SHA-256", bytes.slice().buffer),
					),
					(b) => b.toString(16).padStart(2, "0"),
				).join(""),
		},
		checksum = {
			sha256: (s: string) =>
				binaryChecksum.sha256Bytes(new TextEncoder().encode(s)),
		};
	const store = new MemoryVersionedProjectStore(),
		repository = new FencedProjectRepository(
			new DurableProjectRepository(store, checksum.sha256),
			store,
			"unit-legacy",
		),
		encoder = new FflatePortableBackupEncoder(),
		smoke = new PortableBackupReadRenderSmokeCheck({
			checksum: binaryChecksum,
		});
	const noResourceWrite = async (): Promise<never> => {
		throw new Error("Readonly fixture cannot publish resources");
	};
	const controller = createSharedProjectController({
		resources: {
			read: async () => undefined,
			writeIfAbsent: noResourceWrite,
			delete: noResourceWrite,
		},
		library: { list: async () => [], register: noResourceWrite },
		pinStaging: {
			requiresPublicationContext: true,
			begin: noResourceWrite,
			markForPublication: noResourceWrite,
			complete: noResourceWrite,
			discard: noResourceWrite,
		},
		repository,
		checksum,
		binaryChecksum,
		clock: { now: () => "2026-11-05T00:00:00.000Z" },
		ids: {
			next: () => {
				ids++;
				return crypto.randomUUID();
			},
		},
		storageEstimate: { estimateStorage: async () => ({}) },
		portable: {
			encoder,
			decoder: new FflatePortableBackupDecoder(binaryChecksum),
			smoke,
		},
	}).controller;
	const registered = createRegisteredRuntimePortablePorts({ binaryChecksum });
	const readonlyProjects = createBrowserReadonlyProjects({
		technical: {
			secureContext: true,
			indexedDb: {
				databases: async () => [],
				open: () => {
					opens++;
					throw new Error("No readonly provisioning");
				},
			},
		},
		readReleaseStartupInput: async () => input(),
		checksum,
		binaryChecksum,
		portable: {
			legacyEncoder: encoder,
			legacySmoke: smoke,
			registeredWriter: registered.writer,
			registeredSmoke: registered.smoke,
		},
	});
	const runtime = createBrowserRuntime({
		legacy: {
			controller,
			releaseStartup: {
				handshake: async () => {
					writerHandshakes++;
					return { kind: "read-only/exportable", recovery: {} };
				},
			},
		},
		readReleaseStartupInput: async () => input(),
		readonlyProjects,
	});
	return {
		runtime,
		readonlyProjects,
		ids: () => ids,
		writerHandshakes: () => writerHandshakes,
		opens: () => opens,
	};
}
it("keeps the truthful all-readonly outcome while separately exposing independently admitted query/export capability", async () => {
	const f = fixture();
	let notifications = 0;
	f.runtime.subscribeStartupSources(() => {
		notifications++;
	});
	expect(await f.runtime.releaseStartup.handshake(input())).toMatchObject({
		kind: "read-only/exportable",
	});
	expect(f.runtime.readonlyProjects).toBe(f.readonlyProjects);
	expect(f.runtime.getReadonlyProjectSources()).toEqual([
		"legacy",
		"browser-registered",
	]);
	const directory = await f.runtime.readonlyProjects?.readDirectory();
	expect(directory?.storageSources).toEqual([
		{ storageNamespace: "legacy", kind: "available" },
		{
			storageNamespace: "browser-registered",
			kind: "not-provisioned",
			history: "unknown",
		},
	]);
	expect(f.runtime.canCreateLegacyProject()).toBe(false);
	expect(f.ids()).toBe(0);
	expect(f.writerHandshakes()).toBe(0);
	expect(f.opens()).toBe(0);
	expect(notifications).toBeGreaterThan(0);
	const disposal = f.runtime.dispose();
	expect(f.readonlyProjects.signal.aborted).toBe(true);
	await disposal;
});
