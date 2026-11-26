import type { InteriorCommand } from "../domain/interior-project";
import { floorDecorPresetFor, resolveSupportedPlacements, supportedDecorBasePoints, type SupportAddress } from "../domain/interior-support";
import { findRoomForFloorItem, yawRadiansFor } from "../domain/parametric-item";
import type { Project } from "../domain/project";
import { supportOptions, type SupportOption } from "./supported-item-controls";
import { type AvailableSupportOption, supportAddressAt, supportPlacementCommand } from "./supported-placement-targets";

export type SupportDragPoint = { readonly xMm: number; readonly zMm: number };

type Decor = NonNullable<Parameters<typeof supportPlacementCommand>[2]>;

export type SupportDragSource = {
	readonly assetInstanceId: string;
	readonly decor: Decor;
	readonly originalSupport?: { readonly hostId: string; readonly surfaceKey: string };
	readonly point: SupportDragPoint;
	readonly yawMilliDeg: number;
};

export type SupportDragDestination = {
	readonly command: InteriorCommand;
	readonly point: SupportDragPoint;
	readonly heightMm: number;
	readonly option?: SupportOption;
	readonly address?: SupportAddress;
};

export type PlanSupportDrop =
	| { readonly kind: "place"; readonly destination: SupportDragDestination }
	| { readonly kind: "choose-level"; readonly hostId: string; readonly point: SupportDragPoint };

const milliDegrees = (radians: number) => Math.round(radians * 180_000 / Math.PI);
const normalizedYaw = (yaw: number) => ((yaw % 360_000) + 360_000) % 360_000;

function supportDragRelativeYaw(source: SupportDragSource, host: SupportOption["host"]): number {
	return normalizedYaw(source.yawMilliDeg - milliDegrees(yawRadiansFor(host)));
}

function fittingSurface(source: SupportDragSource, { host, surface }: SupportOption) {
	if (host.assetInstanceId === source.assetInstanceId ||
		(surface.ceilingMm !== undefined && surface.heightMm + source.decor.heightMm > surface.ceilingMm)) return undefined;
	const points = supportedDecorBasePoints(source.decor.catalogPreset?.presetId ?? "", {
		xMm: 0, zMm: 0, widthMm: source.decor.widthMm, depthMm: source.decor.depthMm, yawMilliDeg: supportDragRelativeYaw(source, host),
	});
	if (points.length === 0) return undefined;
	const halfWidth = Math.max(...points.map(point => Math.abs(point.xMm)));
	const halfDepth = Math.max(...points.map(point => Math.abs(point.zMm)));
	const minX = Math.ceil(surface.minXMm + halfWidth - 1e-7);
	const maxX = Math.floor(surface.maxXMm - halfWidth + 1e-7);
	const minZ = Math.ceil(surface.minZMm + halfDepth - 1e-7);
	const maxZ = Math.floor(surface.maxZMm - halfDepth + 1e-7);
	return minX <= maxX && minZ <= maxZ ? { minX, maxX, minZ, maxZ } : undefined;
}

export type SupportedDrag = ReturnType<typeof createSupportedDrag>;

