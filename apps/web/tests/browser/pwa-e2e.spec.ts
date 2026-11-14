// @ts-nocheck
import {
	chromium,
	devices,
	expect,
	test,
	type TestInfo,
} from "@playwright/test";
import { WRITER_LEASE_DURATION_MS } from "../../src/application/ports";

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

async function chooseEditorOption(page, name) {
	if (name === "План 2D" || name === "3D") {
		const option = page
			.getByTestId("editor-view-switch")
			.getByRole("button", { name, exact: true });
		await expect(option).toBeEnabled();
		await option.click();
		return;
	}
	const railButton = page
		.getByRole("navigation", { name: "Инструменты редактора" })
		.getByRole("button", { name, exact: true });
	if (await railButton.count()) {
		await railButton.click();
		return;
	}
	const options = page.getByRole("dialog", { name: "Опции редактора" });
	if ((await options.count()) === 0) {
		await page.getByRole("button", { name: "Опции", exact: true }).click();
	}
	await options.getByRole("button", { name, exact: true }).click();
}

async function startNewProjectFromHub(page, name) {
	await expect(page.getByTestId("project-hub")).toBeVisible();
	await page
		.getByRole("button", { name: "Новый проект", exact: true })
		.click();
	await expect(
		page.getByRole("heading", { name: "Новый проект", exact: true }),
	).toBeVisible();
	await page.getByLabel("Название проекта").fill(name);
	await page.getByRole("button", { name: "Создать проект" }).click();
	await expect(page.getByTestId("editor-workspace")).toBeVisible();
}

async function openProjectFromHub(page, name) {
	await expect(page.getByTestId("project-hub")).toBeVisible();
	await page
		.getByRole("button", { name: `Открыть ${name}`, exact: true })
		.click();
	await expect(page.getByTestId("editor-workspace")).toBeVisible();
}

async function openEditorOverflowAction(page, name) {
	const action = page.getByRole("button", {
		name: new RegExp(`^${name}(?::|$)`),
	});
	if ((await action.count()) === 0) {
		await page
			.getByRole("button", { name: "Открыть остальные действия" })
			.click();
	}
	await expect(action).toBeEnabled();
	return action;
}

async function roomPoint(page, xFraction = 0.5, zFraction = 0.5) {
	const face = page.getByTestId("room-face").first();
	await expect(face).toBeVisible();
	return face.evaluate(
		(element, fractions) => {
			const bounds = element.getBBox();
			const matrix = element.getScreenCTM();
			if (!matrix) throw new Error("Room projection did not render");
			const point = new DOMPoint(
				bounds.x + bounds.width * fractions.x,
				bounds.y + bounds.height * fractions.z,
			).matrixTransform(matrix);
			return { x: point.x, y: point.y };
		},
		{ x: xFraction, z: zFraction },
	);
}

test("PWA-E2E-00: a production reload retains the active registered worker for explicit safe updates", async ({
	page: _page,
}, testInfo) => {
	const session = await openPersistentPhone(
		testInfo,
		"pwa-retained-registration",
	);
	try {
		await session.page.goto("/");
		const installed = await session.page.evaluate(async () => {
			const registration = await navigator.serviceWorker.register("/sw.js");
			await navigator.serviceWorker.ready;
			const worker = registration.active;
			if (!worker) throw new Error("Expected an active worker");
			if (worker.state !== "activated") {
				await new Promise<void>((resolve) => {
					worker.addEventListener("statechange", () => {
						if (worker.state === "activated") resolve();
					});
				});
			}
			return {
				scope: registration.scope,
				scriptURL: registration.active?.scriptURL,
				state: registration.active?.state,
			};
		});
		expect(installed.scriptURL).toBe(
			new URL("/sw.js", session.page.url()).href,
		);
		expect(installed.state).toBe("activated");
		await session.page.reload();
		await expect(session.page.getByTestId("project-hub")).toBeVisible();
		await expect
			.poll(() =>
				session.page.evaluate(async () => {
					const registration = await navigator.serviceWorker.getRegistration();
					return {
						scope: registration?.scope,
						scriptURL: registration?.active?.scriptURL,
						state: registration?.active?.state,
					};
				}),
			)
			.toEqual(installed);
		await expect
			.poll(() =>
				session.page.evaluate(
					() => navigator.serviceWorker.controller?.scriptURL,
				),
			)
			.toBe(installed.scriptURL);
		expect(
			await session.page.evaluate(
				async () => (await navigator.serviceWorker.getRegistrations()).length,
			),
		).toBe(1);
	} finally {
		await session.context.close();
	}
});

