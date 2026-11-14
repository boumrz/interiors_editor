import { expect, test } from "@playwright/test";
import type {} from "./stored-source-recovery-harness";
test.beforeEach(async ({ page }, testInfo) => {
	await page.goto("/");
	expect(
		await page.evaluate(
			() => Reflect.get(globalThis, "__stryker__")?.activeMutant,
		),
	).toBe(testInfo.project.metadata.activeMutant);
	await page.evaluate(() => window.__storedSourceFixture.mount());
});
test("SOURCE01 listing and reading require separate explicit actions and export preserves the exact raw string", async ({
	page,
}) => {
	expect(
		(await page.evaluate(() => window.__storedSourceFixture.inspect())).calls,
	).toEqual([]);
	await page
		.getByRole("button", { name: "Показать записи", exact: true })
		.click();
	await expect(
		page.getByRole("button", {
			name: "Подготовить исходник записи 1",
			exact: true,
		}),
	).toBeVisible();
	expect(
		(await page.evaluate(() => window.__storedSourceFixture.inspect())).calls,
	).toEqual([{ phase: "list", owner: "a" }]);
	await page
		.getByRole("button", { name: "Подготовить исходник записи 1", exact: true })
		.click();
	await expect(page.getByRole("status")).toContainText(
		"Исходник подготовлен к передаче",
	);
	const state = await page.evaluate(() =>
		window.__storedSourceFixture.inspect(),
	);
	expect(state.calls).toEqual([
		{ phase: "list", owner: "a" },
		{
			phase: "read",
			owner: "a",
			projectId: "a-project",
			revisionId: "a-revision",
		},
		{ phase: "export", owner: "a" },
	]);
	expect(state.exported).toEqual([
		{
			kind: "unverified-source",
			projectId: "a-project",
			revisionId: "a-revision",
			serializedProject: state.raw,
		},
	]);
	await expect(page.getByText("Файл сохранён", { exact: true })).toHaveCount(0);
});
for (const mode of ["empty", "list-error"] as const)
	test(`SOURCE02 ${mode} is an honest list outcome with an available retry`, async ({
		page,
	}) => {
		await page.evaluate(
			(value) => window.__storedSourceFixture.mode(value),
			mode,
		);
		await page
			.getByRole("button", { name: "Показать записи", exact: true })
			.click();
		await expect(page.getByRole("status")).toContainText(
			mode === "empty"
				? "Доступных исходников нет"
				: "Не удалось получить список",
		);
		await expect(
			page.getByRole("button", { name: "Обновить список", exact: true }),
		).toBeEnabled();
		expect(
			(await page.evaluate(() => window.__storedSourceFixture.inspect())).calls,
		).toHaveLength(1);
	});
for (const mode of [
	"stale",
	"wrong-project",
	"wrong-revision",
	"read-error",
	"export-error",
] as const)
	test(`SOURCE03 ${mode} does not claim recovery or prepare a mismatched source`, async ({
		page,
	}) => {
		await page
			.getByRole("button", { name: "Показать записи", exact: true })
			.click();
		await page.evaluate(
			(value) => window.__storedSourceFixture.mode(value),
			mode,
		);
		await page
			.getByRole("button", {
				name: "Подготовить исходник записи 1",
				exact: true,
			})
			.click();
		await expect(page.getByRole("status")).toContainText(
			mode === "read-error"
				? "Не удалось прочитать"
				: mode === "export-error"
					? "Не удалось подготовить"
					: "Запись изменилась",
		);
		expect(
			(await page.evaluate(() => window.__storedSourceFixture.inspect()))
				.exported,
		).toHaveLength(mode === "export-error" ? 1 : 0);
		await expect(
			page.getByRole("button", { name: "Обновить список", exact: true }),
		).toBeEnabled();
	});
for (const phase of ["list", "read", "export"] as const)
	test(`SOURCE04 a pending ${phase} cannot leak an old A result after A→B→A`, async ({
		page,
	}) => {
		if (phase !== "list")
			await page
				.getByRole("button", { name: "Показать записи", exact: true })
				.click();
		await page.evaluate(
			(value) => window.__storedSourceFixture.hold(value),
			phase,
		);
		await page
			.getByRole("button", {
				name:
					phase === "list"
						? "Показать записи"
						: "Подготовить исходник записи 1",
				exact: true,
			})
			.click();
		await expect(
			page.getByRole("button", { name: "Обновить список", exact: true }),
		).toBeDisabled();
		await page.evaluate(() => window.__storedSourceFixture.switch("b"));
		await expect(
			page.getByRole("button", { name: "Показать записи", exact: true }),
		).toBeEnabled();
		await page.evaluate(() => window.__storedSourceFixture.switch("a"));
		await expect(
			page.getByRole("button", { name: "Показать записи", exact: true }),
		).toBeEnabled();
		await page.evaluate(() => window.__storedSourceFixture.release());
 await page.evaluate(()=>window.__storedSourceFixture.flush());
		await expect(page.getByRole("status")).toContainText("Покажите записи");
		await expect(
			page.getByRole("button", {
				name: "Подготовить исходник записи 1",
				exact: true,
			}),
		).toHaveCount(0);
		expect(
			(await page.evaluate(() => window.__storedSourceFixture.inspect()))
				.exported,
		).toHaveLength(phase === "export" ? 1 : 0);
	});
