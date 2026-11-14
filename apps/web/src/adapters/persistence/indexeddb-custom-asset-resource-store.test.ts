import { describe, expect, it } from '@rstest/core';

import { IndexedDbCustomAssetResourceStore } from './indexeddb-custom-asset-resource-store';

/** These request/open/transaction doubles dispatch every programmed event in
 * microtasks. After the next event turn the public Promise must have settled;
 * an omitted source callback is an identified assertion, not a test timeout. */
async function afterControlledEvents<T>(work: Promise<T>): Promise<T> {
  const observed: { current: { kind: 'pending' } | { kind: 'fulfilled'; value: T } | { kind: 'rejected'; error: unknown } } = { current: { kind: 'pending' } };
  void work.then(value => { observed.current = { kind: 'fulfilled', value }; }, error => { observed.current = { kind: 'rejected', error }; });
  await new Promise<void>(resolve => setTimeout(resolve, 0));
  expect(observed.current.kind).not.toBe('pending');
  if (observed.current.kind === 'rejected') throw observed.current.error;
  if (observed.current.kind !== 'fulfilled') throw new Error('Controlled request events did not settle their public operation');
  return observed.current.value;
}

describe('IndexedDbCustomAssetResourceStore batch recovery', () => {
  it('writes new plain resources and protects an existing shared row before returning already-present', async () => {
    await withSharedIndexedDb(async()=>{
      const first=new IndexedDbCustomAssetResourceStore();
      const second=new IndexedDbCustomAssetResourceStore();
      const shared={resourceHash:'a'.repeat(64),bytes:Uint8Array.of(1,2,3)};
      await expect(first.writeIfAbsentPinned(shared,'owner')).resolves.toEqual({kind:'stored'});
      await expect(second.writeIfAbsent(shared)).resolves.toEqual({kind:'already-present'});
      await first.deletePinnedIfOwned(shared.resourceHash,'owner');
      await expect(second.read(shared.resourceHash)).resolves.toEqual(shared.bytes);
      const unique={resourceHash:'b'.repeat(64),bytes:Uint8Array.of(4,5,6)};
      await expect(second.writeIfAbsent(unique)).resolves.toEqual({kind:'stored'});
      await expect(second.read(unique.resourceHash)).resolves.toEqual(unique.bytes);
    });
  });

  it('lists cards deterministically and never removes a different card when the requested id is absent', async () => {
    await withSharedIndexedDb(async()=>{
      const store=new IndexedDbCustomAssetResourceStore();
      const first={assetDefinitionId:'z-card',byteLength:3,depthMm:1,displayName:'Z Model',format:'glb' as const,heightMm:1,widthMm:1,resourceHash:'b'.repeat(64)};
      const second={...first,assetDefinitionId:'a-card',displayName:'A Model',resourceHash:'a'.repeat(64)};
      await expect(store.register(first,{resourceHash:first.resourceHash,bytes:Uint8Array.of(1,2,3)})).resolves.toEqual({kind:'registered',asset:first});
      await expect(store.register(second,{resourceHash:second.resourceHash,bytes:Uint8Array.of(4,5,6)})).resolves.toEqual({kind:'registered',asset:second});
      await expect(store.remove('missing')).resolves.toEqual({kind:'not-found'});
      await expect(store.list()).resolves.toEqual([second,first]);
      await store.remove(first.assetDefinitionId);
      await store.remove(second.assetDefinitionId);
      await expect(store.listRemovedResourceHashes()).resolves.toEqual([second.resourceHash,first.resourceHash]);
      await expect(store.register(first,{resourceHash:first.resourceHash,bytes:Uint8Array.of(1,2,3)},{restoreRemoved:true})).resolves.toEqual({kind:'registered',asset:first});
      await expect(store.register(first,{resourceHash:first.resourceHash,bytes:Uint8Array.of(1,2,3)})).resolves.toEqual({kind:'already-present',asset:first});
    });
  });
  it('removes only a custom catalog card, persists its tombstone across reopen, and restores it only on explicit reimport', async () => {
    await withSharedIndexedDb(async () => {
      const store = new IndexedDbCustomAssetResourceStore();
      const resource = {resourceHash:'a'.repeat(64),bytes:Uint8Array.of(1,2,3)};
      const asset = {assetDefinitionId:'custom-model',byteLength:3,depthMm:100,displayName:'Model',format:'glb' as const,heightMm:100,resourceHash:resource.resourceHash,widthMm:100};
      await store.register(asset,resource);
      await expect(store.remove(asset.assetDefinitionId)).resolves.toEqual({kind:'removed'});
      await expect(store.list()).resolves.toEqual([]);
      await expect(store.read(resource.resourceHash)).resolves.toEqual(resource.bytes);
      const reopened = new IndexedDbCustomAssetResourceStore();
      await expect(reopened.register({...asset,displayName:'Automatic reopen'},resource)).resolves.toMatchObject({kind:'suppressed'});
      await expect(reopened.list()).resolves.toEqual([]);
      await expect(reopened.listRemovedResourceHashes()).resolves.toEqual([resource.resourceHash]);
      await expect(reopened.remove(asset.assetDefinitionId)).resolves.toEqual({kind:'not-found'});
      await reopened.register({...asset,displayName:'Explicit import'},resource,{restoreRemoved:true});
      await expect(reopened.list()).resolves.toEqual([asset]);
      await expect(reopened.listRemovedResourceHashes()).resolves.toEqual([]);
      await expect(reopened.read(resource.resourceHash)).resolves.toEqual(resource.bytes);
    });
  });
  it('protects shared exact bytes from an earlier staging owner while retaining exclusive owner cancellation', async () => {
    await withSharedIndexedDb(async () => {
      const first = new IndexedDbCustomAssetResourceStore();
      const second = new IndexedDbCustomAssetResourceStore();
      const resource = { resourceHash:'a'.repeat(64), bytes:Uint8Array.of(1,2,3) };
      await first.writeIfAbsentPinned(resource,'writer-a');
      await expect(second.protectExistingResource(resource.resourceHash)).resolves.toBe(true);
      await first.deletePinnedIfOwned(resource.resourceHash,'writer-a');
      await expect(second.read(resource.resourceHash)).resolves.toEqual(resource.bytes);
      await expect(second.protectExistingResource('missing')).resolves.toBe(false);
      const exclusive = {...resource,resourceHash:'b'.repeat(64)};
      await first.writeIfAbsentPinned(exclusive,'exclusive');
      await first.deletePinnedIfOwned(exclusive.resourceHash,'exclusive');
      await expect(first.read(exclusive.resourceHash)).resolves.toBeUndefined();
    });
  });

  it('atomically protects an already-present pinned row before a second writer can rely on it', async () => {
    await withSharedIndexedDb(async () => {
      const first = new IndexedDbCustomAssetResourceStore();
      const second = new IndexedDbCustomAssetResourceStore();
      const resource = {resourceHash:'a'.repeat(64),bytes:Uint8Array.of(1,2,3)};
      await first.writeIfAbsentPinned(resource,'writer-a');
      await expect(second.writeIfAbsentPinned(resource,'writer-b')).resolves.toEqual({kind:'already-present'});
      await second.releasePinned(resource.resourceHash,'writer-b');
      await first.deletePinnedIfOwned(resource.resourceHash,'writer-a');
      await expect(second.read(resource.resourceHash)).resolves.toEqual(resource.bytes);
    });
  });
  it('copies every resource and submits the full replacement set through one read-write transaction', async () => {
    const transactions: { readonly mode: IDBTransactionMode; readonly stores: string | string[] }[] = [];
    const storedRecords: { readonly bytes: ArrayBuffer; readonly resourceHash: string }[] = [];
    const transaction = {
      objectStore: () => ({
        put: (record: { readonly bytes: ArrayBuffer; readonly resourceHash: string }) => {
          storedRecords.push({ bytes: record.bytes.slice(0), resourceHash: record.resourceHash });
          queueMicrotask(() => transaction.oncomplete?.(new Event('complete')));
        }
      }),
      onabort: null as ((event: Event) => unknown) | null,
      oncomplete: null as ((event: Event) => unknown) | null,
      onerror: null as ((event: Event) => unknown) | null
    };
    const database = {
      transaction: (stores: string | string[], mode: IDBTransactionMode) => {
        transactions.push({ mode, stores });
        return transaction;
      }
    };
    const openRequest = {
      onerror: null as ((event: Event) => unknown) | null,
      onsuccess: null as ((event: Event) => unknown) | null,
      onupgradeneeded: null as ((event: Event) => unknown) | null,
      result: database
    };
    const originalWindow = globalThis.window;
    Object.defineProperty(globalThis, 'window', {
      configurable: true,
      value: {
        indexedDB: {
          open: () => {
            queueMicrotask(() => openRequest.onsuccess?.(new Event('success')));
            return openRequest;
          }
        }
      }
    });

    try {
      const store = new IndexedDbCustomAssetResourceStore();
      const firstBytes = new Uint8Array([0x61, 0x62]);
      const secondBytes = new Uint8Array([0x63, 0x64]);

      await store.writeReplacingBatch([
        { bytes: firstBytes, resourceHash: 'a'.repeat(64) },
        { bytes: secondBytes, resourceHash: 'b'.repeat(64) }
      ]);
      firstBytes.fill(0x00);
      secondBytes.fill(0x00);

      expect(transactions).toEqual([{ mode: 'readwrite', stores: 'resources' }]);
      expect(storedRecords).toEqual([
        { bytes: new Uint8Array([0x61, 0x62]).buffer, resourceHash: 'a'.repeat(64) },
        { bytes: new Uint8Array([0x63, 0x64]).buffer, resourceHash: 'b'.repeat(64) }
      ]);
    } finally {
      Object.defineProperty(globalThis, 'window', {
        configurable: true,
        value: originalWindow
      });
    }
  });
});

