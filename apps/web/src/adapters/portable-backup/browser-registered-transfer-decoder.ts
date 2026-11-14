import { copyProject } from "../../domain/copy-project";
import {
	assessBrowserBackupRepresentability,
	freezeBrowserBackupValue,
	sameBrowserBackupResourceBytes,
	sameBrowserBackupValue,
	verifyBrowserBackupCandidate,
} from "../../application/browser-backup-representability";
import type {
	BinaryChecksumPort,
	CancellationSignalPort,
	CustomAssetResource,
	CustomAssetResourceStorePort,
	DurablePublicationCandidate,
	PortableBackupDecoderPort,
	PortableBackupDecodeResult,
	PortableBackupImportAdmissionFailure,
	PortableBackupImportAdmissionPort,
	PortableBackupImportProfilePort,
	PublicationCandidate,
} from "../../application/ports";
import type { Project } from "../../domain/project";

const unavailable = () => ({ kind: "verification-unavailable" }) as const;
const cancelled = () =>
	({ kind: "rejected", reasonCode: "BACKUP_CANCELLED" }) as const;

/** Private destination profile for the additional browser route; no publisher is supplied here. */
export class BrowserRegisteredTransferDecoder
	implements PortableBackupDecoderPort, PortableBackupImportAdmissionPort
{
	private readonly decoded = new WeakSet<object>();
	private readonly sealed = new WeakSet<object>();
	public constructor(
		private readonly dependencies: {
			readonly decoder: PortableBackupDecoderPort;
			readonly resources: Pick<
				CustomAssetResourceStorePort,
				"read" | "protectExistingResource"
			>;
			readonly binaryChecksum: BinaryChecksumPort;
		},
	) {}
	public async decode(
		bytes: Uint8Array,
		signal?: CancellationSignalPort,
	): Promise<PortableBackupDecodeResult> {
		try {
			const result = await this.dependencies.decoder.decode(bytes, signal);
			if (result.kind === "accepted") this.decoded.add(result);
			return result;
		} catch {
			return unavailable();
		}
	}
	public isRetryBlocked(candidate: DurablePublicationCandidate): boolean {
		return this.sealed.has(candidate);
	}
	public async prepare(
		decoded: Extract<PortableBackupDecodeResult, { kind: "accepted" }>,
		source: Project,
		resources: readonly CustomAssetResource[],
		signal?: CancellationSignalPort,
	): Promise<
		| PortableBackupImportAdmissionFailure
		| {
				readonly kind: "accepted";
				readonly profile: PortableBackupImportProfilePort;
		  }
	> {
		if (signal?.aborted) return cancelled();
		if (
			!this.decoded.has(decoded) ||
			!decoded.projectMember ||
			!sameBrowserBackupValue(source, decoded.projectMember.project) ||
			!sameBrowserBackupResourceBytes(resources, decoded.resources ?? []) ||
			(resources.length > 0 &&
				typeof this.dependencies.resources.protectExistingResource !==
					"function")
		)
			return unavailable();
		this.decoded.delete(decoded);
		const represented = await assessBrowserBackupRepresentability(
			source,
			resources,
			this.dependencies.binaryChecksum,
			signal,
		);
		if (signal?.aborted) return cancelled();
		if (represented.kind !== "representable") return represented;
		const proof = represented.proof;
		let candidate: PublicationCandidate | undefined;
		const profile: PortableBackupImportProfilePort = {
			source: proof.project,
			seal: async (input, signal) => {
				if (signal?.aborted) return cancelled();
				if (candidate) return unavailable();
				try {
					const owned = {
						project: copyProject(input.project),
						revision: { ...input.revision },
					};
					freezeBrowserBackupValue(owned);
					const checked = await verifyBrowserBackupCandidate(
						owned,
						proof,
						resources,
						this.dependencies.binaryChecksum,
						signal,
					);
					if (signal?.aborted) return cancelled();
					if (checked.kind !== "accepted") return checked;
					candidate = owned;
					this.sealed.add(owned);
					return { kind: "accepted", candidate: owned };
				} catch {
					return unavailable();
				}
			},
			beforePublish: async (input, signal) => {
				if (signal?.aborted) return cancelled();
				if (input !== candidate || !this.sealed.has(input))
					return unavailable();
				try {
					const pinned: CustomAssetResource[] = [];
					for (const resource of proof.resources) {
						if (signal?.aborted) return cancelled();
						// Protect the exact existing key before its old staging owner can clean it up.
						if (
							!(await this.dependencies.resources.protectExistingResource?.(
								resource.resourceHash,
							))
						)
							return unavailable();
						if (signal?.aborted) return cancelled();
						const bytes = await this.dependencies.resources.read(
							resource.resourceHash,
						);
						if (!bytes) return unavailable();
						pinned.push({
							resourceHash: resource.resourceHash,
							bytes: bytes.slice(),
						});
					}
					if (signal?.aborted) return cancelled();
					if (!sameBrowserBackupResourceBytes(pinned, proof.resources))
						return unavailable();
					const checked = await verifyBrowserBackupCandidate(
						input,
						proof,
						pinned,
						this.dependencies.binaryChecksum,
						signal,
					);
					if (signal?.aborted) return cancelled();
					return checked.kind === "accepted" ? checked : unavailable();
				} catch {
					return signal?.aborted ? cancelled() : unavailable();
				}
			},
		};
		return { kind: "accepted", profile };
	}
}
