import { expect, it } from "@rstest/core";
import { createTelegramDiagnostics } from "./telegram-diagnostics";

const manifest = {
	version: 1,
	workerProtocolVersion: 1,
	appBuildId: "build-2026.11.05",
	minimumCapabilities: ["indexeddb"],
	projectSchemas: { readable: [1], writable: [1] },
	assetSchemas: { readable: [1], writable: [1] },
	catalogSchemas: { readable: [1], writable: [1] },
};
it("starts with stable honest unchecked diagnostics and performs no capability probe", () => {
	const diagnostics = createTelegramDiagnostics({
		manifest,
		secureContext: true,
		webLocks: true,
	});
	const record = diagnostics.snapshot();
	expect(diagnostics.snapshot()).toBe(record);
	expect(record).toMatchObject({
		version: 1,
		target: "telegram",
		appBuildId: manifest.appBuildId,
		catalogVersion: "not-observed",
		phase: "checking",
		reason: "checking",
		capabilities: {
			indexeddb: "not-checked",
			webgl2: "not-checked",
			secureContext: true,
			webLocks: true,
		},
	});
});
it("captures only owned technical versions, capabilities and a stable specific reason", () => {
	const owned = structuredClone(manifest),
		diagnostics = createTelegramDiagnostics({
			manifest: owned,
			secureContext: true,
			webLocks: true,
		});
	diagnostics.update({
		phase: "verification",
		reason: "invalid-signature",
		capabilities: { indexeddb: true, webgl2: false },
		catalogVersion: "catalog-2026-11",
	});
	const record = diagnostics.snapshot();
	owned.projectSchemas.readable.push(99);
	owned.appBuildId = "modified";
	expect(record).toMatchObject({
		appBuildId: "build-2026.11.05",
		catalogVersion: "catalog-2026-11",
		phase: "verification",
		reason: "invalid-signature",
		schemas: {
			project: { readable: [1], writable: [1] },
			asset: { readable: [1], writable: [1] },
			catalog: { readable: [1], writable: [1] },
		},
		capabilities: { indexeddb: true, webgl2: false },
	});
	expect(Object.isFrozen(record)).toBe(true);
	expect(Object.isFrozen(record.schemas.project)).toBe(true);
});
it("never copies raw errors, launch data, account identity, Project contents or file paths", () => {
	const diagnostics = createTelegramDiagnostics({
		manifest,
		secureContext: true,
		webLocks: true,
	});
	const input = {
		phase: "verification" as const,
		reason: "invalid-signature",
		initData: "SECRET_INIT",
		token: "SECRET_TOKEN",
		username: "SECRET_PERSON",
		project: { geometry: "SECRET_GEOMETRY" },
		glb: "SECRET_GLB",
		path: "/SECRET_PATH/model.glb",
	};
	diagnostics.update(input);
	expect(JSON.stringify(diagnostics.snapshot())).not.toContain("SECRET_");
	diagnostics.update({
		phase: "verification",
		reason: "SECRET_TOKEN in raw SDK exception",
	});
	expect(diagnostics.snapshot().reason).toBe("unclassified");
	expect(JSON.stringify(diagnostics.snapshot())).not.toContain("SECRET_");
});
it("rejects malformed or oversized technical metadata instead of dumping untrusted input", () => {
	const diagnostics = createTelegramDiagnostics({
		manifest: {
			...manifest,
			appBuildId: "/private/SECRET_PATH",
			projectSchemas: { readable: Array(100).fill(1), writable: [1] },
		},
		secureContext: false,
		webLocks: false,
	});
	diagnostics.update({
		phase: "release",
		reason: "release-incompatible",
		catalogVersion: "https://SECRET_HOST/private/file.glb",
	});
	const record = diagnostics.snapshot();
	expect(record.appBuildId).toBe("unknown");
	expect(record.schemas.project).toBe("unknown");
	expect(record.catalogVersion).toBe("unavailable");
	expect(JSON.stringify(record)).not.toContain("SECRET_");
});
it("keeps observers independent, supports unsubscribe and permanently refuses late updates after close", () => {
	const diagnostics = createTelegramDiagnostics({
		manifest,
		secureContext: true,
		webLocks: true,
	});
	const events: string[] = [];
	diagnostics.subscribe(() => {
		throw new Error("Observer failure");
	});
	const stop = diagnostics.subscribe(() =>
		events.push(diagnostics.snapshot().reason),
	);
	diagnostics.update({ phase: "editor", reason: "ready" });
	expect(events).toEqual(["ready"]);
	stop();
	diagnostics.close();
	const closed = diagnostics.snapshot();
	diagnostics.update({
		phase: "editor",
		reason: "ready",
		catalogVersion: "late-version",
	});
	expect(diagnostics.snapshot()).toBe(closed);
	expect(closed).toMatchObject({ phase: "closed", reason: "disposed" });
	expect(events).toEqual(["ready"]);
	let called = false;
	diagnostics.subscribe(() => {
		called = true;
	});
	expect(called).toBe(false);
});
it("resets an attempt to unchecked capabilities without retaining a previous catalog observation", () => {
	const diagnostics = createTelegramDiagnostics({
		manifest,
		secureContext: true,
		webLocks: true,
	});
	diagnostics.update({
		phase: "editor",
		reason: "ready",
		capabilities: { indexeddb: true, webgl2: true },
		catalogVersion: "catalog-old",
	});
	diagnostics.reset();
	expect(diagnostics.snapshot()).toMatchObject({
		phase: "checking",
		reason: "checking",
		catalogVersion: "not-observed",
		capabilities: {
			indexeddb: "not-checked",
			webgl2: "not-checked",
			secureContext: true,
			webLocks: true,
		},
	});
});

