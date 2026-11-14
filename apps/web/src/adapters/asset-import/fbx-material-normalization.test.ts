import { describe, expect, it } from "@rstest/core";
import { Group, Mesh, MeshPhongMaterial, Texture } from "three";

import { normalizeStaticFbxMaterialLighting } from "./fbx-material-normalization";

describe("normalizeStaticFbxMaterialLighting", () => {
	it("removes an exporter-default white emissive channel that would wash out a textured static FBX", () => {
		const material = new MeshPhongMaterial({
			emissive: "#ffffff",
			map: new Texture(),
		});
		const scene = new Group();
		scene.add(new Mesh(undefined, material));

		normalizeStaticFbxMaterialLighting(scene);

		expect(material.emissive.getHex()).toBe(0x000000);
	});

	it("preserves intentionally coloured or texture-driven emission", () => {
		const coloured = new MeshPhongMaterial({ emissive: "#ff6600" });
		const textureDriven = new MeshPhongMaterial({
			emissive: "#ffffff",
			emissiveMap: new Texture(),
		});
		const scene = new Group();
		scene.add(new Mesh(undefined, [coloured, textureDriven]));

		normalizeStaticFbxMaterialLighting(scene);

		expect(coloured.emissive.getHex()).toBe(0xff6600);
		expect(textureDriven.emissive.getHex()).toBe(0xffffff);
	});

	it("uses the documented near-white boundary without suppressing a dimmer real emission", () => {
		const exporterSentinel = new MeshPhongMaterial();
		exporterSentinel.emissive.setRGB(0.99, 0.99, 0.99);
		const dimmerEmission = new MeshPhongMaterial();
		dimmerEmission.emissive.setRGB(0.989, 0.989, 0.989);
		const scene = new Group();
		scene.add(new Mesh(undefined, [exporterSentinel, dimmerEmission]));

		normalizeStaticFbxMaterialLighting(scene);

		expect(exporterSentinel.emissive.getHex()).toBe(0x000000);
		expect(dimmerEmission.emissive.r).toBeCloseTo(0.989);
	});
});
