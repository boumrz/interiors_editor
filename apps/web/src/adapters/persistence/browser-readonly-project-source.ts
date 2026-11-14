import {
	assessBrowserBackupRepresentability,
	sameBrowserBackupValue,
} from "../../application/browser-backup-representability";
import { canonicalProjectSerializer } from "../../application/create-project";
import type { ExportPortableBackupResult } from "../../application/export-portable-backup";
import { ExportPortableBackupUseCase } from "../../application/export-portable-backup";
import { ExportRuntimePortableBackupUseCase } from "../../application/export-runtime-portable-backup";
import type {
	BinaryChecksumPort,
	CancellationSignalPort,
	ChecksumPort,
	PortableBackupArchiveWriterPort,
	PortableBackupEncoderPort,
	PortableBackupSmokeCheckPort,
	ProjectSourceRecoveryPort,
	ProjectStorageNamespace,
	ProjectStorageSourceStatus,
	ProjectSummary,
} from "../../application/ports";
import { sameSha256ResourceHashBits } from "../../domain/resource-hash";
import { withNativeCancellation } from "../portable-backup/native-cancellation";
import {
	type BrowserReadonlyProjectSnapshot,
	type BrowserReadonlyResourceDescriptor,
	readBrowserReadonlyResource,
	readUnverifiedBrowserSnapshot,
	verifyBrowserReadonlySnapshot,
} from "./browser-readonly-project-snapshot";
export interface BrowserReadonlySourceDirectory {
	readonly projects: readonly ProjectSummary[];
	readonly status: ProjectStorageSourceStatus;
	readonly recoveryNeeded?: true;
}
export interface BrowserReadonlyProjectSource {
	readonly storageNamespace: ProjectStorageNamespace;
	readonly signal: AbortSignal;
	readonly sourceRecovery: ProjectSourceRecoveryPort;
	getKnownFailure(): "recovery-required" | undefined;
	readDirectory(): Promise<BrowserReadonlySourceDirectory>;
	exportBackup(
		projectId: string,
		revisionId: string,
		format: "legacy" | "registered",
		signal?: CancellationSignalPort,
	): Promise<
		ExportPortableBackupResult | { readonly kind: "verification-unavailable" }
	>;
	dispose(): Promise<void>;
}
export interface BrowserReadonlyProjectSourceDependencies {
	readonly storageNamespace: ProjectStorageNamespace;
	readonly admitted: () => boolean;
	readonly previousSource?: BrowserReadonlyProjectSource;
	readonly technical: {
		readonly indexedDb: Pick<IDBFactory, "open"> &
			Partial<Pick<IDBFactory, "databases">>;
		readonly secureContext: boolean;
		readonly openTimeoutMs?: number;
	};
	readonly checksum: ChecksumPort;
	readonly binaryChecksum: BinaryChecksumPort;
	readonly portable: {
		readonly legacyEncoder: PortableBackupEncoderPort;
		readonly legacySmoke: PortableBackupSmokeCheckPort;
		readonly registeredWriter: PortableBackupArchiveWriterPort;
		readonly registeredSmoke: PortableBackupSmokeCheckPort;
	};
}

const privateStores = {
	"scope-metadata": "key",
	projects: "projectId",
	revisions: "revisionId",
	staging: "attemptId",
	"writer-fences": "projectId",
	"publication-attempts": "attemptId",
	"pin-staging-leases": "leaseId",
	resources: "resourceHash",
	library: "resourceHash",
} as const;
const legacyStores = {
	projects: "projectId",
	revisions: "revisionId",
	staging: "projectId",
	"writer-leases": "projectId",
	"pin-staging-leases": "leaseId",
} as const;
const resourceStores = {
	resources: "resourceHash",
	library: "resourceHash",
} as const;
type FailureKind = "unavailable" | "recovery-required";
class ReadonlyStorageFault extends Error {
	constructor(
		readonly kind: FailureKind,
		message: string,
	) {
		super(message);
	}
}
interface DatabaseProfile {
	readonly name: string;
	readonly version: number;
	readonly stores: Readonly<Record<string, string>>;
	readonly privateMetadata: boolean;
}
interface ReadonlySnapshot extends BrowserReadonlyProjectSnapshot {
	readonly resourceRows?: readonly unknown[];
}