test("PWA-E2E-01: the phone editor exposes an install manifest and reopens the cached shell offline after first online visit", async ({
	page: _page,
}, testInfo) => {
	const session = await openPersistentPhone(testInfo, "pwa-shell");
	await session.page.goto("/");

	await expect(session.page.getByText("Работайте как в приложении", { exact: true })).toHaveCount(0);

	const manifestHref = await session.page
		.locator('link[rel="manifest"]')
		.getAttribute("href");
	expect(manifestHref).toBe("/manifest.webmanifest");
	const manifest = await session.page.evaluate(
		async (href) => (await fetch(href ?? "")).json(),
		manifestHref,
	);
	expect(manifest).toMatchObject({
		display: "standalone",
		name: "InteriorsEditor",
		start_url: "/",
	});
	expect(manifest.icons).toContainEqual(
		expect.objectContaining({ src: "/icon.svg" }),
	);

	await session.page.evaluate(async () => {
		await navigator.serviceWorker.ready;
	});
	await expect
		.poll(() =>
			session.page.evaluate(
				() => navigator.serviceWorker.controller?.scriptURL ?? "",
			),
		)
		.toContain("/sw.js");
	const cachedShellPaths = await session.page.evaluate(async () => {
		const cacheName = (await caches.keys()).find((key) =>
			/^interiors-editor-shell-[a-f0-9]{16}$/.test(key),
		);
		if (!cacheName) {
			return [];
		}
		const cache = await caches.open(cacheName);
		return (await cache.keys()).map((request) => new URL(request.url).pathname);
	});
	for (const asset of [
		/^\/main\.[a-f0-9]+\.js$/,
		// The phone editor is intentionally split into several on-demand chunks.
		/^\/editor-app(?:-[a-z0-9-]+)?\.[a-f0-9]+\.js$/,
		// Rspack may partition the Three.js route into more than one chunk; the
		// shell contract is the runtime family, never an implementation filename.
		/^\/three-runtime(?:-[a-z0-9-]+)?\.[a-f0-9]+\.js$/,
	]) {
		expect(cachedShellPaths.some((path) => asset.test(path))).toBe(true);
	}
	expect(cachedShellPaths.some((path) => /\.css$/.test(path))).toBe(true);

	await session.context.setOffline(true);
	await session.page.reload();
	await expect(session.page.getByTestId("project-hub")).toBeVisible();
	await expect(session.page.getByTestId("project-directory-empty")).toBeVisible();
	await expect(session.page.getByLabel("Название проекта")).toHaveCount(0);
	await session.context.close();
});

