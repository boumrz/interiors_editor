# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: drawing-dimensions-e2e.spec.ts >> DRAWING-03 (MEASURE-02 replacement): narrow enlarged plan recomputes clear room dimensions after partition Undo
- Location: tests/browser/drawing-dimensions-e2e.spec.ts:216:1

# Error details

```
Error: expect(received).toBe(expected) // Object.is equality

Expected: 2
Received: 1

Call Log:
- Timeout 5000ms exceeded while waiting on the predicate
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
      - button "Переименовать проект Размерный план" [ref=e22] [cursor=pointer]:
        - generic [ref=e23]: Размерный план
      - status [ref=e24]: Предпросмотр — не сохранено
      - button "Открыть остальные действия" [ref=e25] [cursor=pointer]
      - generic [ref=e30]:
        - group "Переключить вид редактора" [ref=e31]:
          - button "План 2D" [pressed] [ref=e33] [cursor=pointer]: План
          - button "3D" [ref=e34] [cursor=pointer]
        - button "Настроить размеры" [disabled] [ref=e35]:
          - generic [ref=e38]: Размеры
    - navigation "Инструменты редактора" [ref=e39]:
      - generic [ref=e40]:
        - button "Комната" [ref=e41] [cursor=pointer]
        - button "Рука и выбор" [ref=e45] [cursor=pointer]
        - button "Стена" [pressed] [ref=e50] [cursor=pointer]
        - button "Предметы интерьера" [ref=e54] [cursor=pointer]:
          - generic [ref=e58]: Предмет
    - group "История изменений" [ref=e59]:
      - 'button "Отменить действие: изменение плана" [ref=e60] [cursor=pointer]': ↶
      - button "Повторить действие" [disabled] [ref=e61]: ↷
```

# Test source

