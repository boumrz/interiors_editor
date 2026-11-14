import { describe, expect, it } from "@rstest/core";
import { createInitialProject } from "../../domain/initial-project";
import { configureRectangularRoom } from "../../domain/rectangular-room";
import type { Project } from "../../domain/project";
import { ImportPortableBackupUseCase } from "../../application/import-portable-backup";
import { canonicalProjectSerializer } from "../../application/create-project";
import type {
	DurablePublicationCandidate,
	CustomAssetResource,
	PortableBackupDecodeResult,
} from "../../application/ports";
import { createRegisteredRuntimePortablePorts } from "./registered-runtime-portable";
import { BrowserRegisteredImportAdmission } from "./browser-registered-import-admission";

const instant = "2026-11-04T12:00:00.000Z";
const sourceId = "11111111-1111-4111-8111-111111111111",
	occupiedId = "22222222-2222-4222-8222-222222222222",
	selectedId = "33333333-3333-4333-8333-333333333333",
	revisionId = "44444444-4444-4444-8444-444444444444";
const binaryChecksum = {
	sha256Bytes: async (bytes: Uint8Array) =>
		[
			...new Uint8Array(
				await crypto.subtle.digest("SHA-256", bytes.slice().buffer),
			),
		]
			.map((byte) => byte.toString(16).padStart(2, "0"))
			.join(""),
};
function source(): Project {
	let id = 0;
	const result = configureRectangularRoom(
		createInitialProject({
			projectId: sourceId,
			levelId: "level",
			name: "Source",
			createdAt: instant,
		}),
		{ widthMm: "4000", depthMm: "3000", heightMm: "2600" },
		{ next: () => `geometry-${++id}` },
		instant,
	);
	if (result.kind !== "accepted") throw new Error("Invalid fixture");
	return result.project;
}
async function fixture(
	project = source(),
	lookup: "available" | "unavailable" | "occupied" = "available",
) {
	const raw = createRegisteredRuntimePortablePorts({ binaryChecksum });
	const encoded = await raw.writer.encode({
		project,
		createdAt: instant,
		resources: [],
	});
	if (encoded.kind !== "encoded")
		throw new Error("Could not encode source fixture");
	const events: string[] = [];
	let index = 0,
		published: DurablePublicationCandidate | undefined;
	const ids = {
		next: () => {
			events.push("id");
			return (
				[sourceId, occupiedId, selectedId, revisionId][index++] ?? selectedId
			);
		},
	};
	const admission = new BrowserRegisteredImportAdmission({
		decoder: raw.decoder,
		binaryChecksum,
		ids,
		resources: {
			read: async () => {
				throw new Error("Empty fixture cannot read resources");
			},
		},
		live: () => true,
		initialize: async () => {
			events.push("bootstrap");
			return true;
		},
		lookupProjectId: async (id) => {
			events.push(`lookup:${id}`);
			return {
				kind:
					lookup === "unavailable"
						? "unavailable"
						: lookup === "occupied" || id === occupiedId
							? "occupied"
							: "free",
			};
		},
	});
	const importer = new ImportPortableBackupUseCase({
		decoder: admission,
		admission,
		smoke: {
			verify: async (project, resources) => {
				events.push("smoke");
				return raw.smoke.verify(project, resources);
			},
		},
		checksum: {
			sha256: async (text) =>
				binaryChecksum.sha256Bytes(new TextEncoder().encode(text)),
		},
		binaryChecksum,
		clock: { now: () => "2026-11-05T00:00:00.000Z" },
		ids,
		serializer: canonicalProjectSerializer,
		pinStaging: {
			requiresPublicationContext: true,
			begin: async () => {
				throw new Error("No resource pin for empty resource set");
			},
			markForPublication: async () => undefined,
			complete: async () => undefined,
			discard: async () => undefined,
		},
		repository: {
			loadCurrent: async () => ({ kind: "empty" }),
			recover: async () => ({ kind: "recovered" }),
			publish: async (candidate) => {
				if (
					candidate.project.schemaVersion !== 1 ||
					candidate.revision.schemaVersion !== 1
				)
					throw new Error("V1 expected");
				published = candidate;
				events.push("publish");
				return { kind: "durable" };
			},
		},
	});
	return {
		admission,
		importer,
		archive: encoded.bytes,
		events,
		get ids() {
			return index;
		},
		get published() {
			return published;
		},
	};
}

