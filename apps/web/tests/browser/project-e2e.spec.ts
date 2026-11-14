import {
	chromium,
	devices,
	expect,
	type Locator,
	type Page,
	type TestInfo,
	test,
} from "@playwright/test";
import { installCatalogGatewayFake } from "./catalog-gateway-fake";
import {
	clickRectangularRoomCentre,
	clickRectangularRoomPoint,
} from "./room-geometry-fixture";
import { RuntimePortableBackupCodec } from "../../src/adapters/portable-backup/runtime-portable-backup-codec";
import { validateRuntimeV1Project } from "../../src/application/runtime-v1-project-validation";

type InteriorsTestControl = {
	setDelay(milliseconds: number): void;
	setFault(point: "before-pointer" | "before-pointer-quota"): void;
	pausePinStagingMark(): void;
	releasePinStagingMark(): void;
};

async function waitForTestControl(page: Page): Promise<void> {
	await expect
		.poll(() =>
			page.evaluate(() =>
				Boolean(
					(
						window as unknown as {
							__interiorsTestControl?: InteriorsTestControl;
						}
					).__interiorsTestControl,
				),
			),
		)
		.toBe(true);
}

async function setTestDelay(page: Page, milliseconds: number): Promise<void> {
	await waitForTestControl(page);
	await page.evaluate((delayMilliseconds) => {
		const control = (
			window as unknown as { __interiorsTestControl?: InteriorsTestControl }
		).__interiorsTestControl;
		if (!control) {
			throw new Error("Expected the Interiors test control");
		}
		control.setDelay(delayMilliseconds);
	}, milliseconds);
}

async function setTestFault(
	page: Page,
	point: "before-pointer" | "before-pointer-quota",
): Promise<void> {
	await waitForTestControl(page);
	await page.evaluate((faultPoint) => {
		const control = (
			window as unknown as { __interiorsTestControl?: InteriorsTestControl }
		).__interiorsTestControl;
		if (!control) {
			throw new Error("Expected the Interiors test control");
		}
		control.setFault(faultPoint);
	}, point);
}

async function pauseDialogWriterChecks(page: Page): Promise<void> {
	await page.evaluate(() => {
		const original = IDBDatabase.prototype.transaction;
		const pending: Array<() => void> = [];
		let paused = true;
		IDBDatabase.prototype.transaction = function (...args) {
			const transaction = original.apply(this, args);
			if (
				transaction.objectStoreNames.length === 1 &&
				transaction.objectStoreNames.contains("writer-leases")
			) {
				transaction.addEventListener(
					"complete",
					(event) => {
						if (!paused) return;
						event.stopImmediatePropagation();
						pending.push(() =>
							transaction.dispatchEvent(new Event("complete")),
						);
					},
					{ once: true },
				);
			}
			return transaction;
		};
		Object.assign(window, {
			resumeDialogWriterChecks: () => {
				if (!paused) return;
				paused = false;
				IDBDatabase.prototype.transaction = original;
				for (const resume of pending.splice(0)) resume();
			},
		});
	});
}

async function resumeDialogWriterChecks(page: Page): Promise<void> {
	await page.evaluate(() =>
		(
			window as unknown as { resumeDialogWriterChecks: () => void }
		).resumeDialogWriterChecks(),
	);
}

async function expectConfirmationKeyboard(
	page: Page,
	dialog: Locator,
	cancelName: string,
	confirmName: string,
): Promise<void> {
	const cancel = dialog.getByRole("button", { name: cancelName, exact: true });
	const confirm = dialog.getByRole("button", {
		name: confirmName,
		exact: true,
	});
	await expect(cancel).toBeFocused();
	await page.keyboard.press("Shift+Tab");
	await expect(confirm).toBeFocused();
	await page.keyboard.press("Tab");
	await expect(cancel).toBeFocused();
	await page.keyboard.press("Tab");
	await expect(confirm).toBeFocused();
	await page.keyboard.press("Shift+Tab");
	await expect(cancel).toBeFocused();
	await page
		.getByTestId("editor-top-bar")
		.locator("button")
		.first()
		.evaluate((button) => button.focus());
	await expect(cancel).toBeFocused();
	await page.mouse.click(24, 24);
	await expect(dialog).toBeVisible();
}

async function expectCompactConfirmation(
	page: Page,
	dialog: Locator,
	screenshotPath: string,
): Promise<void> {
	await page.setViewportSize({ width: 360, height: 480 });
	await page.evaluate(() => {
		document.documentElement.style.fontSize = "200%";
	});
	const box = await dialog.boundingBox();
	if (!box) throw new Error("Expected a visible confirmation");
	expect(box.y).toBeGreaterThanOrEqual(0);
	expect(box.y + box.height).toBeLessThanOrEqual(480);
	for (const button of await dialog.getByRole("button").all()) {
		await button.scrollIntoViewIfNeeded();
		const target = await button.boundingBox();
		if (!target) throw new Error("Expected a reachable confirmation action");
		expect(target.height).toBeGreaterThanOrEqual(44);
		expect(target.width).toBeGreaterThanOrEqual(44);
		expect(target.x).toBeGreaterThanOrEqual(0);
		expect(target.x + target.width).toBeLessThanOrEqual(360);
		expect(target.y).toBeGreaterThanOrEqual(0);
		expect(target.y + target.height).toBeLessThanOrEqual(480);
	}
	expect(
		await dialog.evaluate(
			(element) => element.scrollWidth <= element.clientWidth,
		),
	).toBe(true);
	await page.screenshot({ path: screenshotPath, scale: "css" });
	await page.evaluate(() => {
		document.documentElement.style.fontSize = "";
	});
	await page.setViewportSize({ width: 393, height: 852 });
}

async function pausePinStagingMark(page: Page): Promise<void> {
	await waitForTestControl(page);
	await page.evaluate(() => {
		const control = (
			window as unknown as { __interiorsTestControl?: InteriorsTestControl }
		).__interiorsTestControl;
		if (!control) {
			throw new Error("Expected the Interiors test control");
		}
		control.pausePinStagingMark();
	});
}

async function releasePinStagingMark(page: Page): Promise<void> {
	await waitForTestControl(page);
	await page.evaluate(() => {
		const control = (
			window as unknown as { __interiorsTestControl?: InteriorsTestControl }
		).__interiorsTestControl;
		if (!control) {
			throw new Error("Expected the Interiors test control");
		}
		control.releasePinStagingMark();
	});
}

async function openPersistentPhone(testInfo: TestInfo, suffix: string) {
	const context = await chromium.launchPersistentContext(
		testInfo.outputPath(`profile-${suffix}`),
		{
			...devices["iPhone 13"],
			channel: "chrome",
			colorScheme: "light",
			locale: "ru-RU",
			serviceWorkers: "block",
		},
	);
	const page = context.pages()[0] ?? (await context.newPage());
	await installCatalogGatewayFake(page);
	return { context, page };
}

async function openProjectDirectoryActions(
	page: Page,
	projectName: string,
): Promise<void> {
	await page
		.locator(`summary[aria-label="Действия для ${projectName}"]`)
		.click();
}

async function openProjectDirectory(page: Page): Promise<void> {
	await openEditorSecondaryActions(page);
	await page.getByRole("button", { name: "Проекты", exact: true }).click();
	await expect(page.getByRole("heading", { name: "Проекты", exact: true })).toBeVisible();
}

async function openEditorSecondaryActions(page: Page): Promise<void> {
	const trigger = page.getByRole("button", {
		name: "Открыть остальные действия",
	});
	if ((await trigger.getAttribute("aria-expanded")) !== "true") {
		await trigger.click();
	}
	await expect(trigger).toHaveAttribute("aria-expanded", "true");
}

async function revealCatalogAuthoring(catalogue: Locator): Promise<void> {
	const authoring = catalogue.getByTestId("catalog-authoring");
	if ((await authoring.getAttribute("open")) !== "") {
		await authoring.getByText("Импорт модели", { exact: true }).click();
	}
	await expect(authoring).toHaveAttribute("open", "");
}

/**
 * Project creation is an explicit route from the cold-start hub. Keeping this
 * as a public UI flow prevents browser scenarios from accidentally relying on
 * a legacy auto-open of the sole local Project.
 */
async function startNewProject(page: Page): Promise<void> {
	await expect(page.getByRole("heading", { name: "Проекты", exact: true })).toBeVisible();
	await page.getByRole("button", { name: "Новый проект", exact: true }).click();
	await expect(
		page.getByRole("heading", { name: "Новый проект" }),
	).toBeVisible();
}

async function submitNewProject(page: Page, name: string): Promise<void> {
	await page.getByLabel("Название проекта").fill(name);
	await page.getByRole("button", { name: "Создать проект" }).click();
}

async function createProject(page: Page, name: string): Promise<void> {
	await startNewProject(page);
	await submitNewProject(page, name);
	await expect(page.getByTestId("editor-workspace")).toBeVisible();
}

async function openProjectCard(
	page: Page,
	projectName: string,
	destination: "editor" | "recovery" = "editor",
): Promise<void> {
	await expect(page.getByRole("heading", { name: "Проекты", exact: true })).toBeVisible();
	await page.getByRole("button", { name: `Открыть ${projectName}` }).click();
	await expect(
		destination === "editor"
			? page.getByTestId("editor-workspace")
			: page.getByRole("heading", { name: "Проект требует восстановления" }),
	).toBeVisible();
}

async function openPersistentShortPhone(testInfo: TestInfo, suffix: string) {
	const context = await chromium.launchPersistentContext(
		testInfo.outputPath(`profile-${suffix}`),
		{
			...devices["iPhone 13"],
			channel: "chrome",
			colorScheme: "light",
			locale: "ru-RU",
			serviceWorkers: "block",
			viewport: { height: 568, width: 320 },
		},
	);
	const page = context.pages()[0] ?? (await context.newPage());
	await installCatalogGatewayFake(page);
	return { context, page };
}

async function chooseCorruptPortableBackup(
	page: Page,
	name: string,
): Promise<void> {
	await page
		.getByLabel("Импортировать проект")
		.evaluate((element, fileName) => {
			const input = element as HTMLInputElement;
			const transfer = new DataTransfer();
			transfer.items.add(
				new File(
					[Uint8Array.from([0x50, 0x4b, 0x03, 0x04, 0, 1, 2, 3])],
					fileName,
					{ type: "application/zip" },
				),
			);
			Object.defineProperty(input, "files", {
				configurable: true,
				value: transfer.files,
			});
			input.dispatchEvent(new Event("change", { bubbles: true }));
		}, name);
}

async function readFirstCustomAssetResource(page: Page): Promise<number[]> {
	return page.evaluate(
		() =>
			new Promise<number[]>((resolve, reject) => {
				const request = window.indexedDB.open("interiors-editor-custom-assets");
				request.onerror = () => reject(request.error);
				request.onsuccess = () => {
					const database = request.result;
					const transaction = database.transaction("resources", "readonly");
					const resources = transaction.objectStore("resources").getAll();
					let firstBytes: number[] | undefined;
					resources.onsuccess = () => {
						const first = resources.result[0] as
							| { readonly bytes: ArrayBuffer }
							| undefined;
						firstBytes = first
							? Array.from(new Uint8Array(first.bytes))
							: undefined;
					};
					transaction.oncomplete = () => {
						database.close();
						if (!firstBytes) {
							reject(new Error("Expected one stored custom asset resource"));
							return;
						}
						resolve(firstBytes);
					};
					transaction.onerror = () => reject(transaction.error);
				};
			}),
	);
}

async function readFirstCustomAssetRecord(page: Page): Promise<{
	readonly bytes: readonly number[];
	readonly resourceHash: string;
}> {
	return page.evaluate(
		() =>
			new Promise((resolve, reject) => {
				const request = window.indexedDB.open("interiors-editor-custom-assets");
				request.onerror = () => reject(request.error);
				request.onsuccess = () => {
					const database = request.result;
					const transaction = database.transaction("resources", "readonly");
					const resources = transaction.objectStore("resources").getAll();
					resources.onsuccess = () => {
						const first = resources.result[0] as
							| { readonly bytes: ArrayBuffer; readonly resourceHash: string }
							| undefined;
						if (!first) {
							reject(new Error("Expected one stored custom asset resource"));
							return;
						}
						resolve({
							bytes: Array.from(new Uint8Array(first.bytes)),
							resourceHash: first.resourceHash,
						});
					};
					transaction.oncomplete = () => database.close();
					transaction.onerror = () => reject(transaction.error);
				};
			}),
	);
}

async function restoreCustomAssetRecord(
	page: Page,
	record: { readonly bytes: readonly number[]; readonly resourceHash: string },
): Promise<void> {
	await page.evaluate(
		({ bytes, resourceHash }) =>
			new Promise<void>((resolve, reject) => {
				const request = window.indexedDB.open("interiors-editor-custom-assets");
				request.onerror = () => reject(request.error);
				request.onsuccess = () => {
					const database = request.result;
					const transaction = database.transaction("resources", "readwrite");
					transaction.objectStore("resources").put({
						bytes: Uint8Array.from(bytes).buffer,
						resourceHash,
					});
					transaction.oncomplete = () => {
						database.close();
						resolve();
					};
					transaction.onerror = () => reject(transaction.error);
				};
			}),
		record,
	);
}

async function readAllCustomAssetResources(
	page: Page,
): Promise<readonly number[][]> {
	return page.evaluate(
		() =>
			new Promise<number[][]>((resolve, reject) => {
				const request = window.indexedDB.open("interiors-editor-custom-assets");
				request.onerror = () => reject(request.error);
				request.onsuccess = () => {
					const database = request.result;
					const transaction = database.transaction("resources", "readonly");
					const resources = transaction.objectStore("resources").getAll();
					let allBytes: number[][] = [];
					resources.onsuccess = () => {
						allBytes = (
							resources.result as readonly { readonly bytes: ArrayBuffer }[]
						).map((resource) => Array.from(new Uint8Array(resource.bytes)));
					};
					transaction.oncomplete = () => {
						database.close();
						resolve(allBytes);
					};
					transaction.onerror = () => reject(transaction.error);
				};
			}),
	);
}

async function corruptFirstCustomAssetResource(page: Page): Promise<void> {
	await page.evaluate(
		() =>
			new Promise<void>((resolve, reject) => {
				const request = window.indexedDB.open("interiors-editor-custom-assets");
				request.onerror = () => reject(request.error);
				request.onsuccess = () => {
					const database = request.result;
					const transaction = database.transaction("resources", "readwrite");
					const resources = transaction.objectStore("resources");
					const read = resources.getAll();
					read.onsuccess = () => {
						const first = read.result[0] as
							| { readonly resourceHash: string }
							| undefined;
						if (!first) {
							transaction.abort();
							reject(new Error("Expected one stored custom asset resource"));
							return;
						}
						resources.put({
							bytes: new Uint8Array([0x63, 0x6f, 0x72, 0x72, 0x75, 0x70, 0x74])
								.buffer,
							resourceHash: first.resourceHash,
						});
					};
					transaction.oncomplete = () => {
						database.close();
						resolve();
					};
					transaction.onerror = () => reject(transaction.error);
					transaction.onabort = () =>
						reject(
							transaction.error ?? new Error("IndexedDB transaction aborted"),
						);
				};
			}),
	);
}

async function clearCustomAssetLibrary(page: Page): Promise<void> {
	await page.evaluate(
		() =>
			new Promise<void>((resolve, reject) => {
				const request = window.indexedDB.open("interiors-editor-custom-assets");
				request.onerror = () => reject(request.error);
				request.onsuccess = () => {
					const database = request.result;
					const transaction = database.transaction("library", "readwrite");
					transaction.objectStore("library").clear();
					transaction.oncomplete = () => {
						database.close();
						resolve();
					};
					transaction.onerror = () => reject(transaction.error);
				};
			}),
	);
}

async function deleteFirstCustomAssetResource(page: Page): Promise<void> {
	await page.evaluate(
		() =>
			new Promise<void>((resolve, reject) => {
				const request = window.indexedDB.open("interiors-editor-custom-assets");
				request.onerror = () => reject(request.error);
				request.onsuccess = () => {
					const database = request.result;
					const transaction = database.transaction("resources", "readwrite");
					const resources = transaction.objectStore("resources");
					const read = resources.getAll();
					read.onsuccess = () => {
						const first = read.result[0] as
							| { readonly resourceHash: string }
							| undefined;
						if (!first) {
							transaction.abort();
							reject(new Error("Expected one stored custom asset resource"));
							return;
						}
						resources.delete(first.resourceHash);
					};
					transaction.oncomplete = () => {
						database.close();
						resolve();
					};
					transaction.onerror = () => reject(transaction.error);
					transaction.onabort = () =>
						reject(
							transaction.error ?? new Error("IndexedDB transaction aborted"),
						);
				};
			}),
	);
}

async function deleteAllCustomAssetResources(page: Page): Promise<void> {
	await page.evaluate(
		() =>
			new Promise<void>((resolve, reject) => {
				const request = window.indexedDB.open("interiors-editor-custom-assets");
				request.onerror = () => reject(request.error);
				request.onsuccess = () => {
					const database = request.result;
					const transaction = database.transaction("resources", "readwrite");
					transaction.objectStore("resources").clear();
					transaction.oncomplete = () => {
						database.close();
						resolve();
					};
					transaction.onerror = () => reject(transaction.error);
					transaction.onabort = () =>
						reject(
							transaction.error ?? new Error("IndexedDB transaction aborted"),
						);
				};
			}),
	);
}

