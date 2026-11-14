import { test, expect, withReaderPublicBody as withReadonlyBodyProof, completing } from "../verification/reader-public-regressions-native-test";
// Dedicated8 public callback bodies; old7 and donor33/41 retain their own identities.
import type {} from "./browser-readonly-public-oracles";
for (const storageNamespace of ["legacy", "browser-registered"] as const) {
 test(`BROWSER-READONLY-DIRECTORY-${storageNamespace}: actual producer Projects sort newest first with stable ID ties`, withReadonlyBodyProof(async ({page}) => {
  const actual = await completing(page.evaluate(owner => window.__browserReadonlyPublicOracles.directory(owner), storageNamespace));
  expect(actual.directory.status).toEqual({storageNamespace,kind:"available"});
  expect(actual.directory.projects).toHaveLength(3);
  expect(actual.directory.projects.map(row=>row.projectId)).toEqual(actual.expectedIds);
  expect(actual.directory.projects.map(row=>row.updatedAt)).toEqual([actual.later,actual.earlier,actual.earlier]);
  expect(actual.before).toEqual(actual.after);
  expect(actual.modes.length).toBeGreaterThan(0);
  expect(actual.modes.every(mode=>mode==="readonly")).toBe(true);
  expect(actual.opens.every(open=>open.version===undefined)).toBe(true);
  expect(actual.upgrades).toEqual([]);
 }));
 test(`BROWSER-READONLY-EXPECTED-REVISION-${storageNamespace}: a wrong expected Revision never exports current bytes`, withReadonlyBodyProof(async ({page}) => {
  const actual=await completing(page.evaluate(owner=>window.__browserReadonlyPublicOracles.wrongRevision(owner),storageNamespace));
  expect(actual.control.kind).toBe("ready");
  expect(actual.result).toEqual({kind:"verification-unavailable"});
  expect(actual.before).toEqual(actual.after);
  expect(actual.modes.every(mode=>mode==="readonly")).toBe(true);
  expect(actual.upgrades).toEqual([]);
 }));
 test(`BROWSER-READONLY-EXPORT-CAS-${storageNamespace}: actual Durable R2 before formatter delivery prevents stale R1 ready bytes`, withReadonlyBodyProof(async ({page}) => {
  const actual=await completing(page.evaluate(owner=>window.__browserReadonlyPublicOracles.exportCas(owner),storageNamespace));
  expect(actual.control.kind).toBe("ready");
  expect(actual.phase).toBe("formatter-held");
  expect(actual.heldFormatterKind).toBe("encoded");
  expect(actual.produced).toMatchObject({kind:"durable"});
  expect(actual.revisionBefore).not.toBe(actual.revisionAfter);
  expect(actual.result).toEqual({kind:"verification-unavailable"});
  expect(actual.afterProducer).toEqual(actual.afterReader);
  expect(actual.modes.every(mode=>mode==="readonly")).toBe(true);
  expect(actual.upgrades).toEqual([]);
 }));
 test(`BROWSER-READONLY-NO-INVENTORY-${storageNamespace}: actual absent native open aborts v0 without leaving a provisioned DB`, withReadonlyBodyProof(async ({page}) => {
  const actual=await completing(page.evaluate(owner=>window.__browserReadonlyPublicOracles.absentNoInventory(owner),storageNamespace));
  expect(actual.beforeNames).not.toContain(actual.name);
  expect(actual.afterNames).not.toContain(actual.name);
  expect(actual.directory.projects).toEqual([]);
  expect(actual.directory.status).toEqual(storageNamespace==="legacy"?{storageNamespace,kind:"available"}:{storageNamespace,kind:"not-provisioned",history:"unknown"});
  expect(actual.signalAborted).toBe(false);
  expect(actual.knownFailure).toBeUndefined();
  expect(actual.opens).toEqual([{name:actual.name,version:undefined}]);
  expect(actual.upgrades).toEqual([actual.name]);
 }));
}
