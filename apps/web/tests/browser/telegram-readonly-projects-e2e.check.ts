import { expect, type Locator, type Page, test } from "@playwright/test";
import type {} from "./telegram-readonly-projects-harness";

// Actual mounted leaf + real local File bridge; runtime/source payloads are explicit UI port doubles.
test.beforeEach(async ({ page }) => {
	await page.goto("/");
	await page.waitForFunction(() => !!window.readonlyLeafUi);
	const proof = await page.evaluate(() => ({
		sha: window.__READONLY_LEAF_SUBJECT__.sha,
		active: window.__READONLY_LEAF_SUBJECT__.readActive(),
		instrumented: window.__READONLY_LEAF_SUBJECT__.instrumented,
		html: window.__stryker__.activeMutant,
	}));
	await test.info().attach("actual-readonly-leaf-module", {
		body: JSON.stringify({ ...proof, testTitle: test.info().titlePath }),
		contentType: "application/json",
	});
	expect(proof.sha).toBe(test.info().config.metadata.sourceSHA);
	expect(proof.active).toBe(test.info().config.metadata.activeMutant);
	expect(proof.html).toBe(test.info().config.metadata.activeMutant);
	if (test.info().config.metadata.activeMutant !== null)
		expect(proof.instrumented).toBe(true);
});
async function clickEnabled(target: Locator) {
	await expect(target).toBeVisible({ timeout: 5000 });
	await expect(target).toBeEnabled({ timeout: 5000 });
	await target.click({ timeout: 5000 });
}
const snap = (page: Page) =>
	page.evaluate(() => window.readonlyLeafUi.snapshot());
const prepare = (page: Page) =>
	page.getByRole("button", { name: "Подготовить файл проекта", exact: true });
const handoff = (page: Page) =>
	page.getByRole("button", { name: "Передать файл", exact: true });

test("RO-LEAF-01 StrictMode lists once, binds exact Revision and hands off only on the fresh second gesture", async ({
	page,
}) => {
	await page.evaluate(() => window.readonlyLeafUi.reset({ holdHandoff: true }));
	await expect(
		page.getByRole("heading", { name: "Комната A 😀" }),
	).toBeVisible();
	expect((await snap(page)).calls).toEqual(["list:A"]);
	expect((await snap(page)).listeners).toBe(1);
	await clickEnabled(prepare(page));
	await expect(handoff(page)).toBeVisible();
	expect((await snap(page)).calls).toEqual([
		"list:A",
		"export:private-A:revision-A:false",
	]);
	expect((await snap(page)).shares).toBe(0);
	await clickEnabled(handoff(page));
	await expect(prepare(page)).toBeDisabled();
	await expect(
		page.getByRole("button", { name: "Показать записи", exact: true }),
	).toBeDisabled();
	await page.evaluate(() => window.readonlyLeafUi.resolveHandoff());
	await expect(
		page
			.getByRole("status")
			.filter({ hasText: /^Проверьте файл вне приложения\./ }),
	).toBeVisible();
	expect(await page.evaluate(() => window.readonlyLeafUi.shared())).toEqual([
		{ name: "fixture.interiors", type: "application/zip", bytes: [80, 75, 7] },
	]);
	await clickEnabled(
		page.getByRole("button", { name: "Закрыть", exact: true }),
	);
	await expect(handoff(page)).toHaveCount(0);
	await clickEnabled(
		page.getByRole("button", { name: "Повторить запуск", exact: true }),
	);
	await clickEnabled(page.getByRole("button", { name: "Выйти", exact: true }));
	const state = await snap(page);
	expect(state.retries).toBe(1);
	expect(state.exits).toBe(1);
	expect(state.warnings.every((v) => v === false)).toBe(true);
	for (const label of [
		"Создать проект",
		"Импортировать",
		"Удалить",
		"Перехватить",
		"Исправить",
	]) {
		await expect(
			page.getByRole("button", { name: label, exact: true }),
		).toHaveCount(0);
	}
	expect(await page.locator("main").innerText()).not.toContain("private-A");
});

test("RO-LEAF-02 empty, unavailable and recovery-needed remain distinct with private error text hidden", async ({
	page,
}) => {
	await page.evaluate(() => window.readonlyLeafUi.reset({ mode: "empty" }));
	await expect(
		page.getByText(
			"В этом локальном контексте пока нет проверенных проектов.",
			{ exact: true },
		),
	).toBeVisible();
	await expect(
		page.getByRole("region", { name: "Проверенные записи" }),
	).toHaveCount(0);
	await page.evaluate(() => window.readonlyLeafUi.reset({ mode: "reject" }));
	await expect(
		page.getByText(/Не удалось получить список проектов/),
	).toBeVisible();
	expect(await page.locator("main").innerText()).not.toContain(
		"нет проверенных проектов",
	);
	expect(await page.locator("body").innerText()).not.toContain(
		"private-launch-value",
	);
	expect((await snap(page)).problems).toEqual(["source-unavailable"]);
	await page.evaluate(() => window.readonlyLeafUi.reset({ mode: "recovery" }));
	await expect(
		page.getByText(/Часть локальных данных не удалось проверить/),
	).toBeVisible();
	await expect(
		page.getByRole("complementary", { name: "Непроверенные исходники" }),
	).toBeVisible();
});