async function tamperFirstCustomAssetResource(page: Page): Promise<void> {
	await page.evaluate(
		() =>
			new Promise<void>((resolve, reject) => {
				const request = window.indexedDB.open("interiors-editor-custom-assets");
				request.onerror = () => reject(request.error);
				request.onsuccess = () => {
					const database = request.result;
					const transaction = database.transaction("resources", "readwrite");
					const resources = transaction.objectStore("resources");
					const read = resources.getAll();
					read.onsuccess = () => {
						const first = read.result[0] as
							| {
									readonly bytes: ArrayBuffer;
									readonly resourceHash: string;
							  }
							| undefined;
						if (!first) {
							transaction.abort();
							reject(new Error("Expected one stored custom asset resource"));
							return;
						}
						const bytes = new Uint8Array(first.bytes.slice(0));
						bytes[bytes.length - 1] ^= 1;
						resources.put({
							bytes: bytes.buffer,
							resourceHash: first.resourceHash,
						});
					};
					transaction.oncomplete = () => {
						database.close();
						resolve();
					};
					transaction.onerror = () => reject(transaction.error);
					transaction.onabort = () =>
						reject(
							transaction.error ?? new Error("IndexedDB transaction aborted"),
						);
				};
			}),
	);
}

async function currentProjectRevisionId(page: Page): Promise<string> {
	return page.evaluate(
		() =>
			new Promise<string>((resolve, reject) => {
				const request = window.indexedDB.open("interiors-editor-projects");
				request.onerror = () => reject(request.error);
				request.onsuccess = () => {
					const database = request.result;
					const transaction = database.transaction("projects", "readonly");
					const pointers = transaction.objectStore("projects").getAll();
					pointers.onsuccess = () => {
						const pointer = pointers.result[0] as
							| { readonly currentRevisionId?: string }
							| undefined;
						if (!pointer?.currentRevisionId) {
							reject(new Error("Expected one current Project revision"));
							return;
						}
						resolve(pointer.currentRevisionId);
					};
					transaction.oncomplete = () => database.close();
					transaction.onerror = () => reject(transaction.error);
				};
			}),
	);
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
					count.onsuccess = () => resolve(count.result);
					transaction.oncomplete = () => database.close();
					transaction.onerror = () => reject(transaction.error);
				};
			}),
	);
}

async function pinStagingRootInventory(page: Page): Promise<{
	readonly leases: readonly {
		readonly leaseId: string;
		readonly publication?: {
			readonly projectId: string;
			readonly revisionId: string;
		};
	}[];
	readonly resources: readonly {
		readonly pinStagingLeaseId?: string;
		readonly resourceHash: string;
	}[];
}> {
	return page.evaluate(async () => {
		const list = <T>(databaseName: string, storeName: string) =>
			new Promise<readonly T[]>((resolve, reject) => {
				const request = window.indexedDB.open(databaseName);
				request.onerror = () => reject(request.error);
				request.onsuccess = () => {
					const database = request.result;
					const transaction = database.transaction(storeName, "readonly");
					const read = transaction.objectStore(storeName).getAll();
					read.onsuccess = () => resolve(read.result as readonly T[]);
					transaction.oncomplete = () => database.close();
					transaction.onerror = () => reject(transaction.error);
				};
			});
		const [leases, resources] = await Promise.all([
			list<{
				readonly leaseId: string;
				readonly publication?: {
					readonly projectId: string;
					readonly revisionId: string;
				};
			}>("interiors-editor-projects", "pin-staging-leases"),
			list<{
				readonly pinStagingLeaseId?: string;
				readonly resourceHash: string;
			}>("interiors-editor-custom-assets", "resources"),
		]);
		return { leases, resources };
	});
}

async function currentProjectPointers(page: Page): Promise<
	readonly {
		readonly currentRevisionId: string;
		readonly name: string;
		readonly projectId: string;
	}[]
> {
	return page.evaluate(
		() =>
			new Promise((resolve, reject) => {
				const request = window.indexedDB.open("interiors-editor-projects");
				request.onerror = () => reject(request.error);
				request.onsuccess = () => {
					const database = request.result;
					const transaction = database.transaction("projects", "readonly");
					const pointers = transaction.objectStore("projects").getAll();
					pointers.onsuccess = () => resolve(pointers.result);
					transaction.oncomplete = () => database.close();
					transaction.onerror = () => reject(transaction.error);
				};
			}),
	);
}

async function seedDanglingProjectPointer(page: Page): Promise<void> {
	await page.evaluate(
		() =>
			new Promise<void>((resolve, reject) => {
				const request = window.indexedDB.open("interiors-editor-projects");
				request.onerror = () => reject(request.error);
				request.onsuccess = () => {
					const database = request.result;
					const transaction = database.transaction("projects", "readwrite");
					transaction.objectStore("projects").put({
						currentRevisionId: "revision-missing",
						name: "Повреждённая запись",
						projectId: "project-dangling",
					});
					transaction.oncomplete = () => {
						database.close();
						resolve();
					};
					transaction.onerror = () => reject(transaction.error);
					transaction.onabort = () =>
						reject(
							transaction.error ??
								new Error("Expected dangling pointer transaction to complete"),
						);
				};
			}),
	);
}

function centimetreSketchfabGlb(): Uint8Array {
	const positions = new Float32Array([
		-1, -1, -1, 1, -1, -1, 1, 1, -1, -1, 1, -1, -1, -1, 1, 1, -1, 1, 1, 1, 1,
		-1, 1, 1,
	]);
	const document = {
		asset: {
			extras: {
				source: "https://sketchfab.com/3d-models/white-armchair-fbx-1k-9mb",
			},
			generator: "Sketchfab-16.67.0",
			version: "2.0",
		},
		accessors: [
			{
				bufferView: 0,
				componentType: 5126,
				count: 8,
				max: [1, 1, 1],
				min: [-1, -1, -1],
				type: "VEC3",
			},
		],
		bufferViews: [{ buffer: 0, byteLength: positions.byteLength }],
		buffers: [{ byteLength: positions.byteLength }],
		meshes: [{ primitives: [{ attributes: { POSITION: 0 } }] }],
		nodes: [
			{
				matrix: [100, 0, 0, 0, 0, 0, -100, 0, 0, 100, 0, 0, 0, 0, 0, 1],
				mesh: 0,
			},
		],
		scene: 0,
		scenes: [{ nodes: [0] }],
	};
	const json = new TextEncoder().encode(JSON.stringify(document));
	const jsonLength = Math.ceil(json.byteLength / 4) * 4;
	const totalLength = 12 + 8 + jsonLength + 8 + positions.byteLength;
	const bytes = new Uint8Array(totalLength);
	const view = new DataView(bytes.buffer);
	view.setUint32(0, 0x46546c67, true);
	view.setUint32(4, 2, true);
	view.setUint32(8, totalLength, true);
	view.setUint32(12, jsonLength, true);
	view.setUint32(16, 0x4e4f534a, true);
	bytes.set(json, 20);
	bytes.fill(0x20, 20 + json.byteLength, 20 + jsonLength);
	const binaryOffset = 20 + jsonLength;
	view.setUint32(binaryOffset, positions.byteLength, true);
	view.setUint32(binaryOffset + 4, 0x004e4942, true);
	bytes.set(new Uint8Array(positions.buffer), binaryOffset + 8);
	return bytes;
}

function alternateCentimetreSketchfabGlb(): Uint8Array {
	const bytes = centimetreSketchfabGlb();
	new DataView(bytes.buffer).setFloat32(bytes.byteLength - 4, 1.25, true);
	return bytes;
}

test("PROJECT-E2E-01: creates, persists and reopens a local Project without an account", async ({
	page: _page,
}, testInfo) => {
	const first = await openPersistentPhone(testInfo, "durable");
	const configuredBaseUrl = testInfo.project.use.baseURL;
	if (typeof configuredBaseUrl !== "string") {
		throw new Error("Expected the browser test project to define baseURL");
	}
	const localOrigin = new URL(configuredBaseUrl).origin;
	const externalRequests: string[] = [];
	first.page.on("request", (request) => {
		if (new URL(request.url()).origin !== localOrigin) {
			externalRequests.push(request.url());
		}
	});

	await first.page.goto("/");
	await startNewProject(first.page);
	await setTestDelay(first.page, 180);
	await submitNewProject(first.page, "  План на телефоне  ");

	await expect(first.page.getByRole("status")).toContainText(
		"Сохраняем локально",
	);
	await expect(first.page.getByRole("status")).toContainText("Сохранено");
	expect(externalRequests).toEqual([]);
	await first.context.close();

	const reopened = await openPersistentPhone(testInfo, "durable");
	await reopened.page.goto("/");
	await openProjectCard(reopened.page, "План на телефоне");
	await expect(reopened.page.getByTestId("writer-lease-notice")).toBeVisible();
	await reopened.page
		.getByRole("button", { name: "Взять редактирование на себя" })
		.click();
	await reopened.page
		.getByRole("button", { name: "Подтвердить перехват" })
		.click();
	await expect(reopened.page.getByTestId("writer-lease-notice")).toHaveCount(0);
	await expect(reopened.page.getByRole("status")).toContainText("Сохранено");
	await reopened.context.close();

	const blank = await openPersistentPhone(testInfo, "blank");
	await blank.page.goto("/");
	await startNewProject(blank.page);
	await blank.page.getByRole("button", { name: "Создать проект" }).click();
	await expect(blank.page.getByRole("alert")).toHaveText(
		"Введите название проекта.",
	);
	await expect(blank.page.getByRole("status")).toHaveCount(0);
	expect(await durableRevisionCount(blank.page)).toBe(0);
	await blank.context.close();

	const faulted = await openPersistentPhone(testInfo, "fault");
	await faulted.page.goto("/");
	await startNewProject(faulted.page);
	await setTestFault(faulted.page, "before-pointer");
	await submitNewProject(faulted.page, "Не должен сохраниться");
	await expect(faulted.page.getByRole("status")).toContainText("Не сохранено");
	await expect(
		faulted.page.getByTestId("project-creation-failure"),
	).toContainText("Не удалось создать проект");
	await expect(
		faulted.page.getByRole("button", { name: "Скачать сохранённую версию" }),
	).toHaveCount(0);
	await expect(
		faulted.page.getByRole("button", { name: "Повторить сохранение" }),
	).toBeVisible();
	await faulted.page.reload();
	await expect(
		faulted.page.getByRole("heading", { name: "Проекты", exact: true }),
	).toBeVisible();
	await expect(faulted.page.getByTestId("project-durability-status")).toHaveCount(0);
	await faulted.context.close();
});

test("PROJECT-E2E-01: an immediate double submit cannot create a second local Project", async ({
	page: _page,
}, testInfo) => {
	const session = await openPersistentPhone(testInfo, "single-publication");
	await session.page.goto("/");
	await startNewProject(session.page);
	await session.page.getByLabel("Название проекта").fill("Одна публикация");
	await session.page
		.getByRole("button", { name: "Создать проект" })
		.evaluate((button) => {
			(button as HTMLButtonElement).click();
			(button as HTMLButtonElement).click();
		});

	await expect(
		session.page.getByTestId("project-durability-status"),
	).toContainText("Сохранено локально");
	const recordCounts = await session.page.evaluate(
		() =>
			new Promise<number>((resolve, reject) => {
				const request = window.indexedDB.open("interiors-editor-projects");
				request.onerror = () => reject(request.error);
				request.onsuccess = () => {
					const database = request.result;
					const transaction = database.transaction(
						["projects", "revisions"],
						"readonly",
					);
					const projects = transaction.objectStore("projects").count();
					const revisions = transaction.objectStore("revisions").count();
					transaction.oncomplete = () => {
						resolve(projects.result * 100 + revisions.result);
						database.close();
					};
				};
			}),
	);
	expect(recordCounts).toBe(101);
	await session.context.close();
});

test("PROJECT-E2E-01H: cold start keeps empty and sole local Projects behind explicit hub choices", async ({
	page: _page,
}, testInfo) => {
	const session = await openPersistentPhone(
		testInfo,
		"projects-first-cold-open",
	);
	await session.page.goto("/");

	await expect(
		session.page.getByRole("heading", { name: "Проекты", exact: true }),
	).toBeVisible();
	await expect(
		session.page.getByTestId("project-directory-empty"),
	).toContainText(/пока нет проектов/i);
	await expect(session.page.getByLabel("Название проекта")).toHaveCount(0);

	await session.page.getByRole("button", { name: "Новый проект" }).click();
	await expect(
		session.page.getByRole("heading", { name: "Новый проект" }),
	).toBeVisible();
	await session.page
		.getByRole("button", { name: "Вернуться к проектам" })
		.click();
	await expect(
		session.page.getByRole("heading", { name: "Проекты", exact: true }),
	).toBeVisible();

	await session.page.getByRole("button", { name: "Новый проект" }).click();
	await session.page.getByLabel("Название проекта").fill("Единственный план");
	await session.page.getByRole("button", { name: "Создать проект" }).click();
	await expect(session.page.getByTestId("editor-workspace")).toBeVisible();

	await session.page.reload();
	await expect(
		session.page.getByRole("heading", { name: "Проекты", exact: true }),
	).toBeVisible();
	await expect(
		session.page.getByRole("button", { name: "Открыть Единственный план" }),
	).toBeVisible();
	await expect(session.page.getByTestId("editor-workspace")).toHaveCount(0);

	await session.page
		.getByRole("button", { name: "Открыть Единственный план" })
		.click();
	await expect(session.page.getByTestId("editor-workspace")).toBeVisible();
	await session.context.close();
});

test("PROJECT-E2E-01I: calm project cards open by name and remain usable on a narrow phone with enlarged text", async ({
	page: _page,
}, testInfo) => {
	const session = await openPersistentPhone(testInfo, "calm-project-cards");
	await session.page.setViewportSize({ width: 360, height: 740 });
	await session.page.goto("/");
	const hub = session.page.getByTestId("project-hub");
	await expect(hub).toBeVisible();
	const surfaces = await hub.evaluate((element) =>
		[element, element.parentElement].map((surface) => {
			if (!surface) throw new Error("Expected the Projects surface");
			const style = getComputedStyle(surface);
			return [style.backgroundImage, style.backdropFilter];
		}),
	);
	expect(surfaces).toEqual([
		["none", "none"],
		["none", "none"],
	]);
	await expect(hub.getByRole("button", { name: "Новый проект" })).toHaveCSS(
		"background-color",
		"rgb(25, 118, 185)",
	);
	await session.page.screenshot({
		path: testInfo.outputPath("projects-empty.png"),
		scale: "css",
	});
	await hub.getByRole("button", { name: "Новый проект" }).click();
	const back = session.page.getByRole("button", {
		name: "Вернуться к проектам",
	});
	expect((await back.boundingBox())?.height).toBeGreaterThanOrEqual(44);
	const projectName = "Квартира · кухня и гостиная после перепланировки";
	await session.page.getByLabel("Название проекта").fill(projectName);
	await session.page.screenshot({
		path: testInfo.outputPath("project-create.png"),
		scale: "css",
	});
	await session.page.getByRole("button", { name: "Создать проект" }).click();
	await expect(session.page.getByTestId("editor-workspace")).toBeVisible();
	await session.page.reload();
	const open = hub.getByRole("button", {
		name: `Открыть ${projectName}`,
		exact: true,
	});
	await expect(open.getByText(projectName, { exact: true })).toBeVisible();
	const before = await currentProjectPointers(session.page);
	await openProjectDirectoryActions(session.page, projectName);
	await expect(
		hub.getByRole("button", { name: `Переименовать ${projectName}` }),
	).toBeVisible();
	await expect(session.page.getByTestId("editor-workspace")).toHaveCount(0);
	await openProjectDirectoryActions(session.page, projectName);
	await session.page.screenshot({
		path: testInfo.outputPath("projects-populated.png"),
		scale: "css",
	});
	// Text enlargement must preserve the full title and the independent menu.
	await session.page.evaluate(() => {
		document.documentElement.style.fontSize = "200%";
	});
	await openProjectDirectoryActions(session.page, projectName);
	const title = open.getByText(projectName, { exact: true });
	expect(
		await title.evaluate(
			(element) => element.scrollWidth <= element.clientWidth,
		),
	).toBe(true);
	for (const control of await hub
		.locator("button:visible, summary:visible")
		.all()) {
		const box = await control.boundingBox();
		expect(box?.height).toBeGreaterThanOrEqual(44);
		expect(box?.width).toBeGreaterThanOrEqual(44);
		expect(
			await control.evaluate(
				(element) => element.scrollWidth <= element.clientWidth,
			),
		).toBe(true);
	}
	expect(
		await session.page.evaluate(() => document.documentElement.scrollWidth),
	).toBeLessThanOrEqual(360);
	await openProjectDirectoryActions(session.page, projectName);
	await title.click();
	await expect(session.page.getByTestId("editor-workspace")).toBeVisible();
	expect(await currentProjectPointers(session.page)).toEqual(before);
	await session.context.close();
});

