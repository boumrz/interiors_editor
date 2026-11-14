import assert from "node:assert/strict";
import { test } from "node:test";
import { createServer } from "node:http";
import { mkdtemp, mkdir, writeFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
	sealTelegramRelease,
	telegramPublicConfiguration,
} from "./telegram-release-build.mjs";
import {
	createTelegramPreviewServer,
	readTelegramRelease,
} from "./telegram-preview-server.mjs";
async function release(root, name, entry = "entry-a", lazy = "lazy-a") {
	const directory = join(root, name);
	await mkdir(directory, { recursive: true });
	const entryPath = `/telegram.${name}.js`,
		lazyPath = `/lazy.${name}.js`;
	const assets = new Map([
		[entryPath, Buffer.from(entry)],
		[lazyPath, Buffer.from(lazy)],
	]);
	const html = `<html><script defer src="${entryPath}"></script><script id="telegram-loaded-release" type="application/json">__TELEGRAM_RELEASE_CAPSULE__</script><script id="telegram-deployment" type="application/json">__TELEGRAM_DEPLOYMENT__</script>__TELEGRAM_FALLBACK_LINKS__</html>`;
	const sealed = sealTelegramRelease({
		html,
		entryPath,
		assets,
		configuration: telegramPublicConfiguration({}),
	});
	const files = new Map([
		...assets,
		["/index.html", Buffer.from(sealed.html)],
		["/release-manifest.json", Buffer.from(JSON.stringify(sealed.manifest))],
		["/release-set.json", Buffer.from(JSON.stringify(sealed.releaseSet))],
	]);
	for (const [path, bytes] of files)
		await writeFile(join(directory, path.slice(1)), bytes);
	return { directory, id: sealed.manifest.appBuildId, entryPath, lazyPath };
}
const listen = async (server) => {
	await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
	return `http://127.0.0.1:${server.address().port}`;
};
test("verified complete release snapshots reject missing/corrupt lazy bytes and foreign embedded manifests", async () => {
	const root = await mkdtemp(join(tmpdir(), "tma-release-reader-"));
	try {
		const a = await release(root, "aaaa");
		assert.equal((await readTelegramRelease(a.directory)).appBuildId, a.id);
		await writeFile(join(a.directory, a.lazyPath.slice(1)), "tampered");
		await assert.rejects(readTelegramRelease(a.directory));
		const b = await release(root, "bbbb");
		await rm(join(b.directory, b.lazyPath.slice(1)));
		await assert.rejects(readTelegramRelease(b.directory));
		const c = await release(root, "cccc");
		await writeFile(join(c.directory, "release-manifest.json"), "{}");
		await assert.rejects(readTelegramRelease(c.directory));
	} finally {
		await rm(root, { recursive: true, force: true });
	}
});
test("atomic activation/rollback retains old immutable lazy URLs and refuses incomplete or conflicting sets", async () => {
	const root = await mkdtemp(join(tmpdir(), "tma-release-switch-"));
	let preview;
	try {
		const a = await release(root, "aaaa"),
			b = await release(root, "bbbb", "entry-b", "lazy-b");
		preview = await createTelegramPreviewServer({ directory: a.directory });
		const origin = await listen(preview.server);
		assert.equal(
			(await fetch(`${origin}/release-manifest.json`).then((r) => r.json()))
				.appBuildId,
			a.id,
		);
		await preview.activate(b.directory);
		assert.equal(
			(await fetch(`${origin}/release-manifest.json`).then((r) => r.json()))
				.appBuildId,
			b.id,
		);
		assert.equal(
			await fetch(origin + a.lazyPath).then((r) => r.text()),
			"lazy-a",
		);
		await preview.activate(a.directory);
		assert.equal(
			(await fetch(`${origin}/release-manifest.json`).then((r) => r.json()))
				.appBuildId,
			a.id,
		);
		assert.equal(
			await fetch(origin + b.lazyPath).then((r) => r.text()),
			"lazy-b",
		);
		const bad = await release(root, "badbad");
		await rm(join(bad.directory, bad.lazyPath.slice(1)));
		await assert.rejects(preview.activate(bad.directory));
		assert.equal(preview.activeBuildId(), a.id);
		const collision = await release(
			root,
			"aaaa",
			"different-immutable-content",
		);
		await assert.rejects(preview.activate(collision.directory));
		assert.equal(preview.activeBuildId(), a.id);
		assert.equal(
			await fetch(origin + a.entryPath).then((r) => r.text()),
			"entry-a",
		);
	} finally {
		await preview?.close();
		await rm(root, { recursive: true, force: true });
	}
});
test("delivery has exact routes, honest content types, no HTML fallback, no writes and no traversal", async () => {
	const root = await mkdtemp(join(tmpdir(), "tma-release-routing-"));
	let preview;
	try {
		const a = await release(root, "aaaa");
		preview = await createTelegramPreviewServer({ directory: a.directory });
		const origin = await listen(preview.server);
		for (const path of [
			"/missing.js",
			"/missing.css",
			"/missing.json",
			"/catalog-api/v1/catalogs/current",
			"/projects",
			"/missing/manifest.json",
			"/%2e%2e/secret",
			"//secret",
		]) {
			const response = await fetch(origin + path);
			assert.equal(response.status, 404, path);
			assert.notEqual(response.headers.get("content-type"), "text/html");
		}
		assert.equal(
			(await fetch(origin + a.entryPath)).headers.get("content-type"),
			"text/javascript; charset=utf-8",
		);
		const head = await fetch(origin + a.entryPath, { method: "HEAD" });
		assert.equal(head.status, 200);
		assert.equal(await head.text(), "");
		assert.equal(head.headers.get("x-content-type-options"), "nosniff");
		assert.equal(
			(await fetch(origin + "/", { method: "POST", body: "never-store-me" }))
				.status,
			405,
		);
		assert.match(
			(await fetch(origin + a.lazyPath)).headers.get("cache-control"),
			/immutable/,
		);
		assert.equal(
			(await fetch(origin + "/")).headers.get("cache-control"),
			"no-store",
		);
	} finally {
		await preview?.close();
		await rm(root, { recursive: true, force: true });
	}
});
test("catalog-only proxy forwards bounded methods/range metadata and never credentials, queries or Project payload", async () => {
	const root = await mkdtemp(join(tmpdir(), "tma-catalog-proxy-"));
	let preview;
	const requests = [];
	const upstream = createServer((request, response) => {
		requests.push({
			url: request.url,
			method: request.method,
			headers: request.headers,
		});
		response.writeHead(206, {
			"Content-Type": "model/gltf-binary",
			ETag: '"abc"',
			"Accept-Ranges": "bytes",
			"Content-Range": "bytes 0-2/3",
			"Set-Cookie": "must-not-forward=1",
		});
		response.end("GLB");
	});
	try {
		const upstreamOrigin = await listen(upstream),
			a = await release(root, "aaaa");
		preview = await createTelegramPreviewServer({
			directory: a.directory,
			catalogOrigin: upstreamOrigin,
		});
		const origin = await listen(preview.server),
			path = "/catalog-api/v1/resources/sha256/" + "a".repeat(64);
		const response = await fetch(origin + path, {
			headers: { Range: "bytes=0-2", "X-Telegram-Init-Data": "never-forward" },
		});
		assert.equal(response.status, 206);
		assert.equal(await response.text(), "GLB");
		assert.equal(response.headers.get("set-cookie"), null);
		assert.equal(requests[0].headers.range, "bytes=0-2");
		assert.equal(requests[0].headers["x-telegram-init-data"], undefined);
		assert.equal(requests[0].headers.cookie, undefined);
		assert.equal(requests[0].headers.authorization, undefined);
		for (const headers of [
			{ Cookie: "session=private" },
			{ Authorization: "Bearer private" },
		])
			assert.equal((await fetch(origin + path, { headers })).status, 400);
		assert.equal(
			(await fetch(origin + path + "?initData=never-forward")).status,
			404,
		);
		assert.equal(
			(await fetch(origin + path, { method: "POST", body: "user-project" }))
				.status,
			405,
		);
		assert.equal(requests.length, 1);
	} finally {
		await preview?.close();
		upstream.closeAllConnections();
		await new Promise((resolve) => upstream.close(resolve));
		await rm(root, { recursive: true, force: true });
	}
});
test("restart re-inventories every explicitly retained set before selecting the active shell", async () => {
	const root = await mkdtemp(join(tmpdir(), "tma-release-restart-"));
	let preview;
	try {
		const a = await release(root, "aaaa"),
			b = await release(root, "bbbb", "entry-b", "lazy-b");
		preview = await createTelegramPreviewServer({ directory: a.directory });
		await listen(preview.server);
		await preview.activate(b.directory);
		await preview.close();
		preview = await createTelegramPreviewServer({
			directory: b.directory,
			retainedDirectories: [a.directory],
		});
		const origin = await listen(preview.server);
		assert.equal(preview.activeBuildId(), b.id);
		assert.deepEqual(
			new Set(preview.retainedBuildIds()),
			new Set([a.id, b.id]),
		);
		assert.equal(
			await fetch(origin + a.lazyPath).then((r) => r.text()),
			"lazy-a",
		);
		await preview.activate(a.directory);
		assert.equal(
			await fetch(origin + b.lazyPath).then((r) => r.text()),
			"lazy-b",
		);
	} finally {
		await preview?.close();
		await rm(root, { recursive: true, force: true });
	}
});
async function editPackage(directory, mutate) {
	const metadataPath = join(directory, "release-set.json"),
		set = JSON.parse(
			await (await import("node:fs/promises")).readFile(metadataPath, "utf8"),
		);
	const { createHash } = await import("node:crypto");
	const replace = async (path, bytes) => {
		await mkdir(join(directory, path.slice(1), ".."), { recursive: true });
		await writeFile(join(directory, path.slice(1)), bytes);
		const entry = set.assets.find((entry) => entry.path === path);
		const descriptor = {
			path,
			byteLength: Buffer.byteLength(bytes),
			sha256: createHash("sha256").update(bytes).digest("hex"),
		};
		if (entry) Object.assign(entry, descriptor);
		else set.assets.push(descriptor);
	};
	const manifest = JSON.parse(
		await (await import("node:fs/promises")).readFile(
			join(directory, "release-manifest.json"),
			"utf8",
		),
	);
	let html = await (await import("node:fs/promises")).readFile(
		join(directory, "index.html"),
		"utf8",
	);
	const capsule = JSON.parse(
		/<script id="telegram-loaded-release" type="application\/json">([^<]*)<\/script>/.exec(
			html,
		)[1],
	);
	const context = { set, manifest, capsule, replace, html };
	await mutate(context);
	html = context.html.replace(
		/(<script id="telegram-loaded-release" type="application\/json">)[^<]*(<\/script>)/,
		(_all, start, end) => start + JSON.stringify(context.capsule) + end,
	);
	await replace("/release-manifest.json", JSON.stringify(context.manifest));
	await replace("/index.html", html);
	await writeFile(metadataPath, JSON.stringify(set));
}
test("independently coherent malformed release metadata, manifests and HTML still cannot be activated", async () => {
	const root = await mkdtemp(join(tmpdir(), "tma-release-contract-"));
	const faults = [
		(c) => {
			c.set.unexpectedPrivateField = "not-a-release-field";
		},
		(c) => {
			c.set.version = 2;
		},
		(c) => {
			c.set.deliveryTarget = "browser";
		},
		...[
			"",
			1234567890123456,
			"A".repeat(16),
			"x" + "a".repeat(16),
			"a".repeat(16) + "x",
		].map((value) => (c) => {
			c.set.appBuildId = value;
			c.manifest.appBuildId = value;
			c.capsule.manifest.appBuildId = value;
		}),
		(c) => {
			c.set.assets.push({ ...c.set.assets[0] });
		},
		(c) => {
			c.set.assets[0].unexpected = true;
		},
		(c) => {
			c.set.assets.find((entry) => entry.path.endsWith(".js")).byteLength++;
		},
		(c) => {
			c.manifest.version = 2;
			c.capsule.manifest.version = 2;
		},
		(c) => {
			c.manifest.workerProtocolVersion = 2;
			c.capsule.manifest.workerProtocolVersion = 2;
		},
		...["projectSchemas", "assetSchemas", "catalogSchemas"].map(
			(key) => (c) => {
				c.manifest[key] = { readable: [1, 2], writable: [2] };
				c.capsule.manifest[key] = c.manifest[key];
			},
		),
		(c) => {
			c.manifest.minimumCapabilities = ["unknown"];
			c.capsule.manifest.minimumCapabilities = ["unknown"];
		},
		(c) => {
			c.capsule.deliveryTarget = "browser";
		},
		(c) => {
			c.capsule.entryPath = "/telegram.foreign.js";
		},
		(c) => {
			c.capsule.manifest.appBuildId = "b".repeat(16);
		},
		(c) => {
			c.capsule.extra = true;
		},
		(c) => {
			c.html = c.html.replace(
				'data-telegram-entry="true"',
				'data-telegram-entry="true" data-telegram-entry="true"',
			);
		},
		async (c) => {
			await c.replace("/sw.js", "/* forbidden worker */");
		},
		async (c) => {
			await c.replace("/manifest.webmanifest", "{}");
		},
	];
	try {
		for (let index = 0; index < faults.length; index++) {
			const value = await release(root, `case${index}`);
			await editPackage(value.directory, faults[index]);
			await assert.rejects(
				readTelegramRelease(value.directory),
				`coherent malformed package${index}`,
			);
		}
	} finally {
		await rm(root, { recursive: true, force: true });
	}
});
test("a listed symlink outside the prepared directory cannot become a served immutable resource", async () => {
	const root = await mkdtemp(join(tmpdir(), "tma-release-symlink-"));
	try {
		const value = await release(root, "aaaa");
		const outside = join(root, "outside.js");
		await writeFile(outside, "owned test secret");
		const { symlink, readFile } = await import("node:fs/promises"),
			{ createHash } = await import("node:crypto");
		await symlink(outside, join(value.directory, "borrowed.js"));
		const metadata = JSON.parse(
			await readFile(join(value.directory, "release-set.json"), "utf8"),
		);
		metadata.assets.push({
			path: "/borrowed.js",
			byteLength: 17,
			sha256: createHash("sha256").update("owned test secret").digest("hex"),
		});
		await writeFile(
			join(value.directory, "release-set.json"),
			JSON.stringify(metadata),
		);
		await assert.rejects(readTelegramRelease(value.directory));
	} finally {
		await rm(root, { recursive: true, force: true });
	}
});
test("preview arguments preserve all retained directories and reject browser port, missing or ambiguous options", async () => {
	const { parseTelegramPreviewArguments } = await import(
		"./telegram-preview-server.mjs"
	);
	assert.deepEqual(
		parseTelegramPreviewArguments([
			"--directory",
			"/tmp/current",
			"--retain-directory",
			"/tmp/old-a",
			"--retain-directory",
			"/tmp/old-b",
		]),
		{
			directory: "/tmp/current",
			retainedDirectories: ["/tmp/old-a", "/tmp/old-b"],
			port: 0,
			catalogOrigin: undefined,
		},
	);
	assert.equal(
		parseTelegramPreviewArguments([
			"--directory",
			"/tmp/current",
			"--port",
			"4176",
			"--catalog-origin",
			"http://127.0.0.1:4174",
		]).port,
		4176,
	);
	for (const argv of [
		[],
		["--directory"],
		["--directory", "/tmp/current", "--port", "4175"],
		["--directory", "/tmp/current", "--port", "-1"],
		["--directory", "/tmp/current", "--port", "65536"],
		["--directory", "/tmp/current", "--port", "1.5"],
		["--directory", "/tmp/current", "--directory", "/tmp/other"],
		["--directory", "/tmp/current", "--unknown", "value"],
	])
		assert.throws(() => parseTelegramPreviewArguments(argv));
});
test("each served static asset has its actual MIME type, including HTML/CSS and opaque binary", async () => {
	const root = await mkdtemp(join(tmpdir(), "tma-delivery-types-"));
	let preview;
	try {
		const a = await release(root, "aaaa");
		await editPackage(a.directory, async (c) => {
			for (const [path, bytes] of [
				["/style.css", "body{}"],
				["/icon.svg", "<svg/>"],
				["/image.png", "opaque-png"],
				["/model.glb", "opaque-glb"],
				["/debug.js.map", "{}"],
				["/opaque.bin", "opaque-bytes"],
			])
				await c.replace(path, bytes);
		});
		preview = await createTelegramPreviewServer({ directory: a.directory });
		const origin = await listen(preview.server);
		for (const [path, type] of [
			["/", "text/html; charset=utf-8"],
			["/style.css", "text/css; charset=utf-8"],
			["/icon.svg", "image/svg+xml"],
			["/image.png", "image/png"],
			["/model.glb", "model/gltf-binary"],
			["/debug.js.map", "application/json"],
			["/opaque.bin", "application/octet-stream"],
		]) {
			const response = await fetch(origin + path);
			assert.equal(response.status, 200);
			assert.equal(response.headers.get("content-type"), type);
		}
	} finally {
		await preview?.close();
		await rm(root, { recursive: true, force: true });
	}
});
test("only an HTTP(S) origin without credentials, path, query or fragment can be used for catalog-only routing", async () => {
	const root = await mkdtemp(join(tmpdir(), "tma-catalog-origin-"));
	try {
		const a = await release(root, "aaaa");
		for (const catalogOrigin of [
			"ftp://example.invalid",
			"http://user@example.invalid",
			"http://:password@example.invalid",
			"http://example.invalid/path",
			"http://example.invalid/?query=1",
			"http://example.invalid/#fragment",
		])
			await assert.rejects(
				createTelegramPreviewServer({ directory: a.directory, catalogOrigin }),
			);
	} finally {
		await rm(root, { recursive: true, force: true });
	}
});
test("catalog proxy preserves response/request range metadata and rejects encoded or HTML success responses", async () => {
	const root = await mkdtemp(join(tmpdir(), "tma-catalog-representation-"));
	let preview,
		mode = "good";
	const requests = [];
	const upstream = createServer(async (request, response) => {
		requests.push(request.headers);
		if (mode === "encoded") {
			const { gzipSync } = await import("node:zlib");
			response
				.writeHead(200, {
					"Content-Type": "model/gltf-binary",
					"Content-Encoding": "gzip",
					ETag: '"abc"',
					"Accept-Ranges": "bytes",
				})
				.end(gzipSync(Buffer.from("GLB")));
		} else if (mode === "html") {
			response
				.writeHead(200, { "Content-Type": "text/html" })
				.end("<html>wrong SPA fallback</html>");
		} else if (mode === "empty") {
			response.writeHead(204).end();
		} else
			response
				.writeHead(206, {
					"Content-Type": "model/gltf-binary",
					"Content-Length": "3",
					ETag: '"abc"',
					"Accept-Ranges": "bytes",
					"Content-Range": "bytes 0-2/3",
					"Cache-Control": "public, max-age=60",
				})
				.end("GLB");
	});
	try {
		const originUpstream = await listen(upstream),
			a = await release(root, "aaaa");
		preview = await createTelegramPreviewServer({
			directory: a.directory,
			catalogOrigin: originUpstream,
		});
		const origin = await listen(preview.server),
			path = "/catalog-api/v1/resources/sha256/" + "b".repeat(64);
		const response = await fetch(origin + path, {
			headers: {
				Accept: "model/gltf-binary",
				Range: "bytes=0-2",
				"If-Range": '"abc"',
				"If-None-Match": '"old"',
			},
		});
		assert.equal(await response.text(), "GLB");
		for (const [key, value] of [
			["content-type", "model/gltf-binary"],
			["content-length", "3"],
			["etag", '"abc"'],
			["accept-ranges", "bytes"],
			["content-range", "bytes 0-2/3"],
			["cache-control", "public, max-age=60"],
		])
			assert.equal(response.headers.get(key), value);
		for (const [key, value] of [
			["accept", "model/gltf-binary"],
			["range", "bytes=0-2"],
			["if-range", '"abc"'],
			["if-none-match", '"old"'],
		])
			assert.equal(requests[0][key], value);
 assert.ok(requests[0]["accept-encoding"].split(",").every(value=>value.trim()==="identity"));
		await fetch(origin + path).then((r) => r.arrayBuffer());
		assert.equal(requests[1]["accept-encoding"], "identity");
		mode = "encoded";
		assert.equal((await fetch(origin + path)).status, 502);
		mode = "html";
		assert.equal(
			(await fetch(origin + "/catalog-api/v1/catalogs/current")).status,
			502,
		);
		mode = "empty";
		assert.equal(
			(await fetch(origin + "/catalog-api/v1/catalogs/current")).status,
			204,
		);
	} finally {
		await preview?.close();
		upstream.closeAllConnections();
		await new Promise((resolve) => upstream.close(resolve));
		await rm(root, { recursive: true, force: true });
	}
});
