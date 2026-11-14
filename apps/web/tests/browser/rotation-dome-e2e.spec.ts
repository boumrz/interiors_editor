import { expect, type Page, test } from "@playwright/test";
import { installCatalogGatewayFake } from "./catalog-gateway-fake";

async function revisions(page: Page) {
	return page.evaluate(async () => {
		const db = await new Promise<IDBDatabase>((resolve, reject) => {
			const request = indexedDB.open("interiors-editor-projects");
			request.onsuccess = () => resolve(request.result);
			request.onerror = () => reject(request.error);
		});
		try {
			return await new Promise<number>((resolve, reject) => {
				const tx = db.transaction("revisions", "readonly");
				const request = tx.objectStore("revisions").count();
				request.onsuccess = () => resolve(request.result);
				request.onerror = () => reject(request.error);
			});
		} finally {
			db.close();
		}
	});
}

async function openItem(page: Page) {
	await installCatalogGatewayFake(page);
	await page.goto("/");
	await page.getByRole("button", { name: "Новый проект", exact: true }).click();
	await page
		.getByRole("textbox", { name: "Название проекта" })
		.fill("Полусфера поворота");
	await page
		.getByRole("button", { name: "Создать проект", exact: true })
		.click();
	await page
		.getByRole("button", { name: "Создать контур", exact: true })
		.click();
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
	await composer
		.getByLabel("Название макетного предмета")
		.fill("Стол поворота");
	await composer
		.getByRole("button", { name: "Начать размещение", exact: true })
		.click();
	const face = await page.getByTestId("room-face").first().boundingBox();
	const canvas = await page.getByTestId("plan-canvas").boundingBox();
	if (!face || !canvas) throw new Error("Expected a room plan");
	await page.getByTestId("plan-canvas").click({
		position: {
			x: face.x + face.width / 2 - canvas.x,
			y: face.y + face.height / 2 - canvas.y,
		},
	});
	await page.getByTestId("item-placement-confirm").click();
	await page.getByRole("button", { name: "Рука и выбор", exact: true }).click();
	await page.getByTestId("schematic-item").click();
	await page.getByRole("button", { name: "3D", exact: true }).click();
	await expect(
		page.getByTestId("three-dimensional-rotation-dome"),
	).toBeVisible();
}

test("ROTATION-DOME-01: the visible cap has a real touch band and sector capture does not jump or save a tap", async ({
	page,
}) => {
	await openItem(page);
	const cap = page.getByTestId("three-dimensional-rotation-gizmo");
	const band = page.getByTestId("three-dimensional-rotation-hit-area");
	const box = await cap.boundingBox();
	if (!box) throw new Error("Expected a rotation dome");
	expect(box.width).toBeGreaterThanOrEqual(144);
	const painted = await page
		.getByTestId("three-dimensional-rotation-dome")
		.boundingBox();
	expect(painted?.width).toBeGreaterThanOrEqual(144);
	expect(
		await page.evaluate(
			({ x, y }) =>
				document.elementFromPoint(x, y)?.getAttribute("data-testid"),
			{ x: box.x + 100, y: box.y + 100 },
		),
	).toBe("three-dimensional-canvas");
	expect(
		Number.parseFloat(
			await band.evaluate((element) => getComputedStyle(element).strokeWidth),
		),
	).toBeGreaterThanOrEqual(48);
	for (const name of [
		"Повернуть предмет на 45° против часовой стрелки",
		"Повернуть предмет на 45° по часовой стрелке",
	]) {
		const button = page.getByRole("button", { name, exact: true });
		const bounds = await button.boundingBox();
		if (!bounds) throw new Error("Expected accessible step controls");
		expect(Math.min(bounds.width, bounds.height)).toBeGreaterThanOrEqual(48);
	}
	const before = await revisions(page);
	const cdp = await page.context().newCDPSession(page);
	try {
		await cdp.send("Input.dispatchTouchEvent", {
			type: "touchStart",
			touchPoints: [{ id: 91, x: box.x + box.width - 27, y: box.y + 100 }],
		});
		await expect(
			page.getByTestId("three-dimensional-rotation-angle"),
		).toHaveText("0°");
		await cdp.send("Input.dispatchTouchEvent", {
			type: "touchEnd",
			touchPoints: [],
		});
	} finally {
		await cdp.detach();
	}
	await expect(page.getByTestId("three-dimensional-item-preview")).toHaveText(
		"нет",
	);
	expect(await revisions(page)).toBe(before);
});

