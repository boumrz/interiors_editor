import {
	createBrowserReadonlyProjectSource,
	type BrowserReadonlyProjectSource,
	type BrowserReadonlyProjectSourceDependencies,
} from "../../src/adapters/persistence/browser-readonly-project-source";
import { FflatePortableBackupEncoder } from "../../src/adapters/portable-backup/fflate-portable-backup-encoder";
import { PortableBackupReadRenderSmokeCheck } from "../../src/adapters/portable-backup/portable-backup-read-render-smoke";
import { createRegisteredRuntimePortablePorts } from "../../src/adapters/portable-backup/registered-runtime-portable";
import { createProductionRuntime } from "../../src/app/production-app";
import { createBrowserRegisteredRuntime } from "../../src/app/browser-registered-runtime";
import {
	browserClock,
	browserIds,
	browserChecksum,
	browserBinaryChecksum,
} from "../../src/app/browser-ports";
import type { ProjectController } from "../../src/app/project-controller";
import type { ReleaseStartupInput } from "../../src/app/release-startup";
import type { Project } from "../../src/domain/project";
import { createInitialProject } from "../../src/domain/initial-project";

type Namespace = "legacy" | "browser-registered";
type Observer = {
	readonly technical: BrowserReadonlyProjectSourceDependencies["technical"];
	readonly modes: IDBTransactionMode[];
	readonly opens: readonly { name: string; version: number | undefined }[];
	readonly upgrades: string[];
	restore(): void;
};
interface Helpers {
	snapshot(): Promise<unknown>;
	observe(): Observer;
	project(controller: ProjectController): Project;
}
const earlier = "2026-11-06T01:00:00.000Z",
	later = "2026-11-06T01:00:00.001Z";
const scheduled = globalThis.setTimeout.bind(globalThis),
	unschedule = globalThis.clearTimeout.bind(globalThis);
function held<T>() {
	let resolve: (value: T) => void = () => undefined;
	const promise = new Promise<T>((finish) => {
		resolve = finish;
	});
	return { promise, resolve };
}
async function technicalCleanup(work: () => unknown | Promise<unknown>) {
	let timer: ReturnType<typeof setTimeout> | undefined;
	try {
		await Promise.race([
			Promise.resolve().then(work),
			new Promise<never>((_, reject) => {
				timer = scheduled(() => reject(Error("fixture cleanup pending")), 1000);
			}),
		]);
	} catch (cause) {
		throw new Error(
			"BROWSER_READONLY_PROOF_INVALID_CLEANUP: public-oracle fixture cleanup failed",
			{ cause },
		);
	} finally {
		if (timer !== undefined) unschedule(timer);
	}
}
function writable(): ReleaseStartupInput {
	return {
		capabilities: { indexeddb: true, webgl2: true },
		hasControllingWorker: false,
		workerManifest: undefined,
		shellManifest: {
			version: 1,
			workerProtocolVersion: 1,
			appBuildId: "actual-reader-public-oracles",
			projectSchemas: { readable: [1], writable: [1] },
			assetSchemas: { readable: [1], writable: [1] },
			catalogSchemas: { readable: [1], writable: [1] },
			minimumCapabilities: ["indexeddb", "webgl2"],
		},
	};
}
function strWrongRevision(revisionId: string) {
	return revisionId.concat("-wrong");
}
function state(controller: ProjectController) {
	const s = controller.snapshot();
	if (s.kind !== "saved" || s.project.schemaVersion !== 1)
		throw Error("Actual producer did not expose a saved V1 Project");
	return { project: s.project, revisionId: s.revisionId };
}
function captureHandles() {
	const own = Object.getOwnPropertyDescriptor(indexedDB, "open"),
		open = indexedDB.open.bind(indexedDB),
		handles = new Set<IDBDatabase>();
	Object.defineProperty(indexedDB, "open", {
		configurable: true,
		writable: true,
		value: (name: string, version?: number) => {
			const request = version === undefined ? open(name) : open(name, version);
			request.addEventListener("success", () => handles.add(request.result));
			return request;
		},
	});
	return {
		close() {
			let failure: { cause: unknown } | undefined;
			for (const database of handles)
				try {
					database.close();
				} catch (cause) {
					failure ??= { cause };
				}
			handles.clear();
			if (failure) throw failure.cause;
		},
		restore() {
			if (own) Object.defineProperty(indexedDB, "open", own);
			else Reflect.deleteProperty(indexedDB, "open");
		},
	};
}

