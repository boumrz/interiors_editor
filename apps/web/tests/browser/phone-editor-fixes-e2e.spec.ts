import { expect, type Page, test } from "@playwright/test";
import type { Project } from "../../src/domain/project";
import { installCatalogGatewayFake } from "./catalog-gateway-fake";

async function room(
	page: Page,
	options: { readonly square?: boolean; readonly selectWall?: boolean } = {},
) {
	await installCatalogGatewayFake(page);
	await page.goto("/");
	await page.getByRole("button", { name: "Новый проект", exact: true }).click();
	await page
		.getByRole("textbox", { name: "Название проекта" })
		.fill("Сенсорный план");
	await page
		.getByRole("button", { name: "Создать проект", exact: true })
		.click();
	if (options.square) {
		await page.getByLabel("Ширина, мм", { exact: true }).fill("3000");
		await page.getByLabel("Глубина, мм", { exact: true }).fill("3000");
	}
	await page
		.getByRole("button", { name: "Создать контур", exact: true })
		.click();
	await page.getByRole("button", { name: "Рука и выбор", exact: true }).click();
	if (options.selectWall !== false)
		await page.getByTestId("wall-segment").first().click();
}

async function snapshot(
	page: Page,
): Promise<{ project: Project; revisions: number; revisionId: string }> {
	return page.evaluate(async () => {
		const db = await new Promise<IDBDatabase>((resolve, reject) => {
			const r = indexedDB.open("interiors-editor-projects");
			r.onsuccess = () => resolve(r.result);
			r.onerror = () => reject(r.error);
		});
		try {
			const read = (store: string) =>
				new Promise<unknown[]>((resolve, reject) => {
					const r = db
						.transaction(store, "readonly")
						.objectStore(store)
						.getAll();
					r.onsuccess = () => resolve(r.result);
					r.onerror = () => reject(r.error);
				});
			const projects = (await read("projects")) as {
				currentRevisionId: string;
			}[];
			const revisions = (await read("revisions")) as {
				revisionId: string;
				candidate: { project: Project };
			}[];
			const revision = revisions.find(
				(r) => r.revisionId === projects[0]?.currentRevisionId,
			);
			if (!revision) throw new Error("Expected durable test Project");
			return {
				project: revision.candidate.project,
				revisions: revisions.length,
				revisionId: revision.revisionId,
			};
		} finally {
			db.close();
		}
	});
}

async function opening(page: Page, kind: "Door" | "Window") {
	await page
		.getByTestId("editor-action-dock")
		.getByRole("button", { name: "Добавить проём", exact: true })
		.click();
	if (kind === "Window")
		await page
			.getByRole("dialog", { name: "Новый проём", exact: true })
			.getByRole("button", { name: "Окно", exact: true })
			.click();
	const dialog = page.getByRole("dialog", {
		name: kind === "Window" ? "Новое окно" : "Новый проём",
		exact: true,
	});
	await dialog.getByRole("button", { name: "Добавить", exact: true }).click();
	await expect(dialog).not.toBeVisible();
	await expect(
		page.getByTestId(kind === "Door" ? "door-opening" : "window-opening"),
	).toHaveCount(1);
}

async function confirmOpeningMove(
	page: Page,
	before: Awaited<ReturnType<typeof snapshot>>,
) {
	const dialog = page.getByRole("dialog", {
		name: /^Подтвердить перемещение (окна|проёма)$/,
	});
	await expect(dialog).toBeVisible();
	await expect(dialog.locator("input, select, textarea")).toHaveCount(0);
	expect(await snapshot(page)).toEqual(before);
	await dialog
		.getByRole("button", { name: "Подтвердить", exact: true })
		.click();
	await expect(dialog).not.toBeVisible();
}