test("PWA-E2E-02: a cached phone shell reopens and makes a durable local plan edit with the network disabled", async ({
	page: _page,
}, testInfo) => {
	test.setTimeout(90_000);
	const session = await openPersistentPhone(testInfo, "pwa-offline-edit");
	await session.page.goto("/");
	await session.page.evaluate(async () => {
		await navigator.serviceWorker.ready;
	});
	await session.page.reload();
	await expect
		.poll(() =>
			session.page.evaluate(
				() => navigator.serviceWorker.controller?.scriptURL ?? "",
			),
		)
		.toContain("/sw.js");

	await startNewProjectFromHub(session.page, "Офлайн план");
	await session.page.getByRole("button", { name: "Создать контур" }).click();
	await expect(session.page.getByTestId("plan-width")).toHaveText("4000 мм");

	await chooseEditorOption(session.page, "Предметы интерьера");
	const catalog = session.page.getByRole("dialog", {
		name: "Предметы интерьера",
	});
	await catalog.getByRole("button", { name: /^Кровать —/ }).click();
	const placeCatalogAsset = catalog.getByRole("button", {
		name: "Показать на плане",
	});
	await expect(placeCatalogAsset).toBeEnabled({ timeout: 30_000 });
	await placeCatalogAsset.click();
	await expect(catalog).toHaveCount(0, { timeout: 60_000 });
	const placement = await roomPoint(session.page);
	await session.page.mouse.click(placement.x, placement.y);
	await expect(
		session.page.getByTestId("item-placement-preview"),
	).toHaveAttribute("data-placement-valid", "true");
	await session.page
		.getByRole("button", { name: "Подтвердить размещение предмета" })
		.click();
	await expect(session.page.getByTestId("item-count")).toHaveText("1 предмет");

	await session.page.addInitScript(() => {
		Object.defineProperty(window.navigator, "onLine", {
			configurable: true,
			value: false,
		});
	});
	await session.context.setOffline(true);
	await session.page.reload();
	await openProjectFromHub(session.page, "Офлайн план");
	await expect(session.page.getByTestId("plan-width")).toHaveText("4000 мм");
	await expect(session.page.getByTestId("item-count")).toHaveText("1 предмет");
	const offlineStatus = session.page.getByTestId("healthy-offline-status");
	await expect(offlineStatus).toHaveText("Офлайн — работаем на устройстве");
	await expect(offlineStatus.getByRole("button")).toHaveCount(0);
	await expect(session.page.getByRole("dialog")).toHaveCount(0);
	await chooseEditorOption(session.page, "3D");
	await expect(
		session.page.getByRole("region", { name: "3D вид комнаты" }),
	).toBeVisible();
	await expect(offlineStatus).toBeVisible();
	await chooseEditorOption(session.page, "План 2D");
	await session.page.getByRole("button", { name: "Размеры плана" }).click();
	await session.page.getByLabel("Ширина, мм").fill("4300");
	await session.page.getByRole("button", { name: "Применить размеры" }).click();
	await expect(session.page.getByTestId("plan-width")).toHaveText("4300 мм");
	await expect(session.page.getByTestId("project-durability-status")).toContainText(
		"Сохранено локально",
	);

	const undo = await openEditorOverflowAction(
		session.page,
		"Отменить действие",
	);
	await undo.click();
	await expect(session.page.getByTestId("plan-width")).toHaveText("4000 мм");
	const redo = await openEditorOverflowAction(
		session.page,
		"Повторить действие",
	);
	await redo.click();
	await expect(session.page.getByTestId("plan-width")).toHaveText("4300 мм");
	await expect(session.page.getByTestId("item-count")).toHaveText("1 предмет");
	await expect(session.page.getByTestId("project-durability-status")).toContainText(
		"Сохранено локально",
	);
	await session.context.setOffline(false);
	await session.page.evaluate(() => {
		Object.defineProperty(window.navigator, "onLine", {
			configurable: true,
			value: true,
		});
		window.dispatchEvent(new Event("online"));
	});
	await expect(offlineStatus).toHaveCount(0);
	await session.context.close();

	const reopened = await openPersistentPhone(testInfo, "pwa-offline-edit");
	await reopened.context.setOffline(true);
	await reopened.page.goto("/");
	await openProjectFromHub(reopened.page, "Офлайн план");
	await expect(reopened.page.getByTestId("plan-width")).toHaveText("4300 мм");
	await expect(reopened.page.getByTestId("item-count")).toHaveText("1 предмет");
	await expect(reopened.page.getByTestId("project-durability-status")).toContainText(
		"Только просмотр",
	);
	await expect(reopened.page.getByTestId("healthy-offline-status")).toHaveCount(0);
	const takeOver = reopened.page.getByRole("button", {
		name: "Взять редактирование на себя",
	});
	await expect(takeOver).toBeVisible();
	await reopened.page.waitForTimeout(WRITER_LEASE_DURATION_MS + 250);
	// A real reload constructs a fresh production repository. The remembered
	// foreign-writer acknowledgement must survive it, so lease expiry cannot
	// silently turn this context into the writer.
	await reopened.page.reload();
	await openProjectFromHub(reopened.page, "Офлайн план");
	await expect(reopened.page.getByTestId("plan-width")).toHaveText("4300 мм");
	await expect(reopened.page.getByTestId("item-count")).toHaveText("1 предмет");
	await expect(reopened.page.getByTestId("project-durability-status")).toContainText(
		"Только просмотр",
	);
	await expect(takeOver).toBeVisible();
	await takeOver.click();
	await reopened.page
		.getByRole("button", { name: "Подтвердить перехват" })
		.click();
	await expect(reopened.page.getByTestId("plan-width")).toHaveText("4300 мм");
	await expect(reopened.page.getByTestId("item-count")).toHaveText("1 предмет");
	await expect(reopened.page.getByTestId("project-durability-status")).toContainText(
		"Сохранено локально",
	);
	await chooseEditorOption(reopened.page, "3D");
	await expect(
		reopened.page.getByRole("region", { name: "3D вид комнаты" }),
	).toBeVisible();
	await reopened.context.close();
});