async function touchPointsForDome(page: Page) {
	const box = await page
		.getByTestId("three-dimensional-rotation-gizmo")
		.boundingBox();
	if (!box) throw new Error("Expected a visible dome");
	const centre = { x: box.x + 100, y: box.y + 100 };
	const at = (degrees: number, radius = 73) => ({
		id: 91,
		x: centre.x + Math.sin((degrees * Math.PI) / 180) * radius,
		y: centre.y - Math.cos((degrees * Math.PI) / 180) * radius,
	});
	return { at, centre };
}

async function history(page: Page, action: "undo" | "redo") {
	const button = page.getByRole("button", {
		name: action === "undo" ? /^Отменить действие/ : /^Повторить действие/,
	});
	if (!(await button.isVisible()))
		await page
			.getByRole("button", { name: "Открыть остальные действия", exact: true })
			.click();
	await button.click();
	const close = page.getByRole("button",{name:"Закрыть остальные действия",exact:true});
	if (await close.isVisible()) await close.click();
}

test("ROTATION-DOME-02: captured touch drag saves one relative rotation and step controls share Undo, Redo and reopen", async ({
	page,
}) => {
	await openItem(page);
	const before = await revisions(page);
	const { at } = await touchPointsForDome(page);
	await page
		.getByTestId("three-dimensional-rotation-hit-area")
		.evaluate((element) => {
			Object.defineProperty(element, "setPointerCapture", {
				configurable: true,
				value: () => {
					throw new DOMException("Capture unavailable", "NotSupportedError");
				},
			});
		});
	const cdp = await page.context().newCDPSession(page);
	try {
		await cdp.send("Input.dispatchTouchEvent", {
			type: "touchStart",
			touchPoints: [at(-45)],
		});
		await expect(
			page.getByTestId("three-dimensional-rotation-angle"),
		).toHaveText("0°");
		await cdp.send("Input.dispatchTouchEvent", {
			type: "touchMove",
			touchPoints: [at(45)],
		});
		await expect(
			page.getByTestId("three-dimensional-rotation-angle"),
		).toHaveText("270°");
		await cdp.send("Input.dispatchTouchEvent", {
			type: "touchMove",
			touchPoints: [at(135, 130)],
		});
		await expect(
			page.getByTestId("three-dimensional-rotation-angle"),
		).toHaveText("180°");
		await cdp.send("Input.dispatchTouchEvent", {
			type: "touchEnd",
			touchPoints: [],
		});
	} finally {
		await cdp.detach();
	}
	await expect.poll(() => revisions(page)).toBe(before + 1);
	await expect(page.getByTestId("three-dimensional-rotation-angle")).toHaveText(
		"180°",
	);
	await page
		.getByRole("button", {
			name: "Повернуть предмет на 45° против часовой стрелки",
			exact: true,
		})
		.click();
	await expect(page.getByTestId("three-dimensional-rotation-angle")).toHaveText(
		"225°",
	);
	await expect.poll(() => revisions(page)).toBe(before + 2);
	await history(page, "undo");
	await page.getByRole("button", { name: "План 2D", exact: true }).click();
	await page.getByTestId("schematic-item").click();
	await page.getByRole("button", { name: "3D", exact: true }).click();
	await expect(page.getByTestId("three-dimensional-rotation-angle")).toHaveText(
		"180°",
	);
	await history(page, "redo");
	await page.getByRole("button", { name: "План 2D", exact: true }).click();
	await page.getByTestId("schematic-item").click();
	await page.getByRole("button", { name: "3D", exact: true }).click();
	await expect(page.getByTestId("three-dimensional-rotation-angle")).toHaveText(
		"225°",
	);
	await page.reload();
	await page
		.getByRole("button", { name: "Открыть Полусфера поворота", exact: true })
		.click();
	await page.getByTestId("schematic-item").click();
	await page.getByRole("button", { name: "3D", exact: true }).click();
	await expect(page.getByTestId("three-dimensional-rotation-angle")).toHaveText(
		"225°",
	);
});