test("SOURCE05 unmount ignores a held read and never calls its exporter", async ({
	page,
}) => {
	const errors: string[] = [];
	page.on("pageerror", (error) => errors.push(error.message));
	await page
		.getByRole("button", { name: "Показать записи", exact: true })
		.click();
	await page.evaluate(() => window.__storedSourceFixture.hold("read"));
	await page
		.getByRole("button", { name: "Подготовить исходник записи 1", exact: true })
		.click();
	await page.evaluate(() => {
		window.__storedSourceFixture.unmount();
		window.__storedSourceFixture.release();
	});
	expect(
		(await page.evaluate(() => window.__storedSourceFixture.inspect()))
			.exported,
	).toEqual([]);
	expect(errors).toEqual([]);
	await expect(page.getByRole("complementary")).toHaveCount(0);
});
test("SOURCE06 the panel uses the shared palette and wraps at phone width", async ({
	page,
}) => {
	await page.evaluate(() => {
		document.documentElement.style.setProperty("--surface", "rgb(24, 29, 37)");
		document.documentElement.style.setProperty("--ink", "rgb(238, 242, 248)");
	});
	const panel = page.getByRole("complementary", {
		name: "Непроверенные исходники",
		exact: true,
	});
	expect(
		await panel.evaluate((element) => ({
			background: getComputedStyle(element).backgroundColor,
			color: getComputedStyle(element).color,
			overflow: document.documentElement.scrollWidth > innerWidth,
		})),
	).toEqual({
		background: "rgb(24, 29, 37)",
		color: "rgb(238, 242, 248)",
		overflow: false,
	});
});
for (const phase of ["list", "read", "export"] as const)
	test(`SOURCE07 an old ${phase} completion cannot unlock or replace a new owner's pending list`, async ({
		page,
	}) => {
		if (phase !== "list")
			await page
				.getByRole("button", { name: "Показать записи", exact: true })
				.click();
		await page.evaluate(
			(value) => window.__storedSourceFixture.hold(value),
			phase,
		);
		await page
			.getByRole("button", {
				name:
					phase === "list"
						? "Показать записи"
						: "Подготовить исходник записи 1",
				exact: true,
			})
			.click();
		await page.evaluate(() => window.__storedSourceFixture.switch("b"));
		await page.evaluate(() => window.__storedSourceFixture.hold("list"));
		await page
			.getByRole("button", { name: "Показать записи", exact: true })
			.click();
		await page.evaluate(() => window.__storedSourceFixture.release(0));
 await page.evaluate(()=>window.__storedSourceFixture.flush());
		await expect(page.getByRole("status")).toContainText("Поиск исходников");
		await expect(
			page.getByRole("button", { name: "Обновить список", exact: true }),
		).toBeDisabled();
		await page.evaluate(() => window.__storedSourceFixture.release(1));
		await expect(
			page.getByRole("button", {
				name: "Подготовить исходник записи 1",
				exact: true,
			}),
		).toBeEnabled();
		await page
			.getByRole("button", {
				name: "Подготовить исходник записи 1",
				exact: true,
			})
			.click();
		await expect(page.getByRole("status")).toContainText(
			"Исходник подготовлен",
		);
		const state = await page.evaluate(() =>
			window.__storedSourceFixture.inspect(),
		);
		expect(state.exported.at(-1)?.projectId).toBe("b-project");
		expect(state.exported).toHaveLength(phase === "export" ? 2 : 1);
	});
