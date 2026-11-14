import type {
	PinStagingLease,
	PinStagingPublication,
} from "../../application/ports";
import { openVersionedProjectDatabase } from "./indexeddb-versioned-project-store";
import type {
	PinStagingLeaseJournalPort,
	PinStagingLeaseRecord,
} from "./pin-staging-lease-coordinator";

const STORE_NAME = "pin-staging-leases";

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
 * Durable PinStagingLease records live in the Project database—not the blob
 * database—so a browser restart can decide published versus no-publish before
 * any immutable resource is unrooted.
 */
export class IndexedDbPinStagingLeaseJournal
	implements PinStagingLeaseJournalPort
{
	private database: Promise<IDBDatabase> | undefined;

	public async create(lease: PinStagingLease): Promise<void> {
		const database = await this.open();
		const transaction = database.transaction(STORE_NAME, "readwrite");
		transaction.objectStore(STORE_NAME).put(copyRecord(lease));
		await transactionCompletion(transaction);
	}

	public async list(): Promise<readonly PinStagingLeaseRecord[]> {
		const database = await this.open();
		const transaction = database.transaction(STORE_NAME, "readonly");
		const records = (await requestResult(
			transaction.objectStore(STORE_NAME).getAll(),
		)) as readonly PinStagingLeaseRecord[];
		await transactionCompletion(transaction);
		return records.map(copyRecord);
	}

	public async markForPublication(
		leaseId: string,
		publication: PinStagingPublication,
	): Promise<void> {
		const database = await this.open();
		const transaction = database.transaction(STORE_NAME, "readwrite");
		const store = transaction.objectStore(STORE_NAME);
		const record = (await requestResult(store.get(leaseId))) as
			| PinStagingLeaseRecord
			| undefined;
		if (!record) {
			transaction.abort();
			throw new Error("Pin-staging lease disappeared before publication");
		}
		store.put(copyRecord({ ...record, publication }));
		await transactionCompletion(transaction);
	}

	public async remove(leaseId: string): Promise<void> {
		const database = await this.open();
		const transaction = database.transaction(STORE_NAME, "readwrite");
		transaction.objectStore(STORE_NAME).delete(leaseId);
		await transactionCompletion(transaction);
	}

	private open(): Promise<IDBDatabase> {
		if (this.database) return this.database;
		let opening: Promise<IDBDatabase>;
		opening = openVersionedProjectDatabase(window.indexedDB, () => {
			if (this.database === opening) this.database = undefined;
		});
		this.database = opening;
		void opening.catch(() => {
			if (this.database === opening) this.database = undefined;
		});
		return opening;
	}
}

function copyRecord(record: PinStagingLeaseRecord): PinStagingLeaseRecord {
	return {
		leaseId: record.leaseId,
		resourceHashes: [...record.resourceHashes],
		...(record.publication
			? {
					publication: {
						projectId: record.publication.projectId,
						revisionId: record.publication.revisionId,
					},
				}
			: {}),
	};
}
