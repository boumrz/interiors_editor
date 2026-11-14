import { expect, it } from "@rstest/core";
import { canonicalProjectSerializer } from "../../application/create-project";
import type {
	BinaryChecksumPort,
	PublicationCandidate,
} from "../../application/ports";
import { createInitialProject } from "../../domain/initial-project";
import { preflightStaticGlbImport } from "../../domain/static-glb-import";
import { IndexedDbCustomAssetResourceStore } from "../persistence/indexeddb-custom-asset-resource-store";
import { BrowserRegisteredProjectExporter } from "./browser-registered-project-exporter";
import { createRegisteredRuntimePortablePorts } from "./registered-runtime-portable";

const binaryChecksum: BinaryChecksumPort = {
	async sha256Bytes(bytes) {
		const digest = await globalThis.crypto.subtle.digest(
			"SHA-256",
			Uint8Array.from(bytes).buffer,
		);
		return Array.from(new Uint8Array(digest), (byte) =>
			byte.toString(16).padStart(2, "0"),
		).join("");
	},
};
const checksum = {
	sha256: (text: string) =>
		binaryChecksum.sha256Bytes(new TextEncoder().encode(text)),
};

function staticGlb(generator: string): Uint8Array {
	const json = new TextEncoder().encode(
		JSON.stringify({ asset: { version: "2.0", generator } }),
	);
	const paddedLength = Math.ceil(json.byteLength / 4) * 4;
	const bytes = new Uint8Array(20 + paddedLength),
		view = new DataView(bytes.buffer);
	view.setUint32(0, 0x46546c67, true);
	view.setUint32(4, 2, true);
	view.setUint32(8, bytes.byteLength, true);
	view.setUint32(12, paddedLength, true);
	view.setUint32(16, 0x4e4f534a, true);
	bytes.fill(32, 20);
	bytes.set(json, 20);
	return bytes;
}

async function resourcefulCandidate(
	bytes: Uint8Array,
): Promise<PublicationCandidate> {
	const createdAt = "2026-11-05T12:00:00.000Z";
	const project = {
		...createInitialProject({
			createdAt,
			name: "Exact requested snapshot",
			projectId: "stored-project",
			levelId: "level",
		}),
		assetDefinitionRefs: [
			{
				assetDefinitionId: "required",
				displayName: "Required static resource",
				format: "glb" as const,
				resourceHash: await binaryChecksum.sha256Bytes(bytes),
				byteLength: bytes.byteLength,
				widthMm: 100,
				heightMm: 100,
				depthMm: 100,
			},
		],
	};
	const serializedProject = canonicalProjectSerializer.serialize(project);
	return {
		project,
		revision: {
			projectId: project.projectId,
			revisionId: "stored-revision",
			schemaVersion: 1,
			createdAt,
			serializedProject,
			checksum: await checksum.sha256(serializedProject),
		},
	};
}

it("refuses mixed valid and invalid pin descriptors in both orders before opening storage", async () => {
	const original = Object.getOwnPropertyDescriptor(globalThis, "window");
	let opened = 0;
	Object.defineProperty(globalThis, "window", {
		configurable: true,
		value: {
			indexedDB: {
				open: () => {
					opened++;
					throw new Error("Unexpected metadata I/O");
				},
			},
		},
	});
	const valid = { resourceHash: "a".repeat(64), byteLength: 3 };
	const invalid = { resourceHash: "b".repeat(64), byteLength: 0 };
	try {
		const outcomes = [];
		for (const definitions of [
			[valid, invalid],
			[invalid, valid],
		]) {
			opened = 0;
			try {
				const value =
					await new IndexedDbCustomAssetResourceStore().readPinnedSnapshot(
						definitions,
					);
				outcomes.push({ kind: "fulfilled", value, opened });
			} catch (error) {
				outcomes.push({
					kind: "rejected",
					message: error instanceof Error ? error.message : String(error),
					opened,
				});
			}
		}
		expect(outcomes).toEqual([
			{ kind: "fulfilled", value: undefined, opened: 0 },
			{ kind: "fulfilled", value: undefined, opened: 0 },
		]);
	} finally {
		if (original) Object.defineProperty(globalThis, "window", original);
		else Reflect.deleteProperty(globalThis, "window");
	}
});

it("refuses an unrelated extra snapshot resource before checksumming or formatting any export bytes", async () => {
	const requiredBytes = staticGlb("Required"),
		unrelatedBytes = staticGlb("Unrelated");
	expect(preflightStaticGlbImport(requiredBytes).kind).toBe("accepted");
	expect(preflightStaticGlbImport(unrelatedBytes).kind).toBe("accepted");
	const source = await resourcefulCandidate(requiredBytes);
	const requiredHash = source.project.assetDefinitionRefs[0].resourceHash;
	const unrelatedHash = await binaryChecksum.sha256Bytes(unrelatedBytes);
	expect(unrelatedHash).not.toBe(requiredHash);
	const registered = createRegisteredRuntimePortablePorts({ binaryChecksum });
	const effects: string[] = [];
	const exporter = new BrowserRegisteredProjectExporter({
		checksum: {
			sha256: (text) => {
				effects.push("checksum");
				return checksum.sha256(text);
			},
		},
		readPinnedSnapshot: async (definitions) => {
			effects.push("snapshot");
			expect(definitions).toStrictEqual(source.project.assetDefinitionRefs);
			return [
				{ resourceHash: requiredHash, bytes: requiredBytes },
				{ resourceHash: unrelatedHash, bytes: unrelatedBytes },
			];
		},
		smoke: {
			verify: (project, resources) => {
				effects.push("smoke");
				return registered.smoke.verify(project, resources);
			},
		},
		writer: {
			encode: (input, signal) => {
				effects.push("writer");
				return registered.writer.encode(input, signal);
			},
		},
	});
	expect(await exporter.execute(source)).toEqual({
		kind: "verification-unavailable",
	});
	expect(effects).toEqual(["snapshot"]);
});
