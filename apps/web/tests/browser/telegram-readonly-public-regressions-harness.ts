/** New test scope only. Every successful handle/request/transaction is native. */
export async function runCounterTechnicalCleanup(action: () => void): Promise<void> {
	try {
		action();
	} catch (cause) {
		throw new Error("READER_PUBLIC_PROOF_INVALID: counter fixture cleanup", { cause });
	}
}
export function createTelegramReadonlyPublicCounter(input: {
	readonly indexedDb: Pick<IDBFactory, "open">;
	readonly databaseName: () => Promise<string>;
	readonly rename: (value: unknown) => {
		readonly key: "a-counter";
		readonly lastReserved: string;
	};
}) {
	async function existingDatabase(): Promise<IDBDatabase> {
		const name = await input.databaseName();
		return new Promise((resolve, reject) => {
			const request = input.indexedDb.open(name);
			request.onupgradeneeded = () => request.transaction?.abort();
			request.onerror = () => reject(request.error);
			request.onsuccess = () => resolve(request.result);
		});
	}
	return {
		async renameCounterKey() {
			const database = await existingDatabase();
			try {
				await new Promise<void>((resolve, reject) => {
					const transaction = database.transaction("scope-metadata", "readwrite");
					let failed: { cause: unknown } | undefined;
					transaction.oncomplete = () => resolve();
					transaction.onabort = () => reject(failed?.cause ?? transaction.error);
					const metadata = transaction.objectStore("scope-metadata");
					const request = metadata.get("counter");
					request.onsuccess = () => {
						try {
							const renamed = input.rename(request.result);
							metadata.delete("counter");
							metadata.put(renamed);
						} catch (cause) {
							failed = { cause };
							transaction.abort();
						}
					};
				});
				return await new Promise<{ keys: IDBValidKey[]; records: unknown[] }>((resolve, reject) => {
					const transaction = database.transaction("scope-metadata", "readonly");
					const store = transaction.objectStore("scope-metadata");
					const keys = store.getAllKeys(), records = store.getAll();
					transaction.oncomplete = () => resolve({ keys: keys.result, records: records.result });
					transaction.onabort = () => reject(transaction.error);
				});
			} finally {
				await runCounterTechnicalCleanup(() => database.close());
			}
		},
	};
}
declare global {
	interface Window {
		__telegramReadonlyCounterMatrix: ReturnType<typeof createTelegramReadonlyPublicCounter>;
	}
}
