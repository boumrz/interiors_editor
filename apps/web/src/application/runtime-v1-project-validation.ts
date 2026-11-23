import {
	deriveBoundedOrthogonalFaces,
} from "../domain/derive-plan-faces";
import {
	resolveOrthogonalPlanFaces,
} from "../domain/derived-orthogonal-plan-faces";
import { wallOpeningHostsForProject } from "../domain/door-opening-project";
import {
	assessParametricFloorItemPlacement,
	rotationStepForYawRadians,
	yawRadiansFor,
	type ParametricFloorItemInput,
} from "../domain/parametric-item";
import {
	assessParametricWallItemPlacement,
} from "../domain/parametric-wall-item";
import type { Project } from "../domain/project";
import { isStructurallyValidProjectV1 } from "../domain/project-json-transfer";
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
export function validateRuntimeV1Project(
	value: unknown,
): RuntimeV1ProjectValidationResult {
	if (!isStructurallyValidProjectV1(value))
		return reject("BACKUP_SCHEMA_UNREADABLE");
	const project = value;
	if (!withinProjectLimits(project)) return reject("BACKUP_PROJECT_LIMIT");
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
	}
	for (const item of project.assetInstances) {
		if (item.anchorClass === "wall") {
			const assessed = assessParametricWallItemPlacement(
				project,
				item,
				item.assetInstanceId,
			);
			if (assessed.kind === "rejected") return assessed;
		} else {
			const assessmentInput = floorInputs.get(item.assetInstanceId);
			if (!assessmentInput) return reject("INVALID_DIMENSION");
			const assessed = assessParametricFloorItemPlacement(
				project,
				assessmentInput,
				item.assetInstanceId,
			);
			if (assessed.kind === "invalid") return reject(assessed.reasonCode);
		}
	}
	return { kind: "accepted", project };
}

/** Values are the current source-owned Project Limits, separate from the wider closed V1 grammar. */
function withinProjectLimits(project: Project): boolean {
	if (
		project.level.vertices.length > 600 ||
		project.level.wallSegments.length > 300 ||
		project.level.rooms.length > 50 ||
		project.level.openings.length > 200 ||
		project.assetInstances.length > 250 ||
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
