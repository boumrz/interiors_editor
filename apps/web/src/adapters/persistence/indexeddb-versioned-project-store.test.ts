import { describe, expect, it } from "@rstest/core";

import type {
	DurablePublicationCandidate,
	WriterLease,
} from "../../application/ports";
import {
	classifyCurrentPointerRecords,
	IndexedDbVersionedProjectStore,
	matchesCurrentPointer,
	openVersionedProjectDatabase,
	type ProjectPointerRecord,
} from "./indexeddb-versioned-project-store";
import { PublicationFaultController } from "./publication-fault-controller";

function openRequest(database: IDBDatabase): IDBOpenDBRequest {
	return {
		error: null,
		onblocked: null,
		onerror: null,
		onupgradeneeded: null,
		onsuccess: null,
		result: database,
	} as unknown as IDBOpenDBRequest;
}

function emptyProjectDatabase(): IDBDatabase {
	const transaction = {
		error: null,
		objectStore: () => ({
			getAll: () => {
				const request = {
					error: null,
					onerror: null,
					onsuccess: null,
					result: [],
				} as unknown as IDBRequest<unknown[]>;
				queueMicrotask(() => request.onsuccess?.(new Event("success")));
				return request;
			},
		}),
		onabort: null,
		oncomplete: null,
		onerror: null,
	} as unknown as IDBTransaction;
	Object.defineProperty(transaction, "oncomplete", {
		get: () => null,
		set: (handler: ((event: Event) => void) | null) =>
			queueMicrotask(() => handler?.(new Event("complete"))),
	});
	return {
		close: () => undefined,
		objectStoreNames: { contains: () => true },
		transaction: () => transaction,
	} as unknown as IDBDatabase;
}

function successfulRequest<T>(result: T): IDBRequest<T> {
	const request = {
		error: null,
		onerror: null,
		onsuccess: null,
		result,
	} as unknown as IDBRequest<T>;
	queueMicrotask(() => request.onsuccess?.(new Event("success")));
	return request;
}

function mutableProjectDatabase(
	projects: readonly ProjectPointerRecord[],
	revisions: readonly {
		readonly revisionId: string;
		readonly candidate: DurablePublicationCandidate;
	}[],
	transactionLog: {
		stores: readonly string[];
		mode: IDBTransactionMode;
	}[] = [],
	writerLeases: readonly WriterLease[] = [],
): IDBDatabase {
	const projectRecords = new Map(
		projects.map((pointer) => [pointer.projectId, pointer]),
	);
	const revisionRecords = new Map(
		revisions.map((revision) => [revision.revisionId, revision]),
	);
	const writerLeaseRecords = new Map(
		writerLeases.map((lease) => [lease.projectId, lease]),
	);
	const stagingRecords = new Map<string, object>();

	return {
		close: () => undefined,
		objectStoreNames: { contains: () => true },
		transaction: (stores: string | string[], mode: IDBTransactionMode) => {
			const storeNames = typeof stores === "string" ? [stores] : stores;
			const knownStoreNames = new Set([
				"projects",
				"revisions",
				"staging",
				"writer-leases",
			]);
			if (storeNames.some((name) => !knownStoreNames.has(name))) {
				throw new Error(`Unexpected object store: ${storeNames.join(",")}`);
			}
			if (mode !== "readonly" && mode !== "readwrite") {
				throw new Error(`Unexpected transaction mode: ${mode}`);
			}
			transactionLog.push({
				stores: storeNames,
				mode,
			});
			const recordStore = <Record extends object>(
				records: Map<string, Record>,
				keyOf: (record: Record) => string,
			) => ({
				get: (key: string) => successfulRequest(records.get(key)),
				getAll: () => successfulRequest([...records.values()]),
				delete: (key: string) => records.delete(key),
				put: (record: Record) => records.set(keyOf(record), record),
			});
			const transaction = {
				error: null,
				objectStore: (name: string) => {
					if (name === "projects") {
						return recordStore(projectRecords, (pointer) => pointer.projectId);
					}
					if (name === "revisions") {
						return recordStore(
							revisionRecords,
							(revision) => revision.revisionId,
						);
					}
					if (name === "staging") {
						return recordStore(
							stagingRecords,
							(record) => (record as { projectId: string }).projectId,
						);
					}
					if (name === "writer-leases") {
						return recordStore(writerLeaseRecords, (lease) => lease.projectId);
					}
					throw new Error(`Unexpected object store: ${name}`);
				},
				abort: () => undefined,
				onabort: null,
				oncomplete: null,
				onerror: null,
			} as unknown as IDBTransaction;
			Object.defineProperty(transaction, "oncomplete", {
				get: () => null,
				set: (handler: ((event: Event) => void) | null) =>
					queueMicrotask(() => handler?.(new Event("complete"))),
			});
			return transaction;
		},
	} as unknown as IDBDatabase;
}

