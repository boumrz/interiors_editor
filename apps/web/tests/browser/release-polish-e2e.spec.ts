import { expect, type Page, test } from "@playwright/test";
import { installCatalogGatewayFake } from "./catalog-gateway-fake";

async function createPlan(page: Page, name = "Релизный план") {
	await installCatalogGatewayFake(page);
	await page.goto("/");
	await page.getByRole("button", { name: "Новый проект", exact: true }).click();
	await page.getByRole("textbox", { name: "Название проекта" }).fill(name);
	await page
		.getByRole("button", { name: "Создать проект", exact: true })
		.click();
	await page
		.getByRole("button", { name: "Создать контур", exact: true })
		.click();
	await expect(page.getByTestId("room-face")).toHaveCount(1);
}

test("REL-01: project directory exposes named deletion, cancel preserves it and confirm survives reload", async ({
	page,
}) => {
	await createPlan(page);
	await page
		.getByRole("button", { name: "Вернуться к проектам", exact: true })
		.click();
	await page
		.getByRole("button", { name: "Удалить проект Релизный план", exact: true })
		.click();
	const confirmation = page.getByRole("dialog", {
		name: "Удалить проект",
		exact: true,
	});
	await expect(confirmation).toContainText("Релизный план");
	await confirmation.getByRole("button", { name: "Оставить проект" }).click();
	await expect(
		page.getByRole("button", { name: "Открыть Релизный план" }),
	).toBeVisible();
	await page
		.getByRole("button", { name: "Удалить проект Релизный план", exact: true })
		.click();
	await confirmation.getByRole("button", { name: "Удалить навсегда" }).click();
	await expect(page.getByTestId("project-directory-empty")).toBeVisible();
	await page.reload();
	await expect(page.getByTestId("project-directory-empty")).toBeVisible();
});

test("REL-02: new project has one title and no instructional help", async ({
	page,
}) => {
	await page.goto("/");
	await page.getByRole("button", { name: "Новый проект", exact: true }).click();
	await expect(page.getByText("Новый проект", { exact: true })).toHaveCount(1);
	await expect(page.getByTestId("first-run-help")).toHaveCount(0);
	await expect(
		page.getByText("Точные мм · хранится на устройстве", { exact: true }),
	).toHaveCount(0);
});

test("REL-05-06: room editor exposes type only with readable mobile controls", async ({
	page,
}) => {
	await createPlan(page);
	await page.getByRole("button", { name: "Рука и выбор", exact: true }).click();
	await page.getByRole("button", { name: "Помещения", exact: true }).click();
	await expect(
		page.getByRole("textbox", { name: "Название помещения" }),
	).toHaveCount(0);
	const type = page.getByRole("combobox", { name: "Тип помещения" });
	await type.selectOption("bedroom");
	await page.getByRole("button", { name: "Сохранить помещение" }).click();
	await expect(
		page.getByRole("navigation", { name: "Список помещений" }),
	).toContainText("Спальня");
	const style = await type.evaluate((e) => ({
		height: e.getBoundingClientRect().height,
		padding: parseFloat(getComputedStyle(e).paddingRight),
		border: getComputedStyle(e).borderRightWidth,
	}));
	expect(style.height).toBeGreaterThanOrEqual(44);
	expect(style.padding).toBeGreaterThanOrEqual(36);
	expect(style.border).not.toBe("0px");
});

test("REL-08-09: visible canvas history and retired split gesture", async ({
	page,
}) => {
	await createPlan(page);
	const history = page.getByRole("group", { name: "История изменений" });
	await expect(history).toBeVisible();
	await history.getByRole("button", { name: /^Отменить/ }).click();
	await expect(page.getByTestId("room-face")).toHaveCount(0);
	await history.getByRole("button", { name: /^Повторить/ }).click();
	await expect(page.getByTestId("room-face")).toHaveCount(1);
	await page.getByRole("button", { name: "Рука и выбор", exact: true }).click();
	await page.getByTestId("wall-segment").first().click();
	await page.getByRole("button", { name: "Свойства" }).click();
	await expect(
		page.getByRole("button", { name: /Разделить стену жестом/ }),
	).toHaveCount(0);
	await expect(page.locator("button[title]")).toHaveCount(0);
});