test("PWA-E2E-03: an installed update waits for the user and rechecks draft safety before the final reload", async ({
	page: _page,
}, testInfo) => {
	test.setTimeout(90_000);
	const session = await openPersistentPhone(testInfo, "pwa-safe-update");
	await session.page.goto("/");
	await session.page.evaluate(async () => {
		await navigator.serviceWorker.ready;
	});
	await session.page.reload();
	await expect
		.poll(() =>
			session.page.evaluate(
				() => navigator.serviceWorker.controller?.scriptURL ?? "",
			),
		)
		.toContain("/sw.js");

	await startNewProjectFromHub(session.page, "Обновляемый план");
	await session.page.getByRole("button", { name: "Создать контур" }).click();
	await expect(session.page.getByTestId("plan-width")).toHaveText("4000 мм");
	await expect(session.page.getByTestId("project-durability-status")).toContainText(
		"Сохранено локально",
	);

	const controllerBeforeUpdate = await session.page.evaluate(
		() => navigator.serviceWorker.controller?.scriptURL ?? "",
	);
	const previousShellCache = "interiors-editor-shell-previous-e2e";
	await session.page.evaluate(async (cacheName) => {
		await caches.open(cacheName);
	}, previousShellCache);
	await session.page.evaluate(async () => {
		await navigator.serviceWorker.register("/sw.js?pwa-update-e2e=next", {
			scope: "/",
		});
	});

	await expect
		.poll(() =>
			session.page.evaluate(async () =>
				Boolean((await navigator.serviceWorker.getRegistration())?.waiting),
			),
		)
		.toBe(true);
	await expect
		.poll(() =>
			session.page.evaluate(
				async (cacheName) => (await caches.keys()).includes(cacheName),
				previousShellCache,
			),
		)
		.toBe(true);
	await expect(session.page.getByTestId("pwa-update-notice")).toBeVisible();
	await expect(session.page.getByTestId("pwa-update-notice")).toContainText(
		"Обновление готово",
	);
	const updateButton = session.page.getByRole("button", {
		name: "Обновить приложение",
	});
	await expect(updateButton).toBeEnabled();
	await expect
		.poll(() =>
			updateButton.evaluate((button) => {
				const bounds = button.getBoundingClientRect();
				const target = document.elementFromPoint(
					bounds.left + bounds.width / 2,
					bounds.top + bounds.height / 2,
				);
				return target === button;
			}),
		)
		.toBe(true);
	await expect
		.poll(() =>
			session.page.evaluate(
				() => navigator.serviceWorker.controller?.scriptURL ?? "",
			),
		)
		.toBe(controllerBeforeUpdate);

	await chooseEditorOption(session.page, "3D");
	await expect(
		session.page.getByRole("region", { name: "3D вид комнаты" }),
	).toBeVisible();
	await chooseEditorOption(session.page, "План 2D");
	await expect(session.page.getByTestId("plan-width")).toHaveText("4000 мм");

	await updateButton.click();
	await expect
		.poll(() =>
			session.page.evaluate(
				() => navigator.serviceWorker.controller?.scriptURL ?? "",
			),
		)
		.toContain("pwa-update-e2e=next");
	const reloadButton = session.page.getByRole("button", {
		name: "Перезагрузить приложение",
	});
	await expect(session.page.getByTestId("pwa-update-notice")).toContainText(
		"готово к перезапуску",
	);
	await expect(reloadButton).toBeEnabled();

	await chooseEditorOption(session.page, "Стена");
	const plan = session.page.getByTestId("plan-canvas");
	const startPoint = await roomPoint(session.page, 0.3, 0.4);
	const endPoint = await roomPoint(session.page, 0.7, 0.4);
	const cdp = await session.page.context().newCDPSession(session.page);
	try {
		const start = {
			id: 81,
			...startPoint,
		};
		await cdp.send("Input.dispatchTouchEvent", {
			touchPoints: [start],
			type: "touchStart",
		});
		await expect(plan.getByTestId("wall-draft")).toHaveCount(1);
		await cdp.send("Input.dispatchTouchEvent", {
			touchPoints: [
				{
					...start,
					...endPoint,
				},
			],
			type: "touchMove",
		});
		await cdp.send("Input.dispatchTouchEvent", {
			touchPoints: [],
			type: "touchEnd",
		});
	} finally {
		await cdp.detach();
	}
	await expect(session.page.getByTestId("wall-draft-actions")).toBeVisible();
	await expect(reloadButton).toBeDisabled();
	await session.page.getByRole("button", { name: "Отменить стену" }).click();
	await expect(reloadButton).toBeEnabled();

	const reloaded = session.page.waitForEvent("framenavigated");
	await reloadButton.click();
	await reloaded;
	await session.page.waitForLoadState("domcontentloaded");
	await expect
		.poll(() =>
			session.page.evaluate(
				async (cacheName) => (await caches.keys()).includes(cacheName),
				previousShellCache,
			),
		)
		.toBe(false);
	await openProjectFromHub(session.page, "Обновляемый план");
	await expect(session.page.getByTestId("plan-width")).toHaveText("4000 мм");
	await expect(session.page.getByTestId("project-durability-status")).toContainText(
		"Сохранено локально",
	);
	await session.context.close();
});