/** All durable rows originate from real runtime/controller publication. Clock is the public clock port only. */
async function producer(namespace: Namespace) {
	let time = earlier;
	const clockDescriptor = Object.getOwnPropertyDescriptor(browserClock, "now");
	if (namespace === "legacy") {
		if (!clockDescriptor?.writable)
			throw Error("Fixture requires the writable public browser clock port");
		Object.defineProperty(browserClock, "now", {
			...clockDescriptor,
			value: () => time,
		});
	}
	let captures: ReturnType<typeof captureHandles> | undefined;
	let privateRuntime:
		| ReturnType<typeof createBrowserRegisteredRuntime>
		| undefined;
	async function cleanup() {
		let first: { cause: unknown } | undefined;
		for (const work of [
			() => privateRuntime?.dispose(),
			() => captures?.close(),
			() => captures?.restore(),
			() => {
				if (namespace === "legacy" && clockDescriptor)
					Object.defineProperty(browserClock, "now", clockDescriptor);
			},
		])
			try {
				await work();
			} catch (cause) {
				first ??= { cause };
			}
		if (first) throw first.cause;
	}
	try {
		captures = captureHandles();
		const legacy =
			namespace === "legacy" ? createProductionRuntime() : undefined;
		if (namespace === "browser-registered")
			privateRuntime = createBrowserRegisteredRuntime({
				context: {
					indexedDb: indexedDB,
					locks: navigator.locks,
					secureContext: isSecureContext,
					crypto,
					sessionStorage,
					navigationType: "navigate",
					readReleaseStartupInput: async () => writable(),
				},
				ports: {
					checksum: browserChecksum,
					binaryChecksum: browserBinaryChecksum,
					clock: { now: () => time },
					ids: browserIds,
					storageEstimate: { estimateStorage: async () => ({}) },
				},
			});
		const runtime = legacy ?? privateRuntime;
		if (!runtime) throw Error("Missing actual producer");
		if (
			(await runtime.releaseStartup.handshake(writable())).kind !== "writable"
		)
			throw Error("Actual producer startup refused");
		const controller = runtime.controller;
		await controller.open();
		return {
			controller,
			setTime(value: string) {
				time = value;
			},
			async create(name: string) {
				if (namespace === "legacy") {
					controller.startNewProject();
					if ((await controller.create(name)).kind !== "durable")
						throw Error("Actual legacy publication refused");
				} else {
					const project = createInitialProject({
							projectId: "77777777-7777-4777-8777-777777777777",
							levelId: "public-source-level",
							name,
							createdAt: time,
						}),
						file = await createRegisteredRuntimePortablePorts({
							binaryChecksum: browserBinaryChecksum,
						}).writer.encode({ project, createdAt: time, resources: [] });
					if (
						file.kind !== "encoded" ||
						(await controller.importRegisteredPortableBackup(file.bytes))
							.kind !== "durable"
					)
						throw Error("Actual private publication refused");
				}
				return state(controller);
			},
			async dispose() {
				await cleanup();
			},
		};
	} catch (cause) {
		try {
			await cleanup();
		} catch (cleanupCause) {
			throw new Error(
				"BROWSER_READONLY_PROOF_INVALID_CLEANUP: producer startup cleanup failed",
				{ cause: cleanupCause },
			);
		}
		throw cause;
	}
}
function reader(
	namespace: Namespace,
	observer: Observer,
	writer?: BrowserReadonlyProjectSourceDependencies["portable"]["registeredWriter"],
) {
	const ports = createRegisteredRuntimePortablePorts({
		binaryChecksum: browserBinaryChecksum,
	});
	return createBrowserReadonlyProjectSource({
		storageNamespace: namespace,
		admitted: () => true,
		technical: observer.technical,
		checksum: browserChecksum,
		binaryChecksum: browserBinaryChecksum,
		portable: {
			legacyEncoder: new FflatePortableBackupEncoder(),
			legacySmoke: new PortableBackupReadRenderSmokeCheck({
				checksum: browserBinaryChecksum,
			}),
			registeredWriter: writer ?? ports.writer,
			registeredSmoke: ports.smoke,
		},
	});
}
async function closeFixture(
	source: BrowserReadonlyProjectSource | undefined,
	observer: Observer | undefined,
	produced: Awaited<ReturnType<typeof producer>> | undefined,
) {
	let first: { cause: unknown } | undefined;
	for (const work of [
		() => source?.dispose(),
		() => observer?.restore(),
		() => produced?.dispose(),
	])
		try {
			await technicalCleanup(work);
		} catch (cause) {
			first ??= { cause };
		}
	if (first) throw first.cause;
}
function evidence(observer: Observer) {
	return {
		modes: [...observer.modes],
		opens: [...observer.opens],
		upgrades: [...observer.upgrades],
	};
}

