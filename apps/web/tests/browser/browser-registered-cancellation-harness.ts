import { runFactoryTechnicalCleanup } from "../verification/factory-technical-cleanup";
import "./browser-registered-project-harness";
import { createRegisteredRuntimePortablePorts } from "../../src/adapters/portable-backup/registered-runtime-portable";
import {
	browserBinaryChecksum,
	browserChecksum,
	browserClock,
} from "../../src/app/browser-ports";
import { createBrowserRegisteredRuntime } from "../../src/app/browser-registered-runtime";
import type { ReleaseStartupInput } from "../../src/app/release-startup";
import { createInitialProject } from "../../src/domain/initial-project";

const legacyName = "interiors-editor-projects";
const instant = "2026-11-06T00:00:00.000Z";
const startup = (): ReleaseStartupInput => ({
	capabilities: { indexeddb: true, webgl2: true },
	shellManifest: {
		version: 1,
		workerProtocolVersion: 1,
		appBuildId: "native-cancellation-oracle",
		minimumCapabilities: ["indexeddb"],
		projectSchemas: { readable: [1], writable: [1] },
		assetSchemas: { readable: [1], writable: [1] },
		catalogSchemas: { readable: [1], writable: [1] },
	},
	hasControllingWorker: false,
	workerManifest: undefined,
});

function deferred<T>() {
	let resolve: (value: T | PromiseLike<T>) => void = () => {};
	const promise = new Promise<T>((yes) => {
		resolve = yes;
	});
	return { promise, resolve };
}
async function observeCompletion<T>(promise: Promise<T>, milliseconds: number) {
	let timer: ReturnType<typeof setTimeout> | undefined;
	try {
		return await Promise.race([
			promise.then(
				(value) => ({ kind: "fulfilled" as const, value }),
				(reason) => ({ kind: "rejected" as const, reason: String(reason) }),
			),
			new Promise<{ kind: "pending" }>((resolve) => {
				timer = setTimeout(() => resolve({ kind: "pending" }), milliseconds);
			}),
		]);
	} finally {
		if (timer !== undefined) clearTimeout(timer);
	}
}

/** Only real native requests/results/events are delegated. This delays delivery of
 * one actual onsuccess callback; it cannot create Access, transactions or rows. */
function holdActualLegacySuccess() {
	const entered = deferred<{
		readonly name: string;
		readonly version: number;
	}>();
	const closed = deferred<void>();
	let armed = false,
		release: (() => void) | undefined,
		restoreClose = () => {};
	let successEvents = 0,
		closeCalls = 0,
		requests = 0;
	const indexedDb: Pick<IDBFactory, "open"> = {
		open(name: string, version?: number): IDBOpenDBRequest {
			const request =
				version === undefined
					? indexedDB.open(name)
					: indexedDB.open(name, version);
			if (!armed || name !== legacyName || release) return request;
			requests++;
			return new Proxy(request, {
				get(target, key) {
					const value = Reflect.get(target, key, target);
					return typeof value === "function" ? value.bind(target) : value;
				},
				set(target, key, value) {
					if (key !== "onsuccess" || typeof value !== "function")
						return Reflect.set(target, key, value, target);
					target.onsuccess = (event) => {
						successEvents++;
						const database = target.result;
						const descriptor = Object.getOwnPropertyDescriptor(
							database,
							"close",
						);
						const nativeClose = database.close;
						database.close = function () {
							const returned = Reflect.apply(nativeClose, this, []);
							if (this === database) {
								closeCalls++;
								closed.resolve();
							}
							return returned;
						};
						restoreClose = () => {
							if (descriptor)
								Object.defineProperty(database, "close", descriptor);
							else Reflect.deleteProperty(database, "close");
						};
						let delivered = false;
						release = () => {
							if (!delivered) {
								delivered = true;
								Reflect.apply(value, target, [event]);
							}
						};
						entered.resolve({ name: database.name, version: database.version });
					};
					return true;
				},
			});
		},
	};
	return {
		indexedDb,
		entered: entered.promise,
		closed: closed.promise,
		arm() {
			armed = true;
		},
		release() {
			release?.();
		},
		restore() {
			restoreClose();
		},
		snapshot: () => ({ successEvents, closeCalls, requests }),
	};
}

