# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: editor-workspace-e2e.spec.ts >> PLAN-E2E-04AC: New Opening traps focus, blocks the background, and restores its initiator
- Location: tests/browser/editor-workspace-e2e.spec.ts:9722:1

# Error details

```
Error: expect(locator).toBeFocused() failed

Locator:  getByRole('button', { name: 'Добавить проём', exact: true })
Expected: focused
Received: inactive
Timeout:  5000ms

Call log:
  - Expect "toBeFocused" with timeout 5000ms
  - waiting for getByRole('button', { name: 'Добавить проём', exact: true })
    14 × locator resolved to <button type="button" aria-label="Добавить проём" class="@interiors/web-src_ui_AppShell_module_css-dockAction @interiors/web-src_ui_AppShell_module_css-roomDockAction">…</button>
       - unexpected value "inactive"

```

```yaml
- button "Добавить проём"
```

# Test source

```ts
  9697 | 	await draft.getByLabel("Ширина, мм").fill("900");
  9698 | 	await draft.getByLabel("Высота, мм").fill("2100");
  9699 | 	await expect(draft.getByLabel("Отступ от начала, мм")).toHaveCount(0);
  9700 | 	await expect(draft.getByLabel("Порог / нижняя отметка, мм")).toHaveCount(0);
  9701 | 	await draft.getByRole("button", { name: "Добавить", exact: true }).click();
  9702 | 	await expect(session.page.getByTestId("door-opening")).toHaveCount(1);
  9703 | 	await expect
  9704 | 		.poll(() => durableRevisionCount(session.page))
  9705 | 		.toBe(revisionsBeforeDraft + 1);
  9706 | 	await expect
  9707 | 		.poll(() => durableDoorOpenings(session.page))
  9708 | 		.toEqual([
  9709 | 			expect.objectContaining({
  9710 | 				heightMm: 2100,
  9711 | 				offsetMm: 2000,
  9712 | 				sillMm: 0,
  9713 | 				widthMm: 900,
  9714 | 			}),
  9715 | 		]);
  9716 | 	await expect(session.page.getByTestId("door-leaf")).toHaveCount(0);
  9717 | 	await expect(session.page.getByTestId("door-swing")).toHaveCount(0);
  9718 | 	await expect(addOpening).toBeFocused();
  9719 | 	await session.context.close();
  9720 | });
  9721 | 
  9722 | test("PLAN-E2E-04AC: New Opening traps focus, blocks the background, and restores its initiator", async ({
  9723 | 	page: _page,
  9724 | }, testInfo) => {
  9725 | 	const session = await openPersistentPhone(
  9726 | 		testInfo,
  9727 | 		"editor-new-opening-modal-focus",
  9728 | 		{ freshProfile: true },
  9729 | 	);
  9730 | 	await session.page.goto("/");
  9731 | 	await startNewProject(session.page, "Модальный проём");
  9732 | 	await session.page.getByRole("button", { name: "Создать контур" }).click();
  9733 | 	await session.page.getByTestId("wall-segment").first().click();
  9734 | 	const addOpening = session.page.getByRole("button", {
  9735 | 		name: "Добавить проём",
  9736 | 		exact: true,
  9737 | 	});
  9738 | 	const rename = session.page.getByRole("button", {
  9739 | 		name: "Переименовать проект Модальный проём",
  9740 | 	});
  9741 | 	const renameBox = await rename.boundingBox();
  9742 | 	if (!renameBox)
  9743 | 		throw new Error("Expected the project header behind the draft");
  9744 | 	const modalBackgroundsAreInert = () =>
  9745 | 		session.page.locator("#editor-canvas").evaluate((canvas) =>
  9746 | 			Array.from(canvas.children)
  9747 | 				.filter(
  9748 | 					(child) =>
  9749 | 						child.getAttribute("data-testid") !== "opening-creation-draft",
  9750 | 				)
  9751 | 				.every(
  9752 | 					(child) =>
  9753 | 						child.hasAttribute("inert") &&
  9754 | 						child.getAttribute("aria-hidden") === "true",
  9755 | 				),
  9756 | 		);
  9757 | 	const revisionsBeforeDraft = await durableRevisionCount(session.page);
  9758 | 	await addOpening.focus();
  9759 | 	await addOpening.click();
  9760 | 
  9761 | 	const draft = session.page.getByRole("dialog", { name: "Новый проём" });
  9762 | 	const door = draft.getByRole("button", { name: "Дверь", exact: true });
  9763 | 	const add = draft.getByRole("button", { name: "Добавить", exact: true });
  9764 | 	await expect(draft.getByLabel("Ширина, мм")).toBeFocused();
  9765 | 	await expect.poll(modalBackgroundsAreInert).toBe(true);
  9766 | 	await draft.getByLabel("Ширина, мм").fill("950");
  9767 | 	await expect.poll(modalBackgroundsAreInert).toBe(true);
  9768 | 	await add.focus();
  9769 | 	await session.page.keyboard.press("Tab");
  9770 | 	await expect(door).toBeFocused();
  9771 | 	await door.focus();
  9772 | 	await session.page.keyboard.press("Shift+Tab");
  9773 | 	await expect(add).toBeFocused();
  9774 | 
  9775 | 	await session.page.mouse.click(
  9776 | 		renameBox.x + renameBox.width / 2,
  9777 | 		renameBox.y + renameBox.height / 2,
  9778 | 	);
  9779 | 	await expect(draft).toBeVisible();
  9780 | 	await expect(session.page.getByTestId("rename-project-sheet")).toHaveCount(0);
  9781 | 	expect(await durableRevisionCount(session.page)).toBe(revisionsBeforeDraft);
  9782 | 
  9783 | 	await session.page.keyboard.press("Escape");
  9784 | 	await expect(draft).toHaveCount(0);
  9785 | 	await expect.poll(modalBackgroundsAreInert).toBe(false);
  9786 | 	await expect(addOpening).toBeFocused();
  9787 | 	expect(await durableRevisionCount(session.page)).toBe(revisionsBeforeDraft);
  9788 | 
  9789 | 	await addOpening.click();
  9790 | 	const reopenedDraft = session.page.getByRole("dialog", {
  9791 | 		name: "Новый проём",
  9792 | 	});
  9793 | 	await reopenedDraft
  9794 | 		.getByRole("button", { name: "Добавить", exact: true })
  9795 | 		.click();
  9796 | 	await expect(reopenedDraft).toHaveCount(0);
> 9797 | 	await expect(addOpening).toBeFocused();
       |                           ^ Error: expect(locator).toBeFocused() failed
  9798 | 	await expect
  9799 | 		.poll(() => durableRevisionCount(session.page))
  9800 | 		.toBe(revisionsBeforeDraft + 1);
  9801 | 	await session.context.close();
  9802 | });
  9803 | 
  9804 | test("PLAN-E2E-04J: the removed wall-split route remains absent when visible Undo changes the current revision", async ({
  9805 | 	page: _page,
  9806 | }, testInfo) => {
  9807 | 	const session = await openPersistentPhone(
  9808 | 		testInfo,
  9809 | 		"editor-wall-split-stale-base",
  9810 | 	);
  9811 | 	await session.page.goto("/");
  9812 | 	await startNewProject(session.page, "Устаревший разрез");
  9813 | 	await session.page.getByRole("button", { name: "Создать контур" }).click();
  9814 | 	await chooseEditorOption(session.page, "Рука и выбор");
  9815 | 	const exteriorWall = session.page
  9816 | 		.locator('[data-testid="wall-segment"][data-wall-kind="exterior"]')
  9817 | 		.first();
  9818 | 	await exteriorWall.click();
  9819 | 	await expandSelectedWallInspector(session.page);
  9820 | 	await expect(
  9821 | 		session.page.getByRole("button", { name: "Разделить стену жестом" }),
  9822 | 	).toHaveCount(0);
  9823 | 	const splitDraft = session.page.getByTestId("wall-split-draft");
  9824 | 	await expect(splitDraft).toHaveCount(0);
  9825 | 	const revisionBeforeUndo = (await durableResourceManifests(session.page))
  9826 | 		.currentRevisionId;
  9827 | 	await triggerEditorHistoryAction(session.page, "undo");
  9828 | 	await expect
  9829 | 		.poll(
  9830 | 			async () =>
  9831 | 				(await durableResourceManifests(session.page)).currentRevisionId,
  9832 | 		)
  9833 | 		.not.toBe(revisionBeforeUndo);
  9834 | 	await expect(splitDraft).toHaveCount(0);
  9835 | 	await session.context.close();
  9836 | });
  9837 | 
  9838 | test("PLAN-E2E-04Z: reopening a legacy wall split away from a Door keeps one durable wall host", async ({
  9839 | 	page: _page,
  9840 | }, testInfo) => {
  9841 | 	const session = await openPersistentPhone(
  9842 | 		testInfo,
  9843 | 		"editor-doorway-wall-split",
  9844 | 	);
  9845 | 	await session.page.goto("/");
  9846 | 	await startNewProject(session.page, "Разделить стену с дверью");
  9847 | 	await session.page.getByRole("button", { name: "Создать контур" }).click();
  9848 | 	await chooseEditorOption(session.page, "Рука и выбор");
  9849 | 	const hostWall = session.page
  9850 | 		.locator('[data-testid="wall-segment"][data-wall-kind="exterior"]')
  9851 | 		.first();
  9852 | 	await hostWall.click();
  9853 | 	await loadOpeningFixtureOnSelectedWall(session.page, {
  9854 | 		heightMm: 2100,
  9855 | 		kind: "Door",
  9856 | 		offsetMm: 2000,
  9857 | 		sillMm: 0,
  9858 | 		widthMm: 900,
  9859 | 	});
  9860 | 	await expect(session.page.getByTestId("door-opening")).toHaveCount(1);
  9861 | 	await expandSelectedWallInspector(session.page);
  9862 | 	const revisionsBeforeSplit = await durableRevisionCount(session.page);
  9863 | 	await loadLegacySplitWallFixture(session.page, 0.15);
  9864 | 	await expect(session.page.getByTestId("wall-segment")).toHaveCount(5);
  9865 | 	await expect(session.page.getByTestId("door-opening")).toHaveCount(1);
  9866 | 	expect(await durableRevisionCount(session.page)).toBe(
  9867 | 		revisionsBeforeSplit + 1,
  9868 | 	);
  9869 | 	await session.page.reload();
  9870 | 	await openProjectFromHub(session.page, "Разделить стену с дверью");
  9871 | 	await expect(session.page.getByTestId("wall-segment")).toHaveCount(5);
  9872 | 	await expect(session.page.getByTestId("door-opening")).toHaveCount(1);
  9873 | 	await chooseEditorOption(session.page, "3D");
  9874 | 	await expect(
  9875 | 		session.page.getByTestId("three-dimensional-canvas"),
  9876 | 	).toBeVisible();
  9877 | 	await session.context.close();
  9878 | });
  9879 | 
  9880 | test("PLAN-E2E-04AA: the removed wall-split route cannot remove a Door", async ({
  9881 | 	page: _page,
  9882 | }, testInfo) => {
  9883 | 	const session = await openPersistentPhone(
  9884 | 		testInfo,
  9885 | 		"editor-doorway-wall-split-conflict",
  9886 | 	);
  9887 | 	await session.page.goto("/");
  9888 | 	await startNewProject(session.page, "Разрез через дверной проём");
  9889 | 	await session.page.getByRole("button", { name: "Создать контур" }).click();
  9890 | 	await chooseEditorOption(session.page, "Рука и выбор");
  9891 | 	const hostWall = session.page
  9892 | 		.locator('[data-testid="wall-segment"][data-wall-kind="exterior"]')
  9893 | 		.first();
  9894 | 	await hostWall.click();
  9895 | 	await loadOpeningFixtureOnSelectedWall(session.page, {
  9896 | 		heightMm: 2100,
  9897 | 		kind: "Door",
```