test("REL-11: catalog network error stays inline, retries and closes without reopening", async ({
	page,
}) => {
	await createPlan(page);
	await page.route("**/catalog-api/v1/catalogs/current", (route) =>
		route.abort("failed"),
	);
	// A production service worker forwards its own network request, outside
	// page routing. Offline also exercises that real PWA failure path.
	await page.context().setOffline(true);
	await page
		.getByRole("button", { name: "Предметы интерьера", exact: true })
		.click();
	const catalog = page.getByRole("dialog", {
		name: "Предметы интерьера",
		exact: true,
	});
	await expect(catalog).toBeVisible();
	await expect(catalog.getByRole("alert")).toContainText(
		"Каталог временно недоступен",
	);
	await expect(
		page.getByRole("dialog", { name: "Каталог временно недоступен" }),
	).toHaveCount(0);
	await page.context().setOffline(false);
	await page.unroute("**/catalog-api/v1/catalogs/current");
	await installCatalogGatewayFake(page);
	await catalog.getByRole("button", { name: "Повторить", exact: true }).click();
	await expect(catalog.getByRole("alert")).toHaveCount(0);
	await expect(catalog.getByTestId("catalog-title")).toHaveText("Каталог");
	await catalog
		.getByRole("button", { name: "Закрыть предметы интерьера" })
		.click();
	await expect(catalog).toHaveCount(0);
});

for (const width of [320, 375, 390, 430])
	test(`REL-12-13: catalog fits ${width}px and import is first`, async ({
		page,
	}) => {
		await page.setViewportSize({ width, height: 844 });
		await createPlan(page);
		await page
			.getByRole("button", { name: "Предметы интерьера", exact: true })
			.click();
		const catalog = page.getByRole("dialog", {
			name: "Предметы интерьера",
			exact: true,
		});
		await expect(catalog.getByTestId("catalog-title")).toBeVisible();
		const authoring = catalog.getByTestId("catalog-authoring");
		await expect(authoring).toBeInViewport();
		await expect(authoring).toContainText("Импорт модели");
		const overflow = await catalog.evaluate((e) =>
			[
				...e.querySelectorAll<HTMLElement>(
					"nav, [class*=catalogContent], [class*=catalogCategoryTabs]",
				),
				e,
			]
				.filter((n) => n.scrollWidth > n.clientWidth + 1)
				.map((n) => n.tagName),
		);
		expect(overflow).toEqual([]);
		await authoring.locator("summary").click();
		await catalog
			.getByRole("button", { name: "Создать макетный предмет", exact: true })
			.click();
		const submit = catalog.getByRole("button", { name: "Начать размещение" });
		const appearance = await submit.evaluate((e) => ({
			height: e.getBoundingClientRect().height,
			radius: getComputedStyle(e).borderRadius,
			background: getComputedStyle(e).backgroundColor,
		}));
		expect(appearance.height).toBeGreaterThanOrEqual(44);
		expect(appearance.radius).not.toBe("0px");
		expect(appearance.background).not.toBe("rgba(0, 0, 0, 0)");
	});

