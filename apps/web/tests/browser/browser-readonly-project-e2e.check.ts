import { expect, test } from "@playwright/test";
import type {} from "./browser-readonly-project-harness";

test.beforeEach(async ({ page }, info) => {
	try {
		await page.goto("/");
		const actual = await page.evaluate(
			({ hashes, active, selected }) => {
				const global: unknown = Reflect.get(globalThis, "__stryker__"),
					table: unknown = Reflect.get(
						globalThis,
						"__BROWSER_READONLY_LOADED__",
					);
				if (
					!global ||
					typeof global !== "object" ||
					Reflect.get(global, "activeMutant") !== active ||
					!table ||
					typeof table !== "object"
				)
					throw new Error("BROWSER_READONLY_CANARY_INVALID: global");
				return Object.entries(hashes).map(([path, expected]) => {
					const marker: unknown = Reflect.get(table, path);
					if (!marker || typeof marker !== "object")
						throw new Error("BROWSER_READONLY_CANARY_INVALID: module");
					const read: unknown = Reflect.get(marker, "readActive"),
						instrumented = Reflect.get(marker, "instrumented");
					if (
						Reflect.get(marker, "sha") !== expected ||
						instrumented !== selected.includes(path) ||
						typeof read !== "function" ||
						(instrumented && read() !== active)
					)
						throw new Error(
							"BROWSER_READONLY_CANARY_INVALID: source/namespace",
						);
					return { path, sha: expected, instrumented, actual: read() };
				});
			},
			{
				hashes: info.project.metadata.sourceHashes as Record<string, string>,
				active: info.project.metadata.activeMutant,
				selected: info.project.metadata.selected as string[],
			},
		);
		expect(actual).toHaveLength(4);
		console.log(
			`BROWSER_READONLY_ACTIVATION ${JSON.stringify({ title: info.title, active: info.project.metadata.activeMutant, valid: true, modules: actual })}`,
		);
	} catch (error) {
		console.log(
			`BROWSER_READONLY_ACTIVATION ${JSON.stringify({ title: info.title, active: info.project.metadata.activeMutant, valid: false, reason: String(error) })}`,
		);
		throw error;
	}
});
for (const resourceful of [false, true])
	test(`BROWSER-READONLY-${resourceful ? "02" : "01"}: actual ${resourceful ? "GLB" : "empty"} Durable sources export both formats without native writes, provisioning or ownership changes`, async ({
		page,
	}) => {
		const actual = await page.evaluate(
			(value) => window.__browserReadonlyProjectHarness.both(value),
			resourceful,
		);
		expect(actual.startup.kind).toBe("read-only/exportable");
		expect(actual.constructionOpens).toBe(0);
		expect(actual.readonlySources).toEqual(["legacy", "browser-registered"]);
		expect(actual.directory.projects).toHaveLength(2);
		expect(actual.directory.storageSources).toEqual([
			{ storageNamespace: "legacy", kind: "available" },
			{ storageNamespace: "browser-registered", kind: "available" },
		]);
		expect(actual.files).toHaveLength(4);
		for (const file of actual.files) {
			expect(file.kind).toBe("ready");
			expect(file.decoded).toMatchObject({
				kind: "accepted",
				exactProject: true,
			});
			expect(file.decoded?.resources).toHaveLength(resourceful ? 1 : 0);
			if (resourceful) {
				const model = actual.models.find(
					(value) => value.resourceHash === file.decoded?.resources?.[0]?.key,
				);
				expect(model).toBeDefined();
				expect(file.decoded?.resources?.[0]).toEqual({
					key: model?.resourceHash,
					sha256: model?.resourceHash,
					bytes: model?.bytes,
				});
			}
		}
		expect(actual.raw).toEqual([
			{
				owner: "legacy",
				exact: true,
				available: "unverified-source",
				staleAbsent: true,
			},
			{
				owner: "browser-registered",
				exact: true,
				available: "unverified-source",
				staleAbsent: true,
			},
		]);
		expect(actual.before).toEqual(actual.after);
		expect(actual.sessionBefore).toEqual(actual.sessionAfter);
		expect(actual.localBefore).toEqual(actual.localAfter);
		expect(actual.opens.length).toBeGreaterThan(0);
		expect(actual.opens.every((open) => open.version === undefined)).toBe(true);
		expect(actual.upgrades).toEqual([]);
		expect(actual.modes.length).toBeGreaterThan(0);
		expect(actual.modes.every((mode) => mode === "readonly")).toBe(true);
	});
