import { RuntimePortableBackupCodec } from "../../src/adapters/portable-backup/runtime-portable-backup-codec";
import { validateRuntimeV1Project } from "../../src/application/runtime-v1-project-validation";
import { expect, type Page, type Locator, test } from "@playwright/test";
import {
	audit,
	installEntryAudit,
	semanticRows,
} from "./telegram-entry-support";
import { signedExample } from "./telegram-entry-signed-fixture";
const sdkURL = "**/telegram-sdk/telegram-web-app.124bdff7ba3fe86c8ba5143467afec21e020405e74abdb92cfdda6c0ee3b5908.js";
async function noStorage(page: Page, expectedReady = 0) {
	const observed = await audit(page);
	expect(observed.opens).toEqual([]);
	expect(
		observed.deletes +
			observed.registrations +
			observed.unregisters +
			observed.cacheDeletes,
	).toBe(0);
	expect(observed.ready).toBe(expectedReady);
	expect(observed.contexts).toBe(observed.releasedContexts);
}
async function signed(page: Page) {
	await page.clock.setFixedTime(new Date(1_733_584_787_000));
	await installEntryAudit(page, "signed", signedExample);
}
async function createRoom(page: Page, name: string) {
	await expect(
		page.getByRole("button", { name: "Новый проект", exact: true }),
	).toBeVisible();
	await page.getByRole("button", { name: "Новый проект", exact: true }).click();
	await page.getByRole("textbox", { name: "Название проекта" }).fill(name);
	await page
		.getByRole("button", { name: "Создать проект", exact: true })
		.click();
	await page
		.getByRole("textbox", { name: "Ширина, мм", exact: true })
		.fill("4100");
	await page
		.getByRole("textbox", { name: "Глубина, мм", exact: true })
		.fill("3200");
	await page
		.getByRole("textbox", { name: "Высота, мм", exact: true })
		.fill("2700");
	await page
		.getByRole("button", { name: "Создать контур", exact: true })
		.click();
	await expect(
		page.getByTestId("editor-top-bar").getByRole("status"),
	).toHaveText("Сохранено");
}
test.beforeEach(async ({ page, baseURL }) => {
	if (!baseURL) throw new Error("Missing isolated Telegram target origin");
	await page.request.post(`${baseURL}/__entry-proof/activate-base`);
	const environment = await page.request
		.get(`${baseURL}/__entry-proof/environment`)
		.then((response) => response.json());
	const allowed = new Set([new URL(baseURL).origin, environment.emptyOrigin]);
	await page.route("**/*", (route) =>
		allowed.has(new URL(route.request().url()).origin)
			? route.continue()
			: route.abort(),
	);
});
test("TMA-ENTRY-01: an empty deployment keeps a Web link and retry/exit without SDK or DB", async ({
	page,
	baseURL,
}) => {
	const environment = await page.request
		.get(`${baseURL}/__entry-proof/environment`)
		.then((response) => response.json());
	await installEntryAudit(page, "invalid");
	await page.goto(environment.emptyOrigin);
	await expect(
		page.getByText(
			"Этот Telegram-редактор пока не настроен. Можно открыть веб-редактор.",
		),
	).toBeVisible();
	await expect(
		page.getByRole("link", { name: "Открыть веб-редактор" }),
	).toHaveAttribute("href", "https://example.invalid/editor");
	await page
		.getByRole("button", { name: "Повторить запуск", exact: true })
		.click();
	await expect(
		page.getByRole("button", { name: "Выйти", exact: true }),
	).toBeVisible();
	expect((await audit(page)).sdkReads).toBe(0);
	await noStorage(page);
});
test("TMA-ENTRY-02: a rejected launch reveals committed recovery UI without opening any namespace", async ({
	page,
}) => {
	await installEntryAudit(page, "invalid");
	await page.goto("/");
	await expect(
		page.getByText(/Безопасный запуск не подтверждён/),
	).toBeVisible();
	await expect.poll(async () => (await audit(page)).ready).toBe(1);
	expect(await page.evaluate(() => window.__telegramEntryProof.host.calls)).toEqual(["recovery-ready"]);
	await noStorage(page, 1);
	await page.getByRole("button", { name: "Повторить запуск", exact: true }).click();
	await expect.poll(async () => (await audit(page)).ready).toBe(2);
	expect(await page.evaluate(() => window.__telegramEntryProof.host.calls)).toEqual(["recovery-ready", "recovery-ready"]);
	await noStorage(page, 2);
	await page.getByRole("button", { name: "Выйти", exact: true }).click();
	await expect.poll(async () => (await audit(page)).closed).toBe(1);
});
test("TMA-ENTRY-03: a foreign loaded-shell capsule is rejected before reading SDK", async ({
	page,
}) => {
	await installEntryAudit(page, "invalid");
	await page.route(
		(url) => url.pathname === "/",
		async (route) => {
			const original = await route.fetch();
			const html = (await original.text()).replace(
				/("entryPath":")\/telegram\.[A-Za-z0-9_-]+\.js"/,
				'$1/telegram.foreign.js"',
			);
			await route.fulfill({ response: original, body: html });
		},
	);
	await page.goto("/");
	await expect(
		page.getByText(/Безопасный запуск не подтверждён/),
	).toBeVisible();
	expect((await audit(page)).sdkReads).toBe(0);
	await noStorage(page);
});
test("TMA-ENTRY-04: an existing real controlling worker with unavailable manifest is retained and blocks launch", async ({
	page,
}) => {
	await installEntryAudit(page, "invalid");
	await page.goto("/");
	await expect(
		page.getByText(/Безопасный запуск не подтверждён/),
	).toBeVisible();
	await page.evaluate(() => window.__telegramEntryProof.installWorker());
	await page.reload();
	await expect(
		page.getByText(/Безопасный запуск не подтверждён/),
	).toBeVisible();
	expect(await page.evaluate(() => !!navigator.serviceWorker.controller)).toBe(
		true,
	);
	expect((await audit(page)).sdkReads).toBe(0);
	await noStorage(page);
});
test("TMA-ENTRY-05: blocked SDK leaves loading and offers a finite fresh retry", async ({
	page,
}) => {
	let requests = 0;
	await installEntryAudit(page, "missing");
	await page.route(sdkURL, (route) => {
		requests++;
		return route.abort();
	});
	await page.goto("/");
	await expect(
		page.getByRole("button", { name: "Повторить запуск", exact: true }),
	).toBeVisible();
	expect(requests).toBe(1);
	await page
		.getByRole("button", { name: "Повторить запуск", exact: true })
		.click();
	await expect.poll(() => requests).toBe(2);
	await expect(
		page.getByRole("button", { name: "Повторить запуск", exact: true }),
	).toBeVisible();
	await noStorage(page);
});
test("TMA-ENTRY-06: a stalled native script times out, and its late failure cannot create runtime", async ({
	page,
}) => {
	await installEntryAudit(page, "missing");
	await page.clock.install();
	let stalled: Parameters<Parameters<Page["route"]>[1]>[0] | undefined;
	await page.route(sdkURL, (route) => {
		stalled = route;
	});
	await page.goto("/", { waitUntil: "domcontentloaded" });
	await expect.poll(() => !!stalled).toBe(true);
	await page.clock.runFor(10_001);
	await expect(page.getByText(/Telegram не ответил вовремя/)).toBeVisible();
	await stalled?.abort();
	await noStorage(page);
});
test("TMA-ENTRY-07: real signed native bootstrap and shared factory save and reopen the exact local rectangle", async ({
	page,
}) => {
	await signed(page);
	await page.goto("/");
	await createRoom(page, "Actual Telegram entry");
	const before = await semanticRows(page);
	expect(before.revisions).toHaveLength(2);
	const observed = await audit(page);
	expect(observed.ready).toBe(1);
	expect(observed.opens.length).toBeGreaterThan(0);
	expect(
		observed.opens.every((name) =>
			/^interiors-editor-projects:tma-v1-[0-9a-f]{64}$/.test(name),
		),
	).toBe(true);
	expect(
		observed.registrations +
			observed.unregisters +
			observed.deletes +
			observed.cacheDeletes,
	).toBe(0);
	await page.clock.setFixedTime(new Date(1_733_584_793_000));
	await page.reload();
	await page
		.getByRole("button", { name: "Открыть Actual Telegram entry", exact: true })
		.click();
	await expect(
		page.getByTestId("editor-top-bar").getByRole("status"),
	).toHaveText("Сохранено");
	expect(await semanticRows(page)).toEqual(before);
});
for (const direction of ["release", "rollback"] as const)
	test(`TMA-ENTRY-${direction === "release" ? "08" : "09"}: old loaded shell resolves its pending application module after ${direction}`, async ({
		page,
		baseURL,
	}, info) => {
		const environment = await page.request
			.get(`${baseURL}/__entry-proof/environment`)
			.then((response) => response.json());
		if (direction === "rollback")
			await page.request.post(`${baseURL}/__entry-proof/activate-next`);
		const oldApplicationPath: string =
			direction === "release"
				? environment.baseApplicationPath
				: environment.nextApplicationPath;
		await signed(page);
		let held: Parameters<Parameters<Page["route"]>[1]>[0] | undefined;
		await page.route(
			(url) => url.pathname === oldApplicationPath,
			(route) => {
				held = route;
			},
		);
		await page.goto("/", { waitUntil: "domcontentloaded" });
		await expect.poll(() => !!held).toBe(true);
		expect((await audit(page)).opens).toEqual([]);
		const old = await page.request
			.get("/release-set.json")
			.then((response) => response.json());
		await page.request.post(
			`${baseURL}/__entry-proof/${direction === "release" ? "activate-next" : "activate-base"}`,
		);
		const active = await page.request
			.get("/release-set.json")
			.then((response) => response.json());
		expect(active.appBuildId).not.toBe(old.appBuildId);
		expect(
			active.assets.some(
				(asset: { path: string }) => asset.path === oldApplicationPath,
			),
		).toBe(false);
		await held?.continue();
		await createRoom(page, `Old ${direction} client`);
		const before = await semanticRows(page);
		await page
			.getByTestId("editor-view-switch")
			.getByRole("button", { name: "3D", exact: true })
			.click();
		await expect(page.getByTestId("three-dimensional-canvas")).toBeVisible();
		expect(await semanticRows(page)).toEqual(before);
		const observed = await page.request
			.get(`${baseURL}/__entry-proof/environment`)
			.then((response) => response.json());
		expect(
			observed.served.some(
				(entry: { path: string; activeBuildId: string }) =>
					entry.path === oldApplicationPath &&
					entry.activeBuildId === active.appBuildId,
			),
		).toBe(true);
		const embedded = await page.evaluate(
			() =>
				JSON.parse(
					document.getElementById("telegram-loaded-release")?.textContent ??
						"null",
				).manifest.appBuildId,
		);
		expect(embedded).toBe(old.appBuildId);
		expect((await audit(page)).ready).toBe(1);
		await info.attach(`old-client-${direction}-3d`, {
			body: await page.screenshot(),
			contentType: "image/png",
		});
		await info.attach("retained-application-boundary", {
			body: JSON.stringify({
				oldApplicationPath,
				oldBuild: old.appBuildId,
				activeBuild: active.appBuildId,
				embeddedBuild: embedded,
				physicalTelegram: false,
				threeWasAlreadyStatic: true,
			}),
			contentType: "application/json",
		});
	});
test("TMA-ENTRY-10: a missing application chunk gives retry and Web fallback without a partial runtime", async ({
	page,
}) => {
	await installEntryAudit(page, "invalid");
	let blocked = true;
	await page.route(
		(url) => /^\/[0-9]+\.[a-z0-9]+\.js$/.test(url.pathname),
		(route) => (blocked ? route.abort() : route.continue()),
	);
	await page.goto("/");
	await expect(page.getByText(/Не удалось загрузить редактор/)).toBeVisible();
	await expect(
		page.getByRole("link", { name: "Открыть веб-редактор" }),
	).toBeVisible();
	await noStorage(page);
	blocked = false;
	await page
		.getByRole("button", { name: "Повторить запуск", exact: true })
		.click();
	await expect(
		page.getByText(/Безопасный запуск не подтверждён/),
	).toBeVisible();
	await expect.poll(async () => (await audit(page)).ready).toBe(1);
	await noStorage(page, 1);
});
test("TMA-ENTRY-11: a verified SDK ready failure revokes admission and offers retry before any database opens", async ({
	page,
}) => {
	await page.clock.setFixedTime(new Date(1_733_584_787_000));
	await installEntryAudit(page, "signed-ready-fails", signedExample);
	await page.goto("/");
	await expect(
		page.getByText(/Безопасный запуск не подтверждён/),
	).toBeVisible();
	await expect(
		page.getByRole("button", { name: "Повторить запуск", exact: true }),
	).toBeVisible();
	const observed = await audit(page);
	expect(observed.ready).toBe(1);
	expect(observed.opens).toEqual([]);
	expect(
		observed.registrations +
			observed.unregisters +
			observed.deletes +
			observed.cacheDeletes,
	).toBe(0);
});

test("TMA-HOST-01: actual SDK stable viewport, overlapping insets and keyboard resize preserve the exact Project", async ({
	page,
}) => {
	await signed(page);
	await page.goto("/");
	await createRoom(page, "Host layout");
	const before = await semanticRows(page);
	const initialHeight = await page.evaluate(() =>
		Math.min(700, innerHeight, visualViewport?.height ?? innerHeight),
	);
	expect(
		await page.evaluate(() =>
			parseFloat(
				document.documentElement.style.getPropertyValue(
					"--editor-viewport-height",
				),
			),
		),
	).toBe(initialHeight);
	expect(
		await page.evaluate(() =>
			document.documentElement.style.getPropertyValue("--editor-safe-area-top"),
		),
	).toBe("max(env(safe-area-inset-top, 0px), 30px)");
	await page.evaluate(() => {
		window.__telegramEntryProof.host.patch({
			viewportHeight: 500,
			viewportStableHeight: 500,
		});
		window.__telegramEntryProof.host.emit("viewportChanged", {
			isStateStable: false,
		});
	});
	expect(
		await page.evaluate(() =>
			parseFloat(
				document.documentElement.style.getPropertyValue(
					"--editor-viewport-height",
				),
			),
		),
	).toBe(initialHeight);
	await page.setViewportSize({ width: 360, height: 420 });
	await expect
		.poll(() =>
			page.evaluate(() =>
				parseFloat(
					document.documentElement.style.getPropertyValue(
						"--editor-viewport-height",
					),
				),
			),
		)
		.toBeLessThanOrEqual(420);
	await page.evaluate(() =>
		window.__telegramEntryProof.host.emit("viewportChanged", {
			isStateStable: true,
		}),
	);
	expect(await semanticRows(page)).toEqual(before);
});
test("TMA-HOST-02: dark host theme keeps actual room controls readable without changing any Revision", async ({
	page,
}) => {
	await signed(page);
	await page.goto("/");
	await createRoom(page, "Host theme");
	const before = await semanticRows(page);
	await page.evaluate(() => {
		window.__telegramEntryProof.host.patch({
			colorScheme: "dark",
			themeParams: { bg_color: "#ffffff", text_color: "#ffffff" },
		});
		window.__telegramEntryProof.host.emit("themeChanged");
	});
	await page.getByTestId("wall-segment").first().click();
	await page
		.getByRole("button", { name: "Добавить проём", exact: true })
		.click();
	const dialog = page.getByRole("dialog", { name: "Новый проём", exact: true });
	await expect(dialog).toBeVisible();
	expect(
		await dialog
			.locator("form")
			.evaluate((element) => getComputedStyle(element).backgroundColor),
	).toBe("rgb(31, 44, 54)");
	const colors = await dialog
		.getByRole("textbox", { name: "Ширина, мм", exact: true })
		.evaluate((input) => {
			const colors = [];
			for (const element of [
				input,
				input.closest("label"),
				input.parentElement,
			]) {
				if (!element) continue;
				const fg = getComputedStyle(element).color;
				let current: Element | null = element,
					bg = "";
				while (current) {
					const value = getComputedStyle(current).backgroundColor;
					if (value !== "rgba(0, 0, 0, 0)" && value !== "transparent") {
						bg = value;
						break;
					}
					current = current.parentElement;
				}
				colors.push({ fg, bg });
			}
			return colors;
		});
	function luminance(raw: string) {
		const components = raw.match(/[\d.]+/g);
		if (!components || components.length < 3)
			throw new Error("Expected computed RGB color");
		const rgb = components
			.slice(0, 3)
			.map(Number)
			.map((n) => {
				const c = n / 255;
				return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
			});
		return 0.2126 * rgb[0] + 0.7152 * rgb[1] + 0.0722 * rgb[2];
	}
	for (const { fg, bg } of colors) {
		const a = luminance(fg),
			b = luminance(bg);
		expect(
			(Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05),
			`${fg} on ${bg}`,
		).toBeGreaterThanOrEqual(4.5);
	}
	expect(await semanticRows(page)).toEqual(before);
});
test("TMA-HOST-03: actual SDK Back preserves raw room draft and fresh focus until explicit discard", async ({
	page,
}) => {
	await signed(page);
	await page.goto("/");
	await createRoom(page, "Host Back");
	await page.getByRole("button", { name: "Помещения", exact: true }).click();
	const directory = page.getByRole("dialog", {
			name: "Помещения",
			exact: true,
		}),
		input = directory.getByRole("textbox", {
			name: "Высота помещения, мм",
			exact: true,
		});
	await input.fill(" 02x ");
	await input.focus();
	const before = await semanticRows(page);
	await page.evaluate(() =>
		window.__telegramEntryProof.host.emit("backButtonClicked"),
	);
	const guard = page.getByRole("alertdialog", {
		name: "Несохранённая правка",
		exact: true,
	});
	await expect(guard).toBeVisible();
	await guard.getByRole("button", { name: "Продолжить", exact: true }).click();
	await expect(input).toHaveValue(" 02x ");
	await expect(input).toBeFocused();
	expect(await semanticRows(page)).toEqual(before);
	expect(
		await page.evaluate(
			() => window.__telegramEntryProof.host.listeners().backButtonClicked,
		),
	).toBe(1);
});
test("TMA-HOST-04: observable changed launch drains the mounted runtime and removes every host listener without changing saved data", async ({
	page,
}) => {
	await signed(page);
	await page.goto("/");
	await createRoom(page, "Host replacement");
	const before = await semanticRows(page);
	await page.evaluate(() => {
		window.__telegramEntryProof.host.patch({
			initData: "unsigned replacement",
		});
		window.__telegramEntryProof.host.emit("activated");
	});
	await expect(
		page.getByText(/Безопасный запуск не подтверждён/),
	).toBeVisible();
	expect(
		await page.evaluate(() =>
			Object.values(window.__telegramEntryProof.host.listeners()).every(
				(value) => value === 0,
			),
		),
	).toBe(true);
	expect(
		await page.evaluate(() =>
			document.documentElement.style.getPropertyValue(
				"--editor-viewport-height",
			),
		),
	).toBe("");
	expect(await semanticRows(page)).toEqual(before);
	expect((await audit(page)).deletes).toBe(0);
});

test("TMA-THEME-01: canonical dark Plan remains readable and theme switches preserve raw field, focus, caret and exact rows", async ({
	page,
}, info) => {
	await signed(page);
	await page.goto("/");
	await createRoom(page, "Canonical dark Plan");
	const before = await semanticRows(page);
	const geometry = () =>
		page.getByTestId("plan-canvas").evaluate((svg) => ({
			viewBox: svg.getAttribute("viewBox"),
			walls: [...svg.querySelectorAll('[data-testid="wall-segment"]')].map(
				(wall) => ({
					id: wall.getAttribute("data-wall-id"),
					d: wall.getAttribute("d"),
					points: wall.getAttribute("points"),
				}),
			),
		}));
	const oldGeometry = await geometry();
	await page.evaluate(() => {
		window.__telegramEntryProof.host.patch({ colorScheme: "dark" });
		window.__telegramEntryProof.host.emit("themeChanged");
	});
	const colors = await page.getByTestId("plan-canvas").evaluate((svg) => {
		const room = svg.querySelector('[data-testid="room-face"]');
		if (!room) throw new Error("Expected real Room projection");
		const background = getComputedStyle(room).fill;
		const labels = [
			...svg.querySelectorAll(
				'[data-testid="room-measurement"] text,[data-testid="drawing-dimensions"] text',
			),
		]
			.filter(
				(element) =>
					element.textContent?.trim() &&
					element.getClientRects().length > 0 &&
					getComputedStyle(element).visibility !== "hidden",
			)
			.map((element) => ({
				text: element.textContent,
				color: getComputedStyle(element).fill,
			}));
		return { background, labels };
	});
	expect(colors.background).toBe("rgb(29, 37, 44)");
	expect(colors.labels.length).toBeGreaterThan(0);
	function luminance(raw: string) {
		const components = raw.match(/[\d.]+/g);
		if (!components || components.length < 3)
			throw new Error(`Expected computed color ${raw}`);
		const rgb = components
			.slice(0, 3)
			.map(Number)
			.map((n) => {
				const c = n / 255;
				return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
			});
		return 0.2126 * rgb[0] + 0.7152 * rgb[1] + 0.0722 * rgb[2];
	}
	for (const label of colors.labels) {
		const a = luminance(label.color),
			b = luminance(colors.background);
		expect(
			(Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05),
			label.text ?? "",
		).toBeGreaterThanOrEqual(4.5);
	}
	expect(await geometry()).toEqual(oldGeometry);
	await info.attach("dark-plan-contrast", {
		body: await page.screenshot(),
		contentType: "image/png",
	});
	await page.getByRole("button", { name: "Помещения", exact: true }).click();
	const input = page
		.getByRole("dialog", { name: "Помещения", exact: true })
		.getByRole("textbox", { name: "Высота помещения, мм", exact: true });
	await input.fill(" 02x ");
	await input.evaluate((element: HTMLInputElement) => {
		element.focus();
		element.setSelectionRange(1, 4, "backward");
	});
	for (const scheme of ["light", "dark"]) {
		await page.evaluate((colorScheme) => {
			window.__telegramEntryProof.host.patch({ colorScheme });
			window.__telegramEntryProof.host.emit("themeChanged");
		}, scheme);
		await expect(input).toHaveValue(" 02x ");
		await expect(input).toBeFocused();
		expect(
			await input.evaluate((element: HTMLInputElement) => [
				element.selectionStart,
				element.selectionEnd,
				element.selectionDirection,
			]),
		).toEqual([1, 4, "backward"]);
		expect(await semanticRows(page)).toEqual(before);
	}
});

async function readableControls(surface: Locator) {
	const contrasts = await surface.evaluate((element) => {
		const canvas = document.createElement("canvas");
		canvas.width = canvas.height = 1;
		const context = canvas.getContext("2d");
		if (!context) throw new Error("Expected color parser");
		const rgba = (value: string) => {
			context.clearRect(0, 0, 1, 1);
			context.fillStyle = value;
			context.fillRect(0, 0, 1, 1);
			return [...context.getImageData(0, 0, 1, 1).data].map((n, i) =>
				i === 3 ? n / 255 : n,
			);
		};
		const luminance = (rgb: number[]) => {
			const c = rgb.slice(0, 3).map((n) => {
				const x = n / 255;
				return x <= 0.04045 ? x / 12.92 : ((x + 0.055) / 1.055) ** 2.4;
			});
			return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2];
		};
		return [
			...element.querySelectorAll(
				"h1,h2,h3,strong,label,button,input,select,p,span",
			),
		]
			.filter(
				(node) =>
					(node.tagName !== "SPAN" || !!node.textContent?.trim()) &&
					node.getClientRects().length > 0 &&
					!node.hasAttribute("disabled") &&
					getComputedStyle(node).visibility !== "hidden" &&
					getComputedStyle(node).opacity !== "0",
			)
			.map((node) => {
				const foreground = rgba(getComputedStyle(node).color),
					layers: number[][] = [];
				let ancestor: Element | null = node;
				while (ancestor) {
					layers.push(rgba(getComputedStyle(ancestor).backgroundColor));
					ancestor = ancestor.parentElement;
				}
				let background = [255, 255, 255, 1];
				for (const layer of layers.reverse())
					background = layer
						.slice(0, 3)
						.map((n, i) => n * layer[3] + background[i] * (1 - layer[3]))
						.concat(1);
				const a = luminance(foreground),
					b = luminance(background);
				return {
					text: (node.textContent ?? node.getAttribute("aria-label") ?? "")
						.trim()
						.slice(0, 90),
					foreground,
					background,
					ratio: (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05),
				};
			});
	});
	expect(contrasts.length).toBeGreaterThan(0);
	for (const color of contrasts)
		expect(color.ratio, JSON.stringify(color)).toBeGreaterThanOrEqual(4.5);
}
test("TMA-THEME-02: actual dark dimension, rename, leave, catalog and local-file surfaces retain readable controls", async ({
	page,
}, info) => {
	await signed(page);
	await page.goto("/");
	await createRoom(page, "Dark surfaces");
	const before = await semanticRows(page);
	await page.evaluate(() => {
		window.__telegramEntryProof.host.patch({ colorScheme: "dark" });
		window.__telegramEntryProof.host.emit("themeChanged");
	});
	await page
		.getByRole("button", { name: "Настроить размеры", exact: true })
		.click();
	const dimensions = page.getByRole("dialog", { name: "Размеры", exact: true });
	await expect(dimensions).toBeVisible();
	await readableControls(dimensions);
	await page.evaluate(() =>
		window.__telegramEntryProof.host.emit("backButtonClicked"),
	);
	await expect(dimensions).not.toBeVisible();
	await page
		.getByRole("button", {
			name: "Переименовать проект Dark surfaces",
			exact: true,
		})
		.click();
	const rename = page.getByTestId("rename-project-sheet");
	await expect(rename).toBeVisible();
	await readableControls(rename);
	const input = rename.getByRole("textbox", {
		name: "Новое название проекта",
		exact: true,
	});
	await input.fill("  000 Темно  ");
	await page.evaluate(() =>
		window.__telegramEntryProof.host.emit("backButtonClicked"),
	);
	const guard = page.getByRole("alertdialog", {
		name: "Несохранённая правка",
		exact: true,
	});
	await expect(guard).toBeVisible();
	await readableControls(guard);
	await guard.getByRole("button", { name: "Продолжить", exact: true }).click();
	await expect(input).toHaveValue("  000 Темно  ");
	await expect(input).toBeFocused();
	await page.evaluate(() =>
		window.__telegramEntryProof.host.emit("backButtonClicked"),
	);
	await guard
		.getByRole("button", { name: "Отменить правку", exact: true })
		.click();
	await expect(rename).not.toBeVisible();
	await page
		.getByRole("button", { name: "Предметы интерьера", exact: true })
		.click();
	const catalog = page
		.getByTestId("catalog-title")
		.locator("xpath=ancestor::*[@role='dialog'][1]");
	await expect(catalog).toBeVisible();
	await readableControls(catalog);
	await info.attach("dark-catalog-contrast", {
		body: await page.screenshot(),
		contentType: "image/png",
	});
	await page
		.getByRole("button", { name: "Закрыть предметы интерьера", exact: true })
		.click();
	await page
		.getByRole("button", { name: "Открыть остальные действия", exact: true })
		.click();
	await page
		.getByRole("button", { name: "Экспортировать проект", exact: true })
		.click();
	const transfer = page.getByRole("complementary", {
		name: "Передача файла",
		exact: true,
	});
	await expect(
		transfer.getByRole("button", { name: "Передать файл", exact: true }),
	).toBeVisible();
	await readableControls(transfer);
	await transfer.getByRole("button", { name: "Закрыть", exact: true }).click();
	expect(await semanticRows(page)).toEqual(before);
});
test("TMA-THEME-03: actual dark 3D controls preserve a readable surface and the exact durable model", async ({
	page,
}, info) => {
	await signed(page);
	await page.goto("/");
	await createRoom(page, "Dark 3D controls");
	const before = await semanticRows(page);
	await page.evaluate(() => {
		window.__telegramEntryProof.host.patch({ colorScheme: "dark" });
		window.__telegramEntryProof.host.emit("themeChanged");
	});
	await page.getByRole("button", { name: "3D", exact: true }).click();
	await expect(page.getByTestId("three-dimensional-canvas")).toBeVisible();
	await readableControls(page.getByTestId("editor-workspace"));
	await info.attach("dark-3d-controls", {
		body: await page.screenshot(),
		contentType: "image/png",
	});
	expect(await semanticRows(page)).toEqual(before);
});