test("PROJECT-E2E-01A: direct Project deletion keeps cancel safe, then removes the phone Project and its revisions", async ({
	page: _page,
}, testInfo) => {
	const session = await openPersistentPhone(testInfo, "direct-project-delete");
	await session.page.goto("/");
	await createProject(session.page, "План для полного удаления");
	await session.page.getByRole("button", { name: "Создать контур" }).click();
	const before = (await currentProjectPointers(session.page)).find(
		(pointer) => pointer.name === "План для полного удаления",
	);
	if (!before) {
		throw new Error("Expected the Project pointer before deletion.");
	}

	await openEditorSecondaryActions(session.page);
	await session.page
		.getByRole("button", { name: "Удалить проект", exact: true })
		.click();
	const permanentDialog = session.page.getByRole("dialog", {
		name: "Удалить проект",
	});
	await expect(permanentDialog).toContainText("Удалить проект навсегда?");
	await expect(permanentDialog).toContainText("План для полного удаления");
	await expect(permanentDialog).toContainText("Это действие нельзя отменить.");
	await session.page.screenshot({
		path: testInfo.outputPath("dialog-project-delete.png"),
		scale: "css",
	});
	await permanentDialog
		.getByRole("button", { name: "Оставить проект" })
		.click();
	await expect(permanentDialog).toHaveCount(0);
	await expect
		.poll(async () =>
			(await currentProjectPointers(session.page)).find(
				(pointer) => pointer.projectId === before.projectId,
			),
		)
		.toEqual(before);

	await openEditorSecondaryActions(session.page);
	await session.page
		.getByRole("button", { name: "Удалить проект", exact: true })
		.click();
	await session.page
		.getByRole("dialog", { name: "Удалить проект" })
		.getByRole("button", { name: "Удалить навсегда" })
		.click();
	await expect(
		session.page.getByRole("heading", { name: "Проекты", exact: true }),
	).toBeVisible();
	await expect
		.poll(async () => currentProjectPointers(session.page))
		.toEqual([]);
	await expect.poll(() => durableRevisionCount(session.page)).toBe(0);
	await session.context.close();
});

test("DIALOG-E2E-01: Project deletion keeps focus, busy and errors inside a readable phone confirmation", async ({
	page: _page,
}, testInfo) => {
	const session = await openPersistentPhone(
		testInfo,
		"accessible-project-delete",
	);
	await session.page.setViewportSize({ width: 393, height: 852 });
	await session.page.goto("/");
	const name = `Квартира для ремонта · ${"ДлинноеНазваниеБезПробелов".repeat(4)}`;
	await createProject(session.page, name);
	const before = await currentProjectPointers(session.page);
	const revisions = await durableRevisionCount(session.page);
	const menu = session.page.getByRole("button", {
		name: "Открыть остальные действия",
	});
	const openDelete = async () => {
		await openEditorSecondaryActions(session.page);
		await session.page
			.getByRole("button", { name: "Удалить проект", exact: true })
			.click();
	};
	await openDelete();
	const dialog = session.page.getByRole("dialog", {
		name: "Удалить проект",
		exact: true,
	});
	await expectConfirmationKeyboard(
		session.page,
		dialog,
		"Оставить проект",
		"Удалить навсегда",
	);
	await expect(dialog).toHaveCSS("background-color", "rgb(255, 255, 255)");
	await expect(dialog).toHaveCSS("border-radius", "24px");
	await expectCompactConfirmation(
		session.page,
		dialog,
		testInfo.outputPath("dialog-project-delete-large-text.png"),
	);
	await session.page.screenshot({
		path: testInfo.outputPath("dialog-project-delete-long-name.png"),
		scale: "css",
	});
	await session.page.keyboard.press("Escape");
	await expect(dialog).toHaveCount(0);
	await expect(menu).toBeFocused();
	expect(await currentProjectPointers(session.page)).toEqual(before);
	await openDelete();
	await dialog.getByRole("button", { name: "Оставить проект" }).click();
	await expect(menu).toBeFocused();
	await openDelete();
	await session.page.evaluate(() => {
		const original = IDBDatabase.prototype.transaction;
		IDBDatabase.prototype.transaction = function (...args) {
			const names =
				typeof args[0] === "string" ? [args[0]] : Array.from(args[0]);
			if (
				args[1] === "readwrite" &&
				names.includes("projects") &&
				names.includes("revisions")
			) {
				IDBDatabase.prototype.transaction = original;
				throw new DOMException(
					"Simulated unavailable storage",
					"QuotaExceededError",
				);
			}
			return original.apply(this, args);
		};
	});
	await dialog.getByRole("button", { name: "Удалить навсегда" }).click();
	await expect(dialog.getByRole("alert")).toContainText(
		"Не удалось удалить проект",
	);
	await expect(
		dialog.getByRole("button", { name: "Оставить проект" }),
	).toBeFocused();
	expect(await currentProjectPointers(session.page)).toEqual(before);
	expect(await durableRevisionCount(session.page)).toBe(revisions);
	await session.page.screenshot({
		path: testInfo.outputPath("dialog-project-delete-error.png"),
		scale: "css",
	});
	await pauseDialogWriterChecks(session.page);
	await dialog.getByRole("button", { name: "Удалить навсегда" }).click();
	await expect(dialog).toHaveAttribute("aria-busy", "true");
	await expect(
		dialog.getByRole("button", { name: "Оставить проект" }),
	).toBeDisabled();
	await expect(dialog.getByRole("button", { name: "Удаляем…" })).toBeDisabled();
	await session.page.keyboard.press("Tab");
	await expect(dialog).toBeFocused();
	await session.page.keyboard.press("Shift+Tab");
	await expect(dialog).toBeFocused();
	await session.page.keyboard.press("Escape");
	await session.page.mouse.click(24, 24);
	await expect(dialog).toBeVisible();
	await resumeDialogWriterChecks(session.page);
	await expect(
		session.page.getByRole("heading", { name: "Проекты", exact: true }),
	).toBeFocused();
	expect(await currentProjectPointers(session.page)).toEqual([]);
	expect(await durableRevisionCount(session.page)).toBe(0);
	await session.context.close();
});

test("DIALOG-E2E-02: a Project deletion confirmation is retired when another window takes the writer lease", async ({
	page: _page,
}, testInfo) => {
	const session = await openPersistentPhone(
		testInfo,
		"confirmation-writer-change",
	);
	await session.page.goto("/");
	await createProject(session.page, "Проект в двух окнах");
	const before = await currentProjectPointers(session.page);
	await openEditorSecondaryActions(session.page);
	await session.page
		.getByRole("button", { name: "Удалить проект", exact: true })
		.click();
	const dialog = session.page.getByRole("dialog", {
		name: "Удалить проект",
		exact: true,
	});
	await expect(dialog).toBeVisible();
	const other = await session.context.newPage();
	await other.goto("/");
	await openProjectCard(other, "Проект в двух окнах");
	await other
		.getByRole("button", { name: "Взять редактирование на себя" })
		.click();
	await other.getByRole("button", { name: "Подтвердить перехват" }).click();
	await session.page.bringToFront();
	await session.page.evaluate(() =>
		document.dispatchEvent(new Event("visibilitychange")),
	);
	await expect(dialog).toHaveCount(0);
	await expect(session.page.getByTestId("writer-lease-notice")).toBeVisible();
	expect(await currentProjectPointers(session.page)).toEqual(before);
	await session.page
		.getByRole("button", { name: "Взять редактирование на себя" })
		.click();
	await session.page
		.getByRole("button", { name: "Подтвердить перехват" })
		.click();
	await expect(session.page.getByTestId("writer-lease-notice")).toHaveCount(0);
	await expect(dialog).toHaveCount(0);
	await openEditorSecondaryActions(session.page);
	await session.page
		.getByRole("button", { name: "Удалить проект", exact: true })
		.click();
	await expect(
		dialog.getByRole("button", { name: "Оставить проект" }),
	).toBeFocused();
	await session.page.keyboard.press("Escape");
	await session.context.close();
});

test("PROJECT-E2E-01C: a critical local-storage estimate warns before the user makes another change", async ({
	page: _page,
}, testInfo) => {
	const session = await openPersistentPhone(testInfo, "storage-pressure");
	await session.page.addInitScript(() => {
		const storagePressureTestControl = {
			setUsage(usage: number) {
				this.usage = usage;
			},
			usage: 0,
		};
		Object.defineProperty(window, "__interiorsStoragePressureTestControl", {
			configurable: true,
			value: storagePressureTestControl,
		});
		Object.defineProperty(navigator.storage, "estimate", {
			configurable: true,
			value: async () => ({
				quota: 1_000,
				usage: storagePressureTestControl.usage,
			}),
		});
	});
	await session.page.goto("/");
	await createProject(session.page, "План с риском хранилища");

	const warning = session.page.getByTestId("storage-pressure");
	await expect(warning).toHaveCount(0);
	await session.page.evaluate(() => {
		const control = (
			window as unknown as {
				__interiorsStoragePressureTestControl: {
					setUsage(usage: number): void;
				};
			}
		).__interiorsStoragePressureTestControl;
		control.setUsage(900);
		document.dispatchEvent(new Event("visibilitychange"));
	});
	await expect(warning).toContainText("Риск заполнения хранилища");
	await expect(warning).toContainText("занято не менее 90%");
	const headerBox = await session.page
		.getByTestId("editor-top-bar")
		.boundingBox();
	const warningBox = await warning.boundingBox();
	if (!headerBox || !warningBox)
		throw new Error("Expected the header and storage warning");
	expect(warningBox.y).toBeGreaterThanOrEqual(headerBox.y + headerBox.height);
	await expect(
		warning.getByRole("button", { name: "К проектам и экспорту" }),
	).toBeVisible();
	await session.context.close();
});

test("PROJECT-E2E-01E: a refusal to persist browser storage stays explicit and preserves the backup route", async ({
	page: _page,
}, testInfo) => {
	const session = await openPersistentPhone(
		testInfo,
		"storage-persistence-refused",
	);
	await session.page.addInitScript(() => {
		const storagePersistenceTestControl = {
			persistRequests: 0,
			usage: 900,
		};
		Object.defineProperty(window, "__interiorsStoragePersistenceTestControl", {
			configurable: true,
			value: storagePersistenceTestControl,
		});
		Object.defineProperty(navigator.storage, "estimate", {
			configurable: true,
			value: async () => ({
				quota: 1_000,
				usage: storagePersistenceTestControl.usage,
			}),
		});
		Object.defineProperty(navigator.storage, "persist", {
			configurable: true,
			value: async () => {
				storagePersistenceTestControl.persistRequests += 1;
				return false;
			},
		});
	});
	await session.page.goto("/");
	await createProject(session.page, "План с отказом защиты");

	const warning = session.page.getByTestId("storage-pressure");
	await expect(warning).toContainText("Риск заполнения хранилища");
	await warning
		.getByRole("button", { name: "Запросить защиту хранилища" })
		.click();
	await expect(warning).toContainText(
		"Браузер не подтвердил защиту локального хранилища",
	);
	await expect(
		warning.getByRole("button", { name: "К проектам и экспорту" }),
	).toBeVisible();
	expect(
		await session.page.evaluate(
			() =>
				(
					window as unknown as {
						__interiorsStoragePersistenceTestControl: {
							persistRequests: number;
						};
					}
				).__interiorsStoragePersistenceTestControl.persistRequests,
		),
	).toBe(1);
	await session.context.close();
});

test("PROJECT-E2E-01D: an unavailable storage estimate stays explicit while local plan authoring remains available", async ({
	page: _page,
}, testInfo) => {
	const session = await openPersistentPhone(
		testInfo,
		"storage-estimate-unavailable",
	);
	await session.page.addInitScript(() => {
		Object.defineProperty(navigator, "storage", {
			configurable: true,
			value: undefined,
		});
	});
	await session.page.goto("/");
	await createProject(session.page, "План без оценки");

	const fallback = session.page.getByTestId("storage-estimate-unavailable");
	await expect(fallback).toContainText("Не удалось оценить свободное место");
	await expect(
		fallback.getByRole("button", { name: "К проектам и экспорту" }),
	).toBeVisible();
	await session.page.getByRole("button", { name: "Создать контур" }).click();
	await expect(session.page.getByTestId("plan-width")).toHaveText("4000 мм");
	await expect(
		session.page.getByTestId("project-durability-status"),
	).toContainText("Сохранено локально");
	await session.context.close();
});

test("PROJECT-E2E-02: a user returns to local cards and opens exactly the Project they chose", async ({
	page: _page,
}, testInfo) => {
	const session = await openPersistentPhone(testInfo, "project-directory");
	await session.page.goto("/");
	await createProject(session.page, "Первый план");
	const firstProjectId = (await currentProjectPointers(session.page)).find(
		(pointer) => pointer.name === "Первый план",
	)?.projectId;
	if (!firstProjectId) {
		throw new Error(
			"Expected the first Project pointer after durable publication.",
		);
	}

	await openProjectDirectory(session.page);
	await expect(
		session.page.getByRole("heading", { name: "Проекты", exact: true }),
	).toBeVisible();
	await createProject(session.page, "Второй план");
	const secondPointer = (await currentProjectPointers(session.page)).find(
		(pointer) => pointer.name === "Второй план",
	);
	const secondProjectId = secondPointer?.projectId;
	if (!secondProjectId || !secondPointer) {
		throw new Error(
			"Expected the second Project pointer after durable publication.",
		);
	}

	await openProjectDirectory(session.page);
	await expect(
		session.page.getByRole("button", { name: "Открыть Первый план" }),
	).toBeVisible();
	await expect(
		session.page.getByRole("button", { name: "Открыть Второй план" }),
	).toBeVisible();
	await session.page
		.getByRole("button", { name: "Открыть Первый план" })
		.click();
	await expect(session.page.getByTestId("editor-workspace")).toBeVisible();
	await expect(
		session.page.getByTestId("editor-top-bar").getByRole("status"),
	).toContainText("Сохранено");

	await openProjectDirectory(session.page);
	await openProjectDirectoryActions(session.page, "Второй план");
	await session.page
		.getByRole("button", { name: "Переименовать Второй план" })
		.click();
	await expect(
		session.page.getByRole("dialog", { name: "Переименовать проект" }),
	).toBeVisible();
	await session.page
		.getByLabel("Новое название проекта")
		.fill("Черновик без публикации");
	await session.page.getByRole("button", { name: "Отмена" }).click();
	await expect(
		session.page.getByRole("dialog", { name: "Переименовать проект" }),
	).toHaveCount(0);
	await expect
		.poll(async () =>
			(await currentProjectPointers(session.page)).find(
				(pointer) => pointer.projectId === secondProjectId,
			),
		)
		.toEqual(secondPointer);

	await session.page
		.getByRole("button", { name: "Переименовать проект Второй план" })
		.click();
	await expect(
		session.page.getByRole("dialog", { name: "Переименовать проект" }),
	).toBeVisible();
	await session.page.getByLabel("Новое название проекта").fill("Кухня");
	await session.page
		.getByRole("button", { name: "Сохранить название" })
		.click();
	await expect(
		session.page.getByRole("dialog", { name: "Переименовать проект" }),
	).toHaveCount(0);
	const undo = session.page.getByRole("button", { name: "Отменить действие" });
	const redo = session.page.getByRole("button", { name: "Повторить действие" });
	await expect(undo).toBeEnabled();
	await undo.click();
	await expect
		.poll(
			async () =>
				(await currentProjectPointers(session.page)).find(
					(pointer) => pointer.projectId === secondProjectId,
				)?.name,
		)
		.toBe("Второй план");
	await expect(redo).toBeEnabled();
	await redo.click();
	await expect
		.poll(
			async () =>
				(await currentProjectPointers(session.page)).find(
					(pointer) => pointer.projectId === secondProjectId,
				)?.name,
		)
		.toBe("Кухня");
	await session.page
		.getByRole("button", { name: "Переименовать проект Кухня" })
		.click();
	await setTestFault(session.page, "before-pointer-quota");
	await session.page.getByLabel("Новое название проекта").fill("Кухня 2");
	await session.page
		.getByRole("button", { name: "Сохранить название" })
		.click();
	await expect(session.page.locator("#rename-project-error")).toContainText(
		"Прежнее название не изменено",
	);
	await expect(session.page.locator("#rename-project-error")).toContainText(
		"недостаточно места",
	);
	await expect(session.page.getByLabel("Новое название проекта")).toHaveValue(
		"Кухня 2",
	);
	await expect(
		session.page.getByRole("button", { name: "Сохранить название" }),
	).toBeDisabled();
	await expect
		.poll(
			async () =>
				(await currentProjectPointers(session.page)).find(
					(pointer) => pointer.projectId === secondProjectId,
				)?.name,
		)
		.toBe("Кухня");
	await session.page
		.getByRole("dialog", { name: "Переименовать проект" })
		.getByRole("button", { name: "Повторить сохранение" })
		.click();
	await expect(
		session.page.getByTestId("editor-top-bar").getByRole("status"),
	).toContainText("Сохранено");
	await expect(
		session.page.getByRole("dialog", { name: "Переименовать проект" }),
	).toHaveCount(0);
	await openProjectDirectory(session.page);
	await expect(
		session.page.getByRole("button", { name: "Открыть Кухня 2" }),
	).toBeVisible();
	await expect(
		session.page.getByRole("button", { name: "Открыть Первый план" }),
	).toBeVisible();
	await session.page.reload();
	await expect(
		session.page.getByRole("heading", { name: "Проекты", exact: true }),
	).toBeVisible();
	await expect(
		session.page.getByRole("button", { name: "Открыть Кухня 2" }),
	).toBeVisible();
	await expect(
		session.page.getByRole("button", { name: "Открыть Первый план" }),
	).toBeVisible();
	const reopenedPointers = await currentProjectPointers(session.page);
	expect(reopenedPointers).toContainEqual(
		expect.objectContaining({
			name: "Кухня 2",
			projectId: secondProjectId,
		}),
	);
	expect(reopenedPointers).toContainEqual(
		expect.objectContaining({
			name: "Первый план",
			projectId: firstProjectId,
		}),
	);
	await session.context.close();
});

