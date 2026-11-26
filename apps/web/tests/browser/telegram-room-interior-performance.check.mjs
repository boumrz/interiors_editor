import { expect, test } from "@playwright/test";
import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";

const idleWindowMs = 450;

/** Counts submissions at the canvas boundary. Three's shadow pass precedes the main color clear. */
function installDrawProbe() {
	const prototype = WebGL2RenderingContext.prototype;
	const trackedCanvas = context => context.canvas.isConnected &&
		context.canvas.getAttribute("data-testid") === "three-dimensional-canvas";
	const blank = () => ({ drawCalls: 0, triangles: 0 });
	const framebuffer = new WeakMap();
	const offscreen = new WeakMap();
	let frameNumber = 0;
	let callTotal = 0;
	let latest;
	const around = (name, observe) => {
		const native = prototype[name];
		prototype[name] = function (...args) {
			const result = Reflect.apply(native, this, args);
			if (trackedCanvas(this)) observe(this, args);
			return result;
		};
	};
	around("bindFramebuffer", (gl, [target, next]) => {
		if (target !== gl.READ_FRAMEBUFFER) framebuffer.set(gl, next);
	});
	around("clear", (gl, [mask]) => {
		if (framebuffer.get(gl) || !(mask & gl.COLOR_BUFFER_BIT)) return;
		latest = { visible: blank(), offscreen: offscreen.get(gl) ?? blank() };
		offscreen.delete(gl);
		frameNumber++;
	});
	const count = (gl, mode, vertices, instances = 1) => {
		let counter;
		if (framebuffer.get(gl)) {
			counter = offscreen.get(gl) ?? blank();
			offscreen.set(gl, counter);
		} else {
			counter = latest?.visible;
		}
		if (!counter) return;
		counter.drawCalls++;
		callTotal++;
		if (mode === gl.TRIANGLES) counter.triangles += Math.floor(vertices / 3) * instances;
		if (mode === gl.TRIANGLE_STRIP || mode === gl.TRIANGLE_FAN) {
			counter.triangles += Math.max(0, vertices - 2) * instances;
		}
	};
	around("drawArrays", (gl, [mode, , vertices]) => count(gl, mode, vertices));
	around("drawElements", (gl, [mode, vertices]) => count(gl, mode, vertices));
	around("drawRangeElements", (gl, [mode, , , vertices]) => count(gl, mode, vertices));
	around("drawArraysInstanced", (gl, [mode, , vertices, instances]) => count(gl, mode, vertices, instances));
	around("drawElementsInstanced", (gl, [mode, vertices, , , instances]) => count(gl, mode, vertices, instances));
	window.__roomDrawProbe = () => ({ frameNumber, callTotal, latest });
}

async function currentProject(page) {
	const state = await page.evaluate(() => window.__telegramRuntimeUi.state());
	if (state.kind !== "saved" || state.project.schemaVersion !== 1) throw Error("Expected the saved demo Project");
	return state.project;
}

function assignedFinishCommands(project) {
	return [
		...project.level.rooms.flatMap(({ roomId, floorFinish }) => floorFinish
			? [{ kind: "set-floor-finish", roomId, finish: floorFinish }] : []),
		...project.level.wallSegments.flatMap(({ wallSegmentId, sideFinishes }) =>
			Object.entries(sideFinishes ?? {}).map(([side, finish]) =>
				({ kind: "set-wall-finish", wallSegmentId, side, finish }))),
	];
}

function geometryAndItems({ level, assetInstances, supportedItems }) {
	return {
		level: {
			...level,
			rooms: level.rooms.map(({ floorFinish, ...room }) => room),
			wallSegments: level.wallSegments.map(({ sideFinishes, ...wall }) => wall),
		},
		assetInstances,
		supportedItems,
	};
}

const readProbe = page => page.evaluate(() => window.__roomDrawProbe());

async function idleProof(page) {
	const idle = await page.evaluate(async windowMs => {
		const frame = () => new Promise(resolve => requestAnimationFrame(resolve));
		for (let index = 0; index < 6; index++) await frame();
		const before = window.__roomDrawProbe();
		let browserFrames = 0;
		const start = performance.now();
		while (performance.now() - start < windowMs) {
			await frame();
			browserFrames++;
		}
		const after = window.__roomDrawProbe();
		return {
			visibleTab: document.visibilityState === "visible",
			windowMs,
			browserFrames,
			sceneFrames: after.frameNumber - before.frameNumber,
			submittedDrawCalls: after.callTotal - before.callTotal,
		};
	}, idleWindowMs);
	expect(idle).toMatchObject({ visibleTab: true, sceneFrames: 0, submittedDrawCalls: 0 });
	expect(idle.browserFrames).toBeGreaterThan(5);
	return idle;
}

