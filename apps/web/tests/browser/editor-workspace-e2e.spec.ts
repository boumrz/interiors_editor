import {
	chromium,
	devices,
	expect,
	type Locator,
	type Page,
	type Route,
	type TestInfo,
	test,
} from "@playwright/test";
import { canonicalProjectSerializer } from "../../src/application/create-project";
import type { PublicationCandidate } from "../../src/application/ports";
import {
	addDoorOpeningToProject,
	addWindowOpeningToProject,
	wallOpeningHostsForProject,
} from "../../src/domain/door-opening-project";
import {
	changeGeneralWallThickness,
	reverseGeneralWall,
	splitGeneralWall,
} from "../../src/domain/general-wall-project";
import {
	createParametricWallItem,
	type ParametricWallItemInput,
} from "../../src/domain/parametric-wall-item";
import type { Project } from "../../src/domain/project";
import { isStructurallyValidProjectV1 } from "../../src/domain/project-json-transfer";
import { installCatalogGatewayFake } from "./catalog-gateway-fake";

type RenderedBox = {
	height: number;
	left: number;
	top: number;
	width: number;
};

type PointerBox = {
	height: number;
	width: number;
	x: number;
	y: number;
};

async function showAllDrawingDimensions(page: Page): Promise<void> {
	await page
		.getByRole("button", { name: "Настроить размеры", exact: true })
		.click();
	const dialog = page.getByRole("dialog", { name: "Размеры", exact: true });
	await expect(dialog).toBeVisible();
	await dialog
		.getByRole("button", { name: "Показать всё", exact: true })
		.click();
	await dialog.getByRole("tab", { name: "Помещения", exact: true }).click();
	for (const name of ["Внутренние размеры", "Внешние габариты"]) {
		await expect(
			dialog.getByRole("checkbox", { name, exact: true }),
		).toBeChecked();
	}
	await dialog.getByRole("tab", { name: "Проёмы", exact: true }).click();
	await expect(
		dialog.getByRole("checkbox", { name: "Ширина проёмов", exact: true }),
	).toBeChecked();
	await expect(
		dialog.getByRole("checkbox", { name: "Стены по осям", exact: true }),
	).toHaveCount(0);
	await expect(
		dialog.getByRole("checkbox", { name: "Простенки по осям", exact: true }),
	).toHaveCount(0);
	await dialog.getByRole("button", { name: "Готово", exact: true }).click();
	await expect(dialog).toHaveCount(0);
}

async function firstExposedCanvasPoint(
	page: Page,
	canvas: PointerBox,
	candidates: readonly (readonly [number, number])[],
) {
	for (const [horizontal, vertical] of candidates) {
		const point = {
			x: canvas.x + canvas.width * horizontal,
			y: canvas.y + canvas.height * vertical,
		};
		const isCanvas = await page.evaluate(({ x, y }) => {
			return (
				document.elementFromPoint(x, y)?.getAttribute("data-testid") ===
				"three-dimensional-canvas"
			);
		}, point);
		if (isCanvas) return point;
	}
	throw new Error("Expected an exposed 3D canvas point outside the inspector");
}

async function openPersistentPhone(
	testInfo: TestInfo,
	suffix: string,
	options: {
		readonly freshProfile?: boolean;
		readonly installCatalogFake?: boolean;
		readonly serviceWorkers?: "allow" | "block";
	} = {},
) {
	const profileSuffix = options.freshProfile
		? `${suffix}-${Date.now()}-${Math.random()}`
		: suffix;
	const context = await chromium.launchPersistentContext(
		testInfo.outputPath(`profile-${profileSuffix}`),
		{
			...devices["iPhone 13"],
			channel: "chrome",
			colorScheme: "light",
			locale: "ru-RU",
			serviceWorkers: options.serviceWorkers ?? "block",
		},
	);
	const page = context.pages()[0] ?? (await context.newPage());
	if (options.installCatalogFake !== false)
		await installCatalogGatewayFake(page);
	return { context, page };
}

type EditorOption =
	| "План 2D"
	| "3D"
	| "Рука и выбор"
	| "Стена"
	| "Предметы интерьера";

/**
 * View mode is intentionally separated from authoring tools: it stays visible
 * in the compact top bar, while the three frequent creation tools stay in the
 * persistent action dock.
 */
async function chooseEditorOption(page: Page, name: EditorOption) {
	if (name === "План 2D" || name === "3D") {
		const option = page
			.getByTestId("editor-view-switch")
			.getByRole("button", { name, exact: true });
		await expect(option).toBeEnabled();
		await option.click();
		return;
	}
	const rail = page.getByRole("navigation", { name: "Инструменты редактора" });
	const option = rail.getByRole("button", { name, exact: true });
	if (name === "Предметы интерьера" && !(await option.isVisible())) {
		await page
			.getByRole("button", { name: "Открыть остальные действия" })
			.click();
		const catalog = page
			.getByRole("dialog", { name: "Остальные действия редактора" })
			.getByRole("button", { name, exact: true });
		// A completed placement can clear the wall selection between the first
		// visibility read and opening this menu. Follow the now-visible route.
		await expect
			.poll(
				async () => (await catalog.isVisible()) || (await option.isVisible()),
			)
			.toBe(true);
		if (await catalog.isVisible()) {
			await expect(catalog).toBeEnabled();
			await catalog.click();
			return;
		}
		await page
			.getByRole("button", { name: "Закрыть остальные действия", exact: true })
			.click();
	}
	// Selecting a wall intentionally replaces the construction action with
	// “Свойства” in the compact dock. Returning to drawing is still a direct
	// two-tap phone flow: clear the selection, then choose “Стена”.
	if (name === "Стена" && !(await option.isVisible())) {
		const select = rail.getByRole("button", {
			name: "Рука и выбор",
			exact: true,
		});
		await expect(select).toBeEnabled();
		await select.click();
	}
	await expect(option).toBeEnabled();
	await option.click();
}

async function startNewProject(page: Page, name: string) {
	await page.getByRole("button", { name: "Новый проект", exact: true }).click();
	await page.getByLabel("Название проекта").fill(name);
	await page.getByRole("button", { name: "Создать проект" }).click();
}

async function openProjectFromHub(page: Page, name: string) {
	await expect(page.getByRole("heading", { name: "Проекты" })).toBeVisible();
	await page
		.getByRole("button", { name: `Открыть ${name}`, exact: true })
		.click();
	await expect(page.getByTestId("editor-workspace")).toBeVisible();
}

async function choosePreloadedCatalogAsset(
	page: Page,
	label = "Деревянный комод",
	autoConfirmPlacement = true,
) {
	await chooseEditorOption(page, "Предметы интерьера");
	const catalog = page.getByRole("dialog", { name: "Предметы интерьера" });
	await catalog
		.getByRole("button", { name: new RegExp(`^${label} —`) })
		.click();
	const place = catalog.getByRole("button", {
		name: "Показать на плане",
	});
	await expect(place).toBeEnabled({ timeout: 30_000 });
	if (autoConfirmPlacement) {
		// Most pre-existing scenarios are about the command after placement, not
		// the confirmation affordance itself. Arm this observer *before* opening
		// the preview: a fast catalog path can synchronously mount the confirm
		// control, which otherwise leaves this helper waiting for an event that
		// already happened. The dedicated preview scenario below exercises the
		// real ✓/× interaction.
		await page.evaluate(() => {
			const observer = new MutationObserver(() => {
				const confirm = document.querySelector<SVGGElement>(
					'[data-testid="item-placement-confirm"]',
				);
				if (!confirm || confirm.getAttribute("aria-disabled") === "true")
					return;
				observer.disconnect();
				confirm.dispatchEvent(new MouseEvent("click", { bubbles: true }));
			});
			observer.observe(document.body, {
				childList: true,
				subtree: true,
				attributes: true,
				attributeFilter: ["aria-disabled"],
			});
		});
	}
	await place.click();
	await expect(catalog).toHaveCount(0, { timeout: 30_000 });
}

/** Legacy command scenarios retain their helper name while exercising a real
 * bundled resource instead of a procedural placeholder. */
async function chooseBuiltInGreybox(
	page: Page,
	label = "Стол",
	autoConfirmPlacement = true,
) {
	return choosePreloadedCatalogAsset(
		page,
		label === "Стол" ? "Деревянный комод" : label,
		autoConfirmPlacement,
	);
}

async function chooseFloorPlaceholder(page: Page, label: string) {
	await chooseEditorOption(page, "Предметы интерьера");
	const catalog = page.getByRole("dialog", { name: "Предметы интерьера" });
	await catalog.getByTestId("catalog-authoring").locator("summary").click();
	await catalog
		.getByRole("button", { name: "Создать макетный предмет" })
		.click();
	const composer = catalog.getByRole("form", {
		name: "Создать макетный предмет",
	});
	await composer.getByLabel("Название макетного предмета").fill(label);
	await composer.getByLabel("Ширина макетного предмета, мм").fill("800");
	await composer.getByLabel("Глубина макетного предмета, мм").fill("422");
	await composer.getByLabel("Высота макетного предмета, мм").fill("868");
	await composer.getByRole("button", { name: "Начать размещение" }).click();
	await expect(catalog).toHaveCount(0);
}

async function expandSelectedItemInspector(page: Page) {
	const inspector = page.getByTestId("selected-item-inspector");
	if (await inspector.isVisible()) {
		if ((await inspector.getAttribute("data-inspector-expanded")) === "true") {
			return;
		}
		const toggle = page.getByRole("button", {
			name: "Развернуть панель предмета",
		});
		await expect(toggle).toBeVisible();
		await toggle.click();
		return;
	}
	const action = page.getByRole("button", {
		name: "Параметры выбранного предмета",
	});
	if (!(await action.isVisible())) {
		await page
			.getByRole("button", { name: "Открыть остальные действия" })
			.click();
	}
	await expect(action).toBeVisible();
	await action.click();
	await expect(inspector).toBeVisible();
}

async function triggerEditorHistoryAction(page: Page, action: "undo" | "redo") {
	const historyAction = page.getByRole("button", {
		name: action === "undo" ? /^Отменить действие/ : /^Повторить действие/,
	});
	await expect(historyAction).toBeVisible();
	await expect(historyAction).toBeEnabled();
	await historyAction.click();
}

async function expandSelectedWallInspector(page: Page) {
	const inspector = page.getByTestId("selected-wall-inspector");
	if (!(await inspector.isVisible())) {
		await page
			.getByTestId("editor-action-dock")
			.getByRole("button", { name: "Свойства", exact: true })
			.click();
	}
	await expect(inspector).toBeVisible();
	await expect(
		inspector.getByRole("button", {
			name: "Закрыть свойства стены",
			exact: true,
		}),
	).toBeVisible();
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

async function durableResourceManifests(page: Page): Promise<{
	readonly currentRevisionId: string;
	readonly revisions: Readonly<
		{
			readonly resourceHashes: readonly string[];
			readonly revisionId: string;
		}[]
	>;
}> {
	return page.evaluate(
		() =>
			new Promise((resolve, reject) => {
				const request = window.indexedDB.open("interiors-editor-projects");
				request.onerror = () => reject(request.error);
				request.onsuccess = () => {
					const database = request.result;
					const transaction = database.transaction(
						["projects", "revisions"],
						"readonly",
					);
					const projects = transaction.objectStore("projects").getAll();
					const revisions = transaction.objectStore("revisions").getAll();
					transaction.oncomplete = () => {
						const currentRevisionId = (
							projects.result[0] as
								| { readonly currentRevisionId?: string }
								| undefined
						)?.currentRevisionId;
						if (!currentRevisionId) {
							database.close();
							reject(new Error("Expected a current Project revision"));
							return;
						}
						const manifests = (
							revisions.result as readonly {
								readonly candidate?: {
									readonly revision?: {
										readonly revisionId?: string;
										readonly serializedProject?: string;
									};
								};
							}[]
						).flatMap((record) => {
							const revision = record.candidate?.revision;
							if (!revision?.revisionId || !revision.serializedProject)
								return [];
							const project = JSON.parse(revision.serializedProject) as {
								readonly assetDefinitionRefs?: readonly {
									readonly resourceHash?: string;
								}[];
							};
							return [
								{
									resourceHashes: (project.assetDefinitionRefs ?? [])
										.map((definition) => definition.resourceHash)
										.filter(
											(resourceHash): resourceHash is string =>
												typeof resourceHash === "string",
										),
									revisionId: revision.revisionId,
								},
							];
						});
						database.close();
						resolve({ currentRevisionId, revisions: manifests });
					};
					transaction.onerror = () => {
						database.close();
						reject(transaction.error);
					};
				};
			}),
	);
}

async function durableWallItems(page: Page): Promise<
	Readonly<{
		readonly anchorClass: "wall";
		readonly assetInstanceId: string;
		readonly color: string;
		readonly colorVariantId?: string;
		readonly locked?: true;
		readonly offsetMm: number;
		readonly side: "left" | "right";
		readonly wallSegmentId: string;
		readonly widthMm: number;
	}>[]
> {
	return page.evaluate(
		() =>
			new Promise((resolve, reject) => {
				const request = window.indexedDB.open("interiors-editor-projects");
				request.onerror = () => reject(request.error);
				request.onsuccess = () => {
					const database = request.result;
					const transaction = database.transaction(
						["projects", "revisions"],
						"readonly",
					);
					const projects = transaction.objectStore("projects").getAll();
					projects.onsuccess = () => {
						const pointer = projects.result[0] as
							| { readonly currentRevisionId?: string }
							| undefined;
						if (!pointer?.currentRevisionId) {
							reject(new Error("Expected a current Project revision"));
							return;
						}
						const revision = transaction
							.objectStore("revisions")
							.get(pointer.currentRevisionId);
						revision.onsuccess = () => {
							const serializedProject = revision.result?.candidate?.revision
								?.serializedProject as string | undefined;
							if (!serializedProject) {
								reject(new Error("Expected a serialized Project revision"));
								return;
							}
							const project = JSON.parse(serializedProject) as {
								readonly assetInstances: readonly {
									readonly anchorClass: string;
									readonly assetInstanceId: string;
									readonly color: string;
									readonly colorVariantId?: string;
									readonly locked?: true;
									readonly offsetMm: number;
									readonly side: "left" | "right";
									readonly wallSegmentId: string;
									readonly widthMm: number;
								}[];
							};
							resolve(
								project.assetInstances.filter(
									(
										item,
									): item is (typeof project.assetInstances)[number] & {
										readonly anchorClass: "wall";
									} => item.anchorClass === "wall",
								),
							);
						};
					};
					transaction.oncomplete = () => database.close();
					transaction.onerror = () => reject(transaction.error);
				};
			}),
	);
}

async function durableFloorItems(page: Page): Promise<
	Readonly<{
		readonly assetDefinitionId?: string;
		readonly anchorClass: "floor";
		readonly assetInstanceId: string;
		readonly color?: string;
		readonly colorVariantId?: string;
		readonly locked?: true;
		readonly roomId: string;
	}>[]
> {
	return page.evaluate(
		() =>
			new Promise((resolve, reject) => {
				const request = window.indexedDB.open("interiors-editor-projects");
				request.onerror = () => reject(request.error);
				request.onsuccess = () => {
					const database = request.result;
					const transaction = database.transaction(
						["projects", "revisions"],
						"readonly",
					);
					const projects = transaction.objectStore("projects").getAll();
					projects.onsuccess = () => {
						const pointer = projects.result[0] as
							| { readonly currentRevisionId?: string }
							| undefined;
						if (!pointer?.currentRevisionId) {
							reject(new Error("Expected a current Project revision"));
							return;
						}
						const revision = transaction
							.objectStore("revisions")
							.get(pointer.currentRevisionId);
						revision.onsuccess = () => {
							const serializedProject = revision.result?.candidate?.revision
								?.serializedProject as string | undefined;
							if (!serializedProject) {
								reject(new Error("Expected a serialized Project revision"));
								return;
							}
							const project = JSON.parse(serializedProject) as {
								readonly assetInstances: readonly {
									readonly assetDefinitionId?: string;
									readonly anchorClass: string;
									readonly assetInstanceId: string;
									readonly color: string;
									readonly locked?: true;
									readonly roomId: string;
								}[];
							};
							resolve(
								project.assetInstances.filter(
									(
										item,
									): item is (typeof project.assetInstances)[number] & {
										readonly anchorClass: "floor";
									} => item.anchorClass === "floor",
								),
							);
						};
					};
					transaction.oncomplete = () => database.close();
					transaction.onerror = () => reject(transaction.error);
				};
			}),
	);
}

async function durablePlanVertices(page: Page): Promise<
	readonly {
		readonly vertexId: string;
		readonly xMm: number;
		readonly zMm: number;
	}[]
> {
	return page.evaluate(
		() =>
			new Promise((resolve, reject) => {
				const request = window.indexedDB.open("interiors-editor-projects");
				request.onerror = () => reject(request.error);
				request.onsuccess = () => {
					const database = request.result;
					const transaction = database.transaction(
						["projects", "revisions"],
						"readonly",
					);
					const projects = transaction.objectStore("projects").getAll();
					projects.onsuccess = () => {
						const pointer = projects.result[0] as
							| { readonly currentRevisionId?: string }
							| undefined;
						if (!pointer?.currentRevisionId) {
							reject(new Error("Expected a current Project revision"));
							return;
						}
						const revision = transaction
							.objectStore("revisions")
							.get(pointer.currentRevisionId);
						revision.onsuccess = () => {
							const serializedProject = revision.result?.candidate?.revision
								?.serializedProject as string | undefined;
							if (!serializedProject) {
								reject(new Error("Expected a serialized Project revision"));
								return;
							}
							const project = JSON.parse(serializedProject) as {
								readonly level: {
									readonly vertices: readonly {
										readonly vertexId: string;
										readonly xMm: number;
										readonly zMm: number;
									}[];
								};
							};
							resolve(project.level.vertices);
						};
					};
					transaction.oncomplete = () => database.close();
					transaction.onerror = () => reject(transaction.error);
				};
			}),
	);
}

async function durableWallSegment(
	page: Page,
	wallSegmentId: string,
): Promise<
	| {
			readonly endVertexId: string;
			readonly startVertexId: string;
			readonly thicknessMm: number;
			readonly wallSegmentId: string;
	  }
	| undefined
> {
	return page.evaluate((selectedWallSegmentId) => {
		return new Promise((resolve, reject) => {
			const request = window.indexedDB.open("interiors-editor-projects");
			request.onerror = () => reject(request.error);
			request.onsuccess = () => {
				const database = request.result;
				const transaction = database.transaction(
					["projects", "revisions"],
					"readonly",
				);
				const projects = transaction.objectStore("projects").getAll();
				projects.onsuccess = () => {
					const pointer = projects.result[0] as
						| { readonly currentRevisionId?: string }
						| undefined;
					if (!pointer?.currentRevisionId) {
						reject(new Error("Expected a current Project revision"));
						return;
					}
					const revision = transaction
						.objectStore("revisions")
						.get(pointer.currentRevisionId);
					revision.onsuccess = () => {
						const serializedProject = revision.result?.candidate?.revision
							?.serializedProject as string | undefined;
						if (!serializedProject) {
							reject(new Error("Expected a serialized Project revision"));
							return;
						}
						const project = JSON.parse(serializedProject) as {
							readonly level: {
								readonly wallSegments: readonly {
									readonly endVertexId: string;
									readonly startVertexId: string;
									readonly thicknessMm: number;
									readonly wallSegmentId: string;
								}[];
							};
						};
						resolve(
							project.level.wallSegments.find(
								(wall) => wall.wallSegmentId === selectedWallSegmentId,
							),
						);
					};
				};
				transaction.oncomplete = () => database.close();
				transaction.onerror = () => reject(transaction.error);
			};
		});
	}, wallSegmentId);
}

async function durableWindowOpenings(page: Page): Promise<
	readonly {
		readonly heightMm: number;
		readonly offsetMm: number;
		readonly sillMm: number;
		readonly widthMm: number;
	}[]
> {
	return page.evaluate(
		() =>
			new Promise((resolve, reject) => {
				const request = window.indexedDB.open("interiors-editor-projects");
				request.onerror = () => reject(request.error);
				request.onsuccess = () => {
					const database = request.result;
					const transaction = database.transaction(
						["projects", "revisions"],
						"readonly",
					);
					const projects = transaction.objectStore("projects").getAll();
					projects.onsuccess = () => {
						const pointer = projects.result[0] as
							| { readonly currentRevisionId?: string }
							| undefined;
						if (!pointer?.currentRevisionId) {
							reject(new Error("Expected a current Project revision"));
							return;
						}
						const revision = transaction
							.objectStore("revisions")
							.get(pointer.currentRevisionId);
						revision.onsuccess = () => {
							const serializedProject = revision.result?.candidate?.revision
								?.serializedProject as string | undefined;
							if (!serializedProject) {
								reject(new Error("Expected a serialized Project revision"));
								return;
							}
							const project = JSON.parse(serializedProject) as {
								readonly level: {
									readonly openings: readonly {
										readonly heightMm: number;
										readonly kind: string;
										readonly offsetMm: number;
										readonly sillMm: number;
										readonly widthMm: number;
									}[];
								};
							};
							resolve(
								project.level.openings
									.filter((opening) => opening.kind === "Window")
									.map(({ heightMm, offsetMm, sillMm, widthMm }) => ({
										heightMm,
										offsetMm,
										sillMm,
										widthMm,
									})),
							);
						};
					};
					transaction.oncomplete = () => database.close();
					transaction.onerror = () => reject(transaction.error);
				};
			}),
	);
}

async function durableDoorOpenings(page: Page): Promise<
	readonly {
		readonly heightMm: number;
		readonly offsetMm: number;
		readonly sillMm: number;
		readonly swingSide: "left" | "right" | undefined;
		readonly wallSegmentId: string;
		readonly widthMm: number;
	}[]
> {
	return page.evaluate(
		() =>
			new Promise((resolve, reject) => {
				const request = window.indexedDB.open("interiors-editor-projects");
				request.onerror = () => reject(request.error);
				request.onsuccess = () => {
					const database = request.result;
					const transaction = database.transaction(
						["projects", "revisions"],
						"readonly",
					);
					const projects = transaction.objectStore("projects").getAll();
					projects.onsuccess = () => {
						const pointer = projects.result[0] as
							| { readonly currentRevisionId?: string }
							| undefined;
						if (!pointer?.currentRevisionId) {
							reject(new Error("Expected a current Project revision"));
							return;
						}
						const revision = transaction
							.objectStore("revisions")
							.get(pointer.currentRevisionId);
						revision.onsuccess = () => {
							const serializedProject = revision.result?.candidate?.revision
								?.serializedProject as string | undefined;
							if (!serializedProject) {
								reject(new Error("Expected a serialized Project revision"));
								return;
							}
							const project = JSON.parse(serializedProject) as {
								readonly level: {
									readonly openings: readonly {
										readonly heightMm: number;
										readonly kind: string;
										readonly offsetMm: number;
										readonly sillMm: number;
										readonly swingSide?: "left" | "right";
										readonly wallSegmentId: string;
										readonly widthMm: number;
									}[];
								};
							};
							resolve(
								project.level.openings
									.filter((opening) => opening.kind === "Door")
									.map(
										({
											heightMm,
											offsetMm,
											sillMm,
											swingSide,
											wallSegmentId,
											widthMm,
										}) => ({
											heightMm,
											offsetMm,
											sillMm,
											swingSide,
											wallSegmentId,
											widthMm,
										}),
									),
							);
						};
					};
					transaction.oncomplete = () => database.close();
					transaction.onerror = () => reject(transaction.error);
				};
			}),
	);
}

type OpeningCreationInput = {
	readonly heightMm: number;
	readonly kind: "Door" | "Window";
	readonly offsetMm: number;
	readonly sillMm: number;
	readonly widthMm: number;
};

async function clickWallOutsideOpeningHandle(wall: Locator): Promise<void> {
	const point = await wall.evaluate((element) => {
		const wallId = element.getAttribute("data-wall-id");
		const line = document.querySelector<SVGLineElement>(
			`[data-testid="wall-line"][data-wall-id="${wallId}"]`,
		);
		if (!line) throw new Error("Expected the exact rendered wall centerline");
		const matrix = line.getScreenCTM();
		if (!matrix) throw new Error("Expected a visible wall transform");
		const box = element.getBoundingClientRect();
		for (const fraction of [0.2, 0.8, 0.35, 0.65, 0.1, 0.9, 0.5]) {
			const point = new DOMPoint(
				line.x1.baseVal.value +
					(line.x2.baseVal.value - line.x1.baseVal.value) * fraction,
				line.y1.baseVal.value +
					(line.y2.baseVal.value - line.y1.baseVal.value) * fraction,
			).matrixTransform(matrix);
			if (document.elementFromPoint(point.x, point.y) !== element) continue;
			return { x: point.x - box.x, y: point.y - box.y };
		}
		throw new Error(
			"No wall hit target is exposed outside Opening handles and panels",
		);
	});
	await wall.click({ position: point });
}

async function selectedFixtureWallId(page: Page): Promise<string> {
	const id = await page
		.getByTestId("wall-line")
		.evaluateAll((lines) =>
			lines
				.find((line) => getComputedStyle(line).stroke === "rgb(37, 99, 235)")
				?.getAttribute("data-wall-id"),
		);
	if (!id)
		throw new Error(
			"Select an explicit wall before installing a legacy fixture",
		);
	return id;
}

/**
 * Imports an already-authored legacy revision into this test's isolated profile.
 * The production command under test starts only after reopening this fixture;
 * no removed authoring control is simulated or restored.
 */
async function loadLegacyProjectFixture(
	page: Page,
	transform: (source: Project) => Project,
	wallId: string,
): Promise<void> {
	const source = await page.evaluate(async () => {
		const database = await new Promise<IDBDatabase>((resolve, reject) => {
			const request = indexedDB.open("interiors-editor-projects");
			request.onsuccess = () => resolve(request.result);
			request.onerror = () => reject(request.error);
		});
		try {
			return await new Promise<Project>((resolve, reject) => {
				const transaction = database.transaction(
					["projects", "revisions"],
					"readonly",
				);
				const pointers = transaction.objectStore("projects").getAll();
				pointers.onsuccess = () => {
					if (pointers.result.length !== 1) {
						reject(new Error("A fixture requires one isolated Project"));
						return;
					}
					const revision = transaction
						.objectStore("revisions")
						.get(pointers.result[0].currentRevisionId);
					revision.onsuccess = () => resolve(revision.result.candidate.project);
					revision.onerror = () => reject(revision.error);
				};
				pointers.onerror = () => reject(pointers.error);
			});
		} finally {
			database.close();
		}
	});
	const project = transform(source);
	if (!isStructurallyValidProjectV1(project))
		throw new Error("Legacy fixture failed the real Project schema");
	const serializedProject = canonicalProjectSerializer.serialize(project);
	const digest = await globalThis.crypto.subtle.digest(
		"SHA-256",
		new TextEncoder().encode(serializedProject),
	);
	const checksum = [...new Uint8Array(digest)]
		.map((byte) => byte.toString(16).padStart(2, "0"))
		.join("");
	const candidate: PublicationCandidate = {
		project,
		revision: {
			checksum,
			createdAt: project.updatedAt,
			projectId: project.projectId,
			revisionId: `legacy-fixture-${globalThis.crypto.randomUUID()}`,
			schemaVersion: 1,
			serializedProject,
		},
	};
	await page.evaluate(async (candidate) => {
		const database = await new Promise<IDBDatabase>((resolve, reject) => {
			const request = indexedDB.open("interiors-editor-projects");
			request.onsuccess = () => resolve(request.result);
			request.onerror = () => reject(request.error);
		});
		try {
			await new Promise<void>((resolve, reject) => {
				const transaction = database.transaction(
					["projects", "revisions"],
					"readwrite",
				);
				transaction
					.objectStore("revisions")
					.put({ revisionId: candidate.revision.revisionId, candidate });
				transaction.objectStore("projects").put({
					currentRevisionId: candidate.revision.revisionId,
					projectId: candidate.project.projectId,
					name: candidate.project.name,
				});
				transaction.oncomplete = () => resolve();
				transaction.onerror = () => reject(transaction.error);
				transaction.onabort = () => reject(transaction.error);
			});
		} finally {
			database.close();
		}
	}, candidate);
	await page.reload();
	await openProjectFromHub(page, project.name);
	await chooseEditorOption(page, "Рука и выбор");
	await clickWallOutsideOpeningHandle(
		page.locator(`[data-testid="wall-segment"][data-wall-id="${wallId}"]`),
	);
	await expandSelectedWallInspector(page);
}

/** Opens a valid pre-release split wall; splitting is deliberately not a UI action. */
async function loadLegacySplitWallFixture(
	page: Page,
	fraction = 0.5,
): Promise<void> {
	const wallId = await selectedFixtureWallId(page);
	await expect(
		page.getByRole("button", { name: "Разделить стену жестом" }),
	).toHaveCount(0);
	await loadLegacyProjectFixture(
		page,
		(source) => {
			const wall = source.level.wallSegments.find(
				(entry) => entry.wallSegmentId === wallId,
			);
			const start = source.level.vertices.find(
				(entry) => entry.vertexId === wall?.startVertexId,
			);
			const end = source.level.vertices.find(
				(entry) => entry.vertexId === wall?.endVertexId,
			);
			if (!start || !end) throw new Error("Legacy split host is missing");
			const result = splitGeneralWall(
				source,
				{
					wallSegmentId: wallId,
					pointMm: {
						xMm: Math.round(start.xMm + (end.xMm - start.xMm) * fraction),
						zMm: Math.round(start.zMm + (end.zMm - start.zMm) * fraction),
					},
				},
				{ next: () => `legacy-split-${globalThis.crypto.randomUUID()}` },
				new Date().toISOString(),
			);
			if (result.kind !== "accepted")
				throw new Error(`Legacy split rejected: ${result.reasonCode}`);
			return result.project;
		},
		wallId,
	);
}

async function loadLegacyWallPanelFixture(
	page: Page,
	overrides: Partial<ParametricWallItemInput> = {},
): Promise<void> {
	const wallId = overrides.wallSegmentId ?? (await selectedFixtureWallId(page));
	await loadLegacyProjectFixture(
		page,
		(source) => {
			const host = wallOpeningHostsForProject(source)?.find(
				(host) => host.wallSegmentId === wallId,
			);
			if (!host) throw new Error("Legacy panel needs a verified wall host");
			const result = createParametricWallItem(
				source,
				{
					color: "#416b91",
					depthMm: 50,
					elevationMm: Math.round(host.heightMm / 2),
					heightMm: Math.min(600, host.heightMm),
					label: "Настенная панель",
					offsetMm: Math.round(host.usableLengthMm / 2),
					side: "left",
					wallSegmentId: wallId,
					widthMm: Math.min(900, host.usableLengthMm),
					...overrides,
				},
				{ next: () => globalThis.crypto.randomUUID() },
				new Date().toISOString(),
			);
			if (result.kind !== "accepted")
				throw new Error(`Legacy panel fixture rejected: ${result.reasonCode}`);
			return result.project;
		},
		wallId,
	);
}

/** Exact old positions are fixture data; new Opening creation is tested below
 * through its real automatic-placement form and in the touch regression suite. */
async function loadOpeningFixtureOnSelectedWall(
	page: Page,
	input: OpeningCreationInput,
	screenshotPath?: string,
) {
	const wallId = await selectedFixtureWallId(page);
	await loadLegacyProjectFixture(
		page,
		(source) => {
			const { kind, ...dimensions } = input;
			const result = (
				kind === "Door" ? addDoorOpeningToProject : addWindowOpeningToProject
			)(
				source,
				{ ...dimensions, wallSegmentId: wallId },
				{ next: () => globalThis.crypto.randomUUID() },
				new Date().toISOString(),
			);
			if (result.kind !== "accepted")
				throw new Error(
					`Legacy Opening fixture rejected: ${result.reasonCode}`,
				);
			return result.project;
		},
		wallId,
	);
	if (screenshotPath)
		await page.screenshot({ path: screenshotPath, scale: "css" });
}

async function renderedWallItemCenterMm(
	page: Page,
): Promise<{ xMm: number; zMm: number }> {
	const [item] = await durableWallItems(page);
	if (!item) throw new Error("Expected one durable wall item");
	const wall = await durableWallSegment(page, item.wallSegmentId);
	if (!wall) throw new Error("Expected the durable wall host");
	const vertices = await durablePlanVertices(page);
	const start = vertices.find(
		(vertex) => vertex.vertexId === wall.startVertexId,
	);
	const end = vertices.find((vertex) => vertex.vertexId === wall.endVertexId);
	if (!start || !end) throw new Error("Expected resolved wall endpoints");
	return page.getByTestId("wall-schematic-item").evaluate(
		(element, { start, end, wallId }) => {
			const line = document.querySelector<SVGLineElement>(
				`[data-testid="wall-line"][data-wall-id="${wallId}"]`,
			);
			if (!line) throw new Error("Expected the exact rendered host");
			const box = (element as SVGGraphicsElement).getBBox();
			const scale =
				Math.hypot(
					line.x2.baseVal.value - line.x1.baseVal.value,
					line.y2.baseVal.value - line.y1.baseVal.value,
				) / Math.hypot(end.xMm - start.xMm, end.zMm - start.zMm);
			return {
				xMm:
					start.xMm + (box.x + box.width / 2 - line.x1.baseVal.value) / scale,
				zMm:
					start.zMm + (box.y + box.height / 2 - line.y1.baseVal.value) / scale,
			};
		},
		{ start, end, wallId: item.wallSegmentId },
	);
}

async function exteriorWallBounds(page: Page): Promise<RenderedBox[]> {
	return page.locator('[data-wall-kind="exterior"]').evaluateAll((elements) =>
		elements.map((element) => {
			const box = element.getBoundingClientRect();
			return {
				height: box.height,
				left: box.left,
				top: box.top,
				width: box.width,
			};
		}),
	);
}

test("EDITOR-E2E-00: development clears an installed worker and its caches without changing durable Projects", async ({
	page: _page,
}, testInfo) => {
	const session = await openPersistentPhone(
		testInfo,
		"editor-development-worker-cleanup",
		{ installCatalogFake: false, serviceWorkers: "allow" },
	);
	try {
		await session.page.goto("/");
		await startNewProject(session.page, "Проект после очистки dev-кеша");
		await session.page.getByRole("button", { name: "Создать контур" }).click();
		await expect(session.page.getByTestId("room-face")).toHaveCount(1);
		await expect(
			session.page.getByTestId("editor-top-bar").getByRole("status"),
		).toHaveText("Сохранено");
		const readDurableState = () =>
			session.page.evaluate(async () => {
				const database = await new Promise<IDBDatabase>((resolve, reject) => {
					const request = indexedDB.open("interiors-editor-projects");
					request.onsuccess = () => resolve(request.result);
					request.onerror = () => reject(request.error);
				});
				try {
					return await new Promise<{
						pointers: readonly unknown[];
						revisions: readonly unknown[];
					}>((resolve, reject) => {
						const transaction = database.transaction(
							["projects", "revisions"],
							"readonly",
						);
						const pointers = transaction.objectStore("projects").getAll();
						const revisions = transaction.objectStore("revisions").getAll();
						transaction.oncomplete = () =>
							resolve({
								pointers: pointers.result,
								revisions: revisions.result,
							});
						transaction.onerror = () => reject(transaction.error);
						transaction.onabort = () => reject(transaction.error);
					});
				} finally {
					database.close();
				}
			});
		const before = await readDurableState();
		expect(before.pointers).toHaveLength(1);
		expect(before.revisions).toHaveLength(2);
		const seededCacheNames = [
			"interiors-editor-shell-dev-cleanup-e2e",
			"interiors-editor-browse-dev-cleanup-e2e",
		];
		const installed = await session.page.evaluate(async (cacheNames) => {
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
			for (const name of cacheNames) {
				const cache = await caches.open(name);
				await cache.put("/dev-cleanup-proof", new Response(`cached:${name}`));
			}
			return {
				active: Boolean(registration.active),
				cacheNames: await caches.keys(),
			};
		}, seededCacheNames);
		expect(installed.active).toBe(true);
		for (const name of seededCacheNames)
			expect(installed.cacheNames).toContain(name);
		await session.page.reload();
		await expect(session.page.getByTestId("project-hub")).toBeVisible();
		await expect
			.poll(() =>
				session.page.evaluate(async () => ({
					registrations: (await navigator.serviceWorker.getRegistrations())
						.length,
					cacheNames: await caches.keys(),
				})),
			)
			.toEqual({ registrations: 0, cacheNames: [] });
		expect(await readDurableState()).toEqual(before);
		await openProjectFromHub(session.page, "Проект после очистки dev-кеша");
		await expect(session.page.getByTestId("room-face")).toHaveCount(1);
		expect(await readDurableState()).toEqual(before);
	} finally {
		await session.context.close();
	}
});

test("REFERENCE-DIAGONAL-E2E-02: a tall diagonal apartment keeps its compact 3D cutaway after reload on a phone", async ({
	page: _page,
}, testInfo) => {
	test.setTimeout(180_000);
	const session = await openPersistentPhone(testInfo, "reference-diagonal", {
		freshProfile: true,
	});
	await session.page.setViewportSize({ height: 852, width: 393 });
	await session.page.goto("/");
	await startNewProject(session.page, "Эталонная диагональная квартира");
	await session.page.getByLabel("Ширина, мм").fill("5000");
	await session.page.getByLabel("Глубина, мм").fill("7000");
	await session.page.getByLabel("Высота, мм").fill("2600");
	await session.page.getByRole("button", { name: "Создать контур" }).click();

	await chooseEditorOption(session.page, "Стена");
	const starterCorners = (
		await Promise.all(
			Array.from({ length: 4 }, (_, index) =>
				wallClientEndpoints(session.page, index),
			),
		)
	).flatMap(({ end, start }) => [start, end]);
	const topLeft = starterCorners.reduce((corner, candidate) =>
		candidate.x + candidate.y < corner.x + corner.y ? candidate : corner,
	);
	const topRight = starterCorners.reduce((corner, candidate) =>
		candidate.x - candidate.y > corner.x - corner.y ? candidate : corner,
	);
	const bottomLeft = starterCorners.reduce((corner, candidate) =>
		candidate.x - candidate.y < corner.x - corner.y ? candidate : corner,
	);
	const widthPx = Math.abs(topRight.x - topLeft.x);
	if (widthPx < 40) {
		throw new Error("Expected a visible tall starter contour");
	}
	const diagonalHalfway = {
		x: topLeft.x + widthPx / 2,
		y: topLeft.y + widthPx / 2,
	};
	await drawCreationWallByTouch(session.page, topLeft, {
		x: topRight.x,
		y: topLeft.y + widthPx,
	});
	await expect(session.page.getByTestId("room-count")).toHaveText("2 комнаты");

	// Split the lower diagonal polygon along a cardinal wall. Its start is on
	// the 45-degree divider and its end joins the exterior floor edge, which
	// creates three genuinely different room-face shapes in one phone flow.
	await chooseEditorOption(session.page, "Стена");
	await drawCreationWallByTouch(session.page, diagonalHalfway, {
		x: diagonalHalfway.x,
		y: bottomLeft.y,
	});
	await expect(session.page.getByTestId("room-count")).toHaveText("3 комнаты");
	await expect(session.page.getByTestId("wall-count")).toHaveText("9 стен");
	await chooseEditorOption(session.page, "Рука и выбор");

	const rooms = await roomFaceInteriorPoints(session.page);
	expect(rooms).toHaveLength(3);
	const itemPlacements = [
		{ label: "Винтажный стул Zen", room: rooms[0] },
		{ label: "Обеденное кресло", room: rooms[1] },
		{ label: "Деревянный комод", room: rooms[2] },
	] as const;
	if (itemPlacements.some(({ room }) => !room)) {
		throw new Error("Expected three interior points for the diagonal rooms");
	}
	for (const { label, room } of itemPlacements) {
		await choosePreloadedCatalogAsset(session.page, label, false);
		await session.page.mouse.click(room.x, room.y);
		await expect(
			session.page.getByTestId("item-placement-preview"),
		).toHaveAttribute("data-placement-valid", "true");
		await session.page
			.getByRole("button", { name: "Подтвердить размещение предмета" })
			.click();
	}
	await expect(session.page.getByTestId("item-count")).toHaveText("3 предмета");
	const placementStatus = session.page.getByTestId(
		"item-placement-durable-status",
	);
	await expect(placementStatus).toHaveText("Предмет размещён и сохранён.");
	await expect(placementStatus).toBeHidden({ timeout: 5_000 });
	await chooseEditorOption(session.page, "Рука и выбор");

	const furnishedItems = await durableFloorItems(session.page);
	const furnishedRooms = await durableRooms(session.page);
	expect(furnishedRooms).toHaveLength(3);
	expect(furnishedItems).toHaveLength(3);
	expect(
		new Set(furnishedItems.map((item) => item.assetDefinitionId)).size,
	).toBe(3);
	expect(new Set(furnishedItems.map((item) => item.roomId)).size).toBe(3);

	const planScreenshot = testInfo.outputPath("reference-diagonal-plan.png");
	await session.page.screenshot({ path: planScreenshot });
	await testInfo.attach("reference-diagonal-plan", {
		contentType: "image/png",
		path: planScreenshot,
	});

	const revisionsBeforeViewChange = await durableRevisionCount(session.page);
	await chooseEditorOption(session.page, "3D");
	const threeDimensionalCanvas = session.page.getByTestId(
		"three-dimensional-canvas",
	);
	await expect(threeDimensionalCanvas).toBeVisible({ timeout: 15_000 });
	await expect(
		session.page.getByTestId("three-dimensional-custom-glb-status"),
	).toHaveText("rendered:3");
	await expect(
		session.page.getByTestId("three-dimensional-cutaway"),
	).toHaveText("Авто: ближние внешние стены скрываются");
	await expect(
		session.page.getByTestId("three-dimensional-cutaway-notice"),
	).toHaveCount(0);
	await expect(
		session.page.getByText("3 предмета в плане", { exact: true }),
	).toHaveText("3 предмета в плане");
	await expect(
		session.page.getByText("3 предмета в плане", { exact: true }),
	).toBeHidden();
	await expect(
		session.page.getByTestId("three-dimensional-camera"),
	).toContainText("1.571:1.150:");
	const [canvasBox, deckBox, headerBox] = await Promise.all([
		threeDimensionalCanvas.boundingBox(),
		session.page.getByTestId("three-dimensional-camera-deck").boundingBox(),
		session.page.getByTestId("editor-top-bar").boundingBox(),
	]);
	if (!canvasBox || !deckBox || !headerBox) {
		throw new Error(
			"Expected the phone 3D viewport and its chrome to be laid out",
		);
	}
	// The camera must use the actual calm scene window, not the pixels hidden
	// by the persistent header and thumb deck. This keeps a tall shell framed
	// as the primary visual layer on a phone without changing Project data.
	expect(canvasBox.y).toBeGreaterThanOrEqual(
		headerBox.y + headerBox.height - 1,
	);
	expect(canvasBox.y + canvasBox.height).toBeLessThanOrEqual(deckBox.y + 1);
	const [, , initialDistanceText] = (
		(await session.page
			.getByTestId("three-dimensional-camera")
			.textContent()) ?? ""
	).split(":");
	expect(Number(initialDistanceText)).toBeLessThanOrEqual(1.65);
	expect(await durableRevisionCount(session.page)).toBe(
		revisionsBeforeViewChange,
	);

	const autoPixels = await threeDimensionalCanvas.screenshot();
	const autoScreenshot = testInfo.outputPath("reference-diagonal-3d-auto.png");
	await session.page.screenshot({ path: autoScreenshot });
	await testInfo.attach("reference-diagonal-3d-auto", {
		contentType: "image/png",
		path: autoScreenshot,
	});

	const showAllWalls = session.page.getByRole("button", {
		name: "Показать все стены",
	});
	await showAllWalls.click();
	await expect(showAllWalls).toHaveAttribute("aria-pressed", "true");
	await expect(
		session.page.getByTestId("three-dimensional-cutaway-notice"),
	).toHaveCount(0);
	await expect(
		session.page.getByTestId("three-dimensional-cutaway"),
	).toHaveText("Все стены показаны");
	expect((await threeDimensionalCanvas.screenshot()).equals(autoPixels)).toBe(
		false,
	);
	const allWallsScreenshot = testInfo.outputPath(
		"reference-diagonal-3d-all-walls.png",
	);
	await session.page.screenshot({ path: allWallsScreenshot });
	await testInfo.attach("reference-diagonal-3d-all-walls", {
		contentType: "image/png",
		path: allWallsScreenshot,
	});

	const autoCutaway = session.page.getByRole("button", {
		name: "Авто cutaway",
	});
	await autoCutaway.click();
	await expect(autoCutaway).toHaveAttribute("aria-pressed", "true");
	await expect(
		session.page.getByTestId("three-dimensional-cutaway-notice"),
	).toHaveCount(0);

	await chooseEditorOption(session.page, "План 2D");
	await chooseEditorOption(session.page, "Рука и выбор");
	const schematicItems = session.page.getByTestId("schematic-item");
	await expect(schematicItems).toHaveCount(3);
	await schematicItems.nth(2).click();
	const planSelectionFrame = session.page.getByTestId(
		"two-dimensional-item-selection-frame",
	);
	await expect(planSelectionFrame).toBeVisible();
	await expect(
		planSelectionFrame.getByTestId("two-dimensional-item-selection-handle"),
	).toHaveCount(4);

	await chooseEditorOption(session.page, "3D");
	await expect(
		session.page.getByTestId("three-dimensional-custom-glb-status"),
	).toHaveText("rendered:3");
	const threeDimensionalSelectionFrame = session.page.getByTestId(
		"three-dimensional-item-selection-frame",
	);
	await expect(threeDimensionalSelectionFrame).toBeVisible();
	await expect(
		threeDimensionalSelectionFrame.getByTestId(
			"three-dimensional-item-selection-handle",
		),
	).toHaveCount(0);
	await expect(threeDimensionalSelectionFrame.locator("polygon")).toHaveCount(
		1,
	);
	await expect(
		session.page.getByTestId("three-dimensional-rotation-gizmo"),
	).toHaveAttribute("data-rotation-active", "false");
	expect(await durableRevisionCount(session.page)).toBe(
		revisionsBeforeViewChange,
	);

	const selectedScreenshot = testInfo.outputPath(
		"reference-diagonal-3d-selected.png",
	);
	await session.page.screenshot({ path: selectedScreenshot });
	await testInfo.attach("reference-diagonal-3d-selected", {
		contentType: "image/png",
		path: selectedScreenshot,
	});

	await session.page.reload();
	await openProjectFromHub(session.page, "Эталонная диагональная квартира");
	await expect(session.page.getByTestId("room-count")).toHaveText("3 комнаты");
	await expect(session.page.getByTestId("wall-count")).toHaveText("9 стен");
	await expect(session.page.getByTestId("item-count")).toHaveText("3 предмета");
	expect(await durableRevisionCount(session.page)).toBe(
		revisionsBeforeViewChange,
	);
	expect(await durableFloorItems(session.page)).toEqual(furnishedItems);

	await chooseEditorOption(session.page, "3D");
	await expect(threeDimensionalCanvas).toBeVisible({ timeout: 15_000 });
	await expect(
		session.page.getByTestId("three-dimensional-custom-glb-status"),
	).toHaveText("rendered:3");
	await expect(
		session.page.getByTestId("three-dimensional-cutaway"),
	).toHaveText("Авто: ближние внешние стены скрываются");
	await expect(
		session.page.getByTestId("three-dimensional-cutaway-notice"),
	).toHaveCount(0);
	await expect(
		session.page.getByTestId("three-dimensional-camera"),
	).toContainText("1.571:1.150:");
	await session.context.close();
});

test("EDITOR-E2E-00A: the development shell exposes its release manifest before editing", async ({
	page: _page,
}, testInfo) => {
	const session = await openPersistentPhone(
		testInfo,
		"editor-development-release-manifest",
		{ installCatalogFake: false },
	);
	const manifest = await session.page.request.get("/release-manifest.json");
	expect(manifest.ok()).toBe(true);
	expect(await manifest.json()).toMatchObject({
		assetSchemas: { readable: [1], writable: [1] },
		catalogSchemas: { readable: [1], writable: [1] },
		minimumCapabilities: ["indexeddb"],
		projectSchemas: { readable: [1], writable: [1] },
		version: 1,
		workerProtocolVersion: 1,
	});

	await session.page.goto("/");
	await expect(
		session.page.getByRole("heading", { name: "Проекты" }),
	).toBeVisible();
	await expect(
		session.page.getByRole("button", { name: "Новый проект" }),
	).toBeVisible();
	await session.context.close();
});

async function drawCentreDivider(page: Page) {
	await chooseEditorOption(page, "Стена");
	const exteriorBounds = await exteriorWallBounds(page);
	const horizontalBounds = exteriorBounds
		.filter((box) => box.width > box.height)
		.sort((first, second) => first.top - second.top);
	const topBox = horizontalBounds[0];
	const bottomBox = horizontalBounds.at(-1);
	if (!topBox || !bottomBox) {
		throw new Error(
			"Starter horizontal boundary wall hit targets did not render",
		);
	}
	const x = topBox.left + topBox.width / 2;
	await page.mouse.move(x, topBox.top + topBox.height / 2);
	await page.mouse.down();
	await page.mouse.move(x, bottomBox.top + bottomBox.height / 2, { steps: 8 });
	await page.mouse.up();
}

/** Completes the centre crossbar using the stable left/right exterior boundaries. */
async function drawCentreCrossbar(page: Page) {
	await chooseEditorOption(page, "Стена");
	const exteriorBounds = await exteriorWallBounds(page);
	const verticalBounds = exteriorBounds
		.filter((box) => box.height > box.width)
		.sort((first, second) => first.left - second.left);
	const leftBox = verticalBounds[0];
	const rightBox = verticalBounds.at(-1);
	if (!leftBox || !rightBox) {
		throw new Error(
			"Starter vertical boundary wall hit targets did not render",
		);
	}
	const y = leftBox.top + leftBox.height / 2;
	await page.mouse.move(leftBox.left + leftBox.width / 2, y);
	await page.mouse.down();
	await page.mouse.move(rightBox.left + rightBox.width / 2, y, { steps: 8 });
	await page.mouse.up();
}

async function planPointMm(
	page: Page,
	target: { xMm: number; zMm: number },
): Promise<{ x: number; y: number }> {
	const line = page.getByTestId("wall-line").first();
	const wallId = await line.getAttribute("data-wall-id");
	if (!wallId) throw new Error("Expected a canonical wall reference");
	const [vertices, wall] = await Promise.all([
		durablePlanVertices(page),
		durableWallSegment(page, wallId),
	]);
	if (!wall) throw new Error("Expected the durable wall reference");
	const start = vertices.find(
		(vertex) => vertex.vertexId === wall.startVertexId,
	);
	const end = vertices.find((vertex) => vertex.vertexId === wall.endVertexId);
	if (!start || !end) throw new Error("Expected canonical wall endpoints");
	return line.evaluate(
		(element, { start, end, target }) => {
			const line = element as SVGLineElement;
			const matrix = line.getScreenCTM();
			if (!matrix) throw new Error("Expected the live plan transform");
			const first = new DOMPoint(
				line.x1.baseVal.value,
				line.y1.baseVal.value,
			).matrixTransform(matrix);
			const second = new DOMPoint(
				line.x2.baseVal.value,
				line.y2.baseVal.value,
			).matrixTransform(matrix);
			const scale =
				Math.hypot(second.x - first.x, second.y - first.y) /
				Math.hypot(end.xMm - start.xMm, end.zMm - start.zMm);
			const point = {
				x: first.x + (target.xMm - start.xMm) * scale,
				y: first.y + (target.zMm - start.zMm) * scale,
			};
			const hit = document.elementFromPoint(point.x, point.y);
			if (!hit || !line.closest("svg")?.contains(hit))
				throw new Error(
					"The intended canonical plan point is obscured by editor controls",
				);
			return point;
		},
		{ start, end, target },
	);
}

async function clickPlanPointMm(
	page: Page,
	xMm: number,
	zMm: number,
): Promise<void> {
	const point = await planPointMm(page, { xMm, zMm });
	await page.mouse.click(point.x, point.y);
}

async function wallClientEndpoints(page: Page, wallIndex: number) {
	return page
		.getByTestId("wall-line")
		.nth(wallIndex)
		.evaluate((line) => {
			if (!(line instanceof SVGLineElement)) {
				throw new Error("Expected an SVG wall line");
			}
			const matrix = line.getScreenCTM();
			if (!matrix) {
				throw new Error("Wall line has no screen transform");
			}
			const pointFor = (x: string | null, y: string | null) => {
				const point = new DOMPoint(Number(x), Number(y)).matrixTransform(
					matrix,
				);
				return { x: point.x, y: point.y };
			};
			return {
				end: pointFor(line.getAttribute("x2"), line.getAttribute("y2")),
				start: pointFor(line.getAttribute("x1"), line.getAttribute("y1")),
			};
		});
}

async function durableRooms(page: Page): Promise<
	readonly {
		readonly faceFingerprint: string;
		readonly heightMm: number;
		readonly name?: string;
		readonly roomId: string;
	}[]
> {
	return page.evaluate(
		() =>
			new Promise((resolve, reject) => {
				const request = window.indexedDB.open("interiors-editor-projects");
				request.onerror = () => reject(request.error);
				request.onsuccess = () => {
					const database = request.result;
					const transaction = database.transaction(
						["projects", "revisions"],
						"readonly",
					);
					const projects = transaction.objectStore("projects").getAll();
					projects.onsuccess = () => {
						const pointer = projects.result[0] as
							| { readonly currentRevisionId?: string }
							| undefined;
						if (!pointer?.currentRevisionId) {
							reject(new Error("Expected a current Project revision"));
							return;
						}
						const revision = transaction
							.objectStore("revisions")
							.get(pointer.currentRevisionId);
						revision.onsuccess = () => {
							const serializedProject = revision.result?.candidate?.revision
								?.serializedProject as string | undefined;
							if (!serializedProject) {
								reject(new Error("Expected a serialized Project revision"));
								return;
							}
							const project = JSON.parse(serializedProject) as {
								readonly level: {
									readonly rooms: readonly {
										readonly faceFingerprint: string;
										readonly heightMm: number;
										readonly name?: string;
										readonly roomId: string;
									}[];
								};
							};
							resolve(project.level.rooms);
						};
					};
					transaction.oncomplete = () => database.close();
					transaction.onerror = () => reject(transaction.error);
				};
			}),
	);
}

async function drawCreationWallWithMouse(
	page: Page,
	start: { x: number; y: number },
	end: { x: number; y: number },
) {
	await chooseEditorOption(page, "Стена");
	await dragWall(page, start, end);
}

async function dragWall(
	page: Page,
	start: { x: number; y: number },
	end: { x: number; y: number },
) {
	await page.mouse.move(start.x, start.y);
	await page.mouse.down();
	await page.mouse.move(end.x, end.y, { steps: 8 });
	await page.mouse.up();
}

async function rotationDegrees(page: Page): Promise<number | undefined> {
	const transform = await page
		.locator("[data-item-id]")
		.first()
		.getAttribute("transform");
	const match = /^rotate\((-?\d+(?:\.\d+)?) /.exec(transform ?? "");
	return match ? Number(match[1]) : undefined;
}

/**
 * Exercises Chromium's touch-input pipeline rather than the mouse helper used
 * by older browser regressions, so React receives an actual touch PointerEvent.
 */
async function drawCentreDividerByTouch(page: Page) {
	await chooseEditorOption(page, "Стена");
	const exteriorBounds = await exteriorWallBounds(page);
	const horizontalBounds = exteriorBounds
		.filter((box) => box.width > box.height)
		.sort((first, second) => first.top - second.top);
	const topBox = horizontalBounds[0];
	const bottomBox = horizontalBounds.at(-1);
	if (!topBox || !bottomBox) {
		throw new Error(
			"Starter horizontal boundary wall hit targets did not render",
		);
	}
	const x = topBox.left + topBox.width / 2;
	const startY = topBox.top + topBox.height / 2;
	const endY = bottomBox.top + bottomBox.height / 2;
	await dragByTouch(page, { x, y: startY }, { x, y: endY });
}

async function drawCentreCrossbarByTouch(page: Page) {
	await chooseEditorOption(page, "Стена");
	const exteriorBounds = await exteriorWallBounds(page);
	const verticalBounds = exteriorBounds
		.filter((box) => box.height > box.width)
		.sort((first, second) => first.left - second.left);
	const leftBox = verticalBounds[0];
	const rightBox = verticalBounds.at(-1);
	if (!leftBox || !rightBox) {
		throw new Error(
			"Starter vertical boundary wall hit targets did not render",
		);
	}
	const y = leftBox.top + leftBox.height / 2;
	await dragByTouch(
		page,
		{ x: leftBox.left + leftBox.width / 2, y },
		{ x: rightBox.left + rightBox.width / 2, y },
	);
}

/** Each new wall is armed through the visible tool after the previous publish returns to Hand. */
async function drawCreationWallByTouch(
	page: Page,
	start: { x: number; y: number },
	end: { x: number; y: number },
) {
	await chooseEditorOption(page, "Стена");
	await dragByTouch(page, start, end);
}

async function dragByTouch(
	page: Page,
	start: { x: number; y: number },
	end: { x: number; y: number },
) {
	const plan = page.getByTestId("plan-canvas");
	const cdp = await page.context().newCDPSession(page);
	try {
		await cdp.send("Input.dispatchTouchEvent", {
			touchPoints: [{ id: 17, x: start.x, y: start.y }],
			type: "touchStart",
		});
		await expect(plan.getByTestId("wall-draft")).toHaveCount(1);
		await cdp.send("Input.dispatchTouchEvent", {
			touchPoints: [{ id: 17, x: end.x, y: end.y }],
			type: "touchMove",
		});
		await expect
			.poll(() =>
				plan
					.getByTestId("wall-draft")
					.evaluate(
						(line) =>
							line.getAttribute("x1") !== line.getAttribute("x2") ||
							line.getAttribute("y1") !== line.getAttribute("y2"),
					),
			)
			.toBe(true);
		await cdp.send("Input.dispatchTouchEvent", {
			touchPoints: [],
			type: "touchEnd",
		});
	} finally {
		await cdp.detach();
	}
	await expect(page.getByTestId("wall-draft-actions")).toBeVisible();
	await page.getByRole("button", { name: "Подтвердить стену" }).click();
}

async function dragPlanControlByTouch(
	page: Page,
	start: { x: number; y: number },
	end: { x: number; y: number },
) {
	const cdp = await page.context().newCDPSession(page);
	try {
		await cdp.send("Input.dispatchTouchEvent", {
			touchPoints: [{ id: 19, x: start.x, y: start.y }],
			type: "touchStart",
		});
		await cdp.send("Input.dispatchTouchEvent", {
			touchPoints: [{ id: 19, x: end.x, y: end.y }],
			type: "touchMove",
		});
		await cdp.send("Input.dispatchTouchEvent", {
			touchPoints: [],
			type: "touchEnd",
		});
	} finally {
		await cdp.detach();
	}
}

async function orderedRoomFaceCentres(
	page: Page,
): Promise<Array<{ x: number; y: number }>> {
	const boxes = await page.getByTestId("room-face").evaluateAll((elements) =>
		elements.map((element) => {
			const box = element.getBoundingClientRect();
			const candidates = [
				[0.5, 0.5],
				[0.4, 0.5],
				[0.6, 0.5],
				[0.5, 0.36],
				[0.5, 0.64],
				[0.32, 0.5],
				[0.68, 0.5],
			];
			const plan = element.closest("svg");
			const point = candidates
				.map(([x, y]) => ({
					x: box.x + box.width * x,
					y: box.y + box.height * y,
				}))
				.find(({ x, y }) => {
					const target = document.elementFromPoint(x, y);
					return target !== null && plan?.contains(target);
				});
			return point ?? { x: box.x + box.width / 2, y: box.y + box.height / 2 };
		}),
	);
	if (boxes.length === 0) {
		throw new Error("Expected at least one derived room face");
	}
	return boxes.sort(
		(first, second) => first.x - second.x || first.y - second.y,
	);
}

/**
 * The rectangular helper above intentionally optimises common room faces. A
 * diagonal reference scene needs a point genuinely inside each SVG polygon,
 * and picks the deepest sampled point so the catalogue preview has clearance
 * before its ordinary validation runs.
 */
async function roomFaceInteriorPoints(
	page: Page,
): Promise<Array<{ x: number; y: number }>> {
	const points = await page.getByTestId("room-face").evaluateAll((elements) =>
		elements.map((element) => {
			if (!(element instanceof SVGGeometryElement)) {
				throw new Error("Expected an SVG room face");
			}
			const box = element.getBoundingClientRect();
			const matrix = element.getScreenCTM();
			const plan = element.closest("svg");
			if (!matrix || !plan) {
				throw new Error("Room face has no visible SVG transform");
			}
			const fractions = [0.18, 0.3, 0.42, 0.5, 0.58, 0.7, 0.82];
			const boundary = Array.from({ length: 48 }, (_, index) => {
				const point = element.getPointAtLength(
					(element.getTotalLength() * index) / 48,
				);
				return new DOMPoint(point.x, point.y).matrixTransform(matrix);
			});
			const candidates = fractions.flatMap((horizontal) =>
				fractions.flatMap((vertical) => {
					const x = box.x + box.width * horizontal;
					const y = box.y + box.height * vertical;
					const local = new DOMPoint(x, y).matrixTransform(matrix.inverse());
					const target = document.elementFromPoint(x, y);
					if (
						!element.isPointInFill(local) ||
						!target ||
						!plan.contains(target)
					) {
						return [];
					}
					return [
						{
							x,
							y,
							score: Math.min(
								...boundary.map((edge) => Math.hypot(edge.x - x, edge.y - y)),
							),
						},
					];
				}),
			);
			const point = candidates.sort(
				(first, second) => second.score - first.score,
			)[0];
			if (!point) {
				throw new Error("Could not find an exposed point inside a room face");
			}
			return { x: point.x, y: point.y };
		}),
	);
	if (points.length === 0) {
		throw new Error("Expected at least one derived room face");
	}
	return points.sort(
		(first, second) => first.x - second.x || first.y - second.y,
	);
}

test("EDITOR-E2E-01: a phone editor owns the viewport and commits exact plan dimensions with explicit apply", async ({
	page: _page,
}, testInfo) => {
	const session = await openPersistentPhone(testInfo, "editor-workspace");
	await session.page.goto("/");
	await startNewProject(session.page, "Гостиная");

	const workspace = session.page.getByTestId("editor-workspace");
	await expect(workspace).toBeVisible();
	await expect(
		session.page.getByRole("button", { name: "Применить размеры" }),
	).toHaveCount(0);
	await expect(session.page.getByRole("button", { name: "Опции" })).toHaveCount(
		0,
	);

	await session.page.getByLabel("Ширина, мм").fill("4000");
	await session.page.getByLabel("Глубина, мм").fill("3000");
	await session.page.getByLabel("Высота, мм").fill("2600");
	await session.page.getByRole("button", { name: "Создать контур" }).click();
	await expect(session.page.getByTestId("plan-width")).toHaveText("4000 мм");

	await session.page.getByRole("button", { name: "Размеры плана" }).click();
	const planDimensionsSheet = session.page.getByTestId("plan-dimensions-sheet");
	await expect(planDimensionsSheet).toBeVisible();
	await expect(
		planDimensionsSheet.getByTestId("plan-dimensions-sheet-handle"),
	).toBeVisible();
	await session.page.getByLabel("Ширина, мм").fill("4550");
	await session.page.getByRole("button", { name: "Применить размеры" }).click();
	await expect(session.page.getByTestId("plan-width")).toHaveText("4550 мм");
	await expect(
		session.page.getByTestId("project-durability-status"),
	).toContainText("Сохранено локально");

	const editorBox = await workspace.boundingBox();
	expect(editorBox?.height).toBeGreaterThanOrEqual(
		(await session.page.evaluate(() => window.innerHeight)) - 1,
	);
	expect(
		await session.page.evaluate(() => document.documentElement.scrollHeight),
	).toBeLessThanOrEqual(await session.page.evaluate(() => window.innerHeight));
	await session.context.close();
});

test("EDITOR-E2E-13: shared phone chrome keeps Plan and 3D controls clear above their canvases", async ({
	page: _page,
}, testInfo) => {
	const session = await openPersistentPhone(
		testInfo,
		"editor-floating-toolrail",
	);
	await session.page.goto("/");
	await startNewProject(session.page, "Инструменты на холсте");
	await session.page.getByRole("button", { name: "Создать контур" }).click();

	const header = session.page.getByTestId("editor-top-bar");
	const viewSwitch = session.page.getByTestId("editor-view-switch");
	for (const width of [393, 360]) {
		await session.page.setViewportSize({ width, height: 852 });
		for (const control of await header.getByRole("button").all()) {
			const bounds = await control.boundingBox();
			const label =
				(await control.getAttribute("aria-label")) ?? "Header control";
			expect(bounds?.height, label).toBeGreaterThanOrEqual(44);
			expect(bounds?.width, label).toBeGreaterThanOrEqual(44);
		}
	}
	await session.page.setViewportSize({ width: 393, height: 852 });
	const rail = session.page.getByRole("navigation", {
		name: "Инструменты редактора",
	});
	const dock = session.page.getByTestId("editor-action-dock");
	await expect(header).toBeVisible();
	await expect(
		header.getByRole("button", { name: "Вернуться к проектам" }),
	).toBeVisible();
	await expect(
		header.getByRole("button", {
			name: "Переименовать проект Инструменты на холсте",
		}),
	).toBeVisible();
	await expect(header.getByRole("status")).toHaveText("Сохранено");
	await expect(
		viewSwitch.getByRole("button", { name: "План 2D", exact: true }),
	).toBeVisible();
	await expect(
		viewSwitch.getByRole("button", { name: "3D", exact: true }),
	).toBeVisible();
	await expect(rail).toBeVisible();
	await expect(
		rail.getByRole("button", { name: "План 2D", exact: true }),
	).toHaveCount(0);
	await expect(
		rail.getByRole("button", { name: "3D", exact: true }),
	).toHaveCount(0);
	for (const name of [
		"Комната",
		"Рука и выбор",
		"Стена",
		"Предметы интерьера",
	]) {
		await expect(dock.getByRole("button", { name, exact: true })).toBeVisible();
	}
	const dockLayout = await dock.evaluate((element) => {
		const bounds = element.getBoundingClientRect();
		return {
			clientWidth: element.clientWidth,
			height: bounds.height,
			overflowX: window.getComputedStyle(element).overflowX,
			scrollWidth: element.scrollWidth,
		};
	});
	// The primary tools remain one uninterrupted thumb-zone row. A horizontal
	// carousel makes switching tools unnecessarily awkward on a phone.
	expect(dockLayout.height).toBeGreaterThanOrEqual(44);
	expect(dockLayout.overflowX).toBe("visible");
	expect(dockLayout.scrollWidth).toBeLessThanOrEqual(dockLayout.clientWidth);
	const planChrome = await session.page.evaluate(() => {
		const readSurface = (selector: string) => {
			const element = document.querySelector<HTMLElement>(selector);
			if (!element) throw new Error(`Expected ${selector}`);
			const style = window.getComputedStyle(element);
			return {
				backdropFilter: style.backdropFilter,
				backgroundColor: style.backgroundColor,
				backgroundImage: style.backgroundImage,
				borderRadius: style.borderRadius,
			};
		};
		return {
			actionDock: readSurface('[data-testid="editor-action-dock"]'),
			activePlan: window.getComputedStyle(
				document.querySelector<HTMLElement>(
					'[data-testid="editor-view-switch"] button[aria-pressed="true"]',
				) ?? document.body,
			).backgroundColor,
			activeSelect: window.getComputedStyle(
				document.querySelector<HTMLElement>(
					'[data-testid="editor-action-dock"] button[aria-pressed="true"]',
				) ?? document.body,
			).backgroundColor,
			header: readSurface('[data-testid="editor-top-bar"]'),
			shellBackgroundImage: window.getComputedStyle(
				document.querySelector<HTMLElement>(
					'[data-testid="editor-workspace"]',
				) ?? document.body,
			).backgroundImage,
		};
	});
	expect(planChrome).toEqual({
		actionDock: {
			backdropFilter: "none",
			backgroundColor: "rgb(255, 255, 255)",
			backgroundImage: "none",
			borderRadius: "28px",
		},
		activePlan: "rgb(25, 118, 185)",
		activeSelect: "rgb(231, 243, 251)",
		header: {
			backdropFilter: "none",
			backgroundColor: "rgb(255, 255, 255)",
			backgroundImage: "none",
			borderRadius: "0px",
		},
		shellBackgroundImage: "none",
	});
	await expect(
		session.page.getByRole("button", { name: "Опции", exact: true }),
	).toHaveCount(0);
	await expect(
		session.page.getByTestId("wall-line").first(),
	).not.toHaveAttribute("stroke-dasharray");
	const gridFollowsRoomFill = await session.page
		.getByTestId("plan-canvas")
		.getByTestId("room-face")
		.first()
		.evaluate((room) => {
			const grid = room.parentElement?.querySelector(
				'[data-testid="infinite-grid"]',
			);
			return Boolean(
				grid &&
					room.compareDocumentPosition(grid) & Node.DOCUMENT_POSITION_FOLLOWING,
			);
		});
	expect(gridFollowsRoomFill).toBe(true);

	const revisionsBeforeViewSwitch = await durableRevisionCount(session.page);
	await viewSwitch.getByRole("button", { name: "3D", exact: true }).click();
	await expect(
		session.page.getByTestId("three-dimensional-canvas"),
	).toBeVisible();
	const headerControlsWinHitTesting = await Promise.all([
		header
			.getByRole("button", { name: "Вернуться к проектам" })
			.evaluate((element) => {
				const bounds = element.getBoundingClientRect();
				const hit = document.elementFromPoint(
					bounds.left + bounds.width / 2,
					bounds.top + bounds.height / 2,
				);
				return hit === element || element.contains(hit);
			}),
		header
			.getByRole("button", {
				name: "Переименовать проект Инструменты на холсте",
			})
			.evaluate((element) => {
				const bounds = element.getBoundingClientRect();
				const hit = document.elementFromPoint(
					bounds.left + bounds.width / 2,
					bounds.top + bounds.height / 2,
				);
				return hit === element || element.contains(hit);
			}),
		viewSwitch.evaluate((element) => {
			const bounds = element.getBoundingClientRect();
			const hit = document.elementFromPoint(
				bounds.left + bounds.width / 2,
				bounds.top + bounds.height / 2,
			);
			return hit === element || element.contains(hit);
		}),
	]);
	expect(headerControlsWinHitTesting).toEqual([true, true, true]);
	const threeDimensionalDeck = session.page.getByTestId(
		"three-dimensional-view-controls",
	);
	await expect(threeDimensionalDeck).toBeVisible();
	await expect(dock).toBeHidden();
	const threeDimensionalChrome = await threeDimensionalDeck.evaluate(
		(element) => {
			const style = window.getComputedStyle(element);
			return {
				backdropFilter: style.backdropFilter,
				backgroundColor: style.backgroundColor,
				backgroundImage: style.backgroundImage,
				borderRadius: style.borderRadius,
			};
		},
	);
	expect(threeDimensionalChrome).toEqual({
		backdropFilter: "none",
		backgroundColor: "rgb(255, 255, 255)",
		backgroundImage: "none",
		borderRadius: "28px",
	});
	await viewSwitch
		.getByRole("button", { name: "План 2D", exact: true })
		.click();
	expect(await durableRevisionCount(session.page)).toBe(
		revisionsBeforeViewSwitch,
	);
	const plan = session.page.getByTestId("plan-canvas");
	await expect(plan).toBeVisible();

	const planBox = await plan.boundingBox();
	if (!planBox) {
		throw new Error("Plan canvas did not render");
	}
	await rail.getByRole("button", { name: "Стена", exact: true }).click();
	const cdp = await session.page.context().newCDPSession(session.page);
	try {
		const start = await planPointMm(session.page, { xMm: -1000, zMm: -1000 });
		await cdp.send("Input.dispatchTouchEvent", {
			touchPoints: [{ id: 19, ...start }],
			type: "touchStart",
		});
		await expect(plan.getByTestId("wall-draft")).toHaveCount(1);
		await session.page.waitForTimeout(220);
		await cdp.send("Input.dispatchTouchEvent", {
			touchPoints: [{ id: 19, x: start.x + 42, y: start.y + 24 }],
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
	await session.page.getByRole("button", { name: "Подтвердить стену" }).click();
	await expect(session.page.getByTestId("wall-count")).toHaveText("5 стен");
	await session.context.close();
});

test("EDITOR-E2E-13A: selecting a wall promotes the explicit New Opening sheet into the phone action dock", async ({
	page: _page,
}, testInfo) => {
	const session = await openPersistentPhone(
		testInfo,
		"editor-contextual-wall-dock",
	);
	await session.page.goto("/");
	await startNewProject(session.page, "Проём из dock");
	await session.page.getByRole("button", { name: "Создать контур" }).click();

	const dock = session.page.getByTestId("editor-action-dock");
	await expect(
		dock.getByRole("button", { name: "Предметы интерьера" }),
	).toBeVisible();
	await expect(
		dock.getByRole("button", { name: "Добавить проём", exact: true }),
	).toHaveCount(0);
	await expect(
		session.page.getByText("Периметр: 14000 мм", { exact: true }),
	).toBeHidden();

	await session.page.getByTestId("wall-segment").first().click();
	const initialWallInspector = session.page.getByRole("complementary", {
		name: "Свойства выбранной стены",
	});
	await expect(initialWallInspector).toHaveCount(0);
	await expandSelectedWallInspector(session.page);
	await expect(initialWallInspector).toBeVisible();
	await expect(initialWallInspector).toHaveAttribute(
		"data-testid",
		"selected-wall-inspector",
	);
	await expect(
		initialWallInspector.getByTestId("selected-wall-inspector-icon"),
	).toBeVisible();
	await expect(
		dock.getByRole("button", { name: "Добавить проём", exact: true }),
	).toBeVisible();
	await expect(
		dock.getByRole("button", { name: "Предметы интерьера" }),
	).toBeVisible();
	await session.page
		.getByRole("button", { name: "Открыть остальные действия" })
		.click();
	const secondaryActions = session.page.getByRole("dialog", {
		name: "Остальные действия редактора",
	});
	const wallInspector = session.page.getByRole("complementary", {
		name: "Свойства выбранной стены",
	});
	await expect(
		secondaryActions.getByRole("button", { name: "Предметы интерьера" }),
	).toBeVisible();
	await expect(wallInspector).toBeHidden();
	await secondaryActions
		.getByRole("button", { name: "Закрыть остальные действия" })
		.click();
	await expect(secondaryActions).toBeHidden();
	await expect(wallInspector).toBeVisible();
	await session.context.close();
});

test("EDITOR-E2E-13B: the phone catalog exposes model import above browsing without horizontal overflow", async ({
	page: _page,
}, testInfo) => {
	const session = await openPersistentPhone(
		testInfo,
		"editor-catalog-browse-first",
	);
	await session.page.goto("/");
	await startNewProject(session.page, "Каталог без шума");
	await session.page.getByRole("button", { name: "Создать контур" }).click();

	await session.page
		.getByTestId("editor-action-dock")
		.getByRole("button", { name: "Предметы интерьера" })
		.click();
	const catalog = session.page.getByRole("dialog", {
		name: "Предметы интерьера",
	});
	const search = catalog.getByPlaceholder("Найти предмет");
	const firstCard = catalog.getByTestId("preloaded-catalog-card").first();
	const placementBar = catalog.getByTestId("catalog-placement-bar");
	const authoring = catalog.getByTestId("catalog-authoring");
	const mockItemAuthoring = catalog.getByRole("region", {
		name: "Создать макетный предмет",
	});
	await expect(search).toBeVisible();
	await expect(firstCard).toBeVisible();
	await expect(authoring).not.toHaveAttribute("open", "");
	await expect(mockItemAuthoring).toBeHidden();
	await expect(placementBar).toBeHidden();

	const [searchTop, firstCardTop, authoringTop] = await Promise.all([
		search.evaluate((element) => element.getBoundingClientRect().top),
		firstCard.evaluate((element) => element.getBoundingClientRect().top),
		authoring.evaluate((element) => element.getBoundingClientRect().top),
	]);
	expect(authoringTop).toBeLessThan(searchTop);
	expect(authoringTop).toBeLessThan(firstCardTop);
	expect(
		await catalog.evaluate(
			(element) => element.scrollWidth <= element.clientWidth,
		),
	).toBe(true);
	await firstCard.click();
	await expect(catalog).toHaveAttribute(
		"data-focused-preloaded-selection",
		"true",
	);
	await expect(placementBar).toBeVisible();
	await expect(
		placementBar.getByRole("button", { name: "Показать на плане" }),
	).toBeEnabled({ timeout: 30_000 });
	await expect(firstCard).toBeHidden();
	await expect(authoring).toBeHidden();
	await session.page.keyboard.press("Escape");
	await expect(catalog).toHaveCount(0);
	await session.context.close();
});

test("EDITOR-E2E-13C: the phone dock exposes room, wall, item and selection directly", async ({
	page: _page,
}, testInfo) => {
	const session = await openPersistentPhone(
		testInfo,
		"editor-reference-phone-dock",
	);
	await session.page.goto("/");
	await startNewProject(session.page, "Прямые инструменты");
	await session.page.getByRole("button", { name: "Создать контур" }).click();

	const dock = session.page.getByTestId("editor-action-dock");
	const room = dock.getByRole("button", { name: "Комната", exact: true });
	const wall = dock.getByRole("button", { name: "Стена", exact: true });
	const item = dock.getByRole("button", { name: "Предметы интерьера" });
	const select = dock.getByRole("button", {
		name: "Рука и выбор",
		exact: true,
	});
	await expect(room).toBeVisible();
	await expect(wall).toBeVisible();
	await expect(item).toBeVisible();
	await expect(select).toBeVisible();

	await room.click();
	await expect(
		session.page.getByRole("dialog", { name: "Помещения" }),
	).toBeVisible();
	await session.context.close();
});

test("EDITOR-E2E-13D: the phone 3D view uses one presentation camera deck", async ({
	page: _page,
}, testInfo) => {
	const session = await openPersistentPhone(
		testInfo,
		"editor-reference-three-dimensional-deck",
	);
	await session.page.goto("/");
	await startNewProject(session.page, "3D-подача");
	await session.page.getByRole("button", { name: "Создать контур" }).click();
	await session.page
		.getByTestId("editor-view-switch")
		.getByRole("button", { name: "3D", exact: true })
		.click();

	const cameraDeck = session.page.getByTestId("three-dimensional-camera-deck");
	await expect(session.page.getByTestId("editor-action-dock")).toBeHidden();
	await expect(
		cameraDeck.getByRole("button", { name: "Предметы интерьера" }),
	).toBeVisible();
	await expect(
		cameraDeck.getByRole("button", { name: "Авто cutaway" }),
	).toBeVisible();
	await expect(
		cameraDeck.getByRole("button", { name: "Показать все стены" }),
	).toBeVisible();
	await cameraDeck.getByRole("button", { name: "Предметы интерьера" }).click();
	await expect(
		session.page.getByRole("dialog", { name: "Предметы интерьера" }),
	).toBeVisible();
	await session.context.close();
});

test("EDITOR-E2E-13E: the clean phone plan keeps dimension settings accessible through the safe area", async ({
	page: _page,
}, testInfo) => {
	const session = await openPersistentPhone(
		testInfo,
		"editor-reference-plan-cues",
	);
	await session.page.goto("/");
	await startNewProject(session.page, "План с ориентиром");
	await session.page.getByRole("button", { name: "Создать контур" }).click();

	const settings = session.page.getByRole("button", {
		name: "Настроить размеры",
		exact: true,
	});
	await expect(settings).toBeVisible();
	await expect(session.page.getByTestId("plan-reference-markers")).toHaveCount(
		0,
	);
	await expect(
		session.page.getByTestId("drawing-dimension-legend"),
	).toHaveCount(0);
	const dimensions = session.page.getByTestId("drawing-dimensions");
	await expect(
		dimensions.locator('[data-dimension-kind="room-clear"]'),
	).toHaveCount(2);
	await expect(
		dimensions.locator(
			'[data-dimension-kind="wall"], [data-dimension-kind="overall"]',
		),
	).toHaveCount(0);

	const revisionsBeforeSettings = await durableRevisionCount(session.page);
	const safeArea = await session.context.newCDPSession(session.page);
	await safeArea.send("Emulation.setSafeAreaInsetsOverride", {
		insets: { top: 44, bottom: 34, left: 0, right: 0 },
	});
	const [headerBox, settingsBox] = await Promise.all([
		session.page.getByTestId("editor-top-bar").boundingBox(),
		settings.boundingBox(),
	]);
	if (!headerBox || !settingsBox)
		throw new Error("Expected settings within the phone header safe area");
	expect(settingsBox.width).toBeGreaterThanOrEqual(44);
	expect(settingsBox.height).toBeGreaterThanOrEqual(44);
	expect(settingsBox.y).toBeGreaterThanOrEqual(headerBox.y);
	expect(settingsBox.y + settingsBox.height).toBeLessThanOrEqual(
		headerBox.y + headerBox.height,
	);
	await settings.click();
	const dialog = session.page.getByRole("dialog", {
		name: "Размеры",
		exact: true,
	});
	await expect(dialog).toBeVisible();
	await expect(
		dialog.getByRole("checkbox", { name: "Внутренние размеры", exact: true }),
	).toBeChecked();
	await dialog.getByRole("button", { name: "Готово", exact: true }).click();
	await expect(settings).toBeFocused();
	expect(await durableRevisionCount(session.page)).toBe(
		revisionsBeforeSettings,
	);
	await session.context.close();
});

test("EDITOR-E2E-13F: a selected catalog item receives a focused explicit handoff sheet", async ({
	page: _page,
}, testInfo) => {
	const session = await openPersistentPhone(
		testInfo,
		"editor-catalog-selection-tray",
	);
	await session.page.goto("/");
	await startNewProject(session.page, "Выбор предмета");
	await session.page.getByRole("button", { name: "Создать контур" }).click();
	await session.page
		.getByTestId("editor-action-dock")
		.getByRole("button", { name: "Предметы интерьера" })
		.click();

	const catalog = session.page.getByRole("dialog", {
		name: "Предметы интерьера",
	});
	await catalog.getByTestId("preloaded-catalog-card").first().click();
	const tray = catalog.getByTestId("catalog-placement-bar");
	await expect(catalog).toHaveAttribute(
		"data-focused-preloaded-selection",
		"true",
	);
	await expect(tray).toBeVisible();
	await expect(tray.getByTestId("catalog-placement-preview")).toBeVisible();
	await expect(
		tray.getByRole("button", { name: "Показать на плане" }),
	).toBeEnabled({ timeout: 30_000 });
	await expect(tray.getByRole("button", { name: "Отмена" })).toHaveCount(0);
	await session.context.close();
});

test("EDITOR-E2E-13G: 3D placement names the selected item and keeps its controls without instructions", async ({
	page: _page,
}, testInfo) => {
	const session = await openPersistentPhone(
		testInfo,
		"editor-three-dimensional-placement-tray",
	);
	await session.page.goto("/");
	await startNewProject(session.page, "Предмет в 3D");
	await session.page.getByRole("button", { name: "Создать контур" }).click();
	await session.page
		.getByTestId("editor-view-switch")
		.getByRole("button", { name: "3D", exact: true })
		.click();
	await session.page
		.getByTestId("three-dimensional-camera-deck")
		.getByRole("button", { name: "Предметы интерьера" })
		.click();

	const catalog = session.page.getByRole("dialog", {
		name: "Предметы интерьера",
	});
	await catalog.getByRole("button", { name: /^Кровать —/ }).click();
	const showOnPlan = catalog.getByRole("button", {
		name: "Показать на плане",
	});
	await expect(showOnPlan).toBeEnabled({ timeout: 30_000 });
	await showOnPlan.click();
	await expect(catalog).toHaveCount(0, { timeout: 30_000 });

	const placementTray = session.page.getByTestId(
		"three-dimensional-item-placement-menu",
	);
	await expect(placementTray).toHaveAttribute(
		"data-placement-state",
		"choose-point",
	);
	await expect(
		placementTray.getByTestId("three-dimensional-item-placement-identity"),
	).toContainText("Кровать");
	await expect(
		placementTray.getByTestId("three-dimensional-item-placement-status"),
	).toHaveCount(0);
	expect(await placementTray.locator("button").allTextContents()).toEqual([
		"↶",
		"↷",
		"Отмена",
		"Поставить",
	]);
	await expect(
		placementTray.getByRole("button", {
			name: "Отменить размещение предмета",
		}),
	).toBeVisible();
	await expect(
		placementTray.getByRole("button", {
			name: "Подтвердить размещение предмета",
		}),
	).toBeDisabled();
	await expect(
		session.page.getByTestId("three-dimensional-camera-deck"),
	).toHaveCount(0);
	await session.context.close();
});

test("EDITOR-E2E-13H: catalog filters use visual category cues without losing their names", async ({
	page: _page,
}, testInfo) => {
	const session = await openPersistentPhone(
		testInfo,
		"editor-catalog-visual-categories",
	);
	await session.page.goto("/");
	await startNewProject(session.page, "Категории");
	await session.page.getByRole("button", { name: "Создать контур" }).click();
	await session.page
		.getByTestId("editor-action-dock")
		.getByRole("button", { name: "Предметы интерьера" })
		.click();

	const categories = session.page.getByRole("navigation", {
		name: "Категории каталога",
	});
	for (const category of ["Все", "Кастомное", "Мебель", "Сантехника"]) {
		const filter = categories.getByRole("button", {
			name: category,
			exact: true,
		});
		await expect(filter).toHaveAttribute(
			"data-testid",
			"catalog-category-filter",
		);
		await expect(filter.getByTestId("catalog-category-glyph")).toBeVisible();
	}
	await session.context.close();
});

test("EDITOR-E2E-13I: a selected item keeps its outline and a visible rotation dome between Plan and 3D", async ({
	page: _page,
}, testInfo) => {
	const session = await openPersistentPhone(
		testInfo,
		"editor-plan-selection-corners",
	);
	await session.page.goto("/");
	await startNewProject(session.page, "Выбор предмета");
	await session.page.getByRole("button", { name: "Создать контур" }).click();
	await chooseBuiltInGreybox(session.page, "Стол");

	const [roomPoint] = await roomFaceInteriorPoints(session.page);
	if (!roomPoint) throw new Error("Expected the actual usable room centre");
	await session.page.mouse.click(roomPoint.x, roomPoint.y);
	await expect(session.page.getByTestId("item-count")).toHaveText("1 предмет");
	await expect(session.page.getByTestId("item-count")).toHaveText("1 предмет");
	await expect(
		session.page.getByTestId("item-placement-durable-status"),
	).toBeHidden({ timeout: 5_000 });
	await chooseEditorOption(session.page, "Рука и выбор");
	await session.page.getByTestId("schematic-item").click();

	const frame = session.page.getByTestId(
		"two-dimensional-item-selection-frame",
	);
	await expect(frame).toBeVisible();
	await expect(
		frame.getByTestId("two-dimensional-item-selection-handle"),
	).toHaveCount(4);
	// Like 3D, Plan keeps its selected-item frame as the only resting visual
	// cue. The full direct rotation target remains intact, but its visible ring
	// and handle stay completely quiet until the user engages it.
	const planRotationTrack = session.page.getByTestId(
		"two-dimensional-rotation-track",
	);
	const planRotationHandle = session.page.locator("[data-rotation-handle]");
	await expect(planRotationTrack).toBeVisible();
	await expect(planRotationHandle).toBeVisible();
	await expect(planRotationTrack).toHaveCSS("opacity", "0");
	await expect(planRotationHandle).toHaveCSS("opacity", "0");
	await expect(
		session.page.getByTestId("two-dimensional-rotation-hit-area"),
	).toHaveCSS("stroke-opacity", "0.001");
	const quietPlanSelectionScreenshot = testInfo.outputPath(
		"plan-selection-quiet.png",
	);
	await session.page.screenshot({ path: quietPlanSelectionScreenshot });
	await testInfo.attach("plan-selection-quiet", {
		contentType: "image/png",
		path: quietPlanSelectionScreenshot,
	});
	const revisionsBeforeViewSwitch = await durableRevisionCount(session.page);
	await chooseEditorOption(session.page, "3D");
	const threeDimensionalFrame = session.page.getByTestId(
		"three-dimensional-item-selection-frame",
	);
	await expect(threeDimensionalFrame).toBeVisible();
	await expect(
		threeDimensionalFrame.getByTestId(
			"three-dimensional-item-selection-handle",
		),
	).toHaveCount(0);
	await expect(threeDimensionalFrame.locator("polygon")).toHaveCount(1);
	await expect(threeDimensionalFrame).toHaveCSS("pointer-events", "none");
	// A passive footprint outline and a visible hemisphere expose selection and
	// rotation before a touch begins; the wide hit band leaves the centre free.
	const rotationGizmo = session.page.getByTestId(
		"three-dimensional-rotation-gizmo",
	);
	await expect(rotationGizmo).toHaveAttribute("data-rotation-active", "false");
	const rotationTrack = session.page.getByTestId(
		"three-dimensional-rotation-track",
	);
	const rotationHandle = session.page.getByTestId(
		"three-dimensional-rotation-handle",
	);
	await expect(
		session.page.getByTestId("three-dimensional-rotation-hit-area"),
	).toHaveCSS("stroke-opacity", "0.001");
	await expect(rotationTrack).toBeVisible();
	await expect(rotationHandle).toBeVisible();
	expect(
		Number.parseFloat(
			await rotationTrack.evaluate(
				(element) => getComputedStyle(element).opacity,
			),
		),
	).toBeGreaterThan(0.5);
	expect(
		Number.parseFloat(
			await rotationHandle.evaluate(
				(element) => getComputedStyle(element).opacity,
			),
		),
	).toBeGreaterThan(0.5);
	expect(await durableRevisionCount(session.page)).toBe(
		revisionsBeforeViewSwitch,
	);
	await chooseEditorOption(session.page, "План 2D");
	await expect(frame).toBeVisible();
	await session.context.close();
});

test("EDITOR-E2E-13J: a selected item keeps its controls clear of the overflow bubble", async ({
	page: _page,
}, testInfo) => {
	const session = await openPersistentPhone(
		testInfo,
		"editor-selected-item-context-dock",
	);
	await session.page.goto("/");
	await startNewProject(session.page, "Контекст предмета");
	await session.page.getByRole("button", { name: "Создать контур" }).click();
	await chooseBuiltInGreybox(session.page, "Стол");

	const [roomPoint] = await roomFaceInteriorPoints(session.page);
	if (!roomPoint) throw new Error("Expected the actual usable room centre");
	await session.page.mouse.click(roomPoint.x, roomPoint.y);
	await expect(session.page.getByTestId("item-count")).toHaveText("1 предмет");
	await chooseEditorOption(session.page, "Рука и выбор");
	await session.page.getByTestId("schematic-item").click();

	const inspector = session.page.getByTestId("selected-item-inspector");
	await expect(inspector).toHaveAttribute("data-inspector-expanded", "false");
	const dock = session.page.getByTestId("editor-action-dock");
	await expect(
		dock.getByRole("button", { name: "Предметы интерьера" }),
	).toBeVisible();
	await expect(
		dock.getByRole("button", { name: "Открыть остальные действия" }),
	).toHaveCount(0);
	const placementStatus = session.page.getByTestId(
		"item-placement-durable-status",
	);
	await expect(placementStatus).toHaveText("Предмет размещён и сохранён.");
	await expect(placementStatus).toBeHidden();
	// The reference leaves the canvas unobstructed: the selection frame is the
	// primary cue, while precise parameters live behind the existing overflow
	// action instead of a persistent bottom card.
	await expect(inspector).toBeHidden();
	await session.page
		.getByRole("button", { name: "Открыть остальные действия" })
		.click();
	const propertiesAction = session.page.getByRole("button", {
		name: "Параметры выбранного предмета",
	});
	await expect(propertiesAction).toBeVisible();
	await expect(propertiesAction).toHaveAttribute(
		"aria-controls",
		"selected-item-inspector",
	);
	await propertiesAction.click();
	await expect(inspector).toBeVisible();
	await expect(placementStatus).toBeHidden();
	await expect(inspector).toHaveAttribute("data-inspector-expanded", "true");
	const hideInspector = inspector.getByRole("button", {
		name: "Скрыть панель предмета",
	});
	await expect(hideInspector).toHaveText("Скрыть параметры");
	await hideInspector.click();
	await expect(inspector).toBeHidden();
	await session.context.close();
});

test("EDITOR-E2E-13K: a selected wall exposes one New Opening action without overlap", async ({
	page: _page,
}, testInfo) => {
	const session = await openPersistentPhone(
		testInfo,
		"editor-selected-wall-context-dock",
	);
	await session.page.goto("/");
	await startNewProject(session.page, "Контекст стены");
	await session.page.getByRole("button", { name: "Создать контур" }).click();
	const selectedWall = session.page.getByTestId("wall-segment").first();
	const selectedWallId = await selectedWall.getAttribute("data-wall-id");
	if (!selectedWallId) throw new Error("Expected a selectable Wall identity");
	await selectedWall.click();
	await expect(
		session.page.locator(
			`[data-testid="wall-line"][data-wall-id="${selectedWallId}"]`,
		),
	).toHaveCSS("stroke", "rgb(37, 99, 235)");

	const dock = session.page.getByTestId("editor-action-dock");
	await expect(
		dock.getByRole("button", { name: "Добавить проём", exact: true }),
	).toBeVisible();
	await expect(
		dock.getByRole("button", { name: "Открыть остальные действия" }),
	).toHaveCount(0);
	await dock
		.getByRole("button", { name: "Добавить проём", exact: true })
		.click();
	const draft = session.page.getByTestId("opening-creation-draft");
	await expect(draft).toBeVisible();
	await draft.getByRole("button", { name: "Окно", exact: true }).click();
	await expect(draft.getByLabel("Высота подоконника, мм")).toHaveCount(0);
	await session.context.close();
});

test("EDITOR-E2E-13L: wall drawing uses fixed 100 mm geometry without a thickness control", async ({
	page: _page,
}, testInfo) => {
	const session = await openPersistentPhone(
		testInfo,
		"editor-wall-fixed-thickness",
	);
	await session.page.goto("/");
	await startNewProject(session.page, "Контекст стены");
	await session.page.getByRole("button", { name: "Создать контур" }).click();
	await chooseEditorOption(session.page, "Стена");
	await expect(session.page.getByLabel("Толщина стены, мм")).toHaveCount(0);
	await expect(session.page.getByTestId("plan-canvas")).toBeVisible();
	const wallIds = await session.page
		.getByTestId("wall-segment")
		.evaluateAll((walls) =>
			walls.map((wall) => wall.getAttribute("data-wall-id")),
		);
	for (const wallId of wallIds) {
		if (!wallId) throw new Error("Wall id required");
		expect((await durableWallSegment(session.page, wallId))?.thicknessMm).toBe(
			100,
		);
	}
	await session.context.close();
});

test("EDITOR-E2E-13M: the resting phone plan reads as a technical drawing, not a metrics card", async ({
	page: _page,
}, testInfo) => {
	const session = await openPersistentPhone(
		testInfo,
		"editor-technical-resting-plan",
	);
	await session.page.goto("/");
	await startNewProject(session.page, "Технический план");
	await session.page.getByRole("button", { name: "Создать контур" }).click();

	const measurement = session.page.getByTestId("room-measurement");
	await expect(measurement).toContainText("4000 мм × 3000 мм");
	await expect(measurement.getByText("4000 мм × 3000 мм")).toBeHidden();
	await expect(session.page.getByTestId("room-label")).toBeHidden();
	await expect(session.page.getByTestId("plan-room-status")).toBeHidden();
	await expect(session.page.getByTestId("item-count")).toHaveText(
		"0 предметов",
	);
	await expect(session.page.getByTestId("item-count")).toBeHidden();
	await expect(session.page.getByTestId("plan-reference-markers")).toHaveCount(
		0,
	);
	await expect(
		session.page.getByTestId("drawing-dimension-legend"),
	).toHaveCount(0);

	await session.page
		.getByRole("button", { name: "Открыть остальные действия" })
		.click();
	const secondaryActions = session.page.getByRole("dialog", {
		name: "Остальные действия редактора",
	});
	await expect(
		secondaryActions.getByRole("button", { name: "Размеры плана" }),
	).toBeVisible();
	await secondaryActions.getByRole("button", { name: "Размеры плана" }).click();
	await expect(session.page.getByTestId("plan-dimensions-sheet")).toBeVisible();
	await session.context.close();
});

test("EDITOR-E2E-02: drawing a snapped divider creates a durable two-room plan", async ({
	page: _page,
}, testInfo) => {
	const session = await openPersistentPhone(testInfo, "editor-divider");
	await session.page.goto("/");
	await startNewProject(session.page, "План с перегородкой");
	await session.page.getByRole("button", { name: "Создать контур" }).click();
	await chooseEditorOption(session.page, "Стена");

	await drawCentreDivider(session.page);

	await expect(session.page.getByTestId("wall-count")).toHaveText("7 стен");
	await expect(
		session.page.getByTestId("plan-canvas").getByTestId("room-face"),
	).toHaveCount(2);
	await expect(
		session.page.getByTestId("project-durability-status"),
	).toContainText("Сохранено локально");
	await session.context.close();
});

test("EDITOR-E2E-02RM: a split publishes immediately without a Room metadata dialog", async ({
	page: _page,
}, testInfo) => {
	const session = await openPersistentPhone(
		testInfo,
		"editor-room-metadata-split",
	);
	await session.page.goto("/");
	await startNewProject(session.page, "Автоматическое разделение");
	await session.page.getByRole("button", { name: "Создать контур" }).click();
	await chooseEditorOption(session.page, "Стена");
	const revisionsBefore = await durableRevisionCount(session.page);

	await drawCentreDivider(session.page);
	const preview = session.page.getByTestId("room-metadata-conflict-preview");
	await expect(preview).toHaveCount(0);
	await expect(session.page.getByTestId("room-count")).toHaveText("2 комнаты");
	expect(await durableRevisionCount(session.page)).toBeGreaterThan(
		revisionsBefore,
	);
	await session.context.close();
});

test("EDITOR-E2E-02L: a horizontal wall visibly separates the starter plan and enables 3D", async ({
	page: _page,
}, testInfo) => {
	const session = await openPersistentPhone(
		testInfo,
		"editor-horizontal-divider-visible",
	);
	await session.page.goto("/");
	await startNewProject(session.page, "Горизонтальное разделение");
	await session.page.getByRole("button", { name: "Создать контур" }).click();
	await chooseEditorOption(session.page, "Стена");

	await drawCentreCrossbar(session.page);

	await expect(session.page.getByTestId("wall-count")).toHaveText("7 стен");
	await expect(session.page.getByTestId("room-count")).toHaveText("2 комнаты");
	await expect(session.page.getByTestId("room-face")).toHaveCount(2);
	await expect(session.page.getByTestId("room-measurement")).toHaveCount(2);
	await expect(session.page.getByTestId("plan-room-status")).toHaveCount(0);
	await expect(session.page.getByTestId("plan-canvas")).toHaveAttribute(
		"data-active-tool",
		"select",
	);
	await expect(session.page.getByTestId("room-label")).toHaveCount(2);
	await expect(
		session.page.getByRole("button", { name: "3D", exact: true }),
	).toBeEnabled();
	await session.context.close();
});

test("EDITOR-E2E-02M: a manually closed empty contour derives its first room before it is divided", async ({
	page: _page,
}, testInfo) => {
	const session = await openPersistentPhone(
		testInfo,
		"editor-manual-first-room",
	);
	await session.page.goto("/");
	await startNewProject(session.page, "Ручной контур");
	await chooseEditorOption(session.page, "Стена");

	const canvas = session.page.getByTestId("plan-canvas");
	const canvasBox = await canvas.boundingBox();
	if (!canvasBox) {
		throw new Error("Plan canvas did not render");
	}
	await drawCreationWallWithMouse(
		session.page,
		{ x: canvasBox.x + 55, y: canvasBox.y + 170 },
		{ x: canvasBox.x + 155, y: canvasBox.y + 170 },
	);
	await expect(session.page.getByTestId("wall-count")).toHaveText("1 стена");

	const first = await wallClientEndpoints(session.page, 0);
	const firstRight = [first.start, first.end].sort((a, b) => b.x - a.x)[0];
	if (!firstRight) {
		throw new Error("First wall right endpoint did not render");
	}
	await drawCreationWallWithMouse(session.page, firstRight, {
		x: firstRight.x,
		y: firstRight.y + 100,
	});
	await expect(session.page.getByTestId("wall-count")).toHaveText("2 стены");

	const second = await wallClientEndpoints(session.page, 1);
	const secondBottom = [second.start, second.end].sort((a, b) => b.y - a.y)[0];
	if (!secondBottom) {
		throw new Error("Second wall lower endpoint did not render");
	}
	const currentFirst = await wallClientEndpoints(session.page, 0);
	const firstLeft = [currentFirst.start, currentFirst.end].sort(
		(a, b) => a.x - b.x,
	)[0];
	if (!firstLeft) {
		throw new Error("First wall left endpoint did not render");
	}
	await drawCreationWallWithMouse(session.page, secondBottom, {
		x: firstLeft.x,
		y: secondBottom.y,
	});
	await expect(session.page.getByTestId("wall-count")).toHaveText("3 стены");

	const third = await wallClientEndpoints(session.page, 2);
	const thirdLeft = [third.start, third.end].sort((a, b) => a.x - b.x)[0];
	const refreshedFirst = await wallClientEndpoints(session.page, 0);
	const refreshedFirstLeft = [refreshedFirst.start, refreshedFirst.end].sort(
		(a, b) => a.x - b.x,
	)[0];
	if (!thirdLeft || !refreshedFirstLeft) {
		throw new Error("Manual contour endpoints did not render");
	}
	await drawCreationWallWithMouse(session.page, thirdLeft, refreshedFirstLeft);
	await expect(session.page.getByTestId("wall-count")).toHaveText("4 стены");

	await expect(session.page.getByTestId("room-count")).toHaveText("1 комната");
	await expect(session.page.getByTestId("room-face")).toHaveCount(1);
	await expect(
		session.page.getByRole("button", { name: "3D", exact: true }),
	).toBeEnabled();

	await drawCentreCrossbar(session.page);
	await expect(session.page.getByTestId("room-count")).toHaveText("2 комнаты");
	await session.context.close();
});

test("EDITOR-E2E-02V: a manually closed 45-degree first room keeps its triangular 2D face and opens in 3D", async ({
	page: _page,
}, testInfo) => {
	const session = await openPersistentPhone(
		testInfo,
		"editor-manual-triangle-first-room",
	);
	await session.page.goto("/");
	await startNewProject(session.page, "Ручная диагональная комната");
	await chooseEditorOption(session.page, "Стена");

	const canvas = session.page.getByTestId("plan-canvas");
	const canvasBox = await canvas.boundingBox();
	if (!canvasBox) throw new Error("Plan canvas did not render");
	await drawCreationWallWithMouse(
		session.page,
		{ x: canvasBox.x + 55, y: canvasBox.y + 170 },
		{ x: canvasBox.x + 155, y: canvasBox.y + 170 },
	);
	const first = await wallClientEndpoints(session.page, 0);
	const firstRight = [first.start, first.end].sort((a, b) => b.x - a.x)[0];
	const firstLeft = [first.start, first.end].sort((a, b) => a.x - b.x)[0];
	if (!firstRight || !firstLeft) {
		throw new Error("First triangle edge did not render");
	}
	const firstLength = firstRight.x - firstLeft.x;
	await drawCreationWallWithMouse(session.page, firstRight, {
		x: firstRight.x,
		y: firstRight.y + firstLength,
	});
	const second = await wallClientEndpoints(session.page, 1);
	const secondBottom = [second.start, second.end].sort((a, b) => b.y - a.y)[0];
	const refreshedFirst = await wallClientEndpoints(session.page, 0);
	const refreshedFirstLeft = [refreshedFirst.start, refreshedFirst.end].sort(
		(a, b) => a.x - b.x,
	)[0];
	if (!secondBottom || !refreshedFirstLeft) {
		throw new Error("Triangle contour endpoints did not render");
	}
	await chooseEditorOption(session.page, "Стена");
	const cdp = await session.page.context().newCDPSession(session.page);
	try {
		await cdp.send("Input.dispatchTouchEvent", {
			touchPoints: [{ id: 73, x: secondBottom.x, y: secondBottom.y }],
			type: "touchStart",
		});
		await cdp.send("Input.dispatchTouchEvent", {
			touchPoints: [
				{ id: 73, x: refreshedFirstLeft.x, y: refreshedFirstLeft.y },
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
	await expect(session.page.getByTestId("wall-draft-actions")).toContainText(
		"диагональ 45°",
	);
	await session.page.getByRole("button", { name: "Подтвердить стену" }).click();

	await expect(session.page.getByTestId("room-count")).toHaveText("1 комната");
	await expect(session.page.getByTestId("room-face")).toHaveCount(1);
	await expect(
		session.page.locator('polygon[data-testid="room-face"]'),
	).toHaveCount(1);
	const threeDimensional = session.page.getByRole("button", {
		name: "3D",
		exact: true,
	});
	await expect(threeDimensional).toBeEnabled();
	await threeDimensional.click();
	await expect(
		session.page.getByTestId("three-dimensional-canvas"),
	).toBeVisible();
	await session.context.close();
});

test("EDITOR-E2E-02VB: a phone user can confirm the fourth 45-degree wall of a trapezoid and derive its first room", async ({
	page: _page,
}, testInfo) => {
	const session = await openPersistentPhone(
		testInfo,
		"editor-manual-trapezoid-first-room",
	);
	await session.page.goto("/");
	await startNewProject(session.page, "Трапеция с диагональю");
	await chooseEditorOption(session.page, "Стена");

	const canvasBox = await session.page.getByTestId("plan-canvas").boundingBox();
	if (!canvasBox) throw new Error("Plan canvas did not render");
	await drawCreationWallWithMouse(
		session.page,
		{ x: canvasBox.x + 55, y: canvasBox.y + 170 },
		{ x: canvasBox.x + 255, y: canvasBox.y + 170 },
	);
	await expect(session.page.getByTestId("wall-count")).toHaveText("1 стена");

	const first = await wallClientEndpoints(session.page, 0);
	const firstRight = [first.start, first.end].sort((a, b) => b.x - a.x)[0];
	if (!firstRight) throw new Error("First trapezoid edge did not render");
	await drawCreationWallWithMouse(session.page, firstRight, {
		x: firstRight.x,
		y: firstRight.y + 80,
	});
	await expect(session.page.getByTestId("wall-count")).toHaveText("2 стены");

	const second = await wallClientEndpoints(session.page, 1);
	const secondBottom = [second.start, second.end].sort((a, b) => b.y - a.y)[0];
	if (!secondBottom) throw new Error("Second trapezoid edge did not render");
	const twoWallVertices = await durablePlanVertices(session.page);
	const baseLengthMm =
		Math.max(...twoWallVertices.map((vertex) => vertex.xMm)) -
		Math.min(...twoWallVertices.map((vertex) => vertex.xMm));
	const sideLengthMm =
		Math.max(...twoWallVertices.map((vertex) => vertex.zMm)) -
		Math.min(...twoWallVertices.map((vertex) => vertex.zMm));
	const firstAfterSecond = await wallClientEndpoints(session.page, 0);
	const firstScreenLength = Math.abs(
		firstAfterSecond.end.x - firstAfterSecond.start.x,
	);
	if (baseLengthMm <= sideLengthMm || firstScreenLength <= 0) {
		throw new Error("Trapezoid construction dimensions are invalid");
	}
	// The viewport can rescale after every durable edit. Convert the exact
	// millimetre top-edge length to the current screen scale, so the final
	// segment closes an actual 45° vector rather than merely a visual diagonal.
	await drawCreationWallWithMouse(session.page, secondBottom, {
		x:
			secondBottom.x -
			((baseLengthMm - sideLengthMm) / baseLengthMm) * firstScreenLength,
		y: secondBottom.y,
	});
	await expect(session.page.getByTestId("wall-count")).toHaveText("3 стены");

	const third = await wallClientEndpoints(session.page, 2);
	const thirdLeft = [third.start, third.end].sort((a, b) => a.x - b.x)[0];
	const refreshedFirst = await wallClientEndpoints(session.page, 0);
	const refreshedFirstLeft = [refreshedFirst.start, refreshedFirst.end].sort(
		(a, b) => a.x - b.x,
	)[0];
	if (!thirdLeft || !refreshedFirstLeft) {
		throw new Error("Trapezoid closing endpoints did not render");
	}
	await chooseEditorOption(session.page, "Стена");
	const cdp = await session.page.context().newCDPSession(session.page);
	try {
		await cdp.send("Input.dispatchTouchEvent", {
			touchPoints: [{ id: 78, x: thirdLeft.x, y: thirdLeft.y }],
			type: "touchStart",
		});
		await cdp.send("Input.dispatchTouchEvent", {
			touchPoints: [
				{ id: 78, x: refreshedFirstLeft.x, y: refreshedFirstLeft.y },
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
	await expect(session.page.getByTestId("wall-draft-actions")).toContainText(
		"диагональ 45°",
	);
	await session.page.getByRole("button", { name: "Подтвердить стену" }).click();

	await expect(session.page.getByRole("alert")).toHaveCount(0);
	await expect(session.page.getByTestId("wall-count")).toHaveText("4 стены");
	await expect(session.page.getByTestId("room-count")).toHaveText("1 комната");
	await expect(session.page.getByTestId("room-face")).toHaveCount(1);
	await session.context.close();
});

test("EDITOR-E2E-02VC: a phone-drawn concave room retains legacy thickness through a legacy split, reopening and 3D", async ({
	page: _page,
}, testInfo) => {
	const session = await openPersistentPhone(
		testInfo,
		"editor-manual-concave-first-room",
	);
	await session.page.goto("/");
	await startNewProject(session.page, "Вогнутая комната");
	await chooseEditorOption(session.page, "Стена");

	const canvasBox = await session.page.getByTestId("plan-canvas").boundingBox();
	if (!canvasBox) throw new Error("Plan canvas did not render");
	await drawCreationWallByTouch(
		session.page,
		{ x: canvasBox.x + 55, y: canvasBox.y + 135 },
		{ x: canvasBox.x + 235, y: canvasBox.y + 135 },
	);
	await expect(session.page.getByTestId("wall-count")).toHaveText("1 стена");

	const first = await wallClientEndpoints(session.page, 0);
	const firstRight = [first.start, first.end].sort((a, b) => b.x - a.x)[0];
	if (!firstRight) throw new Error("First concave edge did not render");
	await drawCreationWallByTouch(session.page, firstRight, {
		x: firstRight.x,
		y: firstRight.y + 90,
	});
	await expect(session.page.getByTestId("wall-count")).toHaveText("2 стены");

	const second = await wallClientEndpoints(session.page, 1);
	const secondBottom = [second.start, second.end].sort((a, b) => b.y - a.y)[0];
	const currentFirst = await wallClientEndpoints(session.page, 0);
	const currentFirstWidth = Math.abs(currentFirst.end.x - currentFirst.start.x);
	if (!secondBottom || currentFirstWidth <= 0) {
		throw new Error("Concave step dimensions did not render");
	}
	await drawCreationWallByTouch(session.page, secondBottom, {
		x: secondBottom.x - currentFirstWidth / 2,
		y: secondBottom.y,
	});
	await expect(session.page.getByTestId("wall-count")).toHaveText("3 стены");

	const third = await wallClientEndpoints(session.page, 2);
	const thirdLeft = [third.start, third.end].sort((a, b) => a.x - b.x)[0];
	const currentSecond = await wallClientEndpoints(session.page, 1);
	const currentSecondHeight = Math.abs(
		currentSecond.end.y - currentSecond.start.y,
	);
	if (!thirdLeft || currentSecondHeight <= 0) {
		throw new Error("Concave inner corner did not render");
	}
	await drawCreationWallByTouch(session.page, thirdLeft, {
		x: thirdLeft.x,
		y: thirdLeft.y + currentSecondHeight,
	});
	await expect(session.page.getByTestId("wall-count")).toHaveText("4 стены");

	const fourth = await wallClientEndpoints(session.page, 3);
	const fourthBottom = [fourth.start, fourth.end].sort((a, b) => b.y - a.y)[0];
	const refreshedFirst = await wallClientEndpoints(session.page, 0);
	const refreshedFirstLeft = [refreshedFirst.start, refreshedFirst.end].sort(
		(a, b) => a.x - b.x,
	)[0];
	if (!fourthBottom || !refreshedFirstLeft) {
		throw new Error("Concave lower edge endpoints did not render");
	}
	await drawCreationWallByTouch(session.page, fourthBottom, {
		x: refreshedFirstLeft.x,
		y: fourthBottom.y,
	});
	await expect(session.page.getByTestId("wall-count")).toHaveText("5 стен");

	const fifth = await wallClientEndpoints(session.page, 4);
	const fifthLeft = [fifth.start, fifth.end].sort((a, b) => a.x - b.x)[0];
	const closingFirst = await wallClientEndpoints(session.page, 0);
	const closingFirstLeft = [closingFirst.start, closingFirst.end].sort(
		(a, b) => a.x - b.x,
	)[0];
	if (!fifthLeft || !closingFirstLeft) {
		throw new Error("Concave closing endpoints did not render");
	}
	await drawCreationWallByTouch(session.page, fifthLeft, closingFirstLeft);

	await expect(session.page.getByRole("alert")).toHaveCount(0);
	await expect(session.page.getByTestId("wall-segment")).toHaveCount(6);
	await expect(session.page.getByTestId("room-count")).toHaveText("1 комната");
	await expect(
		session.page.locator('polygon[data-testid="room-face"]'),
	).toHaveCount(1);
	const durableVertices = await durablePlanVertices(session.page);
	expect(durableVertices).toHaveLength(6);
	const roomId = await session.page
		.getByTestId("room-face")
		.getAttribute("data-room-id");
	if (!roomId) throw new Error("Expected a durable concave Room identity");
	const revisionsBeforeThickness = await durableRevisionCount(session.page);

	await chooseEditorOption(session.page, "Рука и выбор");
	const selectedWall = session.page.getByTestId("wall-segment").first();
	const wallId = await selectedWall.getAttribute("data-wall-id");
	if (!wallId) throw new Error("Expected a concave boundary Wall identity");
	const wallLine = session.page.locator(
		`[data-testid="wall-line"][data-wall-id="${wallId}"]`,
	);
	const strokeWidthBefore = Number(await wallLine.getAttribute("stroke-width"));
	await selectedWall.click();
	await expandSelectedWallInspector(session.page);
	await loadLegacyProjectFixture(
		session.page,
		(source) => {
			const result = changeGeneralWallThickness(
				source,
				{ wallSegmentId: wallId, thicknessMm: 120 },
				new Date().toISOString(),
			);
			if (result.kind !== "accepted")
				throw new Error("Legacy concave thickness rejected");
			return result.project;
		},
		wallId,
	);
	await expect(
		session.page.getByLabel("Толщина выбранной стены, мм"),
	).toHaveCount(0);
	await expect
		.poll(() => durableRevisionCount(session.page))
		.toBe(revisionsBeforeThickness + 1);
	expect(await durablePlanVertices(session.page)).toEqual(durableVertices);
	await expect(session.page.getByTestId("room-face")).toHaveAttribute(
		"data-room-id",
		roomId,
	);
	expect(Number(await wallLine.getAttribute("stroke-width"))).toBeGreaterThan(
		strokeWidthBefore,
	);
	const revisionsBeforeSplit = await durableRevisionCount(session.page);
	await loadLegacySplitWallFixture(session.page);
	await expect(session.page.getByTestId("wall-segment")).toHaveCount(7);
	await expect
		.poll(() => durableRevisionCount(session.page))
		.toBe(revisionsBeforeSplit + 1);
	const durableVerticesAfterSplit = await durablePlanVertices(session.page);
	expect(durableVerticesAfterSplit).toHaveLength(7);
	await expect(
		session.page.locator(
			`[data-testid="wall-segment"][data-wall-id="${wallId}"]`,
		),
	).toHaveCount(1);
	await expect(session.page.getByTestId("room-face")).toHaveAttribute(
		"data-room-id",
		roomId,
	);

	await chooseEditorOption(session.page, "3D");
	await expect(
		session.page.getByTestId("three-dimensional-canvas"),
	).toBeVisible();
	await chooseEditorOption(session.page, "План 2D");
	await session.page.reload();
	await openProjectFromHub(session.page, "Вогнутая комната");
	await expect(session.page.getByTestId("wall-count")).toHaveText("7 стен");
	await expect(session.page.getByTestId("room-count")).toHaveText("1 комната");
	await expect(
		session.page.locator('polygon[data-testid="room-face"]'),
	).toHaveCount(1);
	await expect(session.page.getByTestId("room-face")).toHaveAttribute(
		"data-room-id",
		roomId,
	);
	await expect
		.poll(() => durableRevisionCount(session.page))
		.toBe(revisionsBeforeThickness + 2);
	expect(await durablePlanVertices(session.page)).toEqual(
		durableVerticesAfterSplit,
	);
	await chooseEditorOption(session.page, "Рука и выбор");
	await session.page
		.locator(`[data-testid="wall-segment"][data-wall-id="${wallId}"]`)
		.click();
	await expect(
		session.page.getByLabel("Толщина выбранной стены, мм"),
	).toHaveCount(0);
	await expect(
		session.page.getByRole("button", { name: "3D", exact: true }),
	).toBeEnabled();
	await chooseEditorOption(session.page, "3D");
	await expect(
		session.page.getByTestId("three-dimensional-canvas"),
	).toBeVisible();
	await session.context.close();
});

test("EDITOR-E2E-02VD: a phone user divides the rectangular arm of an L-shaped Room and reopens both Rooms", async ({
	page: _page,
}, testInfo) => {
	const session = await openPersistentPhone(
		testInfo,
		"editor-concave-rectangular-successor",
	);
	await session.page.goto("/");
	await startNewProject(session.page, "Деление Г-образной комнаты");
	await chooseEditorOption(session.page, "Стена");

	const canvasBox = await session.page.getByTestId("plan-canvas").boundingBox();
	if (!canvasBox) throw new Error("Plan canvas did not render");
	await drawCreationWallByTouch(
		session.page,
		{ x: canvasBox.x + 55, y: canvasBox.y + 135 },
		{ x: canvasBox.x + 235, y: canvasBox.y + 135 },
	);
	const first = await wallClientEndpoints(session.page, 0);
	const firstRight = [first.start, first.end].sort((a, b) => b.x - a.x)[0];
	if (!firstRight) throw new Error("First L-shaped edge did not render");
	await drawCreationWallByTouch(session.page, firstRight, {
		x: firstRight.x,
		y: firstRight.y + 90,
	});

	const second = await wallClientEndpoints(session.page, 1);
	const secondBottom = [second.start, second.end].sort((a, b) => b.y - a.y)[0];
	const currentFirst = await wallClientEndpoints(session.page, 0);
	const currentFirstWidth = Math.abs(currentFirst.end.x - currentFirst.start.x);
	if (!secondBottom || currentFirstWidth <= 0) {
		throw new Error("L-shaped step dimensions did not render");
	}
	await drawCreationWallByTouch(session.page, secondBottom, {
		x: secondBottom.x - currentFirstWidth / 2,
		y: secondBottom.y,
	});

	const third = await wallClientEndpoints(session.page, 2);
	const thirdLeft = [third.start, third.end].sort((a, b) => a.x - b.x)[0];
	const currentSecond = await wallClientEndpoints(session.page, 1);
	const currentSecondHeight = Math.abs(
		currentSecond.end.y - currentSecond.start.y,
	);
	if (!thirdLeft || currentSecondHeight <= 0) {
		throw new Error("L-shaped inner corner did not render");
	}
	await drawCreationWallByTouch(session.page, thirdLeft, {
		x: thirdLeft.x,
		y: thirdLeft.y + currentSecondHeight,
	});

	const fourth = await wallClientEndpoints(session.page, 3);
	const fourthBottom = [fourth.start, fourth.end].sort((a, b) => b.y - a.y)[0];
	const refreshedFirst = await wallClientEndpoints(session.page, 0);
	const refreshedFirstLeft = [refreshedFirst.start, refreshedFirst.end].sort(
		(a, b) => a.x - b.x,
	)[0];
	if (!fourthBottom || !refreshedFirstLeft) {
		throw new Error("L-shaped lower edge endpoints did not render");
	}
	await drawCreationWallByTouch(session.page, fourthBottom, {
		x: refreshedFirstLeft.x,
		y: fourthBottom.y,
	});

	const fifth = await wallClientEndpoints(session.page, 4);
	const fifthLeft = [fifth.start, fifth.end].sort((a, b) => a.x - b.x)[0];
	const closingFirst = await wallClientEndpoints(session.page, 0);
	const closingFirstLeft = [closingFirst.start, closingFirst.end].sort(
		(a, b) => a.x - b.x,
	)[0];
	if (!fifthLeft || !closingFirstLeft) {
		throw new Error("L-shaped closing endpoints did not render");
	}
	await drawCreationWallByTouch(session.page, fifthLeft, closingFirstLeft);

	await expect(session.page.getByTestId("wall-count")).toHaveText("6 стен");
	await expect(session.page.getByTestId("room-count")).toHaveText("1 комната");
	const roomId = await session.page
		.getByTestId("room-face")
		.getAttribute("data-room-id");
	if (!roomId) throw new Error("Expected a durable L-shaped Room identity");

	const outerBottom = await wallClientEndpoints(session.page, 0);
	const innerTop = await wallClientEndpoints(session.page, 2);
	const outerLeft = [outerBottom.start, outerBottom.end].sort(
		(a, b) => a.x - b.x,
	)[0];
	const outerRight = [outerBottom.start, outerBottom.end].sort(
		(a, b) => b.x - a.x,
	)[0];
	if (!outerLeft || !outerRight) {
		throw new Error("L-shaped split boundary did not render");
	}
	const dividerX = outerLeft.x + (outerRight.x - outerLeft.x) * 0.75;
	const revisionsBeforeSplit = await durableRevisionCount(session.page);
	await drawCreationWallByTouch(
		session.page,
		{
			x: dividerX,
			y: (outerBottom.start.y + outerBottom.end.y) / 2,
		},
		{
			x: dividerX,
			y: (innerTop.start.y + innerTop.end.y) / 2,
		},
	);

	await expect(session.page.getByRole("alert")).toHaveCount(0);
	await expect(session.page.getByTestId("wall-count")).toHaveText("9 стен");
	await expect(session.page.getByTestId("room-count")).toHaveText("2 комнаты");
	await expect
		.poll(() => durableRevisionCount(session.page))
		.toBe(revisionsBeforeSplit + 1);
	await expect(
		session.page.locator(`[data-testid="room-face"][data-room-id="${roomId}"]`),
	).toHaveCount(1);

	await session.page.reload();
	await openProjectFromHub(session.page, "Деление Г-образной комнаты");
	await expect(session.page.getByTestId("wall-count")).toHaveText("9 стен");
	await expect(session.page.getByTestId("room-count")).toHaveText("2 комнаты");
	await expect(
		session.page.locator(`[data-testid="room-face"][data-room-id="${roomId}"]`),
	).toHaveCount(1);
	await chooseEditorOption(session.page, "3D");
	await expect(
		session.page.getByTestId("three-dimensional-canvas"),
	).toBeVisible();
	await session.context.close();
});

test("PLAN-E2E-04K: a phone user can cancel and durably move a closed-room corner onto its exact 45-degree line", async ({
	page: _page,
}, testInfo) => {
	const session = await openPersistentPhone(
		testInfo,
		"editor-touch-move-closed-room-corner",
	);
	await session.page.goto("/");
	await startNewProject(session.page, "Правка угла комнаты");
	await chooseEditorOption(session.page, "Стена");

	const canvasBox = await session.page.getByTestId("plan-canvas").boundingBox();
	if (!canvasBox) throw new Error("Plan canvas did not render");
	await drawCreationWallByTouch(
		session.page,
		{ x: canvasBox.x + 55, y: canvasBox.y + 135 },
		{ x: canvasBox.x + 235, y: canvasBox.y + 135 },
	);
	const first = await wallClientEndpoints(session.page, 0);
	const firstRight = [first.start, first.end].sort((a, b) => b.x - a.x)[0];
	const firstEdgeWidth = Math.abs(first.end.x - first.start.x);
	if (!firstRight || firstEdgeWidth <= 0) {
		throw new Error("First concave edge did not render");
	}
	await drawCreationWallByTouch(session.page, firstRight, {
		x: firstRight.x,
		y: firstRight.y + firstEdgeWidth / 2,
	});
	const second = await wallClientEndpoints(session.page, 1);
	const secondBottom = [second.start, second.end].sort((a, b) => b.y - a.y)[0];
	const currentSecondHeight = Math.abs(second.end.y - second.start.y);
	if (!secondBottom || currentSecondHeight <= 0) {
		throw new Error("Concave step dimensions did not render");
	}
	await drawCreationWallByTouch(session.page, secondBottom, {
		x: secondBottom.x - currentSecondHeight,
		y: secondBottom.y,
	});
	const third = await wallClientEndpoints(session.page, 2);
	const thirdLeft = [third.start, third.end].sort((a, b) => a.x - b.x)[0];
	const refreshedSecond = await wallClientEndpoints(session.page, 1);
	const refreshedSecondHeight = Math.abs(
		refreshedSecond.end.y - refreshedSecond.start.y,
	);
	if (!thirdLeft || refreshedSecondHeight <= 0) {
		throw new Error("Concave inner corner did not render");
	}
	await drawCreationWallByTouch(session.page, thirdLeft, {
		x: thirdLeft.x,
		y: thirdLeft.y + refreshedSecondHeight,
	});
	const fourth = await wallClientEndpoints(session.page, 3);
	const fourthBottom = [fourth.start, fourth.end].sort((a, b) => b.y - a.y)[0];
	const refreshedFirst = await wallClientEndpoints(session.page, 0);
	const refreshedFirstLeft = [refreshedFirst.start, refreshedFirst.end].sort(
		(a, b) => a.x - b.x,
	)[0];
	if (!fourthBottom || !refreshedFirstLeft) {
		throw new Error("Concave lower edge endpoints did not render");
	}
	await drawCreationWallByTouch(session.page, fourthBottom, {
		x: refreshedFirstLeft.x,
		y: fourthBottom.y,
	});
	const fifth = await wallClientEndpoints(session.page, 4);
	const fifthLeft = [fifth.start, fifth.end].sort((a, b) => a.x - b.x)[0];
	const closingFirst = await wallClientEndpoints(session.page, 0);
	const closingFirstLeft = [closingFirst.start, closingFirst.end].sort(
		(a, b) => a.x - b.x,
	)[0];
	if (!fifthLeft || !closingFirstLeft) {
		throw new Error("Concave closing endpoints did not render");
	}
	await drawCreationWallByTouch(session.page, fifthLeft, closingFirstLeft);
	await expect(session.page.getByTestId("room-count")).toHaveText("1 комната");
	const verticesBeforeMove = await durablePlanVertices(session.page);
	const horizontalAnchor = verticesBeforeMove[2];
	const innerCorner = verticesBeforeMove[3];
	const verticalAnchor = verticesBeforeMove[4];
	if (!horizontalAnchor || !innerCorner || !verticalAnchor) {
		throw new Error("Expected the two anchors around the concave corner");
	}
	expect(Math.abs(horizontalAnchor.xMm - verticalAnchor.xMm)).toBe(
		Math.abs(horizontalAnchor.zMm - verticalAnchor.zMm),
	);
	expect(horizontalAnchor.xMm + horizontalAnchor.zMm).toBe(
		verticalAnchor.xMm + verticalAnchor.zMm,
	);
	const roomId = await session.page
		.getByTestId("room-face")
		.getAttribute("data-room-id");
	expect(roomId).toBeTruthy();

	await chooseEditorOption(session.page, "Рука и выбор");
	await session.page.getByTestId("wall-segment").nth(2).click();
	await expandSelectedWallInspector(session.page);
	await session.page
		.getByRole("button", { name: "Переместить вершину жестом" })
		.click({ timeout: 5000 });
	const handles = session.page.getByTestId("wall-vertex-move-handle");
	await expect(handles).toHaveCount(2);
	const innerHandle = session.page.locator(
		`[data-testid="wall-vertex-move-handle"][data-wall-vertex-id="${innerCorner.vertexId}"]`,
	);
	await expect(innerHandle).toHaveCount(1);
	const innerHandleBox = await innerHandle.boundingBox();
	const selectedEdge = await wallClientEndpoints(session.page, 2);
	const halfEdgeWidth = Math.abs(selectedEdge.end.x - selectedEdge.start.x) / 2;
	if (!innerHandleBox || halfEdgeWidth <= 0) {
		throw new Error("Closed-room corner handle did not render");
	}
	expect(innerHandleBox.width).toBeGreaterThanOrEqual(44);
	expect(innerHandleBox.height).toBeGreaterThanOrEqual(44);
	const dragCorner = async () => {
		const centreX = innerHandleBox.x + innerHandleBox.width / 2;
		const centreY = innerHandleBox.y + innerHandleBox.height / 2;
		await dragPlanControlByTouch(
			session.page,
			{ x: centreX, y: centreY },
			{ x: centreX + halfEdgeWidth, y: centreY + halfEdgeWidth },
		);
	};
	const revisionsBeforeMove = await durableRevisionCount(session.page);
	await dragCorner();
	const draft = session.page.getByTestId("wall-vertex-move-draft");
	await expect(draft).toBeVisible();
	await expect(
		session.page.getByTestId("wall-vertex-move-preview"),
	).toHaveCount(2);
	expect(await durableRevisionCount(session.page)).toBe(revisionsBeforeMove);
	await draft.getByRole("button", { name: "Отменить перенос вершины" }).click();
	expect(await durableRevisionCount(session.page)).toBe(revisionsBeforeMove);

	await expandSelectedWallInspector(session.page);
	await session.page
		.getByRole("button", { name: "Переместить вершину жестом" })
		.click();
	const durableHandleBox = await session.page
		.locator(
			`[data-testid="wall-vertex-move-handle"][data-wall-vertex-id="${innerCorner.vertexId}"]`,
		)
		.boundingBox();
	const durableSelectedEdge = await wallClientEndpoints(session.page, 2);
	if (!durableHandleBox)
		throw new Error("Durable corner handle did not render");
	const durableHalfEdgeWidth =
		Math.abs(durableSelectedEdge.end.x - durableSelectedEdge.start.x) / 2;
	const durableCentreX = durableHandleBox.x + durableHandleBox.width / 2;
	const durableCentreY = durableHandleBox.y + durableHandleBox.height / 2;
	await dragPlanControlByTouch(
		session.page,
		{ x: durableCentreX, y: durableCentreY },
		{
			x: durableCentreX + durableHalfEdgeWidth,
			y: durableCentreY + durableHalfEdgeWidth,
		},
	);
	await expect(draft).toBeVisible();
	await draft
		.getByRole("button", { name: "Подтвердить перенос вершины" })
		.click();
	await expect(draft).toHaveCount(0);
	expect(await durableRevisionCount(session.page)).toBe(
		revisionsBeforeMove + 1,
	);
	await expect(session.page.getByTestId("room-face")).toHaveAttribute(
		"data-room-id",
		roomId ?? "",
	);
	const verticesAfterMove = await durablePlanVertices(session.page);
	const movedCorner = verticesAfterMove.find(
		(vertex) => vertex.vertexId === innerCorner.vertexId,
	);
	if (!movedCorner) throw new Error("Moved corner did not remain durable");
	expect(movedCorner).not.toEqual(innerCorner);
	expect((movedCorner.xMm - innerCorner.xMm) % 100).toBe(0);
	expect((movedCorner.zMm - innerCorner.zMm) % 100).toBe(0);
	expect(movedCorner.xMm + movedCorner.zMm).toBe(
		horizontalAnchor.xMm + horizontalAnchor.zMm,
	);

	await session.page.reload();
	await openProjectFromHub(session.page, "Правка угла комнаты");
	await expect(session.page.getByTestId("wall-count")).toHaveText("6 стен");
	expect(await durablePlanVertices(session.page)).toEqual(verticesAfterMove);
	await expect(session.page.getByTestId("room-face")).toHaveAttribute(
		"data-room-id",
		roomId ?? "",
	);
	await chooseEditorOption(session.page, "3D");
	await expect(
		session.page.getByTestId("three-dimensional-canvas"),
	).toBeVisible();
	await session.context.close();
});

test("EDITOR-E2E-02VA: a complete item footprint can be durably placed inside the usable triangle and reopened in 3D", async ({
	page: _page,
}, testInfo) => {
	const session = await openPersistentPhone(
		testInfo,
		"editor-triangle-item-placement",
	);
	await session.page.goto("/");
	await startNewProject(session.page, "Предмет в треугольной комнате");
	await chooseEditorOption(session.page, "Стена");

	const canvas = session.page.getByTestId("plan-canvas");
	const canvasBox = await canvas.boundingBox();
	if (!canvasBox) throw new Error("Plan canvas did not render");
	await drawCreationWallWithMouse(
		session.page,
		{ x: canvasBox.x + 55, y: canvasBox.y + 170 },
		{ x: canvasBox.x + 155, y: canvasBox.y + 170 },
	);
	const first = await wallClientEndpoints(session.page, 0);
	const firstRight = [first.start, first.end].sort((a, b) => b.x - a.x)[0];
	const firstLeft = [first.start, first.end].sort((a, b) => a.x - b.x)[0];
	if (!firstRight || !firstLeft) {
		throw new Error("First triangle edge did not render");
	}
	const firstLength = firstRight.x - firstLeft.x;
	await drawCreationWallWithMouse(session.page, firstRight, {
		x: firstRight.x,
		y: firstRight.y + firstLength,
	});
	const second = await wallClientEndpoints(session.page, 1);
	const secondBottom = [second.start, second.end].sort((a, b) => b.y - a.y)[0];
	const refreshedFirst = await wallClientEndpoints(session.page, 0);
	const refreshedFirstLeft = [refreshedFirst.start, refreshedFirst.end].sort(
		(a, b) => a.x - b.x,
	)[0];
	if (!secondBottom || !refreshedFirstLeft) {
		throw new Error("Triangle contour endpoints did not render");
	}
	await chooseEditorOption(session.page, "Стена");
	const cdp = await session.page.context().newCDPSession(session.page);
	try {
		await cdp.send("Input.dispatchTouchEvent", {
			touchPoints: [{ id: 75, x: secondBottom.x, y: secondBottom.y }],
			type: "touchStart",
		});
		await cdp.send("Input.dispatchTouchEvent", {
			touchPoints: [
				{ id: 75, x: refreshedFirstLeft.x, y: refreshedFirstLeft.y },
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
	await session.page.getByRole("button", { name: "Подтвердить стену" }).click();

	const triangle = session.page.locator('polygon[data-testid="room-face"]');
	await expect(triangle).toHaveCount(1);
	const vertices = await durablePlanVertices(session.page);
	const minX = Math.min(...vertices.map((vertex) => vertex.xMm));
	const maxX = Math.max(...vertices.map((vertex) => vertex.xMm));
	const minZ = Math.min(...vertices.map((vertex) => vertex.zMm));
	const maxZ = Math.max(...vertices.map((vertex) => vertex.zMm));
	// "Деревянный комод" is 800 × 422 mm. Keep an additional 50 mm
	// clearance after snap-to-100-mm so every rotated-footprint check remains
	// safely inside the 50-mm inset triangle.
	const itemWidthMm = 800;
	const itemDepthMm = 422;
	const targetX = Math.floor((maxX - 50 - itemWidthMm / 2 - 50) / 100) * 100;
	const targetZ = Math.ceil((minZ + 50 + itemDepthMm / 2 + 50) / 100) * 100;
	if (
		targetX - targetZ <
			minX - minZ + 50 * Math.SQRT2 + itemWidthMm / 2 + itemDepthMm / 2 ||
		targetX > maxX ||
		targetZ > maxZ
	) {
		throw new Error("Triangle is too small for the selected item footprint");
	}
	await chooseBuiltInGreybox(session.page, "Деревянный комод", false);
	const planPoint = await planPointMm(session.page, {
		xMm: targetX,
		zMm: targetZ,
	});
	await session.page.mouse.click(planPoint.x, planPoint.y);
	const preview = session.page.getByTestId("item-placement-preview");
	await expect(preview).toHaveAttribute("data-placement-valid", "true");
	const revisionsBefore = await durableRevisionCount(session.page);
	await session.page
		.getByRole("button", { name: "Подтвердить размещение предмета" })
		.click();
	await expect(session.page.getByTestId("item-count")).toHaveText("1 предмет");
	expect(await durableRevisionCount(session.page)).toBe(revisionsBefore + 1);

	await session.page.reload();
	await openProjectFromHub(session.page, "Предмет в треугольной комнате");
	await expect(session.page.getByTestId("item-count")).toHaveText("1 предмет");
	await chooseEditorOption(session.page, "3D");
	await expect(
		session.page.getByTestId("three-dimensional-canvas"),
	).toBeVisible();
	await expect(
		session.page.getByText("1 предмет в плане", { exact: true }),
	).toHaveText("1 предмет в плане");
	await expect(
		session.page.getByText("1 предмет в плане", { exact: true }),
	).toBeHidden();
	await session.context.close();
});

test("EDITOR-E2E-02W: a touch-drawn 45-degree split keeps chosen Room metadata and shows two exact triangular rooms", async ({
	page: _page,
}, testInfo) => {
	const session = await openPersistentPhone(
		testInfo,
		"editor-square-diagonal-room-split",
	);
	await session.page.goto("/");
	await startNewProject(session.page, "Диагональное деление");
	await session.page.getByLabel("Ширина, мм").fill("3000");
	await session.page.getByLabel("Глубина, мм").fill("3000");
	await session.page.getByRole("button", { name: "Создать контур" }).click();
	await chooseEditorOption(session.page, "Стена");
	const predecessorRoomId = await session.page
		.getByTestId("room-face")
		.getAttribute("data-room-id");
	if (!predecessorRoomId) {
		throw new Error("Expected the square predecessor Room identity");
	}

	const endpoints = (
		await Promise.all(
			[0, 1, 2, 3].map((index) => wallClientEndpoints(session.page, index)),
		)
	).flatMap((wall) => [wall.start, wall.end]);
	const start = [...endpoints].sort(
		(first, second) => first.x + first.y - (second.x + second.y),
	)[0];
	const end = [...endpoints].sort(
		(first, second) => second.x + second.y - (first.x + first.y),
	)[0];
	if (!start || !end) throw new Error("Square corner targets did not render");

	const revisionsBefore = await durableRevisionCount(session.page);
	const cdp = await session.page.context().newCDPSession(session.page);
	try {
		await cdp.send("Input.dispatchTouchEvent", {
			touchPoints: [{ id: 74, x: start.x, y: start.y }],
			type: "touchStart",
		});
		await cdp.send("Input.dispatchTouchEvent", {
			touchPoints: [{ id: 74, x: end.x, y: end.y }],
			type: "touchMove",
		});
		await cdp.send("Input.dispatchTouchEvent", {
			touchPoints: [],
			type: "touchEnd",
		});
	} finally {
		await cdp.detach();
	}

	await expect(session.page.getByTestId("wall-draft-actions")).toContainText(
		"диагональ 45°",
	);
	await session.page.getByRole("button", { name: "Подтвердить стену" }).click();
	const preview = session.page.getByTestId("room-metadata-conflict-preview");
	await expect(preview).toHaveCount(0);
	await expect(session.page.getByTestId("wall-segment")).toHaveCount(5);
	await expect(session.page.getByTestId("room-count")).toHaveText("2 комнаты");
	await expect(
		session.page.locator('polygon[data-testid="room-face"]'),
	).toHaveCount(2);
	await expect(
		session.page.locator(
			`[data-testid="room-face"][data-room-id="${predecessorRoomId}"]`,
		),
	).toHaveCount(1);
	expect(await durableRevisionCount(session.page)).toBeGreaterThan(
		revisionsBefore,
	);
	await session.page.reload();
	await openProjectFromHub(session.page, "Диагональное деление");
	await expect(session.page.getByTestId("room-count")).toHaveText("2 комнаты");
	await expect(
		session.page.locator(
			`[data-testid="room-face"][data-room-id="${predecessorRoomId}"]`,
		),
	).toHaveCount(1);
	const threeDimensional = session.page.getByRole("button", {
		name: "3D",
		exact: true,
	});
	await expect(threeDimensional).toBeEnabled();
	await threeDimensional.click();
	await expect(
		session.page.getByTestId("three-dimensional-canvas"),
	).toBeVisible();
	await session.context.close();
});

test("EDITOR-E2E-02WD: a phone user splits an already diagonal Room and reopens all three Rooms", async ({
	page: _page,
}, testInfo) => {
	const session = await openPersistentPhone(
		testInfo,
		"editor-post-diagonal-room-split",
	);
	await session.page.goto("/");
	await startNewProject(session.page, "Комната после диагонального деления");
	await session.page.getByLabel("Ширина, мм").fill("3000");
	await session.page.getByLabel("Глубина, мм").fill("3000");
	await session.page.getByRole("button", { name: "Создать контур" }).click();
	await chooseEditorOption(session.page, "Стена");

	const squareEndpoints = (
		await Promise.all(
			[0, 1, 2, 3].map((index) => wallClientEndpoints(session.page, index)),
		)
	).flatMap((wall) => [wall.start, wall.end]);
	const diagonalStart = [...squareEndpoints].sort(
		(first, second) => first.x + first.y - (second.x + second.y),
	)[0];
	const diagonalEnd = [...squareEndpoints].sort(
		(first, second) => second.x + second.y - (first.x + first.y),
	)[0];
	if (!diagonalStart || !diagonalEnd) {
		throw new Error("Square corner targets did not render");
	}
	await drawCreationWallByTouch(session.page, diagonalStart, diagonalEnd);
	await expect(session.page.getByTestId("wall-count")).toHaveText("5 стен");
	await expect(session.page.getByTestId("room-count")).toHaveText("2 комнаты");

	const diagonal = await wallClientEndpoints(session.page, 4);
	const diagonalFirst =
		diagonal.start.x <= diagonal.end.x ? diagonal.start : diagonal.end;
	const diagonalSecond =
		diagonal.start.x <= diagonal.end.x ? diagonal.end : diagonal.start;
	const fraction = 2400 / 3100;
	const diagonalContact = {
		x: diagonalFirst.x + (diagonalSecond.x - diagonalFirst.x) * fraction,
		y: diagonalFirst.y + (diagonalSecond.y - diagonalFirst.y) * fraction,
	};
	const horizontalBounds = (await exteriorWallBounds(session.page))
		.filter((box) => box.width > box.height)
		.sort((first, second) => first.top - second.top);
	const bottom = horizontalBounds.at(-1);
	if (!bottom) throw new Error("Square boundary did not render");
	const boundaryContact = {
		x: bottom.left + bottom.width * fraction,
		y: bottom.top + bottom.height / 2,
	};
	const revisionsBeforeSecondSplit = await durableRevisionCount(session.page);
	await drawCreationWallByTouch(session.page, boundaryContact, diagonalContact);

	await expect(session.page.getByTestId("wall-count")).toHaveText("8 стен");
	await expect(session.page.getByTestId("room-count")).toHaveText("3 комнаты");
	await expect
		.poll(() => durableRevisionCount(session.page))
		.toBe(revisionsBeforeSecondSplit + 1);
	await session.page.reload();
	await openProjectFromHub(session.page, "Комната после диагонального деления");
	await expect(session.page.getByTestId("wall-count")).toHaveText("8 стен");
	await expect(session.page.getByTestId("room-count")).toHaveText("3 комнаты");
	await chooseEditorOption(session.page, "3D");
	await expect(
		session.page.getByTestId("three-dimensional-canvas"),
	).toBeVisible();
	await session.context.close();
});

test("EDITOR-E2E-02Y: a diagonal Door is safely edited before its explicit composed deletion", async ({
	page: _page,
}, testInfo) => {
	const session = await openPersistentPhone(
		testInfo,
		"editor-square-diagonal-door",
	);
	await session.page.goto("/");
	await startNewProject(session.page, "Дверь в диагональной стене");
	await session.page.getByLabel("Ширина, мм").fill("3000");
	await session.page.getByLabel("Глубина, мм").fill("3000");
	await session.page.getByRole("button", { name: "Создать контур" }).click();
	await chooseEditorOption(session.page, "Стена");

	const endpoints = (
		await Promise.all(
			[0, 1, 2, 3].map((index) => wallClientEndpoints(session.page, index)),
		)
	).flatMap((wall) => [wall.start, wall.end]);
	const start = [...endpoints].sort(
		(first, second) => first.x + first.y - (second.x + second.y),
	)[0];
	const end = [...endpoints].sort(
		(first, second) => second.x + second.y - (first.x + first.y),
	)[0];
	if (!start || !end) throw new Error("Square corner targets did not render");

	const cdp = await session.page.context().newCDPSession(session.page);
	try {
		await cdp.send("Input.dispatchTouchEvent", {
			touchPoints: [{ id: 76, x: start.x, y: start.y }],
			type: "touchStart",
		});
		await cdp.send("Input.dispatchTouchEvent", {
			touchPoints: [{ id: 76, x: end.x, y: end.y }],
			type: "touchMove",
		});
		await cdp.send("Input.dispatchTouchEvent", {
			touchPoints: [],
			type: "touchEnd",
		});
	} finally {
		await cdp.detach();
	}
	await session.page.getByRole("button", { name: "Подтвердить стену" }).click();
	const splitConflict = session.page.getByTestId(
		"room-metadata-conflict-preview",
	);
	await expect(splitConflict).toHaveCount(0);

	const diagonal = session.page.locator(
		'[data-testid="wall-segment"][data-wall-kind="interior"]',
	);
	await expect(diagonal).toHaveCount(1);
	await chooseEditorOption(session.page, "Рука и выбор");
	await clickWallOutsideOpeningHandle(diagonal);
	const revisionsBeforeDoor = await durableRevisionCount(session.page);
	await loadOpeningFixtureOnSelectedWall(session.page, {
		heightMm: 2100,
		kind: "Door",
		offsetMm: 2000,
		sillMm: 0,
		widthMm: 900,
	});
	await expect(session.page.getByTestId("door-opening")).toHaveCount(1);
	await expect(session.page.getByTestId("door-leaf")).toHaveCount(0);
	await expect(session.page.getByTestId("door-swing")).toHaveCount(0);
	expect(await durableRevisionCount(session.page)).toBe(
		revisionsBeforeDoor + 1,
	);
	const [doorBeforeEdit] = await durableDoorOpenings(session.page);
	if (!doorBeforeEdit) throw new Error("Expected a durable diagonal Door");
	await expandSelectedWallInspector(session.page);
	await session.page
		.getByRole("button", { name: "Изменить проём", exact: true })
		.click();
	const doorDraft = session.page.getByTestId("opening-draft");
	await expect(doorDraft).toBeVisible();
	await doorDraft.getByLabel("Ширина дверного проёма, мм").fill("10000");
	await doorDraft
		.getByRole("button", { name: "Сохранить проём", exact: true })
		.click();
	await expect(doorDraft.getByRole("alert")).toContainText(
		"Ширина дверного проёма не может превышать длину выбранной стены.",
	);
	expect(await durableRevisionCount(session.page)).toBe(
		revisionsBeforeDoor + 1,
	);
	await doorDraft.getByLabel("Ширина дверного проёма, мм").fill("1300");
	await doorDraft
		.getByRole("button", { name: "Сохранить проём", exact: true })
		.click();
	await expect(doorDraft).toHaveCount(0);
	await expect
		.poll(() => durableRevisionCount(session.page))
		.toBe(revisionsBeforeDoor + 2);
	await expect
		.poll(() => durableDoorOpenings(session.page))
		.toEqual([
			{
				...doorBeforeEdit,
				widthMm: 1300,
			},
		]);
	await session.page.reload();
	await openProjectFromHub(session.page, "Дверь в диагональной стене");
	await expect(session.page.getByTestId("door-opening")).toHaveCount(1);
	const threeDimensional = session.page.getByRole("button", {
		name: "3D",
		exact: true,
	});
	await threeDimensional.click();
	await expect(
		session.page.getByTestId("three-dimensional-canvas"),
	).toBeVisible({ timeout: 15_000 });
	await session.page
		.getByRole("button", { name: "План 2D", exact: true })
		.click();
	await clickWallOutsideOpeningHandle(diagonal);
	await expandSelectedWallInspector(session.page);
	await session.page
		.getByRole("button", { name: "Удалить стену", exact: true })
		.click();
	const consequences = session.page.getByTestId("opening-conflict-preview");
	await expect(consequences).toContainText("1 проём");
	await expect(
		consequences.getByRole("button", {
			name: /Удалить стену и 1 проём и изменить 2 помещения/,
		}),
	).toBeDisabled();
	await consequences.getByTestId("wall-deletion-metadata-1").click();
	await consequences
		.getByRole("button", {
			name: /Удалить стену и 1 проём и изменить 2 помещения/,
		})
		.click();
	await expect(consequences).toHaveCount(0);
	await expect(session.page.getByTestId("door-opening")).toHaveCount(0);
	await expect(session.page.getByTestId("wall-count")).toHaveText("4 стены");
	expect(await durableRevisionCount(session.page)).toBe(
		revisionsBeforeDoor + 3,
	);
	await session.context.close();
});

test("EDITOR-E2E-02X: removing a diagonal through touch keeps one chosen Room and restores the square", async ({
	page: _page,
}, testInfo) => {
	const session = await openPersistentPhone(
		testInfo,
		"editor-square-diagonal-room-merge",
	);
	await session.page.goto("/");
	await startNewProject(session.page, "Удаление диагонального деления");
	await session.page.getByLabel("Ширина, мм").fill("3000");
	await session.page.getByLabel("Глубина, мм").fill("3000");
	await session.page.getByRole("button", { name: "Создать контур" }).click();
	await chooseEditorOption(session.page, "Стена");

	const endpoints = (
		await Promise.all(
			[0, 1, 2, 3].map((index) => wallClientEndpoints(session.page, index)),
		)
	).flatMap((wall) => [wall.start, wall.end]);
	const start = [...endpoints].sort(
		(first, second) => first.x + first.y - (second.x + second.y),
	)[0];
	const end = [...endpoints].sort(
		(first, second) => second.x + second.y - (first.x + first.y),
	)[0];
	if (!start || !end) throw new Error("Square corner targets did not render");

	const cdp = await session.page.context().newCDPSession(session.page);
	try {
		await cdp.send("Input.dispatchTouchEvent", {
			touchPoints: [{ id: 75, x: start.x, y: start.y }],
			type: "touchStart",
		});
		await cdp.send("Input.dispatchTouchEvent", {
			touchPoints: [{ id: 75, x: end.x, y: end.y }],
			type: "touchMove",
		});
		await cdp.send("Input.dispatchTouchEvent", {
			touchPoints: [],
			type: "touchEnd",
		});
	} finally {
		await cdp.detach();
	}
	await session.page.getByRole("button", { name: "Подтвердить стену" }).click();
	const splitConflict = session.page.getByTestId(
		"room-metadata-conflict-preview",
	);
	await expect(splitConflict).toHaveCount(0);
	await expect(session.page.getByTestId("room-count")).toHaveText("2 комнаты");

	const revisionsAfterSplit = await durableRevisionCount(session.page);
	const diagonal = session.page.locator(
		'[data-testid="wall-segment"][data-wall-kind="interior"]',
	);
	await expect(diagonal).toHaveCount(1);
	await chooseEditorOption(session.page, "Рука и выбор");
	await diagonal.click();
	await expandSelectedWallInspector(session.page);
	const deleteWall = session.page
		.getByTestId("selected-wall-inspector")
		.getByRole("button", { name: "Удалить стену", exact: true });
	await expect(deleteWall).toBeVisible();
	await deleteWall.click();

	const consequences = session.page.getByTestId("opening-conflict-preview");
	await expect(consequences).toBeVisible();
	await expect(consequences).toContainText(
		"чьи тип, высота и история останутся",
	);
	await expect(
		consequences.getByRole("button", {
			name: /Удалить стену и изменить 2 помещения/,
		}),
	).toBeDisabled();
	await consequences
		.getByRole("button", { name: "Отмена", exact: true })
		.click();
	await expect(consequences).toHaveCount(0);
	expect(await durableRevisionCount(session.page)).toBe(revisionsAfterSplit);
	await expect(diagonal).toHaveCount(1);

	await deleteWall.click();
	await expect(consequences).toBeVisible();
	await consequences.getByTestId("wall-deletion-metadata-1").click();
	await consequences
		.getByRole("button", { name: /Удалить стену и изменить 2 помещения/ })
		.click();
	await expect(consequences).toHaveCount(0);
	await expect(session.page.getByTestId("wall-count")).toHaveText("4 стены");
	await expect(session.page.getByTestId("room-count")).toHaveText("1 комната");
	expect(await durableRevisionCount(session.page)).toBeGreaterThan(
		revisionsAfterSplit,
	);
	await session.page.reload();
	await openProjectFromHub(session.page, "Удаление диагонального деления");
	await expect(session.page.getByTestId("wall-count")).toHaveText("4 стены");
	await expect(session.page.getByTestId("room-count")).toHaveText("1 комната");
	await session.context.close();
});

test("EDITOR-E2E-02N: reopening a pre-fix closed contour keeps its exact Durable Revision", async ({
	page: _page,
}, testInfo) => {
	const session = await openPersistentPhone(
		testInfo,
		"editor-repair-closed-contour-v2",
	);
	await session.page.goto("/");
	await startNewProject(session.page, "Старый контур");
	await expect(
		session.page.getByTestId("project-durability-status"),
	).toContainText("Сохранено локально");

	await session.page.evaluate(async () => {
		const initial = await new Promise<{
			project: { projectId: string; name: string; createdAt: string };
		}>((resolve, reject) => {
			const request = window.indexedDB.open("interiors-editor-projects");
			request.onerror = () => reject(request.error);
			request.onsuccess = () => {
				const database = request.result;
				const transaction = database.transaction("revisions", "readonly");
				const get = transaction.objectStore("revisions").getAll();
				get.onerror = () => reject(get.error);
				get.onsuccess = () => {
					database.close();
					const record = get.result.find(
						(value: { candidate?: { project?: { name?: string } } }) =>
							value.candidate?.project?.name === "Старый контур",
					) as { candidate?: unknown } | undefined;
					const candidate = record?.candidate as
						| { project?: unknown }
						| undefined;
					if (!candidate?.project) {
						reject(new Error("Initial project was not persisted"));
						return;
					}
					resolve(
						candidate as {
							project: { projectId: string; name: string; createdAt: string };
						},
					);
				};
			};
		});
		const project = {
			assetDefinitionRefs: [],
			assetInstances: [],
			createdAt: initial.project.createdAt,
			level: {
				levelId: "level-legacy",
				openings: [],
				rooms: [],
				vertices: [
					{ vertexId: "top-left", xMm: 0, zMm: 0 },
					{ vertexId: "top-divider", xMm: 2000, zMm: 0 },
					{ vertexId: "top-right", xMm: 4000, zMm: 0 },
					{ vertexId: "bottom-left", xMm: 0, zMm: 3000 },
					{ vertexId: "bottom-divider", xMm: 2000, zMm: 3000 },
					{ vertexId: "bottom-right", xMm: 4000, zMm: 3000 },
				],
				wallSegments: [
					{
						endVertexId: "top-divider",
						startVertexId: "top-left",
						thicknessMm: 100,
						wallSegmentId: "top-left-wall",
					},
					{
						endVertexId: "top-right",
						startVertexId: "top-divider",
						thicknessMm: 100,
						wallSegmentId: "top-right-wall",
					},
					{
						endVertexId: "bottom-left",
						startVertexId: "top-left",
						thicknessMm: 100,
						wallSegmentId: "left-wall",
					},
					{
						endVertexId: "bottom-divider",
						startVertexId: "bottom-left",
						thicknessMm: 100,
						wallSegmentId: "bottom-left-wall",
					},
					{
						endVertexId: "bottom-right",
						startVertexId: "bottom-divider",
						thicknessMm: 100,
						wallSegmentId: "bottom-right-wall",
					},
					{
						endVertexId: "bottom-right",
						startVertexId: "top-right",
						thicknessMm: 100,
						wallSegmentId: "right-wall",
					},
					{
						endVertexId: "bottom-divider",
						startVertexId: "top-divider",
						thicknessMm: 100,
						wallSegmentId: "divider",
					},
				],
			},
			lifecycle: "active",
			name: initial.project.name,
			projectId: initial.project.projectId,
			schemaVersion: 1,
			updatedAt: "2026-08-13T08:44:00.000Z",
		};
		const serializedProject = JSON.stringify({
			schemaVersion: project.schemaVersion,
			projectId: project.projectId,
			name: project.name,
			createdAt: project.createdAt,
			updatedAt: project.updatedAt,
			lifecycle: project.lifecycle,
			level: {
				levelId: project.level.levelId,
				vertices: project.level.vertices,
				wallSegments: project.level.wallSegments,
				rooms: project.level.rooms,
				openings: project.level.openings,
			},
			assetInstances: project.assetInstances,
			assetDefinitionRefs: project.assetDefinitionRefs,
		});
		const digest = await window.crypto.subtle.digest(
			"SHA-256",
			new TextEncoder().encode(serializedProject),
		);
		const checksum = Array.from(new Uint8Array(digest), (byte) =>
			byte.toString(16).padStart(2, "0"),
		).join("");
		const candidate = {
			project,
			revision: {
				checksum,
				createdAt: project.updatedAt,
				projectId: project.projectId,
				revisionId: "revision-stale-closed-contour",
				schemaVersion: 1,
				serializedProject,
			},
		};
		await new Promise<void>((resolve, reject) => {
			const request = window.indexedDB.open("interiors-editor-projects");
			request.onerror = () => reject(request.error);
			request.onsuccess = () => {
				const database = request.result;
				const transaction = database.transaction(
					["projects", "revisions"],
					"readwrite",
				);
				transaction.objectStore("revisions").put({
					candidate,
					revisionId: candidate.revision.revisionId,
				});
				transaction.objectStore("projects").clear();
				transaction.objectStore("projects").put({
					currentRevisionId: candidate.revision.revisionId,
					name: project.name,
					projectId: project.projectId,
				});
				transaction.oncomplete = () => {
					database.close();
					resolve();
				};
				transaction.onerror = () => reject(transaction.error);
			};
		});
	});

	await session.page.reload();
	await openProjectFromHub(session.page, "Старый контур");
	await expect(session.page.getByTestId("room-count")).toHaveText("0 комнат");
	await expect(
		session.page.getByRole("button", { name: "3D", exact: true }),
	).toBeDisabled();
	await expect.poll(() => durableRevisionCount(session.page)).toBe(2);
	await session.context.close();
});

test("EDITOR-E2E-02A: each confirmed wall returns to Hand and the next wall starts from an explicit tool choice", async ({
	page: _page,
}, testInfo) => {
	const session = await openPersistentPhone(
		testInfo,
		"editor-direct-wall-draw",
	);
	await session.page.goto("/");
	await startNewProject(session.page, "Рисование стен");
	await session.page.getByRole("button", { name: "Создать контур" }).click();
	await expect
		.poll(async () => (await durableRooms(session.page)).length)
		.toBe(1);

	const plan = session.page.getByTestId("plan-canvas");
	const revisionsBeforeChoosingWall = await durableRevisionCount(session.page);
	await chooseEditorOption(session.page, "Стена");

	await expect(plan).toHaveAttribute("data-active-tool", "wall");
	expect(await durableRevisionCount(session.page)).toBe(
		revisionsBeforeChoosingWall,
	);
	await expect(plan).toHaveAttribute("aria-label", "План помещения");
	await expect(
		session.page
			.getByRole("navigation", { name: "Инструменты редактора" })
			.getByRole("button", { name: "Стена", exact: true }),
	).toHaveAttribute("aria-pressed", "true");
	await expect(session.page.getByLabel("Характеристики плана")).toHaveCount(0);

	await drawCentreDividerByTouch(session.page);
	await expect(session.page.getByTestId("wall-count")).toHaveText("7 стен");
	await expect(session.page.getByTestId("room-count")).toHaveText("2 комнаты");
	await expect(plan).toHaveAttribute("data-active-tool", "select");
	await expect(session.page.getByTestId("active-tool-hint")).toHaveCount(0);
	await expect(
		session.page.getByTestId("project-durability-status"),
	).toContainText("Сохранено локально");
	await drawCentreCrossbarByTouch(session.page);
	await expect(session.page.getByTestId("wall-count")).toHaveText("12 стен");
	await expect(session.page.getByTestId("room-count")).toHaveText("4 комнаты");
	await expect(plan).toHaveAttribute("data-active-tool", "select");
	await session.page.reload();
	await openProjectFromHub(session.page, "Рисование стен");
	await expect(session.page.getByTestId("wall-count")).toHaveText("12 стен");
	await expect(session.page.getByTestId("room-count")).toHaveText("4 комнаты");
	await session.context.close();
});

test("EDITOR-E2E-02B: a two-finger plan gesture never commits the active wall draft", async ({
	page: _page,
}, testInfo) => {
	const session = await openPersistentPhone(testInfo, "editor-wall-pinch");
	await session.page.goto("/");
	await startNewProject(session.page, "Жест без стены");
	await session.page.getByRole("button", { name: "Создать контур" }).click();
	await chooseEditorOption(session.page, "Стена");
	const revisionsBeforePinch = await durableRevisionCount(session.page);
	const plan = session.page.getByTestId("plan-canvas");
	const box = await plan.boundingBox();
	if (!box) {
		throw new Error("Plan canvas did not render");
	}
	// Both contacts deliberately stay left of the floating ToolRail. This is
	// a canvas pinch, not a simultaneous tap on an editor control.
	const first = {
		id: 11,
		...(await planPointMm(session.page, { xMm: 800, zMm: 1100 })),
	};
	const second = {
		id: 12,
		...(await planPointMm(session.page, { xMm: 2000, zMm: 2000 })),
	};
	const cdp = await session.page.context().newCDPSession(session.page);
	try {
		await cdp.send("Input.dispatchTouchEvent", {
			touchPoints: [first],
			type: "touchStart",
		});
		await expect(plan.getByTestId("wall-draft")).toHaveCount(1);
		await cdp.send("Input.dispatchTouchEvent", {
			touchPoints: [first, second],
			type: "touchStart",
		});
		await cdp.send("Input.dispatchTouchEvent", {
			touchPoints: [
				{ ...first, x: first.x - 18, y: first.y - 18 },
				{ ...second, x: second.x + 18, y: second.y + 18 },
			],
			type: "touchMove",
		});
		await cdp.send("Input.dispatchTouchEvent", {
			touchPoints: [first],
			type: "touchEnd",
		});
		await expect(plan.getByTestId("wall-draft")).toHaveCount(0);
		expect(await durableRevisionCount(session.page)).toBe(revisionsBeforePinch);
		await cdp.send("Input.dispatchTouchEvent", {
			touchPoints: [],
			type: "touchEnd",
		});
		const third = {
			id: 13,
			...(await planPointMm(session.page, { xMm: 1000, zMm: 900 })),
		};
		const fourth = {
			id: 14,
			...(await planPointMm(session.page, { xMm: 2200, zMm: 2000 })),
		};
		await cdp.send("Input.dispatchTouchEvent", {
			touchPoints: [third],
			type: "touchStart",
		});
		await expect(plan.getByTestId("wall-draft")).toHaveCount(1);
		await cdp.send("Input.dispatchTouchEvent", {
			touchPoints: [third, fourth],
			type: "touchStart",
		});
		await cdp.send("Input.dispatchTouchEvent", {
			touchPoints: [
				{ ...third, x: third.x - 12, y: third.y - 12 },
				{ ...fourth, x: fourth.x + 12, y: fourth.y + 12 },
			],
			type: "touchMove",
		});
		await expect(plan.getByTestId("wall-draft")).toHaveCount(0);
		await cdp.send("Input.dispatchTouchEvent", {
			touchPoints: [fourth],
			type: "touchEnd",
		});
		await expect(plan.getByTestId("wall-draft")).toHaveCount(0);
		expect(await durableRevisionCount(session.page)).toBe(revisionsBeforePinch);
		await cdp.send("Input.dispatchTouchEvent", {
			touchPoints: [],
			type: "touchEnd",
		});
	} finally {
		await cdp.detach();
	}

	await expect(session.page.getByTestId("wall-count")).toHaveText("4 стены");
	expect(await durableRevisionCount(session.page)).toBe(revisionsBeforePinch);
	await expect(plan.getByTestId("wall-draft")).toHaveCount(0);
	await session.context.close();
});

test("EDITOR-E2E-02P: a genuine two-finger 2D pinch zooms the disposable plan camera only", async ({
	page: _page,
}, testInfo) => {
	const session = await openPersistentPhone(testInfo, "editor-plan-pinch");
	await session.page.goto("/");
	await startNewProject(session.page, "2D масштаб");
	await session.page.getByRole("button", { name: "Создать контур" }).click();
	await chooseEditorOption(session.page, "Рука и выбор");
	const revisionsBeforePinch = await durableRevisionCount(session.page);
	const plan = session.page.getByTestId("plan-canvas");
	const before = await session.page
		.getByTestId("plan-content")
		.getAttribute("transform");
	const box = await plan.boundingBox();
	if (!box) throw new Error("Plan canvas did not render");
	const first = {
		id: 71,
		...(await planPointMm(session.page, { xMm: 800, zMm: 1100 })),
	};
	const second = {
		id: 72,
		...(await planPointMm(session.page, { xMm: 2000, zMm: 2000 })),
	};
	const cdp = await session.page.context().newCDPSession(session.page);
	try {
		await cdp.send("Input.dispatchTouchEvent", {
			touchPoints: [first, second],
			type: "touchStart",
		});
		await cdp.send("Input.dispatchTouchEvent", {
			touchPoints: [
				{ ...first, x: first.x - 34, y: first.y - 18 },
				{ ...second, x: second.x + 34, y: second.y + 18 },
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
	await expect(session.page.getByTestId("plan-content")).not.toHaveAttribute(
		"transform",
		before ?? "",
	);
	const zoomTransform = await session.page
		.getByTestId("plan-content")
		.getAttribute("transform");
	const zoomMatch = /translate\(([-\d.]+) ([-\d.]+)\) scale\(([-\d.]+)\)/.exec(
		zoomTransform ?? "",
	);
	if (!zoomMatch) throw new Error("Plan zoom transform did not render");
	// A centred pinch must compensate both axes. The former origin-anchored
	// implementation left this at translate(0 0), visibly throwing the drawing
	// to the upper-left corner on a phone.
	expect(Number(zoomMatch[1])).toBeLessThan(-20);
	expect(Number(zoomMatch[2])).toBeLessThan(-20);
	expect(await durableRevisionCount(session.page)).toBe(revisionsBeforePinch);
	await session.context.close();
});

test("EDITOR-E2E-02PA: a 40 m phone plan can zoom until one 100 mm wall occupies one touch-usable grid cell", async ({
	page: _page,
}, testInfo) => {
	const session = await openPersistentPhone(
		testInfo,
		"editor-large-plan-grid-scale",
	);
	await session.page.goto("/");
	await startNewProject(session.page, "Большой точный план");
	await session.page.getByLabel("Ширина, мм").fill("40000");
	await session.page.getByLabel("Глубина, мм").fill("30000");
	await session.page.getByRole("button", { name: "Создать контур" }).click();

	const plan = session.page.getByTestId("plan-canvas");
	const box = await plan.boundingBox();
	if (!box) throw new Error("Large plan canvas did not render");
	const overviewWallTouchWidth = await plan
		.getByTestId("wall-segment")
		.first()
		.evaluate((wall) => {
			const bounds = wall.getBoundingClientRect();
			return Math.min(bounds.width, bounds.height);
		});
	expect(overviewWallTouchWidth).toBeGreaterThanOrEqual(43.5);
	const cdp = await session.page.context().newCDPSession(session.page);
	try {
		for (let pinchIndex = 0; pinchIndex < 4; pinchIndex += 1) {
			const first = {
				id: 801 + pinchIndex * 2,
				x: box.x + box.width / 2 - 28,
				y: box.y + box.height / 2,
			};
			const second = {
				id: first.id + 1,
				x: box.x + box.width / 2 + 28,
				y: box.y + box.height / 2,
			};
			await cdp.send("Input.dispatchTouchEvent", {
				touchPoints: [first, second],
				type: "touchStart",
			});
			await cdp.send("Input.dispatchTouchEvent", {
				touchPoints: [
					{ ...first, x: first.x - 84 },
					{ ...second, x: second.x + 84 },
				],
				type: "touchMove",
			});
			await cdp.send("Input.dispatchTouchEvent", {
				touchPoints: [],
				type: "touchEnd",
			});
		}
	} finally {
		await cdp.detach();
	}

	const scaleMatch = /scale\(([-\d.]+)\)/.exec(
		(await session.page
			.getByTestId("plan-content")
			.getAttribute("transform")) ?? "",
	);
	if (!scaleMatch) throw new Error("Large plan zoom transform did not render");
	expect(Number(scaleMatch[1])).toBeGreaterThan(3);

	const constructionScale = await plan.evaluate((canvas) => {
		const gridLines = [
			...canvas.querySelectorAll<SVGLineElement>(
				'[data-testid="infinite-grid"] line',
			),
		];
		const verticalLines = gridLines
			.filter(
				(line) =>
					Number(line.getAttribute("x1")) === Number(line.getAttribute("x2")),
			)
			.map((line) => {
				const matrix = line.getScreenCTM();
				if (!matrix) throw new Error("Grid line has no screen transform");
				return new DOMPoint(
					Number(line.getAttribute("x1")),
					Number(line.getAttribute("y1")),
				).matrixTransform(matrix).x;
			})
			.sort((first, second) => first - second);
		const cellWidths = verticalLines
			.slice(1)
			.map((position, index) => position - (verticalLines[index] ?? position));
		const gridCellPx = Math.min(...cellWidths.filter((width) => width > 0.1));
		const minorGridLine = gridLines.reduce((minor, line) =>
			Number.parseFloat(getComputedStyle(line).strokeWidth) <
			Number.parseFloat(getComputedStyle(minor).strokeWidth)
				? line
				: minor,
		);
		const minorGridStyle = getComputedStyle(minorGridLine);
		const minorGridMatrix = minorGridLine.getScreenCTM();
		if (!minorGridMatrix) throw new Error("Grid line has no screen transform");
		const gridStrokeWidth = Number.parseFloat(minorGridStyle.strokeWidth);
		const gridStrokePx =
			minorGridStyle.vectorEffect === "non-scaling-stroke"
				? gridStrokeWidth
				: gridStrokeWidth * Math.hypot(minorGridMatrix.a, minorGridMatrix.b);
		const horizontalWall = [
			...canvas.querySelectorAll<SVGLineElement>('[data-testid="wall-line"]'),
		].find(
			(wall) =>
				Number(wall.getAttribute("y1")) === Number(wall.getAttribute("y2")),
		);
		const wallMatrix = horizontalWall?.getScreenCTM();
		if (!horizontalWall || !wallMatrix) {
			throw new Error("Horizontal wall has no screen transform");
		}
		const wallScale = Math.hypot(wallMatrix.a, wallMatrix.b);
		return {
			gridCellPx,
			gridStrokePx,
			wallThicknessPx:
				Number(horizontalWall.getAttribute("stroke-width")) * wallScale,
		};
	});
	expect(constructionScale.gridCellPx).toBeGreaterThanOrEqual(43.5);
	expect(constructionScale.gridStrokePx).toBeLessThanOrEqual(1);
	expect(constructionScale.wallThicknessPx).toBeCloseTo(
		constructionScale.gridCellPx,
		1,
	);
	await chooseEditorOption(session.page, "Стена");
	const drawCdp = await session.page.context().newCDPSession(session.page);
	await drawCdp.send("Input.dispatchTouchEvent", {
		touchPoints: [
			{
				id: 901,
				x: box.x + box.width / 2 - 48,
				y: box.y + box.height / 2,
			},
		],
		type: "touchStart",
	});
	await drawCdp.send("Input.dispatchTouchEvent", {
		touchPoints: [
			{
				id: 901,
				x: box.x + box.width / 2 + 48,
				y: box.y + box.height / 2,
			},
		],
		type: "touchMove",
	});
	const draft = plan.getByTestId("wall-draft");
	await expect(draft).toHaveCount(1);
	const draftPresentation = await draft.evaluate((element) => {
		const line = element as SVGLineElement;
		const style = getComputedStyle(line);
		const matrix = line.getScreenCTM();
		if (!matrix) throw new Error("Wall draft has no screen transform");
		const width = Number.parseFloat(style.strokeWidth);
		const screenPoint = (xAttribute: "x1" | "x2", yAttribute: "y1" | "y2") =>
			new DOMPoint(
				Number(line.getAttribute(xAttribute)),
				Number(line.getAttribute(yAttribute)),
			).matrixTransform(matrix);
		const gridLines = [
			...(line.ownerSVGElement?.querySelectorAll<SVGLineElement>(
				'[data-testid="infinite-grid"] line',
			) ?? []),
		];
		const gridPositions = (axis: "x" | "y") =>
			gridLines
				.filter((gridLine) =>
					axis === "x"
						? Number(gridLine.getAttribute("x1")) ===
							Number(gridLine.getAttribute("x2"))
						: Number(gridLine.getAttribute("y1")) ===
							Number(gridLine.getAttribute("y2")),
				)
				.map((gridLine) => {
					const gridMatrix = gridLine.getScreenCTM();
					if (!gridMatrix) throw new Error("Grid line has no screen transform");
					const point = new DOMPoint(
						Number(gridLine.getAttribute("x1")),
						Number(gridLine.getAttribute("y1")),
					).matrixTransform(gridMatrix);
					return axis === "x" ? point.x : point.y;
				})
				.sort((first, second) => first - second);
		const distanceToCellCentre = (position: number, grid: readonly number[]) =>
			Math.min(
				...grid
					.slice(1)
					.map((edge, index) =>
						Math.abs(position - ((grid[index] ?? edge) + edge) / 2),
					),
			);
		const start = screenPoint("x1", "y1");
		const end = screenPoint("x2", "y2");
		const xGrid = gridPositions("x");
		const yGrid = gridPositions("y");
		return {
			cellCentreErrorPx: Math.max(
				distanceToCellCentre(start.x, xGrid),
				distanceToCellCentre(start.y, yGrid),
				distanceToCellCentre(end.x, xGrid),
				distanceToCellCentre(end.y, yGrid),
			),
			strokePx:
				style.vectorEffect === "non-scaling-stroke"
					? width
					: width * Math.hypot(matrix.a, matrix.b),
		};
	});
	expect(draftPresentation.strokePx).toBeLessThanOrEqual(4.5);
	expect(draftPresentation.cellCentreErrorPx).toBeLessThanOrEqual(0.1);
	await drawCdp.send("Input.dispatchTouchEvent", {
		touchPoints: [],
		type: "touchEnd",
	});
	await drawCdp.detach();
	await session.context.close();
});

test("EDITOR-E2E-02Q: a touch wall remains a reviewable candidate until explicit confirm", async ({
	page: _page,
}, testInfo) => {
	const session = await openPersistentPhone(
		testInfo,
		"editor-touch-wall-confirm",
	);
	await session.page.goto("/");
	await startNewProject(session.page, "Подтверждение стены");
	await session.page.getByRole("button", { name: "Создать контур" }).click();
	await chooseEditorOption(session.page, "Стена");

	const plan = session.page.getByTestId("plan-canvas");
	const [box, revisionsBefore] = await Promise.all([
		plan.boundingBox(),
		durableRevisionCount(session.page),
	]);
	if (!box) throw new Error("Plan canvas did not render");
	const cdp = await session.page.context().newCDPSession(session.page);
	try {
		const start = {
			id: 61,
			...(await planPointMm(session.page, { xMm: 2000, zMm: 900 })),
		};
		const end = await planPointMm(session.page, { xMm: 2000, zMm: 2100 });
		await cdp.send("Input.dispatchTouchEvent", {
			touchPoints: [start],
			type: "touchStart",
		});
		await cdp.send("Input.dispatchTouchEvent", {
			touchPoints: [{ ...start, ...end }],
			type: "touchMove",
		});
		await cdp.send("Input.dispatchTouchEvent", {
			touchPoints: [],
			type: "touchEnd",
		});
	} finally {
		await cdp.detach();
	}

	const actions = session.page.getByTestId("wall-draft-actions");
	await expect(actions).toBeVisible();
	await expect(actions).toContainText("Стена:");
	await expect(actions).toContainText("вертикально");
	await expect(session.page.getByTestId("wall-draft")).toHaveCount(1);
	expect(await durableRevisionCount(session.page)).toBe(revisionsBefore);
	await session.page.getByRole("button", { name: "Отменить стену" }).click();
	await expect(actions).toHaveCount(0);
	await expect(session.page.getByTestId("wall-draft")).toHaveCount(0);
	expect(await durableRevisionCount(session.page)).toBe(revisionsBefore);

	await session.context.close();
});

test("EDITOR-E2E-02S: a touch gesture previews, saves, and renders a 45-degree wall without coordinate entry", async ({
	page: _page,
}, testInfo) => {
	const session = await openPersistentPhone(
		testInfo,
		"editor-touch-wall-45-degrees",
	);
	await session.page.goto("/");
	await startNewProject(session.page, "Диагональная стена");
	await session.page.getByRole("button", { name: "Создать контур" }).click();
	await chooseEditorOption(session.page, "Стена");

	const plan = session.page.getByTestId("plan-canvas");
	const box = await plan.boundingBox();
	if (!box) throw new Error("Plan canvas did not render");
	const cdp = await session.page.context().newCDPSession(session.page);
	try {
		const start = {
			id: 63,
			...(await planPointMm(session.page, { xMm: 1400, zMm: 2100 })),
		};
		const end = await planPointMm(session.page, { xMm: 2400, zMm: 1100 });
		await cdp.send("Input.dispatchTouchEvent", {
			touchPoints: [start],
			type: "touchStart",
		});
		await cdp.send("Input.dispatchTouchEvent", {
			touchPoints: [{ ...start, ...end }],
			type: "touchMove",
		});
		await cdp.send("Input.dispatchTouchEvent", {
			touchPoints: [],
			type: "touchEnd",
		});
	} finally {
		await cdp.detach();
	}

	const actions = session.page.getByTestId("wall-draft-actions");
	await expect(actions).toContainText("диагональ 45°");
	await session.page.getByRole("button", { name: "Подтвердить стену" }).click();
	await expect(session.page.getByTestId("wall-count")).toHaveText("5 стен");
	await expect
		.poll(() =>
			plan.locator('[data-testid="wall-line"]').evaluateAll((walls) =>
				walls.some((wall) => {
					const x1 = Number(wall.getAttribute("x1"));
					const x2 = Number(wall.getAttribute("x2"));
					const y1 = Number(wall.getAttribute("y1"));
					const y2 = Number(wall.getAttribute("y2"));
					return Math.abs(Math.abs(x2 - x1) - Math.abs(y2 - y1)) < 0.001;
				}),
			),
		)
		.toBe(true);

	await chooseEditorOption(session.page, "3D");
	await expect(
		session.page.getByTestId("three-dimensional-canvas"),
	).toBeVisible();
	await session.context.close();
});

test("PLAN-E2E-04JA: a phone user can preview and remove a redundant Vertex on a 45-degree Wall", async ({
	page: _page,
}, testInfo) => {
	const session = await openPersistentPhone(
		testInfo,
		"editor-remove-diagonal-split-vertex",
	);
	await session.page.goto("/");
	await startNewProject(session.page, "Убрать вершину диагонали");
	await session.page.getByRole("button", { name: "Создать контур" }).click();
	await chooseEditorOption(session.page, "Стена");
	const plan = session.page.getByTestId("plan-canvas");
	const box = await plan.boundingBox();
	if (!box) throw new Error("Plan canvas did not render");
	await dragByTouch(
		session.page,
		await planPointMm(session.page, { xMm: 1400, zMm: 2100 }),
		await planPointMm(session.page, { xMm: 2400, zMm: 1100 }),
	);
	await expect(session.page.getByTestId("wall-count")).toHaveText("5 стен");
	await chooseEditorOption(session.page, "Рука и выбор");
	const diagonal = session.page.locator(
		'[data-testid="wall-segment"][data-wall-kind="interior"]',
	);
	await expect(diagonal).toHaveCount(1);
	await diagonal.tap();
	await expandSelectedWallInspector(session.page);
	await loadLegacySplitWallFixture(session.page);
	await expect(session.page.getByTestId("wall-segment")).toHaveCount(6);

	await session.page
		.getByRole("button", { name: "Удалить вершину", exact: true })
		.tap();
	const preview = session.page.getByTestId("vertex-deletion-draft");
	await expect(preview).toContainText(
		"объединены только две прямые части стены без проёмов",
	);
	await preview.getByRole("button", { name: "Подтвердить удаление" }).tap();
	await expect(session.page.getByTestId("wall-segment")).toHaveCount(5);
	await expect(preview).toHaveCount(0);
	await session.page.reload();
	await openProjectFromHub(session.page, "Убрать вершину диагонали");
	await expect(session.page.getByTestId("wall-segment")).toHaveCount(5);
	await session.context.close();
});

test("EDITOR-E2E-02T: a detached 45-degree wall endpoint moves only along its diagonal after explicit confirmation", async ({
	page: _page,
}, testInfo) => {
	const session = await openPersistentPhone(
		testInfo,
		"editor-touch-move-diagonal-vertex",
	);
	await session.page.goto("/");
	await startNewProject(session.page, "Перенос диагонали");
	await session.page.getByRole("button", { name: "Создать контур" }).click();
	await chooseEditorOption(session.page, "Стена");

	const plan = session.page.getByTestId("plan-canvas");
	const box = await plan.boundingBox();
	if (!box) throw new Error("Plan canvas did not render");
	const cdp = await session.page.context().newCDPSession(session.page);
	try {
		const start = {
			id: 64,
			...(await planPointMm(session.page, { xMm: 1400, zMm: 2100 })),
		};
		const end = await planPointMm(session.page, { xMm: 2400, zMm: 1100 });
		await cdp.send("Input.dispatchTouchEvent", {
			touchPoints: [start],
			type: "touchStart",
		});
		await cdp.send("Input.dispatchTouchEvent", {
			touchPoints: [{ ...start, ...end }],
			type: "touchMove",
		});
		await cdp.send("Input.dispatchTouchEvent", {
			touchPoints: [],
			type: "touchEnd",
		});
	} finally {
		await cdp.detach();
	}
	await session.page.getByRole("button", { name: "Подтвердить стену" }).click();

	await chooseEditorOption(session.page, "Рука и выбор");
	const diagonal = session.page.locator(
		'[data-testid="wall-segment"][data-wall-kind="interior"]',
	);
	await expect(diagonal).toHaveCount(1);
	await diagonal.click();
	await expandSelectedWallInspector(session.page);
	await session.page
		.getByRole("button", { name: "Переместить вершину жестом" })
		.click();
	const handles = session.page.getByTestId("wall-vertex-move-handle");
	await expect(handles).toHaveCount(2);
	const handle = handles.first();
	const handleBox = await handle.boundingBox();
	if (!handleBox) throw new Error("Diagonal vertex handle did not render");
	const revisionCountBeforeMove = await durableRevisionCount(session.page);
	await session.page.mouse.move(
		handleBox.x + handleBox.width / 2,
		handleBox.y + handleBox.height / 2,
	);
	await session.page.mouse.down();
	const movedEndpoint = await planPointMm(session.page, {
		xMm: 1700,
		zMm: 1800,
	});
	await session.page.mouse.move(movedEndpoint.x, movedEndpoint.y);
	await session.page.mouse.up();
	const candidate = session.page.getByTestId("wall-vertex-move-draft");
	await expect(candidate).toBeVisible();
	expect(await durableRevisionCount(session.page)).toBe(
		revisionCountBeforeMove,
	);
	await candidate
		.getByRole("button", { name: "Подтвердить перенос вершины" })
		.click();
	await expect(candidate).toHaveCount(0);
	expect(await durableRevisionCount(session.page)).toBe(
		revisionCountBeforeMove + 1,
	);

	await expect(
		session.page.getByRole("button", { name: "Разделить стену жестом" }),
	).toHaveCount(0);
	await expect(session.page.getByTestId("wall-split-draft")).toHaveCount(0);

	await session.context.close();
});

test("EDITOR-E2E-02U: a detached 45-degree wall moves perpendicular to itself only after explicit confirmation", async ({
	page: _page,
}, testInfo) => {
	const session = await openPersistentPhone(
		testInfo,
		"editor-touch-move-diagonal-wall",
	);
	await session.page.goto("/");
	await startNewProject(session.page, "Перенос стены 45°");
	await session.page.getByRole("button", { name: "Создать контур" }).click();
	await chooseEditorOption(session.page, "Стена");

	const plan = session.page.getByTestId("plan-canvas");
	const planBox = await plan.boundingBox();
	if (!planBox) throw new Error("Plan canvas did not render");
	const cdp = await session.page.context().newCDPSession(session.page);
	try {
		const start = {
			id: 65,
			...(await planPointMm(session.page, { xMm: 1400, zMm: 2100 })),
		};
		const end = await planPointMm(session.page, { xMm: 2400, zMm: 1100 });
		await cdp.send("Input.dispatchTouchEvent", {
			touchPoints: [start],
			type: "touchStart",
		});
		await cdp.send("Input.dispatchTouchEvent", {
			touchPoints: [{ ...start, ...end }],
			type: "touchMove",
		});
		await cdp.send("Input.dispatchTouchEvent", {
			touchPoints: [],
			type: "touchEnd",
		});
	} finally {
		await cdp.detach();
	}
	await session.page.getByRole("button", { name: "Подтвердить стену" }).click();

	await chooseEditorOption(session.page, "Рука и выбор");
	const diagonal = session.page.locator(
		'[data-testid="wall-segment"][data-wall-kind="interior"]',
	);
	await expect(diagonal).toHaveCount(1);
	await diagonal.click();
	await expandSelectedWallInspector(session.page);
	await session.page
		.getByRole("button", { name: "Переместить стену жестом" })
		.click();
	const diagonalBox = await diagonal.boundingBox();
	if (!diagonalBox) throw new Error("Diagonal wall did not render");
	const revisionCountBeforeMove = await durableRevisionCount(session.page);
	await session.page.mouse.move(
		diagonalBox.x + diagonalBox.width / 2,
		diagonalBox.y + diagonalBox.height / 2,
	);
	await session.page.mouse.down();
	await session.page.mouse.move(
		diagonalBox.x + diagonalBox.width / 2 + 36,
		diagonalBox.y + diagonalBox.height / 2 + 36,
	);
	await session.page.mouse.up();
	const candidate = session.page.getByTestId("wall-move-draft");
	await expect(candidate).toBeVisible();
	expect(await durableRevisionCount(session.page)).toBe(
		revisionCountBeforeMove,
	);
	await candidate.getByRole("button", { name: "Подтвердить перенос" }).click();
	await expect(candidate).toHaveCount(0);
	expect(await durableRevisionCount(session.page)).toBe(
		revisionCountBeforeMove + 1,
	);

	await session.context.close();
});

test("EDITOR-E2E-02R: the wall tool exposes drawing on the plan, not coordinate entry", async ({
	page: _page,
}, testInfo) => {
	const session = await openPersistentPhone(
		testInfo,
		"editor-no-wall-coordinates",
	);
	await session.page.goto("/");
	await startNewProject(session.page, "Стена жестом");
	await session.page.getByRole("button", { name: "Создать контур" }).click();
	await chooseEditorOption(session.page, "Стена");

	await expect(
		session.page.getByRole("button", { name: "Стена по координатам" }),
	).toHaveCount(0);
	await expect(session.page.getByTestId("numeric-wall-entry")).toHaveCount(0);
	for (const label of [
		"Начало X, мм",
		"Начало Z, мм",
		"Конец X, мм",
		"Конец Z, мм",
	]) {
		await expect(session.page.getByLabel(label)).toHaveCount(0);
	}

	await session.context.close();
});

test("EDITOR-E2E-02C: a wall tool tap only establishes a cancelled draft and never invents a divider", async ({
	page: _page,
}, testInfo) => {
	const session = await openPersistentPhone(
		testInfo,
		"editor-wall-tap-no-divider",
	);
	await session.page.goto("/");
	await startNewProject(session.page, "Без случайной стены");
	await session.page.getByRole("button", { name: "Создать контур" }).click();
	const plan = session.page.getByTestId("plan-canvas");
	const box = await plan.boundingBox();
	if (!box) {
		throw new Error("Plan canvas did not render");
	}
	const revisionsBeforeTap = await durableRevisionCount(session.page);

	await chooseEditorOption(session.page, "Стена");
	await session.page.mouse.click(
		box.x + box.width * 0.5,
		box.y + box.height * 0.5,
	);

	expect(await durableRevisionCount(session.page)).toBe(revisionsBeforeTap);
	await expect(session.page.getByTestId("wall-count")).toHaveText("4 стены");
	await expect(session.page.getByTestId("wall-draft")).toHaveCount(0);
	await session.context.close();
});

test("EDITOR-E2E-02D: a sub-threshold wall microdrag never invents a divider", async ({
	page: _page,
}, testInfo) => {
	const session = await openPersistentPhone(
		testInfo,
		"editor-wall-microdrag-no-divider",
	);
	await session.page.goto("/");
	await startNewProject(session.page, "Без микростены");
	await session.page.getByRole("button", { name: "Создать контур" }).click();
	const plan = session.page.getByTestId("plan-canvas");
	const box = await plan.boundingBox();
	if (!box) {
		throw new Error("Plan canvas did not render");
	}
	const revisionsBeforeMicrodrag = await durableRevisionCount(session.page);

	await chooseEditorOption(session.page, "Стена");
	const start = await planPointMm(session.page, { xMm: 2000, zMm: 1500 });
	await session.page.mouse.move(start.x, start.y);
	await session.page.mouse.down();
	await session.page.mouse.move(start.x + 5, start.y);
	await session.page.mouse.up();

	expect(await durableRevisionCount(session.page)).toBe(
		revisionsBeforeMicrodrag,
	);
	await expect(session.page.getByTestId("wall-count")).toHaveText("4 стены");
	await expect(session.page.getByTestId("wall-draft")).toHaveCount(0);
	await session.context.close();
});

test("EDITOR-E2E-02E: wall mode keeps a delayed press dedicated to drawing instead of panning the plan", async ({
	page: _page,
}, testInfo) => {
	const session = await openPersistentPhone(
		testInfo,
		"editor-wall-delayed-draw",
	);
	await session.page.goto("/");
	await startNewProject(session.page, "Долгое рисование");
	await session.page.getByRole("button", { name: "Создать контур" }).click();
	await chooseEditorOption(session.page, "Стена");

	const exteriorBounds = await exteriorWallBounds(session.page);
	const horizontalBounds = exteriorBounds
		.filter((box) => box.width > box.height)
		.sort((first, second) => first.top - second.top);
	const top = horizontalBounds[0];
	const bottom = horizontalBounds.at(-1);
	if (!top || !bottom) {
		throw new Error("Starter boundaries did not render");
	}
	const x = top.left + top.width / 2;
	await session.page.mouse.move(x, top.top + top.height / 2);
	await session.page.mouse.down();
	await session.page.waitForTimeout(260);
	await session.page.mouse.move(x, bottom.top + bottom.height / 2, {
		steps: 8,
	});
	await expect(session.page.getByTestId("wall-draft")).toHaveCount(1);
	await session.page.mouse.up();

	await expect(session.page.getByTestId("wall-draft")).toHaveCount(0);
	await expect(session.page.getByTestId("wall-count")).toHaveText("7 стен");
	await expect(session.page.getByTestId("room-count")).toHaveText("2 комнаты");
	await session.context.close();
});

test("EDITOR-E2E-02F: releasing an outward wall from an existing corner replaces its draft with a durable wall", async ({
	page: _page,
}, testInfo) => {
	const session = await openPersistentPhone(
		testInfo,
		"editor-outward-corner-wall",
	);
	await session.page.goto("/");
	await startNewProject(session.page, "Внешняя стена от угла");
	await session.page.getByRole("button", { name: "Создать контур" }).click();
	await chooseEditorOption(session.page, "Стена");

	const exteriorBounds = await exteriorWallBounds(session.page);
	const top = exteriorBounds
		.filter((box) => box.width > box.height)
		.sort((first, second) => first.top - second.top)[0];
	const left = exteriorBounds
		.filter((box) => box.height > box.width)
		.sort((first, second) => first.left - second.left)[0];
	if (!top || !left) {
		throw new Error("Starter boundaries did not render");
	}
	const start = {
		x: left.left + left.width / 2,
		y: top.top + top.height / 2,
	};
	await session.page.mouse.move(start.x, start.y);
	await session.page.mouse.down();
	await session.page.mouse.move(start.x, start.y - 100, { steps: 8 });
	await expect(session.page.getByTestId("wall-draft")).toHaveCount(1);
	await session.page.mouse.up();

	await expect(session.page.getByTestId("wall-draft")).toHaveCount(0);
	await expect(session.page.getByTestId("wall-count")).toHaveText("5 стен");
	await expect(
		session.page.getByTestId("project-durability-status"),
	).toContainText("Сохранено локально");
	await session.context.close();
});

test("EDITOR-E2E-02G: a touch drag outward from an existing corner replaces its draft with a durable wall", async ({
	page: _page,
}, testInfo) => {
	const session = await openPersistentPhone(
		testInfo,
		"editor-touch-outward-corner-wall",
	);
	await session.page.goto("/");
	await startNewProject(session.page, "Тач-внешняя стена от угла");
	await session.page.getByRole("button", { name: "Создать контур" }).click();
	await chooseEditorOption(session.page, "Стена");

	const exteriorBounds = await exteriorWallBounds(session.page);
	const top = exteriorBounds
		.filter((box) => box.width > box.height)
		.sort((first, second) => first.top - second.top)[0];
	const left = exteriorBounds
		.filter((box) => box.height > box.width)
		.sort((first, second) => first.left - second.left)[0];
	if (!top || !left) {
		throw new Error("Starter boundaries did not render");
	}
	const start = {
		x: left.left + left.width / 2,
		y: top.top + top.height / 2,
	};
	await dragByTouch(session.page, start, { x: start.x, y: start.y - 100 });

	await expect(session.page.getByTestId("wall-draft")).toHaveCount(0);
	await expect(session.page.getByTestId("wall-count")).toHaveText("5 стен");
	await expect(
		session.page.getByTestId("project-durability-status"),
	).toContainText("Сохранено локально");
	await session.context.close();
});

test("EDITOR-E2E-02H: a prior touch pan cannot keep an outward wall draft from being committed", async ({
	page: _page,
}, testInfo) => {
	const session = await openPersistentPhone(
		testInfo,
		"editor-touch-pan-then-outward-wall",
	);
	await session.page.goto("/");
	await startNewProject(session.page, "После перемещения — стена");
	await session.page.getByRole("button", { name: "Создать контур" }).click();

	const plan = session.page.getByTestId("plan-canvas");
	const planBox = await plan.boundingBox();
	if (!planBox) {
		throw new Error("Plan canvas did not render");
	}
	const transformBeforePan = await session.page
		.getByTestId("plan-content")
		.getAttribute("transform");
	const cdp = await session.page.context().newCDPSession(session.page);
	try {
		const panStart = {
			id: 26,
			...(await planPointMm(session.page, { xMm: -500, zMm: 1500 })),
		};
		await cdp.send("Input.dispatchTouchEvent", {
			touchPoints: [panStart],
			type: "touchStart",
		});
		await cdp.send("Input.dispatchTouchEvent", {
			touchPoints: [{ ...panStart, x: panStart.x + 28, y: panStart.y + 14 }],
			type: "touchMove",
		});
		await cdp.send("Input.dispatchTouchEvent", {
			touchPoints: [],
			type: "touchEnd",
		});
	} finally {
		await cdp.detach();
	}

	await expect(session.page.getByTestId("plan-content")).not.toHaveAttribute(
		"transform",
		transformBeforePan ?? "",
	);
	await chooseEditorOption(session.page, "Стена");
	const exteriorBounds = await exteriorWallBounds(session.page);
	const top = exteriorBounds
		.filter((box) => box.width > box.height)
		.sort((first, second) => first.top - second.top)[0];
	const left = exteriorBounds
		.filter((box) => box.height > box.width)
		.sort((first, second) => first.left - second.left)[0];
	if (!top || !left) {
		throw new Error("Starter boundaries did not render");
	}
	const start = {
		x: left.left + left.width / 2,
		y: top.top + top.height / 2,
	};
	await dragByTouch(session.page, start, { x: start.x, y: start.y - 100 });

	await expect(plan.getByTestId("wall-draft")).toHaveCount(0);
	await expect(session.page.getByTestId("wall-count")).toHaveText("5 стен");
	await session.context.close();
});

test("EDITOR-E2E-02I: a positive-overlap gesture trims the occupied part and publishes only the extension", async ({
	page: _page,
}, testInfo) => {
	const session = await openPersistentPhone(
		testInfo,
		"editor-smart-wall-extension",
	);
	await session.page.goto("/");
	await startNewProject(session.page, "Умное продолжение стены");
	await session.page.getByRole("button", { name: "Создать контур" }).click();
	await chooseEditorOption(session.page, "Стена");

	const exteriorBounds = await exteriorWallBounds(session.page);
	const top = exteriorBounds
		.filter((box) => box.width > box.height)
		.sort((first, second) => first.top - second.top)[0];
	if (!top) {
		throw new Error("Starter top boundary did not render");
	}
	const start = {
		x: top.left + top.width * 0.7,
		y: top.top + top.height / 2,
	};
	const revisionsBeforeExtension = await durableRevisionCount(session.page);
	const verticesBeforeExtension = await durablePlanVertices(session.page);
	await session.page.mouse.move(start.x, start.y);
	await session.page.mouse.down();
	await session.page.mouse.move(top.left + top.width + 70, start.y + 2, {
		steps: 8,
	});
	await session.page.mouse.up();

	await expect(session.page.getByTestId("wall-draft")).toHaveCount(0);
	await expect(session.page.getByTestId("wall-count")).toHaveText("5 стен");
	await expect(session.page.getByRole("alert")).toHaveCount(0);
	await expect
		.poll(() => durableRevisionCount(session.page))
		.toBe(revisionsBeforeExtension + 1);
	const verticesAfterExtension = await durablePlanVertices(session.page);
	expect(verticesAfterExtension).toHaveLength(
		verticesBeforeExtension.length + 1,
	);
	expect(verticesAfterExtension).toEqual(
		expect.arrayContaining([...verticesBeforeExtension]),
	);
	await expect(session.page.getByTestId("room-count")).toHaveText("1 комната");
	await expect(
		session.page.getByTestId("project-durability-status"),
	).toContainText("Сохранено локально");
	await session.context.close();
});

test("EDITOR-E2E-02J: a wall drawn near two boundaries automatically connects and divides the room", async ({
	page: _page,
}, testInfo) => {
	const session = await openPersistentPhone(
		testInfo,
		"editor-smart-wall-divider",
	);
	await session.page.goto("/");
	await startNewProject(session.page, "Умная перегородка");
	await session.page.getByRole("button", { name: "Создать контур" }).click();
	await chooseEditorOption(session.page, "Стена");

	const exteriorBounds = await exteriorWallBounds(session.page);
	const horizontal = exteriorBounds
		.filter((box) => box.width > box.height)
		.sort((first, second) => first.top - second.top);
	const top = horizontal[0];
	const bottom = horizontal.at(-1);
	if (!top || !bottom) {
		throw new Error("Starter horizontal boundaries did not render");
	}
	const x = top.left + top.width * 0.45;
	await session.page.mouse.move(x, top.top + top.height / 2);
	await session.page.mouse.down();
	await session.page.mouse.move(x + 2, bottom.top + bottom.height / 2, {
		steps: 8,
	});
	await session.page.mouse.up();

	await expect(session.page.getByTestId("wall-draft")).toHaveCount(0);
	await expect(session.page.getByTestId("wall-count")).toHaveText("7 стен");
	await expect(session.page.getByTestId("room-count")).toHaveText("2 комнаты");
	await expect(
		session.page.getByTestId("project-durability-status"),
	).toContainText("Сохранено локально");
	await session.context.close();
});

test("EDITOR-E2E-02K: a closed T-shaped plan immediately derives all rooms and opens in 3D", async ({
	page: _page,
}, testInfo) => {
	const session = await openPersistentPhone(
		testInfo,
		"editor-t-shaped-rooms-in-three-dimensions",
	);
	await session.page.goto("/");
	await startNewProject(session.page, "Три комнаты");
	await session.page.getByRole("button", { name: "Создать контур" }).click();
	await chooseEditorOption(session.page, "Стена");
	await drawCentreDivider(session.page);
	await expect(session.page.getByTestId("room-count")).toHaveText("2 комнаты");

	await chooseEditorOption(session.page, "Стена");
	const exterior = await exteriorWallBounds(session.page);
	const vertical = exterior
		.filter((box) => box.height > box.width)
		.sort((first, second) => first.left - second.left);
	const left = vertical[0];
	const right = vertical.at(-1);
	const allVertical = await session.page
		.getByTestId("wall-line")
		.evaluateAll((elements) =>
			elements
				.map((element) => {
					const box = element.getBoundingClientRect();
					return {
						height: box.height,
						left: box.left,
						top: box.top,
						width: box.width,
					};
				})
				.filter((box) => box.height > box.width),
		);
	if (!left || !right) {
		throw new Error("Starter vertical boundaries did not render");
	}
	const divider = allVertical.find(
		(box) =>
			box.left > left.left + left.width && box.left < right.left - right.width,
	);
	if (!divider) {
		throw new Error("The first divider did not render as a selectable wall");
	}
	const y = divider.top + divider.height / 2;
	await session.page.mouse.move(left.left + left.width / 2, y);
	await session.page.mouse.down();
	await session.page.mouse.move(divider.left + divider.width / 2, y, {
		steps: 8,
	});
	await session.page.mouse.up();

	await expect(session.page.getByTestId("room-count")).toHaveText("3 комнаты");
	await expect(session.page.getByTestId("room-face")).toHaveCount(3);
	const threeDimensional = session.page.getByRole("button", {
		name: "3D",
		exact: true,
	});
	await expect(threeDimensional).toBeEnabled();
	await threeDimensional.click();
	await expect(
		session.page.getByTestId("three-dimensional-canvas"),
	).toBeVisible();
	await session.context.close();
});

test("EDITOR-E2E-12: measurements stay readable while drawing and built-in furniture starts from the ToolRail", async ({
	page: _page,
}, testInfo) => {
	const session = await openPersistentPhone(
		testInfo,
		"editor-options-measurements-builtins",
	);
	await session.page.goto("/");
	await startNewProject(session.page, "Измерения и предметы");
	await session.page.getByRole("button", { name: "Создать контур" }).click();
	await chooseEditorOption(session.page, "Стена");

	const plan = session.page.getByTestId("plan-canvas");
	await expect(plan).toHaveAttribute("data-active-tool", "wall");
	await expect(session.page.getByTestId("active-tool-chip")).toHaveText(
		"Стены",
	);
	await expect(plan.getByTestId("room-measurement")).toHaveCount(1);
	await expect(plan.getByTestId("room-measurement")).toContainText(
		"4000 мм × 3000 мм",
	);
	await expect(plan.getByTestId("room-measurement")).toContainText("12,00 м²");
	await expect(
		session.page.getByRole("button", { name: "Прямоугольная комната" }),
	).toHaveCount(0);
	await expect(
		session.page.getByRole("navigation", { name: "Инструменты редактора" }),
	).toBeVisible();
	await expect(session.page.getByRole("button", { name: "Опции" })).toHaveCount(
		0,
	);
	await session.page
		.getByRole("navigation", { name: "Инструменты редактора" })
		.getByRole("button", { name: "Предметы интерьера" })
		.click();

	const catalog = session.page.getByRole("dialog", {
		name: "Предметы интерьера",
	});
	await expect(catalog).toBeVisible();
	await expect(
		catalog.getByRole("img", { name: "Превью предмета: Кровать" }),
	).toBeVisible();
	await catalog
		.getByRole("button", { name: /Кровать.*1769 × 1075 × 426 мм/ })
		.click();
	const showOnPlan = catalog.getByRole("button", {
		name: "Показать на плане",
	});
	await expect(showOnPlan).toBeEnabled({ timeout: 30_000 });
	await showOnPlan.click();
	await expect(catalog).toHaveCount(0);
	await expect(plan).toHaveAttribute("data-active-tool", "item");
	await expect(session.page.getByTestId("item-placement-identity")).toHaveText(
		"Кровать",
	);
	await expect(session.page.getByTestId("item-draft-hint")).toHaveCount(0);
	await expect(session.page.getByLabel("Свойства нового предмета")).toHaveCount(
		0,
	);
	await session.context.close();
});

test("EDITOR-E2E-12A: a new plan has no unexplained dashed guide across the room", async ({
	page: _page,
}, testInfo) => {
	const session = await openPersistentPhone(testInfo, "editor-no-dashed-guide");
	await session.page.goto("/");
	await startNewProject(session.page, "Чистый чертёж");
	await session.page.getByRole("button", { name: "Создать контур" }).click();

	await expect(
		session.page.getByTestId("plan-canvas").locator("line.measurementGuide"),
	).toHaveCount(0);
	await session.context.close();
});

test("PLAN-E2E-04C: selecting walls leaves the plan viewport exactly where it was", async ({
	page: _page,
}, testInfo) => {
	const session = await openPersistentPhone(
		testInfo,
		"editor-wall-selection-stable",
	);
	await session.page.goto("/");
	await startNewProject(session.page, "Стабильный выбор");
	await session.page.getByRole("button", { name: "Создать контур" }).click();

	const planContent = session.page
		.getByTestId("plan-canvas")
		.locator(":scope > g")
		.first();
	const transformBefore = await planContent.getAttribute("transform");
	await chooseEditorOption(session.page, "Рука и выбор");
	const wall = session.page
		.locator('[data-testid="wall-segment"][data-wall-kind="exterior"]')
		.first();
	await wall.click();
	await expect(session.page.getByTestId("selected-wall-inspector")).toHaveCount(
		0,
	);
	await expect(
		session.page
			.getByTestId("editor-action-dock")
			.getByRole("button", { name: "Свойства", exact: true }),
	).toBeVisible();
	await expect(planContent).toHaveAttribute("transform", transformBefore ?? "");
	await session.context.close();
});

test("PLAN-E2E-04D: a legacy thick wall reopens with exact geometry while thickness editing stays absent", async ({
	page: _page,
}, testInfo) => {
	const session = await openPersistentPhone(
		testInfo,
		"editor-legacy-wall-thickness",
	);
	await session.page.goto("/");
	await startNewProject(session.page, "Старая толщина стены");
	await session.page.getByRole("button", { name: "Создать контур" }).click();
	await chooseEditorOption(session.page, "Рука и выбор");
	const wall = session.page.getByTestId("wall-segment").first();
	const wallId = await wall.getAttribute("data-wall-id");
	if (!wallId) throw new Error("Wall id required");
	await wall.click();
	const verticesBefore = await durablePlanVertices(session.page);
	const roomsBefore = await durableRooms(session.page);
	await loadLegacyProjectFixture(
		session.page,
		(source) => {
			const result = changeGeneralWallThickness(
				source,
				{ wallSegmentId: wallId, thicknessMm: 151 },
				new Date().toISOString(),
			);
			if (result.kind !== "accepted")
				throw new Error("Legacy thickness fixture rejected");
			return result.project;
		},
		wallId,
	);
	const loaded = await durableWallSegment(session.page, wallId);
	expect(loaded?.thicknessMm).toBe(151);
	expect(await durablePlanVertices(session.page)).toEqual(verticesBefore);
	expect(await durableRooms(session.page)).toEqual(roomsBefore);
	await expect(
		session.page.getByLabel("Толщина выбранной стены, мм"),
	).toHaveCount(0);
	const baseline = await durableRevisionCount(session.page);
	await chooseEditorOption(session.page, "3D");
	await expect(
		session.page.getByTestId("three-dimensional-canvas"),
	).toBeVisible();
	await session.page.reload();
	await openProjectFromHub(session.page, "Старая толщина стены");
	expect(await durableWallSegment(session.page, wallId)).toEqual(loaded);
	expect(await durablePlanVertices(session.page)).toEqual(verticesBefore);
	expect(await durableRevisionCount(session.page)).toBe(baseline);
	await session.context.close();
});

test("PLAN-E2E-04D-1: wall reversal is absent while a legacy reversed wall and its exact item address reopen", async ({
	page: _page,
}, testInfo) => {
	const session = await openPersistentPhone(testInfo, "editor-wall-reversal");
	await session.page.goto("/");
	await startNewProject(session.page, "Направление стены");
	await session.page.getByRole("button", { name: "Создать контур" }).click();
	await chooseEditorOption(session.page, "Рука и выбор");

	const wall = session.page
		.locator('[data-testid="wall-segment"][data-wall-kind="exterior"]')
		.first();
	const wallId = await wall.getAttribute("data-wall-id");
	if (!wallId) throw new Error("Expected a selected exterior wall identity");
	const directionBefore = await durableWallSegment(session.page, wallId);
	if (!directionBefore) throw new Error("Expected a durable exterior wall");

	await wall.click();
	await expandSelectedWallInspector(session.page);
	await loadLegacyWallPanelFixture(session.page, { side: "right" });
	await expect.poll(() => durableWallItems(session.page)).toHaveLength(1);
	const offset = session.page.getByLabel(
		"Смещение настенного предмета «Настенная панель», мм",
	);
	await offset.fill("1100");
	await offset.blur();
	await expect
		.poll(async () => (await durableWallItems(session.page))[0]?.offsetMm)
		.toBe(1100);
	const [panelBefore] = await durableWallItems(session.page);
	if (!panelBefore) throw new Error("Expected a durable wall panel");
	const revisionsBeforeReversal = await durableRevisionCount(session.page);

	await expect(
		session.page.getByRole("button", { name: "Развернуть стену", exact: true }),
	).toHaveCount(0);
	expect(await durableWallSegment(session.page, wallId)).toEqual(
		directionBefore,
	);
	expect(await durableRevisionCount(session.page)).toBe(
		revisionsBeforeReversal,
	);
	await loadLegacyProjectFixture(
		session.page,
		(source) => {
			const result = reverseGeneralWall(
				source,
				{ wallSegmentId: wallId },
				new Date().toISOString(),
			);
			if (result.kind !== "accepted")
				throw new Error("Legacy reversed wall fixture rejected");
			return result.project;
		},
		wallId,
	);
	await expect
		.poll(() => durableRevisionCount(session.page))
		.toBe(revisionsBeforeReversal + 1);
	await expect
		.poll(() => durableWallSegment(session.page, wallId))
		.toMatchObject({
			endVertexId: directionBefore.startVertexId,
			startVertexId: directionBefore.endVertexId,
			wallSegmentId: wallId,
		});
	await expect
		.poll(() => durableWallItems(session.page))
		.toEqual([
			expect.objectContaining({
				assetInstanceId: panelBefore.assetInstanceId,
				offsetMm: 3000,
				side: "left",
				wallSegmentId: wallId,
			}),
		]);

	await session.page.reload();
	await openProjectFromHub(session.page, "Направление стены");
	await expect
		.poll(() => durableWallSegment(session.page, wallId))
		.toMatchObject({
			endVertexId: directionBefore.startVertexId,
			startVertexId: directionBefore.endVertexId,
			wallSegmentId: wallId,
		});
	await expect
		.poll(() => durableWallItems(session.page))
		.toEqual([
			expect.objectContaining({
				assetInstanceId: panelBefore.assetInstanceId,
				offsetMm: 3000,
				side: "left",
				wallSegmentId: wallId,
			}),
		]);
	await session.context.close();
});

test("EDITOR-E2E-03: 3D camera orbits by touch without creating another project revision", async ({
	page: _page,
}, testInfo) => {
	const session = await openPersistentPhone(testInfo, "editor-3d-gesture");
	await session.page.goto("/");
	await startNewProject(session.page, "3D гостиная");
	await session.page.getByRole("button", { name: "Создать контур" }).click();
	await chooseEditorOption(session.page, "3D");

	await expect(
		session.page.getByRole("button", { name: "Войти в Фокус" }),
	).toHaveCount(0);
	await expect(
		session.page.getByRole("button", { name: "Выйти из Фокуса" }),
	).toHaveCount(0);
	await expect(
		session.page.getByTestId("editor-workspace"),
	).not.toHaveAttribute("data-focus-active");
	await expect(
		session.page.getByTestId("editor-workspace"),
	).not.toHaveAttribute("data-native-fullscreen");
	const scene = session.page.getByTestId("three-dimensional-canvas");
	await expect(scene).toBeVisible();
	await expect(
		session.page.getByTestId("three-dimensional-metrics"),
	).toContainText("12,00 м²");
	const before = await session.page
		.getByTestId("three-dimensional-camera")
		.textContent();
	const box = await scene.boundingBox();
	if (!box) {
		throw new Error("3D canvas did not render");
	}
	await session.page.mouse.move(
		box.x + box.width * 0.45,
		box.y + box.height * 0.45,
	);
	await session.page.mouse.down();
	await session.page.mouse.move(
		box.x + box.width * 0.65,
		box.y + box.height * 0.55,
		{ steps: 6 },
	);
	await session.page.mouse.up();

	await expect(
		session.page.getByTestId("three-dimensional-camera"),
	).not.toHaveText(before ?? "");
	await expect(
		session.page.getByTestId("project-durability-status"),
	).toContainText("Сохранено локально");
	await session.context.close();
});

test("EDITOR-E2E-03C: 3D inspection has no Room picker and keeps the orbit gesture clear", async ({
	page: _page,
}, testInfo) => {
	const session = await openPersistentPhone(
		testInfo,
		"editor-3d-room-selection",
	);
	await session.page.goto("/");
	await startNewProject(session.page, "3D выбор комнаты");
	await session.page.getByRole("button", { name: "Создать контур" }).click();
	await chooseEditorOption(session.page, "3D");

	const scene = session.page.getByTestId("three-dimensional-canvas");
	await expect(scene).toBeVisible();
	await expect(
		session.page.getByTestId("three-dimensional-room-selection"),
	).toHaveCount(0);
	await expect(session.page.getByLabel("Выбрать помещение в 3D")).toHaveCount(
		0,
	);
	await expect(
		session.page.getByRole("complementary", {
			name: "Свойства выбранного помещения",
		}),
	).toHaveCount(0);
	const revision = await session.page
		.getByRole("button", { name: "Переименовать проект 3D выбор комнаты" })
		.textContent();

	const box = await scene.boundingBox();
	if (!box) throw new Error("3D canvas did not render");
	await scene.click({ position: { x: box.width / 2, y: box.height / 2 } });
	await expect(
		session.page.getByTestId("three-dimensional-room-selection"),
	).toHaveCount(0);
	const cameraBeforeOrbit = await session.page
		.getByTestId("three-dimensional-camera")
		.textContent();
	await session.page.mouse.move(
		box.x + box.width * 0.42,
		box.y + box.height * 0.46,
	);
	await session.page.mouse.down();
	await session.page.mouse.move(
		box.x + box.width * 0.61,
		box.y + box.height * 0.54,
		{ steps: 6 },
	);
	await session.page.mouse.up();
	await expect(
		session.page.getByTestId("three-dimensional-camera"),
	).not.toHaveText(cameraBeforeOrbit ?? "");
	await expect(
		session.page.getByRole("button", {
			name: "Переименовать проект 3D выбор комнаты",
		}),
	).toHaveText(revision ?? "");
	await session.context.close();
});

test("EDITOR-E2E-03A: a genuine two-finger 3D pinch changes only the disposable camera distance", async ({
	page: _page,
}, testInfo) => {
	const session = await openPersistentPhone(testInfo, "editor-3d-pinch");
	await session.page.goto("/");
	await startNewProject(session.page, "3D масштаб");
	await session.page.getByRole("button", { name: "Создать контур" }).click();
	await chooseEditorOption(session.page, "3D");
	const scene = session.page.getByTestId("three-dimensional-canvas");
	const box = await scene.boundingBox();
	if (!box) throw new Error("3D canvas did not render");
	const before = await session.page
		.getByTestId("three-dimensional-camera")
		.textContent();
	const first = {
		id: 81,
		x: box.x + box.width * 0.28,
		y: box.y + box.height * 0.45,
	};
	const second = {
		id: 82,
		x: box.x + box.width * 0.52,
		y: box.y + box.height * 0.55,
	};
	const cdp = await session.page.context().newCDPSession(session.page);
	try {
		await cdp.send("Input.dispatchTouchEvent", {
			touchPoints: [first, second],
			type: "touchStart",
		});
		await cdp.send("Input.dispatchTouchEvent", {
			touchPoints: [
				{ ...first, x: first.x - 38, y: first.y - 18 },
				{ ...second, x: second.x + 38, y: second.y + 18 },
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
	await expect(
		session.page.getByTestId("three-dimensional-camera"),
	).not.toHaveText(before ?? "");
	await session.context.close();
});

test("EDITOR-E2E-03B: phone 3D keeps pinch scaling direct instead of showing redundant scale buttons", async ({
	page: _page,
}, testInfo) => {
	const session = await openPersistentPhone(
		testInfo,
		"editor-3d-scale-buttons",
	);
	await session.page.goto("/");
	await startNewProject(session.page, "Шкала 3D");
	await session.page.getByRole("button", { name: "Создать контур" }).click();
	await chooseEditorOption(session.page, "3D");
	await expect(
		session.page.locator('button[aria-label="Приблизить 3D"]'),
	).toBeHidden();
	await expect(
		session.page.locator('button[aria-label="Отдалить 3D"]'),
	).toBeHidden();
	await expect(
		session.page.getByRole("button", { name: "Авто cutaway" }),
	).toBeVisible();
	await session.context.close();
});

test("CUTAWAY-E2E-01: 3D cutaway controls and context recovery keep camera state outside durable history", async ({
	page: _page,
}, testInfo) => {
	const session = await openPersistentPhone(testInfo, "editor-3d-cutaway");
	await session.page.goto("/");
	await startNewProject(session.page, "3D cutaway");
	await session.page.getByRole("button", { name: "Создать контур" }).click();
	await chooseEditorOption(session.page, "3D");

	const scene = session.page.getByTestId("three-dimensional-canvas");
	const sceneBox = await scene.boundingBox();
	if (!sceneBox) throw new Error("3D canvas did not render");
	const revisionCountBeforeInspection = await durableRevisionCount(
		session.page,
	);
	const cutawayState = session.page.getByTestId("three-dimensional-cutaway");
	const cutawayNotice = session.page.getByTestId(
		"three-dimensional-cutaway-notice",
	);
	const auto = session.page.getByRole("button", { name: "Авто cutaway" });
	const showAll = session.page.getByRole("button", {
		name: "Показать все стены",
	});

	await expect(auto).toHaveAttribute("aria-pressed", "true");
	await expect(cutawayState).toHaveText(
		"Авто: ближние внешние стены скрываются",
	);
	await expect(cutawayNotice).toHaveCount(0);
	const cameraBeforeOrbit = await session.page
		.getByTestId("three-dimensional-camera")
		.textContent();
	await session.page.mouse.move(
		sceneBox.x + sceneBox.width * 0.25,
		sceneBox.y + sceneBox.height * 0.5,
	);
	await session.page.mouse.down();
	await session.page.mouse.move(
		sceneBox.x + sceneBox.width * 0.75,
		sceneBox.y + sceneBox.height * 0.56,
		{ steps: 8 },
	);
	await session.page.mouse.up();
	await expect(
		session.page.getByTestId("three-dimensional-camera"),
	).not.toHaveText(cameraBeforeOrbit ?? "");

	await showAll.click();
	await expect(showAll).toHaveAttribute("aria-pressed", "true");
	await expect(auto).toHaveAttribute("aria-pressed", "false");
	await expect(cutawayState).toHaveText("Все стены показаны");
	await expect(cutawayNotice).toHaveCount(0);

	await scene.evaluate((canvas) =>
		canvas.dispatchEvent(new Event("webglcontextlost", { cancelable: true })),
	);
	const sceneRegion = session.page.getByRole("region", {
		name: "3D вид комнаты",
	});
	await expect(sceneRegion.getByRole("status")).toContainText(
		"Графический контекст потерян. Данные проекта не изменены.",
	);
	await scene.evaluate((canvas) =>
		canvas.dispatchEvent(new Event("webglcontextrestored")),
	);
	await expect(sceneRegion.getByRole("status")).toHaveCount(0);
	await expect(showAll).toHaveAttribute("aria-pressed", "true");
	await expect(cutawayState).toHaveText("Все стены показаны");

	await auto.click();
	await expect(auto).toHaveAttribute("aria-pressed", "true");
	await expect(cutawayState).toHaveText(
		"Авто: ближние внешние стены скрываются",
	);
	await expect(cutawayNotice).toHaveCount(0);
	await expect
		.poll(() => durableRevisionCount(session.page))
		.toBe(revisionCountBeforeInspection);
	await session.context.close();
});

test("RENDERER-E2E-01: repeated 3D recovery failure offers a non-durable Plan fallback", async ({
	page: _page,
}, testInfo) => {
	const session = await openPersistentPhone(
		testInfo,
		"editor-3d-recovery-fallback",
	);
	await session.page.goto("/");
	await startNewProject(session.page, "3D безопасное восстановление");
	await session.page.getByRole("button", { name: "Создать контур" }).click();
	await chooseEditorOption(session.page, "3D");

	const scene = session.page.getByTestId("three-dimensional-canvas");
	const revisionCountBeforeFailure = await durableRevisionCount(session.page);
	await scene.evaluate((canvas) => {
		Object.defineProperty(canvas, "getContext", {
			configurable: true,
			value: () => null,
		});
		canvas.dispatchEvent(new Event("webglcontextlost", { cancelable: true }));
		canvas.dispatchEvent(new Event("webglcontextrestored"));
	});

	await expect(
		session.page.getByRole("button", { name: "Открыть точный план 2D" }),
	).toBeVisible();
	await expect(
		session.page.getByTestId("three-dimensional-renderer-diagnostics"),
	).toContainText("восстановление исчерпано");
	const fallbackButton = session.page.getByRole("button", {
		name: "Открыть точный план 2D",
	});
	const [headerBox, fallbackBox] = await Promise.all([
		session.page.getByTestId("editor-top-bar").boundingBox(),
		fallbackButton.boundingBox(),
	]);
	if (!headerBox || !fallbackBox)
		throw new Error("Expected the 3D recovery action");
	expect(fallbackBox.y).toBeGreaterThanOrEqual(headerBox.y + headerBox.height);
	expect(fallbackBox.height).toBeGreaterThanOrEqual(44);
	await session.page.screenshot({
		path: testInfo.outputPath("editor-3d-recovery.png"),
		scale: "css",
	});
	await session.page
		.getByRole("button", { name: "Открыть точный план 2D" })
		.click();
	await expect(session.page.getByTestId("plan-canvas")).toBeVisible();
	await expect
		.poll(() => durableRevisionCount(session.page))
		.toBe(revisionCountBeforeFailure);
	await session.context.close();
});

test("EDITOR-E2E-04: placing a resized schematic item appears in both the durable plan and 3D projection", async ({
	page: _page,
}, testInfo) => {
	const session = await openPersistentPhone(testInfo, "editor-item");
	await session.page.goto("/");
	await startNewProject(session.page, "Мебель");
	await session.page.getByRole("button", { name: "Создать контур" }).click();
	await chooseFloorPlaceholder(session.page, "Изменяемый макет");
	const plan = session.page.getByTestId("plan-canvas");
	const planBox = await plan.boundingBox();
	if (!planBox) {
		throw new Error("Plan canvas did not render");
	}
	await clickPlanPointMm(session.page, 2000, 1500);
	await session.page
		.getByRole("button", { name: "Подтвердить размещение предмета" })
		.click();

	await expect(session.page.getByTestId("item-count")).toHaveText("1 предмет");
	await expect(session.page.getByTestId("schematic-item")).toBeVisible();
	await chooseEditorOption(session.page, "Рука и выбор");
	await session.page.getByTestId("schematic-item").last().click();
	await expandSelectedItemInspector(session.page);
	await expect(
		session.page.getByLabel("Ширина выбранного предмета, мм"),
	).toBeEnabled();
	await session.page.getByLabel("Ширина выбранного предмета, мм").fill("1600");
	await session.page
		.getByLabel("Ширина выбранного предмета, мм")
		.press("Enter");
	await expect(session.page.getByTestId("schematic-item-front")).toBeVisible();
	await chooseEditorOption(session.page, "3D");
	await expect(
		session.page.getByTestId("three-dimensional-canvas"),
	).toBeVisible();
	await expect(
		session.page.getByText("1 предмет в плане", { exact: true }),
	).toHaveText("1 предмет в плане");
	await expect(
		session.page.getByText("1 предмет в плане", { exact: true }),
	).toBeHidden();
	await session.context.close();
});

test("EDITOR-E2E-04B: a floor-item ghost uses one explicit Поставить dock", async ({
	page: _page,
}, testInfo) => {
	const session = await openPersistentPhone(
		testInfo,
		"editor-item-placement-preview",
	);
	await session.page.goto("/");
	await startNewProject(session.page, "Предпросмотр предмета");
	await session.page.getByRole("button", { name: "Создать контур" }).click();
	await chooseBuiltInGreybox(session.page, "Стол", false);
	// The armed placement dock exposes identity and cancellation before the first point.
	await expect(session.page.getByTestId("item-placement-identity")).toHaveText(
		"Деревянный комод",
	);
	await expect(session.page.getByTestId("item-placement-cancel")).toBeVisible();
	await expect(
		session.page.getByTestId("item-placement-confirm"),
	).toBeDisabled();
	await expect(
		session.page.getByRole("navigation", { name: "Инструменты редактора" }),
	).toHaveCount(0);
	const plan = session.page.getByTestId("plan-canvas");
	const planBox = await plan.boundingBox();
	if (!planBox) throw new Error("Plan canvas did not render");

	await clickPlanPointMm(session.page, 2000, 1500);
	const preview = session.page.getByTestId("item-placement-preview");
	await expect(preview).toHaveAttribute("data-placement-valid", "true");
	await expect(session.page.getByTestId("item-count")).toHaveText(
		"0 предметов",
	);
	await expect(
		session.page.getByTestId("editor-top-bar").getByRole("status"),
	).toHaveText("Предпросмотр — не сохранено");
	const placementDock = session.page.getByTestId("item-placement-action-dock");
	await expect(placementDock).toBeVisible();
	await expect(session.page.getByTestId("item-draft-hint")).toHaveCount(0);
	await expect(session.page.getByTestId("editor-action-dock")).toHaveCount(0);
	await expect(
		session.page.getByRole("navigation", { name: "Инструменты редактора" }),
	).toHaveCount(0);
	await expect(
		session.page.getByRole("button", {
			name: "Подтвердить размещение предмета",
		}),
	).toBeVisible();
	await expect(session.page.getByTestId("item-placement-confirm")).toHaveText(
		"Поставить",
	);
	await expect(
		session.page.getByRole("button", { name: "Отменить размещение предмета" }),
	).toBeVisible();
	await session.page
		.getByRole("button", { name: "Подтвердить размещение предмета" })
		.click();
	await expect(session.page.getByTestId("item-count")).toHaveText("1 предмет");
	await expect(
		session.page.getByTestId("item-placement-durable-status"),
	).toHaveText("Предмет размещён и сохранён.");
	await expect(preview).toHaveCount(0);
	await expect(plan).toHaveAttribute("data-active-tool", "select");

	await chooseBuiltInGreybox(session.page, "Стол", false);
	await expect(
		session.page.getByTestId("item-placement-durable-status"),
	).toHaveCount(0);
	await clickPlanPointMm(session.page, -400, 1500);
	await expect(preview).toHaveAttribute("data-placement-valid", "false");
	await expect(
		session.page.getByRole("button", {
			name: "Подтвердить размещение предмета",
		}),
	).toHaveAttribute("aria-disabled", "true");
	await session.page
		.getByRole("button", { name: "Отменить размещение предмета" })
		.click();
	await expect(preview).toHaveCount(0);
	await expect(session.page.getByTestId("item-draft-hint")).toHaveCount(0);
	await expect(plan).toHaveAttribute("data-active-tool", "select");
	await session.context.close();
});

test("EDITOR-E2E-04BA: dragging a placement preview follows the finger without panning the plan", async ({
	page: _page,
}, testInfo) => {
	const session = await openPersistentPhone(
		testInfo,
		"editor-item-placement-drag",
	);
	await session.page.goto("/");
	await startNewProject(session.page, "Перетаскивание предпросмотра");
	await session.page.getByRole("button", { name: "Создать контур" }).click();
	await chooseBuiltInGreybox(session.page, "Стол", false);
	const plan = session.page.getByTestId("plan-canvas");
	const planBox = await plan.boundingBox();
	if (!planBox) throw new Error("Plan canvas did not render");
	const planContent = session.page.getByTestId("plan-content");
	const transformBefore = await planContent.getAttribute("transform");
	const start = await planPointMm(session.page, { xMm: 1200, zMm: 1500 });
	const end = await planPointMm(session.page, { xMm: 2400, zMm: 1500 });

	await session.page.mouse.move(start.x, start.y);
	await session.page.mouse.down();
	await session.page.mouse.move(end.x, end.y, { steps: 8 });
	const preview = session.page.getByTestId("item-placement-preview");
	await expect(preview).toBeVisible();
	const placementDock = session.page.getByTestId("item-placement-action-dock");
	await expect(placementDock).toBeVisible();
	await expect(session.page.getByTestId("editor-action-dock")).toHaveCount(0);
	await expect(session.page.getByTestId("item-placement-confirm")).toHaveText(
		"Поставить",
	);
	await expect(session.page.getByTestId("item-placement-cancel")).toHaveText(
		"Отмена",
	);
	const placementDockBox = await placementDock.boundingBox();
	const confirmBox = await session.page
		.getByTestId("item-placement-confirm")
		.boundingBox();
	const cancelBox = await session.page
		.getByTestId("item-placement-cancel")
		.boundingBox();
	if (!placementDockBox) throw new Error("Placement sheet did not render");
	expect(placementDockBox.y).toBeGreaterThanOrEqual(planBox.y);
	expect(placementDockBox.y + placementDockBox.height).toBeLessThanOrEqual(
		planBox.y + planBox.height + 1,
	);
	expect(confirmBox?.height).toBeGreaterThanOrEqual(48);
	expect(cancelBox?.height).toBeGreaterThanOrEqual(48);
	const previewBox = await preview.locator("polygon").first().boundingBox();
	expect(previewBox?.x).toBeGreaterThan(start.x);
	expect(await planContent.getAttribute("transform")).toBe(transformBefore);
	await session.page.mouse.up();
	await session.page
		.getByRole("button", { name: "Отменить размещение предмета" })
		.click();
	await expect(session.page.getByTestId("item-draft-hint")).toHaveCount(0);
	await expect(plan).toHaveAttribute("data-active-tool", "select");
	await session.context.close();
});

test("EDITOR-E2E-04BB: a selected mobile item clearly discloses parameters and never triggers browser input zoom", async ({
	page: _page,
}, testInfo) => {
	const session = await openPersistentPhone(
		testInfo,
		"editor-mobile-inspector-disclosure",
	);
	await session.page.goto("/");
	await startNewProject(session.page, "Понятные параметры");
	await session.page.getByRole("button", { name: "Создать контур" }).click();
	await chooseBuiltInGreybox(session.page);
	const plan = session.page.getByTestId("plan-canvas");
	const planBox = await plan.boundingBox();
	if (!planBox) throw new Error("Plan canvas did not render");
	await clickPlanPointMm(session.page, 2000, 1500);
	await expect(session.page.getByTestId("item-count")).toHaveText("1 предмет");
	await chooseEditorOption(session.page, "Рука и выбор");
	await session.page.getByTestId("schematic-item").click();
	await expect(session.page.getByText("Нажмите «Параметры»")).toBeHidden();
	const selectionInspector = session.page.getByTestId(
		"selected-item-inspector",
	);
	await expect(selectionInspector).toHaveAttribute(
		"data-testid",
		"selected-item-inspector",
	);
	await expect(selectionInspector).toHaveAttribute("data-item-locked", "false");
	await expect(
		selectionInspector.getByTestId("selected-item-inspector-icon"),
	).toBeHidden();
	const placementConfirmation = session.page.getByTestId(
		"item-placement-durable-status",
	);
	await expect(placementConfirmation).toHaveText(
		"Предмет размещён и сохранён.",
	);
	const width = session.page.getByLabel("Ширина выбранного предмета, мм");
	await expect(selectionInspector).toBeHidden();
	await expect(width).toBeHidden();
	await expect(
		session.page.getByText("Ширина выбранного предмета, мм", { exact: true }),
	).toBeHidden();
	await expect(placementConfirmation).toBeHidden();
	const [dockBox, selectionFrameBox] = await Promise.all([
		session.page.getByTestId("editor-action-dock").boundingBox(),
		session.page
			.getByTestId("two-dimensional-item-selection-frame")
			.boundingBox(),
	]);
	if (!dockBox || !selectionFrameBox) {
		throw new Error("The editor dock and selected item frame must render");
	}
	expect(selectionFrameBox.y + selectionFrameBox.height).toBeLessThanOrEqual(
		dockBox.y,
	);
	await expandSelectedItemInspector(session.page);
	await expect(width).toBeVisible();
	await expect(width).toHaveAttribute(
		"aria-label",
		"Ширина выбранного предмета, мм",
	);
	await expect(
		session.page.getByLabel("Глубина выбранного предмета, мм"),
	).toHaveAttribute("aria-label", "Глубина выбранного предмета, мм");
	await expect(
		session.page.getByLabel("Высота выбранного предмета, мм"),
	).toHaveAttribute("aria-label", "Высота выбранного предмета, мм");
	const item = session.page.locator("g[data-item-id]").first();
	const transformBefore = await item.getAttribute("transform");
	const angle = session.page.getByLabel(
		"Угол поворота выбранного предмета, градусы",
	);
	await angle.fill("90");
	await angle.press("Enter");
	await expect(item).not.toHaveAttribute("transform", transformBefore ?? "");
	await expect(angle).toHaveValue("90");
	expect(
		await width.evaluate((input) => getComputedStyle(input).fontSize),
	).toBe("16px");
	await session.context.close();
});

test("ITEM-E2E-05: a selected item changes only through a declared color variant and Undo restores it", async ({
	page: _page,
}, testInfo) => {
	const session = await openPersistentPhone(
		testInfo,
		"editor-item-color-variant",
	);
	await session.page.goto("/");
	await startNewProject(session.page, "Вариант предмета");
	await session.page.getByRole("button", { name: "Создать контур" }).click();
	await chooseEditorOption(session.page, "Предметы интерьера");
	const catalog = session.page.getByRole("dialog", {
		name: "Предметы интерьера",
	});
	await catalog
		.getByTestId("catalog-authoring")
		.getByText("Импорт модели", { exact: true })
		.click();
	await catalog
		.getByRole("button", { name: "Создать макетный предмет" })
		.click();
	const composer = catalog.getByRole("form", {
		name: "Создать макетный предмет",
	});
	await composer.getByLabel("Название макетного предмета").fill("Цветной стол");
	await composer.getByLabel("Ширина макетного предмета, мм").fill("1200");
	await composer.getByLabel("Глубина макетного предмета, мм").fill("700");
	await composer.getByLabel("Высота макетного предмета, мм").fill("750");
	await composer.getByRole("button", { name: "Начать размещение" }).click();
	await expect(catalog).toHaveCount(0);
	const plan = session.page.getByTestId("plan-canvas");
	const planBox = await plan.boundingBox();
	if (!planBox) throw new Error("Plan canvas did not render");
	await clickPlanPointMm(session.page, 2000, 1500);
	await expect(
		session.page.getByTestId("item-placement-preview"),
	).toHaveAttribute("data-placement-valid", "true");
	await session.page
		.getByRole("button", { name: "Подтвердить размещение предмета" })
		.click();
	await expect(session.page.getByTestId("item-count")).toHaveText("1 предмет");
	await chooseEditorOption(session.page, "Рука и выбор");
	const item = session.page.getByTestId("schematic-item");
	await item.click();
	await expandSelectedItemInspector(session.page);
	const initialFill = await item.getAttribute("fill");
	if (!initialFill) {
		throw new Error("Placed item did not have a schematic fill");
	}

	const colors = session.page.getByRole("group", { name: "Цвет предмета" });
	await expect(colors).toBeVisible();
	const revisionsBeforeVariant = await durableRevisionCount(session.page);
	const blue = colors.getByRole("button", {
		name: "Выбрать вариант цвета предмета Глубокий синий",
	});
	await blue.click();
	const confirmation = session.page.getByRole("dialog", {
		name: "Подтвердить вариант цвета",
	});
	await expect(confirmation).toContainText("Глубокий синий");
	await expect(item).toHaveAttribute("fill", initialFill);
	await expect
		.poll(() => durableRevisionCount(session.page))
		.toBe(revisionsBeforeVariant);
	await confirmation.getByRole("button", { name: "Отменить вариант" }).click();
	await blue.click();
	await confirmation.getByRole("button", { name: "Применить вариант" }).click();
	await expect(item).toHaveAttribute("fill", "#416b91");
	await expect(blue).toHaveAttribute("aria-pressed", "true");
	await expect
		.poll(() => durableRevisionCount(session.page))
		.toBe(revisionsBeforeVariant + 1);
	await expect
		.poll(async () => (await durableFloorItems(session.page))[0])
		.toEqual(
			expect.objectContaining({
				color: "#416b91",
				colorVariantId: "alpha-blue",
			}),
		);

	await triggerEditorHistoryAction(session.page, "undo");
	await expect(session.page.getByTestId("schematic-item")).toHaveAttribute(
		"fill",
		initialFill,
	);
	await triggerEditorHistoryAction(session.page, "redo");
	await expect(session.page.getByTestId("schematic-item")).toHaveAttribute(
		"fill",
		"#416b91",
	);
	await session.page.reload();
	await openProjectFromHub(session.page, "Вариант предмета");
	await expect
		.poll(async () => (await durableFloorItems(session.page))[0])
		.toEqual(expect.objectContaining({ colorVariantId: "alpha-blue" }));
	await session.context.close();
});

test("EDITOR-E2E-04B: dragging an unselected 3D item selects it without accidentally drafting a move", async ({
	page: _page,
}, testInfo) => {
	const session = await openPersistentPhone(
		testInfo,
		"editor-item-three-dimensional-select-before-move",
	);
	await session.page.goto("/");
	await startNewProject(session.page, "3D выбор предмета");
	await session.page.getByRole("button", { name: "Создать контур" }).click();
	await chooseBuiltInGreybox(session.page, "Стол");
	const plan = session.page.getByTestId("plan-canvas");
	const planBox = await plan.boundingBox();
	if (!planBox) throw new Error("Plan canvas did not render");
	await clickPlanPointMm(session.page, 2000, 1500);
	await chooseEditorOption(session.page, "3D");
	await expect(
		session.page.getByTestId("three-dimensional-custom-glb-status"),
	).toHaveText("rendered:1");
	const scene = session.page.getByTestId("three-dimensional-canvas");
	const sceneBox = await scene.boundingBox();
	if (!sceneBox) throw new Error("3D canvas did not render");
	const cameraBefore = await session.page
		.getByTestId("three-dimensional-camera")
		.textContent();
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
		session.page.getByTestId("three-dimensional-item-preview"),
	).toHaveText("нет");
	await expect(
		session.page.getByTestId("three-dimensional-item-transform-draft"),
	).toHaveCount(0);
	await expect(
		session.page.getByTestId("three-dimensional-camera"),
	).not.toHaveText(cameraBefore ?? "");
	await expect(
		session.page.getByTestId("three-dimensional-rotation-handle"),
	).toBeVisible();
	await session.context.close();
});

test("EDITOR-E2E-04C: a selected 3D item moves and rotates smoothly without extra confirmation", async ({
	page: _page,
}, testInfo) => {
	const session = await openPersistentPhone(
		testInfo,
		"editor-item-three-dimensional-direct",
	);
	await session.page.goto("/");
	await startNewProject(session.page, "3D предмет");
	await session.page.getByRole("button", { name: "Создать контур" }).click();
	await chooseBuiltInGreybox(session.page, "Стол");
	const plan = session.page.getByTestId("plan-canvas");
	const planBox = await plan.boundingBox();
	if (!planBox) throw new Error("Plan canvas did not render");
	await clickPlanPointMm(session.page, 2000, 1500);
	await chooseEditorOption(session.page, "3D");
	const scene = session.page.getByTestId("three-dimensional-canvas");
	let sceneBox = await scene.boundingBox();
	if (!sceneBox) throw new Error("3D canvas did not render");
	const placementStatus = session.page.getByTestId(
		"item-placement-durable-status",
	);
	const cameraDeck = session.page.getByTestId(
		"three-dimensional-view-controls",
	);
	await expect(placementStatus).toHaveText("Предмет размещён и сохранён.");
	await expect(placementStatus).toBeHidden();
	await expect(cameraDeck).toBeVisible();
	const cameraDeckBox = await cameraDeck.boundingBox();
	if (!cameraDeckBox) throw new Error("3D camera deck did not render");
	await expect
		.poll(async () => {
			const [canvasBounds, deckBounds] = await Promise.all([
				scene.boundingBox(),
				cameraDeck.boundingBox(),
			]);
			return (
				!!canvasBounds &&
				!!deckBounds &&
				canvasBounds.y + canvasBounds.height <= deckBounds.y + 1
			);
		})
		.toBe(true);
	const currentSceneBox = await scene.boundingBox();
	if (!currentSceneBox) throw new Error("Expected settled 3D canvas");
	sceneBox = currentSceneBox;
	await expect(
		session.page.getByTestId("three-dimensional-renderer-diagnostics"),
	).toContainText("WebGL2");
	await expect(
		session.page.getByTestId("three-dimensional-custom-glb-status"),
	).toHaveText("rendered:1");
	await session.page.mouse.click(
		sceneBox.x + sceneBox.width / 2,
		sceneBox.y + sceneBox.height / 2,
	);
	await expect(
		session.page.getByTestId("three-dimensional-rotation-handle"),
	).toBeVisible();
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
	await expect(
		session.page.getByTestId("three-dimensional-item-preview"),
	).not.toHaveText("нет");
	const revisionsBeforeMove = await durableRevisionCount(session.page);
	await session.page.mouse.up();
	await expect(
		session.page.getByTestId("three-dimensional-item-transform-draft"),
	).toHaveCount(0);
	await expect(
		session.page.getByRole("button", { name: "Подтвердить перенос предмета" }),
	).toHaveCount(0);
	await expect
		.poll(() => durableRevisionCount(session.page))
		.toBe(revisionsBeforeMove + 1);
	await expect(
		session.page.getByTestId("editor-top-bar").getByRole("status"),
	).toHaveText("Сохранено");
	const rotationRing = session.page.getByTestId(
		"three-dimensional-rotation-hit-area",
	);
	const rotationRingBox = await rotationRing.boundingBox();
	if (!rotationRingBox) throw new Error("3D rotation ring did not render");
	const rotationPoints = await rotationRing.evaluate((element) => {
		if (!(element instanceof SVGPathElement))
			throw new Error("Expected a rendered rotation arc");
		const matrix = element.getScreenCTM();
		if (!matrix) throw new Error("Expected the rotation arc screen transform");
		const length = element.getTotalLength();
		const pointAt = (fraction: number) => {
			const point = element.getPointAtLength(length * fraction);
			const screen = new DOMPoint(point.x, point.y).matrixTransform(matrix);
			if (document.elementFromPoint(screen.x, screen.y) !== element)
				throw new Error(
					"The rotation arc grip must be exposed to an actual pointer",
				);
			return { x: screen.x, y: screen.y };
		};
		return { start: pointAt(0.25), end: pointAt(0.75) };
	});
	await session.page.mouse.move(rotationPoints.start.x, rotationPoints.start.y);
	await session.page.mouse.down();
	await expect(
		session.page.getByTestId("three-dimensional-rotation-gizmo"),
	).toHaveAttribute("data-rotation-active", "true");
	await session.page.mouse.move(rotationPoints.end.x, rotationPoints.end.y, {
		steps: 4,
	});
	await expect(
		session.page.getByTestId("three-dimensional-item-preview"),
	).toContainText("поворот");
	const revisionsBeforeRotation = await durableRevisionCount(session.page);
	await session.page.mouse.up();
	await expect(
		session.page.getByTestId("three-dimensional-item-transform-draft"),
	).toHaveCount(0);
	await expect(
		session.page.getByRole("button", { name: "Подтвердить поворот предмета" }),
	).toHaveCount(0);
	await expect
		.poll(() => durableRevisionCount(session.page))
		.toBe(revisionsBeforeRotation + 1);
	await expect(
		session.page.getByTestId("project-durability-status"),
	).toContainText("Сохранено локально");
	await session.context.close();
});

test("EDITOR-E2E-04C-1: a lost 3D projection cannot publish an item move", async ({
	page: _page,
}, testInfo) => {
	const session = await openPersistentPhone(
		testInfo,
		"editor-item-three-dimensional-context-loss",
	);
	await session.page.goto("/");
	await startNewProject(session.page, "3D предмет без контекста");
	await session.page.getByRole("button", { name: "Создать контур" }).click();
	await chooseBuiltInGreybox(session.page, "Стол");
	const plan = session.page.getByTestId("plan-canvas");
	const planBox = await plan.boundingBox();
	if (!planBox) throw new Error("Plan canvas did not render");
	await clickPlanPointMm(session.page, 2000, 1500);
	await expect(session.page.getByTestId("item-count")).toHaveText("1 предмет");
	await chooseEditorOption(session.page, "3D");
	const scene = session.page.getByTestId("three-dimensional-canvas");
	const sceneBox = await scene.boundingBox();
	if (!sceneBox) throw new Error("3D canvas did not render");
	await expect(
		session.page.getByTestId("three-dimensional-renderer-diagnostics"),
	).toContainText("WebGL2");
	await session.page.mouse.click(
		sceneBox.x + sceneBox.width / 2,
		sceneBox.y + sceneBox.height / 2,
	);
	await expect(
		session.page.getByTestId("three-dimensional-rotation-handle"),
	).toBeVisible();
	const revisionsBeforeContextLoss = await durableRevisionCount(session.page);

	await scene.evaluate((canvas) =>
		canvas.dispatchEvent(new Event("webglcontextlost", { cancelable: true })),
	);
	await expect(
		session.page
			.getByRole("region", { name: "3D вид комнаты" })
			.getByRole("status")
			.filter({ hasText: "Графический контекст потерян." }),
	).toContainText("Графический контекст потерян. Данные проекта не изменены.");

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

	await expect
		.poll(() => durableRevisionCount(session.page))
		.toBe(revisionsBeforeContextLoss);
	await expect(
		session.page.getByTestId("three-dimensional-item-preview"),
	).toHaveText("нет");
	await session.context.close();
});

test("EDITOR-E2E-04D: the large 3D rotation ring updates live and an empty floor click restores camera orbit", async ({
	page: _page,
}, testInfo) => {
	const session = await openPersistentPhone(
		testInfo,
		"editor-three-dimensional-deselect",
	);
	await session.page.goto("/");
	await startNewProject(session.page, "3D поворот и обзор");
	await session.page.getByRole("button", { name: "Создать контур" }).click();
	await chooseBuiltInGreybox(session.page, "Стол");
	const plan = session.page.getByTestId("plan-canvas");
	const planBox = await plan.boundingBox();
	if (!planBox) throw new Error("Plan canvas did not render");
	await clickPlanPointMm(session.page, 2000, 1500);
	await chooseEditorOption(session.page, "3D");

	const scene = session.page.getByTestId("three-dimensional-canvas");
	const sceneBox = await scene.boundingBox();
	if (!sceneBox) throw new Error("3D canvas did not render");
	await expect(
		session.page.getByTestId("three-dimensional-custom-glb-status"),
	).toHaveText("rendered:1");
	await session.page.mouse.click(
		sceneBox.x + sceneBox.width / 2,
		sceneBox.y + sceneBox.height / 2,
	);
	const ring = session.page.getByTestId("three-dimensional-rotation-hit-area");
	await expect(ring).toBeVisible();
	const visualRing = session.page.getByTestId(
		"three-dimensional-rotation-gizmo",
	);
	await expect(
		visualRing.getByTestId("three-dimensional-rotation-track"),
	).toHaveCount(1);
	await expect(visualRing.locator("ellipse, line")).toHaveCount(0);
	await expect(visualRing).toHaveAttribute("data-rotation-active", "false");
	const ringBox = await ring.boundingBox();
	if (!ringBox) throw new Error("3D rotation ring did not render");
	const rotationControlBox = await visualRing.boundingBox();
	if (!rotationControlBox) throw new Error("3D rotation dome did not render");
	expect(ringBox.width).toBeGreaterThanOrEqual(144);

	const handle = session.page.getByTestId("three-dimensional-rotation-handle");
	expect(
		Number.parseFloat(
			await visualRing
				.getByTestId("three-dimensional-rotation-track")
				.evaluate((element) => getComputedStyle(element).opacity),
		),
	).toBeGreaterThan(0.5);
	expect(
		Number.parseFloat(
			await handle.evaluate((element) => getComputedStyle(element).opacity),
		),
	).toBeGreaterThan(0.5);
	const handleBefore = await handle.boundingBox();
	if (!handleBefore) throw new Error("3D rotation handle did not render");
	await session.page.mouse.move(
		rotationControlBox.x + 100 - Math.SQRT1_2 * 73,
		rotationControlBox.y + 100 - Math.SQRT1_2 * 73,
	);
	await session.page.mouse.down();
	await expect(visualRing).toHaveAttribute("data-rotation-active", "true");
	expect(
		Number.parseFloat(
			await visualRing
				.getByTestId("three-dimensional-rotation-track")
				.evaluate((element) => getComputedStyle(element).opacity),
		),
	).toBeGreaterThan(0.3);
	expect(
		Number.parseFloat(
			await handle.evaluate((element) => getComputedStyle(element).opacity),
		),
	).toBeGreaterThan(0.8);
	await session.page.mouse.move(
		rotationControlBox.x + 100 + Math.SQRT1_2 * 73,
		rotationControlBox.y + 100 - Math.SQRT1_2 * 73,
		{ steps: 8 },
	);
	await expect(
		session.page.getByTestId("three-dimensional-item-preview"),
	).toContainText("поворот");
	const handleDuringDrag = await handle.boundingBox();
	if (!handleDuringDrag)
		throw new Error("3D rotation handle disappeared during drag");
	expect(
		Math.hypot(
			handleDuringDrag.x - handleBefore.x,
			handleDuringDrag.y - handleBefore.y,
		),
	).toBeGreaterThan(20);
	const revisionsBeforeRotation = await durableRevisionCount(session.page);
	await session.page.mouse.up();
	await expect(visualRing).toHaveAttribute("data-rotation-active", "false");
	await expect(
		session.page.getByTestId("three-dimensional-item-transform-draft"),
	).toHaveCount(0);
	await expect
		.poll(() => durableRevisionCount(session.page))
		.toBe(revisionsBeforeRotation + 1);

	const cameraBefore = await session.page
		.getByTestId("three-dimensional-camera")
		.textContent();
	// The 3D inspector is intentionally layered over the top of the canvas on a
	// phone.  Choose an actual exposed pixel rather than assuming a fractional
	// point of the canvas has no UI above it; otherwise this interaction test can
	// click the room picker instead of exercising an empty-floor tap.
	const emptyPoint = await firstExposedCanvasPoint(session.page, sceneBox, [
		[0.14, 0.72],
		[0.84, 0.34],
		[0.16, 0.46],
	]);
	await session.page.mouse.click(emptyPoint.x, emptyPoint.y);
	await expect(
		session.page.getByTestId("three-dimensional-rotation-gizmo"),
	).toHaveCount(0);
	const scenePixelsBeforeOrbit = await scene.screenshot();
	// iPhone WebKit may reject pointer capture for the canvas. The primary 3D
	// navigation gesture must still orbit the room rather than becoming inert.
	await scene.evaluate((canvas) => {
		Object.defineProperty(canvas, "setPointerCapture", {
			configurable: true,
			value: () => {
				throw new DOMException(
					"Canvas pointer capture is unavailable",
					"NotSupportedError",
				);
			},
		});
	});
	const cdp = await session.page.context().newCDPSession(session.page);
	try {
		await cdp.send("Input.dispatchTouchEvent", {
			touchPoints: [{ id: 92, x: emptyPoint.x, y: emptyPoint.y }],
			type: "touchStart",
		});
		await cdp.send("Input.dispatchTouchEvent", {
			touchPoints: [{ id: 92, x: emptyPoint.x + 52, y: emptyPoint.y - 28 }],
			type: "touchMove",
		});
		const scenePixelsDuringOrbit = await scene.screenshot();
		expect(scenePixelsDuringOrbit.equals(scenePixelsBeforeOrbit)).toBe(false);
		await cdp.send("Input.dispatchTouchEvent", {
			touchPoints: [],
			type: "touchEnd",
		});
	} finally {
		await cdp.detach();
	}
	await expect(
		session.page.getByTestId("three-dimensional-camera"),
	).not.toHaveText(cameraBefore ?? "");
	const scenePixelsAfterOrbit = await scene.screenshot();
	expect(scenePixelsAfterOrbit.equals(scenePixelsBeforeOrbit)).toBe(false);
	await session.context.close();
});

test("EDITOR-E2E-04G: an empty 3D room redraws its plan during a touch orbit", async ({
	page: _page,
}, testInfo) => {
	const session = await openPersistentPhone(
		testInfo,
		"editor-empty-three-dimensional-orbit",
	);
	await session.page.goto("/");
	await startNewProject(session.page, "Пустая комната 3D");
	await session.page.getByRole("button", { name: "Создать контур" }).click();
	await chooseEditorOption(session.page, "3D");

	const scene = session.page.getByTestId("three-dimensional-canvas");
	const sceneBox = await scene.boundingBox();
	if (!sceneBox) throw new Error("3D canvas did not render");
	await expect(
		session.page.getByTestId("three-dimensional-custom-glb-status"),
	).toHaveText("none");
	const orbitPoint = await firstExposedCanvasPoint(session.page, sceneBox, [
		[0.16, 0.7],
		[0.84, 0.36],
	]);
	const cameraBeforeOrbit = await session.page
		.getByTestId("three-dimensional-camera")
		.textContent();
	const scenePixelsBeforeOrbit = await scene.screenshot();
	const cdp = await session.page.context().newCDPSession(session.page);
	try {
		await cdp.send("Input.dispatchTouchEvent", {
			touchPoints: [{ id: 93, x: orbitPoint.x, y: orbitPoint.y }],
			type: "touchStart",
		});
		await cdp.send("Input.dispatchTouchEvent", {
			touchPoints: [{ id: 93, x: orbitPoint.x + 72, y: orbitPoint.y - 32 }],
			type: "touchMove",
		});
		await expect(
			session.page.getByTestId("three-dimensional-camera"),
		).not.toHaveText(cameraBeforeOrbit ?? "");
		const scenePixelsDuringOrbit = await scene.screenshot();
		expect(scenePixelsDuringOrbit.equals(scenePixelsBeforeOrbit)).toBe(false);
		await cdp.send("Input.dispatchTouchEvent", {
			touchPoints: [],
			type: "touchEnd",
		});
	} finally {
		await cdp.detach();
	}
	await session.context.close();
});

test("EDITOR-E2E-04E: 3D rotation stays captured outside its centred ring and a dragged item saves directly", async ({
	page: _page,
}, testInfo) => {
	const session = await openPersistentPhone(
		testInfo,
		"editor-three-dimensional-rotation-capture",
	);
	await session.page.goto("/");
	await startNewProject(session.page, "3D свободный предмет");
	await session.page.getByRole("button", { name: "Создать контур" }).click();
	await chooseBuiltInGreybox(session.page, "Стол");
	const plan = session.page.getByTestId("plan-canvas");
	const planBox = await plan.boundingBox();
	if (!planBox) throw new Error("Plan canvas did not render");
	await clickPlanPointMm(session.page, 2000, 1500);
	await chooseEditorOption(session.page, "3D");
	const scene = session.page.getByTestId("three-dimensional-canvas");
	const sceneBox = await scene.boundingBox();
	if (!sceneBox) throw new Error("3D canvas did not render");
	await expect(
		session.page.getByTestId("three-dimensional-custom-glb-status"),
	).toHaveText("rendered:1");
	const itemCentre = {
		x: sceneBox.x + sceneBox.width / 2,
		y: sceneBox.y + sceneBox.height / 2,
	};
	await session.page.mouse.click(itemCentre.x, itemCentre.y);

	const gizmo = session.page.getByTestId("three-dimensional-rotation-gizmo");
	const gizmoBox = await gizmo.boundingBox();
	if (!gizmoBox) throw new Error("3D rotation sphere did not render");
	const footprintBox = await session.page
		.getByTestId("three-dimensional-item-selection-frame")
		.locator("polygon")
		.boundingBox();
	if (!footprintBox)
		throw new Error("Expected the selected item's projected floor footprint");
	expect(
		Math.hypot(
			gizmoBox.x +
				gizmoBox.width / 2 -
				(footprintBox.x + footprintBox.width / 2),
			gizmoBox.y + 100 - (footprintBox.y + footprintBox.height / 2),
		),
	).toBeLessThanOrEqual(28);

	const ring = session.page.getByTestId("three-dimensional-rotation-hit-area");
	const ringBox = await ring.boundingBox();
	if (!ringBox) throw new Error("3D rotation ring did not render");
	const rotationControlBox = await gizmo.boundingBox();
	if (!rotationControlBox) throw new Error("3D rotation dome did not render");
	const handle = session.page.getByTestId("three-dimensional-rotation-handle");
	await expect(gizmo).toHaveAttribute("data-rotation-active", "false");
	await session.page.mouse.move(
		rotationControlBox.x + 100 - Math.SQRT1_2 * 73,
		rotationControlBox.y + 100 - Math.SQRT1_2 * 73,
	);
	await session.page.mouse.down();
	await expect(gizmo).toHaveAttribute("data-rotation-active", "true");
	await session.page.mouse.move(
		rotationControlBox.x + 100 + Math.SQRT1_2 * 73,
		rotationControlBox.y + 100 - Math.SQRT1_2 * 73,
		{ steps: 5 },
	);
	const handleInsideRing = await handle.boundingBox();
	if (!handleInsideRing) throw new Error("3D rotation handle did not render");
	await session.page.mouse.move(
		sceneBox.x + 4,
		sceneBox.y + sceneBox.height * 0.7,
		{ steps: 5 },
	);
	const handleOutsideRing = await handle.boundingBox();
	if (!handleOutsideRing)
		throw new Error("3D rotation handle did not render after leaving ring");
	expect(
		Math.hypot(
			handleOutsideRing.x - handleInsideRing.x,
			handleOutsideRing.y - handleInsideRing.y,
		),
	).toBeGreaterThan(20);
	const revisionsBeforeRotation = await durableRevisionCount(session.page);
	await session.page.mouse.up();
	await expect(gizmo).toHaveAttribute("data-rotation-active", "false");
	await expect(
		session.page.getByTestId("three-dimensional-item-transform-draft"),
	).toHaveCount(0);
	await expect
		.poll(() => durableRevisionCount(session.page))
		.toBe(revisionsBeforeRotation + 1);
	await expect(
		session.page.getByTestId("project-durability-status"),
	).toContainText("Сохранено локально");
	await session.page.mouse.move(itemCentre.x, itemCentre.y);
	await session.page.mouse.down();
	await session.page.mouse.move(itemCentre.x + 36, itemCentre.y + 18, {
		steps: 4,
	});
	await expect(
		session.page.getByTestId("three-dimensional-item-preview"),
	).toContainText("перемещение");
	const gizmoDuringMove = await gizmo.boundingBox();
	if (!gizmoDuringMove)
		throw new Error("3D rotation ring did not follow the item preview");
	expect(
		Math.hypot(gizmoDuringMove.x - gizmoBox.x, gizmoDuringMove.y - gizmoBox.y),
	).toBeGreaterThan(8);
	const revisionsBeforeMove = await durableRevisionCount(session.page);
	await session.page.mouse.up();
	await expect(
		session.page.getByTestId("three-dimensional-item-transform-draft"),
	).toHaveCount(0);
	await expect
		.poll(() => durableRevisionCount(session.page))
		.toBe(revisionsBeforeMove + 1);
	await expect(
		session.page.getByTestId("three-dimensional-item-preview"),
	).toHaveText("нет");
	await session.context.close();
});

test("EDITOR-E2E-04F: a touch rotation follows relative snapped dome deltas and turns the 3D model clockwise", async ({
	page: _page,
}, testInfo) => {
	const session = await openPersistentPhone(
		testInfo,
		"editor-three-dimensional-touch-rotation",
	);
	await session.page.goto("/");
	await startNewProject(session.page, "3D плавный поворот");
	await session.page.getByRole("button", { name: "Создать контур" }).click();
	await chooseBuiltInGreybox(session.page, "Стол");
	const plan = session.page.getByTestId("plan-canvas");
	const planBox = await plan.boundingBox();
	if (!planBox) throw new Error("Plan canvas did not render");
	await clickPlanPointMm(session.page, 2000, 1500);
	await chooseEditorOption(session.page, "3D");
	const scene = session.page.getByTestId("three-dimensional-canvas");
	const sceneBox = await scene.boundingBox();
	if (!sceneBox) throw new Error("3D canvas did not render");
	await expect(
		session.page.getByTestId("three-dimensional-custom-glb-status"),
	).toHaveText("rendered:1");
	await session.page.mouse.click(
		sceneBox.x + sceneBox.width / 2,
		sceneBox.y + sceneBox.height / 2,
	);
	const ring = session.page.getByTestId("three-dimensional-rotation-hit-area");
	const ringBox = await ring.boundingBox();
	if (!ringBox) throw new Error("3D rotation ring did not render");
	const preview = session.page.getByTestId("three-dimensional-item-preview");
	const handle = session.page.getByTestId("three-dimensional-rotation-handle");
	const revisionsBeforeRotation = await durableRevisionCount(session.page);
	const cdp = await session.page.context().newCDPSession(session.page);
	const domeBox = await session.page
		.getByTestId("three-dimensional-rotation-gizmo")
		.boundingBox();
	if (!domeBox) throw new Error("3D rotation dome did not render");
	const centre = { x: domeBox.x + 100, y: domeBox.y + 100 };
	const at = (degrees: number) => ({
		id: 91,
		x: centre.x + Math.sin((degrees * Math.PI) / 180) * 73,
		y: centre.y - Math.cos((degrees * Math.PI) / 180) * 73,
	});
	// Start in an arbitrary sector; subsequent contacts are relative to that grab.
	const top = at(-45);
	const right = at(45);
	const bottom = at(135);
	const left = at(225);
	expect(
		await session.page.evaluate(
			({ x, y }) =>
				document.elementFromPoint(x, y)?.getAttribute("data-testid"),
			top,
		),
	).toBe("three-dimensional-rotation-hit-area");
	// iOS Safari can reject pointer capture on an SVG element. Rotation must
	// still continue through the window-level gesture fallback in that case.
	await ring.evaluate((element) => {
		Object.defineProperty(element, "setPointerCapture", {
			configurable: true,
			value: () => {
				throw new DOMException(
					"SVG pointer capture is unavailable",
					"NotSupportedError",
				);
			},
		});
	});
	try {
		await cdp.send("Input.dispatchTouchEvent", {
			touchPoints: [top],
			type: "touchStart",
		});
		await cdp.send("Input.dispatchTouchEvent", {
			touchPoints: [right],
			type: "touchMove",
		});
		await expect(preview).toHaveText("поворот:4.712");
		const handleAtRight = await handle.boundingBox();
		if (!handleAtRight)
			throw new Error("3D rotation handle did not render at right position");
		await cdp.send("Input.dispatchTouchEvent", {
			touchPoints: [bottom],
			type: "touchMove",
		});
		await session.page.evaluate(
			() =>
				new Promise<void>((resolve) => requestAnimationFrame(() => resolve())),
		);
		const handleAtBottom = await handle.boundingBox();
		if (!handleAtBottom)
			throw new Error("3D rotation handle did not render at bottom position");
		expect(
			Math.hypot(
				handleAtBottom.x - handleAtRight.x,
				handleAtBottom.y - handleAtRight.y,
			),
		).toBeGreaterThan(20);
		await cdp.send("Input.dispatchTouchEvent", {
			touchPoints: [left],
			type: "touchMove",
		});
		await session.page.evaluate(
			() =>
				new Promise<void>((resolve) => requestAnimationFrame(() => resolve())),
		);
		const handleAtLeft = await handle.boundingBox();
		if (!handleAtLeft)
			throw new Error("3D rotation handle did not render at left position");
		expect(
			Math.hypot(
				handleAtLeft.x - handleAtBottom.x,
				handleAtLeft.y - handleAtBottom.y,
			),
		).toBeGreaterThan(20);
		await cdp.send("Input.dispatchTouchEvent", {
			touchPoints: [],
			type: "touchEnd",
		});
	} finally {
		await cdp.detach();
	}
	await expect(
		session.page.getByTestId("three-dimensional-item-transform-draft"),
	).toHaveCount(0);
	await expect
		.poll(() => durableRevisionCount(session.page))
		.toBe(revisionsBeforeRotation + 1);
	await expect(preview).toHaveText("нет");
	await session.context.close();
});

test("EDITOR-E2E-04A: a two-finger gesture cancels an item drag instead of moving the durable item", async ({
	page: _page,
}, testInfo) => {
	const session = await openPersistentPhone(testInfo, "editor-item-pinch");
	await session.page.goto("/");
	await startNewProject(session.page, "Предмет без случайного сдвига");
	await session.page.getByRole("button", { name: "Создать контур" }).click();
	await chooseBuiltInGreybox(session.page, "Стол");

	const plan = session.page.getByTestId("plan-canvas");
	const planBox = await plan.boundingBox();
	if (!planBox) {
		throw new Error("Plan canvas did not render");
	}
	const revisionsBeforePlacement = await durableRevisionCount(session.page);
	await clickPlanPointMm(session.page, 2000, 1500);
	await expect
		.poll(() => durableRevisionCount(session.page))
		.toBeGreaterThan(revisionsBeforePlacement);
	await expect(
		session.page.getByTestId("project-durability-status"),
	).toContainText("Сохранено локально");
	await session.page.waitForTimeout(250);
	await chooseEditorOption(session.page, "Рука и выбор");

	const item = session.page.getByTestId("schematic-item");
	const itemBox = await item.boundingBox();
	if (!itemBox) {
		throw new Error("Placed item did not render");
	}
	const revisionsBeforePinch = await durableRevisionCount(session.page);
	const first = {
		id: 31,
		x: itemBox.x + itemBox.width / 2,
		y: itemBox.y + itemBox.height / 2,
	};
	// Keep the second touch on the canvas, left of ToolRail and outside the item.
	const second = { id: 32, x: first.x - 42, y: first.y + 26 };
	const cdp = await session.page.context().newCDPSession(session.page);
	try {
		await cdp.send("Input.dispatchTouchEvent", {
			touchPoints: [first],
			type: "touchStart",
		});
		await expect(
			session.page.getByTestId("selected-item-inspector"),
		).toBeHidden();
		await cdp.send("Input.dispatchTouchEvent", {
			touchPoints: [first, second],
			type: "touchStart",
		});
		await cdp.send("Input.dispatchTouchEvent", {
			touchPoints: [
				{ ...first, x: first.x + 28, y: first.y - 12 },
				{ ...second, x: second.x - 28, y: second.y + 12 },
			],
			type: "touchMove",
		});
		await cdp.send("Input.dispatchTouchEvent", {
			touchPoints: [first],
			type: "touchEnd",
		});
		await cdp.send("Input.dispatchTouchEvent", {
			touchPoints: [],
			type: "touchEnd",
		});
	} finally {
		await cdp.detach();
	}

	await expect
		.poll(() => durableRevisionCount(session.page))
		.toBe(revisionsBeforePinch);
	await expect(item).toBeVisible();
	await session.context.close();
});

test("EDITOR-E2E-05: a schematic item is host-addressed to the clicked grid cell instead of the first room", async ({
	page: _page,
}, testInfo) => {
	const session = await openPersistentPhone(testInfo, "editor-item-host");
	await session.page.goto("/");
	await startNewProject(session.page, "Хост предмета");
	await session.page.getByRole("button", { name: "Создать контур" }).click();
	await chooseEditorOption(session.page, "Стена");

	await drawCentreDivider(session.page);
	await expect(session.page.getByTestId("room-count")).toHaveText("2 комнаты");

	await chooseBuiltInGreybox(session.page);
	const [, rightRoom] = await orderedRoomFaceCentres(session.page);
	if (!rightRoom) {
		throw new Error("Right-hand room face did not render");
	}
	await session.page.mouse.click(rightRoom.x, rightRoom.y);

	await expect(session.page.getByTestId("item-count")).toHaveText("1 предмет");
	await expect(session.page.getByRole("alert")).toHaveCount(0);
	await session.context.close();
});

test("EDITOR-E2E-08: a second drag builds a four-cell grid and an oversized item cannot leave it", async ({
	page: _page,
}, testInfo) => {
	const session = await openPersistentPhone(
		testInfo,
		"editor-grid-and-item-bounds",
	);
	await session.page.goto("/");
	await startNewProject(session.page, "Сетка");
	await session.page.getByRole("button", { name: "Создать контур" }).click();
	const plan = session.page.getByTestId("plan-canvas");

	await chooseEditorOption(session.page, "Стена");
	await drawCentreDivider(session.page);
	await expect(session.page.getByTestId("room-count")).toHaveText("2 комнаты");
	await expect(
		session.page.getByTestId("project-durability-status"),
	).toContainText("Сохранено локально");

	await chooseEditorOption(session.page, "Стена");
	await drawCentreCrossbar(session.page);
	await expect(session.page.getByTestId("room-count")).toHaveText("4 комнаты");
	await expect(
		session.page.getByTestId("project-durability-status"),
	).toContainText("Сохранено локально");
	await expect(session.page.getByTestId("wall-count")).toHaveText("12 стен");
	await expect(plan).not.toContainText("4 комнаты");

	await chooseFloorPlaceholder(session.page, "Увеличиваемый макет");
	const [, rightRoom] = await orderedRoomFaceCentres(session.page);
	if (!rightRoom) {
		throw new Error("Room face for oversized placement did not render");
	}
	await session.page.mouse.click(rightRoom.x, rightRoom.y);
	await session.page
		.getByRole("button", { name: "Подтвердить размещение предмета" })
		.click();
	await expect(session.page.getByTestId("item-count")).toHaveText("1 предмет");
	await chooseEditorOption(session.page, "Рука и выбор");
	await session.page.getByTestId("schematic-item").click();
	await expandSelectedItemInspector(session.page);
	await expect(
		session.page.getByLabel("Ширина выбранного предмета, мм"),
	).toBeEnabled();
	await session.page.getByLabel("Ширина выбранного предмета, мм").fill("2400");
	await session.page
		.getByLabel("Ширина выбранного предмета, мм")
		.press("Enter");
	await expect(session.page.getByRole("alert")).toContainText(
		"Предмет должен целиком находиться внутри",
	);
	await expect(session.page.getByTestId("item-count")).toHaveText("1 предмет");
	await session.context.close();
});

test("EDITOR-E2E-09: dragging a placed item snaps it into another valid grid cell", async ({
	page: _page,
}, testInfo) => {
	const session = await openPersistentPhone(testInfo, "editor-item-move");
	await session.page.goto("/");
	await startNewProject(session.page, "Перенос предмета");
	await session.page.getByRole("button", { name: "Создать контур" }).click();
	await chooseEditorOption(session.page, "Стена");
	await drawCentreDivider(session.page);

	await chooseBuiltInGreybox(session.page);
	const [leftRoom, rightRoom] = await orderedRoomFaceCentres(session.page);
	if (!leftRoom || !rightRoom) {
		throw new Error("Two room faces did not render for item movement");
	}
	await session.page.mouse.click(leftRoom.x, leftRoom.y);
	await expect(session.page.getByTestId("item-count")).toHaveText("1 предмет");
	await chooseEditorOption(session.page, "Рука и выбор");
	const item = session.page.getByTestId("schematic-item");
	const before = await item.boundingBox();
	if (!before) {
		throw new Error("Placed item did not render");
	}
	await session.page.mouse.move(
		before.x + before.width / 2,
		before.y + before.height / 2,
	);
	await session.page.mouse.down();
	await session.page.mouse.move(rightRoom.x, rightRoom.y, { steps: 8 });
	await session.page.mouse.up();

	await expect(
		session.page.getByTestId("project-durability-status"),
	).toContainText("Сохранено локально");
	await session.page.reload();
	await openProjectFromHub(session.page, "Перенос предмета");
	const durableItem = session.page.getByTestId("schematic-item");
	await expect(durableItem).toBeVisible();
	const after = await durableItem.boundingBox();
	expect(after?.x).toBeGreaterThan(before.x + 40);
	await session.context.close();
});

test("EDITOR-E2E-10: dragging an item across a wall is rejected and keeps its last durable position", async ({
	page: _page,
}, testInfo) => {
	const session = await openPersistentPhone(
		testInfo,
		"editor-item-move-rejected",
	);
	await session.page.goto("/");
	await startNewProject(session.page, "Граница предмета");
	await session.page.getByRole("button", { name: "Создать контур" }).click();
	await chooseEditorOption(session.page, "Стена");
	await drawCentreDivider(session.page);
	await chooseBuiltInGreybox(session.page);
	const [leftRoom] = await orderedRoomFaceCentres(session.page);
	if (!leftRoom) {
		throw new Error("Left room face did not render for rejected movement");
	}
	await session.page.mouse.click(leftRoom.x, leftRoom.y);
	await chooseEditorOption(session.page, "Рука и выбор");
	const item = session.page.getByTestId("schematic-item");
	const before = await item.boundingBox();
	if (!before) {
		throw new Error("Placed item did not render");
	}
	const revisionsBeforeRejectedDrag = await durableRevisionCount(session.page);
	const divider = (
		await session.page
			.locator('[data-wall-kind="interior"]')
			.evaluateAll((elements) =>
				elements.map((element) => {
					const box = element.getBoundingClientRect();
					return {
						height: box.height,
						left: box.left,
						top: box.top,
						width: box.width,
					};
				}),
			)
	)
		.filter((box) => box.height > box.width)
		.sort((first, second) => second.height - first.height)[0];
	if (!divider) {
		throw new Error("Interior divider did not render");
	}

	await session.page.mouse.move(
		before.x + before.width / 2,
		before.y + before.height / 2,
	);
	await session.page.mouse.down();
	await session.page.mouse.move(
		divider.left + divider.width / 2,
		divider.top + divider.height / 2,
		{ steps: 8 },
	);
	await session.page.mouse.up();
	await expect(session.page.getByTestId("item-move-draft")).toHaveCount(0);
	await expect(
		session.page.getByTestId("item-placement-action-dock"),
	).toHaveCount(0);
	const notice = session.page.getByRole("alert");
	await expect(notice.locator("p")).toHaveText(
		"Предмет должен целиком находиться внутри выбранной комнаты.",
	);
	await notice.getByRole("button", { name: "Закрыть уведомление" }).click();
	await expect(notice).toHaveCount(0);
	await expect
		.poll(() => durableRevisionCount(session.page))
		.toBe(revisionsBeforeRejectedDrag);
	await session.page.reload();
	await openProjectFromHub(session.page, "Граница предмета");
	const after = await session.page.getByTestId("schematic-item").boundingBox();
	expect(after?.x).toBeLessThan(before.x + 20);
	await session.context.close();
});

test("EDITOR-E2E-11: selected placeholder resizes in the editor and an overlapping placeholder needs explicit warned confirmation", async ({
	page: _page,
}, testInfo) => {
	const session = await openPersistentPhone(
		testInfo,
		"editor-item-resize-and-collision",
	);
	await session.page.goto("/");
	await startNewProject(session.page, "Редактирование предмета");
	await session.page.getByRole("button", { name: "Создать контур" }).click();
	const plan = session.page.getByTestId("plan-canvas");
	const planBox = await plan.boundingBox();
	if (!planBox) {
		throw new Error("Plan canvas did not render");
	}

	await chooseFloorPlaceholder(session.page, "Первый макет");
	await clickPlanPointMm(session.page, 1500, 1500);
	await expect(
		session.page.getByTestId("item-placement-preview"),
	).toHaveAttribute("data-placement-valid", "true");
	await session.page
		.getByRole("button", { name: "Подтвердить размещение предмета" })
		.click();
	await expect(session.page.getByTestId("item-count")).toHaveText("1 предмет");
	// A confirmed placement returns to the normal selection mode.  Start a new
	// catalog placement before checking that its preview detects the overlap.
	await chooseFloorPlaceholder(session.page, "Второй макет");
	await clickPlanPointMm(session.page, 1500, 1500);
	const collisionPreview = session.page.getByTestId("item-placement-preview");
	await expect(collisionPreview).toHaveAttribute(
		"data-placement-valid",
		"true",
	);
	await expect(collisionPreview).toHaveAttribute(
		"data-placement-tier",
		"warning",
	);
	await expect(session.page.getByTestId("item-placement-feedback")).toHaveText(
		"Предупреждение: пересечение с другим предметом.",
	);
	await expect(
		session.page.locator('[data-preview-collision="item"]'),
	).toHaveCount(1);
	await expect(
		session.page.getByRole("button", {
			name: "Подтвердить размещение предмета",
		}),
	).toHaveAttribute("aria-disabled", "false");
	await session.page
		.getByRole("button", { name: "Подтвердить размещение предмета" })
		.click();
	await expect(collisionPreview).toHaveCount(0);
	await expect(session.page.getByTestId("item-count")).toHaveText("2 предмета");

	await chooseEditorOption(session.page, "Рука и выбор");
	await session.page.getByTestId("schematic-item").last().click();
	await expect(
		session.page.getByTestId("selected-item-inspector"),
	).toBeHidden();
	await expandSelectedItemInspector(session.page);
	await session.page.getByLabel("Ширина выбранного предмета, мм").fill("1400");
	await session.page
		.getByLabel("Ширина выбранного предмета, мм")
		.press("Enter");
	await expect(
		session.page.getByTestId("project-durability-status"),
	).toContainText("Сохранено локально");
	await session.page.reload();
	await openProjectFromHub(session.page, "Редактирование предмета");
	await chooseEditorOption(session.page, "Рука и выбор");
	await session.page.getByTestId("schematic-item").last().click();
	await expandSelectedItemInspector(session.page);
	await expect(
		session.page.getByLabel("Ширина выбранного предмета, мм"),
	).toHaveValue("1400");
	await expect(
		session.page.getByTestId("selected-item-placement-warning"),
	).toHaveText(
		"Предупреждение для этого предмета: пересечение с другим предметом.",
	);
	await session.context.close();
});

test("PLAN-E2E-03: the infinite surface derives rooms from walls and exposes no separate room tool", async ({
	page: _page,
}, testInfo) => {
	const session = await openPersistentPhone(
		testInfo,
		"editor-infinite-canvas-derived-rooms",
	);
	await session.page.goto("/");
	await startNewProject(session.page, "Свободное полотно");
	await session.page.getByRole("button", { name: "Создать контур" }).click();

	const plan = session.page.getByTestId("plan-canvas");
	const grid = session.page.getByTestId("infinite-grid");
	await expect(grid).toBeVisible();
	expect(await grid.locator("line").count()).toBeGreaterThan(8);
	await expect(
		session.page.getByRole("button", {
			name: "Прямоугольная комната",
			exact: true,
		}),
	).toHaveCount(0);

	await chooseEditorOption(session.page, "Стена");
	await drawCentreDivider(session.page);
	await expect(plan.getByTestId("room-face")).toHaveCount(2);
	await expect(plan.getByTestId("room-measurement")).toHaveCount(2);
	await expect(session.page.getByTestId("room-count")).toHaveText("2 комнаты");
	await session.context.close();
});

test("PLAN-E2E-04: deleting a divider explicitly preserves one Room's metadata before persisting the merged plan", async ({
	page: _page,
}, testInfo) => {
	const session = await openPersistentPhone(testInfo, "editor-delete-wall");
	await session.page.goto("/");
	await startNewProject(session.page, "Удаление перегородки");
	await session.page.getByRole("button", { name: "Создать контур" }).click();
	await chooseEditorOption(session.page, "Стена");

	await drawCentreDivider(session.page);

	const walls = session.page.getByTestId("wall-segment");
	await expect(walls).toHaveCount(7);
	const divider = session.page.locator(
		'[data-testid="wall-segment"][data-wall-kind="interior"]',
	);
	await expect(divider).toHaveCount(1);
	await chooseEditorOption(session.page, "Рука и выбор");
	await divider.click();
	await expandSelectedWallInspector(session.page);
	await expect(
		session.page.getByLabel("Свойства выбранной стены"),
	).toBeVisible();
	await expect(
		session.page.getByRole("button", { name: "Удалить стену", exact: true }),
	).toBeVisible();
	await session.page
		.getByRole("button", { name: "Удалить стену", exact: true })
		.click();

	const consequences = session.page.getByTestId("opening-conflict-preview");
	await expect(consequences).toBeVisible();
	await expect(consequences).toContainText(
		"чьи тип, высота и история останутся",
	);
	await expect(
		consequences.getByRole("button", {
			name: /Удалить стену и изменить 2 помещения/,
		}),
	).toBeDisabled();
	await consequences
		.getByRole("button", { name: "Отмена", exact: true })
		.click();
	await expect(consequences).toHaveCount(0);
	await expect(walls).toHaveCount(7);

	await session.page
		.getByRole("button", { name: "Удалить стену", exact: true })
		.click();
	await expect(consequences).toBeVisible();
	await consequences.getByTestId("wall-deletion-metadata-1").click();
	await consequences
		.getByRole("button", { name: /Удалить стену и изменить 2 помещения/ })
		.click();
	await expect(walls).toHaveCount(4);
	await expect(
		session.page.getByTestId("project-durability-status"),
	).toContainText("Сохранено локально");
	await session.page.reload();
	await openProjectFromHub(session.page, "Удаление перегородки");
	await expect(session.page.getByTestId("wall-segment")).toHaveCount(4);
	await session.context.close();
});

test("PLAN-E2E-04E: a selected wall has no coordinate controls and offers direct manipulation", async ({
	page: _page,
}, testInfo) => {
	const session = await openPersistentPhone(
		testInfo,
		"editor-no-wall-coordinate-controls",
	);
	await session.page.goto("/");
	await startNewProject(session.page, "Стена без координат");
	await session.page.getByRole("button", { name: "Создать контур" }).click();
	await chooseEditorOption(session.page, "Стена");
	await drawCentreDivider(session.page);

	const divider = session.page.locator(
		'[data-testid="wall-segment"][data-wall-kind="interior"]',
	);
	await expect(divider).toHaveCount(1);
	await chooseEditorOption(session.page, "Рука и выбор");
	await divider.click();
	await expandSelectedWallInspector(session.page);
	for (const label of [
		"Положение выбранной стены, мм",
		"Разделить стену в точке, мм",
		"Координата X начала выбранной стены, мм",
		"Координата Z начала выбранной стены, мм",
		"Координата X конца выбранной стены, мм",
		"Координата Z конца выбранной стены, мм",
	]) {
		await expect(session.page.getByLabel(label)).toHaveCount(0);
	}
	await expect(
		session.page.getByRole("button", { name: "Переместить стену жестом" }),
	).toBeVisible();
	await session.context.close();
});

test("PLAN-E2E-04E: a selected divider has a cancellable touch-move candidate before it is published", async ({
	page: _page,
}, testInfo) => {
	const session = await openPersistentPhone(testInfo, "editor-touch-move-wall");
	await session.page.goto("/");
	await startNewProject(session.page, "Жест переноса стены");
	await session.page.getByRole("button", { name: "Создать контур" }).click();
	await chooseEditorOption(session.page, "Стена");
	await drawCentreDivider(session.page);

	const divider = session.page.locator(
		'[data-testid="wall-segment"][data-wall-kind="interior"]',
	);
	await expect(divider).toHaveCount(1);
	await chooseEditorOption(session.page, "Рука и выбор");
	await divider.click();
	await expandSelectedWallInspector(session.page);
	const revisionCountBeforeMove = await durableRevisionCount(session.page);

	await session.page
		.getByRole("button", { name: "Переместить стену жестом" })
		.click();
	const dividerBox = await divider.boundingBox();
	if (!dividerBox) throw new Error("Expected a visible divider");
	const dividerTouchY = dividerBox.y + Math.min(36, dividerBox.height / 2);
	await session.page.mouse.move(
		dividerBox.x + dividerBox.width / 2,
		dividerTouchY,
	);
	await session.page.mouse.down();
	await expect(session.page.getByTestId("wall-move-preview")).toHaveCount(1);
	await session.page.mouse.move(
		dividerBox.x + dividerBox.width / 2 - 45,
		dividerTouchY,
	);
	await session.page.mouse.up();

	const candidate = session.page.getByTestId("wall-move-draft");
	await expect(candidate).toBeVisible();
	await expect(candidate).toContainText("Черновик переноса стены");
	await expect(
		candidate.getByRole("button", { name: "Отменить перенос" }),
	).toBeVisible();
	expect(await durableRevisionCount(session.page)).toBe(
		revisionCountBeforeMove,
	);
	await candidate.getByRole("button", { name: "Отменить перенос" }).click();
	await expect(candidate).toHaveCount(0);
	expect(await durableRevisionCount(session.page)).toBe(
		revisionCountBeforeMove,
	);

	await session.page
		.getByRole("button", { name: "Переместить стену жестом" })
		.click();
	const durableDivider = session.page.locator(
		'[data-testid="wall-segment"][data-wall-kind="interior"]',
	);
	const secondDividerBox = await durableDivider.boundingBox();
	if (!secondDividerBox) throw new Error("Expected a visible divider");
	const secondDividerTouchY =
		secondDividerBox.y + Math.min(36, secondDividerBox.height / 2);
	await session.page.mouse.move(
		secondDividerBox.x + secondDividerBox.width / 2,
		secondDividerTouchY,
	);
	await session.page.mouse.down();
	await session.page.mouse.move(
		secondDividerBox.x + secondDividerBox.width / 2 - 45,
		secondDividerTouchY,
	);
	await session.page.mouse.up();
	await expect(candidate).toBeVisible();
	await candidate.getByRole("button", { name: "Подтвердить перенос" }).click();
	await expect(candidate).toHaveCount(0);
	await expect(
		session.page.getByTestId("project-durability-status"),
	).toContainText("Сохранено локально");
	expect(await durableRevisionCount(session.page)).toBe(
		revisionCountBeforeMove + 1,
	);
	await session.context.close();
});

test("PLAN-E2E-04H: a selected detached wall offers vertex movement directly on the plan", async ({
	page: _page,
}, testInfo) => {
	const session = await openPersistentPhone(
		testInfo,
		"editor-touch-move-wall-vertex",
	);
	await session.page.goto("/");
	await startNewProject(session.page, "Жест вершины");
	await session.page.getByRole("button", { name: "Создать контур" }).click();
	const plan = session.page.getByTestId("plan-canvas");
	const planBox = await plan.boundingBox();
	if (!planBox) throw new Error("Plan canvas did not render");

	await chooseEditorOption(session.page, "Стена");
	const start = await planPointMm(session.page, { xMm: -1000, zMm: -1000 });
	await session.page.mouse.move(start.x, start.y);
	await session.page.mouse.down();
	await session.page.mouse.move(start.x + 70, start.y, { steps: 6 });
	await session.page.mouse.up();

	await chooseEditorOption(session.page, "Рука и выбор");
	const freeWall = session.page.locator(
		'[data-testid="wall-segment"][data-wall-kind="interior"]',
	);
	await expect(freeWall).toHaveCount(1);
	await freeWall.click();
	await expandSelectedWallInspector(session.page);
	await session.page
		.getByRole("button", { name: "Переместить вершину жестом" })
		.click();
	const handles = session.page.getByTestId("wall-vertex-move-handle");
	await expect(handles).toHaveCount(2);
	const handle = handles.first();
	const handleBox = await handle.boundingBox();
	if (!handleBox) throw new Error("Vertex move handle did not render");
	const revisionCountBeforeMove = await durableRevisionCount(session.page);
	await session.page.mouse.move(
		handleBox.x + handleBox.width / 2,
		handleBox.y + handleBox.height / 2,
	);
	await session.page.mouse.down();
	await session.page.mouse.move(
		handleBox.x + handleBox.width / 2 + 40,
		handleBox.y + handleBox.height / 2,
	);
	await session.page.mouse.up();
	const candidate = session.page.getByTestId("wall-vertex-move-draft");
	await expect(candidate).toBeVisible();
	await expect(
		session.page.getByTestId("wall-vertex-move-preview"),
	).toHaveCount(1);
	expect(await durableRevisionCount(session.page)).toBe(
		revisionCountBeforeMove,
	);
	await candidate
		.getByRole("button", { name: "Отменить перенос вершины" })
		.click();
	await expect(candidate).toHaveCount(0);
	expect(await durableRevisionCount(session.page)).toBe(
		revisionCountBeforeMove,
	);

	await session.page
		.getByRole("button", { name: "Переместить вершину жестом" })
		.click();
	const durableHandle = session.page
		.getByTestId("wall-vertex-move-handle")
		.first();
	const durableHandleBox = await durableHandle.boundingBox();
	if (!durableHandleBox) throw new Error("Vertex move handle did not render");
	await session.page.mouse.move(
		durableHandleBox.x + durableHandleBox.width / 2,
		durableHandleBox.y + durableHandleBox.height / 2,
	);
	await session.page.mouse.down();
	await session.page.mouse.move(
		durableHandleBox.x + durableHandleBox.width / 2 + 40,
		durableHandleBox.y + durableHandleBox.height / 2,
	);
	await session.page.mouse.up();
	await expect(candidate).toBeVisible();
	await candidate
		.getByRole("button", { name: "Подтвердить перенос вершины" })
		.click();
	await expect(candidate).toHaveCount(0);
	expect(await durableRevisionCount(session.page)).toBe(
		revisionCountBeforeMove + 1,
	);

	await session.context.close();
});

test("PLAN-E2E-04L: a Project revision change discards an armed wall-move draft", async ({
	page: _page,
}, testInfo) => {
	const session = await openPersistentPhone(
		testInfo,
		"editor-stale-wall-move-draft",
	);
	await session.page.goto("/");
	await startNewProject(session.page, "Сброс черновика");
	await session.page.getByRole("button", { name: "Создать контур" }).click();
	await chooseEditorOption(session.page, "Рука и выбор");
	const wall = session.page.getByTestId("wall-segment").first();
	await wall.click();
	await expandSelectedWallInspector(session.page);
	await session.page
		.getByRole("button", { name: "Переместить стену жестом" })
		.click();
	const wallBox = await wall.boundingBox();
	if (!wallBox) throw new Error("Selected wall did not render");
	const start = {
		x: wallBox.x + wallBox.width / 2,
		y: wallBox.y + wallBox.height / 2,
	};
	await session.page.mouse.move(start.x, start.y);
	await session.page.mouse.down();
	await session.page.mouse.move(start.x, start.y + 40);
	await session.page.mouse.up();
	const draft = session.page.getByTestId("wall-move-draft");
	await expect(draft).toBeVisible();

	await triggerEditorHistoryAction(session.page, "undo");
	await expect(draft).toHaveCount(0);
	await expect(session.page.getByTestId("wall-segment")).toHaveCount(0);
	await session.context.close();
});

test("PLAN-E2E-04I: a selected wall has no split action and a repeated touch leaves its geometry durable", async ({
	page: _page,
}, testInfo) => {
	const session = await openPersistentPhone(
		testInfo,
		"editor-touch-split-wall",
	);
	await session.page.goto("/");
	await startNewProject(session.page, "Жест разделения стены");
	await session.page.getByRole("button", { name: "Создать контур" }).click();
	await chooseEditorOption(session.page, "Рука и выбор");
	const exteriorWall = session.page
		.locator('[data-testid="wall-segment"][data-wall-kind="exterior"]')
		.first();
	await exteriorWall.click();
	await expandSelectedWallInspector(session.page);
	const revisionsBeforeTouch = await durableRevisionCount(session.page);
	const verticesBeforeTouch = await durablePlanVertices(session.page);
	await expect(
		session.page.getByRole("button", { name: "Разделить стену жестом" }),
	).toHaveCount(0);
	await chooseEditorOption(session.page, "Рука и выбор");
	await exteriorWall.tap();
	await expect(session.page.getByTestId("wall-split-draft")).toHaveCount(0);
	await expect(session.page.getByTestId("wall-split-preview")).toHaveCount(0);
	await expect(session.page.getByTestId("wall-segment")).toHaveCount(4);
	expect(await durablePlanVertices(session.page)).toEqual(verticesBeforeTouch);
	expect(await durableRevisionCount(session.page)).toBe(revisionsBeforeTouch);
	await session.page.reload();
	await openProjectFromHub(session.page, "Жест разделения стены");
	expect(await durablePlanVertices(session.page)).toEqual(verticesBeforeTouch);

	await session.context.close();
});

test("RECONCILIATION-E2E-02A: a whole wall item rehosts when reopening a legacy split wall", async ({
	page: _page,
}, testInfo) => {
	const session = await openPersistentPhone(
		testInfo,
		"editor-wall-item-split-rehost",
	);
	await session.page.goto("/");
	await startNewProject(session.page, "Панель и разделение стены");
	await session.page.getByRole("button", { name: "Создать контур" }).click();
	await chooseEditorOption(session.page, "Рука и выбор");
	const exteriorWall = session.page
		.locator('[data-testid="wall-segment"][data-wall-kind="exterior"]')
		.first();
	const originalWallId = await exteriorWall.getAttribute("data-wall-id");
	if (!originalWallId) throw new Error("Expected the selected wall identity");
	await exteriorWall.click();
	await expandSelectedWallInspector(session.page);
	const revisionCountBeforePanel = await durableRevisionCount(session.page);
	await choosePreloadedCatalogAsset(
		session.page,
		"Демонстрационное настенное бра",
		false,
	);
	const panelPreview = session.page.getByText("Размещение настенного предмета");
	await expect(panelPreview).toBeVisible();
	await session.page
		.getByRole("button", { name: "Отменить", exact: true })
		.click();
	await expect(panelPreview).toHaveCount(0);
	await expect.poll(() => durableWallItems(session.page)).toHaveLength(0);
	expect(await durableRevisionCount(session.page)).toBe(
		revisionCountBeforePanel,
	);

	await choosePreloadedCatalogAsset(
		session.page,
		"Демонстрационное настенное бра",
		false,
	);
	await expect(panelPreview).toBeVisible();
	await session.page
		.getByRole("button", { name: "Подтвердить размещение" })
		.click();
	await expect
		.poll(() => durableRevisionCount(session.page))
		.toBe(revisionCountBeforePanel + 1);

	await loadLegacySplitWallFixture(session.page, 0.2);
	await expect(session.page.getByTestId("wall-segment")).toHaveCount(5);
	await expect
		.poll(() => durableRevisionCount(session.page))
		.toBe(revisionCountBeforePanel + 2);

	const items = await durableWallItems(session.page);
	expect(items).toHaveLength(1);
	expect(items[0]).toEqual(
		expect.objectContaining({
			anchorClass: "wall",
			offsetMm: expect.any(Number),
			side: "left",
		}),
	);
	expect(items[0]?.wallSegmentId).not.toBe(originalWallId);
	await session.context.close();
});

test("RECONCILIATION-E2E-02E: a phone-drawn T junction keeps an unaffected wall panel in place", async ({
	page: _page,
}, testInfo) => {
	const session = await openPersistentPhone(
		testInfo,
		"editor-wall-item-t-junction-rehost",
	);
	await session.page.goto("/");
	await startNewProject(session.page, "Панель и T-образный стык");
	await session.page.getByRole("button", { name: "Создать контур" }).click();
	await chooseEditorOption(session.page, "Рука и выбор");
	const exteriorWall = session.page
		.locator('[data-testid="wall-segment"][data-wall-kind="exterior"]')
		.first();
	const originalWallId = await exteriorWall.getAttribute("data-wall-id");
	if (!originalWallId) throw new Error("Expected the selected wall identity");
	await exteriorWall.click();
	await expandSelectedWallInspector(session.page);
	await loadLegacyWallPanelFixture(session.page);
	await expect.poll(() => durableWallItems(session.page)).toHaveLength(1);
	const offset = session.page.getByLabel(
		"Смещение настенного предмета «Настенная панель», мм",
	);
	await offset.fill("3000");
	await offset.blur();
	await expect
		.poll(async () => (await durableWallItems(session.page))[0]?.offsetMm)
		.toBe(3000);
	const markerBefore = await renderedWallItemCenterMm(session.page);
	const wallBox = await exteriorWall.boundingBox();
	const planBox = await session.page.getByTestId("plan-canvas").boundingBox();
	if (!markerBefore || !wallBox || !planBox) {
		throw new Error("Expected the wall, panel and plan canvas to render");
	}
	const revisionsBeforeJunction = await durableRevisionCount(session.page);
	await chooseEditorOption(session.page, "Стена");
	const horizontal = wallBox.width >= wallBox.height;
	const contact = horizontal
		? {
				x: wallBox.x + wallBox.width * 0.35,
				y: wallBox.y + wallBox.height / 2,
			}
		: {
				x: wallBox.x + wallBox.width / 2,
				y: wallBox.y + wallBox.height * 0.35,
			};
	const [planCenter] = await roomFaceInteriorPoints(session.page);
	if (!planCenter)
		throw new Error("Expected the actual room interior direction");
	const branchEnd = horizontal
		? {
				x: contact.x,
				y: contact.y + Math.sign(planCenter.y - contact.y) * 90,
			}
		: {
				x: contact.x + Math.sign(planCenter.x - contact.x) * 90,
				y: contact.y,
			};
	await drawCreationWallWithMouse(session.page, contact, branchEnd);

	await expect(session.page.getByTestId("wall-draft")).toHaveCount(0);
	await expect(session.page.getByTestId("wall-count")).toHaveText("6 стен");
	await expect
		.poll(() => durableRevisionCount(session.page))
		.toBe(revisionsBeforeJunction + 1);
	const [rehosted] = await durableWallItems(session.page);
	if (!rehosted) throw new Error("Expected the rehosted wall panel");
	expect(rehosted).toEqual(
		expect.objectContaining({
			anchorClass: "wall",
			side: "left",
		}),
	);
	expect(rehosted.wallSegmentId).not.toBe(originalWallId);
	expect(rehosted.offsetMm).toBeLessThan(3000);
	const markerAfter = await renderedWallItemCenterMm(session.page);
	if (!markerAfter) throw new Error("Expected the rehosted panel marker");
	expect(markerAfter.xMm).toBeCloseTo(markerBefore.xMm, 1);
	expect(markerAfter.zMm).toBeCloseTo(markerBefore.zMm, 1);

	await session.page.reload();
	await openProjectFromHub(session.page, "Панель и T-образный стык");
	await expect(session.page.getByTestId("wall-count")).toHaveText("6 стен");
	await expect(session.page.getByTestId("wall-schematic-item")).toHaveCount(1);
	await expect
		.poll(() => durableWallItems(session.page))
		.toEqual([expect.objectContaining(rehosted)]);
	await chooseEditorOption(session.page, "3D");
	await expect(
		session.page.getByTestId("three-dimensional-canvas"),
	).toBeVisible();
	await session.context.close();
});

test("RECONCILIATION-E2E-02G: a T contact through a wall panel requires explicit atomic removal", async ({
	page: _page,
}, testInfo) => {
	const session = await openPersistentPhone(
		testInfo,
		"editor-wall-item-t-junction-conflict",
	);
	await session.page.goto("/");
	await startNewProject(session.page, "Панель в T-образном стыке");
	await session.page.getByRole("button", { name: "Создать контур" }).click();
	await chooseEditorOption(session.page, "Рука и выбор");
	const exteriorWall = session.page
		.locator('[data-testid="wall-segment"][data-wall-kind="exterior"]')
		.first();
	await exteriorWall.click();
	await expandSelectedWallInspector(session.page);
	await loadLegacyWallPanelFixture(session.page);
	await session.page
		.getByRole("button", {
			name: "Выбрать вариант цвета настенного предмета Орех",
			exact: true,
		})
		.click();
	await session.page
		.getByRole("button", { name: "Применить вариант", exact: true })
		.click();
	await expect
		.poll(async () => (await durableWallItems(session.page))[0]?.color)
		.toBe("#8c6e4c");
	await expect.poll(() => durableWallItems(session.page)).toHaveLength(1);
	const marker = await session.page
		.getByTestId("wall-schematic-item")
		.boundingBox();
	const wallBox = await exteriorWall.boundingBox();
	const planBox = await session.page.getByTestId("plan-canvas").boundingBox();
	if (!marker || !wallBox || !planBox) {
		throw new Error("Expected the wall, panel and plan canvas to render");
	}
	const contact = {
		x: marker.x + marker.width / 2,
		y: marker.y + marker.height / 2,
	};
	const horizontal = wallBox.width >= wallBox.height;
	// This is a direction vector, not a tap: the open inspector may cover the room.
	const planCenter = await session.page
		.getByTestId("room-face")
		.first()
		.evaluate((element) => {
			const bounds = element.getBoundingClientRect();
			return {
				x: bounds.x + bounds.width / 2,
				y: bounds.y + bounds.height / 2,
			};
		});
	if (!planCenter)
		throw new Error("Expected the actual room interior direction");
	const branchEnd = horizontal
		? {
				x: contact.x,
				y: contact.y + Math.sign(planCenter.y - contact.y) * 90,
			}
		: {
				x: contact.x + Math.sign(planCenter.x - contact.x) * 90,
				y: contact.y,
			};
	let revisionsBeforeJunction = await durableRevisionCount(session.page);
	await chooseEditorOption(session.page, "Стена");
	await drawCreationWallByTouch(session.page, contact, branchEnd);

	const conflict = session.page.getByTestId("wall-add-host-conflict-preview");
	await expect(conflict).toBeVisible();
	await expect(conflict).toBeFocused();
	await expect(conflict).toContainText("1 настенный предмет");
	await expect(conflict).toContainText("Настенная панель");
	expect(await durableRevisionCount(session.page)).toBe(
		revisionsBeforeJunction,
	);
	await expect.poll(() => durableWallItems(session.page)).toHaveLength(1);

	await dragPlanControlByTouch(session.page, branchEnd, {
		x: branchEnd.x + (horizontal ? 50 : 0),
		y: branchEnd.y + (horizontal ? 0 : 50),
	});
	await expect(session.page.getByTestId("wall-draft")).toHaveCount(0);
	await conflict.getByRole("button", { name: "Отмена" }).click();
	await expect(conflict).toHaveCount(0);
	await expect(
		session.page.getByRole("button", { name: "Стена", exact: true }),
	).toBeFocused();
	expect(await durableRevisionCount(session.page)).toBe(
		revisionsBeforeJunction,
	);
	await expect.poll(() => durableWallItems(session.page)).toHaveLength(1);

	await triggerEditorHistoryAction(session.page, "undo");
	await expect(conflict).toHaveCount(0);
	await expect
		.poll(async () => (await durableWallItems(session.page))[0]?.color)
		.toBe("#416b91");
	await triggerEditorHistoryAction(session.page, "redo");
	await expect
		.poll(async () => (await durableWallItems(session.page))[0]?.color)
		.toBe("#8c6e4c");

	revisionsBeforeJunction = await durableRevisionCount(session.page);

	// History restores the durable model and remounts the plan projection. Read
	// the restored hit targets again instead of dragging against stale pixels.
	const restoredMarker = await session.page
		.getByTestId("wall-schematic-item")
		.boundingBox();
	const restoredWallBox = await exteriorWall.boundingBox();
	const restoredPlanBox = await session.page
		.getByTestId("plan-canvas")
		.boundingBox();
	if (!restoredMarker || !restoredWallBox || !restoredPlanBox) {
		throw new Error("Expected restored wall panel and plan canvas to render");
	}
	const restoredContact = {
		x: restoredMarker.x + restoredMarker.width / 2,
		y: restoredMarker.y + restoredMarker.height / 2,
	};
	const restoredHorizontal = restoredWallBox.width >= restoredWallBox.height;
	const [restoredPlanCenter] = await roomFaceInteriorPoints(session.page);
	if (!restoredPlanCenter)
		throw new Error("Expected the restored room interior direction");
	const restoredBranchEnd = restoredHorizontal
		? {
				x: restoredContact.x,
				y:
					restoredContact.y +
					Math.sign(restoredPlanCenter.y - restoredContact.y) * 90,
			}
		: {
				x:
					restoredContact.x +
					Math.sign(restoredPlanCenter.x - restoredContact.x) * 90,
				y: restoredContact.y,
			};

	await drawCreationWallByTouch(
		session.page,
		restoredContact,
		restoredBranchEnd,
	);
	await expect(conflict).toBeVisible();
	await conflict
		.getByRole("button", {
			name: "Добавить стену и удалить 1 настенный предмет",
		})
		.click();

	await expect(conflict).toHaveCount(0);
	await expect(session.page.getByTestId("wall-count")).toHaveText("6 стен");
	await expect
		.poll(() => durableRevisionCount(session.page))
		.toBe(revisionsBeforeJunction + 1);
	await expect.poll(() => durableWallItems(session.page)).toEqual([]);
	await session.context.close();
});

test("RECONCILIATION-E2E-02F: a phone-drawn X junction keeps an unaffected divider panel in place", async ({
	page: _page,
}, testInfo) => {
	const session = await openPersistentPhone(
		testInfo,
		"editor-wall-item-x-junction-rehost",
	);
	await session.page.goto("/");
	await startNewProject(session.page, "Панель и X-образный стык");
	await session.page.getByRole("button", { name: "Создать контур" }).click();
	await chooseEditorOption(session.page, "Стена");
	await drawCentreDividerByTouch(session.page);
	await expect(session.page.getByTestId("wall-count")).toHaveText("7 стен");

	await chooseEditorOption(session.page, "Рука и выбор");
	const divider = session.page
		.locator('[data-testid="wall-segment"][data-wall-kind="interior"]')
		.first();
	const originalWallId = await divider.getAttribute("data-wall-id");
	if (!originalWallId) throw new Error("Expected the divider wall identity");
	await divider.click();
	await expandSelectedWallInspector(session.page);
	await loadLegacyWallPanelFixture(session.page);
	await expect.poll(() => durableWallItems(session.page)).toHaveLength(1);
	const offset = session.page.getByLabel(
		"Смещение настенного предмета «Настенная панель», мм",
	);
	await offset.fill("2300");
	await offset.blur();
	await expect
		.poll(async () => (await durableWallItems(session.page))[0]?.offsetMm)
		.toBe(2300);
	const markerBefore = await renderedWallItemCenterMm(session.page);
	if (!markerBefore) throw new Error("Expected the divider panel marker");

	const revisionsBeforeJunction = await durableRevisionCount(session.page);
	await chooseEditorOption(session.page, "Стена");
	await drawCentreCrossbarByTouch(session.page);

	await expect(session.page.getByTestId("wall-draft")).toHaveCount(0);
	await expect(session.page.getByTestId("wall-count")).toHaveText("12 стен");
	await expect(session.page.getByTestId("room-count")).toHaveText("4 комнаты");
	await expect
		.poll(() => durableRevisionCount(session.page))
		.toBe(revisionsBeforeJunction + 1);
	const [rehosted] = await durableWallItems(session.page);
	if (!rehosted) throw new Error("Expected the X-rehosted wall panel");
	expect(rehosted.wallSegmentId).not.toBe(originalWallId);
	expect(rehosted.offsetMm).toBeLessThan(2300);
	const markerAfter = await renderedWallItemCenterMm(session.page);
	if (!markerAfter) throw new Error("Expected the X-rehosted panel marker");
	expect(markerAfter.xMm).toBeCloseTo(markerBefore.xMm, 1);
	expect(markerAfter.zMm).toBeCloseTo(markerBefore.zMm, 1);

	await session.page.reload();
	await openProjectFromHub(session.page, "Панель и X-образный стык");
	await expect(session.page.getByTestId("wall-count")).toHaveText("12 стен");
	await expect(session.page.getByTestId("room-count")).toHaveText("4 комнаты");
	await expect(session.page.getByTestId("wall-schematic-item")).toHaveCount(1);
	await expect
		.poll(() => durableWallItems(session.page))
		.toEqual([expect.objectContaining(rehosted)]);
	await chooseEditorOption(session.page, "3D");
	await expect(
		session.page.getByTestId("three-dimensional-canvas"),
	).toBeVisible();
	await session.context.close();
});

test("RECONCILIATION-E2E-02D: a wall panel remains intact when the removed split route is unavailable", async ({
	page: _page,
}, testInfo) => {
	const session = await openPersistentPhone(
		testInfo,
		"editor-wall-item-split-conflict",
	);
	await session.page.goto("/");
	await startNewProject(session.page, "Панель в линии разделения");
	await session.page.getByRole("button", { name: "Создать контур" }).click();
	await chooseEditorOption(session.page, "Рука и выбор");
	const exteriorWall = session.page
		.locator('[data-testid="wall-segment"][data-wall-kind="exterior"]')
		.first();
	await exteriorWall.click();
	await expandSelectedWallInspector(session.page);
	await loadLegacyWallPanelFixture(session.page);
	await expect.poll(() => durableWallItems(session.page)).toHaveLength(1);
	const revisionsBeforeSplit = await durableRevisionCount(session.page);

	const itemsBeforeTouch = await durableWallItems(session.page);
	await expect(
		session.page.getByRole("button", { name: "Разделить стену жестом" }),
	).toHaveCount(0);
	await chooseEditorOption(session.page, "Рука и выбор");
	await exteriorWall.tap();
	await expect(session.page.getByTestId("wall-split-draft")).toHaveCount(0);
	await expect(
		session.page.getByTestId("wall-split-host-conflict"),
	).toHaveCount(0);
	expect(await durableWallItems(session.page)).toEqual(itemsBeforeTouch);
	expect(await durableRevisionCount(session.page)).toBe(revisionsBeforeSplit);
	await session.page.reload();
	await openProjectFromHub(session.page, "Панель в линии разделения");
	await expect(session.page.getByTestId("wall-segment")).toHaveCount(4);
	await expect(session.page.getByTestId("room-face")).toHaveCount(1);
	expect(await durableWallItems(session.page)).toEqual(itemsBeforeTouch);
	expect(await durableRevisionCount(session.page)).toBe(revisionsBeforeSplit);

	await session.context.close();
});

test("ITEM-E2E-04A: a selected wall keeps one panel at its edited local offset after reload", async ({
	page: _page,
}, testInfo) => {
	const session = await openPersistentPhone(
		testInfo,
		"editor-wall-item-local-move",
	);
	await session.page.goto("/");
	await startNewProject(session.page, "Панель на стене");
	await session.page.getByRole("button", { name: "Создать контур" }).click();
	await chooseEditorOption(session.page, "Рука и выбор");
	const exteriorWall = session.page
		.locator('[data-testid="wall-segment"][data-wall-kind="exterior"]')
		.first();
	await exteriorWall.click();
	await expandSelectedWallInspector(session.page);
	await loadLegacyWallPanelFixture(session.page);
	await expect.poll(() => durableWallItems(session.page)).toHaveLength(1);
	const revisionsBeforeMove = await durableRevisionCount(session.page);

	const offsetInput = session.page.getByLabel(
		"Смещение настенного предмета «Настенная панель», мм",
	);
	const elevationInput = session.page.getByLabel(
		"Высота центра настенного предмета «Настенная панель», мм",
	);
	const originalOffset = await offsetInput.inputValue();
	const originalElevation = await elevationInput.inputValue();
	await offsetInput.fill("3100");
	await offsetInput.press("Escape");
	await expect(offsetInput).toHaveValue(originalOffset);
	expect(await durableRevisionCount(session.page)).toBe(revisionsBeforeMove);
	await elevationInput.fill("1500");
	await elevationInput.press("Escape");
	await expect(elevationInput).toHaveValue(originalElevation);
	expect(await durableRevisionCount(session.page)).toBe(revisionsBeforeMove);
	await offsetInput.fill("3100");
	await offsetInput.blur();
	await expect
		.poll(() => durableRevisionCount(session.page))
		.toBe(revisionsBeforeMove + 1);
	await expect
		.poll(() => durableWallItems(session.page))
		.toEqual([expect.objectContaining({ offsetMm: 3100 })]);

	await session.page.reload();
	await openProjectFromHub(session.page, "Панель на стене");
	await expect
		.poll(() => durableWallItems(session.page))
		.toEqual([expect.objectContaining({ offsetMm: 3100 })]);
	await session.context.close();
});

test("ITEM-E2E-04H: a real catalog wall-model draft preserves the chosen semantic side after confirmation and reload", async ({
	page: _page,
}, testInfo) => {
	const session = await openPersistentPhone(
		testInfo,
		"editor-wall-item-semantic-side",
	);
	await session.page.goto("/");
	await startNewProject(session.page, "Сторона настенной панели");
	await session.page.getByRole("button", { name: "Создать контур" }).click();
	await chooseEditorOption(session.page, "Рука и выбор");
	await session.page
		.locator('[data-testid="wall-segment"][data-wall-kind="exterior"]')
		.first()
		.click();
	await expandSelectedWallInspector(session.page);
	const revisionsBeforePanel = await durableRevisionCount(session.page);
	await choosePreloadedCatalogAsset(
		session.page,
		"Демонстрационное настенное бра",
		false,
	);
	const rightSide = session.page.getByRole("button", {
		name: "Разместить на правой стороне стены",
	});
	await expect(rightSide).toBeVisible();
	await rightSide.click();
	await expect(rightSide).toHaveAttribute("aria-pressed", "true");
	await session.page
		.getByRole("button", { name: "Подтвердить размещение" })
		.click();
	await expect
		.poll(() => durableRevisionCount(session.page))
		.toBe(revisionsBeforePanel + 1);
	await expect
		.poll(() => durableWallItems(session.page))
		.toEqual([expect.objectContaining({ side: "right" })]);
	await expect(session.page.getByTestId("wall-schematic-item")).toHaveAttribute(
		"data-wall-item-side",
		"right",
	);

	await session.page.reload();
	await openProjectFromHub(session.page, "Сторона настенной панели");
	await expect
		.poll(() => durableWallItems(session.page))
		.toEqual([expect.objectContaining({ side: "right" })]);
	await session.context.close();
});

test("ITEM-E2E-04I: a legacy custom wall placeholder retains its saved dimensions and color without restoring its authoring tool", async ({
	page: _page,
}, testInfo) => {
	const session = await openPersistentPhone(
		testInfo,
		"editor-custom-wall-placeholder",
	);
	await session.page.goto("/");
	await startNewProject(session.page, "Настенный макет по размерам");
	await session.page.getByRole("button", { name: "Создать контур" }).click();
	await chooseEditorOption(session.page, "Рука и выбор");
	await session.page
		.locator('[data-testid="wall-segment"][data-wall-kind="exterior"]')
		.first()
		.click();
	await expandSelectedWallInspector(session.page);
	const revisionsBeforePlacement = await durableRevisionCount(session.page);
	await expect(
		session.page.getByRole("button", {
			name: "Добавить настенную панель",
			exact: true,
		}),
	).toHaveCount(0);
	await loadLegacyWallPanelFixture(session.page, {
		label: "Индивидуальная панель",
		widthMm: 700,
		depthMm: 70,
		heightMm: 500,
		elevationMm: 800,
		offsetMm: 1400,
		color: "#716796",
	});
	await expect
		.poll(() => durableRevisionCount(session.page))
		.toBe(revisionsBeforePlacement + 1);
	await expect
		.poll(() => durableWallItems(session.page))
		.toEqual([
			expect.objectContaining({
				color: "#716796",
				depthMm: 70,
				elevationMm: 800,
				heightMm: 500,
				label: "Индивидуальная панель",
				offsetMm: 1400,
				widthMm: 700,
			}),
		]);

	await session.page.reload();
	await openProjectFromHub(session.page, "Настенный макет по размерам");
	await expect
		.poll(() => durableWallItems(session.page))
		.toEqual([
			expect.objectContaining({
				color: "#716796",
				depthMm: 70,
				elevationMm: 800,
				heightMm: 500,
				label: "Индивидуальная панель",
				offsetMm: 1400,
				widthMm: 700,
			}),
		]);
	await session.context.close();
});

test("ITEM-E2E-04B: a locked wall panel survives reload and requires explicit unlock before editing", async ({
	page: _page,
}, testInfo) => {
	const session = await openPersistentPhone(testInfo, "editor-wall-item-lock");
	await session.page.goto("/");
	await startNewProject(session.page, "Защищённая панель");
	await session.page.getByRole("button", { name: "Создать контур" }).click();
	await chooseEditorOption(session.page, "Рука и выбор");
	const exteriorWall = session.page
		.locator('[data-testid="wall-segment"][data-wall-kind="exterior"]')
		.first();
	await exteriorWall.click();
	await expandSelectedWallInspector(session.page);
	await loadLegacyWallPanelFixture(session.page);
	await expect.poll(() => durableWallItems(session.page)).toHaveLength(1);
	const revisionsBeforeLock = await durableRevisionCount(session.page);

	await session.page
		.getByRole("button", { name: "Заблокировать настенный предмет" })
		.click();
	await expect
		.poll(() => durableRevisionCount(session.page))
		.toBe(revisionsBeforeLock + 1);
	await expect
		.poll(() => durableWallItems(session.page))
		.toEqual([expect.objectContaining({ locked: true })]);
	await expect(
		session.page.getByText(
			"Предмет заблокирован. Разблокируйте его, чтобы изменить положение или удалить.",
		),
	).toHaveCount(0);
	await expect(
		session.page.getByLabel(
			"Смещение настенного предмета «Настенная панель», мм",
		),
	).toBeDisabled();
	await expect(
		session.page.getByRole("button", { name: "Удалить настенный предмет" }),
	).toBeDisabled();
	await expect(
		session.page.getByRole("button", {
			name: "Выбрать вариант цвета настенного предмета Глубокий синий",
		}),
	).toBeDisabled();

	await session.page.reload();
	await openProjectFromHub(session.page, "Защищённая панель");
	await expect
		.poll(() => durableWallItems(session.page))
		.toEqual([expect.objectContaining({ locked: true })]);
	await chooseEditorOption(session.page, "Рука и выбор");
	await exteriorWall.click();
	await expandSelectedWallInspector(session.page);
	const revisionsBeforeUnlock = await durableRevisionCount(session.page);
	await session.page
		.getByRole("button", { name: "Разблокировать настенный предмет" })
		.click();
	await expect
		.poll(() => durableRevisionCount(session.page))
		.toBe(revisionsBeforeUnlock + 1);
	await expect
		.poll(async () => (await durableWallItems(session.page))[0]?.locked)
		.toBeUndefined();
	await expect(
		session.page.getByLabel(
			"Смещение настенного предмета «Настенная панель», мм",
		),
	).toBeEnabled();
	await session.context.close();
});

test("ITEM-E2E-04D: duplicating a catalog wall model starts an adjacent non-durable copy until confirmed", async ({
	page: _page,
}, testInfo) => {
	const session = await openPersistentPhone(
		testInfo,
		"editor-wall-item-duplicate",
	);
	await session.page.goto("/");
	await startNewProject(session.page, "Копия настенной панели");
	await session.page.getByRole("button", { name: "Создать контур" }).click();
	await chooseEditorOption(session.page, "Рука и выбор");
	const exteriorWall = session.page
		.locator('[data-testid="wall-segment"][data-wall-kind="exterior"]')
		.first();
	await exteriorWall.click();
	await expandSelectedWallInspector(session.page);
	await choosePreloadedCatalogAsset(
		session.page,
		"Демонстрационное настенное бра",
		false,
	);
	await session.page
		.getByRole("button", { name: "Подтвердить размещение", exact: true })
		.click();
	await expect.poll(() => durableWallItems(session.page)).toHaveLength(1);
	const [source] = await durableWallItems(session.page);
	if (!source) throw new Error("Expected the source wall panel");
	await session.page
		.getByRole("button", { name: "Заблокировать настенный предмет" })
		.click();
	await expect
		.poll(async () => (await durableWallItems(session.page))[0]?.locked)
		.toBe(true);
	const revisionsBeforeDuplicate = await durableRevisionCount(session.page);

	const duplicate = session.page.getByRole("button", {
		name: "Дублировать настенный предмет",
		exact: true,
	});
	await expect(duplicate).toBeEnabled();
	await duplicate.click();
	await expect(
		session.page.getByText("Размещение настенного предмета"),
	).toBeVisible();
	await expect(
		session.page.getByText(
			`Смещение от начала стены: ${source.offsetMm + source.widthMm} мм`,
		),
	).toBeVisible();
	expect(await durableRevisionCount(session.page)).toBe(
		revisionsBeforeDuplicate,
	);
	await expect
		.poll(() => durableWallItems(session.page))
		.toEqual([expect.objectContaining({ ...source, locked: true })]);

	await session.page
		.getByRole("button", { name: "Подтвердить размещение" })
		.click();
	await expect
		.poll(() => durableRevisionCount(session.page))
		.toBe(revisionsBeforeDuplicate + 1);
	const copies = await durableWallItems(session.page);
	expect(copies).toHaveLength(2);
	expect(copies.map((item) => item.assetInstanceId)).toEqual(
		expect.arrayContaining([source.assetInstanceId]),
	);
	const copy = copies.find(
		(item) => item.assetInstanceId !== source.assetInstanceId,
	);
	expect(
		copies.find((item) => item.assetInstanceId === source.assetInstanceId),
	).toEqual(expect.objectContaining({ locked: true }));
	expect(copy).toEqual(
		expect.objectContaining({
			side: source.side,
			wallSegmentId: source.wallSegmentId,
			widthMm: source.widthMm,
		}),
	);
	expect(Math.abs((copy?.offsetMm ?? source.offsetMm) - source.offsetMm)).toBe(
		source.widthMm,
	);
	expect(copy?.locked).toBeUndefined();
	await session.context.close();
});

test("ITEM-E2E-04E: a catalog model over a legacy same-side wall panel shows a warning and requires explicit durable confirmation", async ({
	page: _page,
}, testInfo) => {
	const session = await openPersistentPhone(
		testInfo,
		"editor-wall-item-overlap",
	);
	await session.page.goto("/");
	await startNewProject(session.page, "Пересечение настенных панелей");
	await session.page.getByRole("button", { name: "Создать контур" }).click();
	await chooseEditorOption(session.page, "Рука и выбор");
	const wallIds = await session.page
		.locator('[data-testid="wall-segment"][data-wall-kind="exterior"]')
		.evaluateAll((walls) =>
			walls.map((wall) => wall.getAttribute("data-wall-id")),
		);
	// Choose an explicit non-default host; a lost selection must never pass by chance.
	const selectedHostId = wallIds
		.filter((id): id is string => id !== null)
		.sort()
		.at(-1);
	if (!selectedHostId || wallIds.length < 2)
		throw new Error("Expected distinct wall host choices");
	const exteriorWall = session.page.locator(
		`[data-testid="wall-segment"][data-wall-id="${selectedHostId}"]`,
	);
	await exteriorWall.click();
	await expandSelectedWallInspector(session.page);
	const revisionsBeforePanel = await durableRevisionCount(session.page);
	await loadLegacyWallPanelFixture(session.page);
	await expect.poll(() => durableWallItems(session.page)).toHaveLength(1);
	await expect
		.poll(() => durableRevisionCount(session.page))
		.toBe(revisionsBeforePanel + 1);

	const [legacyPanel] = await durableWallItems(session.page);
	if (!legacyPanel) throw new Error("Expected the exact legacy wall host");
	await choosePreloadedCatalogAsset(
		session.page,
		"Демонстрационное настенное бра",
		false,
	);
	await expect
		.poll(() => selectedFixtureWallId(session.page))
		.toBe(legacyPanel.wallSegmentId);
	await expect(
		session.page.getByTestId("wall-item-placement-affected-target"),
	).toHaveText(
		"Конфликтующий предмет: «Настенная панель». Измените смещение или сторону.",
	);
	await expect(
		session.page.getByTestId("wall-item-placement-warning"),
	).toHaveText("Предупреждение: предметы пересекаются.");
	await expect(
		session.page.getByRole("button", { name: "Подтвердить размещение" }),
	).toBeEnabled();
	await session.page
		.getByRole("button", { name: "Подтвердить размещение" })
		.click();
	await expect
		.poll(() => durableRevisionCount(session.page))
		.toBe(revisionsBeforePanel + 2);
	await expect.poll(() => durableWallItems(session.page)).toHaveLength(2);

	await session.context.close();
});

test("ITEM-E2E-04F: duplicating a catalog wall model does not start an impossible preview", async ({
	page: _page,
}, testInfo) => {
	const session = await openPersistentPhone(
		testInfo,
		"editor-wall-item-safe-duplicate",
	);
	await session.page.goto("/");
	await startNewProject(session.page, "Безопасная копия настенной панели");
	await session.page.getByRole("button", { name: "Создать контур" }).click();
	await chooseEditorOption(session.page, "Рука и выбор");
	const exteriorWall = session.page
		.locator('[data-testid="wall-segment"][data-wall-kind="exterior"]')
		.first();
	await exteriorWall.click();
	await expandSelectedWallInspector(session.page);
	await choosePreloadedCatalogAsset(
		session.page,
		"Демонстрационное настенное бра",
		false,
	);
	await session.page
		.getByRole("button", { name: "Подтвердить размещение", exact: true })
		.click();
	await expect.poll(() => durableWallItems(session.page)).toHaveLength(1);
	const [source] = await durableWallItems(session.page);
	if (!source) throw new Error("Expected source wall panel");

	const sourceOffset = session.page.getByLabel(
		"Смещение настенного предмета «Демонстрационное настенное бра», мм",
	);
	await sourceOffset.fill(String(source.widthMm));
	await sourceOffset.blur();
	await expect
		.poll(async () => (await durableWallItems(session.page))[0]?.offsetMm)
		.toBe(source.widthMm);

	await choosePreloadedCatalogAsset(
		session.page,
		"Демонстрационное настенное бра",
		false,
	);
	await session.page
		.getByRole("button", { name: "Подтвердить размещение", exact: true })
		.click();
	await expect.poll(() => durableWallItems(session.page)).toHaveLength(2);
	const wallItemOffsets = session.page.getByLabel(
		"Смещение настенного предмета «Демонстрационное настенное бра», мм",
	);
	await wallItemOffsets.nth(1).fill(String(source.widthMm * 2));
	await wallItemOffsets.nth(1).blur();
	await expect
		.poll(async () => (await durableWallItems(session.page))[1]?.offsetMm)
		.toBe(source.widthMm * 2);
	const revisionsBeforeDuplicate = await durableRevisionCount(session.page);

	await session.page
		.getByRole("button", {
			name: "Дублировать настенный предмет",
			exact: true,
		})
		.first()
		.click();
	await expect(
		session.page.getByText(
			"На этой стене нет места для безопасной копии предмета.",
		),
	).toBeVisible();
	await expect(
		session.page.getByText("Размещение настенного предмета"),
	).toHaveCount(0);
	expect(await durableRevisionCount(session.page)).toBe(
		revisionsBeforeDuplicate,
	);
	await expect
		.poll(() => durableWallItems(session.page))
		.toEqual([
			expect.objectContaining({ offsetMm: source.widthMm }),
			expect.objectContaining({ offsetMm: source.widthMm * 2 }),
		]);

	await session.context.close();
});

test("ITEM-E2E-04G: a wall panel color is a durable, undoable declared variant", async ({
	page: _page,
}, testInfo) => {
	const session = await openPersistentPhone(testInfo, "editor-wall-item-color");
	await session.page.goto("/");
	await startNewProject(session.page, "Цвет настенной панели");
	await session.page.getByRole("button", { name: "Создать контур" }).click();
	await chooseEditorOption(session.page, "Рука и выбор");
	const exteriorWall = session.page
		.locator('[data-testid="wall-segment"][data-wall-kind="exterior"]')
		.first();
	await exteriorWall.click();
	await expandSelectedWallInspector(session.page);
	await loadLegacyWallPanelFixture(session.page);
	await expect.poll(() => durableWallItems(session.page)).toHaveLength(1);
	const initialWallColor = (await durableWallItems(session.page))[0]?.color;
	if (!initialWallColor) {
		throw new Error("Placed wall item did not have an initial color");
	}
	const revisionsBeforeRecolor = await durableRevisionCount(session.page);
	const orange = session.page.getByRole("button", {
		name: "Выбрать вариант цвета настенного предмета Тёплое дерево",
	});
	await expect(orange).toBeEnabled();
	await orange.click();
	const confirmation = session.page.getByRole("dialog", {
		name: "Подтвердить вариант цвета",
	});
	await expect(confirmation).toContainText("Тёплое дерево");
	await expect
		.poll(() => durableRevisionCount(session.page))
		.toBe(revisionsBeforeRecolor);
	await confirmation.getByRole("button", { name: "Отменить вариант" }).click();
	await expect(confirmation).toHaveCount(0);
	await expect
		.poll(async () => (await durableWallItems(session.page))[0]?.color)
		.toBe(initialWallColor);
	await expect
		.poll(() => durableRevisionCount(session.page))
		.toBe(revisionsBeforeRecolor);

	await orange.click();
	await expect(confirmation).toBeVisible();
	await confirmation.getByRole("button", { name: "Применить вариант" }).click();
	await expect
		.poll(async () => (await durableWallItems(session.page))[0]?.color)
		.toBe("#a76a3b");
	await expect
		.poll(async () => (await durableWallItems(session.page))[0]?.colorVariantId)
		.toBe("alpha-warm-wood");
	await expect
		.poll(() => durableRevisionCount(session.page))
		.toBe(revisionsBeforeRecolor + 1);
	await expect(orange).toHaveAttribute("aria-pressed", "true");

	await triggerEditorHistoryAction(session.page, "undo");
	await expect
		.poll(async () => (await durableWallItems(session.page))[0]?.color)
		.toBe(initialWallColor);
	await triggerEditorHistoryAction(session.page, "redo");
	await expect
		.poll(async () => (await durableWallItems(session.page))[0]?.colorVariantId)
		.toBe("alpha-warm-wood");
	await session.page.reload();
	await openProjectFromHub(session.page, "Цвет настенной панели");
	await expect
		.poll(async () => (await durableWallItems(session.page))[0])
		.toEqual(
			expect.objectContaining({
				color: "#a76a3b",
				colorVariantId: "alpha-warm-wood",
			}),
		);
	await session.context.close();
});

test("ITEM-E2E-04C: a locked floor item survives reload and requires explicit unlock before any edit", async ({
	page: _page,
}, testInfo) => {
	const session = await openPersistentPhone(testInfo, "editor-floor-item-lock");
	await session.page.goto("/");
	await startNewProject(session.page, "Защищённый стол");
	await session.page.getByRole("button", { name: "Создать контур" }).click();
	await chooseBuiltInGreybox(session.page);
	const planBox = await session.page.getByTestId("plan-canvas").boundingBox();
	if (!planBox) throw new Error("Expected plan canvas");
	await clickPlanPointMm(session.page, 2000, 1500);
	await expect.poll(() => durableFloorItems(session.page)).toHaveLength(1);

	await chooseEditorOption(session.page, "Рука и выбор");
	await session.page.getByTestId("schematic-item").click();
	await expandSelectedItemInspector(session.page);
	const revisionsBeforeLock = await durableRevisionCount(session.page);
	await session.page
		.getByRole("button", { name: "Заблокировать предмет" })
		.click();
	await expect
		.poll(() => durableRevisionCount(session.page))
		.toBe(revisionsBeforeLock + 1);
	await expect
		.poll(() => durableFloorItems(session.page))
		.toEqual([expect.objectContaining({ locked: true })]);
	await expect(
		session.page.getByText(
			"Предмет заблокирован. Разблокируйте его, чтобы изменить параметры, цвет, положение или удалить.",
		),
	).toHaveCount(0);
	await expect(
		session.page.getByLabel("Ширина выбранного предмета, мм"),
	).toBeDisabled();
	await expect(
		session.page.getByLabel("Угол поворота выбранного предмета, градусы"),
	).toBeDisabled();
	await expect(
		session.page.getByRole("button", { name: "Удалить предмет", exact: true }),
	).toBeDisabled();

	await session.page.reload();
	await openProjectFromHub(session.page, "Защищённый стол");
	await expect
		.poll(() => durableFloorItems(session.page))
		.toEqual([expect.objectContaining({ locked: true })]);
	await chooseEditorOption(session.page, "Рука и выбор");
	await session.page.getByTestId("schematic-item").click();
	await expandSelectedItemInspector(session.page);
	const revisionsBeforeUnlock = await durableRevisionCount(session.page);
	await session.page
		.getByRole("button", { name: "Разблокировать предмет" })
		.click();
	await expect
		.poll(() => durableRevisionCount(session.page))
		.toBe(revisionsBeforeUnlock + 1);
	await expect
		.poll(async () => (await durableFloorItems(session.page))[0]?.locked)
		.toBeUndefined();
	await expect(
		session.page.getByLabel("Ширина выбранного предмета, мм"),
	).toBeDisabled();
	await expect(
		session.page.getByRole("button", { name: "Удалить предмет", exact: true }),
	).toBeEnabled();
	await session.context.close();
});

test("RECONCILIATION-E2E-02B: deleting a wall with a panel requires one atomic outcome", async ({
	page: _page,
}, testInfo) => {
	const session = await openPersistentPhone(
		testInfo,
		"editor-wall-item-delete-conflict",
	);
	await session.page.goto("/");
	await startNewProject(session.page, "Панель на удаляемой стене");
	await session.page.getByRole("button", { name: "Создать контур" }).click();
	await chooseEditorOption(session.page, "Рука и выбор");
	const exteriorWall = session.page
		.locator('[data-testid="wall-segment"][data-wall-kind="exterior"]')
		.first();
	await exteriorWall.click();
	await expandSelectedWallInspector(session.page);
	await loadLegacyWallPanelFixture(session.page);
	await expect.poll(() => durableWallItems(session.page)).toHaveLength(1);
	const affectedWallItemId = (await durableWallItems(session.page))[0]
		?.assetInstanceId;
	const affectedRoomId = await session.page
		.getByTestId("room-face")
		.getAttribute("data-room-id");
	if (!affectedWallItemId || !affectedRoomId) {
		throw new Error(
			"Expected exact wall Item and Room identities before deletion",
		);
	}
	const revisionsBeforeDeletion = await durableRevisionCount(session.page);

	await session.page
		.getByRole("button", { name: "Удалить стену", exact: true })
		.click();
	const conflict = session.page.getByTestId("opening-conflict-preview");
	await expect(conflict).toContainText("1 предмет");
	await expect(
		conflict.getByText(affectedWallItemId, { exact: true }),
	).toBeVisible();
	await expect(
		conflict.getByText(affectedRoomId, { exact: true }),
	).toBeVisible();
	expect(await durableRevisionCount(session.page)).toBe(
		revisionsBeforeDeletion,
	);
	await conflict.getByRole("button", { name: "Отмена", exact: true }).click();
	await expect(conflict).toHaveCount(0);
	await expect.poll(() => durableWallItems(session.page)).toHaveLength(1);
	expect(await durableRevisionCount(session.page)).toBe(
		revisionsBeforeDeletion,
	);

	await session.page
		.getByRole("button", { name: "Удалить стену", exact: true })
		.click();
	await conflict
		.getByRole("button", {
			name: "Удалить стену и 1 предмет и изменить 1 помещение",
			exact: true,
		})
		.click();
	await expect(conflict).toHaveCount(0);
	await expect.poll(() => durableWallItems(session.page)).toHaveLength(0);
	await expect
		.poll(() => durableRevisionCount(session.page))
		.toBe(revisionsBeforeDeletion + 1);
	await session.context.close();
});

test("RECONCILIATION-E2E-02C: removing a split vertex returns a panel to its durable wall host", async ({
	page: _page,
}, testInfo) => {
	const session = await openPersistentPhone(
		testInfo,
		"editor-wall-item-merge-rehost",
	);
	await session.page.goto("/");
	await startNewProject(session.page, "Панель и объединение");
	await session.page.getByRole("button", { name: "Создать контур" }).click();
	await chooseEditorOption(session.page, "Рука и выбор");
	const exteriorWall = session.page
		.locator('[data-testid="wall-segment"][data-wall-kind="exterior"]')
		.first();
	const originalWallId = await exteriorWall.getAttribute("data-wall-id");
	if (!originalWallId) throw new Error("Expected the selected wall identity");
	await exteriorWall.click();
	await expandSelectedWallInspector(session.page);
	const revisionsBeforePanel = await durableRevisionCount(session.page);
	await loadLegacyWallPanelFixture(session.page);
	await expect.poll(() => durableWallItems(session.page)).toHaveLength(1);
	const initialItem = (await durableWallItems(session.page))[0];
	if (!initialItem) throw new Error("Expected the durable wall Item");

	await loadLegacySplitWallFixture(session.page, 0.2);
	await expect(session.page.getByTestId("wall-segment")).toHaveCount(5);
	expect((await durableWallItems(session.page))[0]?.wallSegmentId).not.toBe(
		originalWallId,
	);

	await session.page
		.getByRole("button", { name: "Удалить вершину", exact: true })
		.click();
	const deletionPreview = session.page.getByTestId("vertex-deletion-draft");
	await expect(
		deletionPreview.getByText(initialItem.assetInstanceId, { exact: true }),
	).toBeVisible();
	await deletionPreview
		.getByRole("button", { name: "Подтвердить удаление" })
		.click();
	await expect(session.page.getByTestId("wall-segment")).toHaveCount(4);
	const items = await durableWallItems(session.page);
	expect(items).toHaveLength(1);
	expect(items[0]).toEqual(
		expect.objectContaining({
			anchorClass: "wall",
			offsetMm: initialItem.offsetMm,
			side: "left",
			wallSegmentId: originalWallId,
		}),
	);
	expect(await durableRevisionCount(session.page)).toBe(
		revisionsBeforePanel + 3,
	);
	await session.page.reload();
	await openProjectFromHub(session.page, "Панель и объединение");
	await expect
		.poll(() => durableWallItems(session.page))
		.toEqual([expect.objectContaining({ offsetMm: initialItem.offsetMm })]);
	await session.context.close();
});

test("PLAN-E2E-04J: a selected split wall can remove only its redundant inline vertex", async ({
	page: _page,
}, testInfo) => {
	const session = await openPersistentPhone(
		testInfo,
		"editor-remove-split-vertex",
	);
	await session.page.goto("/");
	await startNewProject(session.page, "Убрать разделение стены");
	await session.page.getByRole("button", { name: "Создать контур" }).click();
	await chooseEditorOption(session.page, "Рука и выбор");
	const exteriorWall = session.page
		.locator('[data-testid="wall-segment"][data-wall-kind="exterior"]')
		.first();
	await exteriorWall.click();
	await expandSelectedWallInspector(session.page);
	await loadLegacySplitWallFixture(session.page);
	await expect(session.page.getByTestId("wall-segment")).toHaveCount(5);
	const revisionsBeforeVertexRemoval = await durableRevisionCount(session.page);

	await session.page
		.getByRole("button", { name: "Удалить вершину", exact: true })
		.click();
	const candidate = session.page.getByTestId("vertex-deletion-draft");
	await expect(candidate).toBeVisible();
	expect(await durableRevisionCount(session.page)).toBe(
		revisionsBeforeVertexRemoval,
	);
	await candidate.getByRole("button", { name: "Отменить удаление" }).click();
	await expect(candidate).toHaveCount(0);
	expect(await durableRevisionCount(session.page)).toBe(
		revisionsBeforeVertexRemoval,
	);

	await session.page
		.getByRole("button", { name: "Удалить вершину", exact: true })
		.click();
	await candidate.getByRole("button", { name: "Подтвердить удаление" }).click();
	await expect(candidate).toHaveCount(0);
	await expect(session.page.getByTestId("wall-segment")).toHaveCount(4);
	expect(await durableRevisionCount(session.page)).toBe(
		revisionsBeforeVertexRemoval + 1,
	);

	await session.context.close();
});

test("PLAN-E2E-04A: an explicitly drawn exterior wall can be selected and deleted without touching the room", async ({
	page: _page,
}, testInfo) => {
	const session = await openPersistentPhone(
		testInfo,
		"editor-delete-exterior-wall",
	);
	await session.page.goto("/");
	await startNewProject(session.page, "Удаление внешней стены");
	await session.page.getByRole("button", { name: "Создать контур" }).click();
	const plan = session.page.getByTestId("plan-canvas");
	const planBox = await plan.boundingBox();
	if (!planBox) {
		throw new Error("Plan canvas did not render");
	}

	await chooseEditorOption(session.page, "Стена");
	const start = await planPointMm(session.page, { xMm: -1000, zMm: -1000 });
	await session.page.mouse.move(start.x, start.y);
	await session.page.mouse.down();
	await session.page.mouse.move(start.x + 70, start.y, { steps: 6 });
	await session.page.mouse.up();
	await expect(session.page.getByTestId("wall-count")).toHaveText("5 стен");
	await expect(session.page.getByTestId("room-count")).toHaveText("1 комната");

	await chooseEditorOption(session.page, "Рука и выбор");
	const freeWall = session.page.locator(
		'[data-testid="wall-segment"][data-wall-kind="interior"]',
	);
	await expect(freeWall).toHaveCount(1);
	await freeWall.click();
	await expandSelectedWallInspector(session.page);
	const revisionsBeforeDeletion = await durableRevisionCount(session.page);
	await session.page
		.getByRole("button", { name: "Удалить стену", exact: true })
		.click();
	const consequences = session.page.getByTestId("opening-conflict-preview");
	await expect(consequences).toContainText(
		"Помещения, проёмы и предметы не затрагиваются",
	);
	await expect(session.page.getByTestId("wall-segment")).toHaveCount(5);
	expect(await durableRevisionCount(session.page)).toBe(
		revisionsBeforeDeletion,
	);
	await consequences
		.getByRole("button", { name: "Отмена", exact: true })
		.click();
	await expect(consequences).toHaveCount(0);
	await expect(session.page.getByTestId("wall-segment")).toHaveCount(5);

	await session.page
		.getByRole("button", { name: "Удалить стену", exact: true })
		.click();
	await consequences
		.getByRole("button", { name: "Удалить стену", exact: true })
		.click();
	await expect(session.page.getByTestId("wall-segment")).toHaveCount(4);
	await expect(session.page.getByTestId("room-face")).toHaveCount(1);
	await expect
		.poll(() => durableRevisionCount(session.page))
		.toBe(revisionsBeforeDeletion + 1);
	await session.page.reload();
	await openProjectFromHub(session.page, "Удаление внешней стены");
	await expect(session.page.getByTestId("wall-segment")).toHaveCount(4);
	await expect(session.page.getByTestId("room-face")).toHaveCount(1);
	await session.context.close();
});

test("EDITOR-E2E-04B: a selected item rotates on declared steps and saves directly after the drag", async ({
	page: _page,
}, testInfo) => {
	const session = await openPersistentPhone(testInfo, "editor-item-rotation");
	await session.page.goto("/");
	await startNewProject(session.page, "Поворот мебели");
	await session.page.getByRole("button", { name: "Создать контур" }).click();
	await chooseBuiltInGreybox(session.page, "Стол");
	const plan = session.page.getByTestId("plan-canvas");
	const planBox = await plan.boundingBox();
	if (!planBox) {
		throw new Error("Plan canvas did not render");
	}
	await clickPlanPointMm(session.page, 2000, 1500);
	await expect(session.page.getByTestId("item-count")).toHaveText("1 предмет");
	await expect(
		session.page.getByTestId("item-placement-durable-status"),
	).toHaveText("Предмет размещён и сохранён.");
	await expect(
		session.page.getByTestId("item-placement-durable-status"),
	).toBeHidden({ timeout: 5_000 });
	await chooseEditorOption(session.page, "Рука и выбор");
	const item = session.page.getByTestId("schematic-item");
	await item.click();
	const rotationGizmo = session.page.getByTestId("rotation-gizmo");
	const gizmo = rotationGizmo.getByLabel("Кольцо поворота предмета");
	await expect(gizmo).toBeVisible();
	const rotationTrack = rotationGizmo.getByTestId(
		"two-dimensional-rotation-track",
	);
	await expect(rotationTrack).toHaveCount(1);
	await expect(rotationGizmo.locator("ellipse, line")).toHaveCount(0);
	const rotationHitArea = session.page.getByTestId(
		"two-dimensional-rotation-hit-area",
	);
	await expect(rotationHitArea).toBeVisible();
	const [itemBox, rotationHitAreaBox] = await Promise.all([
		item.boundingBox(),
		rotationHitArea.boundingBox(),
	]);
	if (!itemBox || !rotationHitAreaBox) {
		throw new Error("Item rotation ring did not render");
	}
	expect(
		Math.hypot(
			rotationHitAreaBox.x +
				rotationHitAreaBox.width / 2 -
				(itemBox.x + itemBox.width / 2),
			rotationHitAreaBox.y +
				rotationHitAreaBox.height / 2 -
				(itemBox.y + itemBox.height / 2),
		),
	).toBeLessThan(70);
	expect(
		await session.page.evaluate(
			({ x, y }) =>
				document.elementFromPoint(x, y)?.getAttribute("data-testid"),
			{
				x: rotationHitAreaBox.x + rotationHitAreaBox.width / 2,
				y: rotationHitAreaBox.y + rotationHitAreaBox.height / 2,
			},
		),
	).not.toBe("two-dimensional-rotation-hit-area");
	expect(
		await session.page.evaluate(
			({ x, y }) =>
				document.elementFromPoint(x, y)?.getAttribute("data-testid"),
			{
				x: rotationHitAreaBox.x + rotationHitAreaBox.width - 4,
				y: rotationHitAreaBox.y + rotationHitAreaBox.height / 2,
			},
		),
	).toBe("two-dimensional-rotation-hit-area");
	const handle = session.page.locator("[data-rotation-handle]");
	await expect(rotationTrack).toHaveCSS("opacity", "0");
	await expect(handle).toHaveCSS("opacity", "0");
	const handleBox = await handle.boundingBox();
	const gizmoBox = await gizmo.boundingBox();
	if (!handleBox || !gizmoBox) throw new Error("Rotation gizmo did not render");
	const rotationBeforeDrag = await rotationDegrees(session.page);
	const revisionsBeforeRotation = await durableRevisionCount(session.page);
	await session.page.mouse.move(
		rotationHitAreaBox.x + rotationHitAreaBox.width - 4,
		rotationHitAreaBox.y + rotationHitAreaBox.height / 2,
	);
	await session.page.mouse.down();
	await expect(session.page.getByTestId("rotation-gizmo")).toHaveAttribute(
		"data-rotation-active",
		"true",
	);
	await expect(rotationTrack).toHaveCSS("opacity", "0.4");
	await expect(handle).toHaveCSS("opacity", "0.9");
	const activePlanRotationScreenshot = testInfo.outputPath(
		"plan-rotation-active.png",
	);
	await session.page.screenshot({ path: activePlanRotationScreenshot });
	await testInfo.attach("plan-rotation-active", {
		contentType: "image/png",
		path: activePlanRotationScreenshot,
	});
	await session.page.mouse.move(
		gizmoBox.x + gizmoBox.width,
		gizmoBox.y + gizmoBox.height / 2,
		{ steps: 7 },
	);
	await session.page.mouse.up();
	const rotatedHandleBox = await handle.boundingBox();
	if (!rotatedHandleBox) throw new Error("Rotated handle did not render");
	expect(
		Math.abs(
			rotatedHandleBox.x +
				rotatedHandleBox.width / 2 -
				(gizmoBox.x + gizmoBox.width),
		),
	).toBeLessThan(5);
	const rotationAfterDrag = await rotationDegrees(session.page);
	expect(Math.abs(rotationAfterDrag ?? 0)).toBeGreaterThan(45);
	expect(
		Math.abs(rotationAfterDrag ?? 0) / 45 -
			Math.round(Math.abs(rotationAfterDrag ?? 0) / 45),
	).toBeLessThan(0.001);
	await expect(session.page.getByTestId("item-rotation-draft")).toHaveCount(0);
	await expect(
		session.page.getByRole("button", { name: "Подтвердить поворот предмета" }),
	).toHaveCount(0);
	await expect(
		session.page.getByTestId("item-placement-action-dock"),
	).toHaveCount(0);
	await expect
		.poll(() => durableRevisionCount(session.page))
		.toBe(revisionsBeforeRotation + 1);
	await session.page.getByRole("button", { name: "Рука и выбор" }).click();
	await expect(session.page.getByTestId("selected-item-inspector")).toHaveCount(
		0,
	);
	await triggerEditorHistoryAction(session.page, "undo");
	await expect
		.poll(() => rotationDegrees(session.page))
		.toBe(rotationBeforeDrag);
	await session.page
		.getByRole("button", { name: /^Повторить действие/ })
		.click();
	await expect
		.poll(() => rotationDegrees(session.page))
		.toBe(rotationAfterDrag);
	await session.page.reload();
	await openProjectFromHub(session.page, "Поворот мебели");
	await expect
		.poll(async () => {
			const degrees = await rotationDegrees(session.page);
			return Math.abs(degrees ?? 0);
		})
		.toBeGreaterThan(45);
	const rotationAfterReload = await rotationDegrees(session.page);
	expect(
		Math.abs(rotationAfterReload ?? 0) / 45 -
			Math.round(Math.abs(rotationAfterReload ?? 0) / 45),
	).toBeLessThan(0.001);
	await session.context.close();
});

test("EDITOR-E2E-04C: Escape restores item numeric drafts while removed wall thickness editing remains absent", async ({
	page: _page,
}, testInfo) => {
	const session = await openPersistentPhone(
		testInfo,
		"editor-numeric-draft-cancel",
	);
	await session.page.goto("/");
	await startNewProject(session.page, "Отмена точных правок");
	await session.page.getByRole("button", { name: "Создать контур" }).click();
	await chooseFloorPlaceholder(session.page, "Отменяемый макет");

	const plan = session.page.getByTestId("plan-canvas");
	const planBox = await plan.boundingBox();
	if (!planBox) throw new Error("Plan canvas did not render");
	await clickPlanPointMm(session.page, 2000, 1500);
	await expect(
		session.page.getByTestId("item-placement-preview"),
	).toHaveAttribute("data-placement-valid", "true");
	await session.page
		.getByRole("button", { name: "Подтвердить размещение предмета" })
		.click();
	await expect(session.page.getByTestId("item-count")).toHaveText("1 предмет");
	await chooseEditorOption(session.page, "Рука и выбор");
	await session.page.getByTestId("schematic-item").click();
	await expandSelectedItemInspector(session.page);

	const width = session.page.getByLabel("Ширина выбранного предмета, мм");
	const originalWidth = await width.inputValue();
	const revisionsBeforeItemCancel = await durableRevisionCount(session.page);
	await width.fill("1600");
	await width.press("Escape");
	await expect(width).toHaveValue(originalWidth);
	expect(await durableRevisionCount(session.page)).toBe(
		revisionsBeforeItemCancel,
	);

	await session.page
		.getByRole("button", { name: "Скрыть панель предмета", exact: true })
		.click();
	const exteriorWall = session.page
		.locator('[data-testid="wall-segment"][data-wall-kind="exterior"]')
		.first();
	await exteriorWall.click();
	await expandSelectedWallInspector(session.page);
	const beforeWallCancel = await durableRevisionCount(session.page);
	await expect(
		session.page.getByLabel("Толщина выбранной стены, мм"),
	).toHaveCount(0);
	await session.page.keyboard.press("Escape");
	expect(await durableRevisionCount(session.page)).toBe(beforeWallCancel);
	await session.context.close();
});

test("EDITOR-E2E-04D: a floor item drag saves directly when the pointer is released", async ({
	page: _page,
}, testInfo) => {
	const session = await openPersistentPhone(
		testInfo,
		"editor-floor-move-draft-cancel",
	);
	await session.page.goto("/");
	await startNewProject(session.page, "Отмена переноса предмета");
	await session.page.getByRole("button", { name: "Создать контур" }).click();
	await chooseFloorPlaceholder(session.page, "Переносимый макет");

	const plan = session.page.getByTestId("plan-canvas");
	const planBox = await plan.boundingBox();
	if (!planBox) throw new Error("Plan canvas did not render");
	await clickPlanPointMm(session.page, 2000, 1500);
	await session.page
		.getByRole("button", { name: "Подтвердить размещение предмета" })
		.click();
	await chooseEditorOption(session.page, "Рука и выбор");
	const item = session.page.getByTestId("schematic-item");
	const itemBox = await item.boundingBox();
	if (!itemBox) throw new Error("Floor item did not render");
	const durableBeforeDrag = await durableFloorItems(session.page);
	const revisionsBeforeDrag = await durableRevisionCount(session.page);

	await session.page.mouse.move(
		itemBox.x + itemBox.width / 2,
		itemBox.y + itemBox.height / 2,
	);
	await session.page.mouse.down();
	const validMoveTarget = await planPointMm(session.page, {
		xMm: 2600,
		zMm: 1500,
	});
	await session.page.mouse.move(validMoveTarget.x, validMoveTarget.y, {
		steps: 5,
	});
	await session.page.mouse.up();

	await expect(session.page.getByTestId("item-move-draft")).toHaveCount(0);
	await expect(
		session.page.getByRole("button", { name: "Подтвердить перенос предмета" }),
	).toHaveCount(0);
	await expect(
		session.page.getByTestId("item-placement-action-dock"),
	).toHaveCount(0);
	await expect
		.poll(() => durableRevisionCount(session.page))
		.toBe(revisionsBeforeDrag + 1);
	await expect
		.poll(() => durableFloorItems(session.page))
		.not.toEqual(durableBeforeDrag);
	await session.page.getByRole("button", { name: "Рука и выбор" }).click();
	await expect(session.page.getByTestId("selected-item-inspector")).toHaveCount(
		0,
	);
	await triggerEditorHistoryAction(session.page, "undo");
	await expect
		.poll(() => durableFloorItems(session.page))
		.toEqual(durableBeforeDrag);
	await session.context.close();
});

test("PLAN-E2E-04B: a selected wall creates a Door only after the explicit New Opening draft is added", async ({
	page: _page,
}, testInfo) => {
	const session = await openPersistentPhone(testInfo, "editor-new-doorway");
	await session.page.goto("/");
	await startNewProject(session.page, "Дверной проём");
	await session.page.getByRole("button", { name: "Создать контур" }).click();
	const exteriorWall = session.page
		.locator('[data-testid="wall-segment"][data-wall-kind="exterior"]')
		.first();
	await expect(
		session.page.getByRole("button", {
			name: "Добавить проём",
			exact: true,
		}),
	).toHaveCount(0);
	await exteriorWall.click();
	const addOpening = session.page.getByRole("button", {
		name: "Добавить проём",
		exact: true,
	});
	await expect(addOpening).toBeEnabled();
	const revisionsBeforeDraft = await durableRevisionCount(session.page);
	await addOpening.click();
	const draft = session.page.getByTestId("opening-creation-draft");
	await expect(
		session.page.getByRole("dialog", { name: "Новый проём" }),
	).toBeVisible();
	await expect(session.page.getByTestId("plan-canvas")).toHaveAttribute(
		"data-interaction-locked",
		"true",
	);
	await expect(
		session.page.locator(
			'[data-testid="editor-view-switch"] button[aria-label="План 2D"]',
		),
	).toBeDisabled();
	await expect(
		session.page.getByTestId("selected-wall-inspector"),
	).toBeHidden();
	await expect(
		draft.getByRole("button", { name: "Дверь", exact: true }),
	).toHaveAttribute("aria-pressed", "true");
	await expect(
		draft.getByRole("button", { name: "Окно", exact: true }),
	).toBeVisible();
	await expect(draft.getByLabel("Ширина, мм")).toBeVisible();
	await expect(draft.getByLabel("Высота, мм")).toBeVisible();
	await expect(draft.getByLabel("Отступ от начала, мм")).toHaveCount(0);
	await expect(draft.getByLabel("Порог / нижняя отметка, мм")).toHaveCount(0);
	await expect(draft.getByRole("button", { name: /Открывание/ })).toHaveCount(
		0,
	);
	await expect(session.page.getByTestId("door-opening")).toHaveCount(0);
	expect(await durableRevisionCount(session.page)).toBe(revisionsBeforeDraft);

	await draft.getByLabel("Ширина, мм").fill("10000");
	await expect(draft.getByRole("alert")).toContainText(
		"Ширина больше свободного участка стены",
	);
	await expect(
		draft.getByRole("button", { name: "Добавить", exact: true }),
	).toBeDisabled();
	await draft.getByRole("button", { name: "Отмена", exact: true }).click();
	await expect(draft).toHaveCount(0);
	await expect(session.page.getByTestId("door-opening")).toHaveCount(0);
	expect(await durableRevisionCount(session.page)).toBe(revisionsBeforeDraft);

	await addOpening.click();
	await draft.getByLabel("Ширина, мм").fill("900");
	await draft.getByLabel("Высота, мм").fill("2100");
	await expect(draft.getByLabel("Отступ от начала, мм")).toHaveCount(0);
	await expect(draft.getByLabel("Порог / нижняя отметка, мм")).toHaveCount(0);
	await draft.getByRole("button", { name: "Добавить", exact: true }).click();
	await expect(session.page.getByTestId("door-opening")).toHaveCount(1);
	await expect
		.poll(() => durableRevisionCount(session.page))
		.toBe(revisionsBeforeDraft + 1);
	await expect
		.poll(() => durableDoorOpenings(session.page))
		.toEqual([
			expect.objectContaining({
				heightMm: 2100,
				offsetMm: 2000,
				sillMm: 0,
				widthMm: 900,
			}),
		]);
	await expect(session.page.getByTestId("door-leaf")).toHaveCount(0);
	await expect(session.page.getByTestId("door-swing")).toHaveCount(0);
	await expect(addOpening).toBeFocused();
	await session.context.close();
});

test("PLAN-E2E-04AC: New Opening traps focus, blocks the background, and restores its initiator", async ({
	page: _page,
}, testInfo) => {
	const session = await openPersistentPhone(
		testInfo,
		"editor-new-opening-modal-focus",
		{ freshProfile: true },
	);
	await session.page.goto("/");
	await startNewProject(session.page, "Модальный проём");
	await session.page.getByRole("button", { name: "Создать контур" }).click();
	await session.page.getByTestId("wall-segment").first().click();
	const addOpening = session.page.getByRole("button", {
		name: "Добавить проём",
		exact: true,
	});
	const rename = session.page.getByRole("button", {
		name: "Переименовать проект Модальный проём",
	});
	const renameBox = await rename.boundingBox();
	if (!renameBox)
		throw new Error("Expected the project header behind the draft");
	const modalBackgroundsAreInert = () =>
		session.page.locator("#editor-canvas").evaluate((canvas) =>
			Array.from(canvas.children)
				.filter(
					(child) =>
						child.getAttribute("data-testid") !== "opening-creation-draft",
				)
				.every(
					(child) =>
						child.hasAttribute("inert") &&
						child.getAttribute("aria-hidden") === "true",
				),
		);
	const revisionsBeforeDraft = await durableRevisionCount(session.page);
	await addOpening.focus();
	await addOpening.click();

	const draft = session.page.getByRole("dialog", { name: "Новый проём" });
	const door = draft.getByRole("button", { name: "Дверь", exact: true });
	const add = draft.getByRole("button", { name: "Добавить", exact: true });
	await expect(draft.getByLabel("Ширина, мм")).toBeFocused();
	await expect.poll(modalBackgroundsAreInert).toBe(true);
	await draft.getByLabel("Ширина, мм").fill("950");
	await expect.poll(modalBackgroundsAreInert).toBe(true);
	await add.focus();
	await session.page.keyboard.press("Tab");
	await expect(door).toBeFocused();
	await door.focus();
	await session.page.keyboard.press("Shift+Tab");
	await expect(add).toBeFocused();

	await session.page.mouse.click(
		renameBox.x + renameBox.width / 2,
		renameBox.y + renameBox.height / 2,
	);
	await expect(draft).toBeVisible();
	await expect(session.page.getByTestId("rename-project-sheet")).toHaveCount(0);
	expect(await durableRevisionCount(session.page)).toBe(revisionsBeforeDraft);

	await session.page.keyboard.press("Escape");
	await expect(draft).toHaveCount(0);
	await expect.poll(modalBackgroundsAreInert).toBe(false);
	await expect(addOpening).toBeFocused();
	expect(await durableRevisionCount(session.page)).toBe(revisionsBeforeDraft);

	await addOpening.click();
	const reopenedDraft = session.page.getByRole("dialog", {
		name: "Новый проём",
	});
	await reopenedDraft
		.getByRole("button", { name: "Добавить", exact: true })
		.click();
	await expect(reopenedDraft).toHaveCount(0);
	await expect(addOpening).toBeFocused();
	await expect
		.poll(() => durableRevisionCount(session.page))
		.toBe(revisionsBeforeDraft + 1);
	await session.context.close();
});

test("PLAN-E2E-04J: the removed wall-split route remains absent when visible Undo changes the current revision", async ({
	page: _page,
}, testInfo) => {
	const session = await openPersistentPhone(
		testInfo,
		"editor-wall-split-stale-base",
	);
	await session.page.goto("/");
	await startNewProject(session.page, "Устаревший разрез");
	await session.page.getByRole("button", { name: "Создать контур" }).click();
	await chooseEditorOption(session.page, "Рука и выбор");
	const exteriorWall = session.page
		.locator('[data-testid="wall-segment"][data-wall-kind="exterior"]')
		.first();
	await exteriorWall.click();
	await expandSelectedWallInspector(session.page);
	await expect(
		session.page.getByRole("button", { name: "Разделить стену жестом" }),
	).toHaveCount(0);
	const splitDraft = session.page.getByTestId("wall-split-draft");
	await expect(splitDraft).toHaveCount(0);
	const revisionBeforeUndo = (await durableResourceManifests(session.page))
		.currentRevisionId;
	await triggerEditorHistoryAction(session.page, "undo");
	await expect
		.poll(
			async () =>
				(await durableResourceManifests(session.page)).currentRevisionId,
		)
		.not.toBe(revisionBeforeUndo);
	await expect(splitDraft).toHaveCount(0);
	await session.context.close();
});

test("PLAN-E2E-04Z: reopening a legacy wall split away from a Door keeps one durable wall host", async ({
	page: _page,
}, testInfo) => {
	const session = await openPersistentPhone(
		testInfo,
		"editor-doorway-wall-split",
	);
	await session.page.goto("/");
	await startNewProject(session.page, "Разделить стену с дверью");
	await session.page.getByRole("button", { name: "Создать контур" }).click();
	await chooseEditorOption(session.page, "Рука и выбор");
	const hostWall = session.page
		.locator('[data-testid="wall-segment"][data-wall-kind="exterior"]')
		.first();
	await hostWall.click();
	await loadOpeningFixtureOnSelectedWall(session.page, {
		heightMm: 2100,
		kind: "Door",
		offsetMm: 2000,
		sillMm: 0,
		widthMm: 900,
	});
	await expect(session.page.getByTestId("door-opening")).toHaveCount(1);
	await expandSelectedWallInspector(session.page);
	const revisionsBeforeSplit = await durableRevisionCount(session.page);
	await loadLegacySplitWallFixture(session.page, 0.15);
	await expect(session.page.getByTestId("wall-segment")).toHaveCount(5);
	await expect(session.page.getByTestId("door-opening")).toHaveCount(1);
	expect(await durableRevisionCount(session.page)).toBe(
		revisionsBeforeSplit + 1,
	);
	await session.page.reload();
	await openProjectFromHub(session.page, "Разделить стену с дверью");
	await expect(session.page.getByTestId("wall-segment")).toHaveCount(5);
	await expect(session.page.getByTestId("door-opening")).toHaveCount(1);
	await chooseEditorOption(session.page, "3D");
	await expect(
		session.page.getByTestId("three-dimensional-canvas"),
	).toBeVisible();
	await session.context.close();
});

test("PLAN-E2E-04AA: the removed wall-split route cannot remove a Door", async ({
	page: _page,
}, testInfo) => {
	const session = await openPersistentPhone(
		testInfo,
		"editor-doorway-wall-split-conflict",
	);
	await session.page.goto("/");
	await startNewProject(session.page, "Разрез через дверной проём");
	await session.page.getByRole("button", { name: "Создать контур" }).click();
	await chooseEditorOption(session.page, "Рука и выбор");
	const hostWall = session.page
		.locator('[data-testid="wall-segment"][data-wall-kind="exterior"]')
		.first();
	await hostWall.click();
	await loadOpeningFixtureOnSelectedWall(session.page, {
		heightMm: 2100,
		kind: "Door",
		offsetMm: 2000,
		sillMm: 0,
		widthMm: 900,
	});
	await expect(session.page.getByTestId("door-opening")).toHaveCount(1);
	await expandSelectedWallInspector(session.page);
	const revisionBeforeSplit = await durableRevisionCount(session.page);
	const doorsBeforeTouch = await durableDoorOpenings(session.page);
	await expect(
		session.page.getByRole("button", { name: "Разделить стену жестом" }),
	).toHaveCount(0);
	await chooseEditorOption(session.page, "Рука и выбор");
	await clickWallOutsideOpeningHandle(hostWall);
	await expect(session.page.getByTestId("wall-split-draft")).toHaveCount(0);
	await expect(
		session.page.getByTestId("wall-split-host-conflict"),
	).toHaveCount(0);
	await expect(session.page.getByTestId("wall-segment")).toHaveCount(4);
	expect(await durableDoorOpenings(session.page)).toEqual(doorsBeforeTouch);
	expect(await durableRevisionCount(session.page)).toBe(revisionBeforeSplit);
	await session.page.reload();
	await openProjectFromHub(session.page, "Разрез через дверной проём");
	expect(await durableDoorOpenings(session.page)).toEqual(doorsBeforeTouch);

	await session.context.close();
});

test("PLAN-E2E-04D: the New Opening sheet changes to Window before its single explicit publish", async ({
	page: _page,
}, testInfo) => {
	const session = await openPersistentPhone(testInfo, "editor-new-window");
	await session.page.goto("/");
	await startNewProject(session.page, "Окно");
	await session.page.getByRole("button", { name: "Создать контур" }).click();
	const exteriorWall = session.page
		.locator('[data-testid="wall-segment"][data-wall-kind="exterior"]')
		.first();
	await exteriorWall.click();
	const revisionsBeforeDraft = await durableRevisionCount(session.page);
	await session.page
		.getByRole("button", { name: "Добавить проём", exact: true })
		.click();
	const draft = session.page.getByTestId("opening-creation-draft");
	await draft.getByRole("button", { name: "Окно", exact: true }).click();
	await expect(
		session.page.getByRole("dialog", { name: "Новое окно", exact: true }),
	).toBeVisible();
	await expect(
		session.page.getByRole("dialog", { name: "Новый проём", exact: true }),
	).toHaveCount(0);
	await expect(
		session.page.getByTestId("selected-wall-inspector"),
	).toBeHidden();
	await expect(
		draft.getByRole("button", { name: "Окно", exact: true }),
	).toHaveAttribute("aria-pressed", "true");
	await expect(draft.getByLabel("Порог / нижняя отметка, мм")).toHaveCount(0);
	await expect(draft.getByLabel("Высота подоконника, мм")).toHaveCount(0);
	await expect(draft.getByLabel("Отступ от начала, мм")).toHaveCount(0);
	await expect(session.page.getByTestId("window-opening")).toHaveCount(0);
	expect(await durableRevisionCount(session.page)).toBe(revisionsBeforeDraft);

	await draft.getByLabel("Ширина, мм").fill("1300");
	await draft.getByLabel("Высота, мм").fill("1100");
	await expect(draft.getByLabel("Отступ от начала, мм")).toHaveCount(0);
	await draft.getByRole("button", { name: "Добавить", exact: true }).click();
	await expect(session.page.getByTestId("window-opening")).toHaveCount(1);
	await expect(session.page.getByTestId("plan-canvas")).toHaveAttribute(
		"data-active-tool",
		"select",
	);
	await expect
		.poll(() => durableRevisionCount(session.page))
		.toBe(revisionsBeforeDraft + 1);
	await expect
		.poll(() => durableWindowOpenings(session.page))
		.toEqual([{ heightMm: 1100, offsetMm: 2000, sillMm: 900, widthMm: 1300 }]);
	await expect(session.page.getByTestId("door-leaf")).toHaveCount(0);
	await expect(session.page.getByTestId("door-swing")).toHaveCount(0);
	await session.context.close();
});

test("PLAN-E2E-04F: editing a legacy window size preserves its exact offset and existing non-default sill without a sill field", async ({
	page: _page,
}, testInfo) => {
	const session = await openPersistentPhone(
		testInfo,
		"editor-window-edit-draft",
	);
	await session.page.goto("/");
	await startNewProject(session.page, "Правка окна");
	await session.page.getByRole("button", { name: "Создать контур" }).click();
	const exteriorWall = session.page
		.locator('[data-testid="wall-segment"][data-wall-kind="exterior"]')
		.first();
	await clickWallOutsideOpeningHandle(exteriorWall);
	await loadOpeningFixtureOnSelectedWall(session.page, {
		heightMm: 1200,
		kind: "Window",
		offsetMm: 2050,
		sillMm: 800,
		widthMm: 1200,
	});
	await expect(session.page.getByTestId("window-opening")).toHaveCount(1);
	await expandSelectedWallInspector(session.page);
	const revisionsBeforeEdit = await durableRevisionCount(session.page);

	await session.page
		.getByRole("button", { name: "Изменить окно", exact: true })
		.click();
	const draft = session.page.getByTestId("opening-draft");
	await expect(draft).toBeVisible();
	await draft.getByLabel("Высота окна, мм").fill("1100");
	await draft.getByRole("button", { name: "Отмена", exact: true }).click();
	await expect(draft).toHaveCount(0);
	expect(await durableRevisionCount(session.page)).toBe(revisionsBeforeEdit);

	const windowContext = session.page.getByRole("complementary", {
		name: "Выбранное окно",
	});
	await expect(windowContext).toBeVisible();
	await expect(
		session.page.getByTestId("selected-wall-inspector"),
	).toBeHidden();
	await windowContext
		.getByRole("button", { name: "Параметры", exact: true })
		.click();
	await draft.getByLabel("Ширина окна, мм").fill("1300");
	await draft.getByLabel("Высота окна, мм").fill("1100");
	await expect(draft.getByLabel("Высота подоконника окна, мм")).toHaveCount(0);
	await expect(
		draft.getByLabel("Смещение окна от начала стены, мм"),
	).toHaveCount(0);
	await draft
		.getByRole("button", { name: "Сохранить окно", exact: true })
		.click();
	await expect(draft).toHaveCount(0);
	await expect
		.poll(() => durableRevisionCount(session.page))
		.toBe(revisionsBeforeEdit + 1);
	await expect
		.poll(() => durableWindowOpenings(session.page))
		.toEqual([{ heightMm: 1100, offsetMm: 2050, sillMm: 800, widthMm: 1300 }]);
	await session.page.reload();
	await openProjectFromHub(session.page, "Правка окна");
	await expect(session.page.getByTestId("window-opening")).toHaveCount(1);
	await session.context.close();
});

test("RECONCILIATION-E2E-01: deleting a doorway host requires an explicit atomic conflict outcome", async ({
	page: _page,
}, testInfo) => {
	const session = await openPersistentPhone(
		testInfo,
		"editor-doorway-host-delete",
	);
	await session.page.goto("/");
	await startNewProject(session.page, "Сохранность дверного проёма");
	await session.page.getByRole("button", { name: "Создать контур" }).click();
	const hostWall = session.page
		.locator('[data-testid="wall-segment"][data-wall-kind="exterior"]')
		.first();
	await hostWall.click();
	await loadOpeningFixtureOnSelectedWall(session.page, {
		heightMm: 2100,
		kind: "Door",
		offsetMm: 2000,
		sillMm: 0,
		widthMm: 900,
	});
	await expect(session.page.getByTestId("door-opening")).toHaveCount(1);
	const openingId = await session.page
		.getByTestId("door-opening")
		.getAttribute("data-opening-id");
	const affectedRoomId = await session.page
		.getByTestId("room-face")
		.getAttribute("data-room-id");
	if (!openingId || !affectedRoomId) {
		throw new Error(
			"Expected exact Opening and Room identities before deletion",
		);
	}
	await expandSelectedWallInspector(session.page);
	const revisionsBeforeDeletion = await durableRevisionCount(session.page);

	await session.page
		.getByRole("button", { name: "Удалить стену", exact: true })
		.click();

	const conflict = session.page.getByTestId("opening-conflict-preview");
	await expect(conflict).toContainText("1 проём");
	await expect(conflict.getByText(openingId, { exact: true })).toBeVisible();
	await expect(
		conflict.getByText(affectedRoomId, { exact: true }),
	).toBeVisible();
	await expect(session.page.getByTestId("wall-segment")).toHaveCount(4);
	await expect(session.page.getByTestId("door-opening")).toHaveCount(1);
	expect(await durableRevisionCount(session.page)).toBe(
		revisionsBeforeDeletion,
	);
	await conflict.getByRole("button", { name: "Отмена", exact: true }).click();
	await expect(conflict).toHaveCount(0);
	await expect(session.page.getByTestId("wall-segment")).toHaveCount(4);
	await expect(session.page.getByTestId("door-opening")).toHaveCount(1);
	expect(await durableRevisionCount(session.page)).toBe(
		revisionsBeforeDeletion,
	);

	await session.page
		.getByRole("button", { name: "Удалить стену", exact: true })
		.click();
	await conflict
		.getByRole("button", {
			name: "Удалить стену и 1 проём и изменить 1 помещение",
			exact: true,
		})
		.click();
	await expect(conflict).toHaveCount(0);
	await expect(session.page.getByTestId("wall-segment")).toHaveCount(3);
	await expect(session.page.getByTestId("door-opening")).toHaveCount(0);
	await expect
		.poll(() => durableRevisionCount(session.page))
		.toBe(revisionsBeforeDeletion + 1);
	await session.context.close();
});

test("PLAN-E2E-04G: deleting a wall previews an orphaned floor item and removes it only in the confirmed atomic outcome", async ({
	page: _page,
}, testInfo) => {
	const session = await openPersistentPhone(
		testInfo,
		"editor-wall-item-delete",
	);
	await session.page.goto("/");
	await startNewProject(session.page, "Последствия для предмета");
	await session.page.getByRole("button", { name: "Создать контур" }).click();
	await chooseBuiltInGreybox(session.page, "Стол");
	const plan = session.page.getByTestId("plan-canvas");
	const planBox = await plan.boundingBox();
	if (!planBox) throw new Error("Plan canvas did not render");
	await clickPlanPointMm(session.page, 2000, 1500);
	await expect(session.page.getByTestId("item-count")).toHaveText("1 предмет");
	const revisionsBeforeDeletion = await durableRevisionCount(session.page);

	await chooseEditorOption(session.page, "Рука и выбор");
	const exteriorWall = session.page
		.locator('[data-testid="wall-segment"][data-wall-kind="exterior"]')
		.first();
	await exteriorWall.click();
	await expandSelectedWallInspector(session.page);
	await session.page
		.getByRole("button", { name: "Удалить стену", exact: true })
		.click();

	const conflict = session.page.getByTestId("opening-conflict-preview");
	await expect(conflict).toContainText("1 предмет");
	expect(await durableRevisionCount(session.page)).toBe(
		revisionsBeforeDeletion,
	);
	await conflict.getByRole("button", { name: "Отмена", exact: true }).click();
	await expect(conflict).toHaveCount(0);
	await expect(session.page.getByTestId("item-count")).toHaveText("1 предмет");
	expect(await durableRevisionCount(session.page)).toBe(
		revisionsBeforeDeletion,
	);

	await session.page
		.getByRole("button", { name: "Удалить стену", exact: true })
		.click();
	await conflict
		.getByRole("button", {
			name: "Удалить стену и 1 предмет и изменить 1 помещение",
			exact: true,
		})
		.click();
	await expect(conflict).toHaveCount(0);
	await expect(session.page.getByTestId("item-count")).toHaveText(
		"0 предметов",
	);
	await expect(session.page.getByTestId("wall-segment")).toHaveCount(3);
	await expect
		.poll(() => durableRevisionCount(session.page))
		.toBe(revisionsBeforeDeletion + 1);
	await session.context.close();
});

test("PLAN-E2E-05: a wall-created room split persists after reload", async ({
	page: _page,
}, testInfo) => {
	const session = await openPersistentPhone(testInfo, "editor-wall-room-split");
	await session.page.goto("/");
	await startNewProject(session.page, "Две комнаты");
	await session.page.getByRole("button", { name: "Создать контур" }).click();

	await chooseEditorOption(session.page, "Стена");
	await drawCentreDivider(session.page);
	await expect(session.page.getByTestId("room-count")).toHaveText("2 комнаты");
	await expect(session.page.getByTestId("wall-count")).toHaveText("7 стен");
	await expect(session.page.getByTestId("room-face")).toHaveCount(2);
	await session.page.reload();
	await openProjectFromHub(session.page, "Две комнаты");
	await expect(session.page.getByTestId("room-count")).toHaveText("2 комнаты");
	await expect(session.page.getByTestId("wall-count")).toHaveText("7 стен");
	await session.context.close();
});

test("PLAN-E2E-05A: a wall draw through a placed item is rejected without changing the durable plan", async ({
	page: _page,
}, testInfo) => {
	const session = await openPersistentPhone(
		testInfo,
		"editor-wall-item-collision",
	);
	await session.page.goto("/");
	await startNewProject(session.page, "Стена и стол");
	await session.page.getByRole("button", { name: "Создать контур" }).click();
	await chooseBuiltInGreybox(session.page, "Стол");
	const plan = session.page.getByTestId("plan-canvas");
	const planBox = await plan.boundingBox();
	if (!planBox) {
		throw new Error("Plan canvas did not render");
	}
	await clickPlanPointMm(session.page, 2000, 1500);
	await expect
		.poll(() => durableRevisionCount(session.page))
		.toBeGreaterThan(2);
	const revisionsBeforeWall = await durableRevisionCount(session.page);

	await chooseEditorOption(session.page, "Стена");
	await drawCentreDivider(session.page);

	const collisionAlert = session.page.getByRole("alert");
	await expect(collisionAlert).toContainText(
		"Стена не может пересекать предмет «Деревянный комод».",
	);
	await expect(collisionAlert).toContainText(
		"Откройте предмет, чтобы переместить его, или проведите стену иначе.",
	);
	await expect(session.page.getByTestId("wall-count")).toHaveText("4 стены");
	expect(await durableRevisionCount(session.page)).toBe(revisionsBeforeWall);
	const openCorrection = collisionAlert.getByRole("button", {
		name: "Открыть предмет для исправления",
	});
	await expect(openCorrection).toBeFocused();
	await openCorrection.click();
	await expect(
		session.page.getByLabel("Свойства выбранного предмета"),
	).toContainText("Деревянный комод");
	const moveLeft = session.page.getByRole("button", {
		name: "Сместить предмет на 100 мм влево",
	});
	await expect(moveLeft).toBeVisible();
	const revisionsBeforeCorrection = await durableRevisionCount(session.page);
	await moveLeft.click();
	await expect
		.poll(() => durableRevisionCount(session.page))
		.toBe(revisionsBeforeCorrection + 1);
	await session.context.close();
});

test("PLAN-E2E-05D: moving a legacy thick wall through a Door names the Opening and focuses its size correction", async ({
	page: _page,
}, testInfo) => {
	const session = await openPersistentPhone(
		testInfo,
		"editor-wall-door-opening-correction",
	);
	await session.page.goto("/");
	await startNewProject(session.page, "Стена через дверной проём");
	await session.page.getByRole("button", { name: "Создать контур" }).click();
	const hostWall = session.page
		.locator('[data-testid="wall-segment"][data-wall-kind="exterior"]')
		.first();
	await hostWall.click();
	await loadOpeningFixtureOnSelectedWall(session.page, {
		heightMm: 2100,
		kind: "Door",
		offsetMm: 2000,
		sillMm: 0,
		widthMm: 900,
	});
	const door = session.page.getByTestId("door-opening");
	await expect(door).toHaveCount(1);
	const plan = session.page.getByTestId("plan-canvas");
	const [planBox, hostWallBox] = await Promise.all([
		plan.boundingBox(),
		hostWall.boundingBox(),
	]);
	if (!planBox || !hostWallBox) {
		throw new Error("Door correction fixture did not render");
	}
	const horizontalDoor = hostWallBox.width >= hostWallBox.height;
	const hostAxis = horizontalDoor
		? hostWallBox.y + hostWallBox.height / 2
		: hostWallBox.x + hostWallBox.width / 2;
	const planAxis = horizontalDoor
		? planBox.y + planBox.height / 2
		: planBox.x + planBox.width / 2;
	const nearHost = hostAxis + (Math.sign(planAxis - hostAxis) || 1) * 24;
	const start = horizontalDoor
		? { x: planBox.x + planBox.width * 0.3, y: nearHost }
		: { x: nearHost, y: planBox.y + planBox.height * 0.3 };
	const end = horizontalDoor
		? { x: planBox.x + planBox.width * 0.7, y: nearHost }
		: { x: nearHost, y: planBox.y + planBox.height * 0.7 };
	await session.page
		.getByRole("button", { name: "Рука и выбор", exact: true })
		.click();
	await chooseEditorOption(session.page, "Стена");
	await session.page.mouse.move(start.x, start.y);
	await session.page.mouse.down();
	await session.page.mouse.move(end.x, end.y, { steps: 8 });
	await session.page.mouse.up();
	const freeWall = session.page.locator(
		'[data-testid="wall-segment"][data-wall-kind="interior"]',
	);
	await expect(freeWall).toHaveCount(1);
	await chooseEditorOption(session.page, "Рука и выбор");
	await freeWall.click();
	await expandSelectedWallInspector(session.page);
	const movingWallId = await freeWall.getAttribute("data-wall-id");
	const hostWallId = await hostWall.getAttribute("data-wall-id");
	if (!movingWallId || !hostWallId)
		throw new Error("Expected stable collision fixture wall ids");
	await loadLegacyProjectFixture(
		session.page,
		(source) => {
			const result = changeGeneralWallThickness(
				source,
				{ wallSegmentId: movingWallId, thicknessMm: 201 },
				new Date().toISOString(),
			);
			if (result.kind !== "accepted")
				throw new Error("Legacy free wall thickness rejected");
			return result.project;
		},
		movingWallId,
	);
	const [
		movingBox,
		refreshedHostBox,
		refreshedPlanBox,
		hostVertices,
		hostSegment,
	] = await Promise.all([
		freeWall.boundingBox(),
		hostWall.boundingBox(),
		plan.boundingBox(),
		durablePlanVertices(session.page),
		durableWallSegment(session.page, hostWallId),
	]);
	if (!movingBox || !refreshedHostBox || !refreshedPlanBox || !hostSegment)
		throw new Error("Expected a visible legacy wall and doorway host");
	const hostStart = hostVertices.find(
		(vertex) => vertex.vertexId === hostSegment.startVertexId,
	);
	const hostEnd = hostVertices.find(
		(vertex) => vertex.vertexId === hostSegment.endVertexId,
	);
	if (!hostStart || !hostEnd) throw new Error("Expected host endpoints");
	const hostLine = session.page.locator(
		`[data-testid="wall-line"][data-wall-id="${hostWallId}"]`,
	);
	const scale = await hostLine.evaluate(
		(element, lengthMm) => {
			const line = element as SVGLineElement;
			const matrix = line.getScreenCTM();
			if (!matrix) throw new Error("Expected projected host transform");
			const first = new DOMPoint(
				line.x1.baseVal.value,
				line.y1.baseVal.value,
			).matrixTransform(matrix);
			const second = new DOMPoint(
				line.x2.baseVal.value,
				line.y2.baseVal.value,
			).matrixTransform(matrix);
			return Math.hypot(second.x - first.x, second.y - first.y) / lengthMm;
		},
		Math.hypot(hostEnd.xMm - hostStart.xMm, hostEnd.zMm - hostStart.zMm),
	);
	const horizontal = refreshedHostBox.width >= refreshedHostBox.height;
	const axis = horizontal
		? refreshedHostBox.y + refreshedHostBox.height / 2
		: refreshedHostBox.x + refreshedHostBox.width / 2;
	const inside = horizontal
		? refreshedPlanBox.y + refreshedPlanBox.height / 2
		: refreshedPlanBox.x + refreshedPlanBox.width / 2;
	const from = {
		x: movingBox.x + movingBox.width / 2,
		y: movingBox.y + movingBox.height / 2,
	};
	const to = horizontal
		? { x: from.x, y: axis + (Math.sign(inside - axis) || 1) * 100 * scale }
		: { x: axis + (Math.sign(inside - axis) || 1) * 100 * scale, y: from.y };
	const revisionsBeforeRejectedWall = await durableRevisionCount(session.page);
	await session.page
		.getByRole("button", { name: "Переместить стену жестом" })
		.click();
	await dragWall(session.page, from, to);
	const moveDraft = session.page.getByTestId("wall-move-draft");
	await expect(moveDraft).toBeVisible();
	await moveDraft
		.getByRole("button", { name: "Подтвердить перенос", exact: true })
		.click();

	const collisionAlert = session.page.getByRole("alert");
	await expect(collisionAlert).toContainText(
		"Стена пересекает Дверной проём № 1",
	);
	await expect(collisionAlert).toContainText(
		"Откройте проём, чтобы изменить его, или проведите стену иначе.",
	);
	expect(await durableRevisionCount(session.page)).toBe(
		revisionsBeforeRejectedWall,
	);
	const openCorrection = collisionAlert.getByRole("button", {
		name: "Открыть дверной проём для исправления",
	});
	await expect(openCorrection).toBeFocused();
	await openCorrection.click();
	const openingDraft = session.page.getByTestId("opening-draft");
	const widthInput = openingDraft.getByLabel("Ширина дверного проёма, мм");
	await expect(widthInput).toBeFocused();
	await expect(widthInput).toHaveValue("900");
	expect(await durableRevisionCount(session.page)).toBe(
		revisionsBeforeRejectedWall,
	);
	await session.context.close();
});

test("PLAN-E2E-05B: moving a detached wall through a placed item offers an accessible correction without publishing", async ({
	page: _page,
}, testInfo) => {
	const session = await openPersistentPhone(
		testInfo,
		"editor-moved-wall-item-collision",
	);
	await session.page.goto("/");
	await startNewProject(session.page, "Перенос стены и комод");
	await session.page.getByRole("button", { name: "Создать контур" }).click();
	await chooseBuiltInGreybox(session.page, "Стол");
	const plan = session.page.getByTestId("plan-canvas");
	const planBox = await plan.boundingBox();
	if (!planBox) throw new Error("Plan canvas did not render");
	const placedItem = session.page.locator("[data-item-id]");
	await clickPlanPointMm(session.page, 2000, 1500);
	await expect
		.poll(() => durableRevisionCount(session.page))
		.toBeGreaterThan(2);
	const placedItemBox = await placedItem.boundingBox();
	if (!placedItemBox) throw new Error("Placed item did not render");

	await chooseEditorOption(session.page, "Стена");
	await drawCreationWallWithMouse(
		session.page,
		await planPointMm(session.page, { xMm: 700, zMm: 900 }),
		await planPointMm(session.page, { xMm: 700, zMm: 2100 }),
	);

	await chooseEditorOption(session.page, "Рука и выбор");
	const freeWall = session.page.locator(
		'[data-testid="wall-segment"][data-wall-kind="interior"]',
	);
	await expect(freeWall).toHaveCount(1);
	await freeWall.click();
	await expandSelectedWallInspector(session.page);
	const revisionsBeforeMove = await durableRevisionCount(session.page);
	await session.page
		.getByRole("button", { name: "Переместить стену жестом" })
		.click();
	const freeWallBox = await freeWall.boundingBox();
	if (!freeWallBox) throw new Error("Detached wall did not render");
	const wallCentre = {
		x: freeWallBox.x + freeWallBox.width / 2,
		y: freeWallBox.y + freeWallBox.height / 2,
	};
	await session.page.mouse.move(wallCentre.x, wallCentre.y);
	await session.page.mouse.down();
	await session.page.mouse.move(
		placedItemBox.x + placedItemBox.width / 2,
		wallCentre.y,
		{ steps: 6 },
	);
	await session.page.mouse.up();
	const candidate = session.page.getByTestId("wall-move-draft");
	await expect(candidate).toBeVisible();
	await candidate.getByRole("button", { name: "Подтвердить перенос" }).click();

	const collisionAlert = session.page.getByRole("alert");
	await expect(collisionAlert).toContainText(
		"Стена не может пересекать предмет «Деревянный комод».",
	);
	await expect(
		collisionAlert.getByRole("button", {
			name: "Открыть предмет для исправления",
		}),
	).toBeFocused();
	await expect(candidate).toBeVisible();
	expect(await durableRevisionCount(session.page)).toBe(revisionsBeforeMove);
	await session.context.close();
});

test("PLAN-E2E-05C: moving a detached wall vertex into a placed item offers an accessible correction without publishing", async ({
	page: _page,
}, testInfo) => {
	const session = await openPersistentPhone(
		testInfo,
		"editor-moved-wall-vertex-item-collision",
	);
	await session.page.goto("/");
	await startNewProject(session.page, "Вершина стены и комод");
	await session.page.getByRole("button", { name: "Создать контур" }).click();
	await chooseBuiltInGreybox(session.page, "Стол");
	const plan = session.page.getByTestId("plan-canvas");
	const planBox = await plan.boundingBox();
	if (!planBox) throw new Error("Plan canvas did not render");
	const placedItem = session.page.locator("[data-item-id]");
	await clickPlanPointMm(session.page, 2000, 1500);
	await expect
		.poll(() => durableRevisionCount(session.page))
		.toBeGreaterThan(2);
	const placedItemBox = await placedItem.boundingBox();
	if (!placedItemBox) throw new Error("Placed item did not render");

	await chooseEditorOption(session.page, "Стена");
	await drawCreationWallWithMouse(
		session.page,
		await planPointMm(session.page, { xMm: 500, zMm: 1500 }),
		await planPointMm(session.page, { xMm: 1200, zMm: 1500 }),
	);

	await chooseEditorOption(session.page, "Рука и выбор");
	const freeWall = session.page.locator(
		'[data-testid="wall-segment"][data-wall-kind="interior"]',
	);
	await expect(freeWall).toHaveCount(1);
	await freeWall.click();
	await expandSelectedWallInspector(session.page);
	const revisionsBeforeMove = await durableRevisionCount(session.page);
	await session.page
		.getByRole("button", { name: "Переместить вершину жестом" })
		.click();
	const handle = session.page.getByTestId("wall-vertex-move-handle").last();
	const handleBox = await handle.boundingBox();
	if (!handleBox) throw new Error("Vertex move handle did not render");
	const handleCentre = {
		x: handleBox.x + handleBox.width / 2,
		y: handleBox.y + handleBox.height / 2,
	};
	await session.page.mouse.move(handleCentre.x, handleCentre.y);
	await session.page.mouse.down();
	await session.page.mouse.move(
		placedItemBox.x + placedItemBox.width / 2,
		handleCentre.y,
		{ steps: 6 },
	);
	await session.page.mouse.up();
	const candidate = session.page.getByTestId("wall-vertex-move-draft");
	await expect(candidate).toBeVisible();
	await candidate
		.getByRole("button", { name: "Подтвердить перенос вершины" })
		.click();

	const collisionAlert = session.page.getByRole("alert");
	await expect(collisionAlert).toContainText(
		"Стена не может пересекать предмет «Деревянный комод».",
	);
	await expect(
		collisionAlert.getByRole("button", {
			name: "Открыть предмет для исправления",
		}),
	).toBeFocused();
	await expect(candidate).toBeVisible();
	expect(await durableRevisionCount(session.page)).toBe(revisionsBeforeMove);
	await session.context.close();
});

test("PLAN-E2E-06: room measurements remain on-canvas while the wall tool is active", async ({
	page: _page,
}, testInfo) => {
	const session = await openPersistentPhone(
		testInfo,
		"editor-on-canvas-measurements",
	);
	await session.page.goto("/");
	await startNewProject(session.page, "Размеры на плане");
	await session.page.getByRole("button", { name: "Создать контур" }).click();

	await chooseEditorOption(session.page, "Стена");
	const measurement = session.page.getByTestId("room-measurement");
	await expect(measurement).toContainText("4000 мм × 3000 мм");
	await expect(measurement).toContainText("12,00 м²");
	expect(
		await session.page
			.getByTestId("wall-line")
			.evaluateAll((lines) =>
				lines.every((line) => line.getAttribute("stroke-dasharray") === null),
			),
	).toBe(true);
	await session.page.reload();
	await openProjectFromHub(session.page, "Размеры на плане");
	await chooseEditorOption(session.page, "Стена");
	await expect(session.page.getByTestId("room-measurement")).toContainText(
		"12,00 м²",
	);
	await session.context.close();
});

test("PLAN-E2E-07: leaving the wall tool never reveals a separate room-draft mode", async ({
	page: _page,
}, testInfo) => {
	const session = await openPersistentPhone(
		testInfo,
		"editor-dismiss-wall-draft",
	);
	await session.page.goto("/");
	await startNewProject(session.page, "Отмена черновика");
	await session.page.getByRole("button", { name: "Создать контур" }).click();
	await chooseEditorOption(session.page, "Стена");

	await chooseEditorOption(session.page, "Рука и выбор");
	await expect(session.page.getByTestId("room-draft")).toHaveCount(0);
	await expect(session.page.getByTestId("room-measurement")).toContainText(
		"12,00 м²",
	);
	await session.context.close();
});

test("ITEM-E2E-04: a fixed-size catalog item can be placed and reopened in a room derived by walls", async ({
	page: _page,
}, testInfo) => {
	const session = await openPersistentPhone(
		testInfo,
		"editor-item-in-derived-room",
	);
	await session.page.goto("/");
	await startNewProject(session.page, "Мебель во второй комнате");
	await session.page.getByRole("button", { name: "Создать контур" }).click();
	await chooseEditorOption(session.page, "Стена");
	await drawCentreDivider(session.page);
	await expect(session.page.getByTestId("room-count")).toHaveText("2 комнаты");
	const secondRoom = (await orderedRoomFaceCentres(session.page))[1];
	if (!secondRoom) {
		throw new Error("Derived second room did not render");
	}

	await chooseBuiltInGreybox(session.page, "Кровать");
	await session.page.mouse.click(secondRoom.x, secondRoom.y);
	await expect(session.page.getByTestId("item-count")).toHaveText("1 предмет");

	await chooseEditorOption(session.page, "Рука и выбор");
	await session.page.getByTestId("schematic-item").click();
	await expandSelectedItemInspector(session.page);
	const width = session.page.getByLabel("Ширина выбранного предмета, мм");
	await expect(width).toBeDisabled();
	const fixedWidthMm = await width.inputValue();
	await session.page.reload();
	await openProjectFromHub(session.page, "Мебель во второй комнате");
	await chooseEditorOption(session.page, "Рука и выбор");
	await session.page.getByTestId("schematic-item").click();
	await expandSelectedItemInspector(session.page);
	await expect(width).toBeDisabled();
	await expect(width).toHaveValue(fixedWidthMm);
	await session.context.close();
});

// MEASURE-E2E-01 was replaced by DRAWING-01 in drawing-dimensions-e2e.spec.ts.
// The passive drawing contract replaces the removed picker; domain measurement unit tests remain.

// MEASURE-E2E-02 was replaced by DRAWING-03 in drawing-dimensions-e2e.spec.ts.
// The passive drawing contract replaces the removed picker; domain measurement unit tests remain.

// MEASURE-E2E-03 was replaced by DRAWING-04 in drawing-dimensions-e2e.spec.ts.
// The passive drawing contract replaces the removed picker; domain measurement unit tests remain.

// MEASURE-E2E-04 was replaced by DRAWING-05 in drawing-dimensions-e2e.spec.ts.
// The passive drawing contract replaces the removed picker; domain measurement unit tests remain.

test("ITEM-E2E-03: selecting a placed item exposes deletion and persists its removal", async ({
	page: _page,
}, testInfo) => {
	const session = await openPersistentPhone(testInfo, "editor-delete-item");
	await session.page.goto("/");
	await startNewProject(session.page, "Удаление мебели");
	await session.page.getByRole("button", { name: "Создать контур" }).click();
	await chooseBuiltInGreybox(session.page);

	const plan = session.page.getByTestId("plan-canvas");
	const planBox = await plan.boundingBox();
	if (!planBox) {
		throw new Error("Plan canvas did not render");
	}
	await clickPlanPointMm(session.page, 2000, 1500);
	await expect(session.page.getByTestId("item-count")).toHaveText("1 предмет");
	const placementManifests = await durableResourceManifests(session.page);
	const placedManifest = placementManifests.revisions.find(
		(manifest) => manifest.revisionId === placementManifests.currentRevisionId,
	);
	expect(placedManifest?.resourceHashes).toHaveLength(1);
	const [placedResourceHash] = placedManifest?.resourceHashes ?? [];
	if (!placedResourceHash) {
		throw new Error("Expected the placed GLB to have one pinned resource hash");
	}

	await chooseEditorOption(session.page, "Рука и выбор");
	await session.page.getByTestId("schematic-item").click();
	await expect(
		session.page.getByTestId("selected-item-inspector"),
	).toBeHidden();
	await expandSelectedItemInspector(session.page);
	await expect(
		session.page.getByRole("button", { name: "Удалить предмет", exact: true }),
	).toBeVisible();
	await session.page
		.getByRole("button", { name: "Удалить предмет", exact: true })
		.click();

	await expect(session.page.getByTestId("item-count")).toHaveText(
		"0 предметов",
	);
	await expect(session.page.getByTestId("schematic-item")).toHaveCount(0);
	const deletedManifests = await durableResourceManifests(session.page);
	expect(
		deletedManifests.revisions.some((manifest) =>
			manifest.resourceHashes.includes(placedResourceHash),
		),
	).toBe(true);
	await triggerEditorHistoryAction(session.page, "undo");
	await expect(session.page.getByTestId("item-count")).toHaveText("1 предмет");
	const undoneManifests = await durableResourceManifests(session.page);
	expect(
		undoneManifests.revisions.find(
			(manifest) => manifest.revisionId === undoneManifests.currentRevisionId,
		)?.resourceHashes,
	).toEqual([placedResourceHash]);

	await triggerEditorHistoryAction(session.page, "redo");
	await expect(session.page.getByTestId("item-count")).toHaveText(
		"0 предметов",
	);
	const redoneManifests = await durableResourceManifests(session.page);
	expect(
		redoneManifests.revisions.some((manifest) =>
			manifest.resourceHashes.includes(placedResourceHash),
		),
	).toBe(true);

	await triggerEditorHistoryAction(session.page, "undo");
	await session.page.getByTestId("schematic-item").click();
	await expandSelectedItemInspector(session.page);
	await session.page
		.getByRole("button", { name: "Заблокировать предмет" })
		.click();
	await expect
		.poll(async () => (await durableFloorItems(session.page))[0]?.locked)
		.toBe(true);
	await expect(
		session.page.getByRole("button", { name: "Удалить предмет", exact: true }),
	).toBeDisabled();
	await expect(
		session.page.getByText(
			"Предмет заблокирован. Разблокируйте его, чтобы изменить параметры, цвет, положение или удалить.",
		),
	).toHaveCount(0);
	await expect(
		session.page.getByTestId("project-durability-status"),
	).toContainText("Сохранено локально");
	await session.page.reload();
	await openProjectFromHub(session.page, "Удаление мебели");
	await expect(session.page.getByTestId("item-count")).toHaveText("1 предмет");
	await expect(session.page.getByTestId("schematic-item")).toHaveCount(1);
	await expect
		.poll(async () => (await durableFloorItems(session.page))[0]?.locked)
		.toBe(true);
	await session.context.close();
});

test("ITEM-E2E-03A: duplicating a selected GLB starts a non-durable placement and reuses its model definition", async ({
	page: _page,
}, testInfo) => {
	const session = await openPersistentPhone(testInfo, "editor-duplicate-item");
	await session.page.goto("/");
	await startNewProject(session.page, "Копии мебели");
	await session.page.getByRole("button", { name: "Создать контур" }).click();
	await chooseBuiltInGreybox(session.page);

	const plan = session.page.getByTestId("plan-canvas");
	const planBox = await plan.boundingBox();
	if (!planBox) throw new Error("Plan canvas did not render");
	await clickPlanPointMm(session.page, 1000, 1500);
	await expect(session.page.getByTestId("item-count")).toHaveText("1 предмет");
	const revisionsBeforeDuplicate = await durableRevisionCount(session.page);

	await chooseEditorOption(session.page, "Рука и выбор");
	await session.page.getByTestId("schematic-item").click();
	await expandSelectedItemInspector(session.page);
	await expect(
		session.page.getByLabel("Ширина выбранного предмета, мм"),
	).toBeDisabled();
	await expect(
		session.page.getByLabel("Глубина выбранного предмета, мм"),
	).toBeDisabled();
	await expect(
		session.page.getByLabel("Высота выбранного предмета, мм"),
	).toBeDisabled();
	await session.page
		.getByRole("button", { name: "Дублировать предмет", exact: true })
		.click();
	await expect(session.page.getByTestId("item-placement-identity")).toHaveText(
		"Деревянный комод",
	);
	await expect(session.page.getByTestId("item-draft-hint")).toHaveCount(0);
	expect(await durableRevisionCount(session.page)).toBe(
		revisionsBeforeDuplicate,
	);

	await clickPlanPointMm(session.page, 3000, 1500);
	await expect(
		session.page.getByTestId("item-placement-preview"),
	).toHaveAttribute("data-placement-valid", "true");
	await session.page
		.getByRole("button", { name: "Подтвердить размещение предмета" })
		.click();
	await expect(session.page.getByTestId("item-count")).toHaveText("2 предмета");
	await expect
		.poll(() => durableRevisionCount(session.page))
		.toBe(revisionsBeforeDuplicate + 1);
	const items = await durableFloorItems(session.page);
	expect(new Set(items.map((item) => item.assetInstanceId)).size).toBe(2);
	expect(new Set(items.map((item) => item.assetDefinitionId)).size).toBe(1);
	await session.context.close();
});

test("EDITOR-E2E-06: the phone workspace has no redundant fullscreen action", async ({
	page: _page,
}, testInfo) => {
	const session = await openPersistentPhone(
		testInfo,
		"editor-no-fullscreen-control",
	);
	await session.page.goto("/");
	await startNewProject(session.page, "Без полноэкранного режима");

	await expect(
		session.page.getByRole("button", { name: "На весь экран" }),
	).toHaveCount(0);
	await expect(
		session.page.getByRole("button", { name: "Рука и выбор" }),
	).not.toContainText("🐾");
	await expect(session.page.getByTestId("select-tool-icon")).toBeVisible();
	await session.context.close();
});

test("EDITOR-E2E-06B: renaming from the phone header opens a focused project sheet", async ({
	page: _page,
}, testInfo) => {
	const session = await openPersistentPhone(
		testInfo,
		"editor-rename-project-sheet",
	);
	await session.page.goto("/");
	await startNewProject(session.page, "Текущий план");

	await session.page
		.getByRole("button", { name: "Переименовать проект Текущий план" })
		.click();
	const renameSheet = session.page.getByTestId("rename-project-sheet");
	await expect(renameSheet).toBeVisible();
	await expect(
		renameSheet.getByText("Переименовать проект", { exact: true }),
	).toBeVisible();
	await expect(renameSheet.getByLabel("Новое название проекта")).toBeFocused();
	const saveAction = renameSheet.getByRole("button", { name: "Сохранить" });
	const cancelAction = renameSheet.getByRole("button", { name: "Отмена" });
	await expect(saveAction).toBeVisible();
	await expect(cancelAction).toBeVisible();
	const [saveBox, cancelBox, viewport] = await Promise.all([
		saveAction.boundingBox(),
		cancelAction.boundingBox(),
		session.page.evaluate(() => ({
			width: window.innerWidth,
			height: window.innerHeight,
		})),
	]);
	if (!saveBox || !cancelBox)
		throw new Error("Rename sheet actions did not render");
	expect(saveBox.x).toBeGreaterThan(cancelBox.x);
	expect(saveBox.x + saveBox.width).toBeLessThanOrEqual(viewport.width);
	expect(cancelBox.x + cancelBox.width).toBeLessThanOrEqual(viewport.width);
	expect(
		Math.max(saveBox.y + saveBox.height, cancelBox.y + cancelBox.height),
	).toBeLessThanOrEqual(viewport.height);
	await session.context.close();
});

test("EDITOR-E2E-06A: starting over requires confirmation and keeps the previous plan as Undo", async ({
	page: _page,
}, testInfo) => {
	const session = await openPersistentPhone(testInfo, "editor-restart-project");
	await session.page.goto("/");
	await startNewProject(session.page, "Новый вариант");
	await session.page.getByRole("button", { name: "Создать контур" }).click();
	await expect(session.page.getByTestId("plan-area")).toHaveCount(1);

	await session.page
		.getByRole("button", { name: "Открыть остальные действия" })
		.click();
	await session.page.getByRole("button", { name: "Начать заново" }).click();
	const confirmation = session.page.getByRole("dialog", {
		name: "Начать проект заново",
	});
	await expect(confirmation).toBeVisible();
	await expect(confirmation).toHaveAttribute(
		"data-testid",
		"restart-project-sheet",
	);
	await expect(
		session.page.getByRole("dialog", { name: "Остальные действия редактора" }),
	).toHaveCount(0);
	await confirmation.getByRole("button", { name: "Оставить чертёж" }).click();
	await expect(session.page.getByTestId("plan-area")).toHaveCount(1);

	await session.page
		.getByRole("button", { name: "Открыть остальные действия" })
		.click();
	await session.page.getByRole("button", { name: "Начать заново" }).click();
	await confirmation
		.getByRole("button", { name: "Создать пустой план" })
		.click();
	await expect(
		session.page.getByLabel("Размеры стартового контура"),
	).toBeVisible();
	await triggerEditorHistoryAction(session.page, "undo");
	await expect(session.page.getByTestId("plan-area")).toHaveCount(1);
	await session.context.close();
});

test("CATALOG-E2E-00: the selected catalog action remains inside a short viewport", async ({
	page: _page,
}, testInfo) => {
	const session = await openPersistentPhone(
		testInfo,
		"editor-catalog-fixed-action",
		{ freshProfile: true },
	);
	await session.page.goto("/");
	await startNewProject(session.page, "Доступное действие");
	await session.page.getByRole("button", { name: "Создать контур" }).click();
	await chooseEditorOption(session.page, "Предметы интерьера");

	const catalog = session.page.getByRole("dialog", {
		name: "Предметы интерьера",
	});
	await expect(catalog.getByTestId("catalog-title")).toBeVisible();
	await expect(catalog.getByTestId("catalog-title")).toHaveText("Каталог");
	const activeCategory = catalog.getByRole("button", {
		name: "Все",
		exact: true,
	});
	const firstCatalogCard = catalog
		.getByTestId("preloaded-catalog-card")
		.first();
	await expect(activeCategory).toBeVisible();
	await expect(firstCatalogCard).toBeVisible();
	await expect(
		activeCategory.evaluate(
			(button) => getComputedStyle(button).backgroundColor,
		),
	).resolves.toBe("rgb(37, 99, 235)");
	await expect(
		firstCatalogCard.evaluate((card) => getComputedStyle(card).borderRadius),
	).resolves.toBe("18px");
	await catalog
		.getByRole("button", { name: /^Антикварный кожаный диван —/ })
		.click();
	const placementAction = catalog.getByRole("button", {
		name: /^(?:Отмена|Показать на плане)$/,
	});
	await expect(placementAction).toBeVisible();
	await expect(
		placementAction.evaluate(
			(button) => getComputedStyle(button).backgroundColor,
		),
	).resolves.toBe("rgb(37, 99, 235)");
	const [actionBox, viewportHeight, dialogScrollMetrics] = await Promise.all([
		placementAction.boundingBox(),
		session.page.evaluate(() => window.innerHeight),
		catalog.evaluate((dialog) => ({
			clientHeight: dialog.clientHeight,
			scrollHeight: dialog.scrollHeight,
		})),
	]);
	if (!actionBox) {
		throw new Error("The catalog action did not render");
	}
	expect(actionBox.y).toBeGreaterThanOrEqual(0);
	expect(actionBox.y + actionBox.height).toBeLessThanOrEqual(viewportHeight);
	expect(dialogScrollMetrics.scrollHeight).toBeLessThanOrEqual(
		// A one-row safe-area rounding remainder is harmless, but the dialog
		// itself must not become the multi-screen scroll container.
		dialogScrollMetrics.clientHeight + 12,
	);

	await session.page.unrouteAll({ behavior: "ignoreErrors" });
	await session.context.close();
});

test("CATALOG-E2E-01: a phone catalog returns a chosen preloaded model to direct plan placement", async ({
	page: _page,
}, testInfo) => {
	test.setTimeout(90_000);
	const session = await openPersistentPhone(
		testInfo,
		"editor-preloaded-catalog",
	);
	await session.page.goto("/");
	await startNewProject(session.page, "Палитра мебели");
	await session.page.getByRole("button", { name: "Создать контур" }).click();
	await chooseEditorOption(session.page, "3D");
	await expect(
		session.page.getByTestId("three-dimensional-canvas"),
	).toBeVisible();
	await session.page
		.getByTestId("three-dimensional-camera-deck")
		.getByRole("button", { name: "Предметы интерьера" })
		.click();

	const catalog = session.page.getByRole("dialog", {
		name: "Предметы интерьера",
	});
	await expect(catalog).toBeVisible();
	for (const label of [
		"Антикварный кожаный диван",
		"Кресло Kursi",
		"Винтажный стул Zen",
		"Обеденное кресло",
		"Фактурное кресло",
		"Кровать",
		"Деревянный комод",
		"Шкаф в скандинавском стиле",
	]) {
		await expect(
			catalog.getByRole("button", { name: new RegExp(`^${label} —`) }),
		).toHaveCount(1);
	}

	await expect(
		catalog.getByRole("img", { name: "Превью предмета: Кровать" }),
	).toBeVisible();
	const bedCard = catalog.getByRole("button", { name: /^Кровать —/ });
	await expect(bedCard.getByTestId("catalog-card-category")).toHaveText(
		"Мебель",
	);
	await expect(bedCard.getByTestId("catalog-card-readiness")).toContainText(
		"Готово",
	);
	await expect(bedCard.getByTestId("catalog-card-variant-count")).toHaveCount(
		0,
	);
	await bedCard.click();
	const placeCatalogAsset = catalog.getByRole("button", {
		name: "Показать на плане",
	});
	await expect(placeCatalogAsset).toBeEnabled({ timeout: 30_000 });
	await placeCatalogAsset.click();
	await expect(catalog).toHaveCount(0, { timeout: 60_000 });
	const scene = session.page.getByTestId("three-dimensional-canvas");
	await expect(scene).toBeVisible();
	await expect(
		session.page.getByTestId("three-dimensional-item-placement-identity"),
	).toContainText("Кровать");
	const sceneBox = await scene.boundingBox();
	if (!sceneBox) {
		throw new Error("3D canvas did not render");
	}
	const placementMenuBox = await session.page
		.getByTestId("three-dimensional-item-placement-menu")
		.boundingBox();
	await expect(
		session.page.getByTestId("three-dimensional-camera-deck"),
	).toHaveCount(0);
	if (!placementMenuBox) {
		throw new Error("3D placement controls did not render");
	}
	expect(placementMenuBox.y).toBeGreaterThanOrEqual(sceneBox.y);
	expect(placementMenuBox.y + placementMenuBox.height).toBeLessThanOrEqual(
		sceneBox.y + sceneBox.height + 1,
	);
	await session.page.mouse.click(
		sceneBox.x + sceneBox.width * 0.5,
		sceneBox.y + sceneBox.height * 0.5,
	);
	const placementPreview = session.page.getByTestId(
		"three-dimensional-item-placement-preview",
	);
	await expect(placementPreview).toHaveAttribute(
		"data-placement-valid",
		"true",
	);
	const placementXBeforeDrag = await placementPreview.getAttribute("data-x-m");
	const cameraBeforePlacementDrag = await session.page
		.getByTestId("three-dimensional-camera")
		.textContent();
	await session.page.mouse.move(
		sceneBox.x + sceneBox.width * 0.5,
		sceneBox.y + sceneBox.height * 0.5,
	);
	await session.page.mouse.down();
	await session.page.mouse.move(
		sceneBox.x + sceneBox.width * 0.55,
		sceneBox.y + sceneBox.height * 0.53,
		{ steps: 6 },
	);
	await session.page.mouse.up();
	await expect(placementPreview).not.toHaveAttribute(
		"data-x-m",
		placementXBeforeDrag ?? "",
	);
	await expect(session.page.getByTestId("three-dimensional-camera")).toHaveText(
		cameraBeforePlacementDrag ?? "",
	);
	await session.page
		.getByRole("button", { name: "Подтвердить размещение предмета" })
		.click();

	await expect(
		session.page.getByText("1 предмет в плане", { exact: true }),
	).toHaveText("1 предмет в плане");
	await expect(
		session.page.getByText("1 предмет в плане", { exact: true }),
	).toBeHidden();
	await chooseEditorOption(session.page, "План 2D");
	await chooseEditorOption(session.page, "Рука и выбор");
	await session.page.getByTestId("schematic-item").click();
	await expandSelectedItemInspector(session.page);
	await expect(
		session.page.getByLabel("Свойства выбранного предмета"),
	).toContainText("Кровать");
	await expect(
		session.page.getByLabel("Ширина выбранного предмета, мм"),
	).toHaveValue("1769");
	await expect(
		session.page.getByText(
			"У этой 3D-модели не объявлены изменяемые варианты цвета.",
		),
	).toHaveCount(0);
	await expect(
		session.page.getByRole("button", {
			name: "Выбрать цвет предмета #416b91",
		}),
	).toHaveCount(0);
	await session.context.close();
});

test("CATALOG-E2E-01A: a phone catalog filters only declared preloaded resources before it starts a placement draft", async ({
	page: _page,
}, testInfo) => {
	const session = await openPersistentPhone(testInfo, "editor-catalog-search");
	await session.page.goto("/");
	await startNewProject(session.page, "Поиск мебели");
	await session.page.getByRole("button", { name: "Создать контур" }).click();
	await chooseEditorOption(session.page, "Предметы интерьера");

	const catalog = session.page.getByRole("dialog", {
		name: "Предметы интерьера",
	});
	const search = catalog.getByRole("textbox", {
		name: "Поиск по названию, категории, креплению или размеру",
	});
	const categoryNavigation = catalog.getByRole("navigation", {
		name: "Категории каталога",
	});
	for (const category of [
		"Мебель",
		"Сантехника",
		"Техника и электроника",
		"Освещение",
		"Аксессуары",
	]) {
		await expect(
			categoryNavigation.getByRole("button", { name: category, exact: true }),
		).toHaveCount(1);
	}
	await categoryNavigation
		.getByRole("button", { name: "Сантехника", exact: true })
		.click();
	await expect(catalog.getByTestId("catalog-result-count")).toHaveText(
		"1 предмет",
	);
	await expect(
		catalog.getByRole("button", { name: /^Демонстрационная раковина —/ }),
	).toHaveCount(1);
	await categoryNavigation
		.getByRole("button", { name: "Мебель", exact: true })
		.click();
	await search.fill("Шкаф");
	await expect(catalog.getByTestId("catalog-result-count")).toHaveText(
		"1 предмет",
	);
	await expect(
		catalog.getByRole("button", { name: /^Шкаф в скандинавском стиле —/ }),
	).toHaveCount(1);
	await expect(catalog.getByRole("button", { name: /^Кровать —/ })).toHaveCount(
		0,
	);
	await search.fill("хранение");
	await expect(catalog.getByTestId("catalog-result-count")).toHaveText(
		"2 предмета",
	);
	await expect(
		catalog.getByRole("button", { name: /^Деревянный комод —/ }),
	).toHaveCount(1);
	await expect(
		catalog.getByRole("button", { name: /^Шкаф в скандинавском стиле —/ }),
	).toHaveCount(1);
	await search.fill("напольный");
	await expect(catalog.getByTestId("catalog-result-count")).toHaveText(
		"8 предметов",
	);
	const firstFurnitureCard = catalog
		.getByTestId("preloaded-catalog-card")
		.first();
	await expect(
		firstFurnitureCard.getByTestId("catalog-card-category"),
	).toHaveText("Мебель");
	await expect(firstFurnitureCard).toContainText("На полу");
	await expect(
		firstFurnitureCard.getByTestId("catalog-card-variant-count"),
	).toHaveCount(0);

	await search.fill("несуществующий предмет");
	await expect(
		catalog.getByText(
			"В локальном каталоге нет предметов с такими параметрами.",
		),
	).toContainText("нет предметов с такими параметрами");
	await search.fill("");
	await categoryNavigation
		.getByRole("button", { name: "Мебель", exact: true })
		.click();
	await expect(catalog.getByTestId("catalog-result-count")).toHaveText(
		"8 предметов",
	);
	await catalog
		.getByRole("button", { name: /^Антикварный кожаный диван —/ })
		.click();
	const placeCatalogAsset = catalog.getByRole("button", {
		name: "Показать на плане",
	});
	await expect(placeCatalogAsset).toBeEnabled({ timeout: 30_000 });
	await session.page.keyboard.press("Escape");
	await expect(catalog).toHaveCount(0);
	await expect(session.page.getByTestId("item-count")).toHaveText(
		"0 предметов",
	);
	await session.context.close();
});

test("CATALOG-E2E-01E: local furniture and its search stay available while the catalog publication is unavailable", async ({
	page: _page,
}, testInfo) => {
	const session = await openPersistentPhone(
		testInfo,
		"editor-catalog-local-fallback",
		{ freshProfile: true },
	);
	await session.page.route("**/catalog-api/v1/catalogs/current", (route) =>
		route.fulfill({ status: 503 }),
	);

	await session.page.goto("/");
	await startNewProject(session.page, "Локальная мебель");
	await session.page.getByRole("button", { name: "Создать контур" }).click();
	await expect
		.poll(async () => (await durableRooms(session.page)).length)
		.toBe(1);
	const revisionsBeforeCatalog = await durableRevisionCount(session.page);
	await chooseEditorOption(session.page, "Предметы интерьера");

	const catalog = session.page.getByRole("dialog", {
		name: "Предметы интерьера",
	});
	await expect(catalog.getByTestId("catalog-publication-error")).toBeVisible();
	await expect(session.page.getByTestId("catalog-outage-dialog")).toHaveCount(
		0,
	);
	await expect(catalog).toBeVisible();
	const categoryNavigation = catalog.getByRole("navigation", {
		name: "Категории каталога",
	});
	await categoryNavigation
		.getByRole("button", { name: "Мебель", exact: true })
		.click();
	await expect(catalog.getByTestId("catalog-result-count")).toHaveText(
		"8 предметов",
	);
	const bed = catalog.getByRole("button", { name: /^Кровать —/ });
	await expect(bed).toContainText("Готово к загрузке");
	const search = catalog.getByRole("textbox", {
		name: "Поиск по названию, категории, креплению или размеру",
	});
	await search.fill("хранение");
	await expect(catalog.getByTestId("catalog-result-count")).toHaveText(
		"2 предмета",
	);
	expect(await durableRevisionCount(session.page)).toBe(revisionsBeforeCatalog);
	await search.fill("");
	await bed.click();
	const showOnPlan = catalog.getByRole("button", {
		name: "Показать на плане",
	});
	await expect(showOnPlan).toBeEnabled({ timeout: 30_000 });
	await showOnPlan.click();
	await expect(catalog).toHaveCount(0, { timeout: 30_000 });
	await expect(session.page.getByTestId("item-placement-identity")).toHaveText(
		"Кровать",
	);
	await expect(session.page.getByTestId("item-draft-hint")).toHaveCount(0);
	await session.context.close();
});

test("CATALOG-E2E-01AA: a user can compose an exact local placeholder before its explicit floor placement", async ({
	page: _page,
}, testInfo) => {
	const session = await openPersistentPhone(
		testInfo,
		"editor-local-placeholder",
	);
	await session.page.goto("/");
	await startNewProject(session.page, "Свой макетный предмет");
	await session.page.getByRole("button", { name: "Создать контур" }).click();
	await chooseEditorOption(session.page, "Предметы интерьера");

	const catalog = session.page.getByRole("dialog", {
		name: "Предметы интерьера",
	});
	await catalog
		.getByTestId("catalog-authoring")
		.getByText("Импорт модели", { exact: true })
		.click();
	await catalog
		.getByRole("button", { name: "Создать макетный предмет" })
		.click();
	const composer = catalog.getByRole("form", {
		name: "Создать макетный предмет",
	});
	await composer.getByLabel("Название макетного предмета").fill("Рабочий стол");
	await composer.getByLabel("Ширина макетного предмета, мм").fill("0");
	await composer.getByRole("button", { name: "Начать размещение" }).click();
	await expect(composer.getByRole("alert")).toHaveText(
		"Укажите название и целые положительные ширину, глубину и высоту.",
	);
	await expect(catalog).toBeVisible();
	await composer.getByLabel("Ширина макетного предмета, мм").fill("1100");
	await composer.getByLabel("Глубина макетного предмета, мм").fill("650");
	await composer.getByLabel("Высота макетного предмета, мм").fill("740");
	await composer
		.getByRole("button", { name: "Выбрать цвет макетного предмета #416b91" })
		.click();
	await expect(composer.getByText("Размещение: на полу")).toHaveCount(0);
	await composer.getByRole("button", { name: "Начать размещение" }).click();
	await expect(catalog).toHaveCount(0);
	await expect(session.page.getByTestId("item-placement-identity")).toHaveText(
		"Рабочий стол",
	);
	await expect(session.page.getByTestId("item-draft-hint")).toHaveCount(0);

	const plan = session.page.getByTestId("plan-canvas");
	const planBox = await plan.boundingBox();
	if (!planBox) throw new Error("Plan canvas did not render");
	await clickPlanPointMm(session.page, 2000, 1500);
	await expect(
		session.page.getByTestId("item-placement-preview"),
	).toHaveAttribute("data-placement-valid", "true");
	await session.page
		.getByRole("button", { name: "Подтвердить размещение предмета" })
		.click();
	await expect(session.page.getByTestId("item-count")).toHaveText("1 предмет");
	const roomId = (await durableRooms(session.page))[0]?.roomId;
	expect(roomId).toBeDefined();
	await expect
		.poll(() => durableFloorItems(session.page))
		.toEqual([
			expect.objectContaining({
				anchorClass: "floor",
				roomId,
				widthMm: 1100,
				depthMm: 650,
				heightMm: 740,
				color: "#416b91",
			}),
		]);
	const placedItems = await durableFloorItems(session.page);
	await chooseEditorOption(session.page, "Рука и выбор");
	await session.page.getByTestId("schematic-item").click();
	await expect(
		session.page.getByLabel("Свойства выбранного предмета"),
	).toContainText("Рабочий стол");
	await expect(
		session.page.getByLabel("Свойства выбранного предмета"),
	).toContainText("МАКЕТНЫЙ ПРЕДМЕТ");
	await session.page.reload();
	await openProjectFromHub(session.page, "Свой макетный предмет");
	expect(await durableFloorItems(session.page)).toEqual(placedItems);
	await chooseEditorOption(session.page, "Рука и выбор");
	await session.page.getByTestId("schematic-item").click();
	await expect(
		session.page.getByLabel("Свойства выбранного предмета"),
	).toContainText("МАКЕТНЫЙ ПРЕДМЕТ");
	await session.context.close();
});

test("CATALOG-E2E-01G: choosing a wall model after a Window keeps explicit placement accessible", async ({
	page: _page,
}, testInfo) => {
	const session = await openPersistentPhone(
		testInfo,
		"window-to-wall-catalog-model",
	);
	await session.page.goto("/");
	await startNewProject(session.page, "Бра после окна");
	await session.page.getByRole("button", { name: "Создать контур" }).click();
	await session.page.getByTestId("wall-segment").first().click();
	await session.page
		.getByRole("button", { name: "Добавить проём", exact: true })
		.click();
	const creation = session.page.getByTestId("opening-creation-draft");
	await creation.getByRole("button", { name: "Окно", exact: true }).click();
	await creation.getByLabel("Высота, мм").fill("100");
	await creation.getByRole("button", { name: "Добавить", exact: true }).click();
	await expect.poll(() => durableWindowOpenings(session.page)).toHaveLength(1);
	await session.page.getByTestId("opening-move-handle").click();
	await expect(
		session.page.getByRole("complementary", { name: "Выбранное окно" }),
	).toBeVisible();
	const windowsBefore = await durableWindowOpenings(session.page);
	const revisionsBefore = await durableRevisionCount(session.page);
	const resourcesBefore = await durableResourceManifests(session.page);
	await choosePreloadedCatalogAsset(
		session.page,
		"Демонстрационное настенное бра",
		false,
	);
	const placement = session.page.getByTestId("selected-wall-inspector");
	await expect(placement).toBeVisible();
	await expect(
		session.page.getByRole("complementary", { name: "Выбранное окно" }),
	).toHaveCount(0);
	const confirm = placement.getByRole("button", {
		name: "Подтвердить размещение",
		exact: true,
	});
	await expect(confirm).toBeVisible();
	await expect(confirm).toBeEnabled();
	expect(await durableWindowOpenings(session.page)).toEqual(windowsBefore);
	expect(await durableRevisionCount(session.page)).toBe(revisionsBefore);
	expect(await durableWallItems(session.page)).toEqual([]);
	const emptyCanvasPoint = await session.page
		.getByTestId("plan-canvas")
		.evaluate((canvas) => {
			const background = canvas.querySelector(":scope > rect");
			const bounds = canvas.getBoundingClientRect();
			for (
				let y = Math.min(bounds.bottom, innerHeight) - 24;
				y > bounds.top + 24;
				y -= 24
			) {
				for (let x = bounds.left + 24; x < bounds.right - 24; x += 24) {
					const isEmpty = [-12, 0, 12].every((dx) =>
						[-12, 0, 12].every((dy) => {
							const hit = document.elementFromPoint(x + dx, y + dy);
							return hit === canvas || hit === background;
						}),
					);
					if (isEmpty) return { x, y };
				}
			}
			throw new Error("Expected an unobstructed empty canvas tap target");
		});
	await session.page.touchscreen.tap(emptyCanvasPoint.x, emptyCanvasPoint.y);
	await expect(placement).toHaveCount(0);
	await expect(
		session.page.getByText("Размещение настенного предмета", { exact: true }),
	).toHaveCount(0);
	expect(await durableRevisionCount(session.page)).toBe(revisionsBefore);
	expect(await durableWindowOpenings(session.page)).toEqual(windowsBefore);
	expect(await durableWallItems(session.page)).toEqual([]);
	expect(await durableResourceManifests(session.page)).toEqual(resourcesBefore);
	await choosePreloadedCatalogAsset(
		session.page,
		"Демонстрационное настенное бра",
		false,
	);
	await expect(placement).toBeVisible();
	await expect(confirm).toBeEnabled();
	expect(await durableRevisionCount(session.page)).toBe(revisionsBefore);
	await confirm.click();
	await expect.poll(() => durableWallItems(session.page)).toHaveLength(1);
	await expect
		.poll(() => durableRevisionCount(session.page))
		.toBe(revisionsBefore + 1);
	expect(await durableWindowOpenings(session.page)).toEqual(windowsBefore);
	const itemsBeforeReload = await durableWallItems(session.page);
	await session.page.reload();
	await openProjectFromHub(session.page, "Бра после окна");
	expect(await durableWallItems(session.page)).toEqual(itemsBeforeReload);
	expect(await durableWindowOpenings(session.page)).toEqual(windowsBefore);
	await session.context.close();
});

test("CATALOG-E2E-01B: a preloaded model is prepared before an explicit non-durable placement handoff", async ({
	page: _page,
}, testInfo) => {
	test.setTimeout(90_000);
	const session = await openPersistentPhone(
		testInfo,
		"editor-catalog-pending-model",
	);
	let releaseModelRequest: (() => void) | undefined;
	let holdFirstRangeRequest = true;
	const modelRequestStarted = new Promise<void>((resolve) => {
		void session.page.route(
			"**/catalog-api/v1/resources/sha256/b3fe3da6d19b4a5c46bfd2ebeeb7bfbe97e9a1ba650bb4d79a4edba92115316e",
			async (route) => {
				if (!holdFirstRangeRequest) {
					await route.fallback();
					return;
				}
				holdFirstRangeRequest = false;
				resolve();
				await new Promise<void>((continueRequest) => {
					releaseModelRequest = continueRequest;
				});
				await route.fallback();
			},
		);
	});

	await session.page.goto("/");
	await startNewProject(session.page, "Загрузка модели");
	await session.page.getByRole("button", { name: "Создать контур" }).click();
	await expect
		.poll(async () => (await durableRooms(session.page)).length)
		.toBe(1);
	const revisionsBeforePlacement = await durableRevisionCount(session.page);
	await chooseEditorOption(session.page, "Предметы интерьера");

	const catalog = session.page.getByRole("dialog", {
		name: "Предметы интерьера",
	});
	await catalog
		.getByRole("button", { name: /^Антикварный кожаный диван —/ })
		.click();
	await modelRequestStarted;
	await expect(
		catalog.getByTestId("preloaded-catalog-loading-status"),
	).toContainText("Готовим для офлайн…");

	const placementBar = catalog.getByTestId("catalog-placement-bar");
	await expect(catalog).toHaveAttribute(
		"data-focused-preloaded-selection",
		"true",
	);
	await expect(catalog).toHaveAttribute(
		"data-preloaded-resource-state",
		"loading",
	);
	await expect(
		catalog.evaluate((dialog) => getComputedStyle(dialog).backgroundColor),
	).resolves.toBe("rgba(0, 0, 0, 0)");
	await expect(
		catalog
			.getByTestId("preloaded-catalog-loading-status")
			.locator("span")
			.evaluate((status) => getComputedStyle(status).fontSize),
	).resolves.not.toBe("0px");
	expect(await placementBar.locator("button").allTextContents()).toEqual([
		"Отмена",
	]);
	await expect(
		placementBar.getByRole("button", { name: "Отмена" }),
	).toBeEnabled();
	await expect(
		catalog.getByRole("button", { name: "Показать на плане" }),
	).toHaveCount(0);
	await expect(
		catalog.getByTestId("preloaded-catalog-ready-status"),
	).toHaveCount(0);
	await expect(session.page.getByTestId("item-placement-preview")).toHaveCount(
		0,
	);
	expect(await durableRevisionCount(session.page)).toBe(
		revisionsBeforePlacement,
	);

	if (!releaseModelRequest) {
		throw new Error("The catalogue did not hold the requested GLB");
	}
	releaseModelRequest();
	await expect(
		catalog.getByTestId("preloaded-catalog-ready-status"),
	).toHaveText("Готово для размещения");
	const showOnPlan = catalog.getByRole("button", { name: "Показать на плане" });
	await expect(showOnPlan).toBeEnabled();
	await expect(catalog).toBeVisible();
	await expect(session.page.getByTestId("item-placement-preview")).toHaveCount(
		0,
	);
	expect(await durableRevisionCount(session.page)).toBe(
		revisionsBeforePlacement,
	);

	await showOnPlan.click();
	await expect(catalog).toHaveCount(0, { timeout: 60_000 });
	await expect(session.page.getByTestId("item-placement-identity")).toHaveText(
		"Антикварный кожаный диван",
	);
	await expect(session.page.getByTestId("item-draft-hint")).toHaveCount(0);
	expect(await durableRevisionCount(session.page)).toBe(
		revisionsBeforePlacement,
	);

	const plan = session.page.getByTestId("plan-canvas");
	const planBox = await plan.boundingBox();
	if (!planBox) throw new Error("Plan canvas did not render");
	await clickPlanPointMm(session.page, 2000, 1500);
	await expect(
		session.page.getByTestId("item-placement-preview"),
	).toBeVisible();
	await expect(
		session.page.getByRole("button", {
			name: "Подтвердить размещение предмета",
		}),
	).toHaveText("Поставить");
	expect(await durableRevisionCount(session.page)).toBe(
		revisionsBeforePlacement,
	);
	await session.page
		.getByRole("button", { name: "Подтвердить размещение предмета" })
		.click();
	await expect
		.poll(() => durableRevisionCount(session.page))
		.toBe(revisionsBeforePlacement + 1);
	await session.context.close();
});

test("CATALOG-E2E-01F: a large catalog model is placed through bounded byte-range requests", async ({
	page: _page,
}, testInfo) => {
	test.setTimeout(90_000);
	const session = await openPersistentPhone(
		testInfo,
		"editor-catalog-large-model-ranges",
	);
	const largeModelPattern =
		"**/catalog-api/v1/resources/sha256/4b7191cbbb12ec08e81f60ce3270cb94f991521da6869e9d6b23f6b52076cbd2";
	const receivedRanges: string[] = [];
	await session.page.route(largeModelPattern, async (route) => {
		const range = route.request().headers().range;
		if (!range) {
			await route.fulfill({ status: 503 });
			return;
		}
		receivedRanges.push(range);
		await route.fallback();
	});

	await session.page.goto("/");
	await startNewProject(session.page, "Большая модель");
	await session.page.getByRole("button", { name: "Создать контур" }).click();
	await chooseEditorOption(session.page, "Предметы интерьера");

	const catalog = session.page.getByRole("dialog", {
		name: "Предметы интерьера",
	});
	await catalog
		.getByRole("button", { name: /^Шкаф в скандинавском стиле —/ })
		.click();
	const place = catalog.getByRole("button", {
		name: "Показать на плане",
	});
	await expect(place).toBeEnabled({ timeout: 30_000 });
	await place.click();

	await expect(catalog).toHaveCount(0, { timeout: 60_000 });
	await expect(session.page.getByTestId("item-placement-identity")).toHaveText(
		"Шкаф в скандинавском стиле",
	);
	await expect(session.page.getByTestId("item-draft-hint")).toHaveCount(0);
	expect(receivedRanges).toContain("bytes=0-1048575");
	await session.context.close();
});

test("CATALOG-E2E-01C: an unavailable catalog resource stays non-durable and can be retried or cancelled", async ({
	page: _page,
}, testInfo) => {
	const session = await openPersistentPhone(
		testInfo,
		"editor-catalog-resource-retry",
	);
	const unavailableModelPattern =
		"**/catalog-api/v1/resources/sha256/b3fe3da6d19b4a5c46bfd2ebeeb7bfbe97e9a1ba650bb4d79a4edba92115316e";
	let modelUnavailable = true;
	const unavailableModel = async (route: Route) => {
		if (modelUnavailable) {
			await route.fulfill({
				headers: { "cache-control": "no-store", "content-length": "0" },
				status: 503,
			});
			return;
		}
		await route.fallback();
	};
	await session.page.route(unavailableModelPattern, unavailableModel);

	await session.page.goto("/");
	await startNewProject(session.page, "Повтор загрузки модели");
	await session.page.getByRole("button", { name: "Создать контур" }).click();
	await expect(session.page.getByTestId("room-face")).toHaveCount(1);
	await expect(
		session.page.getByTestId("editor-top-bar").getByRole("status"),
	).toHaveText("Сохранено");
	const revisionsBeforeResourceFailure = await durableRevisionCount(
		session.page,
	);
	await chooseEditorOption(session.page, "Предметы интерьера");

	const catalog = session.page.getByRole("dialog", {
		name: "Предметы интерьера",
	});
	await catalog
		.getByRole("button", { name: /^Антикварный кожаный диван —/ })
		.click();
	await expect(
		catalog.getByTestId("preloaded-catalog-resource-status"),
	).toContainText("Не удалось подготовить предмет для офлайн");
	const failedResourceSheet = catalog.getByTestId("catalog-placement-bar");
	expect(await failedResourceSheet.locator("button").allTextContents()).toEqual(
		["Повторить", "Отмена"],
	);
	await expect(session.page.getByTestId("item-count")).toHaveText(
		"0 предметов",
	);
	expect(await durableRevisionCount(session.page)).toBe(
		revisionsBeforeResourceFailure,
	);
	await expect(
		session.page.getByRole("heading", {
			name: "Проект требует восстановления",
		}),
	).toHaveCount(0);

	await failedResourceSheet.getByRole("button", { name: "Отмена" }).click();
	await expect(catalog.getByTestId("catalog-placement-bar")).toBeHidden();
	await expect(
		catalog.getByRole("button", { name: /^Антикварный кожаный диван —/ }),
	).toContainText("Готово к загрузке");

	await catalog
		.getByRole("button", { name: /^Антикварный кожаный диван —/ })
		.click();
	await expect(
		catalog.getByTestId("preloaded-catalog-resource-status"),
	).toContainText("Не удалось подготовить предмет для офлайн");
	modelUnavailable = false;
	await catalog.getByRole("button", { name: "Повторить" }).click();
	await expect(
		catalog.getByRole("button", {
			name: "Показать на плане",
		}),
	).toBeEnabled({ timeout: 30_000 });
	await session.page.keyboard.press("Escape");
	await expect(catalog).toHaveCount(0);
	await expect(session.page.getByTestId("item-count")).toHaveText(
		"0 предметов",
	);
	expect(await durableRevisionCount(session.page)).toBe(
		revisionsBeforeResourceFailure,
	);
	await expect(
		session.page.getByRole("heading", {
			name: "Проект требует восстановления",
		}),
	).toHaveCount(0);
	await session.context.close();
});

test("CATALOG-E2E-01D: a broken thumbnail keeps the catalog card readable and its model selectable", async ({
	page: _page,
}, testInfo) => {
	const session = await openPersistentPhone(
		testInfo,
		"editor-catalog-thumbnail-fallback",
		{ freshProfile: true },
	);
	await session.page.route(
		"**/catalog-api/v1/resources/sha256/078e8997934cd6a7b7639d3ce15ed8401a33fa1ad374f95ce7a1eaa78203d355",
		(route) => route.abort("failed"),
	);

	await session.page.goto("/");
	await startNewProject(session.page, "Превью каталога");
	await session.page.getByRole("button", { name: "Создать контур" }).click();
	await chooseEditorOption(session.page, "Предметы интерьера");

	const catalog = session.page.getByRole("dialog", {
		name: "Предметы интерьера",
	});
	const card = catalog.getByRole("button", {
		name: /^Антикварный кожаный диван —/,
	});
	const thumbnailFallback = card.getByTestId(
		"preloaded-catalog-thumbnail-fallback",
	);
	await expect(thumbnailFallback).toHaveText("Превью недоступно");
	await expect(thumbnailFallback).toHaveCSS("height", "160px");
	await expect(
		card.getByAltText("Превью предмета: Антикварный кожаный диван"),
	).toHaveCount(0);
	await card.click();
	await expect(
		catalog.getByRole("button", {
			name: "Показать на плане",
		}),
	).toBeEnabled({ timeout: 30_000 });
	await session.context.close();
});

test("CATALOG-E2E-02: version metadata is visible and an inline publication outage can be retried or the catalog closed without changing the local Project", async ({
	page: _page,
}, testInfo) => {
	const session = await openPersistentPhone(
		testInfo,
		"editor-versioned-catalog-outage",
		{ freshProfile: true },
	);
	await session.page.goto("/");
	await startNewProject(session.page, "Локальный план");
	await session.page.getByRole("button", { name: "Создать контур" }).click();
	await expect(session.page.getByTestId("room-face")).toHaveCount(1);
	await expect(
		session.page.getByTestId("editor-top-bar").getByRole("status"),
	).toHaveText("Сохранено");
	const revisionsBeforeCatalog = await durableRevisionCount(session.page);
	const currentPublicationPattern = "**/catalog-api/v1/catalogs/current";
	let outageEnabled = true;
	const outage = async (route: Route) => {
		if (outageEnabled) {
			await route.abort("failed");
			return;
		}
		await route.fallback();
	};
	await session.page.route(currentPublicationPattern, outage);

	await chooseEditorOption(session.page, "Предметы интерьера");
	const catalog = session.page.getByRole("dialog", {
		name: "Предметы интерьера",
	});
	const catalogOutage = catalog.getByTestId("catalog-publication-error");
	await expect(catalog).toBeVisible();
	await expect(session.page.getByTestId("catalog-outage-dialog")).toHaveCount(
		0,
	);
	await expect(catalogOutage).toContainText("Каталог временно недоступен");
	await expect(catalogOutage.getByRole("button")).toHaveText(["Повторить"]);
	await expect(
		session.page.getByTestId("project-durability-status"),
	).toContainText("Сохранено локально");
	expect(await durableRevisionCount(session.page)).toBe(revisionsBeforeCatalog);
	await expect(
		session.page.getByRole("heading", {
			name: "Проект требует восстановления",
		}),
	).toHaveCount(0);

	outageEnabled = false;
	await catalogOutage.getByRole("button", { name: "Повторить" }).click();
	await expect(catalog).toBeVisible();
	await expect(catalog.getByTestId("catalog-publication-status")).toContainText(
		/Версия alpha-\d{4}-\d{2}-\d{2}\.\d+/,
	);
	await expect(catalog.getByTestId("catalog-publication-status")).toContainText(
		/\d+ предметов · envelope SHA-256/,
	);
	await catalog.getByRole("button", { name: /^Кровать —/ }).click();
	await expect(
		catalog.getByTestId("catalog-selected-resource-metadata"),
	).toContainText(/\d+ байт · SHA-256 [a-f0-9]{64}/);
	await session.page.keyboard.press("Escape");
	await expect(catalog).toHaveCount(0);
	expect(await durableRevisionCount(session.page)).toBe(revisionsBeforeCatalog);
	await expect(session.page.getByTestId("item-count")).toHaveText(
		"0 предметов",
	);

	outageEnabled = true;
	await chooseEditorOption(session.page, "Предметы интерьера");
	await expect(catalog).toBeVisible();
	await expect(catalogOutage).toContainText("Каталог временно недоступен");
	await expect(
		catalogOutage.getByRole("button", { name: "Отмена" }),
	).toHaveCount(0);
	await catalog
		.getByRole("button", { name: "Закрыть предметы интерьера" })
		.click();
	await expect(catalog).toHaveCount(0);
	expect(await durableRevisionCount(session.page)).toBe(revisionsBeforeCatalog);
	await expect(session.page.getByTestId("item-count")).toHaveText(
		"0 предметов",
	);
	await session.context.close();
});

test("HISTORY-E2E-00: a phone editor durably undoes and redoes a placed item in the active session", async ({
	page: _page,
}, testInfo) => {
	const session = await openPersistentPhone(testInfo, "editor-session-history");
	await session.page.goto("/");
	await startNewProject(session.page, "История плана");
	await session.page.getByRole("button", { name: "Создать контур" }).click();
	await chooseBuiltInGreybox(session.page);

	const plan = session.page.getByTestId("plan-canvas");
	const planBox = await plan.boundingBox();
	if (!planBox) {
		throw new Error("Plan canvas did not render");
	}
	await clickPlanPointMm(session.page, 2000, 1500);
	await expect(session.page.getByTestId("item-count")).toHaveText("1 предмет");

	const undo = session.page.getByRole("button", { name: "Отменить действие" });
	const redo = session.page.getByRole("button", { name: "Повторить действие" });
	await expect(undo).toBeVisible();
	await expect(redo).toBeVisible();
	await expect(undo).toBeEnabled();
	await expect(redo).toBeDisabled();

	await undo.click();
	await expect(session.page.getByTestId("item-count")).toHaveText(
		"0 предметов",
	);
	await expect(redo).toBeEnabled();
	await expect(
		session.page.getByTestId("project-durability-status"),
	).toContainText("Сохранено локально");

	await redo.click();
	await expect(session.page.getByTestId("item-count")).toHaveText("1 предмет");
	await expect(undo).toBeEnabled();
	await expect(
		session.page.getByTestId("project-durability-status"),
	).toContainText("Сохранено локально");
	await session.context.close();
});

test("EDITOR-E2E-14: the mobile canvas fits wall bodies and dimension labels before a pinch and pan", async ({
	page: _page,
}, testInfo) => {
	const session = await openPersistentPhone(
		testInfo,
		"editor-mobile-full-canvas",
	);
	await session.page.goto("/");
	await startNewProject(session.page, "Полноэкранный план");
	await session.page.getByRole("button", { name: "Создать контур" }).click();
	await expect
		.poll(async () => (await durableRooms(session.page)).length)
		.toBe(1);

	const revisionsBeforeFilter = await durableRevisionCount(session.page);
	await showAllDrawingDimensions(session.page);
	expect(await durableRevisionCount(session.page)).toBe(revisionsBeforeFilter);

	const workspace = session.page.getByTestId("editor-workspace");
	const plan = session.page.getByTestId("plan-canvas");
	const [workspaceBox, planBox] = await Promise.all([
		workspace.boundingBox(),
		plan.boundingBox(),
	]);
	if (!workspaceBox || !planBox)
		throw new Error("Mobile editor workspace did not render");
	expect(
		await session.page
			.locator('[data-testid="editor-workspace"] > header')
			.count(),
	).toBe(0);
	expect(planBox.y).toBeLessThanOrEqual(workspaceBox.y + 1);
	expect(planBox.height).toBeGreaterThanOrEqual(workspaceBox.height - 1);

	const [headerBox, dockBox] = await Promise.all([
		session.page.getByTestId("editor-top-bar").boundingBox(),
		session.page.getByTestId("editor-action-dock").boundingBox(),
	]);
	await expect(
		session.page.getByTestId("drawing-dimension-legend"),
	).toHaveCount(0);
	if (!headerBox || !dockBox)
		throw new Error("Expected the visible phone chrome");
	const dimensions = session.page.getByTestId("drawing-dimensions");
	await expect
		.poll(() => dimensions.locator("text").count())
		.toBeGreaterThanOrEqual(2);
	const visibleLabelCount = await dimensions.locator("text").count();
	expect(visibleLabelCount).toBeLessThanOrEqual(8);
	await expect(dimensions.locator("[data-dimension-clipped]")).toHaveCount(0);
	const graphics = await session.page
		.locator(
			'[data-testid="wall-line"], [data-testid="drawing-dimensions"] text',
		)
		.evaluateAll((elements) =>
			elements.map((element) => {
				const rect = element.getBoundingClientRect();
				const matrix = (element as SVGGraphicsElement).getScreenCTM();
				const halfStroke =
					element instanceof SVGLineElement && matrix
						? (Number.parseFloat(getComputedStyle(element).strokeWidth) *
								Math.hypot(matrix.a, matrix.b)) /
							2
						: 0;
				return {
					left: rect.left - halfStroke,
					right: rect.right + halfStroke,
					top: rect.top - halfStroke,
					bottom: rect.bottom + halfStroke,
				};
			}),
		);
	expect(graphics).toHaveLength(4 + visibleLabelCount);
	for (const graphic of graphics) {
		expect(graphic.left).toBeGreaterThanOrEqual(planBox.x - 1);
		expect(graphic.right).toBeLessThanOrEqual(planBox.x + planBox.width + 1);
		expect(graphic.top).toBeGreaterThanOrEqual(
			headerBox.y + headerBox.height - 1,
		);
		expect(graphic.bottom).toBeLessThanOrEqual(dockBox.y + 1);
	}
	const horizontalHitBoxes = await session.page
		.getByTestId("wall-segment")
		.evaluateAll((elements) =>
			elements.map((element) => {
				const box = element.getBoundingClientRect();
				return { height: box.height, width: box.width };
			}),
		);
	const horizontalWallTouchWidth = Math.max(
		...horizontalHitBoxes
			.filter((box) => box.width > box.height)
			.map((box) => box.height),
	);
	expect(horizontalWallTouchWidth).toBeGreaterThanOrEqual(43.5);
	expect(horizontalWallTouchWidth).toBeLessThanOrEqual(44.5);

	const beforePinch = await session.page
		.getByTestId("plan-content")
		.getAttribute("transform");
	const first = {
		id: 141,
		...(await planPointMm(session.page, { xMm: 800, zMm: 1100 })),
	};
	const second = {
		id: 142,
		...(await planPointMm(session.page, { xMm: 2000, zMm: 2000 })),
	};
	const cdp = await session.page.context().newCDPSession(session.page);
	try {
		await cdp.send("Input.dispatchTouchEvent", {
			touchPoints: [first, second],
			type: "touchStart",
		});
		await cdp.send("Input.dispatchTouchEvent", {
			touchPoints: [
				{ ...first, x: first.x - 30, y: first.y - 18 },
				{ ...second, x: second.x + 30, y: second.y + 18 },
			],
			type: "touchMove",
		});
		await cdp.send("Input.dispatchTouchEvent", {
			touchPoints: [],
			type: "touchEnd",
		});
		await expect(session.page.getByTestId("plan-content")).not.toHaveAttribute(
			"transform",
			beforePinch ?? "",
		);
		const afterPinch = await session.page
			.getByTestId("plan-content")
			.getAttribute("transform");
		const panStart = {
			id: 143,
			...(await planPointMm(session.page, { xMm: 1400, zMm: 1500 })),
		};
		await cdp.send("Input.dispatchTouchEvent", {
			touchPoints: [panStart],
			type: "touchStart",
		});
		await cdp.send("Input.dispatchTouchEvent", {
			touchPoints: [{ ...panStart, x: panStart.x + 58, y: panStart.y - 34 }],
			type: "touchMove",
		});
		await expect(session.page.getByTestId("plan-content")).not.toHaveAttribute(
			"transform",
			afterPinch ?? "",
		);
		await cdp.send("Input.dispatchTouchEvent", {
			touchPoints: [],
			type: "touchEnd",
		});
	} finally {
		await cdp.detach();
	}
	await session.context.close();
});

test("EDITOR-E2E-16: a phone user sees one compact four-action dock without losing the plan", async ({
	page: _page,
}, testInfo) => {
	const session = await openPersistentPhone(
		testInfo,
		"editor-mobile-tool-dock",
	);
	await session.page.goto("/");
	await startNewProject(session.page, "Компактные инструменты");
	await session.page.getByRole("button", { name: "Создать контур" }).click();

	const rail = session.page.getByRole("navigation", {
		name: "Инструменты редактора",
	});
	const header = session.page.getByTestId("editor-top-bar");
	const actionMenuToggle = header.getByRole("button", {
		name: "Открыть остальные действия",
	});
	const plan = session.page.getByTestId("plan-canvas");
	const [railBox, planBox] = await Promise.all([
		rail.boundingBox(),
		plan.boundingBox(),
	]);
	if (!railBox || !planBox) throw new Error("Mobile tool dock did not render");
	expect(railBox.height).toBeLessThanOrEqual(112);
	expect(railBox.width).toBeGreaterThan(planBox.width * 0.9);
	const railScroll = await rail.evaluate((element) => {
		return {
			overflowX: window.getComputedStyle(element).overflowX,
			scrollLeft: element.scrollLeft,
			scrollWidth: element.scrollWidth,
			visibleWidth: element.clientWidth,
		};
	});
	expect(railScroll.scrollWidth).toBeLessThanOrEqual(railScroll.visibleWidth);
	expect(railScroll.scrollLeft).toBe(0);
	expect(railScroll.overflowX).toBe("hidden");
	await expect(actionMenuToggle).toBeVisible();
	await expect(
		rail.getByRole("button", { name: "Открыть остальные действия" }),
	).toHaveCount(0);
	expect(
		planBox.y + planBox.height - (railBox.y + railBox.height),
	).toBeGreaterThanOrEqual(16);

	await actionMenuToggle.click();
	const secondaryActions = session.page.getByRole("dialog", {
		name: "Остальные действия редактора",
	});
	await expect(secondaryActions).toBeVisible();
	await secondaryActions
		.getByRole("button", { name: "Закрыть остальные действия" })
		.click();
	await expect(secondaryActions).toBeHidden();

	await expect(plan).toBeVisible();
	await session.context.close();
});

test("EDITOR-E2E-16A: returning to projects clears the header action-menu state", async ({
	page: _page,
}, testInfo) => {
	const session = await openPersistentPhone(
		testInfo,
		"editor-header-menu-reset",
	);
	await session.page.goto("/");
	await startNewProject(session.page, "Первый план");

	const actionMenuToggle = session.page.getByRole("button", {
		name: "Открыть остальные действия",
	});
	const secondaryActions = session.page.getByRole("dialog", {
		name: "Остальные действия редактора",
	});
	await actionMenuToggle.click();
	await expect(secondaryActions).toBeVisible();
	await secondaryActions
		.getByRole("button", { name: "Проекты", exact: true })
		.click();
	await expect(
		session.page.getByRole("heading", { name: "Проекты" }),
	).toBeVisible();

	await startNewProject(session.page, "Второй план");
	await actionMenuToggle.click();
	await expect(secondaryActions).toBeVisible();
	await session.context.close();
});

test("EDITOR-E2E-17: the return compass stays hidden while any part of the drawing remains visible", async ({
	page: _page,
}, testInfo) => {
	const session = await openPersistentPhone(
		testInfo,
		"editor-return-to-drawing",
	);
	await session.page.goto("/");
	await startNewProject(session.page, "Вернуться к чертежу");
	await session.page.getByRole("button", { name: "Создать контур" }).click();
	await chooseEditorOption(session.page, "Рука и выбор");
	const plan = session.page.getByTestId("plan-canvas");
	const planContent = session.page.getByTestId("plan-content");
	const initialTransform = await planContent.getAttribute("transform");
	const planBox = await plan.boundingBox();
	if (!planBox) throw new Error("Plan canvas did not render");

	const panStart = {
		id: 191,
		x: planBox.x + planBox.width * 0.31,
		y: planBox.y + planBox.height * 0.41,
	};
	const cdp = await session.page.context().newCDPSession(session.page);
	try {
		await cdp.send("Input.dispatchTouchEvent", {
			touchPoints: [panStart],
			type: "touchStart",
		});
		await cdp.send("Input.dispatchTouchEvent", {
			touchPoints: [{ ...panStart, x: panStart.x + 96, y: panStart.y + 68 }],
			type: "touchMove",
		});
		await cdp.send("Input.dispatchTouchEvent", {
			touchPoints: [],
			type: "touchEnd",
		});
	} finally {
		await cdp.detach();
	}
	await expect(planContent).not.toHaveAttribute(
		"transform",
		initialTransform ?? "",
	);
	await expect(
		session.page.getByRole("button", {
			name: "Вернуться к чертежу",
			exact: true,
		}),
	).toHaveCount(0);
	await session.context.close();
});

test("EDITOR-E2E-18: rotation controls keep a large reachable touch target in 2D and 3D", async ({
	page: _page,
}, testInfo) => {
	const session = await openPersistentPhone(
		testInfo,
		"editor-large-rotation-target",
	);
	await session.page.goto("/");
	await startNewProject(session.page, "Крупный поворот");
	await session.page.getByRole("button", { name: "Создать контур" }).click();
	await chooseBuiltInGreybox(session.page, "Стол");
	const plan = session.page.getByTestId("plan-canvas");
	const planBox = await plan.boundingBox();
	if (!planBox) throw new Error("Plan canvas did not render");
	await clickPlanPointMm(session.page, 2000, 1500);
	await chooseEditorOption(session.page, "Рука и выбор");
	await session.page.getByTestId("schematic-item").click();
	const twoDimensionalHandle = session.page.locator("[data-rotation-handle]");
	const handleBox = await twoDimensionalHandle.boundingBox();
	if (!handleBox) throw new Error("2D rotation handle did not render");
	expect(Math.min(handleBox.width, handleBox.height)).toBeGreaterThanOrEqual(
		20,
	);
	const itemBox = await session.page
		.getByTestId("schematic-item")
		.boundingBox();
	const trackBox = await session.page
		.getByTestId("two-dimensional-rotation-track")
		.boundingBox();
	if (!itemBox || !trackBox)
		throw new Error("2D rotation track did not render");
	expect(
		Math.hypot(
			itemBox.x + itemBox.width / 2 - (trackBox.x + trackBox.width / 2),
			itemBox.y + itemBox.height / 2 - (trackBox.y + trackBox.height / 2),
		),
	).toBeLessThanOrEqual(2);
	await chooseEditorOption(session.page, "3D");
	const threeDimensionalBox = await session.page
		.getByTestId("three-dimensional-rotation-gizmo")
		.boundingBox();
	if (!threeDimensionalBox) throw new Error("3D rotation ring did not render");
	expect(threeDimensionalBox.width).toBeGreaterThanOrEqual(196);
	expect(threeDimensionalBox.height).toBeGreaterThanOrEqual(128);
	await expect(
		session.page.getByTestId("three-dimensional-rotation-hit-area"),
	).toHaveCSS("stroke-width", "48px");
	for (const label of [
		"Повернуть предмет на 45° против часовой стрелки",
		"Повернуть предмет на 45° по часовой стрелке",
	]) {
		const target = await session.page
			.getByRole("button", { name: label, exact: true })
			.boundingBox();
		if (!target) throw new Error("Expected an accessible 3D rotation target");
		expect(Math.min(target.width, target.height)).toBeGreaterThanOrEqual(48);
	}
	await session.context.close();
});

test("EDITOR-E2E-19: an item stays draggable through the centre while its 2D ring follows the live preview", async ({
	page: _page,
}, testInfo) => {
	const session = await openPersistentPhone(
		testInfo,
		"editor-centred-rotation-ring",
	);
	await session.page.goto("/");
	await startNewProject(session.page, "Кольцо по центру");
	await session.page.getByRole("button", { name: "Создать контур" }).click();
	await chooseBuiltInGreybox(session.page, "Стол");
	const plan = session.page.getByTestId("plan-canvas");
	const planBox = await plan.boundingBox();
	if (!planBox) throw new Error("Plan canvas did not render");
	await clickPlanPointMm(session.page, 2000, 1500);
	await chooseEditorOption(session.page, "Рука и выбор");
	const item = session.page.getByTestId("schematic-item");
	await item.click();
	const planTransformBeforeDrag = await session.page
		.getByTestId("plan-content")
		.getAttribute("transform");
	const beforeItem = await item.boundingBox();
	const beforeTrack = await session.page
		.getByTestId("two-dimensional-rotation-track")
		.boundingBox();
	if (!beforeItem || !beforeTrack)
		throw new Error("Selected item did not render");
	const centre = {
		x: beforeItem.x + beforeItem.width / 2,
		y: beforeItem.y + beforeItem.height / 2,
	};
	await session.page.mouse.move(centre.x, centre.y);
	await session.page.mouse.down();
	await session.page.mouse.move(centre.x + 34, centre.y + 22, { steps: 4 });
	const duringItem = await item.boundingBox();
	const duringTrack = await session.page
		.getByTestId("two-dimensional-rotation-track")
		.boundingBox();
	if (!duringItem || !duringTrack)
		throw new Error("Live item preview did not render");
	expect(
		Math.hypot(
			duringItem.x +
				duringItem.width / 2 -
				(beforeItem.x + beforeItem.width / 2),
			duringItem.y +
				duringItem.height / 2 -
				(beforeItem.y + beforeItem.height / 2),
		),
	).toBeGreaterThan(10);
	expect(
		Math.hypot(
			duringItem.x +
				duringItem.width / 2 -
				(duringTrack.x + duringTrack.width / 2),
			duringItem.y +
				duringItem.height / 2 -
				(duringTrack.y + duringTrack.height / 2),
		),
	).toBeLessThanOrEqual(2);
	expect(
		await session.page.getByTestId("plan-content").getAttribute("transform"),
	).toBe(planTransformBeforeDrag);
	await session.page.mouse.up();
	await session.context.close();
});

test("EDITOR-E2E-20: a two-finger translation pans the plan in construction and placement modes", async ({
	page: _page,
}, testInfo) => {
	const session = await openPersistentPhone(
		testInfo,
		"editor-two-finger-pan-tools",
	);
	await session.page.goto("/");
	await startNewProject(session.page, "Жесты во всех режимах");
	await session.page.getByRole("button", { name: "Создать контур" }).click();
	const plan = session.page.getByTestId("plan-canvas");
	const planContent = session.page.getByTestId("plan-content");
	const planBox = await plan.boundingBox();
	if (!planBox) throw new Error("Plan canvas did not render");
	const panWithTwoFingers = async (firstId: number, secondId: number) => {
		const first = {
			id: firstId,
			...(await planPointMm(session.page, { xMm: 800, zMm: 1100 })),
		};
		const second = {
			id: secondId,
			...(await planPointMm(session.page, { xMm: 2000, zMm: 2000 })),
		};
		const cdp = await session.page.context().newCDPSession(session.page);
		try {
			await cdp.send("Input.dispatchTouchEvent", {
				touchPoints: [first, second],
				type: "touchStart",
			});
			await cdp.send("Input.dispatchTouchEvent", {
				touchPoints: [
					{ ...first, x: first.x + 46, y: first.y - 28 },
					{ ...second, x: second.x + 46, y: second.y - 28 },
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
	};
	const revisionsBefore = await durableRevisionCount(session.page);
	await chooseEditorOption(session.page, "Стена");
	const beforeWallPan = await planContent.getAttribute("transform");
	await panWithTwoFingers(301, 302);
	await expect(planContent).not.toHaveAttribute(
		"transform",
		beforeWallPan ?? "",
	);
	await expect(plan.getByTestId("wall-draft")).toHaveCount(0);
	await chooseBuiltInGreybox(session.page, "Стол", false);
	const beforeItemPan = await planContent.getAttribute("transform");
	await panWithTwoFingers(303, 304);
	await expect(planContent).not.toHaveAttribute(
		"transform",
		beforeItemPan ?? "",
	);
	expect(await durableRevisionCount(session.page)).toBe(revisionsBefore);
	await session.context.close();
});

test("EDITOR-E2E-15: a nearby wall checkpoint locks the draft end before release", async ({
	page: _page,
}, testInfo) => {
	const session = await openPersistentPhone(
		testInfo,
		"editor-wall-snap-checkpoint",
	);
	await session.page.goto("/");
	await startNewProject(session.page, "Чекпоинт стены");
	await session.page.getByRole("button", { name: "Создать контур" }).click();
	await chooseEditorOption(session.page, "Стена");
	const segments = await session.page
		.getByTestId("wall-segment")
		.evaluateAll((elements) =>
			elements.map((element) => {
				const box = element.getBoundingClientRect();
				return {
					height: box.height,
					left: box.left,
					top: box.top,
					width: box.width,
				};
			}),
		);
	const horizontal = segments
		.filter((segment) => segment.width > segment.height)
		.sort((first, second) => first.top - second.top);
	const top = horizontal[0];
	const bottom = horizontal.at(-1);
	if (!top || !bottom)
		throw new Error("Starter contour did not render two horizontal walls");
	const start = { x: top.left + top.width / 2, y: top.top + top.height / 2 };
	const nearEnd = {
		x: bottom.left + bottom.width / 2,
		// At the larger phone-first drawing scale, 34 CSS px is about 400 mm:
		// outside the intentional 150 mm construction magnet.  Stay inside the
		// checkpoint radius without turning a nearby parallel wall into a snap.
		y: bottom.top + bottom.height / 2 - 8,
	};
	await session.page.mouse.move(start.x, start.y);
	await session.page.mouse.down();
	await session.page.mouse.move(nearEnd.x, nearEnd.y, { steps: 6 });
	const draft = session.page.getByTestId("wall-draft");
	const checkpoint = session.page.getByTestId("wall-snap-checkpoint");
	await expect(draft).toHaveCount(1);
	await expect(session.page.getByTestId("wall-alignment-guide")).toHaveCount(1);
	await expect(checkpoint).toBeVisible();
	const [draftEnd, checkpointPosition] = await Promise.all([
		draft.evaluate((line) => ({
			x: Number(line.getAttribute("x2")),
			y: Number(line.getAttribute("y2")),
		})),
		checkpoint.evaluate((circle) => ({
			x: Number(circle.getAttribute("cx")),
			y: Number(circle.getAttribute("cy")),
		})),
	]);
	expect(draftEnd).toEqual(checkpointPosition);
	await session.page.mouse.up();
	await expect(session.page.getByTestId("wall-count")).toHaveText("7 стен");
	await session.context.close();
});

test("EDITOR-E2E-03D: tapping a Room in Plan or 3D does not select it or expose a Room property editor", async ({
	page: _page,
}, testInfo) => {
	const session = await openPersistentPhone(testInfo, "editor-room-properties");
	await session.page.goto("/");
	await startNewProject(session.page, "Параметры помещения");
	await session.page.getByRole("button", { name: "Создать контур" }).click();

	const roomFace = session.page.getByTestId("room-face").first();
	const roomBox = await roomFace.boundingBox();
	if (!roomBox) throw new Error("Derived room face did not render");
	const revisionsBefore = await durableRevisionCount(session.page);
	// The grid is deliberately above the visual room fill. A real user taps the
	// plan coordinate rather than an SVG rect, so exercise that exact path.
	await session.page.mouse.click(
		roomBox.x + roomBox.width / 2,
		roomBox.y + roomBox.height / 2,
	);
	await expect(
		session.page.getByRole("complementary", {
			name: "Свойства выбранного помещения",
		}),
	).toHaveCount(0);
	await expect(
		session.page.getByLabel("Название выбранного помещения"),
	).toHaveCount(0);
	expect(await durableRevisionCount(session.page)).toBe(revisionsBefore);

	await chooseEditorOption(session.page, "3D");
	const scene = session.page.getByTestId("three-dimensional-canvas");
	await expect(scene).toBeVisible();
	const sceneBox = await scene.boundingBox();
	if (!sceneBox) throw new Error("3D canvas did not render");
	await scene.click({
		position: { x: sceneBox.width / 2, y: sceneBox.height / 2 },
	});
	await expect(
		session.page.getByTestId("three-dimensional-room-selection"),
	).toHaveCount(0);
	await expect(session.page.getByLabel("Выбрать помещение в 3D")).toHaveCount(
		0,
	);
	await expect(
		session.page.getByRole("complementary", {
			name: "Свойства выбранного помещения",
		}),
	).toHaveCount(0);
	expect(await durableRevisionCount(session.page)).toBe(revisionsBefore);
	await session.context.close();
});

test("ROOM-E2E-01: the separate phone Room directory saves only type and height while preserving legacy names as one durable command", async ({
	page: _page,
}, testInfo) => {
	const session = await openPersistentPhone(
		testInfo,
		"room-metadata-directory",
		{ freshProfile: true },
	);
	await session.page.goto("/");
	await startNewProject(session.page, "Назначение комнат");
	await session.page.getByRole("button", { name: "Создать контур" }).click();
	await chooseEditorOption(session.page, "Стена");
	await drawCentreDivider(session.page);
	await expect(session.page.getByTestId("room-face")).toHaveCount(2);
	await chooseEditorOption(session.page, "Рука и выбор");

	await session.page
		.getByRole("button", { name: "Помещения", exact: true })
		.click();
	const directory = session.page.getByRole("dialog", { name: "Помещения" });
	await expect(directory).toBeVisible();
	await expect(directory.getByTestId("room-directory-sheet")).toBeVisible();
	await expect(
		directory.getByTestId("room-directory-sheet-handle"),
	).toBeVisible();
	await expect(
		directory
			.getByRole("navigation", { name: "Список помещений" })
			.getByRole("button")
			.nth(0),
	).toHaveAttribute("aria-pressed", "true");
	await directory
		.getByRole("navigation", { name: "Список помещений" })
		.getByRole("button")
		.nth(1)
		.click();
	await expect(
		directory
			.getByRole("navigation", { name: "Список помещений" })
			.getByRole("button")
			.nth(1),
	).toHaveAttribute("aria-pressed", "true");
	await expect(directory.getByLabel("Ширина, мм")).toHaveCount(0);
	await expect(directory.getByLabel("Глубина, мм")).toHaveCount(0);

	const revisionsBefore = await durableRevisionCount(session.page);
	const namesBefore = (await durableRooms(session.page)).map(
		(room) => room.name,
	);
	await directory.getByLabel("Высота помещения, мм").fill("499");
	await directory.getByRole("button", { name: "Сохранить помещение" }).click();
	await expect(directory.getByRole("alert")).toContainText(
		"от 500 до 10 000 мм",
	);
	await expect(directory.getByLabel("Высота помещения, мм")).toHaveValue(
		"2600",
	);
	expect(await durableRevisionCount(session.page)).toBe(revisionsBefore);

	await expect(directory.getByLabel("Название помещения")).toHaveCount(0);
	await directory.getByLabel("Тип помещения").selectOption("kitchen");
	await directory.getByLabel("Высота помещения, мм").fill("2800");
	await directory.getByRole("button", { name: "Сохранить помещение" }).click();
	await expect(directory.getByRole("status")).toHaveText(
		"Помещение сохранено локально.",
	);
	await expect
		.poll(() => durableRevisionCount(session.page))
		.toBe(revisionsBefore + 1);
	await expect(
		directory
			.getByRole("navigation", { name: "Список помещений" })
			.getByRole("button")
			.nth(0),
	).toContainText("2600 мм");
	await expect(
		directory.getByRole("button", { name: "Кухня", exact: true }),
	).toHaveAttribute("aria-pressed", "true");

	await directory.getByRole("button", { name: "Закрыть помещения" }).click();
	const kitchenPlanLabel = session.page
		.getByTestId("room-label")
		.filter({ hasText: "Кухня" });
	await expect(kitchenPlanLabel).toHaveCount(1);
	await expect(kitchenPlanLabel).toBeHidden();
	await session.page.reload();
	await openProjectFromHub(session.page, "Назначение комнат");
	await session.page
		.getByRole("button", { name: "Помещения", exact: true })
		.click();
	const reopened = session.page.getByRole("dialog", { name: "Помещения" });
	await reopened.getByRole("button", { name: "Кухня", exact: true }).click();
	await expect(reopened.getByLabel("Название помещения")).toHaveCount(0);
	await expect(reopened.getByLabel("Тип помещения")).toHaveValue("kitchen");
	await expect(reopened.getByLabel("Высота помещения, мм")).toHaveValue("2800");
	expect((await durableRooms(session.page)).map((room) => room.name)).toEqual(
		namesBefore,
	);
	await reopened.getByRole("button", { name: "Закрыть помещения" }).click();

	await chooseEditorOption(session.page, "3D");
	await expect(
		session.page.getByTestId("three-dimensional-canvas"),
	).toBeVisible({ timeout: 15_000 });
	await expect(
		session.page.getByTestId("three-dimensional-metrics"),
	).toContainText("2800 мм");
	await session.context.close();
});

async function expectInspectorControlsToFit(surface: Locator) {
	expect(
		await surface.evaluate(
			(element) => element.scrollWidth <= element.clientWidth,
		),
	).toBe(true);
	for (const control of await surface.locator("button, input, select").all()) {
		await control.scrollIntoViewIfNeeded();
		const box = await control.boundingBox();
		expect(box).not.toBeNull();
		if (!box) throw new Error("Expected inspector control bounds");
		expect(box.height).toBeGreaterThanOrEqual(44);
		expect(box.x).toBeGreaterThanOrEqual(0);
		expect(box.x + box.width).toBeLessThanOrEqual(360);
		// A scrollable surface must expose each action to a real pointer,
		// including controls near a sticky heading at enlarged text sizes.
		expect(
			await control.evaluate((element) => {
				const rect = element.getBoundingClientRect();
				const hit = document.elementFromPoint(
					rect.x + rect.width / 2,
					rect.y + rect.height / 2,
				);
				return hit === element || (hit !== null && element.contains(hit));
			}),
		).toBe(true);
	}
}

test("PANEL-E2E-01: Room properties retain focus and the selected room through saving, and fit enlarged text", async ({
	page: _page,
}, testInfo) => {
	const { page, context } = await openPersistentPhone(testInfo, "room-panel", {
		freshProfile: true,
	});
	await page.setViewportSize({ width: 393, height: 852 });
	await page.goto("/");
	await startNewProject(page, "Комнаты квартиры");
	await page.getByRole("button", { name: "Создать контур" }).click();
	await chooseEditorOption(page, "Стена");
	await drawCentreDivider(page);
	await chooseEditorOption(page, "Рука и выбор");
	const trigger = page.getByRole("button", { name: "Комната", exact: true });
	await trigger.click();
	const directory = page.getByRole("dialog", { name: "Помещения" });
	const save = directory.getByRole("button", { name: "Сохранить помещение" });
	const close = directory.getByRole("button", { name: "Закрыть помещения" });
	await expect(directory).toBeFocused();
	await page.keyboard.press("Shift+Tab");
	await expect(save).toBeFocused();
	await page.keyboard.press("Tab");
	await expect(close).toBeFocused();
	await page.keyboard.press("Escape");
	await expect(directory).toHaveCount(0);
	await expect(trigger).toBeFocused();
	await trigger.click();
	await expect(close).toHaveCSS("min-height", "44px");
	await expect(directory.getByTestId("room-directory-sheet")).toHaveCSS(
		"background-color",
		"rgb(255, 255, 255)",
	);
	await expect(directory.getByLabel("Тип помещения")).toHaveCSS(
		"font-size",
		"16px",
	);
	await expect(directory.getByLabel("Название помещения")).toHaveCount(0);
	await directory.getByLabel("Тип помещения").selectOption("kitchen");
	await directory.getByLabel("Высота помещения, мм").fill("2800");
	const before = await durableRevisionCount(page);
	await page.evaluate(() =>
		(
			window as unknown as {
				__interiorsTestControl: { setDelay(ms: number): void };
			}
		).__interiorsTestControl.setDelay(1800),
	);
	await save.click();
	await expect(
		directory.getByRole("button", { name: "Сохраняем…" }),
	).toBeDisabled();
	await expect(
		directory
			.getByRole("navigation", { name: "Список помещений" })
			.getByRole("button")
			.nth(1),
	).toBeDisabled();
	await expect(close).toBeDisabled();
	await page.keyboard.press("Escape");
	await expect(directory).toBeVisible();
	await expect(directory.getByRole("status")).toHaveText(
		"Помещение сохранено локально.",
	);
	await page.evaluate(() =>
		(
			window as unknown as {
				__interiorsTestControl: { setDelay(ms: number): void };
			}
		).__interiorsTestControl.setDelay(0),
	);
	expect(await durableRevisionCount(page)).toBe(before + 1);
	await expect(
		directory.getByRole("button", { name: "Кухня", exact: true }),
	).toHaveAttribute("aria-pressed", "true");
	await expect(
		directory
			.getByRole("navigation", { name: "Список помещений" })
			.getByRole("button")
			.nth(1),
	).toContainText("2600 мм");
	await directory.getByTestId("room-directory-sheet").evaluate((element) => {
		element.scrollTop = 0;
	});
	await page.screenshot({
		path: testInfo.outputPath("room-properties.png"),
		scale: "css",
	});
	await page.setViewportSize({ width: 360, height: 480 });
	await page.evaluate(() => {
		document.documentElement.style.fontSize = "200%";
	});
	await expectInspectorControlsToFit(
		directory.getByTestId("room-directory-sheet"),
	);
	await page.screenshot({
		path: testInfo.outputPath("room-properties-large-text.png"),
		scale: "css",
	});
	await close.click();
	await expect(trigger).toBeFocused();
	await context.close();
});

test("PANEL-E2E-02: Plan dimensions focus on open, explain invalid dimensions inside the sheet and fit enlarged text", async ({
	page: _page,
}, testInfo) => {
	const { page, context } = await openPersistentPhone(testInfo, "plan-panel", {
		freshProfile: true,
	});
	await page.setViewportSize({ width: 393, height: 852 });
	await page.goto("/");
	await startNewProject(page, "Размеры квартиры");
	await page.getByRole("button", { name: "Создать контур" }).click();
	const menu = page.getByRole("button", { name: "Открыть остальные действия" });
	await menu.click();
	await page
		.getByRole("dialog", { name: "Остальные действия редактора" })
		.getByRole("button", { name: "Размеры плана", exact: true })
		.click();
	const panel = page.getByTestId("plan-dimensions-sheet");
	await expect(panel).toBeFocused();
	await expect(panel).toHaveCSS("background-color", "rgb(255, 255, 255)");
	const history = page.getByRole("group", {
		name: "История изменений",
		exact: true,
	});
	const panelBounds = await panel.boundingBox();
	const historyBounds = await history.boundingBox();
	if (!panelBounds || !historyBounds)
		throw new Error("Expected plan inspector and canvas history");
	expect(panelBounds.y + panelBounds.height).toBeLessThanOrEqual(
		historyBounds.y,
	);
	await expect(panel.getByLabel("Высота, мм")).toHaveCSS("font-size", "16px");
	await expect(
		panel.getByRole("button", { name: "Скрыть размеры плана" }),
	).toHaveCSS("min-height", "44px");
	const before = await durableRevisionCount(page);
	await panel.getByLabel("Высота, мм").fill("0");
	await panel.getByRole("button", { name: "Применить размеры" }).click();
	await expect(panel.getByRole("alert")).toContainText(
		"Введите целые положительные миллиметры.",
	);
	await expect(page.getByRole("alert")).toHaveCount(1);
	await expect(panel.getByLabel("Высота, мм")).toHaveAttribute(
		"aria-describedby",
		(await panel.getByRole("alert").getAttribute("id")) ?? "missing",
	);
	expect(await durableRevisionCount(page)).toBe(before);
	await page.screenshot({
		path: testInfo.outputPath("plan-dimensions-error.png"),
		scale: "css",
	});
	await panel.getByLabel("Высота, мм").fill("2800");
	await panel.getByLabel("Ширина, мм").fill("4500");
	await panel.getByRole("button", { name: "Применить размеры" }).click();
	await expect(panel.getByRole("alert")).toHaveCount(0);
	await expect(panel.getByTestId("plan-width")).toHaveText("4500 мм");
	await expect.poll(() => durableRevisionCount(page)).toBe(before + 1);
	await page.screenshot({
		path: testInfo.outputPath("plan-dimensions.png"),
		scale: "css",
	});
	await page.setViewportSize({ width: 360, height: 480 });
	await page.evaluate(() => {
		document.documentElement.style.fontSize = "200%";
	});
	const safeArea = await context.newCDPSession(page);
	await safeArea.send("Emulation.setSafeAreaInsetsOverride", {
		insets: { top: 59, bottom: 34, left: 0, right: 0 },
	});
	await expect
		.poll(async () => {
			const headerBox = await page.getByTestId("editor-top-bar").boundingBox();
			const panelBox = await panel.boundingBox();
			if (!headerBox || !panelBox)
				throw new Error("Expected the plan panel and safe-area header");
			return panelBox.y >= headerBox.y + headerBox.height;
		})
		.toBe(true);
	await expectInspectorControlsToFit(panel);
	const applyControl = panel.getByRole("button", {
		name: "Применить размеры",
		exact: true,
	});
	expect(
		await applyControl.evaluate((element) => {
			const bounds = element.getBoundingClientRect();
			return [0.2, 0.8].every((x) =>
				[0.2, 0.8].every((y) => {
					const hit = document.elementFromPoint(
						bounds.x + bounds.width * x,
						bounds.y + bounds.height * y,
					);
					return hit === element || (hit !== null && element.contains(hit));
				}),
			);
		}),
	).toBe(true);
	const applyBounds = await applyControl.boundingBox();
	const enlargedPanelBounds = await panel.boundingBox();
	if (!applyBounds || !enlargedPanelBounds)
		throw new Error("Expected enlarged plan controls");
	expect(applyBounds.y).toBeGreaterThanOrEqual(enlargedPanelBounds.y);
	expect(applyBounds.y + applyBounds.height).toBeLessThanOrEqual(
		enlargedPanelBounds.y + enlargedPanelBounds.height,
	);
	await page.screenshot({
		path: testInfo.outputPath("plan-dimensions-large-text.png"),
		scale: "css",
	});
	await page.keyboard.press("Escape");
	await expect(panel).toBeHidden();
	await expect(menu).toBeFocused();
	await context.close();
});

test("PANEL-E2E-03: a writer takeover disables Plan dimensions and retires an open Room directory", async ({
	page: _page,
}, testInfo) => {
	const { page, context } = await openPersistentPhone(
		testInfo,
		"inspector-writer",
		{ freshProfile: true },
	);
	await page.setViewportSize({ width: 393, height: 852 });
	await page.goto("/");
	await startNewProject(page, "Смена редактора");
	await page.getByRole("button", { name: "Создать контур" }).click();
	await page
		.getByRole("button", { name: "Открыть остальные действия" })
		.click();
	await page
		.getByRole("dialog", { name: "Остальные действия редактора" })
		.getByRole("button", { name: "Размеры плана", exact: true })
		.click();
	const before = await durableRevisionCount(page);
	const other = await context.newPage();
	await other.goto("/");
	await openProjectFromHub(other, "Смена редактора");
	await other
		.getByRole("button", { name: "Взять редактирование на себя" })
		.click();
	await other.getByRole("button", { name: "Подтвердить перехват" }).click();
	await page.bringToFront();
	await page.evaluate(() =>
		document.dispatchEvent(new Event("visibilitychange")),
	);
	await expect(page.getByTestId("writer-lease-notice")).toBeVisible();
	const panel = page.getByTestId("plan-dimensions-sheet");
	for (const input of await panel.getByRole("textbox").all())
		await expect(input).toBeDisabled();
	await expect(
		panel.getByRole("button", { name: "Применить размеры" }),
	).toBeDisabled();
	await page
		.getByRole("button", { name: "Взять редактирование на себя" })
		.click();
	await page.getByRole("button", { name: "Подтвердить перехват" }).click();
	await expect(
		panel.getByRole("button", { name: "Применить размеры" }),
	).toBeEnabled();
	await panel.getByRole("button", { name: "Скрыть размеры плана" }).click();
	await page.getByRole("button", { name: "Комната", exact: true }).click();
	await other.bringToFront();
	await other.evaluate(() =>
		document.dispatchEvent(new Event("visibilitychange")),
	);
	await other
		.getByRole("button", { name: "Взять редактирование на себя" })
		.click();
	await other.getByRole("button", { name: "Подтвердить перехват" }).click();
	await page.bringToFront();
	await page.evaluate(() =>
		document.dispatchEvent(new Event("visibilitychange")),
	);
	await expect(page.getByRole("dialog", { name: "Помещения" })).toHaveCount(0);
	await page
		.getByRole("button", { name: "Взять редактирование на себя" })
		.click();
	await page.getByRole("button", { name: "Подтвердить перехват" }).click();
	await expect(page.getByRole("dialog", { name: "Помещения" })).toHaveCount(0);
	expect(await durableRevisionCount(page)).toBe(before);
	await context.close();
});

test("PANEL-E2E-04: Plan validation and its open state do not leak into another Project", async ({
	page: _page,
}, testInfo) => {
	const { page, context } = await openPersistentPhone(
		testInfo,
		"inspector-project-switch",
		{ freshProfile: true },
	);
	await page.goto("/");
	await startNewProject(page, "Первый план");
	await page.getByRole("button", { name: "Создать контур" }).click();
	const back = page.getByRole("button", { name: "Вернуться к проектам" });
	await back.click();
	await startNewProject(page, "Второй план");
	await page.getByRole("button", { name: "Создать контур" }).click();
	await page
		.getByRole("button", { name: "Открыть остальные действия" })
		.click();
	await page
		.getByRole("dialog", { name: "Остальные действия редактора" })
		.getByRole("button", { name: "Размеры плана", exact: true })
		.click();
	const panel = page.getByTestId("plan-dimensions-sheet");
	await panel.getByLabel("Высота, мм").fill("0");
	await panel.getByRole("button", { name: "Применить размеры" }).click();
	await expect(panel.getByRole("alert")).toBeVisible();
	await back.click();
	await openProjectFromHub(page, "Первый план");
	await expect(panel).toBeHidden();
	await expect(page.getByRole("alert")).toHaveCount(0);
	await page
		.getByRole("button", { name: "Открыть остальные действия" })
		.click();
	await page
		.getByRole("dialog", { name: "Остальные действия редактора" })
		.getByRole("button", { name: "Размеры плана", exact: true })
		.click();
	await expect(panel.getByRole("alert")).toHaveCount(0);
	await expect(panel.getByLabel("Высота, мм")).toHaveValue("2600");
	await expect(panel.getByLabel("Высота, мм")).not.toHaveAttribute(
		"aria-invalid",
		"true",
	);
	await context.close();
});

test("ROOM-E2E-01A: the modal Room directory keeps keyboard focus inside its controls", async ({
	page: _page,
}, testInfo) => {
	const session = await openPersistentPhone(
		testInfo,
		"room-metadata-directory-focus",
		{ freshProfile: true },
	);
	await session.page.goto("/");
	await startNewProject(session.page, "Фокус помещений");
	await session.page.getByRole("button", { name: "Создать контур" }).click();
	await chooseEditorOption(session.page, "Рука и выбор");
	await session.page
		.getByRole("button", { name: "Помещения", exact: true })
		.click();

	const directory = session.page.getByRole("dialog", { name: "Помещения" });
	const close = directory.getByRole("button", { name: "Закрыть помещения" });
	const save = directory.getByRole("button", { name: "Сохранить помещение" });
	await expect(directory).toBeVisible();
	await save.focus();
	await session.page.keyboard.press("Tab");
	await expect(close).toBeFocused();
	await session.page.keyboard.press("Shift+Tab");
	await expect(save).toBeFocused();
	await session.context.close();
});

test("RECONCILIATION-E2E-01R: lowering Room height resolves its affected Window in one atomic command", async ({
	page: _page,
}, testInfo) => {
	const session = await openPersistentPhone(
		testInfo,
		"room-height-opening-conflict",
		{ freshProfile: true },
	);
	await session.page.setViewportSize({ width: 393, height: 852 });
	await session.page.goto("/");
	await startNewProject(session.page, "Высота помещения и окно");
	await session.page.getByRole("button", { name: "Создать контур" }).click();
	const hostWall = session.page
		.locator('[data-testid="wall-segment"][data-wall-kind="exterior"]')
		.first();
	await hostWall.click();
	await loadOpeningFixtureOnSelectedWall(session.page, {
		heightMm: 1200,
		kind: "Window",
		offsetMm: 2000,
		sillMm: 900,
		widthMm: 1200,
	});
	await expect(session.page.getByTestId("window-opening")).toHaveCount(1);
	await session.page.reload();
	await openProjectFromHub(session.page, "Высота помещения и окно");

	await session.page
		.getByRole("button", { name: "Помещения", exact: true })
		.click();
	const directory = session.page.getByRole("dialog", { name: "Помещения" });
	const revisionsBefore = await durableRevisionCount(session.page);
	await directory.getByLabel("Высота помещения, мм").fill("2000");
	await directory.getByRole("button", { name: "Сохранить помещение" }).click();
	const conflict = directory.getByTestId(
		"room-height-opening-conflict-preview",
	);
	await expect(conflict).toContainText("1 проём");
	await expect(directory.getByLabel("Название помещения")).toHaveCount(0);
	await expect(directory.getByLabel("Тип помещения")).toBeDisabled();
	await expect(directory.getByLabel("Высота помещения, мм")).toBeDisabled();
	await expect(
		conflict.getByRole("button", {
			name: "Уменьшить проём до 1100 мм",
			exact: true,
		}),
	).toBeVisible();
	await expect(
		conflict.getByRole("button", { name: "Удалить проём", exact: true }),
	).toBeVisible();
	expect(await durableRevisionCount(session.page)).toBe(revisionsBefore);
	await expect
		.poll(() => durableWindowOpenings(session.page))
		.toEqual([expect.objectContaining({ heightMm: 1200, sillMm: 900 })]);

	await conflict.scrollIntoViewIfNeeded();
	await session.page.screenshot({
		path: testInfo.outputPath("room-height-conflict.png"),
		scale: "css",
	});
	await session.page.setViewportSize({ width: 360, height: 480 });
	await session.page.evaluate(() => {
		document.documentElement.style.fontSize = "200%";
	});
	await expectInspectorControlsToFit(
		directory.getByTestId("room-directory-sheet"),
	);
	await session.page.screenshot({
		path: testInfo.outputPath("room-height-conflict-large-text.png"),
		scale: "css",
	});
	await session.page.setViewportSize({ width: 393, height: 852 });
	await session.page.evaluate(() => {
		document.documentElement.style.fontSize = "";
	});
	await conflict.getByRole("button", { name: "Отмена", exact: true }).click();
	await expect(conflict).toHaveCount(0);
	await expect(directory.getByLabel("Высота помещения, мм")).toHaveValue(
		"2600",
	);
	expect(await durableRevisionCount(session.page)).toBe(revisionsBefore);

	await directory.getByLabel("Высота помещения, мм").fill("2000");
	await directory.getByRole("button", { name: "Сохранить помещение" }).click();
	await conflict
		.getByRole("button", {
			name: "Уменьшить проём до 1100 мм",
			exact: true,
		})
		.click();
	await conflict
		.getByRole("button", {
			name: "Сохранить помещение и изменить 1 проём",
			exact: true,
		})
		.click();
	await expect(conflict).toHaveCount(0);
	await expect(directory.getByRole("status")).toHaveText(
		"Помещение и проёмы сохранены локально.",
	);
	await expect
		.poll(() => durableRevisionCount(session.page))
		.toBe(revisionsBefore + 1);
	await expect
		.poll(() => durableWindowOpenings(session.page))
		.toEqual([expect.objectContaining({ heightMm: 1100, sillMm: 900 })]);

	await directory.getByLabel("Высота помещения, мм").fill("1900");
	await directory.getByRole("button", { name: "Сохранить помещение" }).click();
	await expect(conflict).toContainText("1 проём");
	await conflict
		.getByRole("button", { name: "Удалить проём", exact: true })
		.click();
	const revisionBeforeFailure = (await durableResourceManifests(session.page))
		.currentRevisionId;
	await session.page.evaluate(() =>
		(
			window as unknown as {
				__interiorsTestControl: { setFault(point: string): void };
			}
		).__interiorsTestControl.setFault("before-pointer-quota"),
	);
	await conflict
		.getByRole("button", {
			name: "Сохранить помещение и изменить 1 проём",
			exact: true,
		})
		.click();
	await expect(conflict).toHaveCount(0);
	const failure = session.page.getByTestId("persistence-failure-notice");
	await expect(failure).toBeVisible();
	await expect(directory).not.toHaveAttribute("aria-modal", "true");
	await expect(directory.getByLabel("Высота помещения, мм")).toHaveValue(
		"1900",
	);
	expect((await durableResourceManifests(session.page)).currentRevisionId).toBe(
		revisionBeforeFailure,
	);
	await expect
		.poll(() => durableWindowOpenings(session.page))
		.toEqual([expect.objectContaining({ heightMm: 1100, sillMm: 900 })]);
	await session.page.screenshot({
		path: testInfo.outputPath("room-conflict-save-failure.png"),
		scale: "css",
	});
	await failure
		.getByRole("button", { name: "Повторить сохранение", exact: true })
		.click();
	await expect(failure).toHaveCount(0);
	await expect(directory).toHaveAttribute("aria-modal", "true");
	await expect(directory.getByLabel("Высота помещения, мм")).toHaveValue(
		"1900",
	);

	await expect
		.poll(
			async () =>
				(await durableResourceManifests(session.page)).currentRevisionId,
		)
		.not.toBe(revisionBeforeFailure);
	await expect.poll(() => durableWindowOpenings(session.page)).toEqual([]);
	await session.context.close();
});

test("REFERENCE-APARTMENT-E2E-01: a furnished four-room apartment survives Plan, 3D cutaway, and reload on a phone", async ({
	page: _page,
}, testInfo) => {
	test.setTimeout(180_000);
	const session = await openPersistentPhone(testInfo, "reference-apartment", {
		freshProfile: true,
	});
	await session.page.setViewportSize({ height: 852, width: 393 });
	await session.page.goto("/");
	await startNewProject(session.page, "Эталонная квартира");
	await session.page.getByLabel("Ширина, мм").fill("6000");
	await session.page.getByLabel("Глубина, мм").fill("4800");
	await session.page.getByLabel("Высота, мм").fill("2600");
	await session.page.getByRole("button", { name: "Создать контур" }).click();

	await chooseEditorOption(session.page, "Стена");
	await drawCentreDivider(session.page);
	// A completed wall returns the compact dock to selection. Re-enter the
	// explicit wall tool before the second divider, just as a phone user does.
	await chooseEditorOption(session.page, "Стена");
	await drawCentreCrossbar(session.page);
	await expect(session.page.getByTestId("room-count")).toHaveText("4 комнаты");
	await expect(session.page.getByTestId("wall-count")).toHaveText("12 стен");
	await chooseEditorOption(session.page, "Рука и выбор");
	await expect(session.page.getByLabel("Характеристики плана")).toHaveCount(0);

	const exteriorWalls = session.page.locator(
		'[data-testid="wall-segment"][data-wall-kind="exterior"]',
	);
	await expect(exteriorWalls).toHaveCount(8);
	const openings: readonly OpeningCreationInput[] = [
		{
			heightMm: 2100,
			kind: "Door",
			offsetMm: 600,
			sillMm: 0,
			widthMm: 900,
		},
		{
			heightMm: 1200,
			kind: "Window",
			offsetMm: 600,
			sillMm: 900,
			widthMm: 1200,
		},
		{
			heightMm: 2100,
			kind: "Door",
			offsetMm: 600,
			sillMm: 0,
			widthMm: 900,
		},
		{
			heightMm: 1200,
			kind: "Window",
			offsetMm: 600,
			sillMm: 900,
			widthMm: 1200,
		},
	];
	for (const [index, opening] of openings.entries()) {
		await exteriorWalls.nth(index).click();
		await loadOpeningFixtureOnSelectedWall(
			session.page,
			opening,
			index === 1
				? testInfo.outputPath("reference-apartment-window-fixture.png")
				: undefined,
		);
		await chooseEditorOption(session.page, "Рука и выбор");
	}
	await expect(session.page.getByTestId("door-opening")).toHaveCount(2);
	await expect(session.page.getByTestId("window-opening")).toHaveCount(2);
	// Doors remain calm neutral openings; a window gains two parallel panes so
	// the furnished Plan can be read at a glance without a swing/leaf symbol.
	await expect(session.page.getByTestId("window-opening-pane")).toHaveCount(4);
	await expect(
		session.page.getByTestId("door-opening").getByTestId("window-opening-pane"),
	).toHaveCount(0);
	const windowPaneLines = await session.page
		.getByTestId("window-opening-pane")
		.evaluateAll((panes) =>
			panes.map((pane) => {
				const line = pane as SVGLineElement;
				return {
					x1: Number.parseFloat(line.getAttribute("x1") ?? "NaN"),
					x2: Number.parseFloat(line.getAttribute("x2") ?? "NaN"),
					y1: Number.parseFloat(line.getAttribute("y1") ?? "NaN"),
					y2: Number.parseFloat(line.getAttribute("y2") ?? "NaN"),
				};
			}),
		);
	for (let index = 0; index < windowPaneLines.length; index += 2) {
		const first = windowPaneLines[index];
		const second = windowPaneLines[index + 1];
		if (!first || !second) {
			throw new Error("A Window needs exactly two pane lines");
		}
		expect(first.x2 - first.x1).toBeCloseTo(second.x2 - second.x1, 6);
		expect(first.y2 - first.y1).toBeCloseTo(second.y2 - second.y1, 6);
		expect(
			Math.hypot(first.x1 - second.x1, first.y1 - second.y1),
		).toBeGreaterThan(1);
	}

	const rooms = await orderedRoomFaceCentres(session.page);
	const itemPlacements = [
		{ label: "Винтажный стул Zen", roomIndex: 0 },
		{ label: "Обеденное кресло", roomIndex: 1 },
		{ label: "Деревянный комод", roomIndex: 2 },
	] as const;
	expect(rooms).toHaveLength(4);
	for (const { label, roomIndex } of itemPlacements) {
		await choosePreloadedCatalogAsset(session.page, label, false);
		const room = (await orderedRoomFaceCentres(session.page))[roomIndex];
		if (!room)
			throw new Error("Expected the same usable Room after catalog handoff");
		await session.page.mouse.click(room.x, room.y);
		await expect(
			session.page.getByTestId("item-placement-preview"),
		).toHaveAttribute("data-placement-valid", "true");
		if (label === "Деревянный комод") {
			await session.page.screenshot({
				path: testInfo.outputPath("reference-apartment-placement.png"),
				scale: "css",
			});
		}
		const revisionsBeforePlacement = await durableRevisionCount(session.page);
		await session.page
			.getByRole("button", { name: "Подтвердить размещение предмета" })
			.click();
		await expect
			.poll(() => durableRevisionCount(session.page))
			.toBe(revisionsBeforePlacement + 1);
	}
	await expect(session.page.getByTestId("item-count")).toHaveText("3 предмета");
	const placementStatus = session.page.getByTestId(
		"item-placement-durable-status",
	);
	await expect(placementStatus).toHaveText("Предмет размещён и сохранён.");
	await expect(placementStatus).toBeHidden({ timeout: 5_000 });
	await chooseEditorOption(session.page, "Рука и выбор");

	const planScreenshot = testInfo.outputPath("reference-apartment-plan.png");
	await session.page.screenshot({ path: planScreenshot });
	await testInfo.attach("reference-apartment-plan", {
		contentType: "image/png",
		path: planScreenshot,
	});

	const revisionsBeforeViewChange = await durableRevisionCount(session.page);
	const furnishedItems = await durableFloorItems(session.page);
	const furnishedRooms = await durableRooms(session.page);
	expect(furnishedRooms).toHaveLength(4);
	expect(furnishedItems).toHaveLength(3);
	expect(
		new Set(furnishedItems.map((item) => item.assetDefinitionId)).size,
	).toBe(3);
	expect(new Set(furnishedItems.map((item) => item.roomId)).size).toBe(3);

	await chooseEditorOption(session.page, "3D");
	await expect(
		session.page.getByTestId("three-dimensional-canvas"),
	).toBeVisible({ timeout: 15_000 });
	await expect(
		session.page.getByTestId("three-dimensional-cutaway"),
	).toHaveText("Авто: ближние внешние стены скрываются");
	await expect(
		session.page.getByTestId("three-dimensional-cutaway-notice"),
	).toHaveCount(0);
	await expect(
		session.page.getByText("3 предмета в плане", { exact: true }),
	).toHaveText("3 предмета в плане");
	await expect(
		session.page.getByText("3 предмета в плане", { exact: true }),
	).toBeHidden();
	await expect(
		session.page.getByTestId("three-dimensional-camera"),
	).toContainText("0.000:1.000:");
	await expect(
		session.page.getByTestId("three-dimensional-custom-glb-status"),
	).toHaveText("rendered:3", { timeout: 15_000 });
	expect(await durableRevisionCount(session.page)).toBe(
		revisionsBeforeViewChange,
	);

	await session.page.reload();
	await openProjectFromHub(session.page, "Эталонная квартира");
	await expect(session.page.getByTestId("room-count")).toHaveText("4 комнаты");
	await expect(session.page.getByTestId("door-opening")).toHaveCount(2);
	await expect(session.page.getByTestId("window-opening")).toHaveCount(2);
	await expect(session.page.getByTestId("item-count")).toHaveText("3 предмета");
	expect(await durableRevisionCount(session.page)).toBe(
		revisionsBeforeViewChange,
	);
	expect(await durableFloorItems(session.page)).toEqual(furnishedItems);

	await chooseEditorOption(session.page, "3D");
	await expect(
		session.page.getByTestId("three-dimensional-canvas"),
	).toBeVisible({ timeout: 15_000 });
	await expect(
		session.page.getByTestId("three-dimensional-cutaway"),
	).toHaveText("Авто: ближние внешние стены скрываются");
	await expect(
		session.page.getByTestId("three-dimensional-cutaway-notice"),
	).toHaveCount(0);
	await expect(
		session.page.getByText("3 предмета в плане", { exact: true }),
	).toHaveText("3 предмета в плане");
	await expect(
		session.page.getByText("3 предмета в плане", { exact: true }),
	).toBeHidden();
	await expect(
		session.page.getByTestId("three-dimensional-camera"),
	).toContainText("0.000:1.000:");
	await expect(
		session.page.getByTestId("three-dimensional-custom-glb-status"),
	).toHaveText("rendered:3", { timeout: 15_000 });

	const threeDimensionalScreenshot = testInfo.outputPath(
		"reference-apartment-3d-reopened.png",
	);
	await session.page.screenshot({ path: threeDimensionalScreenshot });
	await testInfo.attach("reference-apartment-3d-reopened", {
		contentType: "image/png",
		path: threeDimensionalScreenshot,
	});

	const threeDimensionalCanvas = session.page.getByTestId(
		"three-dimensional-canvas",
	);
	const threeDimensionalCanvasBox = await threeDimensionalCanvas.boundingBox();
	if (!threeDimensionalCanvasBox) {
		throw new Error(
			"3D canvas did not render for the furnished apartment orbit",
		);
	}
	const cameraBeforeOrbit = await session.page
		.getByTestId("three-dimensional-camera")
		.textContent();
	await session.page.mouse.move(
		threeDimensionalCanvasBox.x + threeDimensionalCanvasBox.width * 0.25,
		threeDimensionalCanvasBox.y + threeDimensionalCanvasBox.height * 0.5,
	);
	await session.page.mouse.down();
	await session.page.mouse.move(
		threeDimensionalCanvasBox.x + threeDimensionalCanvasBox.width * 0.75,
		threeDimensionalCanvasBox.y + threeDimensionalCanvasBox.height * 0.56,
		{ steps: 8 },
	);
	await session.page.mouse.up();
	await expect(
		session.page.getByTestId("three-dimensional-camera"),
	).not.toHaveText(cameraBeforeOrbit ?? "");
	await expect(
		session.page.getByTestId("three-dimensional-custom-glb-status"),
	).toHaveText("rendered:3", { timeout: 15_000 });
	expect(await durableRevisionCount(session.page)).toBe(
		revisionsBeforeViewChange,
	);

	const orbitThreeDimensionalScreenshot = testInfo.outputPath(
		"reference-apartment-3d-orbit.png",
	);
	await session.page.screenshot({ path: orbitThreeDimensionalScreenshot });
	await testInfo.attach("reference-apartment-3d-orbit", {
		contentType: "image/png",
		path: orbitThreeDimensionalScreenshot,
	});

	const overviewReset = session.page.getByRole("button", {
		name: "Вернуть обзор 3D",
	});
	await expect(overviewReset).toBeVisible();
	await overviewReset.click();
	await expect(session.page.getByTestId("three-dimensional-camera")).toHaveText(
		cameraBeforeOrbit ?? "",
	);
	await expect(overviewReset).toHaveCount(0);
	await expect(
		session.page.getByTestId("three-dimensional-cutaway-notice"),
	).toHaveCount(0);
	await expect(
		session.page.getByTestId("three-dimensional-custom-glb-status"),
	).toHaveText("rendered:3", { timeout: 15_000 });
	expect(await durableRevisionCount(session.page)).toBe(
		revisionsBeforeViewChange,
	);

	const overviewResetScreenshot = testInfo.outputPath(
		"reference-apartment-3d-overview-reset.png",
	);
	await session.page.screenshot({ path: overviewResetScreenshot });
	await testInfo.attach("reference-apartment-3d-overview-reset", {
		contentType: "image/png",
		path: overviewResetScreenshot,
	});

	// The nearest furnished room is selected after reopening to preserve the
	// passive outline and visible rotation dome in the same apartment evidence.
	await chooseEditorOption(session.page, "План 2D");
	await chooseEditorOption(session.page, "Рука и выбор");
	const schematicItems = session.page.getByTestId("schematic-item");
	await expect(schematicItems).toHaveCount(3);
	await schematicItems.nth(2).click();
	const planSelectionFrame = session.page.getByTestId(
		"two-dimensional-item-selection-frame",
	);
	await expect(planSelectionFrame).toBeVisible();
	await expect(
		planSelectionFrame.getByTestId("two-dimensional-item-selection-handle"),
	).toHaveCount(4);
	await session.page.screenshot({
		path: testInfo.outputPath("reference-apartment-plan-selected.png"),
		scale: "css",
	});

	await chooseEditorOption(session.page, "3D");
	const threeDimensionalSelectionFrame = session.page.getByTestId(
		"three-dimensional-item-selection-frame",
	);
	await expect(threeDimensionalSelectionFrame).toBeVisible();
	await expect(
		threeDimensionalSelectionFrame.getByTestId(
			"three-dimensional-item-selection-handle",
		),
	).toHaveCount(0);
	await expect(threeDimensionalSelectionFrame.locator("polygon")).toHaveCount(
		1,
	);
	await expect(
		session.page.getByTestId("three-dimensional-rotation-gizmo"),
	).toHaveAttribute("data-rotation-active", "false");
	await expect(
		session.page.getByTestId("three-dimensional-custom-glb-status"),
	).toHaveText("rendered:3", { timeout: 15_000 });
	expect(await durableRevisionCount(session.page)).toBe(
		revisionsBeforeViewChange,
	);

	// Compare the same passive outline in the overview and the selected initial
	// pose. Its size depends on the live viewport, not an obsolete pixel floor.
	const focusCanvasBox = await threeDimensionalCanvas.boundingBox();
	if (!focusCanvasBox) throw new Error("Expected the focused live canvas");
	const overviewGestureStart = await firstExposedCanvasPoint(
		session.page,
		focusCanvasBox,
		[
			[0.15, 0.2],
			[0.8, 0.2],
			[0.15, 0.8],
		],
	);
	await dragPlanControlByTouch(session.page, overviewGestureStart, {
		x: overviewGestureStart.x + 30,
		y: overviewGestureStart.y + 8,
	});
	await overviewReset.click();
	await expect(session.page.getByTestId("three-dimensional-camera")).toHaveText(
		cameraBeforeOrbit ?? "",
	);
	const overviewFootprintBox = await threeDimensionalSelectionFrame
		.locator("polygon")
		.boundingBox();
	if (!overviewFootprintBox)
		throw new Error("Expected the same selected footprint in the overview");
	const overviewFootprintArea =
		overviewFootprintBox.width * overviewFootprintBox.height;
	await chooseEditorOption(session.page, "План 2D");
	await chooseEditorOption(session.page, "3D");
	await expect(threeDimensionalSelectionFrame).toBeVisible();
	await expect(
		session.page.getByTestId("three-dimensional-custom-glb-status"),
	).toHaveText("rendered:3", { timeout: 15_000 });

	const selectedCanvasBox = await threeDimensionalCanvas.boundingBox();
	const selectedFootprintBox = await threeDimensionalSelectionFrame
		.locator("polygon")
		.boundingBox();
	if (!selectedCanvasBox || !selectedFootprintBox) {
		throw new Error("Selected 3D footprint did not render on the live canvas");
	}
	const selectedFrame = {
		bottom: selectedFootprintBox.y + selectedFootprintBox.height,
		left: selectedFootprintBox.x,
		right: selectedFootprintBox.x + selectedFootprintBox.width,
		top: selectedFootprintBox.y,
	};
	const selectedFrameCentre = {
		x: (selectedFrame.left + selectedFrame.right) / 2,
		y: (selectedFrame.top + selectedFrame.bottom) / 2,
	};
	expect(
		selectedFootprintBox.width * selectedFootprintBox.height,
	).toBeGreaterThan(overviewFootprintArea);
	const headerBox = await session.page
		.getByTestId("editor-view-switch")
		.boundingBox();
	const deckBox = await session.page
		.getByTestId("three-dimensional-camera-deck")
		.boundingBox();
	if (!headerBox || !deckBox)
		throw new Error("Expected the visible header and camera deck");
	expect(selectedFrameCentre.y).toBeGreaterThan(headerBox.y + headerBox.height);
	expect(selectedFrameCentre.y).toBeLessThan(deckBox.y);
	expect(selectedFrameCentre.x).toBeGreaterThanOrEqual(
		selectedCanvasBox.x + selectedCanvasBox.width * 0.25,
	);
	expect(selectedFrameCentre.x).toBeLessThanOrEqual(
		selectedCanvasBox.x + selectedCanvasBox.width * 0.75,
	);
	expect(selectedFrameCentre.y).toBeGreaterThanOrEqual(
		selectedCanvasBox.y + selectedCanvasBox.height * 0.2,
	);
	expect(selectedFrameCentre.y).toBeLessThanOrEqual(
		selectedCanvasBox.y + selectedCanvasBox.height * 0.7,
	);

	const selectedThreeDimensionalScreenshot = testInfo.outputPath(
		"reference-apartment-3d-selected.png",
	);
	await session.page.screenshot({ path: selectedThreeDimensionalScreenshot });
	await testInfo.attach("reference-apartment-3d-selected", {
		contentType: "image/png",
		path: selectedThreeDimensionalScreenshot,
	});
	await session.context.close();
});
