import {expect,type Locator,type Page,test} from "@playwright/test";
import type {PublicationCandidate,VersionedCatalogPublication} from "../../src/application/ports";
import {installEntryAudit,audit} from "./telegram-entry-support";
import {signedExample, fixtureEditionTime} from "./telegram-entry-signed-fixture";
import {clickRectangularRoomCentre, clickRectangularRoomPoint} from "./room-geometry-fixture";

async function saved(page:Page){await expect(page.getByTestId("editor-top-bar").getByRole("status")).toHaveText("Сохранено");}
async function createRoom(page:Page,name:string){
 await expect(page.getByTestId("project-hub")).toBeVisible();
 await page.getByRole("button",{name:"Новый проект",exact:true}).click();await page.getByRole("textbox",{name:"Название проекта",exact:true}).fill(name);
 await page.getByRole("button",{name:"Создать проект",exact:true}).click();
 await page.getByRole("textbox",{name:"Ширина, мм",exact:true}).fill("5000");
 await page.getByRole("textbox",{name:"Глубина, мм",exact:true}).fill("4000");
 await page.getByRole("textbox",{name:"Высота, мм",exact:true}).fill("2800");
 await page.getByRole("button",{name:"Создать контур",exact:true}).click();await saved(page);
}
async function publication(page:Page):Promise<VersionedCatalogPublication>{
 const response=await page.request.get("/catalog-api/v1/catalogs/current",{headers:{Accept:"application/json"}});expect(response.status()).toBe(200);
 const bytes=new Uint8Array(await response.body()),digest=await crypto.subtle.digest("SHA-256",bytes),hash=Array.from(new Uint8Array(digest),b=>b.toString(16).padStart(2,"0")).join("");
 expect(response.headers().etag).toBe(`"${hash}"`);
 return {...await response.json(),envelopeHash:hash};
}
async function scopeState(page:Page){
 return page.evaluate(async()=>{
  const name=window.__telegramEntryProof.audit.opens.find(name=>name.startsWith("interiors-editor-projects:tma-v1-"));
  if(!name)throw new Error("No admitted scoped store");
  const database=await new Promise<IDBDatabase>((resolve,reject)=>{const r=indexedDB.open(name);r.onsuccess=()=>resolve(r.result);r.onerror=()=>reject(r.error);});
  try{
   const transaction=database.transaction(["projects","revisions","resources","publication-attempts"],"readonly");
   const done=new Promise<void>((resolve,reject)=>{transaction.oncomplete=()=>resolve();transaction.onabort=()=>reject(transaction.error);});
   const pointers=transaction.objectStore("projects").getAll(),revisions=transaction.objectStore("revisions").getAll(),resources=transaction.objectStore("resources").getAll(),attempts=transaction.objectStore("publication-attempts").getAll();
   await done;
   const pointer=pointers.result[0],revision=revisions.result.find(row=>row.revisionId===pointer?.currentRevisionId);
   if(pointers.result.length!==1||!revision?.candidate)throw new Error("Expected exactly one current scoped Durable Revision");
   const pinned=await Promise.all(resources.result.map(async row=>{
    if(!(row.blob instanceof Blob))throw new Error("Missing actual pinned Blob");
    const bytes=await row.blob.arrayBuffer(),hash=await crypto.subtle.digest("SHA-256",bytes);
    return {resourceHash:row.resourceHash,byteLength:bytes.byteLength,sha256:Array.from(new Uint8Array(hash),b=>b.toString(16).padStart(2,"0")).join(""),durable:row.durable,roots:row.roots};
   }));
   return {current:revision.candidate as PublicationCandidate,revisions:revisions.result,projects:pointers.result,pinned,creation:attempts.result.find(row=>row.attemptId===revision.creationAttemptId),resourceManifest:revision.resourceManifest};
  }finally{database.close();}
 });
}
const ownModelPath = decodeURIComponent(
	new URL(
		"../../../catalog-control-plane/src/main/resources/catalog/evidence-assets/evidence-floor-vase.glb",
		import.meta.url,
	).pathname,
);
const malformedModelPath = decodeURIComponent(
	new URL("../../public/icon.svg", import.meta.url).pathname,
);
const ownModelName = "Своя ваза";

