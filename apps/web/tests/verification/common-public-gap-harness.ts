import "../browser/browser-registered-project-harness";
import { TelegramProjectRepository } from "../../src/adapters/persistence/telegram-project-repository";
import {
	type TelegramScopeAccess,
	TelegramScopeStore,
} from "../../src/adapters/persistence/telegram-scope-store";
import { createTelegramContextState } from "../../src/adapters/telegram/context-state";
import type { VerifiedTelegramScope } from "../../src/adapters/telegram/signed-launch";
import {
	browserBinaryChecksum,
	browserChecksum,
} from "../../src/app/browser-ports";
import { TelegramRuntimeSession } from "../../src/app/telegram-runtime-session";
import { canonicalProjectSerializer } from "../../src/application/create-project";
import type { PublicationCandidate } from "../../src/application/ports";
import { createInitialProject } from "../../src/domain/initial-project";
import type { CustomGlbAssetDefinition } from "../../src/domain/project";

// Actual native IDB, Web Locks, transactions, checksum and repository. The cast
// supplies only a test scope, never a signed-launch or valid-GLB/rendering proof.
const scope = `tma-v1-${"8".repeat(64)}` as VerifiedTelegramScope;
const foreignScope = `tma-v1-${"7".repeat(64)}`;
const projectId = "public-gap-boundaries";
const bytes = Uint8Array.of(91, 92, 93);
const names = [
	"scope-metadata",
	"projects",
	"revisions",
	"staging",
	"writer-fences",
	"publication-attempts",
	"pin-staging-leases",
	"resources",
	"library",
] as const;
const databaseName = `interiors-editor-projects:${scope}`;
function open(): Promise<IDBDatabase> {
	return new Promise((resolve, reject) => {
		const request = indexedDB.open(databaseName);
		request.onsuccess = () => resolve(request.result);
		request.onerror = () => reject(request.error);
	});
}
async function records(name: (typeof names)[number]): Promise<unknown[]> {
	const database = await open();
	try {
		return await new Promise((resolve, reject) => {
			const transaction = database.transaction(name, "readonly"),
				request = transaction.objectStore(name).getAll();
			transaction.oncomplete = () => resolve(request.result);
			transaction.onabort = () => reject(transaction.error);
		});
	} finally {
		database.close();
	}
}
async function normalized(value: unknown): Promise<unknown> {
	if (value instanceof Blob)
		return {
			nativeType: "Blob",
			type: value.type,
			size: value.size,
			bytes: Array.from(new Uint8Array(await value.arrayBuffer())),
		};
	if (value === undefined) return { nativeType: "undefined" };
	if (Array.isArray(value))
		return {
			nativeType: "Array",
			length: value.length,
			entries: await Promise.all(
				Object.keys(value).map(async (key) => [
					key,
					await normalized(Reflect.get(value, key)),
				]),
			),
		};
	if (value && typeof value === "object")
		return Object.fromEntries(
			await Promise.all(
				Object.keys(value)
					.sort()
					.map(async (key) => [key, await normalized(Reflect.get(value, key))]),
			),
		);
	return value;
}
async function snapshot() {
	const database = await open();
	let values: { name: string; rows: unknown[] }[];
	try {
		values = await new Promise((resolve, reject) => {
			const transaction = database.transaction([...names], "readonly"),
				result: { name: string; rows: unknown[] }[] = [];
			for (const name of names) {
				const request = transaction.objectStore(name).getAll();
				request.onsuccess = () => result.push({ name, rows: request.result });
			}
			transaction.oncomplete = () => resolve(result);
			transaction.onabort = () => reject(transaction.error);
		});
	} finally {
		database.close();
	}
	return Promise.all(
		values
			.sort((a, b) => a.name.localeCompare(b.name))
			.map(async (value) => ({
				name: value.name,
				rows: await normalized(value.rows),
			})),
	);
}
async function protectedHistoryRows(attemptId: string) {
	return Promise.all(
		names.map(async (name) => {
			const rows = (await records(name)).map(record);
			const protectedRows =
				name === "staging"
					? rows.filter((row) => row.attemptId !== attemptId)
					: name === "publication-attempts"
						? rows.map((row) =>
								row.attemptId === attemptId
									? { ...row, state: "owned-history-state" }
									: row,
							)
						: rows;
			return { name, rows: await normalized(protectedRows) };
		}),
	);
}
async function technicalState() {
	const rows = (await records("scope-metadata")).map((value) => record(value)),
		counter = rows.find((row) => row.key === "counter");
	if (!counter || typeof counter.lastReserved !== "string")
		throw new Error("Missing genuine metadata counter");
	return {
		counter: counter.lastReserved,
		counterKeys: Object.keys(counter).sort(),
		identityRows: rows.filter((row) => row.key !== "counter"),
		count: rows.length,
	};
}
function record(value: unknown): Record<string, unknown> {
	if (!value || typeof value !== "object" || Array.isArray(value))
		throw new Error("Missing native fixture row");
	return value as Record<string, unknown>;
}
async function put(name: (typeof names)[number], value: unknown) {
	const database = await open();
	try {
		await new Promise<void>((resolve, reject) => {
			const transaction = database.transaction(name, "readwrite", {
				durability: "strict",
			});
			transaction.objectStore(name).put(value);
			transaction.oncomplete = () => resolve();
			transaction.onabort = () => reject(transaction.error);
		});
	} finally {
		database.close();
	}
}
async function candidate(
	revisionId: string,
	withResource = false,
	selectedProjectId = projectId,
): Promise<PublicationCandidate> {
	const asset: CustomGlbAssetDefinition = {
		assetDefinitionId: "opaque-resource",
		displayName: "Opaque protocol bytes",
		format: "glb",
		resourceHash: await browserBinaryChecksum.sha256Bytes(bytes),
		byteLength: bytes.byteLength,
		widthMm: 100,
		depthMm: 100,
		heightMm: 100,
	};
	const project = {
		...createInitialProject({
			projectId: selectedProjectId,
			levelId: "public-level",
			name: `Public ${revisionId}`,
			createdAt: "2026-11-05T12:00:00.000Z",
		}),
		assetDefinitionRefs: withResource ? [asset] : [],
	};
	const serializedProject = canonicalProjectSerializer.serialize(project);
	return {
		project,
		revision: {
			projectId: selectedProjectId,
			revisionId,
			schemaVersion: 1,
			createdAt: project.createdAt,
			serializedProject,
			checksum: await browserChecksum.sha256(serializedProject),
		},
	};
}
async function outcome(operation: () => Promise<unknown>) {
	try {
		return { kind: "resolved" as const, value: await operation() };
	} catch {
		return { kind: "rejected" as const };
	}
}