async function withSharedIndexedDb(work: () => Promise<void>): Promise<void> {
  const resourceRecords = new Map<string,{readonly resourceHash:string}>();
  const libraryRecords = new Map<string,{readonly resourceHash:string}>();
  const database = { transaction: (stores:string|string[], mode:string) => {
    if (mode !== 'readwrite' && mode !== 'readonly') throw new TypeError('Invalid transaction mode');
    const selected=typeof stores==='string'?[stores]:stores;
    if (!selected.length || selected.some(name=>name!=='resources' && name!=='library')) throw new TypeError('Invalid transaction store');
    const transaction = { oncomplete:null as (()=>void)|null, onerror:null as (()=>void)|null, onabort:null as (()=>void)|null,
      objectStore:(name?:string)=>{const records=name==='library'?libraryRecords:resourceRecords;return {
        get:(hash:string)=>{const request={result:records.get(hash),onsuccess:null as (()=>void)|null,onerror:null as (()=>void)|null};queueMicrotask(()=>{request.onsuccess?.();queueMicrotask(()=>transaction.oncomplete?.());});return request;},
        getAll:()=>{const request={result:[...records.values()],onsuccess:null as (()=>void)|null,onerror:null as (()=>void)|null};queueMicrotask(()=>{request.onsuccess?.();queueMicrotask(()=>transaction.oncomplete?.());});return request;},
        put:(record:{readonly resourceHash:string})=>{records.set(record.resourceHash,record);queueMicrotask(()=>transaction.oncomplete?.());},
        delete:(hash:string)=>{records.delete(hash);queueMicrotask(()=>transaction.oncomplete?.());}
      };} };
    return transaction;
  } };
  const originalWindow = globalThis.window;
  Object.defineProperty(globalThis,'window',{configurable:true,value:{indexedDB:{open:()=>{const request={result:database,onsuccess:null as (()=>void)|null,onerror:null as (()=>void)|null};queueMicrotask(()=>request.onsuccess?.());return request;}}}});
  try { await work(); } finally { Object.defineProperty(globalThis,'window',{configurable:true,value:originalWindow}); }
}