async function openCatalog(page: Page) {
	const button = page
		.getByRole("navigation", { name: "Инструменты редактора" })
		.getByRole("button", { name: "Предметы интерьера", exact: true });
	if (await button.isVisible()) {
		await button.click();
	} else {
		await page
			.getByRole("button", { name: "Открыть остальные действия", exact: true })
			.click();
		await page
			.getByRole("button", { name: "Предметы интерьера", exact: true })
			.click();
	}
	return page.getByRole("dialog", { name: "Предметы интерьера", exact: true });
}

async function openOwnModels(page: Page) {
	const catalog = await openCatalog(page);
	await catalog
		.getByRole("tab", { name: "Мои модели", exact: true })
		.click();
	await expect(catalog.getByRole("tab", { name: "Мои модели", exact: true })).toHaveAttribute("aria-selected", "true");
	return catalog;
}

async function importOwnModel(page: Page) {
	const catalog = await openCatalog(page);
	const [chooser] = await Promise.all([
		page.waitForEvent("filechooser"),
		catalog
			.getByRole("button", { name: "Импортировать свой GLB", exact: true })
			.click(),
	]);
	await chooser.setFiles(ownModelPath);
	await expect(catalog.getByRole("tab", { name: "Мои модели", exact: true })).toHaveAttribute("aria-selected", "true");
	await catalog
		.getByRole("textbox", { name: "Название модели", exact: true })
		.fill(ownModelName);
	return catalog;
}

async function placeOwnModel(page: Page, name: string) {
	await page.goto("/");
	await createRoom(page, name);
	const before = await scopeState(page);
	const catalog = await importOwnModel(page);
	expect(await scopeState(page)).toEqual(before);
	await catalog
		.getByRole("button", {
			name: "Добавить в «Мои модели» и разместить",
			exact: true,
		})
		.click();
	await expect(catalog).toHaveCount(0);
	expect((await scopeState(page)).current).toEqual(before.current);
	await clickRectangularRoomCentre(page);
	await expect(page.getByTestId("item-placement-preview")).toHaveAttribute(
		"data-placement-valid",
		"true",
	);
	await page
		.getByRole("button", {
			name: "Подтвердить размещение предмета",
			exact: true,
		})
		.click();
	await expect
		.poll(async () => (await scopeState(page)).current.revision.revisionId)
		.not.toBe(before.current.revision.revisionId);
	await saved(page);
	return { before, after: await scopeState(page) };
}

test.beforeEach(async ({ page, baseURL }) => {
	if (!baseURL) throw new Error("No isolated target");
	await page.route("**/*", (route) =>
		new URL(route.request().url()).origin === new URL(baseURL).origin
			? route.continue()
			: route.abort(),
	);
	await page.clock.setFixedTime(new Date(fixtureEditionTime));
	await installEntryAudit(page, "signed", signedExample);
});

