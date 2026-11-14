# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: project-e2e.spec.ts >> PROJECT-E2E-01: a dangling current pointer is recovery-needed and cannot become a new Project
- Location: tests/browser/project-e2e.spec.ts:3462:1

# Error details

```
Error: expect(locator).toContainText(expected) failed

Locator: getByRole('status')
Expected substring: "Нужно восстановление"
Error: strict mode violation: getByRole('status') resolved to 6 elements:
    1) <p role="status">Хранилище для переноса сейчас не создано. История…</p> aka getByLabel('Исходные записи для восстановления').getByText('Хранилище для переноса сейчас не создано. История прежних данных неизвестна. Явн')
    2) <p role="status">Часть записей не прошла проверку. Их исходные дан…</p> aka getByText('Часть записей не прошла проверку. Их исходные данные можно подготовить отдельно')
    3) <p role="status">Покажите записи, чтобы выбрать исходные данные дл…</p> aka getByLabel('Непроверенные исходники: На этом устройстве · обычное хранилище').getByText('Покажите записи, чтобы выбрать исходные данные для отдельного файла')
    4) <p role="status">Покажите записи, чтобы выбрать исходные данные дл…</p> aka getByLabel('Непроверенные исходники: На этом устройстве · хранилище для переноса').getByText('Покажите записи, чтобы выбрать исходные данные для отдельного файла')
    5) <div role="status">…</div> aka getByText('Часть проектов сейчас недоступнаНа этом устройстве · обычное хранилище — требует')
    6) <p role="status">Хранилище для переноса сейчас не создано. История…</p> aka getByTestId('project-hub').getByText('Хранилище для переноса сейчас не создано. История прежних данных неизвестна. Явн')

Call log:
  - Expect "toContainText" with timeout 5000ms
  - waiting for getByRole('status')

```

# Page snapshot

```yaml
- main [ref=f1e3]:
  - region [ref=f1e4]:
    - generic [ref=f1e5]:
      - generic [ref=f1e6]:
        - paragraph [ref=f1e7]: Локальные данные
        - heading "Исходные записи для восстановления" [level=2] [ref=f1e8]
        - paragraph [ref=f1e9]: Непроверенные записи можно выгрузить отдельно. Доступные проекты остаются в обычном списке; исходник не является полным архивом.
      - button "Обновить список" [ref=f1e10] [cursor=pointer]
      - region "Локальные хранилища" [ref=f1e11]:
        - status [ref=f1e12]: Хранилище для переноса сейчас не создано. История прежних данных неизвестна. Явный импорт создаст текущую область после проверки файла.
        - group [ref=f1e13]:
          - generic "Старая версия не видит перенесённые проекты" [ref=f1e14] [cursor=pointer]
      - status [ref=f1e15]: Часть записей не прошла проверку. Их исходные данные можно подготовить отдельно.
      - 'region "Непроверенные исходники: На этом устройстве · обычное хранилище" [ref=f1e16]':
        - paragraph [ref=f1e17]: На этом устройстве · обычное хранилище
        - complementary "Непроверенные исходники" [ref=f1e18]:
          - heading "Непроверенные исходники" [level=2] [ref=f1e19]
          - paragraph [ref=f1e20]: Исходные данные записи можно выгрузить отдельно. Это не полный backup и не восстановленный проект.
          - button "Показать записи" [ref=f1e21] [cursor=pointer]
          - status [ref=f1e22]: Покажите записи, чтобы выбрать исходные данные для отдельного файла.
      - 'region "Непроверенные исходники: На этом устройстве · хранилище для переноса" [ref=f1e23]':
        - paragraph [ref=f1e24]: На этом устройстве · хранилище для переноса
        - complementary "Непроверенные исходники" [ref=f1e25]:
          - heading "Непроверенные исходники" [level=2] [ref=f1e26]
          - paragraph [ref=f1e27]: Исходные данные записи можно выгрузить отдельно. Это не полный backup и не восстановленный проект.
          - button "Показать записи" [ref=f1e28] [cursor=pointer]
          - status [ref=f1e29]: Покажите записи, чтобы выбрать исходные данные для отдельного файла.
  - region [ref=f1e30]:
    - generic [ref=f1e31]:
      - heading "Проекты" [active] [level=1] [ref=f1e32]
      - paragraph [ref=f1e33]: Планы на этом устройстве
    - generic [ref=f1e34]:
      - button "Новый проект" [ref=f1e35] [cursor=pointer]
      - button "Импортировать проект" [ref=f1e36]
      - button "Импортировать проект" [ref=f1e37] [cursor=pointer]
      - button "Импорт файла для переноса" [ref=f1e38] [cursor=pointer]
    - button "Восстановить несохранённую правку" [ref=f1e39] [cursor=pointer]
    - alert [ref=f1e40]: Один из локальных проектов требует восстановления. Остальные доступны.
    - region "Локальные хранилища" [ref=f1e41]:
      - status [ref=f1e42]:
        - paragraph [ref=f1e43]: Часть проектов сейчас недоступна
        - list [ref=f1e44]:
          - listitem [ref=f1e45]: На этом устройстве · обычное хранилище — требуется проверка и восстановление
        - button "Повторить проверку локальных хранилищ" [ref=f1e46]: Повторить
      - status [ref=f1e47]: Хранилище для переноса сейчас не создано. История прежних данных неизвестна. Явный импорт создаст текущую область после проверки файла.
      - group [ref=f1e48]:
        - generic "Старая версия не видит перенесённые проекты" [ref=f1e49]
```

