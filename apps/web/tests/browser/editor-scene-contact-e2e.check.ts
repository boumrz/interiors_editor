import { expect, test, type Page } from "@playwright/test";
import type {} from "./editor-scene-contact-harness";
import { projectRectangularRoomForWebGl } from "../../src/adapters/renderer/rectangular-room-projection";
import { canvasPointForFloor } from "../../src/ui/three-dimensional-floor-interaction";
const pageErrors=new WeakMap<Page,Error[]>();

test.beforeEach(async ({ page }, testInfo) => {
 const errors:Error[]=[];pageErrors.set(page,errors);page.on("pageerror",error=>errors.push(error));
 await page.goto("/");
 expect(await page.evaluate(() => Reflect.get(globalThis, "__stryker__")?.activeMutant)).toBe(testInfo.project.metadata.activeMutant);
});
test.afterEach(async({page})=>{expect(pageErrors.get(page)).toEqual([]);});
async function startRotation(page: Page) {
 const ring = page.getByTestId("three-dimensional-rotation-gizmo");
 await expect(ring).toBeVisible();
 await expect(page.getByRole("button", { name: "Повернуть предмет на 45° по часовой стрелке", exact: true })).toBeEnabled();
 const box = await ring.boundingBox(); if (!box) throw new Error("Missing rotation ring");
 const start = { x: box.x + box.width / 2, y: box.y + box.height * 27 / 128 };
 expect(await page.evaluate(({x,y}) => document.elementFromPoint(x,y)?.getAttribute("data-testid"),start)).toBe("three-dimensional-rotation-hit-area");
 await page.mouse.move(start.x,start.y); await page.mouse.down();
 await page.mouse.move(box.x+box.width*0.865,box.y+box.height*100/128,{steps:5});
 await expect(page.getByTestId("three-dimensional-item-preview")).not.toHaveText("нет");
}
async function projectedPoint(page: Page, xM: number, zM: number) {
 await expect(page.getByTestId("three-dimensional-renderer-diagnostics")).toContainText("стандартное качество");
 await page.evaluate(() => new Promise<void>((resolve) => requestAnimationFrame(() => requestAnimationFrame(() => resolve()))));
 const [state, text, box] = await Promise.all([page.evaluate(() => window.__editorSceneContactFixture.inspect()),page.getByTestId("three-dimensional-camera").textContent(),page.getByTestId("three-dimensional-canvas").boundingBox()]);
 const scene=projectRectangularRoomForWebGl(state.project); if(!scene || !text || !box) throw new Error("Missing floor projection");
 const [azimuthRadians=0,elevationRadians=0,distance=0,panXM=0,panZM=0]=text.split(":").map(Number);
 const point=canvasPointForFloor(scene,{azimuthRadians,elevationRadians,distance,panXM,panZM},box,{xM,zM}); if(!point) throw new Error("Missing floor contact");
 return {x:box.x+point.x,y:box.y+point.y};
}
async function choosePlacement(page: Page) {
 const point=await projectedPoint(page,2.4,1.5);
 expect(await page.evaluate(({x,y})=>document.elementFromPoint(x,y)?.getAttribute("data-testid"),point)).toBe("three-dimensional-canvas");
 await page.mouse.click(point.x,point.y);
 await expect(page.getByRole("button",{name:"Подтвердить размещение предмета",exact:true})).toBeEnabled();
 const preview=page.getByTestId("three-dimensional-item-placement-preview");
 return {x:await preview.getAttribute("data-x-m"),z:await preview.getAttribute("data-z-m")};
}
async function rotatePlacement(page: Page) {
 const box=await page.getByTestId("three-dimensional-rotation-gizmo").boundingBox(); if(!box) throw new Error("Missing placement ring");
 await page.mouse.move(box.x+box.width/2,box.y+box.height*27/128);await page.mouse.down();await page.mouse.move(box.x+box.width*0.865,box.y+box.height*100/128,{steps:5});
 return box;
}
test("SCENE00 absent host boundary keeps a normal browser rotation Durable", async ({page}) => {
 await page.evaluate(() => window.__editorSceneContactFixture.mount(false));
 const before = await page.evaluate(() => window.__editorSceneContactFixture.durableSnapshot());
 await startRotation(page); await page.mouse.up(); await page.evaluate(() => window.__editorSceneContactFixture.settle());
 expect((await page.evaluate(() => window.__editorSceneContactFixture.durableSnapshot())).revisions.length).toBe(before.revisions.length+1);
});
test("SCENE01 host suspension retains the exact rotation pose and rejects a late pointerup", async ({page}) => {
 await page.evaluate(() => window.__editorSceneContactFixture.mount());
 const before = await page.evaluate(() => window.__editorSceneContactFixture.durableSnapshot());
 await startRotation(page); const preview = await page.getByTestId("three-dimensional-item-preview").textContent();
 await page.evaluate(() => window.__editorSceneContactFixture.suspend());
 await expect(page.getByTestId("three-dimensional-item-preview")).toHaveText(preview ?? "");
 await page.mouse.up(); await page.evaluate(() => window.__editorSceneContactFixture.settle());
 expect(await page.evaluate(() => window.__editorSceneContactFixture.durableSnapshot())).toEqual(before);
 expect((await page.evaluate(() => window.__editorSceneContactFixture.inspect())).interaction).toMatchObject({hasDraft:true,hasPendingCommand:false});
});
test("SCENE02 Continue requires a fresh contact while retaining the previous world yaw", async ({page}) => {
 await page.evaluate(() => window.__editorSceneContactFixture.mount());
 const before = await page.evaluate(() => window.__editorSceneContactFixture.durableSnapshot());
 await startRotation(page); const preview = await page.getByTestId("three-dimensional-item-preview").textContent();
 await page.evaluate(() => window.__editorSceneContactFixture.suspend()); await page.mouse.up();
 await page.evaluate(() => window.__editorSceneContactFixture.resume());
 await expect(page.getByTestId("three-dimensional-item-preview")).toHaveText(preview ?? "");
 expect(await page.evaluate(() => window.__editorSceneContactFixture.durableSnapshot())).toEqual(before);
 const ring = await page.getByTestId("three-dimensional-rotation-gizmo").boundingBox(); if(!ring) throw new Error("Missing resumed ring");
 await page.mouse.move(ring.x+ring.width/2,ring.y+ring.height*27/128); await page.mouse.down();
 await expect(page.getByTestId("three-dimensional-item-preview")).toHaveText(preview ?? "");
 await page.mouse.move(ring.x+ring.width*0.135,ring.y+ring.height*100/128,{steps:5});
 await page.mouse.up(); await page.evaluate(() => window.__editorSceneContactFixture.settle());
 expect((await page.evaluate(() => window.__editorSceneContactFixture.durableSnapshot())).revisions.length).toBe(before.revisions.length+1);
});
test("SCENE03 explicit child cancellation discards only the local pose without publishing", async ({page}) => {
 await page.evaluate(() => window.__editorSceneContactFixture.mount());
 const before = await page.evaluate(() => window.__editorSceneContactFixture.durableSnapshot());
 await startRotation(page);
 await page.evaluate(() => { window.__editorSceneContactFixture.suspend(); window.__editorSceneContactFixture.cancel(); window.__editorSceneContactFixture.cancel(); });
 await page.mouse.up(); await page.evaluate(() => window.__editorSceneContactFixture.resume());
 await expect(page.getByTestId("three-dimensional-item-preview")).toHaveText("нет");
 expect(await page.evaluate(() => window.__editorSceneContactFixture.durableSnapshot())).toEqual(before);
 expect((await page.evaluate(() => window.__editorSceneContactFixture.inspect())).selectedItemId).not.toBe("");
});
test("SCENE04 a real viewport resize keeps the world preview and rejects an old projection endpoint", async ({page}) => {
 await page.evaluate(() => window.__editorSceneContactFixture.mount());
 const before = await page.evaluate(() => window.__editorSceneContactFixture.durableSnapshot());
 await startRotation(page); const preview=await page.getByTestId("three-dimensional-item-preview").textContent();
 await page.evaluate(() => window.__editorSceneContactFixture.resize(340));
 await page.mouse.up(); await page.evaluate(() => window.__editorSceneContactFixture.settle());
 expect(await page.evaluate(() => window.__editorSceneContactFixture.durableSnapshot())).toEqual(before);
 await expect(page.getByTestId("three-dimensional-item-preview")).toHaveText(preview ?? "");
});
test("SCENE05 step rotation exposes Pending before callback and drains through host suspension", async ({page}) => {
 await page.evaluate(() => window.__editorSceneContactFixture.mount());
 const before = await page.evaluate(() => window.__editorSceneContactFixture.durableSnapshot());
 await page.evaluate(() => window.__editorSceneContactFixture.holdNextCommand());
 const step=page.getByRole("button",{name:"Повернуть предмет на 45° по часовой стрелке",exact:true}); await step.click();
 const during=await page.evaluate(() => window.__editorSceneContactFixture.inspect());
 expect(during.commandEntrySnapshots.at(-1)).toMatchObject({hasPendingCommand:true});
 await page.evaluate(() => {window.__editorSceneContactFixture.suspend();window.__editorSceneContactFixture.resume();});
 expect((await page.evaluate(() => window.__editorSceneContactFixture.inspect())).interaction).toMatchObject({hasPendingCommand:true});
 await page.evaluate(() => window.__editorSceneContactFixture.releaseCommand());await page.evaluate(() => window.__editorSceneContactFixture.settle());
 expect((await page.evaluate(() => window.__editorSceneContactFixture.durableSnapshot())).revisions.length).toBe(before.revisions.length+1);
 expect((await page.evaluate(() => window.__editorSceneContactFixture.inspect())).interaction).toMatchObject({hasPendingCommand:false});
});
test("SCENE06 background invalidation preserves the latest world yaw without completing its old contact", async ({page}) => {
 await page.evaluate(() => window.__editorSceneContactFixture.mount());
 const before=await page.evaluate(() => window.__editorSceneContactFixture.durableSnapshot());
 await startRotation(page); const preview=await page.getByTestId("three-dimensional-item-preview").textContent();
 await page.evaluate(() => window.dispatchEvent(new Event("blur")));
 await expect(page.getByTestId("three-dimensional-item-preview")).toHaveText(preview ?? "");
 await page.mouse.up(); await page.evaluate(() => window.__editorSceneContactFixture.settle());
 expect(await page.evaluate(() => window.__editorSceneContactFixture.durableSnapshot())).toEqual(before);
});
test("SCENE07 native WebGL context loss does not discard an unsaved host draft", async ({page}) => {
 await page.evaluate(() => window.__editorSceneContactFixture.mount());
 const before=await page.evaluate(() => window.__editorSceneContactFixture.durableSnapshot());
 await startRotation(page); const preview=await page.getByTestId("three-dimensional-item-preview").textContent();
 await page.evaluate(() => {
  const canvas=document.querySelector<HTMLCanvasElement>('[data-testid="three-dimensional-canvas"]');
  const extension=canvas?.getContext("webgl2")?.getExtension("WEBGL_lose_context");
  if(!extension) throw new Error("Native WEBGL_lose_context proof unavailable");
  extension.loseContext();
 });
 await expect(page.getByTestId("three-dimensional-renderer-diagnostics")).toContainText("контекст");
 await expect(page.getByTestId("three-dimensional-item-preview")).toHaveText(preview ?? "");
 await page.mouse.up(); await page.evaluate(() => window.__editorSceneContactFixture.settle());
 expect(await page.evaluate(() => window.__editorSceneContactFixture.durableSnapshot())).toEqual(before);
});
test("SCENE08 placement awaits the actual callback Promise while retaining the chosen world point", async ({page}) => {
 await page.evaluate(() => window.__editorSceneContactFixture.mount(true,false,true));
 const before=await page.evaluate(() => window.__editorSceneContactFixture.durableSnapshot());
 const point=await choosePlacement(page);
 await page.evaluate(() => window.__editorSceneContactFixture.holdNextCommand());
 await page.getByRole("button",{name:"Подтвердить размещение предмета",exact:true}).click();
 const during=await page.evaluate(() => window.__editorSceneContactFixture.inspect());
 expect(during.commandEntrySnapshots.at(-1)).toMatchObject({hasPendingCommand:true});
 await expect(page.getByRole("button",{name:"Повернуть предмет на 45° по часовой стрелке",exact:true})).toBeDisabled();
 await page.getByRole("button",{name:"Подтвердить размещение предмета",exact:true}).click();
 expect((await page.evaluate(()=>window.__editorSceneContactFixture.inspect())).commandEntrySnapshots).toHaveLength(1);
 await page.getByRole("button",{name:"Отменить размещение предмета",exact:true}).click();
 const preview=page.getByTestId("three-dimensional-item-placement-preview");
 await expect(preview).toHaveAttribute("data-x-m",point.x ?? ""); await expect(preview).toHaveAttribute("data-z-m",point.z ?? "");
 await page.evaluate(()=>{window.__editorSceneContactFixture.suspend();window.__editorSceneContactFixture.resume();});
 expect((await page.evaluate(() => window.__editorSceneContactFixture.inspect())).interaction).toMatchObject({hasPendingCommand:true});
 expect(await page.evaluate(() => window.__editorSceneContactFixture.durableSnapshot())).toEqual(before);
 await page.evaluate(()=>window.__editorSceneContactFixture.releaseCommand()); await page.evaluate(()=>window.__editorSceneContactFixture.settle());
 const after=await page.evaluate(() => window.__editorSceneContactFixture.inspect());
 expect(after.project.assetInstances).toHaveLength(2);
 expect((await page.evaluate(() => window.__editorSceneContactFixture.durableSnapshot())).revisions.length).toBe(before.revisions.length+1);
 expect(after.interaction).toMatchObject({hasPendingCommand:false});
 await expect(page.getByRole("button",{name:"Повернуть предмет на 45° по часовой стрелке",exact:true})).toBeEnabled();
});
test("SCENE09 placement background invalidation preserves the point and latest raw yaw", async ({page}) => {
 await page.evaluate(() => window.__editorSceneContactFixture.mount(true,false,true));
 const before=await page.evaluate(() => window.__editorSceneContactFixture.durableSnapshot());
 const point=await choosePlacement(page);
 const ring=page.getByTestId("three-dimensional-rotation-gizmo"); const box=await ring.boundingBox(); if(!box) throw new Error("Missing placement rotation ring");
 await page.mouse.move(box.x+box.width/2,box.y+box.height*27/128);await page.mouse.down();await page.mouse.move(box.x+box.width*0.865,box.y+box.height*100/128,{steps:5});
 const yaw=(await page.evaluate(()=>window.__editorSceneContactFixture.inspect())).placementYaw; expect(yaw).not.toBe(0);
 await page.evaluate(()=>window.dispatchEvent(new Event("blur"))); await page.mouse.up();
 expect((await page.evaluate(()=>window.__editorSceneContactFixture.inspect())).placementYaw).toBe(yaw);
 await expect(page.getByTestId("three-dimensional-item-placement-preview")).toHaveAttribute("data-x-m",point.x ?? "");
 await expect(page.getByTestId("three-dimensional-item-placement-preview")).toHaveAttribute("data-z-m",point.z ?? "");
 expect(await page.evaluate(() => window.__editorSceneContactFixture.durableSnapshot())).toEqual(before);
});
test("SCENE10 an absent boundary retains the browser placement blur cancellation",async({page})=>{
 await page.evaluate(()=>window.__editorSceneContactFixture.mount(false,false,true)); await choosePlacement(page);
 await rotatePlacement(page);expect((await page.evaluate(()=>window.__editorSceneContactFixture.inspect())).placementYaw).not.toBe(0);
 await page.evaluate(()=>window.dispatchEvent(new Event("blur")));await page.mouse.up();
 expect((await page.evaluate(()=>window.__editorSceneContactFixture.inspect())).placementYaw).toBe(0);
});
test("SCENE11 StrictMode effect replay retains a live boundary and native renderer",async({page})=>{
 await page.evaluate(()=>window.__editorSceneContactFixture.mount(true,true));
 const before=await page.evaluate(()=>window.__editorSceneContactFixture.durableSnapshot());
 await startRotation(page);await page.mouse.up();await page.evaluate(()=>window.__editorSceneContactFixture.settle());
 expect((await page.evaluate(()=>window.__editorSceneContactFixture.durableSnapshot())).revisions.length).toBe(before.revisions.length+1);
 expect((await page.evaluate(()=>window.__editorSceneContactFixture.inspect())).interaction).toMatchObject({hasPendingCommand:false});
});
test("SCENE12 a queued old window callback cannot move or finish a fresh resumed contact",async({page})=>{
 await page.evaluate(()=>window.__editorSceneContactFixture.mount());
 await expect(page.getByTestId("three-dimensional-rotation-gizmo")).toBeVisible();
 const before=await page.evaluate(()=>window.__editorSceneContactFixture.durableSnapshot());
 await page.evaluate(()=>window.__editorSceneContactFixture.capturePointerListeners()); await startRotation(page);await page.evaluate(()=>window.__editorSceneContactFixture.stopPointerListenerCapture());
 await page.evaluate(()=>window.__editorSceneContactFixture.suspend());await page.mouse.up();await page.evaluate(()=>window.__editorSceneContactFixture.resume());
 await startRotation(page);const preview=await page.getByTestId("three-dimensional-item-preview").textContent();
 const ring=await page.getByTestId("three-dimensional-rotation-gizmo").boundingBox();if(!ring) throw new Error("Missing ring");
 await page.evaluate(point=>{window.__editorSceneContactFixture.replayPointerListener("pointerdown",point,901);window.__editorSceneContactFixture.replayPointerListener("pointermove",point);window.__editorSceneContactFixture.replayPointerListener("pointerup",point);},{x:ring.x+ring.width*0.135,y:ring.y+ring.height*100/128});
 await expect(page.getByTestId("three-dimensional-item-preview")).toHaveText(preview ?? "");
 expect(await page.evaluate(()=>window.__editorSceneContactFixture.durableSnapshot())).toEqual(before);
 await page.mouse.up();await page.evaluate(()=>window.__editorSceneContactFixture.settle());
 expect((await page.evaluate(()=>window.__editorSceneContactFixture.durableSnapshot())).revisions.length).toBe(before.revisions.length+1);
});
test("SCENE13 a revoked animation callback cannot consume a fresh placement preview frame",async({page})=>{
 await page.evaluate(()=>window.__editorSceneContactFixture.mount(true,false,true));await choosePlacement(page);
 const ring=await rotatePlacement(page);
 const beforeHeld=(await page.evaluate(()=>window.__editorSceneContactFixture.inspect())).placementYaw;
 await page.evaluate(()=>window.__editorSceneContactFixture.captureNextFrame());
 await page.mouse.move(ring.x+ring.width*0.75,ring.y+ring.height*0.35);
 expect((await page.evaluate(()=>window.__editorSceneContactFixture.inspect())).placementYaw).toBe(beforeHeld);
 await page.evaluate(()=>window.__editorSceneContactFixture.suspend());await page.mouse.up();await page.evaluate(()=>window.__editorSceneContactFixture.resume());
 const retained=(await page.evaluate(()=>window.__editorSceneContactFixture.inspect())).placementYaw;
 expect(retained).not.toBe(beforeHeld);
 const fresh=await page.getByTestId("three-dimensional-rotation-gizmo").boundingBox();if(!fresh) throw new Error("Missing fresh ring");
 await page.mouse.move(fresh.x+fresh.width/2,fresh.y+fresh.height*27/128);await page.mouse.down();await page.evaluate(()=>window.__editorSceneContactFixture.captureNextFrame());await page.mouse.move(fresh.x+fresh.width*0.135,fresh.y+fresh.height*100/128);
 expect((await page.evaluate(()=>window.__editorSceneContactFixture.inspect())).placementYaw).toBe(retained);
 await page.evaluate(()=>window.__editorSceneContactFixture.replayFrame(0));
 expect((await page.evaluate(()=>window.__editorSceneContactFixture.inspect())).placementYaw).toBe(retained);
 await page.evaluate(()=>window.__editorSceneContactFixture.replayFrame(1));
 expect((await page.evaluate(()=>window.__editorSceneContactFixture.inspect())).placementYaw).not.toBe(retained);
 await page.mouse.up();
});
test("SCENE14 a real second pointer still cancels the item edit and permits the next fresh rotation",async({page})=>{
 await page.evaluate(()=>window.__editorSceneContactFixture.mount());
 await expect(page.getByRole("button",{name:"Повернуть предмет на 45° по часовой стрелке",exact:true})).toBeEnabled();
 const before=await page.evaluate(()=>window.__editorSceneContactFixture.durableSnapshot());
 const ring=await page.getByTestId("three-dimensional-rotation-gizmo").boundingBox();const canvas=await page.getByTestId("three-dimensional-canvas").boundingBox();if(!ring||!canvas) throw new Error("Missing touch projection");
 const first={id:501,x:ring.x+ring.width/2,y:ring.y+ring.height*27/128};const moved={...first,x:ring.x+ring.width*0.865,y:ring.y+ring.height*100/128};const second={id:502,x:canvas.x+10,y:canvas.y+20};
 const cdp=await page.context().newCDPSession(page);
 try{await cdp.send("Input.dispatchTouchEvent",{type:"touchStart",touchPoints:[first]});await cdp.send("Input.dispatchTouchEvent",{type:"touchMove",touchPoints:[moved]});await cdp.send("Input.dispatchTouchEvent",{type:"touchStart",touchPoints:[moved,second]});await cdp.send("Input.dispatchTouchEvent",{type:"touchMove",touchPoints:[moved,{...second,x:second.x+8}]});await cdp.send("Input.dispatchTouchEvent",{type:"touchEnd",touchPoints:[]});}finally{await cdp.detach();}
 await expect(page.getByTestId("three-dimensional-item-preview")).toHaveText("нет");
 expect(await page.evaluate(()=>window.__editorSceneContactFixture.durableSnapshot())).toEqual(before);
 await startRotation(page);await page.mouse.up();await page.evaluate(()=>window.__editorSceneContactFixture.settle());
 expect((await page.evaluate(()=>window.__editorSceneContactFixture.durableSnapshot())).revisions.length).toBe(before.revisions.length+1);
});
test("SCENE15 a suspended move preserves its world point and cannot publish from an old canvas endpoint",async({page})=>{
 await page.evaluate(()=>window.__editorSceneContactFixture.mount());
 const before=await page.evaluate(()=>window.__editorSceneContactFixture.durableSnapshot());
 const from=await projectedPoint(page,1.5,1.5);const to=await projectedPoint(page,1.8,1.5);
 await page.mouse.move(from.x,from.y);await page.mouse.down();await page.mouse.move(to.x,to.y,{steps:5});
 await expect(page.getByTestId("three-dimensional-item-preview")).toContainText("перемещение");
 const preview=await page.getByTestId("three-dimensional-item-preview").textContent();
 await page.evaluate(()=>window.__editorSceneContactFixture.suspend());await page.mouse.up();await page.evaluate(()=>window.__editorSceneContactFixture.resume());
 await expect(page.getByTestId("three-dimensional-item-preview")).toHaveText(preview ?? "");
 expect(await page.evaluate(()=>window.__editorSceneContactFixture.durableSnapshot())).toEqual(before);
});
test("SCENE16 a paused placement ignores direct view cancellation until the explicit child-draft seam",async({page})=>{
 await page.evaluate(()=>window.__editorSceneContactFixture.mount(true,false,true));const point=await choosePlacement(page);
 const before=await page.evaluate(()=>window.__editorSceneContactFixture.durableSnapshot());
 await page.evaluate(()=>window.__editorSceneContactFixture.suspend());await page.getByRole("button",{name:"Отменить размещение предмета",exact:true}).click();
 await expect(page.getByTestId("three-dimensional-item-placement-preview")).toHaveAttribute("data-x-m",point.x ?? "");
 await page.evaluate(()=>window.__editorSceneContactFixture.cancel());
 await expect(page.getByTestId("three-dimensional-item-placement-menu")).toHaveCount(0);
 expect(await page.evaluate(()=>window.__editorSceneContactFixture.durableSnapshot())).toEqual(before);
});
test("SCENE17 a paused scene ignores fresh contacts and admits a new placement contact only after Continue",async({page})=>{
 await page.evaluate(()=>window.__editorSceneContactFixture.mount(true,false,true));const original=await choosePlacement(page);
 const before=await page.evaluate(()=>window.__editorSceneContactFixture.durableSnapshot());
 const next=await projectedPoint(page,2.4,1.9);
 await page.evaluate(()=>window.__editorSceneContactFixture.suspend());await page.mouse.click(next.x,next.y);
 const preview=page.getByTestId("three-dimensional-item-placement-preview");
 await expect(preview).toHaveAttribute("data-x-m",original.x ?? "");await expect(preview).toHaveAttribute("data-z-m",original.z ?? "");
 await page.evaluate(()=>window.__editorSceneContactFixture.resume());await page.mouse.click(next.x,next.y);
 expect(await preview.getAttribute("data-z-m")).not.toBe(original.z);
 expect(await page.evaluate(()=>window.__editorSceneContactFixture.durableSnapshot())).toEqual(before);
});
test("SCENE18 a fresh no-op move contact after Continue retains the raw world point",async({page})=>{
 await page.evaluate(()=>window.__editorSceneContactFixture.mount());const before=await page.evaluate(()=>window.__editorSceneContactFixture.durableSnapshot());
 const from=await projectedPoint(page,1.5,1.5);const to=await projectedPoint(page,1.8,1.5);await page.mouse.move(from.x,from.y);await page.mouse.down();await page.mouse.move(to.x,to.y,{steps:5});
 const preview=page.getByTestId("three-dimensional-item-preview");await expect(preview).toContainText("перемещение:");const pose=await preview.textContent();
 await page.evaluate(()=>window.__editorSceneContactFixture.suspend());await page.mouse.up();await page.evaluate(()=>window.__editorSceneContactFixture.resume());
 const point=await projectedPoint(page,1.8,1.5);expect(await page.evaluate(({x,y})=>document.elementFromPoint(x,y)?.getAttribute("data-testid"),point)).toBe("three-dimensional-canvas");await page.mouse.click(point.x,point.y);
 await expect(preview).toHaveText(pose ?? "");expect(await page.evaluate(()=>window.__editorSceneContactFixture.durableSnapshot())).toEqual(before);
 await page.mouse.move(point.x,point.y);await page.mouse.down();const next=await projectedPoint(page,2,1.5);await page.mouse.move(next.x,next.y,{steps:4});await page.mouse.up();await page.evaluate(()=>window.__editorSceneContactFixture.settle());
 expect((await page.evaluate(()=>window.__editorSceneContactFixture.durableSnapshot())).revisions.length).toBe(before.revisions.length+1);
});
test("SCENE19 a fresh unchanged rotation contact after Continue retains the raw world yaw",async({page})=>{
 await page.evaluate(()=>window.__editorSceneContactFixture.mount());const before=await page.evaluate(()=>window.__editorSceneContactFixture.durableSnapshot());await startRotation(page);
 const preview=page.getByTestId("three-dimensional-item-preview");const pose=await preview.textContent();await page.evaluate(()=>window.__editorSceneContactFixture.suspend());await page.mouse.up();await page.evaluate(()=>window.__editorSceneContactFixture.resume());
 const box=await page.getByTestId("three-dimensional-rotation-gizmo").boundingBox();if(!box)throw new Error("Missing resumed ring");await page.mouse.click(box.x+box.width/2,box.y+box.height*27/128);
 await expect(preview).toHaveText(pose ?? "");expect(await page.evaluate(()=>window.__editorSceneContactFixture.durableSnapshot())).toEqual(before);
 await startRotation(page);await page.mouse.up();await page.evaluate(()=>window.__editorSceneContactFixture.settle());expect((await page.evaluate(()=>window.__editorSceneContactFixture.durableSnapshot())).revisions.length).toBe(before.revisions.length+1);
});
test("SCENE20 a retained move cannot be silently replaced by a fresh rotation command",async({page})=>{
 await page.evaluate(()=>window.__editorSceneContactFixture.mount());const from=await projectedPoint(page,1.5,1.5);const to=await projectedPoint(page,1.8,1.5);await page.mouse.move(from.x,from.y);await page.mouse.down();await page.mouse.move(to.x,to.y,{steps:5});
 const preview=page.getByTestId("three-dimensional-item-preview");await expect(preview).toContainText("перемещение:");const pose=await preview.textContent();await page.evaluate(()=>window.__editorSceneContactFixture.suspend());await page.mouse.up();await page.evaluate(()=>window.__editorSceneContactFixture.resume());const before=await page.evaluate(()=>window.__editorSceneContactFixture.durableSnapshot());
 await expect(page.getByRole("status").filter({hasText:"Продолжите перемещение или отмените правку."})).toBeVisible();await expect(page.getByTestId("three-dimensional-rotation-gizmo")).toHaveAttribute("aria-disabled","true");
 const ring=await page.getByTestId("three-dimensional-rotation-gizmo").boundingBox();if(!ring)throw new Error("Missing retained ring");await page.mouse.move(ring.x+ring.width/2,ring.y+ring.height*27/128);await page.mouse.down();await page.mouse.move(ring.x+ring.width*.865,ring.y+ring.height*100/128,{steps:4});await page.mouse.up();await page.evaluate(()=>window.__editorSceneContactFixture.settle());
 expect(await page.evaluate(()=>window.__editorSceneContactFixture.durableSnapshot())).toEqual(before);await expect(preview).toHaveText(pose ?? "");
 const fromAgain=await projectedPoint(page,1.8,1.5);const toAgain=await projectedPoint(page,2,1.5);await page.mouse.move(fromAgain.x,fromAgain.y);await page.mouse.down();await page.mouse.move(toAgain.x,toAgain.y,{steps:4});await page.mouse.up();await page.evaluate(()=>window.__editorSceneContactFixture.settle());expect((await page.evaluate(()=>window.__editorSceneContactFixture.durableSnapshot())).revisions.length).toBe(before.revisions.length+1);
});
test("SCENE21 a retained rotation cannot be silently replaced by a fresh move command",async({page})=>{
 await page.evaluate(()=>window.__editorSceneContactFixture.mount());await startRotation(page);const preview=page.getByTestId("three-dimensional-item-preview");const pose=await preview.textContent();await page.evaluate(()=>window.__editorSceneContactFixture.suspend());await page.mouse.up();await page.evaluate(()=>window.__editorSceneContactFixture.resume());const before=await page.evaluate(()=>window.__editorSceneContactFixture.durableSnapshot());
 await expect(page.getByRole("status").filter({hasText:"Продолжите поворот или отмените правку."})).toBeVisible();
 const from=await projectedPoint(page,1.5,1.5);const to=await projectedPoint(page,1.8,1.5);await page.mouse.move(from.x,from.y);await page.mouse.down();await page.mouse.move(to.x,to.y,{steps:5});await page.mouse.up();await page.evaluate(()=>window.__editorSceneContactFixture.settle());
 expect(await page.evaluate(()=>window.__editorSceneContactFixture.durableSnapshot())).toEqual(before);await expect(preview).toHaveText(pose ?? "");
 await startRotation(page);await page.mouse.up();await page.evaluate(()=>window.__editorSceneContactFixture.settle());expect((await page.evaluate(()=>window.__editorSceneContactFixture.durableSnapshot())).revisions.length).toBe(before.revisions.length+1);
});
test("SCENE22 a retained move cannot be replaced by a rotation step",async({page})=>{
 await page.evaluate(()=>window.__editorSceneContactFixture.mount());const from=await projectedPoint(page,1.5,1.5);const to=await projectedPoint(page,1.8,1.5);await page.mouse.move(from.x,from.y);await page.mouse.down();await page.mouse.move(to.x,to.y,{steps:5});await page.evaluate(()=>window.__editorSceneContactFixture.suspend());await page.mouse.up();await page.evaluate(()=>window.__editorSceneContactFixture.resume());const before=await page.evaluate(()=>window.__editorSceneContactFixture.durableSnapshot());
 const step=page.getByRole("button",{name:"Повернуть предмет на 45° по часовой стрелке",exact:true});await step.click({force:true});await page.evaluate(()=>window.__editorSceneContactFixture.settle());expect(await page.evaluate(()=>window.__editorSceneContactFixture.durableSnapshot())).toEqual(before);await expect(step).toBeDisabled();
});
test("SCENE23 the same transform kind on a different item cannot erase the retained target",async({page})=>{
 await page.evaluate(()=>window.__editorSceneContactFixture.mount());await page.evaluate(()=>window.__editorSceneContactFixture.addSecondItem());
 const from=await projectedPoint(page,1.5,1.5);const to=await projectedPoint(page,1.8,1.5);await page.mouse.move(from.x,from.y);await page.mouse.down();await page.mouse.move(to.x,to.y,{steps:5});const preview=page.getByTestId("three-dimensional-item-preview");const pose=await preview.textContent();await page.evaluate(()=>window.__editorSceneContactFixture.suspend());await page.mouse.up();await page.evaluate(()=>window.__editorSceneContactFixture.resume());const before=await page.evaluate(()=>window.__editorSceneContactFixture.durableSnapshot());
 const secondId=await page.evaluate(()=>window.__editorSceneContactFixture.inspect().project.assetInstances[1]?.assetInstanceId);if(!secondId)throw new Error("Missing genuine second item");
 // Exercise a real parent selection update, then a native contact on that item.
 // The first item's retained ring otherwise occludes this phone-sized target.
 await page.evaluate((id)=>window.__editorSceneContactFixture.selectItem(id),secondId);
 const second=await projectedPoint(page,2.3,1.5);
 expect(await page.evaluate(({x,y})=>document.elementFromPoint(x,y)?.getAttribute("data-testid"),second)).toBe("three-dimensional-canvas");
 const selected=(await page.evaluate(()=>window.__editorSceneContactFixture.inspect())).selectedItemId;expect(selected).not.toBe((await page.evaluate(()=>window.__editorSceneContactFixture.inspect())).project.assetInstances[0].assetInstanceId);
 const endpoint=await projectedPoint(page,2.6,1.5);await page.mouse.move(second.x,second.y);await page.mouse.down();await page.mouse.move(endpoint.x,endpoint.y,{steps:4});await page.mouse.up();
 expect(await page.evaluate(()=>window.__editorSceneContactFixture.durableSnapshot())).toEqual(before);await expect(preview).toHaveText(pose ?? "");
});
test("SCENE24 camera inspection remains available while an opposite transform is disabled",async({page})=>{
 await page.evaluate(()=>window.__editorSceneContactFixture.mount());await startRotation(page);const preview=page.getByTestId("three-dimensional-item-preview");const pose=await preview.textContent();await page.evaluate(()=>window.__editorSceneContactFixture.suspend());await page.mouse.up();await page.evaluate(()=>window.__editorSceneContactFixture.resume());const before=await page.evaluate(()=>window.__editorSceneContactFixture.durableSnapshot());const camera=page.getByTestId("three-dimensional-camera");const prior=await camera.textContent();
 const canvas=await page.getByTestId("three-dimensional-canvas").boundingBox();if(!canvas)throw new Error("Missing camera surface");await page.mouse.move(canvas.x+20,canvas.y+canvas.height-100);await page.mouse.down();await page.mouse.move(canvas.x+35,canvas.y+canvas.height-95);await expect(camera).not.toHaveText(prior ?? "");const afterFirst=await camera.textContent();await page.mouse.move(canvas.x+50,canvas.y+canvas.height-90);await expect(camera).not.toHaveText(afterFirst ?? "");await page.mouse.up();await expect(preview).toHaveText(pose ?? "");expect(await page.evaluate(()=>window.__editorSceneContactFixture.durableSnapshot())).toEqual(before);
 await page.evaluate(()=>{window.__editorSceneContactFixture.suspend();window.__editorSceneContactFixture.cancel();window.__editorSceneContactFixture.resume();});await expect(preview).toHaveText("нет");expect(await page.evaluate(()=>window.__editorSceneContactFixture.durableSnapshot())).toEqual(before);
});
test("SCENE25 a native move after focusing local chrome is not mistaken for window background",async({page})=>{
 await page.evaluate(()=>window.__editorSceneContactFixture.mount());const before=await page.evaluate(()=>window.__editorSceneContactFixture.durableSnapshot());await page.getByTestId("fixture-chrome-hand").click();const from=await projectedPoint(page,1.5,1.5);const to=await projectedPoint(page,1.8,1.5);await page.mouse.move(from.x,from.y);await page.mouse.down();await page.mouse.move(to.x,to.y,{steps:4});await page.mouse.up();await page.evaluate(()=>window.__editorSceneContactFixture.settle());expect((await page.evaluate(()=>window.__editorSceneContactFixture.durableSnapshot())).revisions.length).toBe(before.revisions.length+1);
});
test("SCENE26 suspension flushes the latest held item yaw before revoking its old frame",async({page})=>{
 await page.evaluate(()=>window.__editorSceneContactFixture.mount());const before=await page.evaluate(()=>window.__editorSceneContactFixture.durableSnapshot());await startRotation(page);const preview=page.getByTestId("three-dimensional-item-preview");const prior=await preview.textContent();const ring=await page.getByTestId("three-dimensional-rotation-gizmo").boundingBox();if(!ring)throw new Error("Missing live ring");await page.evaluate(()=>window.__editorSceneContactFixture.captureNextFrame());await page.mouse.move(ring.x+ring.width*.75,ring.y+ring.height*.35);await expect(preview).toHaveText(prior ?? "");await page.evaluate(()=>window.__editorSceneContactFixture.suspend());await expect(preview).not.toHaveText(prior ?? "");const retained=await preview.textContent();await page.mouse.up();await page.evaluate(()=>window.__editorSceneContactFixture.resume());await page.evaluate(()=>window.__editorSceneContactFixture.replayFrame(0));await expect(preview).toHaveText(retained ?? "");expect(await page.evaluate(()=>window.__editorSceneContactFixture.durableSnapshot())).toEqual(before);
});
test("SCENE27 a resized live item move refuses further old projection updates and publication",async({page})=>{
 await page.evaluate(()=>window.__editorSceneContactFixture.mount());const before=await page.evaluate(()=>window.__editorSceneContactFixture.durableSnapshot());const from=await projectedPoint(page,1.5,1.5);const to=await projectedPoint(page,1.8,1.5);await page.mouse.move(from.x,from.y);await page.mouse.down();await page.mouse.move(to.x,to.y,{steps:4});const preview=page.getByTestId("three-dimensional-item-preview");const retained=await preview.textContent();await page.evaluate(()=>window.__editorSceneContactFixture.resize(340));await page.mouse.move(to.x+30,to.y+20);await page.mouse.up();await page.evaluate(()=>window.__editorSceneContactFixture.settle());await expect(preview).toHaveText(retained ?? "");expect(await page.evaluate(()=>window.__editorSceneContactFixture.durableSnapshot())).toEqual(before);
});
test("SCENE28 a resized live placement drag retains its exact world point rather than stale client pixels",async({page})=>{
 await page.evaluate(()=>window.__editorSceneContactFixture.mount(true,false,true));const chosen=await choosePlacement(page);const before=await page.evaluate(()=>window.__editorSceneContactFixture.durableSnapshot());const from=await projectedPoint(page,2.4,1.5);const to=await projectedPoint(page,2.6,1.6);await page.mouse.move(from.x,from.y);await page.mouse.down();await page.mouse.move(to.x,to.y,{steps:4});const preview=page.getByTestId("three-dimensional-item-placement-preview");const retained={x:await preview.getAttribute("data-x-m"),z:await preview.getAttribute("data-z-m")};expect(retained).not.toEqual(chosen);await page.evaluate(()=>window.__editorSceneContactFixture.resize(340));await page.mouse.move(to.x+30,to.y+20);await page.mouse.up();await page.evaluate(()=>window.__editorSceneContactFixture.settle());await expect(preview).toHaveAttribute("data-x-m",retained.x ?? "");await expect(preview).toHaveAttribute("data-z-m",retained.z ?? "");expect(await page.evaluate(()=>window.__editorSceneContactFixture.durableSnapshot())).toEqual(before);
});
test("SCENE29 a changed resumed move keeps its new world pose while the actual command is pending",async({page})=>{
 await page.evaluate(()=>window.__editorSceneContactFixture.mount());const from=await projectedPoint(page,1.5,1.5);const retainedPoint=await projectedPoint(page,1.8,1.5);await page.mouse.move(from.x,from.y);await page.mouse.down();await page.mouse.move(retainedPoint.x,retainedPoint.y,{steps:4});const preview=page.getByTestId("three-dimensional-item-preview");const oldPose=await preview.textContent();await page.evaluate(()=>window.__editorSceneContactFixture.suspend());await page.mouse.up();await page.evaluate(()=>window.__editorSceneContactFixture.resume());const before=await page.evaluate(()=>window.__editorSceneContactFixture.durableSnapshot());await page.evaluate(()=>window.__editorSceneContactFixture.holdNextCommand());const fresh=await projectedPoint(page,1.8,1.5);const endpoint=await projectedPoint(page,2,1.5);await page.mouse.move(fresh.x,fresh.y);await page.mouse.down();await page.mouse.move(endpoint.x,endpoint.y,{steps:4});await expect(preview).not.toHaveText(oldPose ?? "");const nextPose=await preview.textContent();await page.mouse.up();await expect(preview).toHaveText(nextPose ?? "");expect((await page.evaluate(()=>window.__editorSceneContactFixture.inspect())).interaction).toMatchObject({hasPendingCommand:true});expect(await page.evaluate(()=>window.__editorSceneContactFixture.durableSnapshot())).toEqual(before);await page.evaluate(()=>window.__editorSceneContactFixture.releaseCommand());await page.evaluate(()=>window.__editorSceneContactFixture.settle());expect((await page.evaluate(()=>window.__editorSceneContactFixture.durableSnapshot())).revisions.length).toBe(before.revisions.length+1);
});
test("SCENE30 a changed resumed rotation keeps its new yaw while the actual command is pending",async({page})=>{
 await page.evaluate(()=>window.__editorSceneContactFixture.mount());await startRotation(page);const preview=page.getByTestId("three-dimensional-item-preview");const oldPose=await preview.textContent();await page.evaluate(()=>window.__editorSceneContactFixture.suspend());await page.mouse.up();await page.evaluate(()=>window.__editorSceneContactFixture.resume());const before=await page.evaluate(()=>window.__editorSceneContactFixture.durableSnapshot());await page.evaluate(()=>window.__editorSceneContactFixture.holdNextCommand());await startRotation(page);await expect(preview).not.toHaveText(oldPose ?? "");await page.mouse.up();await expect(preview).not.toHaveText(oldPose ?? "");await expect(preview).not.toHaveText("нет");expect((await page.evaluate(()=>window.__editorSceneContactFixture.inspect())).interaction).toMatchObject({hasPendingCommand:true});expect(await page.evaluate(()=>window.__editorSceneContactFixture.durableSnapshot())).toEqual(before);await page.evaluate(()=>window.__editorSceneContactFixture.releaseCommand());await page.evaluate(()=>window.__editorSceneContactFixture.settle());expect((await page.evaluate(()=>window.__editorSceneContactFixture.durableSnapshot())).revisions.length).toBe(before.revisions.length+1);
});
test("SCENE31 a disabled opposite ring cannot replace the retained move while a fresh move contact is held",async({page})=>{
 await page.evaluate(()=>window.__editorSceneContactFixture.mount());const from=await projectedPoint(page,1.5,1.5);const to=await projectedPoint(page,1.8,1.5);await page.mouse.move(from.x,from.y);await page.mouse.down();await page.mouse.move(to.x,to.y,{steps:4});const preview=page.getByTestId("three-dimensional-item-preview");const retained=await preview.textContent();await page.evaluate(()=>window.__editorSceneContactFixture.suspend());await page.mouse.up();await page.evaluate(()=>window.__editorSceneContactFixture.resume());const before=await page.evaluate(()=>window.__editorSceneContactFixture.durableSnapshot());const firstPoint=await projectedPoint(page,1.8,1.5);const ring=await page.getByTestId("three-dimensional-rotation-gizmo").boundingBox();if(!ring)throw new Error("Missing disabled rotation ring");const first={id:801,x:firstPoint.x,y:firstPoint.y};const second={id:802,x:ring.x+ring.width/2,y:ring.y+ring.height*27/128};expect(await page.evaluate(({x,y})=>document.elementFromPoint(x,y)?.getAttribute('data-testid'),first)).toBe('three-dimensional-canvas');expect(await page.evaluate(({x,y})=>document.elementFromPoint(x,y)?.getAttribute('data-testid'),second)).toBe('three-dimensional-rotation-hit-area');const cdp=await page.context().newCDPSession(page);try{await cdp.send("Input.dispatchTouchEvent",{type:"touchStart",touchPoints:[first]});await cdp.send("Input.dispatchTouchEvent",{type:"touchStart",touchPoints:[first,second]});await expect(preview).toHaveText(retained ?? "");await cdp.send("Input.dispatchTouchEvent",{type:"touchEnd",touchPoints:[]});}finally{await cdp.detach();}await expect(preview).toHaveText(retained ?? "");expect(await page.evaluate(()=>window.__editorSceneContactFixture.durableSnapshot())).toEqual(before);
});
test("SCENE32 absent host retains the browser's immediate placement handoff rather than waiting in the host gate",async({page})=>{
 await page.evaluate(()=>window.__editorSceneContactFixture.mount(false,false,true));await choosePlacement(page);const before=await page.evaluate(()=>window.__editorSceneContactFixture.durableSnapshot());await page.evaluate(()=>window.__editorSceneContactFixture.holdNextCommand());await page.getByRole("button",{name:"Подтвердить размещение предмета",exact:true}).click();await expect(page.getByTestId("three-dimensional-item-placement-preview")).toHaveCount(0);expect(await page.evaluate(()=>window.__editorSceneContactFixture.durableSnapshot())).toEqual(before);await page.evaluate(()=>window.__editorSceneContactFixture.releaseCommand());await page.evaluate(()=>window.__editorSceneContactFixture.settle());expect((await page.evaluate(()=>window.__editorSceneContactFixture.durableSnapshot())).revisions.length).toBe(before.revisions.length+1);
});
for(const host of [false,true])test(`SCENE33 a normal explicit placement Cancel works with host=${host}`,async({page})=>{
 await page.evaluate(value=>window.__editorSceneContactFixture.mount(value,false,true),host);await choosePlacement(page);const before=await page.evaluate(()=>window.__editorSceneContactFixture.durableSnapshot());await page.getByRole("button",{name:"Отменить размещение предмета",exact:true}).click();await expect(page.getByTestId("three-dimensional-item-placement-menu")).toHaveCount(0);expect(await page.evaluate(()=>window.__editorSceneContactFixture.durableSnapshot())).toEqual(before);
});
for(const host of [false,true])test(`SCENE34 an omitted optional placement callback cannot fabricate a Project or throw with host=${host}`,async({page})=>{
 await page.evaluate(value=>window.__editorSceneContactFixture.mount(value,false,true,false),host);const point=await choosePlacement(page);const before=await page.evaluate(()=>window.__editorSceneContactFixture.durableSnapshot());await page.getByRole("button",{name:"Подтвердить размещение предмета",exact:true}).click();const preview=page.getByTestId("three-dimensional-item-placement-preview");if(host){await expect(preview).toHaveAttribute("data-x-m",point.x ?? "");await expect(preview).toHaveAttribute("data-z-m",point.z ?? "");}else await expect(preview).toHaveCount(0);expect(await page.evaluate(()=>window.__editorSceneContactFixture.durableSnapshot())).toEqual(before);
});
test("SCENE35 fresh native contacts through actual WebGL loss and restore preserve the retained draft until a new valid edit",async({page})=>{
 await page.evaluate(()=>window.__editorSceneContactFixture.mount());const before=await page.evaluate(()=>window.__editorSceneContactFixture.durableSnapshot());await startRotation(page);const preview=page.getByTestId("three-dimensional-item-preview");const retained=await preview.textContent();await page.evaluate(()=>window.__editorSceneContactFixture.loseRendererContext());await expect(page.getByTestId("three-dimensional-renderer-diagnostics")).toContainText("контекст");await page.mouse.up();await expect(preview).toHaveText(retained ?? "");const canvas=await page.getByTestId("three-dimensional-canvas").boundingBox();if(!canvas)throw new Error("Missing unavailable canvas");const point={x:canvas.x+4,y:canvas.y+canvas.height-80};expect(await page.evaluate(({x,y})=>document.elementFromPoint(x,y)?.getAttribute('data-testid'),point)).toBe('three-dimensional-canvas');await page.mouse.move(point.x,point.y);await page.mouse.down();await page.mouse.move(point.x+2,point.y+2);await page.mouse.up();await expect(preview).toHaveText(retained ?? "");expect(await page.evaluate(()=>window.__editorSceneContactFixture.durableSnapshot())).toEqual(before);
 await page.evaluate(()=>window.__editorSceneContactFixture.restoreRendererContext());await expect(page.getByTestId("three-dimensional-renderer-diagnostics")).toContainText("стандартное качество");await expect(preview).toHaveText(retained ?? "");expect(await page.evaluate(()=>window.__editorSceneContactFixture.durableSnapshot())).toEqual(before);await startRotation(page);await page.mouse.up();await page.evaluate(()=>window.__editorSceneContactFixture.settle());expect((await page.evaluate(()=>window.__editorSceneContactFixture.durableSnapshot())).revisions.length).toBe(before.revisions.length+1);
});
