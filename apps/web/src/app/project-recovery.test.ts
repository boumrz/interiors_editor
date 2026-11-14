import { describe, expect, it } from "@rstest/core";
import { createInitialProject } from "../domain/initial-project";
import { canonicalProjectSerializer } from "../application/create-project";
import { configureRectangularRoom } from "../domain/rectangular-room";
import type { PublicationCandidate } from "../application/ports";
import type { DurablePublicationCandidate } from "../application/ports";
import {
	decodeRecoveryDraft,
	exportRecoveryDraft,
	recoveryReadOnlyProjection,
} from "./project-recovery";

async function resourceSha256(bytes: Uint8Array): Promise<string> {
	return [
		...new Uint8Array(
			await crypto.subtle.digest("SHA-256", new Uint8Array(bytes).buffer),
		),
	]
		.map((value) => value.toString(16).padStart(2, "0"))
		.join("");
}

function candidateWithHashes(
	hashes: readonly string[],
	byteLength: number,
): PublicationCandidate {
	const source = candidate();
	const project = {
		...source.project,
		assetDefinitionRefs: hashes.map((resourceHash, index) => ({
			assetDefinitionId: `model-${index}`,
			byteLength,
			depthMm: 100,
			displayName: "Model",
			format: "glb" as const,
			heightMm: 100,
			resourceHash,
			widthMm: 100,
		})),
	};
	return {
		project,
		revision: {
			...source.revision,
			serializedProject: canonicalProjectSerializer.serialize(project),
		},
	};
}

function resourceVerifier(source: PublicationCandidate) {
	const projectBytes = new TextEncoder().encode(
		source.revision.serializedProject,
	);
	return {
		sha256Bytes: async (bytes: Uint8Array) =>
			bytes.byteLength === projectBytes.byteLength &&
			bytes.every((value, index) => value === projectBytes[index])
				? source.revision.checksum
				: resourceSha256(bytes),
	};
}

function candidate(): PublicationCandidate {
	const project = createInitialProject({
		createdAt: "2026-10-24T10:00:00.000Z",
		levelId: "level",
		name: "Комната",
		projectId: "project",
	});
	return {
		project,
		revision: {
			checksum: "exact-original-checksum",
			createdAt: project.updatedAt,
			projectId: project.projectId,
			revisionId: "pending",
			schemaVersion: 1,
			serializedProject: canonicalProjectSerializer.serialize(project),
		},
	};
}

