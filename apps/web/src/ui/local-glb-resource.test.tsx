import { describe, expect, it } from "@rstest/core";
import { loadLocalGlbResource } from "./local-glb-resource";
import type { CustomGlbAssetDefinition } from "../domain/project";

function glb(): Uint8Array {
	const json = new TextEncoder().encode('{"asset":{"version":"2.0"}} ');
	const bytes = new Uint8Array(20 + json.byteLength);
	const view = new DataView(bytes.buffer);
	view.setUint32(0, 0x46546c67, true);
	view.setUint32(4, 2, true);
	view.setUint32(8, bytes.byteLength, true);
	view.setUint32(12, json.byteLength, true);
	view.setUint32(16, 0x4e4f534a, true);
	bytes.set(json, 20);
	return bytes;
}
async function hash(bytes: Uint8Array): Promise<string> {
	return [
		...new Uint8Array(
			await crypto.subtle.digest("SHA-256", new Uint8Array(bytes).buffer),
		),
	]
		.map((value) => value.toString(16).padStart(2, "0"))
		.join("");
}
function asset(
	resourceHash: string,
	byteLength: number,
): CustomGlbAssetDefinition {
	return {
		assetDefinitionId: "model",
		displayName: "Model",
		resourceHash,
		byteLength,
		format: "glb",
		widthMm: 100,
		heightMm: 100,
		depthMm: 100,
	};
}

describe("local GLB hydration by exact resource address", () => {
	it("independently reads and verifies case aliases while preserving their raw addresses and owning the returned bytes", async () => {
		const bytes = glb();
		const lower = await hash(bytes);
		const reads: string[] = [];
		for (const resourceHash of [lower, lower.toUpperCase()]) {
			const result = await loadLocalGlbResource(
				asset(resourceHash, bytes.byteLength),
				{
					read: async (key) => {
						reads.push(key);
						return bytes;
					},
					checksum: { sha256Bytes: hash },
				},
			);
			expect(result).toEqual({
				kind: "ready",
				assetDefinitionId: "model",
				resourceHash,
				bytes,
			});
			if (result.kind !== "ready")
				throw new Error("Expected exact local bytes");
			expect(result.bytes).not.toBe(bytes);
		}
		expect(reads).toEqual([lower, lower.toUpperCase()]);
	});
	it("does not borrow a healthy alias or accept missing, malformed, wrong-length or corrupt bytes", async () => {
		const bytes = glb();
		const lower = await hash(bytes);
		const corrupt = bytes.slice();
		corrupt[corrupt.length - 1] = 0;
		for (const bad of [
			undefined,
			bytes.slice(1),
			corrupt,
			Uint8Array.of(1, 2, 3),
		]) {
			expect(
				await loadLocalGlbResource(
					asset(lower.toUpperCase(), bytes.byteLength),
					{
						read: async (key) => (key === lower ? bytes : bad),
						checksum: { sha256Bytes: hash },
					},
				),
			).toEqual({ kind: "unavailable", assetDefinitionId: "model" });
		}
	});
	it("rejects independently incorrect declared length or malformed content even with a matching digest", async () => {
		const bytes = glb();
		const resourceHash = await hash(bytes);
		for (const byteLength of [bytes.byteLength - 1, bytes.byteLength + 1]) {
			expect(
				await loadLocalGlbResource(asset(resourceHash, byteLength), {
					read: async () => bytes,
					checksum: { sha256Bytes: hash },
				}),
			).toEqual({ kind: "unavailable", assetDefinitionId: "model" });
		}
		const malformed = bytes.slice();
		malformed[0] = 0;
		expect(
			await loadLocalGlbResource(
				asset(await hash(malformed), malformed.byteLength),
				{
					read: async () => malformed,
					checksum: { sha256Bytes: hash },
				},
			),
		).toEqual({ kind: "unavailable", assetDefinitionId: "model" });
	});
	it("rejects successful but wrong or malformed checksum results for otherwise valid exact bytes", async () => {
		const bytes = glb();
		const resourceHash = await hash(bytes);
		const wrong = `${resourceHash[0] === "0" ? "1" : "0"}${resourceHash.slice(1)}`;
		for (const digest of [wrong, "G".repeat(64)]) {
			let checks = 0;
			const result = await loadLocalGlbResource(asset(resourceHash, bytes.byteLength), {
				read: async () => bytes,
				checksum: { sha256Bytes: async () => { checks++; return digest; } },
			});
			expect(result).toEqual({ kind: "unavailable", assetDefinitionId: "model" });
			expect(checks).toBe(1);
		}
	});
	it("accepts the exact25MiB boundary and snapshots the raw address before a read callback changes metadata", async () => {
		const bytes = new Uint8Array(25 * 1024 * 1024);
		bytes.fill(0x20);
		bytes.set(glb());
		const view = new DataView(bytes.buffer);
		view.setUint32(8, bytes.byteLength, true);
		view.setUint32(12, bytes.byteLength - 20, true);
		const raw = (await hash(bytes)).toUpperCase();
		const definition = asset(raw, bytes.byteLength);
		const result = await loadLocalGlbResource(definition, {
			read: async (key) => {
				expect(key).toBe(raw);
				Object.assign(definition, {
					resourceHash: "a".repeat(64),
					byteLength: 1,
					assetDefinitionId: "changed",
				});
				return bytes;
			},
			checksum: { sha256Bytes: hash },
		});
		expect(result.kind).toBe("ready");
		if (result.kind === "ready") {
			expect(result.resourceHash).toBe(raw);
			expect(result.assetDefinitionId).toBe("model");
			expect(result.bytes.byteLength).toBe(25 * 1024 * 1024);
		}
	});

	it("keeps the existing25MiB pre-parse guard and rejects malformed metadata before reading or copying resources", async () => {
		let reads = 0;
		for (const definition of [
			asset("g".repeat(64), 10),
			asset("a".repeat(64), 0),
			asset("a".repeat(64), Number.NaN),
			asset("a".repeat(64), 1.5),
			asset("a".repeat(64), 25 * 1024 * 1024 + 1),
		])
			expect(
				await loadLocalGlbResource(definition, {
					read: async () => {
						reads++;
						throw new Error("Must not read");
					},
					checksum: { sha256Bytes: hash },
				}),
			).toEqual({ kind: "unavailable", assetDefinitionId: "model" });
		expect(reads).toBe(0);
	});
	it("snapshots bytes before asynchronous checksum work and contains local read/hash failures", async () => {
		const bytes = glb();
		const resourceHash = await hash(bytes);
		const before = bytes.slice();
		expect(
			await loadLocalGlbResource(asset(resourceHash, bytes.byteLength), {
				read: async () => bytes,
				checksum: {
					sha256Bytes: async (value) => {
						bytes.fill(0);
						return hash(value);
					},
				},
			}),
		).toEqual({
			kind: "ready",
			assetDefinitionId: "model",
			resourceHash,
			bytes: before,
		});
		for (const failure of ["read", "hash"])
			expect(
				await loadLocalGlbResource(asset(resourceHash, before.byteLength), {
					read: async () => {
						if (failure === "read") throw new Error("Local read failed");
						return before;
					},
					checksum: {
						sha256Bytes: async () => {
							throw new Error("Hash unavailable");
						},
					},
				}),
			).toEqual({ kind: "unavailable", assetDefinitionId: "model" });
	});
});
