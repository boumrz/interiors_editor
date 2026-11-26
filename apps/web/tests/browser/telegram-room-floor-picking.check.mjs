import { expect, test } from "@playwright/test";
import { projectRectangularRoomForWebGl } from "../../src/adapters/renderer/rectangular-room-projection";
import { canvasPointForWorld } from "../../src/ui/three-dimensional-floor-interaction";
import { openEditorCatalog } from "./telegram-entry-support";

test("TMA-INTERIOR-3D-UNIFIED: a touch can switch between a floor and a tabletop in the same draft", async ({ page, baseURL }, info) => {
	const origin = new URL(baseURL).origin;
	await page.route("**/*", route => new URL(route.request().url()).origin === origin ? route.continue() : route.abort());
	await page.goto("/");
	await page.evaluate(async () => {
		await window.__telegramRuntimeUi.initialize();
		await window.__telegramRuntimeUi.mountNavigable("a", true, "exact", "authoring", "authoring");
	});
	await expect(page.getByRole("button", { name: "Новый проект", exact: true })).toBeVisible();
	await page.evaluate(() => window.__telegramRuntimeUi.createRoomInteriorDemo());
	const state = () => page.evaluate(() => window.__telegramRuntimeUi.state());
	const rows = () => page.evaluate(() => window.__telegramRuntimeUi.semanticRows("a"));
	const original = (await state()).project;
	const before = await rows();
	await openEditorCatalog(page);
	await page.locator('[data-greybox-preset="book"]').tap();
	const placement = page.getByTestId("interior-supported-placement");
	const status = placement.getByRole("status");
	const confirm = placement.getByRole("button", { name: "Подтвердить", exact: true });
	await page.getByRole("button", { name: "3D", exact: true }).tap();
	await expect(status).toHaveText("Коснитесь пола или подсвеченной опоры.");
	await expect(confirm).toBeDisabled();
	await expect(page.getByTestId("three-dimensional-renderer-diagnostics")).toContainText("стандартное качество");
	await expect(page.getByRole("button", { name: "Повторить 3D", exact: true })).toHaveCount(0);
	await expect(page.getByRole("button", { name: "Приблизить 3D", exact: true })).toBeVisible();
	await page.screenshot({ path: info.outputPath("3d-destination-preselection.png"), scale: "css" });

	const scene = projectRectangularRoomForWebGl(original, undefined, true);
	const bounds = await page.getByTestId("three-dimensional-canvas").boundingBox();
	const desk = scene?.items.find(item => item.material?.furnitureKind === "catalog:desk");
	if (!scene || !bounds || !desk) throw new Error("Missing the rendered demo desk");
	const tapWorld = async (world) => {
		const [azimuthRadians, elevationRadians, distance, panXM, panZM] = (await page.getByTestId("three-dimensional-camera").textContent()).split(":").map(Number);
		const point = canvasPointForWorld(scene, { azimuthRadians, elevationRadians, distance, panXM, panZM }, bounds, world);
		if (!point) throw new Error("Expected the chosen point in view");
		const contact = { x: bounds.x + point.x, y: bounds.y + point.y };
		expect(await page.evaluate(({ x, y }) => document.elementFromPoint(x, y)?.getAttribute("data-testid"), contact)).toBe("three-dimensional-canvas");
		await page.touchscreen.tap(contact.x, contact.y);
	};
	await tapWorld({ x: 1.45, y: 0, z: 1.67 });
	await expect(status).toHaveText(/Пол · Место выбрано/);
	await expect(confirm).toBeEnabled();
	await tapWorld({ x: desk.centerXM - 0.1, y: desk.centerYM + desk.heightM / 2, z: desk.centerZM });
	await expect(status).toHaveText(/Письменный стол · Верх/);
	await expect(confirm).toBeEnabled();
	expect(await rows()).toEqual(before);
	await confirm.tap();
	await expect(page.getByTestId("editor-top-bar").getByRole("status")).toHaveText("Сохранено");
	expect((await state()).project.supportedItems).toContainEqual(expect.objectContaining({
		supportAssetInstanceId: desk.assetInstanceId, supportSurfaceKey: "top",
		catalogPreset: { presetId: "book", version: 1 },
	}));
	expect((await rows()).revisions).toHaveLength(before.revisions.length + 1);
});