it("reads all exact unleased pin rows through one readonly transaction and owns every returned byte", async () => {
	const records = new Map<
			string,
			{ resourceHash: string; bytes: ArrayBuffer; pinStagingLeaseId?: string }
		>([
			[
				"a".repeat(64),
				{ resourceHash: "a".repeat(64), bytes: Uint8Array.of(1, 2, 3).buffer },
			],
			[
				"A".repeat(64),
				{ resourceHash: "A".repeat(64), bytes: Uint8Array.of(1, 2, 3).buffer },
			],
		]),
		modes: string[] = [];
	let closed = 0;
	const database = {
		version: 2,
		objectStoreNames: { contains: (name: string) => name === "resources" },
		close: () => {
			closed++;
		},
		transaction: (_name: string, mode: string) => {
			modes.push(mode);
			const transaction = {
				oncomplete: null as (() => void) | null,
				onabort: null as (() => void) | null,
				onerror: null as (() => void) | null,
				objectStore: () => ({
					get: (key: string) => {
						const request = {
							result: records.get(key),
							onsuccess: null as (() => void) | null,
							onerror: null as (() => void) | null,
						};
						queueMicrotask(() => {
							request.onsuccess?.();
							queueMicrotask(() => transaction.oncomplete?.());
						});
						return request;
					},
				}),
			};
			return transaction;
		},
	};
	const previous = Object.getOwnPropertyDescriptor(globalThis, "window");
	Object.defineProperty(globalThis, "window", {
		configurable: true,
		value: {
			indexedDB: {
				open: () => {
					const request = {
						result: database,
						onsuccess: null as (() => void) | null,
						onerror: null as (() => void) | null,
						onupgradeneeded: null as (() => void) | null,
					};
					queueMicrotask(() => request.onsuccess?.());
					return request;
				},
			},
		},
	});
	try {
		const store = new IndexedDbCustomAssetResourceStore(),
			definitions = [
				{ resourceHash: "a".repeat(64), byteLength: 3 },
				{ resourceHash: "A".repeat(64), byteLength: 3 },
			],
			snapshot = await afterControlledEvents(store.readPinnedSnapshot(definitions));
		expect(snapshot).toEqual(
			definitions.map((def) => ({
				resourceHash: def.resourceHash,
				bytes: Uint8Array.of(1, 2, 3),
			})),
		);
		expect(modes).toEqual(["readonly"]);
		expect(closed).toBe(1);
		if (!snapshot) throw new Error("Missing snapshot");
		snapshot[0].bytes[0] = 9;
		expect(
			new Uint8Array(records.get("a".repeat(64))?.bytes ?? new ArrayBuffer(0)),
		).toEqual(Uint8Array.of(1, 2, 3));
		records.set("a".repeat(64), {
			resourceHash: "a".repeat(64),
			bytes: Uint8Array.of(1, 2, 3).buffer,
			pinStagingLeaseId: undefined,
		});
		expect(await afterControlledEvents(store.readPinnedSnapshot(definitions))).toEqual(
			definitions.map((def) => ({
				resourceHash: def.resourceHash,
				bytes: Uint8Array.of(1, 2, 3),
			})),
		);
		for (const corrupt of [
			{ resourceHash: "a".repeat(64), bytes: Uint8Array.of(1, 2).buffer },
			{ resourceHash: "foreign", bytes: Uint8Array.of(1, 2, 3).buffer },
			{
				resourceHash: "a".repeat(64),
				bytes: Uint8Array.of(1, 2, 3).buffer,
				pinStagingLeaseId: "active-owner",
			},
		]) {
			records.set("a".repeat(64), corrupt);
			expect(await afterControlledEvents(store.readPinnedSnapshot(definitions))).toBeUndefined();
		}
		records.delete("a".repeat(64));
		expect(await afterControlledEvents(store.readPinnedSnapshot(definitions))).toBeUndefined();
		expect(await afterControlledEvents(store.readPinnedSnapshot([]))).toEqual([]);
	} finally {
		if (previous) Object.defineProperty(globalThis, "window", previous);
		else Reflect.deleteProperty(globalThis, "window");
	}
});

