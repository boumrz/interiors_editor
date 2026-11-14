import { describe, expect, it } from "@rstest/core";
import { Texture } from "three";

import { preserveLocalTextureMimeType } from "./fbx-texture-mime";

describe("preserveLocalTextureMimeType", () => {
	it("keeps a selected JPEG sidecar as JPEG for GLB export", () => {
		const texture = new Texture();

		preserveLocalTextureMimeType(texture, "image/jpeg");

		expect(texture.userData.mimeType).toBe("image/jpeg");
	});
});