export function createSupportedDrag(
	project: Project,
	canPlace: (command: InteriorCommand) => boolean,
	onDrop: (command: InteriorCommand) => Promise<boolean>,
	onChooseLevel: (source: SupportDragSource, hostId: string, point: SupportDragPoint) => void,
	options = supportOptions(project),
) {
	return {
		options,
		onDrop,
		onChooseLevel,
		source(assetInstanceId: string): SupportDragSource | undefined {
			const floor = project.assetInstances.find(item => item.assetInstanceId === assetInstanceId);
			if (floor?.anchorClass === "floor" && !floor.locked) {
				const catalogPreset = floorDecorPresetFor(floor);
				return catalogPreset ? {
					assetInstanceId, decor: { ...floor, catalogPreset }, point: floor,
					yawMilliDeg: normalizedYaw(milliDegrees(yawRadiansFor(floor))),
				} : undefined;
			}
			const pose = resolveSupportedPlacements(project).find(candidate => candidate.item.assetInstanceId === assetInstanceId);
			if (!pose || pose.item.locked) return undefined;
			const { item, yawMilliDeg } = pose;
			return {
				assetInstanceId, decor: item, point: pose, yawMilliDeg,
				originalSupport: { hostId: item.supportAssetInstanceId, surfaceKey: item.supportSurfaceKey },
			};
		},
		optionsFor(source: SupportDragSource) {
			return options.filter(option => fittingSurface(source, option));
		},
		onSurface(source: SupportDragSource, option: SupportOption, point: SupportDragPoint): SupportDragDestination | undefined {
			const bounds = fittingSurface(source, option);
			if (!bounds) return undefined;
			const { host, surface } = option;
			const address = supportAddressAt(option, supportDragRelativeYaw(source, host), point);
			const offsetXMm = Math.min(bounds.maxX, Math.max(bounds.minX, address.offsetXMm));
			const offsetZMm = Math.min(bounds.maxZ, Math.max(bounds.minZ, address.offsetZMm));
			const target = { ...address, offsetXMm, offsetZMm };
			const mode = source.originalSupport ? "move" : "attach";
			const command = supportPlacementCommand({ mode, sourceId: source.assetInstanceId }, target, source.decor);
			if (!command || !canPlace(command)) return undefined;
			const yaw = yawRadiansFor(host);
			return {
				command, option, address: target, heightMm: surface.heightMm, point: {
					xMm: host.xMm + Math.cos(yaw) * offsetXMm + Math.sin(yaw) * offsetZMm,
					zMm: host.zMm - Math.sin(yaw) * offsetXMm + Math.cos(yaw) * offsetZMm,
				},
			};
		},
		onFloor(source: SupportDragSource, point: SupportDragPoint): SupportDragDestination | undefined {
			if (!source.originalSupport) return undefined;
			const position = { xMm: Math.round(point.xMm) + 0, zMm: Math.round(point.zMm) + 0 };
			const footprint = { ...source.decor, ...position, yawRadians: source.yawMilliDeg * Math.PI / 180_000 };
			const roomId = findRoomForFloorItem(project, footprint);
			if (!roomId) return undefined;
			const command: InteriorCommand = { kind: "move-supported", assetInstanceId: source.assetInstanceId,
				target: { ...position, roomId, yawMilliDeg: source.yawMilliDeg } };
			return canPlace(command) ? { command, point: position, heightMm: 0 } : undefined;
		},
	};
}

export function supportDragLevels(drag: SupportedDrag, sourceId: string, hostId: string, point: SupportDragPoint): readonly AvailableSupportOption[] {
	const source = drag.source(sourceId);
	if (!source) return [];
	return drag.optionsFor(source).flatMap(option => {
		if (option.host.assetInstanceId !== hostId) return [];
		const anchor = drag.onSurface(source, option, point)?.address;
		return anchor ? [{ ...option, anchor }] : [];
	});
}

export function planSupportDrop(drag: SupportedDrag, source: SupportDragSource, contact: SupportDragPoint, point: SupportDragPoint): PlanSupportDrop | undefined {
	const destinations = drag.options.flatMap(option => {
		const { surface } = option;
		const hit = supportAddressAt(option, 0, contact);
		if (hit.offsetXMm < surface.minXMm || hit.offsetXMm > surface.maxXMm ||
			hit.offsetZMm < surface.minZMm || hit.offsetZMm > surface.maxZMm) return [];
		const destination = drag.onSurface(source, option, point);
		return destination ? [{ destination, option }] : [];
	});
	const hostId = destinations.at(-1)?.option.host.assetInstanceId;
	if (!hostId) return undefined;
	const onHost = destinations.filter(({ option }) => option.host.assetInstanceId === hostId);
	const preferred = source.originalSupport?.hostId === hostId ?
		onHost.find(({ option }) => option.surface.key === source.originalSupport?.surfaceKey) : undefined;
	const selected = preferred ?? (onHost.length === 1 ? onHost[0] : undefined);
	return selected ? { kind: "place", destination: selected.destination } : { kind: "choose-level", hostId, point };
}
