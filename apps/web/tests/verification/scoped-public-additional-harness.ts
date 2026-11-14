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

// Protocol fixture identity only: this does not prove signed launch, GLB safety,
// rendering, complete archives, or a physical Telegram profile.
const scope = `tma-v1-${"9".repeat(64)}` as VerifiedTelegramScope;
const databaseName = `interiors-editor-projects:${scope}`;
const bytes = Uint8Array.of(101, 102, 103);
const stores = [
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
type Store = (typeof stores)[number];
function record(value: unknown): Record<string, unknown> {
	if (!value || typeof value !== "object" || Array.isArray(value))
		throw new Error("Expected actual native row");
	return value as Record<string, unknown>;
}
function openExisting(): Promise<IDBDatabase> {
	return new Promise((resolve, reject) => {
		const request = indexedDB.open(databaseName);
		let settled = false;
		request.onupgradeneeded = () => {
			request.transaction?.abort();
			settled = true;
			reject(new Error("Actual protocol fixture was not initialized"));
		};
		request.onsuccess = () => {
			if (settled) request.result.close();
			else {
				settled = true;
				resolve(request.result);
			}
		};
		request.onerror = () => {
			if (!settled) {
				settled = true;
				reject(request.error);
			}
		};
	});
}
async function records(name: Store): Promise<unknown[]> {
	const database = await openExisting();
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
async function put(name: Store, value: unknown): Promise<void> {
	const database = await openExisting();
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
async function remove(name: Store, key: string): Promise<void> {
	const database = await openExisting();
	try {
		await new Promise<void>((resolve, reject) => {
			const transaction = database.transaction(name, "readwrite", {
				durability: "strict",
			});
			transaction.objectStore(name).delete(key);
			transaction.oncomplete = () => resolve();
			transaction.onabort = () => reject(transaction.error);
		});
	} finally {
		database.close();
	}
}
async function find(
	name: Store,
	key: string,
	value: string,
): Promise<Record<string, unknown>> {
	const found = (await records(name)).filter(
		(item) => record(item)[key] === value,
	);
	if (found.length !== 1)
		throw new Error("Expected one matching genuine native row");
	return record(found[0]);
}
async function normalized(value: unknown): Promise<unknown> {
	if (value instanceof Blob)
		return {
			nativeType: "Blob",
			size: value.size,
			type: value.type,
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
async function snapshot(only: readonly Store[] = stores) {
	const database = await openExisting();
	let values: { name: Store; rows: unknown[] }[];
	try {
		values = await new Promise((resolve, reject) => {
			const transaction = database.transaction([...only], "readonly"),
				result: { name: Store; rows: unknown[] }[] = [];
			for (const name of only) {
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
const dataStores = stores.filter(
	(name) => name !== "scope-metadata" && name !== "writer-fences",
);
async function otherProjectData(projectId: string) {
	return Promise.all(
		(
			[
				"projects",
				"revisions",
				"staging",
				"writer-fences",
				"publication-attempts",
				"pin-staging-leases",
			] as const
		).map(async (name) => ({
			name,
			rows: await normalized(
				(await records(name)).filter(
					(value) => record(value).projectId === projectId,
				),
			),
		})),
	);
}
async function metadata() {
	const identity = await find("scope-metadata", "key", "identity"),
		counter = await find("scope-metadata", "key", "counter");
	if (typeof counter.lastReserved !== "string")
		throw new Error("Expected actual counter string");
	return {
		identity: await normalized(identity),
		counter: counter.lastReserved,
	};
}
async function asset(): Promise<CustomGlbAssetDefinition> {
	return {
		assetDefinitionId: "opaque-model",
		displayName: "Opaque protocol resource",
		format: "glb",
		resourceHash: await browserBinaryChecksum.sha256Bytes(bytes),
		byteLength: bytes.byteLength,
		widthMm: 100,
		depthMm: 100,
		heightMm: 100,
	};
}
async function candidate(
	projectId: string,
	revisionId: string,
	resource = false,
): Promise<PublicationCandidate> {
	const project = {
		...createInitialProject({
			projectId,
			levelId: `${projectId}-level`,
			name: `Proof ${revisionId}`,
			createdAt: "2026-11-05T12:00:00.000Z",
		}),
		assetDefinitionRefs: resource ? [await asset()] : [],
	};
	const serializedProject = canonicalProjectSerializer.serialize(project);
	return {
		project,
		revision: {
			projectId,
			revisionId,
			schemaVersion: 1,
			createdAt: project.createdAt,
			serializedProject,
			checksum: await browserChecksum.sha256(serializedProject),
		},
	};
}
/** Delegate every capability/result to the actual native store. Observation is
 * recorded only after the real readonly reconciliation snapshot commits. */
class SnapshotObservedStore extends TelegramScopeStore {
	observeRevision: string | undefined;
	snapshotObserved = false;
	override run<T>(
		operation: (access: TelegramScopeAccess) => Promise<T>,
	): Promise<T> {
		return super.run((access) =>
			operation({
				scope: access.scope,
				signal: access.signal,
				reserveId: (kind) => access.reserveId(kind),
				transact: async (names, mode, work) => {
					const result = await access.transact(names, mode, work);
					if (
						this.observeRevision &&
						mode === "readonly" &&
						names.length === 3 &&
						names.includes("revisions") &&
						names.includes("staging") &&
						names.includes("pin-staging-leases") &&
						result &&
						typeof result === "object"
					) {
						const revision = Reflect.get(result, "revision");
						if (
							revision &&
							typeof revision === "object" &&
							Reflect.get(revision, "revisionId") === this.observeRevision
						)
							this.snapshotObserved = true;
					}
					return result;
				},
			}),
		);
	}
}
function runtime(ownerId: string, initialNow = 1000) {
	const session = new TelegramRuntimeSession(scope),
		store = new SnapshotObservedStore(session, {
			indexedDb: indexedDB,
			locks: navigator.locks,
			secureContext: isSecureContext,
		});
	let now = initialNow,
		stringHook:
			| { source: string; run: (digest: string) => Promise<void> }
			| undefined,
		binaryHook: ((digest: string) => Promise<void>) | undefined;
	const repo = new TelegramProjectRepository(store, {
		ownerId,
		nowEpochMs: () => now,
		takeoverRequirements: createTelegramContextState(scope, {
			sessionStorage,
			localStorage,
		}).writerTakeover,
		checksum: {
			async sha256(source) {
				const digest = await browserChecksum.sha256(source);
				if (stringHook?.source === source) {
					const hook = stringHook;
					stringHook = undefined;
					await hook.run(digest);
				}
				return digest;
			},
		},
		binaryChecksum: {
			async sha256Bytes(input) {
				const digest = await browserBinaryChecksum.sha256Bytes(input),
					hook = binaryHook;
				binaryHook = undefined;
				await hook?.(digest);
				return digest;
			},
		},
	});
	return {
		repo,
		store,
		setNow(value: number) {
			now = value;
		},
		armString(source: string, run: (digest: string) => Promise<void>) {
			stringHook = { source, run };
		},
		armBinary(run: (digest: string) => Promise<void>) {
			binaryHook = run;
		},
	};
}
type Runtime = ReturnType<typeof runtime>;
async function prepare(
	value: Runtime,
	projectId: string,
	revisionId: string,
	base?: string,
) {
	const next = await candidate(projectId, revisionId, true),
		definition = next.project.assetDefinitionRefs[0];
	const lease = await value.repo.pinStaging.begin([definition.resourceHash], {
		candidate: next,
		...(base === undefined ? {} : { expectedBaseRevisionId: base }),
	});
	const write = value.repo.resources.writeIfAbsentPinned;
	if (!write) throw new Error("Missing actual pinned write");
	const written = await write(
		{ resourceHash: definition.resourceHash, bytes },
		lease.leaseId,
	);
	if (written.kind !== "stored" && written.kind !== "already-present")
		throw new Error("Valid actual resource write refused");
	return { next, definition, lease };
}
async function publishPrepared(
	value: Runtime,
	prepared: Awaited<ReturnType<typeof prepare>>,
	base?: string,
) {
	await value.repo.pinStaging.markForPublication(prepared.lease, {
		projectId: prepared.next.project.projectId,
		revisionId: prepared.next.revision.revisionId,
	});
	return value.repo.publish(prepared.next, base);
}
async function baseFixture() {
	const a = runtime("additional-owner-a"),
		first = await candidate("main", "base-r1");
	if ((await a.repo.publish(first)).kind !== "durable")
		throw new Error("Valid initial publication refused");
	const prepared = await prepare(a, "main", "pending-r2", "base-r1");
	return { a, first, prepared };
}
const api = {
	async sharedTakeover(
		mode: "prepared-other" | "published-other" | "prepared-library",
	) {
		const a = runtime("shared-owner-a"),
			b = runtime("shared-owner-b");
		try {
			const first = await prepare(a, "first", "first-r1");
			if (
				mode === "published-other" &&
				(await publishPrepared(a, first)).kind !== "durable"
			)
				throw new Error("Valid first publication refused");
			let second: Awaited<ReturnType<typeof prepare>> | undefined;
			if (mode !== "prepared-library")
				second = await prepare(a, "other", "other-r1");
			else if (
				(
					await a.repo.library.register(await asset(), {
						resourceHash: first.definition.resourceHash,
						bytes,
					})
				).kind !== "registered"
			)
				throw new Error("Actual library root not registered");
			const otherDataBefore = await otherProjectData("other"),
				libraryBefore = await a.repo.library.list();
			const takeover = await b.repo.takeOverWriterLease("first"),
				otherDataAfter = await otherProjectData("other"),
				row = await find(
					"resources",
					"resourceHash",
					first.definition.resourceHash,
				);
			const bytesAfterTakeover = Array.from(
					(await a.repo.resources.read(first.definition.resourceHash)) ?? [],
				),
				firstCurrent = await b.repo.loadProject("first"),
				libraryAfter = await a.repo.library.list();
			const otherPublication = second
				? await publishPrepared(a, second)
				: undefined;
			const otherCurrent = second
				? await a.repo.loadProject("other")
				: undefined;
			return {
				takeover,
				bytesAfterTakeover,
				rootsAfterTakeover: row.roots,
				expectedOtherRoots: second ? [second.lease.leaseId] : [],
				durableAfterTakeover: row.durable,
				otherDataBefore,
				otherDataAfter,
				libraryBefore,
				libraryAfter,
				otherPublication,
				otherCurrent,
				firstCurrent,
			};
		} finally {
			await Promise.all([a.store.close(), b.store.close()]);
		}
	},
	async takeoverSnapshotCas(field: "attempt" | "revision" | "stage" | "pin") {
		const { a, prepared } = await baseFixture(),
			b = runtime("cas-owner-b");
		try {
			const lease = await find(
					"pin-staging-leases",
					"leaseId",
					prepared.lease.leaseId,
				),
				attemptId = lease.attemptId;
			if (typeof attemptId !== "string")
				throw new Error("Missing actual attempt identity");
			const target: Store =
				field === "attempt"
					? "publication-attempts"
					: field === "revision"
						? "revisions"
						: field === "stage"
							? "staging"
							: "pin-staging-leases";
			const key =
					field === "revision"
						? "revisionId"
						: field === "pin"
							? "leaseId"
							: "attemptId",
				keyValue =
					field === "revision"
						? "pending-r2"
						: field === "pin"
							? prepared.lease.leaseId
							: attemptId;
			const original = await find(target, key, keyValue);
			let afterFault: Awaited<ReturnType<typeof snapshot>> | undefined,
				observedDigest: string | undefined,
				faultCount = 0;
			b.store.observeRevision = "pending-r2";
			b.armString(prepared.next.revision.serializedProject, async (digest) => {
				observedDigest = digest;
				if (!b.store.snapshotObserved)
					throw new Error(
						"Actual readonly snapshot was not observed before checksum",
					);
				const altered =
					field === "attempt"
						? { ...original, ownerId: "changed-after-snapshot" }
						: field === "revision"
							? {
									...original,
									candidate: {
										...record(original.candidate),
										project: {
											...record(record(original.candidate).project),
											name: "Changed after snapshot",
										},
									},
								}
							: field === "stage"
								? { ...original, checksum: "changed-after-snapshot" }
								: { ...original, marked: !original.marked };
				await put(target, altered);
				faultCount++;
				afterFault = await snapshot();
			});
			const refused = await b.repo.takeOverWriterLease("main"),
				afterRefusal = await snapshot(),
				bytesAfterRefusal = Array.from(
					(await a.repo.resources.read(prepared.definition.resourceHash)) ?? [],
				),
				currentAfterRefusal = await a.repo.loadProject("main");
			await put(target, original);
			const retry = await b.repo.takeOverWriterLease("main"),
				finalCurrent = await b.repo.loadProject("main");
			return {
				snapshotObserved: b.store.snapshotObserved,
				faultCount,
				observedDigest,
				expectedDigest: prepared.next.revision.checksum,
				refused,
				afterFault,
				afterRefusal,
				bytesAfterRefusal,
				currentAfterRefusal,
				retry,
				finalCurrent,
			};
		} finally {
			await Promise.all([a.store.close(), b.store.close()]);
		}
	},
	async missingBase(mode: "existing-no-base" | "absent-with-base") {
		const a = runtime("base-owner");
		try {
			const first = await candidate("base-project", "first-r1"),
				next = await candidate("base-project", "next-r2");
			if (mode === "existing-no-base") {
				if ((await a.repo.publish(first)).kind !== "durable")
					throw new Error("Initial fixture refused");
			} else await a.store.reserveId("lease");
			const beforeData = await snapshot(dataStores),
				before = await metadata();
			const refused =
				mode === "existing-no-base"
					? await a.repo.publish(next)
					: await a.repo.publish(first, "nonexistent-base");
			const afterData = await snapshot(dataStores),
				after = await metadata(),
				positive =
					mode === "existing-no-base"
						? await a.repo.publish(next, "first-r1")
						: await a.repo.publish(first);
			return {
				beforeData,
				afterData,
				identityBefore: before.identity,
				identityAfter: after.identity,
				counterBefore: before.counter,
				counterAfter: after.counter,
				refused,
				positive,
			};
		} finally {
			await a.store.close();
		}
	},
	async historyCreation(
		field: "project" | "revision" | "checksum" | "serialization" | "intent",
	) {
		const a = runtime("history-owner");
		try {
			const first = await candidate("history-project", "history-r1"),
				second = await candidate("history-project", "history-r2");
			if (
				(await a.repo.publish(first)).kind !== "durable" ||
				(await a.repo.publish(second, "history-r1")).kind !== "durable"
			)
				throw new Error("Valid history fixture refused");
			const revision = await find("revisions", "revisionId", "history-r1"),
				attemptId = revision.creationAttemptId;
			if (typeof attemptId !== "string")
				throw new Error("Missing actual creation identity");
			const original = await find(
					"publication-attempts",
					"attemptId",
					attemptId,
				),
				receipt = record(original.receipt);
			const altered =
				field === "project"
					? { ...original, projectId: "foreign-history-project" }
					: field === "revision"
						? {
								...original,
								revisionId: "foreign-history-revision",
								receipt: { ...receipt, revisionId: "foreign-history-revision" },
							}
						: field === "checksum"
							? {
									...original,
									checksum: "different-exact-source-digest",
									receipt: {
										...receipt,
										checksum: "different-exact-source-digest",
									},
								}
							: field === "serialization"
								? {
										...original,
										serializedProject: "different original source bytes",
									}
								: { ...original, intent: "history" };
			await put("publication-attempts", altered);
			const beforeData = await snapshot(dataStores),
				refused = await a.repo.publishNextRevision(
					first,
					"history-r2",
					"history",
				),
				afterData = await snapshot(dataStores),
				currentAfterRefusal = await a.repo.loadProject("history-project");
			await put("publication-attempts", original);
			const positive = await a.repo.publishNextRevision(
					first,
					"history-r2",
					"history",
				),
				finalCurrent = await a.repo.loadProject("history-project");
			return {
				beforeData,
				refused,
				afterData,
				currentAfterRefusal,
				positive,
				finalCurrent,
			};
		} finally {
			await a.store.close();
		}
	},
	async knownPublishedExtraStage() {
		const { a, first, prepared } = await baseFixture(),
			b = runtime("stage-owner-b");
		try {
			const revision = await find("revisions", "revisionId", "base-r1"),
				id = revision.creationAttemptId;
			if (typeof id !== "string")
				throw new Error("Missing actual published creation");
			const published = await find("publication-attempts", "attemptId", id),
				actualStage = await find("staging", "revisionId", "pending-r2");
			await put("staging", {
				...actualStage,
				protocolVersion: published.protocolVersion,
				scope: published.scope,
				projectId: published.projectId,
				attemptId: published.attemptId,
				ownerId: published.ownerId,
				fencingToken: published.fencingToken,
				expectedBaseRevisionId: published.expectedBaseRevisionId,
				revisionId: published.revisionId,
				checksum: published.checksum,
				resourceManifest: published.resourceManifest,
				candidate: first,
			});
			const before = await snapshot(),
				access = await a.repo.inspectWriterAccess("main"),
				takeover = await b.repo.takeOverWriterLease("main"),
				after = await snapshot();
			await remove("staging", id);
			const restored = await a.repo.inspectWriterAccess("main"),
				resource = Array.from(
					(await a.repo.resources.read(prepared.definition.resourceHash)) ?? [],
				);
			return { before, access, takeover, after, restored, bytes: resource };
		} finally {
			await Promise.all([a.store.close(), b.store.close()]);
		}
	},
	async lateFence(field: "extra" | "deleted" | "negative-clock") {
		const { a, prepared } = await baseFixture();
		try {
			await a.repo.pinStaging.markForPublication(prepared.lease, {
				projectId: "main",
				revisionId: "pending-r2",
			});
			const original = await find("writer-fences", "projectId", "main");
			let faultCount = 0,
				observedDigest: string | undefined,
				afterFault: Awaited<ReturnType<typeof snapshot>> | undefined;
			a.armBinary(async (digest) => {
				observedDigest = digest;
				if (field === "negative-clock") a.setNow(-1);
				else
					await put(
						"writer-fences",
						field === "extra"
							? { ...original, unknownWriterFact: true }
							: { ...original, deleted: true },
					);
				faultCount++;
				afterFault = await snapshot();
			});
			const refused = await a.repo.publish(prepared.next, "base-r1"),
				afterRefusal = await snapshot(),
				lost = a.repo.consumeLostWriterLease(),
				lostAgain = a.repo.consumeLostWriterLease();
			a.setNow(1000);
			await put("writer-fences", original);
			const blockedBefore = await snapshot(),
				blocked = await a.repo.publish(prepared.next, "base-r1"),
				blockedAfter = await snapshot();
			const takeover = await a.repo.takeOverWriterLease("main"),
				positive = await a.repo.publish(
					await candidate("main", "after-takeover-r3"),
					"base-r1",
				);
			return {
				faultCount,
				observedDigest,
				expectedDigest: prepared.definition.resourceHash,
				afterFault,
				refused,
				afterRefusal,
				lost,
				lostAgain,
				blockedBefore,
				blocked,
				blockedAfter,
				takeover,
				positive,
			};
		} finally {
			await a.store.close();
		}
	},
	async foreignCreationSurvivesLastRootCleanup() {
		const a = runtime("foreign-creation-owner-a"),
			b = runtime("foreign-creation-owner-b");
		try {
			const origin = await prepare(a, "origin", "origin-r1"),
				consumer = await prepare(a, "consumer", "consumer-r1");
			await a.repo.pinStaging.discard(origin.lease);
			const resourceBefore = await find(
				"resources",
				"resourceHash",
				origin.definition.resourceHash,
			);
			const originBefore = await otherProjectData("origin"),
				metadataBefore = await metadata(),
				takeover = await b.repo.takeOverWriterLease("consumer"),
				bytesAfter = Array.from(
					(await b.repo.resources.read(origin.definition.resourceHash)) ?? [],
				),
				resourceAfter = (await records("resources")).find(
					(value) =>
						record(value).resourceHash === origin.definition.resourceHash,
				),
				originAfter = await otherProjectData("origin"),
				metadataAfter = await metadata(),
				consumerAfter = await b.repo.loadProject("consumer");
			return {
				originLease: origin.lease.leaseId,
				consumerLease: consumer.lease.leaseId,
				beforeCreationLease: resourceBefore.creationLeaseId,
				beforeRoots: resourceBefore.roots,
				beforeDurable: resourceBefore.durable,
				takeover,
				bytesAfter,
				resourceAfter: await normalized(resourceAfter),
				expectedResourceAfter: await normalized({ ...resourceBefore, roots: [] }),
				originBefore,
				originAfter,
				metadataBefore,
				metadataAfter,
				consumerAfter,
			};
		} finally {
			await Promise.all([a.store.close(), b.store.close()]);
		}
	},
	async zeroEpoch() {
		const a = runtime("zero-owner", 0);
		try {
			const published = await a.repo.publish(
					await candidate("zero-project", "zero-r1"),
				),
				current = await a.repo.loadProject("zero-project");
			return { published, current };
		} finally {
			await a.store.close();
		}
	},
};
Object.assign(window, { scopedAdditional: api });
declare global {
	interface Window {
		scopedAdditional: typeof api;
	}
}
