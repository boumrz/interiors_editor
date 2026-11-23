import { createHash } from "node:crypto";
import { createServer } from "node:http";
import { readFile, realpath } from "node:fs/promises";
import { resolve, sep } from "node:path";
import { Readable } from "node:stream";
import { pipeline } from "node:stream/promises";
import { pathToFileURL } from "node:url";

const releases = new WeakMap();
const sha256 = (bytes) => createHash("sha256").update(bytes).digest("hex");
function record(value, keys) {
	return (
		value &&
		typeof value === "object" &&
		!Array.isArray(value) &&
		Object.keys(value).length === keys.length &&
		keys.every((key) => Object.hasOwn(value, key))
	);
}
function assetPath(path) {
	return (
		typeof path === "string" &&
		/^\/[A-Za-z0-9_][A-Za-z0-9_./-]*$/.test(path) &&
		!path.includes("//") &&
		path
			.split("/")
			.every(
				(segment) =>
					segment !== "." && segment !== ".." && !segment.startsWith("."),
			)
	);
}
function reject() {
	throw new Error("Telegram release set is incomplete or incompatible");
}
/** Reads every listed byte before it can become active; subsequent disk writes cannot mutate this snapshot. */
export async function readTelegramRelease(directory) {
	const root = await realpath(directory),
		metadata = await readFile(resolve(root, "release-set.json"));
	const releaseSet = JSON.parse(metadata.toString("utf8"));
	if (
		!record(releaseSet, [
			"version",
			"deliveryTarget",
			"appBuildId",
			"entryPath",
			"assets",
		]) ||
		releaseSet.version !== 1 ||
		releaseSet.deliveryTarget !== "telegram" ||
		typeof releaseSet.appBuildId !== "string" ||
		!/^[0-9a-f]{16}$/.test(releaseSet.appBuildId) ||
		!/^\/telegram\.[A-Za-z0-9_-]+\.js$/.test(releaseSet.entryPath) ||
		!Array.isArray(releaseSet.assets)
	)
		reject();
	const files = new Map();
	for (const entry of releaseSet.assets) {
		if (
			!record(entry, ["path", "byteLength", "sha256"]) ||
			!assetPath(entry.path) ||
			files.has(entry.path) ||
			!Number.isSafeInteger(entry.byteLength) ||
			entry.byteLength < 0 ||
			typeof entry.sha256 !== "string" ||
			!/^[0-9a-f]{64}$/.test(entry.sha256)
		)
			reject();
		const path = await realpath(resolve(root, entry.path.slice(1)));
		if (!path.startsWith(`${root}${sep}`)) reject();
		const bytes = await readFile(path);
		if (bytes.byteLength !== entry.byteLength || sha256(bytes) !== entry.sha256)
			reject();
		files.set(entry.path, bytes);
	}
	if (
		!files.has("/index.html") ||
		!files.has("/release-manifest.json") ||
		!files.has(releaseSet.entryPath) ||
		files.has("/sw.js") ||
		files.has("/manifest.webmanifest")
	)
		reject();
	const manifest = JSON.parse(
		files.get("/release-manifest.json").toString("utf8"),
	);
	if (
		manifest.appBuildId !== releaseSet.appBuildId ||
		manifest.version !== 1 ||
		manifest.workerProtocolVersion !== 1 ||
		!["assetSchemas", "catalogSchemas", "projectSchemas"].every(
			(key) =>
				JSON.stringify(manifest[key]) === '{"readable":[1],"writable":[1]}',
		) ||
		JSON.stringify(manifest.minimumCapabilities) !== '["indexeddb"]'
	)
		reject();
	const html = files.get("/index.html").toString("utf8");
	const capsuleMatch = html.match(
		/<script id="telegram-loaded-release" type="application\/json">([^<]*)<\/script>/g,
	);
	if (capsuleMatch?.length !== 1) reject();
	const capsule = JSON.parse(
		capsuleMatch[0].replace(/^.*?>/, "").replace(/<\/script>$/, ""),
	);
	if (
		!record(capsule, ["deliveryTarget", "entryPath", "manifest"]) ||
		capsule.deliveryTarget !== "telegram" ||
		capsule.entryPath !== releaseSet.entryPath ||
		JSON.stringify(capsule.manifest) !== JSON.stringify(manifest) ||
		html.split('data-telegram-entry="true"').length !== 2 ||
		!html.includes(`data-telegram-entry="true" src="${releaseSet.entryPath}"`)
	)
		reject();
	files.set("/release-set.json", metadata);
	const release = Object.freeze({ appBuildId: releaseSet.appBuildId });
	releases.set(release, files);
	return release;
}
function catalogConfiguration(value) {
	if (value === undefined) return undefined;
	const url = new URL(value);
	if (
		!["http:", "https:"].includes(url.protocol) ||
		url.username ||
		url.password ||
		url.pathname !== "/" ||
		url.search ||
		url.hash
	)
		throw new Error("A catalog-only origin is required");
	return url.origin;
}
const controls = new Set([
	"/index.html",
	"/release-manifest.json",
	"/release-set.json",
	"/legal/privacy-policy.html",
	"/legal/license-agreement.html",
	"/legal/analytics-consent.html",
]);
const contentType = (path) =>
	path.endsWith(".html")
		? "text/html; charset=utf-8"
		: path.endsWith(".js")
			? "text/javascript; charset=utf-8"
			: path.endsWith(".css")
				? "text/css; charset=utf-8"
				: path.endsWith(".json") || path.endsWith(".map")
					? "application/json"
					: path.endsWith(".svg")
						? "image/svg+xml"
						: path.endsWith(".png")
							? "image/png"
							: path.endsWith(".glb")
								? "model/gltf-binary"
								: "application/octet-stream";