test("BROWSER-READONLY-03: a genuinely refused legacy startup never provisions during ordinary probes and healthy private editing survives", async ({
	page,
}) => {
	const actual = await page.evaluate(() =>
		window.__browserReadonlyProjectHarness.absentLegacy(),
	);
	expect(actual.startup.kind).toBe("writable");
	expect(actual.aborted).toBeGreaterThan(0);
	expect(actual.absentBefore).toBe(true);
	expect(actual.absentAfter).toBe(true);
	expect(actual.renamed.kind).toBe("durable");
	expect(actual.readonlySources).toEqual(["legacy"]);
	expect(actual.hub).toMatchObject({
		kind: "projects",
		storageSources: [
			{ storageNamespace: "legacy", kind: "unavailable" },
			{ storageNamespace: "browser-registered", kind: "available" },
		],
	});
	expect(actual.directory.storageSources).toEqual([
		{ storageNamespace: "legacy", kind: "available" },
		{ storageNamespace: "browser-registered", kind: "available" },
	]);
	expect(actual.directory.projects).toHaveLength(1);
	expect(actual.directory.projects[0]?.storageNamespace).toBe(
		"browser-registered",
	);
	expect(actual.before).toEqual(actual.after);
	expect(actual.modes.every((mode) => mode === "readonly")).toBe(true);
	expect(actual.upgrades).toEqual([]);
	expect(actual.opens.every((open) => open.version === undefined)).toBe(true);
});

for (const mode of ["identity", "counter"] as const)
	test(`BROWSER-READONLY-${mode === "identity" ? "04" : "05"}: observed ${mode} loss remains recovery-required across same-provider re-admission while healthy neighbor exports`, async ({
		page,
	}) => {
		const actual = await page.evaluate(
			(value) => window.__browserReadonlyProjectHarness.sticky(value),
			mode,
		);
		await test.info().attach("native-sticky-result", {
			body: JSON.stringify(actual),
			contentType: "application/json",
		});
		expect(actual.initial.projects).toHaveLength(2);
		expect(actual.first.storageSources).toEqual([
			{ storageNamespace: "legacy", kind: "available" },
			{ storageNamespace: "browser-registered", kind: "recovery-required" },
		]);
		expect(actual.after.storageSources).toEqual([
			{ storageNamespace: "legacy", kind: "available" },
			{ storageNamespace: "browser-registered", kind: "recovery-required" },
		]);
		expect(actual.after.projects).toHaveLength(1);
		expect(actual.after.projects[0]?.storageNamespace).toBe("legacy");
		expect(actual.firstAborted).toBe(true);
		expect(actual.previousAborted).toBe(true);
		expect(actual.currentAborted).toBe(true);
		expect(actual.privateRawUnavailable).toBe(true);
		expect(actual.neighborFile).toMatchObject({
			kind: "accepted",
			exactProject: true,
		});
		expect(actual.faultBefore).toEqual(actual.faultAfter);
		expect(actual.restoredBefore).toEqual(actual.restoredAfter);
		expect(actual.upgrades).toEqual([]);
		expect(actual.modes.every((mode) => mode === "readonly")).toBe(true);
	});

test("BROWSER-READONLY-06: losing only the legacy resource DB refuses its model backup while the independent healthy empty Project and original source remain exportable", async ({
	page,
}) => {
	const actual = await page.evaluate(() =>
		window.__browserReadonlyProjectHarness.resourceNeighbor(),
	);
	await test.info().attach("resource-neighbor-result", {
		body: JSON.stringify(actual),
		contentType: "application/json",
	});
	expect(actual.control).toMatchObject({
		kind: "accepted",
		exactProject: true,
	});
	expect(actual.cBefore).toMatchObject({
		kind: "accepted",
		exactProject: true,
	});
	expect(actual.aMissing).not.toBe("ready");
	expect(actual.cAfter).toMatchObject({ kind: "accepted", exactProject: true });
	expect(actual.rawExact).toBe(true);
	expect(actual.directory.storageSources[0]?.kind).toBe("available");
	expect(actual.directory.projects).toHaveLength(2);
	expect(actual.before).toEqual(actual.after);
	expect(actual.resourceDatabaseAbsent).toBe(true);
	expect(actual.modes.every((mode) => mode === "readonly")).toBe(true);
	expect(actual.upgrades).toEqual([]);
});

