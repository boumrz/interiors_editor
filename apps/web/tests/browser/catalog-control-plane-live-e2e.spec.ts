import { expect, test, type Page } from "@playwright/test";
import type {
	PublicationCandidate,
	VersionedCatalogAsset,
	VersionedCatalogPublication,
} from "../../src/application/ports";
import { clickRectangularRoomCentre } from "./room-geometry-fixture";

async function startNewProjectFromHub(page: Page, name: string): Promise<void> {
	await expect(page.getByTestId("project-hub")).toBeVisible();
	await page.getByRole("button", { name: "Новый проект", exact: true }).click();
	await expect(
		page.getByRole("heading", { name: "Новый проект", exact: true }),
	).toBeVisible();
	await page.getByLabel("Название проекта").fill(name);
	await page.getByRole("button", { name: "Создать проект" }).click();
	await expect(page.getByTestId("editor-workspace")).toBeVisible();
}

const liveCatalogEnabled = Boolean(
	(
		globalThis as typeof globalThis & {
			readonly process?: { readonly env?: Record<string, string | undefined> };
		}
	).process?.env?.INTERIORS_LIVE_CATALOG_E2E,
);

async function readLivePublication(
	page: Page,
): Promise<VersionedCatalogPublication> {
	const response = await page.request.get("/catalog-api/v1/catalogs/current", {
		headers: { Accept: "application/json" },
	});
	expect(response.status()).toBe(200);
	const envelopeBytes = new Uint8Array(await response.body());
	const envelopeDigest = await globalThis.crypto.subtle.digest(
		"SHA-256",
		envelopeBytes,
	);
	const envelopeHash = Array.from(new Uint8Array(envelopeDigest), (value) =>
		value.toString(16).padStart(2, "0"),
	).join("");
	expect(response.headers().etag?.replace(/^W\//, "")).toBe(
		`"${envelopeHash}"`,
	);
	const envelope: Omit<VersionedCatalogPublication, "envelopeHash"> =
		await response.json();
	return { ...envelope, envelopeHash };
}

async function readDurableState(page: Page) {
	return page.evaluate(async () => {
		const database = await new Promise<IDBDatabase>((resolve, reject) => {
			const request = indexedDB.open("interiors-editor-projects");
			request.onsuccess = () => resolve(request.result);
			request.onerror = () => reject(request.error);
		});
		try {
			return await new Promise<{
				current: PublicationCandidate;
				revisions: readonly PublicationCandidate[];
			}>((resolve, reject) => {
				const transaction = database.transaction(
					["projects", "revisions"],
					"readonly",
				);
				const pointers = transaction.objectStore("projects").getAll();
				const records = transaction.objectStore("revisions").getAll();
				transaction.oncomplete = () => {
					const revisions = records.result.map(
						(record) => record.candidate as PublicationCandidate,
					);
					const current = revisions.find(
						(candidate) =>
							candidate.revision.revisionId ===
							pointers.result[0]?.currentRevisionId,
					);
					if (pointers.result.length !== 1 || !current)
						return reject(new Error("Expected exactly one durable Project"));
					resolve({ current, revisions });
				};
				transaction.onerror = () => reject(transaction.error);
				transaction.onabort = () => reject(transaction.error);
			});
		} finally {
			database.close();
		}
	});
}

async function expectExactPinnedResource(
	page: Page,
	asset: VersionedCatalogAsset,
) {
	const stored = await page.evaluate(async (resourceHash) => {
		const database = await new Promise<IDBDatabase>((resolve, reject) => {
			const request = indexedDB.open("interiors-editor-custom-assets");
			request.onsuccess = () => resolve(request.result);
			request.onerror = () => reject(request.error);
		});
		try {
			const record = await new Promise<{
				bytes: ArrayBuffer;
				resourceHash: string;
			}>((resolve, reject) => {
				const transaction = database.transaction("resources", "readonly");
				const request = transaction.objectStore("resources").get(resourceHash);
				transaction.oncomplete = () =>
					request.result
						? resolve(request.result)
						: reject(new Error("Expected exact locally pinned model bytes"));
				transaction.onerror = () => reject(transaction.error);
				transaction.onabort = () => reject(transaction.error);
			});
			const bytes = new Uint8Array(record.bytes);
			const hash = await crypto.subtle.digest("SHA-256", bytes);
			return {
				byteLength: bytes.byteLength,
				resourceHash: record.resourceHash,
				sha256: Array.from(new Uint8Array(hash), (value) =>
					value.toString(16).padStart(2, "0"),
				).join(""),
			};
		} finally {
			database.close();
		}
	}, asset.resource.sha256);
	expect(stored).toEqual({
		byteLength: asset.resource.byteLength,
		resourceHash: asset.resource.sha256,
		sha256: asset.resource.sha256,
	});
}

async function chooseLiveModel(
	page: Page,
	publication: VersionedCatalogPublication,
	asset: VersionedCatalogAsset,
) {
	await page
		.getByRole("navigation", { name: "Инструменты редактора" })
		.getByRole("button", { name: "Предметы интерьера", exact: true })
		.click();
	const catalog = page.getByRole("dialog", { name: "Предметы интерьера" });
	await expect(catalog.getByTestId("catalog-publication-status")).toContainText(
		`Версия ${publication.catalogVersion} · ${publication.assets.length} предметов`,
	);
	await catalog
		.getByRole("button", { name: new RegExp(`^${asset.label} —`) })
		.click();
	await expect(
		catalog.getByTestId("catalog-selected-resource-metadata"),
	).toContainText(
		`${asset.resource.byteLength} байт · SHA-256 ${asset.resource.sha256}`,
	);
	const showOnPlan = catalog.getByRole("button", {
		name: "Показать на плане",
		exact: true,
	});
	await expect(showOnPlan).toBeEnabled({ timeout: 60_000 });
	await showOnPlan.click();
	await expect(catalog).toHaveCount(0);
}

async function expectOnePublishedModel(
	page: Page,
	before: Awaited<ReturnType<typeof readDurableState>>,
	publication: VersionedCatalogPublication,
	asset: VersionedCatalogAsset,
) {
	await expect
		.poll(async () => (await readDurableState(page)).revisions.length)
		.toBe(before.revisions.length + 1);
	const saved = await readDurableState(page);
	expect(
		saved.revisions.filter(
			(candidate) =>
				candidate.revision.revisionId !== saved.current.revision.revisionId,
		),
	).toEqual(before.revisions);
	expect(saved.current.project.level).toEqual(before.current.project.level);
	expect(saved.current.project.assetInstances).toHaveLength(1);
	expect(saved.current.project.assetDefinitionRefs).toHaveLength(1);
	const instance = saved.current.project.assetInstances[0];
	const definition = saved.current.project.assetDefinitionRefs[0];
	if (!instance || !definition)
		throw new Error("Expected one published model and its definition");
	expect(instance.assetInstanceId).not.toBe("");
	expect(definition.assetDefinitionId).not.toBe("");
	expect(instance).toMatchObject({
		anchorClass: asset.anchorClass,
		assetDefinitionId: definition.assetDefinitionId,
		depthMm: asset.dimensionsMm.depth,
		heightMm: asset.dimensionsMm.height,
		label: asset.label,
		widthMm: asset.dimensionsMm.width,
	});
	expect(definition).toEqual({
		assetDefinitionId: definition.assetDefinitionId,
		byteLength: asset.resource.byteLength,
		catalogAssetId: asset.assetId,
		catalogEnvelopeHash: publication.envelopeHash,
		catalogVersion: publication.catalogVersion,
		depthMm: asset.dimensionsMm.depth,
		displayName: asset.label,
		format: "glb",
		heightMm: asset.dimensionsMm.height,
		resourceHash: asset.resource.sha256,
		source: "CatalogVersion",
		widthMm: asset.dimensionsMm.width,
	});
	expect(JSON.parse(saved.current.revision.serializedProject)).toEqual(
		saved.current.project,
	);
	await expectExactPinnedResource(page, asset);
	return saved;
}

async function expectReopenedModel(
	page: Page,
	saved: Awaited<ReturnType<typeof readDurableState>>,
	asset: VersionedCatalogAsset,
) {
	await page.reload();
	await expect(page.getByTestId("project-hub")).toBeVisible();
	await page
		.getByRole("button", {
			name: `Открыть ${saved.current.project.name}`,
			exact: true,
		})
		.click();
	await expect(page.getByTestId("editor-workspace")).toBeVisible();
	await expect(
		page.getByTestId("editor-top-bar").getByRole("status"),
	).toHaveText("Сохранено");
	expect(await readDurableState(page)).toEqual(saved);
	await expectExactPinnedResource(page, asset);
	await expect(
		page.getByTestId(
			asset.anchorClass === "wall" ? "wall-schematic-item" : "schematic-item",
		),
	).toHaveCount(1);
}

test("CATALOG-LIVE-01: a published floor model loads, saves exact resources and survives reopening", async ({
	page,
}) => {
	test.setTimeout(90_000);
	test.skip(
		!liveCatalogEnabled,
		"Requires the local Kotlin/PostgreSQL control plane",
	);
	await page.goto("/");
	const publication = await readLivePublication(page);
	const asset = publication.assets.find(
		(candidate) => candidate.assetId === "single-bed",
	);
	if (!asset) throw new Error("The published catalog must include single-bed");
	expect(asset.anchorClass).toBe("floor");
	await startNewProjectFromHub(page, "Живой каталог");
	await page.getByRole("button", { name: "Создать контур" }).click();
	await expect(page.getByTestId("room-face")).toHaveCount(1);
	await expect(
		page.getByTestId("editor-top-bar").getByRole("status"),
	).toHaveText("Сохранено");
	const before = await readDurableState(page);
	await chooseLiveModel(page, publication, asset);
	await expect(page.getByTestId("item-placement-identity")).toHaveText(
		asset.label,
	);
	expect(await readDurableState(page)).toEqual(before);
	await clickRectangularRoomCentre(page);
	await expect(page.getByTestId("item-placement-preview")).toHaveAttribute(
		"data-placement-valid",
		"true",
	);
	const confirm = page.getByRole("button", {
		name: "Подтвердить размещение предмета",
		exact: true,
	});
	await expect(confirm).toBeEnabled();
	expect(await readDurableState(page)).toEqual(before);
	await confirm.click();
	const saved = await expectOnePublishedModel(page, before, publication, asset);
	expect(saved.current.project.assetInstances[0]).toMatchObject({
		anchorClass: "floor",
		roomId: before.current.project.level.rooms[0]?.roomId,
		yawStep: 0,
	});
	await expectReopenedModel(page, saved, asset);
});

test("CATALOG-LIVE-02: a published wall model keeps the selected host and exact pinned resources after reopening", async ({
	page,
}) => {
	test.setTimeout(90_000);
	test.skip(
		!liveCatalogEnabled,
		"Requires the local Kotlin/PostgreSQL control plane",
	);
	await page.goto("/");
	const publication = await readLivePublication(page);
	const asset = publication.assets.find(
		(candidate) => candidate.assetId === "evidence-wall-sconce",
	);
	if (!asset)
		throw new Error("The published catalog must include evidence-wall-sconce");
	expect(asset.anchorClass).toBe("wall");
	const tinyModel = await page.request.get(
		`/catalog-api/v1/resources/sha256/${asset.resource.sha256}`,
		{ headers: { Accept: "model/gltf-binary", Range: "bytes=0-1048575" } },
	);
	expect(tinyModel.status()).toBe(206);
	const rangeLength = Math.min(1048576, asset.resource.byteLength);
	expect(tinyModel.headers()["content-range"]).toBe(
		`bytes 0-${rangeLength - 1}/${asset.resource.byteLength}`,
	);
	expect((await tinyModel.body()).byteLength).toBe(rangeLength);
	await startNewProjectFromHub(page, "Живое бра");
	await page.getByRole("button", { name: "Создать контур" }).click();
	await expect(page.getByTestId("room-face")).toHaveCount(1);
	await expect(
		page.getByTestId("editor-top-bar").getByRole("status"),
	).toHaveText("Сохранено");
	const before = await readDurableState(page);
	await page.getByRole("button", { name: "Рука и выбор", exact: true }).click();
	const wall = page.getByTestId("wall-segment").nth(1);
	const wallId = await wall.getAttribute("data-wall-id");
	if (!wallId) throw new Error("Expected a selected wall host");
	await wall.click();
	await chooseLiveModel(page, publication, asset);
	const placement = page.getByTestId("selected-wall-inspector");
	await expect(placement).toBeVisible();
	const confirm = placement.getByRole("button", {
		name: "Подтвердить размещение",
		exact: true,
	});
	await expect(confirm).toBeEnabled();
	expect(await readDurableState(page)).toEqual(before);
	await confirm.click();
	const saved = await expectOnePublishedModel(page, before, publication, asset);
	expect(saved.current.project.assetInstances[0]).toMatchObject({
		anchorClass: "wall",
		wallSegmentId: wallId,
		side: "left",
		elevationMm: 1500,
	});
	await expectReopenedModel(page, saved, asset);
});
