import { completeReadonlyUnitOperation } from "../../../tests/verification/readonly-public-unit-completion";
import { describe, expect, it } from "@rstest/core";
import { createInitialProject } from "../../domain/initial-project";
import { serializeProjectCanonically } from "../../domain/canonical-serialization";
import { configureRectangularRoom } from "../../domain/rectangular-room";
import { applyInteriorCommand } from "../../domain/interior-project";
import type { Project } from "../../domain/project";
import { verifiedReadonlyTestScope } from "../../../tests/fixtures/telegram-readonly-signed-launch";
import {
 readUnverifiedTelegramSnapshot,
 verifyTelegramReadonlyCurrentSnapshot as unboundedVerifyTelegramReadonlyCurrentSnapshot,
 readTelegramReadonlyResourceRow,
 sameTelegramReadonlySnapshot,
} from "./telegram-readonly-project-snapshot";

function verifyTelegramReadonlyCurrentSnapshot(...args: Parameters<typeof unboundedVerifyTelegramReadonlyCurrentSnapshot>) { return completeReadonlyUnitOperation(unboundedVerifyTelegramReadonlyCurrentSnapshot(...args)); }

const checksum = { async sha256(text: string) {
 const bytes = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(text));
 return Array.from(new Uint8Array(bytes), byte => byte.toString(16).padStart(2, "0")).join("");
} };
// Unit record fixture only; the separate native case uses the actual repository producer.
async function snapshot(update: (project: Project) => Project = project => project) {
 const scope = await verifiedReadonlyTestScope(), projectId = "unit-project\ud800";
 const project = update(createInitialProject({ projectId, levelId: "level", name: "Readonly Project", createdAt: "2026-11-05T00:00:00.000Z" }));
 const serializedProject = serializeProjectCanonically(project), digest = await checksum.sha256(serializedProject);
 const candidate = { project, revision: { schemaVersion: 1 as const, projectId, revisionId: "revision", createdAt: project.createdAt, serializedProject, checksum: digest } };
 const creationAttemptId = `tma-v1:${scope}:attempt:1`;
 const creation = { protocolVersion: 1, scope, projectId, attemptId: creationAttemptId, ownerId: "11111111-1111-4111-8111-111111111111", fencingToken: 1, expectedBaseRevisionId: null, revisionId: "revision", checksum: digest, serializedProject, resourceManifest: [], intent: "mutation", state: "published", receipt: { revisionId: "revision", checksum: digest, resourceManifest: [] } };
 return { scope, projectId, pointer: { scope, projectId, currentRevisionId: "revision", name: project.name }, revision: { scope, projectId, revisionId: "revision", creationAttemptId, resourceManifest: [], candidate }, creation };
}