describe("unpublished recovery draft", () => {
	it("records wrong-length, corrupt, missing and unverifiable bytes without embedding them as complete resources", async () => {
		const original = candidate();
		const hash = "a".repeat(64);
		const project = {
			...original.project,
			assetDefinitionRefs: [
				{
					assetDefinitionId: "model",
					resourceHash: hash,
					byteLength: 3,
					depthMm: 100,
					displayName: "Model",
					format: "glb" as const,
					heightMm: 100,
					widthMm: 100,
				},
			],
		};
		const source = {
			project,
			revision: {
				...original.revision,
				serializedProject: canonicalProjectSerializer.serialize(project),
			},
		};
		for (const variant of [
			"missing",
			"length",
			"hash",
			"read-error",
			"checksum-error",
			"no-verifier",
		]) {
			const result = await exportRecoveryDraft(
				source,
				{
					read: async () => {
						if (variant === "read-error") throw new Error("read failed");
						return variant === "missing"
							? undefined
							: variant === "length"
								? Uint8Array.of(1, 2)
								: Uint8Array.of(1, 2, 3);
					},
				},
				variant === "no-verifier"
					? undefined
					: {
							sha256Bytes: async () => {
								if (variant === "checksum-error")
									throw new Error("hash failed");
								return variant === "hash" ? "b".repeat(64) : hash;
							},
						},
			);
			if (result.kind !== "ready")
				throw new Error("Expected recoverable source");
			expect(JSON.parse(new TextDecoder().decode(result.bytes))).toMatchObject({
				completeResources: false,
				resources: [],
				missingResourceHashes: [hash],
				candidate: source,
			});
		}
	});

	it("enforces unique-resource count and aggregate limits using declarations before reading oversized bytes", async () => {
		const original = candidate();
		const definition = {
			assetDefinitionId: "model",
			resourceHash: "a".repeat(64),
			byteLength: 1,
			depthMm: 1,
			displayName: "Model",
			format: "glb" as const,
			heightMm: 1,
			widthMm: 1,
		};
		for (const definitions of [
			Array.from({ length: 901 }, (_, i) => ({
				...definition,
				assetDefinitionId: `model-${i}`,
				resourceHash: i.toString(16).padStart(64, "0"),
			})),
			[0, 1, 2, 3].map((i) => ({
				...definition,
				assetDefinitionId: `model-${i}`,
				resourceHash: i.toString(16).padStart(64, "0"),
				byteLength: 50 * 1024 * 1024,
			})),
			...[-1, 0, 1.5].map((byteLength, i) => [
				{
					...definition,
					assetDefinitionId: `invalid-${i}`,
					byteLength,
				},
			]),
			[{ ...definition, resourceHash: "x".repeat(64) }],
			[{ ...definition, resourceHash: `x${"a".repeat(64)}` }],
			[{ ...definition, resourceHash: `${"a".repeat(64)}x` }],
			[{ ...definition, byteLength: 51 * 1024 * 1024 }],
			[
				definition,
				{ ...definition, assetDefinitionId: "different", byteLength: 2 },
			],
		]) {
			let reads = 0;
			await expect(
				exportRecoveryDraft(
					{
						...original,
						project: { ...original.project, assetDefinitionRefs: definitions },
					},
					{
						read: async () => {
							reads++;
							return undefined;
						},
					},
				),
			).resolves.toEqual({
				kind: "rejected",
				reasonCode: "RECOVERY_DRAFT_LIMIT_EXCEEDED",
			});
			expect(reads).toBe(0);
		}
		const atLimit = Array.from({ length: 900 }, (_, i) => ({
			...definition,
			assetDefinitionId: `model-${i}`,
			resourceHash: i.toString(16).padStart(64, "0"),
		}));
		await expect(
			exportRecoveryDraft({
				...original,
				project: { ...original.project, assetDefinitionRefs: atLimit },
			}),
		).resolves.toMatchObject({ kind: "ready" });
		await expect(
			exportRecoveryDraft({
				...original,
				project: {
					...original.project,
					assetDefinitionRefs: [
						{ ...definition, byteLength: 50 * 1024 * 1024 },
					],
				},
			}),
		).resolves.toMatchObject({ kind: "ready" });
		const exactAggregate = [50, 50, 50, 30].map((size, i) => ({
			...definition,
			assetDefinitionId: `limit-${i}`,
			resourceHash: i.toString(16).padStart(64, "0"),
			byteLength: size * 1024 * 1024,
		}));
		await expect(
			exportRecoveryDraft({
				...original,
				project: { ...original.project, assetDefinitionRefs: exactAggregate },
			}),
		).resolves.toMatchObject({ kind: "ready" });
	});
	it("rejects legacy/future schema drafts instead of exporting a source this recovery route cannot restore", async () => {
		const source = candidate();
		const legacy: DurablePublicationCandidate = JSON.parse(
			JSON.stringify({
				...source,
				project: { ...source.project, schemaVersion: 2 },
				revision: { ...source.revision, schemaVersion: 2 },
			}),
		);
		await expect(exportRecoveryDraft(legacy)).resolves.toEqual({
			kind: "rejected",
			reasonCode: "RECOVERY_DRAFT_UNSUPPORTED",
		});
		for (const [projectSchema, revisionSchema] of [
			[1, 2],
			[2, 1],
		]) {
			const mixed: DurablePublicationCandidate = JSON.parse(
				JSON.stringify({
					...source,
					project: { ...source.project, schemaVersion: projectSchema },
					revision: { ...source.revision, schemaVersion: revisionSchema },
				}),
			);
			await expect(exportRecoveryDraft(mixed)).resolves.toEqual({
				kind: "rejected",
				reasonCode: "RECOVERY_DRAFT_UNSUPPORTED",
			});
		}
	});
	it("uses a safe compact download stem for punctuation and repeated whitespace", async () => {
		const original = candidate();
		const result = await exportRecoveryDraft({
			...original,
			project: { ...original.project, name: "Alpha//::Beta   End" },
		});
		expect(result).toMatchObject({
			kind: "ready",
			filename: "Alpha-Beta-End.interiors-recovery.json",
		});
	});
	it("preserves the exact pending project and revision in a distinctly named, unpublished format", async () => {
		const source = candidate();
		const result = await exportRecoveryDraft(source);
		expect(result.kind).toBe("ready");
		if (result.kind !== "ready") throw new Error("Expected recovery draft");
		expect(result.filename).toBe("Комната.interiors-recovery.json");
		expect(result.mimeType).toBe("application/json");
		expect(JSON.parse(new TextDecoder().decode(result.bytes))).toEqual({
			format: "interiors-recovery-draft",
			formatVersion: 1,
			durability: "unpublished",
			completeResources: true,
			candidate: source,
			resources: [],
			missingResourceHashes: [],
		});
		expect(source).toEqual(candidate());
	});

	it("includes only hash-verified resource copies and explicitly records unavailable exact bytes", async () => {
		const source = candidate();
		const definition = {
			assetDefinitionId: "model",
			byteLength: 3,
			depthMm: 100,
			displayName: "Model",
			format: "glb" as const,
			heightMm: 100,
			widthMm: 100,
			resourceHash: "a".repeat(64),
		};
		const withResources: PublicationCandidate = {
			...source,
			project: {
				...source.project,
				assetDefinitionRefs: [
					definition,
					{
						...definition,
						assetDefinitionId: "missing",
						resourceHash: "b".repeat(64),
					},
				],
			},
		};
		const bytes = Uint8Array.of(1, 2, 255);
		const result = await exportRecoveryDraft(
			withResources,
			{
				read: async (hash) =>
					hash === definition.resourceHash ? bytes : undefined,
			},
			{ sha256Bytes: async () => definition.resourceHash },
		);
		if (result.kind !== "ready") throw new Error("Expected recovery draft");
		const parsed = JSON.parse(new TextDecoder().decode(result.bytes));
		expect(parsed.completeResources).toBe(false);
		expect(parsed.resources).toEqual([
			{
				resourceHash: definition.resourceHash,
				encoding: "base64",
				bytes: "AQL/",
			},
		]);
		expect(parsed.missingResourceHashes).toEqual(["b".repeat(64)]);
		bytes.fill(0);
		expect(
			JSON.parse(new TextDecoder().decode(result.bytes)).resources[0].bytes,
		).toBe("AQL/");
	});

	it("bounds declared resource envelopes before reading or allocating resource bytes", async () => {
		const source = candidate();
		let readCount = 0;
		const result = await exportRecoveryDraft(
			{
				...source,
				project: {
					...source.project,
					assetDefinitionRefs: [
						{
							assetDefinitionId: "too-large",
							byteLength: Number.MAX_SAFE_INTEGER,
							depthMm: 1,
							displayName: "Oversized",
							format: "glb",
							heightMm: 1,
							widthMm: 1,
							resourceHash: "a".repeat(64),
						},
					],
				},
			},
			{
				read: async () => {
					readCount++;
					return undefined;
				},
			},
		);
		expect(result).toEqual({
			kind: "rejected",
			reasonCode: "RECOVERY_DRAFT_LIMIT_EXCEEDED",
		});
		expect(readCount).toBe(0);
	});
});