test("PWA-E2E-05: a waiting update cannot reload while an uncommitted wall draft is active", async ({
	page: _page,
}, testInfo) => {
	const session = await openPersistentPhone(testInfo, "pwa-update-active-draft");
	await session.page.goto("/");
	await session.page.evaluate(async () => {
		await navigator.serviceWorker.ready;
	});
	await session.page.reload();
	await expect
		.poll(() =>
			session.page.evaluate(
				() => navigator.serviceWorker.controller?.scriptURL ?? "",
			),
		)
		.toContain("/sw.js");

	await startNewProjectFromHub(session.page, "Черновик перед обновлением");
	await session.page.getByRole("button", { name: "Создать контур" }).click();
	await chooseEditorOption(session.page, "Стена");
	const plan = session.page.getByTestId("plan-canvas");
	const startPoint = await roomPoint(session.page, 0.3, 0.4);
	const endPoint = await roomPoint(session.page, 0.7, 0.4);
	const cdp = await session.page.context().newCDPSession(session.page);
	try {
		const start = { id: 24, ...startPoint };
		await cdp.send("Input.dispatchTouchEvent", { touchPoints: [start], type: "touchStart" });
		await expect(plan.getByTestId("wall-draft")).toHaveCount(1);
		await cdp.send("Input.dispatchTouchEvent", {
			touchPoints: [{ ...start, ...endPoint }],
			type: "touchMove",
		});
		await cdp.send("Input.dispatchTouchEvent", { touchPoints: [], type: "touchEnd" });
	} finally {
		await cdp.detach();
	}
	await expect(session.page.getByTestId("wall-draft-actions")).toBeVisible();

	await session.page.evaluate(async () => {
		await navigator.serviceWorker.register("/sw.js?pwa-active-draft-e2e=next", {
			scope: "/",
		});
	});
	await expect
		.poll(() =>
			session.page.evaluate(async () =>
				Boolean((await navigator.serviceWorker.getRegistration())?.waiting),
			),
		)
		.toBe(true);
	const updateButton = session.page.getByRole("button", {
		name: "Обновить приложение",
	});
	await expect(session.page.getByTestId("pwa-update-notice")).toBeVisible();
	await expect(updateButton).toBeDisabled();

	await session.page.getByRole("button", { name: "Отменить стену" }).click();
	await expect(updateButton).toBeEnabled();
	await session.context.close();
});