test("PROJECT-E2E-02: return and invalid rename move focus to their accessible targets", async ({
	page: _page,
}, testInfo) => {
	const session = await openPersistentPhone(
		testInfo,
		"project-directory-focus",
	);
	await session.page.goto("/");
	await createProject(session.page, "План для фокуса");

	await openProjectDirectory(session.page);
	await expect(
		session.page.getByRole("heading", { name: "Проекты", exact: true }),
	).toBeFocused();
	await openProjectDirectoryActions(session.page, "План для фокуса");
	await session.page
		.getByRole("button", { name: "Переименовать План для фокуса" })
		.click();
	await expect(session.page.getByLabel("Новое название проекта")).toBeFocused();
	await session.page.getByLabel("Новое название проекта").fill(" \t");
	await session.page
		.getByRole("button", { name: "Сохранить название" })
		.click();
	await expect(session.page.locator("#rename-project-error")).toBeFocused();
	await session.context.close();
});

test("PROJECT-E2E-02: a dangling pointer announces recovery without hiding healthy cards", async ({
	page: _page,
}, testInfo) => {
	const session = await openPersistentPhone(
		testInfo,
		"project-directory-corruption",
	);
	await session.page.goto("/");
	await createProject(session.page, "Здоровый план A");
	await openProjectDirectory(session.page);
	await createProject(session.page, "Здоровый план B");

	await seedDanglingProjectPointer(session.page);
	await session.page.reload();

	await expect(
		session.page.getByRole("heading", { name: "Проекты", exact: true }),
	).toBeVisible();
	await expect(session.page.getByRole("alert")).toContainText(
		"требует восстановления",
	);
	await expect(
		session.page.getByRole("button", { name: "Открыть Здоровый план A" }),
	).toBeVisible();
	await expect(
		session.page.getByRole("button", { name: "Открыть Здоровый план B" }),
	).toBeVisible();
	await session.context.close();
});

test("PROJECT-E2E-03: JSON transfer always imports a separate local Project", async ({
	page: _page,
}, testInfo) => {
	const session = await openPersistentPhone(testInfo, "json-transfer");
	await session.page.goto("/");
	await createProject(session.page, "План для передачи");
	await expect(session.page.getByRole("status")).toContainText("Сохранено");

	await openProjectDirectory(session.page);
	await openProjectDirectoryActions(session.page, "План для передачи");
	const exportDownload = await Promise.all([
		session.page.waitForEvent("download"),
		session.page
			.getByRole("button", { name: "Экспортировать проект План для передачи" })
			.click(),
	]).then(([download]) => download);
	const transferPath = await exportDownload.path();
	if (!transferPath) {
		throw new Error("Expected exported JSON download file");
	}
	await session.page
		.getByLabel("Импортировать проект")
		.setInputFiles(transferPath);
	await expect(session.page.getByTestId("editor-workspace")).toBeVisible();
	await expect(session.page.getByRole("status")).toContainText("Сохранено");

	await openProjectDirectory(session.page);
	await expect(
		session.page.getByRole("button", { name: "Открыть План для передачи" }),
	).toHaveCount(2);
	await session.context.close();
});

test("PROJECT-E2E-03C: a resource-free project uses the same self-contained Portable Backup route offline", async ({
	page: _page,
}, testInfo) => {
	const session = await openPersistentPhone(
		testInfo,
		"portable-backup-transfer",
	);
	await session.page.goto("/");
	await createProject(session.page, "Бэкап для передачи");
	await expect(
		session.page.getByTestId("editor-top-bar").getByRole("status"),
	).toContainText("Сохранено");

	await openProjectDirectory(session.page);
	await openProjectDirectoryActions(session.page, "Бэкап для передачи");
	await session.context.setOffline(true);
	const download = await Promise.all([
		session.page.waitForEvent("download"),
		session.page
			.getByRole("button", {
				name: "Экспортировать проект Бэкап для передачи",
			})
			.click(),
	]).then(([nextDownload]) => nextDownload);
	expect(download.suggestedFilename()).toBe("Бэкап-для-передачи.interiors");
	const transferPath = await download.path();
	if (!transferPath) {
		throw new Error("Expected exported Portable Backup file");
	}
	await session.page.evaluate(() => {
		const subtle = window.crypto.subtle;
		const originalDigest = subtle.digest.bind(subtle);
		Object.defineProperty(subtle, "digest", {
			configurable: true,
			value: async (...arguments_: Parameters<SubtleCrypto["digest"]>) => {
				await new Promise((resolve) => window.setTimeout(resolve, 300));
				return originalDigest(...arguments_);
			},
		});
	});

	await session.page
		.getByLabel("Импортировать проект")
		.setInputFiles(transferPath);
	const importStatus = session.page.getByTestId(
		"project-transfer-import-status",
	);
	await expect(importStatus).toContainText("Проверяем контейнер");
	await expect(
		importStatus.getByRole("progressbar", { name: "Прогресс импорта проекта" }),
	).toBeVisible();
	await expect(session.page.getByTestId("editor-workspace")).toBeVisible();
	await expect(
		session.page.getByTestId("editor-top-bar").getByRole("status"),
	).toContainText("Сохранено");

	await openProjectDirectory(session.page);
	await expect(
		session.page.getByRole("button", { name: "Открыть Бэкап для передачи" }),
	).toHaveCount(2);
	await session.context.close();
});

test("RESOURCE-E2E-01: owner cancellation cleans exclusive staging while restart retains unproven roots without publishing an item", async ({
	page: _page,
}, testInfo) => {
	test.setTimeout(90_000);
	const session = await openPersistentPhone(
		testInfo,
		"resource-admission-lifecycle",
	);
	await session.page.goto("/");
	await createProject(session.page, "Pin admission lifecycle");
	await session.page.getByRole("button", { name: "Создать контур" }).click();
	const revisionBefore = await currentProjectRevisionId(session.page);
	const revisionCountBefore = await durableRevisionCount(session.page);

	const startPreloadedPlacement = async (page: Page) => {
		await page
			.getByRole("button", { name: "Предметы интерьера", exact: true })
			.click();
		const catalog = page.getByRole("dialog", {
			name: "Предметы интерьера",
		});
		await catalog
			.getByRole("button", { name: /^Антикварный кожаный диван —/ })
			.click();
		const place = catalog.getByRole("button", {
			name: "Показать на плане",
		});
		await expect(place).toBeEnabled({ timeout: 30_000 });
		await place.click();
		await expect(catalog).toHaveCount(0, { timeout: 30_000 });
		await clickRectangularRoomCentre(page);
		await expect(page.getByTestId("item-placement-preview")).toHaveAttribute(
			"data-placement-valid",
			"true",
		);
	};

	await startPreloadedPlacement(session.page);
	await pausePinStagingMark(session.page);
	await session.page.getByTestId("item-placement-confirm").click();
	await expect
		.poll(
			async () => (await pinStagingRootInventory(session.page)).leases.length,
		)
		.toBe(1);
	await expect(session.page.getByTestId("item-placement-feedback")).toHaveText(
		"Подготавливаем модель…",
	);
	const cancellationRoots = await pinStagingRootInventory(session.page);
	expect(cancellationRoots.resources).toHaveLength(1);
	expect(cancellationRoots.resources[0]?.pinStagingLeaseId).toBe(
		cancellationRoots.leases[0]?.leaseId,
	);
	const cancelPendingPlacement = session.page.getByTestId(
		"item-placement-cancel",
	);
	await expect(cancelPendingPlacement).toBeEnabled();
	await cancelPendingPlacement.click();
	await releasePinStagingMark(session.page);
	await expect
		.poll(
			async () => (await pinStagingRootInventory(session.page)).leases.length,
		)
		.toBe(0);
	await expect
		.poll(
			async () =>
				(await pinStagingRootInventory(session.page)).resources.length,
		)
		.toBe(0);
	await expect(session.page.getByTestId("item-count")).toHaveText(
		"0 предметов",
	);
	expect(await currentProjectRevisionId(session.page)).toBe(revisionBefore);
	expect(await durableRevisionCount(session.page)).toBe(revisionCountBefore);

	await startPreloadedPlacement(session.page);
	await pausePinStagingMark(session.page);
	await session.page.getByTestId("item-placement-confirm").click();
	await expect
		.poll(
			async () => (await pinStagingRootInventory(session.page)).leases.length,
		)
		.toBe(1);
	const crashRoots = await pinStagingRootInventory(session.page);
	expect(crashRoots.resources).toHaveLength(1);
	expect(crashRoots.resources[0]?.pinStagingLeaseId).toBe(
		crashRoots.leases[0]?.leaseId,
	);
	expect(crashRoots.leases[0]?.publication?.revisionId).not.toBe(
		revisionBefore,
	);
	await session.context.close();

	const reopened = await openPersistentPhone(
		testInfo,
		"resource-admission-lifecycle",
	);
	await reopened.page.goto("/");
	await openProjectCard(reopened.page, "Pin admission lifecycle");
	await expect
		.poll(
			async () => (await pinStagingRootInventory(reopened.page)).leases.length,
		)
		.toBe(1);
	await expect
		.poll(
			async () =>
				(await pinStagingRootInventory(reopened.page)).resources.length,
		)
		.toBe(1);
	expect(
		(await pinStagingRootInventory(reopened.page)).leases[0]?.leaseId,
	).toBe(crashRoots.leases[0]?.leaseId);
	// Another context cannot prove this crashed publication is not still live.
	// Conservative retention must not create a durable item or advance history.

	await expect(reopened.page.getByTestId("item-count")).toHaveText(
		"0 предметов",
	);
	expect(await currentProjectRevisionId(reopened.page)).toBe(revisionBefore);
	expect(await durableRevisionCount(reopened.page)).toBe(revisionCountBefore);
	await expect(
		reopened.page.getByRole("heading", {
			name: "Проект требует восстановления",
		}),
	).toHaveCount(0);
	await expect(reopened.page.getByTestId("writer-lease-notice")).toBeVisible();
	await reopened.page
		.getByRole("button", { name: "Взять редактирование на себя" })
		.click();
	await reopened.page
		.getByRole("button", { name: "Подтвердить перехват" })
		.click();
	await expect(reopened.page.getByTestId("writer-lease-notice")).toHaveCount(0);

	await startPreloadedPlacement(reopened.page);
	await pausePinStagingMark(reopened.page);
	await reopened.page.getByTestId("item-placement-confirm").click();
	await expect
		.poll(
			async () => (await pinStagingRootInventory(reopened.page)).leases.length,
		)
		.toBe(2);
	const foreignWriter = await reopened.context.newPage();
	await foreignWriter.goto("/");
	await openProjectCard(foreignWriter, "Pin admission lifecycle");
	await expect(foreignWriter.getByTestId("writer-lease-notice")).toBeVisible();
	await foreignWriter
		.getByRole("button", { name: "Взять редактирование на себя" })
		.click();
	await foreignWriter
		.getByRole("button", { name: "Подтвердить перехват" })
		.click();
	await expect(foreignWriter.getByTestId("writer-lease-notice")).toHaveCount(0);
	await releasePinStagingMark(reopened.page);
	await expect
		.poll(
			async () => (await pinStagingRootInventory(reopened.page)).leases.length,
		)
		.toBe(2);
	await expect
		.poll(
			async () =>
				(await pinStagingRootInventory(reopened.page)).resources.length,
		)
		.toBe(1);
	await expect(reopened.page.getByTestId("writer-lease-notice")).toBeVisible();
	await expect(reopened.page.getByTestId("item-count")).toHaveText(
		"0 предметов",
	);
	expect(await currentProjectRevisionId(reopened.page)).toBe(revisionBefore);
	expect(await durableRevisionCount(reopened.page)).toBe(revisionCountBefore);
	await foreignWriter.close();
	await reopened.context.close();
});

test("CATALOG-E2E-05 / PROJECT-E2E-03D: an offline self-contained project transfer restores its exact pinned GLB without a remote fetch", async ({
	page: _page,
}, testInfo) => {
	const session = await openPersistentPhone(
		testInfo,
		"portable-backup-custom-glb",
	);
	await session.page.goto("/");
	await createProject(session.page, "Модель для бэкапа");
	await session.page.getByRole("button", { name: "Создать контур" }).click();

	await session.page
		.getByRole("button", { name: "Предметы интерьера", exact: true })
		.click();
	const catalogue = session.page.getByRole("dialog", {
		name: "Предметы интерьера",
	});
	await revealCatalogAuthoring(catalogue);
	await catalogue
		.getByTestId("custom-glb-import-input")
		.evaluate((input, bytes) => {
			const transfer = new DataTransfer();
			transfer.items.add(
				new File([new Uint8Array(bytes)], "portable-resource.glb", {
					type: "model/gltf-binary",
				}),
			);
			(input as HTMLInputElement).files = transfer.files;
			input.dispatchEvent(new Event("change", { bubbles: true }));
		}, Array.from(centimetreSketchfabGlb()));
	await expect(catalogue.getByTestId("custom-glb-preview")).toBeVisible();
	await catalogue.getByLabel("Ширина, мм").fill("500");
	await catalogue.getByLabel("Глубина, мм").fill("500");
	await catalogue.getByLabel("Высота, мм").fill("500");
	await expect(catalogue.getByRole("checkbox")).toHaveCount(0);
	await catalogue
		.getByRole("button", { name: "Добавить в «Кастомное» и разместить" })
		.click();
	await clickRectangularRoomCentre(session.page);
	await session.page.getByTestId("item-placement-confirm").click();
	await expect(session.page.getByTestId("item-count")).toHaveText("1 предмет");
	const sourceViewSwitch = session.page.getByTestId("editor-view-switch");
	await sourceViewSwitch
		.getByRole("button", { name: "3D", exact: true })
		.click();
	await expect(
		session.page.getByRole("region", { name: "3D вид комнаты" }),
	).toBeVisible();
	await sourceViewSwitch
		.getByRole("button", { name: "План 2D", exact: true })
		.click();

	await openProjectDirectory(session.page);
	await openProjectDirectoryActions(session.page, "Модель для бэкапа");
	const exportNetworkRequests: string[] = [];
	session.page.on("request", (request) => {
		if (/^https?:/.test(request.url()))
			exportNetworkRequests.push(request.url());
	});
	await session.context.setOffline(true);
	const download = await Promise.all([
		session.page.waitForEvent("download"),
		session.page
			.getByRole("button", { name: "Экспортировать проект Модель для бэкапа" })
			.click(),
	]).then(([nextDownload]) => nextDownload);
	expect(download.suggestedFilename()).toBe("Модель-для-бэкапа.interiors");
	expect(exportNetworkRequests).toEqual([]);
	const transferPath = await download.path();
	if (!transferPath)
		throw new Error("Expected a custom-resource Portable Backup download file");

	// The source is deliberately made unopenable before import: success below
	// can only come from the GLB bundled in the downloaded .interiors archive.
	await deleteAllCustomAssetResources(session.page);
	await session.page
		.getByLabel("Импортировать проект")
		.setInputFiles(transferPath);
	await expect(session.page.getByTestId("editor-workspace")).toBeVisible();
	await expect(session.page.getByTestId("item-count")).toHaveText("1 предмет");
	await session.page
		.getByTestId("editor-view-switch")
		.getByRole("button", { name: "3D", exact: true })
		.click();
	await expect(
		session.page.getByRole("region", { name: "3D вид комнаты" }),
	).toBeVisible();
	expect(exportNetworkRequests).toEqual([]);
	await session.context.setOffline(false);
	await session.page.reload();
	await expect(
		session.page.getByRole("heading", { name: "Проекты", exact: true }),
	).toBeVisible();
	await expect(
		session.page.getByRole("button", { name: "Открыть Модель для бэкапа" }),
	).toHaveCount(2);
	await expect(readAllCustomAssetResources(session.page)).resolves.toHaveLength(
		1,
	);
	await session.context.close();
});

test("PROJECT-E2E-03E: a corrupt Portable Backup leaves every existing Project unchanged and explains the safe rejection", async ({
	page: _page,
}, testInfo) => {
	const session = await openPersistentPhone(
		testInfo,
		"portable-backup-corrupt-rejection",
	);
	await session.page.goto("/");
	await createProject(session.page, "Сохранный проект");
	await openProjectDirectory(session.page);

	await chooseCorruptPortableBackup(session.page, "повреждённый.interiors");

	await expect(session.page.getByRole("alert")).toHaveText(
		"Не удалось проверить файл проекта. Существующие проекты не изменены.",
	);
	await expect(
		session.page.getByRole("button", { name: "Открыть Сохранный проект" }),
	).toHaveCount(1);
	await session.context.close();
});