describe("recovery read-only projection", () => {
	it("preserves placeholders and healthy referenced models while excluding only missing-model instances", () => {
		const ids = ["v1", "v2", "v3", "v4", "w1", "w2", "w3", "w4", "room"];
		const configured = configureRectangularRoom(
			candidate().project,
			{ depthMm: "3000", heightMm: "2600", widthMm: "4000" },
			{ next: () => ids.shift() ?? "unexpected" },
			candidate().project.updatedAt,
		);
		if (configured.kind !== "accepted") throw new Error("Expected room");
		const definition = {
			assetDefinitionId: "healthy",
			resourceHash: "a".repeat(64),
			byteLength: 3,
			depthMm: 100,
			displayName: "Healthy",
			format: "glb" as const,
			heightMm: 100,
			widthMm: 100,
		};
		const item = {
			assetInstanceId: "placeholder",
			anchorClass: "floor" as const,
			color: "#716796",
			depthMm: 100,
			heightMm: 100,
			label: "Item",
			roomId: "room",
			widthMm: 100,
			xMm: 1000,
			zMm: 1000,
		};
		const project = {
			...configured.project,
			assetDefinitionRefs: [
				definition,
				{
					...definition,
					assetDefinitionId: "missing",
					resourceHash: "b".repeat(64),
				},
			],
			assetInstances: [
				item,
				{
					...item,
					assetInstanceId: "healthy-instance",
					assetDefinitionId: "healthy",
					xMm: 1500,
				},
				{
					...item,
					assetInstanceId: "missing-instance",
					assetDefinitionId: "missing",
					xMm: 2000,
				},
			],
		};
		const result = recoveryReadOnlyProjection(project, ["b".repeat(64)]);
		expect(result.assetDefinitionRefs).toEqual([definition]);
		expect(
			result.assetInstances.map((instance) => instance.assetInstanceId),
		).toEqual(["placeholder", "healthy-instance"]);
		expect(project.assetDefinitionRefs).toHaveLength(2);
		expect(project.assetInstances).toHaveLength(3);
		expect(Object.isFrozen(result.assetInstances[0])).toBe(true);
	});
	it("detaches and freezes geometry, excluding only definitions and instances whose exact resource is unresolved", () => {
		const source = candidate();
		const definition = {
			assetDefinitionId: "missing",
			byteLength: 3,
			depthMm: 100,
			displayName: "Model",
			format: "glb" as const,
			heightMm: 100,
			widthMm: 100,
			resourceHash: "a".repeat(64),
		};
		const project = { ...source.project, assetDefinitionRefs: [definition] };
		const preview = recoveryReadOnlyProjection(project, [
			definition.resourceHash,
		]);
		expect(preview.assetDefinitionRefs).toEqual([]);
		expect(preview.level).toEqual(project.level);
		expect(preview.level).not.toBe(project.level);
		expect(Object.isFrozen(preview.level.vertices)).toBe(true);
		expect(project.assetDefinitionRefs).toEqual([definition]);
	});
});

