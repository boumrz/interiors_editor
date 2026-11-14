import type {
	CustomAssetResourceStorePort,
	PinStagingLease,
	PinStagingLeasePort,
	PinStagingPublication,
} from "../../application/ports";

export type PinStagingLeaseRecord = PinStagingLease & {
	readonly publication?: PinStagingPublication;
};

/** The Project database owns this journal; resource bytes remain in their own store. */
export interface PinStagingLeaseJournalPort {
	create(lease: PinStagingLease): Promise<void>;
	list(): Promise<readonly PinStagingLeaseRecord[]>;
	markForPublication(
		leaseId: string,
		publication: PinStagingPublication,
	): Promise<void>;
	remove(leaseId: string): Promise<void>;
}

interface PinStagingLeaseCoordinatorDependencies {
	/** Test-only crash checkpoint; production leaves it absent. */
	readonly afterMarkForPublication?: () => Promise<void>;
	readonly isPublicationPublished: (
		publication: PinStagingPublication,
	) => Promise<boolean>;
	readonly journal: PinStagingLeaseJournalPort;
	readonly nextLeaseId?: () => string;
	readonly resources: CustomAssetResourceStorePort;
}

/**
 * Bridges the independently transactional Project and blob stores without
 * pretending they have a cross-store transaction. The journal is written
 * before bytes can be pinned. Startup may finish a proven publication, but
 * cannot infer that an unproven lease has no live owner or retained history.
 */
export class PinStagingLeaseCoordinator implements PinStagingLeasePort {
	public constructor(
		private readonly dependencies: PinStagingLeaseCoordinatorDependencies,
	) {}

	public async begin(resourceHashes: readonly string[]): Promise<PinStagingLease> {
		const uniqueHashes = [...new Set(resourceHashes)];
		if (uniqueHashes.length === 0 || uniqueHashes.length !== resourceHashes.length) {
			throw new Error("A pin-staging lease needs one or more unique resource hashes");
		}
		const lease: PinStagingLease = {
			leaseId: this.nextLeaseId(),
			resourceHashes: uniqueHashes,
		};
		await this.dependencies.journal.create(lease);
		return lease;
	}

	public async markForPublication(
		lease: PinStagingLease,
		publication: PinStagingPublication,
	): Promise<void> {
		await this.dependencies.journal.markForPublication(lease.leaseId, publication);
		await this.dependencies.afterMarkForPublication?.();
	}

	/** A durable pointer already proves the bytes reachable; turn staged roots durable. */
	public async complete(lease: PinStagingLease): Promise<void> {
		for (const resourceHash of lease.resourceHashes) {
			await this.dependencies.resources.releasePinned?.(
				resourceHash,
				lease.leaseId,
			);
		}
		await this.dependencies.journal.remove(lease.leaseId);
	}

	/**
	 * Do not remove a root until every unique byte is deleted. If a second live
	 * lease names a hash, it remains rooted there and this lease can safely end.
	 */
	public async discard(lease: PinStagingLease): Promise<void> {
		const records = await this.dependencies.journal.list();
		const otherRoots = new Set(
			records
				.filter((record) => record.leaseId !== lease.leaseId)
				.flatMap((record) => record.resourceHashes),
		);
		for (const resourceHash of lease.resourceHashes) {
			if (!otherRoots.has(resourceHash)) {
				if (this.dependencies.resources.deletePinnedIfOwned) {
					await this.dependencies.resources.deletePinnedIfOwned(
						resourceHash,
						lease.leaseId,
					);
				} else {
					await this.dependencies.resources.delete(resourceHash);
				}
			}
		}
		await this.dependencies.journal.remove(lease.leaseId);
	}

	/**
 * A matching durable publication may complete its staged root. All other
 * roots remain protected: another context may still be publishing/retrying,
 * or the successful revision may now be superseded but remain in history.
 * Explicit owner cancellation still uses discard; global orphan collection
 * requires an independent proof that every live/durable root is absent.
	 */
	public async reconcile(): Promise<void> {
		const records = await this.dependencies.journal.list();
		for (const record of records) {
			if (
				record.publication !== undefined &&
				(await this.dependencies.isPublicationPublished(record.publication))
			) {
				await this.complete(record);
			}
		}
	}

	private nextLeaseId(): string {
		if (this.dependencies.nextLeaseId) return this.dependencies.nextLeaseId();
		const crypto = (globalThis as typeof globalThis & { readonly crypto?: { randomUUID?(): string } }).crypto;
		const randomUuid = crypto?.randomUUID;
		if (typeof randomUuid === "function") return randomUuid.call(crypto);
		throw new Error("Secure random UUID generation is unavailable for pin staging");
	}
}