test("RO-LEAF-03 abort synchronously revokes a pending export, closes delivery and drops the late result", async ({
	page,
}) => {
	await page.evaluate(() => window.readonlyLeafUi.reset({ holdExport: true }));
	await expect(prepare(page)).toBeEnabled();
	await clickEnabled(prepare(page));
	await expect
		.poll(async () =>
			(await snap(page)).calls.some((v) => v.startsWith("export:")),
		)
		.toBe(true);
	await expect(prepare(page)).toBeDisabled();
	await page.evaluate(() => {
		window.readonlyLeafUi.abort("A");
		window.readonlyLeafUi.resolveExport("A");
	});
	await expect(page.getByText(/Просмотр данных завершён/)).toBeVisible();
	await expect(handoff(page)).toHaveCount(0);
	expect((await snap(page)).shares).toBe(0);
	await clickEnabled(
		page.getByRole("button", { name: "Повторить запуск", exact: true }),
	);
	await clickEnabled(page.getByRole("button", { name: "Выйти", exact: true }));
	expect((await snap(page)).retries).toBe(1);
	expect((await snap(page)).exits).toBe(1);
});

test("RO-LEAF-04 A→B→A full effects retire the old query and Back subscriber without reviving it", async ({
	page,
}) => {
	await page.evaluate(() => window.readonlyLeafUi.reset({ mode: "deferred" }));
	await expect
		.poll(
			async () => (await snap(page)).calls.filter((v) => v === "list:A").length,
		)
		.toBe(1);
	await page.evaluate(() => {
		window.readonlyLeafUi.add("B");
		window.readonlyLeafUi.show("B");
	});
	await expect(
		page.getByRole("heading", { name: "Комната B 😀" }),
	).toBeVisible();
	await page.evaluate(() => window.readonlyLeafUi.resolveList("A"));
	await expect(
		page.getByRole("heading", { name: "Комната B 😀" }),
	).toBeVisible();
	await expect(page.getByRole("heading", { name: "Комната A 😀" })).toHaveCount(
		0,
	);
	await page.evaluate(() => window.readonlyLeafUi.show("A"));
	await expect(
		page.getByRole("heading", { name: "Комната A 😀" }),
	).toBeVisible();
	expect((await snap(page)).listeners).toBe(1);
	expect((await snap(page)).calls.filter((v) => v === "list:A")).toHaveLength(
		2,
	);
	await page.evaluate(() => window.readonlyLeafUi.back());
	expect((await snap(page)).exits).toBe(1);
	await page.evaluate(() => {
		window.readonlyLeafUi.unmount();
		window.readonlyLeafUi.back(true);
	});
	const state = await snap(page);
	expect(state.listeners).toBe(0);
	expect(state.exits).toBe(1);
	expect(state.showBack.at(-1)).toBe(false);
});

test("RO-LEAF-05 an old raw read cannot replace a newer prepared Project file", async ({
	page,
}) => {
	await page.evaluate(() => window.readonlyLeafUi.reset({ holdSource: true }));
	await expect(prepare(page)).toBeEnabled();
	await clickEnabled(
		page.getByRole("button", { name: "Показать записи", exact: true }),
	);
	await clickEnabled(
		page.getByRole("button", {
			name: "Подготовить исходник записи 1",
			exact: true,
		}),
	);
	await expect
		.poll(async () =>
			(await snap(page)).calls.includes("source:raw-A:raw-revision-A"),
		)
		.toBe(true);
	await clickEnabled(prepare(page));
	await expect(handoff(page)).toBeVisible();
	await page.evaluate(() => window.readonlyLeafUi.resolveSource("A"));
	await clickEnabled(handoff(page));
	const files = await page.evaluate(() => window.readonlyLeafUi.shared());
	expect(files).toEqual([
		{ name: "fixture.interiors", type: "application/zip", bytes: [80, 75, 7] },
	]);
});

