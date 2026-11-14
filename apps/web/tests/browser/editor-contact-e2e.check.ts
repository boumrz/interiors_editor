import { expect, test, type Page } from "@playwright/test";
import type {} from "./editor-contact-harness";
const pageErrors = new WeakMap<Page, Error[]>();
test.beforeEach(async ({ page }, testInfo) => {
	const errors: Error[] = []; pageErrors.set(page, errors); page.on("pageerror", (error) => errors.push(error));
	await page.goto("/");
	expect(
		await page.evaluate(
			() => Reflect.get(globalThis, "__stryker__")?.activeMutant,
		),
	).toBe(testInfo.project.metadata.activeMutant);
});
test.afterEach(async ({ page }) => { expect(pageErrors.get(page)).toEqual([]); });
async function startDrag(page: Page) {
	const item = page.getByTestId("schematic-item").first();
	await expect(item).toBeVisible();
	const box = await item.boundingBox();
	if (!box) throw new Error("Missing Plan item box");
	await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
	await page.mouse.down();
	await page.mouse.move(
		box.x + box.width / 2 + Math.max(8, box.width * 2),
		box.y + box.height / 2,
		{ steps: 5 },
	);
}
for (const surface of ["plan"] as const) {
	test(`CONTACT01 ${surface}: host suspension preserves the exact Durable Project after late pointerup`, async ({
		page,
	}) => {
		await page.evaluate(
			(surface) => window.__editorContactFixture.mount(surface),
			surface,
		);
		const before = await page.evaluate(() =>
			window.__editorContactFixture.durableSnapshot(),
		);
		await startDrag(page);
		await page.evaluate(() => window.__editorContactFixture.suspend());
		await page.mouse.up();
		await page.evaluate(() => window.__editorContactFixture.settle());
		expect(
			await page.evaluate(() =>
				window.__editorContactFixture.durableSnapshot(),
			),
		).toEqual(before);
	});
	test(`CONTACT00 ${surface}: absent boundary keeps a normal browser gesture Durable`, async ({
		page,
	}) => {
		await page.evaluate(
			(surface) => window.__editorContactFixture.mount(surface, false),
			surface,
		);
		const before = await page.evaluate(() =>
			window.__editorContactFixture.durableSnapshot(),
		);
		await startDrag(page);
		await page.mouse.up();
		await page.evaluate(() => window.__editorContactFixture.settle());
		expect(
			(
				await page.evaluate(() =>
					window.__editorContactFixture.durableSnapshot(),
				)
			).revisions.length,
		).toBe(before.revisions.length + 1);
	});
}

test("CONTACT02 plan: Continue preserves the preview and selection while a fresh contact continues from that world pose", async ({
	page,
}) => {
	await page.evaluate(() => window.__editorContactFixture.mount("plan"));
	const before = await page.evaluate(() =>
		window.__editorContactFixture.durableSnapshot(),
	);
	await startDrag(page);
	const item = page.getByTestId("schematic-item");
	const previewX = await item.getAttribute("x");
	const selection = (
		await page.evaluate(() => window.__editorContactFixture.inspect())
	).selectedItemId;
	await page.evaluate(() => window.__editorContactFixture.suspend());
	await page.mouse.up();
	await page.evaluate(() => window.__editorContactFixture.resume());
	await expect(item).toHaveAttribute("x", previewX ?? "");
	expect(
		(await page.evaluate(() => window.__editorContactFixture.inspect()))
			.selectedItemId,
	).toBe(selection);
	expect(
		await page.evaluate(() => window.__editorContactFixture.durableSnapshot()),
	).toEqual(before);
	const box = await item.boundingBox();
	if (!box) throw new Error("Missing retained preview");
	await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
	await page.mouse.down();
	await expect(item).toHaveAttribute("x", previewX ?? "");
	await page.mouse.move(box.x + box.width * 1.5, box.y + box.height / 2, {
		steps: 3,
	});
	expect(Number(await item.getAttribute("x"))).toBeGreaterThan(
		Number(previewX) + box.width * 0.5,
	);
	await page.mouse.up();
	await page.evaluate(() => window.__editorContactFixture.settle());
	expect(
		(await page.evaluate(() => window.__editorContactFixture.durableSnapshot()))
			.revisions.length,
	).toBe(before.revisions.length + 1);
});

test("CONTACT03 plan: explicit child draft cancellation keeps the Project and selection without a second navigation", async ({
	page,
}) => {
	await page.evaluate(() => window.__editorContactFixture.mount("plan"));
	const before = await page.evaluate(() =>
		window.__editorContactFixture.durableSnapshot(),
	);
	const item = page.getByTestId("schematic-item");
	const originalX = await item.getAttribute("x");
	await startDrag(page);
	await page.evaluate(() => {
		window.__editorContactFixture.suspend();
		window.__editorContactFixture.cancel();
		window.__editorContactFixture.cancel();
	});
	await page.mouse.up();
	await page.evaluate(() => window.__editorContactFixture.resume());
	await expect(item).toHaveAttribute("x", originalX ?? "");
	expect(
		await page.evaluate(() => window.__editorContactFixture.durableSnapshot()),
	).toEqual(before);
	expect(
		(await page.evaluate(() => window.__editorContactFixture.inspect()))
			.selectedItemId,
	).not.toBe("");
});

test("CONTACT04 plan: a viewport contact invalidation never publishes its old pointer endpoint", async ({
	page,
}) => {
	await page.evaluate(() => window.__editorContactFixture.mount("plan"));
	const before = await page.evaluate(() =>
		window.__editorContactFixture.durableSnapshot(),
	);
	await startDrag(page);
	await page.evaluate(() => {
		window.__editorContactFixture.invalidate();
		window.__editorContactFixture.resize(340);
	});
	await page.mouse.up();
	await page.evaluate(() => window.__editorContactFixture.settle());
	expect(
		await page.evaluate(() => window.__editorContactFixture.durableSnapshot()),
	).toEqual(before);
});

test("CONTACT05 plan: Pending is visible inside the admitted callback before its first await", async ({
	page,
}) => {
	await page.evaluate(() => window.__editorContactFixture.mount("plan"));
	const before = await page.evaluate(() =>
		window.__editorContactFixture.durableSnapshot(),
	);
	await page.evaluate(() => window.__editorContactFixture.holdNextCommand());
	await startDrag(page);
	await page.mouse.up();
	const during = await page.evaluate(() =>
		window.__editorContactFixture.inspect(),
	);
	expect(during.commandEntrySnapshots.at(-1)).toMatchObject({
		hasPendingCommand: true,
	});
	expect(during.interaction).toMatchObject({ hasPendingCommand: true });
	await page.evaluate(() => {
		window.__editorContactFixture.suspend();
		window.__editorContactFixture.resume();
	});
	expect(
		(await page.evaluate(() => window.__editorContactFixture.inspect()))
			.interaction,
	).toMatchObject({ hasPendingCommand: true });
	await page.evaluate(() => window.__editorContactFixture.releaseCommand());
	await page.evaluate(() => window.__editorContactFixture.settle());
	expect(
		(await page.evaluate(() => window.__editorContactFixture.inspect()))
			.interaction,
	).toMatchObject({ hasPendingCommand: false });
	expect(
		(await page.evaluate(() => window.__editorContactFixture.durableSnapshot()))
			.revisions.length,
	).toBe(before.revisions.length + 1);
});