async function touchDrag(
	page: Page,
	from: { x: number; y: number },
	to: { x: number; y: number },
) {
	const cdp = await page.context().newCDPSession(page);
	await cdp.send("Input.dispatchTouchEvent", {
		type: "touchStart",
		touchPoints: [{ id: 1, ...from }],
	});
	for (let step = 1; step <= 5; step++)
		await cdp.send("Input.dispatchTouchEvent", {
			type: "touchMove",
			touchPoints: [
				{
					id: 1,
					x: from.x + ((to.x - from.x) * step) / 5,
					y: from.y + ((to.y - from.y) * step) / 5,
				},
			],
		});
	await cdp.send("Input.dispatchTouchEvent", {
		type: "touchEnd",
		touchPoints: [],
	});
	await cdp.detach();
}

test("PHONE-FIX-01: removed wall tools and opening position fields are absent", async ({
	page,
}) => {
	await room(page);
	await page.getByRole("button", { name: "Свойства", exact: true }).click();
	await expect(page.getByRole("button", { name: /Измерить/ })).toHaveCount(0);
	await expect(page.getByRole("textbox", { name: /Толщина/ })).toHaveCount(0);
	await expect(
		page.getByRole("button", {
			name: "Добавить настенную панель",
			exact: true,
		}),
	).toHaveCount(0);
	await page
		.getByTestId("editor-action-dock")
		.getByRole("button", { name: "Добавить проём", exact: true })
		.click();
	const dialog = page.getByRole("dialog", { name: "Новый проём", exact: true });
	await expect(
		dialog.getByRole("textbox", { name: /Отступ|Порог|нижняя отметка/ }),
	).toHaveCount(0);
	await dialog.getByRole("button", { name: "Добавить", exact: true }).click();
	await expect
		.poll(async () => (await snapshot(page)).project.level.openings[0]?.sillMm)
		.toBe(0);
	const state = await snapshot(page);
	expect(state.project.level.openings[0]?.sillMm).toBe(0);
	expect(
		state.project.level.wallSegments.every((wall) => wall.thicknessMm === 100),
	).toBe(true);
});

for (const kind of ["Door", "Window"] as const)
	test(`PHONE-FIX-02-${kind}: a genuine touch drag moves an opening once and survives reopening`, async ({
		page,
	}) => {
		await room(page);
		await opening(page, kind);
		const before = await snapshot(page);
		const handle = page.getByTestId("opening-move-handle").first();
		await expect(handle).toBeVisible();
		const bounds = await handle.boundingBox();
		if (!bounds) throw new Error("Expected opening grip");
		expect(bounds.width).toBeGreaterThanOrEqual(48);
		expect(bounds.height).toBeGreaterThanOrEqual(48);
		const from = {
			x: bounds.x + bounds.width / 2 + 5,
			y: bounds.y + bounds.height / 2,
		};
		await touchDrag(page, from, { x: from.x + 42, y: from.y + 5 });
		await confirmOpeningMove(page, before);
		await expect
			.poll(
				async () => (await snapshot(page)).project.level.openings[0]?.offsetMm,
			)
			.not.toBe(before.project.level.openings[0]?.offsetMm);
		const moved = await snapshot(page);
		expect(moved.revisions).toBe(before.revisions + 1);
		expect(moved.project.level.openings[0]).toMatchObject({
			openingId: before.project.level.openings[0]?.openingId,
			wallSegmentId: before.project.level.openings[0]?.wallSegmentId,
			sillMm: before.project.level.openings[0]?.sillMm,
		});
		await page.reload();
		await page
			.getByRole("button", { name: "Открыть Сенсорный план", exact: true })
			.click();
		expect((await snapshot(page)).project.level.openings).toEqual(
			moved.project.level.openings,
		);
	});