test("TMA-OWN-GLB: a deliberate local import pins exact bytes, renders and reopens on the floor", async ({
	page,
}, info) => {
	const networkCatalogRequests: string[] = [];
	page.on("request", (request) => {
		if (new URL(request.url()).pathname.startsWith("/catalog-api/"))
			networkCatalogRequests.push(request.url());
	});
	const { before, after } = await placeOwnModel(page, "Telegram own model");
	const deliveredFixture = await page.request.get(
		"/catalog/evidence-floor-vase.glb",
	);
	expect(deliveredFixture.status()).toBe(200);
	const bytes = Uint8Array.from(await deliveredFixture.body());
	const digest = await crypto.subtle.digest("SHA-256", bytes);
	const sha256 = Array.from(new Uint8Array(digest), (byte) =>
		byte.toString(16).padStart(2, "0"),
	).join("");
	expect(after.revisions).toHaveLength(before.revisions.length + 1);
	expect(after.current.project.level).toEqual(before.current.project.level);
	expect(after.current.project.assetInstances).toEqual([
		expect.objectContaining({
			anchorClass: "floor",
			label: ownModelName,
			roomId: before.current.project.level.rooms[0]?.roomId,
		}),
	]);
	expect(after.pinned).toEqual([
		expect.objectContaining({
			resourceHash: sha256,
			byteLength: bytes.byteLength,
			sha256,
			durable: true,
		}),
	]);
	expect(after.resourceManifest).toContainEqual({
		resourceHash: sha256,
		byteLength: bytes.byteLength,
	});
	expect(after.creation).toMatchObject({
		state: "published",
		revisionId: after.current.revision.revisionId,
		receipt: {
			revisionId: after.current.revision.revisionId,
			checksum: after.current.revision.checksum,
			resourceManifest: after.resourceManifest,
		},
	});
	await page
		.getByTestId("editor-view-switch")
		.getByRole("button", { name: "3D", exact: true })
		.click();
	await expect(
		page.getByTestId("three-dimensional-custom-glb-status"),
	).toHaveText("rendered:1", { timeout: 30000 });
	expect(await scopeState(page)).toEqual(after);
	await info.attach("own-glb-3d", {
		body: await page.screenshot(),
		contentType: "image/png",
	});
	await page.reload();
	await expect(page.getByTestId("project-hub")).toBeVisible();
	await page
		.getByRole("button", { name: "Открыть Telegram own model", exact: true })
		.click();
	await saved(page);
	expect(await scopeState(page)).toEqual(after);
	// A fresh context can reopen the previous writer's project read-only.
	const notice = page.getByTestId("writer-lease-notice");
	if (await notice.isVisible()) {
		await notice.getByRole("button", { name: "Взять редактирование на себя" }).click();
		await notice.getByRole("button", { name: "Подтвердить", exact: true }).click();
		await expect(notice).toBeHidden();
	}
	const library = await openOwnModels(page);
	await expect(
		library
			.getByTestId("custom-catalog-card")
			.filter({ hasText: ownModelName }),
	).toBeEnabled();
	await library.getByTestId("custom-catalog-card").filter({ hasText: ownModelName }).click();
	const importButton = library.getByRole("button", { name: "Импортировать свой GLB", exact: true });
	const [cancelled] = await Promise.all([page.waitForEvent("filechooser"), importButton.click()]);
	await cancelled.setFiles([]);
	await expect(library.getByTestId("custom-catalog-card")).toHaveAttribute("aria-pressed", "true");
	const [replacement] = await Promise.all([page.waitForEvent("filechooser"), importButton.click()]);
	await replacement.setFiles(ownModelPath);
	await expect(library.getByRole("textbox", { name: "Название модели", exact: true })).toBeVisible();
	await expect(library.getByTestId("custom-catalog-card")).toHaveAttribute("aria-pressed", "false");
	await expect(library.getByRole("button", { name: "Добавить в «Мои модели» и разместить" })).toBeEnabled();
	expect(await scopeState(page)).toEqual(after);
	await expect(library.getByTestId("preloaded-catalog-card")).toHaveCount(0);
	expect(networkCatalogRequests).toEqual([]);
	const observed = await audit(page);
	expect(
		observed.registrations +
			observed.unregisters +
			observed.deletes +
			observed.cacheDeletes,
	).toBe(0);
	expect(
		observed.opens.every((name) =>
			name.startsWith("interiors-editor-projects:tma-v1-"),
		),
	).toBe(true);
});