function openedDatabase(database: IDBDatabase): Pick<IDBFactory, "open"> {
	return {
		open: () => {
			const request = openRequest(database);
			queueMicrotask(() => request.onsuccess?.(new Event("success")));
			return request;
		},
	};
}

const trashedCandidate = {
	project: { projectId: "project-trash" },
	revision: { projectId: "project-trash", revisionId: "revision-trash" },
} as DurablePublicationCandidate;

describe("classifyCurrentPointerRecords", () => {
	it("recognizes an empty store as a first run", () => {
		expect(classifyCurrentPointerRecords([])).toEqual({ kind: "empty" });
	});

	it("returns the only pointer as the durable current pointer", () => {
		const pointer = {
			currentRevisionId: "revision-1",
			name: "Первый план",
			projectId: "project-1",
		};

		expect(classifyCurrentPointerRecords([pointer])).toEqual({
			kind: "pointer",
			pointer,
		});
	});

	it("treats more than one current pointer as corrupt instead of choosing the first record", () => {
		expect(
			classifyCurrentPointerRecords([
				{
					currentRevisionId: "revision-1",
					name: "Первый план",
					projectId: "project-1",
				},
				{
					currentRevisionId: "revision-2",
					name: "Второй план",
					projectId: "project-2",
				},
			]),
		).toEqual({ kind: "corrupt" });
	});
});

describe("matchesCurrentPointer", () => {
	it("fails closed when a pointer resolves to a revision from another project", () => {
		expect(
			matchesCurrentPointer(
				{
					currentRevisionId: "revision-b",
					name: "План A",
					projectId: "project-a",
				},
				{
					project: { projectId: "project-b" },
					revision: { projectId: "project-b", revisionId: "revision-b" },
				},
			),
		).toBe(false);
	});

	it("accepts only a candidate whose canonical project and revision belong to the pointer project", () => {
		expect(
			matchesCurrentPointer(
				{
					currentRevisionId: "revision-a",
					name: "План A",
					projectId: "project-a",
				},
				{
					project: { projectId: "project-a" },
					revision: { projectId: "project-a", revisionId: "revision-a" },
				},
			),
		).toBe(true);
	});
});

describe("IndexedDB opening", () => {
	it("fails explicitly when another context blocks a storage upgrade", async () => {
		const request = openRequest(emptyProjectDatabase());
		const pending = openVersionedProjectDatabase({ open: () => request });

		request.onblocked?.(
			new Event("blocked") as unknown as IDBVersionChangeEvent,
		);

		await expect(pending).rejects.toThrow("Project storage upgrade is blocked");
	});

	it("closes an opened connection when IndexedDB announces a version change", async () => {
		let closeCount = 0;
		const database = {
			close: () => {
				closeCount += 1;
			},
			objectStoreNames: { contains: () => true },
		} as unknown as IDBDatabase;
		const request = openRequest(database);
		const pending = openVersionedProjectDatabase({ open: () => request });

		request.onsuccess?.(new Event("success"));
		await expect(pending).resolves.toBe(database);
		database.onversionchange?.(
			new Event("versionchange") as unknown as IDBVersionChangeEvent,
		);

		expect(closeCount).toBe(1);
	});

	it("clears a failed opening attempt so the next project read can retry", async () => {
		const first = openRequest(emptyProjectDatabase());
		const second = openRequest(emptyProjectDatabase());
		let openCount = 0;
		const store = new IndexedDbVersionedProjectStore(
			new PublicationFaultController(),
			{
				open: () => {
					openCount += 1;
					return openCount === 1 ? first : second;
				},
			},
		);

		const failedRead = store.readCurrent();
		first.onerror?.(new Event("error"));
		await expect(failedRead).rejects.toThrow("Could not open project storage");

		const retriedRead = store.readCurrent();
		second.onsuccess?.(new Event("success"));

		await expect(retriedRead).resolves.toEqual({ kind: "empty" });
		expect(openCount).toBe(2);
	});

	it("opens a new connection after IndexedDB invalidates the current version", async () => {
		const firstDatabase = emptyProjectDatabase();
		const first = openRequest(firstDatabase);
		const second = openRequest(emptyProjectDatabase());
		let openCount = 0;
		const store = new IndexedDbVersionedProjectStore(
			new PublicationFaultController(),
			{
				open: () => {
					openCount += 1;
					return openCount === 1 ? first : second;
				},
			},
		);

		const initialRead = store.readCurrent();
		first.onsuccess?.(new Event("success"));
		await expect(initialRead).resolves.toEqual({ kind: "empty" });
		firstDatabase.onversionchange?.(
			new Event("versionchange") as unknown as IDBVersionChangeEvent,
		);

		const reopenedRead = store.readCurrent();
		expect(openCount).toBe(2);
		second.onsuccess?.(new Event("success"));

		await expect(reopenedRead).resolves.toEqual({ kind: "empty" });
	});
});

