import { expect, it } from "@rstest/core";
import { createInitialProject } from "../domain/initial-project";
import { assessBrowserBackupRepresentability } from "./browser-backup-representability";

const cryptoModule = "node:crypto";
async function digest(bytes: Uint8Array): Promise<string> {
	const native: {
		createHash(name: string): {
			update(bytes: Uint8Array): { digest(encoding: "hex"): string };
		};
	} = await import(cryptoModule);
	return native.createHash("sha256").update(bytes).digest("hex");
}
async function fixture() {
	const original = createInitialProject({
		createdAt: "2026-11-04T12:00:00.000Z",
		levelId: "level",
		name: "Resource set",
		projectId: "source",
	});
	const resources = await Promise.all(
		[Uint8Array.of(1, 2, 3), Uint8Array.of(5, 7, 11)].map(async (bytes) => ({
			resourceHash: await digest(bytes),
			bytes,
		})),
	);
	const project = {
		...original,
		assetDefinitionRefs: resources.map(({ resourceHash, bytes }, index) => ({
			assetDefinitionId: `model-${index}`,
			displayName: "Model",
			format: "glb" as const,
			resourceHash,
			byteLength: bytes.byteLength,
			widthMm: 100,
			depthMm: 100,
			heightMm: 100,
		})),
	};
	let digests = 0;
	return {
		project,
		resources,
		digests: () => digests,
		checksum: {
			sha256Bytes: async (bytes: Uint8Array) => {
				digests++;
				return digest(bytes);
			},
		},
	};
}
const rejected = {
	kind: "rejected",
	reasonCode: "PROJECT_BACKUP_ENVELOPE_EXCEEDED",
};
it("rejects duplicate provided addresses even when their count matches the distinct project manifest", async () => {
	const f = await fixture();
	expect(
		await assessBrowserBackupRepresentability(
			f.project,
			[f.resources[0], f.resources[0]],
			f.checksum,
		),
	).toEqual(rejected);
	expect(f.digests()).toBe(0);
	expect(
		f.project.assetDefinitionRefs.map(({ resourceHash }) => resourceHash),
	).toEqual(f.resources.map(({ resourceHash }) => resourceHash));
});
it("rejects a same-count unrelated resource before hashing the earlier valid member", async () => {
	const f = await fixture(),
		bytes = Uint8Array.of(13, 17, 19),
		unrelated = { resourceHash: await digest(bytes), bytes };
	expect(
		await assessBrowserBackupRepresentability(
			f.project,
			[f.resources[0], unrelated],
			f.checksum,
		),
	).toEqual(rejected);
	expect(f.digests()).toBe(0);
});
it("accepts every exact manifest resource independently of its provided order", async () => {
	const f = await fixture(),
		reversed = [...f.resources].reverse();
	const result = await assessBrowserBackupRepresentability(
		f.project,
		reversed,
		f.checksum,
	);
	expect(result.kind).toBe("representable");
	if (result.kind !== "representable")
		throw new Error("Exact resource set rejected");
	expect(
		result.proof.resources.map(({ resourceHash }) => resourceHash),
	).toEqual(reversed.map(({ resourceHash }) => resourceHash));
	expect(f.digests()).toBe(2);
});
