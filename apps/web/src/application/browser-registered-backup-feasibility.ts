import {
	assessBackupFeasibility,
	type BackupFeasibilityPolicyPort,
} from "./backup-feasibility-policy";
import { assessBrowserBackupRepresentability } from "./browser-backup-representability";
import type { BinaryChecksumPort, CustomAssetResource } from "./ports";

/** Private namespace only. Ordinary browser and Telegram policies remain their existing owners. */
export function createBrowserRegisteredBackupFeasibility(
	binaryChecksum: BinaryChecksumPort,
): BackupFeasibilityPolicyPort {
	return {
		async assess(candidate, ports) {
			const resources = new Map<string, CustomAssetResource>();
			const checkedPorts = ports
				? {
						binaryChecksum: ports.binaryChecksum,
						resources: {
							read: async (resourceHash: string) => {
								const bytes = await ports.resources.read(resourceHash);
								if (bytes) resources.set(resourceHash, { resourceHash, bytes });
								return bytes;
							},
						},
					}
				: undefined;
			const previous = await assessBackupFeasibility(candidate, checkedPorts);
			if (previous.kind === "rejected") return previous;
			if (
				candidate.project.schemaVersion !== 1 ||
				candidate.revision.schemaVersion !== 1 ||
				(candidate.project.assetDefinitionRefs.length > 0 && !ports)
			)
				return {
					kind: "rejected",
					reasonCode: "PROJECT_BACKUP_ENVELOPE_EXCEEDED",
				};
			const represented = await assessBrowserBackupRepresentability(
				candidate.project,
				[...resources.values()],
				binaryChecksum,
			);
			return represented.kind === "representable"
				? { kind: "accepted" }
				: { kind: "rejected", reasonCode: "PROJECT_BACKUP_ENVELOPE_EXCEEDED" };
		},
	};
}