interface SourceObservationOwner {
	readonly knownExisting: Set<string>;
	observedCounter: bigint;
	readonly loss: AbortController;
}
const sourceOwners = new WeakMap<
	BrowserReadonlyProjectSource,
	{
		readonly namespace: ProjectStorageNamespace;
		readonly factory: BrowserReadonlyProjectSourceDependencies["technical"]["indexedDb"];
		readonly observation: SourceObservationOwner;
	}
>();

/** Host composition controls admission. Construction and disposal never provision or upgrade any database. */
export function createBrowserReadonlyProjectSource(
	dependencies: BrowserReadonlyProjectSourceDependencies,
): BrowserReadonlyProjectSource {
	const { storageNamespace, technical, portable } = dependencies;
	if (
		storageNamespace !== "legacy" &&
		storageNamespace !== "browser-registered"
	)
		throw new Error("Explicit browser source ownership is required");
	if (
		!technical.secureContext ||
		typeof technical.indexedDb.open !== "function" ||
		typeof dependencies.admitted !== "function" ||
		typeof dependencies.checksum.sha256 !== "function" ||
		typeof dependencies.binaryChecksum.sha256Bytes !== "function" ||
		typeof portable.legacyEncoder.encode !== "function" ||
		typeof portable.legacySmoke.verify !== "function" ||
		typeof portable.registeredWriter.encode !== "function" ||
		typeof portable.registeredSmoke.verify !== "function"
	)
		throw new Error("Native readonly snapshot and backup ports are required");
	const timeout = technical.openTimeoutMs ?? 5000;
	if (!Number.isSafeInteger(timeout) || timeout <= 0 || timeout > 60000)
		throw new Error("A bounded readonly open timeout is required");
	const previous =
		dependencies.previousSource === undefined
			? undefined
			: sourceOwners.get(dependencies.previousSource);
	if (
		dependencies.previousSource !== undefined &&
		(!previous ||
			previous.namespace !== storageNamespace ||
			previous.factory !== technical.indexedDb)
	)
		throw new Error(
			"A prior reader must be owned by this namespace and native factory",
		);
	const observation = previous?.observation ?? {
		knownExisting: new Set<string>(),
		observedCounter: 0n,
		loss: new AbortController(),
	};
	const reader = new ReadonlyBrowserReader(
		{ ...dependencies, technical: { ...technical }, portable: { ...portable } },
		timeout,
		observation,
	);
	const source: BrowserReadonlyProjectSource = Object.freeze({
		storageNamespace,
		signal: reader.signal,
		getKnownFailure: () => reader.getKnownFailure(),
		sourceRecovery: Object.freeze({
			listRecoverySources: () => reader.listSources(),
			readRecoverySource: (projectId: string, revisionId: string) =>
				reader.readSource(projectId, revisionId),
		}),
		readDirectory: () => reader.directory(),
		exportBackup: (
			projectId: string,
			revisionId: string,
			format: "legacy" | "registered",
			signal?: CancellationSignalPort,
		) => reader.export(projectId, revisionId, format, signal),
		dispose: () => reader.dispose(),
	});
	sourceOwners.set(source, {
		namespace: storageNamespace,
		factory: technical.indexedDb,
		observation,
	});
	return source;
}
class ReadonlyBrowserReader {
	private readonly cancellation = new AbortController();
	public readonly signal = this.cancellation.signal;
	private readonly profiles: readonly DatabaseProfile[];
	private readonly openNative: IDBFactory["open"];
	private readonly inventory: (() => Promise<IDBDatabaseInfo[]>) | undefined;
	private readonly handles = new Map<string, IDBDatabase>();
	private readonly retiredHandles = new Set<IDBDatabase>();
	private cleanupFailure: { readonly reason: unknown } | undefined;
	private readonly transactions = new Set<IDBTransaction>();
	private tail: Promise<void> = Promise.resolve();
	private disposal: Promise<void> | undefined;
	private readonly onOwnerLoss = () => {
		void this.dispose().catch(() => undefined);
	};
	private readonly abortTransactions = () => {
		for (const transaction of this.transactions) abort(transaction);
	};
	constructor(
		private readonly dependencies: BrowserReadonlyProjectSourceDependencies,
		private readonly timeout: number,
		private readonly owner: SourceObservationOwner,
	) {
		this.profiles =
			dependencies.storageNamespace === "legacy"
				? [
						{
							name: "interiors-editor-projects",
							version: 3,
							stores: legacyStores,
							privateMetadata: false,
						},
						{
							name: "interiors-editor-custom-assets",
							version: 2,
							stores: resourceStores,
							privateMetadata: false,
						},
					]
				: [
						{
							name: "interiors-editor-browser-registered",
							version: 1,
							stores: privateStores,
							privateMetadata: true,
						},
					];
		this.openNative = dependencies.technical.indexedDb.open.bind(
			dependencies.technical.indexedDb,
		);
		this.inventory = dependencies.technical.indexedDb.databases?.bind(
			dependencies.technical.indexedDb,
		);
		this.signal.addEventListener("abort", this.abortTransactions, {
			once: true,
		});
		this.owner.loss.signal.addEventListener("abort", this.onOwnerLoss, {
			once: true,
		});
		if (this.owner.loss.signal.aborted) this.onOwnerLoss();
	}
	public getKnownFailure(): "recovery-required" | undefined {
		return this.owner.loss.signal.aborted ? "recovery-required" : undefined;
	}
	private assertActive(signal?: AbortSignal): void {
		if (this.signal.aborted || signal?.aborted || !this.dependencies.admitted())
			throw new ReadonlyStorageFault(
				"unavailable",
				"Readonly source admission is closed",
			);
	}
	private run<T>(work: () => Promise<T>): Promise<T> {
		try {
			this.assertActive();
		} catch (error) {
			return Promise.reject(error);
		}
		const result = this.tail.then(async () => {
			this.assertActive();
			return work();
		});
		this.tail = result.then(
			() => undefined,
			() => undefined,
		);
		return result;
	}
	public dispose(): Promise<void> {
		if (this.disposal) return this.disposal;
		let finish: () => void = () => undefined,
			fail: (reason: unknown) => void = () => undefined;
		this.disposal = new Promise<void>((resolve, reject) => {
			finish = resolve;
			fail = reject;
		});
		this.cancellation.abort();
		void this.tail.then(() => {
			for (const database of new Set([
				...this.handles.values(),
				...this.retiredHandles,
			]))
				this.closeOwnedHandle(database);
			this.handles.clear();
			this.retiredHandles.clear();
			this.signal.removeEventListener("abort", this.abortTransactions);
			this.owner.loss.signal.removeEventListener("abort", this.onOwnerLoss);
			if (this.cleanupFailure) fail(this.cleanupFailure.reason);
			else finish();
		}, fail);
		return this.disposal;
	}
	private closeOwnedHandle(database: IDBDatabase): void {
		for (const [name, current] of this.handles)
			if (current === database) this.handles.delete(name);
		try {
			database.onversionchange = null;
			database.onclose = null;
			database.close();
			this.retiredHandles.delete(database);
		} catch (reason) {
			this.cleanupFailure ??= { reason };
			this.retiredHandles.add(database);
		}
	}
	private profileFault(
		profile: DatabaseProfile,
		message: string,
	): ReadonlyStorageFault {
		return profile === this.profiles[0]
			? this.lose(message)
			: new ReadonlyStorageFault("unavailable", message);
	}
	private lose(message: string): ReadonlyStorageFault {
		this.owner.loss.abort();
		void this.dispose().catch(() => undefined);
		return new ReadonlyStorageFault("recovery-required", message);
	}
	public async directory(): Promise<BrowserReadonlySourceDirectory> {
		try {
			return await this.run(async () => {
				const profile = this.profiles[0],
					database = await this.database(profile);
				if (!database)
					return {
						projects: [],
						status:
							this.dependencies.storageNamespace === "legacy"
								? { storageNamespace: "legacy", kind: "available" }
								: {
										storageNamespace: "browser-registered",
										kind: "not-provisioned",
										history: "unknown",
									},
					};
				const ids = await this.transaction(database, profile, (transaction) =>
					request(transaction.objectStore("projects").getAllKeys()),
				);
				const projects: ProjectSummary[] = [];
				let recoveryNeeded = false;
				for (const id of ids) {
					if (typeof id !== "string") {
						recoveryNeeded = true;
						continue;
					}
					const rows = await this.snapshot(database, profile, id, false),
						verified = await verifyBrowserReadonlySnapshot(
							rows,
							this.dependencies.checksum,
						);
					this.assertActive();
					if (!verified) {
						recoveryNeeded = true;
						continue;
					}
					projects.push({
						projectId: id,
						revisionId: verified.candidate.revision.revisionId,
						name: verified.candidate.project.name,
						updatedAt: verified.candidate.project.updatedAt,
					});
				}
				projects.sort(
					(a, b) =>
						b.updatedAt.localeCompare(a.updatedAt) ||
						a.projectId.localeCompare(b.projectId),
				);
				return {
					projects,
					status: {
						storageNamespace: this.dependencies.storageNamespace,
						kind: "available",
					},
					...(recoveryNeeded ? { recoveryNeeded: true as const } : {}),
				};
			});
		} catch (error) {
			return {
				projects: [],
				status: {
					storageNamespace: this.dependencies.storageNamespace,
					kind: this.owner.loss.signal.aborted
						? "recovery-required"
						: error instanceof ReadonlyStorageFault
							? error.kind
							: "unavailable",
				},
			};
		}
	}
	public listSources() {
		return this.run(async () => {
			const profile = this.profiles[0],
				database = await this.database(profile);
			if (!database) return [];
			const ids = await this.transaction(database, profile, (transaction) =>
				request(transaction.objectStore("projects").getAllKeys()),
			);
			const sources: {
				kind: "unverified-source";
				projectId: string;
				revisionId: string;
			}[] = [];
			for (const id of ids) {
				if (typeof id !== "string") continue;
				const row = await this.snapshot(database, profile, id, false),
					revisionId = record(row.pointer)
						? row.pointer.currentRevisionId
						: undefined;
				if (typeof revisionId !== "string") continue;
				const source = readUnverifiedBrowserSnapshot(row, revisionId);
				if (source)
					sources.push({
						kind: source.kind,
						projectId: source.projectId,
						revisionId: source.revisionId,
					});
			}
			this.assertActive();
			return sources;
		});
	}
	public readSource(projectId: string, revisionId: string) {
		return this.run(async () => {
			const profile = this.profiles[0],
				database = await this.database(profile);
			if (!database) return undefined;
			const source = readUnverifiedBrowserSnapshot(
				await this.snapshot(database, profile, projectId, false),
				revisionId,
			);
			this.assertActive();
			return source;
		});
	}
	public async export(
		projectId: string,
		revisionId: string,
		format: "legacy" | "registered",
		sourceSignal?: CancellationSignalPort,
	): Promise<
		ExportPortableBackupResult | { readonly kind: "verification-unavailable" }
	> {
		if (sourceSignal?.aborted || this.signal.aborted) return cancelled();
		if (format !== "legacy" && format !== "registered") return unavailable();
		try {
			const result = await withNativeCancellation(sourceSignal, (incoming) => {
				const native = incoming ?? this.signal;
				return this.run(async () => {
					this.assertActive(native);
					const profile = this.profiles[0],
						database = await this.database(profile, native);
					if (!database) return unavailable();
					// Private rows and immutable Blobs share one native readonly TX; legacy resources live in their original second DB.
					const snapshot = await this.snapshot(
						database,
						profile,
						projectId,
						true,
						native,
					);
					if (
						!record(snapshot.pointer) ||
						snapshot.pointer.currentRevisionId !== revisionId
					)
						return unavailable();
					const verified = await verifyBrowserReadonlySnapshot(
						snapshot,
						this.dependencies.checksum,
					);
					this.assertActive(native);
					if (!verified) return unavailable();
					const rows =
						this.dependencies.storageNamespace === "legacy"
							? await this.legacyResources(verified.resourceManifest, native)
							: snapshot.resourceRows;
					if (!rows || rows.length !== verified.resourceManifest.length)
						return unavailable();
					const resources = [];
					for (
						let index = 0;
						index < verified.resourceManifest.length;
						index++
					) {
						const descriptor = verified.resourceManifest[index],
							payload = readBrowserReadonlyResource(
								this.dependencies.storageNamespace,
								descriptor,
								rows[index],
							);
						if (!payload) return unavailable();
						const bytes = new Uint8Array(
							payload instanceof Blob
								? await payload.arrayBuffer()
								: payload.slice(0),
						);
						this.assertActive(native);
						if (
							bytes.byteLength !== descriptor.byteLength ||
							!sameSha256ResourceHashBits(
								descriptor.resourceHash,
								await this.dependencies.binaryChecksum.sha256Bytes(bytes),
							)
						)
							return unavailable();
						this.assertActive(native);
						resources.push({ resourceHash: descriptor.resourceHash, bytes });
					}
					const owned = new Map(
						resources.map((resource) => [
							resource.resourceHash,
							resource.bytes,
						]),
					);
					const resourcesPort = {
						read: async (key: string) => owned.get(key)?.slice(),
					};
					let formatted: ExportPortableBackupResult;
					if (format === "legacy") {
						if (
							!(await this.dependencies.portable.legacySmoke.verify(
								verified.candidate.project,
								resources,
							))
						)
							return unavailable();
						this.assertActive(native);
						const representable = await assessBrowserBackupRepresentability(
							verified.candidate.project,
							resources,
							this.dependencies.binaryChecksum,
							native,
						);
						this.assertActive(native);
						if (representable.kind !== "representable") return representable;
						formatted = await new ExportPortableBackupUseCase({
							checksum: this.dependencies.checksum,
							binaryChecksum: this.dependencies.binaryChecksum,
							encoder: this.dependencies.portable.legacyEncoder,
							serializer: canonicalProjectSerializer,
							resources: resourcesPort,
						}).execute(verified.candidate);
					} else
						formatted = await new ExportRuntimePortableBackupUseCase({
							checksum: this.dependencies.checksum,
							resources: resourcesPort,
							smoke: this.dependencies.portable.registeredSmoke,
							writer: this.dependencies.portable.registeredWriter,
						}).execute(verified.candidate, native);
					this.assertActive(native);
					if (formatted.kind !== "ready") return formatted;
					const current = await this.snapshot(
						database,
						profile,
						projectId,
						false,
						native,
					);
					this.assertActive(native);
					// These are owned source proofs only; immutable resource bytes were already copied and independently hashed.
					const { resourceRows: _resourceRows, ...original } = snapshot;
					if (!sameBrowserBackupValue(original, current)) return unavailable();
					return formatted;
				});
			});
			return result.kind === "cancelled" ? cancelled() : result.value;
		} catch {
			return sourceSignal?.aborted || this.signal.aborted
				? cancelled()
				: unavailable();
		}
	}
	private async database(
		profile: DatabaseProfile,
		signal?: AbortSignal,
	): Promise<IDBDatabase | undefined> {
		this.assertActive(signal);
		const cached = this.handles.get(profile.name);
		if (cached) return cached;
		if (this.inventory) {
			const entries = await bounded(
				this.inventory(),
				this.signal,
				signal,
				this.timeout,
			);
			this.assertActive(signal);
			if (!entries.some((row) => row.name === profile.name)) {
				if (
					this.owner.knownExisting.has(profile.name) &&
					profile === this.profiles[0]
				)
					throw this.lose("Known browser readonly database disappeared");
				return undefined;
			}
		}
		return this.open(profile, signal);
	}
	private open(
		profile: DatabaseProfile,
		external?: AbortSignal,
	): Promise<IDBDatabase | undefined> {
		return new Promise((resolve, reject) => {
			let opening: IDBOpenDBRequest;
			try {
				opening = this.openNative(profile.name);
			} catch (error) {
				reject(error);
				return;
			}
			let settled = false,
				validating = false,
				absent = false,
				abandoned = false,
				firstError: unknown;
			const validation = new AbortController();
			const cleanup = () => {
				clearTimeout(timer);
				this.signal.removeEventListener("abort", onAbort);
				external?.removeEventListener("abort", onAbort);
			};
			const fail = (error: unknown) => {
				if (!abandoned) {
					abandoned = true;
					firstError = error;
				}
				validation.abort();
				if (!validating && !settled) {
					settled = true;
					cleanup();
					reject(firstError);
				}
			};
			const onAbort = () =>
				fail(
					new ReadonlyStorageFault(
						"unavailable",
						"Readonly native open was abandoned",
					),
				);
			const timer = setTimeout(
				() =>
					fail(
						new ReadonlyStorageFault(
							"unavailable",
							"Readonly native open timed out",
						),
					),
				this.timeout,
			);
			this.signal.addEventListener("abort", onAbort, { once: true });
			external?.addEventListener("abort", onAbort, { once: true });
			if (this.signal.aborted || external?.aborted) onAbort();
			opening.onblocked = () =>
				fail(
					new ReadonlyStorageFault(
						"unavailable",
						"Readonly native open is blocked",
					),
				);
			opening.onupgradeneeded = (event) => {
				absent =
					event.oldVersion === 0 && !this.owner.knownExisting.has(profile.name);
				opening.transaction?.abort();
			};
			opening.onerror = () => {
				if (settled) return;
				if (absent && !abandoned) {
					settled = true;
					cleanup();
					resolve(undefined);
				} else
					fail(
						opening.error ??
							new ReadonlyStorageFault(
								"unavailable",
								"Readonly native open failed",
							),
					);
			};
			opening.onsuccess = () => {
				const database = opening.result;
				if (
					settled ||
					abandoned ||
					this.signal.aborted ||
					external?.aborted ||
					absent
				) {
					database.close();
					if (!settled)
						fail(
							new ReadonlyStorageFault(
								"unavailable",
								"Abandoned readonly native handle",
							),
						);
					return;
				}
				if (
					database.version !== profile.version ||
					!sameNames(database.objectStoreNames, Object.keys(profile.stores))
				) {
					this.closeOwnedHandle(database);
					fail(
						this.profileFault(profile, "Unsupported browser readonly schema"),
					);
					return;
				}
				this.handles.set(profile.name, database);
				const changed = () => {
					if (profile === this.profiles[0]) this.owner.loss.abort();
					// Legacy resource storage is independent of owned Project/current-Revision rows.
					// Retiring that connection refuses resourceful files without hiding a healthy empty neighbor.
					this.closeOwnedHandle(database);
				};
				database.onversionchange = changed;
				database.onclose = changed;
				validating = true;
				void this.transaction(
					database,
					profile,
					async () => undefined,
					validation.signal,
				).then(
					() => {
						validating = false;
						if (abandoned || this.signal.aborted || external?.aborted) {
							this.closeOwnedHandle(database);
							fail(
								firstError ??
									new ReadonlyStorageFault(
										"unavailable",
										"Readonly validation was abandoned",
									),
							);
							return;
						}
						this.owner.knownExisting.add(profile.name);
						settled = true;
						cleanup();
						resolve(database);
					},
					(error) => {
						validating = false;
						this.closeOwnedHandle(database);
						fail(firstError ?? error);
					},
				);
			};
		});
	}
	private async transaction<T>(
		database: IDBDatabase,
		profile: DatabaseProfile,
		work: (transaction: IDBTransaction) => Promise<T>,
		external?: AbortSignal,
	): Promise<T> {
		this.assertActive(external);
		let transaction: IDBTransaction;
		try {
			transaction = database.transaction(
				Object.keys(profile.stores),
				"readonly",
			);
		} catch {
			throw this.profileFault(
				profile,
				"Browser readonly transaction inventory was lost",
			);
		}
		this.transactions.add(transaction);
		const done = completion(transaction);
		void done.catch(() => undefined);
		const onAbort = () => abort(transaction);
		external?.addEventListener("abort", onAbort, { once: true });
		try {
			for (const [name, key] of Object.entries(profile.stores)) {
				const store = transaction.objectStore(name);
				if (
					store.keyPath !== key ||
					store.autoIncrement ||
					store.indexNames.length !== 0
				)
					throw this.profileFault(
						profile,
						"Unsupported browser readonly store inventory",
					);
			}
			let counter: bigint | undefined;
			if (profile.privateMetadata) {
				const metadata = transaction.objectStore("scope-metadata");
				const [count, identity, storedCounter]: [number, unknown, unknown] =
					await Promise.all([
						request(metadata.count()),
						request(metadata.get("identity")),
						request(metadata.get("counter")),
					]);
				counter =
					count === 2 ? metadataCounter([identity, storedCounter]) : undefined;
				if (counter === undefined || counter < this.owner.observedCounter)
					throw this.lose("Browser readonly identity or counter was lost");
			}
			this.assertActive(external);
			const result = await work(transaction);
			await done;
			this.assertActive(external);
			if (counter !== undefined) {
				if (counter < this.owner.observedCounter)
					throw this.lose("Readonly counter moved backwards");
				this.owner.observedCounter = counter;
			}
			return result;
		} catch (error) {
			abort(transaction);
			await done.catch(() => undefined);
			throw error;
		} finally {
			external?.removeEventListener("abort", onAbort);
			this.transactions.delete(transaction);
		}
	}
	private snapshot(
		database: IDBDatabase,
		profile: DatabaseProfile,
		projectId: string,
		withResources: boolean,
		signal?: AbortSignal,
	): Promise<ReadonlySnapshot> {
		return this.transaction(
			database,
			profile,
			async (transaction) => {
				const pointer: unknown = await request(
					transaction.objectStore("projects").get(projectId),
				);
				const revision: unknown =
					record(pointer) && typeof pointer.currentRevisionId === "string"
						? await request(
								transaction
									.objectStore("revisions")
									.get(pointer.currentRevisionId),
							)
						: undefined;
				const base = {
					storageNamespace: this.dependencies.storageNamespace,
					projectId,
					pointer,
					revision,
				};
				if (!profile.privateMetadata) return base;
				const creation: unknown =
					record(revision) && typeof revision.creationAttemptId === "string"
						? await request(
								transaction
									.objectStore("publication-attempts")
									.get(revision.creationAttemptId),
							)
						: undefined;
				if (!withResources) return { ...base, creation };
				const descriptors = record(revision)
					? boundedManifest(revision.resourceManifest)
					: undefined;
				if (!descriptors) return { ...base, creation };
				const resourceRows: unknown[] = [];
				for (const descriptor of descriptors)
					resourceRows.push(
						await request(
							transaction.objectStore("resources").get(descriptor.resourceHash),
						),
					);
				return { ...base, creation, resourceRows };
			},
			signal,
		);
	}
	private async legacyResources(
		descriptors: readonly BrowserReadonlyResourceDescriptor[],
		signal: AbortSignal,
	): Promise<readonly unknown[] | undefined> {
		if (!descriptors.length) return [];
		const profile = this.profiles[1];
		if (!profile) return undefined;
		const database = await this.database(profile, signal);
		if (!database) return undefined;
		return this.transaction(
			database,
			profile,
			async (transaction) => {
				const rows: unknown[] = [];
				for (const descriptor of descriptors)
					rows.push(
						await request(
							transaction.objectStore("resources").get(descriptor.resourceHash),
						),
					);
				return rows;
			},
			signal,
		);
	}
}
function record(value: unknown): value is Record<string, unknown> {
	return value !== null && typeof value === "object" && !Array.isArray(value);
}
function sameNames(names: DOMStringList, expected: readonly string[]): boolean {
	return [...names].sort().join() === [...expected].sort().join();
}
function metadataCounter(rows: readonly unknown[]): bigint | undefined {
	if (rows.length !== 2) return undefined;
	const identity = rows.find((row) => record(row) && row.key === "identity"),
		counter = rows.find((row) => record(row) && row.key === "counter");
	if (
		!record(identity) ||
		Object.keys(identity).length !== 3 ||
		identity.protocolVersion !== 1 ||
		identity.namespace !== "browser-registered-v1" ||
		!record(counter) ||
		Object.keys(counter).length !== 2 ||
		typeof counter.lastReserved !== "string" ||
		!/^(0|[1-9][0-9]{0,19})$/.test(counter.lastReserved)
	)
		return undefined;
	const value = BigInt(counter.lastReserved);
	return value <= 18_446_744_073_709_551_615n ? value : undefined;
}
function boundedManifest(
	value: unknown,
): readonly BrowserReadonlyResourceDescriptor[] | undefined {
	if (
		!Array.isArray(value) ||
		value.length > 900 ||
		Object.keys(value).length !== value.length
	)
		return undefined;
	const names = Object.keys(value);
	if (!names.every((name, index) => name === String(index))) return undefined;
	let total = 0;
	const rows: BrowserReadonlyResourceDescriptor[] = [];
	for (const row of value) {
		if (
			!record(row) ||
			Object.keys(row).length !== 2 ||
			typeof row.resourceHash !== "string" ||
			!/^[a-fA-F0-9]{64}$/.test(row.resourceHash) ||
			typeof row.byteLength !== "number" ||
			!Number.isSafeInteger(row.byteLength) ||
			row.byteLength <= 0 ||
			row.byteLength > 50 * 1024 * 1024 ||
			row.byteLength > 180 * 1024 * 1024 - total
		)
			return undefined;
		total += row.byteLength;
		rows.push({ resourceHash: row.resourceHash, byteLength: row.byteLength });
	}
	return rows;
}
function request<T>(value: IDBRequest<T>): Promise<T> {
	return new Promise((resolve, reject) => {
		value.onsuccess = () => resolve(value.result);
		value.onerror = () =>
			reject(
				value.error ??
					new ReadonlyStorageFault(
						"unavailable",
						"Readonly native request failed",
					),
			);
	});
}
function abort(transaction: IDBTransaction): void {
	try {
		transaction.abort();
	} catch {
		/* Native final outcome already observed. */
	}
}
function completion(transaction: IDBTransaction): Promise<void> {
	return new Promise((resolve, reject) => {
		let failed = false,
			error: unknown;
		transaction.oncomplete = () => (failed ? reject(error) : resolve());
		transaction.onabort = () =>
			reject(
				error ??
					transaction.error ??
					new ReadonlyStorageFault(
						"unavailable",
						"Readonly native transaction aborted",
					),
			);
		transaction.onerror = () => {
			failed = true;
			error =
				transaction.error ??
				new ReadonlyStorageFault(
					"unavailable",
					"Readonly native request failed",
				);
			abort(transaction);
		};
	});
}
function bounded<T>(
	promise: Promise<T>,
	source: AbortSignal,
	external: AbortSignal | undefined,
	timeout: number,
): Promise<T> {
	return new Promise((resolve, reject) => {
		let settled = false;
		const cleanup = () => {
			clearTimeout(timer);
			source.removeEventListener("abort", onAbort);
			external?.removeEventListener("abort", onAbort);
		};
		const finish = (work: () => void) => {
			if (settled) return;
			settled = true;
			cleanup();
			work();
		};
		const onAbort = () =>
			finish(() =>
				reject(
					new ReadonlyStorageFault(
						"unavailable",
						"Readonly inventory was abandoned",
					),
				),
			);
		const timer = setTimeout(
			() =>
				finish(() =>
					reject(
						new ReadonlyStorageFault(
							"unavailable",
							"Readonly inventory timed out",
						),
					),
				),
			timeout,
		);
		source.addEventListener("abort", onAbort, { once: true });
		external?.addEventListener("abort", onAbort, { once: true });
		if (source.aborted || external?.aborted) onAbort();
		void promise.then(
			(value) => finish(() => resolve(value)),
			(error) => finish(() => reject(error)),
		);
	});
}
function cancelled() {
	return { kind: "rejected", reasonCode: "BACKUP_CANCELLED" } as const;
}
function unavailable() {
	return { kind: "verification-unavailable" } as const;
}
