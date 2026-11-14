import type {
  CustomAssetLibraryPort,
  CustomAssetResource,
  CustomAssetResourceStorePort
} from '../../application/ports';
import type { CustomGlbAssetDefinition } from '../../domain/project';

interface StoredCustomAssetResource {
  readonly bytes: ArrayBuffer;
  readonly pinStagingLeaseId?: string;
  readonly resourceHash: string;
}

interface StoredCustomAssetLibraryEntry {
  readonly asset: CustomGlbAssetDefinition;
  readonly resourceHash: string;
  readonly removed?: true;
}

const DATABASE_NAME = 'interiors-editor-custom-assets';
const DATABASE_VERSION = 2;
const RESOURCE_STORE_NAME = 'resources';
const LIBRARY_STORE_NAME = 'library';

function requestResult<T>(request: IDBRequest<T>): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error('IndexedDB request failed'));
  });
}

function transactionCompletion(transaction: IDBTransaction): Promise<void> {
  return new Promise<void>((resolve, reject) => {
    transaction.oncomplete = () => resolve();
    transaction.onabort = () => reject(transaction.error ?? new Error('IndexedDB transaction aborted'));
    transaction.onerror = () => reject(transaction.error ?? new Error('IndexedDB transaction failed'));
  });
}

/**
 * Immutable GLB bytes and reusable custom-card metadata share a local
 * IndexedDB transaction. Neither is stored inside a Project revision.
 */