test("PWA-E2E-05A: a waiting update becomes available after a 3D item transform saves automatically", async ({
	page: _page,
}, testInfo) => {
	test.setTimeout(90_000);
	const session = await openPersistentPhone(
		testInfo,
		"pwa-update-three-dimensional-item-draft",
	);
	await session.page.goto("/");
	await session.page.evaluate(async () => {
		await navigator.serviceWorker.ready;
	});
	await session.page.reload();
	await expect
		.poll(() =>
			session.page.evaluate(
				() => navigator.serviceWorker.controller?.scriptURL ?? "",
			),
		)
		.toContain("/sw.js");

	await startNewProjectFromHub(session.page, "3D черновик перед обновлением");
	await session.page.getByRole("button", { name: "Создать контур" }).click();
	await chooseEditorOption(session.page, "Предметы интерьера");
	const catalog = session.page.getByRole("dialog", {
		name: "Предметы интерьера",
	});
	await catalog.getByRole("button", { name: /^Кровать —/ }).click();
	const showOnPlan = catalog.getByRole("button", {
		name: "Показать на плане",
	});
	await expect(showOnPlan).toBeEnabled({ timeout: 30_000 });
	await showOnPlan.click();
	await expect(catalog).toHaveCount(0, { timeout: 60_000 });
	const placement = await roomPoint(session.page);
	await session.page.mouse.click(placement.x, placement.y);
	await expect(
		session.page.getByTestId("item-placement-preview"),
	).toHaveAttribute("data-placement-valid", "true");
	await session.page
		.getByRole("button", { name: "Подтвердить размещение предмета" })
		.click();
	await expect(session.page.getByTestId("item-count")).toHaveText("1 предмет");

	await chooseEditorOption(session.page, "3D");
	const scene = session.page.getByTestId("three-dimensional-canvas");
	const sceneBox = await scene.boundingBox();
	if (!sceneBox) throw new Error("3D canvas did not render");
	await session.page.mouse.click(
		sceneBox.x + sceneBox.width / 2,
		sceneBox.y + sceneBox.height / 2,
	);
	await session.page.mouse.move(
		sceneBox.x + sceneBox.width / 2,
		sceneBox.y + sceneBox.height / 2,
	);
	await session.page.mouse.down();
	await session.page.mouse.move(
		sceneBox.x + sceneBox.width * 0.58,
		sceneBox.y + sceneBox.height * 0.54,
		{ steps: 4 },
	);
	await session.page.mouse.up();
	await expect(
		session.page.getByTestId("three-dimensional-item-transform-draft"),
	).toHaveCount(0);

	await session.page.evaluate(async () => {
		await navigator.serviceWorker.register("/sw.js?pwa-3d-draft-e2e=next", {
			scope: "/",
		});
	});
	await expect
		.poll(() =>
			session.page.evaluate(async () =>
				Boolean((await navigator.serviceWorker.getRegistration())?.waiting),
			),
		)
		.toBe(true);
	const updateButton = session.page.getByRole("button", {
		name: "Обновить приложение",
	});
	await expect(session.page.getByTestId("pwa-update-notice")).toBeVisible();
	await expect(updateButton).toBeEnabled();
	await session.context.close();
});

test("PWA-E2E-06: the controlled shell and worker report one versioned release manifest before editing", async ({
	page: _page,
}, testInfo) => {
	const session = await openPersistentPhone(testInfo, "pwa-release-manifest");
	await session.page.goto("/");
	await session.page.evaluate(async () => {
		await navigator.serviceWorker.ready;
	});
	await session.page.reload();
	const result = await session.page.evaluate(async () => {
		const response = await fetch("/release-manifest.json");
		if (!response.ok) throw new Error(`Release manifest failed with ${response.status}`);
		const shellManifest = await response.json();
		const worker = navigator.serviceWorker.controller;
		if (!worker) throw new Error("No controlling worker");
		const workerManifest = await new Promise((resolve, reject) => {
			const channel = new MessageChannel();
			const timeout = window.setTimeout(() => reject(new Error("Worker manifest timed out")), 1_000);
			channel.port1.onmessage = (event) => {
				window.clearTimeout(timeout);
				resolve(event.data?.manifest);
			};
			worker.postMessage({ type: "INTERIORS_RELEASE_MANIFEST" }, [channel.port2]);
		});
		return { shellManifest, workerManifest };
	});
	expect(result.shellManifest).toMatchObject({
		assetSchemas: { readable: [1], writable: [1] },
		catalogSchemas: { readable: [1], writable: [1] },
		minimumCapabilities: ["indexeddb"],
		projectSchemas: { readable: [1], writable: [1] },
		version: 1,
		workerProtocolVersion: 1,
	});
	expect(result.shellManifest.appBuildId).toMatch(/^[a-f0-9]{16}$/);
	expect(result.workerManifest).toEqual(result.shellManifest);
	await session.context.close();
});

