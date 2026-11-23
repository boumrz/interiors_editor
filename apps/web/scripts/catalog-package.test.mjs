import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { mkdtemp, readFile, readdir, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";
import { fileURLToPath } from "node:url";

const webRoot = fileURLToPath(new URL("../", import.meta.url));
const catalogRoot = new URL("../../catalog-control-plane/src/main/resources/catalog/", import.meta.url);

test("a clean production bundle contains every exact advertised fixture resource", { timeout: 60_000 }, async (context) => {
	const directory = await mkdtemp(join(tmpdir(), "interiors-catalog-package-"));
	context.after(() => rm(directory, { recursive: true, force: true }));
	const outputRoot = join(directory, "dist");
	const build = spawnSync(process.execPath, [
		"node_modules/@rspack/cli/bin/rspack.js", "build", "--mode", "production", "--config", "rspack.config.mjs", "--output-path", outputRoot,
	], { cwd: webRoot, encoding: "utf8", timeout: 45_000 });
	assert.equal(build.status, 0, build.stdout + build.stderr);
	const envelope = JSON.parse(await readFile(new URL("catalog-envelope-source.json", catalogRoot), "utf8"));
	const fileMap = JSON.parse(await readFile(new URL("catalog-resource-files-v1.json", catalogRoot), "utf8"));
	const retired = new Set(["armchair-kursi-sofa", "wooden-cabinet", "zen-dining-chair"].flatMap(name => [name + ".glb", name + ".png"]));
	assert.deepEqual((await readdir(join(outputRoot, "catalog"))).filter(name => retired.has(name)), []);
	const descriptors = envelope.assets.flatMap((asset) => [
		asset.resource,
		...(asset.thumbnail ? [asset.thumbnail] : []),
		...asset.variantSlots.flatMap((slot) => slot.variants.map((variant) => variant.resource)),
	]);
	assert.equal(Object.keys(fileMap).length, new Set(descriptors.map(({ sha256 }) => sha256)).size);
	for (const descriptor of descriptors) {
		await context.test(`${fileMap[descriptor.sha256]} is packaged with its advertised bytes and hash`, async () => {
			const resource = await readFile(join(outputRoot, "catalog", fileMap[descriptor.sha256]));
			assert.equal(resource.length, descriptor.byteLength);
			assert.equal(createHash("sha256").update(resource).digest("hex"), descriptor.sha256);
		});
	}
});
