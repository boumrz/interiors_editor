import {
	createParametricFloorItem,
	type CreateParametricFloorItemResult,
	type ParametricFloorItemInput,
} from "./parametric-item";
import type { CustomGlbAssetDefinition, Project } from "./project";
import { isSha256ResourceHash } from "./resource-hash";
import {
	createParametricWallItem,
	type ParametricWallItemInput,
	type CreateParametricWallItemResult,
} from "./parametric-wall-item";

export interface CreateCustomGlbFloorItemInput
	extends Omit<
		ParametricFloorItemInput,
		"assetDefinitionId" | "depthMm" | "heightMm" | "label" | "widthMm"
	> {
	readonly asset: CustomGlbAssetDefinition;
}

export interface CreateCustomGlbWallItemInput
	extends Omit<
		ParametricWallItemInput,
		"assetDefinitionId" | "depthMm" | "heightMm" | "label" | "widthMm"
	> {
	readonly asset: CustomGlbAssetDefinition;
}

export type CreateCustomGlbWallItemResult =
	| CreateParametricWallItemResult
	| Extract<CreateCustomGlbFloorItemResult, { readonly kind: "rejected" }>;

export type CreateCustomGlbFloorItemResult =
	| CreateParametricFloorItemResult
	| {
			readonly kind: "rejected";
			readonly reasonCode:
				| "CUSTOM_ASSET_ID_CONFLICT"
				| "INVALID_CUSTOM_ASSET_DEFINITION";
	  };

export type ValidateCustomGlbAssetDefinitionResult =
	| { readonly kind: "accepted" }
	| Extract<CreateCustomGlbFloorItemResult, { readonly kind: "rejected" }>;

interface IdSource {
	next(): string;
}

/**
 * Registers immutable custom-asset metadata and its first instance together,
 * so an instance can never reference an unknown definition in a revision.
 */
export function createCustomGlbFloorItem(
	project: Project,
	input: CreateCustomGlbFloorItemInput,
	ids: IdSource,
	updatedAt: string,
): CreateCustomGlbFloorItemResult {
	const definitionValidation = validateCustomGlbAssetDefinition(input.asset);
	if (definitionValidation.kind === "rejected") return definitionValidation;
	if (
		project.assetDefinitionRefs.some(
			(asset) => asset.assetDefinitionId === input.asset.assetDefinitionId,
		)
	) {
		return { kind: "rejected", reasonCode: "CUSTOM_ASSET_ID_CONFLICT" };
	}
	return createParametricFloorItem(
		{
			...project,
			assetDefinitionRefs: [...project.assetDefinitionRefs, input.asset],
		},
		{
			assetDefinitionId: input.asset.assetDefinitionId,
			color: input.color,
			depthMm: input.asset.depthMm,
			heightMm: input.asset.heightMm,
			label: input.asset.displayName,
			roomId: input.roomId,
			widthMm: input.asset.widthMm,
			xMm: input.xMm,
			yawStep: input.yawStep,
			zMm: input.zMm,
		},
		ids,
		updatedAt,
	);
}

/** Registers a model and its stable wall-local address as one validated change. */
export function createCustomGlbWallItem(
	project: Project,
	input: CreateCustomGlbWallItemInput,
	ids: IdSource,
	updatedAt: string,
): CreateCustomGlbWallItemResult {
	const validation = validateCustomGlbAssetDefinition(input.asset);
	if (validation.kind === "rejected") return validation;
	if (
		project.assetDefinitionRefs.some(
			(asset) => asset.assetDefinitionId === input.asset.assetDefinitionId,
		)
	) {
		return { kind: "rejected", reasonCode: "CUSTOM_ASSET_ID_CONFLICT" };
	}
	return createParametricWallItem(
		{
			...project,
			assetDefinitionRefs: [...project.assetDefinitionRefs, input.asset],
		},
		{
			...input,
			assetDefinitionId: input.asset.assetDefinitionId,
			depthMm: input.asset.depthMm,
			heightMm: input.asset.heightMm,
			widthMm: input.asset.widthMm,
			label: input.asset.displayName,
		},
		ids,
		updatedAt,
	);
}

/** Validates metadata before it can be made durable in either a Project or the local library. */
export function validateCustomGlbAssetDefinition(
	asset: CustomGlbAssetDefinition,
): ValidateCustomGlbAssetDefinitionResult {
	if (!isValidDefinition(asset)) {
		return { kind: "rejected", reasonCode: "INVALID_CUSTOM_ASSET_DEFINITION" };
	}
	return { kind: "accepted" };
}

function isValidDefinition(asset: CustomGlbAssetDefinition): boolean {
	return (
		asset.format === "glb" &&
		isSha256ResourceHash(asset.resourceHash) &&
		Number.isSafeInteger(asset.byteLength) &&
		asset.byteLength > 0 &&
		asset.byteLength <= 25 * 1024 * 1024 &&
		[asset.widthMm, asset.depthMm, asset.heightMm].every(
			(dimension) =>
				Number.isSafeInteger(dimension) &&
				dimension > 0 &&
				dimension <= 100_000,
		) &&
		asset.assetDefinitionId.trim().length > 0 &&
		asset.displayName.trim().length > 0 &&
		asset.displayName.trim() === asset.displayName &&
		hasValidCatalogVersionOrigin(asset)
	);
}

function hasValidCatalogVersionOrigin(
	asset: CustomGlbAssetDefinition,
): boolean {
	const provenance = [
		asset.source,
		asset.catalogAssetId,
		asset.catalogEnvelopeHash,
		asset.catalogVersion,
	];
	if (provenance.every((value) => value === undefined)) return true;
	return (
		asset.source === "CatalogVersion" &&
		typeof asset.catalogAssetId === "string" &&
		asset.catalogAssetId.trim().length > 0 &&
		asset.catalogAssetId.trim() === asset.catalogAssetId &&
		typeof asset.catalogVersion === "string" &&
		asset.catalogVersion.trim().length > 0 &&
		asset.catalogVersion.trim() === asset.catalogVersion &&
		typeof asset.catalogEnvelopeHash === "string" &&
		/^[a-f0-9]{64}$/.test(asset.catalogEnvelopeHash)
	);
}
