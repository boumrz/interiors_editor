import { existsSync, lstatSync, readFileSync, realpathSync, renameSync, symlinkSync, unlinkSync } from "node:fs";
import { randomUUID, createHash } from "node:crypto";
import { join, sep } from "node:path";
import { expect, test } from "@playwright/test";
import {
	createSavedBrowserRoom,
	openSavedBrowserRoom,
	savedBrowserRecords,
} from "../browser/browser-host-fixture.ts";

function releaseId(directory) {
	const manifest = JSON.parse(readFileSync(join(directory, "release-manifest.json"), "utf8"));
	if (!manifest || typeof manifest !== "object" || !("appBuildId" in manifest) || typeof manifest.appBuildId !== "string") {
		throw new Error("Expected a versioned build artifact");
	}
	return manifest.appBuildId;
}

function isolatedFixture() {
	const configured = process.env.INTERIORS_S1_VERIFY_ROOT;
	if (!configured) throw new Error("Missing isolated upgrade fixture");
	const root = realpathSync(configured);
	if (!root.startsWith(`${realpathSync("/tmp")}${sep}interiors-tma-s1-`)) {
		throw new Error("Upgrade fixture must be in its dedicated temporary directory");
	}
	const link = join(root, "upgrade-web", "dist");
	if (!lstatSync(link).isSymbolicLink()) throw new Error("Expected an isolated release symlink");
	const old = join(root, "old-dist");
	const candidate = join(root, "upgrade-candidate-dist");
	return {
		old, candidate,
		activate: (directory) => {
			const next = `${link}.next-${randomUUID()}`;
			try {
				symlinkSync(directory, next, "dir");
				renameSync(next, link);
			} finally {
				if (existsSync(next)) unlinkSync(next);
			}
		},
	};
}

async function controllingManifest(page) {
	return page.evaluate(() => new Promise((resolve, reject) => {
		const worker = navigator.serviceWorker.controller;
		if (!worker) return reject(new Error("Expected a controlling PWA worker"));
		const channel = new MessageChannel();
		const timeout = setTimeout(() => reject(new Error("Worker manifest timeout")), 2_000);
		channel.port1.onmessage = (event) => {
			clearTimeout(timeout);
			channel.port1.close();
			resolve(event.data);
		};
		worker.postMessage({ type: "INTERIORS_RELEASE_MANIFEST" }, [channel.port2]);
	}));
}

test("HOST-S1-02: an actual pre-extension PWA upgrades to the candidate without changing existing data", async ({ page, context, request }) => {
	const fixture = isolatedFixture();
	const oldId = releaseId(fixture.old);
	const candidateId = releaseId(fixture.candidate);
	expect(oldId).toBe("ccdd13662cdca379");
	expect(candidateId).not.toBe(oldId);
	fixture.activate(fixture.old);
	try {
		await page.goto("/");
		await page.evaluate(async () => { await navigator.serviceWorker.ready; });
		await page.reload();
		expect(await controllingManifest(page)).toMatchObject({ manifest: { appBuildId: oldId } });
		await createSavedBrowserRoom(page, "Upgrade S1");
		const before = await savedBrowserRecords(page);
		expect(before.revisions).toHaveLength(2);

		fixture.activate(fixture.candidate);
		expect(await (await request.get("/release-manifest.json")).json()).toMatchObject({ appBuildId: candidateId });
		const oldWorker = readFileSync(join(fixture.old, "sw.js"), "utf8");
		const oldChunks = Array.from(oldWorker.matchAll(/"(\/editor-app[^" ]+\.js)"/g), (match) => match[1]);
		expect(oldChunks.length).toBeGreaterThan(0);
		for (const path of oldChunks) {
			const response = await request.get(path);
			expect(response.status()).toBe(200);
			const actual = createHash("sha256").update(await response.body()).digest("hex");
			const expected = createHash("sha256").update(readFileSync(join(fixture.old, path.slice(1)))).digest("hex");
			expect(actual).toBe(expected);
		}
		// The old, still-open client first enters this lazy mode after publication.
		await page.getByTestId("editor-view-switch").getByRole("button", { name: "3D", exact: true }).click();
		await expect(page.getByRole("region", { name: "3D вид комнаты" })).toBeVisible();
		await page.getByTestId("editor-view-switch").getByRole("button", { name: "План 2D", exact: true }).click();
		expect(await savedBrowserRecords(page)).toEqual(before);
		await page.evaluate(async () => { await (await navigator.serviceWorker.getRegistration())?.update(); });
		const update = page.getByRole("button", { name: "Обновить приложение", exact: true });
		await expect(update).toBeEnabled();
		await update.click();
		const reload = page.getByRole("button", { name: "Перезагрузить приложение", exact: true });
		await expect(reload).toBeEnabled();
		expect(await savedBrowserRecords(page)).toEqual(before);
		await Promise.all([page.waitForEvent("domcontentloaded"), reload.click()]);
		await openSavedBrowserRoom(page, "Upgrade S1");
		expect(await controllingManifest(page)).toMatchObject({ manifest: { appBuildId: candidateId } });
		expect(await savedBrowserRecords(page)).toEqual(before);

		await page.getByRole("button", { name: "Размеры плана", exact: true }).click();
		await page.getByLabel("Ширина, мм").fill("4300");
		await page.getByRole("button", { name: "Применить размеры", exact: true }).click();
		await expect(page.getByTestId("plan-width")).toHaveText("4300 мм");
		await expect(page.getByTestId("project-durability-status")).toContainText("Сохранено локально");
		const changed = await savedBrowserRecords(page);
		expect(changed.revisions).toHaveLength(3);
		expect(changed.revisions).toEqual(expect.arrayContaining(before.revisions));
		await context.setOffline(true);
		await page.reload();
		await openSavedBrowserRoom(page, "Upgrade S1", 4300);
		expect(await savedBrowserRecords(page)).toEqual(changed);
	} finally {
		await context.setOffline(false);
		fixture.activate(fixture.old);
	}
});