it("observes both a failed resource request and transaction completion without an unhandled rejection", async () => {
	const error = new Error("Read failed"),
		previous = Object.getOwnPropertyDescriptor(globalThis, "window");
	let closed = false;
	const database = {
		version: 2,
		objectStoreNames: { contains: () => true },
		close: () => {
			closed = true;
		},
		transaction: () => {
			const transaction = {
				error,
				oncomplete: null as (() => void) | null,
				onabort: null as (() => void) | null,
				onerror: null as (() => void) | null,
				objectStore: () => ({
					get: () => {
						const request = {
							error,
							onerror: null as (() => void) | null,
							onsuccess: null as (() => void) | null,
						};
						queueMicrotask(() => {
							request.onerror?.();
							transaction.onabort?.();
						});
						return request;
					},
				}),
			};
			return transaction;
		},
	};
	Object.defineProperty(globalThis, "window", {
		configurable: true,
		value: {
			indexedDB: {
				open: () => {
					const request = {
						result: database,
						onsuccess: null as (() => void) | null,
						onerror: null as (() => void) | null,
					};
					queueMicrotask(() => request.onsuccess?.());
					return request;
				},
			},
		},
	});
	try {
		await expect(
			afterControlledEvents(new IndexedDbCustomAssetResourceStore().readPinnedSnapshot([
				{ resourceHash: "a".repeat(64), byteLength: 3 },
			])),
		).rejects.toThrow("Read failed");
		await new Promise<void>((resolve) => setTimeout(resolve, 0));
		expect(closed).toBe(true);
	} finally {
		if (previous) Object.defineProperty(globalThis, "window", previous);
		else Reflect.deleteProperty(globalThis, "window");
	}
});