describe("sealed private browser registered admission", () => {
	it("decodes real wire, checks real smoke, bootstraps before IDs and skips exact source plus occupied IDs before sealing", async () => {
		const f = await fixture();
		expect(await f.importer.execute(f.archive, () => undefined)).toEqual({
			kind: "durable",
			projectId: selectedId,
			revisionId,
		});
		expect(f.events).toEqual([
			"smoke",
			"bootstrap",
			"id",
			"id",
			`lookup:${occupiedId}`,
			"id",
			`lookup:${selectedId}`,
			"id",
			"publish",
		]);
		const candidate = f.published;
		if (!candidate) throw new Error("Missing candidate");
		expect(Object.isFrozen(candidate)).toBe(true);
		expect(Object.isFrozen(candidate.project.level)).toBe(true);
		expect(candidate.project.projectId).toBe(selectedId);
		expect(candidate.revision.projectId).toBe(selectedId);
		expect(candidate.project.createdAt).toBe(instant);
		expect(f.admission.isRetryBlocked(candidate)).toBe(false);
	});
	for (const loss of [
		"negative-zero",
		"own-undefined",
		"lone-utf16",
	] as const) {
		it(`refuses ${loss} legacy representation before bootstrap or ID allocation`, async () => {
			const p = source();
			const project =
				loss === "negative-zero"
					? {
							...p,
							level: {
								...p.level,
								vertices: p.level.vertices.map((v, index) =>
									index === 0 ? { ...v, xMm: -0 } : v,
								),
							},
						}
					: loss === "own-undefined"
						? {
								...p,
								level: {
									...p.level,
									rooms: p.level.rooms.map((room) => ({
										...room,
										name: undefined,
									})),
								},
							}
						: {
								...p,
								level: {
									...p.level,
									rooms: p.level.rooms.map((room) => ({
										...room,
										name: "Room\ud800",
									})),
								},
							};
			const f = await fixture(project);
			expect(await f.importer.execute(f.archive, () => undefined)).toEqual({
				kind: "rejected",
				reasonCode: "PROJECT_BACKUP_ENVELOPE_EXCEEDED",
			});
			expect(f.events).toEqual(["smoke"]);
			expect(f.ids).toBe(0);
		});
	}
	it("fails unavailable direct pointer proof before staging, serialization or publication", async () => {
		const f = await fixture(source(), "unavailable");
		expect(await f.importer.execute(f.archive, () => undefined)).toEqual({
			kind: "verification-unavailable",
		});
		expect(f.events).toEqual([
			"smoke",
			"bootstrap",
			"id",
			"id",
			`lookup:${occupiedId}`,
		]);
		expect(f.published).toBeUndefined();
	});
	it("bounds collision retries to eight proposed Project IDs using the same actual ID port", async () => {
		const f = await fixture(source(), "occupied");
		expect(await f.importer.execute(f.archive, () => undefined)).toEqual({
			kind: "verification-unavailable",
		});
		expect(f.ids).toBe(8);
		expect(
			f.events.filter((event) => event.startsWith("lookup:")),
		).toHaveLength(7);
		expect(f.published).toBeUndefined();
	});
});

