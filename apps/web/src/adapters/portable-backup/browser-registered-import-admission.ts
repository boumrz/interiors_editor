import type { Project } from "../../domain/project";
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
	IdPort,
	PortableBackupDecodeResult,
	PortableBackupDecoderPort,
	PortableBackupImportAdmissionFailure,
	PortableBackupImportAdmissionPort,
	PortableBackupImportProfilePort,
	PublicationCandidate,
} from "../../application/ports";

const unavailable = () => ({ kind: "verification-unavailable" }) as const;
const cancelled = () =>
	({ kind: "rejected", reasonCode: "BACKUP_CANCELLED" }) as const;
const uuid =
	/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

/** New browser destination only. A file never supplies its storage or publication boundary. */
export class BrowserRegisteredImportAdmission
	implements PortableBackupDecoderPort, PortableBackupImportAdmissionPort
{
	private readonly decoded = new WeakSet<object>();
	public constructor(
		private readonly dependencies: {
			readonly decoder: PortableBackupDecoderPort;
			readonly binaryChecksum: BinaryChecksumPort;
			readonly ids: IdPort;
			readonly resources: Pick<CustomAssetResourceStorePort, "read">;
			readonly live: () => boolean;
			/** Called after real smoke and exact representation proof, before first destination ID. */
			readonly initialize: (
				signal?: CancellationSignalPort,
			) => Promise<boolean>;
			/** Trusted composition checks direct current pointer keys in both known stores. */
			readonly lookupProjectId: (
				id: string,
				signal?: CancellationSignalPort,
			) => Promise<{ readonly kind: "free" | "occupied" | "unavailable" }>;
		},
	) {
		this.dependencies = { ...dependencies };
	}
	public async decode(
		bytes: Uint8Array,
		signal?: CancellationSignalPort,
	): Promise<PortableBackupDecodeResult> {
		if (signal?.aborted) return cancelled();
		if (!this.dependencies.live()) return unavailable();
		try {
			const result = await this.dependencies.decoder.decode(bytes, signal);
			if (result.kind !== "accepted") return result;
			if (signal?.aborted) return cancelled();
			if (!this.dependencies.live()) return unavailable();
			this.decoded.add(result);
			return result;
		} catch {
			return signal?.aborted ? cancelled() : unavailable();
		}
	}
	/** This substrate's actual journal/fence/receipt owns retry of the immutable candidate. */
	public isRetryBlocked(_candidate: DurablePublicationCandidate): boolean {
		return false;
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
			!this.dependencies.live() ||
			!this.decoded.has(decoded) ||
			!decoded.projectMember ||
			!sameBrowserBackupValue(source, decoded.projectMember.project) ||
			!sameBrowserBackupResourceBytes(resources, decoded.resources ?? [])
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
		if (!this.dependencies.live()) return unavailable();
		if (represented.kind !== "representable") return represented;
		if (!(await this.dependencies.initialize(signal)))
			return signal?.aborted ? cancelled() : unavailable();
		if (signal?.aborted) return cancelled();
		if (!this.dependencies.live()) return unavailable();
		const proof = represented.proof;
		let selectedId: string | undefined,
			candidate: PublicationCandidate | undefined;
		const ready = (
			signal?: CancellationSignalPort,
		): PortableBackupImportAdmissionFailure | undefined =>
			signal?.aborted
				? cancelled()
				: !this.dependencies.live()
					? unavailable()
					: undefined;
		const profile: PortableBackupImportProfilePort = {
			source: proof.project,
			selectProjectId: async (proposed, signal) => {
				if (selectedId) return unavailable();
				let id = proposed;
				for (let attempt = 0; attempt < 8; attempt++) {
					const stopped = ready(signal);
					if (stopped) return stopped;
					if (id !== proof.project.projectId) {
						if (typeof id !== "string" || id.length !== 36 || !uuid.test(id))
							return unavailable();
						const lookup = await this.dependencies.lookupProjectId(id, signal);
						const stopped = ready(signal);
						if (stopped) return stopped;
						if (lookup.kind === "unavailable") return unavailable();
						if (lookup.kind === "free") {
							selectedId = id;
							return { kind: "selected", projectId: id };
						}
					}
					if (attempt < 7) id = this.dependencies.ids.next();
				}
				return unavailable();
			},
			seal: async (input, signal) => {
				const stopped = ready(signal);
				if (stopped) return stopped;
				if (candidate || !selectedId || input.project.projectId !== selectedId)
					return unavailable();
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
				const ended = ready(signal);
				if (ended) return ended;
				if (checked.kind !== "accepted") return unavailable();
				candidate = owned;
				return { kind: "accepted", candidate: owned };
			},
			beforePublish: async (input, signal) => {
				const stopped = ready(signal);
				if (stopped) return stopped;
				if (input !== candidate) return unavailable();
				const pinned: CustomAssetResource[] = [];
				for (const resource of proof.resources) {
					const stopped = ready(signal);
					if (stopped) return stopped;
					const bytes = await this.dependencies.resources.read(
						resource.resourceHash,
					);
					if (!bytes) return unavailable();
					pinned.push({ resourceHash: resource.resourceHash, bytes });
				}
				if (!sameBrowserBackupResourceBytes(pinned, proof.resources))
					return unavailable();
				const checked = await verifyBrowserBackupCandidate(
					input,
					proof,
					pinned,
					this.dependencies.binaryChecksum,
					signal,
				);
				const ended = ready(signal);
				if (ended) return ended;
				return checked.kind === "accepted" ? checked : unavailable();
			},
		};
		return { kind: "accepted", profile };
	}
}
