import { expect, it } from "@rstest/core";
import { unzipSync, zipSync } from "fflate";
import { createRegisteredRuntimePortablePorts } from "../adapters/portable-backup/registered-runtime-portable";
import { createInitialProject } from "../domain/initial-project";
import { createProductionRuntime } from "./production-app";

it("keeps the browser registered ingress unavailable until its isolated storage is ready while retaining the old default decoder", async () => {
	const values = new Map<string, string>();
	const previous = Object.getOwnPropertyDescriptor(globalThis, "window");
	Object.defineProperty(globalThis, "window", {
		configurable: true,
		value: {
			crypto,
			performance: { getEntriesByType: () => [{ type: "navigate" }] },
			sessionStorage: {
				getItem: (key: string) => values.get(key) ?? null,
				setItem: (key: string, value: string) => values.set(key, value),
			},
		},
	});
	try {
		const runtime = createProductionRuntime();
		const utf8 = (value: unknown) =>
			new TextEncoder().encode(JSON.stringify(value));
		const archive = zipSync(
			{
				"manifest.json": utf8({
					projectSchemaId: "interiors.project/alpha-1",
					projectSchemaVersion: 1,
					sourceProjectId: "p",
					canonicalProjectPath: "project/project.json",
				}),
				"checksums.json": utf8([]),
				"project/project.json": utf8({
					projectSchemaId: "interiors.project/alpha-1",
				}),
			},
			{ level: 0 },
		);
		expect(
			await runtime.controller.importRegisteredPortableBackup(archive),
		).toEqual({ kind: "not-ready" });
		expect(await runtime.controller.importPortableBackup(archive)).toEqual({
			kind: "rejected",
			reasonCode: "PORTABLE_BACKUP_INVALID",
		});
		const registered = createRegisteredRuntimePortablePorts({
			binaryChecksum: {
				sha256Bytes: async (bytes) =>
					[
						...new Uint8Array(
							await crypto.subtle.digest("SHA-256", bytes.slice().buffer),
						),
					]
						.map((byte) => byte.toString(16).padStart(2, "0"))
						.join(""),
			},
		});
		const encoded = await registered.writer.encode({
			project: createInitialProject({
				projectId: "checksum-source",
				levelId: "level",
				name: "Checksum",
				createdAt: "2026-11-04T12:34:56.000Z",
			}),
			resources: [],
			createdAt: "2026-11-04T12:34:56.000Z",
		});
		if (encoded.kind !== "encoded") throw new Error("Missing wire fixture");
		const entries = unzipSync(encoded.bytes);
		entries["project/project.json"][0] ^= 1;
		expect(
			await runtime.controller.importRegisteredPortableBackup(
				zipSync(entries, { level: 0 }),
			),
		).toEqual({ kind: "not-ready" });
	} finally {
		if (previous) Object.defineProperty(globalThis, "window", previous);
		else Reflect.deleteProperty(globalThis, "window");
	}
});