test("CONTACT06 plan: a fresh canvas contact cannot inherit a suspended item's old edit", async ({
	page,
}) => {
	await page.evaluate(() => window.__editorContactFixture.mount("plan"));
	const before = await page.evaluate(() =>
		window.__editorContactFixture.durableSnapshot(),
	);
	await startDrag(page);
	const item = page.getByTestId("schematic-item");
	const previewX = await item.getAttribute("x");
	await page.evaluate(() => window.__editorContactFixture.suspend());
	await page.mouse.up();
	await page.evaluate(() => window.__editorContactFixture.resume());
	const floor = await page.getByTestId("room-face").first().boundingBox();
	if (!floor) throw new Error("Missing room face");
	await page.mouse.click(floor.x + floor.width / 4, floor.y + floor.height / 2);
	await page.evaluate(() => window.__editorContactFixture.settle());
	expect(
		await page.evaluate(() => window.__editorContactFixture.durableSnapshot()),
	).toEqual(before);
	await expect(item).toHaveAttribute("x", previewX ?? "");
});

test("CONTACT07 plan: StrictMode effect replay retains one live optional boundary", async ({
	page,
}) => {
	await page.evaluate(() =>
		window.__editorContactFixture.mount("plan", true, true),
	);
	const before = await page.evaluate(() =>
		window.__editorContactFixture.durableSnapshot(),
	);
	await startDrag(page);
	await page.mouse.up();
	await page.evaluate(() => window.__editorContactFixture.settle());
	expect(
		(await page.evaluate(() => window.__editorContactFixture.durableSnapshot()))
			.revisions.length,
	).toBe(before.revisions.length + 1);
	expect(
		(await page.evaluate(() => window.__editorContactFixture.inspect()))
			.interaction,
	).toMatchObject({ hasPendingCommand: false });
});

test("CONTACT08 plan: second-pointer pinch still cancels an item draft and permits the next gesture", async ({
	page,
}) => {
	await page.evaluate(() => window.__editorContactFixture.mount("plan"));
	const before = await page.evaluate(() =>
		window.__editorContactFixture.durableSnapshot(),
	);
	const item = page.getByTestId("schematic-item");
	const box = await item.boundingBox();
	if (!box) throw new Error("Missing item");
	const cdp = await page.context().newCDPSession(page);
	try {
		const first = {
			id: 51,
			x: box.x + box.width / 2,
			y: box.y + box.height / 2,
		};
		const moved = { ...first, x: first.x + Math.max(8, box.width * 2) };
		const second = { id: 52, x: moved.x + 55, y: moved.y + 20 };
		await cdp.send("Input.dispatchTouchEvent", {
			type: "touchStart",
			touchPoints: [first],
		});
		await cdp.send("Input.dispatchTouchEvent", {
			type: "touchMove",
			touchPoints: [moved],
		});
		await cdp.send("Input.dispatchTouchEvent", {
			type: "touchStart",
			touchPoints: [moved, second],
		});
		await cdp.send("Input.dispatchTouchEvent", {
			type: "touchMove",
			touchPoints: [moved, { ...second, x: second.x + 12 }],
		});
		await cdp.send("Input.dispatchTouchEvent", {
			type: "touchEnd",
			touchPoints: [],
		});
	} finally {
		await cdp.detach();
	}
	await page.evaluate(() => window.__editorContactFixture.settle());
	expect(
		await page.evaluate(() => window.__editorContactFixture.durableSnapshot()),
	).toEqual(before);
	await startDrag(page);
	await page.mouse.up();
	await page.evaluate(() => window.__editorContactFixture.settle());
	expect(
		(await page.evaluate(() => window.__editorContactFixture.durableSnapshot()))
			.revisions.length,
	).toBe(before.revisions.length + 1);
});

test("CONTACT09 plan: a real DOM resize revokes a stale projection even before an explicit host notification", async ({
	page,
}) => {
	await page.evaluate(() => window.__editorContactFixture.mount("plan"));
	const before = await page.evaluate(() =>
		window.__editorContactFixture.durableSnapshot(),
	);
	await startDrag(page);
	await page.evaluate(() => window.__editorContactFixture.resize(340));
	await page.mouse.up();
	await page.evaluate(() => window.__editorContactFixture.settle());
	expect(
		await page.evaluate(() => window.__editorContactFixture.durableSnapshot()),
	).toEqual(before);
	expect(
		(await page.evaluate(() => window.__editorContactFixture.inspect()))
			.interaction,
	).toMatchObject({ hasDraft: true });
});

test("CONTACT10 plan: controlled background invalidation retains the world preview and rejects its old completion", async ({
	page,
}) => {
	await page.evaluate(() => window.__editorContactFixture.mount("plan"));
	const before = await page.evaluate(() =>
		window.__editorContactFixture.durableSnapshot(),
	);
	await startDrag(page);
	const item = page.getByTestId("schematic-item");
	const previewX = await item.getAttribute("x");
	await page.evaluate(() => window.dispatchEvent(new Event("blur")));
	await page.mouse.up();
	await page.evaluate(() => window.__editorContactFixture.settle());
	expect(
		await page.evaluate(() => window.__editorContactFixture.durableSnapshot()),
	).toEqual(before);
	await expect(item).toHaveAttribute("x", previewX ?? "");
});


async function startPlacementRotation(page: Page, withBoundary: boolean) {
 await page.evaluate((enabled) => window.__editorContactFixture.mount("plan", enabled, false, true), withBoundary);
 const floor = await page.getByTestId("room-face").first().boundingBox(); if (!floor) throw new Error("Missing room face");
 await page.mouse.click(floor.x + floor.width * 0.75, floor.y + floor.height / 2);
 const ring = page.getByTestId("item-placement-rotation-handle"); await expect(ring).toBeVisible();
 const box = await ring.boundingBox(); if (!box) throw new Error("Missing placement ring");
 await page.mouse.move(box.x + box.width / 2, box.y); await page.mouse.down();
 await page.mouse.move(box.x + box.width, box.y + box.height / 2, { steps: 4 });
 expect((await page.evaluate(() => window.__editorContactFixture.inspect())).placementYaw).not.toBe(0);
 return box;
}

