import { StrictMode, useEffect, useMemo, useState, type ComponentProps, type ComponentType } from "react";
import { createRoot, type Root } from "react-dom/client";
import { createProductionRuntime } from "../../src/app/production-app";
import { projectRectangularRoomForWebGl } from "../../src/adapters/renderer/rectangular-room-projection";
import type { Project } from "../../src/domain/project";
import { assessParametricFloorItemPlacement, rotationStepForYawRadians, type ParametricFloorItemInput } from "../../src/domain/parametric-item";
import { RoomScene3d } from "../../src/ui/RoomScene3d";
import type { EditorTransientBoundary, RegisterEditorTransientBoundary } from "../../src/ui/editor-host-boundary";
import "../../src/ui/global.css";

// Native browser common-core proof. This fixture has no Telegram SDK or TMA DB.
const runtime = createProductionRuntime();
const controller = runtime.controller;
const Scene: ComponentType<ComponentProps<typeof RoomScene3d> & { readonly registerTransientBoundary?: RegisterEditorTransientBoundary }> = RoomScene3d;
let boundary: EditorTransientBoundary | undefined;
let root: Root | undefined;
let enabled = true;
let placementMode = false;
let omitPlacementCallback = false;
let placementYaw = 0;
let selectedItemId = "";
let refresh: (() => void) | undefined;
let holdNext = false;
let releaseCommand: (() => void) | undefined;
const pending = new Set<Promise<unknown>>();
const commandEntrySnapshots: unknown[] = [];
let captureFrame = false;
const heldFrames: FrameRequestCallback[] = [];
const nativeFrame = window.requestAnimationFrame.bind(window);
let restoreNativeContext: (() => Promise<void>) | undefined;
window.requestAnimationFrame = (callback) => {
 if (!captureFrame) return nativeFrame(callback);
 captureFrame = false; heldFrames.push(callback);
 return nativeFrame(() => undefined);
};
let capturePointerListeners = false;
const heldPointerListeners = new Map<string, unknown>();
window.addEventListener = new Proxy(window.addEventListener, {
 apply(target, receiver, arguments_) {
  const [type, listener] = arguments_;
  if (capturePointerListeners && (type === "pointerdown" || type === "pointermove" || type === "pointerup")) heldPointerListeners.set(type, listener);
  return Reflect.apply(target, receiver, arguments_);
 },
});