test("ROTATION-DOME-03: a second touch cancels a live rotation and takes both contacts into camera pinch", async ({
	page,
}) => {
	await openItem(page);
	const before = await revisions(page);
	const { at, centre } = await touchPointsForDome(page);
	const second = { id: 92, x: centre.x - 110, y: centre.y + 30 };
	const camera = await page
		.getByTestId("three-dimensional-camera")
		.textContent();
	const cdp = await page.context().newCDPSession(page);
	try {
		await cdp.send("Input.dispatchTouchEvent", {
			type: "touchStart",
			touchPoints: [at(-45)],
		});
		await cdp.send("Input.dispatchTouchEvent", {
			type: "touchMove",
			touchPoints: [at(0)],
		});
		await expect(
			page.getByTestId("three-dimensional-item-preview"),
		).toContainText("поворот");
		await cdp.send("Input.dispatchTouchEvent", {
			type: "touchStart",
			touchPoints: [at(0), second],
		});
		await expect(page.getByTestId("three-dimensional-item-preview")).toHaveText(
			"нет",
		);
		await cdp.send("Input.dispatchTouchEvent", {
			type: "touchMove",
			touchPoints: [
				{ ...at(0), x: at(0).x - 25 },
				{ ...second, x: second.x + 25 },
			],
		});
		await expect(page.getByTestId("three-dimensional-camera")).not.toHaveText(
			camera ?? "",
		);
		await cdp.send("Input.dispatchTouchEvent", {
			type: "touchEnd",
			touchPoints: [second],
		});
		await cdp.send("Input.dispatchTouchEvent", {
			type: "touchEnd",
			touchPoints: [],
		});
	} finally {
		await cdp.detach();
	}
	await expect(page.getByTestId("three-dimensional-item-preview")).toHaveText(
		"нет",
	);
	expect(await revisions(page)).toBe(before);
});

test("ROTATION-DOME-04: Escape and pointer cancellation discard the draft without history", async ({
	page,
}) => {
	await openItem(page);
	const before = await revisions(page);
	const { at } = await touchPointsForDome(page);
	const cdp = await page.context().newCDPSession(page);
	try {
		for (const cancel of ["escape", "pointercancel"]) {
			await cdp.send("Input.dispatchTouchEvent", {
				type: "touchStart",
				touchPoints: [at(-45)],
			});
			await cdp.send("Input.dispatchTouchEvent", {
				type: "touchMove",
				touchPoints: [at(0)],
			});
			await expect(
				page.getByTestId("three-dimensional-item-preview"),
			).toContainText("поворот");
			if (cancel === "escape") {
				await page.keyboard.press("Escape");
				await cdp.send("Input.dispatchTouchEvent", {
					type: "touchEnd",
					touchPoints: [],
				});
			} else
				await cdp.send("Input.dispatchTouchEvent", {
					type: "touchCancel",
					touchPoints: [],
				});
			await expect(
				page.getByTestId("three-dimensional-item-preview"),
			).toHaveText("нет");
		}
	} finally {
		await cdp.detach();
	}
	expect(await revisions(page)).toBe(before);
});

