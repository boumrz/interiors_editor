import { expect, type Page, test } from "@playwright/test";
import { installCatalogGatewayFake } from "./catalog-gateway-fake";

async function beginPlacement(page: Page) {
	await installCatalogGatewayFake(page);
	await page.goto("/");
	await page.getByRole("button", { name: "Новый проект", exact: true }).click();
	await page
		.getByLabel("Название проекта", { exact: true })
		.fill("Контакты поворота");
	await page
		.getByRole("button", { name: "Создать проект", exact: true })
		.click();
	await page
		.getByRole("button", { name: "Создать контур", exact: true })
		.click();
	await expect(
		page.getByTestId("editor-top-bar").getByRole("status"),
	).toHaveText("Сохранено");
	await page
		.getByRole("button", { name: "Предметы интерьера", exact: true })
		.click();
	const catalog = page.getByRole("dialog", {
		name: "Предметы интерьера",
		exact: true,
	});
	await catalog
		.getByTestId("catalog-authoring")
		.getByText("Импорт модели", { exact: true })
		.click();
	await catalog
		.getByRole("button", { name: "Создать макетный предмет", exact: true })
		.click();
	const composer = catalog.getByRole("form", {
		name: "Создать макетный предмет",
		exact: true,
	});
	await composer.getByLabel("Название макетного предмета").fill("Два пальца");
	await composer.getByLabel("Ширина макетного предмета, мм").fill("800");
	await composer.getByLabel("Глубина макетного предмета, мм").fill("400");
	await composer
		.getByRole("button", { name: "Начать размещение", exact: true })
		.click();
	const face = await page.getByTestId("room-face").boundingBox();
	if (!face) throw new Error("Expected actual room geometry");
	await page.mouse.click(face.x + face.width / 2, face.y + face.height / 2);
	await expect(page.getByTestId("item-placement-preview")).toHaveAttribute(
		"data-placement-valid",
		"true",
	);
	return face;
}

async function durableSnapshot(page: Page) {
	return page.evaluate(async () => {
		const db = await new Promise<IDBDatabase>((resolve, reject) => {
			const request = indexedDB.open("interiors-editor-projects");
			request.onsuccess = () => resolve(request.result);
			request.onerror = () => reject(request.error);
		});
		try {
			const read = (store: string) =>
				new Promise<unknown[]>((resolve, reject) => {
					const request = db
						.transaction(store, "readonly")
						.objectStore(store)
						.getAll();
					request.onsuccess = () => resolve(request.result);
					request.onerror = () => reject(request.error);
				});
			return {
				projects: await read("projects"),
				revisions: await read("revisions"),
			};
		} finally {
			db.close();
		}
	});
}

async function previewCentre(page: Page) {
	return page
		.getByTestId("item-placement-preview")
		.locator("polygon")
		.first()
		.evaluate((element) => {
			if (!(element instanceof SVGPolygonElement))
				throw new Error("Expected projected footprint");
			const matrix = element.getScreenCTM();
			if (!matrix) throw new Error("Expected actual SVG transform");
			const points = Array.from(
				{ length: element.points.numberOfItems },
				(_, index) => {
					const point = element.points.getItem(index);
					return new DOMPoint(point.x, point.y).matrixTransform(matrix);
				},
			);
			return {
				x: points.reduce((sum, point) => sum + point.x, 0) / points.length,
				y: points.reduce((sum, point) => sum + point.y, 0) / points.length,
			};
		});
}

async function rotationRing(page: Page) {
	return page
		.getByTestId("item-placement-rotation-handle")
		.evaluate((element) => {
			if (!(element instanceof SVGCircleElement))
				throw new Error("Expected rotation ring");
			const matrix = element.getScreenCTM();
			if (!matrix) throw new Error("Expected actual SVG transform");
			const centre = new DOMPoint(
				element.cx.baseVal.value,
				element.cy.baseVal.value,
			).matrixTransform(matrix);
			const edge = new DOMPoint(
				element.cx.baseVal.value + element.r.baseVal.value,
				element.cy.baseVal.value,
			).matrixTransform(matrix);
			return { x: centre.x, y: centre.y, radius: edge.x - centre.x };
		});
}