test("CONTACT11 plan: background invalidation cannot reset the raw placement yaw through the nested rotation control", async ({ page }) => {
 await startPlacementRotation(page, true);
 const before = await page.evaluate(() => window.__editorContactFixture.durableSnapshot());
 const yaw = (await page.evaluate(() => window.__editorContactFixture.inspect())).placementYaw;
 await page.evaluate(() => window.dispatchEvent(new Event("blur")));
 expect((await page.evaluate(() => window.__editorContactFixture.inspect())).placementYaw).toBe(yaw);
 await page.mouse.up();
 expect(await page.evaluate(() => window.__editorContactFixture.durableSnapshot())).toEqual(before);
});

test("CONTACT12 plan: a resumed placement control accepts fresh contacts while its old contact stays revoked", async ({ page }) => {
 const box = await startPlacementRotation(page, true);
 const before = await page.evaluate(() => window.__editorContactFixture.durableSnapshot());
 const yaw = (await page.evaluate(() => window.__editorContactFixture.inspect())).placementYaw;
 await page.evaluate(() => { window.__editorContactFixture.suspend(); window.__editorContactFixture.resume(); });
 await page.mouse.move(box.x + box.width / 2, box.y + box.height, { steps: 4 });
 expect((await page.evaluate(() => window.__editorContactFixture.inspect())).placementYaw).toBe(yaw);
 await page.mouse.up();
 await page.mouse.move(box.x + box.width / 2, box.y); await page.mouse.down();
 await page.mouse.move(box.x + box.width, box.y + box.height / 2, { steps: 4 });
 expect((await page.evaluate(() => window.__editorContactFixture.inspect())).placementYaw).not.toBe(yaw);
 await page.mouse.up();
 expect(await page.evaluate(() => window.__editorContactFixture.durableSnapshot())).toEqual(before);
});

test("CONTACT13 plan: an absent boundary retains the browser placement blur cancellation", async ({ page }) => {
 await startPlacementRotation(page, false);
 await page.evaluate(() => window.dispatchEvent(new Event("blur")));
 expect((await page.evaluate(() => window.__editorContactFixture.inspect())).placementYaw).toBe(0);
 await page.mouse.up();
});