it("owns the original context capability results across a later attempt reset", () => {
	const context = { manifest, secureContext: true, webLocks: true };
	const diagnostics = createTelegramDiagnostics(context);
	context.secureContext = false;
	context.webLocks = false;
	diagnostics.reset();
	expect(diagnostics.snapshot().capabilities).toMatchObject({
		secureContext: true,
		webLocks: true,
	});
});
it("keeps the closed record authoritative when an observer closes reentrantly", () => {
	const diagnostics = createTelegramDiagnostics({
		manifest,
		secureContext: true,
		webLocks: true,
	});
	const events: string[] = [];
	diagnostics.subscribe(() => {
		if (diagnostics.snapshot().reason === "ready") diagnostics.close();
	});
	diagnostics.subscribe(() => {
		events.push(diagnostics.snapshot().reason);
	});
	diagnostics.update({ phase: "editor", reason: "ready" });
	expect(diagnostics.snapshot()).toMatchObject({
		phase: "closed",
		reason: "disposed",
	});
	expect(events).toEqual(["disposed"]);
});

for (const side of ["readable", "writable"] as const)
	it(`bounds a valid long ${side} schema range without losing its public build identity`, () => {
		const versions = Array.from({ length: 17 }, (_, i) => i + 1);
		const range =
			side === "readable"
				? { readable: versions, writable: [1] }
				: { readable: versions, writable: versions };
		const diagnostics = createTelegramDiagnostics({
			manifest: { ...manifest, projectSchemas: range },
			secureContext: true,
			webLocks: true,
		});
		expect(diagnostics.snapshot().appBuildId).toBe(manifest.appBuildId);
		expect(diagnostics.snapshot().schemas.project).toBe("unknown");
	});