export class IndexedDbCustomAssetResourceStore
  implements CustomAssetLibraryPort, CustomAssetResourceStorePort {
  private database: Promise<IDBDatabase> | undefined;

  public async delete(resourceHash: string): Promise<void> {
    const database = await this.open();
    const transaction = database.transaction(RESOURCE_STORE_NAME, 'readwrite');
    transaction.objectStore(RESOURCE_STORE_NAME).delete(resourceHash);
    await transactionCompletion(transaction);
  }

  public async read(resourceHash: string): Promise<Uint8Array | undefined> {
    const database = await this.open();
    const transaction = database.transaction(RESOURCE_STORE_NAME, 'readonly');
    const stored = (await requestResult(
      transaction.objectStore(RESOURCE_STORE_NAME).get(resourceHash)
    )) as StoredCustomAssetResource | undefined;
    await transactionCompletion(transaction);
    return stored ? new Uint8Array(stored.bytes.slice(0)) : undefined;
  }

	/** Read-only, owned export bytes. A pending lease is not a proven durable pin. */
	public async readPinnedSnapshot(
		definitions: readonly Pick<
			CustomGlbAssetDefinition,
			"resourceHash" | "byteLength"
		>[],
	): Promise<readonly CustomAssetResource[] | undefined> {
		const expected = definitions.map((definition) => ({
			resourceHash: definition.resourceHash,
			byteLength: definition.byteLength,
		}));
		if (expected.length === 0) return [];
		if (
			expected.length > 100 ||
			new Set(expected.map((item) => item.resourceHash)).size !==
				expected.length ||
			expected.some(
				(item) =>
					!/^[a-f0-9]{64}$/i.test(item.resourceHash) ||
					!Number.isSafeInteger(item.byteLength) ||
					item.byteLength <= 0 ||
					item.byteLength > 50 * 1024 * 1024,
			) ||
			expected.reduce((sum, item) => sum + item.byteLength, 0) >
				180 * 1024 * 1024
		)
			return undefined;
		const database = await openExistingResourceDatabase();
		try {
			const transaction = database.transaction(RESOURCE_STORE_NAME, "readonly"),
				done = transactionCompletion(transaction);
			const [records] = await Promise.all([
				Promise.all(
					expected.map((definition) =>
						requestResult(
							transaction
								.objectStore(RESOURCE_STORE_NAME)
								.get(definition.resourceHash),
						),
					),
				),
				done,
			]);
			const resources: CustomAssetResource[] = [];
			for (let index = 0; index < expected.length; index++) {
				const record: unknown = records[index],
					definition = expected[index];
				if (
					typeof record !== "object" ||
					record === null ||
					!("resourceHash" in record) ||
					record.resourceHash !== definition.resourceHash ||
					!("bytes" in record) ||
					!(record.bytes instanceof ArrayBuffer) ||
					record.bytes.byteLength !== definition.byteLength ||
					("pinStagingLeaseId" in record &&
						record.pinStagingLeaseId !== undefined)
				)
					return undefined;
				resources.push({
					resourceHash: definition.resourceHash,
					bytes: new Uint8Array(record.bytes.slice(0)),
				});
			}
			return resources;
		} finally {
			database.close();
		}
	}

  public async writeIfAbsent(
    resource: CustomAssetResource
  ): Promise<{ readonly kind: 'already-present' | 'stored' }> {
    const database = await this.open();
    const transaction = database.transaction(RESOURCE_STORE_NAME, 'readwrite');
    const store = transaction.objectStore(RESOURCE_STORE_NAME);
    const existing = (await requestResult(store.get(resource.resourceHash))) as
      | StoredCustomAssetResource
      | undefined;
    if (existing) {
      if (existing.pinStagingLeaseId !== undefined) store.put({ bytes: existing.bytes.slice(0), resourceHash: existing.resourceHash } satisfies StoredCustomAssetResource);
      await transactionCompletion(transaction);
      return { kind: 'already-present' };
    }
    const bytes = resource.bytes.slice();
    store.put({ bytes: bytes.buffer, resourceHash: resource.resourceHash } satisfies StoredCustomAssetResource);
    await transactionCompletion(transaction);
    return { kind: 'stored' };
  }

  /** Records pin-lease ownership atomically with a resource first-write. */
  public async writeIfAbsentPinned(
    resource: CustomAssetResource,
    leaseId: string
  ): Promise<{ readonly kind: 'already-present' | 'stored' }> {
    const database = await this.open();
    const transaction = database.transaction(RESOURCE_STORE_NAME, 'readwrite');
    const store = transaction.objectStore(RESOURCE_STORE_NAME);
    const existing = (await requestResult(store.get(resource.resourceHash))) as
      | StoredCustomAssetResource
      | undefined;
    if (existing) {
      if (existing.pinStagingLeaseId !== undefined) store.put({ bytes: existing.bytes.slice(0), resourceHash: existing.resourceHash } satisfies StoredCustomAssetResource);
      await transactionCompletion(transaction);
      return { kind: 'already-present' };
    }
    const bytes = resource.bytes.slice();
    store.put({
      bytes: bytes.buffer,
      pinStagingLeaseId: leaseId,
      resourceHash: resource.resourceHash
    } satisfies StoredCustomAssetResource);
    await transactionCompletion(transaction);
    return { kind: 'stored' };
  }

  public async deletePinnedIfOwned(resourceHash: string, leaseId: string): Promise<void> {
    const database = await this.open();
    const transaction = database.transaction(RESOURCE_STORE_NAME, 'readwrite');
    const store = transaction.objectStore(RESOURCE_STORE_NAME);
    const stored = (await requestResult(store.get(resourceHash))) as
      | StoredCustomAssetResource
      | undefined;
    if (stored?.pinStagingLeaseId === leaseId) {
      store.delete(resourceHash);
    }
    await transactionCompletion(transaction);
  }

  /** A second verified consumer atomically revokes the first staging writer's exclusive deletion right. */
  public async protectExistingResource(resourceHash: string): Promise<boolean> {
    const database = await this.open();
    const transaction = database.transaction(RESOURCE_STORE_NAME, 'readwrite');
    const store = transaction.objectStore(RESOURCE_STORE_NAME);
    const existing = (await requestResult(store.get(resourceHash))) as StoredCustomAssetResource | undefined;
    if (existing?.pinStagingLeaseId !== undefined) store.put({ bytes: existing.bytes.slice(0), resourceHash: existing.resourceHash } satisfies StoredCustomAssetResource);
    await transactionCompletion(transaction);
    return existing !== undefined;
  }

  public async releasePinned(resourceHash: string, leaseId: string): Promise<void> {
    const database = await this.open();
    const transaction = database.transaction(RESOURCE_STORE_NAME, 'readwrite');
    const store = transaction.objectStore(RESOURCE_STORE_NAME);
    const stored = (await requestResult(store.get(resourceHash))) as
      | StoredCustomAssetResource
      | undefined;
    if (stored?.pinStagingLeaseId === leaseId) {
      store.put({
        bytes: stored.bytes.slice(0),
        resourceHash: stored.resourceHash
      } satisfies StoredCustomAssetResource);
    }
    await transactionCompletion(transaction);
  }

  /** A verified repair may atomically overwrite only the existing hash key. */
  public async writeReplacing(resource: CustomAssetResource): Promise<void> {
    const database = await this.open();
    const transaction = database.transaction(RESOURCE_STORE_NAME, 'readwrite');
    const bytes = resource.bytes.slice();
    transaction.objectStore(RESOURCE_STORE_NAME).put({
      bytes: bytes.buffer,
      resourceHash: resource.resourceHash
    } satisfies StoredCustomAssetResource);
    await transactionCompletion(transaction);
  }

  /** A complete repair set shares one IndexedDB transaction: it either all lands or none does. */
  public async writeReplacingBatch(resources: readonly CustomAssetResource[]): Promise<void> {
    const database = await this.open();
    const transaction = database.transaction(RESOURCE_STORE_NAME, 'readwrite');
    const store = transaction.objectStore(RESOURCE_STORE_NAME);
    for (const resource of resources) {
      const bytes = resource.bytes.slice();
      store.put({
        bytes: bytes.buffer,
        resourceHash: resource.resourceHash
      } satisfies StoredCustomAssetResource);
    }
    await transactionCompletion(transaction);
  }

  public async list(): Promise<readonly CustomGlbAssetDefinition[]> {
    const database = await this.open();
    const transaction = database.transaction(LIBRARY_STORE_NAME, 'readonly');
    const entries = (await requestResult(
      transaction.objectStore(LIBRARY_STORE_NAME).getAll()
    )) as readonly StoredCustomAssetLibraryEntry[];
    await transactionCompletion(transaction);
    return entries
      .filter((entry) => entry.removed !== true)
      .map((entry) => copyDefinition(entry.asset))
      .sort((first, second) => compareLibraryDefinitions(first, second));
  }

  public async register(
    asset: CustomGlbAssetDefinition,
    resource: CustomAssetResource,
    options?: { readonly restoreRemoved?: boolean }
  ): Promise<{
    readonly asset: CustomGlbAssetDefinition;
    readonly kind: 'already-present' | 'registered' | 'suppressed';
  }> {
    const database = await this.open();
    const transaction = database.transaction(
      [RESOURCE_STORE_NAME, LIBRARY_STORE_NAME],
      'readwrite'
    );
    const resourceStore = transaction.objectStore(RESOURCE_STORE_NAME);
    const libraryStore = transaction.objectStore(LIBRARY_STORE_NAME);
    const existing = (await requestResult(
      libraryStore.get(resource.resourceHash)
    )) as StoredCustomAssetLibraryEntry | undefined;
    const bytes = resource.bytes.slice();
    resourceStore.put({
      bytes: bytes.buffer,
      resourceHash: resource.resourceHash
    } satisfies StoredCustomAssetResource);
    if (existing) {
      if (existing.removed && options?.restoreRemoved) {
        libraryStore.put({ asset: copyDefinition(existing.asset), resourceHash: existing.resourceHash } satisfies StoredCustomAssetLibraryEntry);
        await transactionCompletion(transaction);
        return { asset: copyDefinition(existing.asset), kind: 'registered' };
      }
      await transactionCompletion(transaction);
      return { asset: copyDefinition(existing.asset), kind: existing.removed ? 'suppressed' : 'already-present' };
    }
    const storedAsset = copyDefinition(asset);
    libraryStore.put({
      asset: storedAsset,
      resourceHash: resource.resourceHash
    } satisfies StoredCustomAssetLibraryEntry);
    await transactionCompletion(transaction);
    return { asset: copyDefinition(storedAsset), kind: 'registered' };
  }

  /** A durable catalog tombstone never deletes the exact bytes used by Projects or history. */
  public async remove(assetDefinitionId: string): Promise<{ readonly kind: 'removed' | 'not-found' }> {
    const database = await this.open();
    const transaction = database.transaction(LIBRARY_STORE_NAME, 'readwrite');
    const store = transaction.objectStore(LIBRARY_STORE_NAME);
    const entries = (await requestResult(store.getAll())) as readonly StoredCustomAssetLibraryEntry[];
    const entry = entries.find((candidate) => candidate.asset.assetDefinitionId === assetDefinitionId && !candidate.removed);
    if (entry) store.put({ ...entry, removed: true } satisfies StoredCustomAssetLibraryEntry);
    await transactionCompletion(transaction);
    return { kind: entry ? 'removed' : 'not-found' };
  }

  public async listRemovedResourceHashes(): Promise<readonly string[]> {
    const database = await this.open();
    const transaction = database.transaction(LIBRARY_STORE_NAME, 'readonly');
    const entries = (await requestResult(transaction.objectStore(LIBRARY_STORE_NAME).getAll())) as readonly StoredCustomAssetLibraryEntry[];
    await transactionCompletion(transaction);
    return entries.filter((entry) => entry.removed === true).map((entry) => entry.resourceHash).sort();
  }

  private open(): Promise<IDBDatabase> {
    this.database ??= new Promise<IDBDatabase>((resolve, reject) => {
      const request = window.indexedDB.open(DATABASE_NAME, DATABASE_VERSION);
      request.onupgradeneeded = () => {
        const database = request.result;
        if (!database.objectStoreNames.contains(RESOURCE_STORE_NAME)) {
          database.createObjectStore(RESOURCE_STORE_NAME, { keyPath: 'resourceHash' });
        }
        if (!database.objectStoreNames.contains(LIBRARY_STORE_NAME)) {
          database.createObjectStore(LIBRARY_STORE_NAME, { keyPath: 'resourceHash' });
        }
      };
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error ?? new Error('Could not open custom asset storage'));
    });
    return this.database;
  }
}