describe("IndexedDB direct Project deletion", () => {
	it("keeps a Project readable until an explicit direct-delete request", async () => {
		const transactionLog: {
			stores: readonly string[];
			mode: IDBTransactionMode;
		}[] = [];
		const store = new IndexedDbVersionedProjectStore(
			new PublicationFaultController(),
			openedDatabase(
				mutableProjectDatabase(
					[
						{
							currentRevisionId: "revision-trash",
							name: "Восстановимый план",
							projectId: "project-trash",
						},
					],
					[{ candidate: trashedCandidate, revisionId: "revision-trash" }],
					transactionLog,
				),
			),
		);

		await expect(store.readCurrentForProject("project-trash")).resolves.toEqual(
			{
				kind: "candidate",
				candidate: trashedCandidate,
			},
		);
		await expect(
			store.permanentlyDeleteProject("missing-project"),
		).resolves.toBe("not-found");
		expect(transactionLog).toEqual([
			{ mode: "readonly", stores: ["projects", "revisions"] },
			{ mode: "readwrite", stores: ["projects", "revisions", "staging"] },
		]);
	});

	it("checks the writer lease in the same direct-delete transaction and rejects a stale writer", async () => {
		const validLease: WriterLease = {
			expiresAtEpochMs: Number.MAX_SAFE_INTEGER,
			fencingToken: 4,
			ownerId: "phone-a",
			projectId: "project-trash",
		};
		const validTransactionLog: {
			stores: readonly string[];
			mode: IDBTransactionMode;
		}[] = [];
		const validStore = new IndexedDbVersionedProjectStore(
			new PublicationFaultController(),
			openedDatabase(
				mutableProjectDatabase(
					[
						{
							currentRevisionId: "revision-trash",
							name: "Восстановимый план",
							projectId: "project-trash",
						},
					],
					[{ candidate: trashedCandidate, revisionId: "revision-trash" }],
					validTransactionLog,
					[validLease],
				),
			),
		);

		await expect(
			validStore.permanentlyDeleteProject("project-trash", validLease),
		).resolves.toBe("permanently-deleted");
		expect(validTransactionLog).toEqual([
			{
				mode: "readwrite",
				stores: ["projects", "revisions", "staging", "writer-leases"],
			},
		]);

		const staleLease: WriterLease = {
			...validLease,
			fencingToken: 3,
		};
		const staleStore = new IndexedDbVersionedProjectStore(
			new PublicationFaultController(),
			openedDatabase(
				mutableProjectDatabase(
					[
						{
							currentRevisionId: "revision-trash",
							name: "Неизменённый план",
							projectId: "project-trash",
						},
					],
					[{ candidate: trashedCandidate, revisionId: "revision-trash" }],
					[],
					[validLease],
				),
			),
		);

		await expect(
			staleStore.permanentlyDeleteProject("project-trash", staleLease),
		).rejects.toThrow(
			"Writer fence is no longer current before permanent Project deletion",
		);
		await expect(
			staleStore.readCurrentForProject("project-trash"),
		).resolves.toEqual({
			kind: "candidate",
			candidate: trashedCandidate,
		});

		const legacyPointerStore = new IndexedDbVersionedProjectStore(
			new PublicationFaultController(),
			openedDatabase(
				mutableProjectDatabase(
					[
						{
							currentRevisionId: "revision-trash",
							name: "Оставленный в корзине план",
							projectId: "project-trash",
						},
					],
					[{ candidate: trashedCandidate, revisionId: "revision-trash" }],
					[],
					[validLease],
				),
			),
		);

		await expect(legacyPointerStore.readAllCurrent()).resolves.toEqual([
			{ kind: "candidate", candidate: trashedCandidate },
		]);
	});

	it("atomically replaces only an expired writer lease with the next fencing token", async () => {
		let nowEpochMs = 1_000;
		const store = new IndexedDbVersionedProjectStore(
			new PublicationFaultController(),
			openedDatabase(mutableProjectDatabase([], [])),
			() => nowEpochMs,
			100,
		);

		const first = await store.acquireWriterLease("project-1", "phone-a");
		expect(first).toEqual({
			kind: "acquired",
			lease: {
				expiresAtEpochMs: 1_100,
				fencingToken: 1,
				ownerId: "phone-a",
				projectId: "project-1",
			},
		});

		nowEpochMs = 1_050;
		await expect(
			store.acquireWriterLease("project-1", "phone-a"),
		).resolves.toEqual({
			kind: "acquired",
			lease: {
				expiresAtEpochMs: 1_150,
				fencingToken: 1,
				ownerId: "phone-a",
				projectId: "project-1",
			},
		});
		await expect(
			store.acquireWriterLease("project-1", "phone-b"),
		).resolves.toEqual({ kind: "held-by-another-writer" });

		nowEpochMs = 1_150;
		const second = await store.acquireWriterLease("project-1", "phone-b");
		expect(second).toEqual({
			kind: "acquired",
			lease: {
				expiresAtEpochMs: 1_250,
				fencingToken: 2,
				ownerId: "phone-b",
				projectId: "project-1",
			},
		});
		if (first.kind !== "acquired") {
			throw new Error("Expected the first lease acquisition");
		}
		await expect(store.isWriterLeaseCurrent(first.lease)).resolves.toBe(false);
		if (second.kind !== "acquired") {
			throw new Error("Expected the expired lease replacement");
		}
		await expect(store.isWriterLeaseCurrent(second.lease)).resolves.toBe(true);

		nowEpochMs = 1_175;
		const takeover = await store.takeOverWriterLease("project-1", "phone-c");
		expect(takeover).toEqual({
			expiresAtEpochMs: 1_275,
			fencingToken: 3,
			ownerId: "phone-c",
			projectId: "project-1",
		});
		await expect(store.inspectWriterLease("project-1")).resolves.toEqual(
			takeover,
		);
		await expect(store.isWriterLeaseCurrent(second.lease)).resolves.toBe(false);
		await expect(store.isWriterLeaseCurrent(takeover)).resolves.toBe(true);
		await expect(
			store.isWriterLeaseCurrent({ ...takeover, fencingToken: 2 }),
		).resolves.toBe(false);
		await expect(
			store.isWriterLeaseCurrent({ ...takeover, ownerId: "phone-d" }),
		).resolves.toBe(false);
		nowEpochMs = takeover.expiresAtEpochMs;
		await expect(store.isWriterLeaseCurrent(takeover)).resolves.toBe(false);
		await expect(
			store.acquireWriterLease("project-1", takeover.ownerId),
		).resolves.toMatchObject({
			kind: "acquired",
			lease: { expiresAtEpochMs: 1_375, fencingToken: 4 },
		});
	});

	it("rejects an expired lease inside pointer publication and direct deletion transactions", async () => {
		let nowEpochMs = 1_000;
		const store = new IndexedDbVersionedProjectStore(
			new PublicationFaultController(),
			openedDatabase(mutableProjectDatabase([], [])),
			() => nowEpochMs,
			100,
		);
		const acquired = await store.acquireWriterLease(
			trashedCandidate.project.projectId,
			"phone-a",
		);
		if (acquired.kind !== "acquired") {
			throw new Error("Expected the initial writer lease");
		}
		await store.writeStaging(trashedCandidate);
		await expect(
			store.publishCurrentPointer(trashedCandidate, acquired.lease),
		).resolves.toBe("published");
		await store.writeStaging(trashedCandidate);
		await expect(
			store.publishCurrentPointer(trashedCandidate, {
				...acquired.lease,
				ownerId: "phone-b",
			}),
		).rejects.toThrow(
			"Writer fence is no longer current before pointer publication",
		);
		await store.writeStaging(trashedCandidate);
		await expect(
			store.publishCurrentPointer(trashedCandidate, {
				...acquired.lease,
				fencingToken: acquired.lease.fencingToken + 1,
			}),
		).rejects.toThrow(
			"Writer fence is no longer current before pointer publication",
		);
		await store.writeStaging(trashedCandidate);
		nowEpochMs = acquired.lease.expiresAtEpochMs;

		await expect(
			store.publishCurrentPointer(trashedCandidate, acquired.lease),
		).rejects.toThrow(
			"Writer fence is no longer current before pointer publication",
		);
		await expect(
			store.permanentlyDeleteProject(
				trashedCandidate.project.projectId,
				acquired.lease,
			),
		).rejects.toThrow(
			"Writer fence is no longer current before permanent Project deletion",
		);
	});

	it("permanently deletes every Revision owned by an active Project in its fenced metadata transaction", async () => {
		const validLease: WriterLease = {
			expiresAtEpochMs: Number.MAX_SAFE_INTEGER,
			fencingToken: 4,
			ownerId: "phone-a",
			projectId: "project-trash",
		};
		const earlierRevision = {
			...trashedCandidate,
			revision: {
				...trashedCandidate.revision,
				revisionId: "revision-earlier",
			},
		} as DurablePublicationCandidate;
		const activeCandidate = {
			project: { projectId: "project-active" },
			revision: { projectId: "project-active", revisionId: "revision-active" },
		} as DurablePublicationCandidate;
		const transactionLog: {
			stores: readonly string[];
			mode: IDBTransactionMode;
		}[] = [];
		const store = new IndexedDbVersionedProjectStore(
			new PublicationFaultController(),
			openedDatabase(
				mutableProjectDatabase(
					[
						{
							currentRevisionId: "revision-trash",
							name: "Удаляемый план",
							projectId: "project-trash",
						},
						{
							currentRevisionId: "revision-active",
							name: "Сохраняемый план",
							projectId: "project-active",
						},
					],
					[
						{ candidate: trashedCandidate, revisionId: "revision-trash" },
						{ candidate: earlierRevision, revisionId: "revision-earlier" },
						{ candidate: activeCandidate, revisionId: "revision-active" },
					],
					transactionLog,
					[validLease],
				),
			),
		);

		await expect(
			store.permanentlyDeleteProject("project-trash", validLease),
		).resolves.toBe("permanently-deleted");
		expect(transactionLog).toEqual([
			{
				mode: "readwrite",
				stores: ["projects", "revisions", "staging", "writer-leases"],
			},
		]);
		await expect(store.readCurrentForProject("project-trash")).resolves.toEqual(
			{
				kind: "empty",
			},
		);
		await expect(
			store.readCurrentForProject("project-active"),
		).resolves.toEqual({
			kind: "candidate",
			candidate: activeCandidate,
		});
		await expect(store.isWriterLeaseCurrent(validLease)).resolves.toBe(false);
	});

	it("rejects a stale fence before permanent deletion and leaves the Project untouched", async () => {
		const currentLease: WriterLease = {
			expiresAtEpochMs: Number.MAX_SAFE_INTEGER,
			fencingToken: 4,
			ownerId: "phone-b",
			projectId: "project-trash",
		};
		const staleLease: WriterLease = {
			...currentLease,
			fencingToken: 3,
		};
		const store = new IndexedDbVersionedProjectStore(
			new PublicationFaultController(),
			openedDatabase(
				mutableProjectDatabase(
					[
						{
							currentRevisionId: "revision-trash",
							name: "Оставленный план",
							projectId: "project-trash",
						},
					],
					[{ candidate: trashedCandidate, revisionId: "revision-trash" }],
					[],
					[currentLease],
				),
			),
		);

		await expect(
			store.permanentlyDeleteProject("project-trash", staleLease),
		).rejects.toThrow(
			"Writer fence is no longer current before permanent Project deletion",
		);
		await expect(store.readAllCurrent()).resolves.toEqual([
			{ kind: "candidate", candidate: trashedCandidate },
		]);
	});

	it("makes a legacy lifecycle field inert and still reports a missing revision as corruption", async () => {
		const activeCandidate = {
			project: { projectId: "project-active" },
			revision: { projectId: "project-active", revisionId: "revision-active" },
		} as DurablePublicationCandidate;
		const legacyTrashedPointer = {
			currentRevisionId: "revision-trash",
			lifecycle: "trashed",
			name: "Бывшая корзина",
			projectId: "project-trash",
		} as unknown as ProjectPointerRecord;
		const store = new IndexedDbVersionedProjectStore(
			new PublicationFaultController(),
			openedDatabase(
				mutableProjectDatabase(
					[
						{
							currentRevisionId: "revision-active",
							name: "Активный план",
							projectId: "project-active",
						},
						legacyTrashedPointer,
						{
							currentRevisionId: "revision-missing",
							name: "Повреждён",
							projectId: "project-missing",
						},
					],
					[
						{ candidate: activeCandidate, revisionId: "revision-active" },
						{ candidate: trashedCandidate, revisionId: "revision-trash" },
					],
				),
			),
		);

		await expect(store.readAllCurrent()).resolves.toEqual([
			{ kind: "candidate", candidate: activeCandidate },
			{ kind: "candidate", candidate: trashedCandidate },
			{ kind: "corrupt" },
		]);
	});
});
