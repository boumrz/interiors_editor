import {
	WRITER_LEASE_DURATION_MS,
	type DurablePublicationCandidate,
	type WriterLease,
	type WriterLeaseAcquisition,
	type WriterLeaseStorePort,
} from "../../application/ports";
import type {
	StoredCurrent,
	VersionedProjectStore,
} from "./durable-project-repository";
import type { PublicationFaultController } from "./publication-fault-controller";

interface StagingRecord {
	readonly projectId: string;
	readonly revisionId: string;
	readonly candidate: DurablePublicationCandidate;
}

interface RevisionRecord {
	readonly revisionId: string;
	readonly candidate: DurablePublicationCandidate;
}

interface WriterLeaseRecord extends WriterLease {}

export interface ProjectPointerRecord {
	readonly projectId: string;
	readonly name: string;
	readonly currentRevisionId: string;
}

export type CurrentPointerClassification =
	| { readonly kind: "empty" }
	| { readonly kind: "pointer"; readonly pointer: ProjectPointerRecord }
	| { readonly kind: "corrupt" };

/** A one-project alpha database has exactly one durable current pointer. */
export function classifyCurrentPointerRecords(
	pointers: readonly ProjectPointerRecord[],
): CurrentPointerClassification {
	if (pointers.length === 0) {
		return { kind: "empty" };
	}
	if (pointers.length !== 1) {
		return { kind: "corrupt" };
	}
	return { kind: "pointer", pointer: pointers[0] };
}

/** A pointer never authorizes a revision owned by another Project. */
export function matchesCurrentPointer(
	pointer: ProjectPointerRecord,
	candidate: {
		readonly project: { readonly projectId: string };
		readonly revision: {
			readonly projectId: string;
			readonly revisionId: string;
		};
	},
): boolean {
	return (
		pointer.projectId === candidate.project.projectId &&
		pointer.projectId === candidate.revision.projectId &&
		pointer.currentRevisionId === candidate.revision.revisionId
	);
}

const DATABASE_NAME = "interiors-editor-projects";
const DATABASE_VERSION = 3;

function requestResult<T>(request: IDBRequest<T>): Promise<T> {
	return new Promise<T>((resolve, reject) => {
		request.onsuccess = () => resolve(request.result);
		request.onerror = () =>
			reject(request.error ?? new Error("IndexedDB request failed"));
	});
}

function transactionCompletion(transaction: IDBTransaction): Promise<void> {
	return new Promise<void>((resolve, reject) => {
		transaction.oncomplete = () => resolve();
		transaction.onabort = () =>
			reject(transaction.error ?? new Error("IndexedDB transaction aborted"));
		transaction.onerror = () =>
			reject(transaction.error ?? new Error("IndexedDB transaction failed"));
	});
}

/**
 * A blocked upgrade cannot safely be treated as a long-running load. The caller
 * must be able to surface a fault and retry after the other tab closes its
 * stale connection.
 */
export function openVersionedProjectDatabase(
	indexedDb: Pick<IDBFactory, "open">,
	onVersionChange?: () => void,
): Promise<IDBDatabase> {
	return new Promise<IDBDatabase>((resolve, reject) => {
		const request = indexedDb.open(DATABASE_NAME, DATABASE_VERSION);
		request.onupgradeneeded = () => {
			const database = request.result;
			if (!database.objectStoreNames.contains("projects")) {
				database.createObjectStore("projects", { keyPath: "projectId" });
			}
			if (!database.objectStoreNames.contains("revisions")) {
				database.createObjectStore("revisions", { keyPath: "revisionId" });
			}
			if (!database.objectStoreNames.contains("staging")) {
				database.createObjectStore("staging", { keyPath: "projectId" });
			}
			if (!database.objectStoreNames.contains("writer-leases")) {
				database.createObjectStore("writer-leases", { keyPath: "projectId" });
			}
			if (!database.objectStoreNames.contains("pin-staging-leases")) {
				database.createObjectStore("pin-staging-leases", { keyPath: "leaseId" });
			}
		};
		request.onblocked = () =>
			reject(new Error("Project storage upgrade is blocked"));
		request.onsuccess = () => {
			const database = request.result;
			database.onversionchange = () => {
				database.close();
				onVersionChange?.();
			};
			resolve(database);
		};
		request.onerror = () =>
			reject(request.error ?? new Error("Could not open project storage"));
	});
}

