import { describe, expect, it } from "@rstest/core";

import { disposeThreeObject3D } from "./three-resource-disposal";

describe("disposeThreeObject3D", () => {
	it("releases geometries, materials, textures and ImageBitmaps together", () => {
		let geometryDisposed = 0;
		let materialDisposed = 0;
		let textureDisposed = 0;
		let imageClosed = 0;
		const root = {
			traverse(visitor: (node: unknown) => void) {
				visitor({
					geometry: { dispose: () => geometryDisposed++ },
					material: {
						map: {
							dispose: () => textureDisposed++,
							image: { close: () => imageClosed++ },
						},
						dispose: () => materialDisposed++,
					},
				});
			},
		};

		disposeThreeObject3D(root as never);

		expect(geometryDisposed).toBe(1);
		expect(materialDisposed).toBe(1);
		expect(textureDisposed).toBe(1);
		expect(imageClosed).toBe(1);
	});
});
