import { describe, expect, it } from "@rstest/core";

import type { DurablePublicationCandidate } from "../application/ports";
import type { StoredCurrent } from "../adapters/persistence/durable-project-repository";
import {
	ReleaseStartupCoordinator,
	isReleaseManifest,
	type ReleaseManifest,
	type ReleaseRuntimeCapabilities,
} from "./release-startup";

const manifest: ReleaseManifest = {
	appBuildId: "alpha-build-1",
	assetSchemas: { readable: [1], writable: [1] },
	catalogSchemas: { readable: [1], writable: [1] },
	minimumCapabilities: ["indexeddb"],
	projectSchemas: { readable: [1], writable: [1] },
	version: 1,
	workerProtocolVersion: 1,
};

const capabilities: ReleaseRuntimeCapabilities = { indexeddb: true, webgl2: true };

function candidate(schemaVersion = 1): DurablePublicationCandidate {
	return {
		project: {
			assetDefinitionRefs: [],
			assetInstances: [],
			createdAt: "2026-08-28T00:00:00.000Z",
			level: {
			floorFinish: "none",
			levelId: "level-1",
			openings: [],
			rooms: [],
			wallSegments: [],
			wallFinish: "none",
			vertices: [],
			wallHeightMm: 2700,
			wallThicknessMm: 100,
			widthMm: 4000,
			depthMm: 3000,
			roomHeightMm: 2700,
			units: "mm",
			gridStepMm: 100,
			origin: { xMm: 0, zMm: 0 },
			boundaries: [],
			isConfigured: true,
			name: "Level 1",
		} as never,
			lifecycle: "active",
			name: "Recovery project",
			projectId: "project-1",
			schemaVersion,
			updatedAt: "2026-08-28T00:00:00.000Z",
		} as never,
		revision: {
			checksum: "checksum",
			createdAt: "2026-08-28T00:00:00.000Z",
			projectId: "project-1",
			revisionId: "revision-1",
			schemaVersion,
			serializedProject: JSON.stringify({ schemaVersion, preserved: true }),
		} as never,
	};
}

function store(current: StoredCurrent) {
	return { readCurrent: async () => current };
}

function manifestWith(
	patch: Partial<ReleaseManifest>,
): ReleaseManifest {
	return {
		...manifest,
		...patch,
		assetSchemas: patch.assetSchemas ?? manifest.assetSchemas,
		catalogSchemas: patch.catalogSchemas ?? manifest.catalogSchemas,
		projectSchemas: patch.projectSchemas ?? manifest.projectSchemas,
	};
}