it("never creates or upgrades missing pin storage and closes any late successful open after refusal", async () => {
	const previous = Object.getOwnPropertyDescriptor(globalThis, "window");
	const lateCallbackErrors: unknown[] = [];
	let aborted = 0,
		closed = 0;
	const request = {
		transaction: {
			abort: () => {
				aborted++;
			},
		},
		result: {
			close: () => {
				closed++;
			},
		},
		onupgradeneeded: null as (() => void) | null,
		onsuccess: null as (() => void) | null,
		onerror: null as (() => void) | null,
	};
	Object.defineProperty(globalThis, "window", {
		configurable: true,
		value: {
			indexedDB: {
				open: (name: string, version?: number) => {
					expect(name).toBe("interiors-editor-custom-assets");
					expect(version).toBeUndefined();
					queueMicrotask(() => {
						request.onupgradeneeded?.();
						queueMicrotask(() => {
						try { request.onsuccess?.(); } catch (error) { lateCallbackErrors.push(error); }
					});
					});
					return request;
				},
			},
		},
	});
	try {
		await expect(
			afterControlledEvents(new IndexedDbCustomAssetResourceStore().readPinnedSnapshot([
				{ resourceHash: "a".repeat(64), byteLength: 3 },
			])),
		).rejects.toThrow("Pinned resource storage unavailable");
		expect(aborted).toBe(1);
		expect(closed).toBe(1);
		expect(lateCallbackErrors).toEqual([]);
	} finally {
		if (previous) Object.defineProperty(globalThis, "window", previous);
		else Reflect.deleteProperty(globalThis, "window");
	}
});