test("TMA-OFFLINE-01: local catalogue, pinned model, edit and history work with the network down", async ({
	page,
	context,
}) => {
	const { after } = await placeOwnModel(page, "Offline pinned model");
	await context.setOffline(true);
	await page
		.getByTestId("editor-view-switch")
		.getByRole("button", { name: "3D", exact: true })
		.click();
	await expect(
		page.getByTestId("three-dimensional-custom-glb-status"),
	).toHaveText("rendered:1", { timeout: 30000 });
	expect(await scopeState(page)).toEqual(after);
	await page
		.getByTestId("editor-view-switch")
		.getByRole("button", { name: "План 2D", exact: true })
		.click();
	await page.getByRole("button", { name: "Помещения", exact: true }).click();
	const rooms = page.getByRole("dialog", { name: "Помещения", exact: true });
	await rooms
		.getByRole("textbox", { name: "Высота помещения, мм", exact: true })
		.fill("3000");
	await rooms
		.getByRole("button", { name: "Сохранить помещение", exact: true })
		.click();
	await expect
		.poll(
			async () =>
				(await scopeState(page)).current.project.level.rooms[0]?.heightMm,
		)
		.toBe(3000);
	await rooms
		.getByRole("button", { name: "Закрыть помещения", exact: true })
		.click();
	const history = page.getByRole("group", {
		name: "История изменений",
		exact: true,
	});
	await history.getByRole("button", { name: /^Отменить/ }).click();
	await expect
		.poll(
			async () =>
				(await scopeState(page)).current.project.level.rooms[0]?.heightMm,
		)
		.toBe(2800);
	await history.getByRole("button", { name: /^Повторить/ }).click();
	await expect
		.poll(
			async () =>
				(await scopeState(page)).current.project.level.rooms[0]?.heightMm,
		)
		.toBe(3000);
	const edited = await scopeState(page);
	expect(edited.pinned).toEqual(after.pinned);
	expect(edited.current.project.assetInstances).toEqual(
		after.current.project.assetInstances,
	);
	const catalog = await openCatalog(page);
	await expect(catalog.locator('[data-greybox-preset="chair"]')).toBeVisible();
	await expect(catalog.locator('[data-greybox-preset="sconce"]')).toHaveCount(
		0,
	);
	await expect(
		catalog.getByRole("button", { name: "Модели GLB", exact: true }),
	).toHaveCount(0);
	await catalog
		.getByRole("tab", { name: "Мои модели", exact: true })
		.click();
	await expect(
		catalog
			.getByTestId("custom-catalog-card")
			.filter({ hasText: ownModelName }),
	).toBeEnabled();
	await expect(catalog.getByTestId("catalog-publication-error")).toHaveCount(0);
	expect(await scopeState(page)).toEqual(edited);
});

test("TMA-RENDERER-01: unsupported WebGL2 keeps the real signed scoped editor writable in Plan and changes no Project on fallback",async({page})=>{
 await page.addInitScript(()=>{
  const original=HTMLCanvasElement.prototype.getContext;
  Object.defineProperty(HTMLCanvasElement.prototype,"getContext",{configurable:true,value:function(this:HTMLCanvasElement,type:string,options?:unknown){return type==="webgl2"?null:Reflect.apply(original,this,[type,options]);}});
 });
 await page.goto("/");await createRoom(page,"Safe Plan");const before=await scopeState(page);
 await page.getByTestId("editor-view-switch").getByRole("button",{name:"3D",exact:true}).click();
 await expect(page.getByTestId("three-dimensional-renderer-diagnostics")).toContainText("WebGL2 недоступен");
 await page.getByTestId("editor-view-switch").getByRole("button",{name:"План 2D",exact:true}).click();
 await expect(page.getByTestId("plan-canvas")).toBeVisible();expect(await scopeState(page)).toEqual(before);
});

test("TMA-RENDERER-02: actual native WebGL loss and restoration rebuild the pinned model without a Revision",async({page})=>{
 const {after: state}=await placeOwnModel(page,"Restored real model");
 await page.getByTestId("editor-view-switch").getByRole("button",{name:"3D",exact:true}).click();await expect(page.getByTestId("three-dimensional-custom-glb-status")).toHaveText("rendered:1",{timeout:30000});
 await page.getByTestId("three-dimensional-canvas").evaluate(async element=>{
  const canvas=element as HTMLCanvasElement,context=canvas.getContext("webgl2"),extension=context?.getExtension("WEBGL_lose_context");
  if(!extension)throw new Error("Native context-loss extension unavailable");
  Reflect.set(window,"__telegramCatalogRestoreContext",()=>extension.restoreContext());
  await new Promise<void>(resolve=>{canvas.addEventListener("webglcontextlost",()=>resolve(),{once:true});extension.loseContext();});
 });
 await expect(page.getByTestId("three-dimensional-renderer-diagnostics")).toContainText("графический контекст потерян");
 expect(await scopeState(page)).toEqual(state);
 await page.evaluate(()=>Reflect.get(window,"__telegramCatalogRestoreContext")());
 await expect(page.getByTestId("three-dimensional-renderer-diagnostics")).toContainText("качество",{timeout:20000});
 await expect(page.getByTestId("three-dimensional-custom-glb-status")).toHaveText("rendered:1",{timeout:30000});expect(await scopeState(page)).toEqual(state);
});