export function createBrowserReadonlyPublicOracles(helpers: Helpers) {
	return {
		async directory(namespace: Namespace) {
			let produced: Awaited<ReturnType<typeof producer>> | undefined,
				observer: Observer | undefined,
				source: BrowserReadonlyProjectSource | undefined;
			try {
				produced = await producer(namespace);
				const rows = [];
				for (const name of ["Same-time A", "Same-time B", "Same-time C"])
					rows.push(await produced.create(name));
				const ids = rows.map((row) => row.project.projectId).sort(),
					newest = ids[2];
				await produced.controller.openProject(newest);
				produced.setTime(later);
				if (
					(await produced.controller.renameProject("Newest public producer"))
						.kind !== "durable"
				)
					throw Error("Actual newest publication refused");
				const before = await helpers.snapshot();
				observer = helpers.observe();
				source = reader(namespace, observer);
				const directory = await source.readDirectory(),
					after = await helpers.snapshot();
				return {
					directory,
					expectedIds: [newest, ...ids.slice(0, 2)],
					earlier,
					later,
					before,
					after,
					...evidence(observer),
				};
			} finally {
				await closeFixture(source, observer, produced);
			}
		},
		async wrongRevision(namespace: Namespace) {
			let produced: Awaited<ReturnType<typeof producer>> | undefined,
				observer: Observer | undefined,
				source: BrowserReadonlyProjectSource | undefined;
			try {
				produced = await producer(namespace);
				const original = await produced.create("Expected Revision source");
				observer = helpers.observe();
				source = reader(namespace, observer);
				const control = await source.exportBackup(
						original.project.projectId,
						original.revisionId,
						"registered",
					),
					before = await helpers.snapshot(),
					result = await source.exportBackup(
						original.project.projectId,
						strWrongRevision(original.revisionId),
						"registered",
					),
					after = await helpers.snapshot();
				return {
					control: { kind: control.kind },
					result,
					before,
					after,
					...evidence(observer),
				};
			} finally {
				await closeFixture(source, observer, produced);
			}
		},
		async exportCas(namespace: Namespace) {
			let produced: Awaited<ReturnType<typeof producer>> | undefined,
				observer: Observer | undefined,
				source: BrowserReadonlyProjectSource | undefined;
			const entered = held<void>(),
				release = held<void>();
			let hold = false;
			let heldFormatterKind: "encoded" | "rejected" | undefined;
			try {
				produced = await producer(namespace);
				const original = await produced.create("Exact R1 source"),
					ports = createRegisteredRuntimePortablePorts({
						binaryChecksum: browserBinaryChecksum,
					});
				observer = helpers.observe();
				source = reader(namespace, observer, {
					encode: async (input, signal) => {
						const actual = await ports.writer.encode(input, signal);
						if (hold) {
							heldFormatterKind = actual.kind;
							entered.resolve();
							await release.promise;
						}
						return actual;
					},
				});
				const control = await source.exportBackup(
					original.project.projectId,
					original.revisionId,
					"registered",
				);
				hold = true;
				const pending = source.exportBackup(
					original.project.projectId,
					original.revisionId,
					"registered",
				);
				void pending.catch(() => undefined);
				let timer: ReturnType<typeof setTimeout> | undefined;
				const phase = await Promise.race([
					entered.promise.then(() => "formatter-held" as const),
					pending.then(
						() => "settled-before-formatter" as const,
						() => "rejected-before-formatter" as const,
					),
					new Promise<"pending-before-formatter">((resolve) => {
						timer = scheduled(() => resolve("pending-before-formatter"), 700);
					}),
				]);
				if (timer !== undefined) unschedule(timer);
				produced.setTime(later);
				const publication =
						phase === "formatter-held"
							? await produced.controller.renameProject("Actual Durable R2")
							: undefined,
					revisionAfter = state(produced.controller).revisionId,
					afterProducer = await helpers.snapshot();
				release.resolve();
				const result = await pending,
					afterReader = await helpers.snapshot();
				return {
					control: { kind: control.kind },
					phase,
					heldFormatterKind,
					produced: publication,
					revisionBefore: original.revisionId,
					revisionAfter,
					result,
					afterProducer,
					afterReader,
					...evidence(observer),
				};
			} finally {
				release.resolve();
				await closeFixture(source, observer, produced);
			}
		},
		async absentNoInventory(namespace: Namespace) {
			let observer: Observer | undefined,
				source: BrowserReadonlyProjectSource | undefined;
			const name =
				namespace === "legacy"
					? "interiors-editor-projects"
					: "interiors-editor-browser-registered";
			try {
				const beforeNames = (await indexedDB.databases()).map(
					(row) => row.name,
				);
				observer = helpers.observe();
				const ports = createRegisteredRuntimePortablePorts({
					binaryChecksum: browserBinaryChecksum,
				});
				source = createBrowserReadonlyProjectSource({
					storageNamespace: namespace,
					admitted: () => true,
					technical: {
						secureContext: isSecureContext,
						indexedDb: { open: observer.technical.indexedDb.open },
					},
					checksum: browserChecksum,
					binaryChecksum: browserBinaryChecksum,
					portable: {
						legacyEncoder: new FflatePortableBackupEncoder(),
						legacySmoke: new PortableBackupReadRenderSmokeCheck({
							checksum: browserBinaryChecksum,
						}),
						registeredWriter: ports.writer,
						registeredSmoke: ports.smoke,
					},
				});
				const directory = await source.readDirectory(),
					afterNames = (await indexedDB.databases()).map((row) => row.name);
				return {
					name,
					beforeNames,
					afterNames,
					directory,
					signalAborted: source.signal.aborted,
					knownFailure: source.getKnownFailure(),
					...evidence(observer),
				};
			} finally {
				await closeFixture(source, observer, undefined);
			}
		},
	};
}
declare global {
	interface Window {
		__browserReadonlyPublicOracles: ReturnType<
			typeof createBrowserReadonlyPublicOracles
		>;
	}
}
