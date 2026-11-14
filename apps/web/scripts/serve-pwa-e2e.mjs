import { createHash } from "node:crypto";
import { createReadStream, readFileSync, statSync } from "node:fs";
import { createServer, request as httpRequest } from "node:http";
import { extname, resolve, sep } from "node:path";

const host = "127.0.0.1";
const port = Number(process.env.INTERIORS_PWA_SERVER_PORT ?? 4175);
const catalogOrigin = process.env.INTERIORS_PWA_CATALOG_ORIGIN
	? new URL(process.env.INTERIORS_PWA_CATALOG_ORIGIN)
	: undefined;
const distRoot = resolve("dist");
const catalogFixtureRoot = resolve(
	"../catalog-control-plane/src/main/resources/catalog",
);
const catalogFixtureEnvelope = readFileSync(
	resolve(catalogFixtureRoot, "catalog-envelope-source.json"),
);
const catalogFixtureHash = createHash("sha256")
	.update(catalogFixtureEnvelope)
	.digest("hex");
const catalogFixtureResources = JSON.parse(
	readFileSync(
		resolve(catalogFixtureRoot, "catalog-resource-files-v1.json"),
		"utf8",
	),
);
const mimeTypes = new Map([
	[".css", "text/css; charset=utf-8"],
	[".html", "text/html; charset=utf-8"],
	[".js", "text/javascript; charset=utf-8"],
	[".json", "application/json; charset=utf-8"],
	[".png", "image/png"],
	[".svg", "image/svg+xml"],
	[".webmanifest", "application/manifest+json; charset=utf-8"],
]);

createServer((incoming, outgoing) => {
	const url = new URL(incoming.url ?? "/", `http://${host}:${port}`);
	if (url.pathname.startsWith("/catalog-api/")) {
		if (catalogOrigin) proxyCatalog(incoming, outgoing, url);
		else serveCatalogFixture(incoming, outgoing, url);
		return;
	}
	serveStatic(incoming, outgoing, url);
}).listen(port, host);

function proxyCatalog(incoming, outgoing, url) {
	if (!catalogOrigin) return;
	const upstream = httpRequest(
		{
			headers: incoming.headers,
			hostname: catalogOrigin.hostname,
			method: incoming.method,
			path: `${url.pathname}${url.search}`,
			port: catalogOrigin.port,
		},
		(response) => {
			outgoing.writeHead(response.statusCode ?? 502, response.headers);
			response.pipe(outgoing);
		},
	);
	upstream.on("error", () => {
		outgoing.writeHead(502, { "cache-control": "no-store", "content-length": "0" });
		outgoing.end();
	});
	incoming.pipe(upstream);
}

/**
 * PWA scenarios need a real service-worker fetch path, but not a running
 * Kotlin/PostgreSQL control plane. This immutable fixture mirrors the normal
 * browser fake; live control-plane evidence remains opt-in through
 * INTERIORS_PWA_CATALOG_ORIGIN.
 */
function serveCatalogFixture(incoming, outgoing, url) {
	if (url.pathname === "/catalog-api/v1/catalogs/current") {
		if (incoming.method !== "GET") {
			outgoing.writeHead(405, { allow: "GET", "content-length": "0" });
			outgoing.end();
			return;
		}
		outgoing.writeHead(200, {
			"cache-control": "no-cache, max-age=0, must-revalidate",
			"content-length": String(catalogFixtureEnvelope.byteLength),
			"content-type": "application/json; charset=utf-8",
			etag: `"${catalogFixtureHash}"`,
		});
		outgoing.end(catalogFixtureEnvelope);
		return;
	}

	const resourceMatch = url.pathname.match(
		/^\/catalog-api\/v1\/resources\/sha256\/([0-9a-f]{64})$/,
	);
	const filename = resourceMatch
		? catalogFixtureResources[resourceMatch[1]]
		: undefined;
	if (!filename || typeof filename !== "string") {
		outgoing.writeHead(404, { "content-length": "0" });
		outgoing.end();
		return;
	}
	if (incoming.method !== "GET" && incoming.method !== "HEAD") {
		outgoing.writeHead(405, { allow: "GET, HEAD", "content-length": "0" });
		outgoing.end();
		return;
	}
	const filePath = resolve(distRoot, "catalog", filename);
	if (!filePath.startsWith(`${distRoot}${sep}`)) {
		outgoing.writeHead(400, { "content-length": "0" });
		outgoing.end();
		return;
	}
	let stats;
	try {
		stats = statSync(filePath);
	} catch {
		outgoing.writeHead(404, { "content-length": "0" });
		outgoing.end();
		return;
	}
	if (!stats.isFile()) {
		outgoing.writeHead(404, { "content-length": "0" });
		outgoing.end();
		return;
	}
	const range = rangeFor(incoming.headers.range, stats.size);
	if (range === "invalid") {
		outgoing.writeHead(416, {
			"content-range": `bytes */${stats.size}`,
			"content-length": "0",
		});
		outgoing.end();
		return;
	}
	const contentType = filename.endsWith(".png")
		? "image/png"
		: "model/gltf-binary";
	const [start, end] = range ?? [0, stats.size - 1];
	const length = end - start + 1;
	outgoing.writeHead(range ? 206 : 200, {
		"accept-ranges": "bytes",
		"cache-control": "public, max-age=31536000, immutable",
		"content-length": String(length),
		"content-type": contentType,
		...(range ? { "content-range": `bytes ${start}-${end}/${stats.size}` } : {}),
		etag: `"${resourceMatch[1]}"`,
	});
	if (incoming.method === "HEAD") outgoing.end();
	else createReadStream(filePath, { end, start }).pipe(outgoing);
}

function rangeFor(header, byteLength) {
	if (header === undefined) return undefined;
	const match = /^bytes=(0|[1-9][0-9]*)-(0|[1-9][0-9]*)$/.exec(header);
	if (!match) return "invalid";
	const start = Number(match[1]);
	const end = Number(match[2]);
	return !Number.isSafeInteger(start) || !Number.isSafeInteger(end) ||
		start > end || start >= byteLength
		? "invalid"
		: [start, Math.min(end, byteLength - 1)];
}

function serveStatic(incoming, outgoing, url) {
	if (incoming.method !== "GET" && incoming.method !== "HEAD") {
		outgoing.writeHead(405, { allow: "GET, HEAD", "content-length": "0" });
		outgoing.end();
		return;
	}
	const requestedPath = url.pathname === "/" ? "/index.html" : url.pathname;
	let filePath = resolve(distRoot, `.${requestedPath}`);
	if (!filePath.startsWith(`${distRoot}${sep}`)) {
		outgoing.writeHead(400, { "content-length": "0" });
		outgoing.end();
		return;
	}
	let stats;
	try {
		stats = statSync(filePath);
	} catch {
		filePath = resolve(distRoot, "index.html");
		stats = statSync(filePath);
	}
	if (!stats.isFile()) {
		outgoing.writeHead(404, { "content-length": "0" });
		outgoing.end();
		return;
	}
	outgoing.writeHead(200, {
		"cache-control": "no-cache",
		"content-length": String(stats.size),
		"content-type": mimeTypes.get(extname(filePath)) ?? "application/octet-stream",
	});
	if (incoming.method === "HEAD") outgoing.end();
	else createReadStream(filePath).pipe(outgoing);
}
