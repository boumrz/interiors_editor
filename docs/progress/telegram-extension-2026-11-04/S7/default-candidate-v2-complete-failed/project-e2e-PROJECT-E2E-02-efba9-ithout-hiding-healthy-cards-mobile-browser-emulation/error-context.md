# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: project-e2e.spec.ts >> PROJECT-E2E-02: a dangling pointer announces recovery without hiding healthy cards
- Location: tests/browser/project-e2e.spec.ts:1634:1

# Error details

```
Error: expect(locator).toBeVisible() failed

Locator: getByRole('heading', { name: 'Проекты' })
Expected: visible
Timeout: 5000ms
Error: element(s) not found

Call log:
  - Expect "toBeVisible" with timeout 5000ms
  - waiting for getByRole('heading', { name: 'Проекты' })

```

```yaml
- main "Просмотр проектов":
  - paragraph: Локальные данные
  - heading "Просмотр проектов" [level=1]
  - paragraph: Редактирование пока недоступно. Проверенные проекты можно выгрузить полным архивом или подготовить для переноса. Непроверенные исходные записи доступны отдельно.
  - button "Обновить список"
  - region "Локальные хранилища":
    - status: Хранилище для переноса сейчас не создано. История прежних данных неизвестна. Явный импорт создаст текущую область после проверки файла.
    - group: Старая версия не видит перенесённые проекты
  - status: Часть записей не прошла проверку. Их исходные данные можно подготовить отдельно.
  - region "Проверенные записи":
    - list:
      - listitem:
        - paragraph: На этом устройстве · обычное хранилище
        - heading "Здоровый план B" [level=2]
        - 'button "Подготовить полный архив: Здоровый план B"': Подготовить полный архив
        - 'button "Подготовить файл для переноса: Здоровый план B"': Подготовить файл для переноса
      - listitem:
        - paragraph: На этом устройстве · обычное хранилище
        - heading "Здоровый план A" [level=2]
        - 'button "Подготовить полный архив: Здоровый план A"': Подготовить полный архив
        - 'button "Подготовить файл для переноса: Здоровый план A"': Подготовить файл для переноса
  - 'region "Непроверенные исходники: На этом устройстве · обычное хранилище"':
    - paragraph: На этом устройстве · обычное хранилище
    - complementary "Непроверенные исходники":
      - heading "Непроверенные исходники" [level=2]
      - paragraph: Исходные данные записи можно выгрузить отдельно. Это не полный backup и не восстановленный проект.
      - button "Показать записи"
      - status: Покажите записи, чтобы выбрать исходные данные для отдельного файла.
  - 'region "Непроверенные исходники: На этом устройстве · хранилище для переноса"':
    - paragraph: На этом устройстве · хранилище для переноса
    - complementary "Непроверенные исходники":
      - heading "Непроверенные исходники" [level=2]
      - paragraph: Исходные данные записи можно выгрузить отдельно. Это не полный backup и не восстановленный проект.
      - button "Показать записи"
      - status: Покажите записи, чтобы выбрать исходные данные для отдельного файла.
```

# Test source

