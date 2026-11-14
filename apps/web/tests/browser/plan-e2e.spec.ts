import {
	chromium,
	devices,
	expect,
	test,
	type Page,
	type TestInfo,
} from "@playwright/test";

type InteriorsTestControl = {
	setFault(point: "before-pointer" | "before-pointer-quota"): void;
};

async function setTestFault(
	page: Page,
	point: "before-pointer" | "before-pointer-quota",
): Promise<void> {
	await expect
		.poll(() =>
			page.evaluate(() =>
				Boolean(
					(
						window as unknown as {
							__interiorsTestControl?: InteriorsTestControl;
						}
					).__interiorsTestControl,
				),
			),
		)
		.toBe(true);
	await page.evaluate((faultPoint) => {
		const control = (
			window as unknown as { __interiorsTestControl?: InteriorsTestControl }
		).__interiorsTestControl;
		if (!control) throw new Error("Expected the Interiors test control");
		control.setFault(faultPoint);
	}, point);
}

async function openPersistentPhone(testInfo: TestInfo, suffix: string) {
	const context = await chromium.launchPersistentContext(
		testInfo.outputPath(`profile-${suffix}`),
		{
			...devices["iPhone 13"],
			channel: "chrome",
			colorScheme: "light",
			locale: "ru-RU",
		},
	);
	const page = context.pages()[0] ?? (await context.newPage());
	return { context, page };
}

async function startNewProjectFromHub(page: Page, name: string): Promise<void> {
	await expect(page.getByTestId("project-hub")).toBeVisible();
	await page.getByRole("button", { name: "Новый проект", exact: true }).click();
	await expect(
		page.getByRole("heading", { name: "Новый проект", exact: true }),
	).toBeVisible();
	await page.getByLabel("Название проекта").fill(name);
	await page.getByRole("button", { name: "Создать проект" }).click();
	await expect(page.getByTestId("editor-workspace")).toBeVisible();
}

async function openProjectFromHub(page: Page, name: string): Promise<void> {
	await expect(page.getByTestId("project-hub")).toBeVisible();
	await page
		.getByRole("button", { name: `Открыть ${name}`, exact: true })
		.click();
	await expect(page.getByTestId("editor-workspace")).toBeVisible();
}

async function chooseEditorOption(page: Page, name: "3D" | "План 2D") {
	const viewSwitch = page.getByTestId("editor-view-switch");
	const option = viewSwitch.getByRole("button", { name, exact: true });
	await expect(option).toBeEnabled();
	await option.click();
}

async function durableRevisionCount(page: Page): Promise<number> {
	return page.evaluate(
		() =>
			new Promise<number>((resolve, reject) => {
				const request = window.indexedDB.open("interiors-editor-projects");
				request.onerror = () => reject(request.error);
				request.onsuccess = () => {
					const database = request.result;
					const transaction = database.transaction("revisions", "readonly");
					const count = transaction.objectStore("revisions").count();
					transaction.oncomplete = () => {
						database.close();
						resolve(count.result);
					};
					transaction.onerror = () => reject(transaction.error);
				};
			}),
	);
}

