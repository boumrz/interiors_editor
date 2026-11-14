import { DurableProjectRepository } from "../../src/adapters/persistence/durable-project-repository";
import { FencedProjectRepository } from "../../src/adapters/persistence/fenced-project-repository";
import { IndexedDbVersionedProjectStore } from "../../src/adapters/persistence/indexeddb-versioned-project-store";
import { PublicationFaultController } from "../../src/adapters/persistence/publication-fault-controller";
import {
	canonicalProjectSerializer,
	CreateProjectUseCase,
} from "../../src/application/create-project";
import {
	browserChecksum,
	browserClock,
	browserIds,
	browserRandomUuid,
} from "../../src/app/browser-ports";

export const BROWSER_DATABASE = "interiors-editor-projects";
const nativeOpen = IDBFactory.prototype.open;

export async function rows(databaseName: string) {
	if (
		!(await indexedDB.databases()).some((entry) => entry.name === databaseName)
	)
		return { projects: [], revisions: [] };
	const database = await new Promise<IDBDatabase>((resolve, reject) => {
		const request = nativeOpen.call(indexedDB, databaseName);
		request.onsuccess = () => resolve(request.result);
		request.onerror = () => reject(request.error);
	});
	try {
		const transaction = database.transaction(
			["projects", "revisions"],
			"readonly",
		);
		const completion = new Promise<void>((resolve, reject) => {
			transaction.oncomplete = () => resolve();
			transaction.onabort = () => reject(transaction.error);
		});
		const read = (store: string) =>
			new Promise<unknown[]>((resolve, reject) => {
				const request = transaction.objectStore(store).getAll();
				request.onsuccess = () => resolve(request.result);
				request.onerror = () => reject(request.error);
			});
		const [projects, revisions] = await Promise.all([
			read("projects"),
			read("revisions"),
		]);
		await completion;
		return { projects, revisions };
	} finally {
		database.close();
	}
}

/** Healthy browser baseline through its actual persistence/core, without a semantic codec. */
export async function seedBrowserProject() {
	if ((await rows(BROWSER_DATABASE)).projects.length) return;
	const store = new IndexedDbVersionedProjectStore(
		new PublicationFaultController(),
	);
	const repository = new FencedProjectRepository(
		new DurableProjectRepository(store, browserChecksum.sha256),
		store,
		browserRandomUuid(),
	);
	const result = await new CreateProjectUseCase({
		repository,
		checksum: browserChecksum,
		clock: browserClock,
		ids: browserIds,
		serializer: canonicalProjectSerializer,
	}).execute("Preserved browser Project", () => undefined);
	if (result.kind !== "durable")
		throw new Error("Actual browser baseline failed");
}

/** Self-authored one-triangle GLB with finite nonzero bounds; no external resources. */
export function triangleGlb(): Uint8Array<ArrayBuffer> {
	const positions = new Float32Array([0, 0, 0, 0.7, 0, 0, 0, 0.8, 0.6]);
	const text = JSON.stringify({
		asset: { version: "2.0", generator: "Local UI fixture" },
		scene: 0,
		scenes: [{ nodes: [0] }],
		nodes: [{ mesh: 0 }],
		buffers: [{ byteLength: positions.byteLength }],
		bufferViews: [
			{
				buffer: 0,
				byteOffset: 0,
				byteLength: positions.byteLength,
				target: 34962,
			},
		],
		accessors: [
			{
				bufferView: 0,
				byteOffset: 0,
				componentType: 5126,
				count: 3,
				type: "VEC3",
				min: [0, 0, 0],
				max: [0.7, 0.8, 0.6],
			},
		],
		materials: [
			{
				doubleSided: true,
				pbrMetallicRoughness: {
					baseColorFactor: [0.5, 0.3, 0.8, 1],
					metallicFactor: 0,
					roughnessFactor: 1,
				},
			},
		],
		meshes: [
			{ primitives: [{ attributes: { POSITION: 0 }, material: 0, mode: 4 }] },
		],
	});
	const json = new TextEncoder().encode(text);
	const padded = Math.ceil(json.byteLength / 4) * 4;
	const bytes = new Uint8Array(28 + padded + positions.byteLength);
	const view = new DataView(bytes.buffer);
	view.setUint32(0, 0x46546c67, true);
	view.setUint32(4, 2, true);
	view.setUint32(8, bytes.byteLength, true);
	view.setUint32(12, padded, true);
	view.setUint32(16, 0x4e4f534a, true);
	bytes.fill(32, 20, 20 + padded);
	bytes.set(json, 20);
	view.setUint32(20 + padded, positions.byteLength, true);
	view.setUint32(24 + padded, 0x004e4942, true);
	bytes.set(new Uint8Array(positions.buffer), 28 + padded);
	return bytes;
}