test("ROTATION-DOME-05: short enlarged phone keeps cap and step buttons clear of header and camera deck", async ({
	page,
}) => {
	await openItem(page);
	await page.setViewportSize({ width: 360, height: 480 });
	await page.evaluate(() => {
		document.documentElement.style.fontSize = "200%";
	});
	const controls = [
		page.getByTestId("three-dimensional-rotation-gizmo"),
		page.getByRole("button", {
			name: "Повернуть предмет на 45° против часовой стрелки",
			exact: true,
		}),
		page.getByRole("button", {
			name: "Повернуть предмет на 45° по часовой стрелке",
			exact: true,
		}),
	];
	await expect.poll(async () => {
		const [header, deck, ...boxes] = await Promise.all([
			page.getByTestId("editor-top-bar").boundingBox(),
			page.getByTestId("three-dimensional-view-controls").boundingBox(),
			...controls.map((control) => control.boundingBox()),
		]);
		return !!header && !!deck && boxes.every((box) => box !== null && box.y >= header.y + header.height && box.y + box.height <= deck.y && box.x >= 0 && box.x + box.width <= 360);
	}).toBe(true);
	// Raw CDP input bypasses Playwright's normal stable-element actionability.
	// A resize can fit the camera again after the containment check has passed.
	const stableDome = await page
		.getByTestId("three-dimensional-rotation-gizmo")
		.elementHandle();
	if (!stableDome) throw new Error("Expected the visible rotation control");
	await stableDome.waitForElementState("stable");
	const { at } = await touchPointsForDome(page);
	expect(await page.evaluate(
		(point) => document.elementFromPoint(point.x, point.y)?.getAttribute("data-testid"),
		at(75),
	)).toBe("three-dimensional-rotation-hit-area");
	const cdp = await page.context().newCDPSession(page);
	try {
		await cdp.send("Input.dispatchTouchEvent", {
			type: "touchStart",
			touchPoints: [at(75)],
		});
		await cdp.send("Input.dispatchTouchEvent", {
			type: "touchMove",
			touchPoints: [at(0)],
		});
		await expect(
			page.getByTestId("three-dimensional-rotation-gizmo"),
		).toHaveAttribute("data-rotation-active", "true");
		await expect.poll(async () => {
			const [cancel, deck] = await Promise.all([
				page.getByRole("button", { name: "Отменить поворот", exact: true }).boundingBox(),
				page.getByTestId("three-dimensional-view-controls").boundingBox(),
			]);
			return !!cancel && !!deck && cancel.y + cancel.height <= deck.y;
		}).toBe(true);
		await page.screenshot({
			path: test.info().outputPath("rotation-dome-short-active.png"),
		});
	} finally {
		if (!page.isClosed())
			await cdp.send("Input.dispatchTouchEvent", {
				type: "touchCancel",
				touchPoints: [],
			});
		await cdp.detach();
	}
});

test("ROTATION-DOME-06: a locked selected item exposes no transform target while camera inspection remains available", async ({
	page,
}) => {
	await openItem(page);
	await page.getByRole("button", { name: "План 2D", exact: true }).click();
	await page
		.getByRole("button", { name: "Открыть остальные действия", exact: true })
		.click();
	await page
		.getByRole("button", { name: "Параметры выбранного предмета", exact: true })
		.click();
	await page
		.getByRole("button", { name: "Заблокировать предмет", exact: true })
		.click();
	await expect(
		page.getByTestId("editor-top-bar").getByRole("status"),
	).toHaveText("Сохранено");
	await page.getByRole("button", { name: "3D", exact: true }).click();
	await expect(
		page.getByTestId("three-dimensional-rotation-gizmo"),
	).toHaveCount(0);
	const before = await revisions(page);
	const canvas = await page
		.getByTestId("three-dimensional-canvas")
		.boundingBox();
	if (!canvas) throw new Error("Expected the 3D canvas");
	const camera = await page
		.getByTestId("three-dimensional-camera")
		.textContent();
	const exposed = await page
		.getByTestId("three-dimensional-canvas")
		.evaluate((element) => {
			const box = element.getBoundingClientRect();
			for (const [xRatio, yRatio] of [
				[0.9, 0.12],
				[0.15, 0.2],
				[0.7, 0.3],
			]) {
				const point = {
					x: box.left + box.width * xRatio,
					y: box.top + box.height * yRatio,
				};
				if (document.elementFromPoint(point.x, point.y) === element)
					return point;
			}
			throw new Error("Expected an exposed camera target");
		});
	await page.mouse.move(exposed.x, exposed.y);
	await page.mouse.down();
	await page.mouse.move(exposed.x - 35, exposed.y + 10, { steps: 5 });
	await page.mouse.up();
	await expect(page.getByTestId("three-dimensional-camera")).not.toHaveText(
		camera ?? "",
	);
	expect(await revisions(page)).toBe(before);
});

test("ROTATION-DOME-07: explicit cancel and lost WebGL never publish a live rotation", async ({
	page,
}) => {
	await openItem(page);
	const before = await revisions(page);
	const { at } = await touchPointsForDome(page);
	const cdp = await page.context().newCDPSession(page);
	try {
		await cdp.send("Input.dispatchTouchEvent", {
			type: "touchStart",
			touchPoints: [at(-45)],
		});
		await cdp.send("Input.dispatchTouchEvent", {
			type: "touchMove",
			touchPoints: [at(0)],
		});
		await page
			.getByRole("button", { name: "Отменить поворот", exact: true })
			.click();
		await cdp.send("Input.dispatchTouchEvent", {
			type: "touchEnd",
			touchPoints: [],
		});
		await expect(page.getByTestId("three-dimensional-item-preview")).toHaveText(
			"нет",
		);
		await cdp.send("Input.dispatchTouchEvent", {
			type: "touchStart",
			touchPoints: [at(-45)],
		});
		await cdp.send("Input.dispatchTouchEvent", {
			type: "touchMove",
			touchPoints: [at(0)],
		});
		await page
			.getByTestId("three-dimensional-canvas")
			.evaluate((canvas) =>
				canvas.dispatchEvent(
					new Event("webglcontextlost", { cancelable: true }),
				),
			);
		await cdp.send("Input.dispatchTouchEvent", {
			type: "touchEnd",
			touchPoints: [],
		});
		await expect(page.getByTestId("three-dimensional-item-preview")).toHaveText(
			"нет",
		);
	} finally {
		await cdp.detach();
	}
	expect(await revisions(page)).toBe(before);
});