test("PLAN-E2E-02: creates, edits and reopens an exact durable 2D room on a phone", async ({
	page: _page,
}, testInfo) => {
	const session = await openPersistentPhone(testInfo, "plan");
	const configuredBaseUrl = testInfo.project.use.baseURL;
	if (typeof configuredBaseUrl !== "string") {
		throw new Error("Expected the browser test project to define baseURL");
	}
	const localOrigin = new URL(configuredBaseUrl).origin;
	const externalRequests: string[] = [];
	session.page.on("request", (request) => {
		if (new URL(request.url()).origin !== localOrigin) {
			externalRequests.push(request.url());
		}
	});

	await session.page.goto("/");
	await startNewProjectFromHub(session.page, "План гостиной");
	await expect(
		session.page.getByTestId("project-durability-status"),
	).toHaveText("Сохранено локально");

	await session.page.getByLabel("Ширина, мм").fill("4000");
	await session.page.getByLabel("Глубина, мм").fill("3000");
	await session.page.getByLabel("Высота, мм").fill("2600");
	await session.page.getByRole("button", { name: "Создать контур" }).click();

	await expect(
		session.page.getByTestId("project-durability-status"),
	).toHaveText("Сохранено локально");
	await expect(session.page.getByTestId("plan-width")).toHaveText("4000 мм");
	await expect(session.page.getByTestId("plan-depth")).toHaveText("3000 мм");
	await expect(session.page.getByTestId("plan-perimeter")).toHaveText(
		"14000 мм",
	);
	await expect(session.page.getByTestId("plan-area")).toHaveText("12,00 м²");
	await expect(
		session.page.getByRole("img", { name: "План помещения" }),
	).toBeVisible();
	await expect(session.page.getByTestId("room-measurement")).toContainText(
		"Периметр: 14000 мм",
	);
	expect(externalRequests).toEqual([]);

	await chooseEditorOption(session.page, "3D");
	await expect(
		session.page.getByRole("img", { name: "3D вид комнаты" }),
	).toBeVisible();
	const threeDimensionalMetrics = session.page.getByTestId(
		"three-dimensional-metrics",
	);
	await expect(threeDimensionalMetrics).toContainText("4000 мм");
	await expect(threeDimensionalMetrics).toContainText("3000 мм");
	await expect(threeDimensionalMetrics).toContainText("2600 мм");
	await expect(threeDimensionalMetrics).toBeHidden();
	await expect(
		session.page.getByText("1 ПАЛЕЦ — ОБЗОР · 2 ПАЛЬЦА — ПАНОРАМА И МАСШТАБ"),
	).toHaveCount(0);
	await expect(
		session.page.getByTestId("project-durability-status"),
	).toHaveText("Сохранено локально");
	await chooseEditorOption(session.page, "План 2D");
	await expect(
		session.page.getByRole("img", { name: "План помещения" }),
	).toBeVisible();

	await session.page.evaluate(() => {
		const canvasPrototype = HTMLCanvasElement.prototype as unknown as {
			getContext(
				contextId: string,
				...args: unknown[]
			): RenderingContext | null;
		};
		const originalGetContext = canvasPrototype.getContext;
		canvasPrototype.getContext = function contextWithoutWebGl2(
			contextId,
			...args
		) {
			return contextId === "webgl2"
				? null
				: originalGetContext.call(this, contextId, ...args);
		};
	});
	await chooseEditorOption(session.page, "3D");
	await expect(
		session.page.getByText(
			"WebGL2 недоступен. Точный 2D-план остаётся доступен.",
		),
	).toBeVisible();
	await expect(
		session.page.getByRole("button", { name: "Повторить 3D" }),
	).toBeVisible();
	await chooseEditorOption(session.page, "План 2D");

	await session.page.getByRole("button", { name: "Размеры плана" }).click();
	const revisionsBeforeDimensionEdit = await durableRevisionCount(session.page);
	await session.page.getByLabel("Ширина, мм").fill("4550");
	await session.page.getByLabel("Глубина, мм").fill("3350");
	await session.page.getByLabel("Высота, мм").fill("2700");
	await session.page.getByRole("button", { name: "Применить размеры" }).click();
	await expect
		.poll(() => durableRevisionCount(session.page))
		.toBe(revisionsBeforeDimensionEdit + 1);
	await expect(session.page.getByTestId("plan-width")).toHaveText("4550 мм");
	await expect(session.page.getByTestId("plan-depth")).toHaveText("3350 мм");
	await expect(session.page.getByTestId("plan-height")).toHaveText("2700 мм");
	await expect(session.page.getByTestId("plan-perimeter")).toHaveText(
		"15800 мм",
	);

	for (const invalidWidth of [
		"",
		"0",
		"-1",
		"1.5",
		"1e3",
		"9007199254740992",
	]) {
		await session.page.getByLabel("Ширина, мм").fill(invalidWidth);
		await session.page
			.getByRole("button", { name: "Применить размеры" })
			.click();
		await expect(session.page.getByRole("alert")).toHaveText(
			"Введите целые положительные миллиметры.",
		);
		await expect(session.page.getByTestId("plan-width")).toHaveText("4550 мм");
	}
	await session.page.getByLabel("Ширина, мм").fill("4700");
	await setTestFault(session.page, "before-pointer-quota");
	await session.page.getByRole("button", { name: "Применить размеры" }).click();
	await expect(session.page.getByRole("status")).toContainText("Не сохранено");
	await expect(session.page.getByRole("alert")).toContainText(
		"недостаточно места",
	);
	await expect(
		session.page.getByRole("button", { name: "Повторить сохранение" }),
	).toBeVisible();
	const renameAfterQuota = session.page.getByRole("button", {
		name: "Переименовать проект План гостиной",
	});
	await expect(renameAfterQuota).toBeDisabled();
	// Use the visible dock action; the old compatibility shortcut is transparent.
	await session.page
		.getByRole("button", { name: "Комната", exact: true })
		.click();
	const roomsAfterQuota = session.page.getByRole("dialog", {
		name: "Помещения",
	});
	await expect(roomsAfterQuota.getByLabel("Название помещения")).toHaveCount(0);
	await expect(roomsAfterQuota.getByLabel("Тип помещения")).toBeDisabled();
	await expect(
		roomsAfterQuota.getByLabel("Высота помещения, мм"),
	).toBeDisabled();
	await expect(
		roomsAfterQuota.getByRole("button", { name: "Сохранить помещение" }),
	).toBeDisabled();

	await expect
		.poll(() => durableRevisionCount(session.page))
		.toBe(
			// The failed candidate remains staged for retry; a blocked rename must
			// not create another revision beside that exact candidate.
			revisionsBeforeDimensionEdit + 2,
		);

	const criticalControls = [
		session.page.getByRole("button", { name: "Применить размеры" }),
		session.page
			.getByRole("navigation", { name: "Инструменты редактора" })
			.getByRole("button", { name: "Рука и выбор" }),
	];
	for (const control of criticalControls) {
		const box = await control.boundingBox();
		expect(box?.height).toBeGreaterThanOrEqual(44);
		expect(box?.width).toBeGreaterThanOrEqual(44);
	}
	await expect(
		session.page.getByRole("button", { name: "Опции", exact: true }),
	).toHaveCount(0);
	const savedVersionDownload = session.page.getByRole("button", {
		name: "Скачать сохранённую версию",
	});
	await expect(savedVersionDownload).toBeVisible();
	await session.page
		.getByRole("button", { name: "Повторить сохранение" })
		.click();
	await expect(
		session.page.getByTestId("persistence-failure-notice"),
	).toHaveCount(0);
	await roomsAfterQuota
		.getByRole("button", { name: "Закрыть помещения" })
		.click();
	await expect(
		session.page.getByTestId("project-durability-status"),
	).toHaveText("Сохранено локально");
	await expect(session.page.getByTestId("plan-width")).toHaveText("4700 мм");
	await expect
		.poll(() => durableRevisionCount(session.page))
		.toBe(revisionsBeforeDimensionEdit + 2);
	await session.context.close();

	const reopened = await openPersistentPhone(testInfo, "plan");
	await reopened.page.goto("/");
	await openProjectFromHub(reopened.page, "План гостиной");
	await expect(reopened.page.getByTestId("plan-width")).toHaveText("4700 мм");
	await expect(reopened.page.getByTestId("plan-depth")).toHaveText("3350 мм");
	await expect(reopened.page.getByTestId("plan-height")).toHaveText("2700 мм");
	await reopened.context.close();
});
