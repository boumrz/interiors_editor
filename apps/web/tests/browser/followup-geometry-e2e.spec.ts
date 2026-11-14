import { expect, type Page, test } from "@playwright/test";
import type { Project } from "../../src/domain/project";

async function snapshot(page: Page) {
	return page.evaluate(async () => {
		const db = await new Promise<IDBDatabase>((resolve, reject) => {
			const request = indexedDB.open("interiors-editor-projects");
			request.onsuccess = () => resolve(request.result);
			request.onerror = () => reject(request.error);
		});
		try {
			return await new Promise<{ project: Project; revisions: number }>(
				(resolve, reject) => {
					const tx = db.transaction(["projects", "revisions"], "readonly");
					const projects = tx.objectStore("projects").getAll();
					const revisions = tx.objectStore("revisions").getAll();
					tx.oncomplete = () => {
						const current = revisions.result.find(
							(record) =>
								record.candidate.revision.revisionId ===
								projects.result[0]?.currentRevisionId,
						);
						if (!current) return reject(new Error("Expected a saved project"));
						resolve({
							project: current.candidate.project,
							revisions: revisions.result.length,
						});
					};
					tx.onerror = () => reject(tx.error);
				},
			);
		} finally {
			db.close();
		}
	});
}

async function createPlan(page: Page) {
	await page.goto("/");
	await page.getByRole("button", { name: "Новый проект", exact: true }).click();
	await page
		.getByRole("textbox", { name: "Название проекта" })
		.fill("Сквозная стена");
	await page
		.getByRole("button", { name: "Создать проект", exact: true })
		.click();
	await page
		.getByRole("button", { name: "Создать контур", exact: true })
		.click();
	await expect(page.getByTestId("wall-body")).toHaveCount(4);
}

async function screenPoint(page: Page, point: { xMm: number; zMm: number }) {
	const { project } = await snapshot(page);
	return page.getByTestId("wall-line").evaluateAll(
		(nodes, data) => {
			let x: number | undefined;
			let y: number | undefined;
			for (const node of nodes) {
				const line = node as SVGLineElement;
				const wall = data.level.wallSegments.find(
					(wall) => wall.wallSegmentId === line.dataset.wallId,
				);
				const start = data.level.vertices.find(
					(v) => v.vertexId === wall?.startVertexId,
				);
				const end = data.level.vertices.find(
					(v) => v.vertexId === wall?.endVertexId,
				);
				const matrix = line.getScreenCTM();
				if (!start || !end || !matrix) continue;
				const a = new DOMPoint(
					line.x1.baseVal.value,
					line.y1.baseVal.value,
				).matrixTransform(matrix);
				const b = new DOMPoint(
					line.x2.baseVal.value,
					line.y2.baseVal.value,
				).matrixTransform(matrix);
				if (start.zMm === end.zMm && start.xMm !== end.xMm)
					x =
						a.x +
						((data.point.xMm - start.xMm) * (b.x - a.x)) /
							(end.xMm - start.xMm);
				if (start.xMm === end.xMm && start.zMm !== end.zMm)
					y =
						a.y +
						((data.point.zMm - start.zMm) * (b.y - a.y)) /
							(end.zMm - start.zMm);
			}
			if (x === undefined || y === undefined)
				throw new Error("Expected cardinal projection anchors");
			return { x, y };
		},
		{ level: project.level, point },
	);
}

async function touch(page: Page, start: { x: number; y: number }, end = start) {
	const cdp = await page.context().newCDPSession(page);
	try {
		await cdp.send("Input.dispatchTouchEvent", {
			type: "touchStart",
			touchPoints: [{ id: 1, ...start }],
		});
		if (start.x !== end.x || start.y !== end.y) {
			await cdp.send("Input.dispatchTouchEvent", {
				type: "touchMove",
				touchPoints: [{ id: 1, ...end }],
			});
		}
		await cdp.send("Input.dispatchTouchEvent", {
			type: "touchEnd",
			touchPoints: [],
		});
	} finally {
		await cdp.detach();
	}
}

async function drawWall(
	page: Page,
	start: { xMm: number; zMm: number },
	end: { xMm: number; zMm: number },
) {
	await page.getByRole("button", { name: "Стена", exact: true }).click();
	const a = await screenPoint(page, start);
	const b = await screenPoint(page, end);
	await touch(page, a, b);
	const confirm = page.getByRole("button", {
		name: "Подтвердить стену",
		exact: true,
	});
	await expect(confirm).toBeVisible();
	await confirm.click();
}