test("PROJECT-E2E-03F: the phone import can be cancelled before publication without a partial Project", async ({
	page: _page,
}, testInfo) => {
	const session = await openPersistentPhone(testInfo, "portable-backup-cancel");
	await session.page.goto("/");
	await createProject(session.page, "Исходный проект");
	await openProjectDirectory(session.page);
	await session.page.evaluate(() => {
		const original = File.prototype.arrayBuffer;
		File.prototype.arrayBuffer = function delayedArrayBuffer() {
			return new Promise<ArrayBuffer>((resolve, reject) => {
				window.setTimeout(() => {
					original.call(this).then(resolve, reject);
				}, 350);
			});
		};
	});

	await chooseCorruptPortableBackup(session.page, "отменяемый.interiors");
	const status = session.page.getByTestId("project-transfer-import-status");
	await expect(status).toContainText("Читаем отменяемый.interiors");
	await status.getByRole("button", { name: "Отменить импорт" }).click();
	await expect(status).toContainText("Останавливаем импорт");
	await expect(session.page.getByRole("alert")).toHaveText(
		"Импорт отменён. Существующие проекты не изменены.",
	);
	await expect(
		session.page.getByRole("button", { name: "Открыть Исходный проект" }),
	).toHaveCount(1);
	await session.context.close();
});

test("PROJECT-E2E-04: the offline catalogue uses tappable categories and visual cards", async ({
	page: _page,
}, testInfo) => {
	const session = await openPersistentPhone(testInfo, "catalog-tablet");
	await session.page.goto("/");
	await createProject(session.page, "Каталог");
	await expect(session.page.getByRole("status")).toContainText("Сохранено");

	await session.page
		.getByRole("button", { name: "Предметы интерьера", exact: true })
		.click();
	const catalogue = session.page.getByRole("dialog", {
		name: "Предметы интерьера",
	});
	await expect(catalogue).toBeVisible();
	await expect(
		catalogue.getByRole("navigation", { name: "Категории каталога" }),
	).toBeVisible();
	await catalogue.getByRole("button", { name: "Мебель", exact: true }).click();
	await expect(catalogue.getByTestId("catalog-result-count")).toHaveText(
		"8 предметов",
	);
	await expect(
		catalogue.getByRole("img", { name: /Превью предмета/ }),
	).toHaveCount(8);
	const previewBounds = await catalogue
		.getByRole("img", { name: /Превью предмета/ })
		.first()
		.boundingBox();
	expect(previewBounds?.height).toBeLessThanOrEqual(160);
	await catalogue.getByRole("button", { name: /Кровать —/ }).click();
	await expect(catalogue).toBeVisible();
	await expect(
		catalogue.getByRole("button", { name: "Показать на плане" }),
	).toBeEnabled({ timeout: 30_000 });
	await catalogue.getByRole("button", { name: "Показать на плане" }).click();
	await expect(catalogue).toHaveCount(0);
	await expect(session.page.getByTestId("item-placement-identity")).toHaveText(
		"Кровать",
	);
	await expect(session.page.getByTestId("item-draft-hint")).toHaveCount(0);
	await expect(session.page.getByTestId("item-placement-cancel")).toBeVisible();
	await expect(
		session.page.getByTestId("item-placement-confirm"),
	).toBeDisabled();
	await session.context.close();
});

test("PROJECT-E2E-04A: the phone catalogue keeps its categories and first product preview usable", async ({
	page: _page,
}, testInfo) => {
	const session = await openPersistentPhone(testInfo, "catalog-phone-layout");
	await session.page.goto("/");
	await createProject(session.page, "Каталог на телефоне");
	await expect(session.page.getByRole("status")).toContainText("Сохранено");

	await session.page
		.getByRole("button", { name: "Предметы интерьера", exact: true })
		.click();
	const catalogue = session.page.getByRole("dialog", {
		name: "Предметы интерьера",
	});
	const categories = catalogue.getByRole("navigation", {
		name: "Категории каталога",
	});
	const firstPreview = catalogue
		.getByRole("img", { name: /Превью предмета/ })
		.first();

	await expect(categories).toBeVisible();
	await expect(firstPreview).toBeVisible();
	const [categoriesBox, previewBox, firstCardBox] = await Promise.all([
		categories.boundingBox(),
		firstPreview.boundingBox(),
		catalogue
			.getByRole("button", { name: /Антикварный кожаный диван —/ })
			.boundingBox(),
	]);
	if (!categoriesBox || !previewBox || !firstCardBox) {
		throw new Error(
			"Expected the catalogue category rail, card and its first preview to have layout boxes.",
		);
	}
	expect(categoriesBox.height).toBeGreaterThanOrEqual(44);
	expect(previewBox.height).toBeGreaterThanOrEqual(120);
	expect(firstCardBox.height).toBeGreaterThanOrEqual(previewBox.height + 72);
	await session.context.close();
});

test("PROJECT-E2E-04B: an empty custom catalogue shows its empty state and model import", async ({
	page: _page,
}, testInfo) => {
	const session = await openPersistentPhone(
		testInfo,
		"catalog-custom-empty-state",
	);
	await session.page.goto("/");
	await createProject(session.page, "Своя модель");

	await session.page
		.getByRole("button", { name: "Предметы интерьера", exact: true })
		.click();
	const catalogue = session.page.getByRole("dialog", {
		name: "Предметы интерьера",
	});
	await catalogue
		.getByRole("button", { name: "Кастомное", exact: true })
		.click();

	await expect(catalogue.getByTestId("custom-catalog-empty-state")).toHaveText(
		"Нет своих моделей",
	);
	await expect(catalogue.getByTestId("catalog-authoring")).toContainText(
		"Импорт модели",
	);
	await expect(catalogue.getByTestId("catalog-result-count")).toHaveText(
		"0 предметов",
	);
	await expect(catalogue.getByTestId("custom-catalog-card")).toHaveCount(0);
	await session.context.close();
});

test("HISTORY-E2E-01: a phone editor repairs or explicitly discards history-only resource roots without changing the healthy current revision", async ({
	page: _page,
}, testInfo) => {
	test.setTimeout(90_000);
	const session = await openPersistentPhone(
		testInfo,
		"explicit-history-resource-discard",
	);
	await session.page.goto("/");
	await createProject(session.page, "История локальной модели");
	await session.page.getByRole("button", { name: "Создать контур" }).click();
	await session.page
		.getByRole("button", { name: "Предметы интерьера", exact: true })
		.click();
	const catalogue = session.page.getByRole("dialog", {
		name: "Предметы интерьера",
	});
	await revealCatalogAuthoring(catalogue);
	await catalogue
		.getByTestId("custom-glb-import-input")
		.evaluate((input, bytes) => {
			const transfer = new DataTransfer();
			transfer.items.add(
				new File([new Uint8Array(bytes)], "history-resource.glb", {
					type: "model/gltf-binary",
				}),
			);
			(input as HTMLInputElement).files = transfer.files;
			input.dispatchEvent(new Event("change", { bubbles: true }));
		}, Array.from(centimetreSketchfabGlb()));
	await expect(catalogue.getByTestId("custom-glb-preview")).toBeVisible();
	await catalogue.getByLabel("Ширина, мм").fill("500");
	await catalogue.getByLabel("Глубина, мм").fill("500");
	await catalogue.getByLabel("Высота, мм").fill("500");
	await catalogue
		.getByRole("button", { name: "Добавить в «Кастомное» и разместить" })
		.click();
	await clickRectangularRoomCentre(session.page);
	await session.page.getByTestId("item-placement-confirm").click();
	await expect(session.page.getByTestId("item-count")).toHaveText("1 предмет");

	const exactResource = await readFirstCustomAssetRecord(session.page);
	const undo = session.page.getByRole("button", { name: "Отменить действие" });
	const redo = session.page.getByRole("button", { name: "Повторить действие" });
	await expect(undo).toBeVisible();
	await expect(redo).toBeVisible();
	await undo.click();
	await expect(session.page.getByTestId("item-count")).toHaveText(
		"0 предметов",
	);
	await expect(redo).toBeEnabled();

	const healthyRevisionId = await currentProjectRevisionId(session.page);
	const revisionCount = await durableRevisionCount(session.page);
	await deleteFirstCustomAssetResource(session.page);
	await redo.click();

	const discardDialog = session.page.getByRole("dialog", {
		name: "Очистить историю изменений",
	});
	await expect(discardDialog).toBeVisible();
	await expect(
		session.page.getByTestId("history-resource-recovery-notice"),
	).toBeHidden();
	await expectConfirmationKeyboard(
		session.page,
		discardDialog,
		"Оставить историю",
		"Очистить историю",
	);
	await expectCompactConfirmation(
		session.page,
		discardDialog,
		testInfo.outputPath("dialog-history-large-text.png"),
	);
	await session.page.screenshot({
		path: testInfo.outputPath("dialog-history-discard.png"),
		scale: "css",
	});
	await expect(discardDialog).toContainText(
		"Текущий сохранённый план останется без изменений",
	);
	await expect(discardDialog).toContainText(
		"действия «Отменить» и «Повторить» будут потеряны",
	);
	await expect(session.page.getByTestId("item-count")).toHaveText(
		"0 предметов",
	);
	await expect
		.poll(() => currentProjectRevisionId(session.page))
		.toBe(healthyRevisionId);
	await session.page.keyboard.press("Escape");
	await expect(discardDialog).toHaveCount(0);
	await expect(
		session.page
			.getByTestId("history-resource-recovery-notice")
			.getByRole("button", { name: "Очистить историю", exact: true }),
	).toBeFocused();

	const recoveryNotice = session.page.getByTestId(
		"history-resource-recovery-notice",
	);
	await expect(recoveryNotice).toBeVisible();
	await expect(recoveryNotice).toHaveCSS("border-radius", "24px");
	await expect(recoveryNotice).toHaveCSS(
		"background-color",
		"rgb(255, 255, 255)",
	);
	const historyHeader = await session.page
		.getByTestId("editor-top-bar")
		.boundingBox();
	const historyBox = await recoveryNotice.boundingBox();
	if (!historyHeader || !historyBox)
		throw new Error("Expected the history safety surface");
	expect(historyBox.y).toBeGreaterThanOrEqual(
		historyHeader.y + historyHeader.height,
	);
	await session.page.screenshot({
		path: testInfo.outputPath("safety-history-recovery.png"),
		scale: "css",
	});
	await expect(
		session.page.getByRole("button", { name: "Открыть остальные действия" }),
	).toHaveAttribute("aria-expanded", "false");
	await expect(undo).toBeVisible();
	await expect(redo).toBeVisible();
	await expect(undo).toBeDisabled();
	await expect(redo).toBeDisabled();

	await restoreCustomAssetRecord(session.page, exactResource);
	await recoveryNotice
		.getByRole("button", { name: "Проверить историю снова" })
		.click();
	await expect(recoveryNotice).toHaveCount(0);
	await expect(redo).toBeEnabled();
	await redo.click();
	await expect(session.page.getByTestId("item-count")).toHaveText("1 предмет");
	await expect(undo).toBeEnabled();
	await undo.click();
	await expect(session.page.getByTestId("item-count")).toHaveText(
		"0 предметов",
	);
	await expect
		.poll(() => currentProjectRevisionId(session.page))
		.toBe(healthyRevisionId);

	await deleteFirstCustomAssetResource(session.page);
	await redo.click();
	await expect(discardDialog).toBeVisible();
	await discardDialog.getByRole("button", { name: "Оставить историю" }).click();
	await recoveryNotice
		.getByRole("button", { name: "Очистить историю" })
		.click();
	await expect(discardDialog).toBeVisible();
	await session.page.evaluate(() => {
		const original = IDBDatabase.prototype.transaction;
		IDBDatabase.prototype.transaction = function (...args) {
			const names =
				typeof args[0] === "string" ? [args[0]] : Array.from(args[0]);
			if (
				args[1] === "readwrite" &&
				names.includes("writer-leases") &&
				document.querySelector(
					'dialog[aria-label="Очистить историю изменений"][aria-busy="true"]',
				)
			) {
				IDBDatabase.prototype.transaction = original;
				throw new DOMException(
					"Simulated unavailable writer check",
					"UnknownError",
				);
			}
			return original.apply(this, args);
		};
	});
	await discardDialog
		.getByRole("button", { name: "Очистить историю", exact: true })
		.click();
	await expect(discardDialog.getByRole("alert")).toContainText(
		"История не изменена",
	);
	await expect(
		discardDialog.getByRole("button", { name: "Оставить историю" }),
	).toBeFocused();
	expect(await currentProjectRevisionId(session.page)).toBe(healthyRevisionId);
	expect(await durableRevisionCount(session.page)).toBe(revisionCount);
	await session.page.screenshot({
		path: testInfo.outputPath("dialog-history-discard-error.png"),
		scale: "css",
	});
	await pauseDialogWriterChecks(session.page);
	await discardDialog
		.getByRole("button", { name: "Очистить историю", exact: true })
		.click();
	await expect(discardDialog).toHaveAttribute("aria-busy", "true");
	await expect(
		discardDialog.getByRole("button", { name: "Оставить историю" }),
	).toBeDisabled();
	await session.page.keyboard.press("Tab");
	await expect(discardDialog).toBeFocused();
	await session.page.keyboard.press("Escape");
	await session.page.mouse.click(24, 24);
	await expect(discardDialog).toBeVisible();
	await resumeDialogWriterChecks(session.page);

	await expect(discardDialog).toHaveCount(0);
	await expect(
		session.page.getByRole("button", { name: "Открыть остальные действия" }),
	).toBeFocused();
	await expect(recoveryNotice).toHaveCount(0);
	await expect(
		session.page.getByTestId("project-durability-status"),
	).toContainText("Сохранено локально");
	await expect(
		session.page
			.getByRole("navigation", { name: "Инструменты редактора" })
			.getByRole("button", { name: "Предметы интерьера", exact: true }),
	).toBeEnabled();
	await expect(undo).toBeVisible();
	await expect(redo).toBeVisible();
	await expect(undo).toBeDisabled();
	await expect(redo).toBeDisabled();
	await expect
		.poll(() => currentProjectRevisionId(session.page))
		.toBe(healthyRevisionId);
	await expect
		.poll(() => durableRevisionCount(session.page))
		.toBe(revisionCount);
	await session.context.close();
});