for (const releaseOrder of ["rotation-first", "canvas-first"] as const) {
	test(`PLACEMENT-CONTACT-01 ${releaseOrder}: second finger outside the ring cancels angle without moving the draft and releases both contacts`, async ({
		page,
	}) => {
		const face = await beginPlacement(page);
		const baseline = await durableSnapshot(page);
		const originalCentre = await previewCentre(page);
		const ring = await rotationRing(page);
		const angle = page.getByTestId("item-placement-angle");
		const input = await page.context().newCDPSession(page);
		const first = { id: 8, x: ring.x, y: ring.y + ring.radius };
		const rotated = { ...first, x: ring.x + ring.radius, y: ring.y };
		const second = {
			id: 9,
			x: face.x + face.width * 0.1,
			y: face.y + face.height * 0.1,
		};
		// The second contact is real exposed floor, beyond the ring's 44 px hit stroke.
		expect(Math.hypot(second.x - ring.x, second.y - ring.y)).toBeGreaterThan(
			ring.radius + 22,
		);
		expect(
			await page.evaluate(
				({ x, y }) =>
					!!document
						.elementFromPoint(x, y)
						?.closest('[data-testid="plan-canvas"]'),
				second,
			),
		).toBe(true);
		try {
			await input.send("Input.dispatchTouchEvent", {
				type: "touchStart",
				touchPoints: [first],
			});
			await expect(page.getByTestId("item-placement-confirm")).toBeDisabled();
			await input.send("Input.dispatchTouchEvent", {
				type: "touchMove",
				touchPoints: [rotated],
			});
			await expect(angle).toHaveText("90°");
			await input.send("Input.dispatchTouchEvent", {
				type: "touchStart",
				touchPoints: [rotated, second],
			});
			await expect(angle).toHaveText("0°");
			expect(await previewCentre(page)).toEqual(originalCentre);
			expect(await durableSnapshot(page)).toEqual(baseline);
			const remaining = releaseOrder === "rotation-first" ? second : rotated;
			await input.send("Input.dispatchTouchEvent", {
				type: "touchEnd",
				touchPoints: [remaining],
			});
			await input.send("Input.dispatchTouchEvent", {
				type: "touchMove",
				touchPoints: [
					{ ...remaining, x: remaining.x + 12, y: remaining.y + 12 },
				],
			});
			await expect(angle).toHaveText("0°");
			expect(await previewCentre(page)).toEqual(originalCentre);
			await input.send("Input.dispatchTouchEvent", {
				type: "touchEnd",
				touchPoints: [],
			});
			await expect(page.getByTestId("item-placement-confirm")).toBeEnabled();
			const nextPoint = {
				id: 10,
				x: face.x + face.width * 0.85,
				y: face.y + face.height * 0.2,
			};
			await input.send("Input.dispatchTouchEvent", {
				type: "touchStart",
				touchPoints: [nextPoint],
			});
			await input.send("Input.dispatchTouchEvent", {
				type: "touchEnd",
				touchPoints: [],
			});
			await expect(page.getByTestId("item-placement-preview")).toHaveAttribute(
				"data-placement-valid",
				"true",
			);
			const nextCentre = await previewCentre(page);
			expect(
				Math.hypot(
					nextCentre.x - originalCentre.x,
					nextCentre.y - originalCentre.y,
				),
			).toBeGreaterThan(30);
			const nextRing = await rotationRing(page);
			await input.send("Input.dispatchTouchEvent", {
				type: "touchStart",
				touchPoints: [
					{ id: 11, x: nextRing.x, y: nextRing.y + nextRing.radius },
				],
			});
			await input.send("Input.dispatchTouchEvent", {
				type: "touchMove",
				touchPoints: [
					{ id: 11, x: nextRing.x + nextRing.radius, y: nextRing.y },
				],
			});
			await input.send("Input.dispatchTouchEvent", {
				type: "touchEnd",
				touchPoints: [],
			});
			await expect(angle).toHaveText("90°");
			expect(await previewCentre(page)).toEqual(nextCentre);
			expect(await durableSnapshot(page)).toEqual(baseline);
			await page.getByTestId("item-placement-confirm").click();
			await expect(page.getByTestId("plan-canvas")).toHaveAttribute(
				"data-active-tool",
				"select",
			);
			await expect(page.getByTestId("schematic-item")).toHaveCount(1);
			expect((await durableSnapshot(page)).revisions).toHaveLength(
				baseline.revisions.length + 1,
			);
		} finally {
			await input.detach();
		}
	});
}

test("PLACEMENT-CONTACT-02: a floor touch followed by a second finger on the new ring still pans without placing", async ({
	page,
}) => {
	const face = await beginPlacement(page);
	const baseline = await durableSnapshot(page);
	const originalRing = await rotationRing(page);
	const input = await page.context().newCDPSession(page);
	const first = {
		id: 21,
		x: face.x + face.width * 0.1,
		y: face.y + face.height * 0.2,
	};
	expect(
		Math.hypot(first.x - originalRing.x, first.y - originalRing.y),
	).toBeGreaterThan(originalRing.radius + 22);
	try {
		await input.send("Input.dispatchTouchEvent", {
			type: "touchStart",
			touchPoints: [first],
		});
		await expect.poll(() => rotationRing(page)).not.toEqual(originalRing);
		const ring = await rotationRing(page);
		const second = { id: 22, x: ring.x + ring.radius, y: ring.y };
		expect(
			await page.evaluate(
				({ x, y }) =>
					document.elementFromPoint(x, y)?.getAttribute("data-testid"),
				second,
			),
		).toBe("item-placement-rotation-handle");
		const content = page.getByTestId("plan-content");
		const before = await content.getAttribute("transform");
		await input.send("Input.dispatchTouchEvent", {
			type: "touchStart",
			touchPoints: [first, second],
		});
		await input.send("Input.dispatchTouchEvent", {
			type: "touchMove",
			touchPoints: [
				{ ...first, x: first.x + 46, y: first.y - 28 },
				{ ...second, x: second.x + 46, y: second.y - 28 },
			],
		});
		await input.send("Input.dispatchTouchEvent", {
			type: "touchEnd",
			touchPoints: [],
		});
		await expect(content).not.toHaveAttribute("transform", before ?? "");
		await expect(page.getByTestId("item-placement-angle")).toHaveText("0°");
		await expect(page.getByTestId("plan-canvas")).toHaveAttribute(
			"data-active-tool",
			"item",
		);
		expect(await durableSnapshot(page)).toEqual(baseline);
		await page.getByTestId("item-placement-cancel").click();
		expect(await durableSnapshot(page)).toEqual(baseline);
	} finally {
		await input.detach();
	}
});