function authoredGlb(): Uint8Array {
	const text = new TextEncoder().encode(
		JSON.stringify({
			asset: { version: "2.0" },
			buffers: [{ byteLength: 0 }],
			scenes: [{ nodes: [] }],
		}),
	);
	const size = Math.ceil(text.length / 4) * 4;
	const bytes = new Uint8Array(20 + size);
	const view = new DataView(bytes.buffer);
	view.setUint32(0, 0x46546c67, true);
	view.setUint32(4, 2, true);
	view.setUint32(8, bytes.length, true);
	view.setUint32(12, size, true);
	view.setUint32(16, 0x4e4f534a, true);
	bytes.fill(0x20, 20);
	bytes.set(text, 20);
	return bytes;
}
function held<T>() {
	let resolve!: (value: T) => void;
	const promise = new Promise<T>((done) => {
		resolve = done;
	});
	return { promise, resolve };
}
async function resourceProfile() {
	const bytes = authoredGlb(),
		hash = await binaryChecksum.sha256Bytes(bytes);
	const resources: readonly CustomAssetResource[] = [
		{ resourceHash: hash, bytes },
	];
	const project: Project = {
		...source(),
		assetDefinitionRefs: [
			{
				assetDefinitionId: "authored",
				displayName: "Local authored GLB",
				format: "glb",
				resourceHash: hash,
				byteLength: bytes.length,
				widthMm: 500,
				depthMm: 500,
				heightMm: 800,
			},
		],
	};
	const raw = createRegisteredRuntimePortablePorts({ binaryChecksum });
	const encoded = await raw.writer.encode({
		project,
		createdAt: instant,
		resources,
	});
	if (encoded.kind !== "encoded")
		throw new Error("Real source writer rejected fixture");
	const reads: string[] = [];
	const state = {
		live: true,
		read: async (_key: string): Promise<Uint8Array | undefined> =>
			bytes.slice(),
		hash: undefined as undefined | ((bytes: Uint8Array) => Promise<string>),
	};
	const admission = new BrowserRegisteredImportAdmission({
		decoder: raw.decoder,
		binaryChecksum: {
			sha256Bytes: (value) =>
				state.hash ? state.hash(value) : binaryChecksum.sha256Bytes(value),
		},
		ids: { next: () => selectedId },
		resources: {
			read: (key) => {
				reads.push(key);
				return state.read(key);
			},
		},
		live: () => state.live,
		initialize: async () => true,
		lookupProjectId: async () => ({ kind: "free" }),
	});
	const decoded = await admission.decode(encoded.bytes);
	if (decoded.kind !== "accepted")
		throw new Error("Real registered decoder rejected fixture");
	expect(await raw.smoke.verify(project, decoded.resources ?? [])).toBe(true);
	const prepared = await admission.prepare(
		decoded,
		project,
		decoded.resources ?? [],
	);
	if (prepared.kind !== "accepted") throw new Error("Prepare failed");
	const profile = prepared.profile;
	const select = profile.selectProjectId;
	if (!select) throw new Error("Actual private profile must select identity");
	expect(await select(selectedId)).toEqual({
		kind: "selected",
		projectId: selectedId,
	});
	const nextProject = {
		...profile.source,
		projectId: selectedId,
		updatedAt: "2026-11-05T00:00:00.000Z",
	};
	const serializedProject = canonicalProjectSerializer.serialize(nextProject);
	const input = {
		project: nextProject,
		revision: {
			projectId: selectedId,
			revisionId,
			createdAt: nextProject.updatedAt,
			schemaVersion: 1 as const,
			serializedProject,
			checksum: await binaryChecksum.sha256Bytes(
				new TextEncoder().encode(serializedProject),
			),
		},
	};
	const sealed = await profile.seal(input);
	if (sealed.kind !== "accepted") throw new Error("Seal failed");
	return {
		admission,
		profile,
		candidate: sealed.candidate,
		input,
		state,
		reads,
		bytes,
		hash,
		project,
		decoded,
		resources: decoded.resources ?? [],
		archive: encoded.bytes,
	};
}