/** Local rehearsal server only. Activation/rollback are in-process operations, never public HTTP write endpoints. */
export async function createTelegramPreviewServer({
	directory,
	catalogOrigin,
	retainedDirectories = [],
}) {
	const catalog = catalogConfiguration(catalogOrigin),
		immutable = new Map(),
		retained = new Map();
	let active;
	const activate = async (candidateDirectory) => {
		const release = await readTelegramRelease(candidateDirectory),
			files = releases.get(release),
			prior = retained.get(release.appBuildId);
		if (
			prior &&
			[...controls].some((path) => {
				const previous = releases.get(prior).get(path);
				const current = files.get(path);
				return current ? !previous?.equals(current) : previous !== undefined;
			})
		)
			reject();
		for (const [path, bytes] of files)
			if (
				!controls.has(path) &&
				immutable.has(path) &&
				!immutable.get(path).equals(bytes)
			)
				throw new Error("Immutable Telegram URL collision");
		for (const [path, bytes] of files)
			if (!controls.has(path)) immutable.set(path, bytes);
		retained.set(release.appBuildId, release);
		active = release;
		return release.appBuildId;
	};
	for (const retainedDirectory of retainedDirectories)
		await activate(retainedDirectory);
	await activate(directory);
	const server = createServer(async (request, response) => {
		response.setHeader("X-Content-Type-Options", "nosniff");
		response.setHeader("Referrer-Policy", "no-referrer");
		const finish = (status) => {
			response.writeHead(status, { "Cache-Control": "no-store" }).end();
		};
		if (request.method !== "GET" && request.method !== "HEAD") {
			finish(405);
			return;
		}
		const rawPath = request.url?.split("?", 1)[0];
		if (
			!rawPath ||
			!rawPath.startsWith("/") ||
			rawPath.includes("%") ||
			rawPath.includes("//") ||
			rawPath.includes("\\") ||
			rawPath.split("/").some((part) => part === "." || part === "..")
		) {
			finish(404);
			return;
		}
		const url = new URL(request.url, "http://127.0.0.1");
		if (url.pathname.startsWith("/catalog-api/")) {
			if (
				!catalog ||
				url.search ||
				!/^\/catalog-api\/v1\/(?:catalogs\/current|resources\/sha256\/[0-9a-f]{64})$/.test(
					url.pathname,
				)
			) {
				finish(404);
				return;
			}
			if (
				request.headers.cookie !== undefined ||
				request.headers.authorization !== undefined ||
				request.headers["transfer-encoding"] !== undefined ||
				(request.headers["content-length"] !== undefined &&
					request.headers["content-length"] !== "0")
			) {
				finish(400);
				return;
			}
			const cancellation = new AbortController(),
				timeout = setTimeout(() => cancellation.abort(), 15_000);
			const abort = () => cancellation.abort();
			response.on("close", abort);
			try {
				const headers = new Headers();
				headers.set("Accept-Encoding", "identity");
				for (const key of ["accept", "range", "if-range", "if-none-match"])
					if (typeof request.headers[key] === "string")
						headers.set(key, request.headers[key]);
				const upstream = await fetch(catalog + url.pathname, {
					method: request.method,
					headers,
					credentials: "omit",
					redirect: "error",
					signal: cancellation.signal,
				});
				const mediaType = upstream.headers
					.get("content-type")
					?.split(";", 1)[0]
					?.trim()
					.toLowerCase();
				if (
					upstream.headers.has("content-encoding") ||
					(upstream.ok &&
						(mediaType === "text/html" ||
							mediaType === "application/xhtml+xml"))
				) {
					await upstream.body?.cancel();
					finish(502);
					return;
				}
				const outgoing = {};
				for (const key of [
					"content-type",
					"content-length",
					"etag",
					"accept-ranges",
					"content-range",
					"cache-control",
				]) {
					const value = upstream.headers.get(key);
					if (value !== null) outgoing[key] = value;
				}
				response.writeHead(upstream.status, outgoing);
				if (request.method === "HEAD" || !upstream.body) response.end();
				else await pipeline(Readable.fromWeb(upstream.body), response);
			} catch {
				if (!response.headersSent) finish(502);
				else response.destroy();
			} finally {
				clearTimeout(timeout);
				response.removeListener("close", abort);
			}
			return;
		}
		const path = url.pathname === "/" ? "/index.html" : url.pathname;
		const bytes = controls.has(path)
			? releases.get(active).get(path)
			: immutable.get(path);
		if (!bytes) {
			finish(404);
			return;
		}
		response.writeHead(200, {
			"Content-Type": contentType(path),
			"Content-Length": bytes.byteLength,
			"Cache-Control": controls.has(path)
				? "no-store"
				: "public, max-age=31536000, immutable",
		});
		response.end(request.method === "HEAD" ? undefined : bytes);
	});
	return {
		server,
		activate,
		activeBuildId: () => active.appBuildId,
		retainedBuildIds: () => [...retained.keys()],
		close: async () => {
			server.closeAllConnections();
			if (server.listening)
				await new Promise((resolveClose, rejectClose) =>
					server.close((error) =>
						error ? rejectClose(error) : resolveClose(),
					),
				);
		},
	};
}

