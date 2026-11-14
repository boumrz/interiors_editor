import type { BrowserEditorInstanceSnapshot } from "./browser-editor-instance";
import { BrowserRegisteredProjectExporter } from "../adapters/portable-backup/browser-registered-project-exporter";
import { DurableProjectRepository } from "../adapters/persistence/durable-project-repository";
import { FencedProjectRepository } from "../adapters/persistence/fenced-project-repository";
import { IndexedDbCustomAssetResourceStore } from "../adapters/persistence/indexeddb-custom-asset-resource-store";
import { IndexedDbPinStagingLeaseJournal } from "../adapters/persistence/indexeddb-pin-staging-lease-journal";
import { IndexedDbVersionedProjectStore } from "../adapters/persistence/indexeddb-versioned-project-store";
import { PinStagingLeaseCoordinator } from "../adapters/persistence/pin-staging-lease-coordinator";
import { PublicationFaultController } from "../adapters/persistence/publication-fault-controller";
import { FflatePortableBackupDecoder } from "../adapters/portable-backup/fflate-portable-backup-decoder";
import { FflatePortableBackupEncoder } from "../adapters/portable-backup/fflate-portable-backup-encoder";
import { PortableBackupReadRenderSmokeCheck } from "../adapters/portable-backup/portable-backup-read-render-smoke";
import { createRegisteredRuntimePortablePorts } from "../adapters/portable-backup/registered-runtime-portable";
import {
	browserBinaryChecksum,
	browserChecksum,
	browserClock,
	browserIds,
	browserStorageEstimate,
	browserWriterOwnerId,
	browserWriterTakeoverRequirements,
} from "./browser-ports";
import type { ProjectController } from "./project-controller";
import { createSharedProjectController } from "./shared-project-controller";
import { ReleaseStartupCoordinator, type ReleaseRecoveryRecord } from "./release-startup";

declare const __INTERIORS_TEST_SEAM__: boolean;

declare global {
	interface Window {
		__interiorsTestControl?: {
			setDelay(milliseconds: number): void;
			setFault(point: "before-pointer" | "before-pointer-quota"): void;
			pausePinStagingMark(): void;
			releasePinStagingMark(): void;
		};
	}
}

export interface ProductionAppRuntime {
	readonly getEditorInstanceSnapshot?: () => BrowserEditorInstanceSnapshot;
	readonly subscribeEditorInstance?: (listener: () => void) => () => void;
	readonly canCreateLegacyProject?: () => boolean;
	readonly getLegacyStartupRecovery?: () => ReleaseRecoveryRecord | undefined;
	readonly getStartupSourcesRevision?: () => number;
	readonly subscribeStartupSources?: (listener: () => void) => () => void;
 readonly controller: ProjectController;
	readonly releaseStartup: Pick<ReleaseStartupCoordinator, "handshake">;
}

export function createProductionRuntime(): ProductionAppRuntime {
	const faults = new PublicationFaultController();
	const store = new IndexedDbVersionedProjectStore(faults);
	const durableRepository = new DurableProjectRepository(
		store,
		browserChecksum.sha256,
	);
	const customAssetResources = new IndexedDbCustomAssetResourceStore();
	const pinStaging = new PinStagingLeaseCoordinator({
		...(__INTERIORS_TEST_SEAM__
			? { afterMarkForPublication: () => faults.afterPinStagingMark() }
			: {}),
		isPublicationPublished: async (publication) => {
			const loaded = await durableRepository.loadProject(publication.projectId);
			return (
				loaded.kind === "durable" &&
				loaded.candidate.revision.revisionId === publication.revisionId
			);
		},
		journal: new IndexedDbPinStagingLeaseJournal(),
		resources: customAssetResources,
	});
	// Each app context owns one facade; the IndexedDB store coordinates its
	// project-scoped fencing token with every other browser/PWA context.
	const repository = new FencedProjectRepository(
		durableRepository,
		store,
		browserWriterOwnerId(),
		browserWriterTakeoverRequirements(),
	);
	if (__INTERIORS_TEST_SEAM__) {
		window.__interiorsTestControl = {
			setDelay: (milliseconds) => faults.setDelay(milliseconds),
			setFault: (point) => faults.setFault(point),
			pausePinStagingMark: () => faults.pausePinStagingMark(),
			releasePinStagingMark: () => faults.releasePinStagingMark(),
		};
	}
	const registeredTransfer = createRegisteredRuntimePortablePorts({
		binaryChecksum: browserBinaryChecksum,
	});
	const { controller, publicationRepository } = createSharedProjectController({
		repository,
		resources: customAssetResources,
		library: customAssetResources,
		pinStaging,
		checksum: browserChecksum,
		binaryChecksum: browserBinaryChecksum,
		clock: browserClock,
		ids: browserIds,
		storageEstimate: browserStorageEstimate,
		portable: {
			registeredTransfer: {
				smoke: registeredTransfer.smoke,
				exporter: new BrowserRegisteredProjectExporter({
					checksum: browserChecksum,
					smoke: registeredTransfer.smoke,
					writer: registeredTransfer.writer,
					readPinnedSnapshot: (definitions) =>
						customAssetResources.readPinnedSnapshot(definitions),
				}),
			},
			encoder: new FflatePortableBackupEncoder(),
			decoder: new FflatePortableBackupDecoder(browserBinaryChecksum),
			smoke: new PortableBackupReadRenderSmokeCheck({
				checksum: browserBinaryChecksum,
			}),
			recoveryDecoder: new FflatePortableBackupDecoder(browserBinaryChecksum),
			recoveryEncoder: new FflatePortableBackupEncoder(),
		},
	});

	return {
		controller,
		releaseStartup: new ReleaseStartupCoordinator(store, {
			reconcileBeforeWrite: () => pinStaging.reconcile(),
			// The current alpha manifest has no legacy schema row: V1/V2 fixtures
			// are explicitly quarantined by the product contract. When a future
			// approved registry supplies a migration, its publication still travels
			// through this repository's compare-and-swap and writer fence.
			publishMigration: async ({ candidate, expectedBaseRevisionId }) => {
				const publication = await publicationRepository.publishNextRevision(
					candidate,
					expectedBaseRevisionId,
				);
				return publication.kind === "durable"
					? publication
					: { kind: "persist-failed" };
			},
		}),
	};
}

/** Legacy construction seam for tests that only need the project controller. */
export function createProductionApp(): ProjectController {
	return createProductionRuntime().controller;
}