test("PHONE-FIX-03: selecting walls never offers the retired split gesture or mutates geometry", async ({
	page,
}) => {
	await room(page);
	const before = await snapshot(page);
	await page.getByRole("button", { name: "Свойства", exact: true }).click();
	await expect(
		page.getByRole("button", { name: "Разделить стену жестом", exact: true }),
	).toHaveCount(0);
	await page
		.getByRole("button", { name: "Закрыть свойства стены", exact: true })
		.click();
	await page.getByTestId("wall-segment").first().click();
	await expect(page.getByTestId("wall-split-preview")).toHaveCount(0);
	await expect(page.getByTestId("wall-split-handle")).toHaveCount(0);
	await expect(
		page.getByRole("button", { name: "Подтвердить разделение", exact: true }),
	).toHaveCount(0);
	expect(await snapshot(page)).toEqual(before);
});

test("PHONE-FIX-04: losing active touch capture cancels its move and leaves the next single touch available", async ({
	page,
}) => {
	await room(page);
	await opening(page, "Door");
	const before = await snapshot(page);
	const handle = page.getByTestId("opening-move-handle").first();
	const box = await handle.boundingBox();
	if (!box) throw new Error("Expected opening grip");
	const from = { x: box.x + box.width / 2, y: box.y + box.height / 2 };
	const canvas = page.getByTestId("plan-canvas");
	const outsideBox = await page
		.getByRole("button", { name: "Рука и выбор", exact: true })
		.boundingBox();
	if (!outsideBox) throw new Error("Expected a DOM control outside the SVG");
	const outside = {
		x: outsideBox.x + outsideBox.width / 2,
		y: outsideBox.y + outsideBox.height / 2,
	};
	expect(
		await page.evaluate(
			({ x, y }) =>
				document
					.elementFromPoint(x, y)
					?.closest('[data-testid="plan-canvas"]') === null,
			outside,
		),
	).toBe(true);
	await canvas.evaluate((element) => {
		element.addEventListener(
			"pointerdown",
			(event) => {
				(element as SVGSVGElement).dataset.activeTestPointer = String(
					(event as PointerEvent).pointerId,
				);
			},
			{ once: true },
		);
		element.addEventListener(
			"lostpointercapture",
			() => {
				(element as SVGSVGElement).dataset.testLostCapture = "observed";
			},
			{ once: true },
		);
	});
	const cdp = await page.context().newCDPSession(page);
	try {
		await cdp.send("Input.dispatchTouchEvent", {
			type: "touchStart",
			touchPoints: [{ id: 1, ...from }],
		});
		await cdp.send("Input.dispatchTouchEvent", {
			type: "touchMove",
			touchPoints: [{ id: 1, x: from.x + 30, y: from.y }],
		});
		await canvas.evaluate((element) => {
			const pointerId = Number(
				(element as SVGSVGElement).dataset.activeTestPointer,
			);
			if (!element.hasPointerCapture(pointerId))
				throw new Error("The real pointer was not captured");
			element.releasePointerCapture(pointerId);
		});
		await cdp.send("Input.dispatchTouchEvent", {
			type: "touchMove",
			touchPoints: [{ id: 1, ...outside }],
		});
		await cdp.send("Input.dispatchTouchEvent", {
			type: "touchEnd",
			touchPoints: [],
		});
		await expect(canvas).toHaveAttribute("data-test-lost-capture", "observed");
		expect((await snapshot(page)).project.level.openings).toEqual(
			before.project.level.openings,
		);
		expect((await snapshot(page)).revisions).toBe(before.revisions);
	} finally {
		await cdp.detach();
	}
	const next = await handle.boundingBox();
	if (!next) throw new Error("Expected the unchanged opening grip");
	const start = { x: next.x + next.width / 2, y: next.y + next.height / 2 };
	await touchDrag(page, start, { x: start.x + 42, y: start.y });
	await confirmOpeningMove(page, before);
	await expect
		.poll(
			async () => (await snapshot(page)).project.level.openings[0]?.offsetMm,
		)
		.not.toBe(before.project.level.openings[0]?.offsetMm);
	expect((await snapshot(page)).revisions).toBe(before.revisions + 1);
});