test("CONTACT14 plan: a nested placement ring cannot reuse its projection after a DOM resize", async ({ page }) => {
 const box = await startPlacementRotation(page, true);
 const yaw = (await page.evaluate(() => window.__editorContactFixture.inspect())).placementYaw;
 await page.evaluate(() => window.__editorContactFixture.resize(340));
 await page.mouse.move(box.x + box.width / 2, box.y + box.height, { steps: 4 });
 expect((await page.evaluate(() => window.__editorContactFixture.inspect())).placementYaw).toBe(yaw);
 await page.mouse.up();
});
test("CONTACT15 plan: explicit same-layout invalidation revokes the old completion", async ({page})=>{
 await page.evaluate(()=>window.__editorContactFixture.mount("plan"));const before=await page.evaluate(()=>window.__editorContactFixture.durableSnapshot());
 await startDrag(page);const item=page.getByTestId("schematic-item");const x=await item.getAttribute("x");
 await page.evaluate(()=>window.__editorContactFixture.invalidate());await page.mouse.up();await page.evaluate(()=>window.__editorContactFixture.settle());
 expect(await page.evaluate(()=>window.__editorContactFixture.durableSnapshot())).toEqual(before);await expect(item).toHaveAttribute("x",x ?? "");
});
test("CONTACT16 plan: paused fresh contacts cannot alter the retained world preview",async({page})=>{
 await page.evaluate(()=>window.__editorContactFixture.mount("plan"));await startDrag(page);const item=page.getByTestId("schematic-item");const x=await item.getAttribute("x");
 await page.evaluate(()=>window.__editorContactFixture.suspend());await page.mouse.up();
 await startDrag(page);await page.mouse.up();await expect(item).toHaveAttribute("x",x ?? "");
});
test("CONTACT17 plan: a paused placement step cannot replace the retained raw yaw",async({page})=>{
 await startPlacementRotation(page,true);await page.mouse.up();const yaw=(await page.evaluate(()=>window.__editorContactFixture.inspect())).placementYaw;
 await page.evaluate(()=>window.__editorContactFixture.suspend());await page.getByRole("button",{name:"Повернуть размещаемый предмет вправо на 45°",exact:true}).click();
 expect((await page.evaluate(()=>window.__editorContactFixture.inspect())).placementYaw).toBe(yaw);
});
test("CONTACT18 plan: a completed placement ring does not retain a stale layout guard for the next step",async({page})=>{
 await startPlacementRotation(page,true);await page.mouse.up();const yaw=(await page.evaluate(()=>window.__editorContactFixture.inspect())).placementYaw;
 await page.evaluate(()=>window.__editorContactFixture.resize(340));await page.getByRole("button",{name:"Повернуть размещаемый предмет вправо на 45°",exact:true}).click();
 expect((await page.evaluate(()=>window.__editorContactFixture.inspect())).placementYaw).not.toBe(yaw);
});
test("CONTACT19 plan: changing selection during a live drag cannot publish the previous target",async({page})=>{
 await page.evaluate(()=>window.__editorContactFixture.mount("plan"));const before=await page.evaluate(()=>window.__editorContactFixture.durableSnapshot());
 await startDrag(page);await page.evaluate(()=>window.__editorContactFixture.clearSelection());await page.mouse.up();await page.evaluate(()=>window.__editorContactFixture.settle());
 expect(await page.evaluate(()=>window.__editorContactFixture.durableSnapshot())).toEqual(before);
});
test("CONTACT20 plan: an independent new base revokes a nested placement contact",async({page})=>{
 const box=await startPlacementRotation(page,true);const yaw=(await page.evaluate(()=>window.__editorContactFixture.inspect())).placementYaw;
 await page.evaluate(()=>window.__editorContactFixture.renameBase());const before=await page.evaluate(()=>window.__editorContactFixture.durableSnapshot());
 await page.mouse.move(box.x+box.width/2,box.y+box.height,{steps:4});await page.mouse.up();
 expect((await page.evaluate(()=>window.__editorContactFixture.inspect())).placementYaw).toBe(yaw);
 expect(await page.evaluate(()=>window.__editorContactFixture.durableSnapshot())).toEqual(before);
});
for (const staleMethod of ["suspend","resume","invalidateContacts","cancelDraft"] as const) {
 test(`CONTACT21 plan: stale ${staleMethod} handle cannot affect the replacement registration`,async({page})=>{
  await page.evaluate(()=>window.__editorContactFixture.mount("plan"));const before=await page.evaluate(()=>window.__editorContactFixture.durableSnapshot());
  await startDrag(page);await page.evaluate(()=>window.__editorContactFixture.replaceRegistration());await page.mouse.up();
  const item=page.getByTestId("schematic-item");const x=await item.getAttribute("x");
  if(staleMethod==="resume"){
   await page.evaluate(()=>window.__editorContactFixture.suspend());await page.evaluate(method=>window.__editorContactFixture.callOld(method),staleMethod);
   await startDrag(page);await page.mouse.up();await expect(item).toHaveAttribute("x",x ?? "");
   expect(await page.evaluate(()=>window.__editorContactFixture.durableSnapshot())).toEqual(before);
  }else{
   await startDrag(page);const current=await item.getAttribute("x");await page.evaluate(method=>window.__editorContactFixture.callOld(method),staleMethod);
   await expect(item).toHaveAttribute("x",current ?? "");await page.mouse.up();await page.evaluate(()=>window.__editorContactFixture.settle());
   expect((await page.evaluate(()=>window.__editorContactFixture.durableSnapshot())).revisions.length).toBe(before.revisions.length+1);
  }
 });
}
test("CONTACT22 plan: a genuine independent base change revokes the live item drag before publication",async({page})=>{
 await page.evaluate(()=>window.__editorContactFixture.mount("plan"));await startDrag(page);
 await page.evaluate(()=>window.__editorContactFixture.renameBase());const afterRename=await page.evaluate(()=>window.__editorContactFixture.durableSnapshot());
 await page.mouse.up();await page.evaluate(()=>window.__editorContactFixture.settle());
 expect(await page.evaluate(()=>window.__editorContactFixture.durableSnapshot())).toEqual(afterRename);
});
test("CONTACT23 plan: a fresh placement drag can change a raw point without an existing item target",async({page})=>{
 await page.evaluate(()=>window.__editorContactFixture.mount("plan",true,false,true));
 const before=await page.evaluate(()=>window.__editorContactFixture.durableSnapshot());const floor=await page.getByTestId("room-face").first().boundingBox();if(!floor) throw new Error("Missing room");
 const start={x:floor.x+floor.width*.75,y:floor.y+floor.height/2};await page.mouse.move(start.x,start.y);await page.mouse.down();
 const polygon=page.getByTestId("item-placement-preview").locator("polygon").first();await expect(polygon).toBeVisible();const points=await polygon.getAttribute("points");
 await page.mouse.move(start.x+Math.max(4,floor.width*.06),start.y,{steps:4});await expect(polygon).not.toHaveAttribute("points",points ?? "");await page.mouse.up();
 expect(await page.evaluate(()=>window.__editorContactFixture.durableSnapshot())).toEqual(before);
});
test("CONTACT24 plan: ring plus canvas contacts release fully before a fresh placement step",async({page})=>{
 await startPlacementRotation(page,true);await page.mouse.up();const before=await page.evaluate(()=>window.__editorContactFixture.durableSnapshot());
 const ring=await page.getByTestId("item-placement-rotation-handle").boundingBox();const canvas=await page.getByTestId("plan-canvas").boundingBox();if(!ring||!canvas) throw new Error("Missing contact surfaces");
 const first={id:61,x:ring.x+ring.width/2,y:ring.y};const moved={...first,x:ring.x+ring.width,y:ring.y+ring.height/2};const second={id:62,x:canvas.x+15,y:canvas.y+15};
 const cdp=await page.context().newCDPSession(page);
 try{await cdp.send("Input.dispatchTouchEvent",{type:"touchStart",touchPoints:[first]});await cdp.send("Input.dispatchTouchEvent",{type:"touchMove",touchPoints:[moved]});await cdp.send("Input.dispatchTouchEvent",{type:"touchStart",touchPoints:[moved,second]});await cdp.send("Input.dispatchTouchEvent",{type:"touchEnd",touchPoints:[]});}finally{await cdp.detach();}
 const step=page.getByRole("button",{name:"Повернуть размещаемый предмет вправо на 45°",exact:true});await expect(step).toBeEnabled();const yaw=(await page.evaluate(()=>window.__editorContactFixture.inspect())).placementYaw;await step.click();
 expect((await page.evaluate(()=>window.__editorContactFixture.inspect())).placementYaw).not.toBe(yaw);
 expect(await page.evaluate(()=>window.__editorContactFixture.durableSnapshot())).toEqual(before);
});
test("CONTACT25 plan: fresh paused contacts cannot replace a raw placement point",async({page})=>{
 await startPlacementRotation(page,true);await page.mouse.up();const polygon=page.getByTestId("item-placement-preview").locator("polygon").first();const points=await polygon.getAttribute("points");
 const floor=await page.getByTestId("room-face").first().boundingBox();if(!floor) throw new Error("Missing room");const next={x:floor.x+floor.width*.4,y:floor.y+floor.height*.7};
 await page.evaluate(()=>window.__editorContactFixture.suspend());await page.mouse.click(next.x,next.y);await expect(polygon).toHaveAttribute("points",points ?? "");
 await page.evaluate(()=>window.__editorContactFixture.resume());await page.mouse.click(next.x,next.y);await expect(polygon).not.toHaveAttribute("points",points ?? "");
});
test("CONTACT26 plan: a fresh camera pan works with the injected boundary and no semantic draft",async({page})=>{
 await page.evaluate(()=>window.__editorContactFixture.mount("plan"));const before=await page.evaluate(()=>window.__editorContactFixture.durableSnapshot());
 const canvas=await page.getByTestId("plan-canvas").boundingBox();if(!canvas) throw new Error("Missing canvas");const content=page.getByTestId("plan-content");const transform=await content.getAttribute("transform");
 await page.mouse.move(canvas.x+20,canvas.y+20);await page.mouse.down();await page.mouse.move(canvas.x+50,canvas.y+30,{steps:4});await page.mouse.up();
 await expect(content).not.toHaveAttribute("transform",transform ?? "");expect(await page.evaluate(()=>window.__editorContactFixture.durableSnapshot())).toEqual(before);
});
test("CONTACT27 plan: a fresh no-op contact after Continue cannot silently discard the retained world pose",async({page})=>{
 await page.evaluate(()=>window.__editorContactFixture.mount("plan"));const before=await page.evaluate(()=>window.__editorContactFixture.durableSnapshot());
 await startDrag(page);const item=page.getByTestId("schematic-item");const x=await item.getAttribute("x");
 await page.evaluate(()=>window.__editorContactFixture.suspend());await page.mouse.up();await page.evaluate(()=>window.__editorContactFixture.resume());
 await expect(item).toHaveAttribute("x",x ?? "");const box=await item.boundingBox();if(!box) throw new Error("Missing retained item");
 await page.mouse.click(box.x+box.width/2,box.y+box.height/2);
 await expect(item).toHaveAttribute("x",x ?? "");expect(await page.evaluate(()=>window.__editorContactFixture.durableSnapshot())).toEqual(before);
});
test("CONTACT28 plan: a completed no-op contact cannot lend its old edit to a fresh background pointer",async({page})=>{
 await page.evaluate(()=>window.__editorContactFixture.mount("plan"));const before=await page.evaluate(()=>window.__editorContactFixture.durableSnapshot());
 await startDrag(page);const item=page.getByTestId("schematic-item");const x=await item.getAttribute("x");await page.evaluate(()=>window.__editorContactFixture.suspend());await page.mouse.up();await page.evaluate(()=>window.__editorContactFixture.resume());
 const box=await item.boundingBox();if(!box)throw new Error("Missing retained item");await page.mouse.click(box.x+box.width/2,box.y+box.height/2);
 const canvas=await page.getByTestId("plan-canvas").boundingBox();if(!canvas)throw new Error("Missing canvas");await page.mouse.move(canvas.x+20,canvas.y+20);await page.mouse.down();await page.mouse.move(canvas.x+50,canvas.y+30,{steps:3});await page.mouse.up();
 await expect(item).toHaveAttribute("x",x ?? "");expect(await page.evaluate(()=>window.__editorContactFixture.durableSnapshot())).toEqual(before);
 await page.evaluate(()=>{window.__editorContactFixture.suspend();window.__editorContactFixture.cancel();window.__editorContactFixture.resume();});
 expect((await page.evaluate(()=>window.__editorContactFixture.inspect())).interaction).toMatchObject({hasDraft:false});expect(await page.evaluate(()=>window.__editorContactFixture.durableSnapshot())).toEqual(before);
});
async function touchPlanRotationRing(page: Page) {
 const ring=page.getByTestId("two-dimensional-rotation-hit-area");await expect(ring).toBeVisible();const box=await ring.boundingBox();if(!box)throw new Error("Missing actual Plan ring");
 await page.mouse.move(box.x+box.width/2,box.y);await page.mouse.down();await page.mouse.move(box.x+box.width,box.y+box.height/2,{steps:4});
}
test("CONTACT29 plan: a normal compatible native rotation still reaches a Durable Revision",async({page})=>{
 await page.evaluate(()=>window.__editorContactFixture.mount("plan"));const before=await page.evaluate(()=>window.__editorContactFixture.durableSnapshot());await touchPlanRotationRing(page);await page.mouse.up();await page.evaluate(()=>window.__editorContactFixture.settle());expect((await page.evaluate(()=>window.__editorContactFixture.durableSnapshot())).revisions.length).toBe(before.revisions.length+1);
});
test("CONTACT30 plan: a retained move cannot be confirmed by a fresh incompatible rotation",async({page})=>{
 await page.evaluate(()=>window.__editorContactFixture.mount("plan"));await startDrag(page);const item=page.getByTestId("schematic-item");const x=await item.getAttribute("x");await page.evaluate(()=>window.__editorContactFixture.suspend());await page.mouse.up();await page.evaluate(()=>window.__editorContactFixture.resume());const before=await page.evaluate(()=>window.__editorContactFixture.durableSnapshot());
 await expect(page.getByRole("status").filter({hasText:"Продолжите перемещение или отмените правку."})).toBeVisible();await expect(page.getByTestId("two-dimensional-rotation-hit-area")).toHaveAttribute("aria-disabled","true");
 await touchPlanRotationRing(page);await page.mouse.up();await page.evaluate(()=>window.__editorContactFixture.settle());expect(await page.evaluate(()=>window.__editorContactFixture.durableSnapshot())).toEqual(before);await expect(item).toHaveAttribute("x",x ?? "");
 await startDrag(page);await page.mouse.up();await page.evaluate(()=>window.__editorContactFixture.settle());expect((await page.evaluate(()=>window.__editorContactFixture.durableSnapshot())).revisions.length).toBe(before.revisions.length+1);
});
test("CONTACT31 plan: a retained rotation cannot be confirmed by a fresh incompatible move",async({page})=>{
 await page.evaluate(()=>window.__editorContactFixture.mount("plan"));await touchPlanRotationRing(page);const transform=await page.getByTestId("schematic-item").locator("..").getAttribute("transform");await page.evaluate(()=>window.__editorContactFixture.suspend());await page.mouse.up();await page.evaluate(()=>window.__editorContactFixture.resume());const before=await page.evaluate(()=>window.__editorContactFixture.durableSnapshot());
 await expect(page.getByRole("status").filter({hasText:"Продолжите поворот или отмените правку."})).toBeVisible();await expect(page.getByTestId("schematic-item")).toHaveAttribute("aria-disabled","true");
 await startDrag(page);await page.mouse.up();await page.evaluate(()=>window.__editorContactFixture.settle());expect(await page.evaluate(()=>window.__editorContactFixture.durableSnapshot())).toEqual(before);await expect(page.getByTestId("schematic-item").locator("..")).toHaveAttribute("transform",transform ?? "");
 await touchPlanRotationRing(page);await page.mouse.up();await page.evaluate(()=>window.__editorContactFixture.settle());expect((await page.evaluate(()=>window.__editorContactFixture.durableSnapshot())).revisions.length).toBe(before.revisions.length+1);
});
test("CONTACT32 plan: local chrome blur cannot revoke a fresh native wall selection",async({page})=>{
 await page.evaluate(()=>window.__editorContactFixture.mount("plan"));const before=await page.evaluate(()=>window.__editorContactFixture.durableSnapshot());await page.getByTestId("fixture-chrome-hand").click();await expect(page.getByTestId("fixture-chrome-hand")).toBeFocused();
 const wall=page.getByTestId("wall-segment").first();const id=await wall.getAttribute("data-wall-id");await wall.click();expect((await page.evaluate(()=>window.__editorContactFixture.inspect())).selectedWallId).toBe(id);expect(await page.evaluate(()=>window.__editorContactFixture.durableSnapshot())).toEqual(before);
});
test("CONTACT33 plan: a native item drag after focusing chrome still reaches a Durable Revision",async({page})=>{
 await page.evaluate(()=>window.__editorContactFixture.mount("plan"));const before=await page.evaluate(()=>window.__editorContactFixture.durableSnapshot());await page.getByTestId("fixture-chrome-hand").click();await startDrag(page);await page.mouse.up();await page.evaluate(()=>window.__editorContactFixture.settle());expect((await page.evaluate(()=>window.__editorContactFixture.durableSnapshot())).revisions.length).toBe(before.revisions.length+1);
});
test("CONTACT34 plan: a native camera contact survives the previous chrome element blur",async({page})=>{
 await page.evaluate(()=>window.__editorContactFixture.mount("plan"));await page.getByTestId("fixture-chrome-hand").click();const canvas=await page.getByTestId("plan-canvas").boundingBox();if(!canvas)throw new Error("Missing canvas");const content=page.getByTestId("plan-content");const transform=await content.getAttribute("transform");await page.mouse.move(canvas.x+20,canvas.y+20);await page.mouse.down();await page.mouse.move(canvas.x+50,canvas.y+30,{steps:4});await page.mouse.up();await expect(content).not.toHaveAttribute("transform",transform ?? "");
});
test("CONTACT35 plan: retained host item editing permits a full camera pan across several native moves",async({page})=>{
 await page.evaluate(()=>window.__editorContactFixture.mount("plan"));const before=await page.evaluate(()=>window.__editorContactFixture.durableSnapshot());await startDrag(page);const item=page.getByTestId("schematic-item");const x=await item.getAttribute("x");const y=await item.getAttribute("y");await page.evaluate(()=>window.__editorContactFixture.suspend());await page.mouse.up();await page.evaluate(()=>window.__editorContactFixture.resume());const canvas=await page.getByTestId("plan-canvas").boundingBox();if(!canvas)throw new Error("Missing native pan canvas");const content=page.getByTestId("plan-content");let prior=await content.getAttribute("transform");const start={x:canvas.x+20,y:canvas.y+20};expect(await page.evaluate(({x,y})=>document.elementFromPoint(x,y)?.closest('[data-testid="plan-canvas"]')?.getAttribute("data-testid"),start)).toBe("plan-canvas");await page.mouse.move(start.x,start.y);await page.mouse.down();for(const offset of [20,40,60]){await page.mouse.move(start.x+offset,start.y+offset/2);await expect(content).not.toHaveAttribute("transform",prior ?? "");prior=await content.getAttribute("transform");}await page.mouse.up();await expect(item).toHaveAttribute("x",x ?? "");await expect(item).toHaveAttribute("y",y ?? "");expect(await page.evaluate(()=>window.__editorContactFixture.durableSnapshot())).toEqual(before);expect((await page.evaluate(()=>window.__editorContactFixture.inspect())).interaction).toMatchObject({hasDraft:true});
});
async function panRetainedPlanThroughFrames(page:Page){
 const canvas=await page.getByTestId("plan-canvas").boundingBox();if(!canvas)throw new Error("Missing pan canvas");const start={x:canvas.x+20,y:canvas.y+20};expect(await page.evaluate(({x,y})=>document.elementFromPoint(x,y)?.closest('[data-testid="plan-canvas"]')?.getAttribute("data-testid"),start)).toBe("plan-canvas");const content=page.getByTestId("plan-content");let prior=await content.getAttribute("transform");await page.mouse.move(start.x,start.y);await page.mouse.down();for(const offset of [20,40,60]){await page.mouse.move(start.x+offset,start.y+offset/2);await expect(content).not.toHaveAttribute("transform",prior ?? "");prior=await content.getAttribute("transform");}await page.mouse.up();
}
test("CONTACT36 plan: retained rotation permits multiple camera frames while keeping the exact raw yaw",async({page})=>{
 await page.evaluate(()=>window.__editorContactFixture.mount("plan"));const before=await page.evaluate(()=>window.__editorContactFixture.durableSnapshot());await touchPlanRotationRing(page);const item=page.getByTestId("schematic-item");const yaw=await item.locator("..").getAttribute("transform");await page.evaluate(()=>window.__editorContactFixture.suspend());await page.mouse.up();await page.evaluate(()=>window.__editorContactFixture.resume());await panRetainedPlanThroughFrames(page);await expect(item.locator("..")).toHaveAttribute("transform",yaw ?? "");expect(await page.evaluate(()=>window.__editorContactFixture.durableSnapshot())).toEqual(before);expect((await page.evaluate(()=>window.__editorContactFixture.inspect())).interaction).toMatchObject({hasDraft:true});
});
test("CONTACT37 plan: an old camera contact remains revoked across Continue before a fresh camera pan",async({page})=>{
 await page.evaluate(()=>window.__editorContactFixture.mount("plan"));const before=await page.evaluate(()=>window.__editorContactFixture.durableSnapshot());await startDrag(page);const item=page.getByTestId("schematic-item");const x=await item.getAttribute("x");await page.evaluate(()=>window.__editorContactFixture.suspend());await page.mouse.up();await page.evaluate(()=>window.__editorContactFixture.resume());const canvas=await page.getByTestId("plan-canvas").boundingBox();if(!canvas)throw new Error("Missing pan canvas");const content=page.getByTestId("plan-content");const initial=await content.getAttribute("transform");await page.mouse.move(canvas.x+20,canvas.y+20);await page.mouse.down();await page.mouse.move(canvas.x+40,canvas.y+30);await expect(content).not.toHaveAttribute("transform",initial ?? "");const paused=await content.getAttribute("transform");await page.evaluate(()=>{window.__editorContactFixture.suspend();window.__editorContactFixture.resume();});await page.mouse.move(canvas.x+80,canvas.y+50);await page.mouse.up();await expect(content).toHaveAttribute("transform",paused ?? "");await expect(item).toHaveAttribute("x",x ?? "");expect(await page.evaluate(()=>window.__editorContactFixture.durableSnapshot())).toEqual(before);await panRetainedPlanThroughFrames(page);await expect(item).toHaveAttribute("x",x ?? "");expect(await page.evaluate(()=>window.__editorContactFixture.durableSnapshot())).toEqual(before);
});
test("CONTACT38 plan: cancelling a native camera contact preserves the retained item draft",async({page})=>{
 await page.evaluate(()=>window.__editorContactFixture.mount("plan"));const before=await page.evaluate(()=>window.__editorContactFixture.durableSnapshot());await startDrag(page);const item=page.getByTestId("schematic-item");const x=await item.getAttribute("x");await page.evaluate(()=>window.__editorContactFixture.suspend());await page.mouse.up();await page.evaluate(()=>window.__editorContactFixture.resume());const canvas=await page.getByTestId("plan-canvas").boundingBox();if(!canvas)throw new Error("Missing pan canvas");const content=page.getByTestId("plan-content");const prior=await content.getAttribute("transform");const cdp=await page.context().newCDPSession(page);const first={id:701,x:canvas.x+20,y:canvas.y+20};try{await cdp.send("Input.dispatchTouchEvent",{type:"touchStart",touchPoints:[first]});await cdp.send("Input.dispatchTouchEvent",{type:"touchMove",touchPoints:[{...first,x:first.x+30,y:first.y+15}]});await expect(content).not.toHaveAttribute("transform",prior ?? "");await cdp.send("Input.dispatchTouchEvent",{type:"touchCancel",touchPoints:[]});}finally{await cdp.detach();}await expect(item).toHaveAttribute("x",x ?? "");expect((await page.evaluate(()=>window.__editorContactFixture.inspect())).interaction).toMatchObject({hasDraft:true});expect(await page.evaluate(()=>window.__editorContactFixture.durableSnapshot())).toEqual(before);await panRetainedPlanThroughFrames(page);
});
test("CONTACT39 plan: a retained move cannot be transferred to a different real item",async({page})=>{
 await page.evaluate(()=>window.__editorContactFixture.mount("plan"));await page.evaluate(()=>window.__editorContactFixture.addSecondItem());await startDrag(page);const first=page.getByTestId("schematic-item").first();const x=await first.getAttribute("x");await page.evaluate(()=>window.__editorContactFixture.suspend());await page.mouse.up();await page.evaluate(()=>window.__editorContactFixture.resume());const before=await page.evaluate(()=>window.__editorContactFixture.durableSnapshot());const second=page.getByTestId("schematic-item").nth(1);const box=await second.boundingBox();if(!box)throw new Error("Missing actual second item");const point={x:box.x+box.width/2,y:box.y+box.height/2};const expectedId=await page.evaluate(()=>window.__editorContactFixture.inspect().project.assetInstances[1]?.assetInstanceId);expect(await page.evaluate(({x,y})=>document.elementFromPoint(x,y)?.closest('[data-item-id]')?.getAttribute('data-item-id'),point)).toBe(expectedId);await page.mouse.move(point.x,point.y);await page.mouse.down();await page.mouse.move(point.x+20,point.y+10,{steps:4});await page.mouse.up();await page.evaluate(()=>window.__editorContactFixture.settle());await expect(first).toHaveAttribute("x",x ?? "");expect(await page.evaluate(()=>window.__editorContactFixture.durableSnapshot())).toEqual(before);
});
test("CONTACT40 plan: a read-only view cannot begin or publish a new native item move",async({page})=>{
 await page.evaluate(()=>window.__editorContactFixture.mount("plan"));await page.evaluate(()=>window.__editorContactFixture.setReadOnly(true));const before=await page.evaluate(()=>window.__editorContactFixture.durableSnapshot());const item=page.getByTestId("schematic-item");const x=await item.getAttribute("x");await startDrag(page);await page.mouse.up();await page.evaluate(()=>window.__editorContactFixture.settle());await expect(item).toHaveAttribute("x",x ?? "");expect(await page.evaluate(()=>window.__editorContactFixture.durableSnapshot())).toEqual(before);expect((await page.evaluate(()=>window.__editorContactFixture.inspect())).interaction).toMatchObject({hasDraft:false});
});
test("CONTACT41 plan: sub-threshold fresh contact jitter cannot discard a retained move",async({page})=>{
 await page.evaluate(()=>window.__editorContactFixture.mount("plan"));await startDrag(page);const item=page.getByTestId("schematic-item");const x=await item.getAttribute("x");await page.evaluate(()=>window.__editorContactFixture.suspend());await page.mouse.up();await page.evaluate(()=>window.__editorContactFixture.resume());const before=await page.evaluate(()=>window.__editorContactFixture.durableSnapshot());const box=await item.boundingBox();if(!box)throw new Error("Missing retained item");await page.mouse.move(box.x+box.width/2,box.y+box.height/2);await page.mouse.down();await page.mouse.move(box.x+box.width/2+4,box.y+box.height/2);await page.mouse.up();await expect(item).toHaveAttribute("x",x ?? "");expect(await page.evaluate(()=>window.__editorContactFixture.durableSnapshot())).toEqual(before);
});
test("CONTACT42 plan: a resumed move that travelled beyond tolerance can return near its origin and publish its changed endpoint",async({page})=>{
 await page.evaluate(()=>window.__editorContactFixture.mount("plan"));await startDrag(page);const item=page.getByTestId("schematic-item");await page.evaluate(()=>window.__editorContactFixture.suspend());await page.mouse.up();await page.evaluate(()=>window.__editorContactFixture.resume());const before=await page.evaluate(()=>window.__editorContactFixture.durableSnapshot());const box=await item.boundingBox();if(!box)throw new Error("Missing retained item");const point={x:box.x+box.width/2,y:box.y+box.height/2};await page.mouse.move(point.x,point.y);await page.mouse.down();await page.mouse.move(point.x+35,point.y);await page.mouse.move(point.x+4,point.y);await page.mouse.up();await page.evaluate(()=>window.__editorContactFixture.settle());expect((await page.evaluate(()=>window.__editorContactFixture.durableSnapshot())).revisions.length).toBe(before.revisions.length+1);
});
test("CONTACT43 plan: a native final endpoint without an intermediate move callback can complete a fresh resumed move",async({page})=>{
 await page.evaluate(()=>window.__editorContactFixture.mount("plan"));await startDrag(page);const item=page.getByTestId("schematic-item");await page.evaluate(()=>window.__editorContactFixture.suspend());await page.mouse.up();await page.evaluate(()=>window.__editorContactFixture.resume());const before=await page.evaluate(()=>window.__editorContactFixture.durableSnapshot());const box=await item.boundingBox();if(!box)throw new Error("Missing retained item");const point={x:box.x+box.width/2,y:box.y+box.height/2};const cdp=await page.context().newCDPSession(page);try{await cdp.send("Input.dispatchMouseEvent",{type:"mousePressed",x:point.x,y:point.y,button:"left",buttons:1,clickCount:1});await cdp.send("Input.dispatchMouseEvent",{type:"mouseReleased",x:point.x+20,y:point.y,button:"left",buttons:0,clickCount:1});}finally{await cdp.detach();}await page.evaluate(()=>window.__editorContactFixture.settle());expect((await page.evaluate(()=>window.__editorContactFixture.durableSnapshot())).revisions.length).toBe(before.revisions.length+1);
});
test("CONTACT44 plan: a fresh resumed move with only a vertical coordinate change is durable",async({page})=>{
 await page.evaluate(()=>window.__editorContactFixture.mount("plan"));await startDrag(page);await page.evaluate(()=>window.__editorContactFixture.suspend());await page.mouse.up();await page.evaluate(()=>window.__editorContactFixture.resume());const before=await page.evaluate(()=>window.__editorContactFixture.durableSnapshot());const box=await page.getByTestId("schematic-item").boundingBox();if(!box)throw new Error("Missing retained item");const point={x:box.x+box.width/2,y:box.y+box.height/2};await page.mouse.move(point.x,point.y);await page.mouse.down();await page.mouse.move(point.x,point.y+20);await page.mouse.up();await page.evaluate(()=>window.__editorContactFixture.settle());expect((await page.evaluate(()=>window.__editorContactFixture.durableSnapshot())).revisions.length).toBe(before.revisions.length+1);
});
test("CONTACT45 plan: a native final endpoint at the existing six-pixel tolerance preserves the retained move",async({page})=>{
 await page.evaluate(()=>window.__editorContactFixture.mount("plan"));await startDrag(page);const item=page.getByTestId("schematic-item");const x=await item.getAttribute("x");await page.evaluate(()=>window.__editorContactFixture.suspend());await page.mouse.up();await page.evaluate(()=>window.__editorContactFixture.resume());const before=await page.evaluate(()=>window.__editorContactFixture.durableSnapshot());const box=await item.boundingBox();if(!box)throw new Error("Missing retained item");const point={x:box.x+box.width/2,y:box.y+box.height/2};const ratio=await page.getByTestId("plan-canvas").evaluate(element=>{if(!(element instanceof SVGSVGElement))throw new Error("Missing actual SVG");return element.getBoundingClientRect().width/element.viewBox.baseVal.width;});const cdp=await page.context().newCDPSession(page);try{await cdp.send("Input.dispatchMouseEvent",{type:"mousePressed",x:point.x,y:point.y,button:"left",buttons:1,clickCount:1});await cdp.send("Input.dispatchMouseEvent",{type:"mouseReleased",x:point.x+6*ratio,y:point.y,button:"left",buttons:0,clickCount:1});}finally{await cdp.detach();}await page.evaluate(()=>window.__editorContactFixture.settle());await expect(item).toHaveAttribute("x",x ?? "");expect(await page.evaluate(()=>window.__editorContactFixture.durableSnapshot())).toEqual(before);
});
for(const host of [false,true])test(`CONTACT46 plan: a native semantic move changes the live preview before publication with host=${host}`,async({page})=>{
 await page.evaluate(value=>window.__editorContactFixture.mount("plan",value),host);const before=await page.evaluate(()=>window.__editorContactFixture.durableSnapshot());const item=page.getByTestId("schematic-item");const x=await item.getAttribute("x");await startDrag(page);await expect(item).not.toHaveAttribute("x",x ?? "");expect(await page.evaluate(()=>window.__editorContactFixture.durableSnapshot())).toEqual(before);await page.mouse.up();await page.evaluate(()=>window.__editorContactFixture.settle());expect((await page.evaluate(()=>window.__editorContactFixture.durableSnapshot())).revisions.length).toBe(before.revisions.length+1);
});
test("CONTACT47 plan: a locked host camera contact remains inert and cannot borrow a semantic gesture",async({page})=>{
 await page.evaluate(()=>window.__editorContactFixture.mount("plan"));await page.evaluate(()=>window.__editorContactFixture.setInteractionLocked(true));const before=await page.evaluate(()=>window.__editorContactFixture.durableSnapshot());const content=page.getByTestId("plan-content");const prior=await content.getAttribute("transform");const canvas=await page.getByTestId("plan-canvas").boundingBox();if(!canvas)throw new Error("Missing locked canvas");await page.mouse.move(canvas.x+20,canvas.y+20);await page.mouse.down();await page.mouse.move(canvas.x+60,canvas.y+40);await page.mouse.up();await expect(content).toHaveAttribute("transform",prior ?? "");expect(await page.evaluate(()=>window.__editorContactFixture.durableSnapshot())).toEqual(before);await page.evaluate(()=>window.__editorContactFixture.setInteractionLocked(false));await panRetainedPlanThroughFrames(page);
});
test("CONTACT48 plan: retained-world camera panning follows the exact relative native finger displacement",async({page})=>{
 await page.evaluate(()=>window.__editorContactFixture.mount("plan"));await startDrag(page);const item=page.getByTestId("schematic-item");const x=await item.getAttribute("x");const y=await item.getAttribute("y");await page.evaluate(()=>window.__editorContactFixture.suspend());await page.mouse.up();await page.evaluate(()=>window.__editorContactFixture.resume());const before=await page.evaluate(()=>window.__editorContactFixture.durableSnapshot());const original=await item.boundingBox();const canvas=await page.getByTestId("plan-canvas").boundingBox();if(!original||!canvas)throw new Error("Missing projected item or camera surface");const start={x:canvas.x+20,y:canvas.y+20};await page.mouse.move(start.x,start.y);await page.mouse.down();for(const delta of [20,40]){await page.mouse.move(start.x+delta,start.y+delta/2);await expect.poll(async()=>{const box=await item.boundingBox();if(!box)throw new Error("Lost projected item");return box.x-original.x;}).toBeCloseTo(delta,1);await expect.poll(async()=>{const box=await item.boundingBox();if(!box)throw new Error("Lost projected item");return box.y-original.y;}).toBeCloseTo(delta/2,1);}await page.mouse.up();await expect(item).toHaveAttribute("x",x ?? "");await expect(item).toHaveAttribute("y",y ?? "");expect(await page.evaluate(()=>window.__editorContactFixture.durableSnapshot())).toEqual(before);
});
test("CONTACT49 plan: a native semantic touchCancel clears that direct gesture and leaves the next edit usable",async({page})=>{
 await page.evaluate(()=>window.__editorContactFixture.mount("plan"));const before=await page.evaluate(()=>window.__editorContactFixture.durableSnapshot());const item=page.getByTestId("schematic-item");const x=await item.getAttribute("x");const box=await item.boundingBox();if(!box)throw new Error("Missing actual semantic touch target");const first={id:911,x:box.x+box.width/2,y:box.y+box.height/2};const cdp=await page.context().newCDPSession(page);try{await cdp.send("Input.dispatchTouchEvent",{type:"touchStart",touchPoints:[first]});await cdp.send("Input.dispatchTouchEvent",{type:"touchMove",touchPoints:[{...first,x:first.x+30}]});await expect(item).not.toHaveAttribute("x",x ?? "");await cdp.send("Input.dispatchTouchEvent",{type:"touchCancel",touchPoints:[]});}finally{await cdp.detach();}await expect(item).toHaveAttribute("x",x ?? "");await expect.poll(async()=>(await page.evaluate(()=>window.__editorContactFixture.inspect())).interaction?.hasDraft).toBe(false);expect(await page.evaluate(()=>window.__editorContactFixture.durableSnapshot())).toEqual(before);await startDrag(page);await page.mouse.up();await page.evaluate(()=>window.__editorContactFixture.settle());expect((await page.evaluate(()=>window.__editorContactFixture.durableSnapshot())).revisions.length).toBe(before.revisions.length+1);
});
test("CONTACT50 plan: a fresh contact after semantic touchCancel starts from the visible Durable position",async({page})=>{
 await page.evaluate(()=>window.__editorContactFixture.mount("plan"));const item=page.getByTestId("schematic-item");const x=await item.getAttribute("x");const before=await page.evaluate(()=>window.__editorContactFixture.durableSnapshot());let box=await item.boundingBox();if(!box)throw new Error("Missing actual semantic target");const first={id:912,x:box.x+box.width/2,y:box.y+box.height/2};const cdp=await page.context().newCDPSession(page);try{await cdp.send("Input.dispatchTouchEvent",{type:"touchStart",touchPoints:[first]});await cdp.send("Input.dispatchTouchEvent",{type:"touchMove",touchPoints:[{...first,x:first.x+30}]});await expect(item).not.toHaveAttribute("x",x ?? "");await cdp.send("Input.dispatchTouchEvent",{type:"touchCancel",touchPoints:[]});}finally{await cdp.detach();}await expect(item).toHaveAttribute("x",x ?? "");box=await item.boundingBox();if(!box)throw new Error("Missing visible Durable target after cancellation");await page.mouse.move(box.x+box.width/2,box.y+box.height/2);await page.mouse.down();await expect(item).toHaveAttribute("x",x ?? "");await page.mouse.up();expect(await page.evaluate(()=>window.__editorContactFixture.durableSnapshot())).toEqual(before);
});