describe("sealed registered resource publication proof", () => {
	it("reads the exact pinned raw key and accepts actual wire/smoke/sealed bytes before publication", async () => {
		const f = await resourceProfile();
		expect(await f.profile.beforePublish(f.candidate)).toEqual({
			kind: "accepted",
		});
		expect(f.reads).toEqual([f.hash]);
		expect(await f.profile.beforePublish({ ...f.candidate })).toEqual({
			kind: "verification-unavailable",
		});
	});
	it("refuses absent pinned bytes and equal-length changed bytes even with an intentionally colliding resource digest", async () => {
		const f = await resourceProfile();
		f.state.read = async () => undefined;
		expect(await f.profile.beforePublish(f.candidate)).toEqual({
			kind: "verification-unavailable",
		});
		const changed = f.bytes.slice();
		changed[changed.length - 1] ^= 1;
		f.state.read = async () => changed;
		f.state.hash = async (value) =>
			value.length === f.bytes.length
				? f.hash
				: binaryChecksum.sha256Bytes(value);
		expect(await f.profile.beforePublish(f.candidate)).toEqual({
			kind: "verification-unavailable",
		});
		expect(f.reads).toEqual([f.hash, f.hash]);
	});
	it("retains one-shot decoded and selected/sealed identity capabilities", async () => {
		const f = await resourceProfile();
		expect(
			await f.admission.prepare(f.decoded, f.project, f.resources),
		).toEqual({ kind: "verification-unavailable" });
		const select = f.profile.selectProjectId;
		if (!select) throw new Error("Expected selection hook");
		expect(await select(selectedId)).toEqual({
			kind: "verification-unavailable",
		});
		expect(await f.profile.seal(f.input)).toEqual({
			kind: "verification-unavailable",
		});
		expect(
			await f.profile.seal({
				...f.input,
				project: { ...f.input.project, projectId: occupiedId },
			}),
		).toEqual({ kind: "verification-unavailable" });
	});
	it("does not admit publication after live revocation or cancellation while an exact pinned read is awaited", async () => {
		for (const stop of ["cancel", "revoke"] as const) {
			const f = await resourceProfile(),
				pending = held<Uint8Array | undefined>(),
				entered = held<void>(),
				signal = new AbortController();
			f.state.read = async () => {
				entered.resolve();
				return pending.promise;
			};
			const result = f.profile.beforePublish(f.candidate, signal.signal);
			await entered.promise;
			if (stop === "cancel") signal.abort();
			else f.state.live = false;
			pending.resolve(f.bytes.slice());
			expect(await result).toEqual(
				stop === "cancel"
					? { kind: "rejected", reasonCode: "BACKUP_CANCELLED" }
					: { kind: "verification-unavailable" },
			);
		}
	});
	it("does not admit publication when cancellation or revocation occurs during the final verifier", async () => {
		for (const stop of ["cancel", "revoke"] as const) {
			const f = await resourceProfile(),
				pending = held<void>(),
				entered = held<void>(),
				signal = new AbortController();
			let first = true;
			f.state.hash = async (value) => {
				if (first) {
					first = false;
					entered.resolve();
					await pending.promise;
				}
				return binaryChecksum.sha256Bytes(value);
			};
			const result = f.profile.beforePublish(f.candidate, signal.signal);
			await entered.promise;
			if (stop === "cancel") signal.abort();
			else f.state.live = false;
			pending.resolve();
			expect(await result).toEqual(
				stop === "cancel"
					? { kind: "rejected", reasonCode: "BACKUP_CANCELLED" }
					: { kind: "verification-unavailable" },
			);
		}
	});
});