test("PHONE-FIX-05: Escape cancels opening move confirmation without changing the durable project", async ({
	page,
}) => {
	await room(page);
	await opening(page, "Door");
	const before = await snapshot(page);
	const grip = await page
		.getByTestId("opening-move-handle")
		.first()
		.boundingBox();
	if (!grip) throw new Error("Expected opening grip");
	const from = { x: grip.x + grip.width / 2, y: grip.y + grip.height / 2 };
	await touchDrag(page, from, { x: from.x + 42, y: from.y });
	const dialog = page.getByRole("dialog");
	await expect(
		dialog.getByRole("button", { name: "Подтвердить", exact: true }),
	).toBeVisible();
	expect(await snapshot(page)).toEqual(before);
	await page.keyboard.press("Escape");
	await expect(dialog).toHaveCount(0);
	await expect(page.getByTestId("opening-draft")).toHaveCount(0);
	expect(await snapshot(page)).toEqual(before);
});

for (const kind of ["Door", "Window"] as const)
	test(`PHONE-FIX-06-${kind}: no-op, Escape, pointercancel and pinch create no revision and permit the next drag`, async ({
		page,
	}) => {
		await room(page);
		await opening(page, kind);
		const before = await snapshot(page);
		for (const cancellation of [
			"no-op",
			"escape",
			"pointercancel",
			"pinch",
		] as const) {
			const box = await page
				.getByTestId("opening-move-handle")
				.first()
				.boundingBox();
			if (!box) throw new Error("Expected opening grip");
			const from = { x: box.x + box.width / 2 + 7, y: box.y + box.height / 2 };
			const moved = { x: from.x + 32, y: from.y };
			const cdp = await page.context().newCDPSession(page);
			try {
				await cdp.send("Input.dispatchTouchEvent", {
					type: "touchStart",
					touchPoints: [{ id: 1, ...from }],
				});
				if (cancellation !== "no-op")
					await cdp.send("Input.dispatchTouchEvent", {
						type: "touchMove",
						touchPoints: [{ id: 1, ...moved }],
					});
				if (cancellation === "escape") await page.keyboard.press("Escape");
				if (cancellation === "pointercancel") {
					await cdp.send("Input.dispatchTouchEvent", {
						type: "touchCancel",
						touchPoints: [],
					});
				} else if (cancellation === "pinch") {
					const second = { x: moved.x + 45, y: moved.y + 55 };
					await cdp.send("Input.dispatchTouchEvent", {
						type: "touchStart",
						touchPoints: [
							{ id: 1, ...moved },
							{ id: 2, ...second },
						],
					});
					await cdp.send("Input.dispatchTouchEvent", {
						type: "touchMove",
						touchPoints: [
							{ id: 1, x: moved.x - 10, y: moved.y },
							{ id: 2, x: second.x + 10, y: second.y },
						],
					});
					await cdp.send("Input.dispatchTouchEvent", {
						type: "touchEnd",
						touchPoints: [{ id: 2, x: second.x + 10, y: second.y }],
					});
					await cdp.send("Input.dispatchTouchEvent", {
						type: "touchEnd",
						touchPoints: [],
					});
				} else {
					await cdp.send("Input.dispatchTouchEvent", {
						type: "touchEnd",
						touchPoints: [],
					});
				}
			} finally {
				await cdp.detach();
			}
			await expect(page.getByTestId("door-opening-move-draft")).toHaveCount(0);
			expect((await snapshot(page)).project).toEqual(before.project);
			expect((await snapshot(page)).revisions).toBe(before.revisions);
		}
		const box = await page
			.getByTestId("opening-move-handle")
			.first()
			.boundingBox();
		if (!box) throw new Error("Expected recovered opening grip");
		const from = { x: box.x + box.width / 2, y: box.y + box.height / 2 };
		await touchDrag(page, from, { x: from.x + 42, y: from.y });
		await confirmOpeningMove(page, before);
		await expect
			.poll(
				async () => (await snapshot(page)).project.level.openings[0]?.offsetMm,
			)
			.not.toBe(before.project.level.openings[0]?.offsetMm);
		expect((await snapshot(page)).revisions).toBe(before.revisions + 1);
	});

