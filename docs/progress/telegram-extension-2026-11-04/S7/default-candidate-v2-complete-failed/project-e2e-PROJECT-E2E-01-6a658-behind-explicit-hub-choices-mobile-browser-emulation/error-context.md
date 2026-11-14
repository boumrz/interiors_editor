# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: project-e2e.spec.ts >> PROJECT-E2E-01H: cold start keeps empty and sole local Projects behind explicit hub choices
- Location: tests/browser/project-e2e.spec.ts:934:1

# Error details

```
Error: expect(locator).toContainText(expected) failed

Locator: getByTestId('project-directory-empty')
Expected substring: "Пока нет проектов"
Received string:    "В обычном хранилище пока нет проектов"
Timeout: 5000ms

Call log:
  - Expect "toContainText" with timeout 5000ms
  - waiting for getByTestId('project-directory-empty')
    14 × locator resolved to <section aria-label="Пустой список проектов" data-testid="project-directory-empty" class="@interiors/web-src_ui_AppShell_module_css-projectDirectoryEmpty">…</section>
       - unexpected value "В обычном хранилище пока нет проектов"

```

```yaml
- region "Пустой список проектов":
  - strong: В обычном хранилище пока нет проектов
```

# Test source

```ts
  848  | 	await expect(reopened.page.getByTestId("writer-lease-notice")).toBeVisible();
  849  | 	await reopened.page
  850  | 		.getByRole("button", { name: "Взять редактирование на себя" })
  851  | 		.click();
  852  | 	await reopened.page
  853  | 		.getByRole("button", { name: "Подтвердить перехват" })
  854  | 		.click();
  855  | 	await expect(reopened.page.getByTestId("writer-lease-notice")).toHaveCount(0);
  856  | 	await expect(reopened.page.getByRole("status")).toContainText("Сохранено");
  857  | 	await reopened.context.close();
  858  | 
  859  | 	const blank = await openPersistentPhone(testInfo, "blank");
  860  | 	await blank.page.goto("/");
  861  | 	await startNewProject(blank.page);
  862  | 	await blank.page.getByRole("button", { name: "Создать проект" }).click();
  863  | 	await expect(blank.page.getByRole("alert")).toHaveText(
  864  | 		"Введите название проекта.",
  865  | 	);
  866  | 	await expect(blank.page.getByRole("status")).toHaveCount(0);
  867  | 	expect(await durableRevisionCount(blank.page)).toBe(0);
  868  | 	await blank.context.close();
  869  | 
  870  | 	const faulted = await openPersistentPhone(testInfo, "fault");
  871  | 	await faulted.page.goto("/");
  872  | 	await startNewProject(faulted.page);
  873  | 	await setTestFault(faulted.page, "before-pointer");
  874  | 	await submitNewProject(faulted.page, "Не должен сохраниться");
  875  | 	await expect(faulted.page.getByRole("status")).toContainText("Не сохранено");
  876  | 	await expect(
  877  | 		faulted.page.getByTestId("project-creation-failure"),
  878  | 	).toContainText("Не удалось создать проект");
  879  | 	await expect(
  880  | 		faulted.page.getByRole("button", { name: "Скачать сохранённую версию" }),
  881  | 	).toHaveCount(0);
  882  | 	await expect(
  883  | 		faulted.page.getByRole("button", { name: "Повторить сохранение" }),
  884  | 	).toBeVisible();
  885  | 	await faulted.page.reload();
  886  | 	await expect(
  887  | 		faulted.page.getByRole("heading", { name: "Проекты" }),
  888  | 	).toBeVisible();
  889  | 	await expect(faulted.page.getByRole("status")).toHaveCount(0);
  890  | 	await faulted.context.close();
  891  | });
  892  | 
  893  | test("PROJECT-E2E-01: an immediate double submit cannot create a second local Project", async ({
  894  | 	page: _page,
  895  | }, testInfo) => {
  896  | 	const session = await openPersistentPhone(testInfo, "single-publication");
  897  | 	await session.page.goto("/");
  898  | 	await startNewProject(session.page);
  899  | 	await session.page.getByLabel("Название проекта").fill("Одна публикация");
  900  | 	await session.page
  901  | 		.getByRole("button", { name: "Создать проект" })
  902  | 		.evaluate((button) => {
  903  | 			(button as HTMLButtonElement).click();
  904  | 			(button as HTMLButtonElement).click();
  905  | 		});
  906  | 
  907  | 	await expect(
  908  | 		session.page.getByTestId("project-durability-status"),
  909  | 	).toContainText("Сохранено локально");
  910  | 	const recordCounts = await session.page.evaluate(
  911  | 		() =>
  912  | 			new Promise<number>((resolve, reject) => {
  913  | 				const request = window.indexedDB.open("interiors-editor-projects");
  914  | 				request.onerror = () => reject(request.error);
  915  | 				request.onsuccess = () => {
  916  | 					const database = request.result;
  917  | 					const transaction = database.transaction(
  918  | 						["projects", "revisions"],
  919  | 						"readonly",
  920  | 					);
  921  | 					const projects = transaction.objectStore("projects").count();
  922  | 					const revisions = transaction.objectStore("revisions").count();
  923  | 					transaction.oncomplete = () => {
  924  | 						resolve(projects.result * 100 + revisions.result);
  925  | 						database.close();
  926  | 					};
  927  | 				};
  928  | 			}),
  929  | 	);
  930  | 	expect(recordCounts).toBe(101);
  931  | 	await session.context.close();
  932  | });
  933  | 
  934  | test("PROJECT-E2E-01H: cold start keeps empty and sole local Projects behind explicit hub choices", async ({
  935  | 	page: _page,
  936  | }, testInfo) => {
  937  | 	const session = await openPersistentPhone(
  938  | 		testInfo,
  939  | 		"projects-first-cold-open",
  940  | 	);
  941  | 	await session.page.goto("/");
  942  | 
  943  | 	await expect(
  944  | 		session.page.getByRole("heading", { name: "Проекты" }),
  945  | 	).toBeVisible();
  946  | 	await expect(
  947  | 		session.page.getByTestId("project-directory-empty"),
> 948  | 	).toContainText("Пока нет проектов");
       |    ^ Error: expect(locator).toContainText(expected) failed
  949  | 	await expect(session.page.getByLabel("Название проекта")).toHaveCount(0);
  950  | 
  951  | 	await session.page.getByRole("button", { name: "Новый проект" }).click();
  952  | 	await expect(
  953  | 		session.page.getByRole("heading", { name: "Новый проект" }),
  954  | 	).toBeVisible();
  955  | 	await session.page
  956  | 		.getByRole("button", { name: "Вернуться к проектам" })
  957  | 		.click();
  958  | 	await expect(
  959  | 		session.page.getByRole("heading", { name: "Проекты" }),
  960  | 	).toBeVisible();
  961  | 
  962  | 	await session.page.getByRole("button", { name: "Новый проект" }).click();
  963  | 	await session.page.getByLabel("Название проекта").fill("Единственный план");
  964  | 	await session.page.getByRole("button", { name: "Создать проект" }).click();
  965  | 	await expect(session.page.getByTestId("editor-workspace")).toBeVisible();
  966  | 
  967  | 	await session.page.reload();
  968  | 	await expect(
  969  | 		session.page.getByRole("heading", { name: "Проекты" }),
  970  | 	).toBeVisible();
  971  | 	await expect(
  972  | 		session.page.getByRole("button", { name: "Открыть Единственный план" }),
  973  | 	).toBeVisible();
  974  | 	await expect(session.page.getByTestId("editor-workspace")).toHaveCount(0);
  975  | 
  976  | 	await session.page
  977  | 		.getByRole("button", { name: "Открыть Единственный план" })
  978  | 		.click();
  979  | 	await expect(session.page.getByTestId("editor-workspace")).toBeVisible();
  980  | 	await session.context.close();
  981  | });
  982  | 
  983  | test("PROJECT-E2E-01I: calm project cards open by name and remain usable on a narrow phone with enlarged text", async ({
  984  | 	page: _page,
  985  | }, testInfo) => {
  986  | 	const session = await openPersistentPhone(testInfo, "calm-project-cards");
  987  | 	await session.page.setViewportSize({ width: 360, height: 740 });
  988  | 	await session.page.goto("/");
  989  | 	const hub = session.page.getByTestId("project-hub");
  990  | 	await expect(hub).toBeVisible();
  991  | 	const surfaces = await hub.evaluate((element) =>
  992  | 		[element, element.parentElement].map((surface) => {
  993  | 			if (!surface) throw new Error("Expected the Projects surface");
  994  | 			const style = getComputedStyle(surface);
  995  | 			return [style.backgroundImage, style.backdropFilter];
  996  | 		}),
  997  | 	);
  998  | 	expect(surfaces).toEqual([
  999  | 		["none", "none"],
  1000 | 		["none", "none"],
  1001 | 	]);
  1002 | 	await expect(hub.getByRole("button", { name: "Новый проект" })).toHaveCSS(
  1003 | 		"background-color",
  1004 | 		"rgb(25, 118, 185)",
  1005 | 	);
  1006 | 	await session.page.screenshot({
  1007 | 		path: testInfo.outputPath("projects-empty.png"),
  1008 | 		scale: "css",
  1009 | 	});
  1010 | 	await hub.getByRole("button", { name: "Новый проект" }).click();
  1011 | 	const back = session.page.getByRole("button", {
  1012 | 		name: "Вернуться к проектам",
  1013 | 	});
  1014 | 	expect((await back.boundingBox())?.height).toBeGreaterThanOrEqual(44);
  1015 | 	const projectName = "Квартира · кухня и гостиная после перепланировки";
  1016 | 	await session.page.getByLabel("Название проекта").fill(projectName);
  1017 | 	await session.page.screenshot({
  1018 | 		path: testInfo.outputPath("project-create.png"),
  1019 | 		scale: "css",
  1020 | 	});
  1021 | 	await session.page.getByRole("button", { name: "Создать проект" }).click();
  1022 | 	await expect(session.page.getByTestId("editor-workspace")).toBeVisible();
  1023 | 	await session.page.reload();
  1024 | 	const open = hub.getByRole("button", {
  1025 | 		name: `Открыть ${projectName}`,
  1026 | 		exact: true,
  1027 | 	});
  1028 | 	await expect(open.getByText(projectName, { exact: true })).toBeVisible();
  1029 | 	const before = await currentProjectPointers(session.page);
  1030 | 	await openProjectDirectoryActions(session.page, projectName);
  1031 | 	await expect(
  1032 | 		hub.getByRole("button", { name: `Переименовать ${projectName}` }),
  1033 | 	).toBeVisible();
  1034 | 	await expect(session.page.getByTestId("editor-workspace")).toHaveCount(0);
  1035 | 	await openProjectDirectoryActions(session.page, projectName);
  1036 | 	await session.page.screenshot({
  1037 | 		path: testInfo.outputPath("projects-populated.png"),
  1038 | 		scale: "css",
  1039 | 	});
  1040 | 	// Text enlargement must preserve the full title and the independent menu.
  1041 | 	await session.page.evaluate(() => {
  1042 | 		document.documentElement.style.fontSize = "200%";
  1043 | 	});
  1044 | 	await openProjectDirectoryActions(session.page, projectName);
  1045 | 	const title = open.getByText(projectName, { exact: true });
  1046 | 	expect(
  1047 | 		await title.evaluate(
  1048 | 			(element) => element.scrollWidth <= element.clientWidth,
```