import { StrictMode, useEffect, useState, type ComponentProps, type ComponentType } from "react";
import { createRoot, type Root } from "react-dom/client";
import { createProductionRuntime } from "../../src/app/production-app";
import type { Project } from "../../src/domain/project";
import { projectRectangularRoomForWebGl } from "../../src/adapters/renderer/rectangular-room-projection";
import { PlanProjection } from "../../src/ui/PlanProjection";
import { RoomScene3d } from "../../src/ui/RoomScene3d";
import type { PlanProjectionProps } from "../../src/ui/editor-plan-presentation";
import { initialEditorViewport } from "../../src/ui/editor-viewport";
import { defaultDrawingDimensionVisibility } from "../../src/ui/drawing-dimension-visibility";
import type { EditorTransientBoundary } from "../../src/ui/editor-host-boundary";
import "../../src/ui/global.css";

// Real common views, controller/use cases and browser IDB in a fresh profile.
// The injected boundary is local; this is not Telegram SDK/physical evidence.
const runtime = createProductionRuntime();
const controller = runtime.controller;
type Registration = { readonly registerTransientBoundary?: (boundary: EditorTransientBoundary) => (() => void) };
const PlanWithBoundary: ComponentType<PlanProjectionProps & Registration> = PlanProjection;
const SceneWithBoundary: ComponentType<ComponentProps<typeof RoomScene3d> & Registration> = RoomScene3d;
let boundary: EditorTransientBoundary | undefined;
let oldBoundary: EditorTransientBoundary | undefined;
let alternateRegistration = false;
let root: Root | undefined;
let surface: "plan" | "scene" = "plan";
let enabled = true;
let placementMode = false;
let placementYaw = 0;
let selectedItemId = "";
let readOnly = false;
let interactionLocked = false;
let selectedWallId: string | undefined;
let refresh: (() => void) | undefined;
let holdNext = false;
let releaseCommand: (() => void) | undefined;
const pending = new Set<Promise<unknown>>();
const commandEntrySnapshots: unknown[] = [];

