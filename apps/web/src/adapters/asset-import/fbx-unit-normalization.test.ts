import { describe, expect, it } from "@rstest/core";
import { Group } from "three";

import { normalizeFbxUnitsToMetres } from "./fbx-unit-normalization";

describe("normalizeFbxUnitsToMetres", () => {
	it("converts Sketchfab's centimetre FBX scene scale into metres", () => {
		const scene = new Group();
		scene.userData.unitScaleFactor = 1;

		normalizeFbxUnitsToMetres(scene);

		expect(scene.scale.toArray()).toEqual([0.01, 0.01, 0.01]);
	});

	it("keeps an FBX already declared in metres at its original scale", () => {
		const scene = new Group();
		scene.userData.unitScaleFactor = 100;

		normalizeFbxUnitsToMetres(scene);

		expect(scene.scale.toArray()).toEqual([1, 1, 1]);
	});

	it("does not invent units when the FBX omitted a valid declared factor", () => {
		const scene = new Group();
		scene.userData.unitScaleFactor = "unknown";

		normalizeFbxUnitsToMetres(scene);

		expect(scene.scale.toArray()).toEqual([1, 1, 1]);
	});
});
