# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: editor-workspace-e2e.spec.ts >> EDITOR-E2E-00: development clears an installed worker and its caches without changing durable Projects
- Location: tests/browser/editor-workspace-e2e.spec.ts:1145:1

# Error details

```
Error: expect(received).toEqual(expected) // deep equality

- Expected  - 1
+ Received  + 3

  Object {
-   "cacheNames": Array [],
+   "cacheNames": Array [
+     "interiors-editor-shell-dd48d08b24f88037",
+   ],
    "registrations": 0,
  }

Call Log:
- Timeout 5000ms exceeded while waiting on the predicate
```

# Test source

```ts
  1132 | 	return page.locator('[data-wall-kind="exterior"]').evaluateAll((elements) =>
  1133 | 		elements.map((element) => {
  1134 | 			const box = element.getBoundingClientRect();
  1135 | 			return {
  1136 | 				height: box.height,
  1137 | 				left: box.left,
  1138 | 				top: box.top,
  1139 | 				width: box.width,
  1140 | 			};
  1141 | 		}),
  1142 | 	);
  1143 | }
  1144 | 
  1145 | test("EDITOR-E2E-00: development clears an installed worker and its caches without changing durable Projects", async ({
  1146 | 	page: _page,
  1147 | }, testInfo) => {
  1148 | 	const session = await openPersistentPhone(
  1149 | 		testInfo,
  1150 | 		"editor-development-worker-cleanup",
  1151 | 		{ installCatalogFake: false, serviceWorkers: "allow" },
  1152 | 	);
  1153 | 	try {
  1154 | 		await session.page.goto("/");
  1155 | 		await startNewProject(session.page, "Проект после очистки dev-кеша");
  1156 | 		await session.page.getByRole("button", { name: "Создать контур" }).click();
  1157 | 		await expect(session.page.getByTestId("room-face")).toHaveCount(1);
  1158 | 		await expect(
  1159 | 			session.page.getByTestId("editor-top-bar").getByRole("status"),
  1160 | 		).toHaveText("Сохранено");
  1161 | 		const readDurableState = () =>
  1162 | 			session.page.evaluate(async () => {
  1163 | 				const database = await new Promise<IDBDatabase>((resolve, reject) => {
  1164 | 					const request = indexedDB.open("interiors-editor-projects");
  1165 | 					request.onsuccess = () => resolve(request.result);
  1166 | 					request.onerror = () => reject(request.error);
  1167 | 				});
  1168 | 				try {
  1169 | 					return await new Promise<{
  1170 | 						pointers: readonly unknown[];
  1171 | 						revisions: readonly unknown[];
  1172 | 					}>((resolve, reject) => {
  1173 | 						const transaction = database.transaction(
  1174 | 							["projects", "revisions"],
  1175 | 							"readonly",
  1176 | 						);
  1177 | 						const pointers = transaction.objectStore("projects").getAll();
  1178 | 						const revisions = transaction.objectStore("revisions").getAll();
  1179 | 						transaction.oncomplete = () =>
  1180 | 							resolve({
  1181 | 								pointers: pointers.result,
  1182 | 								revisions: revisions.result,
  1183 | 							});
  1184 | 						transaction.onerror = () => reject(transaction.error);
  1185 | 						transaction.onabort = () => reject(transaction.error);
  1186 | 					});
  1187 | 				} finally {
  1188 | 					database.close();
  1189 | 				}
  1190 | 			});
  1191 | 		const before = await readDurableState();
  1192 | 		expect(before.pointers).toHaveLength(1);
  1193 | 		expect(before.revisions).toHaveLength(2);
  1194 | 		const seededCacheNames = [
  1195 | 			"interiors-editor-shell-dev-cleanup-e2e",
  1196 | 			"interiors-editor-browse-dev-cleanup-e2e",
  1197 | 		];
  1198 | 		const installed = await session.page.evaluate(async (cacheNames) => {
  1199 | 			const registration = await navigator.serviceWorker.register("/sw.js");
  1200 | 			await navigator.serviceWorker.ready;
  1201 | 			const worker = registration.active;
  1202 | 			if (!worker) throw new Error("Expected an active worker");
  1203 | 			if (worker.state !== "activated") {
  1204 | 				await new Promise<void>((resolve) => {
  1205 | 					worker.addEventListener("statechange", () => {
  1206 | 						if (worker.state === "activated") resolve();
  1207 | 					});
  1208 | 				});
  1209 | 			}
  1210 | 			for (const name of cacheNames) {
  1211 | 				const cache = await caches.open(name);
  1212 | 				await cache.put("/dev-cleanup-proof", new Response(`cached:${name}`));
  1213 | 			}
  1214 | 			return {
  1215 | 				active: Boolean(registration.active),
  1216 | 				cacheNames: await caches.keys(),
  1217 | 			};
  1218 | 		}, seededCacheNames);
  1219 | 		expect(installed.active).toBe(true);
  1220 | 		for (const name of seededCacheNames)
  1221 | 			expect(installed.cacheNames).toContain(name);
  1222 | 		await session.page.reload();
  1223 | 		await expect(session.page.getByTestId("project-hub")).toBeVisible();
  1224 | 		await expect
  1225 | 			.poll(() =>
  1226 | 				session.page.evaluate(async () => ({
  1227 | 					registrations: (await navigator.serviceWorker.getRegistrations())
  1228 | 						.length,
  1229 | 					cacheNames: await caches.keys(),
  1230 | 				})),
  1231 | 			)
> 1232 | 			.toEqual({ registrations: 0, cacheNames: [] });
       |     ^ Error: expect(received).toEqual(expected) // deep equality
  1233 | 		expect(await readDurableState()).toEqual(before);
  1234 | 		await openProjectFromHub(session.page, "Проект после очистки dev-кеша");
  1235 | 		await expect(session.page.getByTestId("room-face")).toHaveCount(1);
  1236 | 		expect(await readDurableState()).toEqual(before);
  1237 | 	} finally {
  1238 | 		await session.context.close();
  1239 | 	}
  1240 | });
  1241 | 
  1242 | test("REFERENCE-DIAGONAL-E2E-02: a tall diagonal apartment keeps its compact 3D cutaway after reload on a phone", async ({
  1243 | 	page: _page,
  1244 | }, testInfo) => {
  1245 | 	test.setTimeout(180_000);
  1246 | 	const session = await openPersistentPhone(testInfo, "reference-diagonal", {
  1247 | 		freshProfile: true,
  1248 | 	});
  1249 | 	await session.page.setViewportSize({ height: 852, width: 393 });
  1250 | 	await session.page.goto("/");
  1251 | 	await startNewProject(session.page, "Эталонная диагональная квартира");
  1252 | 	await session.page.getByLabel("Ширина, мм").fill("5000");
  1253 | 	await session.page.getByLabel("Глубина, мм").fill("7000");
  1254 | 	await session.page.getByLabel("Высота, мм").fill("2600");
  1255 | 	await session.page.getByRole("button", { name: "Создать контур" }).click();
  1256 | 
  1257 | 	await chooseEditorOption(session.page, "Стена");
  1258 | 	const starterCorners = (
  1259 | 		await Promise.all(
  1260 | 			Array.from({ length: 4 }, (_, index) =>
  1261 | 				wallClientEndpoints(session.page, index),
  1262 | 			),
  1263 | 		)
  1264 | 	).flatMap(({ end, start }) => [start, end]);
  1265 | 	const topLeft = starterCorners.reduce((corner, candidate) =>
  1266 | 		candidate.x + candidate.y < corner.x + corner.y ? candidate : corner,
  1267 | 	);
  1268 | 	const topRight = starterCorners.reduce((corner, candidate) =>
  1269 | 		candidate.x - candidate.y > corner.x - corner.y ? candidate : corner,
  1270 | 	);
  1271 | 	const bottomLeft = starterCorners.reduce((corner, candidate) =>
  1272 | 		candidate.x - candidate.y < corner.x - corner.y ? candidate : corner,
  1273 | 	);
  1274 | 	const widthPx = Math.abs(topRight.x - topLeft.x);
  1275 | 	if (widthPx < 40) {
  1276 | 		throw new Error("Expected a visible tall starter contour");
  1277 | 	}
  1278 | 	const diagonalHalfway = {
  1279 | 		x: topLeft.x + widthPx / 2,
  1280 | 		y: topLeft.y + widthPx / 2,
  1281 | 	};
  1282 | 	await drawCreationWallByTouch(session.page, topLeft, {
  1283 | 		x: topRight.x,
  1284 | 		y: topLeft.y + widthPx,
  1285 | 	});
  1286 | 	await expect(session.page.getByTestId("room-count")).toHaveText("2 комнаты");
  1287 | 
  1288 | 	// Split the lower diagonal polygon along a cardinal wall. Its start is on
  1289 | 	// the 45-degree divider and its end joins the exterior floor edge, which
  1290 | 	// creates three genuinely different room-face shapes in one phone flow.
  1291 | 	await chooseEditorOption(session.page, "Стена");
  1292 | 	await drawCreationWallByTouch(session.page, diagonalHalfway, {
  1293 | 		x: diagonalHalfway.x,
  1294 | 		y: bottomLeft.y,
  1295 | 	});
  1296 | 	await expect(session.page.getByTestId("room-count")).toHaveText("3 комнаты");
  1297 | 	await expect(session.page.getByTestId("wall-count")).toHaveText("9 стен");
  1298 | 	await chooseEditorOption(session.page, "Рука и выбор");
  1299 | 
  1300 | 	const rooms = await roomFaceInteriorPoints(session.page);
  1301 | 	expect(rooms).toHaveLength(3);
  1302 | 	const itemPlacements = [
  1303 | 		{ label: "Винтажный стул Zen", room: rooms[0] },
  1304 | 		{ label: "Обеденное кресло", room: rooms[1] },
  1305 | 		{ label: "Деревянный комод", room: rooms[2] },
  1306 | 	] as const;
  1307 | 	if (itemPlacements.some(({ room }) => !room)) {
  1308 | 		throw new Error("Expected three interior points for the diagonal rooms");
  1309 | 	}
  1310 | 	for (const { label, room } of itemPlacements) {
  1311 | 		await choosePreloadedCatalogAsset(session.page, label, false);
  1312 | 		await session.page.mouse.click(room.x, room.y);
  1313 | 		await expect(
  1314 | 			session.page.getByTestId("item-placement-preview"),
  1315 | 		).toHaveAttribute("data-placement-valid", "true");
  1316 | 		await session.page
  1317 | 			.getByRole("button", { name: "Подтвердить размещение предмета" })
  1318 | 			.click();
  1319 | 	}
  1320 | 	await expect(session.page.getByTestId("item-count")).toHaveText("3 предмета");
  1321 | 	const placementStatus = session.page.getByTestId(
  1322 | 		"item-placement-durable-status",
  1323 | 	);
  1324 | 	await expect(placementStatus).toHaveText("Предмет размещён и сохранён.");
  1325 | 	await expect(placementStatus).toBeHidden({ timeout: 5_000 });
  1326 | 	await chooseEditorOption(session.page, "Рука и выбор");
  1327 | 
  1328 | 	const furnishedItems = await durableFloorItems(session.page);
  1329 | 	const furnishedRooms = await durableRooms(session.page);
  1330 | 	expect(furnishedRooms).toHaveLength(3);
  1331 | 	expect(furnishedItems).toHaveLength(3);
  1332 | 	expect(
```