test("PHONE-FIX-07: overlap and out-of-host touch moves keep the complete durable project unchanged", async ({
	page,
}) => {
	await room(page);
	await opening(page, "Door");
	await opening(page, "Window");
	const before = await snapshot(page);
	const door = before.project.level.openings.find(
		(entry) => entry.kind === "Door",
	);
	const window = before.project.level.openings.find(
		(entry) => entry.kind === "Window",
	);
	if (!door || !window) throw new Error("Expected both opening kinds");
	const grip = page.locator(`[data-door-opening-handle="${door.openingId}"]`);
	const windowGrip = page.locator(
		`[data-door-opening-handle="${window.openingId}"]`,
	);
	const source = await grip.boundingBox(),
		target = await windowGrip.boundingBox();
	if (!source || !target) throw new Error("Expected both grips");
	await touchDrag(
		page,
		{ x: source.x + source.width / 2, y: source.y + source.height / 2 },
		{ x: target.x + target.width / 2, y: target.y + target.height / 2 },
	);
	await expect(
		page.getByText("Проёмы на одной стене не могут пересекаться.", {
			exact: true,
		}),
	).toBeVisible();
	expect((await snapshot(page)).project).toEqual(before.project);
	expect((await snapshot(page)).revisions).toBe(before.revisions);
	const restored = await grip.boundingBox();
	const wall = await page.getByTestId("wall-segment").first().boundingBox();
	if (!restored || !wall) throw new Error("Expected restored geometry");
	await touchDrag(
		page,
		{ x: restored.x + restored.width / 2, y: restored.y + restored.height / 2 },
		{ x: wall.x + wall.width - 2, y: restored.y + restored.height / 2 },
	);
	await expect(
		page.getByText("Проём не помещается в границы выбранной стены.", {
			exact: true,
		}),
	).toBeVisible();
	expect((await snapshot(page)).project).toEqual(before.project);
	expect((await snapshot(page)).revisions).toBe(before.revisions);
});

test("PHONE-FIX-08: an overlapping opening preview explains the conflict before the finger is released", async ({
	page,
}) => {
	await room(page);
	await opening(page, "Door");
	await opening(page, "Window");
	const before = await snapshot(page);
	const door = before.project.level.openings.find(
		(entry) => entry.kind === "Door",
	);
	const window = before.project.level.openings.find(
		(entry) => entry.kind === "Window",
	);
	if (!door || !window) throw new Error("Expected both openings");
	const source = await page
		.locator(`[data-door-opening-handle="${door.openingId}"]`)
		.boundingBox();
	const target = await page
		.locator(`[data-door-opening-handle="${window.openingId}"]`)
		.boundingBox();
	if (!source || !target) throw new Error("Expected both handles");
	const cdp = await page.context().newCDPSession(page);
	try {
		await cdp.send("Input.dispatchTouchEvent", {
			type: "touchStart",
			touchPoints: [
				{
					id: 1,
					x: source.x + source.width / 2,
					y: source.y + source.height / 2,
				},
			],
		});
		await cdp.send("Input.dispatchTouchEvent", {
			type: "touchMove",
			touchPoints: [
				{
					id: 1,
					x: target.x + target.width / 2,
					y: target.y + target.height / 2,
				},
			],
		});
		await expect(
			page.getByText("Проёмы на одной стене не могут пересекаться.", {
				exact: true,
			}),
		).toBeVisible();
		expect((await snapshot(page)).project).toEqual(before.project);
		expect((await snapshot(page)).revisions).toBe(before.revisions);
	} finally {
		await cdp.send("Input.dispatchTouchEvent", {
			type: "touchCancel",
			touchPoints: [],
		});
		await cdp.detach();
	}
	expect((await snapshot(page)).revisions).toBe(before.revisions);
});