test("RO-LEAF-06 explicit raw list/select prepares a separate lossless unverified-source File", async ({
	page,
}) => {
	expect((await snap(page)).calls).not.toContain("sources:A");
	await clickEnabled(
		page.getByRole("button", { name: "Показать записи", exact: true }),
	);
	await clickEnabled(
		page.getByRole("button", {
			name: "Подготовить исходник записи 1",
			exact: true,
		}),
	);
	await expect(handoff(page)).toBeVisible();
	expect((await snap(page)).shares).toBe(0);
	await clickEnabled(handoff(page));
	const [file] = await page.evaluate(() => window.readonlyLeafUi.shared());
	expect(file?.name).toBe("project.interiors-source.json");
	expect(file?.type).toBe("application/json");
	if (!file) throw new Error("Missing actual local File");
	const wrapper = JSON.parse(
		new TextDecoder().decode(new Uint8Array(file.bytes)),
	);
	expect(wrapper.purpose).toBe("interiors-editor-unverified-source");
	expect(wrapper.kind).toBe("unverified-source");
	expect(wrapper.serializedProject).toBe(
		await page.evaluate(() => window.readonlyLeafUi.raw()),
	);
	expect(wrapper.projectId).toBe("raw-A");
	expect(wrapper.revisionId).toBe("raw-revision-A");
});

test("RO-LEAF-07 unavailable File delivery disables Project and raw controls while Retry/Exit remain usable", async ({
	page,
}) => {
	await page.evaluate(() =>
		window.readonlyLeafUi.reset({ fileAvailable: false }),
	);
	await expect(prepare(page)).toBeDisabled();
	await expect(
		page.getByRole("button", { name: "Показать записи", exact: true }),
	).toBeDisabled();
	await expect(
		page.getByText("Передача файлов недоступна в этом клиенте.", {
			exact: true,
		}),
	).toBeVisible();
	await clickEnabled(
		page.getByRole("button", { name: "Повторить запуск", exact: true }),
	);
	await clickEnabled(page.getByRole("button", { name: "Выйти", exact: true }));
	const state = await snap(page);
	expect(state.calls).toEqual(["list:A"]);
	expect(state.retries).toBe(1);
	expect(state.exits).toBe(1);
});

function luminance(rgb: number[]) {
	const [r, g, b] = rgb
		.slice(0, 3)
		.map((v) => v / 255)
		.map((v) => (v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4));
	if (r === undefined || g === undefined || b === undefined)
		throw new Error("Missing computed opaque color");
	return r * 0.2126 + g * 0.7152 + b * 0.0722;
}
function ratio(a: string, b: string) {
	const parse = (s: string) => (s.match(/[\d.]+/g) ?? []).map(Number),
		x = luminance(parse(a)),
		y = luminance(parse(b));
	return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05);
}
test("RO-LEAF-08 360px, 200% text and dark theme preserve visible controls, viewport and computed contrast", async ({
	page,
}) => {
	await page.setViewportSize({ width: 360, height: 780 });
	await page.evaluate(() => {
		window.readonlyLeafUi.theme(true);
		document.documentElement.style.fontSize = "32px";
		document.documentElement.style.setProperty(
			"--editor-viewport-height",
			"520px",
		);
		document.documentElement.style.setProperty(
			"--editor-safe-area-top",
			"20px",
		);
		document.documentElement.style.setProperty(
			"--editor-safe-area-bottom",
			"24px",
		);
	});
	await expect(prepare(page)).toBeVisible();
	const layout = await page.evaluate(() => {
		const main = document.querySelector("main"),
			button = [...document.querySelectorAll("button")].find(
				(b) => b.textContent?.trim() === "Подготовить файл проекта",
			),
			h1 = document.querySelector("h1"),
			caption = button?.closest("section")?.querySelector("p");
		if (!main || !button || !h1 || !caption)
			throw new Error("Missing mounted critical surfaces");
		return {
			width: document.documentElement.clientWidth,
			scroll: main.scrollWidth,
			mainWidth: main.clientWidth,
			height: main.getBoundingClientRect().height,
			buttonHeight: button.getBoundingClientRect().height,
			fg: getComputedStyle(button).color,
			bg: getComputedStyle(button).backgroundColor,
			heading: getComputedStyle(h1).color,
			canvas: getComputedStyle(main).backgroundColor,
			caption: getComputedStyle(caption).color,
		};
	});
	expect(layout.width).toBe(360);
	expect(layout.scroll).toBeLessThanOrEqual(layout.mainWidth + 1);
	expect(layout.height).toBe(520);
	expect(layout.buttonHeight).toBeGreaterThanOrEqual(44);
	expect(ratio(layout.fg, layout.bg)).toBeGreaterThanOrEqual(4.5);
	expect(ratio(layout.heading, layout.canvas)).toBeGreaterThanOrEqual(4.5);
	expect(ratio(layout.caption, layout.canvas)).toBeGreaterThanOrEqual(4.5);
	const retry = page.getByRole("button", {
		name: "Повторить запуск",
		exact: true,
	});
	await retry.focus();
	await page.evaluate(() => window.readonlyLeafUi.theme(false));
	await expect(retry).toBeFocused();
	await prepare(page).scrollIntoViewIfNeeded();
	await expect(prepare(page)).toBeInViewport();
	await page.screenshot({
		path: test.info().outputPath("readonly-leaf-360-200.png"),
		fullPage: true,
	});
});