test("FOLLOWUP-GEO-01: a free upper wall end crosses a room boundary, closes three rooms and survives Undo/Redo/reload", async ({
	page,
}, testInfo) => {
	await createPlan(page);
	await page.getByRole("button", { name: "Отдалить", exact: true }).click();
	for (const [start, end] of [
		[
			{ xMm: 0, zMm: 0 },
			{ xMm: 0, zMm: -3100 },
		],
		[
			{ xMm: 0, zMm: -3100 },
			{ xMm: 2700, zMm: -3100 },
		],
		[
			{ xMm: 2700, zMm: -3100 },
			{ xMm: 2700, zMm: -1100 },
		],
	] as const) {
		const before = await snapshot(page);
		await drawWall(page, start, end);
		await expect
			.poll(async () => (await snapshot(page)).revisions)
			.toBe(before.revisions + 1);
	}
	const before = await snapshot(page);
	expect(before.project.level.rooms).toHaveLength(1);
	await drawWall(page, { xMm: 2700, zMm: -1100 }, { xMm: 2700, zMm: 3100 });
	await expect
		.poll(async () => (await snapshot(page)).project.level.rooms.length)
		.toBe(3);
	const after = await snapshot(page);
	expect(after.revisions).toBe(before.revisions + 1);
	expect(after.project.level.wallSegments).toHaveLength(11);
	await expect(page.getByTestId("transient-notification")).toHaveCount(0);
	await page.screenshot({
		path: testInfo.outputPath("continued-open-contour.png"),
	});
	const history = page.getByRole("group", { name: "История изменений" });
	await history.getByRole("button", { name: /^Отменить/ }).click();
	await expect
		.poll(async () => (await snapshot(page)).project.level)
		.toEqual(before.project.level);
	await history.getByRole("button", { name: /^Повторить/ }).click();
	await expect
		.poll(async () => (await snapshot(page)).project.level)
		.toEqual(after.project.level);
	await page.reload();
	await page
		.getByRole("button", { name: "Открыть Сквозная стена", exact: true })
		.click();
	await expect(page.getByTestId("wall-body")).toHaveCount(11);
	expect((await snapshot(page)).project.level).toEqual(after.project.level);
});

test("FOLLOWUP-GEO-04: selection visibly changes the physical wall fill and outline", async ({
	page,
}, testInfo) => {
	await createPlan(page);
	const body = page.getByTestId("wall-body").first();
	const outline = body.locator("..").getByTestId("wall-body-outline");
	const before = await body.evaluate((node) => getComputedStyle(node).fill);
	const stroke = await outline.evaluate(
		(node) => getComputedStyle(node).stroke,
	);
	await page.getByTestId("wall-segment").first().click();
	await expect
		.poll(() => body.evaluate((node) => getComputedStyle(node).fill))
		.not.toBe(before);
	await expect
		.poll(() => outline.evaluate((node) => getComputedStyle(node).stroke))
		.not.toBe(stroke);
	await page.screenshot({
		path: testInfo.outputPath("selected-physical-wall.png"),
	});
});

for (const mode of ["mouse", "touch"] as const) {
	test(`FOLLOWUP-GEO-08-return-${mode}: an out-and-back pan never becomes an empty tap`, async ({
		page,
	}) => {
		await createPlan(page);
		await page.getByTestId("wall-segment").first().click();
		const durable = await snapshot(page);
		const selectedBodies = page.locator(
			'[data-testid="wall-body"][data-selected="true"]',
		);
		const selectedId = await selectedBodies.getAttribute("data-wall-id");
		await expect(selectedBodies).toHaveCount(1);
		const top = await screenPoint(page, { xMm: 2050, zMm: 0 });
		const origin = { x: top.x, y: top.y - 65 };
		if (mode === "touch") {
			const cdp = await page.context().newCDPSession(page);
			try {
				await cdp.send("Input.dispatchTouchEvent", {
					type: "touchStart",
					touchPoints: [{ id: 1, ...origin }],
				});
				for (const point of [{ x: origin.x + 50, y: origin.y + 15 }, origin]) {
					await cdp.send("Input.dispatchTouchEvent", {
						type: "touchMove",
						touchPoints: [{ id: 1, ...point }],
					});
				}
				await cdp.send("Input.dispatchTouchEvent", {
					type: "touchEnd",
					touchPoints: [],
				});
			} finally {
				await cdp.detach();
			}
		} else {
			await page.mouse.move(origin.x, origin.y);
			await page.mouse.down();
			await page.mouse.move(origin.x + 50, origin.y + 15);
			await page.mouse.move(origin.x, origin.y);
			await page.mouse.up();
		}
		await expect(selectedBodies).toHaveCount(1);
		expect(await selectedBodies.getAttribute("data-wall-id")).toBe(selectedId);
		expect(await snapshot(page)).toEqual(durable);
	});
	test(`FOLLOWUP-GEO-08-${mode}: blank canvas tap clears selection while a pan keeps it`, async ({
		page,
	}) => {
		await createPlan(page);
		const durable = await snapshot(page);
		await page.getByTestId("wall-segment").first().click();
		const openingAction = page.getByRole("button", {
			name: "Добавить проём",
			exact: true,
		});
		await expect(openingAction).toBeVisible();
		const top = await screenPoint(page, { xMm: 2050, zMm: 0 });
		const empty = { x: top.x, y: top.y - 65 };
		if (mode === "touch")
			await touch(page, empty, { x: empty.x + 35, y: empty.y + 15 });
		else {
			await page.mouse.move(empty.x, empty.y);
			await page.mouse.down();
			await page.mouse.move(empty.x + 35, empty.y + 15);
			await page.mouse.up();
		}
		await expect(openingAction).toBeVisible();
		const nextTop = await screenPoint(page, { xMm: 2050, zMm: 0 });
		const nextEmpty = { x: nextTop.x, y: nextTop.y - 65 };
		if (mode === "touch") await touch(page, nextEmpty);
		else await page.mouse.click(nextEmpty.x, nextEmpty.y);
		await expect(openingAction).toHaveCount(0);
		expect(await snapshot(page)).toEqual(durable);
	});
}
