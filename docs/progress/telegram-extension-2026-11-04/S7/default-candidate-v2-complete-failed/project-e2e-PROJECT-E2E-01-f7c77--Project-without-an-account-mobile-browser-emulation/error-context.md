# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: project-e2e.spec.ts >> PROJECT-E2E-01: creates, persists and reopens a local Project without an account
- Location: tests/browser/project-e2e.spec.ts:817:1

# Error details

```
Error: expect(locator).toHaveCount(expected) failed

Locator:  getByRole('status')
Expected: 0
Received: 1
Timeout:  5000ms

Call log:
  - Expect "toHaveCount" with timeout 5000ms
  - waiting for getByRole('status')
    14 × locator resolved to 1 element
       - unexpected value "1"

```

# Page snapshot

```yaml
- main [ref=f1e3]:
  - region [ref=f1e4]:
    - generic [ref=f1e5]:
      - heading "Проекты" [active] [level=1] [ref=f1e6]
      - paragraph [ref=f1e7]: Планы на этом устройстве
    - generic [ref=f1e8]:
      - button "Новый проект" [ref=f1e9] [cursor=pointer]
      - button "Импортировать проект" [ref=f1e10]
      - button "Импортировать проект" [ref=f1e11] [cursor=pointer]
      - button "Импорт файла для переноса" [ref=f1e12] [cursor=pointer]
    - button "Восстановить несохранённую правку" [ref=f1e13] [cursor=pointer]
    - region "Локальные хранилища" [ref=f1e14]:
      - status [ref=f1e15]: Хранилище для переноса сейчас не создано. История прежних данных неизвестна. Явный импорт создаст текущую область после проверки файла.
      - group [ref=f1e16]:
        - generic "Старая версия не видит перенесённые проекты" [ref=f1e17]
    - region "Пустой список проектов" [ref=f1e18]:
      - strong [ref=f1e20]: В обычном хранилище пока нет проектов
```

# Test source