// Test-only fault/corruption inputs over actual IndexedDB and repository methods.
// Opaque bytes validate the persistence protocol only, never GLB/rendering/auth.
class AcquisitionFaultStore extends TelegramScopeStore {
	loseNextPublicationAcknowledgement = false;
	acknowledgementLosses = 0;
	acknowledgedCommitSnapshot: Awaited<ReturnType<typeof snapshot>> | undefined;
	hook: (() => Promise<void>) | undefined;
	binaryHook: (() => Promise<void>) | undefined;
	binaryFaults = 0;
	binaryFaultedSnapshot: Awaited<ReturnType<typeof snapshot>> | undefined;
	faults = 0;
	faultedSnapshot: Awaited<ReturnType<typeof snapshot>> | undefined;
	faultedTechnical: Awaited<ReturnType<typeof technicalState>> | undefined;
	override run<T>(
		operation: (access: TelegramScopeAccess) => Promise<T>,
	): Promise<T> {
		return super.run((access) =>
			operation({
				scope: access.scope,
				databaseVersion: access.databaseVersion,
				signal: access.signal,
				reserveId: (kind) => access.reserveId(kind),
				transact: async (names, mode, work) => {
					const result = await access.transact(names, mode, work);
					if (
						this.loseNextPublicationAcknowledgement &&
						mode === "readwrite" &&
						names.includes("resources") &&
						names.includes("staging") &&
						names.includes("publication-attempts")
					) {
						this.loseNextPublicationAcknowledgement = false;
						this.acknowledgementLosses++;
						this.acknowledgedCommitSnapshot = await snapshot();
						throw new Error(
							"Controlled loss after actual committed publication",
						);
					}

					if (
						this.hook &&
						mode === "readwrite" &&
						names.length === 6 &&
						names.includes("writer-fences") &&
						names.includes("projects") &&
						names.includes("pin-staging-leases") &&
						result &&
						typeof result === "object" &&
						Reflect.get(result, "projectId") === projectId &&
						typeof Reflect.get(result, "fencingToken") === "number"
					) {
						const hook = this.hook;
						this.hook = undefined;
						await hook();
						this.faults++;
						this.faultedSnapshot = await snapshot();
						this.faultedTechnical = await technicalState();
					}
					return result;
				},
			}),
		);
	}
}
function runtime(ownerId = "public-gap-owner") {
	const session = new TelegramRuntimeSession(scope),
		store = new AcquisitionFaultStore(session, {
			indexedDb: indexedDB,
			locks: navigator.locks,
			secureContext: isSecureContext,
		});
	const repo = new TelegramProjectRepository(store, {
		ownerId,
		nowEpochMs: () => 1000,
		checksum: browserChecksum,
		binaryChecksum: {
			async sha256Bytes(input: Uint8Array) {
				const digest = await browserBinaryChecksum.sha256Bytes(input),
					hook = store.binaryHook;
				if (hook) {
					store.binaryHook = undefined;
					await hook();
					store.binaryFaults++;
					store.binaryFaultedSnapshot = await snapshot();
				}
				return digest;
			},
		},
		takeoverRequirements: createTelegramContextState(scope, {
			sessionStorage,
			localStorage,
		}).writerTakeover,
	});
	return { store, repo };
}
async function fixture() {
	const value = runtime(),
		first = await candidate("r1");
	if ((await value.repo.publish(first)).kind !== "durable")
		throw new Error("Fixture R1 did not publish");
	const next = await candidate("r2", true),
		asset = next.project.assetDefinitionRefs[0];
	if (asset.format !== "glb") throw new Error("Missing exact custom metadata");
	const lease = await value.repo.pinStaging.begin([asset.resourceHash], {
		candidate: next,
		expectedBaseRevisionId: "r1",
	});
	const write = value.repo.resources.writeIfAbsentPinned;
	if (
		!write ||
		(await write({ resourceHash: asset.resourceHash, bytes }, lease.leaseId))
			.kind !== "stored"
	)
		throw new Error("Fixture pin write failed");
	return { ...value, first, next, asset, lease };
}
async function oneBy(
	name: (typeof names)[number],
	key: string,
	expected: unknown,
) {
	const found = (await records(name))
		.map(record)
		.filter((row) => row[key] === expected);
	if (found.length !== 1)
		throw new Error("Missing unique genuine native fixture row");
	return found[0];
}
const api = {
	async noncurrentJournal(mode: "receipt" | "scope" | "protocol") {
		const value = runtime();
		try {
			const first = await candidate("r1"),
				next = await candidate("r2");
			if (
				(await value.repo.publish(first)).kind !== "durable" ||
				(await value.repo.publish(next, "r1")).kind !== "durable"
			)
				throw new Error("Fixture roots did not publish");
			const revision = await oneBy("revisions", "revisionId", "r1"),
				original = await oneBy(
					"publication-attempts",
					"attemptId",
					revision.creationAttemptId,
				);
			const changed =
				mode === "receipt"
					? {
							...original,
							receipt: {
								...record(original.receipt),
								checksum: "0".repeat(64),
							},
						}
					: mode === "scope"
						? { ...original, scope: foreignScope }
						: { ...original, protocolVersion: 2 };
			await put("publication-attempts", changed);
			const before = await snapshot(),
				refused = await value.repo.inspectWriterAccess(projectId),
				after = await snapshot(),
				current = await value.repo.loadProject(projectId);
			await put("publication-attempts", original);
			const healthy = await value.repo.inspectWriterAccess(projectId);
			return { before, after, refused, current, healthy };
		} finally {
			await value.store.close();
		}
	},
	async noncurrentAcknowledgement() {
		const value = runtime();
		try {
			const first = await candidate("r1"),
				second = await candidate("r2"),
				third = await candidate("r3");
			if ((await value.repo.publish(first)).kind !== "durable")
				throw new Error("Fixture R1 did not publish");
			value.store.loseNextPublicationAcknowledgement = true;
			const lost = await value.repo.publish(second, "r1"),
				actuallyCommitted = await value.repo.loadProject(projectId);
			if (
				actuallyCommitted.kind !== "durable" ||
				actuallyCommitted.candidate.revision.revisionId !== "r2"
			)
				throw new Error("Lost ACK fixture did not actually commit R2");
			const advanced = await value.repo.publish(third, "r2");
			if (advanced.kind !== "durable")
				throw new Error("Fixture R3 did not publish");
			const revision = await oneBy("revisions", "revisionId", "r2"),
				original = await oneBy(
					"publication-attempts",
					"attemptId",
					revision.creationAttemptId,
				);
			value.store.hook = async () => {
				await put("publication-attempts", {
					...original,
					receipt: { ...record(original.receipt), checksum: "0".repeat(64) },
				});
			};
			const refused = await value.repo.publish(second, "r1"),
				after = await snapshot(),
				current = await value.repo.loadProject(projectId);
			await put("publication-attempts", original);
			const beforeRetry = await snapshot(),
				retried = await value.repo.publish(second, "r1"),
				afterRetry = await snapshot();
			return {
				lost,
				actuallyCommitted,
				advanced,
				refused,
				after,
				current,
				retried,
				beforeRetry,
				afterRetry,
				faults: value.store.faults,
				faultedSnapshot: value.store.faultedSnapshot,
				acknowledgementLosses: value.store.acknowledgementLosses,
				acknowledgedCommitSnapshot: value.store.acknowledgedCommitSnapshot,
			};
		} finally {
			await value.store.close();
		}
	},
	async failedHistory(mode: "ordinary" | "ambiguous-creator") {
		const value = runtime(),
			other = runtime("public-gap-owner-B"),
			nativePut = IDBObjectStore.prototype.put;
		let armed = false,
			aborts = 0;
		try {
			const first = await candidate("r1"),
				second = await candidate("r2");
			if (
				(await value.repo.publish(first)).kind !== "durable" ||
				(await value.repo.publish(second, "r1")).kind !== "durable"
			)
				throw new Error("Fixture history roots did not publish");
			const original = await oneBy("revisions", "revisionId", "r1");
			armed = true;
			IDBObjectStore.prototype.put = function (
				...args: Parameters<IDBObjectStore["put"]>
			) {
				const request = nativePut.apply(this, args);
				if (
					armed &&
					this.name === "projects" &&
					this.transaction.db.name === databaseName &&
					args[0] &&
					Reflect.get(args[0], "currentRevisionId") === "r1"
				) {
					armed = false;
					this.transaction.addEventListener("abort", () => aborts++, {
						once: true,
					});
					this.transaction.abort();
				}
				return request;
			};
			const failed = await value.repo.publishNextRevision(
				first,
				"r2",
				"history",
			);
			IDBObjectStore.prototype.put = nativePut;
			const history = await oneBy("publication-attempts", "state", "prepared");
			if (history.intent !== "history")
				throw new Error("Expected actual prepared history journal");
			let beforeProtected:
				| Awaited<ReturnType<typeof protectedHistoryRows>>
				| undefined;
			other.store.hook = async () => {
				if (mode === "ambiguous-creator") {
					const existing = await oneBy("revisions", "revisionId", "r1");
					await put("revisions", {
						...existing,
						creationAttemptId: history.attemptId,
					});
				}
				beforeProtected = await protectedHistoryRows(String(history.attemptId));
			};
			const takeover = await other.repo.takeOverWriterLease(projectId),
				afterProtected = await protectedHistoryRows(String(history.attemptId)),
				historyAfter = (await records("publication-attempts"))
					.map(record)
					.find((row) => row.attemptId === history.attemptId),
				surviving = (await records("revisions"))
					.map(record)
					.find((row) => row.revisionId === "r1"),
				current = await other.repo.loadProject(projectId);
			// Never recreate a deleted historical Revision to make the positive control pass.
			if (mode === "ambiguous-creator" && surviving)
				await put("revisions", {
					...surviving,
					creationAttemptId: original.creationAttemptId,
				});
			const recovery = await other.repo.takeOverWriterLease(projectId),
				retry = await other.repo.publishNextRevision(first, "r2", "history");
			return {
				failed,
				beforeProtected,
				afterProtected,
				historyAfter,
				aborts,
				history,
				original,
				surviving,
				takeover,
				current,
				recovery,
				retry,
				reopened: await other.repo.loadProject(projectId),
				faults: other.store.faults,
			};
		} finally {
			IDBObjectStore.prototype.put = nativePut;
			await value.store.close();
			await other.store.close();
		}
	},
	async orphanPin(mode: "prepared-without-lease" | "no-publish-without-lease") {
		const value =
				mode === "no-publish-without-lease" ? await fixture() : undefined,
			plain = value ?? runtime(),
			nativePut = IDBObjectStore.prototype.put;
		let armed = false,
			aborts = 0;
		try {
			let pin: Record<string, unknown>,
				attempt: Record<string, unknown>,
				next: PublicationCandidate;
			if (value) {
				next = value.next;
				pin = await oneBy("pin-staging-leases", "leaseId", value.lease.leaseId);
				await value.repo.pinStaging.discard(value.lease);
				attempt = await oneBy(
					"publication-attempts",
					"attemptId",
					pin.attemptId,
				);
				if (attempt.state !== "no-publish")
					throw new Error("Expected actual cancelled journal");
				const withoutLease = { ...attempt };
				delete withoutLease.leaseId;
				await put("publication-attempts", withoutLease);
				await put("pin-staging-leases", pin);
			} else {
				const first = await candidate("r1");
				if ((await plain.repo.publish(first)).kind !== "durable")
					throw new Error("Fixture R1 did not publish");
				next = await candidate("r2", true);
				const asset = next.project.assetDefinitionRefs[0];
				if (asset.format !== "glb") throw new Error("Missing custom reference");
				await plain.repo.library.register(asset, {
					resourceHash: asset.resourceHash,
					bytes,
				});
				armed = true;
				IDBObjectStore.prototype.put = function (
					...args: Parameters<IDBObjectStore["put"]>
				) {
					const request = nativePut.apply(this, args);
					if (
						armed &&
						this.name === "projects" &&
						this.transaction.db.name === databaseName &&
						args[0] &&
						Reflect.get(args[0], "currentRevisionId") === "r2"
					) {
						armed = false;
						this.transaction.addEventListener("abort", () => aborts++, {
							once: true,
						});
						this.transaction.abort();
					}
					return request;
				};
				const failed = await plain.repo.publish(next, "r1");
				IDBObjectStore.prototype.put = nativePut;
				if (failed.kind !== "persist-failed")
					throw new Error("Fixture commit abort was not observed");
				attempt = await oneBy("publication-attempts", "state", "prepared");
				if (attempt.leaseId !== undefined)
					throw new Error(
						"Fixture ordinary publication unexpectedly had a lease",
					);
				pin = {
					scope,
					leaseId: `tma-v1:${scope}:lease:999999`,
					attemptId: attempt.attemptId,
					projectId,
					revisionId: "r2",
					resourceHashes: [asset.resourceHash],
					marked: false,
				};
				await put("pin-staging-leases", pin);
			}
			const before = await snapshot(),
				refused = await plain.repo.inspectWriterAccess(projectId),
				after = await snapshot();
			const database = await open();
			try {
				await new Promise<void>((resolve, reject) => {
					const transaction = database.transaction(
						"pin-staging-leases",
						"readwrite",
						{ durability: "strict" },
					);
					transaction
						.objectStore("pin-staging-leases")
						.delete(String(pin.leaseId));
					transaction.oncomplete = () => resolve();
					transaction.onabort = () => reject(transaction.error);
				});
			} finally {
				database.close();
			}
			const healthy = await plain.repo.inspectWriterAccess(projectId);
			return { before, after, refused, healthy, aborts, attempt, pin };
		} finally {
			IDBObjectStore.prototype.put = nativePut;
			await plain.store.close();
		}
	},
	async wrongPublication(mode: "project" | "revision") {
		const value = await fixture();
		try {
			const before = await snapshot(),
				refused = await outcome(() =>
					value.repo.pinStaging.markForPublication(value.lease, {
						projectId: mode === "project" ? "wrong-project" : projectId,
						revisionId: mode === "revision" ? "wrong-revision" : "r2",
					}),
				),
				after = await snapshot();
			await value.repo.pinStaging.markForPublication(value.lease, {
				projectId,
				revisionId: "r2",
			});
			const healthy = await value.repo.publish(value.next, "r1");
			return { before, after, refused, healthy };
		} finally {
			await value.store.close();
		}
	},
	async lateRevision(mode: "scope" | "candidate") {
		const value = await fixture();
		try {
			const original = await oneBy("revisions", "revisionId", "r2");
			await value.repo.pinStaging.markForPublication(value.lease, {
				projectId,
				revisionId: "r2",
			});
			value.store.binaryHook = async () => {
				const changed =
					mode === "scope"
						? { ...original, scope: foreignScope }
						: {
								...original,
								candidate: {
									...record(original.candidate),
									project: {
										...record(record(original.candidate).project),
										name: "Changed after verification",
									},
								},
							};
				await put("revisions", changed);
			};
			const refused = await value.repo.publish(value.next, "r1"),
				after = await snapshot(),
				current = await value.repo.loadProject(projectId);
			// Restore only the existing exact key; never fabricate a row removed by a mutant.
			const stillExists = (await records("revisions")).some(
				(row) => record(row).revisionId === "r2",
			);
			if (stillExists) await put("revisions", original);
			const healthy = stillExists
				? await value.repo.publish(value.next, "r1")
				: undefined;
			return {
				refused,
				after,
				current,
				stillExists,
				healthy,
				faults: value.store.binaryFaults,
				faultedSnapshot: value.store.binaryFaultedSnapshot,
			};
		} finally {
			await value.store.close();
		}
	},
	async historyCreationProtocol() {
		const value = runtime();
		try {
			const first = await candidate("r1"),
				next = await candidate("r2");
			if (
				(await value.repo.publish(first)).kind !== "durable" ||
				(await value.repo.publish(next, "r1")).kind !== "durable"
			)
				throw new Error("Fixture history roots did not publish");
			value.store.hook = async () => {
				const revision = await oneBy("revisions", "revisionId", "r1"),
					creation = await oneBy(
						"publication-attempts",
						"attemptId",
						revision.creationAttemptId,
					);
				await put("publication-attempts", { ...creation, protocolVersion: 2 });
			};
			const refused = await value.repo.publishNextRevision(
					first,
					"r2",
					"history",
				),
				after = await snapshot(),
				technicalAfter = await technicalState();
			return {
				refused,
				technicalAfter,
				technicalFault: value.store.faultedTechnical,
				after,
				faults: value.store.faults,
				faultedSnapshot: value.store.faultedSnapshot,
				current: await value.repo.loadProject(projectId),
			};
		} finally {
			await value.store.close();
		}
	},
	async publishedPinAuthorization() {
		const value = await fixture();
		try {
			await value.repo.pinStaging.markForPublication(value.lease, {
				projectId,
				revisionId: "r2",
			});
			if ((await value.repo.publish(value.next, "r1")).kind !== "durable")
				throw new Error("Fixture R2 did not publish");
			const pin = await oneBy(
				"pin-staging-leases",
				"leaseId",
				value.lease.leaseId,
			);
			if (pin.marked !== true)
				throw new Error("Fixture published pin was not marked");
			await put("pin-staging-leases", { ...pin, marked: false });
			const before = await snapshot(),
				refused = await value.repo.inspectWriterAccess(projectId),
				after = await snapshot();
			await put("pin-staging-leases", pin);
			const healthy = await value.repo.inspectWriterAccess(projectId);
			return { before, after, refused, healthy };
		} finally {
			await value.store.close();
		}
	},

	async sameOwnerPrepared(mode: "stage-schema" | "stage-project") {
		const value = await fixture();
		try {
			const pin = await oneBy(
					"pin-staging-leases",
					"leaseId",
					value.lease.leaseId,
				),
				stage = await oneBy("staging", "attemptId", pin.attemptId),
				revision = await oneBy("revisions", "revisionId", "r2");
			const changed = structuredClone(record(stage.candidate));
			changed.project = {
				...record(changed.project),
				...(mode === "stage-schema"
					? { schemaVersion: 2 }
					: { projectId: "other-project" }),
			};
			await put("staging", { ...stage, candidate: changed });
			await put("revisions", {
				...revision,
				...(mode === "stage-project" ? { projectId: "other-project" } : {}),
				candidate: changed,
			});
			const before = await snapshot(),
				refused = await value.repo.inspectWriterAccess(projectId),
				after = await snapshot();
			await put("staging", stage);
			await put("revisions", revision);
			const healthy = await value.repo.inspectWriterAccess(projectId);
			return { before, after, refused, healthy };
		} finally {
			await value.store.close();
		}
	},
	async changedStoredOwner() {
		const value = await fixture();
		try {
			const pin = await oneBy(
					"pin-staging-leases",
					"leaseId",
					value.lease.leaseId,
				),
				attempt = await oneBy(
					"publication-attempts",
					"attemptId",
					pin.attemptId,
				),
				writer = await oneBy("writer-fences", "projectId", projectId);
			await put("publication-attempts", {
				...attempt,
				ownerId: "coherent-foreign-owner",
			});
			await put("writer-fences", {
				...writer,
				ownerId: "coherent-foreign-owner",
			});
			const before = await snapshot(),
				refused = await outcome(() =>
					value.repo.pinStaging.markForPublication(value.lease, {
						projectId,
						revisionId: "r2",
					}),
				),
				after = await snapshot();
			await put("publication-attempts", attempt);
			await put("writer-fences", writer);
			await value.repo.pinStaging.markForPublication(value.lease, {
				projectId,
				revisionId: "r2",
			});
			const healthy = await value.repo.publish(value.next, "r1");
			return { before, after, refused, healthy };
		} finally {
			await value.store.close();
		}
	},
	async afterAcquisition(
		mode: "lease-attempt" | "lease-project" | "revision-project",
	) {
		const value = await fixture();
		try {
			value.store.hook = async () => {
				if (mode === "revision-project") {
					const revision = await oneBy("revisions", "revisionId", "r2");
					await put("revisions", { ...revision, projectId: "other-project" });
				} else {
					const lease = await oneBy(
						"pin-staging-leases",
						"leaseId",
						value.lease.leaseId,
					);
					await put("pin-staging-leases", {
						...lease,
						...(mode === "lease-attempt"
							? { attemptId: `tma-v1:${scope}:attempt:999999` }
							: { projectId: "other-project" }),
					});
				}
			};
			const refused = await value.repo.takeOverWriterLease(projectId),
				after = await snapshot();
			return {
				refused,
				after,
				faults: value.store.faults,
				faultedSnapshot: value.store.faultedSnapshot,
				current: await value.repo.loadProject(projectId),
			};
		} finally {
			await value.store.close();
		}
	},
	async quotaBeforeCommit() {
		const value = runtime(),
			first = await candidate("r1"),
			next = await candidate("r2");
		const nativeAdd = IDBObjectStore.prototype.add;
		let armed = false,
			writeFaults = 0,
			actualAborts = 0;
		try {
			const healthy = await value.repo.publish(first);
			if (healthy.kind !== "durable")
				throw new Error("Fixture R1 did not publish");
			const before = await snapshot(),
				technicalBefore = await technicalState();
			armed = true;
			IDBObjectStore.prototype.add = function (
				...args: Parameters<IDBObjectStore["add"]>
			) {
				if (
					armed &&
					this.name === "revisions" &&
					this.transaction.db.name === databaseName
				) {
					armed = false;
					writeFaults++;
					this.transaction.addEventListener("abort", () => actualAborts++, {
						once: true,
					});
					this.transaction.abort();
					throw new DOMException(
						"Controlled pre-commit quota fault",
						"QuotaExceededError",
					);
				}
				return nativeAdd.apply(this, args);
			};
			const refused = await value.repo.publish(next, "r1"),
				after = await snapshot(),
				technicalAfter = await technicalState(),
				current = await value.repo.loadProject(projectId);
			IDBObjectStore.prototype.add = nativeAdd;
			const retry = await value.repo.publish(next, "r1");
			return {
				healthy,
				technicalBefore,
				technicalAfter,
				before,
				after,
				writeFaults,
				actualAborts,
				refused,
				current,
				retry,
				reopened: await value.repo.loadProject(projectId),
			};
		} finally {
			IDBObjectStore.prototype.add = nativeAdd;
			await value.store.close();
		}
	},
	async unmarkedPublication() {
		const value = await fixture();
		try {
			const before = await snapshot(),
				refused = await value.repo.publish(value.next, "r1"),
				after = await snapshot(),
				current = await value.repo.loadProject(projectId);
			let retry: Awaited<ReturnType<typeof value.repo.publish>> | undefined;
			if (refused.kind === "persist-failed") {
				await value.repo.pinStaging.markForPublication(value.lease, {
					projectId,
					revisionId: "r2",
				});
				retry = await value.repo.publish(value.next, "r1");
			}
			return {
				before,
				after,
				refused,
				current,
				retry,
				reopened: await value.repo.loadProject(projectId),
			};
		} finally {
			await value.store.close();
		}
	},
	async pinLink(mode: "pointer-scope" | "lease-project" | "attempt-lease") {
		const value = await fixture();
		try {
			let original: Record<string, unknown>,
				name: (typeof names)[number],
				publicationProjectId = projectId;
			if (mode === "pointer-scope") {
				name = "projects";
				original = await oneBy(name, "projectId", projectId);
				await put(name, { ...original, scope: foreignScope });
			} else if (mode === "lease-project") {
				const neighbor = await candidate("q-r1", false, "healthy-neighbor");
				if ((await value.repo.publish(neighbor)).kind !== "durable")
					throw new Error("Fixture neighbor did not publish");
				name = "pin-staging-leases";
				original = await oneBy(name, "leaseId", value.lease.leaseId);
				publicationProjectId = "healthy-neighbor";
				await put(name, { ...original, projectId: publicationProjectId });
			} else {
				name = "publication-attempts";
				const lease = await oneBy(
					"pin-staging-leases",
					"leaseId",
					value.lease.leaseId,
				);
				original = await oneBy(name, "attemptId", lease.attemptId);
				const wrongLeaseId = `tma-v1:${scope}:lease:999999`;
				if (wrongLeaseId === value.lease.leaseId)
					throw new Error("Fixture lease identities collided");
				await put(name, { ...original, leaseId: wrongLeaseId });
			}
			const before = await snapshot(),
				refused = await outcome(() =>
					value.repo.pinStaging.markForPublication(value.lease, {
						projectId: publicationProjectId,
						revisionId: "r2",
					}),
				),
				after = await snapshot();
			await put(name, original);
			await value.repo.pinStaging.markForPublication(value.lease, {
				projectId,
				revisionId: "r2",
			});
			const healthy = await value.repo.publish(value.next, "r1");
			return {
				before,
				after,
				refused,
				healthy,
				reopened: await value.repo.loadProject(projectId),
			};
		} finally {
			await value.store.close();
		}
	},
};
declare global {
	interface Window {
		commonPublicGaps: typeof api;
	}
}
window.commonPublicGaps = api;