function currentProject(): Project {
 const state = controller.snapshot();
 if (state.kind !== "saved" || state.project.schemaVersion !== 1) throw new Error("Missing saved fixture Project");
 return state.project;
}
function register(value: EditorTransientBoundary) {
 boundary = value;
 return () => { if (boundary === value) boundary = undefined; };
}
function placementInput(project: Project, point: { readonly xM: number; readonly zM: number }, yaw: number): ParametricFloorItemInput {
 const room = project.level.rooms[0]; if (!room) throw new Error("Missing room");
 return { roomId: room.roomId, label: "Новый стол", xMm: Math.round(point.xM * 1000), zMm: Math.round(point.zM * 1000), widthMm: 400, depthMm: 400, heightMm: 750, color: "#8C7B6B", yawStep: rotationStepForYawRadians(yaw) };
}
function track(operation: () => Promise<{ readonly kind: string }>): Promise<boolean> {
 commandEntrySnapshots.push(boundary?.inspect());
 const start = holdNext ? new Promise<void>((resolve) => { releaseCommand = resolve; holdNext = false; }) : Promise.resolve();
 const result = start.then(operation).then((value) => value.kind === "durable");
 pending.add(result);
 void result.finally(() => pending.delete(result));
 return result;
}
function View() {
 const [project, setProject] = useState(currentProject);
 const [yaw, setYaw] = useState(0);
 const [, rerender] = useState(0);
 refresh = () => rerender((value) => value + 1);
 useEffect(() => controller.subscribe((state) => { if (state.kind === "saved" && state.project.schemaVersion === 1) setProject(state.project); }), []);
 const scene = useMemo(() => projectRectangularRoomForWebGl(project), [project]);
 if (!scene) throw new Error("Missing derived scene");
 const registration = enabled ? { registerTransientBoundary: register } : {};
 return <div style={{ position: "relative", width: "100%", height: "640px" }} id="editor-surface">
  <Scene {...registration} scene={scene} selectedItemId={selectedItemId} canTransformSelectedItem
   itemPlacementDraft={placementMode ? { color: "#8C7B6B", depthMm: 400, heightMm: 750, label: "Несохранённый стол", widthMm: 400, yawRadians: yaw } : undefined}
   assessItemPlacement={(point) => assessParametricFloorItemPlacement(project, placementInput(project, point, yaw))}
   onItemPlacementYawChange={(next) => { placementYaw = next; setYaw(next); }}
   onCancelItemPlacement={() => { placementMode = false; refresh?.(); }}
   {...(omitPlacementCallback ? {} : { onPlaceItem: async (point: { readonly xM: number; readonly zM: number }) => {
    const accepted = await track(() => controller.createParametricFloorItem(placementInput(currentProject(), point, yaw)));
    if (accepted) { placementMode = false; refresh?.(); }
   } })}
   onMoveItem={(input) => track(() => controller.moveParametricFloorItem({ assetInstanceId: input.assetInstanceId, xMm: Math.round(input.xM * 1000), zMm: Math.round(input.zM * 1000) }))}
   onRotateItem={(input) => track(() => controller.rotateParametricFloorItem(input))}
   onSelectItem={(id) => { selectedItemId = id; refresh?.(); }} />
 </div>;
}
async function durableSnapshot() {
 const db = await new Promise<IDBDatabase>((resolve, reject) => { const request = indexedDB.open("interiors-editor-projects"); request.onsuccess = () => resolve(request.result); request.onerror = () => reject(request.error); });
 try {
  const tx = db.transaction(["projects", "revisions"], "readonly");
  const read = (name: string) => new Promise<unknown[]>((resolve, reject) => { const request = tx.objectStore(name).getAll(); request.onsuccess = () => resolve(request.result); request.onerror = () => reject(request.error); });
  const [projects, revisions] = await Promise.all([read("projects"), read("revisions")]);
  return { projects, revisions };
 } finally { db.close(); }
}
const fixture = {
 loseRendererContext() {
  const canvas=document.querySelector<HTMLCanvasElement>('[data-testid="three-dimensional-canvas"]');
  const extension=canvas?.getContext("webgl2")?.getExtension("WEBGL_lose_context");
  if(!canvas||!extension)throw new Error("Native loss control unavailable");
  restoreNativeContext=()=>new Promise<void>((resolve)=>{canvas.addEventListener("webglcontextrestored",()=>resolve(),{once:true});extension.restoreContext();});extension.loseContext();
 },
 restoreRendererContext() { return restoreNativeContext?.(); },
 selectItem(assetInstanceId: string) {
  if (!currentProject().assetInstances.some((item) => item.assetInstanceId === assetInstanceId)) throw new Error("Missing actual fixture item");
  selectedItemId = assetInstanceId; refresh?.();
 },
 async addSecondItem() {
  const room=currentProject().level.rooms[0];if(!room)throw new Error("Missing actual room");
  const result=await controller.createParametricFloorItem({roomId:room.roomId,label:"Другой стол",xMm:2300,zMm:1500,widthMm:400,depthMm:400,heightMm:750,color:"#9B8579"});if(result.kind!=="durable")throw new Error(`Failed actual second item: ${result.kind}`);
 },
 async mount(withBoundary = true, strict = false, placement = false, withPlacementCallback = true) {
  omitPlacementCallback = !withPlacementCallback;
  enabled = withBoundary; placementMode = placement; placementYaw = 0;
  await controller.create("Scene contact fixture");
  await controller.configureRectangularRoom({ widthMm: "4000", depthMm: "3000", heightMm: "2600" });
  const room = currentProject().level.rooms[0]; if (!room) throw new Error("Missing fixture room");
  const result = await controller.createParametricFloorItem({ roomId: room.roomId, label: "Стол", xMm: 1500, zMm: 1500, widthMm: 400, depthMm: 600, heightMm: 750, color: "#8C7B6B" });
  if (result.kind !== "durable") throw new Error(`Failed fixture item: ${result.kind}`);
  selectedItemId = currentProject().assetInstances[0].assetInstanceId;
  const container = document.getElementById("root"); if (!container) throw new Error("Missing root");
  root = createRoot(container); root.render(strict ? <StrictMode><View /></StrictMode> : <View />);
 },
 suspend() { boundary?.suspend(); }, resume() { boundary?.resume(); },
 invalidate() { boundary?.invalidateContacts(); }, cancel() { boundary?.cancelDraft(); },
 inspect() { return { interaction: boundary?.inspect(), selectedItemId, placementYaw, project: currentProject(), commandEntrySnapshots }; },
 holdNextCommand() { holdNext = true; }, releaseCommand() { releaseCommand?.(); },
 captureNextFrame() { captureFrame = true; },
 replayFrame(index: number) { const callback = heldFrames[index]; if (!callback) throw new Error("Missing held animation callback"); callback(performance.now()); },
 capturePointerListeners() { capturePointerListeners = true; heldPointerListeners.clear(); },
 stopPointerListenerCapture() { capturePointerListeners = false; },
 replayPointerListener(type: "pointerdown" | "pointermove" | "pointerup", point: { readonly x: number; readonly y: number }, pointerId = 1) {
  const callback = heldPointerListeners.get(type); if (typeof callback !== "function") throw new Error("Missing captured native listener");
  Reflect.apply(callback, window, [new PointerEvent(type, { pointerId, pointerType: "mouse", clientX: point.x, clientY: point.y })]);
 },
 async settle() { await Promise.all([...pending]); await new Promise(requestAnimationFrame); },
 resize(width: number) { const container = document.getElementById("root"); if (container) container.style.width = `${width}px`; },
 unmount() { root?.unmount(); root = undefined; },
 durableSnapshot,
};
declare global { interface Window { readonly __editorSceneContactFixture: typeof fixture } }
Object.defineProperty(window, "__editorSceneContactFixture", { value: fixture });