describe("ReleaseStartupCoordinator", () => {
	it("rejects malformed manifest fields instead of granting an editable startup", () => {
		expect(isReleaseManifest(manifest)).toBe(true);
		expect(isReleaseManifest(null)).toBe(false);
		expect(isReleaseManifest("not a manifest")).toBe(false);
		for (const invalid of [
			manifestWith({ version: 2 } as never),
			manifestWith({ appBuildId: "" }),
			manifestWith({ appBuildId: 17 } as never),
			manifestWith({ workerProtocolVersion: 2 } as never),
			manifestWith({ minimumCapabilities: ["indexeddb", "unsupported"] as never }),
			manifestWith({ minimumCapabilities: ["indexeddb", "indexeddb"] }),
			manifestWith({ minimumCapabilities: ["unsupported"] as never }),
			manifestWith({ assetSchemas: { readable: [], writable: [] } }),
			manifestWith({ assetSchemas: { readable: [0], writable: [0] } }),
			manifestWith({ assetSchemas: { readable: [1.5], writable: [1.5] } }),
			manifestWith({ assetSchemas: { readable: [1], writable: [1, 2] } }),
			manifestWith({ catalogSchemas: { readable: [1, 1], writable: [1] } }),
			manifestWith({ catalogSchemas: { readable: [1], writable: [1, 2] } }),
			manifestWith({ projectSchemas: { readable: [1], writable: [1, 2] } }),
			{ ...manifest, assetSchemas: undefined },
		]) {
			expect(isReleaseManifest(invalid)).toBe(false);
		}
	});

	it("requires every declared minimum runtime capability before it permits a write path", async () => {
		const coordinator = new ReleaseStartupCoordinator(store({ kind: "empty" }));

		await expect(
			coordinator.handshake({
				capabilities: { indexeddb: false, webgl2: true },
				shellManifest: manifest,
				workerManifest: manifest,
			}),
		).resolves.toEqual({ kind: "read-only/exportable", recovery: {} });
		await expect(
			coordinator.handshake({
				capabilities,
				shellManifest: manifestWith({ minimumCapabilities: ["webgl2"] }),
				workerManifest: manifestWith({ minimumCapabilities: ["webgl2"] }),
			}),
		).resolves.toEqual({ kind: "writable" });
		await expect(
			coordinator.handshake({
				capabilities: { indexeddb: true, webgl2: false },
				shellManifest: manifestWith({ minimumCapabilities: ["indexeddb", "webgl2"] }),
				workerManifest: manifestWith({ minimumCapabilities: ["indexeddb", "webgl2"] }),
			}),
		).resolves.toEqual({ kind: "read-only/exportable", recovery: {} });
	});

	it("fails closed before reading Projects when crash-recovery cannot reconcile a pin-staging lease", async () => {
		let reads = 0;
		const coordinator = new ReleaseStartupCoordinator(
			{
				readCurrent: async () => {
					reads += 1;
					return { kind: "empty" as const };
				},
			},
			{
				reconcileBeforeWrite: async () => {
					throw new Error("Pin staging journal unavailable");
				},
			},
		);

		await expect(
			coordinator.handshake({ capabilities, shellManifest: manifest, workerManifest: manifest }),
		).resolves.toEqual({ kind: "read-only/exportable", recovery: {} });
		expect(reads).toBe(0);
	});

	it("does not trust an absent response from a worker that already controls the shell", async () => {
		const coordinator = new ReleaseStartupCoordinator(store({ kind: "candidate", candidate: candidate() }));

		await expect(
			coordinator.handshake({
				capabilities,
				hasControllingWorker: true,
				shellManifest: manifest,
				workerManifest: undefined,
			}),
		).resolves.toEqual({
			kind: "read-only/exportable",
			recovery: {
				projectId: "project-1",
				serializedProject: candidate().revision.serializedProject,
			},
		});
	});

	it("accepts an uncontrolled startup without inventing a missing worker incompatibility", async () => {
		const coordinator = new ReleaseStartupCoordinator(store({ kind: "empty" }));
		await expect(
			coordinator.handshake({
				capabilities,
				hasControllingWorker: false,
				shellManifest: manifest,
				workerManifest: undefined,
			}),
		).resolves.toEqual({ kind: "writable" });
	});

	it("defers a corrupt global pointer to the existing project recovery UI so healthy cards remain reachable", async () => {
		const coordinator = new ReleaseStartupCoordinator(store({ kind: "corrupt" }));

		await expect(
			coordinator.handshake({ capabilities, shellManifest: manifest, workerManifest: manifest }),
		).resolves.toEqual({ kind: "writable" });
	});

	it("treats a mismatched revision schema as recovery-only", async () => {
		const mismatched = {
			...candidate(),
			revision: { ...candidate().revision, schemaVersion: 2 },
		} as DurablePublicationCandidate;
		const coordinator = new ReleaseStartupCoordinator(
			store({ kind: "candidate", candidate: mismatched }),
		);
		await expect(
			coordinator.handshake({ capabilities, shellManifest: manifest, workerManifest: manifest }),
		).resolves.toMatchObject({ kind: "read-only/exportable" });
	});

	it("does not read missing candidate schema fields as a migration route", async () => {
		const incomplete = {
			project: {},
			revision: { serializedProject: "{}" },
		} as DurablePublicationCandidate;
		const coordinator = new ReleaseStartupCoordinator(
			store({ kind: "candidate", candidate: incomplete }),
			{
				migrations: [
					{
						fromProjectSchema: undefined as never,
						migrate: async () => candidate(),
						toProjectSchema: 1,
					},
				],
			},
		);
		await expect(
			coordinator.handshake({ capabilities, shellManifest: manifest, workerManifest: manifest }),
		).resolves.toEqual({ kind: "read-only/exportable", recovery: { serializedProject: "{}" } });
	});
	it("opens a compatible durable revision in writable mode only after the shell and worker manifests agree", async () => {
		const coordinator = new ReleaseStartupCoordinator(store({ kind: "candidate", candidate: candidate() }));
		const modes: string[] = [];

		await expect(
			coordinator.handshake({
				capabilities,
				onModeChange: (mode) => modes.push(mode),
				shellManifest: manifest,
				workerManifest: manifest,
			}),
		).resolves.toEqual({ kind: "writable" });
		expect(modes).toEqual(["writable"]);
	});

	it("keeps an unsupported schema exportable and preserves its exact readable bytes", async () => {
		const source = candidate(7);
		const coordinator = new ReleaseStartupCoordinator(
			store({ kind: "candidate", candidate: source }),
		);

		await expect(
			coordinator.handshake({ capabilities, shellManifest: manifest, workerManifest: manifest }),
		).resolves.toEqual({
			kind: "read-only/exportable",
			recovery: {
				projectId: "project-1",
				serializedProject: source.revision.serializedProject,
			},
		});
	});

	it("does not inspect local data as writable when the activated worker reports a different release manifest", async () => {
		const coordinator = new ReleaseStartupCoordinator(store({ kind: "candidate", candidate: candidate() }));
		const incompatibleWorker = { ...manifest, appBuildId: "alpha-build-2" };

		await expect(
			coordinator.handshake({
				capabilities,
				shellManifest: manifest,
				workerManifest: incompatibleWorker,
			}),
		).resolves.toEqual({
			kind: "read-only/exportable",
			recovery: {
				projectId: "project-1",
				serializedProject: candidate().revision.serializedProject,
			},
		});
	});

	it("publishes a registered migration only after it returns a complete replacement candidate", async () => {
		const source = candidate(0);
		const migrated = candidate(1);
		const published: Array<{
			readonly candidate: DurablePublicationCandidate;
			readonly expectedBaseRevisionId: string;
		}> = [];
		const coordinator = new ReleaseStartupCoordinator(store({ kind: "candidate", candidate: source }), {
			migrations: [
				{
					fromProjectSchema: 1,
					migrate: async () => source,
					toProjectSchema: 1,
				},
				{
					fromProjectSchema: 0,
					migrate: async () => migrated,
					toProjectSchema: 1,
				},
			],
			publishMigration: async (publication) => {
				published.push(publication);
				return { kind: "durable" };
			},
		});

		const modes: string[] = [];
		await expect(
			coordinator.handshake({
				capabilities,
				onModeChange: (mode) => modes.push(mode),
				shellManifest: manifest,
				workerManifest: manifest,
			}),
		).resolves.toEqual({ kind: "writable" });
		expect(published).toEqual([
			{ candidate: migrated, expectedBaseRevisionId: source.revision.revisionId },
		]);
		expect(modes).toEqual(["migration-in-progress", "writable"]);
	});

	it("reports migration-in-progress only for a manifest-authorized route and keeps its source read-only until a publisher exists", async () => {
		const modes: string[] = [];
		const coordinator = new ReleaseStartupCoordinator(store({ kind: "candidate", candidate: candidate(0) }), {
			migrations: [
				{
					fromProjectSchema: 0,
					migrate: async () => candidate(),
					toProjectSchema: 1,
				},
			],
		});

		await expect(
			coordinator.handshake({
				capabilities,
				onModeChange: (mode) => modes.push(mode),
				shellManifest: manifest,
				workerManifest: manifest,
			}),
		).resolves.toEqual({ kind: "migration-in-progress" });
		expect(modes).toEqual(["migration-in-progress"]);
	});

	it("refuses a malformed migration output and a failed publication without replacing the source", async () => {
		const source = candidate(0);
		const replacement = candidate(1);
		let attempts = 0;
		const malformed = new ReleaseStartupCoordinator(store({ kind: "candidate", candidate: source }), {
			migrations: [
				{
					fromProjectSchema: 0,
					migrate: async () => source,
					toProjectSchema: 1,
				},
			],
			publishMigration: async () => {
				attempts += 1;
				return { kind: "durable" };
			},
		});
		await expect(
			malformed.handshake({ capabilities, shellManifest: manifest, workerManifest: manifest }),
		).resolves.toMatchObject({ kind: "read-only/exportable" });
		expect(attempts).toBe(0);

		const failedPublication = new ReleaseStartupCoordinator(
			store({ kind: "candidate", candidate: source }),
			{
				migrations: [
					{
						fromProjectSchema: 0,
						migrate: async () => replacement,
						toProjectSchema: 1,
					},
				],
				publishMigration: async () => ({ kind: "persist-failed" }),
			},
		);
		await expect(
			failedPublication.handshake({ capabilities, shellManifest: manifest, workerManifest: manifest }),
		).resolves.toMatchObject({ kind: "read-only/exportable" });
	});

	it("never publishes over the original revision when a registered migration fails", async () => {
		const source = candidate(0);
		let publicationAttempts = 0;
		const coordinator = new ReleaseStartupCoordinator(store({ kind: "candidate", candidate: source }), {
			migrations: [
				{
					fromProjectSchema: 0,
					migrate: async () => {
						throw new Error("cannot migrate");
					},
					toProjectSchema: 1,
				},
			],
			publishMigration: async () => {
				publicationAttempts += 1;
				return { kind: "durable" };
			},
		});

		await expect(
			coordinator.handshake({ capabilities, shellManifest: manifest, workerManifest: manifest }),
		).resolves.toEqual({
			kind: "read-only/exportable",
			recovery: {
				projectId: "project-1",
				serializedProject: source.revision.serializedProject,
			},
		});
		expect(publicationAttempts).toBe(0);
	});
});
