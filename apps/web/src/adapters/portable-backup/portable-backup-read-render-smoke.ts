import { projectRectangularRoomForWebGl } from "../renderer/rectangular-room-projection";
import type {
	BinaryChecksumPort,
	CustomAssetResource,
	PortableBackupSmokeCheckPort,
} from "../../application/ports";
import type { Project } from "../../domain/project";
import {
	createStaticGlbResourcePreflight,
	preflightStaticGlbImport,
	type StaticGlbImportPreflight,
	type StaticGlbResourcePreflightPolicy,
} from "../../domain/static-glb-import";
import { alphaBackupFeasibilityLimits } from "../../application/backup-feasibility-policy";
import { runtimeLayoutViews } from "../../application/runtime-v1-project-validation";

export interface PortableBackupResourcePolicy
	extends StaticGlbResourcePreflightPolicy {
	readonly hashComparison: "sha256-bits";
}

interface PortableBackupReadRenderSmokeDependencies {
	readonly checksum: BinaryChecksumPort;
	readonly resourcePolicy?: PortableBackupResourcePolicy;
}

/**
 * An offline prepublication smoke. It makes a clean, disposable profile from
 * the archive-owned exact bytes, then rebuilds derived Plan and WebGL scene
 * from canonical integer-millimetre geometry. It cannot observe browser-pinned
 * resources, a durable Project identity, or network state.
 */
export class PortableBackupReadRenderSmokeCheck
	implements PortableBackupSmokeCheckPort
{
	private readonly preflight: (bytes: Uint8Array) => StaticGlbImportPreflight;
	private readonly resourcePolicy: PortableBackupResourcePolicy | undefined;

	public constructor(
		private readonly dependencies: PortableBackupReadRenderSmokeDependencies,
	) {
		const policy =
			dependencies.resourcePolicy === undefined
				? undefined
				: {
						maximumInputBytes: dependencies.resourcePolicy.maximumInputBytes,
						hashComparison: dependencies.resourcePolicy.hashComparison,
					};
		if (policy === undefined) {
			this.preflight = preflightStaticGlbImport;
		} else {
			if (policy.hashComparison !== "sha256-bits")
				throw new RangeError("A registered portable hash policy is required");
			this.preflight = createStaticGlbResourcePreflight(policy);
			this.resourcePolicy = {
				maximumInputBytes: policy.maximumInputBytes,
				hashComparison: policy.hashComparison,
			};
		}
	}

	public async verify(
		project: Project,
		resources: readonly CustomAssetResource[],
	): Promise<boolean> {
		if (!(await this.resourcesAreReadable(project, resources))) return false;

		// An open drawing has an honest 2D projection but no derived Room/3D scene.
		// Once Room metadata exists, both derivation and the disposable 3D projection
		// must be reproducible before publication.
		if (project.level.rooms.length === 0) return true;
		return runtimeLayoutViews(project).every(view => projectRectangularRoomForWebGl(view) !== undefined);
	}

	private async resourcesAreReadable(
		project: Project,
		resources: readonly CustomAssetResource[],
	): Promise<boolean> {
		if (
			this.resourcePolicy &&
			!withinPortableProfileBounds(
				resources,
				this.resourcePolicy.maximumInputBytes,
			)
		)
			return false;
		const profile = new Map<string, Uint8Array>();
		for (const resource of resources) {
			if (profile.has(resource.resourceHash)) return false;
			profile.set(resource.resourceHash, resource.bytes.slice());
		}
		for (const definition of project.assetDefinitionRefs) {
			const bytes = profile.get(definition.resourceHash);
			if (
				!bytes ||
				bytes.byteLength !== definition.byteLength ||
				this.preflight(bytes).kind === "rejected"
			) {
				return false;
			}
			const digest = await this.dependencies.checksum.sha256Bytes(bytes);
			if (
				this.resourcePolicy
					? !sameSha256Bits(definition.resourceHash, digest)
					: digest !== definition.resourceHash
			)
				return false;
		}
		return true;
	}
}

function withinPortableProfileBounds(
	resources: readonly CustomAssetResource[],
	maximumInputBytes: number,
): boolean {
	if (resources.length > alphaBackupFeasibilityLimits.maxResourceEntries)
		return false;
	let totalBytes = 0;
	for (const resource of resources) {
		if (resource.bytes.byteLength > maximumInputBytes) return false;
		totalBytes += resource.bytes.byteLength;
		if (totalBytes > alphaBackupFeasibilityLimits.maxResourceBytes)
			return false;
	}
	return true;
}

function sameSha256Bits(expected: string, actual: string): boolean {
	const hex = /^[a-fA-F0-9]{64}$/;
	if (!hex.test(expected) || !hex.test(actual)) return false;
	for (let offset = 0; offset < 64; offset += 2) {
		if (
			Number.parseInt(expected.slice(offset, offset + 2), 16) !==
			Number.parseInt(actual.slice(offset, offset + 2), 16)
		)
			return false;
	}
	return true;
}