test("SOURCE08 repeated same-turn native button events after changing the port admit only one list", async ({
	page,
}) => {
	await page
		.getByRole("button", { name: "Показать записи", exact: true })
		.click();
	await page.evaluate(() => window.__storedSourceFixture.switch("b"));
	await expect(
		page.getByRole("button", { name: "Показать записи", exact: true }),
	).toBeEnabled();
	await page.evaluate(() => {
		window.__storedSourceFixture.hold("list");
		const button = document.querySelector<HTMLButtonElement>("aside button");
		if (!button) throw new Error("Missing list button");
		button.click();
		button.click();
	});
	const state = await page.evaluate(() =>
		window.__storedSourceFixture.inspect(),
	);
	expect(
		state.calls.filter((call) => call.phase === "list" && call.owner === "b"),
	).toHaveLength(1);
	await page.evaluate(() => window.__storedSourceFixture.release());
 await page.evaluate(()=>window.__storedSourceFixture.flush());
});
for (const phase of ["list", "read", "export"] as const) test(`SOURCE09 an old ${phase} rejection cannot replace or unlock the new owner's pending list`, async ({page}) => {
 if (phase !== "list") await page.getByRole("button", {name:"Показать записи", exact:true}).click();
 await page.evaluate(value => { window.__storedSourceFixture.mode(value === "list" ? "list-error" : value === "read" ? "read-error" : "export-error"); window.__storedSourceFixture.hold(value); }, phase);
 await page.getByRole("button", {name:phase === "list" ? "Показать записи" : "Подготовить исходник записи 1", exact:true}).click();
 await page.evaluate(() => { window.__storedSourceFixture.switch("b"); window.__storedSourceFixture.mode("normal"); });
 await expect(page.getByRole("button", {name:"Показать записи", exact:true})).toBeEnabled();
 await page.evaluate(() => window.__storedSourceFixture.hold("list")); await page.getByRole("button", {name:"Показать записи", exact:true}).click();
 await page.evaluate(() => window.__storedSourceFixture.release(0));
 await page.evaluate(()=>window.__storedSourceFixture.flush()); await expect(page.getByRole("status")).toContainText("Поиск исходников"); await expect(page.getByRole("button", {name:"Обновить список", exact:true})).toBeDisabled();
 await page.evaluate(() => window.__storedSourceFixture.release(1)); await expect(page.getByRole("button", {name:"Подготовить исходник записи 1", exact:true})).toBeEnabled();
 expect((await page.evaluate(() => window.__storedSourceFixture.inspect())).exported).toHaveLength(phase === "export" ? 1 : 0);
});
test("SOURCE10 repeated same-turn prepare events read and export the selected source once",async({page})=>{
 await expect(page.getByRole("button",{name:"Подготовить исходник записи 1",exact:true})).toHaveCount(0);await page.getByRole("button",{name:"Показать записи",exact:true}).click();await expect(page.getByRole("button",{name:"Подготовить исходник записи 1",exact:true})).toBeEnabled();await page.evaluate(()=>{window.__storedSourceFixture.hold("read");const button=document.querySelector<HTMLButtonElement>('li button');if(!button)throw new Error("Missing actual source action");button.click();button.click();});expect((await page.evaluate(()=>window.__storedSourceFixture.inspect())).calls.filter(call=>call.phase==="read")).toHaveLength(1);await page.evaluate(()=>window.__storedSourceFixture.release());await page.evaluate(()=>window.__storedSourceFixture.flush());await expect(page.getByRole("status")).toContainText("Исходник подготовлен");expect((await page.evaluate(()=>window.__storedSourceFixture.inspect())).exported).toHaveLength(1);
});
test("SOURCE11 completed preparation releases its operation so an explicit retry reads the source again",async({page})=>{
 await page.getByRole("button",{name:"Показать записи",exact:true}).click();const button=page.getByRole("button",{name:"Подготовить исходник записи 1",exact:true});await button.click();await expect(page.getByRole("status")).toContainText("Исходник подготовлен");await page.evaluate(()=>window.__storedSourceFixture.flush());await button.click();await page.evaluate(()=>window.__storedSourceFixture.flush());const state=await page.evaluate(()=>window.__storedSourceFixture.inspect());expect(state.calls.filter(call=>call.phase==="read")).toHaveLength(2);expect(state.exported).toHaveLength(2);
});
test("SOURCE12 pending or failed listing never displays a phantom source action",async({page})=>{
 await page.evaluate(()=>window.__storedSourceFixture.hold("list"));await page.getByRole("button",{name:"Показать записи",exact:true}).click();await expect(page.getByRole("status")).toContainText("Поиск исходников");await expect(page.getByRole("button",{name:"Подготовить исходник записи 1",exact:true})).toHaveCount(0);await page.evaluate(()=>window.__storedSourceFixture.release());await page.evaluate(()=>window.__storedSourceFixture.flush());await expect(page.getByRole("button",{name:"Подготовить исходник записи 1",exact:true})).toBeEnabled();await page.evaluate(()=>window.__storedSourceFixture.mode("list-error"));await page.getByRole("button",{name:"Обновить список",exact:true}).click();await expect(page.getByRole("status")).toContainText("Не удалось получить список");await expect(page.getByRole("button",{name:"Подготовить исходник записи 1",exact:true})).toHaveCount(0);
});