describe("explicit recovery draft restoration", () => {
	it("honors cancellation before decoding, after the project digest and after a model digest without verifying later resources", async () => {
		const original = candidate();
		const noResources = await exportRecoveryDraft(original);
		if (noResources.kind !== "ready") throw new Error("Expected draft");
		await expect(
			decodeRecoveryDraft(
				noResources.bytes,
				{ sha256Bytes: async () => original.revision.checksum },
				{ aborted: true },
			),
		).resolves.toEqual({ kind: "cancelled" });
		const projectSignal = { aborted: false };
		await expect(
			decodeRecoveryDraft(
				noResources.bytes,
				{
					sha256Bytes: async () => {
						projectSignal.aborted = true;
						return original.revision.checksum;
					},
				},
				projectSignal,
			),
		).resolves.toEqual({ kind: "cancelled" });
		const firstHash = "a".repeat(64),
			secondHash = "b".repeat(64);
		const definition = {
			assetDefinitionId: "first",
			resourceHash: firstHash,
			byteLength: 3,
			depthMm: 100,
			displayName: "First",
			format: "glb" as const,
			heightMm: 100,
			widthMm: 100,
		};
		const project = {
			...original.project,
			assetDefinitionRefs: [
				definition,
				{
					...definition,
					assetDefinitionId: "second",
					resourceHash: secondHash,
					byteLength: 4,
				},
			],
		};
		const source = {
			project,
			revision: {
				...original.revision,
				serializedProject: canonicalProjectSerializer.serialize(project),
			},
		};
		const exported = await exportRecoveryDraft(
			source,
			{
				read: async (hash) =>
					hash === firstHash
						? Uint8Array.of(1, 2, 3)
						: Uint8Array.of(4, 5, 6, 7),
			},
			{
				sha256Bytes: async (bytes) =>
					bytes.length === 3 ? firstHash : secondHash,
			},
		);
		if (exported.kind !== "ready") throw new Error("Expected resource draft");
		const signal = { aborted: false };
		let hashes = 0;
		await expect(
			decodeRecoveryDraft(
				exported.bytes,
				{
					sha256Bytes: async (bytes) => {
						hashes++;
						if (bytes.length === 3) {
							signal.aborted = true;
							return firstHash;
						}
						return bytes.length === 4 ? secondHash : source.revision.checksum;
					},
				},
				signal,
			),
		).resolves.toEqual({ kind: "cancelled" });
		expect(hashes).toBe(2);
		const singleProject = { ...project, assetDefinitionRefs: [definition] };
		const singleSource = {
			project: singleProject,
			revision: {
				...source.revision,
				serializedProject: canonicalProjectSerializer.serialize(singleProject),
			},
		};
		const single = await exportRecoveryDraft(
			singleSource,
			{ read: async () => Uint8Array.of(1, 2, 3) },
			{ sha256Bytes: async () => firstHash },
		);
		if (single.kind !== "ready") throw new Error("Expected single model");
		const lastSignal = { aborted: false };
		await expect(
			decodeRecoveryDraft(
				single.bytes,
				{
					sha256Bytes: async (bytes) => {
						if (bytes.length === 3) {
							lastSignal.aborted = true;
							return firstHash;
						}
						return source.revision.checksum;
					},
				},
				lastSignal,
			),
		).resolves.toEqual({ kind: "cancelled" });
	});
	it("keeps depth, token and literal boundaries inclusive while tracking balanced siblings and escaped names", async () => {
		const verifier = { sha256Bytes: async () => candidate().revision.checksum };
		for (const raw of [
			`${"[".repeat(64)}0${"]".repeat(64)}`,
			`${'{"n":'.repeat(64)}0${"}".repeat(64)}`,
			`[${Array.from({ length: 249_999 }, () => "0").join(",")}]`,
			"9".repeat(64),
			`[${"{},".repeat(100)}{}]`,
		]) {
			await expect(
				decodeRecoveryDraft(new TextEncoder().encode(raw), verifier),
			).resolves.toEqual({
				kind: "rejected",
				reasonCode: "RECOVERY_DRAFT_INVALID",
			});
		}
		const original = candidate();
		const project = {
			...original.project,
			name: 'Room "quoted" \\ braces { [ ] }',
		};
		const source = {
			project,
			revision: {
				...original.revision,
				serializedProject: canonicalProjectSerializer.serialize(project),
			},
		};
		const exported = await exportRecoveryDraft(source);
		if (exported.kind !== "ready") throw new Error("Expected escaped draft");
		await expect(
			decodeRecoveryDraft(exported.bytes, verifier),
		).resolves.toEqual({ kind: "accepted", candidate: source, resources: [] });
	});
	it("rejects each broken revision binding, unexpected member and contradictory completeness claim independently", async () => {
		const source = candidate();
		const exported = await exportRecoveryDraft(source);
		if (exported.kind !== "ready") throw new Error("Expected draft");
		const data = JSON.parse(new TextDecoder().decode(exported.bytes));
		const invalid = [
			{ ...data, format: "other-format" },
			{ ...data, durability: "durable" },
			...[
				{ schemaVersion: 2 },
				{ projectId: "other" },
				{ createdAt: "2026-10-24T11:00:00.000Z" },
				{ revisionId: "" },
				{ revisionId: 123 },
				{ extra: true },
			].map((change) => ({
				...data,
				candidate: {
					...data.candidate,
					revision: { ...data.candidate.revision, ...change },
				},
			})),
			{ ...data, candidate: { ...data.candidate, extra: true } },
		];
		for (const changed of invalid)
			await expect(
				decodeRecoveryDraft(new TextEncoder().encode(JSON.stringify(changed)), {
					sha256Bytes: async () => source.revision.checksum,
				}),
			).resolves.toEqual({
				kind: "rejected",
				reasonCode: "RECOVERY_DRAFT_INVALID",
			});
		for (const changed of [
			{ ...data, completeResources: false },
			{ ...data, missingResourceHashes: ["a".repeat(64)] },
		])
			await expect(
				decodeRecoveryDraft(new TextEncoder().encode(JSON.stringify(changed)), {
					sha256Bytes: async () => source.revision.checksum,
				}),
			).resolves.toEqual({
				kind: "rejected",
				reasonCode: "RECOVERY_DRAFT_INCOMPLETE",
			});
	});

	it("roundtrips byte padding and several base64 chunks without separators or missing tail bytes", async () => {
		for (const length of [1, 2, 12_287, 12_288, 12_289]) {
			const original = candidate();
			const hash = "a".repeat(64);
			const bytes = Uint8Array.from({ length }, (_, i) => i % 251);
			const project = {
				...original.project,
				assetDefinitionRefs: [
					{
						assetDefinitionId: "model",
						resourceHash: hash,
						byteLength: length,
						depthMm: 100,
						displayName: "Model",
						format: "glb" as const,
						heightMm: 100,
						widthMm: 100,
					},
				],
			};
			const source = {
				project,
				revision: {
					...original.revision,
					serializedProject: canonicalProjectSerializer.serialize(project),
				},
			};
			const verifier = {
				sha256Bytes: async (value: Uint8Array) =>
					value.length === bytes.length &&
					value.every((byte, i) => byte === bytes[i])
						? hash
						: source.revision.checksum,
			};
			const exported = await exportRecoveryDraft(
				source,
				{ read: async () => bytes },
				verifier,
			);
			if (exported.kind !== "ready") throw new Error("Expected complete draft");
			await expect(
				decodeRecoveryDraft(exported.bytes, verifier),
			).resolves.toEqual({
				kind: "accepted",
				candidate: source,
				resources: [{ resourceHash: hash, bytes }],
			});
			if (length === 1) {
				const raw = JSON.parse(new TextDecoder().decode(exported.bytes));
				raw.resources[0].bytes = "AA\n\n";
				await expect(
					decodeRecoveryDraft(
						new TextEncoder().encode(JSON.stringify(raw)),
						verifier,
					),
				).resolves.toEqual({
					kind: "rejected",
					reasonCode: "RECOVERY_DRAFT_INVALID",
				});
			}
		}
	});

	it("exports the same immutable resource bytes that were verified while the caller changes its buffer", async () => {
		const original = candidate();
		const hash = "a".repeat(64);
		const bytes = Uint8Array.of(0);
		const project = {
			...original.project,
			assetDefinitionRefs: [
				{
					assetDefinitionId: "model",
					resourceHash: hash,
					byteLength: 1,
					depthMm: 100,
					displayName: "Model",
					format: "glb" as const,
					heightMm: 100,
					widthMm: 100,
				},
			],
		};
		const source = {
			project,
			revision: {
				...original.revision,
				serializedProject: canonicalProjectSerializer.serialize(project),
			},
		};
		let release!: () => void;
		let start!: () => void;
		const gate = new Promise<void>((resolve) => {
			release = resolve;
		});
		const started = new Promise<void>((resolve) => {
			start = resolve;
		});
		const exporting = exportRecoveryDraft(
			source,
			{ read: async () => bytes },
			{
				sha256Bytes: async (snapshot) => {
					const exact = snapshot[0] === 0;
					start();
					await gate;
					return exact ? hash : "wrong";
				},
			},
		);
		expect(
			await Promise.race([
				started.then(() => "hash-started"),
				exporting.then(() => "completed-before-hash"),
			]),
		).toBe("hash-started");
		bytes[0] = 7;
		release();
		const exported = await exporting;
		if (exported.kind !== "ready") throw new Error("Expected complete draft");
		expect(JSON.parse(new TextDecoder().decode(exported.bytes))).toMatchObject({
			completeResources: true,
			resources: [{ resourceHash: hash, encoding: "base64", bytes: "AA==" }],
		});
	});

	it("rejects malformed UTF-8 even when replacement decoding would recreate a valid project name", async () => {
		const original = candidate();
		const project = { ...original.project, name: "Room �" };
		const source = {
			project,
			revision: {
				...original.revision,
				serializedProject: canonicalProjectSerializer.serialize(project),
			},
		};
		const exported = await exportRecoveryDraft(source);
		if (exported.kind !== "ready") throw new Error("Expected draft");
		const index = exported.bytes.findIndex(
			(value, i) =>
				value === 0xef &&
				exported.bytes[i + 1] === 0xbf &&
				exported.bytes[i + 2] === 0xbd,
		);
		const invalid = new Uint8Array(exported.bytes.length - 2);
		invalid.set(exported.bytes.subarray(0, index));
		invalid[index] = 0xff;
		invalid.set(exported.bytes.subarray(index + 3), index + 1);
		await expect(
			decodeRecoveryDraft(invalid, {
				sha256Bytes: async () => source.revision.checksum,
			}),
		).resolves.toEqual({
			kind: "rejected",
			reasonCode: "RECOVERY_DRAFT_INVALID",
		});
	});
	it("rejects excessive nesting and structural expansion before invoking the verifier", async () => {
		let verifications = 0;
		const verifier = {
			sha256Bytes: async () => {
				verifications++;
				return "unused";
			},
		};
		for (const raw of [
			`${"[".repeat(65)}0${"]".repeat(65)}`,
			`${'{"n":'.repeat(65)}0${"}".repeat(65)}`,
			`[${"[],".repeat(85_000)}[]]`,
			"9".repeat(65),
		]) {
			await expect(
				decodeRecoveryDraft(new TextEncoder().encode(raw), verifier),
			).resolves.toEqual({
				kind: "rejected",
				reasonCode: "RECOVERY_DRAFT_LIMIT_EXCEEDED",
			});
		}
		expect(verifications).toBe(0);
	});
	it("validates the exact project/revision binding and every embedded resource before returning an import source", async () => {
		const source = candidate();
		const exported = await exportRecoveryDraft(source);
		if (exported.kind !== "ready") throw new Error("Expected draft");
		await expect(
			decodeRecoveryDraft(exported.bytes, {
				sha256Bytes: async () => source.revision.checksum,
			}),
		).resolves.toEqual({ kind: "accepted", candidate: source, resources: [] });
	});

	it("rejects altered, duplicate-key, foreign-schema and incomplete drafts without reinterpreting their source", async () => {
		const source = candidate();
		const exported = await exportRecoveryDraft(source);
		if (exported.kind !== "ready") throw new Error("Expected draft");
		const text = new TextDecoder().decode(exported.bytes);
		const data = JSON.parse(text);
		for (const raw of [
			text.replace('"formatVersion":1', '"formatVersion":1,"formatVersion":1'),
			JSON.stringify({ ...data, formatVersion: 2 }),
			JSON.stringify({
				...data,
				candidate: {
					...data.candidate,
					project: { ...data.candidate.project, name: "Changed" },
				},
			}),
		]) {
			await expect(
				decodeRecoveryDraft(new TextEncoder().encode(raw), {
					sha256Bytes: async () => source.revision.checksum,
				}),
			).resolves.toEqual({
				kind: "rejected",
				reasonCode: "RECOVERY_DRAFT_INVALID",
			});
		}
		await expect(
			decodeRecoveryDraft(
				new TextEncoder().encode(
					JSON.stringify({
						...data,
						completeResources: false,
						missingResourceHashes: ["a".repeat(64)],
					}),
				),
				{ sha256Bytes: async () => source.revision.checksum },
			),
		).resolves.toEqual({
			kind: "rejected",
			reasonCode: "RECOVERY_DRAFT_INCOMPLETE",
		});
		await expect(
			decodeRecoveryDraft(exported.bytes, { sha256Bytes: async () => "wrong" }),
		).resolves.toEqual({
			kind: "rejected",
			reasonCode: "RECOVERY_DRAFT_INVALID",
		});
	});

	it("verifies base64 resource bytes and rejects the wrong hash, encoding or length", async () => {
		const source = candidate();
		const hash = "a".repeat(64);
		const project = {
			...source.project,
			assetDefinitionRefs: [
				{
					assetDefinitionId: "model",
					byteLength: 3,
					depthMm: 100,
					displayName: "Model",
					format: "glb" as const,
					heightMm: 100,
					widthMm: 100,
					resourceHash: hash,
				},
			],
		};
		const withResource = {
			...source,
			project,
			revision: {
				...source.revision,
				serializedProject: canonicalProjectSerializer.serialize(project),
			},
		};
		const verifier = {
			sha256Bytes: async (bytes: Uint8Array) =>
				bytes.byteLength === 3 &&
				bytes[0] === 1 &&
				bytes[1] === 2 &&
				bytes[2] === 255
					? hash
					: source.revision.checksum,
		};
		const exported = await exportRecoveryDraft(
			withResource,
			{ read: async () => Uint8Array.of(1, 2, 255) },
			verifier,
		);
		if (exported.kind !== "ready") throw new Error("Expected draft");
		await expect(
			decodeRecoveryDraft(exported.bytes, verifier),
		).resolves.toEqual({
			kind: "accepted",
			candidate: withResource,
			resources: [{ resourceHash: hash, bytes: Uint8Array.of(1, 2, 255) }],
		});
		const raw = JSON.parse(new TextDecoder().decode(exported.bytes));
		await expect(
			decodeRecoveryDraft(
				new TextEncoder().encode(JSON.stringify({ ...raw, resources: [] })),
				verifier,
			),
		).resolves.toEqual({
			kind: "rejected",
			reasonCode: "RECOVERY_DRAFT_INVALID",
		});
		for (const resource of [
			{ ...raw.resources[0], bytes: "AQI=" },
			{ ...raw.resources[0], bytes: "AQL_" },
			{ ...raw.resources[0], bytes: "AQIA" },
			{ ...raw.resources[0], encoding: "array" },
			{ ...raw.resources[0], resourceHash: "b".repeat(64) },
		]) {
			await expect(
				decodeRecoveryDraft(
					new TextEncoder().encode(
						JSON.stringify({ ...raw, resources: [resource] }),
					),
					verifier,
				),
			).resolves.toEqual({
				kind: "rejected",
				reasonCode: "RECOVERY_DRAFT_INVALID",
			});
		}
	});
});

