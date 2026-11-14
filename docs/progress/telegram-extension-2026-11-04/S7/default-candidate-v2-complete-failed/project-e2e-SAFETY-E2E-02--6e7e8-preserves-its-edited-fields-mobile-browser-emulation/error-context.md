# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: project-e2e.spec.ts >> SAFETY-E2E-02: save retry remains reachable above an open room sheet and preserves its edited fields
- Location: tests/browser/project-e2e.spec.ts:3644:1

# Error details

```
Error: expect(received).not.toBe(expected) // Object.is equality

Expected: not "7469508d-6193-4522-a356-75bf5a335fde"
```

# Page snapshot

```yaml
- main [ref=e3]:
  - generic [ref=e4]:
    - img "План помещения" [ref=e5]:
      - generic [ref=e7]:
        - generic [ref=e11] [cursor=pointer]
        - generic [ref=e13] [cursor=pointer]
        - generic [ref=e15] [cursor=pointer]
        - generic [ref=e17] [cursor=pointer]
      - generic:
        - 'generic "Помещение в чистоте: 4000 мм"': "4000"
        - 'generic "Помещение в чистоте: 3000 мм"': "3000"
    - group "Масштаб плана" [ref=e18]:
      - button "Приблизить" [ref=e19] [cursor=pointer]: +
      - button "Отдалить" [ref=e20] [cursor=pointer]: −
    - generic:
      - button "Вернуться к проектам" [ref=e21] [cursor=pointer]: ‹Назад
      - button "Переименовать проект Высота комнаты" [ref=e22] [cursor=pointer]:
        - generic [ref=e23]: Высота комнаты
      - status [ref=e24]: Сохранено
      - button "Открыть остальные действия" [ref=e25] [cursor=pointer]
      - generic [ref=e30]:
        - group "Переключить вид редактора" [ref=e31]:
          - button "План 2D" [pressed] [ref=e33] [cursor=pointer]: План
          - button "3D" [ref=e34] [cursor=pointer]
        - button "Настроить размеры" [ref=e35] [cursor=pointer]:
          - generic [ref=e38]: Размеры
    - navigation "Инструменты редактора" [ref=e39]:
      - generic [ref=e40]:
        - button "Комната" [pressed] [ref=e41] [cursor=pointer]
        - button "Рука и выбор" [pressed] [ref=e45] [cursor=pointer]
        - button "Стена" [ref=e50] [cursor=pointer]
        - button "Предметы интерьера" [ref=e54] [cursor=pointer]:
          - generic [ref=e58]: Предмет
    - group "История изменений" [ref=e59]:
      - 'button "Отменить действие: изменение плана" [ref=e60] [cursor=pointer]': ↶
      - button "Повторить действие" [disabled] [ref=e61]: ↷
    - button "Помещения" [expanded] [ref=e62] [cursor=pointer]
    - button "Размеры плана" [ref=e65] [cursor=pointer]
  - dialog "Помещения" [active] [ref=e68]:
    - generic [ref=e69]:
      - generic [ref=e71]:
        - heading "Помещения" [level=2] [ref=e72]
        - button "Закрыть помещения" [ref=e73] [cursor=pointer]: ×
      - generic [ref=e74]:
        - navigation "Список помещений" [ref=e75]:
          - button "Другое" [pressed] [ref=e76] [cursor=pointer]:
            - strong [ref=e77]: Другое
            - generic [ref=e78]: 2800 мм
        - generic [ref=e79]:
          - generic [ref=e80]:
            - generic [ref=e81]: Тип
            - combobox "Тип помещения" [ref=e82]:
              - option "Гостиная"
              - option "Спальня"
              - option "Кухня"
              - option "Ванная"
              - option "Коридор"
              - option "Кабинет"
              - option "Кладовая"
              - option "Другое" [selected]
          - generic [ref=e83]:
            - generic [ref=e84]: Высота, мм
            - textbox "Высота помещения, мм" [ref=e85]: "2800"
          - button "Сохранить помещение" [ref=e86] [cursor=pointer]
```

# Test source