```ts
  153 | 	});
  154 | }
  155 | async function undo(page: Page) {
  156 | 	const undo = page.getByRole("button", { name: /^Отменить действие/ });
  157 | 	await expect(undo).toBeVisible();
  158 | 	await undo.click();
  159 | }
  160 | async function openingState(page: Page) {
  161 | 	return page.evaluate(async () => {
  162 | 		const db = await new Promise<IDBDatabase>((resolve, reject) => {
  163 | 			const request = indexedDB.open("interiors-editor-projects");
  164 | 			request.onsuccess = () => resolve(request.result);
  165 | 			request.onerror = () => reject(request.error);
  166 | 		});
  167 | 		try {
  168 | 			return await new Promise<{
  169 | 				offsetMm: number;
  170 | 				widthMm: number;
  171 | 				revisions: number;
  172 | 			}>((resolve, reject) => {
  173 | 				const tx = db.transaction(["projects", "revisions"], "readonly");
  174 | 				const projects = tx.objectStore("projects").getAll();
  175 | 				const revisions = tx.objectStore("revisions").getAll();
  176 | 				tx.oncomplete = () => {
  177 | 					const revision = revisions.result.find(
  178 | 						(value) =>
  179 | 							value.revisionId === projects.result[0]?.currentRevisionId,
  180 | 					);
  181 | 					const opening = revision?.candidate.project.level.openings[0];
  182 | 					if (!opening) return reject(new Error("Expected durable opening"));
  183 | 					resolve({
  184 | 						offsetMm: opening.offsetMm,
  185 | 						widthMm: opening.widthMm,
  186 | 						revisions: revisions.result.length,
  187 | 					});
  188 | 				};
  189 | 				tx.onerror = () => reject(tx.error);
  190 | 			});
  191 | 		} finally {
  192 | 			db.close();
  193 | 		}
  194 | 	});
  195 | }
  196 | async function wallEnds(page: Page, index: number) {
  197 | 	return page
  198 | 		.getByTestId("wall-line")
  199 | 		.nth(index)
  200 | 		.evaluate((element) => {
  201 | 			if (!(element instanceof SVGLineElement))
  202 | 				throw new Error("Expected SVG wall");
  203 | 			const matrix = element.getScreenCTM();
  204 | 			if (!matrix) throw new Error("Expected plan transform");
  205 | 			const point = (x: string | null, y: string | null) => {
  206 | 				const p = new DOMPoint(Number(x), Number(y)).matrixTransform(matrix);
  207 | 				return { x: p.x, y: p.y };
  208 | 			};
  209 | 			return {
  210 | 				start: point(element.getAttribute("x1"), element.getAttribute("y1")),
  211 | 				end: point(element.getAttribute("x2"), element.getAttribute("y2")),
  212 | 			};
  213 | 		});
  214 | }
  215 | 
  216 | test("DRAWING-03 (MEASURE-02 replacement): narrow enlarged plan recomputes clear room dimensions after partition Undo", async ({
  217 | 	page,
  218 | }) => {
  219 | 	await page.setViewportSize({ width: 360, height: 740 });
  220 | 	await createPlan(page);
  221 | 	await page.getByRole("button", { name: "Стена", exact: true }).click();
  222 | 	const top = await wallEnds(page, 0);
  223 | 	const bottom = await wallEnds(page, 2);
  224 | 	const from = {
  225 | 		x: (top.start.x + top.end.x) / 2,
  226 | 		y: (top.start.y + top.end.y) / 2,
  227 | 	};
  228 | 	const to = {
  229 | 		x: (bottom.start.x + bottom.end.x) / 2,
  230 | 		y: (bottom.start.y + bottom.end.y) / 2,
  231 | 	};
  232 | 	await page.mouse.move(from.x, from.y);
  233 | 	await page.mouse.down();
  234 | 	await page.mouse.move(to.x, to.y, { steps: 8 });
  235 | 	await page.mouse.up();
  236 | 	const clear = page
  237 | 		.getByTestId("drawing-dimensions")
  238 | 		.locator('[data-dimension-kind="room-clear"]');
  239 | 	await expect
  240 | 		.poll(() =>
  241 | 			clear.evaluateAll(
  242 | 				(elements) =>
  243 | 					new Set(
  244 | 						elements.map(
  245 | 							(element) =>
  246 | 								JSON.parse(
  247 | 									element.getAttribute("data-dimension-id") ?? "[]",
  248 | 								)[1],
  249 | 						),
  250 | 					).size,
  251 | 			),
  252 | 		)
> 253 | 		.toBe(2);
      |    ^ Error: expect(received).toBe(expected) // Object.is equality
  254 | 	expect(await clear.count()).toBeLessThanOrEqual(4);
  255 | 	await expect(
  256 | 		page
  257 | 			.getByTestId("drawing-dimensions")
  258 | 			.locator("[data-dimension-crowded], [data-dimension-clipped]"),
  259 | 	).toHaveCount(0);
  260 | 	const before = await revisionCount(page);
  261 | 	await page.addStyleTag({ content: "html { font-size:200% !important; }" });
  262 | 	await expect
  263 | 		.poll(() =>
  264 | 			clear.evaluateAll(
  265 | 				(elements) =>
  266 | 					new Set(
  267 | 						elements.map(
  268 | 							(element) =>
  269 | 								JSON.parse(
  270 | 									element.getAttribute("data-dimension-id") ?? "[]",
  271 | 								)[1],
  272 | 						),
  273 | 					).size,
  274 | 			),
  275 | 		)
  276 | 		.toBe(2);
  277 | 	expect(await clear.count()).toBeLessThanOrEqual(4);
  278 | 	await expect(
  279 | 		page
  280 | 			.getByTestId("drawing-dimensions")
  281 | 			.locator("[data-dimension-crowded], [data-dimension-clipped]"),
  282 | 	).toHaveCount(0);
  283 | 	expect(
  284 | 		await page.evaluate(
  285 | 			() => document.documentElement.scrollWidth <= innerWidth,
  286 | 		),
  287 | 	).toBe(true);
  288 | 	expect(await revisionCount(page)).toBe(before);
  289 | 	await page.addStyleTag({ content: "html { font-size:100% !important; }" });
  290 | 	await undo(page);
  291 | 	await expect(clear).toHaveCount(2);
  292 | 	await expect(clear.locator("text").first()).toHaveText(/4000|3000/);
  293 | 	await page.reload();
  294 | 	await page
  295 | 		.getByRole("button", { name: "Открыть Размерный план", exact: true })
  296 | 		.click();
  297 | 	await expect(clear).toHaveCount(2);
  298 | });
  299 | 
  300 | async function placePlaceholder(page: Page, ratio: number) {
  301 | 	await page
  302 | 		.getByRole("button", { name: "Предметы интерьера", exact: true })
  303 | 		.click();
  304 | 	const catalog = page.getByRole("dialog", {
  305 | 		name: "Предметы интерьера",
  306 | 		exact: true,
  307 | 	});
  308 | 	await catalog
  309 | 		.getByTestId("catalog-authoring")
  310 | 		.getByText("Импорт модели", { exact: true })
  311 | 		.click();
  312 | 	await catalog
  313 | 		.getByRole("button", { name: "Создать макетный предмет", exact: true })
  314 | 		.click();
  315 | 	const composer = catalog.getByRole("form", {
  316 | 		name: "Создать макетный предмет",
  317 | 		exact: true,
  318 | 	});
  319 | 	await composer
  320 | 		.getByLabel("Название макетного предмета")
  321 | 		.fill("Одинаковое имя");
  322 | 	await composer.getByLabel("Ширина макетного предмета, мм").fill("400");
  323 | 	await composer.getByLabel("Глубина макетного предмета, мм").fill("400");
  324 | 	await composer
  325 | 		.getByRole("button", { name: "Начать размещение", exact: true })
  326 | 		.click();
  327 | 	const face = await page.getByTestId("room-face").first().boundingBox();
  328 | 	if (!face) throw new Error("Expected room face");
  329 | 	await page.mouse.click(face.x + face.width * ratio, face.y + face.height / 2);
  330 | 	await page.getByTestId("item-placement-confirm").click();
  331 | }
  332 | 
  333 | test("DRAWING-04 (MEASURE-03 replacement): same-name items retain identity while passive dimensions survive 3D, Plan and Undo", async ({
  334 | 	page,
  335 | }) => {
  336 | 	await createPlan(page);
  337 | 	await placePlaceholder(page, 0.25);
  338 | 	await placePlaceholder(page, 0.75);
  339 | 	await expect(page.getByTestId("schematic-item")).toHaveCount(2);
  340 | 	await page.getByRole("button", { name: "Рука и выбор", exact: true }).click();
  341 | 	const items = page.getByTestId("schematic-item");
  342 | 	const ids = await items.evaluateAll((elements) =>
  343 | 		elements.map((element) =>
  344 | 			element.closest("[data-item-id]")?.getAttribute("data-item-id"),
  345 | 		),
  346 | 	);
  347 | 	expect(ids[0]).toBeTruthy();
  348 | 	expect(ids[1]).toBeTruthy();
  349 | 	expect(ids[0]).not.toBe(ids[1]);
  350 | 	const labels = await page
  351 | 		.getByTestId("drawing-dimensions")
  352 | 		.locator("text")
  353 | 		.allTextContents();
```