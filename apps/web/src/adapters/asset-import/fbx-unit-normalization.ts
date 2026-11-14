import type { Object3D } from "three";

const CENTIMETRES_PER_METRE = 100;

/**
 * FBX GlobalSettings.UnitScaleFactor is expressed in centimetres. Three's
 * FBXLoader exposes it but intentionally leaves scene coordinates untouched;
 * GLB, however, is metre based. Preserve the source's declared unit before
 * measuring, previewing or placing the converted static model.
 */
export function normalizeFbxUnitsToMetres(scene: Object3D): void {
	const unitScaleFactor = scene.userData.unitScaleFactor;
	if (
		typeof unitScaleFactor !== "number" ||
		!Number.isFinite(unitScaleFactor) ||
		unitScaleFactor <= 0
	) {
		return;
	}
	scene.scale.multiplyScalar(unitScaleFactor / CENTIMETRES_PER_METRE);
}