```ts
  3596 | 	expect(
  3597 | 		await notice.evaluate(
  3598 | 			(element) => element.scrollWidth <= element.clientWidth,
  3599 | 		),
  3600 | 	).toBe(true);
  3601 | 	await session.page.evaluate(() => {
  3602 | 		document.documentElement.style.fontSize = "";
  3603 | 	});
  3604 | 	await session.page.evaluate(() => {
  3605 | 		const original = HTMLAnchorElement.prototype.click;
  3606 | 		HTMLAnchorElement.prototype.click = () => {
  3607 | 			HTMLAnchorElement.prototype.click = original;
  3608 | 			throw new Error("Test download creation failure");
  3609 | 		};
  3610 | 	});
  3611 | 	await notice
  3612 | 		.getByRole("button", { name: "Скачать сохранённую версию", exact: true })
  3613 | 		.click();
  3614 | 	await expect(
  3615 | 		notice
  3616 | 			.getByRole("alert")
  3617 | 			.filter({ hasText: "Не удалось подготовить файл проекта" }),
  3618 | 	).toBeVisible();
  3619 | 	expect(await currentProjectRevisionId(session.page)).toBe(before);
  3620 | 	const download = await Promise.all([
  3621 | 		session.page.waitForEvent("download"),
  3622 | 		notice
  3623 | 			.getByRole("button", { name: "Скачать сохранённую версию", exact: true })
  3624 | 			.click(),
  3625 | 	]).then(([file]) => file);
  3626 | 	const backupPath = await download.path();
  3627 | 	if (!backupPath) throw new Error("Expected the last durable backup");
  3628 | 	await expect(notice).toBeVisible();
  3629 | 	expect(await currentProjectRevisionId(session.page)).toBe(before);
  3630 | 	await retry.click();
  3631 | 	await expect(notice).toHaveCount(0);
  3632 | 	await expect(session.page.getByTestId("wall-segment")).toHaveCount(3);
  3633 | 	expect(await currentProjectRevisionId(session.page)).not.toBe(before);
  3634 | 	const imported = await openPersistentPhone(testInfo, "calm-save-backup");
  3635 | 	await imported.page.goto("/");
  3636 | 	await imported.page
  3637 | 		.getByLabel("Импортировать проект")
  3638 | 		.setInputFiles(backupPath);
  3639 | 	await expect(imported.page.getByTestId("wall-segment")).toHaveCount(4);
  3640 | 	await imported.context.close();
  3641 | 	await session.context.close();
  3642 | });
  3643 | 
  3644 | test("SAFETY-E2E-02: save retry remains reachable above an open room sheet and preserves its edited fields", async ({
  3645 | 	page: _page,
  3646 | }, testInfo) => {
  3647 | 	const session = await openPersistentPhone(testInfo, "safety-room-overlay");
  3648 | 	await session.page.goto("/");
  3649 | 	await createProject(session.page, "Высота комнаты");
  3650 | 	await session.page.getByRole("button", { name: "Создать контур" }).click();
  3651 | 	await session.page
  3652 | 		.getByRole("button", { name: "Рука и выбор", exact: true })
  3653 | 		.click();
  3654 | 	await session.page
  3655 | 		.getByRole("button", { name: "Помещения", exact: true })
  3656 | 		.click();
  3657 | 	const directory = session.page.getByRole("dialog", { name: "Помещения" });
  3658 | 	await directory.getByLabel("Высота помещения, мм").fill("2800");
  3659 | 	const before = await currentProjectRevisionId(session.page);
  3660 | 	await setTestFault(session.page, "before-pointer-quota");
  3661 | 	await directory
  3662 | 		.getByRole("button", { name: "Сохранить помещение", exact: true })
  3663 | 		.click();
  3664 | 	const notice = session.page.getByTestId("persistence-failure-notice");
  3665 | 	await expect(notice).toBeVisible();
  3666 | 	await expect(directory).not.toHaveAttribute("aria-modal", "true");
  3667 | 	await expect(
  3668 | 		notice.getByRole("button", { name: "Повторить сохранение", exact: true }),
  3669 | 	).toBeFocused();
  3670 | 	await session.page.keyboard.press("Tab");
  3671 | 	await expect(
  3672 | 		notice.getByRole("button", {
  3673 | 			name: "Скачать несохранённую правку",
  3674 | 			exact: true,
  3675 | 		}),
  3676 | 	).toBeFocused();
  3677 | 	await session.page.keyboard.press("Tab");
  3678 | 	await expect(
  3679 | 		notice.getByRole("button", {
  3680 | 			name: "Скачать сохранённую версию",
  3681 | 			exact: true,
  3682 | 		}),
  3683 | 	).toBeFocused();
  3684 | 	await expect(directory.getByLabel("Высота помещения, мм")).toHaveValue(
  3685 | 		"2800",
  3686 | 	);
  3687 | 	expect(await currentProjectRevisionId(session.page)).toBe(before);
  3688 | 	await notice
  3689 | 		.getByRole("button", { name: "Повторить сохранение", exact: true })
  3690 | 		.click({ timeout: 4000 });
  3691 | 	await expect(notice).toHaveCount(0);
  3692 | 	await expect(directory).toHaveAttribute("aria-modal", "true");
  3693 | 	await expect(directory.getByLabel("Высота помещения, мм")).toHaveValue(
  3694 | 		"2800",
  3695 | 	);
> 3696 | 	expect(await currentProjectRevisionId(session.page)).not.toBe(before);
       |                                                           ^ Error: expect(received).not.toBe(expected) // Object.is equality
  3697 | 	await session.context.close();
  3698 | });
  3699 | 
  3700 | // Actual default Web composition; empty legacy drawings require the explicit wire route.
  3701 | test("PROJECT-E2E-03T: the default browser exposes a separate Telegram wire file and preserves its exact legacy source", async ({ page: _page }, testInfo) => {
  3702 |  const session = await openPersistentPhone(testInfo, "telegram-wire-export");
  3703 |  try {
  3704 |   await session.page.goto("/");
  3705 |   await createProject(session.page, "План для Telegram");
  3706 |   await expect(session.page.getByTestId("editor-top-bar").getByRole("status")).toContainText("Сохранено");
  3707 |   const snapshot = () => session.page.evaluate(() => new Promise<{ projects: unknown[]; revisions: unknown[] }>((resolve, reject) => {
  3708 |    const request = indexedDB.open("interiors-editor-projects");
  3709 |    request.onupgradeneeded = () => { request.transaction?.abort(); reject(new Error("Expected existing legacy Project database")); };
  3710 |    request.onerror = () => reject(request.error);
  3711 |    request.onsuccess = () => {
  3712 |     const database = request.result, tx = database.transaction(["projects", "revisions"], "readonly");
  3713 |     const projects = tx.objectStore("projects").getAll(), revisions = tx.objectStore("revisions").getAll();
  3714 |     tx.oncomplete = () => { database.close(); resolve({ projects: projects.result, revisions: revisions.result }); };
  3715 |     tx.onerror = () => { database.close(); reject(tx.error); }; tx.onabort = () => { database.close(); reject(tx.error); };
  3716 |    };
  3717 |   }));
  3718 |   const before = await snapshot(), pointers = await currentProjectPointers(session.page), roots = await pinStagingRootInventory(session.page);
  3719 |   expect(pointers).toHaveLength(1);
  3720 |   const pointer = pointers[0];
  3721 |   const revision = before.revisions.find(row => row !== null && typeof row === "object" && Reflect.get(row, "revisionId") === pointer.currentRevisionId);
  3722 |   if (!revision || typeof revision !== "object") throw new Error("Missing actual source Revision");
  3723 |   const candidate: unknown = Reflect.get(revision, "candidate");
  3724 |   if (!candidate || typeof candidate !== "object") throw new Error("Missing actual source candidate");
  3725 |   const originalProject: unknown = Reflect.get(candidate, "project");
  3726 |   await openProjectDirectory(session.page); await openProjectDirectoryActions(session.page, "План для Telegram");
  3727 |   const oldExport = session.page.getByRole("button", { name: "Экспортировать проект План для Telegram", exact: true });
  3728 |   await expect(oldExport).toBeEnabled();
  3729 |   const wireExport = session.page.getByRole("button", { name: /^Экспорт файла для переноса:/ });
  3730 |   await expect(wireExport).toBeVisible(); await expect(wireExport).toBeEnabled();
  3731 |   const received = session.page.waitForEvent("download", { timeout: 5_000 });
  3732 |   await wireExport.click({ timeout: 5_000 }); await expect(received).resolves.toBeDefined();
  3733 |   const download = await received, path = await download.path();
  3734 |   if (!path) throw new Error("Missing actual local browser wire download");
  3735 |   expect(download.suggestedFilename()).toMatch(/\.interiors$/);
  3736 |   const fsName = "node:fs/promises";
  3737 |   const fs = await import(fsName) as { readFile(path: string): Promise<Uint8Array> };
  3738 |   const checksum = { sha256Bytes: async (bytes: Uint8Array) => Array.from(new Uint8Array(await crypto.subtle.digest("SHA-256", new Uint8Array(bytes).buffer)), byte => byte.toString(16).padStart(2, "0")).join("") };
  3739 |   const codec = new RuntimePortableBackupCodec(checksum, project => validateRuntimeV1Project(project));
  3740 |   const decoded = await codec.decode(new Uint8Array(await fs.readFile(path)));
  3741 |   expect(decoded.kind).toBe("decoded");
  3742 |   if (decoded.kind !== "decoded") throw new Error("Actual browser wire file did not pass the real portable decoder");
  3743 |   expect(decoded.schema).toBe("runtime-v1-wire");
  3744 |   expect(decoded.metadata.sourceProjectId).toBe(pointer.projectId);
  3745 |   expect(decoded.decodedProject).toEqual(originalProject);
  3746 |   expect(decoded.resources).toEqual([]);
  3747 |   expect(await snapshot()).toEqual(before); expect(await pinStagingRootInventory(session.page)).toEqual(roots);
  3748 |   await expect(oldExport).toBeEnabled();
  3749 |  } finally { await session.context.close(); }
  3750 | });
  3751 | 
```