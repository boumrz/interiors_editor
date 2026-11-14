import { expect, type Locator, type Page, test } from "@playwright/test";
import { projectRectangularRoomForWebGl } from "../../src/adapters/renderer/rectangular-room-projection";
import type { Project } from "../../src/domain/project";
import { canvasPointForFloor } from "../../src/ui/three-dimensional-floor-interaction";
import { installCatalogGatewayFake } from "./catalog-gateway-fake";

async function openScene(page: Page, width: number, height: number) {
	await page.setViewportSize({ width, height });
	await installCatalogGatewayFake(page);
	await page.goto("/");
	await page.getByRole("button", { name: "Новый проект", exact: true }).click();
	await page.getByLabel("Название проекта").fill("Проверка интерфейса");
	await page
		.getByRole("button", { name: "Создать проект", exact: true })
		.click();
	await page
		.getByRole("button", { name: "Создать контур", exact: true })
		.click();
	await page.getByRole("button", { name: "3D", exact: true }).click();
	await expect(
		page.getByTestId("three-dimensional-renderer-diagnostics"),
	).toContainText("стандартное качество");
}

async function setTextScale(page: Page, percent: number) {
	await page.evaluate((value) => {
		document.documentElement.style.fontSize = `${value}%`;
	}, percent);
	await page.evaluate(
		() =>
			new Promise<void>((resolve) =>
				requestAnimationFrame(() => requestAnimationFrame(() => resolve())),
			),
	);
}

async function expectSeparate(first: Locator, second: Locator) {
	const a = await first.boundingBox(),
		b = await second.boundingBox();
	if (!a || !b) throw new Error("Expected visible independent controls");
	expect(
		a.x + a.width <= b.x ||
			b.x + b.width <= a.x ||
			a.y + a.height <= b.y ||
			b.y + b.height <= a.y,
	).toBe(true);
}

async function expectTextContained(button: Locator) {
	expect(
		await button.evaluate((element) => {
			const bounds = element.getBoundingClientRect();
			const text = document.createRange();
			text.selectNodeContents(element);
			return [...text.getClientRects()].every(
				(rect) =>
					rect.left >= bounds.left &&
					rect.right <= bounds.right &&
					rect.top >= bounds.top &&
					rect.bottom <= bounds.bottom,
			);
		}),
	).toBe(true);
}

async function chooseFloorCentre(page: Page) {
	const project = await page.evaluate(async () => {
		const db = await new Promise<IDBDatabase>((resolve, reject) => {
			const request = indexedDB.open("interiors-editor-projects");
			request.onsuccess = () => resolve(request.result);
			request.onerror = () => reject(request.error);
		});
		try {
			return await new Promise<Project>((resolve, reject) => {
				const transaction = db.transaction(
					["projects", "revisions"],
					"readonly",
				);
				const projects = transaction.objectStore("projects").getAll();
				const revisions = transaction.objectStore("revisions").getAll();
				transaction.oncomplete = () => {
					const revision = revisions.result.find(
						(value) =>
							value.revisionId === projects.result[0]?.currentRevisionId,
					);
					if (!revision) return reject(new Error("Expected durable room"));
					resolve(revision.candidate.project);
				};
				transaction.onerror = () => reject(transaction.error);
			});
		} finally {
			db.close();
		}
	});
	const scene = projectRectangularRoomForWebGl(project);
	const floor = scene?.floors[0];
	const canvas = await page
		.getByTestId("three-dimensional-canvas")
		.boundingBox();
	const cameraText = await page
		.getByTestId("three-dimensional-camera")
		.textContent();
	if (!scene || !floor || !canvas || !cameraText)
		throw new Error("Expected projected floor");
	const [
		azimuthRadians = 0,
		elevationRadians = 0,
		distance = 0,
		panXM = 0,
		panZM = 0,
	] = cameraText.split(":").map(Number);
	const point = canvasPointForFloor(
		scene,
		{ azimuthRadians, elevationRadians, distance, panXM, panZM },
		canvas,
		{ xM: floor.centerXM, zM: floor.centerZM },
	);
	if (!point) throw new Error("Expected visible floor centre");
	await page.touchscreen.tap(canvas.x + point.x, canvas.y + point.y);
}

for (const { width, height } of [
	{ width: 320, height: 844 },
	{ width: 430, height: 844 },
	{ width: 360, height: 480 },
])
	for (const textScale of [100, 200]) {
		test(`REL-LAYOUT ${width}x${height}px ${textScale}%: header and 3D history leave placement controls and their text clear`, async ({
			page,
		}) => {
			await openScene(page, width, height);
			await setTextScale(page, textScale);
			const history = page.getByRole("group", {
				name: "История изменений",
				exact: true,
			});
			const header = page.getByTestId("editor-top-bar");
			const back = page.getByRole("button", {
				name: "Вернуться к проектам",
				exact: true,
			});
			const name = page.getByRole("button", { name: /Переименовать проект/ });
			await expectSeparate(back, name);
			await expectSeparate(history, header);
			await expectSeparate(
				history,
				page.getByTestId("three-dimensional-camera-deck"),
			);
			const bounds = await history.boundingBox();
			expect(bounds?.x).toBeGreaterThanOrEqual(0);
			expect((bounds?.x ?? 0) + (bounds?.width ?? 0)).toBeLessThanOrEqual(
				width,
			);
			await setTextScale(page, 100);
			await page
				.getByTestId("three-dimensional-camera-deck")
				.getByRole("button", { name: "Предметы интерьера", exact: true })
				.click();
			const catalog = page.getByRole("dialog", {
				name: "Предметы интерьера",
				exact: true,
			});
			await catalog.getByRole("button", { name: /^Кровать —/ }).click();
			await catalog
				.getByRole("button", { name: "Показать на плане", exact: true })
				.click();
			await expect(catalog).toHaveCount(0);
			await setTextScale(page, textScale);
			await expectSeparate(back, name);
			const menu = page.getByTestId("three-dimensional-item-placement-menu");
			await expectSeparate(history, menu);
			for (const label of [
				"Отменить размещение предмета",
				"Подтвердить размещение предмета",
			]) {
				const button = menu.getByRole("button", { name: label, exact: true });
				await expectTextContained(button);
				expect((await button.boundingBox())?.height).toBeGreaterThanOrEqual(44);
			}
			await menu
				.getByRole("button", {
					name: "Повернуть предмет на 45° против часовой стрелки",
					exact: true,
				})
				.click();
			await expect(
				page.getByTestId("three-dimensional-placement-rotation-angle"),
			).toHaveText("45°");
			await chooseFloorCentre(page);
			await expect(menu).toHaveAttribute("data-placement-state", "ready");
			const dome = page.getByTestId("three-dimensional-rotation-dome");
			await expect(dome).toBeVisible();
			await expectSeparate(history, dome);
			await expectSeparate(history, menu);
			expect(
				await page.evaluate(
					() => document.documentElement.scrollWidth <= innerWidth,
				),
			).toBe(true);
		});
	}