export function parseTelegramPreviewArguments(arguments_) {
	const options = new Map(),
		retainedDirectories = [];
	for (let index = 0; index < arguments_.length; index += 2) {
		const key = arguments_[index],
			value = arguments_[index + 1];
		if (
			![
				"--directory",
				"--port",
				"--catalog-origin",
				"--retain-directory",
			].includes(key) ||
			!value
		)
			throw new Error(
				"Use --directory, optional --port, --catalog-origin and repeatable --retain-directory",
			);
		if (key === "--retain-directory") retainedDirectories.push(value);
		else {
			if (options.has(key))
				throw new Error("A preview option cannot be repeated");
			options.set(key, value);
		}
	}
	if (!options.has("--directory"))
		throw new Error("A prepared Telegram release directory is required");
	const port = Number(options.get("--port") ?? 0);
	if (!Number.isSafeInteger(port) || port < 0 || port > 65535 || port === 4175)
		throw new Error("Use a separate Telegram preview port");
	return {
		directory: options.get("--directory"),
		retainedDirectories,
		port,
		catalogOrigin: options.get("--catalog-origin"),
	};
}
if (
	process.argv[1] &&
	import.meta.url === pathToFileURL(resolve(process.argv[1])).href
) {
	await import("./check-runtime.mjs");
	const options = parseTelegramPreviewArguments(process.argv.slice(2));
	const preview = await createTelegramPreviewServer(options);
	await new Promise((resolveListen) =>
		preview.server.listen(options.port, "127.0.0.1", resolveListen),
	);
	process.stdout.write(
		`Telegram rehearsal: http://127.0.0.1:${preview.server.address().port} (${preview.activeBuildId()})\n`,
	);
	for (const signal of ["SIGINT", "SIGTERM"])
		process.once(signal, () => void preview.close());
}