async function allScopedRecords(page: Page) {
	return page.evaluate(async () => {
		const name = window.__telegramEntryProof.audit.opens.find((value) =>
			value.startsWith("interiors-editor-projects:tma-v1-"),
		);
		if (!name) throw new Error("Expected actual native scope");
		return new Promise<Record<string, unknown[]>>((resolve, reject) => {
			const opening = indexedDB.open(name);
			opening.onerror = () => reject(opening.error);
			opening.onsuccess = () => {
				const db = opening.result,
					names = Array.from(db.objectStoreNames),
					transaction = db.transaction(names, "readonly"),
					records: Record<string, unknown[]> = {};
				for (const store of names) {
					const request = transaction.objectStore(store).getAll();
					request.onsuccess = () => {
						records[store] = request.result;
					};
				}
				transaction.oncomplete = () => {
					db.close();
					resolve(records);
				};
				transaction.onabort = () => {
					db.close();
					reject(transaction.error);
				};
			};
		});
	});
}
test("TMA-ENTRY-12: actual scoped source recovery exports an unverified exact UTF16 record beside a healthy Project", async ({
	page,
}) => {
	await signed(page);
	await page.addInitScript(() => {
		Object.defineProperty(navigator, "canShare", {
			value: () => true,
			configurable: true,
		});
		Object.defineProperty(navigator, "share", {
			value: async (input: { files?: File[] }) => {
				const file = input.files?.[0];
				if (!file) throw new Error("Expected local source File");
				Reflect.set(window, "__sourceFileProof", {
					name: file.name,
					bytes: [...new Uint8Array(await file.arrayBuffer())],
				});
			},
			configurable: true,
		});
	});
	await page.goto("/");
	await createRoom(page, "Healthy source neighbour");
	await page
		.getByRole("button", { name: "Открыть остальные действия", exact: true })
		.click();
	await page.getByRole("button", { name: "Проекты", exact: true }).click();
	await createRoom(page, "Unverified source record");
	const raw = "  \u0000 \ud800 \udfff \ud83d\ude80\n{future data}\t  ";
	await page.evaluate(async (raw) => {
		const name = window.__telegramEntryProof.audit.opens.find((value) =>
			value.startsWith("interiors-editor-projects:tma-v1-"),
		);
		if (!name) throw new Error("Expected actual scoped native store");
		await new Promise<void>((resolve, reject) => {
			const opening = indexedDB.open(name);
			opening.onerror = () => reject(opening.error);
			opening.onsuccess = () => {
				const db = opening.result,
					transaction = db.transaction(["projects", "revisions"], "readwrite"),
					request = transaction.objectStore("projects").getAll();
				request.onsuccess = () => {
					const pointer = request.result.find(
						(row) => row.name === "Unverified source record",
					);
					if (!pointer) throw new Error("Expected actual Project pointer");
					const revision = transaction
						.objectStore("revisions")
						.get(pointer.currentRevisionId);
					revision.onsuccess = () => {
						const row = revision.result;
						row.candidate.project.schemaVersion = 999;
						row.candidate.revision.serializedProject = raw;
						transaction.objectStore("revisions").put(row);
					};
				};
				transaction.oncomplete = () => {
					db.close();
					resolve();
				};
				transaction.onabort = () => {
					db.close();
					reject(transaction.error);
				};
			};
		});
	}, raw);
	const before = await semanticRows(page),
		allBefore = await allScopedRecords(page);
	await page.clock.setFixedTime(new Date(1_733_584_793_000));
	await page.reload();
	await expect(
		page.getByRole("button", {
			name: "Открыть Healthy source neighbour",
			exact: true,
		}),
	).toBeVisible();
	const sources = page.getByRole("complementary", {
		name: "Непроверенные исходники",
		exact: true,
	});
	await expect(sources).toBeVisible();
	await sources
		.getByRole("button", { name: "Показать записи", exact: true })
		.click();
	await sources
		.getByRole("button", { name: "Подготовить исходник записи 1", exact: true })
		.click();
	const file = page.getByRole("complementary", {
		name: "Передача файла",
		exact: true,
	});
	await expect(
		file.getByRole("heading", {
			name: "Непроверенная исходная запись",
			exact: true,
		}),
	).toBeVisible();
	expect(
		await page.evaluate(() => Reflect.get(window, "__sourceFileProof")),
	).toBeUndefined();
	await file
		.getByRole("button", { name: "Передать файл", exact: true })
		.click();
	await expect
		.poll(() =>
			page.evaluate(
				() => Reflect.get(window, "__sourceFileProof") !== undefined,
			),
		)
		.toBe(true);
	const captured = await page.evaluate(
		() =>
			Reflect.get(window, "__sourceFileProof") as {
				name: string;
				bytes: number[];
			},
	);
	expect(captured.name.endsWith(".interiors-source.json")).toBe(true);
	const wrapper = JSON.parse(
		new TextDecoder().decode(Uint8Array.from(captured.bytes)),
	);
	expect(wrapper.purpose).toBe("interiors-editor-unverified-source");
	expect(wrapper.kind).toBe("unverified-source");
	expect(wrapper.serializedProject).toBe(raw);
	expect(await semanticRows(page)).toEqual(before);
	expect(await allScopedRecords(page)).toEqual(allBefore);
	expect((await audit(page)).deletes).toBe(0);
	await expect(file.getByRole("status")).toContainText(
		"не подтверждает его сохранность",
	);
});

