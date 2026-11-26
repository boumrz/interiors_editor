import { deriveBoundedOrthogonalFaces } from "../domain/derive-plan-faces";
import { resolveOrthogonalPlanFaces } from "../domain/derived-orthogonal-plan-faces";
import { projectOpeningsRemainValid, wallOpeningHostsForProject } from "../domain/door-opening-project";
import { projectUsesInteriorDetails } from "../domain/interior-project-format";
import { validateSupportedItems } from "../domain/interior-support";
import {
	assessParametricFloorItemPlacement,
	rotationStepForYawRadians,
	yawRadiansFor,
	type ParametricFloorItemInput,
} from "../domain/parametric-item";
import { assessParametricWallItemPlacement } from "../domain/parametric-wall-item";
import type { Project } from "../domain/project";
import { isStructurallyValidProjectV1, isStructurallyValidTelegramProject } from "../domain/project-json-transfer";
import { projectRoomLayoutView } from "../domain/room-layouts";
import {
	assessDoorOpeningPlacement,
	assessWindowOpeningPlacement,
} from "../domain/wall-opening";
import { alphaBackupFeasibilityLimits } from "./backup-feasibility-policy";
import type { RuntimeV1ProjectValidationReason } from "./portable-backup-reasons";
export type { RuntimeV1ProjectValidationReason } from "./portable-backup-reasons";

export type RuntimeV1ProjectValidationResult =
	| { readonly kind: "accepted"; readonly project: Project }
	| {
			readonly kind: "rejected";
			readonly reasonCode: RuntimeV1ProjectValidationReason;
	  };

/** Read-only domain admission after closed wire shape and before resource hashing or publication. */
export function validateRuntimeV1Project(value: unknown): RuntimeV1ProjectValidationResult {
	return isStructurallyValidProjectV1(value) ? validateProject(value) : reject("BACKUP_SCHEMA_UNREADABLE");
}

export function validateTelegramRuntimeV1Project(value: unknown): RuntimeV1ProjectValidationResult {
	return isStructurallyValidTelegramProject(value) ? validateProject(value) : reject("BACKUP_SCHEMA_UNREADABLE");
}

function validateProject(project: Project): RuntimeV1ProjectValidationResult {
	if (!withinProjectLimits(project)) return reject("BACKUP_PROJECT_LIMIT");
	if (projectUsesInteriorDetails(project) && !validateSupportedItems(project))
		return reject("BACKUP_SCHEMA_UNREADABLE");
	const derived = deriveBoundedOrthogonalFaces(project.level);
	if (derived.kind === "rejected") return derived;
	// Empty/open drawings have no bounded Room and do not require a renderable floor.
	if (derived.faces.length > 0 || project.level.rooms.length > 0) {
		const resolved = resolveOrthogonalPlanFaces(project);
		if (resolved.kind === "rejected") return resolved;
	}
	const floorInputs = new Map<string, ParametricFloorItemInput>();
	for (const item of project.assetInstances) {
		if (item.anchorClass !== "floor") continue;
		const yawRadians = yawRadiansFor(item);
		if (!Number.isFinite(yawRadians)) return reject("INVALID_DIMENSION");
		floorInputs.set(item.assetInstanceId, {
			assetDefinitionId: item.assetDefinitionId,
			...(item.catalogPreset === undefined ? {} : { catalogPreset: item.catalogPreset }),
			...(item.roomLayoutId === undefined ? {} : { roomLayoutId: item.roomLayoutId }),
			...(item.yawMilliDeg === undefined ? { yawStep: rotationStepForYawRadians(yawRadians) } : { yawMilliDeg: item.yawMilliDeg }),
			roomId: item.roomId,
			label: item.label,
			xMm: item.xMm,
			zMm: item.zMm,
			widthMm: item.widthMm,
			depthMm: item.depthMm,
			heightMm: item.heightMm,
			color: item.color,
		});
	}
	if (project.level.openings.length > 0) {
		const wallHosts = wallOpeningHostsForProject(project);
		if (!wallHosts) return reject("INVALID_WALL_HOST");
		for (const opening of project.level.openings) {
			const state = {
				wallHosts,
				openings: project.level.openings.filter(
					(other) => other.openingId !== opening.openingId,
				),
			};
			const assessed =
				opening.kind === "Door"
					? assessDoorOpeningPlacement(state, opening)
					: assessWindowOpeningPlacement(state, opening);
			if (assessed.kind === "rejected") return assessed;
		}
		if (project.level.openings.some(opening => opening.variant === "sliding") &&
			!projectOpeningsRemainValid(project)) return reject("DOOR_CLEARANCE_COLLISION");
	}
	for (const view of runtimeLayoutViews(project)) {
		for (const item of view.assetInstances) {
			if (item.anchorClass === "wall") {
				const assessed = assessParametricWallItemPlacement(view, item, item.assetInstanceId);
				if (assessed.kind === "rejected") return assessed;
			} else {
				const assessmentInput = floorInputs.get(item.assetInstanceId);
				if (!assessmentInput) return reject("INVALID_DIMENSION");
				const assessed = assessParametricFloorItemPlacement(view, assessmentInput, item.assetInstanceId);
				if (assessed.kind === "invalid") return reject(assessed.reasonCode);
			}
		}
	}
	return { kind: "accepted", project };
}