async function archive(name: string, projectId: string) {
	const encoded = await createRegisteredRuntimePortablePorts({
		binaryChecksum: browserBinaryChecksum,
	}).writer.encode({
		project: createInitialProject({
			projectId,
			levelId: "native-level",
			name,
			createdAt: instant,
		}),
		createdAt: instant,
		resources: [],
	});
	if (encoded.kind !== "encoded")
		throw new Error("Actual registered archive setup failed");
	return encoded.bytes;
}

function normalize<T extends { name: string; rows: { name: string }[] }>(
	snapshots: T[],
) {
	return snapshots
		.map((row) => ({
			...row,
			rows: [...row.rows].sort((a, b) => a.name.localeCompare(b.name)),
		}))
		.sort((a, b) => a.name.localeCompare(b.name));
}

async function run(mode: "file-abort" | "runtime-dispose") {
	const observed = holdActualLegacySuccess();
	let allocatedIds = 0;
	const runtime = createBrowserRegisteredRuntime({
		context: {
			indexedDb: observed.indexedDb,
			locks: navigator.locks,
			secureContext: isSecureContext,
			crypto,
			sessionStorage,
			readReleaseStartupInput: async () => startup(),
		},
		ports: {
			checksum: browserChecksum,
			binaryChecksum: browserBinaryChecksum,
			clock: browserClock,
			ids: {
				next: () => {
					allocatedIds++;
					return crypto.randomUUID();
				},
			},
			storageEstimate: { estimateStorage: async () => ({}) },
		},
	});
	let pending:
		| ReturnType<typeof runtime.controller.importRegisteredPortableBackup>
		| undefined;
	let disposal: Promise<void> | undefined;
	const legacy = window.__browserRegisteredProjectHarness;
	try {
		const old = await legacy.seedLegacy("Preserved legacy native source");
		const handshake = await runtime.releaseStartup.handshake(startup());
		if (old.result.kind !== "durable" || handshake.kind !== "writable")
			throw new Error("Actual native source setup failed");
		const seeded = await runtime.controller.importRegisteredPortableBackup(
			await archive(
				"Preserved registered native source",
				"11111111-1111-4111-8111-111111111111",
			),
		);
		if (seeded.kind !== "durable")
			throw new Error("Actual registered native setup was not Durable");
		const before = normalize(await legacy.snapshotAll());
		const bytes = await archive(
			"Must not become Durable",
			"22222222-2222-4222-8222-222222222222",
		);
		const cancellation = new AbortController();
		observed.arm();
		pending = runtime.controller.importRegisteredPortableBackup(bytes, {
			signal: cancellation.signal,
		});
		const reached = await Promise.race([
			observed.entered.then((held) => ({ kind: "held" as const, held })),
			pending.then(
				(value) => ({ kind: "completed-before-lookup" as const, value }),
				(reason) => ({
					kind: "rejected-before-lookup" as const,
					reason: String(reason),
				}),
			),
		]);
		if (reached.kind !== "held")
			return { kind: "lookup-not-reached" as const, outcome: reached };
		const held = reached.held;
		const idsAtCancellation = allocatedIds;
		if (mode === "file-abort") cancellation.abort();
		else disposal = runtime.dispose();
		// Native key lookup's unchanged technical deadline is 1500ms. A public
		// completion observed before 1000ms tests cancellation rather than that timer.
		const completionBeforeLookupDeadline = await observeCompletion(
			pending,
			1000,
		);
		let rejectsNewAdmission: boolean | undefined;
		if (mode === "runtime-dispose") {
			try {
				await runtime.readReleaseStartupInput();
				rejectsNewAdmission = false;
			} catch {
				rejectsNewAdmission = true;
			}
		}
		observed.release();
		const completion = await pending;
		await observed.closed;
		const handlesBeforeAnySnapshotOpen = observed.snapshot();
		await (disposal ?? runtime.dispose());
		const after = normalize(await legacy.snapshotAll());
		return {
			kind: "held-lookup" as const,
			held,
			seeded,
			before,
			after,
			completionBeforeLookupDeadline,
			completion,
			rejectsNewAdmission,
			idsAtCancellation,
			idsAfterDrain: allocatedIds,
			handlesBeforeAnySnapshotOpen,
		};
	} finally {
		await runFactoryTechnicalCleanup(async () => {
			observed.release();
			await Promise.allSettled([pending, disposal ?? runtime.dispose()]);
			observed.restore();
		});
	}
}
const api = { run };
declare global {
	interface Window {
		__browserRegisteredCancellationHarness: typeof api;
	}
}
window.__browserRegisteredCancellationHarness = api;
