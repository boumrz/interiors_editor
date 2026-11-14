/** Lifecycle event double only. It proves cleanup settlement, never IndexedDB atomicity or stored data acceptance. */
export function readonlyCloseLifecycleDouble(failure: unknown) {
	const keys: Record<string, string> = {
		projects: "projectId",
		revisions: "revisionId",
		staging: "projectId",
		"writer-leases": "projectId",
		"pin-staging-leases": "leaseId",
	};
	let closes = 0,
		held: { enter: () => void; deliver: () => void } | undefined;
	function response<T>(value: T) {
		const operation = {
			result: value,
			onsuccess: null as ((event: Event) => unknown) | null,
			onerror: null as ((event: Event) => unknown) | null,
		};
		queueMicrotask(() => operation.onsuccess?.(new Event("success")));
		return operation;
	}
	const database = {
		name: "interiors-editor-projects",
		version: 3,
		objectStoreNames: Object.keys(keys),
		onversionchange: null,
		onclose: null,
		close() {
			closes++;
			throw failure;
		},
		transaction() {
			let aborted = false;
			const hold = held;
			held = undefined;
			const transaction = {
				oncomplete: null as ((event: Event) => unknown) | null,
				onabort: null as ((event: Event) => unknown) | null,
				onerror: null as ((event: Event) => unknown) | null,
				error: null,
				objectStore(name: string) {
					return {
						keyPath: keys[name],
						autoIncrement: false,
						indexNames: [],
						getAllKeys: () => response([]),
					};
				},
				abort() {
					aborted = true;
					if (!hold) queueMicrotask(deliver);
				},
			};
			const deliver = () => {
				if (aborted) transaction.onabort?.(new Event("abort"));
				else transaction.oncomplete?.(new Event("complete"));
			};
			if (hold) {
				hold.deliver = deliver;
				hold.enter();
			} else queueMicrotask(deliver);
			return transaction;
		},
	};
	const factory: Pick<IDBFactory, "open" | "databases"> = {
		databases: async () => [{ name: database.name, version: database.version }],
		open() {
			// Deliberately partial event double. No Project/resource row or fake transaction durability is supplied.
			return response(database) as unknown as IDBOpenDBRequest;
		},
	};
	return {
		factory,
		closes: () => closes,
		holdNextTerminal() {
			let enter: () => void = () => undefined;
			const entered = new Promise<void>((resolve) => {
				enter = resolve;
			});
			const control = { enter, deliver: () => undefined };
			held = control;
			return { entered, release: () => control.deliver() };
		},
	};
}
export async function boundedSettlement(promise: Promise<void>) {
	let timer: ReturnType<typeof setTimeout> | undefined;
	try {
		return await Promise.race([
			promise.then(
				() => ({ kind: "resolved" as const }),
				(reason) => ({ kind: "rejected" as const, reason }),
			),
			new Promise<{ kind: "pending" }>((resolve) => {
				timer = setTimeout(() => resolve({ kind: "pending" }), 30);
			}),
		]);
	} finally {
		clearTimeout(timer);
	}
}