it("bounds untrusted export pin metadata before opening storage, admitting exact capacity boundaries", async () => {
	const previous = Object.getOwnPropertyDescriptor(globalThis, "window");
	let opened = 0;
	Object.defineProperty(globalThis, "window", {
		configurable: true,
		value: {
			indexedDB: {
				open: () => {
					opened++;
					throw new Error("Readonly boundary probe");
				},
			},
		},
	});
	const valid = { resourceHash: "a".repeat(64), byteLength: 3 },
		MiB = 1024 * 1024,
		source = (length: number) =>
			Array.from({ length }, (_, index) => ({
				resourceHash: index.toString(16).padStart(64, "0"),
				byteLength: 3,
			}));
	try {
		for (const definitions of [
			[valid, valid],
			source(101),
			[{ ...valid, resourceHash: `!${valid.resourceHash}` }],
			[{ ...valid, resourceHash: `${valid.resourceHash}!` }],
			[{ ...valid, resourceHash: "é".repeat(64) }],
			...[
				0,
				-1,
				1.5,
				Infinity,
				NaN,
				Number.MAX_SAFE_INTEGER + 1,
				50 * MiB + 1,
			].map((byteLength) => [{ ...valid, byteLength }]),
			[50, 50, 50, 30 + 1 / MiB].map((size, index) => ({
				resourceHash: index.toString(16).padStart(64, "0"),
				byteLength: Math.round(size * MiB),
			})),
		]) {
			opened = 0;
			expect(
				await afterControlledEvents(new IndexedDbCustomAssetResourceStore().readPinnedSnapshot(
					definitions,
				)),
			).toBeUndefined();
			expect(opened).toBe(0);
		}
		for (const definitions of [
			source(100),
			[{ ...valid, byteLength: 50 * MiB }],
			[50, 50, 50, 30].map((size, index) => ({
				resourceHash: index.toString(16).padStart(64, "0"),
				byteLength: size * MiB,
			})),
		]) {
			opened = 0;
			await expect(
				afterControlledEvents(new IndexedDbCustomAssetResourceStore().readPinnedSnapshot(definitions)),
			).rejects.toThrow("Readonly boundary probe");
			expect(opened).toBe(1);
		}
	} finally {
		if (previous) Object.defineProperty(globalThis, "window", previous);
		else Reflect.deleteProperty(globalThis, "window");
	}
});

it("refuses incompatible pin storage and closes a valid late open after a blocked event", async () => {
	const previous = Object.getOwnPropertyDescriptor(globalThis, "window");
	let closed = 0;
	const database = {
			version: 3,
			objectStoreNames: { contains: () => true },
			close: () => {
				closed++;
			},
		},
		request = {
			result: database,
			onblocked: null as (() => void) | null,
			onsuccess: null as (() => void) | null,
			onerror: null as (() => void) | null,
		};
	let blocked = false;
	Object.defineProperty(globalThis, "window", {
		configurable: true,
		value: {
			indexedDB: {
				open: () => {
					queueMicrotask(() => {
						if (blocked) request.onblocked?.();
						request.onsuccess?.();
					});
					return request;
				},
			},
		},
	});
	try {
		await expect(
			afterControlledEvents(new IndexedDbCustomAssetResourceStore().readPinnedSnapshot([
				{ resourceHash: "a".repeat(64), byteLength: 3 },
			])),
		).rejects.toThrow("Pinned resource storage unavailable");
		expect(closed).toBe(1);
		database.version = 2;
		blocked = true;
		await expect(
			afterControlledEvents(new IndexedDbCustomAssetResourceStore().readPinnedSnapshot([
				{ resourceHash: "a".repeat(64), byteLength: 3 },
			])),
		).rejects.toThrow("Pinned resource storage unavailable");
		expect(closed).toBe(2);
	} finally {
		if (previous) Object.defineProperty(globalThis, "window", previous);
		else Reflect.deleteProperty(globalThis, "window");
	}
});