test("TMA-OWN-GLB-REJECT: malformed local bytes create no Project, revision or pin", async ({
	page,
}) => {
	await page.goto("/");
	await createRoom(page, "Rejected GLB");
	const before = await scopeState(page);
	const catalog = await openOwnModels(page);
	await catalog
		.getByTestId("custom-glb-import-input")
		.setInputFiles(malformedModelPath);
	await expect(catalog.getByText(/Это не целая GLB 2.0/)).toBeVisible();
	await expect(catalog.getByTestId("catalog-placement-bar")).toBeHidden();
	expect(await scopeState(page)).toEqual(before);
});

test("TMA-OWN-GLB-CANCEL: late local read cannot add a model after leaving the import review", async ({
	page,
}) => {
	await page.addInitScript(() => {
		const original = File.prototype.arrayBuffer;
		Object.defineProperty(File.prototype, "arrayBuffer", {
			configurable: true,
			value: async function (this: File): Promise<ArrayBuffer> {
				if (this.name === "evidence-floor-vase.glb") {
					await new Promise<void>((resolve) =>
						Reflect.set(window, "releaseOwnGlbRead", resolve),
					);
				}
				return original.call(this);
			},
		});
	});
	await page.goto("/");
	await createRoom(page, "Cancelled local GLB");
	const before = await scopeState(page);
	const catalog = await openOwnModels(page);
	await catalog
		.getByTestId("custom-glb-import-input")
		.setInputFiles(ownModelPath);
	await expect(
		catalog.getByText(/Проверяем evidence-floor-vase.glb локально/),
	).toBeVisible();
	await expect
		.poll(() =>
			page.evaluate(() => typeof Reflect.get(window, "releaseOwnGlbRead")),
		)
		.toBe("function");
	await catalog
		.getByRole("tab", { name: "Предметы", exact: true })
		.click();
	await page.evaluate(() => Reflect.get(window, "releaseOwnGlbRead")());
	await expect(catalog.locator('[data-greybox-preset="chair"]')).toBeVisible();
	await catalog
		.getByRole("tab", { name: "Мои модели", exact: true })
		.click();
	await expect(catalog.getByTestId("custom-glb-import-input")).toBeEnabled();
	await expect(catalog.getByTestId("catalog-placement-bar")).toBeHidden();
	expect(await scopeState(page)).toEqual(before);
});

test("TMA-CATALOG-RANGE: actual same-origin proxy preserves an exact published byte range and immutable ETag",async({page})=>{
 await page.goto("/");const pub=await publication(page),asset=pub.assets.find(a=>a.assetId==="single-bed");if(!asset)throw new Error("Actual published model missing");
 const url=`/catalog-api/v1/resources/sha256/${asset.resource.sha256}`,whole=await page.request.get(url,{headers:{Accept:asset.resource.mediaType}});expect(whole.status()).toBe(200);
 const full=await whole.body();expect(full.byteLength).toBe(asset.resource.byteLength);
 const partial=await page.request.get(url,{headers:{Accept:asset.resource.mediaType,Range:"bytes=16-47"}});expect(partial.status()).toBe(206);expect(partial.headers()["content-range"]).toBe(`bytes 16-47/${full.byteLength}`);expect(partial.headers().etag).toBe(whole.headers().etag);expect(await partial.body()).toEqual(full.subarray(16,48));
});