# Test source

```ts
  3388 | 	).toHaveText("rendered:1");
  3389 | 	await expect(
  3390 | 		session.page.getByTestId("three-dimensional-renderer-diagnostics"),
  3391 | 	).toContainText("WebGL2");
  3392 | 	await expect(
  3393 | 		session.page.getByText("3D-сцена не инициализировалась."),
  3394 | 	).toHaveCount(0);
  3395 | 	await expect(
  3396 | 		session.page.getByRole("complementary", {
  3397 | 			name: "GLB-модель предмета в 3D",
  3398 | 		}),
  3399 | 	).toHaveCount(0);
  3400 | 	await session.page.unrouteAll({ behavior: "ignoreErrors" });
  3401 | 	await session.context.close();
  3402 | });
  3403 | 
  3404 | test("PROJECT-E2E-02: another editor context stays read-only until it explicitly takes over the writer lease", async ({
  3405 | 	page: _page,
  3406 | }, testInfo) => {
  3407 | 	const session = await openPersistentPhone(testInfo, "writer-lease-takeover");
  3408 | 	await session.page.goto("/");
  3409 | 	await createProject(session.page, "Один автор");
  3410 | 	await expect(session.page.getByRole("status")).toContainText("Сохранено");
  3411 | 
  3412 | 	const secondPage = await session.context.newPage();
  3413 | 	await secondPage.goto("/");
  3414 | 	await openProjectCard(secondPage, "Один автор");
  3415 | 	await expect(secondPage.getByTestId("writer-lease-notice")).toBeVisible();
  3416 | 	await expect(
  3417 | 		secondPage.getByRole("button", { name: "Стена", exact: true }),
  3418 | 	).toBeDisabled();
  3419 | 	await expect(
  3420 | 		secondPage.getByLabel("Ширина, мм", { exact: true }),
  3421 | 	).toBeDisabled();
  3422 | 	await expect(
  3423 | 		secondPage.getByRole("button", { name: "Создать контур" }),
  3424 | 	).toBeDisabled();
  3425 | 
  3426 | 	await secondPage
  3427 | 		.getByRole("button", { name: "Взять редактирование на себя" })
  3428 | 		.click();
  3429 | 	await expect(
  3430 | 		secondPage.getByRole("button", { name: "Подтвердить перехват" }),
  3431 | 	).toBeVisible();
  3432 | 	await secondPage.getByRole("button", { name: "Отмена" }).click();
  3433 | 	await expect(secondPage.getByTestId("writer-lease-notice")).toBeVisible();
  3434 | 	await expect(
  3435 | 		secondPage.getByRole("button", { name: "Стена", exact: true }),
  3436 | 	).toBeDisabled();
  3437 | 	await secondPage
  3438 | 		.getByRole("button", { name: "Взять редактирование на себя" })
  3439 | 		.click();
  3440 | 	await secondPage
  3441 | 		.getByRole("button", { name: "Подтвердить перехват" })
  3442 | 		.click();
  3443 | 	await expect(secondPage.getByTestId("writer-lease-notice")).toHaveCount(0);
  3444 | 	await expect(
  3445 | 		secondPage.getByRole("button", { name: "Стена", exact: true }),
  3446 | 	).toBeEnabled();
  3447 | 	await secondPage.getByRole("button", { name: "Создать контур" }).click();
  3448 | 	await expect(secondPage.getByRole("status")).toContainText("Сохранено");
  3449 | 
  3450 | 	await session.page.bringToFront();
  3451 | 	await session.page.evaluate(() =>
  3452 | 		document.dispatchEvent(new Event("visibilitychange")),
  3453 | 	);
  3454 | 	await expect(session.page.getByTestId("writer-lease-notice")).toBeVisible();
  3455 | 	await expect(session.page.getByTestId("room-face")).toBeVisible();
  3456 | 	await expect(
  3457 | 		session.page.getByRole("button", { name: "Стена", exact: true }),
  3458 | 	).toBeDisabled();
  3459 | 	await session.context.close();
  3460 | });
  3461 | 
  3462 | test("PROJECT-E2E-01: a dangling current pointer is recovery-needed and cannot become a new Project", async ({
  3463 | 	page: _page,
  3464 | }, testInfo) => {
  3465 | 	const session = await openPersistentPhone(testInfo, "dangling-pointer");
  3466 | 	await session.page.goto("/");
  3467 | 	await createProject(session.page, "Не терять");
  3468 | 	await expect(session.page.getByRole("status")).toContainText("Сохранено");
  3469 | 	await session.page.evaluate(
  3470 | 		() =>
  3471 | 			new Promise<void>((resolve, reject) => {
  3472 | 				const request = window.indexedDB.open("interiors-editor-projects");
  3473 | 				request.onerror = () => reject(request.error);
  3474 | 				request.onsuccess = () => {
  3475 | 					const database = request.result;
  3476 | 					const transaction = database.transaction("revisions", "readwrite");
  3477 | 					transaction.objectStore("revisions").clear();
  3478 | 					transaction.oncomplete = () => {
  3479 | 						database.close();
  3480 | 						resolve();
  3481 | 					};
  3482 | 					transaction.onerror = () => reject(transaction.error);
  3483 | 				};
  3484 | 			}),
  3485 | 	);
  3486 | 
  3487 | 	await session.page.reload();
> 3488 | 	await expect(session.page.getByRole("status")).toContainText(
       |                                                 ^ Error: expect(locator).toContainText(expected) failed
  3489 | 		"Нужно восстановление",
  3490 | 	);
  3491 | 	await expect(session.page.getByLabel("Название проекта")).toHaveCount(0);
  3492 | 	await expect(session.page.getByTestId("first-run-help")).toHaveCount(0);
  3493 | 	await expect(
  3494 | 		session.page.getByRole("button", { name: "Создать проект", exact: true }),
  3495 | 	).toHaveCount(0);
  3496 | 	await expect(
  3497 | 		session.page.getByRole("button", {
  3498 | 			name: "Восстановить исходные GLB",
  3499 | 			exact: true,
  3500 | 		}),
  3501 | 	).toHaveCount(0);
  3502 | 	const recovery = session.page.getByTestId("project-recovery-screen");
  3503 | 	await expect(recovery).toContainText(
  3504 | 		"Не удалось проверить сохранённую версию",
  3505 | 	);
  3506 | 	await session.page.setViewportSize({ width: 360, height: 640 });
  3507 | 	await session.page.evaluate(() => {
  3508 | 		document.documentElement.style.fontSize = "200%";
  3509 | 	});
  3510 | 	for (const button of await recovery.getByRole("button").all()) {
  3511 | 		await button.scrollIntoViewIfNeeded();
  3512 | 		const box = await button.boundingBox();
  3513 | 		expect(box?.height).toBeGreaterThanOrEqual(44);
  3514 | 		expect((box?.x ?? 0) + (box?.width ?? 0)).toBeLessThanOrEqual(360);
  3515 | 	}
  3516 | 	await recovery
  3517 | 		.getByRole("button", { name: "Повторить проверку", exact: true })
  3518 | 		.click();
  3519 | 	await expect(recovery).toBeVisible();
  3520 | 	await expect(currentProjectPointers(session.page)).resolves.toHaveLength(1);
  3521 | 	await session.page.evaluate(() => {
  3522 | 		document.documentElement.style.fontSize = "";
  3523 | 	});
  3524 | 	await session.page.screenshot({
  3525 | 		path: testInfo.outputPath("safety-project-recovery.png"),
  3526 | 		scale: "css",
  3527 | 	});
  3528 | 	await session.context.close();
  3529 | });
  3530 | 
  3531 | test("SAFETY-E2E-01: a failed save keeps its explanation, durable backup and retry together without losing the pending change", async ({
  3532 | 	page: _page,
  3533 | }, testInfo) => {
  3534 | 	const session = await openPersistentPhone(testInfo, "calm-save-failure");
  3535 | 	await session.page.setViewportSize({ width: 393, height: 852 });
  3536 | 	await session.page.goto("/");
  3537 | 	await createProject(session.page, "Сохранённая планировка");
  3538 | 	await session.page.getByRole("button", { name: "Создать контур" }).click();
  3539 | 	const before = await currentProjectRevisionId(session.page);
  3540 | 	await session.page
  3541 | 		.getByRole("button", { name: "Рука и выбор", exact: true })
  3542 | 		.click();
  3543 | 	await session.page.getByTestId("wall-segment").first().click();
  3544 | 	await session.page
  3545 | 		.getByTestId("editor-action-dock")
  3546 | 		.getByRole("button", { name: "Свойства", exact: true })
  3547 | 		.click();
  3548 | 	await session.page
  3549 | 		.getByTestId("selected-wall-inspector")
  3550 | 		.getByRole("button", { name: "Удалить стену", exact: true })
  3551 | 		.click();
  3552 | 	await setTestFault(session.page, "before-pointer-quota");
  3553 | 	await session.page
  3554 | 		.getByTestId("opening-conflict-preview")
  3555 | 		.getByRole("button", { name: /^Удалить стену/ })
  3556 | 		.click();
  3557 | 	const notice = session.page.getByTestId("persistence-failure-notice");
  3558 | 	await expect(notice).toBeVisible();
  3559 | 	await expect(notice).toContainText("Не удалось сохранить");
  3560 | 	await expect(notice).toContainText("недостаточно места");
  3561 | 	await expect(notice).toContainText(
  3562 | 		"Несохранённую правку можно скачать отдельным файлом",
  3563 | 	);
  3564 | 	await expect(notice).toHaveCSS("background-color", "rgb(255, 255, 255)");
  3565 | 	await expect(notice).toHaveCSS("border-radius", "24px");
  3566 | 	await expect(
  3567 | 		session.page.getByRole("button", {
  3568 | 			name: "Повторить сохранение",
  3569 | 			exact: true,
  3570 | 		}),
  3571 | 	).toHaveCount(1);
  3572 | 	const retry = notice.getByRole("button", {
  3573 | 		name: "Повторить сохранение",
  3574 | 		exact: true,
  3575 | 	});
  3576 | 	await expect(retry).toBeFocused();
  3577 | 	await expect(session.page.getByTestId("wall-segment")).toHaveCount(4);
  3578 | 	expect(await currentProjectRevisionId(session.page)).toBe(before);
  3579 | 	await session.page.screenshot({
  3580 | 		path: testInfo.outputPath("safety-save-failure.png"),
  3581 | 		scale: "css",
  3582 | 	});
  3583 | 	await session.page.setViewportSize({ width: 360, height: 640 });
  3584 | 	await session.page.evaluate(() => {
  3585 | 		document.documentElement.style.fontSize = "200%";
  3586 | 	});
  3587 | 	for (const button of await notice.getByRole("button").all()) {
  3588 | 		await button.scrollIntoViewIfNeeded();
```