test("PWA-E2E-07: an unsupported persisted schema remains untouched and is offered for recovery export", async ({
	page: _page,
}, testInfo) => {
	const session = await openPersistentPhone(testInfo, "pwa-release-recovery");
	await session.page.goto("/");
	await session.page.evaluate(async () => {
		await navigator.serviceWorker.ready;
	});
	await session.page.reload();
	await startNewProjectFromHub(session.page, "Нужен recovery export");
	await session.page.getByRole("button", { name: "Создать контур" }).click();
	// The contour command publishes asynchronously.  Do not corrupt an earlier
	// revision while its fenced durable write is still in flight: that would let
	// the valid publication correctly overwrite this unsupported-schema fixture.
	await expect(
		session.page.getByTestId("project-durability-status"),
	).toHaveText("Сохранено локально");

	const source = await session.page.evaluate(async () => {
		const database = await new Promise<IDBDatabase>((resolve, reject) => {
			const request = indexedDB.open("interiors-editor-projects");
			request.onsuccess = () => resolve(request.result);
			request.onerror = () => reject(request.error);
		});
		const result = await new Promise<{ revisionId: string; serializedProject: string }>((resolve, reject) => {
			const transaction = database.transaction(["projects", "revisions"], "readwrite");
			const projects = transaction.objectStore("projects");
			const revisions = transaction.objectStore("revisions");
			const pointers = projects.getAll();
			pointers.onerror = () => reject(pointers.error);
			pointers.onsuccess = () => {
				const pointer = pointers.result[0];
				const revision = revisions.get(pointer.currentRevisionId);
				revision.onerror = () => reject(revision.error);
				revision.onsuccess = () => {
					const record = revision.result;
					record.candidate.project.schemaVersion = 7;
					record.candidate.revision.schemaVersion = 7;
					record.candidate.revision.serializedProject = JSON.stringify({
						preserved: "exact recovery source",
						schemaVersion: 7,
					});
					revisions.put(record);
					resolve({
						revisionId: pointer.currentRevisionId,
						serializedProject: record.candidate.revision.serializedProject,
					});
				};
			};
			transaction.onerror = () => reject(transaction.error);
		});
		database.close();
		return result;
	});

	await session.page.reload();
	await expect(
		session.page.getByRole("heading", { name: "Безопасное восстановление проекта" }),
	).toBeVisible();
	await expect(session.page.getByTestId("editor-workspace")).toHaveCount(0);
	const download = session.page.waitForEvent("download");
	await session.page
		.getByRole("button", { name: "Скачать копию для восстановления" })
		.click();
	await expect((await download).suggestedFilename()).toContain("recovery.json");
	const after = await session.page.evaluate(async () => {
		const database = await new Promise<IDBDatabase>((resolve, reject) => {
			const request = indexedDB.open("interiors-editor-projects");
			request.onsuccess = () => resolve(request.result);
			request.onerror = () => reject(request.error);
		});
		const pointer = await new Promise<{ currentRevisionId: string }>((resolve, reject) => {
			const transaction = database.transaction("projects", "readonly");
			const request = transaction.objectStore("projects").getAll();
			request.onsuccess = () => resolve(request.result[0]);
			request.onerror = () => reject(request.error);
		});
		database.close();
		return pointer.currentRevisionId;
	});
	expect(after).toBe(source.revisionId);
	await session.context.close();
});