describe("readonly Telegram snapshot proof", () => {
 it("accepts an exact published current snapshot without changing its Project or UTF16 identity", async () => {
  const input = await snapshot(), before = serializeProjectCanonically(input.revision.candidate.project);
  const result = await verifyTelegramReadonlyCurrentSnapshot(input, checksum);
  expect(result?.candidate).toBe(input.revision.candidate);
  expect(result?.candidate.project.projectId).toBe("unit-project\ud800");
  expect(serializeProjectCanonically(input.revision.candidate.project)).toBe(before);
 });
 it("proves the original custom wall receipt only in the storage version that owns its format", async () => {
  const input = await snapshot(project => {
   let next = 0;
   const ids = { next: () => `room-element-${++next}` };
   const room = configureRectangularRoom(project, { widthMm: "4000", depthMm: "3000", heightMm: "2500" }, ids, project.updatedAt);
   if (room.kind !== "accepted") throw Error("Expected a closed room");
   const wallSegmentId = room.project.level.wallSegments[0]?.wallSegmentId;
   if (!wallSegmentId) throw Error("Expected a physical wall");
   const colored = applyInteriorCommand(room.project, {
    kind: "set-wall-finish", wallSegmentId, side: "left", finish: { color: "#1b2c3d", version: 2 },
   }, ids, project.updatedAt);
   if (colored.kind !== "accepted") throw Error("Expected a new wall color");
   return colored.project;
  });
  expect(await verifyTelegramReadonlyCurrentSnapshot(input, checksum, 6)).toBeUndefined();
  expect((await verifyTelegramReadonlyCurrentSnapshot(input, checksum, 7))?.candidate).toBe(input.revision.candidate);
  const altered = { ...input, creation: { ...input.creation, serializedProject: input.creation.serializedProject.replace("#1b2c3d", "#abcdef") } };
  expect(await verifyTelegramReadonlyCurrentSnapshot(altered, checksum, 7)).toBeUndefined();
 });
 it("requires the original published creation receipt rather than a prepared or internally mismatched record", async () => {
  const input = await snapshot();
  for (const creation of [undefined, { ...input.creation, state: "prepared", receipt: undefined }, { ...input.creation, checksum: "other", receipt: { ...input.creation.receipt, checksum: "other" } }, { ...input.creation, receipt: { ...input.creation.receipt, revisionId: "other" } }]) {
   expect(await verifyTelegramReadonlyCurrentSnapshot({ ...input, creation }, checksum)).toBeUndefined();
  }
  expect(readUnverifiedTelegramSnapshot(input, "revision")?.serializedProject).toBe(input.revision.candidate.revision.serializedProject);
 });
 it("refuses borrowed pointer, Revision or candidate identity even if the other fields still look valid", async () => {
  const input = await snapshot();
  const faults = [
   { ...input, pointer: { ...input.pointer, scope: "foreign" } },
   { ...input, pointer: { ...input.pointer, currentRevisionId: "other" } },
   { ...input, revision: { ...input.revision, projectId: "foreign" } },
   { ...input, revision: { ...input.revision, candidate: { ...input.revision.candidate, project: { ...input.revision.candidate.project, projectId: "foreign" } } } },
   { ...input, revision: { ...input.revision, candidate: { ...input.revision.candidate, revision: { ...input.revision.candidate.revision, revisionId: "other" } } } },
  ];
  for (const fault of faults) {
   expect(await verifyTelegramReadonlyCurrentSnapshot(fault, checksum)).toBeUndefined();
   expect(readUnverifiedTelegramSnapshot(fault, "revision")).toBeUndefined();
  }
 });
 it("does not make an invalid Project healthy merely because its row and receipt checksums agree", async () => {
  const input = await snapshot(), invalid = { ...input.revision.candidate.project, unrelated: true };
  const serializedProject = JSON.stringify(invalid), digest = await checksum.sha256(serializedProject);
  const changed = { ...input, revision: { ...input.revision, candidate: { project: invalid, revision: { ...input.revision.candidate.revision, serializedProject, checksum: digest } } }, creation: { ...input.creation, serializedProject, checksum: digest, receipt: { ...input.creation.receipt, checksum: digest } } };
  expect(await verifyTelegramReadonlyCurrentSnapshot(changed, checksum)).toBeUndefined();
  expect(readUnverifiedTelegramSnapshot(changed, "revision")?.serializedProject).toBe(serializedProject);
 });
 it("keeps a corrupt original JS string unverified and exact while enforcing the selected Revision CAS", async () => {
  const input = await snapshot(), serializedProject = " \u0000bad-json\ud800😀\n";
  const rows = { ...input, revision: { ...input.revision, candidate: { ...input.revision.candidate, revision: { ...input.revision.candidate.revision, serializedProject } } } };
  expect(readUnverifiedTelegramSnapshot(rows, "revision")).toEqual({ kind: "unverified-source", projectId: input.projectId, revisionId: "revision", serializedProject });
  expect(readUnverifiedTelegramSnapshot(rows, "stale")).toBeUndefined();
  expect(await verifyTelegramReadonlyCurrentSnapshot(rows, checksum)).toBeUndefined();
 });
 it("does not prove a sparse publication manifest as the empty exact resource manifest", async () => {
  const input = await snapshot();
  const sparse = Array<unknown>(1);
  expect(sparse.length).toBe(1);
  expect(Object.keys(sparse)).toEqual([]);
  const rows = { ...input, revision: { ...input.revision, resourceManifest: sparse }, creation: { ...input.creation, resourceManifest: sparse, receipt: { ...input.creation.receipt, resourceManifest: sparse } } };
  expect(await verifyTelegramReadonlyCurrentSnapshot(rows, checksum)).toBeUndefined();
 });
 it("the exact final source comparison distinguishes an empty item array from a new sparse slot", async () => {
  const before = await snapshot(), changed = structuredClone(before);
  Object.defineProperty(changed.revision.candidate.project.assetInstances, "length", { value: 1 });
  expect(Object.keys(changed.revision.candidate.project.assetInstances)).toEqual([]);
  expect(sameTelegramReadonlySnapshot(before, changed)).toBe(false);
 });
 it("a record-shaped imitation of a manifest cannot stand in for its array", async () => {
  const input = await snapshot();
  expect(await verifyTelegramReadonlyCurrentSnapshot({ ...input, revision: { ...input.revision, resourceManifest: {} } }, checksum)).toBeUndefined();
  expect(sameTelegramReadonlySnapshot([], {})).toBe(false);
 });
 it("extra enumerable manifest properties remain unsupported even with no indexed resources", async () => {
  const input = await snapshot(), manifest: unknown[] = [];
  Object.defineProperty(manifest, "extra", { value: true, enumerable: true });
  expect(await verifyTelegramReadonlyCurrentSnapshot({ ...input, revision: { ...input.revision, resourceManifest: manifest } }, checksum)).toBeUndefined();
 });
 it("checks each original resource key and rooted native metadata without reading Blob bytes", async () => {
  const { scope } = await snapshot(), resourceHash = "A".repeat(64), blob = new Blob([new Uint8Array([1, 2, 3])]);
  const lease = `tma-v1:${scope}:lease:2`, row = { scope, resourceHash, byteLength: 3, blob, version: lease, creationLeaseId: lease, roots: [], durable: true };
  expect(readTelegramReadonlyResourceRow(scope, { resourceHash, byteLength: 3 }, row)).toEqual(row);
  expect(readTelegramReadonlyResourceRow(scope, { resourceHash, byteLength: 3 }, row)?.blob).toBe(blob);
  expect(readTelegramReadonlyResourceRow(scope, { resourceHash: resourceHash.toLowerCase(), byteLength: 3 }, row)).toBeUndefined();
  expect(readTelegramReadonlyResourceRow(scope, { resourceHash: `${resourceHash}\n`, byteLength: 3 }, { ...row, resourceHash: `${resourceHash}\n` })).toBeUndefined();
  for (const corrupt of [{ ...row, scope: "foreign" }, { ...row, byteLength: 2 }, { ...row, version: "foreign" }, { ...row, durable: false }, { ...row, extra: true }]) expect(readTelegramReadonlyResourceRow(scope, { resourceHash, byteLength: 3 }, corrupt)).toBeUndefined();
 });
 it("requires actual dense lease roots rather than sparse length or extra own metadata properties", async () => {
  const { scope } = await snapshot(), resourceHash = "A".repeat(64), blob = new Blob([new Uint8Array([1, 2, 3])]);
  const lease = `tma-v1:${scope}:lease:2`, value = { scope, resourceHash, byteLength: 3, blob, version: lease, creationLeaseId: lease, roots: [lease], durable: false };
  expect(readTelegramReadonlyResourceRow(scope, { resourceHash, byteLength: 3 }, value)).toEqual(value);
  const sparse: unknown[] = Array(1), extra = [lease], disguised = [lease];
  Object.defineProperty(extra, "extra", { value: lease, enumerable: true });
  Object.defineProperty(disguised, "length", { value: 2 });
  Object.defineProperty(disguised, "extra", { value: lease, enumerable: true });
  for (const roots of [sparse, extra, disguised]) {
   expect(readTelegramReadonlyResourceRow(scope, { resourceHash, byteLength: 3 }, { ...value, roots })).toBeUndefined();
  }
 });

});