```ts
  789 | 		scene: 0,
  790 | 		scenes: [{ nodes: [0] }],
  791 | 	};
  792 | 	const json = new TextEncoder().encode(JSON.stringify(document));
  793 | 	const jsonLength = Math.ceil(json.byteLength / 4) * 4;
  794 | 	const totalLength = 12 + 8 + jsonLength + 8 + positions.byteLength;
  795 | 	const bytes = new Uint8Array(totalLength);
  796 | 	const view = new DataView(bytes.buffer);
  797 | 	view.setUint32(0, 0x46546c67, true);
  798 | 	view.setUint32(4, 2, true);
  799 | 	view.setUint32(8, totalLength, true);
  800 | 	view.setUint32(12, jsonLength, true);
  801 | 	view.setUint32(16, 0x4e4f534a, true);
  802 | 	bytes.set(json, 20);
  803 | 	bytes.fill(0x20, 20 + json.byteLength, 20 + jsonLength);
  804 | 	const binaryOffset = 20 + jsonLength;
  805 | 	view.setUint32(binaryOffset, positions.byteLength, true);
  806 | 	view.setUint32(binaryOffset + 4, 0x004e4942, true);
  807 | 	bytes.set(new Uint8Array(positions.buffer), binaryOffset + 8);
  808 | 	return bytes;
  809 | }
  810 | 
  811 | function alternateCentimetreSketchfabGlb(): Uint8Array {
  812 | 	const bytes = centimetreSketchfabGlb();
  813 | 	new DataView(bytes.buffer).setFloat32(bytes.byteLength - 4, 1.25, true);
  814 | 	return bytes;
  815 | }
  816 | 
  817 | test("PROJECT-E2E-01: creates, persists and reopens a local Project without an account", async ({
  818 | 	page: _page,
  819 | }, testInfo) => {
  820 | 	const first = await openPersistentPhone(testInfo, "durable");
  821 | 	const configuredBaseUrl = testInfo.project.use.baseURL;
  822 | 	if (typeof configuredBaseUrl !== "string") {
  823 | 		throw new Error("Expected the browser test project to define baseURL");
  824 | 	}
  825 | 	const localOrigin = new URL(configuredBaseUrl).origin;
  826 | 	const externalRequests: string[] = [];
  827 | 	first.page.on("request", (request) => {
  828 | 		if (new URL(request.url()).origin !== localOrigin) {
  829 | 			externalRequests.push(request.url());
  830 | 		}
  831 | 	});
  832 | 
  833 | 	await first.page.goto("/");
  834 | 	await startNewProject(first.page);
  835 | 	await setTestDelay(first.page, 180);
  836 | 	await submitNewProject(first.page, "  План на телефоне  ");
  837 | 
  838 | 	await expect(first.page.getByRole("status")).toContainText(
  839 | 		"Сохраняем локально",
  840 | 	);
  841 | 	await expect(first.page.getByRole("status")).toContainText("Сохранено");
  842 | 	expect(externalRequests).toEqual([]);
  843 | 	await first.context.close();
  844 | 
  845 | 	const reopened = await openPersistentPhone(testInfo, "durable");
  846 | 	await reopened.page.goto("/");
  847 | 	await openProjectCard(reopened.page, "План на телефоне");
  848 | 	await expect(reopened.page.getByTestId("writer-lease-notice")).toBeVisible();
  849 | 	await reopened.page
  850 | 		.getByRole("button", { name: "Взять редактирование на себя" })
  851 | 		.click();
  852 | 	await reopened.page
  853 | 		.getByRole("button", { name: "Подтвердить перехват" })
  854 | 		.click();
  855 | 	await expect(reopened.page.getByTestId("writer-lease-notice")).toHaveCount(0);
  856 | 	await expect(reopened.page.getByRole("status")).toContainText("Сохранено");
  857 | 	await reopened.context.close();
  858 | 
  859 | 	const blank = await openPersistentPhone(testInfo, "blank");
  860 | 	await blank.page.goto("/");
  861 | 	await startNewProject(blank.page);
  862 | 	await blank.page.getByRole("button", { name: "Создать проект" }).click();
  863 | 	await expect(blank.page.getByRole("alert")).toHaveText(
  864 | 		"Введите название проекта.",
  865 | 	);
  866 | 	await expect(blank.page.getByRole("status")).toHaveCount(0);
  867 | 	expect(await durableRevisionCount(blank.page)).toBe(0);
  868 | 	await blank.context.close();
  869 | 
  870 | 	const faulted = await openPersistentPhone(testInfo, "fault");
  871 | 	await faulted.page.goto("/");
  872 | 	await startNewProject(faulted.page);
  873 | 	await setTestFault(faulted.page, "before-pointer");
  874 | 	await submitNewProject(faulted.page, "Не должен сохраниться");
  875 | 	await expect(faulted.page.getByRole("status")).toContainText("Не сохранено");
  876 | 	await expect(
  877 | 		faulted.page.getByTestId("project-creation-failure"),
  878 | 	).toContainText("Не удалось создать проект");
  879 | 	await expect(
  880 | 		faulted.page.getByRole("button", { name: "Скачать сохранённую версию" }),
  881 | 	).toHaveCount(0);
  882 | 	await expect(
  883 | 		faulted.page.getByRole("button", { name: "Повторить сохранение" }),
  884 | 	).toBeVisible();
  885 | 	await faulted.page.reload();
  886 | 	await expect(
  887 | 		faulted.page.getByRole("heading", { name: "Проекты" }),
  888 | 	).toBeVisible();
> 889 | 	await expect(faulted.page.getByRole("status")).toHaveCount(0);
      |                                                 ^ Error: expect(locator).toHaveCount(expected) failed
  890 | 	await faulted.context.close();
  891 | });
  892 | 
  893 | test("PROJECT-E2E-01: an immediate double submit cannot create a second local Project", async ({
  894 | 	page: _page,
  895 | }, testInfo) => {
  896 | 	const session = await openPersistentPhone(testInfo, "single-publication");
  897 | 	await session.page.goto("/");
  898 | 	await startNewProject(session.page);
  899 | 	await session.page.getByLabel("Название проекта").fill("Одна публикация");
  900 | 	await session.page
  901 | 		.getByRole("button", { name: "Создать проект" })
  902 | 		.evaluate((button) => {
  903 | 			(button as HTMLButtonElement).click();
  904 | 			(button as HTMLButtonElement).click();
  905 | 		});
  906 | 
  907 | 	await expect(
  908 | 		session.page.getByTestId("project-durability-status"),
  909 | 	).toContainText("Сохранено локально");
  910 | 	const recordCounts = await session.page.evaluate(
  911 | 		() =>
  912 | 			new Promise<number>((resolve, reject) => {
  913 | 				const request = window.indexedDB.open("interiors-editor-projects");
  914 | 				request.onerror = () => reject(request.error);
  915 | 				request.onsuccess = () => {
  916 | 					const database = request.result;
  917 | 					const transaction = database.transaction(
  918 | 						["projects", "revisions"],
  919 | 						"readonly",
  920 | 					);
  921 | 					const projects = transaction.objectStore("projects").count();
  922 | 					const revisions = transaction.objectStore("revisions").count();
  923 | 					transaction.oncomplete = () => {
  924 | 						resolve(projects.result * 100 + revisions.result);
  925 | 						database.close();
  926 | 					};
  927 | 				};
  928 | 			}),
  929 | 	);
  930 | 	expect(recordCounts).toBe(101);
  931 | 	await session.context.close();
  932 | });
  933 | 
  934 | test("PROJECT-E2E-01H: cold start keeps empty and sole local Projects behind explicit hub choices", async ({
  935 | 	page: _page,
  936 | }, testInfo) => {
  937 | 	const session = await openPersistentPhone(
  938 | 		testInfo,
  939 | 		"projects-first-cold-open",
  940 | 	);
  941 | 	await session.page.goto("/");
  942 | 
  943 | 	await expect(
  944 | 		session.page.getByRole("heading", { name: "Проекты" }),
  945 | 	).toBeVisible();
  946 | 	await expect(
  947 | 		session.page.getByTestId("project-directory-empty"),
  948 | 	).toContainText("Пока нет проектов");
  949 | 	await expect(session.page.getByLabel("Название проекта")).toHaveCount(0);
  950 | 
  951 | 	await session.page.getByRole("button", { name: "Новый проект" }).click();
  952 | 	await expect(
  953 | 		session.page.getByRole("heading", { name: "Новый проект" }),
  954 | 	).toBeVisible();
  955 | 	await session.page
  956 | 		.getByRole("button", { name: "Вернуться к проектам" })
  957 | 		.click();
  958 | 	await expect(
  959 | 		session.page.getByRole("heading", { name: "Проекты" }),
  960 | 	).toBeVisible();
  961 | 
  962 | 	await session.page.getByRole("button", { name: "Новый проект" }).click();
  963 | 	await session.page.getByLabel("Название проекта").fill("Единственный план");
  964 | 	await session.page.getByRole("button", { name: "Создать проект" }).click();
  965 | 	await expect(session.page.getByTestId("editor-workspace")).toBeVisible();
  966 | 
  967 | 	await session.page.reload();
  968 | 	await expect(
  969 | 		session.page.getByRole("heading", { name: "Проекты" }),
  970 | 	).toBeVisible();
  971 | 	await expect(
  972 | 		session.page.getByRole("button", { name: "Открыть Единственный план" }),
  973 | 	).toBeVisible();
  974 | 	await expect(session.page.getByTestId("editor-workspace")).toHaveCount(0);
  975 | 
  976 | 	await session.page
  977 | 		.getByRole("button", { name: "Открыть Единственный план" })
  978 | 		.click();
  979 | 	await expect(session.page.getByTestId("editor-workspace")).toBeVisible();
  980 | 	await session.context.close();
  981 | });
  982 | 
  983 | test("PROJECT-E2E-01I: calm project cards open by name and remain usable on a narrow phone with enlarged text", async ({
  984 | 	page: _page,
  985 | }, testInfo) => {
  986 | 	const session = await openPersistentPhone(testInfo, "calm-project-cards");
  987 | 	await session.page.setViewportSize({ width: 360, height: 740 });
  988 | 	await session.page.goto("/");
  989 | 	const hub = session.page.getByTestId("project-hub");
```