for (const width of [320, 390]) {
	test(`TMA-CATALOG-MODAL: at ${width}px and double text the selected model and keyboard stay inside the catalog`, async ({ page }) => {
		await placeOwnModel(page, "Крупный текст");
		await page.setViewportSize({ width, height: 750 });
		await page.evaluate(() => { document.documentElement.style.fontSize = "200%"; });
		const opener = page.getByRole("navigation", { name: "Инструменты редактора" }).getByRole("button", { name: "Предметы интерьера" });
		await opener.tap();
		const catalog = page.getByRole("dialog", { name: "Предметы интерьера" });
		const close = catalog.getByRole("button", { name: "Закрыть предметы интерьера" });
		const expectHeaderFits = async () => {
			const geometry = await catalog.evaluate(sheet => {
				const viewport = window.visualViewport;
				const controls = Array.from(sheet.querySelectorAll<HTMLElement>(
					'[role="tab"], input[placeholder="Найти предмет"], button',
				)).filter(control => control.matches('[role="tab"], input[placeholder="Найти предмет"]') || control.textContent === "Импортировать свой GLB");
				return {
					windowX: window.scrollX,
					viewportX: viewport?.offsetLeft ?? 0,
					scrollLeft: sheet.scrollLeft,
					overflow: sheet.scrollWidth - sheet.clientWidth,
					clipped: controls.filter(control => {
						const box = control.getBoundingClientRect();
						return box.left < -0.5 || box.right > (viewport?.width ?? window.innerWidth) + 0.5;
					}).map(control => control.getAttribute("aria-label") || control.textContent),
				};
			});
			expect.soft(geometry).toEqual({ windowX: 0, viewportX: 0, scrollLeft: 0, overflow: 0, clipped: [] });
		};
		await expectHeaderFits();
		await expect.soft(catalog.getByRole("tab", { name: "Предметы", exact: true })).toBeFocused();
		await catalog.getByRole("tab", { name: "Мои модели" }).tap();
		await expectHeaderFits();
		const card = catalog.getByTestId("custom-catalog-card");
		await card.tap();
		const selected = catalog.getByTestId("catalog-placement-bar");
		for (const source of ["library", "file"] as const) {
			if (source === "file") {
				const [chooser] = await Promise.all([
					page.waitForEvent("filechooser"),
					catalog.getByRole("button", { name: "Импортировать свой GLB" }).tap(),
				]);
				await chooser.setFiles(ownModelPath);
			}
			const submit = selected.getByRole("button", {
				name: source === "file" ? "Добавить в «Мои модели» и разместить" : "Разместить на плане",
			});
			await expect(submit).toBeEnabled();
			await expectHeaderFits();
			await submit.scrollIntoViewIfNeeded();
			const fits = await selected.evaluate(panel => {
				const button = panel.querySelector("button"), title = panel.querySelector("strong");
				if (!button || !title) return false;
				const a = button.getBoundingClientRect(), b = title.getBoundingClientRect();
				return b.width >= 40 && title.scrollWidth <= title.clientWidth + 1 &&
					(a.top >= b.bottom || a.left >= b.right) && a.width >= 44 && a.height >= 44 &&
					a.left >= 0 && a.right <= window.innerWidth + 1;
			});
			expect.soft(fits, `${source} selection and action must both be readable`).toBe(true);
			await submit.focus();
			await page.keyboard.press("Tab");
			await expect.soft(close).toBeFocused({ timeout: 800 });
			await close.focus();
			await expectHeaderFits();
			await page.keyboard.press("Shift+Tab");
			await expect.soft(submit).toBeFocused({ timeout: 800 });
		}
		const submit = selected.getByRole("button", { name: "Добавить в «Мои модели» и разместить" });
		await submit.focus();
		await page.keyboard.press("Escape");
		const guard = page.getByRole("alertdialog", { name: "Несохранённая правка" });
		await guard.getByRole("button", { name: "Продолжить", exact: true }).click();
		await expect(submit).toBeFocused();
		await catalog.getByRole("tab", { name: "Предметы", exact: true }).tap();
		await page.keyboard.press("Escape");
		await expect(catalog).toHaveCount(0);
		await expect(opener).toBeFocused();
	});
}

