import {expect,type Page,test} from "@playwright/test";
import type {PublicationCandidate,VersionedCatalogAsset,VersionedCatalogPublication} from "../../src/application/ports";
import {installEntryAudit,audit} from "./telegram-entry-support";
import {signedExample} from "./telegram-entry-signed-fixture";
import {clickRectangularRoomCentre} from "./room-geometry-fixture";

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
async function choose(page:Page,pub:VersionedCatalogPublication,asset:VersionedCatalogAsset){
 const button=page.getByRole("navigation",{name:"Инструменты редактора"}).getByRole("button",{name:"Предметы интерьера",exact:true});
 if(await button.isVisible())await button.click();else{await page.getByRole("button",{name:"Открыть остальные действия",exact:true}).click();await page.getByRole("button",{name:"Предметы интерьера",exact:true}).click();}
 const catalog=page.getByRole("dialog",{name:"Предметы интерьера",exact:true});
 await expect(catalog.getByTestId("catalog-publication-status")).toContainText(`Версия ${pub.catalogVersion} · ${pub.assets.length} предметов`);
 await catalog.getByTestId("preloaded-catalog-card").filter({hasText:asset.label}).click();
 await expect(catalog.getByTestId("catalog-selected-resource-metadata")).toContainText(asset.resource.sha256);
 const use=catalog.getByRole("button",{name:"Показать на плане",exact:true});await expect(use).toBeEnabled({timeout:60000});await use.click();await expect(catalog).toHaveCount(0);
}
test.beforeEach(async({page,baseURL})=>{
 if(!baseURL)throw new Error("No isolated target");
 await page.route("**/*",route=>new URL(route.request().url()).origin===new URL(baseURL).origin?route.continue():route.abort());
 await page.clock.setFixedTime(new Date(1733584787000));await installEntryAudit(page,"signed",signedExample);
});
for(const kind of ["floor","wall"] as const)test(`TMA-CATALOG-${kind}: actual published ${kind} GLB crosses proxy, pins, renders and reopens its exact host`,async({page},info)=>{
 await page.goto("/");const pub=await publication(page),asset=pub.assets.find(a=>a.assetId===(kind==="floor"?"single-bed":"evidence-wall-sconce"));
 if(!asset||asset.anchorClass!==kind)throw new Error("Required actual published model missing");
 await createRoom(page,`Telegram catalog ${kind}`);const before=await scopeState(page);let wallId:string|null=null;
 if(kind==="wall"){await page.getByRole("button",{name:"Рука и выбор",exact:true}).click();const wall=page.getByTestId("wall-segment").nth(1);wallId=await wall.getAttribute("data-wall-id");await wall.click();await expect(page.locator(`[data-testid="wall-body"][data-wall-id="${wallId}"]`)).toHaveAttribute("data-selected","true");}
 await choose(page,pub,asset);expect(await scopeState(page)).toEqual(before);
 if(kind==="floor"){await clickRectangularRoomCentre(page);await expect(page.getByTestId("item-placement-preview")).toHaveAttribute("data-placement-valid","true");await page.getByRole("button",{name:"Подтвердить размещение предмета",exact:true}).click();}
 else await page.getByTestId("selected-wall-inspector").getByRole("button",{name:"Подтвердить размещение",exact:true}).click();
 await expect.poll(async()=>(await scopeState(page)).current.revision.revisionId).not.toBe(before.current.revision.revisionId);
 await saved(page);const after=await scopeState(page);expect(after.revisions).toHaveLength(before.revisions.length+1);expect(after.current.project.level).toEqual(before.current.project.level);
 expect(after.current.project.assetInstances).toHaveLength(1);expect(after.current.project.assetInstances[0]).toMatchObject({anchorClass:kind,label:asset.label,widthMm:asset.dimensionsMm.width,depthMm:asset.dimensionsMm.depth,heightMm:asset.dimensionsMm.height,...(kind==="wall"?{wallSegmentId:wallId,side:"left",elevationMm:1500}:{roomId:before.current.project.level.rooms[0]?.roomId})});
 expect(after.pinned).toHaveLength(1);expect(after.pinned[0]).toMatchObject({resourceHash:asset.resource.sha256,byteLength:asset.resource.byteLength,sha256:asset.resource.sha256,durable:true});expect(after.resourceManifest).toContainEqual({resourceHash:asset.resource.sha256,byteLength:asset.resource.byteLength});expect(after.creation).toMatchObject({state:"published",revisionId:after.current.revision.revisionId,receipt:{revisionId:after.current.revision.revisionId,checksum:after.current.revision.checksum,resourceManifest:after.resourceManifest}});
 await page.getByTestId("editor-view-switch").getByRole("button",{name:"3D",exact:true}).click();await expect(page.getByTestId("three-dimensional-custom-glb-status")).toHaveText("rendered:1",{timeout:30000});expect(await scopeState(page)).toEqual(after);
 await info.attach(`actual-catalog-${kind}-3d`,{body:await page.screenshot(),contentType:"image/png"});
 await page.reload();await expect(page.getByTestId("project-hub")).toBeVisible();await page.getByRole("button",{name:`Открыть Telegram catalog ${kind}`,exact:true}).click();await saved(page);expect(await scopeState(page)).toEqual(after);
 const observed=await audit(page);expect(observed.registrations+observed.unregisters+observed.deletes+observed.cacheDeletes).toBe(0);expect(observed.opens.every(n=>n.startsWith("interiors-editor-projects:tma-v1-"))).toBe(true);
});