test("REL-14: transient errors are above the canvas, close manually and expire within five seconds", async ({
	page,
}) => {
	await page.goto("/");
	await page.getByRole("button", { name: "Новый проект", exact: true }).click();
	await page
		.getByRole("textbox", { name: "Название проекта" })
		.fill("Уведомления");
	await page
		.getByRole("button", { name: "Создать проект", exact: true })
		.click();
	const now = new Date("2026-11-01T12:00:00Z");
	await page.clock.install({ time: now });
	await page.clock.pauseAt(new Date(now.getTime() + 1000));
	await page
		.getByRole("textbox", { name: "Ширина, мм", exact: true })
		.fill("0");
	await page
		.getByRole("button", { name: "Создать контур", exact: true })
		.click();
	const notice = page.getByTestId("transient-notification");
	await expect(notice).toBeVisible();
	const bounds = await notice.boundingBox();
	expect(bounds?.y).toBeLessThan(250);
	await notice.getByRole("button", { name: "Закрыть уведомление" }).click();
	await expect(notice).toHaveCount(0);
	await page
		.getByRole("button", { name: "Создать контур", exact: true })
		.click();
	await expect(notice).toBeVisible();
	await page.clock.fastForward(4999);
	await expect(notice).toBeVisible();
	await page.clock.fastForward(1);
	await expect(notice).toHaveCount(0);
});

test("REL-15-16: window context and opening movement require explicit confirmation", async ({
	page,
}) => {
	await createPlan(page);
	await page.getByRole("button", { name: "Рука и выбор", exact: true }).click();
	await page.getByTestId("wall-segment").first().click();
	await page
		.getByRole("button", { name: "Добавить проём", exact: true })
		.click();
	const creation = page.getByRole("dialog", {
		name: "Новый проём",
		exact: true,
	});
	await creation.getByRole("button", { name: "Окно", exact: true }).click();
	const windowDialog = page.getByRole("dialog", {
		name: "Новое окно",
		exact: true,
	});
	await expect(windowDialog).toBeVisible();
	await expect(page.getByTestId("selected-wall-inspector")).not.toBeVisible();
	await expect(page.getByTestId("window-opening")).toHaveCount(0);
	await windowDialog
		.getByRole("button", { name: "Добавить", exact: true })
		.click();
	await expect(page.getByTestId("window-opening")).toHaveCount(1);
	const before = await openingSnapshot(page);
	await page.getByTestId("opening-move-handle").focus();
	await page.keyboard.press("ArrowRight");
	const move = page.getByRole("dialog", {
		name: "Подтвердить перемещение окна",
		exact: true,
	});
	await expect(move).toBeVisible();
	expect(await openingSnapshot(page)).toEqual(before);
	await move.getByRole("button", { name: "Отмена", exact: true }).click();
	expect(await openingSnapshot(page)).toEqual(before);
	await page.getByTestId("opening-move-handle").focus();
	await page.keyboard.press("ArrowRight");
	await expect(move).toBeVisible();
	await move.getByRole("button", { name: "Подтвердить", exact: true }).click();
	await expect
		.poll(async () => (await openingSnapshot(page)).offsetMm)
		.not.toBe(before.offsetMm);
	expect((await openingSnapshot(page)).revisions).toBe(before.revisions + 1);
});

async function openingSnapshot(page: Page) {
	return page.evaluate(async () => {
		const db = await new Promise<IDBDatabase>((resolve, reject) => {
			const r = indexedDB.open("interiors-editor-projects");
			r.onsuccess = () => resolve(r.result);
			r.onerror = () => reject(r.error);
		});
		try {
			const read = (store: string) =>
				new Promise<unknown[]>((resolve, reject) => {
					const r = db.transaction(store).objectStore(store).getAll();
					r.onsuccess = () => resolve(r.result);
					r.onerror = () => reject(r.error);
				});
			const projects = (await read("projects")) as {
				currentRevisionId: string;
			}[];
			const revisions = (await read("revisions")) as {
				revisionId: string;
				candidate: { project: { level: { openings: { offsetMm: number }[] } } };
			}[];
			return {
				revisions: revisions.length,
				offsetMm: revisions.find(
					(r) => r.revisionId === projects[0]?.currentRevisionId,
				)?.candidate.project.level.openings[0]?.offsetMm,
			};
		} finally {
			db.close();
		}
	});
}
