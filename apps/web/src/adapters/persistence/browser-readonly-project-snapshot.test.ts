import { expect, it } from "@rstest/core";
import { sameBrowserBackupValue } from "../../application/browser-backup-representability";
import { canonicalProjectSerializer } from "../../application/create-project";
import { createInitialProject } from "../../domain/initial-project";
import {
	readBrowserReadonlyResource,
	readUnverifiedBrowserSnapshot,
	verifyBrowserReadonlySnapshot,
} from "./browser-readonly-project-snapshot";

const checksum = {
	async sha256(value: string) {
		return Array.from(
			new Uint8Array(
				await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value)),
			),
			(v) => v.toString(16).padStart(2, "0"),
		).join("");
	},
};
async function fixture() {
	const project = createInitialProject({
		projectId: "same-raw-id\ud800",
		levelId: "level",
		name: "Readonly",
		createdAt: "2026-11-05T00:00:00.000Z",
	});
	const serializedProject = canonicalProjectSerializer.serialize(project);
	const candidate = {
		project,
		revision: {
			schemaVersion: 1 as const,
			projectId: project.projectId,
			revisionId: "revision",
			createdAt: project.createdAt,
			serializedProject,
			checksum: await checksum.sha256(serializedProject),
		},
	};
	const scope = "browser-registered-v1",
		attemptId = `${scope}:attempt:1`,
		resourceManifest: readonly { resourceHash: string; byteLength: number }[] =
			[];
	const creation = {
		protocolVersion: 1,
		scope,
		projectId: project.projectId,
		attemptId,
		ownerId: "owner",
		fencingToken: 1,
		expectedBaseRevisionId: null,
		revisionId: "revision",
		serializedProject,
		checksum: candidate.revision.checksum,
		resourceManifest,
		intent: "mutation",
		state: "published",
		receipt: {
			revisionId: "revision",
			checksum: candidate.revision.checksum,
			resourceManifest,
		},
	};
	return {
		candidate,
		legacy: {
			storageNamespace: "legacy" as const,
			projectId: project.projectId,
			pointer: {
				projectId: project.projectId,
				name: project.name,
				currentRevisionId: "revision",
			},
			revision: { revisionId: "revision", candidate },
		},
		registered: {
			storageNamespace: "browser-registered" as const,
			projectId: project.projectId,
			pointer: {
				scope,
				projectId: project.projectId,
				name: project.name,
				currentRevisionId: "revision",
			},
			revision: {
				scope,
				projectId: project.projectId,
				revisionId: "revision",
				candidate,
				creationAttemptId: attemptId,
				resourceManifest,
			},
			creation,
		},
	};
}
it("keeps legacy and private proofs separate while preserving the original native Project object", async () => {
	const f = await fixture();
	for (const value of [f.legacy, f.registered]) {
		const result = await verifyBrowserReadonlySnapshot(value, checksum);
		expect(result?.candidate).toBe(f.candidate);
		expect(result?.resourceManifest).toEqual([]);
		expect(result?.candidate.project.projectId).toBe("same-raw-id\ud800");
	}
	expect(
		await verifyBrowserReadonlySnapshot(
			{ ...f.legacy, storageNamespace: "browser-registered" },
			checksum,
		),
	).toBeUndefined();
	expect(
		await verifyBrowserReadonlySnapshot(
			{ ...f.registered, storageNamespace: "legacy" },
			checksum,
		),
	).toBeUndefined();
});
it("private current state requires its own exact published creation receipt and browser operation prefix", async () => {
	const f = await fixture();
	for (const creation of [
		undefined,
		{ ...f.registered.creation, state: "prepared" },
		{ ...f.registered.creation, attemptId: "tma-v1:forged:attempt:1" },
		{
			...f.registered.creation,
			receipt: { ...f.registered.creation.receipt, revisionId: "foreign" },
		},
	])
		expect(
			await verifyBrowserReadonlySnapshot(
				{ ...f.registered, creation },
				checksum,
			),
		).toBeUndefined();
});
it("raw recovery retains the exact corrupt JS string but cannot borrow another selected identity", async () => {
	const f = await fixture(),
		serializedProject = " \u0000bad-json\ud800\n";
	for (const value of [f.legacy, f.registered]) {
		const input = {
			...value,
			revision: {
				...value.revision,
				candidate: {
					...f.candidate,
					revision: { ...f.candidate.revision, serializedProject },
				},
			},
		};
		expect(readUnverifiedBrowserSnapshot(input, "revision")).toEqual({
			kind: "unverified-source",
			projectId: f.candidate.project.projectId,
			revisionId: "revision",
			serializedProject,
		});
		expect(readUnverifiedBrowserSnapshot(input, "foreign")).toBeUndefined();
		expect(
			await verifyBrowserReadonlySnapshot(input, checksum),
		).toBeUndefined();
		expect(
			readUnverifiedBrowserSnapshot(
				{ ...input, projectId: "foreign" },
				"revision",
			),
		).toBeUndefined();
	}
});
it("does not turn checksum-consistent invalid domain data into a healthy readonly backup", async () => {
	const f = await fixture(),
		project = { ...f.candidate.project, extra: true },
		serializedProject = JSON.stringify(project),
		candidate = {
			project,
			revision: {
				...f.candidate.revision,
				serializedProject,
				checksum: await checksum.sha256(serializedProject),
			},
		};
	expect(
		await verifyBrowserReadonlySnapshot(
			{ ...f.legacy, revision: { revisionId: "revision", candidate } },
			checksum,
		),
	).toBeUndefined();
});
it("requires exact native resource ownership for each original raw address", () => {
	const resourceHash = "A".repeat(64),
		expected = { resourceHash, byteLength: 3 },
		bytes = new Uint8Array([1, 2, 3]).buffer,
		blob = new Blob([bytes]),
		scope = "browser-registered-v1",
		lease = `${scope}:lease:2`,
		privateRow = {
			scope,
			...expected,
			blob,
			version: lease,
			creationLeaseId: lease,
			roots: [],
			durable: true,
		};
	expect(
		readBrowserReadonlyResource("legacy", expected, { resourceHash, bytes }),
	).toBe(bytes);
	expect(
		readBrowserReadonlyResource("legacy", expected, {
			resourceHash,
			bytes,
			pinStagingLeaseId: undefined,
		}),
	).toBe(bytes);
	expect(
		readBrowserReadonlyResource("browser-registered", expected, privateRow),
	).toBe(blob);
	expect(
		readBrowserReadonlyResource(
			"legacy",
			{ ...expected, resourceHash: resourceHash.toLowerCase() },
			{ resourceHash, bytes },
		),
	).toBeUndefined();
	expect(
		readBrowserReadonlyResource("browser-registered", expected, {
			...privateRow,
			scope: "tma-v1-forged",
		}),
	).toBeUndefined();
	expect(
		readBrowserReadonlyResource("legacy", expected, {
			resourceHash,
			bytes,
			pinStagingLeaseId: "foreign",
		}),
	).toBeUndefined();
	expect(
		readBrowserReadonlyResource("browser-registered", expected, {
			...privateRow,
			durable: false,
		}),
	).toBeUndefined();
	expect(
		readBrowserReadonlyResource("browser-registered", expected, {
			...privateRow,
			roots: Array(1),
			durable: false,
		}),
	).toBeUndefined();
});
it("exact final comparison sees signed zero, own undefined and sparse array length changes", () => {
	expect(sameBrowserBackupValue({ x: -0 }, { x: 0 })).toBe(false);
	expect(sameBrowserBackupValue({ x: undefined }, {})).toBe(false);
	expect(sameBrowserBackupValue([], Array(1))).toBe(false);
});
