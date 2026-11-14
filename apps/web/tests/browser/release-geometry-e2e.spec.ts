import { expect, test } from "@playwright/test";
import { installCatalogGatewayFake } from "./catalog-gateway-fake";

test("RELEASE-GEO-01: physical wall bodies, shared corner outline and visible zoom controls fit a phone", async ({
	page,
}, testInfo) => {
	await installCatalogGatewayFake(page);
	await page.goto("/");
	await page.getByRole("button", { name: "Новый проект", exact: true }).click();
	await page
		.getByRole("textbox", { name: "Название проекта" })
		.fill("Чертёж стен");
	await page
		.getByRole("button", { name: "Создать проект", exact: true })
		.click();
	await page
		.getByRole("button", { name: "Создать контур", exact: true })
		.click();
	await expect(page.getByTestId("wall-body")).toHaveCount(4);
	await expect(page.getByRole("img", { name: "План помещения", exact: true }).locator("title")).toHaveCount(0);
	await expect(page.getByTestId("wall-body").first()).toHaveAttribute(
		"fill",
		/wall-hatch/,
	);
	const zoomIn = page.getByRole("button", { name: "Приблизить", exact: true });
	const zoomOut = page.getByRole("button", { name: "Отдалить", exact: true });
	await expect(zoomIn).toBeVisible();
	await expect(zoomOut).toBeVisible();
	const bounds = await zoomIn.boundingBox();
	expect(bounds?.width).toBeGreaterThanOrEqual(44);
	expect(bounds?.height).toBeGreaterThanOrEqual(44);
	const plan = page.getByTestId("plan-content");
	const before = await plan.getAttribute("transform");
	await zoomIn.click();
	await expect(plan).not.toHaveAttribute("transform", before ?? "");
	await zoomOut.click();
	await page.screenshot({
		path: testInfo.outputPath("physical-walls-phone.png"),
	});
	expect(
		await page.evaluate(
			() => document.documentElement.scrollWidth <= innerWidth,
		),
	).toBe(true);
	await page.getByRole("button", { name: "3D", exact: true }).click();
	await expect(page.getByTestId("three-dimensional-canvas")).toBeVisible();
	await page.getByRole("button", { name: "Показать все стены", exact: true }).click();
	await page.screenshot({
		path: testInfo.outputPath("physical-walls-3d-phone.png"),
	});
});

test("RELEASE-GEO-02: a wall gesture crossing a room closes at the first host and waits for confirmation", async ({
	page,
}) => {
	await installCatalogGatewayFake(page);
	await page.goto("/");
	await page.getByRole("button", { name: "Новый проект", exact: true }).click();
	await page
		.getByRole("textbox", { name: "Название проекта" })
		.fill("Замыкание");
	await page
		.getByRole("button", { name: "Создать проект", exact: true })
		.click();
	await page
		.getByRole("button", { name: "Создать контур", exact: true })
		.click();
	await page.getByRole("button", { name: "Стена", exact: true }).click();
	const lines = await page.getByTestId("wall-line").evaluateAll((elements) =>
		elements.map((element) => {
			const line = element as SVGLineElement;
			const matrix = line.getScreenCTM();
			if (!matrix) throw new Error("projection absent");
			const start = new DOMPoint(
				line.x1.baseVal.value,
				line.y1.baseVal.value,
			).matrixTransform(matrix);
			const end = new DOMPoint(
				line.x2.baseVal.value,
				line.y2.baseVal.value,
			).matrixTransform(matrix);
			return { x1: start.x, y1: start.y, x2: end.x, y2: end.y };
		}),
	);
	const top = lines.find(
		(line) =>
			Math.abs(line.y1 - line.y2) < 1 &&
			line.y1 === Math.min(...lines.map((l) => Math.min(l.y1, l.y2))),
	);
	const bottom = lines.find(
		(line) =>
			Math.abs(line.y1 - line.y2) < 1 &&
			line.y1 === Math.max(...lines.map((l) => Math.max(l.y1, l.y2))),
	);
	if (!top || !bottom) throw new Error("rectangle walls absent");
	const x = (top.x1 + top.x2) / 2;
	const client = await page.context().newCDPSession(page);
	await client.send("Input.dispatchTouchEvent", {
		type: "touchStart",
		touchPoints: [{ id: 71, x, y: top.y1 }],
	});
	await client.send("Input.dispatchTouchEvent", {
		type: "touchMove",
		touchPoints: [{ id: 71, x, y: bottom.y1 + 28 }],
	});
	await client.send("Input.dispatchTouchEvent", {
		type: "touchEnd",
		touchPoints: [],
	});
	await expect(
		page.getByRole("button", { name: "Подтвердить стену", exact: true }),
	).toBeVisible();
	await expect(page.getByTestId("wall-body")).toHaveCount(4);
	await page
		.getByRole("button", { name: "Подтвердить стену", exact: true })
		.click();
	await expect(page.getByTestId("wall-body")).toHaveCount(7);
	await expect(page.getByTestId("wall-draft-actions")).not.toBeVisible();
});