it("keeps a valid bounded schema range and technical version at the exact public diagnostic limits", () => {
	const versions = Array.from({ length: 16 }, (_, i) => i + 1),
		build = "b".repeat(128);
	const diagnostics = createTelegramDiagnostics({
		manifest: {
			...manifest,
			appBuildId: build,
			projectSchemas: { readable: versions, writable: versions },
		},
		secureContext: true,
		webLocks: true,
	});
	diagnostics.update({
		phase: "release",
		reason: "release-incompatible",
		catalogVersion: "c".repeat(128),
	});
	expect(diagnostics.snapshot().appBuildId).toBe(build);
	expect(diagnostics.snapshot().schemas.project).toEqual({
		readable: versions,
		writable: versions,
	});
	expect(diagnostics.snapshot().catalogVersion).toBe("c".repeat(128));
	const oversized = createTelegramDiagnostics({
		manifest: { ...manifest, appBuildId: "b".repeat(129) },
		secureContext: true,
		webLocks: true,
	});
	expect(oversized.snapshot().appBuildId).toBe("unknown");
	oversized.update({
		phase: "release",
		reason: "release-incompatible",
		catalogVersion: "c".repeat(129),
	});
	expect(oversized.snapshot().catalogVersion).toBe("unavailable");
});
it("keeps prior observed versions and capabilities when a later failure carries no new measurement", () => {
	const diagnostics = createTelegramDiagnostics({
		manifest,
		secureContext: true,
		webLocks: true,
	});
	diagnostics.update({
		phase: "editor",
		reason: "ready",
		capabilities: { indexeddb: true, webgl2: false },
		catalogVersion: "catalog-measured",
	});
	diagnostics.update({ phase: "storage", reason: "storage-failed" });
	expect(diagnostics.snapshot()).toMatchObject({
		phase: "storage",
		reason: "storage-failed",
		catalogVersion: "catalog-measured",
		capabilities: { indexeddb: true, webgl2: false },
	});
});
it("does not copy malformed measurements or unknown phase text into the record", () => {
	const diagnostics = createTelegramDiagnostics({
		manifest,
		secureContext: true,
		webLocks: true,
	});
	diagnostics.update({
		phase: "SECRET_PHASE",
		reason: "SECRET_REASON",
		capabilities: { indexeddb: "SECRET_CAPABILITY", webgl2: null },
	} as unknown as Parameters<typeof diagnostics.update>[0]);
	expect(diagnostics.snapshot()).toMatchObject({
		phase: "checking",
		reason: "unclassified",
		capabilities: { indexeddb: "not-checked", webgl2: "not-checked" },
	});
	expect(JSON.stringify(diagnostics.snapshot())).not.toContain("SECRET_");
});
it("keeps malformed metadata and thrown diagnostic input getters private", () => {
	for (const value of [
		{},
		null,
		{
			get version() {
				throw new Error("SECRET_ERROR");
			},
		},
	]) {
		const diagnostics = createTelegramDiagnostics({
			manifest: value,
			secureContext: true,
			webLocks: true,
		});
		expect(diagnostics.snapshot().appBuildId).toBe("unknown");
		expect(JSON.stringify(diagnostics.snapshot())).not.toContain("SECRET_");
	}
});
it("closes once and cannot reset its immutable closed record", () => {
	const diagnostics = createTelegramDiagnostics({
		manifest,
		secureContext: true,
		webLocks: true,
	});
	let events = 0;
	diagnostics.subscribe(() => {
		events++;
	});
	diagnostics.close();
	const record = diagnostics.snapshot();
	diagnostics.reset();
	diagnostics.close();
	expect(diagnostics.snapshot()).toBe(record);
	expect(events).toBe(1);
});

it("rejects non-string catalog metadata without coercing or retaining an object supplied by a faulty caller", () => {
	let coerced = 0;
	const value = {
		privateFilename: "SECRET_PATH",
		toString() {
			coerced++;
			return "public-version";
		},
	};
	const diagnostics = createTelegramDiagnostics({
		manifest,
		secureContext: true,
		webLocks: true,
	});
	diagnostics.update({
		phase: "editor",
		reason: "ready",
		catalogVersion: value as unknown as string,
	});
	expect(diagnostics.snapshot().catalogVersion).toBe("unavailable");
	expect(coerced).toBe(0);
	expect(JSON.stringify(diagnostics.snapshot())).not.toContain("SECRET_PATH");
});
it("does not present a small malformed release range as validated diagnostic schema support", () => {
	const diagnostics = createTelegramDiagnostics({
		manifest: { ...manifest, projectSchemas: { readable: [1], writable: [2] } },
		secureContext: true,
		webLocks: true,
	});
	expect(diagnostics.snapshot()).toMatchObject({
		appBuildId: "unknown",
		schemas: { project: "unknown", asset: "unknown", catalog: "unknown" },
	});
});
