import type { BinaryChecksumPort } from "../application/ports";
import type { CustomGlbAssetDefinition } from "../domain/project";
import {
	isSha256ResourceHash,
	sameSha256ResourceHashBits,
} from "../domain/resource-hash";
import { preflightStaticGlbImport } from "../domain/static-glb-import";

export type LocalGlbResourceResult =
	| {
			readonly kind: "ready";
			readonly assetDefinitionId: string;
			readonly resourceHash: string;
			readonly bytes: Uint8Array;
	  }
	| { readonly kind: "unavailable"; readonly assetDefinitionId: string };

/** Retains exact local addresses; every resource is verified before renderer hydration. */
export async function loadLocalGlbResource(
	definition: CustomGlbAssetDefinition,
	ports: {
		readonly read: (resourceHash: string) => Promise<Uint8Array | undefined>;
		readonly checksum: BinaryChecksumPort;
	},
): Promise<LocalGlbResourceResult> {
	const { assetDefinitionId, resourceHash, byteLength } = definition;
	const unavailable = { kind: "unavailable" as const, assetDefinitionId };
	if (
		!isSha256ResourceHash(resourceHash) ||
		!Number.isSafeInteger(byteLength) ||
		byteLength <= 0 ||
		byteLength > 25 * 1024 * 1024
	)
		return unavailable;
	try {
		const source = await ports.read(resourceHash);
		if (
			!source ||
			source.byteLength !== byteLength ||
			preflightStaticGlbImport(source).kind === "rejected"
		)
			return unavailable;
		const bytes = source.slice();
		if (
			!sameSha256ResourceHashBits(
				resourceHash,
				await ports.checksum.sha256Bytes(bytes),
			)
		)
			return unavailable;
		return { kind: "ready", assetDefinitionId, resourceHash, bytes };
	} catch {
		return unavailable;
	}
}