test("BROWSER-READONLY-07: actual mounted readonly BrowserRuntimeEditor exports each qualified GLB Project through a fresh offline download gesture and reads the saved file without writes", async ({
	page,
}) => {
	const actual = await page.evaluate(() =>
		window.__browserReadonlyProjectHarness.mountReadonly(true),
	);
	expect(actual.constructionOpens).toBe(0);
	let after:
		| Awaited<
				ReturnType<
					Window["__browserReadonlyProjectHarness"]["finishMountedReadonly"]
				>
		  >
		| undefined;
	try {
		await expect(
			page.getByRole("heading", { name: "Просмотр проектов", exact: true }),
		).toBeVisible();
		await expect(
			page.getByRole("button", { name: /^Подготовить файл для переноса:/ }),
		).toHaveCount(2);
		await page.context().setOffline(true);
		for (const owner of ["legacy", "browser-registered"] as const) {
			const button = page.getByRole("button", {
				name: new RegExp(
					"^Подготовить файл для переноса: " + actual.names[owner],
				),
			});
			await button.click();
			await expect(
				page.getByRole("button", { name: "Скачать файл", exact: true }),
			).toBeEnabled();
			const receiving = page.waitForEvent("download");
			await page
				.getByRole("button", { name: "Скачать файл", exact: true })
				.click();
			const download = await receiving;
			expect(await download.failure()).toBeNull();
			const path = test.info().outputPath(owner + ".interiors");
			await download.saveAs(path);
			await page.evaluate(
				(namespace) =>
					window.__browserReadonlyProjectHarness.receiveDownloadedFile(
						namespace,
					),
				owner,
			);
			await page.locator("#readonly-download-proof").setInputFiles(path);
			await expect
				.poll(() =>
					page.evaluate(() =>
						window.__browserReadonlyProjectHarness.downloadedFileProof(),
					),
				)
				.toMatchObject({
					kind: "decoded-file",
					owner,
					result: { kind: "accepted", exactProject: true },
				});
			const proof = (await page.evaluate(() =>
				window.__browserReadonlyProjectHarness.downloadedFileProof(),
			)) as {
				byteLength: number;
				result: {
					resources: { key: string; bytes: number[]; sha256: string }[];
				};
			};
			expect(proof.byteLength).toBeGreaterThan(0);
			expect(proof.result.resources).toHaveLength(1);
			const model = actual.models.find(
				(value) => value.resourceHash === proof.result.resources[0]?.key,
			);
			expect(model).toBeDefined();
			expect(proof.result.resources[0]).toEqual({
				key: model?.resourceHash,
				bytes: model?.bytes,
				sha256: model?.resourceHash,
			});
		}
	} finally {
		after = await page.evaluate(() =>
			window.__browserReadonlyProjectHarness.finishMountedReadonly(),
		);
		await test.info().attach("actual-mounted-readonly-storage", {
			body: JSON.stringify(after),
			contentType: "application/json",
		});
		await page.context().setOffline(false);
	}
	if (!after) throw new Error("Missing mounted readonly cleanup proof");
	expect(after.after).toEqual(after.before);
	expect(after.sessionAfter).toEqual(after.sessionBefore);
	expect(after.localAfter).toEqual(after.localBefore);
	expect(after.modes.length).toBeGreaterThan(0);
	expect(after.modes.every((mode) => mode === "readonly")).toBe(true);
	expect(after.opens.every((open) => open.version === undefined)).toBe(true);
	expect(after.upgrades).toEqual([]);
	const changed = Object.keys({
		...after.constructorSessionBefore,
		...after.constructorSessionAfter,
	}).filter(
		(key) =>
			after.constructorSessionBefore[key] !==
			after.constructorSessionAfter[key],
	);
	expect(changed).toEqual([
		"interiors-editor-browser-registered-context-v1:interiors-editor-writer-owner",
	]);
});