test("PROJECT-E2E-04B: a Sketchfab-style FBX ZIP carries its texture sidecars into placement and exact-repairs a corrupted custom resource", async ({
	page: _page,
}, testInfo) => {
	const session = await openPersistentShortPhone(
		testInfo,
		"fbx-direct-placement",
	);
	await session.page.addInitScript(() => {
		const json = new TextEncoder().encode(
			JSON.stringify({
				asset: { version: "2.0" },
				buffers: [{ byteLength: 0 }],
				scenes: [{ nodes: [] }],
			}),
		);
		const jsonLength = Math.ceil(json.byteLength / 4) * 4;
		const bytes = new Uint8Array(20 + jsonLength);
		const view = new DataView(bytes.buffer);
		view.setUint32(0, 0x46546c67, true);
		view.setUint32(4, 2, true);
		view.setUint32(8, bytes.byteLength, true);
		view.setUint32(12, jsonLength, true);
		view.setUint32(16, 0x4e4f534a, true);
		bytes.set(json, 20);
		bytes.fill(0x20, 20 + json.byteLength);

		class ConvertedFbxWorker {
			private readonly listeners = new Map<
				string,
				Set<(event: unknown) => void>
			>();

			addEventListener(type: string, listener: (event: unknown) => void) {
				const entries =
					this.listeners.get(type) ?? new Set<(event: unknown) => void>();
				entries.add(listener);
				this.listeners.set(type, entries);
			}

			postMessage(message: unknown) {
				window.setTimeout(() => {
					const request = message as {
						readonly sidecarResources?: readonly unknown[];
					};
					const data =
						request.sidecarResources?.length === 4
							? { glbBytes: bytes.buffer.slice(0), kind: "converted" }
							: { kind: "rejected", reasonCode: "FBX_EXTERNAL_RESOURCE" };
					for (const listener of this.listeners.get("message") ?? []) {
						listener({ data });
					}
				}, 300);
			}

			removeEventListener(type: string, listener: (event: unknown) => void) {
				this.listeners.get(type)?.delete(listener);
			}

			terminate() {}
		}

		Object.defineProperty(window, "Worker", {
			configurable: true,
			value: ConvertedFbxWorker,
		});
	});
	await session.page.goto("/");
	await createProject(session.page, "FBX сразу в план");
	await expect(session.page.getByRole("status")).toContainText("Сохранено");
	await session.page.getByRole("button", { name: "Создать контур" }).click();
	await expect(session.page.getByTestId("plan-canvas")).toBeVisible();
	await expect(
		session.page.getByRole("button", {
			name: "Переименовать проект FBX сразу в план",
		}),
	).toBeVisible();
	await expect(
		session.page.getByRole("button", { name: "Размеры плана" }),
	).toBeVisible();

	await session.page
		.getByRole("button", { name: "Предметы интерьера", exact: true })
		.click();
	const catalogue = session.page.getByRole("dialog", {
		name: "Предметы интерьера",
	});
	await revealCatalogAuthoring(catalogue);
	await catalogue
		.getByLabel("Выбрать FBX и текстуры для локального преобразования")
		.setInputFiles([
			{
				// Playwright's public type calls this a Buffer, but the workspace keeps
				// browser tests free of Node globals. Its protocol consumes toString('base64').
				buffer: {
					toString: () =>
						"UEsDBBQAAAAIACQ4EF2Yoe4RHQAAABsAAAAhAAAAc291cmNlL0NoYWlyV2hpdGUgKF9CbGVuZCkgMUsuZmJ4806sTEksSlRwc4pQcMrMSyyqVFBgkGJ4IcPAAABQSwMEFAAAAAgAJDgQXRvfBaUDAAAAAQAAACkAAAB0ZXh0dXJlcy9NYWluUGlsbG93XzFLLUJhc2VDb2xvci5qcGcuanBlZ2MEAFBLAwQUAAAACAAkOBBdoY4MPAMAAAABAAAAJAAAAHRleHR1cmVzL01haW5QaWxsb3dfMUstTm9ybWFsR0wuanBlZ2MCAFBLAwQUAAAACAAkOBBdN74LSwMAAAABAAAAJQAAAHRleHR1cmVzL1BpbGxvd18xSy1CYXNlQ29sb3IuanBnLmpwZWdjBgBQSwMEFAAAAAgAJDgQXZQrb9UDAAAAAQAAACMAAAB0ZXh0dXJlcy9Xb29kXzFLLUJhc2VDb2xvci5qcGcuanBlZ2MBAFBLAQIUABQAAAAIACQ4EF2Yoe4RHQAAABsAAAAhAAAAAAAAAAAAAAAAAAAAAABzb3VyY2UvQ2hhaXJXaGl0ZSAoX0JsZW5kKSAxSy5mYnhQSwECFAAUAAAACAAkOBBdG98FpQMAAAABAAAAKQAAAAAAAAAAAAAAAABcAAAAdGV4dHVyZXMvTWFpblBpbGxvd18xSy1CYXNlQ29sb3IuanBnLmpwZWdQSwECFAAUAAAACAAkOBBdoY4MPAMAAAABAAAAJAAAAAAAAAAAAAAAAACmAAAAdGV4dHVyZXMvTWFpblBpbGxvd18xSy1Ob3JtYWxHTC5qcGVnUEsBAhQAFAAAAAgAJDgQXTe+C0sDAAAAAQAAACUAAAAAAAAAAAAAAAAA6wAAAHRleHR1cmVzL1BpbGxvd18xSy1CYXNlQ29sb3IuanBnLmpwZWdQSwECFAAUAAAACAAkOBBdlCtv1QMAAAABAAAAIwAAAAAAAAAAAAAAAAAxAQAAdGV4dHVyZXMvV29vZF8xSy1CYXNlQ29sb3IuanBnLmpwZWdQSwUGAAAAAAUABQCcAQAAdQEAAAAA",
				} as never,
				mimeType: "application/zip",
				name: "white-armchair-fbx-1k-9mb.zip",
			},
		]);

	await expect(
		catalogue.getByText("Преобразуем white-armchair-fbx-1k-9mb.zip локально…"),
	).toBeVisible();
	await expect(
		catalogue.getByText(
			"Конвертировано из FBX: source/ChairWhite (_Blend) 1K.fbx",
		),
	).toBeVisible();
	await expect(
		catalogue.getByRole("button", {
			name: "Добавить в «Кастомное» и разместить",
		}),
	).toBeVisible();
	await expect(
		catalogue.getByRole("button", { name: "Скачать GLB" }),
	).toHaveCount(0);
	const addAndPlace = catalogue.getByRole("button", {
		name: "Добавить в «Кастомное» и разместить",
	});
	const [catalogueBox, addAndPlaceBox] = await Promise.all([
		catalogue.boundingBox(),
		addAndPlace.boundingBox(),
	]);
	if (!catalogueBox || !addAndPlaceBox) {
		throw new Error(
			"Expected a visible catalogue action in the phone viewport.",
		);
	}
	expect(addAndPlaceBox.y).toBeGreaterThanOrEqual(catalogueBox.y);
	expect(addAndPlaceBox.y + addAndPlaceBox.height).toBeLessThanOrEqual(
		catalogueBox.y + catalogueBox.height,
	);
	await addAndPlace.click();
	await expect(catalogue).toHaveCount(0);
	await clickRectangularRoomCentre(session.page);
	await session.page.getByTestId("item-placement-confirm").click();
	await expect(session.page.getByTestId("item-count")).toHaveText("1 предмет");

	await session.page
		.getByRole("button", { name: "Предметы интерьера", exact: true })
		.click();
	await expect(
		catalogue.getByRole("button", { name: "Кастомное", exact: true }),
	).toBeVisible();
	const customCategoryBounds = await catalogue
		.getByRole("button", { name: "Кастомное", exact: true })
		.boundingBox();
	expect(customCategoryBounds?.height).toBeGreaterThanOrEqual(44);
	await catalogue
		.getByRole("button", { name: "Кастомное", exact: true })
		.click();
	await expect(catalogue.getByTestId("custom-catalog-card")).toHaveCount(1);
	await expect(
		catalogue
			.getByTestId("custom-catalog-card")
			.getByTestId("custom-glb-preview"),
	).toBeVisible();
	await catalogue.getByTestId("custom-catalog-card").click();
	await catalogue.getByRole("button", { name: "Разместить на плане" }).click();
	await clickRectangularRoomPoint(session.page, { x: 0.22, y: 0.25 });
	await expect(
		session.page.getByTestId("item-placement-preview"),
	).toHaveAttribute("data-placement-valid", "true");
	await session.page.getByTestId("item-placement-confirm").click();
	await expect(session.page.getByTestId("item-count")).toHaveText("2 предмета");

	const exactResourceBytes = await readFirstCustomAssetResource(session.page);
	await corruptFirstCustomAssetResource(session.page);
	await session.page.reload();
	await openProjectCard(session.page, "FBX сразу в план", "recovery");
	await expect(session.page.getByRole("status").filter({hasText:"Нужно восстановление"})).toContainText(
		"Нужно восстановление",
	);
	await expect(
		session.page.getByRole("heading", {
			name: "Проект требует восстановления",
		}),
	).toBeVisible();
	await expect(
		session.page.getByTestId("resource-recovery-diagnostic"),
	).toContainText("Редактирование остановлено");
	await expect(session.page.getByLabel("Название проекта")).toHaveCount(0);
	const repairInput = session.page.getByLabel(
		"Выбрать исходные GLB-модели для восстановления",
	);
	await expect(repairInput).toHaveCount(1);
	await expect(repairInput).toHaveAttribute("multiple", "");
	await repairInput.evaluate((input, bytes) => {
		const transfer = new DataTransfer();
		transfer.items.add(
			new File([new Uint8Array(bytes)], "точная-модель.glb", {
				type: "model/gltf-binary",
			}),
		);
		(input as HTMLInputElement).files = transfer.files;
		input.dispatchEvent(new Event("change", { bubbles: true }));
	}, exactResourceBytes);
	await expect(session.page.getByTestId("editor-workspace")).toBeVisible();
	await expect(session.page.getByRole("status")).toContainText("Сохранено");
	await expect(session.page.getByTestId("item-count")).toHaveText("2 предмета");
	await session.context.close();
});

test("CATALOG-E2E-04 / RECOVERY-E2E-01: missing exact custom resources stay blocked across catalog outage and exact repair creates no Revision", async ({
	page: _page,
}, testInfo) => {
	const session = await openPersistentPhone(
		testInfo,
		"batch-custom-resource-recovery",
	);
	await session.page.goto("/");
	await createProject(session.page, "Атомарное восстановление");
	await session.page.getByRole("button", { name: "Создать контур" }).click();

	const placeSelectedAssetInAnyUsableRoomPoint = async () => {
		const [planBox, roomBox] = await Promise.all([
			session.page.getByTestId("plan-canvas").boundingBox(),
			session.page.getByTestId("room-face").boundingBox(),
		]);
		if (!planBox || !roomBox) {
			throw new Error(
				"Expected an interactive plan and its room face for custom-resource recovery.",
			);
		}
		const confirm = session.page.getByTestId("item-placement-confirm");
		const attempts: Array<readonly [number, number, string | null]> = [];
		for (const [horizontal, vertical] of [
			[0.5, 0.5],
			[0.2, 0.2],
			[0.8, 0.2],
			[0.2, 0.8],
			[0.8, 0.8],
		] as const) {
			await session.page.getByTestId("plan-canvas").click({
				position: {
					x: roomBox.x - planBox.x + roomBox.width * horizontal,
					y: roomBox.y - planBox.y + roomBox.height * vertical,
				},
			});
			await session.page.waitForTimeout(100);
			const disabled = await confirm.getAttribute("aria-disabled");
			attempts.push([horizontal, vertical, disabled]);
			if (disabled !== "true") {
				await confirm.click();
				return;
			}
		}
		throw new Error(
			`Expected a usable room point for the selected custom model: ${JSON.stringify({ attempts, planBox, roomBox })}`,
		);
	};

	await session.page
		.getByRole("button", { name: "Предметы интерьера", exact: true })
		.click();
	const firstCatalogue = session.page.getByRole("dialog", {
		name: "Предметы интерьера",
	});
	await revealCatalogAuthoring(firstCatalogue);
	await firstCatalogue
		.getByTestId("custom-glb-import-input")
		.evaluate((input, bytes) => {
			const transfer = new DataTransfer();
			transfer.items.add(
				new File([new Uint8Array(bytes)], "first-recovery.glb", {
					type: "model/gltf-binary",
				}),
			);
			(input as HTMLInputElement).files = transfer.files;
			input.dispatchEvent(new Event("change", { bubbles: true }));
		}, Array.from(centimetreSketchfabGlb()));
	await expect(firstCatalogue.getByTestId("custom-glb-preview")).toBeVisible();
	await firstCatalogue.getByLabel("Ширина, мм").fill("500");
	await firstCatalogue.getByLabel("Глубина, мм").fill("500");
	await firstCatalogue.getByLabel("Высота, мм").fill("500");
	await firstCatalogue
		.getByRole("button", { name: "Добавить в «Кастомное» и разместить" })
		.click();
	await clickRectangularRoomCentre(session.page);
	await session.page.getByTestId("item-placement-confirm").click();
	await expect(session.page.getByTestId("item-count")).toHaveText("1 предмет");

	await session.page
		.getByRole("button", { name: "Предметы интерьера", exact: true })
		.click();
	const secondCatalogue = session.page.getByRole("dialog", {
		name: "Предметы интерьера",
	});
	await revealCatalogAuthoring(secondCatalogue);
	await secondCatalogue
		.getByRole("button", { name: "Другой файл", exact: true })
		.click();
	await secondCatalogue
		.getByTestId("custom-glb-import-input")
		.evaluate((input, bytes) => {
			const transfer = new DataTransfer();
			transfer.items.add(
				new File([new Uint8Array(bytes)], "second-recovery.glb", {
					type: "model/gltf-binary",
				}),
			);
			(input as HTMLInputElement).files = transfer.files;
			input.dispatchEvent(new Event("change", { bubbles: true }));
		}, Array.from(alternateCentimetreSketchfabGlb()));
	await expect(
		secondCatalogue
			.getByRole("region", { name: "Импорт своей GLB-модели" })
			.getByTestId("custom-glb-preview"),
	).toBeVisible();
	await secondCatalogue.getByLabel("Ширина, мм").fill("500");
	await secondCatalogue.getByLabel("Глубина, мм").fill("500");
	await secondCatalogue.getByLabel("Высота, мм").fill("500");
	await secondCatalogue
		.getByRole("button", { name: "Добавить в «Кастомное» и разместить" })
		.click();
	await placeSelectedAssetInAnyUsableRoomPoint();
	await expect(session.page.getByTestId("item-count")).toHaveText("2 предмета");

	const revisionBeforeRecovery = await currentProjectRevisionId(session.page);
	const revisionCountBeforeRecovery = await durableRevisionCount(session.page);
	const exactBytes = await readAllCustomAssetResources(session.page);
	expect(exactBytes).toHaveLength(2);
	await deleteAllCustomAssetResources(session.page);
	await session.page.reload();
	await openProjectCard(session.page, "Атомарное восстановление", "recovery");
	await expect(session.page.getByRole("status").filter({hasText:"Нужно восстановление"})).toContainText(
		"Нужно восстановление",
	);
	await expect(
		session.page.getByRole("heading", {
			name: "Проект требует восстановления",
		}),
	).toBeVisible();
	await expect(session.page.getByLabel("Название проекта")).toHaveCount(0);
	const recoveryScreen = session.page.getByTestId("project-recovery-screen");
	await expect(recoveryScreen).toContainText("Размещённых предметов: 2");
	await expect(
		recoveryScreen.getByRole("button", {
			name: "Восстановить исходные GLB",
			exact: true,
		}),
	).toHaveCSS("background-color", "rgb(25, 118, 185)");
	await session.page.screenshot({
		path: testInfo.outputPath("safety-resource-recovery.png"),
		scale: "css",
	});
	const reachableDiagnostic = await session.page
		.getByTestId("resource-recovery-diagnostic")
		.innerText();
	await session.page.route("**/catalog-api/**", (route) =>
		route.abort("failed"),
	);
	await session.page.reload();
	await openProjectCard(session.page, "Атомарное восстановление", "recovery");
	await expect(session.page.getByRole("status").filter({hasText:"Нужно восстановление"})).toContainText(
		"Нужно восстановление",
	);
	await expect(
		session.page.getByTestId("resource-recovery-diagnostic"),
	).toHaveText(reachableDiagnostic);
	const repairInput = session.page.getByLabel(
		"Выбрать исходные GLB-модели для восстановления",
	);
	await expect(repairInput).toHaveAttribute("multiple", "");

	await repairInput.evaluate((input, bytes) => {
		const transfer = new DataTransfer();
		transfer.items.add(
			new File([new Uint8Array(bytes)], "only-one.glb", {
				type: "model/gltf-binary",
			}),
		);
		(input as HTMLInputElement).files = transfer.files;
		input.dispatchEvent(new Event("change", { bubbles: true }));
	}, exactBytes[0]);
	await expect(session.page.getByRole("alert")).toContainText(
		"точный набор исходных GLB",
	);
	await expect(readAllCustomAssetResources(session.page)).resolves.toHaveLength(
		0,
	);
	await expect
		.poll(() => currentProjectRevisionId(session.page))
		.toBe(revisionBeforeRecovery);
	await expect
		.poll(() => durableRevisionCount(session.page))
		.toBe(revisionCountBeforeRecovery);

	await session.page.evaluate(() => {
		const original = File.prototype.arrayBuffer;
		File.prototype.arrayBuffer = async function () {
			await new Promise((resolve) => window.setTimeout(resolve, 1000));
			return original.call(this);
		};
	});
	await repairInput.evaluate((input, bytesList) => {
		const transfer = new DataTransfer();
		for (const [index, bytes] of bytesList.entries()) {
			transfer.items.add(
				new File([new Uint8Array(bytes)], `exact-${index}.glb`, {
					type: "model/gltf-binary",
				}),
			);
		}
		(input as HTMLInputElement).files = transfer.files;
		input.dispatchEvent(new Event("change", { bubbles: true }));
	}, exactBytes);
	await expect(
		recoveryScreen.getByRole("button", { name: "Вернуться к проектам" }),
	).toBeDisabled();
	await expect(
		session.page.getByRole("button", {
			name: "Повторить проверку",
			exact: true,
		}),
	).toBeDisabled();
	await expect(session.page.getByTestId("editor-workspace")).toBeVisible();
	await expect(session.page.getByTestId("item-count")).toHaveText("2 предмета");
	await expect(readAllCustomAssetResources(session.page)).resolves.toHaveLength(
		2,
	);
	await expect
		.poll(() => currentProjectRevisionId(session.page))
		.toBe(revisionBeforeRecovery);
	await expect
		.poll(() => durableRevisionCount(session.page))
		.toBe(revisionCountBeforeRecovery);
	await session.context.close();
});