describe("readonly snapshot public proof boundaries", () => {
 it("never promotes extra or array-shaped native pointer, Revision or candidate records into a healthy Project", async () => {
  const input = await snapshot();
  for (const pointer of [{ ...input.pointer, unexpected: true }, Object.assign([], input.pointer), null]) {
   expect(await verifyTelegramReadonlyCurrentSnapshot({ ...input, pointer }, checksum)).toBeUndefined();
  }
  for (const revision of [{ ...input.revision, unexpected: true }, Object.assign([], input.revision), { ...input.revision, scope: "foreign" }, { ...input.revision, revisionId: "other" }, { ...input.revision, creationAttemptId: "other" }, { ...input.revision, candidate: Object.assign([], input.revision.candidate) }]) {
   expect(await verifyTelegramReadonlyCurrentSnapshot({ ...input, revision }, checksum)).toBeUndefined();
  }
  expect(await verifyTelegramReadonlyCurrentSnapshot({ ...input, pointer: { ...input.pointer, name: "Borrowed title" } }, checksum)).toBeUndefined();
  expect((await verifyTelegramReadonlyCurrentSnapshot(input, checksum))?.candidate).toBe(input.revision.candidate);
 });
 it("requires every original creation-receipt identity and protocol field, without accepting an unknown ownership shape", async () => {
  const input = await snapshot(), creation = input.creation;
  const corrupt = [
   { ...creation, protocolVersion: 2 }, { ...creation, projectId: "other" }, { ...creation, attemptId: "foreign" },
   { ...creation, ownerId: 1 }, { ...creation, fencingToken: 0 }, { ...creation, fencingToken: 0.5 }, { ...creation, fencingToken: NaN },
   { ...creation, expectedBaseRevisionId: 1 }, { ...creation, revisionId: "other" }, { ...creation, serializedProject: "changed" },
   { ...creation, intent: "history" }, { ...creation, state: "no-publish" }, { ...creation, unexpected: true }, Object.assign([], creation),
   { ...creation, leaseId: "foreign" }, { ...creation, leaseId: undefined }, { ...creation, receipt: undefined },
   { ...creation, receipt: { ...creation.receipt, checksum: "other" } }, { ...creation, receipt: { ...creation.receipt, extra: true } },
   { ...creation, receipt: { ...creation.receipt, resourceManifest: [{ resourceHash: "a".repeat(64), byteLength: 1 }] } },
  ];
  for (const value of corrupt) {
   expect(await verifyTelegramReadonlyCurrentSnapshot({ ...input, creation: value }, checksum)).toBeUndefined();
   expect(readUnverifiedTelegramSnapshot({ ...input, creation: value }, "revision")?.serializedProject).toBe(input.revision.candidate.revision.serializedProject);
  }
  const foreignAttempt = { ...input, revision: { ...input.revision, creationAttemptId: "foreign:attempt:1" }, creation: { ...creation, attemptId: "foreign:attempt:1" } };
  expect(await verifyTelegramReadonlyCurrentSnapshot(foreignAttempt, checksum)).toBeUndefined();
  expect((await verifyTelegramReadonlyCurrentSnapshot({ ...input, creation: { ...creation, expectedBaseRevisionId: "previous-revision", leaseId: `tma-v1:${input.scope}:lease:8` } }, checksum))?.candidate).toBe(input.revision.candidate);
  const { expectedBaseRevisionId: _removed, ...missingRequiredField } = creation;
  expect(await verifyTelegramReadonlyCurrentSnapshot({ ...input, creation: missingRequiredField }, checksum)).toBeUndefined();
  expect((await verifyTelegramReadonlyCurrentSnapshot(input, checksum))?.candidate).toBe(input.revision.candidate);
 });
 it("requires exact original resource ownership fields, dense distinct scoped roots and a genuine matching Blob", async () => {
  const { scope } = await snapshot(), resourceHash = "a".repeat(64), blob = new Blob([new Uint8Array([1, 2, 3])]);
  const lease = `tma-v1:${scope}:lease:7`, expected = { resourceHash, byteLength: 3 };
  const value = { scope, resourceHash, byteLength: 3, blob, version: lease, creationLeaseId: lease, roots: [lease], durable: false };
  for (const changed of [
   { ...value, resourceHash: 1 }, { ...value, byteLength: "3" }, { ...value, byteLength: 0 },
   { ...value, blob: { size: 3 } }, { ...value, blob: new Blob([new Uint8Array([1, 2])]) },
   { ...value, version: 7 }, { ...value, creationLeaseId: "foreign" }, { ...value, creationLeaseId: 7 },
   { ...value, roots: {} }, { ...value, roots: [lease, lease] }, { ...value, roots: [7] }, { ...value, roots: ["foreign"] },
   { ...value, durable: "false" }, Object.assign([], value),
  ]) expect(readTelegramReadonlyResourceRow(scope, expected, changed)).toBeUndefined();
  expect(readTelegramReadonlyResourceRow(scope, expected, value)?.blob).toBe(blob);
  expect(readTelegramReadonlyResourceRow(scope, expected, { ...value, roots: [], durable: true })?.blob).toBe(blob);
 });
});