function currentProject(): Project {
 const state = controller.snapshot();
 if (state.kind !== "saved" || state.project.schemaVersion !== 1) throw new Error("Missing saved fixture Project");
 return state.project;
}
function register(value: EditorTransientBoundary) {
 boundary = value;
 return () => { if (boundary === value) boundary = undefined; };
}
function registerAlternate(value: EditorTransientBoundary) { return register(value); }
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
 const [viewport, setViewport] = useState(initialEditorViewport);
 const [yaw, setYaw] = useState(0);
 const [, rerender] = useState(0);
 refresh = () => rerender((value) => value + 1);
 useEffect(() => controller.subscribe((state) => { if (state.kind === "saved" && state.project.schemaVersion === 1) setProject(state.project); }), []);
 const registration = enabled ? { registerTransientBoundary: alternateRegistration ? registerAlternate : register } : {};
 const move = (input: { assetInstanceId: string; xMm: number; zMm: number }) => track(() => controller.moveParametricFloorItem(input));
 const rotate = (input: { assetInstanceId: string; yawRadians: number }) => track(() => controller.rotateParametricFloorItem(input));
 const scene = projectRectangularRoomForWebGl(project);
 if (!scene) throw new Error("Missing derived scene");
 return <div style={{ position: "relative", width: "100%", height: "640px" }} id="editor-surface">
  {surface === "plan" ? <PlanWithBoundary {...registration}
   dimensionVisibility={defaultDrawingDimensionVisibility()} openingMoveErrorCopy={(reason) => reason}
   activeTool={placementMode ? "item" : "select"} isInteractionLocked={interactionLocked} isWallMoveMode={false} isWallSplitMode={false} isWallVertexMoveMode={false} movableWallVertexIds={[]}
   openingCreationPreview={undefined} itemDraft={placementMode ? { color: "#8C7B6B", depthMm: 600, heightMm: 750, label: "Несохранённый стол", widthMm: 400, yawRadians: yaw } : undefined} readOnly={readOnly}
   onItemPlacementYawChange={(next) => { placementYaw = next; setYaw(next); }} onCancelItemPlacement={() => { placementMode = false; refresh?.(); }}
   onDrawWall={(input) => track(() => controller.addGeneralWall(input))}
   onDrawingVisibilityChange={() => undefined} onMoveDoorOpening={(input) => track(() => controller.moveDoorOpening(input))}
   onMoveItem={move} onRotateItem={rotate} onMoveWall={async () => false} onMoveWallVertex={async () => false}
   onResolveSplitHostConflict={async () => "rejected"} onSplitWall={async () => ({ kind: "rejected" })}
   onPwaUpdateSafetyChange={() => undefined} onPlaceItem={() => undefined}
   onSelectItem={(id) => { selectedItemId = id; selectedWallId = undefined; refresh?.(); }} onSelectWall={(id) => { selectedWallId = id; if(id) selectedItemId = ""; refresh?.(); }}
   onWallMoveModeChange={() => undefined} onWallSplitModeChange={() => undefined} onWallVertexMoveModeChange={() => undefined}
   project={project} selectedItemId={selectedItemId} selectedWallId={selectedWallId} wallThicknessMm={100} viewport={viewport} setViewport={setViewport}
  /> : <SceneWithBoundary {...registration} scene={scene} selectedItemId={selectedItemId} canTransformSelectedItem
   onMoveItem={(input) => move({ assetInstanceId: input.assetInstanceId, xMm: Math.round(input.xM * 1000), zMm: Math.round(input.zM * 1000) })}
   onRotateItem={rotate} onSelectItem={(id) => { selectedItemId = id; refresh?.(); }} />}
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
 setReadOnly(value: boolean) { readOnly = value; refresh?.(); },
 setInteractionLocked(value: boolean) { interactionLocked = value; refresh?.(); },
 async addSecondItem() {
  const room=currentProject().level.rooms[0];if(!room)throw new Error("Missing actual room");
  const result=await controller.createParametricFloorItem({roomId:room.roomId,label:"Другой стол",xMm:1000,zMm:2300,widthMm:400,depthMm:400,heightMm:750,color:"#9B8579"});if(result.kind!=="durable")throw new Error(`Failed actual second item: ${result.kind}`);
 },
 async mount(view: "plan" | "scene", withBoundary = true, strict = false, placement = false) {
  surface = view; enabled = withBoundary; placementMode = placement; placementYaw = 0; selectedWallId = undefined;
  await controller.create("Contact fixture");
  await controller.configureRectangularRoom({ widthMm: "4000", depthMm: "3000", heightMm: "2600" });
  const room = currentProject().level.rooms[0];
  if (!room) throw new Error("Missing fixture room");
  const result = await controller.createParametricFloorItem({ roomId: room.roomId, label: "Стол", xMm: 1500, zMm: 1500, widthMm: 400, depthMm: 600, heightMm: 750, color: "#8C7B6B" });
  if (result.kind !== "durable") throw new Error(`Failed fixture item: ${result.kind}`);
  selectedItemId = currentProject().assetInstances[0].assetInstanceId;
  const container = document.getElementById("root"); if (!container) throw new Error("Missing root");
  root = createRoot(container); root.render(strict ? <StrictMode><View /></StrictMode> : <View />);
 },
 suspend() { boundary?.suspend(); }, resume() { boundary?.resume(); },
 replaceRegistration() { oldBoundary = boundary; alternateRegistration = !alternateRegistration; refresh?.(); },
 callOld(method: "suspend" | "resume" | "invalidateContacts" | "cancelDraft") { oldBoundary?.[method](); },
 clearSelection() { selectedItemId = ""; refresh?.(); },
 async renameBase() { const result = await controller.renameProject("Changed base"); if (result.kind !== "durable") throw new Error(`Failed independent base mutation: ${result.kind}`); },
 invalidate() { boundary?.invalidateContacts(); }, cancel() { boundary?.cancelDraft(); },
 inspect() { return { interaction: boundary?.inspect(), selectedItemId, selectedWallId, placementYaw, project: currentProject(), commandEntrySnapshots }; },
 holdNextCommand() { holdNext = true; }, releaseCommand() { releaseCommand?.(); },
 async settle() { await Promise.all([...pending]); await new Promise(requestAnimationFrame); },
 resize(width: number) { const container = document.getElementById("root"); if (container) container.style.width = `${width}px`; },
 unmount() { root?.unmount(); root = undefined; },
 durableSnapshot,
};
declare global { interface Window { readonly __editorContactFixture: typeof fixture } }
Object.defineProperty(window, "__editorContactFixture", { value: fixture });
