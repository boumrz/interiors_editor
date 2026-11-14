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
const scope = `tma-v1-${"e".repeat(64)}` as VerifiedTelegramScope;
const foreignScope = `tma-v1-${"d".repeat(64)}`;
const projectId = "public-protocol-edges";
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
function record(value: unknown): Record<string, unknown> {
	if (!value || typeof value !== "object" || Array.isArray(value))
		throw new Error("Missing native fixture row");
	return value as Record<string, unknown>;
}
async function sole(
	name: (typeof names)[number],
): Promise<Record<string, unknown>> {
	const rows = await records(name);
	if (rows.length !== 1) throw new Error("Expected one genuine native row");
	return record(rows[0]);
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
async function removeResource(hash: string) {
	const database = await open();
	try {
		await new Promise<void>((resolve, reject) => {
			const transaction = database.transaction("resources", "readwrite", {
				durability: "strict",
			});
			transaction.objectStore("resources").delete(hash);
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
			projectId,
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
			projectId,
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
/** Fault injection over the actual provided capability. No rows, transactions,
 * IDs or successful return values are fabricated. Only a completed publication
 * transaction loses its acknowledgement before the repository continuation. */
class CompletionFaultStore extends TelegramScopeStore {
	failPublicationAcknowledgement = false;
	acknowledgementLosses = 0;
	committedSnapshot: Awaited<ReturnType<typeof snapshot>> | undefined;
	override run<T>(
		operation: (access: TelegramScopeAccess) => Promise<T>,
	): Promise<T> {
		if (!this.failPublicationAcknowledgement) return super.run(operation);
		return super.run((access) =>
			operation({
				scope: access.scope,
				signal: access.signal,
				reserveId: (kind) => access.reserveId(kind),
				transact: async (names, mode, work) => {
					const result = await access.transact(names, mode, work);
					if (
						this.failPublicationAcknowledgement &&
						mode === "readwrite" &&
						names.includes("resources") &&
						names.includes("staging") &&
						names.includes("publication-attempts")
					) {
						this.failPublicationAcknowledgement = false;
						this.acknowledgementLosses++;
						this.committedSnapshot = await snapshot();
						throw new Error(
							"Test-only successful native commit acknowledgement loss",
						);
					}
					return result;
				},
			}),
		);
	}
}
function runtime() {
	const session = new TelegramRuntimeSession(scope),
		store = new CompletionFaultStore(session, {
			indexedDb: indexedDB,
			locks: navigator.locks,
			secureContext: isSecureContext,
		});
	let current: PublicationCandidate | undefined;
	let binaryHook: ((digest: string) => Promise<void>) | undefined;
	const dependencies = {
		ownerId: "public-protocol-owner",
		nowEpochMs: () => 1000,
		checksum: browserChecksum,
		binaryChecksum: {
			async sha256Bytes(input: Uint8Array) {
				const digest = await browserBinaryChecksum.sha256Bytes(input),
					hook = binaryHook;
				binaryHook = undefined;
				await hook?.(digest);
				return digest;
			},
		},
		takeoverRequirements: createTelegramContextState(scope, {
			sessionStorage,
			localStorage,
		}).writerTakeover,
		sessionRoots: () => ({ current, undo: [], redo: [] }),
	};
	const repository = () => new TelegramProjectRepository(store, dependencies),
		repo = repository();
	return {
		store,
		repo,
		repository,
		setCurrent(value: PublicationCandidate) {
			current = value;
		},
		arm(hook: (digest: string) => Promise<void>) {
			binaryHook = hook;
		},
	};
}
async function fixture() {
	const value = runtime(),
		first = await candidate("r1");
	if ((await value.repo.publish(first)).kind !== "durable")
		throw new Error("Native fixture did not publish R1");
	const next = await candidate("r2", true),
		asset = next.project.assetDefinitionRefs[0];
	if (asset.format !== "glb")
		throw new Error("Expected actual custom metadata");
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
		throw new Error("Native pin write failed");
	return { ...value, first, next, asset, lease };
}
const api = {
	async publicationAcknowledgementLoss() {
		const value = runtime();
		try {
			const first = await candidate("r1"),
				next = await candidate("r2");
			const healthy = await value.repo.publish(first);
			if (healthy.kind !== "durable")
				throw new Error("Native fixture did not publish R1");
			value.store.failPublicationAcknowledgement = true;
			const refused = await value.repo.publish(next, "r1");
			const committed = await value.repo.loadProject(projectId),
				beforeRetry = await snapshot();
			const retried = await value.repo.publish(next, "r1"),
				afterRetry = await snapshot();
			const normalAfterFault = await value.repo.publish(
				await candidate("r3"),
				"r2",
			);
			return {
				healthy,
				refused,
				acknowledgementLosses: value.store.acknowledgementLosses,
				committedSnapshot: value.store.committedSnapshot,
				committed,
				beforeRetry,
				retried,
				afterRetry,
				normalAfterFault,
				current: await value.repo.loadProject(projectId),
			};
		} finally {
			await value.store.close();
		}
	},
	async unpublishedComplete() {
		const value = await fixture();
		try {
			const before = await snapshot(),
				denied = await outcome(() =>
					value.repo.pinStaging.complete(value.lease),
				),
				after = await snapshot();
			await value.repo.pinStaging.markForPublication(value.lease, {
				projectId,
				revisionId: "r2",
			});
			const published = await value.repo.publish(value.next, "r1");
			await value.repo.pinStaging.complete(value.lease);
			return {
				before,
				denied,
				after,
				published,
				current: await value.repo.loadProject(projectId),
				resource: Array.from(
					(await value.repo.resources.read(value.asset.resourceHash)) ?? [],
				),
			};
		} finally {
			await value.store.close();
		}
	},
	async singleRepairAndRemovedHashes() {
		const value = await fixture();
		try {
			await value.repo.pinStaging.markForPublication(value.lease, {
				projectId,
				revisionId: "r2",
			});
			if ((await value.repo.publish(value.next, "r1")).kind !== "durable")
				throw new Error("Native fixture did not publish R2");
			value.setCurrent(value.next);
			const registered = await value.repo.library.register(value.asset, {
				resourceHash: value.asset.resourceHash,
				bytes,
			});
			const beforeRemoved =
				await value.repo.library.listRemovedResourceHashes?.();
			const remove = value.repo.library.remove;
			if (!remove) throw new Error("Missing actual library removal port");
			const removed = await remove(value.asset.assetDefinitionId),
				removedHashes = await value.repo.library.listRemovedResourceHashes?.(),
				listedAfterRemove = await value.repo.library.list();
			const restored = await value.repo.library.register(
				value.asset,
				{ resourceHash: value.asset.resourceHash, bytes },
				{ restoreRemoved: true },
			);
			const afterRestored =
				await value.repo.library.listRemovedResourceHashes?.();
			await removeResource(value.asset.resourceHash);
			const missingResource =
				(await value.repo.resources.read(value.asset.resourceHash)) === undefined;
			const damaged = await value.repo.loadProject(projectId),
				before = await snapshot(),
				replace = value.repo.resources.writeReplacing;
			if (!replace)
				throw new Error("Missing actual single-resource repair port");
			const denied = await outcome(() =>
					replace({
						resourceHash: value.asset.resourceHash,
						bytes: Uint8Array.of(11, 12, 13),
					}),
				),
				afterDenied = await snapshot();
			const repaired = await outcome(() =>
				replace({ resourceHash: value.asset.resourceHash, bytes }),
			);
			return {
				registered,
				beforeRemoved,
				removed,
				removedHashes,
				listedAfterRemove,
				restored,
				afterRestored,
				expectedHash: value.asset.resourceHash,
				missingResource,
				damaged,
				before,
				denied,
				afterDenied,
				repaired,
				current: await value.repo.loadProject(projectId),
				resource: Array.from(
					(await value.repo.resources.read(value.asset.resourceHash)) ?? [],
				),
			};
		} finally {
			await value.store.close();
		}
	},
	async publicationResourceCas(
		field: "version" | "roots" | "durable" | "creationLeaseId",
	) {
		const value = await fixture();
		try {
			await value.repo.pinStaging.markForPublication(value.lease, {
				projectId,
				revisionId: "r2",
			});
			const fresh = await value.store.reserveId("lease"),
				original = await sole("resources");
			let faultSnapshot: Awaited<ReturnType<typeof snapshot>> | undefined,
				observedDigest: string | undefined;
			value.arm(async (digest) => {
				if (digest !== value.asset.resourceHash)
					throw new Error("Fault did not follow actual resource SHA");
				observedDigest = digest;
				await put("resources", {
					...original,
					[field]:
						field === "roots"
							? [...(original.roots as string[]), fresh]
							: field === "durable"
								? true
								: fresh,
				});
				faultSnapshot = await snapshot();
			});
			const refused = await value.repo.publish(value.next, "r1"),
				after = await snapshot();
			if (!faultSnapshot || !observedDigest)
				throw new Error("Public verification boundary was not reached");
			const currentBeforeRepair = await value.repo.loadProject(projectId);
			await put("resources", original);
			const retried = await value.repo.publish(value.next, "r1");
			return {
				field,
				observedDigest,
				expectedDigest: value.asset.resourceHash,
				faultSnapshot,
				after,
				refused,
				currentBeforeRepair,
				retried,
				current: await value.repo.loadProject(projectId),
				resource: Array.from(
					(await value.repo.resources.read(value.asset.resourceHash)) ?? [],
				),
			};
		} finally {
			await value.store.close();
		}
	},
	async publicationWriterCas(field: "scope" | "ownerId" | "fencingToken") {
		const value = await fixture();
		try {
			await value.repo.pinStaging.markForPublication(value.lease, {
				projectId,
				revisionId: "r2",
			});
			let original: Record<string, unknown> | undefined,
				faultSnapshot: Awaited<ReturnType<typeof snapshot>> | undefined,
				observedDigest: string | undefined;
			value.arm(async (digest) => {
				if (digest !== value.asset.resourceHash)
					throw new Error("Fault did not follow actual resource SHA");
				observedDigest = digest;
				original = await sole("writer-fences");
				await put("writer-fences", {
					...original,
					[field]:
						field === "scope"
							? foreignScope
							: field === "ownerId"
								? "foreign-runtime-owner"
								: Number(original.fencingToken) + 1,
				});
				faultSnapshot = await snapshot();
			});
			const refused = await value.repo.publish(value.next, "r1"),
				after = await snapshot();
			if (!faultSnapshot || !original || !observedDigest)
				throw new Error("Public verification boundary was not reached");
			const notification = value.repo.consumeLostWriterLease(),
				consumed = value.repo.consumeLostWriterLease();
			await put("writer-fences", original);
			const blockedBefore = await snapshot(),
				blocked = await value.repo.publish(value.next, "r1"),
				afterBlocked = await snapshot();
			const replacement = value.repository(),
				recreatedBlockedBefore = await snapshot(),
				recreatedBlocked = await replacement.publish(value.next, "r1"),
				afterRecreatedBlocked = await snapshot();
			const resourceBeforeTakeover = Array.from(
				(await replacement.resources.read(value.asset.resourceHash)) ?? [],
			);
			const takenOver = await replacement.takeOverWriterLease(projectId),
				positive = await replacement.publish(await candidate("r3"), "r1");
			return {
				field,
				observedDigest,
				expectedDigest: value.asset.resourceHash,
				faultSnapshot,
				after,
				refused,
				notification,
				consumed,
				blockedBefore,
				blocked,
				afterBlocked,
				recreatedBlockedBefore,
				recreatedBlocked,
				afterRecreatedBlocked,
				takenOver,
				resourceBeforeTakeover,
				positive,
				current: await replacement.loadProject(projectId),
				resource: Array.from(
					(await replacement.resources.read(value.asset.resourceHash)) ?? [],
				),
			};
		} finally {
			await value.store.close();
		}
	},
};
Object.assign(window, { scopedProtocolEdges: api });
declare global {
	interface Window {
		scopedProtocolEdges: typeof api;
	}
}