it("keeps programmatic browser registered import closed before decoding, IDs, pins or database I/O while retaining its independent exporter", async () => {
	const saved = new Map<string, string>(),
		previousWindow = Object.getOwnPropertyDescriptor(globalThis, "window"),
		previousDb = Object.getOwnPropertyDescriptor(globalThis, "indexedDB"),
		nativeCrypto = crypto;
	let ids = 0,
		opens = 0,
		digests = 0,
		statuses = 0;
	Object.defineProperty(globalThis, "window", {
		configurable: true,
		value: {
			crypto: {
				subtle: {
					digest: async (
						...args: Parameters<typeof nativeCrypto.subtle.digest>
					) => {
						digests++;
						return nativeCrypto.subtle.digest(...args);
					},
				},
				randomUUID: () => {
					ids++;
					return nativeCrypto.randomUUID();
				},
			},
			performance: { getEntriesByType: () => [{ type: "navigate" }] },
			sessionStorage: {
				getItem: (key: string) => saved.get(key) ?? null,
				setItem: (key: string, value: string) => saved.set(key, value),
			},
		},
	});
	Object.defineProperty(globalThis, "indexedDB", {
		configurable: true,
		value: {
			open: () => {
				opens++;
				throw new Error(
					"Policy rejection may not open Project/pin/resource storage",
				);
			},
		},
	});
	try {
		const runtime = createProductionRuntime(),
			priorIds = ids,
			priorState = runtime.controller.snapshot();
		const binaryChecksum = {
			sha256Bytes: async (bytes: Uint8Array) =>
				[
					...new Uint8Array(
						await nativeCrypto.subtle.digest("SHA-256", bytes.slice().buffer),
					),
				]
					.map((byte) => byte.toString(16).padStart(2, "0"))
					.join(""),
		};
		const json = new TextEncoder().encode('{"asset":{"version":"2.0"}} '),
			bytes = new Uint8Array(20 + json.byteLength),
			header = new DataView(bytes.buffer);
		header.setUint32(0, 0x46546c67, true);
		header.setUint32(4, 2, true);
		header.setUint32(8, bytes.byteLength, true);
		header.setUint32(12, json.byteLength, true);
		header.setUint32(16, 0x4e4f534a, true);
		bytes.set(json, 20);
		const hash = (await binaryChecksum.sha256Bytes(bytes)).toUpperCase(),
			createdAt = "2026-11-04T12:34:56.000Z",
			project = {
				...createInitialProject({
					projectId: "upper-wire-source",
					levelId: "level",
					name: "Upper model",
					createdAt,
				}),
				assetDefinitionRefs: [
					{
						assetDefinitionId: "model",
						displayName: "Local model",
						format: "glb" as const,
						resourceHash: hash,
						byteLength: bytes.byteLength,
						widthMm: 100,
						depthMm: 100,
						heightMm: 100,
					},
				],
			};
		const encoded = await createRegisteredRuntimePortablePorts({
			binaryChecksum,
		}).writer.encode({
			project,
			createdAt,
			resources: [{ resourceHash: hash, bytes }],
		});
		if (encoded.kind !== "encoded")
			throw new Error("Invalid actual Upper wire fixture");
		const original = encoded.bytes.slice();
		expect(
			await runtime.controller.importRegisteredPortableBackup(encoded.bytes, {
				onStatus: () => {
					statuses++;
				},
			}),
		).toEqual({ kind: "not-ready" });
		expect(ids).toBe(priorIds);
		expect(opens).toBe(0);
		expect(runtime.controller.snapshot()).toEqual(priorState);
		expect(encoded.bytes).toEqual(original);
		const entries = unzipSync(encoded.bytes);
		entries["project/project.json"][0] ^= 1;
		expect(
			await runtime.controller.importRegisteredPortableBackup(
				zipSync(entries, { level: 0 }),
			),
		).toEqual({ kind: "not-ready" });
		expect(
			await runtime.controller.importRegisteredPortableBackup(
				Uint8Array.of(1, 2, 3),
			),
		).toEqual({ kind: "not-ready" });
		expect(
			await runtime.controller.exportRegisteredProjectTransfer(
				"selected-project",
				{ signal: { aborted: true } },
			),
		).toEqual({ kind: "rejected", reasonCode: "BACKUP_CANCELLED" });
		expect(ids).toBe(priorIds);
		expect(opens).toBe(0);
		expect(digests).toBe(0);
		expect(statuses).toBe(0);
		expect(runtime.controller.hasPendingPublication()).toBe(false);
		expect(runtime.controller.snapshot()).toStrictEqual(priorState);
	} finally {
		if (previousWindow)
			Object.defineProperty(globalThis, "window", previousWindow);
		else Reflect.deleteProperty(globalThis, "window");
		if (previousDb) Object.defineProperty(globalThis, "indexedDB", previousDb);
		else Reflect.deleteProperty(globalThis, "indexedDB");
	}
});