test("PHONE-FIX-09: a genuine diagonal opening drag preserves host and exact dimensions through Undo and Redo", async ({
	page,
}) => {
	await room(page, { square: true, selectWall: false });
	await page
		.getByTestId("editor-action-dock")
		.getByRole("button", { name: "Стена", exact: true })
		.click();
	const endpoints = await page.getByTestId("wall-line").evaluateAll((lines) =>
		lines.flatMap((line) => {
			if (!(line instanceof SVGLineElement))
				throw new Error("Expected wall line");
			const matrix = line.getScreenCTM();
			if (!matrix) throw new Error("Expected a screen transform");
			return (
				[
					["x1", "y1"],
					["x2", "y2"],
				] as const
			).map(([x, y]) => {
				const point = new DOMPoint(
					Number(line.getAttribute(x)),
					Number(line.getAttribute(y)),
				).matrixTransform(matrix);
				return { x: point.x, y: point.y };
			});
		}),
	);
	const start = [...endpoints].sort((a, b) => a.x + a.y - b.x - b.y)[0];
	const end = [...endpoints].sort((a, b) => b.x + b.y - a.x - a.y)[0];
	if (!start || !end) throw new Error("Expected opposite square corners");
	await touchDrag(page, start, end);
	await page
		.getByRole("button", { name: "Подтвердить стену", exact: true })
		.click();
	const diagonal = page.locator(
		'[data-testid="wall-segment"][data-wall-kind="interior"]',
	);
	await expect(diagonal).toHaveCount(1);
	await page.getByRole("button", { name: "Рука и выбор", exact: true }).click();
	await diagonal.click();
	await opening(page, "Door");
	const before = await snapshot(page);
	const grip = await page
		.getByTestId("opening-move-handle")
		.first()
		.boundingBox();
	if (!grip) throw new Error("Expected diagonal opening grip");
	const from = { x: grip.x + grip.width / 2, y: grip.y + grip.height / 2 };
	await touchDrag(page, from, { x: from.x + 28, y: from.y + 28 });
	await confirmOpeningMove(page, before);
	await expect
		.poll(
			async () => (await snapshot(page)).project.level.openings[0]?.offsetMm,
		)
		.not.toBe(before.project.level.openings[0]?.offsetMm);
	const moved = await snapshot(page);
	const original = before.project.level.openings[0],
		result = moved.project.level.openings[0];
	if (!original || !result) throw new Error("Expected opening snapshots");
	expect(result).toEqual({ ...original, offsetMm: result.offsetMm });
	expect((result.offsetMm - original.offsetMm) % 100).toBe(0);
	expect(moved.revisions).toBe(before.revisions + 1);
	const history = async (action: "undo" | "redo") => {
		const button = page.getByRole("button", {
			name: action === "undo" ? /^Отменить действие/ : /^Повторить действие/,
		});
		await expect(button).toBeVisible();
		await button.click();
	};
	await history("undo");
	await expect
		.poll(async () => (await snapshot(page)).project.level.openings)
		.toEqual(before.project.level.openings);
	await history("redo");
	await expect
		.poll(async () => (await snapshot(page)).project.level.openings)
		.toEqual(moved.project.level.openings);
});