test("RECOVERY-E2E-01: cancelled removal keeps the prior Revision and confirmed RecoveryChangeSet publishes exactly one next Revision", async ({
	page: _page,
}, testInfo) => {
	test.slow();
	const session = await openPersistentPhone(
		testInfo,
		"recovery-changeset-removal",
	);
	await session.page.goto("/");
	await createProject(session.page, "Удаление недоступной модели");
	await session.page.getByRole("button", { name: "Создать контур" }).click();

	await session.page
		.getByRole("button", { name: "Предметы интерьера", exact: true })
		.click();
	const catalogue = session.page.getByRole("dialog", {
		name: "Предметы интерьера",
	});
	await revealCatalogAuthoring(catalogue);
	await catalogue
		.getByTestId("custom-glb-import-input")
		.evaluate((input, bytes) => {
			const transfer = new DataTransfer();
			transfer.items.add(
				new File([new Uint8Array(bytes)], "remove-in-recovery.glb", {
					type: "model/gltf-binary",
				}),
			);
			(input as HTMLInputElement).files = transfer.files;
			input.dispatchEvent(new Event("change", { bubbles: true }));
		}, Array.from(centimetreSketchfabGlb()));
	await expect(catalogue.getByTestId("custom-glb-preview")).toBeVisible({
		timeout: 15_000,
	});
	await catalogue
		.getByRole("button", { name: "Добавить в «Кастомное» и разместить" })
		.click();
	await clickRectangularRoomCentre(session.page);
	await session.page.getByTestId("item-placement-confirm").click();
	await expect(session.page.getByTestId("item-count")).toHaveText("1 предмет");

	const revisionBeforeRecovery = await currentProjectRevisionId(session.page);
	const revisionCountBeforeRecovery = await durableRevisionCount(session.page);
	await deleteAllCustomAssetResources(session.page);
	await session.page.reload();
	await openProjectCard(
		session.page,
		"Удаление недоступной модели",
		"recovery",
	);
	await expect(session.page.getByRole("status").filter({hasText:"Нужно восстановление"})).toContainText(
		"Нужно восстановление",
		{ timeout: 20_000 },
	);
	await expect(
		session.page.getByText("Размещённых предметов: 1"),
	).toBeVisible();
	await session.page
		.getByRole("button", { name: "Удалить все недоступные модели" })
		.click();
	await expect(
		session.page.getByRole("button", {
			name: "Подтвердить удаление всех недоступных моделей",
		}),
	).toBeVisible();
	await session.page.getByRole("button", { name: "Отмена" }).click();
	await expect(
		session.page.getByRole("button", {
			name: "Подтвердить удаление всех недоступных моделей",
		}),
	).toHaveCount(0);
	await expect(session.page.getByRole("status").filter({hasText:"Нужно восстановление"})).toContainText(
		"Нужно восстановление",
	);
	await expect
		.poll(() => currentProjectRevisionId(session.page))
		.toBe(revisionBeforeRecovery);
	await expect
		.poll(() => durableRevisionCount(session.page))
		.toBe(revisionCountBeforeRecovery);
	await session.page
		.getByRole("button", { name: "Удалить все недоступные модели" })
		.click();
	await session.page
		.getByRole("button", {
			name: "Подтвердить удаление всех недоступных моделей",
		})
		.click();

	await expect(session.page.getByRole("status")).toContainText("Сохранено");
	await expect(session.page.getByTestId("item-count")).toHaveText(
		"0 предметов",
	);
	await expect(
		session.page.getByRole("button", { name: "Стена", exact: true }),
	).toBeEnabled();
	await expect
		.poll(() => currentProjectRevisionId(session.page))
		.not.toBe(revisionBeforeRecovery);
	await expect
		.poll(() => durableRevisionCount(session.page))
		.toBe(revisionCountBeforeRecovery + 1);
	await expect(readAllCustomAssetResources(session.page)).resolves.toHaveLength(
		0,
	);
	await session.context.close();
});

test("PROJECT-E2E-04C: direct Sketchfab FBX-derived GLB suggests metre dimensions instead of 100× centimetre bounds", async ({
	page: _page,
}, testInfo) => {
	const session = await openPersistentPhone(
		testInfo,
		"direct-sketchfab-glb-scale",
	);
	await session.page.goto("/");
	await createProject(session.page, "Нормализация GLB");
	await session.page
		.getByRole("button", { name: "Предметы интерьера", exact: true })
		.click();
	const catalogue = session.page.getByRole("dialog", {
		name: "Предметы интерьера",
	});
	await revealCatalogAuthoring(catalogue);
	await catalogue
		.getByTestId("custom-glb-import-input")
		.evaluate((input, bytes) => {
			const transfer = new DataTransfer();
			transfer.items.add(
				new File([new Uint8Array(bytes)], "white-armchair-fbx-1k-9mb.glb", {
					type: "model/gltf-binary",
				}),
			);
			(input as HTMLInputElement).files = transfer.files;
			input.dispatchEvent(new Event("change", { bubbles: true }));
		}, Array.from(centimetreSketchfabGlb()));

	await expect(catalogue.getByLabel("Ширина, мм")).toHaveValue("2000");
	await expect(catalogue.getByLabel("Глубина, мм")).toHaveValue("2000");
	await expect(catalogue.getByLabel("Высота, мм")).toHaveValue("2000");
	await expect(catalogue.getByTestId("custom-glb-preview")).toBeVisible();
	await session.context.close();
});

test("PROJECT-E2E-04D: a verified import remains in Custom and can be placed into a different local project", async ({
	page: _page,
}, testInfo) => {
	const session = await openPersistentPhone(testInfo, "shared-custom-library");
	await session.page.goto("/");
	await createProject(session.page, "Первый каталог");
	await session.page.getByRole("button", { name: "Создать контур" }).click();
	await session.page
		.getByRole("button", { name: "Предметы интерьера", exact: true })
		.click();
	const firstCatalogue = session.page.getByRole("dialog", {
		name: "Предметы интерьера",
	});
	await revealCatalogAuthoring(firstCatalogue);
	await firstCatalogue
		.getByTestId("custom-glb-import-input")
		.evaluate((input, bytes) => {
			const transfer = new DataTransfer();
			transfer.items.add(
				new File([new Uint8Array(bytes)], "shared-armchair.glb", {
					type: "model/gltf-binary",
				}),
			);
			(input as HTMLInputElement).files = transfer.files;
			input.dispatchEvent(new Event("change", { bubbles: true }));
		}, Array.from(centimetreSketchfabGlb()));
	await expect(firstCatalogue.getByTestId("custom-glb-preview")).toBeVisible();
	await firstCatalogue
		.getByRole("button", { name: "Добавить в «Кастомное» и разместить" })
		.click();
	await clickRectangularRoomCentre(session.page);
	await session.page.getByTestId("item-placement-cancel").click();
	await session.page.reload();
	await openProjectCard(session.page, "Первый каталог");
	await expect(session.page.getByRole("status")).toContainText("Сохранено");

	await openProjectDirectory(session.page);
	await createProject(session.page, "Второй каталог");
	await session.page.getByRole("button", { name: "Создать контур" }).click();
	await session.page
		.getByRole("button", { name: "Предметы интерьера", exact: true })
		.click();
	const secondCatalogue = session.page.getByRole("dialog", {
		name: "Предметы интерьера",
	});
	await secondCatalogue
		.getByRole("button", { name: "Кастомное", exact: true })
		.click();
	const sharedCard = secondCatalogue.getByTestId("custom-catalog-card");
	await expect(sharedCard).toHaveCount(1);
	await expect(sharedCard.getByTestId("custom-glb-preview")).toBeVisible();
	await sharedCard.click();
	await secondCatalogue
		.getByRole("button", { name: "Разместить на плане" })
		.click();
	await clickRectangularRoomCentre(session.page);
	await session.page.getByTestId("item-placement-confirm").click();
	await expect(session.page.getByTestId("item-count")).toHaveText("1 предмет");
	await session.context.close();
});

test("PROJECT-E2E-04E: reopening an older Project promotes its verified custom model back into the shared library", async ({
	page: _page,
}, testInfo) => {
	const session = await openPersistentPhone(
		testInfo,
		"promote-existing-custom-library",
	);
	await session.page.goto("/");
	await createProject(session.page, "Старый импорт");
	await session.page.getByRole("button", { name: "Создать контур" }).click();
	await session.page
		.getByRole("button", { name: "Предметы интерьера", exact: true })
		.click();
	const firstCatalogue = session.page.getByRole("dialog", {
		name: "Предметы интерьера",
	});
	await revealCatalogAuthoring(firstCatalogue);
	await firstCatalogue
		.getByTestId("custom-glb-import-input")
		.evaluate((input, bytes) => {
			const transfer = new DataTransfer();
			transfer.items.add(
				new File([new Uint8Array(bytes)], "legacy-armchair.glb", {
					type: "model/gltf-binary",
				}),
			);
			(input as HTMLInputElement).files = transfer.files;
			input.dispatchEvent(new Event("change", { bubbles: true }));
		}, Array.from(centimetreSketchfabGlb()));
	await firstCatalogue
		.getByRole("button", { name: "Добавить в «Кастомное» и разместить" })
		.click();
	await clickRectangularRoomCentre(session.page);
	await expect(
		session.page.getByTestId("item-placement-preview"),
	).toHaveAttribute("data-placement-valid", "true");
	await session.page.getByTestId("item-placement-confirm").click();
	await expect(session.page.getByTestId("item-count")).toHaveText("1 предмет");

	await clearCustomAssetLibrary(session.page);
	await session.page.reload();
	await openProjectCard(session.page, "Старый импорт");
	await expect(session.page.getByRole("status")).toContainText("Сохранено");
	await openProjectDirectory(session.page);
	await createProject(session.page, "После миграции");
	await session.page
		.getByRole("button", { name: "Предметы интерьера", exact: true })
		.click();
	const secondCatalogue = session.page.getByRole("dialog", {
		name: "Предметы интерьера",
	});
	await secondCatalogue
		.getByRole("button", { name: "Кастомное", exact: true })
		.click();
	await expect(secondCatalogue.getByTestId("custom-catalog-card")).toHaveCount(
		1,
	);
	await expect(secondCatalogue.getByTestId("custom-glb-preview")).toBeVisible();
	await session.context.close();
});

test("PROJECT-E2E-04F: unavailable Custom bytes are not placeable and exact re-import restores the card without a Project revision", async ({
	page: _page,
}, testInfo) => {
	const session = await openPersistentPhone(
		testInfo,
		"unavailable-custom-library-resource",
	);
	await session.page.goto("/");
	await createProject(session.page, "Недоступная библиотека");
	await session.page.getByRole("button", { name: "Создать контур" }).click();
	await session.page
		.getByRole("button", { name: "Предметы интерьера", exact: true })
		.click();
	const catalogue = session.page.getByRole("dialog", {
		name: "Предметы интерьера",
	});
	await revealCatalogAuthoring(catalogue);
	await catalogue
		.getByTestId("custom-glb-import-input")
		.evaluate((input, bytes) => {
			const transfer = new DataTransfer();
			transfer.items.add(
				new File([new Uint8Array(bytes)], "recoverable-armchair.glb", {
					type: "model/gltf-binary",
				}),
			);
			(input as HTMLInputElement).files = transfer.files;
			input.dispatchEvent(new Event("change", { bubbles: true }));
		}, Array.from(centimetreSketchfabGlb()));
	await catalogue
		.getByRole("button", { name: "Добавить в «Кастомное» и разместить" })
		.click();
	await clickRectangularRoomCentre(session.page);
	await session.page.getByTestId("item-placement-cancel").click();
	const revisionBeforeRepair = await currentProjectRevisionId(session.page);

	await deleteFirstCustomAssetResource(session.page);
	await session.page.reload();
	await openProjectCard(session.page, "Недоступная библиотека");
	await session.page
		.getByRole("button", { name: "Предметы интерьера", exact: true })
		.click();
	const unavailableCatalogue = session.page.getByRole("dialog", {
		name: "Предметы интерьера",
	});
	await unavailableCatalogue
		.getByRole("button", { name: "Кастомное", exact: true })
		.click();
	const unavailableCard = unavailableCatalogue.getByTestId(
		"custom-catalog-card",
	);
	await expect(unavailableCard).toBeDisabled();
	await expect(unavailableCard).toContainText(
		"Модель недоступна локально. Импортируйте исходный GLB заново.",
	);
	await expect(unavailableCard.getByTestId("custom-glb-preview")).toHaveCount(
		0,
	);
	await expect
		.poll(() => currentProjectRevisionId(session.page))
		.toBe(revisionBeforeRepair);

	await revealCatalogAuthoring(unavailableCatalogue);
	await unavailableCatalogue
		.getByTestId("custom-glb-import-input")
		.evaluate((input, bytes) => {
			const transfer = new DataTransfer();
			transfer.items.add(
				new File([new Uint8Array(bytes)], "recoverable-armchair.glb", {
					type: "model/gltf-binary",
				}),
			);
			(input as HTMLInputElement).files = transfer.files;
			input.dispatchEvent(new Event("change", { bubbles: true }));
		}, Array.from(centimetreSketchfabGlb()));
	await unavailableCatalogue
		.getByRole("button", { name: "Добавить в «Кастомное» и разместить" })
		.click();
	await clickRectangularRoomCentre(session.page);
	await session.page.getByTestId("item-placement-cancel").click();
	await session.page
		.getByRole("button", { name: "Предметы интерьера", exact: true })
		.click();
	const restoredCatalogue = session.page.getByRole("dialog", {
		name: "Предметы интерьера",
	});
	await restoredCatalogue
		.getByRole("button", { name: "Кастомное", exact: true })
		.click();
	const restoredCard = restoredCatalogue.getByTestId("custom-catalog-card");
	await expect(restoredCard).toBeEnabled();
	await expect(restoredCard.getByTestId("custom-glb-preview")).toBeVisible();
	await expect
		.poll(() => currentProjectRevisionId(session.page))
		.toBe(revisionBeforeRepair);

	await tamperFirstCustomAssetResource(session.page);
	await session.page.reload();
	await openProjectCard(session.page, "Недоступная библиотека");
	await session.page
		.getByRole("button", { name: "Предметы интерьера", exact: true })
		.click();
	const tamperedCatalogue = session.page.getByRole("dialog", {
		name: "Предметы интерьера",
	});
	await tamperedCatalogue
		.getByRole("button", { name: "Кастомное", exact: true })
		.click();
	await expect(
		tamperedCatalogue.getByTestId("custom-catalog-card"),
	).toBeDisabled();
	await expect(
		tamperedCatalogue.getByTestId("custom-catalog-card"),
	).toContainText(
		"Модель недоступна локально. Импортируйте исходный GLB заново.",
	);
	await expect(tamperedCatalogue.getByTestId("custom-glb-preview")).toHaveCount(
		0,
	);
	await expect
		.poll(() => currentProjectRevisionId(session.page))
		.toBe(revisionBeforeRepair);

	await corruptFirstCustomAssetResource(session.page);
	await session.page.reload();
	await openProjectCard(session.page, "Недоступная библиотека");
	await session.page
		.getByRole("button", { name: "Предметы интерьера", exact: true })
		.click();
	const malformedCatalogue = session.page.getByRole("dialog", {
		name: "Предметы интерьера",
	});
	await malformedCatalogue
		.getByRole("button", { name: "Кастомное", exact: true })
		.click();
	await expect(
		malformedCatalogue.getByTestId("custom-catalog-card"),
	).toBeDisabled();
	await expect(
		malformedCatalogue.getByTestId("custom-catalog-card"),
	).toContainText(
		"Модель недоступна локально. Импортируйте исходный GLB заново.",
	);
	await expect(
		malformedCatalogue.getByTestId("custom-glb-preview"),
	).toHaveCount(0);
	await expect
		.poll(() => currentProjectRevisionId(session.page))
		.toBe(revisionBeforeRepair);
	await session.context.close();
});

test("PROJECT-E2E-04G: direct exact re-import reuses the active Project definition", async ({
	page: _page,
}, testInfo) => {
	const session = await openPersistentPhone(
		testInfo,
		"same-project-direct-reimport",
	);
	await session.page.goto("/");
	await createProject(session.page, "Повторный импорт");
	await session.page.getByRole("button", { name: "Создать контур" }).click();
	await session.page
		.getByRole("button", { name: "Предметы интерьера", exact: true })
		.click();
	const firstCatalogue = session.page.getByRole("dialog", {
		name: "Предметы интерьера",
	});
	await revealCatalogAuthoring(firstCatalogue);
	await firstCatalogue
		.getByTestId("custom-glb-import-input")
		.evaluate((input, bytes) => {
			const transfer = new DataTransfer();
			transfer.items.add(
				new File([new Uint8Array(bytes)], "same-project-armchair.glb", {
					type: "model/gltf-binary",
				}),
			);
			(input as HTMLInputElement).files = transfer.files;
			input.dispatchEvent(new Event("change", { bubbles: true }));
		}, Array.from(centimetreSketchfabGlb()));
	await expect(firstCatalogue.getByTestId("custom-glb-preview")).toBeVisible();
	await firstCatalogue.getByLabel("Ширина, мм").fill("500");
	await firstCatalogue.getByLabel("Глубина, мм").fill("500");
	await firstCatalogue.getByLabel("Высота, мм").fill("500");
	await firstCatalogue
		.getByRole("button", { name: "Добавить в «Кастомное» и разместить" })
		.click();
	await clickRectangularRoomCentre(session.page);
	await expect(
		session.page.getByTestId("item-placement-preview"),
	).toHaveAttribute("data-placement-valid", "true");
	await session.page.getByTestId("item-placement-confirm").click();
	await expect(session.page.getByTestId("item-count")).toHaveText("1 предмет");

	await session.page
		.getByRole("button", { name: "Предметы интерьера", exact: true })
		.click();
	const repeatCatalogue = session.page.getByRole("dialog", {
		name: "Предметы интерьера",
	});
	await revealCatalogAuthoring(repeatCatalogue);
	await repeatCatalogue
		.getByRole("button", { name: "Другой файл", exact: true })
		.click();
	await repeatCatalogue
		.getByTestId("custom-glb-import-input")
		.evaluate((input, bytes) => {
			const transfer = new DataTransfer();
			transfer.items.add(
				new File([new Uint8Array(bytes)], "same-project-armchair.glb", {
					type: "model/gltf-binary",
				}),
			);
			(input as HTMLInputElement).files = transfer.files;
			input.dispatchEvent(new Event("change", { bubbles: true }));
		}, Array.from(centimetreSketchfabGlb()));
	await expect(
		repeatCatalogue
			.getByRole("region", { name: "Импорт своей GLB-модели" })
			.getByTestId("custom-glb-preview"),
	).toBeVisible();
	await repeatCatalogue.getByLabel("Ширина, мм").fill("500");
	await repeatCatalogue.getByLabel("Глубина, мм").fill("500");
	await repeatCatalogue.getByLabel("Высота, мм").fill("500");
	await expect(repeatCatalogue.getByLabel("Ширина, мм")).toHaveValue("500");
	await expect(repeatCatalogue.getByLabel("Глубина, мм")).toHaveValue("500");
	await expect(repeatCatalogue.getByLabel("Высота, мм")).toHaveValue("500");
	await repeatCatalogue
		.getByRole("button", { name: "Добавить в «Кастомное» и разместить" })
		.click();
	await clickRectangularRoomPoint(session.page, { x: 0.22, y: 0.25 });
	await expect(
		session.page.getByTestId("item-placement-preview"),
	).toHaveAttribute("data-placement-valid", "true");
	await session.page.getByTestId("item-placement-confirm").click();
	await expect(session.page.getByTestId("item-count")).toHaveText("2 предмета");
	const viewSwitch = session.page.getByTestId("editor-view-switch");
	await viewSwitch.getByRole("button", { name: "3D", exact: true }).click();
	await expect(
		session.page.getByTestId("three-dimensional-canvas"),
	).toBeVisible();
	await expect(
		session.page.getByTestId("three-dimensional-custom-glb-status"),
	).toHaveText("rendered:1");
	await expect(
		session.page.getByTestId("three-dimensional-renderer-diagnostics"),
	).toContainText("WebGL2");
	await expect(
		session.page.getByText("3D-сцена не инициализировалась."),
	).toHaveCount(0);
	await expect(
		session.page.getByRole("complementary", {
			name: "GLB-модель предмета в 3D",
		}),
	).toHaveCount(0);
	await session.page.unrouteAll({ behavior: "ignoreErrors" });
	await session.context.close();
});

