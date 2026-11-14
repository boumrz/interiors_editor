import { expect, it } from "@rstest/core";
import { canonicalProjectSerializer } from "../../application/create-project";
import { createInitialProject } from "../../domain/initial-project";
import {
	readBrowserReadonlyResource,
	readUnverifiedBrowserSnapshot,
	verifyBrowserReadonlySnapshot,
} from "./browser-readonly-project-snapshot";
const checksum = {
	async sha256(value: string) {
		const digest = await crypto.subtle.digest(
			"SHA-256",
			new TextEncoder().encode(value),
		);
		return Array.from(new Uint8Array(digest), (v) =>
			v.toString(16).padStart(2, "0"),
		).join("");
	},
};
async function fixture() {
	const project = createInitialProject({
			projectId: "owned-project",
			levelId: "level",
			name: "Exact source",
			createdAt: "2026-11-05T00:00:00.000Z",
		}),
		serializedProject = canonicalProjectSerializer.serialize(project),
		revisionId = "owned-revision",
		scope = "browser-registered-v1",
		attemptId = `${scope}:attempt:1`,
		candidate = {
			project,
			revision: {
				schemaVersion: 1 as const,
				projectId: project.projectId,
				revisionId,
				createdAt: project.createdAt,
				serializedProject,
				checksum: await checksum.sha256(serializedProject),
			},
		},
		resourceManifest: readonly unknown[] = [];
	const receipt = {
		revisionId,
		checksum: candidate.revision.checksum,
		resourceManifest,
	};
	const creation = {
		protocolVersion: 1,
		scope,
		projectId: project.projectId,
		attemptId,
		ownerId: "owner",
		fencingToken: 1,
		expectedBaseRevisionId: null,
		revisionId,
		serializedProject,
		checksum: candidate.revision.checksum,
		resourceManifest,
		intent: "mutation",
		state: "published",
		receipt,
	};
	return {
		candidate,
		legacy: {
			storageNamespace: "legacy" as const,
			projectId: project.projectId,
			pointer: {
				projectId: project.projectId,
				name: project.name,
				currentRevisionId: revisionId,
			},
			revision: { revisionId, candidate },
		},
		registered: {
			storageNamespace: "browser-registered" as const,
			projectId: project.projectId,
			pointer: {
				scope,
				projectId: project.projectId,
				name: project.name,
				currentRevisionId: revisionId,
			},
			revision: {
				scope,
				projectId: project.projectId,
				revisionId,
				candidate,
				creationAttemptId: attemptId,
				resourceManifest,
			},
			creation,
		},
	};
}
it("raw recovery refuses each foreign current address without changing the retained original string", async () => {
	const f = await fixture();
	for (const source of [f.legacy, f.registered]) {
		const expected = readUnverifiedBrowserSnapshot(source, "owned-revision");
		expect(expected?.serializedProject).toBe(
			f.candidate.revision.serializedProject,
		);
		for (const change of [
			{ projectId: "foreign" },
			{ pointer: null },
			{ pointer: [] },
			{ pointer: { ...source.pointer, projectId: "foreign" } },
			{ pointer: { ...source.pointer, currentRevisionId: "foreign" } },
			{ revision: null },
			{ revision: [] },
			{ revision: { ...source.revision, revisionId: "foreign" } },
			{ revision: { ...source.revision, candidate: null } },
			{
				revision: {
					...source.revision,
					candidate: { ...f.candidate, project: null },
				},
			},
			{
				revision: {
					...source.revision,
					candidate: {
						...f.candidate,
						project: { ...f.candidate.project, projectId: "foreign" },
					},
				},
			},
			{
				revision: {
					...source.revision,
					candidate: { ...f.candidate, revision: null },
				},
			},
			{
				revision: {
					...source.revision,
					candidate: {
						...f.candidate,
						revision: { ...f.candidate.revision, projectId: "foreign" },
					},
				},
			},
			{
				revision: {
					...source.revision,
					candidate: {
						...f.candidate,
						revision: { ...f.candidate.revision, revisionId: "foreign" },
					},
				},
			},
			{
				revision: {
					...source.revision,
					candidate: {
						...f.candidate,
						revision: { ...f.candidate.revision, serializedProject: 7 },
					},
				},
			},
		])
			expect(
				readUnverifiedBrowserSnapshot(
					{ ...source, ...change },
					"owned-revision",
				),
			).toBeUndefined();
		expect(
			readUnverifiedBrowserSnapshot(source, "another-revision"),
		).toBeUndefined();
		expect(readUnverifiedBrowserSnapshot(source, "owned-revision")).toEqual(
			expected,
		);
	}
	for (const change of [
		{ pointer: { ...f.registered.pointer, scope: "foreign" } },
		{ revision: { ...f.registered.revision, scope: "foreign" } },
		{ revision: { ...f.registered.revision, projectId: "foreign" } },
	])
		expect(
			readUnverifiedBrowserSnapshot(
				{ ...f.registered, ...change },
				"owned-revision",
			),
		).toBeUndefined();
});
it("healthy source verification refuses unknown row fields, pointer names and original Revision proof disagreements", async () => {
	const f = await fixture();
	for (const source of [f.legacy, f.registered]) {
		expect(
			(await verifyBrowserReadonlySnapshot(source, checksum))?.candidate,
		).toBe(f.candidate);
		for (const change of [
			{ pointer: { ...source.pointer, extra: true } },
			{ pointer: { ...source.pointer, name: "foreign name" } },
			{ revision: { ...source.revision, extra: true } },
			{
				revision: {
					...source.revision,
					candidate: {
						...f.candidate,
						revision: { ...f.candidate.revision, schemaVersion: 2 },
					},
				},
			},
			{
				revision: {
					...source.revision,
					candidate: {
						...f.candidate,
						revision: { ...f.candidate.revision, revisionId: "" },
					},
				},
			},
			{
				revision: {
					...source.revision,
					candidate: {
						...f.candidate,
						revision: { ...f.candidate.revision, createdAt: 7 },
					},
				},
			},
			{
				revision: {
					...source.revision,
					candidate: {
						...f.candidate,
						revision: { ...f.candidate.revision, serializedProject: "{}" },
					},
				},
			},
			{
				revision: {
					...source.revision,
					candidate: {
						...f.candidate,
						revision: { ...f.candidate.revision, checksum: "0".repeat(64) },
					},
				},
			},
		])
			expect(
				await verifyBrowserReadonlySnapshot({ ...source, ...change }, checksum),
			).toBeUndefined();
		expect(
			await verifyBrowserReadonlySnapshot(source, {
				async sha256() {
					throw new Error("owned checksum refusal");
				},
			}),
		).toBeUndefined();
	}
});
it("private healthy verification requires every exact creation/receipt field and dense empty resource manifests", async () => {
	const f = await fixture(),
		source = f.registered;
	const patches: Readonly<Record<string, unknown>>[] = [
		{ protocolVersion: 2 },
		{ scope: "foreign" },
		{ projectId: "foreign" },
		{ attemptId: 7 },
		{ attemptId: "browser-registered-v1:attempt:foreign" },
		{ ownerId: 7 },
		{ fencingToken: 0 },
		{ fencingToken: -1 },
		{ fencingToken: 1.5 },
		{ fencingToken: Number.NaN },
		{ fencingToken: "1" },
		{ expectedBaseRevisionId: 7 },
		{ revisionId: "foreign" },
		{ checksum: "foreign" },
		{ serializedProject: "foreign" },
		{ intent: "history" },
		{ state: "prepared" },
		{ leaseId: 7 },
		{ leaseId: "foreign" },
		{ extra: true },
		{ receipt: null },
		{ receipt: { ...source.creation.receipt, extra: true } },
		{ receipt: { ...source.creation.receipt, checksum: "foreign" } },
		{ resourceManifest: Array(1) },
		{ receipt: { ...source.creation.receipt, resourceManifest: Array(1) } },
	];
	for (const patch of patches)
		expect(
			await verifyBrowserReadonlySnapshot(
				{ ...source, creation: { ...source.creation, ...patch } },
				checksum,
			),
		).toBeUndefined();
	for (const key of Object.keys(source.creation)) {
		const creation: Record<string, unknown> = { ...source.creation };
		delete creation[key];
		expect(
			await verifyBrowserReadonlySnapshot({ ...source, creation }, checksum),
		).toBeUndefined();
	}
	expect(
		await verifyBrowserReadonlySnapshot(
			{
				...source,
				revision: { ...source.revision, resourceManifest: Array(1) },
			},
			checksum,
		),
	).toBeUndefined();
	expect(
		(
			await verifyBrowserReadonlySnapshot(
				{
					...source,
					creation: {
						...source.creation,
						expectedBaseRevisionId: "previous",
						leaseId: "browser-registered-v1:lease:2",
					},
				},
				checksum,
			)
		)?.candidate,
	).toBe(f.candidate);
});
it("resource metadata refuses malformed or foreign raw keys and unsafe lengths before accepting any bytes", () => {
	const hash = "a".repeat(64),
		bytes = new Uint8Array([1, 2, 3]).buffer,
		row = { resourceHash: hash, bytes },
		expected = { resourceHash: hash, byteLength: 3 };
	expect(readBrowserReadonlyResource("legacy", expected, row)).toBe(bytes);
	for (const resourceHash of [
		"a".repeat(63),
		"a".repeat(65),
		"g".repeat(64),
		"a".repeat(63) + "\n",
		" " + hash,
		hash + " ",
	])
		expect(
			readBrowserReadonlyResource(
				"legacy",
				{ ...expected, resourceHash },
				{ ...row, resourceHash },
			),
		).toBeUndefined();
	for (const byteLength of [
		0,
		-1,
		0.5,
		Number.NaN,
		Number.POSITIVE_INFINITY,
		50 * 1024 * 1024 + 1,
		2,
		4,
	])
		expect(
			readBrowserReadonlyResource("legacy", { ...expected, byteLength }, row),
		).toBeUndefined();
	for (const value of [
		null,
		[],
		{ ...row, resourceHash: hash.toUpperCase() },
		{ ...row, bytes: new Uint8Array([1, 2, 3]) },
		{ ...row, extra: true },
		{ ...row, pinStagingLeaseId: "active" },
	])
		expect(
			readBrowserReadonlyResource("legacy", expected, value),
		).toBeUndefined();
});
it("private native Blob metadata accepts exact durable or rooted ownership and refuses every foreign field", () => {
	const resourceHash = "B".repeat(64),
		expected = { resourceHash, byteLength: 3 },
		blob = new Blob([new Uint8Array([1, 2, 3])]),
		lease = "browser-registered-v1:lease:7",
		row = {
			scope: "browser-registered-v1",
			resourceHash,
			byteLength: 3,
			blob,
			version: lease,
			creationLeaseId: lease,
			roots: [],
			durable: true,
		};
	expect(readBrowserReadonlyResource("browser-registered", expected, row)).toBe(
		blob,
	);
	expect(
		readBrowserReadonlyResource("browser-registered", expected, {
			...row,
			roots: [lease],
			durable: false,
		}),
	).toBe(blob);
	const patches: Readonly<Record<string, unknown>>[] = [
		{ scope: "foreign" },
		{ resourceHash: resourceHash.toLowerCase() },
		{ byteLength: 2 },
		{ blob: new Blob([new Uint8Array([1, 2])]) },
		{ blob: new Uint8Array([1, 2, 3]).buffer },
		{ version: 7 },
		{ version: "foreign" },
		{ creationLeaseId: 7 },
		{ creationLeaseId: "foreign" },
		{ roots: null },
		{ roots: {} },
		{ roots: Array(1) },
		{ roots: ["foreign"] },
		{ roots: [7] },
		{ roots: [lease, lease] },
		{ durable: "true" },
		{ durable: false },
		{ extra: true },
	];
	for (const patch of patches)
		expect(
			readBrowserReadonlyResource("browser-registered", expected, {
				...row,
				...patch,
			}),
		).toBeUndefined();
	for (const key of Object.keys(row)) {
		const value: Record<string, unknown> = { ...row };
		delete value[key];
		expect(
			readBrowserReadonlyResource("browser-registered", expected, value),
		).toBeUndefined();
	}
});