test("TMA-PLAN-ITEM: floor properties use themed actions and the plan supports keyboard and drag movement", async ({ page }) => {
	await page.setDefaultTimeout(10000);
	await page.goto("/");
	await createRoom(page, "Свойства стула");
	const catalog = await openCatalog(page);
	await catalog.getByRole("button", { name: /^Стул / }).tap();
	await clickRectangularRoomPoint(page, { x: 0.35, y: 0.25 });
	await page.getByRole("button", { name: "Подтвердить размещение предмета", exact: true }).tap();
	await saved(page);
	const item = page.getByTestId("schematic-item");
	const position = async () => {
		const placed = (await scopeState(page)).current.project.assetInstances[0];
		if (!placed || !("xMm" in placed)) throw new Error("Expected placed floor item");
		return { x: placed.xMm, z: placed.zMm };
	};
	const before = await position();
	const initialState = await scopeState(page);
	const chair = await item.boundingBox();
	if (!chair) throw new Error("No saved chair on the plan");
	const touch = await page.context().newCDPSession(page);
	try {
		await touch.send("Input.dispatchTouchEvent", { type: "touchStart", touchPoints: [{ x: chair.x + chair.width / 2, y: chair.y + chair.height / 2 }] });
		await expect(page.getByTestId("selected-item-inspector")).toBeVisible();
		await expect(page.getByTestId("editor-top-bar").getByRole("status")).toHaveText("Сохранено", { timeout: 900 });
		// Insets can settle as Telegram opens the inspector between touchstart and touchend.
		await page.getByTestId("plan-canvas").evaluate(el => { (el as unknown as SVGSVGElement).style.width = "99%"; });
		await touch.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] });
	} finally {
		await touch.detach();
		await page.getByTestId("plan-canvas").evaluate(el => { (el as unknown as SVGSVGElement).style.removeProperty("width"); });
	}
	await saved(page);
	await expect(page.getByText("Продолжите перемещение или отмените правку.", { exact: true })).toHaveCount(0);
	const views = page.getByTestId("editor-view-switch");
	await views.getByRole("button", { name: "3D", exact: true }).tap();
	await expect(page.getByTestId("three-dimensional-canvas")).toBeVisible();
	await expect(page.getByRole("alertdialog")).toHaveCount(0);
	expect((await scopeState(page)).revisions).toEqual(initialState.revisions);
	await views.getByRole("button", { name: "План 2D", exact: true }).tap();
	await item.focus();
	await expect.soft(item).toBeFocused({ timeout: 800 });
	await item.press("Enter");
	await item.press("ArrowRight");
	await expect.soft.poll(position, { timeout: 1000 }).toEqual({ ...before, x: before.x + 100 });
	const inspector = page.getByTestId("selected-item-inspector");
	await expect(inspector.getByRole("button", { name: "Заблокировать предмет", exact: true })).toBeHidden();
	await inspector.getByRole("button", { name: "Развернуть панель предмета" }).tap();
	await expect.soft(inspector.getByRole("group", { name: "Переместить предмет на 100 мм" })).toHaveCount(0);
	await expect.soft(inspector.getByText(/ПОЗИЦИЯ [XZ]/)).toHaveCount(0);
	const lock = inspector.getByRole("button", { name: "Заблокировать предмет", exact: true });
	const duplicate = inspector.getByRole("button", { name: "Дублировать предмет", exact: true });
	const remove = inspector.getByRole("button", { name: "Удалить предмет", exact: true });
	const expectColors = async (control: Locator, ink: string, fill: string) => {
		const colors = await control.evaluate((button, [foreground, background]) => {
			const probe = document.createElement("span");
			probe.style.color = foreground;
			probe.style.backgroundColor = background;
			button.append(probe);
			const actual = getComputedStyle(button), reference = getComputedStyle(probe);
			const pairs = [[actual.color, actual.backgroundColor], [reference.color, reference.backgroundColor]];
			probe.remove();
			return pairs;
		}, [ink, fill]);
		expect(colors[0]).toEqual(colors[1]);
	};
	const fullSize = page.viewportSize();
	if (!fullSize) throw new Error("Missing mobile viewport");
	for (const colorScheme of ["light", "dark"] as const) {
		await page.evaluate(scheme => {
			window.__telegramEntryProof.host.patch({ colorScheme: scheme });
			window.__telegramEntryProof.host.emit("themeChanged");
		}, colorScheme);
		await expectColors(lock, "var(--ink)", "var(--surface)");
		await expectColors(duplicate, "var(--ink)", "var(--surface)");
		await expectColors(remove, "var(--editor-host-danger, var(--danger))", "var(--surface)");
		await lock.tap();
		const unlock = inspector.getByRole("button", { name: "Разблокировать предмет", exact: true });
		await expect(unlock).toHaveAttribute("aria-pressed", "true");
		await expectColors(unlock, "var(--editor-host-primary, var(--blue))", "var(--editor-host-primary-soft, var(--editor-selected))");
		await expect(remove).toBeDisabled();
		await expectColors(remove, "var(--muted)", "var(--canvas)");
		await expect(duplicate).toBeEnabled();
		await expect(inspector.getByRole("textbox", { name: "Ширина выбранного предмета, мм" })).toBeDisabled();
		const lockedPosition = await position();
		await item.press("ArrowRight");
		await saved(page);
		expect(await position()).toEqual(lockedPosition);
		await unlock.tap();
		await expect(remove).toBeEnabled();
		await page.evaluate(() => { document.documentElement.style.fontSize = "200%"; });
		for (const width of [320, 390]) {
			await page.setViewportSize({ ...fullSize, width });
			await lock.scrollIntoViewIfNeeded();
			for (const control of [lock, duplicate, remove]) {
				const fits = await control.evaluate(el => {
					const range = document.createRange();
					range.selectNodeContents(el);
					const frame = el.getBoundingClientRect(), text = range.getBoundingClientRect();
					return frame.height >= 44 && frame.left >= 0 && frame.right <= innerWidth + 1 &&
						text.left >= frame.left - 1 && text.right <= frame.right + 1 && text.top >= frame.top - 1 && text.bottom <= frame.bottom + 1;
				});
				expect(fits).toBe(true);
			}
			await remove.scrollIntoViewIfNeeded();
			const deleteIsClear = await remove.evaluate(el => {
				const r = el.getBoundingClientRect(), y = r.y + r.height * .75;
				return [.15, .5, .85].every(fraction => el.contains(document.elementFromPoint(r.x + r.width * fraction, y)));
			});
			expect(deleteIsClear).toBe(true);
			await page.screenshot({ path: test.info().outputPath(`inspector-${colorScheme}-${width}-200.png`) });
		}
		await page.evaluate(() => { document.documentElement.style.removeProperty("font-size"); });
		await page.setViewportSize(fullSize);
	}
	await inspector.getByRole("button", { name: "Скрыть панель предмета" }).tap();
	const initialDrag = await position();
	const bounds = await item.boundingBox();
	if (!bounds) throw new Error("Plan item is hidden");
	await page.mouse.move(bounds.x + bounds.width / 2, bounds.y + bounds.height / 2);
	await page.mouse.down();
	await page.mouse.move(bounds.x + bounds.width / 2 + 16, bounds.y + bounds.height / 2, { steps: 4 });
	await page.mouse.up();
	await expect.poll(position).not.toEqual(initialDrag);
	await inspector.getByRole("button", { name: "Развернуть панель предмета" }).tap();
	await duplicate.tap();
	await clickRectangularRoomPoint(page, { x: 0.76, y: 0.40 });
	await page.getByRole("button", { name: "Подтвердить размещение предмета", exact: true }).tap();
	await saved(page);
	expect((await scopeState(page)).current.project.assetInstances).toHaveLength(2);
});