async function controllableAdmission() {
	const project = source(),
		raw = createRegisteredRuntimePortablePorts({ binaryChecksum });
	const encoded = await raw.writer.encode({
		project,
		createdAt: instant,
		resources: [],
	});
	if (encoded.kind !== "encoded") throw new Error("Expected real wire fixture");
	const actual = await raw.decoder.decode(encoded.bytes);
	if (actual.kind !== "accepted")
		throw new Error("Expected real accepted member");
	const calls: string[] = [];
	const state = {
		live: true,
		decode: async (): Promise<PortableBackupDecodeResult> => actual,
		initialize: async () => true,
		lookup: async () => ({
			kind: "free" as "free" | "occupied" | "unavailable",
		}),
	};
	const admission = new BrowserRegisteredImportAdmission({
		decoder: {
			decode: async () => {
				calls.push("decode");
				return state.decode();
			},
		},
		binaryChecksum,
		ids: {
			next: () => {
				calls.push("id");
				return selectedId;
			},
		},
		resources: {
			read: async () => {
				throw new Error("No resource expected");
			},
		},
		live: () => state.live,
		initialize: async () => {
			calls.push("initialize");
			return state.initialize();
		},
		lookupProjectId: async () => {
			calls.push("lookup");
			return state.lookup();
		},
	});
	return {
		project,
		raw,
		archive: encoded.bytes,
		actual,
		state,
		admission,
		calls,
	};
}
describe("registered admission capability and lifetime boundaries", () => {
	it("does not invoke a decoder before live admission or after pre-cancellation", async () => {
		const f = await controllableAdmission();
		f.state.live = false;
		expect(await f.admission.decode(f.archive)).toEqual({
			kind: "verification-unavailable",
		});
		const signal = new AbortController();
		signal.abort();
		expect(await f.admission.decode(f.archive, signal.signal)).toEqual({
			kind: "rejected",
			reasonCode: "BACKUP_CANCELLED",
		});
		expect(f.calls).toEqual([]);
	});
	it("refuses a late accepted decode after cancellation or revocation and preserves earlier canonical failures by identity", async () => {
		for (const stop of ["cancel", "revoke"] as const) {
			const f = await controllableAdmission(),
				pending = held<PortableBackupDecodeResult>(),
				signal = new AbortController();
			f.state.decode = async () => pending.promise;
			const decoding = f.admission.decode(f.archive, signal.signal);
			if (stop === "cancel") signal.abort();
			else f.state.live = false;
			pending.resolve(f.actual);
			expect(await decoding).toEqual(
				stop === "cancel"
					? { kind: "rejected", reasonCode: "BACKUP_CANCELLED" }
					: { kind: "verification-unavailable" },
			);
			const failure = {
				kind: "rejected" as const,
				reasonCode: "BACKUP_CHECKSUM_MISMATCH" as const,
			};
			const next = await controllableAdmission(),
				delayed = held<PortableBackupDecodeResult>();
			next.state.decode = async () => delayed.promise;
			const result = next.admission.decode(
				next.archive,
				signal.signal.aborted ? undefined : signal.signal,
			);
			next.state.live = false;
			delayed.resolve(failure);
			expect(await result).toBe(failure);
		}
	});
	it("reports decoder exceptions as unavailable or cancelled rather than corrupt input", async () => {
		for (const cancel of [false, true]) {
			const f = await controllableAdmission(),
				signal = new AbortController();
			f.state.decode = async () => {
				if (cancel) signal.abort();
				throw new Error("Local decoder unavailable");
			};
			expect(await f.admission.decode(f.archive, signal.signal)).toEqual(
				cancel
					? { kind: "rejected", reasonCode: "BACKUP_CANCELLED" }
					: { kind: "verification-unavailable" },
			);
		}
	});
	it("rejects foreign decoded objects, changed source data, and absent member ownership before provisioning", async () => {
		const f = await controllableAdmission();
		const decoded = await f.admission.decode(f.archive);
		if (decoded.kind !== "accepted")
			throw new Error("Expected accepted fixture");
		expect(await f.admission.prepare({ ...decoded }, f.project, [])).toEqual({
			kind: "verification-unavailable",
		});
		expect(
			await f.admission.prepare(
				decoded,
				{ ...f.project, name: "Changed after validation" },
				[],
			),
		).toEqual({ kind: "verification-unavailable" });
		const g = await controllableAdmission();
		const { projectMember: _member, ...withoutMember } = g.actual;
		g.state.decode = async () => withoutMember;
		const missing = await g.admission.decode(g.archive);
		if (missing.kind !== "accepted")
			throw new Error("Expected compatibility accepted fixture");
		expect(await g.admission.prepare(missing, g.project, [])).toEqual({
			kind: "verification-unavailable",
		});
		expect(f.calls).toEqual(["decode"]);
		expect(g.calls).toEqual(["decode"]);
	});
	it("does not allocate destination IDs when initialization fails, cancels, or loses its live generation", async () => {
		for (const stop of ["false", "cancel", "revoke"] as const) {
			const f = await controllableAdmission(),
				signal = new AbortController();
			f.state.initialize = async () => {
				if (stop === "cancel") signal.abort();
				if (stop === "revoke") f.state.live = false;
				return stop !== "false";
			};
			const decoded = await f.admission.decode(f.archive);
			if (decoded.kind !== "accepted")
				throw new Error("Expected accepted fixture");
			expect(
				await f.admission.prepare(decoded, f.project, [], signal.signal),
			).toEqual(
				stop === "cancel"
					? { kind: "rejected", reasonCode: "BACKUP_CANCELLED" }
					: { kind: "verification-unavailable" },
			);
			expect(f.calls).toEqual(["decode", "initialize"]);
		}
	});
	it("refuses malformed destination IDs before lookup and stops a held lookup after cancellation or revocation", async () => {
		for (const invalid of [
			`${selectedId}\n`,
			"",
			"x".repeat(36),
			"11111111-1111-3111-8111-111111111111",
		]) {
			const f = await controllableAdmission();
			const decoded = await f.admission.decode(f.archive);
			if (decoded.kind !== "accepted") throw new Error("Expected member");
			const prepared = await f.admission.prepare(decoded, f.project, []);
			if (prepared.kind !== "accepted" || !prepared.profile.selectProjectId)
				throw new Error("Expected profile");
			expect(await prepared.profile.selectProjectId(invalid)).toEqual({
				kind: "verification-unavailable",
			});
			expect(f.calls).toEqual(["decode", "initialize"]);
		}
		for (const stop of ["cancel", "revoke"] as const) {
			const f = await controllableAdmission(),
				signal = new AbortController(),
				pending = held<{ kind: "free" | "occupied" | "unavailable" }>();
			f.state.lookup = async () => pending.promise;
			const decoded = await f.admission.decode(f.archive);
			if (decoded.kind !== "accepted") throw new Error("Expected member");
			const prepared = await f.admission.prepare(decoded, f.project, []);
			if (prepared.kind !== "accepted" || !prepared.profile.selectProjectId)
				throw new Error("Expected profile");
			const result = prepared.profile.selectProjectId(
				selectedId,
				signal.signal,
			);
			if (stop === "cancel") signal.abort();
			else f.state.live = false;
			pending.resolve({ kind: "free" });
			expect(await result).toEqual(
				stop === "cancel"
					? { kind: "rejected", reasonCode: "BACKUP_CANCELLED" }
					: { kind: "verification-unavailable" },
			);
			expect(f.calls).toEqual(["decode", "initialize", "lookup"]);
		}
	});
});

