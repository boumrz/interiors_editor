import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { once } from "node:events";
import { readFile } from "node:fs/promises";
import { createServer } from "node:net";
import { fileURLToPath } from "node:url";
import { test } from "node:test";

const webRoot = fileURLToPath(new URL("../", import.meta.url));
const catalogRoot = new URL("../../catalog-control-plane/src/main/resources/catalog/", import.meta.url);
const envelope = JSON.parse(await readFile(new URL("catalog-envelope-source.json", catalogRoot), "utf8"));
const tinyAsset = envelope.assets.find(({ assetId }) => assetId === "evidence-wall-sconce");
const resourcePath = `/catalog-api/v1/resources/sha256/${tinyAsset.resource.sha256}`;
const resourceBytes = await readFile(new URL("evidence-assets/evidence-wall-sconce.glb", catalogRoot));

async function startPreview(context) {
	const reservation = createServer();
	reservation.listen(0, "127.0.0.1");
	await once(reservation, "listening");
	const port = reservation.address().port;
	await new Promise((resolve) => reservation.close(resolve));
	const child = spawn(process.execPath, ["scripts/serve-pwa-e2e.mjs"], {
		cwd: webRoot,
		env: { ...process.env, INTERIORS_PWA_CATALOG_ORIGIN: "", INTERIORS_PWA_SERVER_PORT: String(port) },
		stdio: ["ignore", "ignore", "pipe"],
	});
	const errors = [];
	child.stderr.on("data", (chunk) => errors.push(chunk.toString()));
	context.after(async () => {
		if (child.exitCode === null) {
			child.kill();
			await once(child, "exit");
		}
	});
	const origin = `http://127.0.0.1:${port}`;
	for (const _attempt of Array.from({ length: 50 })) {
		assert.equal(child.exitCode, null, `Preview exited: ${errors.join("")}`);
		try {
			const response = await fetch(`${origin}/`, { signal: AbortSignal.timeout(300) });
			if (response.ok) return origin;
		} catch {}
		await new Promise((resolve) => setTimeout(resolve, 40));
	}
	throw new Error(`Preview did not bind configured loopback port ${port}: ${errors.join("")}`);
}

test("the preview binds its configured port without disturbing another running preview", async (context) => {
	const origin = await startPreview(context);
	const response = await fetch(`${origin}/manifest.webmanifest`);
	assert.equal(response.status, 200);
	assert.equal((await response.json()).display, "standalone");
});

test("fixture resource HTTP preserves exact bytes, methods and bounded byte ranges", async (context) => {
	const origin = await startPreview(context);
	const resourceUrl = `${origin}${resourcePath}`;
	await context.test("GET returns the full immutable resource with its exact identity", async () => {
		const response = await fetch(resourceUrl);
		assert.equal(response.status, 200);
		assert.equal(response.headers.get("content-length"), String(resourceBytes.length));
		assert.equal(response.headers.get("content-type"), "model/gltf-binary");
		assert.equal(response.headers.get("etag"), `"${tinyAsset.resource.sha256}"`);
		assert.equal(response.headers.get("accept-ranges"), "bytes");
		assert.deepEqual(Buffer.from(await response.arrayBuffer()), resourceBytes);
	});
	for (const [name, range, start, end] of [
		["initial bounded chunk", "bytes=0-19", 0, 19],
		["middle bounded chunk", "bytes=5-20", 5, 20],
		["single final byte", `bytes=${resourceBytes.length - 1}-${resourceBytes.length - 1}`, resourceBytes.length - 1, resourceBytes.length - 1],
		["full exact range", `bytes=0-${resourceBytes.length - 1}`, 0, resourceBytes.length - 1],
		["first MiB request for a smaller model", "bytes=0-1048575", 0, resourceBytes.length - 1],
		["clamped tail", `bytes=${resourceBytes.length - 3}-${resourceBytes.length + 10}`, resourceBytes.length - 3, resourceBytes.length - 1],
	]) {
		await context.test(name, async () => {
			const response = await fetch(resourceUrl, { headers: { range } });
			assert.equal(response.status, 206);
			assert.equal(response.headers.get("content-range"), `bytes ${start}-${end}/${resourceBytes.length}`);
			assert.equal(response.headers.get("content-length"), String(end - start + 1));
			assert.deepEqual(Buffer.from(await response.arrayBuffer()), resourceBytes.subarray(start, end + 1));
		});
	}
	for (const range of ["bytes=20-19", `bytes=${resourceBytes.length}-${resourceBytes.length + 1}`, "bytes=0-", "bytes=-20", "bytes=00-19", "bytes=0-1,3-4", "bytes=0-9007199254740992", "nibbles=0-2", "prefixbytes=0-19"]) {
		await context.test(`rejects invalid or unsupported range ${range}`, async () => {
			const response = await fetch(resourceUrl, { headers: { range } });
			assert.equal(response.status, 416);
			assert.equal(response.headers.get("content-range"), `bytes */${resourceBytes.length}`);
			assert.equal((await response.arrayBuffer()).byteLength, 0);
		});
	}
	await context.test("HEAD returns full metadata without a body", async () => {
		const response = await fetch(resourceUrl, { method: "HEAD" });
		assert.equal(response.status, 200);
		assert.equal(response.headers.get("content-length"), String(resourceBytes.length));
		assert.equal((await response.arrayBuffer()).byteLength, 0);
	});
	await context.test("HEAD applies the same clamped range metadata without a body", async () => {
		const response = await fetch(resourceUrl, { method: "HEAD", headers: { range: "bytes=2-1048575" } });
		assert.equal(response.status, 206);
		assert.equal(response.headers.get("content-range"), `bytes 2-${resourceBytes.length - 1}/${resourceBytes.length}`);
		assert.equal(response.headers.get("content-length"), String(resourceBytes.length - 2));
		assert.equal((await response.arrayBuffer()).byteLength, 0);
	});
	await context.test("unsupported resource methods cannot read immutable bytes", async () => {
		const response = await fetch(resourceUrl, { method: "POST" });
		assert.equal(response.status, 405);
		assert.equal(response.headers.get("allow"), "GET, HEAD");
		assert.equal((await response.arrayBuffer()).byteLength, 0);
	});
	await context.test("unknown resource hashes return no resource", async () => {
		const response = await fetch(`${origin}/catalog-api/v1/resources/sha256/${"0".repeat(64)}`);
		assert.equal(response.status, 404);
		assert.equal((await response.arrayBuffer()).byteLength, 0);
	});
});