async function sample(page, afterFrame = 0) {
	await expect.poll(() => readProbe(page).then(result => result.frameNumber)).toBeGreaterThan(afterFrame);
	const idle = await idleProof(page);
	const { frameNumber, latest } = await readProbe(page);
	const frame = {
		...latest,
		drawCalls: latest.visible.drawCalls + latest.offscreen.drawCalls,
		triangles: latest.visible.triangles + latest.offscreen.triangles,
	};
	expect(frame.visible.drawCalls).toBeGreaterThan(0);
	expect(frame.visible.triangles).toBeGreaterThan(0);
	const viewport = await page.getByTestId("three-dimensional-canvas").evaluate(canvas => ({
		widthCssPx: canvas.clientWidth,
		heightCssPx: canvas.clientHeight,
		widthBufferPx: canvas.width,
		heightBufferPx: canvas.height,
	}));
	const camera = await page.getByTestId("three-dimensional-camera").textContent();
	return { frameNumber, frame, viewport, camera, idle };
}

test("TMA-INTERIOR-PERFORMANCE: default and assigned finishes on the same room render on demand", async ({ page, baseURL }, info) => {
	if (!baseURL) throw Error("Missing isolated TMA origin");
	const origin = new URL(baseURL).origin;
	await page.route("**/*", route => new URL(route.request().url()).origin === origin ? route.continue() : route.abort());
	await page.addInitScript(installDrawProbe);
	await page.goto("/");
	await page.evaluate(async () => {
		await window.__telegramRuntimeUi.initialize();
		await window.__telegramRuntimeUi.mountNavigable("a", true, "exact", "authoring", "authoring");
	});
	await expect(page.getByRole("button", { name: "Новый проект", exact: true })).toBeVisible();
	await page.evaluate(() => window.__telegramRuntimeUi.createRoomInteriorDemo());
	const assigned = await currentProject(page);
	const commands = assignedFinishCommands(assigned);
	expect(commands).toHaveLength(5);
	await page.evaluate(async finishCommands => {
		for (const { finish, ...reset } of finishCommands) await window.__telegramRuntimeUi.authorInterior(reset);
	}, commands);
	const reset = await currentProject(page);
	expect(assignedFinishCommands(reset)).toHaveLength(0);
	expect(geometryAndItems(reset)).toEqual(geometryAndItems(assigned));
	await page.getByRole("button", { name: "3D", exact: true }).click();
	await expect(page.getByTestId("three-dimensional-renderer-diagnostics")).toContainText("стандартное качество");
	const allWalls = page.getByRole("button", { name: "Показать все стены", exact: true });
	await allWalls.click();
	await expect(allWalls).toHaveAttribute("aria-pressed", "true");
	const before = await sample(page);

	await page.evaluate(async finishCommands => {
		for (const command of finishCommands) await window.__telegramRuntimeUi.authorInterior(command);
	}, commands);
	const restored = await currentProject(page);
	expect(assignedFinishCommands(restored)).toEqual(commands);
	expect(geometryAndItems(restored)).toEqual(geometryAndItems(reset));
	const after = await sample(page, before.frameNumber);
	expect(after.viewport).toEqual(before.viewport);
	expect(after.camera).toEqual(before.camera);
	await expect(allWalls).toHaveAttribute("aria-pressed", "true");

	const output = process.env.TMA_ROOM_PROOF_OUTPUT ?? info.outputPath("room-interior-performance");
	await mkdir(output, { recursive: true });
	await writeFile(join(output, "performance.json"), `${JSON.stringify({
		method: "WebGL2 draw submissions on the actual Telegram editor canvas, with shadows measured separately",
		profile: "Chromium, iPhone 13 viewport emulation, SwiftShader, standard quality, all walls",
		fixture: { rooms: 1, walls: 4, floorItems: assigned.assetInstances.length, supportedItems: assigned.supportedItems.length },
		viewport: after.viewport,
		camera: after.camera,
		referenceRS2: { visibleDrawCalls: 250, visibleTriangles: 750_000 },
		defaultFinishes: { frame: before.frame, idle: before.idle },
		assignedFinishes: { frame: after.frame, idle: after.idle },
		delta: { drawCalls: after.frame.drawCalls - before.frame.drawCalls, triangles: after.frame.triangles - before.frame.triangles },
		redrewAfterFinishChange: after.frameNumber > before.frameNumber,
	}, null, 2)}\n`);
});