export class IndexedDbVersionedProjectStore
	implements VersionedProjectStore, WriterLeaseStorePort
{
	private database: Promise<IDBDatabase> | undefined;

	public constructor(
		private readonly faults: PublicationFaultController,
		private readonly indexedDb: Pick<IDBFactory, "open"> = window.indexedDB,
		private readonly nowEpochMs: () => number = Date.now,
		private readonly writerLeaseDurationMs = WRITER_LEASE_DURATION_MS,
	) {}

	public async writeStaging(
		candidate: DurablePublicationCandidate,
	): Promise<void> {
		await this.faults.beforeStaging();
		const database = await this.open();
		const transaction = database.transaction(
			["staging", "revisions"],
			"readwrite",
		);
		transaction.objectStore("revisions").put({
			candidate,
			revisionId: candidate.revision.revisionId,
		} satisfies RevisionRecord);
		transaction.objectStore("staging").put({
			candidate,
			projectId: candidate.project.projectId,
			revisionId: candidate.revision.revisionId,
		} satisfies StagingRecord);
		await transactionCompletion(transaction);
	}

	public async readStaging(
		projectId: string,
	): Promise<DurablePublicationCandidate | undefined> {
		const database = await this.open();
		const transaction = database.transaction("staging", "readonly");
		const record = (await requestResult(
			transaction.objectStore("staging").get(projectId),
		)) as StagingRecord | undefined;
		await transactionCompletion(transaction);
		return record?.candidate;
	}

	public async readStagingForRecovery(): Promise<
		readonly DurablePublicationCandidate[]
	> {
		const database = await this.open();
		const transaction = database.transaction("staging", "readonly");
		const records = (await requestResult(
			transaction.objectStore("staging").getAll(),
		)) as StagingRecord[];
		await transactionCompletion(transaction);
		return records.map((record) => record.candidate);
	}

	public async publishCurrentPointer(
		candidate: DurablePublicationCandidate,
		lease?: WriterLease,
		expectedBaseRevisionId?: string,
	): Promise<"published" | "stale-base"> {
		this.faults.beforePointer();
		const database = await this.open();
		const transaction = database.transaction(
			["projects", "staging", "writer-leases"],
			"readwrite",
		);
		const staged = (await requestResult(
			transaction.objectStore("staging").get(candidate.project.projectId),
		)) as StagingRecord | undefined;
		if (staged?.revisionId !== candidate.revision.revisionId) {
			transaction.abort();
			throw new Error("Staging revision missing before pointer publication");
		}
		if (lease) {
			const currentLease = (await requestResult(
				transaction.objectStore("writer-leases").get(lease.projectId),
			)) as WriterLeaseRecord | undefined;
			if (
				currentLease?.ownerId !== lease.ownerId ||
				currentLease.fencingToken !== lease.fencingToken ||
				currentLease.expiresAtEpochMs <= this.nowEpochMs()
			) {
				transaction.abort();
				throw new Error(
					"Writer fence is no longer current before pointer publication",
				);
			}
		}
		const currentPointer = (await requestResult(
			transaction.objectStore("projects").get(candidate.project.projectId),
		)) as ProjectPointerRecord | undefined;
		if (
			expectedBaseRevisionId !== undefined &&
			currentPointer?.currentRevisionId !== expectedBaseRevisionId
		) {
			await transactionCompletion(transaction);
			return "stale-base";
		}
		transaction.objectStore("projects").put({
			currentRevisionId: candidate.revision.revisionId,
			name: candidate.project.name,
			projectId: candidate.project.projectId,
		} satisfies ProjectPointerRecord);
		transaction.objectStore("staging").delete(candidate.project.projectId);
		await transactionCompletion(transaction);
		return "published";
	}

	public async readCurrent(): Promise<StoredCurrent> {
		const database = await this.open();
		const transaction = database.transaction(
			["projects", "revisions"],
			"readonly",
		);
		const pointers = (await requestResult(
			transaction.objectStore("projects").getAll(),
		)) as ProjectPointerRecord[];
		const currentPointer = classifyCurrentPointerRecords(pointers);
		if (currentPointer.kind === "empty") {
			await transactionCompletion(transaction);
			return { kind: "empty" };
		}
		if (currentPointer.kind === "corrupt") {
			await transactionCompletion(transaction);
			return { kind: "corrupt" };
		}
		const revision = (await requestResult(
			transaction
				.objectStore("revisions")
				.get(currentPointer.pointer.currentRevisionId),
		)) as RevisionRecord | undefined;
		await transactionCompletion(transaction);
		return revision &&
			matchesCurrentPointer(currentPointer.pointer, revision.candidate)
			? { kind: "candidate", candidate: revision.candidate }
			: { kind: "corrupt" };
	}

	/** Each Project pointer is read independently; a single bad pointer must not poison healthy cards. */
	public async readAllCurrent(): Promise<readonly StoredCurrent[]> {
		const database = await this.open();
		const transaction = database.transaction(
			["projects", "revisions"],
			"readonly",
		);
		const pointers = (await requestResult(
			transaction.objectStore("projects").getAll(),
		)) as ProjectPointerRecord[];
		const currents: StoredCurrent[] = [];
		for (const pointer of pointers) {
			const revision = (await requestResult(
				transaction.objectStore("revisions").get(pointer.currentRevisionId),
			)) as RevisionRecord | undefined;
			currents.push(
				revision && matchesCurrentPointer(pointer, revision.candidate)
					? { kind: "candidate", candidate: revision.candidate }
					: { kind: "corrupt" },
			);
		}
		await transactionCompletion(transaction);
		return currents;
	}

	public async readCurrentForProject(
		projectId: string,
	): Promise<StoredCurrent> {
		const database = await this.open();
		const transaction = database.transaction(
			["projects", "revisions"],
			"readonly",
		);
		const pointer = (await requestResult(
			transaction.objectStore("projects").get(projectId),
		)) as ProjectPointerRecord | undefined;
		if (!pointer) {
			await transactionCompletion(transaction);
			return { kind: "empty" };
		}
		const revision = (await requestResult(
			transaction.objectStore("revisions").get(pointer.currentRevisionId),
		)) as RevisionRecord | undefined;
		await transactionCompletion(transaction);
		return revision && matchesCurrentPointer(pointer, revision.candidate)
			? { kind: "candidate", candidate: revision.candidate }
			: { kind: "corrupt" };
	}

	public async discardStaging(projectId: string): Promise<void> {
		const database = await this.open();
		const transaction = database.transaction(
			["projects", "staging", "revisions"],
			"readwrite",
		);
		const staged = (await requestResult(
			transaction.objectStore("staging").get(projectId),
		)) as StagingRecord | undefined;
		if (staged) {
			transaction.objectStore("staging").delete(projectId);
			const pointer = (await requestResult(
				transaction.objectStore("projects").get(projectId),
			)) as ProjectPointerRecord | undefined;
			if (pointer?.currentRevisionId !== staged.revisionId) {
				transaction.objectStore("revisions").delete(staged.revisionId);
			}
		}
		await transactionCompletion(transaction);
	}

	/**
	 * Removes an explicitly confirmed Project in one metadata
	 * transaction. Resource bytes are not touched: only the later global-root GC
	 * inventory can prove a shared immutable blob unreachable.
	 */
	public async permanentlyDeleteProject(
		projectId: string,
		lease?: WriterLease,
	): Promise<"permanently-deleted" | "not-found"> {
		const database = await this.open();
		const transaction = database.transaction(
			lease
				? ["projects", "revisions", "staging", "writer-leases"]
				: ["projects", "revisions", "staging"],
			"readwrite",
		);
		const projectStore = transaction.objectStore("projects");
		if (lease) {
			const currentLease = (await requestResult(
				transaction.objectStore("writer-leases").get(lease.projectId),
			)) as WriterLeaseRecord | undefined;
			if (
				currentLease?.ownerId !== lease.ownerId ||
				currentLease.fencingToken !== lease.fencingToken ||
				currentLease.expiresAtEpochMs <= this.nowEpochMs()
			) {
				transaction.abort();
				throw new Error(
					"Writer fence is no longer current before permanent Project deletion",
				);
			}
		}
		const pointer = (await requestResult(projectStore.get(projectId))) as
			| ProjectPointerRecord
			| undefined;
		if (!pointer) {
			await transactionCompletion(transaction);
			return "not-found";
		}
		const revisions = (await requestResult(
			transaction.objectStore("revisions").getAll(),
		)) as RevisionRecord[];
		for (const revision of revisions) {
			if (
				revision.candidate.project.projectId === projectId ||
				revision.candidate.revision.projectId === projectId
			) {
				transaction.objectStore("revisions").delete(revision.revisionId);
			}
		}
		projectStore.delete(projectId);
		transaction.objectStore("staging").delete(projectId);
		if (lease) {
			transaction.objectStore("writer-leases").delete(projectId);
		}
		await transactionCompletion(transaction);
		return "permanently-deleted";
	}

	public async acquireWriterLease(
		projectId: string,
		ownerId: string,
	): Promise<WriterLeaseAcquisition> {
		const nowEpochMs = this.nowEpochMs();
		const database = await this.open();
		const transaction = database.transaction("writer-leases", "readwrite");
		const store = transaction.objectStore("writer-leases");
		const current = (await requestResult(store.get(projectId))) as
			| WriterLeaseRecord
			| undefined;
		if (
			current &&
			current.expiresAtEpochMs > nowEpochMs &&
			current.ownerId !== ownerId
		) {
			await transactionCompletion(transaction);
			return { kind: "held-by-another-writer" };
		}
		const lease: WriterLease = {
			expiresAtEpochMs: nowEpochMs + this.writerLeaseDurationMs,
			fencingToken:
				current &&
				current.expiresAtEpochMs > nowEpochMs &&
				current.ownerId === ownerId
					? current.fencingToken
					: (current?.fencingToken ?? 0) + 1,
			ownerId,
			projectId,
		};
		store.put(lease satisfies WriterLeaseRecord);
		await transactionCompletion(transaction);
		return { kind: "acquired", lease };
	}

	public async inspectWriterLease(
		projectId: string,
	): Promise<WriterLease | undefined> {
		const database = await this.open();
		const transaction = database.transaction("writer-leases", "readonly");
		const lease = (await requestResult(
			transaction.objectStore("writer-leases").get(projectId),
		)) as WriterLeaseRecord | undefined;
		await transactionCompletion(transaction);
		return lease;
	}

	public async isWriterLeaseCurrent(lease: WriterLease): Promise<boolean> {
		const current = await this.inspectWriterLease(lease.projectId);
		return (
			current?.ownerId === lease.ownerId &&
			current.fencingToken === lease.fencingToken &&
			current.expiresAtEpochMs > this.nowEpochMs()
		);
	}

	public async takeOverWriterLease(
		projectId: string,
		ownerId: string,
	): Promise<WriterLease> {
		const database = await this.open();
		const transaction = database.transaction("writer-leases", "readwrite");
		const store = transaction.objectStore("writer-leases");
		const current = (await requestResult(store.get(projectId))) as
			| WriterLeaseRecord
			| undefined;
		const lease: WriterLease = {
			expiresAtEpochMs: this.nowEpochMs() + this.writerLeaseDurationMs,
			fencingToken: (current?.fencingToken ?? 0) + 1,
			ownerId,
			projectId,
		};
		store.put(lease satisfies WriterLeaseRecord);
		await transactionCompletion(transaction);
		return lease;
	}

	private open(): Promise<IDBDatabase> {
		if (this.database) return this.database;
		let opening: Promise<IDBDatabase>;
		opening = openVersionedProjectDatabase(this.indexedDb, () => {
			if (this.database === opening) this.database = undefined;
		});
		this.database = opening;
		void opening.catch(() => {
			if (this.database === opening) this.database = undefined;
		});
		return opening;
	}
}