test("PWA-E2E-04: a controlled PWA passes catalog API ranges through without caching remote catalog bytes", async ({
	page: _page,
}, testInfo) => {
	const session = await openPersistentPhone(testInfo, "pwa-catalog-range");
	await session.page.goto("/");
	await session.page.evaluate(async () => {
		await navigator.serviceWorker.ready;
	});
	await session.page.reload();
	await expect
		.poll(() =>
			session.page.evaluate(
				() => navigator.serviceWorker.controller?.scriptURL ?? "",
			),
		)
		.toContain("/sw.js");

	const catalogHash =
		"a7bee7a29476970b9ecded133da4cdd4bd679d175d62395fe7994a4f424b1346";
	const rangeResult = await session.page.evaluate(async (hash) => {
		const response = await fetch(`/catalog-api/v1/resources/sha256/${hash}`, {
			headers: { Accept: "model/gltf-binary", Range: "bytes=0-19" },
		});
		return {
			byteLength: (await response.arrayBuffer()).byteLength,
			status: response.status,
		};
	}, catalogHash);
	expect(rangeResult).toEqual({ byteLength: 20, status: 206 });

	const cachedCatalogApi = await session.page.evaluate(async () => {
		for (const cacheName of await caches.keys()) {
			const cache = await caches.open(cacheName);
			if (
				(await cache.keys()).some((request) =>
					new URL(request.url).pathname.startsWith("/catalog-api/"),
				)
			)
				return true;
		}
		return false;
	});
	expect(cachedCatalogApi).toBe(false);
	await session.context.close();
});

test("PWA-E2E-05: storage-pressure cleanup removes only repeatable browse cache and never catalog-control-plane bytes", async ({
	page: _page,
}, testInfo) => {
	const session = await openPersistentPhone(
		testInfo,
		"pwa-browse-cache-cleanup",
	);
	await session.page.addInitScript(() => {
		Object.defineProperty(navigator.storage, "estimate", {
			configurable: true,
			value: async () => ({ quota: 1_000, usage: 900 }),
		});
	});
	await session.page.goto("/");
	await session.page.evaluate(async () => {
		await navigator.serviceWorker.ready;
	});
	await session.page.reload();
	await expect
		.poll(() =>
			session.page.evaluate(
				() => navigator.serviceWorker.controller?.scriptURL ?? "",
			),
		)
		.toContain("/sw.js");

	await session.page.evaluate(async () => {
		const response = await fetch(
			"/catalog/antique-leather-sofa.png?browse-probe=1",
		);
		if (!response.ok)
			throw new Error(`Browse probe failed: ${response.status}`);
	});

	await startNewProjectFromHub(session.page, "Кэш каталога");
	const warning = session.page.getByTestId("storage-pressure");
	await expect(warning).toContainText("Риск заполнения хранилища");

	await chooseEditorOption(session.page, "Предметы интерьера");
	const catalog = session.page.getByRole("dialog", {
		name: "Предметы интерьера",
	});
	await expect(
		catalog.getByRole("img", { name: /Превью предмета:/ }).first(),
	).toBeVisible();
	await catalog
		.getByRole("button", { name: "Закрыть предметы интерьера" })
		.click();

	const browsePathsBeforeCleanup = await session.page.evaluate(async () => {
		const cacheName = (await caches.keys()).find((key) =>
			/^interiors-editor-browse-[a-f0-9]{16}$/.test(key),
		);
		if (!cacheName) return [];
		return (await (await caches.open(cacheName)).keys()).map(
			(request) => new URL(request.url).pathname,
		);
	});
	expect(browsePathsBeforeCleanup).toContain(
		"/catalog/antique-leather-sofa.png",
	);
	const cachedCatalogApiBeforeCleanup = await session.page.evaluate(
		async () => {
			for (const cacheName of await caches.keys()) {
				const requests = await (await caches.open(cacheName)).keys();
				if (
					requests.some((request) =>
						new URL(request.url).pathname.startsWith("/catalog-api/"),
					)
				)
					return true;
			}
			return false;
		},
	);
	expect(cachedCatalogApiBeforeCleanup).toBe(false);

	await warning
		.getByRole("button", { name: "Освободить место в кэше" })
		.click();
	await expect(warning).toContainText("Кэш повторно загружаемых данных очищен");
	await expect
		.poll(() =>
			session.page.evaluate(async () =>
				(await caches.keys()).some((key) =>
					key.startsWith("interiors-editor-browse-"),
				),
			),
		)
		.toBe(false);
	await expect
		.poll(() =>
			session.page.evaluate(async () =>
				(await caches.keys()).some((key) =>
					/^interiors-editor-shell-[a-f0-9]{16}$/.test(key),
				),
			),
		)
		.toBe(true);

	await session.context.setOffline(true);
	await session.page.reload();
	await openProjectFromHub(session.page, "Кэш каталога");
	await expect(
		session.page.getByTestId("project-durability-status"),
	).toContainText("Сохранено локально");
	await session.context.close();
});
