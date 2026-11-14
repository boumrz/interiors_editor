# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: telegram-runtime-ui-e2e.check.ts >> TMA-UI-29: Back requires an explicit discard for an actual fence-loss recovery candidate
- Location: tests/browser/telegram-runtime-ui-e2e.check.ts:779:1

# Error details

```
Error: expect(locator).toHaveCount(expected) failed

Locator:  getByRole('dialog', { name: 'Размеры', exact: true })
Expected: 0
Received: 1
Timeout:  5000ms

Call log:
  - Expect "toHaveCount" with timeout 5000ms
  - waiting for getByRole('dialog', { name: 'Размеры', exact: true })
    14 × locator resolved to 1 element
       - unexpected value "1"

```

# Test source

```ts
  691 |  await page.evaluate(({x,y})=>{window.__telegramRuntimeUi.setHostActivity(false);document.querySelector('[data-testid="schematic-item"]')?.closest('svg')?.dispatchEvent(new PointerEvent("pointerup",{bubbles:true,pointerId:1,pointerType:"mouse",isPrimary:true,clientX:x,clientY:y,buttons:0}));},{x:x+18,y:y+10});
  692 |  await expect.poll(()=>page.evaluate(()=>window.__telegramRuntimeUi.hasActivePublication())).toBe(false);expect(await rows(page,"a")).toEqual(before);
  693 |  await page.evaluate(()=>window.__telegramRuntimeUi.setHostActivity(true));await page.mouse.up();expect(await rows(page,"a")).toEqual(before);
  694 |  expect(await page.evaluate(()=>window.__telegramRuntimeUi.hostLifecycleListenerCount())).toBe(1);await page.evaluate(()=>window.__telegramRuntimeUi.dispose());expect(await page.evaluate(()=>window.__telegramRuntimeUi.hostLifecycleListenerCount())).toBe(0);
  695 | });
  696 | 
  697 | 
  698 | test("TMA-UI-23: exact unverified private source uses explicit readonly selection and a distinct fresh File gesture", async ({ page }) => {
  699 | 	const preserved = await browser(page);
  700 | 	await start(page, "a");
  701 | 	await createRoom(page, "Source recovery only");
  702 | 	const serializedProject = ' \n{"schemaVersion":999,"raw":"' + String.fromCharCode(0xd800) + '\u0000"}  ';
  703 | 	await page.evaluate((text) => window.__telegramRuntimeUi.corruptCurrentSource("a", text), serializedProject);
  704 | 	await expect(page.getByRole("heading", { name: "Проект требует восстановления", exact: true })).toBeVisible();
  705 | 	const before = await rows(page, "a");
  706 | 	const panel = page.getByRole("complementary", { name: "Непроверенные исходники", exact: true });
  707 | 	await expect(panel).toBeVisible();
  708 | 	await expect(panel.getByRole("button", { name: "Подготовить исходник записи 1", exact: true })).toHaveCount(0);
  709 | 	await panel.getByRole("button", { name: "Показать записи", exact: true }).click();
  710 | 	await panel.getByRole("button", { name: "Подготовить исходник записи 1", exact: true }).click();
  711 | 	const file = page.getByRole("complementary", { name: "Передача файла", exact: true });
  712 | 	await expect(file.getByRole("heading", { name: "Непроверенная исходная запись", exact: true })).toBeVisible();
  713 | 	expect(await page.evaluate(() => window.__telegramRuntimeUi.sharedFileCount())).toBe(0);
  714 | 	await file.getByRole("button", { name: "Передать файл", exact: true }).click();
  715 | 	await expect.poll(() => page.evaluate(() => window.__telegramRuntimeUi.sharedFileCount())).toBe(1);
  716 | 	const handed = await page.evaluate(() => window.__telegramRuntimeUi.sharedFile(0));
  717 | 	expect(handed.name).toBe("project.interiors-source.json");
  718 | 	expect(handed.mimeType).toBe("application/json");
  719 | 	const envelope = JSON.parse(new TextDecoder().decode(new Uint8Array(handed.bytes)));
  720 | 	expect(envelope).toEqual({ purpose: "interiors-editor-unverified-source", version: 1, kind: "unverified-source", projectId: Reflect.get(before.projects[0] as object, "projectId"), revisionId: Reflect.get(before.projects[0] as object, "currentRevisionId"), serializedProject });
  721 | 	await expect(file).toContainText("этот файл не восстанавливает проект автоматически");
  722 | 	expect(await rows(page, "a")).toEqual(before);
  723 | 	expect(await browser(page)).toEqual(preserved);
  724 | });
  725 | 
  726 | 
  727 | test("TMA-UI-24: inactive host captures focused raw angle before blur and never turns it into a saved mutation",async({page})=>{
  728 |  await page.evaluate(()=>window.__telegramRuntimeUi.prepareUpperCustom("a"));await page.evaluate(()=>window.__telegramRuntimeUi.mountPreparedNavigable("a"));await open(page,"Uppercase local model");await page.getByTestId("schematic-item").click();
  729 |  const inspector=page.getByTestId("selected-item-inspector");if(!(await inspector.isVisible())){const action=page.getByRole("button",{name:"Параметры выбранного предмета",exact:true});if(!(await action.isVisible()))await page.getByRole("button",{name:"Открыть остальные действия",exact:true}).click();await action.click();}else if((await inspector.getAttribute("data-inspector-expanded"))!=="true")await page.getByRole("button",{name:"Развернуть панель предмета",exact:true}).click();
  730 |  const angle=inspector.getByRole("textbox",{name:"Угол поворота выбранного предмета, градусы",exact:true});await angle.fill("17.50");const before=await rows(page,"a");
  731 |  await page.evaluate(()=>window.__telegramRuntimeUi.setHostActivity(false));await angle.evaluate(element=>(element as HTMLInputElement).blur());
  732 |  await expect(angle).toHaveValue("17.50");expect(await rows(page,"a")).toEqual(before);
  733 |  await page.evaluate(()=>window.__telegramRuntimeUi.setHostActivity(true));await page.evaluate(()=>window.__telegramRuntimeUi.hostBack());
  734 |  const guard=page.getByRole("alertdialog",{name:"Несохранённая правка",exact:true});await expect(guard).toBeVisible();expect(await rows(page,"a")).toEqual(before);
  735 |  await guard.getByRole("button",{name:"Продолжить",exact:true}).click();await expect(angle).toHaveValue("17.50");expect(await rows(page,"a")).toEqual(before);
  736 | });
  737 | 
  738 | test("TMA-UI-25: a layout-only host event invalidates the old Plan release without a Project command",async({page})=>{
  739 |  await page.evaluate(()=>window.__telegramRuntimeUi.prepareUpperCustom("a"));await page.evaluate(()=>window.__telegramRuntimeUi.mountPreparedNavigable("a"));await open(page,"Uppercase local model");
  740 |  const item=page.getByTestId("schematic-item");await item.click();const box=await item.boundingBox();if(!box)throw new Error("Actual placed model missing");const before=await rows(page,"a");
  741 |  await page.mouse.move(box.x+box.width/2,box.y+box.height/2);await page.mouse.down();await page.mouse.move(box.x+box.width/2+25,box.y+box.height/2+15,{steps:3});
  742 |  await page.evaluate(()=>window.__telegramRuntimeUi.changeHostLayout());await page.mouse.up();expect(await rows(page,"a")).toEqual(before);
  743 | });
  744 | 
  745 | test("TMA-UI-26: closing the page during an actual uncommitted save reopens the last exact Durable Revision",async({page,context})=>{
  746 |  await navigableRoom(page,"Last durable before abrupt close");const before=await rows(page,"a"),preserved=await browser(page),url=page.url();
  747 |  await page.getByRole("button",{name:"Переименовать проект Last durable before abrupt close",exact:true}).click();
  748 |  await page.getByRole("textbox",{name:"Новое название проекта",exact:true}).fill("Uncommitted after close");
  749 |  await page.evaluate(()=>window.__telegramRuntimeUi.holdPublicationChecksum("Uncommitted after close"));
  750 |  await page.getByRole("button",{name:"Сохранить название",exact:true}).click();await expect.poll(()=>page.evaluate(()=>window.__telegramRuntimeUi.checksumIsHeld())).toBe(true);
  751 |  await page.close({runBeforeUnload:false});
  752 |  const reopened=await context.newPage();
  753 |  try{
  754 |   await reopened.goto(url);await start(reopened,"a");await reopened.getByRole("button",{name:"Открыть Last durable before abrupt close",exact:true}).click();
  755 |   await expect.poll(()=>reopened.evaluate(()=>{const state=window.__telegramRuntimeUi.state();return "project" in state ? state.project?.name : undefined;})).toBe("Last durable before abrupt close");
  756 |   expect(await rows(reopened,"a")).toEqual(before);expect(await browser(reopened)).toEqual(preserved);
  757 |   await expect(reopened.getByRole("button",{name:"Переименовать проект Uncommitted after close",exact:true})).toHaveCount(0);
  758 |  }finally{await reopened.evaluate(()=>window.__telegramRuntimeUi.dispose()).catch(()=>undefined);await reopened.close();}
  759 | });
  760 | 
  761 | 
  762 | test("TMA-UI-27: an oversized actual local GLB is refused before reading bytes and without Project changes",async({page})=>{
  763 |  await navigableRoom(page,"Bounded local GLB");const before=await rows(page,"a");
  764 |  await page.getByRole("button",{name:"Предметы интерьера",exact:true}).click();await page.getByTestId("catalog-authoring").locator("summary").click();
  765 |  await page.evaluate(()=>window.__telegramRuntimeUi.selectModelFile("glb",25*1024*1024+1));
  766 |  await expect(page.getByText("Одна GLB-модель ограничена 25 MiB, чтобы её можно было хранить и открыть на телефоне.",{exact:true})).toBeVisible();
  767 |  expect(await page.evaluate(()=>window.__telegramRuntimeUi.localModelFileReads())).toBe(0);expect(await rows(page,"a")).toEqual(before);
  768 | });
  769 | test("TMA-UI-28: embedded Telegram exposes static GLB only and rejects a queued FBX selection without conversion or reads",async({page})=>{
  770 |  await navigableRoom(page,"Static GLB only");const before=await rows(page,"a");
  771 |  await page.getByRole("button",{name:"Предметы интерьера",exact:true}).click();await page.getByTestId("catalog-authoring").locator("summary").click();
  772 |  await expect(page.getByRole("button",{name:"Выбрать FBX или ZIP",exact:true})).toHaveCount(0);
  773 |  await expect(page.getByRole("button",{name:"Выбрать GLB",exact:true})).toBeVisible();
  774 |  await page.evaluate(()=>window.__telegramRuntimeUi.selectModelFile("fbx",1));
  775 |  await expect(page.getByText(/^Преобразуем /)).toHaveCount(0);expect(await page.evaluate(()=>window.__telegramRuntimeUi.localModelFileReads())).toBe(0);expect(await rows(page,"a")).toEqual(before);
  776 | });
  777 | 
  778 | 
  779 | test("TMA-UI-29: Back requires an explicit discard for an actual fence-loss recovery candidate",async({page,context})=>{
  780 |  await navigableRoom(page,"Fence recovery base");
  781 |  await page.getByRole("button",{name:"Переименовать проект Fence recovery base",exact:true}).click();await page.getByRole("textbox",{name:"Новое название проекта",exact:true}).fill("Retained fence candidate");
  782 |  await page.evaluate(()=>window.__telegramRuntimeUi.holdPublicationChecksum("Retained fence candidate"));await page.getByRole("button",{name:"Сохранить название",exact:true}).click();await expect.poll(()=>page.evaluate(()=>window.__telegramRuntimeUi.checksumIsHeld())).toBe(true);
  783 |  const foreign=await context.newPage();
  784 |  try{
  785 |   await foreign.goto(page.url());await foreign.evaluate(async()=>{await window.__telegramRuntimeUi.initialize();await window.__telegramRuntimeUi.mountConcurrentNavigable("a");});await foreign.getByRole("button",{name:"Открыть Fence recovery base",exact:true}).click();
  786 |   await foreign.getByRole("button",{name:"Взять редактирование на себя",exact:true}).click();await foreign.getByRole("button",{name:"Подтвердить перехват",exact:true}).click();await expect(foreign.getByTestId("writer-lease-notice")).toHaveCount(0);
  787 |   await page.evaluate(()=>window.__telegramRuntimeUi.releasePublicationChecksum());
  788 |   await expect.poll(()=>page.evaluate(()=>window.__telegramRuntimeUi.writerRecoveryName())).toBe("Retained fence candidate");
  789 |   await expect.poll(()=>page.evaluate(()=>window.__telegramRuntimeUi.hostClosingWarning())).toBe(true);
  790 |   const durable=await rows(page,"a");
> 791 |   const panel=await dimensions(page);await page.evaluate(()=>window.__telegramRuntimeUi.hostBack());await expect(panel).toHaveCount(0);expect(await page.evaluate(()=>window.__telegramRuntimeUi.writerRecoveryName())).toBe("Retained fence candidate");
      |                                                                                                                         ^ Error: expect(locator).toHaveCount(expected) failed
  792 |   await page.evaluate(()=>window.__telegramRuntimeUi.hostBack());
  793 |   const guard=page.getByRole("alertdialog",{name:"Несохранённая правка",exact:true});await expect(guard).toBeVisible();expect(await page.evaluate(()=>window.__telegramRuntimeUi.hostClosingWarning())).toBe(true);
  794 |   await guard.getByRole("button",{name:"Продолжить",exact:true}).click();expect(await page.evaluate(()=>window.__telegramRuntimeUi.writerRecoveryName())).toBe("Retained fence candidate");expect(await rows(page,"a")).toEqual(durable);
  795 |   await page.evaluate(()=>window.__telegramRuntimeUi.hostBack());await guard.getByRole("button",{name:"Отменить правку",exact:true}).click();await expect(page.getByTestId("project-hub")).toBeVisible();expect(await page.evaluate(()=>window.__telegramRuntimeUi.writerRecoveryName())).toBeUndefined();expect(await rows(page,"a")).toEqual(durable);
  796 |   await page.getByRole("button",{name:"Открыть Fence recovery base",exact:true}).click();await expect(page.getByTestId("writer-lease-notice")).toBeVisible();await page.evaluate(()=>window.__telegramRuntimeUi.hostBack());await expect(page.getByTestId("project-hub")).toBeVisible();await expect(guard).toHaveCount(0);
  797 |  }finally{await foreign.evaluate(()=>window.__telegramRuntimeUi.dispose()).catch(()=>undefined);await foreign.close();}
  798 | });
  799 | 
  800 | 
  801 | test("TMA-UI-30: host Back waits while an explicit native writer takeover is queued behind the real scope lock",async({page,context})=>{
  802 |  await navigableRoom(page,"Queued writer takeover");const before=await rows(page,"a"),foreign=await context.newPage();
  803 |  try{
  804 |   await foreign.goto(page.url());await foreign.evaluate(async()=>{await window.__telegramRuntimeUi.initialize();await window.__telegramRuntimeUi.mountConcurrentNavigable("a");});
  805 |   await foreign.getByRole("button",{name:"Открыть Queued writer takeover",exact:true}).click();await foreign.getByRole("button",{name:"Взять редактирование на себя",exact:true}).click();
  806 |   await page.evaluate(()=>window.__telegramRuntimeUi.holdScopeLock("a"));await foreign.getByRole("button",{name:"Подтвердить перехват",exact:true}).click();await expect(foreign.getByRole("button",{name:"Перехватываем редактирование…",exact:true})).toBeDisabled();
  807 |   await foreign.evaluate(()=>window.__telegramRuntimeUi.hostBack());await expect(foreign.getByText("Дождитесь завершения текущего действия. Сохраняемая правка не отменена.",{exact:true})).toBeVisible();
  808 |   await expect(foreign.getByTestId("project-hub")).toHaveCount(0);await expect(foreign.getByRole("alertdialog",{name:"Несохранённая правка",exact:true})).toHaveCount(0);expect(await foreign.evaluate(()=>window.__telegramRuntimeUi.hostClosingWarning())).toBe(true);
  809 |   await page.evaluate(()=>window.__telegramRuntimeUi.releaseScopeLock());await expect(foreign.getByTestId("writer-lease-notice")).toHaveCount(0);expect(await rows(foreign,"a")).toEqual(before);
  810 |  }finally{await page.evaluate(()=>window.__telegramRuntimeUi.releaseScopeLock()).catch(()=>undefined);await foreign.evaluate(()=>window.__telegramRuntimeUi.dispose()).catch(()=>undefined);await foreign.close();}
  811 | });
  812 | 
```