function copyDefinition(asset: CustomGlbAssetDefinition): CustomGlbAssetDefinition {
  return {
    ...asset,
  };
}

function compareLibraryDefinitions(
  first: CustomGlbAssetDefinition,
  second: CustomGlbAssetDefinition
): number {
  if (first.displayName < second.displayName) return -1;
  if (first.displayName > second.displayName) return 1;
  if (first.resourceHash < second.resourceHash) return -1;
  if (first.resourceHash > second.resourceHash) return 1;
  return 0;
}

/** Opening without a version never upgrades; abort missing-storage creation. */
function openExistingResourceDatabase(): Promise<IDBDatabase> {
	return new Promise((resolve, reject) => {
		const request = window.indexedDB.open(DATABASE_NAME);
		let rejected = false;
		const fail = () => {
			rejected = true;
			reject(new Error("Pinned resource storage unavailable"));
		};
		request.onupgradeneeded = () => {
			request.transaction?.abort();
			fail();
		};
		request.onblocked = fail;
		request.onerror = fail;
		request.onsuccess = () => {
			const database = request.result;
			if (
				rejected ||
				database.version !== DATABASE_VERSION ||
				!database.objectStoreNames.contains(RESOURCE_STORE_NAME)
			) {
				database.close();
				fail();
				return;
			}
			database.onversionchange = () => database.close();
			resolve(database);
		};
	});
}