test("PHONE-FIX-10: resizing and dragging preserve an existing off-grid centre and Window sill", async ({
	page,
}) => {
	await room(page);
	await page
		.getByTestId("editor-action-dock")
		.getByRole("button", { name: "Добавить проём", exact: true })
		.click();
	await page
		.getByRole("dialog", { name: "Новый проём", exact: true })
		.getByRole("button", { name: "Окно", exact: true })
		.click();
	const dialog = page.getByRole("dialog", { name: "Новое окно", exact: true });
	await dialog
		.getByRole("textbox", { name: "Ширина, мм", exact: true })
		.fill("4001");
	await dialog.getByRole("button", { name: "Добавить", exact: true }).click();
	await expect(dialog).not.toBeVisible();
	expect((await snapshot(page)).project.level.openings[0]?.offsetMm).toBe(2050);
	await page.getByRole("button", { name: "Свойства", exact: true }).click();
	await page
		.getByRole("button", { name: "Изменить окно", exact: true })
		.click();
	const editor = page.getByTestId("opening-draft");
	await editor
		.getByRole("textbox", { name: "Ширина окна, мм", exact: true })
		.fill("1200");
	await editor
		.getByRole("button", { name: "Сохранить окно", exact: true })
		.click();
	await expect(editor).not.toBeVisible();
	await expect(
		page.getByRole("complementary", { name: "Выбранное окно", exact: true }),
	).toBeVisible();
	await expect(page.getByTestId("selected-wall-inspector")).not.toBeVisible();
	const before = await snapshot(page);
	expect(before.project.level.openings[0]).toMatchObject({
		offsetMm: 2050,
		widthMm: 1200,
		heightMm: 1200,
		sillMm: 900,
	});
	const grip = await page
		.getByTestId("opening-move-handle")
		.first()
		.boundingBox();
	if (!grip) throw new Error("Expected off-grid opening grip");
	const from = { x: grip.x + grip.width / 2 + 7, y: grip.y + grip.height / 2 };
	expect(
		await page.evaluate(
			({ x, y }) =>
				Boolean(
					document
						.elementFromPoint(x, y)
						?.closest("[data-door-opening-handle]"),
				),
			from,
		),
	).toBe(true);
	const cdp = await page.context().newCDPSession(page);
	try {
		await cdp.send("Input.dispatchTouchEvent", {
			type: "touchStart",
			touchPoints: [{ id: 1, ...from }],
		});
		await cdp.send("Input.dispatchTouchEvent", {
			type: "touchEnd",
			touchPoints: [],
		});
	} finally {
		await cdp.detach();
	}
	expect((await snapshot(page)).project).toEqual(before.project);
	expect((await snapshot(page)).revisions).toBe(before.revisions);
	await touchDrag(page, from, { x: from.x + 42, y: from.y });
	await confirmOpeningMove(page, before);
	await expect
		.poll(
			async () => (await snapshot(page)).project.level.openings[0]?.offsetMm,
		)
		.not.toBe(2050);
	const after = await snapshot(page);
	const moved = after.project.level.openings[0];
	if (!moved) throw new Error("Expected moved Window");
	expect(moved.offsetMm % 100).toBe(50);
	expect(moved).toMatchObject({ widthMm: 1200, heightMm: 1200, sillMm: 900 });
	expect(after.revisions).toBe(before.revisions + 1);
	await page.reload();
	await page
		.getByRole("button", { name: "Открыть Сенсорный план", exact: true })
		.click();
	expect((await snapshot(page)).project.level.openings).toEqual(
		after.project.level.openings,
	);
});

