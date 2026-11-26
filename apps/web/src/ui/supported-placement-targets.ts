import type { InteriorCommand, SupportTarget } from "../domain/interior-project";
import { isSupportedDecorPreset, type SupportAddress } from "../domain/interior-support";
import { alphaParametricItemColorVariantFor } from "../domain/item-color-variant";
import { yawRadiansFor } from "../domain/parametric-item";
import type { CatalogPresetReference } from "../domain/project";
import type { SupportedEditDraft, SupportOption } from "./supported-item-controls";

type PlanPoint = { readonly xMm: number; readonly zMm: number };

type Decor = {
	readonly catalogPreset?: CatalogPresetReference;
	readonly label: string;
	readonly color: string;
	readonly colorVariantId?: string;
	readonly widthMm: number;
	readonly depthMm: number;
	readonly heightMm: number;
};

export type AvailableSupportOption = SupportOption & { readonly anchor: SupportAddress };

export function supportAddressAt(
	{ host, surface }: SupportOption,
	relativeYawMilliDeg: number,
	point?: PlanPoint,
): SupportAddress {
	const yaw = yawRadiansFor(host);
	const dx = (point?.xMm ?? host.xMm) - host.xMm;
	const dz = (point?.zMm ?? host.zMm) - host.zMm;
	return {
		supportAssetInstanceId: host.assetInstanceId,
		supportSurfaceKey: surface.key,
		offsetXMm: Math.round(point ? Math.cos(yaw) * dx - Math.sin(yaw) * dz : (surface.minXMm + surface.maxXMm) / 2) + 0,
		offsetZMm: Math.round(point ? Math.sin(yaw) * dx + Math.cos(yaw) * dz : (surface.minZMm + surface.maxZMm) / 2) + 0,
		relativeYawMilliDeg,
	};
}

export function supportPlacementCommand(
	draft: Pick<SupportedEditDraft, "mode" | "sourceId">,
	target: SupportTarget,
	decor?: Decor,
): InteriorCommand | undefined {
	const { mode, sourceId } = draft;
	if (sourceId && (mode === "move" || mode === "copy" || mode === "rehome")) {
		return { kind: mode === "copy" ? "copy-supported" : "move-supported", assetInstanceId: sourceId, target };
	}
	if (!decor?.catalogPreset || !isSupportedDecorPreset(decor.catalogPreset.presetId)) return undefined;
	const variant = decor.colorVariantId && alphaParametricItemColorVariantFor(decor.colorVariantId);
	const item = {
		catalogPreset: decor.catalogPreset,
		label: decor.label,
		widthMm: decor.widthMm,
		depthMm: decor.depthMm,
		heightMm: decor.heightMm,
		color: decor.color,
		...(variant ? { colorVariantId: variant.variantId } : {}),
	};
	const source = sourceId ? { sourceAssetInstanceId: sourceId } : {};
	return "supportAssetInstanceId" in target
		? { kind: "place-supported", item: { ...target, ...item }, ...source }
		: { kind: "place-decor-on-floor", item, target, ...source };
}

export function availableSupportOptions(
	options: readonly SupportOption[],
	relativeYawMilliDeg: number,
	fits: (address: SupportAddress) => boolean,
): readonly AvailableSupportOption[] {
	return options.flatMap(option => {
		const { surface } = option;
		const center = supportAddressAt(option, relativeYawMilliDeg);
		const width = surface.maxXMm - surface.minXMm;
		const depth = surface.maxZMm - surface.minZMm;
		// A clear centre is preferred. Offer a free side when decor already occupies the centre.
		for (const x of [0, -1 / 4, 1 / 4, -1 / 3, 1 / 3]) {
			for (const z of [0, -1 / 4, 1 / 4, -1 / 3, 1 / 3]) {
				const anchor = {
					...center,
					offsetXMm: center.offsetXMm + Math.round(width * x),
					offsetZMm: center.offsetZMm + Math.round(depth * z),
				};
				if (fits(anchor)) return [{ ...option, anchor }];
			}
		}
		return [];
	});
}