describe("recovery resources preserve original SHA alias keys", () => {
	it("rejects the wrong decoded length even when base64 has the expected encoded length and SHA bits are correct", async () => {
		for (const [declared, actual] of [
			[1, 2],
			[4, 5],
			[4, 6],
		]) {
			const bytes = Uint8Array.from(
				{ length: actual },
				(_, index) => index + 1,
			);
			const hash = await resourceSha256(bytes);
			const source = candidateWithHashes([hash], declared);
			const incomplete = await exportRecoveryDraft(source);
			if (incomplete.kind !== "ready")
				throw new Error("Expected bounded source draft");
			const raw = JSON.parse(new TextDecoder().decode(incomplete.bytes));
			const encoded = btoa(String.fromCharCode(...bytes));
			expect(encoded.length).toBe(Math.ceil(declared / 3) * 4);
			const changed = new TextEncoder().encode(
				JSON.stringify({
					...raw,
					completeResources: true,
					missingResourceHashes: [],
					resources: [
						{ resourceHash: hash, encoding: "base64", bytes: encoded },
					],
				}),
			);
			expect(
				await decodeRecoveryDraft(changed, resourceVerifier(source)),
			).toEqual({
				kind: "rejected",
				reasonCode: "RECOVERY_DRAFT_INVALID",
			});
		}
	});
	it("roundtrips every independently verified original key and retains an opaque Revision checksum", async () => {
		const bytes = Uint8Array.of(1, 2, 3, 255);
		const lower = await resourceSha256(bytes);
		const mixed = [...lower]
			.map((value, index) => (index % 2 ? value.toUpperCase() : value))
			.join("");
		const aliases = [lower, lower.toUpperCase(), mixed];
		expect(new Set(aliases).size).toBe(3);
		const source = candidateWithHashes(aliases, bytes.byteLength);
		const before = structuredClone(source);
		const reads: string[] = [];
		let hashes = 0;
		const exported = await exportRecoveryDraft(
			source,
			{
				read: async (hash) => {
					reads.push(hash);
					return aliases.includes(hash) ? bytes.slice() : undefined;
				},
			},
			{
				sha256Bytes: async (value) => {
					hashes++;
					return (await resourceSha256(value)).toUpperCase();
				},
			},
		);
		expect(exported.kind).toBe("ready");
		if (exported.kind !== "ready")
			throw new Error("Expected complete original-key draft");
		const raw = JSON.parse(new TextDecoder().decode(exported.bytes));
		expect(raw.completeResources).toBe(true);
		expect(raw.missingResourceHashes).toEqual([]);
		expect(
			raw.resources.map(
				(value: { resourceHash: string }) => value.resourceHash,
			),
		).toEqual(aliases);
		expect(reads).toEqual(aliases);
		expect(hashes).toBe(3);
		expect(
			await decodeRecoveryDraft(exported.bytes, resourceVerifier(source)),
		).toEqual({
			kind: "accepted",
			candidate: source,
			resources: aliases.map((resourceHash) => ({ resourceHash, bytes })),
		});
		expect(source).toEqual(before);
		expect(source.revision.checksum).toBe("exact-original-checksum");
	});

	it("records the exact missing, wrong-length or corrupt case key without borrowing its healthy alias", async () => {
		const bytes = Uint8Array.of(1, 2, 3, 255);
		const lower = await resourceSha256(bytes),
			upper = lower.toUpperCase();
		const source = candidateWithHashes([lower, upper], bytes.byteLength);
		for (const bad of [
			undefined,
			bytes.subarray(0, 3),
			Uint8Array.of(1, 2, 3, 254),
		]) {
			const reads: string[] = [];
			const exported = await exportRecoveryDraft(
				source,
				{
					read: async (hash) => {
						reads.push(hash);
						return hash === lower ? bytes : bad;
					},
				},
				{ sha256Bytes: resourceSha256 },
			);
			expect(exported.kind).toBe("ready");
			if (exported.kind !== "ready")
				throw new Error("Expected incomplete source draft");
			expect(
				JSON.parse(new TextDecoder().decode(exported.bytes)),
			).toMatchObject({
				completeResources: false,
				missingResourceHashes: [upper],
				resources: [
					{ resourceHash: lower, encoding: "base64", bytes: "AQID/w==" },
				],
			});
			expect(reads).toEqual([lower, upper]);
			expect(
				await decodeRecoveryDraft(exported.bytes, resourceVerifier(source)),
			).toEqual({
				kind: "rejected",
				reasonCode: "RECOVERY_DRAFT_INCOMPLETE",
			});
		}
	});

	it("rejects a removed, replaced or corrupted alias entry and malformed resource digests", async () => {
		const bytes = Uint8Array.of(1, 2, 3, 255);
		const lower = await resourceSha256(bytes),
			upper = lower.toUpperCase();
		const source = candidateWithHashes([lower, upper], bytes.byteLength);
		const exported = await exportRecoveryDraft(
			source,
			{ read: async () => bytes },
			{ sha256Bytes: resourceSha256 },
		);
		if (exported.kind !== "ready")
			throw new Error("Expected complete source draft");
		const raw = JSON.parse(new TextDecoder().decode(exported.bytes));
		for (const entries of [
			raw.resources.slice(0, 1),
			[raw.resources[0], { ...raw.resources[1], resourceHash: lower }],
			[raw.resources[0], { ...raw.resources[1], bytes: "AQID/g==" }],
			[raw.resources[0], { ...raw.resources[1], bytes: "AQID" }],
		]) {
			expect(
				await decodeRecoveryDraft(
					new TextEncoder().encode(
						JSON.stringify({ ...raw, resources: entries }),
					),
					resourceVerifier(source),
				),
			).toEqual({
				kind: "rejected",
				reasonCode: "RECOVERY_DRAFT_INVALID",
			});
		}
		for (const digest of [
			lower.slice(1),
			`${lower}0`,
			`g${lower.slice(1)}`,
			`${lower}\n`,
		]) {
			const verifier = resourceVerifier(source);
			expect(
				await decodeRecoveryDraft(exported.bytes, {
					sha256Bytes: async (value) =>
						value.byteLength === bytes.byteLength
							? digest
							: verifier.sha256Bytes(value),
				}),
			).toEqual({ kind: "rejected", reasonCode: "RECOVERY_DRAFT_INVALID" });
			const draft = await exportRecoveryDraft(
				source,
				{ read: async () => bytes },
				{ sha256Bytes: async () => digest },
			);
			if (draft.kind !== "ready")
				throw new Error("Expected recoverable incomplete draft");
			expect(JSON.parse(new TextDecoder().decode(draft.bytes))).toMatchObject({
				completeResources: false,
				resources: [],
				missingResourceHashes: [lower, upper],
			});
		}
	});

	it("keeps Revision checksum comparison literal while resource digests compare by bits", async () => {
		const source = candidateWithHashes([], 1);
		const withChecksum = {
			...source,
			revision: { ...source.revision, checksum: "a".repeat(64) },
		};
		const exported = await exportRecoveryDraft(withChecksum);
		if (exported.kind !== "ready") throw new Error("Expected source draft");
		expect(
			await decodeRecoveryDraft(exported.bytes, {
				sha256Bytes: async () => "A".repeat(64),
			}),
		).toEqual({
			kind: "rejected",
			reasonCode: "RECOVERY_DRAFT_INVALID",
		});
	});

	it("excludes only the unresolved exact key from a read-only recovery projection", () => {
		const lower = "a".repeat(64),
			upper = lower.toUpperCase();
		const source = candidateWithHashes([lower, upper], 1);
		const projection = recoveryReadOnlyProjection(source.project, [lower]);
		expect(
			projection.assetDefinitionRefs.map((value) => value.resourceHash),
		).toEqual([upper]);
		expect(
			source.project.assetDefinitionRefs.map((value) => value.resourceHash),
		).toEqual([lower, upper]);
	});
});