test("ROTATION-DOME-08: window blur cancels the draft without a Revision and the next rotation starts cleanly", async ({
	page,
}) => {
	await openItem(page);
	const before = await revisions(page);
	const { at } = await touchPointsForDome(page);
	const cdp = await page.context().newCDPSession(page);
	try {
		await cdp.send("Input.dispatchTouchEvent", {
			type: "touchStart",
			touchPoints: [at(-45)],
		});
		await cdp.send("Input.dispatchTouchEvent", {
			type: "touchMove",
			touchPoints: [at(0)],
		});
		await expect(
			page.getByTestId("three-dimensional-item-preview"),
		).toContainText("поворот");
		await page.evaluate(() => window.dispatchEvent(new Event("blur")));
		await expect(page.getByTestId("three-dimensional-item-preview")).toHaveText(
			"нет",
			{ timeout: 1000 },
		);
		await cdp.send("Input.dispatchTouchEvent", {
			type: "touchEnd",
			touchPoints: [],
		});
		expect(await revisions(page)).toBe(before);
		await cdp.send("Input.dispatchTouchEvent", {
			type: "touchStart",
			touchPoints: [at(-45)],
		});
		await cdp.send("Input.dispatchTouchEvent", {
			type: "touchMove",
			touchPoints: [at(45)],
		});
		await cdp.send("Input.dispatchTouchEvent", {
			type: "touchEnd",
			touchPoints: [],
		});
		await expect.poll(() => revisions(page)).toBe(before + 1);
		await expect(
			page.getByTestId("three-dimensional-rotation-angle"),
		).toHaveText("270°");
	} finally {
		await cdp.detach();
	}
});

test("ROTATION-DOME-09: placement leaves no toast over a cancellable and durable rotation", async ({ page }) => {
	await openItem(page);
	const toast = page.getByTestId("item-placement-durable-status");
	await expect(toast).toBeHidden();
	const before = await revisions(page);
	const { at } = await touchPointsForDome(page);
	const cdp = await page.context().newCDPSession(page);
	let active = false;
	try {
		active = true;
		await cdp.send("Input.dispatchTouchEvent", {type:"touchStart",touchPoints:[at(75)]});
		await cdp.send("Input.dispatchTouchEvent", {type:"touchMove",touchPoints:[at(30)]});
		await expect(page.getByTestId("three-dimensional-item-preview")).toContainText("поворот");
		await expect(toast).toBeHidden();
		await cdp.send("Input.dispatchTouchEvent", {type:"touchCancel",touchPoints:[]});
		active = false;
		await expect(page.getByTestId("three-dimensional-item-preview")).toHaveText("нет");
		expect(await revisions(page)).toBe(before);
		active = true;
		await cdp.send("Input.dispatchTouchEvent", {type:"touchStart",touchPoints:[at(75)]});
		await cdp.send("Input.dispatchTouchEvent", {type:"touchMove",touchPoints:[at(30)]});
		await expect(page.getByTestId("three-dimensional-item-preview")).toContainText("поворот");
		await cdp.send("Input.dispatchTouchEvent", {type:"touchEnd",touchPoints:[]});
		active = false;
		await expect.poll(() => revisions(page)).toBe(before + 1);
		await expect(page.getByTestId("three-dimensional-rotation-angle")).toHaveText("45°");
		await expect(toast).toBeHidden();
	} finally {
		if (active && !page.isClosed()) await cdp.send("Input.dispatchTouchEvent", {type:"touchCancel",touchPoints:[]});
		await cdp.detach();
	}
});
