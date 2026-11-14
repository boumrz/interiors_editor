import {
	validateCustomGlbAssetDefinition,
	type ValidateCustomGlbAssetDefinitionResult,
} from "../domain/custom-glb-asset";
import {
	preflightStaticGlbImport,
	type StaticGlbImportPreflight,
} from "../domain/static-glb-import";
import type { CustomGlbAssetDefinition } from "../domain/project";
import type { BinaryChecksumPort, CustomAssetLibraryPort } from "./ports";
import { sameSha256ResourceHashBits } from "../domain/resource-hash";

export type RegisterCustomGlbLibraryAssetResult =
	| Extract<
			ValidateCustomGlbAssetDefinitionResult,
			{ readonly kind: "rejected" }
	  >
	| Extract<StaticGlbImportPreflight, { readonly kind: "rejected" }>
	| {
			readonly kind: "rejected";
			readonly reasonCode:
				| "CUSTOM_ASSET_BYTES_MISMATCH"
				| "RESOURCE_HASH_MISMATCH";
	  }
	| {
			readonly asset: CustomGlbAssetDefinition;
			readonly kind: "already-present" | "registered" | "suppressed";
	  }
	| {
			readonly kind: "persist-failed";
			readonly reasonCode: import("./ports").PublicationFailureReason;
	  };

export type RegisterCustomGlbLibraryAssetInput = {
	readonly asset: CustomGlbAssetDefinition;
	readonly glbBytes: Uint8Array;
	readonly restoreRemoved?: boolean;
};

interface RegisterCustomGlbLibraryAssetDependencies {
	readonly binaryChecksum: BinaryChecksumPort;
	readonly library: CustomAssetLibraryPort;
}

/**
 * Makes a verified GLB reusable from the device-local "Custom" catalogue.
 * This deliberately has no Project or Revision dependency: selecting a card
 * later is what creates a Project-specific durable reference.
 */
export class RegisterCustomGlbLibraryAssetUseCase {
	public constructor(
		private readonly dependencies: RegisterCustomGlbLibraryAssetDependencies,
	) {}

	public async execute(
		input: RegisterCustomGlbLibraryAssetInput,
	): Promise<RegisterCustomGlbLibraryAssetResult> {
		const glbBytes = input.glbBytes.slice();
		const asset = { ...input.asset };
		const restoreRemoved = input.restoreRemoved === true;
		const preflight = preflightStaticGlbImport(glbBytes);
		if (preflight.kind === "rejected") return preflight;
		if (asset.byteLength !== glbBytes.byteLength) {
			return { kind: "rejected", reasonCode: "CUSTOM_ASSET_BYTES_MISMATCH" };
		}
		const resourceHash =
			await this.dependencies.binaryChecksum.sha256Bytes(glbBytes);
		if (!sameSha256ResourceHashBits(asset.resourceHash, resourceHash)) {
			return { kind: "rejected", reasonCode: "RESOURCE_HASH_MISMATCH" };
		}
		const definitionValidation = validateCustomGlbAssetDefinition(asset);
		if (definitionValidation.kind === "rejected") return definitionValidation;

		try {
			return await this.dependencies.library.register(
				asset,
				{
					bytes: glbBytes,
					resourceHash: asset.resourceHash,
				},
				{ restoreRemoved },
			);
		} catch {
			return { kind: "persist-failed", reasonCode: "PERSISTENCE_WRITE_FAILED" };
		}
	}
}
