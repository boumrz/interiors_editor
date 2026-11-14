# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: telegram-runtime-ui-e2e.check.ts >> BROWSER-DIRECTORY-UI-01: qualified same-ID card actions retain their selected owner at the shared UI boundary
- Location: tests/browser/telegram-runtime-ui-e2e.check.ts:826:1

# Error details

```
Error: expect(received).toEqual(expected) // deep equality

- Expected  - 1
+ Received  + 2

@@ -8,18 +8,19 @@
    ],
    Array [
      "export",
      "same-id",
      Object {
+       "signal": undefined,
        "storageNamespace": "browser-registered",
      },
    ],
    Array [
      "registered-export",
      "same-id",
      Object {
-       "storageNamespace": "browser-registered",
+       "signal": undefined,
      },
    ],
    Array [
      "delete",
      "same-id",
```

# Test source

```ts
  736 | 
  737 | test("TMA-UI-25: a layout-only host event invalidates the old Plan release without a Project command",async({page})=>{
  738 |  await page.evaluate(()=>window.__telegramRuntimeUi.prepareUpperCustom("a"));await page.evaluate(()=>window.__telegramRuntimeUi.mountPreparedNavigable("a"));await open(page,"Uppercase local model");
  739 |  const item=page.getByTestId("schematic-item");await item.click();const box=await item.boundingBox();if(!box)throw new Error("Actual placed model missing");const before=await rows(page,"a");
  740 |  await page.mouse.move(box.x+box.width/2,box.y+box.height/2);await page.mouse.down();await page.mouse.move(box.x+box.width/2+25,box.y+box.height/2+15,{steps:3});
  741 |  await page.evaluate(()=>window.__telegramRuntimeUi.changeHostLayout());await page.mouse.up();expect(await rows(page,"a")).toEqual(before);
  742 | });
  743 | 
  744 | test("TMA-UI-26: closing the page during an actual uncommitted save reopens the last exact Durable Revision",async({page,context})=>{
  745 |  await navigableRoom(page,"Last durable before abrupt close");const before=await rows(page,"a"),preserved=await browser(page),url=page.url();
  746 |  await page.getByRole("button",{name:"Переименовать проект Last durable before abrupt close",exact:true}).click();
  747 |  await page.getByRole("textbox",{name:"Новое название проекта",exact:true}).fill("Uncommitted after close");
  748 |  await page.evaluate(()=>window.__telegramRuntimeUi.holdPublicationChecksum("Uncommitted after close"));
  749 |  await page.getByRole("button",{name:"Сохранить название",exact:true}).click();await expect.poll(()=>page.evaluate(()=>window.__telegramRuntimeUi.checksumIsHeld())).toBe(true);
  750 |  await page.close({runBeforeUnload:false});
  751 |  const reopened=await context.newPage();
  752 |  try{
  753 |   await reopened.goto(url);await start(reopened,"a");await reopened.getByRole("button",{name:"Открыть Last durable before abrupt close",exact:true}).click();
  754 |   await expect.poll(()=>reopened.evaluate(()=>{const state=window.__telegramRuntimeUi.state();return "project" in state ? state.project?.name : undefined;})).toBe("Last durable before abrupt close");
  755 |   expect(await rows(reopened,"a")).toEqual(before);expect(await browser(reopened)).toEqual(preserved);
  756 |   await expect(reopened.getByRole("button",{name:"Переименовать проект Uncommitted after close",exact:true})).toHaveCount(0);
  757 |  }finally{await reopened.evaluate(()=>window.__telegramRuntimeUi.dispose()).catch(()=>undefined);await reopened.close();}
  758 | });
  759 | 
  760 | 
  761 | test("TMA-UI-27: an oversized actual local GLB is refused before reading bytes and without Project changes",async({page})=>{
  762 |  await navigableRoom(page,"Bounded local GLB");const before=await rows(page,"a");
  763 |  await page.getByRole("button",{name:"Предметы интерьера",exact:true}).click();await page.getByTestId("catalog-authoring").locator("summary").click();
  764 |  await page.evaluate(()=>window.__telegramRuntimeUi.selectModelFile("glb",25*1024*1024+1));
  765 |  await expect(page.getByText("Одна GLB-модель ограничена 25 MiB, чтобы её можно было хранить и открыть на телефоне.",{exact:true})).toBeVisible();
  766 |  expect(await page.evaluate(()=>window.__telegramRuntimeUi.localModelFileReads())).toBe(0);expect(await rows(page,"a")).toEqual(before);
  767 | });
  768 | test("TMA-UI-28: embedded Telegram exposes static GLB only and rejects a queued FBX selection without conversion or reads",async({page})=>{
  769 |  await navigableRoom(page,"Static GLB only");const before=await rows(page,"a");
  770 |  await page.getByRole("button",{name:"Предметы интерьера",exact:true}).click();await page.getByTestId("catalog-authoring").locator("summary").click();
  771 |  await expect(page.getByRole("button",{name:"Выбрать FBX или ZIP",exact:true})).toHaveCount(0);
  772 |  await expect(page.getByRole("button",{name:"Выбрать GLB",exact:true})).toBeVisible();
  773 |  await page.evaluate(()=>window.__telegramRuntimeUi.selectModelFile("fbx",1));
  774 |  await expect(page.getByText(/^Преобразуем /)).toHaveCount(0);expect(await page.evaluate(()=>window.__telegramRuntimeUi.localModelFileReads())).toBe(0);expect(await rows(page,"a")).toEqual(before);
  775 | });
  776 | 
  777 | 
  778 | test("TMA-UI-29: Back requires an explicit discard for an actual fence-loss recovery candidate",async({page,context})=>{
  779 |  await navigableRoom(page,"Fence recovery base");
  780 |  await page.getByRole("button",{name:"Переименовать проект Fence recovery base",exact:true}).click();await page.getByRole("textbox",{name:"Новое название проекта",exact:true}).fill("Retained fence candidate");
  781 |  await page.evaluate(()=>window.__telegramRuntimeUi.holdPublicationChecksum("Retained fence candidate"));await page.getByRole("button",{name:"Сохранить название",exact:true}).click();await expect.poll(()=>page.evaluate(()=>window.__telegramRuntimeUi.checksumIsHeld())).toBe(true);
  782 |  const foreign=await context.newPage();
  783 |  try{
  784 |   await foreign.goto(page.url());await foreign.evaluate(async()=>{await window.__telegramRuntimeUi.initialize();await window.__telegramRuntimeUi.mountConcurrentNavigable("a");});await foreign.getByRole("button",{name:"Открыть Fence recovery base",exact:true}).click();
  785 |   await foreign.getByRole("button",{name:"Взять редактирование на себя",exact:true}).click();await foreign.getByRole("button",{name:"Подтвердить перехват",exact:true}).click();await expect(foreign.getByTestId("writer-lease-notice")).toHaveCount(0);
  786 |   await page.evaluate(()=>window.__telegramRuntimeUi.releasePublicationChecksum());
  787 |   await expect.poll(()=>page.evaluate(()=>window.__telegramRuntimeUi.writerRecoveryName())).toBe("Retained fence candidate");
  788 |   await expect.poll(()=>page.evaluate(()=>window.__telegramRuntimeUi.hostClosingWarning())).toBe(true);
  789 |   const durable=await rows(page,"a");
  790 |   const panel=await dimensions(page);await page.evaluate(()=>window.__telegramRuntimeUi.hostBack());await expect(panel).toHaveCount(0);expect(await page.evaluate(()=>window.__telegramRuntimeUi.writerRecoveryName())).toBe("Retained fence candidate");
  791 |   await page.evaluate(()=>window.__telegramRuntimeUi.hostBack());
  792 |   const guard=page.getByRole("alertdialog",{name:"Несохранённая правка",exact:true});await expect(guard).toBeVisible();expect(await page.evaluate(()=>window.__telegramRuntimeUi.hostClosingWarning())).toBe(true);
  793 |   await guard.getByRole("button",{name:"Продолжить",exact:true}).click();expect(await page.evaluate(()=>window.__telegramRuntimeUi.writerRecoveryName())).toBe("Retained fence candidate");expect(await rows(page,"a")).toEqual(durable);
  794 |   await page.evaluate(()=>window.__telegramRuntimeUi.hostBack());await guard.getByRole("button",{name:"Отменить правку",exact:true}).click();await expect(page.getByTestId("project-hub")).toBeVisible();expect(await page.evaluate(()=>window.__telegramRuntimeUi.writerRecoveryName())).toBeUndefined();expect(await rows(page,"a")).toEqual(durable);
  795 |   await page.getByRole("button",{name:"Открыть Fence recovery base",exact:true}).click();await expect(page.getByTestId("writer-lease-notice")).toBeVisible();await page.evaluate(()=>window.__telegramRuntimeUi.hostBack());await expect(page.getByTestId("project-hub")).toBeVisible();await expect(guard).toHaveCount(0);
  796 |  }finally{await foreign.evaluate(()=>window.__telegramRuntimeUi.dispose()).catch(()=>undefined);await foreign.close();}
  797 | });
  798 | 
  799 | 
  800 | test("TMA-UI-30: host Back waits while an explicit native writer takeover is queued behind the real scope lock",async({page,context})=>{
  801 |  await navigableRoom(page,"Queued writer takeover");const before=await rows(page,"a"),foreign=await context.newPage();
  802 |  try{
  803 |   await foreign.goto(page.url());await foreign.evaluate(async()=>{await window.__telegramRuntimeUi.initialize();await window.__telegramRuntimeUi.mountConcurrentNavigable("a");});
  804 |   await foreign.getByRole("button",{name:"Открыть Queued writer takeover",exact:true}).click();await foreign.getByRole("button",{name:"Взять редактирование на себя",exact:true}).click();
  805 |   await page.evaluate(()=>window.__telegramRuntimeUi.holdScopeLock("a"));await foreign.getByRole("button",{name:"Подтвердить перехват",exact:true}).click();await expect(foreign.getByRole("button",{name:"Перехватываем редактирование…",exact:true})).toBeDisabled();
  806 |   await foreign.evaluate(()=>window.__telegramRuntimeUi.hostBack());await expect(foreign.getByText("Дождитесь завершения текущего действия. Сохраняемая правка не отменена.",{exact:true})).toBeVisible();
  807 |   await expect(foreign.getByTestId("project-hub")).toHaveCount(0);await expect(foreign.getByRole("alertdialog",{name:"Несохранённая правка",exact:true})).toHaveCount(0);expect(await foreign.evaluate(()=>window.__telegramRuntimeUi.hostClosingWarning())).toBe(true);
  808 |   await page.evaluate(()=>window.__telegramRuntimeUi.releaseScopeLock());await expect(foreign.getByTestId("writer-lease-notice")).toHaveCount(0);expect(await rows(foreign,"a")).toEqual(before);
  809 |  }finally{await page.evaluate(()=>window.__telegramRuntimeUi.releaseScopeLock()).catch(()=>undefined);await foreign.evaluate(()=>window.__telegramRuntimeUi.dispose()).catch(()=>undefined);await foreign.close();}
  810 | });
  811 | 
  812 | 
  813 | test("TMA-UI-31: exact repair bounds precede every File read or storage write and a supported exact GLB restores the same Revision",async({page})=>{
  814 |  await page.evaluate(()=>window.__telegramRuntimeUi.prepareUpperCustom("a"));await page.evaluate(()=>window.__telegramRuntimeUi.removeCurrentResource("a"));
  815 |  await page.getByRole("button",{name:"Открыть Uppercase local model",exact:true}).click();
  816 |  await expect(page.getByRole("button",{name:"Восстановить исходные GLB",exact:true})).toBeVisible();
  817 |  const before=await rows(page,"a"),all=await page.evaluate(()=>window.__telegramRuntimeUi.allScopedRows("a"));
  818 |  for(const sizes of [[50*1024*1024+1],Array.from({length:901},()=>1)]){
  819 |   await page.evaluate(sizes=>window.__telegramRuntimeUi.selectRepairFiles(sizes),sizes);
  820 |   await expect(page.getByText("Выбранный набор GLB превышает допустимые ограничения. Проект не изменён.",{exact:true})).toBeVisible();expect(await page.evaluate(()=>window.__telegramRuntimeUi.localModelFileReads())).toBe(0);expect(await page.evaluate(()=>window.__telegramRuntimeUi.allScopedRows("a"))).toEqual(all);
  821 |  }
  822 |  await page.evaluate(()=>window.__telegramRuntimeUi.selectRepairFiles());await saved(page);expect(await page.evaluate(()=>window.__telegramRuntimeUi.localModelFileReads())).toBe(1);expect(await rows(page,"a")).toEqual(before);
  823 | });
  824 | 
  825 | 
  826 | test("BROWSER-DIRECTORY-UI-01: qualified same-ID card actions retain their selected owner at the shared UI boundary", async ({ page }) => {
  827 |  await page.evaluate(() => window.__telegramRuntimeUi.mountDirectoryContract());
  828 |  const card = page.locator('[data-project-storage="browser-registered"]');
  829 |  await card.getByRole("button", { name: /^Открыть / }).click();
  830 |  await card.locator("summary").click();
  831 |  await card.getByRole("button", { name: /^Экспортировать проект / }).click();
  832 |  await card.getByRole("button", { name: /^Экспорт файла для переноса:/ }).click();
  833 |  await card.getByRole("button", { name: /^Удалить проект / }).click();
  834 |  await page.getByRole("dialog", { name: "Удалить проект", exact: true }).getByRole("button", { name: "Удалить навсегда", exact: true }).click();
  835 |  const calls = await page.evaluate(() => window.__telegramRuntimeUi.directoryContractCalls());
> 836 |  expect(calls.map(call => [call.method, call.arguments[0], call.arguments[1]])).toEqual([
      |                                                                                 ^ Error: expect(received).toEqual(expected) // deep equality
  837 |   ["openProject", "same-id", { storageNamespace: "browser-registered" }],
  838 |   ["export", "same-id", { storageNamespace: "browser-registered" }],
  839 |   ["registered-export", "same-id", { storageNamespace: "browser-registered" }],
  840 |   ["delete", "same-id", { storageNamespace: "browser-registered" }],
  841 |  ]);
  842 |  await card.getByRole("button", { name: /^Переименовать / }).click();
  843 |  await expect(page.getByRole("textbox", { name: "Новое название проекта", exact: true })).toHaveValue("Перенесённый план");
  844 |  const rename = (await page.evaluate(() => window.__telegramRuntimeUi.directoryContractCalls())).at(-1);
  845 |  expect(rename).toEqual({ method: "openProject", arguments: ["same-id", { storageNamespace: "browser-registered", initialAction: "rename" }] });
  846 | });
  847 | 
  848 | test("BROWSER-DIRECTORY-UI-02: an opaque instance change remounts same-ID editor state and retains only the new rename intent", async ({ page }) => {
  849 |  await page.evaluate(() => window.__telegramRuntimeUi.mountDirectoryContract());
  850 |  await page.evaluate(() => window.__telegramRuntimeUi.selectDirectoryContract("Первая копия"));
  851 |  const input = page.getByRole("textbox", { name: "Новое название проекта", exact: true });
  852 |  await expect(input).toHaveValue("Первая копия"); await input.fill("  Старый сырой черновик  ");
  853 |  await input.evaluate(element => { Object.defineProperty(window, "__priorRename", { value: element, configurable: true }); });
  854 |  await page.evaluate(() => window.__telegramRuntimeUi.selectDirectoryContract("Другая копия с тем же ID"));
  855 |  await expect(input).toHaveValue("Другая копия с тем же ID");
  856 |  expect(await page.evaluate(() => (window as unknown as { __priorRename: Element }).__priorRename.isConnected)).toBe(false);
  857 | });
  858 | 
  859 | test("BROWSER-DIRECTORY-UI-03: the ordinary unqualified Web card preserves its single-argument open contract", async ({ page }) => {
  860 |  await page.evaluate(() => window.__telegramRuntimeUi.mountDirectoryContract(false));
  861 |  await page.getByRole("button", { name: "Открыть Одинаковый план", exact: true }).click();
  862 |  expect(await page.evaluate(() => window.__telegramRuntimeUi.directoryContractCalls())).toEqual([{ method: "openProject", arguments: ["same-id"] }]);
  863 | });
  864 | 
  865 | test("BROWSER-DIRECTORY-UI-04: unavailable source is not called empty and explicit retry refreshes the directory", async ({ page }) => {
  866 |  // Deliberately publish after the render snapshot but before observer registration.
  867 |  await page.evaluate(() => window.__telegramRuntimeUi.mountDirectoryContract(true, true));
  868 |  await expect(page.getByText("Часть проектов сейчас недоступна", { exact: true })).toBeVisible();
  869 |  await expect(page.getByText("Пока нет проектов", { exact: true })).toHaveCount(0);
  870 |  await page.getByRole("button", { name: "Повторить проверку локальных хранилищ", exact: true }).click();
  871 |  await expect(page.locator('[data-project-storage]')).toHaveCount(2);
  872 |  expect(await page.evaluate(() => window.__telegramRuntimeUi.directoryContractCalls())).toEqual([{ method: "showProjects", arguments: [] }]);
  873 | });
  874 | 
```