it("seals only the exact destination identity selected and proven free before its first seal", async () => {
	const f = await controllableAdmission();
	const decoded = await f.admission.decode(f.archive);
	if (decoded.kind !== "accepted") throw new Error("Expected accepted source");
	const prepared = await f.admission.prepare(decoded, f.project, []);
	if (prepared.kind !== "accepted" || !prepared.profile.selectProjectId)
		throw new Error("Expected profile");
	const select = prepared.profile.selectProjectId;
	const profile = prepared.profile;
	expect(await select(selectedId)).toEqual({
		kind: "selected",
		projectId: selectedId,
	});
	async function input(projectId: string) {
		const project = {
			...profile.source,
			projectId,
			updatedAt: "2026-11-05T00:00:00.000Z",
		};
		const serializedProject = canonicalProjectSerializer.serialize(project);
		return {
			project,
			revision: {
				projectId,
				revisionId,
				createdAt: project.updatedAt,
				schemaVersion: 1 as const,
				serializedProject,
				checksum: await binaryChecksum.sha256Bytes(
					new TextEncoder().encode(serializedProject),
				),
			},
		};
	}
	expect(await profile.seal(await input(occupiedId))).toEqual({
		kind: "verification-unavailable",
	});
	const sealed = await profile.seal(await input(selectedId));
	expect(sealed.kind).toBe("accepted");
	if (sealed.kind !== "accepted") throw new Error("Expected selected identity");
	expect(sealed.candidate.project.projectId).toBe(selectedId);
	const cancelled = new AbortController();
	cancelled.abort();
	expect(await profile.seal(await input(selectedId), cancelled.signal)).toEqual(
		{ kind: "rejected", reasonCode: "BACKUP_CANCELLED" },
	);
});