test("PHONE-FIX-11: Escape followed by real capture loss and an outside release cannot leave a ghost touch", async ({
	page,
}) => {
	await room(page);
	await opening(page, "Window");
	const before = await snapshot(page);
	const canvas = page.getByTestId("plan-canvas");
	const handle = page.getByTestId("opening-move-handle").first();
	const grip = await handle.boundingBox();
	const dock = await page
		.getByRole("button", { name: "Рука и выбор", exact: true })
		.boundingBox();
	if (!grip || !dock) throw new Error("Expected visible touch targets");
	const from = { x: grip.x + grip.width / 2, y: grip.y + grip.height / 2 };
	const outside = { x: dock.x + dock.width / 2, y: dock.y + dock.height / 2 };
	expect(
		await page.evaluate(
			({ x, y }) =>
				document
					.elementFromPoint(x, y)
					?.closest('[data-testid="plan-canvas"]') === null,
			outside,
		),
	).toBe(true);
	await canvas.evaluate((element) => {
		element.addEventListener(
			"pointerdown",
			(event) => {
				(element as SVGSVGElement).dataset.escapeTestPointer = String(
					(event as PointerEvent).pointerId,
				);
			},
			{ once: true },
		);
		element.addEventListener(
			"lostpointercapture",
			() => {
				(element as SVGSVGElement).dataset.escapeLostCapture = "observed";
			},
			{ once: true },
		);
	});
	const cdp = await page.context().newCDPSession(page);
	try {
		await cdp.send("Input.dispatchTouchEvent", {
			type: "touchStart",
			touchPoints: [{ id: 1, ...from }],
		});
		await cdp.send("Input.dispatchTouchEvent", {
			type: "touchMove",
			touchPoints: [{ id: 1, x: from.x + 30, y: from.y }],
		});
		await page.keyboard.press("Escape");
		await canvas.evaluate((element) => {
			const pointerId = Number(
				(element as SVGSVGElement).dataset.escapeTestPointer,
			);
			if (element.hasPointerCapture(pointerId))
				element.releasePointerCapture(pointerId);
		});
		await cdp.send("Input.dispatchTouchEvent", {
			type: "touchMove",
			touchPoints: [{ id: 1, ...outside }],
		});
		await cdp.send("Input.dispatchTouchEvent", {
			type: "touchEnd",
			touchPoints: [],
		});
		await expect(canvas).toHaveAttribute(
			"data-escape-lost-capture",
			"observed",
		);
		expect((await snapshot(page)).project).toEqual(before.project);
		expect((await snapshot(page)).revisions).toBe(before.revisions);
	} finally {
		await cdp.detach();
	}
	const next = await handle.boundingBox();
	if (!next) throw new Error("Expected opening grip after cancellation");
	const start = { x: next.x + next.width / 2, y: next.y + next.height / 2 };
	await touchDrag(page, start, { x: start.x + 42, y: start.y });
	await confirmOpeningMove(page, before);
	await expect
		.poll(
			async () => (await snapshot(page)).project.level.openings[0]?.offsetMm,
		)
		.not.toBe(before.project.level.openings[0]?.offsetMm);
	expect((await snapshot(page)).revisions).toBe(before.revisions + 1);
});

test("PHONE-FIX-12: a second real finger over DOM header cancels the opening drag without a revision", async ({
	page,
}) => {
	await room(page);
	await opening(page, "Door");
	const before = await snapshot(page);
	const grip = await page
		.getByTestId("opening-move-handle")
		.first()
		.boundingBox();
	const header = await page
		.getByRole("button", { name: "Открыть остальные действия", exact: true })
		.boundingBox();
	if (!grip || !header)
		throw new Error("Expected opening grip and DOM header control");
	const from = { x: grip.x + grip.width / 2, y: grip.y + grip.height / 2 };
	const moved = { x: from.x + 32, y: from.y };
	const second = {
		x: header.x + header.width / 2,
		y: header.y + header.height / 2,
	};
	expect(
		await page.evaluate(
			({ x, y }) =>
				document
					.elementFromPoint(x, y)
					?.closest('[data-testid="plan-canvas"]') === null,
			second,
		),
	).toBe(true);
	const cdp = await page.context().newCDPSession(page);
	try {
		await cdp.send("Input.dispatchTouchEvent", {
			type: "touchStart",
			touchPoints: [{ id: 1, ...from }],
		});
		await cdp.send("Input.dispatchTouchEvent", {
			type: "touchMove",
			touchPoints: [{ id: 1, ...moved }],
		});
		await cdp.send("Input.dispatchTouchEvent", {
			type: "touchStart",
			touchPoints: [
				{ id: 1, ...moved },
				{ id: 2, ...second },
			],
		});
		await cdp.send("Input.dispatchTouchEvent", {
			type: "touchEnd",
			touchPoints: [],
		});
	} finally {
		await cdp.detach();
	}
	await page.evaluate(
		() =>
			new Promise<void>((resolve) =>
				requestAnimationFrame(() => requestAnimationFrame(() => resolve())),
			),
	);
	await expect(page.getByTestId("door-opening-move-draft")).toHaveCount(0);
	expect((await snapshot(page)).project).toEqual(before.project);
	expect((await snapshot(page)).revisions).toBe(before.revisions);
});