```ts
  1551 | 		"Кухня 2",
  1552 | 	);
  1553 | 	await expect(
  1554 | 		session.page.getByRole("button", { name: "Сохранить название" }),
  1555 | 	).toBeDisabled();
  1556 | 	await expect
  1557 | 		.poll(
  1558 | 			async () =>
  1559 | 				(await currentProjectPointers(session.page)).find(
  1560 | 					(pointer) => pointer.projectId === secondProjectId,
  1561 | 				)?.name,
  1562 | 		)
  1563 | 		.toBe("Кухня");
  1564 | 	await session.page
  1565 | 		.getByRole("dialog", { name: "Переименовать проект" })
  1566 | 		.getByRole("button", { name: "Повторить сохранение" })
  1567 | 		.click();
  1568 | 	await expect(
  1569 | 		session.page.getByTestId("editor-top-bar").getByRole("status"),
  1570 | 	).toContainText("Сохранено");
  1571 | 	await expect(
  1572 | 		session.page.getByRole("dialog", { name: "Переименовать проект" }),
  1573 | 	).toHaveCount(0);
  1574 | 	await openProjectDirectory(session.page);
  1575 | 	await expect(
  1576 | 		session.page.getByRole("button", { name: "Открыть Кухня 2" }),
  1577 | 	).toBeVisible();
  1578 | 	await expect(
  1579 | 		session.page.getByRole("button", { name: "Открыть Первый план" }),
  1580 | 	).toBeVisible();
  1581 | 	await session.page.reload();
  1582 | 	await expect(
  1583 | 		session.page.getByRole("heading", { name: "Проекты" }),
  1584 | 	).toBeVisible();
  1585 | 	await expect(
  1586 | 		session.page.getByRole("button", { name: "Открыть Кухня 2" }),
  1587 | 	).toBeVisible();
  1588 | 	await expect(
  1589 | 		session.page.getByRole("button", { name: "Открыть Первый план" }),
  1590 | 	).toBeVisible();
  1591 | 	const reopenedPointers = await currentProjectPointers(session.page);
  1592 | 	expect(reopenedPointers).toContainEqual(
  1593 | 		expect.objectContaining({
  1594 | 			name: "Кухня 2",
  1595 | 			projectId: secondProjectId,
  1596 | 		}),
  1597 | 	);
  1598 | 	expect(reopenedPointers).toContainEqual(
  1599 | 		expect.objectContaining({
  1600 | 			name: "Первый план",
  1601 | 			projectId: firstProjectId,
  1602 | 		}),
  1603 | 	);
  1604 | 	await session.context.close();
  1605 | });
  1606 | 
  1607 | test("PROJECT-E2E-02: return and invalid rename move focus to their accessible targets", async ({
  1608 | 	page: _page,
  1609 | }, testInfo) => {
  1610 | 	const session = await openPersistentPhone(
  1611 | 		testInfo,
  1612 | 		"project-directory-focus",
  1613 | 	);
  1614 | 	await session.page.goto("/");
  1615 | 	await createProject(session.page, "План для фокуса");
  1616 | 
  1617 | 	await openProjectDirectory(session.page);
  1618 | 	await expect(
  1619 | 		session.page.getByRole("heading", { name: "Проекты" }),
  1620 | 	).toBeFocused();
  1621 | 	await openProjectDirectoryActions(session.page, "План для фокуса");
  1622 | 	await session.page
  1623 | 		.getByRole("button", { name: "Переименовать План для фокуса" })
  1624 | 		.click();
  1625 | 	await expect(session.page.getByLabel("Новое название проекта")).toBeFocused();
  1626 | 	await session.page.getByLabel("Новое название проекта").fill(" \t");
  1627 | 	await session.page
  1628 | 		.getByRole("button", { name: "Сохранить название" })
  1629 | 		.click();
  1630 | 	await expect(session.page.locator("#rename-project-error")).toBeFocused();
  1631 | 	await session.context.close();
  1632 | });
  1633 | 
  1634 | test("PROJECT-E2E-02: a dangling pointer announces recovery without hiding healthy cards", async ({
  1635 | 	page: _page,
  1636 | }, testInfo) => {
  1637 | 	const session = await openPersistentPhone(
  1638 | 		testInfo,
  1639 | 		"project-directory-corruption",
  1640 | 	);
  1641 | 	await session.page.goto("/");
  1642 | 	await createProject(session.page, "Здоровый план A");
  1643 | 	await openProjectDirectory(session.page);
  1644 | 	await createProject(session.page, "Здоровый план B");
  1645 | 
  1646 | 	await seedDanglingProjectPointer(session.page);
  1647 | 	await session.page.reload();
  1648 | 
  1649 | 	await expect(
  1650 | 		session.page.getByRole("heading", { name: "Проекты" }),
> 1651 | 	).toBeVisible();
       |    ^ Error: expect(locator).toBeVisible() failed
  1652 | 	await expect(session.page.getByRole("alert")).toContainText(
  1653 | 		"требует восстановления",
  1654 | 	);
  1655 | 	await expect(
  1656 | 		session.page.getByRole("button", { name: "Открыть Здоровый план A" }),
  1657 | 	).toBeVisible();
  1658 | 	await expect(
  1659 | 		session.page.getByRole("button", { name: "Открыть Здоровый план B" }),
  1660 | 	).toBeVisible();
  1661 | 	await session.context.close();
  1662 | });
  1663 | 
  1664 | test("PROJECT-E2E-03: JSON transfer always imports a separate local Project", async ({
  1665 | 	page: _page,
  1666 | }, testInfo) => {
  1667 | 	const session = await openPersistentPhone(testInfo, "json-transfer");
  1668 | 	await session.page.goto("/");
  1669 | 	await createProject(session.page, "План для передачи");
  1670 | 	await expect(session.page.getByRole("status")).toContainText("Сохранено");
  1671 | 
  1672 | 	await openProjectDirectory(session.page);
  1673 | 	await openProjectDirectoryActions(session.page, "План для передачи");
  1674 | 	const exportDownload = await Promise.all([
  1675 | 		session.page.waitForEvent("download"),
  1676 | 		session.page
  1677 | 			.getByRole("button", { name: "Экспортировать проект План для передачи" })
  1678 | 			.click(),
  1679 | 	]).then(([download]) => download);
  1680 | 	const transferPath = await exportDownload.path();
  1681 | 	if (!transferPath) {
  1682 | 		throw new Error("Expected exported JSON download file");
  1683 | 	}
  1684 | 	await session.page
  1685 | 		.getByLabel("Импортировать проект")
  1686 | 		.setInputFiles(transferPath);
  1687 | 	await expect(session.page.getByTestId("editor-workspace")).toBeVisible();
  1688 | 	await expect(session.page.getByRole("status")).toContainText("Сохранено");
  1689 | 
  1690 | 	await openProjectDirectory(session.page);
  1691 | 	await expect(
  1692 | 		session.page.getByRole("button", { name: "Открыть План для передачи" }),
  1693 | 	).toHaveCount(2);
  1694 | 	await session.context.close();
  1695 | });
  1696 | 
  1697 | test("PROJECT-E2E-03C: a resource-free project uses the same self-contained Portable Backup route offline", async ({
  1698 | 	page: _page,
  1699 | }, testInfo) => {
  1700 | 	const session = await openPersistentPhone(
  1701 | 		testInfo,
  1702 | 		"portable-backup-transfer",
  1703 | 	);
  1704 | 	await session.page.goto("/");
  1705 | 	await createProject(session.page, "Бэкап для передачи");
  1706 | 	await expect(
  1707 | 		session.page.getByTestId("editor-top-bar").getByRole("status"),
  1708 | 	).toContainText("Сохранено");
  1709 | 
  1710 | 	await openProjectDirectory(session.page);
  1711 | 	await openProjectDirectoryActions(session.page, "Бэкап для передачи");
  1712 | 	await session.context.setOffline(true);
  1713 | 	const download = await Promise.all([
  1714 | 		session.page.waitForEvent("download"),
  1715 | 		session.page
  1716 | 			.getByRole("button", {
  1717 | 				name: "Экспортировать проект Бэкап для передачи",
  1718 | 			})
  1719 | 			.click(),
  1720 | 	]).then(([nextDownload]) => nextDownload);
  1721 | 	expect(download.suggestedFilename()).toBe("Бэкап-для-передачи.interiors");
  1722 | 	const transferPath = await download.path();
  1723 | 	if (!transferPath) {
  1724 | 		throw new Error("Expected exported Portable Backup file");
  1725 | 	}
  1726 | 	await session.page.evaluate(() => {
  1727 | 		const subtle = window.crypto.subtle;
  1728 | 		const originalDigest = subtle.digest.bind(subtle);
  1729 | 		Object.defineProperty(subtle, "digest", {
  1730 | 			configurable: true,
  1731 | 			value: async (...arguments_: Parameters<SubtleCrypto["digest"]>) => {
  1732 | 				await new Promise((resolve) => window.setTimeout(resolve, 300));
  1733 | 				return originalDigest(...arguments_);
  1734 | 			},
  1735 | 		});
  1736 | 	});
  1737 | 
  1738 | 	await session.page
  1739 | 		.getByLabel("Импортировать проект")
  1740 | 		.setInputFiles(transferPath);
  1741 | 	const importStatus = session.page.getByTestId(
  1742 | 		"project-transfer-import-status",
  1743 | 	);
  1744 | 	await expect(importStatus).toContainText("Проверяем контейнер");
  1745 | 	await expect(
  1746 | 		importStatus.getByRole("progressbar", { name: "Прогресс импорта проекта" }),
  1747 | 	).toBeVisible();
  1748 | 	await expect(session.page.getByTestId("editor-workspace")).toBeVisible();
  1749 | 	await expect(
  1750 | 		session.page.getByTestId("editor-top-bar").getByRole("status"),
  1751 | 	).toContainText("Сохранено");
```