async function installReadonlyEntryDelivery(page: Page) {
	await page.addInitScript(() => {
		Object.defineProperty(navigator, "canShare", {
			configurable: true,
			value: () => true,
		});
		Object.defineProperty(navigator, "share", {
			configurable: true,
			value: async (input: { files?: File[] }) => {
				const file = input.files?.[0];
				if (!file) throw new Error("Missing actual local readonly file");
				Reflect.set(window, "__readonlyEntryFile", {
					name: file.name,
					bytes: [...new Uint8Array(await file.arrayBuffer())],
				});
			},
		});
	});
}
async function disableEntryLocksOnNextLoad(page: Page) {
	await page.addInitScript(() => {
		Object.defineProperty(navigator, "locks", {
			configurable: true,
			value: undefined,
		});
		const modes: string[] = [];
		Reflect.set(window, "__readonlyEntryModes", modes);
		const transaction = IDBDatabase.prototype.transaction;
		IDBDatabase.prototype.transaction = function (...args) {
			modes.push(args[1] ?? "readonly");
			return Reflect.apply(transaction, this, args);
		};
	});
}
async function capturedReadonlyEntryFile(page: Page) {
	await expect
		.poll(() =>
			page.evaluate(
				() => Reflect.get(window, "__readonlyEntryFile") !== undefined,
			),
		)
		.toBe(true);
	return page.evaluate(
		() =>
			Reflect.get(window, "__readonlyEntryFile") as {
				name: string;
				bytes: number[];
			},
	);
}
test("TMA-ENTRY-13: actual signed readonly entry exports the existing exact room without Web Locks or any native write", async ({
	page,
}) => {
	await signed(page);
	await installReadonlyEntryDelivery(page);
	await page.goto("/");
	await createRoom(page, "Readonly exact room");
	const before = await allScopedRecords(page);
	const pointer = before.projects[0] as { currentRevisionId: string };
	const revision = before.revisions.find(
		(value) =>
			(value as { revisionId: string }).revisionId ===
			pointer.currentRevisionId,
	) as { candidate: { project: import("../../src/domain/project").Project } };
	await disableEntryLocksOnNextLoad(page);
	await page.clock.setFixedTime(new Date(1_733_584_793_000));
	await page.reload();
	await expect(
		page.getByRole("heading", { name: "Просмотр проектов", exact: true }),
	).toBeVisible();
	const records = page.getByRole("region", {
		name: "Проверенные записи",
		exact: true,
	});
	await expect(records).toContainText("Readonly exact room");
	await expect(
		page.getByRole("button", { name: "Новый проект", exact: true }),
	).toHaveCount(0);
	await expect(
		page.getByRole("button", { name: "Удалить проект", exact: true }),
	).toHaveCount(0);
	await records
		.getByRole("button", { name: "Подготовить файл проекта", exact: true })
		.click();
	const delivery = page.getByRole("complementary", {
		name: "Передача файла",
		exact: true,
	});
	await expect(
		delivery.getByRole("button", { name: "Передать файл", exact: true }),
	).toBeEnabled();
	expect(
		await page.evaluate(() => Reflect.get(window, "__readonlyEntryFile")),
	).toBeUndefined();
	await delivery
		.getByRole("button", { name: "Передать файл", exact: true })
		.click();
	const file = await capturedReadonlyEntryFile(page);
	expect(file.name.endsWith(".interiors")).toBe(true);
	const codec = new RuntimePortableBackupCodec(
		{
			sha256Bytes: async (bytes) =>
				Array.from(
					new Uint8Array(
						await crypto.subtle.digest("SHA-256", new Uint8Array(bytes)),
					),
					(byte) => byte.toString(16).padStart(2, "0"),
				).join(""),
		},
		validateRuntimeV1Project,
	);
	const decoded = await codec.decode(Uint8Array.from(file.bytes));
	expect(decoded.kind).toBe("decoded");
	if (decoded.kind !== "decoded")
		throw new Error(
			"Actual readonly entry did not return a complete verified archive",
		);
	expect(decoded.schema).toBe("runtime-v1-wire");
	expect(decoded.decodedProject).toEqual(revision.candidate.project);
	expect(decoded.resources).toEqual([]);
	expect(await allScopedRecords(page)).toEqual(before);
	const modes = await page.evaluate(
		() => Reflect.get(window, "__readonlyEntryModes") as string[],
	);
	expect(modes.length).toBeGreaterThan(0);
	expect(modes.every((mode) => mode === "readonly")).toBe(true);
	expect((await audit(page)).ready).toBe(1);
	expect(
		(await audit(page)).deletes +
			(await audit(page)).registrations +
			(await audit(page)).unregisters +
			(await audit(page)).cacheDeletes,
	).toBe(0);
	await expect(delivery.getByRole("status")).toContainText(
		"Проверьте файл вне приложения",
	);
});
test("TMA-ENTRY-14: actual readonly entry preserves a corrupt original source and its healthy neighbour without native writes", async ({
	page,
}) => {
	await signed(page);
	await installReadonlyEntryDelivery(page);
	await page.goto("/");
	await createRoom(page, "Readonly healthy neighbour");
	await page
		.getByRole("button", { name: "Открыть остальные действия", exact: true })
		.click();
	await page.getByRole("button", { name: "Проекты", exact: true }).click();
	await createRoom(page, "Readonly corrupt record");
	const raw = "  \u0000 \ud800 \udfff \ud83d\ude80\n{future data}\t  ";
	await page.evaluate(async (raw) => {
		const name = window.__telegramEntryProof.audit.opens.find((value) =>
			value.startsWith("interiors-editor-projects:tma-v1-"),
		);
		if (!name) throw new Error("Missing actual scope");
		await new Promise<void>((resolve, reject) => {
			const opening = indexedDB.open(name);
			opening.onerror = () => reject(opening.error);
			opening.onsuccess = () => {
				const db = opening.result,
					transaction = db.transaction(["projects", "revisions"], "readwrite"),
					request = transaction.objectStore("projects").getAll();
				request.onsuccess = () => {
					const pointer = request.result.find(
						(row) => row.name === "Readonly corrupt record",
					);
					if (!pointer) throw new Error("Missing selected Project");
					const read = transaction
						.objectStore("revisions")
						.get(pointer.currentRevisionId);
					read.onsuccess = () => {
						const row = read.result;
						row.candidate.project.schemaVersion = 999;
						row.candidate.revision.serializedProject = raw;
						transaction.objectStore("revisions").put(row);
					};
				};
				transaction.oncomplete = () => {
					db.close();
					resolve();
				};
				transaction.onabort = () => {
					db.close();
					reject(transaction.error);
				};
			};
		});
	}, raw);
	const before = await allScopedRecords(page);
	const ordinal =
		before.projects.findIndex(
			(value) => (value as { name: string }).name === "Readonly corrupt record",
		) + 1;
	expect(ordinal).toBeGreaterThan(0);
	await disableEntryLocksOnNextLoad(page);
	await page.clock.setFixedTime(new Date(1_733_584_793_000));
	await page.reload();
	await expect(
		page.getByRole("heading", { name: "Просмотр проектов", exact: true }),
	).toBeVisible();
	const healthy = page.getByRole("region", {
		name: "Проверенные записи",
		exact: true,
	});
	await expect(healthy).toContainText("Readonly healthy neighbour");
	await expect(healthy).not.toContainText("Readonly corrupt record");
	const sources = page.getByRole("complementary", {
		name: "Непроверенные исходники",
		exact: true,
	});
	await sources
		.getByRole("button", { name: "Показать записи", exact: true })
		.click();
	await sources
		.getByRole("button", {
			name: `Подготовить исходник записи ${ordinal}`,
			exact: true,
		})
		.click();
	const delivery = page.getByRole("complementary", {
		name: "Передача файла",
		exact: true,
	});
	await expect(
		delivery.getByRole("heading", {
			name: "Непроверенная исходная запись",
			exact: true,
		}),
	).toBeVisible();
	expect(
		await page.evaluate(() => Reflect.get(window, "__readonlyEntryFile")),
	).toBeUndefined();
	await delivery
		.getByRole("button", { name: "Передать файл", exact: true })
		.click();
	const file = await capturedReadonlyEntryFile(page);
	const wrapper = JSON.parse(
		new TextDecoder().decode(Uint8Array.from(file.bytes)),
	);
	expect(file.name.endsWith(".interiors-source.json")).toBe(true);
	expect(wrapper.kind).toBe("unverified-source");
	expect(wrapper.serializedProject).toBe(raw);
	expect(await allScopedRecords(page)).toEqual(before);
	expect(
		(
			await page.evaluate(
				() => Reflect.get(window, "__readonlyEntryModes") as string[],
			)
		).every((mode) => mode === "readonly"),
	).toBe(true);
});
test("TMA-ENTRY-15: readonly signed startup with absent storage never provisions a database or offers writer controls", async ({
	page,
}) => {
	await signed(page);
	await disableEntryLocksOnNextLoad(page);
	await page.goto("/");
	await expect(
		page.getByRole("heading", { name: "Просмотр проектов", exact: true }),
	).toBeVisible();
	await expect(
		page.getByRole("region", { name: "Проверенные записи", exact: true }),
	).toHaveCount(0);
	await expect(
		page
			.getByRole("status")
			.filter({
				hasText: "В этом локальном контексте пока нет проверенных проектов.",
			}),
	).toBeVisible();
	await expect(
		page.getByRole("button", { name: "Подготовить файл проекта", exact: true }),
	).toHaveCount(0);
	await expect(
		page.getByRole("button", { name: "Новый проект", exact: true }),
	).toHaveCount(0);
	expect(
		(await page.evaluate(() => indexedDB.databases())).filter((value) =>
			value.name?.startsWith("interiors-editor-projects:tma-v1-"),
		),
	).toEqual([]);
	expect((await audit(page)).opens).toEqual([]);
	expect((await audit(page)).ready).toBe(1);
	expect((await audit(page)).deletes).toBe(0);
});