test("PROJECT-E2E-02: another editor context stays read-only until it explicitly takes over the writer lease", async ({
	page: _page,
}, testInfo) => {
	const session = await openPersistentPhone(testInfo, "writer-lease-takeover");
	await session.page.goto("/");
	await createProject(session.page, "Один автор");
	await expect(session.page.getByRole("status")).toContainText("Сохранено");

	const secondPage = await session.context.newPage();
	await secondPage.goto("/");
	await openProjectCard(secondPage, "Один автор");
	await expect(secondPage.getByTestId("writer-lease-notice")).toBeVisible();
	await expect(
		secondPage.getByRole("button", { name: "Стена", exact: true }),
	).toBeDisabled();
	await expect(
		secondPage.getByLabel("Ширина, мм", { exact: true }),
	).toBeDisabled();
	await expect(
		secondPage.getByRole("button", { name: "Создать контур" }),
	).toBeDisabled();

	await secondPage
		.getByRole("button", { name: "Взять редактирование на себя" })
		.click();
	await expect(
		secondPage.getByRole("button", { name: "Подтвердить перехват" }),
	).toBeVisible();
	await secondPage.getByRole("button", { name: "Отмена" }).click();
	await expect(secondPage.getByTestId("writer-lease-notice")).toBeVisible();
	await expect(
		secondPage.getByRole("button", { name: "Стена", exact: true }),
	).toBeDisabled();
	await secondPage
		.getByRole("button", { name: "Взять редактирование на себя" })
		.click();
	await secondPage
		.getByRole("button", { name: "Подтвердить перехват" })
		.click();
	await expect(secondPage.getByTestId("writer-lease-notice")).toHaveCount(0);
	await expect(
		secondPage.getByRole("button", { name: "Стена", exact: true }),
	).toBeEnabled();
	await secondPage.getByRole("button", { name: "Создать контур" }).click();
	await expect(secondPage.getByRole("status")).toContainText("Сохранено");

	await session.page.bringToFront();
	await session.page.evaluate(() =>
		document.dispatchEvent(new Event("visibilitychange")),
	);
	await expect(session.page.getByTestId("writer-lease-notice")).toBeVisible();
	await expect(session.page.getByTestId("room-face")).toBeVisible();
	await expect(
		session.page.getByRole("button", { name: "Стена", exact: true }),
	).toBeDisabled();
	await session.context.close();
});

test("PROJECT-E2E-01: a dangling current pointer is recovery-needed and cannot become a new Project", async ({
	page: _page,
}, testInfo) => {
	const session = await openPersistentPhone(testInfo, "dangling-pointer");
	await session.page.goto("/");
	await createProject(session.page, "Не терять");
	await expect(session.page.getByRole("status")).toContainText("Сохранено");
	await session.page.evaluate(
		() =>
			new Promise<void>((resolve, reject) => {
				const request = window.indexedDB.open("interiors-editor-projects");
				request.onerror = () => reject(request.error);
				request.onsuccess = () => {
					const database = request.result;
					const transaction = database.transaction("revisions", "readwrite");
					transaction.objectStore("revisions").clear();
					transaction.oncomplete = () => {
						database.close();
						resolve();
					};
					transaction.onerror = () => reject(transaction.error);
				};
			}),
	);

	await session.page.reload();
	await expect(session.page.getByRole("status").filter({hasText:"Нужно восстановление"})).toContainText(
		"Нужно восстановление",
	);
	await expect(session.page.getByLabel("Название проекта")).toHaveCount(0);
	await expect(session.page.getByTestId("first-run-help")).toHaveCount(0);
	await expect(
		session.page.getByRole("button", { name: "Создать проект", exact: true }),
	).toHaveCount(0);
	await expect(
		session.page.getByRole("button", {
			name: "Восстановить исходные GLB",
			exact: true,
		}),
	).toHaveCount(0);
	const recovery = session.page.getByTestId("project-recovery-screen");
	await expect(recovery).toContainText(
		"Не удалось проверить сохранённую версию",
	);
	await session.page.setViewportSize({ width: 360, height: 640 });
	await session.page.evaluate(() => {
		document.documentElement.style.fontSize = "200%";
	});
	for (const button of await recovery.getByRole("button").all()) {
		await button.scrollIntoViewIfNeeded();
		const box = await button.boundingBox();
		expect(box?.height).toBeGreaterThanOrEqual(44);
		expect((box?.x ?? 0) + (box?.width ?? 0)).toBeLessThanOrEqual(360);
	}
	await recovery
		.getByRole("button", { name: "Повторить проверку", exact: true })
		.click();
	await expect(recovery).toBeVisible();
	await expect(currentProjectPointers(session.page)).resolves.toHaveLength(1);
	await session.page.evaluate(() => {
		document.documentElement.style.fontSize = "";
	});
	await session.page.screenshot({
		path: testInfo.outputPath("safety-project-recovery.png"),
		scale: "css",
	});
	await session.context.close();
});

test("SAFETY-E2E-01: a failed save keeps its explanation, durable backup and retry together without losing the pending change", async ({
	page: _page,
}, testInfo) => {
	const session = await openPersistentPhone(testInfo, "calm-save-failure");
	await session.page.setViewportSize({ width: 393, height: 852 });
	await session.page.goto("/");
	await createProject(session.page, "Сохранённая планировка");
	await session.page.getByRole("button", { name: "Создать контур" }).click();
	const before = await currentProjectRevisionId(session.page);
	await session.page
		.getByRole("button", { name: "Рука и выбор", exact: true })
		.click();
	await session.page.getByTestId("wall-segment").first().click();
	await session.page
		.getByTestId("editor-action-dock")
		.getByRole("button", { name: "Свойства", exact: true })
		.click();
	await session.page
		.getByTestId("selected-wall-inspector")
		.getByRole("button", { name: "Удалить стену", exact: true })
		.click();
	await setTestFault(session.page, "before-pointer-quota");
	await session.page
		.getByTestId("opening-conflict-preview")
		.getByRole("button", { name: /^Удалить стену/ })
		.click();
	const notice = session.page.getByTestId("persistence-failure-notice");
	await expect(notice).toBeVisible();
	await expect(notice).toContainText("Не удалось сохранить");
	await expect(notice).toContainText("недостаточно места");
	await expect(notice).toContainText(
		"Несохранённую правку можно скачать отдельным файлом",
	);
	await expect(notice).toHaveCSS("background-color", "rgb(255, 255, 255)");
	await expect(notice).toHaveCSS("border-radius", "24px");
	await expect(
		session.page.getByRole("button", {
			name: "Повторить сохранение",
			exact: true,
		}),
	).toHaveCount(1);
	const retry = notice.getByRole("button", {
		name: "Повторить сохранение",
		exact: true,
	});
	await expect(retry).toBeFocused();
	await expect(session.page.getByTestId("wall-segment")).toHaveCount(4);
	expect(await currentProjectRevisionId(session.page)).toBe(before);
	await session.page.screenshot({
		path: testInfo.outputPath("safety-save-failure.png"),
		scale: "css",
	});
	await session.page.setViewportSize({ width: 360, height: 640 });
	await session.page.evaluate(() => {
		document.documentElement.style.fontSize = "200%";
	});
	for (const button of await notice.getByRole("button").all()) {
		await button.scrollIntoViewIfNeeded();
		const box = await button.boundingBox();
		if (!box) throw new Error("Expected a reachable save failure action");
		expect(box.height).toBeGreaterThanOrEqual(44);
		expect(box.x).toBeGreaterThanOrEqual(0);
		expect(box.x + box.width).toBeLessThanOrEqual(360);
		expect(box.y + box.height).toBeLessThanOrEqual(640);
	}
	expect(
		await notice.evaluate(
			(element) => element.scrollWidth <= element.clientWidth,
		),
	).toBe(true);
	await session.page.evaluate(() => {
		document.documentElement.style.fontSize = "";
	});
	await session.page.evaluate(() => {
		const original = HTMLAnchorElement.prototype.click;
		HTMLAnchorElement.prototype.click = () => {
			HTMLAnchorElement.prototype.click = original;
			throw new Error("Test download creation failure");
		};
	});
	await notice
		.getByRole("button", { name: "Скачать сохранённую версию", exact: true })
		.click();
	await expect(
		notice
			.getByRole("alert")
			.filter({ hasText: "Не удалось подготовить файл проекта" }),
	).toBeVisible();
	expect(await currentProjectRevisionId(session.page)).toBe(before);
	const download = await Promise.all([
		session.page.waitForEvent("download"),
		notice
			.getByRole("button", { name: "Скачать сохранённую версию", exact: true })
			.click(),
	]).then(([file]) => file);
	const backupPath = await download.path();
	if (!backupPath) throw new Error("Expected the last durable backup");
	await expect(notice).toBeVisible();
	expect(await currentProjectRevisionId(session.page)).toBe(before);
	await retry.click();
	await expect(notice).toHaveCount(0);
	await expect(session.page.getByTestId("wall-segment")).toHaveCount(3);
	expect(await currentProjectRevisionId(session.page)).not.toBe(before);
	const imported = await openPersistentPhone(testInfo, "calm-save-backup");
	await imported.page.goto("/");
	await imported.page
		.getByLabel("Импортировать проект")
		.setInputFiles(backupPath);
	await expect(imported.page.getByTestId("wall-segment")).toHaveCount(4);
	await imported.context.close();
	await session.context.close();
});

test("SAFETY-E2E-02: save retry remains reachable above an open room sheet and preserves its edited fields", async ({
	page: _page,
}, testInfo) => {
	const session = await openPersistentPhone(testInfo, "safety-room-overlay");
	await session.page.goto("/");
	await createProject(session.page, "Высота комнаты");
	await session.page.getByRole("button", { name: "Создать контур" }).click();
	await session.page
		.getByRole("button", { name: "Рука и выбор", exact: true })
		.click();
	await session.page
		.getByRole("button", { name: "Помещения", exact: true })
		.click();
	const directory = session.page.getByRole("dialog", { name: "Помещения" });
	await directory.getByLabel("Высота помещения, мм").fill("2800");
	const before = await currentProjectRevisionId(session.page);
	await setTestFault(session.page, "before-pointer-quota");
	await directory
		.getByRole("button", { name: "Сохранить помещение", exact: true })
		.click();
	const notice = session.page.getByTestId("persistence-failure-notice");
	await expect(notice).toBeVisible();
	await expect(directory).not.toHaveAttribute("aria-modal", "true");
	await expect(
		notice.getByRole("button", { name: "Повторить сохранение", exact: true }),
	).toBeFocused();
	await session.page.keyboard.press("Tab");
	await expect(
		notice.getByRole("button", {
			name: "Скачать несохранённую правку",
			exact: true,
		}),
	).toBeFocused();
	await session.page.keyboard.press("Tab");
	await expect(
		notice.getByRole("button", {
			name: "Скачать сохранённую версию",
			exact: true,
		}),
	).toBeFocused();
	await expect(directory.getByLabel("Высота помещения, мм")).toHaveValue(
		"2800",
	);
	expect(await currentProjectRevisionId(session.page)).toBe(before);
	await notice
		.getByRole("button", { name: "Повторить сохранение", exact: true })
		.click({ timeout: 4000 });
	await expect(notice).toHaveCount(0);
	await expect(directory).toHaveAttribute("aria-modal", "true");
	await expect(directory.getByLabel("Высота помещения, мм")).toHaveValue(
		"2800",
	);
	await expect(session.page.getByTestId("editor-top-bar").getByRole("status")).toContainText("Сохранено");
	await expect.poll(() => currentProjectRevisionId(session.page)).not.toBe(before);
	expect(await currentProjectRevisionId(session.page)).not.toBe(before);
	await session.context.close();
});

// Actual default Web composition; empty legacy drawings require the explicit wire route.
test("PROJECT-E2E-03T: the default browser exposes a separate Telegram wire file and preserves its exact legacy source", async ({ page: _page }, testInfo) => {
 const session = await openPersistentPhone(testInfo, "telegram-wire-export");
 try {
  await session.page.goto("/");
  await createProject(session.page, "План для Telegram");
  await expect(session.page.getByTestId("editor-top-bar").getByRole("status")).toContainText("Сохранено");
  const snapshot = () => session.page.evaluate(() => new Promise<{ projects: unknown[]; revisions: unknown[] }>((resolve, reject) => {
   const request = indexedDB.open("interiors-editor-projects");
   request.onupgradeneeded = () => { request.transaction?.abort(); reject(new Error("Expected existing legacy Project database")); };
   request.onerror = () => reject(request.error);
   request.onsuccess = () => {
    const database = request.result, tx = database.transaction(["projects", "revisions"], "readonly");
    const projects = tx.objectStore("projects").getAll(), revisions = tx.objectStore("revisions").getAll();
    tx.oncomplete = () => { database.close(); resolve({ projects: projects.result, revisions: revisions.result }); };
    tx.onerror = () => { database.close(); reject(tx.error); }; tx.onabort = () => { database.close(); reject(tx.error); };
   };
  }));
  const before = await snapshot(), pointers = await currentProjectPointers(session.page), roots = await pinStagingRootInventory(session.page);
  expect(pointers).toHaveLength(1);
  const pointer = pointers[0];
  const revision = before.revisions.find(row => row !== null && typeof row === "object" && Reflect.get(row, "revisionId") === pointer.currentRevisionId);
  if (!revision || typeof revision !== "object") throw new Error("Missing actual source Revision");
  const candidate: unknown = Reflect.get(revision, "candidate");
  if (!candidate || typeof candidate !== "object") throw new Error("Missing actual source candidate");
  const originalProject: unknown = Reflect.get(candidate, "project");
  await openProjectDirectory(session.page); await openProjectDirectoryActions(session.page, "План для Telegram");
  const oldExport = session.page.getByRole("button", { name: "Экспортировать проект План для Telegram", exact: true });
  await expect(oldExport).toBeEnabled();
  const wireExport = session.page.getByRole("button", { name: /^Экспорт файла для переноса:/ });
  await expect(wireExport).toBeVisible(); await expect(wireExport).toBeEnabled();
  const received = session.page.waitForEvent("download", { timeout: 5_000 });
  await wireExport.click({ timeout: 5_000 }); await expect(received).resolves.toBeDefined();
  const download = await received, path = await download.path();
  if (!path) throw new Error("Missing actual local browser wire download");
  expect(download.suggestedFilename()).toMatch(/\.interiors$/);
  const fsName = "node:fs/promises";
  const fs = await import(fsName) as { readFile(path: string): Promise<Uint8Array> };
  const checksum = { sha256Bytes: async (bytes: Uint8Array) => Array.from(new Uint8Array(await crypto.subtle.digest("SHA-256", new Uint8Array(bytes).buffer)), byte => byte.toString(16).padStart(2, "0")).join("") };
  const codec = new RuntimePortableBackupCodec(checksum, project => validateRuntimeV1Project(project));
  const decoded = await codec.decode(new Uint8Array(await fs.readFile(path)));
  expect(decoded.kind).toBe("decoded");
  if (decoded.kind !== "decoded") throw new Error("Actual browser wire file did not pass the real portable decoder");
  expect(decoded.schema).toBe("runtime-v1-wire");
  expect(decoded.metadata.sourceProjectId).toBe(pointer.projectId);
  expect(decoded.decodedProject).toEqual(originalProject);
  expect(decoded.resources).toEqual([]);
  expect(await snapshot()).toEqual(before); expect(await pinStagingRootInventory(session.page)).toEqual(roots);
  await expect(oldExport).toBeEnabled();
 } finally { await session.context.close(); }
});