/** Both saved layouts undergo the existing placement checks in isolation. */
export function runtimeLayoutViews(project: Project): readonly Project[] {
	if (!project.roomLayouts?.length) return [project];
	return (["A", "B"] as const).map(slot => {
		const preferred = new Map(project.roomLayouts?.filter(layout => layout.slot === slot)
			.map(layout => [layout.roomId, layout.layoutId]));
		const view = projectRoomLayoutView(project, preferred);
		if (view.kind !== "accepted") throw new Error("Invalid room layout membership");
		const hostIds = new Set(view.assetInstances.map(item => item.assetInstanceId));
		return { ...project, assetInstances: view.assetInstances,
			...(project.supportedItems ? { supportedItems: project.supportedItems.filter(item => hostIds.has(item.supportAssetInstanceId)) } : {}),
		};
	});
}

/** Values are the current source-owned Project Limits, separate from the wider closed V1 grammar. */
function withinProjectLimits(project: Project): boolean {
	if (
		project.level.vertices.length > 600 ||
		project.level.wallSegments.length > 300 ||
		project.level.rooms.length > 50 ||
		project.level.openings.length > 200 ||
		project.assetInstances.length + (project.supportedItems?.length ?? 0) > 250 ||
		project.assetDefinitionRefs.length > 100
	)
		return false;
	let resourceBytes = 0;
	for (const definition of project.assetDefinitionRefs) {
		if (
			definition.byteLength >
			alphaBackupFeasibilityLimits.maxResourceBytesPerEntry
		)
			return false;
		resourceBytes += definition.byteLength;
	}
	if (resourceBytes > alphaBackupFeasibilityLimits.maxResourceBytes)
		return false;
	const vertices = new Map(
		project.level.vertices.map((vertex) => [vertex.vertexId, vertex]),
	);
	for (const wall of project.level.wallSegments) {
		const start = vertices.get(wall.startVertexId);
		const end = vertices.get(wall.endVertexId);
		if (!start || !end) return false;
		const dx = BigInt(end.xMm) - BigInt(start.xMm);
		const dz = BigInt(end.zMm) - BigInt(start.zMm);
		const squared = dx * dx + dz * dz;
		// A snapshot can contain exact contact fragments shorter than the
		// authored-wall minimum. Topology validation still rejects zero length.
		if (squared > 100_000n * 100_000n)
			return false;
	}
	return true;
}

function reject(
	reasonCode: RuntimeV1ProjectValidationReason,
): Extract<RuntimeV1ProjectValidationResult, { readonly kind: "rejected" }> {
	return { kind: "rejected", reasonCode };
}
