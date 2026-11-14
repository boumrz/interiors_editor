import { describe, expect, it } from "@rstest/core";
import { Group, Mesh, MeshStandardMaterial, PlaneGeometry, Texture } from "three";

import { materializeGlbTextureSources } from "./glb-texture-materialization";

describe("materializeGlbTextureSources", () => {
	it("copies a decoded texture into renderer-owned canvas pixels before the source ImageBitmap can detach", () => {
		let closeCalls = 0;
		const close = () => {
			closeCalls += 1;
		};
		const decodedImage = { close, height: 8, width: 12 };
		const texture = new Texture(decodedImage as never);
		const material = new MeshStandardMaterial({ map: texture });
		const root = new Group();
		root.add(new Mesh(new PlaneGeometry(), material));
		let drawImageArguments: unknown[] | undefined;
		const canvas = {
			height: 0,
			width: 0,
			getContext: (kind: string) => ({
				drawImage: (...arguments_: unknown[]) => {
					drawImageArguments = [kind, ...arguments_];
			},
			}),
		};
		const textureVersionBefore = texture.version;

		const result = materializeGlbTextureSources(root, () => canvas as never);

		expect(result).toBe(true);
		expect(canvas).toMatchObject({ height: 8, width: 12 });
		expect(drawImageArguments).toEqual(["2d", decodedImage, 0, 0, 12, 8]);
		expect(texture.image).toBe(canvas);
		expect(texture.version).toBeGreaterThan(textureVersionBefore);
		expect(closeCalls).toBe(1);
	});

	it("copies a texture shared by multiple imported materials once and leaves an unusable image untouched", () => {
		let closeCalls = 0;
		const close = () => {
			closeCalls += 1;
		};
		const decodedImage = { close, height: 10, width: 10 };
		const sharedTexture = new Texture(decodedImage as never);
		let unusableCloseCalls = 0;
		const unusableImage = {
			close: () => {
				unusableCloseCalls += 1;
			},
			height: 0,
			width: 10,
		};
		const unusableTexture = new Texture(unusableImage as never);
		const root = new Group();
		root.add(
			new Mesh(
				new PlaneGeometry(),
				[
					new MeshStandardMaterial({ map: sharedTexture }),
					new MeshStandardMaterial({ normalMap: sharedTexture }),
					new MeshStandardMaterial({ map: unusableTexture }),
				],
			),
		);
		let canvasCreateCalls = 0;
		const createCanvas = () => {
			canvasCreateCalls += 1;
			return {
				height: 0,
				width: 0,
				getContext: () => ({ drawImage: () => undefined }),
			};
		};

		const result = materializeGlbTextureSources(root, () => createCanvas() as never);

		expect(result).toBe(true);
		expect(canvasCreateCalls).toBe(1);
		expect(closeCalls).toBe(1);
		expect(unusableTexture.image).toBe(unusableImage);
		expect(unusableCloseCalls).toBe(0);
	});

	it("copies one decoded image once when separate texture objects alias it, then closes the source after every alias is safe", () => {
		let closeCalls = 0;
		const decodedImage = {
			close: () => {
				closeCalls += 1;
			},
			height: 10,
			width: 14,
		};
		const firstTexture = new Texture(decodedImage as never);
		const secondTexture = new Texture(decodedImage as never);
		const secondTextureVersionBefore = secondTexture.version;
		const root = new Group();
		root.add(
			new Mesh(
				new PlaneGeometry(),
				[
					new MeshStandardMaterial({ map: firstTexture }),
					new MeshStandardMaterial({ normalMap: secondTexture }),
				],
			),
		);
		let canvasCreateCalls = 0;
		const canvas = {
			height: 0,
			width: 0,
			getContext: () => ({ drawImage: () => undefined }),
		};

		const result = materializeGlbTextureSources(root, () => {
			canvasCreateCalls += 1;
			return canvas as never;
		});

		expect(result).toBe(true);
		expect(canvasCreateCalls).toBe(1);
		expect(firstTexture.image).toBe(canvas);
		expect(secondTexture.image).toBe(canvas);
		expect(secondTexture.version).toBeGreaterThan(secondTextureVersionBefore);
		expect(closeCalls).toBe(1);
	});

	it("ignores missing, primitive, and zero-sized image sources before canvas allocation", () => {
		const missingImageTexture = new Texture(undefined as never);
		const primitiveImageTexture = new Texture("unreadable" as never);
		const zeroWidthTexture = new Texture({ height: 10, width: 0 } as never);
		const fractionalHeightTexture = new Texture({ height: 10.5, width: 10 } as never);
		const textureLikeButNotTexture = {
			dispose: "not a function",
			image: { height: 10, width: 10 },
		};
		const nonTextureMaterial = new MeshStandardMaterial();
		Object.assign(nonTextureMaterial as object, { map: textureLikeButNotTexture });
		const root = new Group();
		root.add(
			new Mesh(
				new PlaneGeometry(),
				new MeshStandardMaterial({
					map: missingImageTexture,
					metalnessMap: fractionalHeightTexture,
					normalMap: primitiveImageTexture,
					roughnessMap: zeroWidthTexture,
				}),
			),
		);
		root.add(new Mesh(new PlaneGeometry(), nonTextureMaterial));
		let canvasCreateCalls = 0;

		const result = materializeGlbTextureSources(root, () => {
			canvasCreateCalls += 1;
			return {
				height: 0,
				width: 0,
				getContext: () => ({ drawImage: () => undefined }),
			} as never;
		});

		expect(result).toBe(true);
		expect(canvasCreateCalls).toBe(0);
		expect(missingImageTexture.image).toBeNull();
		expect(primitiveImageTexture.image).toBe("unreadable");
		expect(zeroWidthTexture.image).toMatchObject({ height: 10, width: 0 });
		expect(fractionalHeightTexture.image).toMatchObject({ height: 10.5, width: 10 });
		expect(textureLikeButNotTexture.image).toMatchObject({ height: 10, width: 10 });
	});

	it("uses the browser canvas factory, allows image sources without close, and preserves sources when copying fails", () => {
		const sourceWithoutClose = { height: 7, width: 6 };
		const copiedTexture = new Texture(sourceWithoutClose as never);
		const root = new Group();
		root.add(new Mesh(new PlaneGeometry(), new MeshStandardMaterial({ map: copiedTexture })));
		const canvas = {
			height: 0,
			width: 0,
			getContext: () => ({ drawImage: () => undefined }),
		};
		const previousDocument = Object.getOwnPropertyDescriptor(globalThis, "document");
		const createdTags: string[] = [];
		Object.defineProperty(globalThis, "document", {
			configurable: true,
			value: {
				createElement: (tag: string) => {
					createdTags.push(tag);
					return canvas;
				},
			},
		});
		let browserFactoryResult: boolean;
		try {
			browserFactoryResult = materializeGlbTextureSources(root);
		} finally {
			if (previousDocument) {
				Object.defineProperty(globalThis, "document", previousDocument);
			} else {
				Reflect.deleteProperty(globalThis, "document");
			}
		}

		expect(createdTags).toEqual(["canvas"]);
		expect(browserFactoryResult).toBe(true);
		expect(copiedTexture.image).toBe(canvas);

		const throwingImage = { height: 4, width: 3 };
		const throwingTexture = new Texture(throwingImage as never);
		const throwingRoot = new Group();
		throwingRoot.add(
			new Mesh(new PlaneGeometry(), new MeshStandardMaterial({ map: throwingTexture })),
		);
		const failedCopyResult = materializeGlbTextureSources(throwingRoot, () => ({
			height: 0,
			width: 0,
			getContext: () => ({
				drawImage: () => {
					throw new Error("copy failed");
				},
			}),
		}) as never);

		expect(failedCopyResult).toBe(false);
		expect(throwingTexture.image).toBe(throwingImage);

		const contextlessImage = { height: 4, width: 3 };
		const contextlessTexture = new Texture(contextlessImage as never);
		const contextlessRoot = new Group();
		contextlessRoot.add(
			new Mesh(
				new PlaneGeometry(),
				new MeshStandardMaterial({ map: contextlessTexture }),
			),
		);
		const missingContextResult = materializeGlbTextureSources(
			contextlessRoot,
			() => ({
				height: 0,
				width: 0,
				getContext: () => null,
			}) as never,
		);

		expect(missingContextResult).toBe(false);
		expect(contextlessTexture.image).toBe(contextlessImage);
	});
});