async function publishActualBed(page:Page,name:string){
 await page.goto("/");const pub=await publication(page),asset=pub.assets.find(a=>a.assetId==="single-bed");
 if(!asset)throw new Error("Required published floor model missing");
 await createRoom(page,name);const before=await scopeState(page);await choose(page,pub,asset);await clickRectangularRoomCentre(page);
 await page.getByRole("button",{name:"Подтвердить размещение предмета",exact:true}).click();
 await expect.poll(async()=>(await scopeState(page)).current.revision.revisionId).not.toBe(before.current.revision.revisionId);await saved(page);
 return {pub,asset,state:await scopeState(page)};
}
test("TMA-OFFLINE-01: after actual pinning the first3D, local edit, undo and redo work offline, and catalog outage stays separate",async({page,context})=>{
 const {pub,state}=await publishActualBed(page,"Offline pinned model");
 await context.setOffline(true);
 await page.getByTestId("editor-view-switch").getByRole("button",{name:"3D",exact:true}).click();
 await expect(page.getByTestId("three-dimensional-custom-glb-status")).toHaveText("rendered:1",{timeout:30000});expect(await scopeState(page)).toEqual(state);
 await page.getByTestId("editor-view-switch").getByRole("button",{name:"План 2D",exact:true}).click();
 await page.getByRole("button",{name:"Помещения",exact:true}).click();
 const rooms=page.getByRole("dialog",{name:"Помещения",exact:true});await rooms.getByRole("textbox",{name:"Высота помещения, мм",exact:true}).fill("3000");
 await rooms.getByRole("button",{name:"Сохранить помещение",exact:true}).click();
 await expect.poll(async()=>(await scopeState(page)).current.project.level.rooms[0]?.heightMm).toBe(3000);
 await rooms.getByRole("button",{name:"Закрыть помещения",exact:true}).click();
 const history=page.getByRole("group",{name:"История изменений",exact:true});
 await history.getByRole("button",{name:/^Отменить/}).click();
 await expect.poll(async()=>(await scopeState(page)).current.project.level.rooms[0]?.heightMm).toBe(2800);
 await history.getByRole("button",{name:/^Повторить/}).click();
 await expect.poll(async()=>(await scopeState(page)).current.project.level.rooms[0]?.heightMm).toBe(3000);
 const edited=await scopeState(page);expect(edited.pinned).toEqual(state.pinned);expect(edited.current.project.assetInstances).toEqual(state.current.project.assetInstances);
 await page.getByRole("button",{name:"Предметы интерьера",exact:true}).click();
 const catalog=page.getByRole("dialog",{name:"Предметы интерьера",exact:true});await expect(catalog.getByTestId("catalog-publication-error")).toContainText("Каталог временно недоступен");
 expect(await scopeState(page)).toEqual(edited);await catalog.getByRole("button",{name:"Закрыть предметы интерьера",exact:true}).click();
 await context.setOffline(false);await page.getByRole("button",{name:"Предметы интерьера",exact:true}).click();
 await expect(catalog.getByTestId("catalog-publication-status")).toContainText(`Версия ${pub.catalogVersion}`);expect(await scopeState(page)).toEqual(edited);
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
 const {state}=await publishActualBed(page,"Restored real model");
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

for(const failure of ["digest","unavailable"] as const)test(`TMA-CATALOG-REJECT-${failure}: failed actual model response is non-durable and an exact retry can prepare locally`,async({page})=>{
 await page.goto("/");const pub=await publication(page),asset=pub.assets.find(a=>a.assetId==="single-bed");if(!asset)throw new Error("Actual published model missing");
 await createRoom(page,`Rejected model ${failure}`);const before=await scopeState(page);
 const pattern=`**/catalog-api/v1/resources/sha256/${asset.resource.sha256}`;let corrupt=true;
 await page.route(pattern,async route=>{
  if(!corrupt){await route.fallback();return;}
  if(failure==="unavailable"){await route.fulfill({status:503,headers:{"cache-control":"no-store"},body:""});return;}
  const response=await route.fetch();expect([200,206]).toContain(response.status());const body=await response.body();body[body.length-1]^=1;
  await route.fulfill({response,body,headers:{...response.headers(),"cache-control":"no-store"}});
 });
 await page.getByRole("button",{name:"Предметы интерьера",exact:true}).click();const catalog=page.getByRole("dialog",{name:"Предметы интерьера",exact:true});
 await catalog.getByTestId("preloaded-catalog-card").filter({hasText:asset.label}).click();
 await expect(catalog.getByTestId("preloaded-catalog-resource-status")).toContainText("Не удалось подготовить предмет для офлайн");
 await expect(catalog.getByRole("button",{name:"Показать на плане",exact:true})).toHaveCount(0);expect(await scopeState(page)).toEqual(before);
 corrupt=false;await catalog.getByRole("button",{name:"Повторить",exact:true}).click();await expect(catalog.getByRole("button",{name:"Показать на плане",exact:true})).toBeEnabled({timeout:60000});
 await page.keyboard.press("Escape");await expect(catalog).toHaveCount(0);expect(await scopeState(page)).toEqual(before);
});

test("TMA-CATALOG-CANCEL: a late actual proxy response cannot place or publish after explicit cancellation",async({page})=>{
 await page.goto("/");const pub=await publication(page),asset=pub.assets.find(a=>a.assetId==="single-bed");if(!asset)throw new Error("Actual published model missing");
 await createRoom(page,"Cancelled model");const before=await scopeState(page);let entered=false,finished=false;let release:()=>void=()=>undefined;
 const held=new Promise<void>(resolve=>{release=resolve;});
 await page.route(`**/catalog-api/v1/resources/sha256/${asset.resource.sha256}`,async route=>{
  const response=await route.fetch();entered=true;await held;
  try{await route.fulfill({response});}catch{/* Native fetch may already be aborted by Cancel. */}finally{finished=true;}
 });
 await page.getByRole("button",{name:"Предметы интерьера",exact:true}).click();const catalog=page.getByRole("dialog",{name:"Предметы интерьера",exact:true});
 await catalog.getByTestId("preloaded-catalog-card").filter({hasText:asset.label}).click();await expect.poll(()=>entered).toBe(true);
 await catalog.getByRole("button",{name:"Отмена",exact:true}).click();release();await expect.poll(()=>finished).toBe(true);
 await expect(catalog.getByTestId("catalog-placement-bar")).toBeHidden();expect(await scopeState(page)).toEqual(before);
});

test("TMA-CATALOG-RANGE: actual same-origin proxy preserves an exact published byte range and immutable ETag",async({page})=>{
 await page.goto("/");const pub=await publication(page),asset=pub.assets.find(a=>a.assetId==="single-bed");if(!asset)throw new Error("Actual published model missing");
 const url=`/catalog-api/v1/resources/sha256/${asset.resource.sha256}`,whole=await page.request.get(url,{headers:{Accept:asset.resource.mediaType}});expect(whole.status()).toBe(200);
 const full=await whole.body();expect(full.byteLength).toBe(asset.resource.byteLength);
 const partial=await page.request.get(url,{headers:{Accept:asset.resource.mediaType,Range:"bytes=16-47"}});expect(partial.status()).toBe(206);expect(partial.headers()["content-range"]).toBe(`bytes 16-47/${full.byteLength}`);expect(partial.headers().etag).toBe(whole.headers().etag);expect(await partial.body()).toEqual(full.subarray(16,48));
});
