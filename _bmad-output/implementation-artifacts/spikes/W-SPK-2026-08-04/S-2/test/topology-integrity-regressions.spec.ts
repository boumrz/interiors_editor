import { describe, expect, it } from "vitest";

import {
  applyCommand,
  createEmptyRevision,
  deserializeRevision,
  serializeRevision,
} from "../src/topology-kernel.js";

const serial = (vertices: unknown[], walls: unknown[]) => JSON.stringify({ schemaVersion: 1, vertices, walls });

describe("S-2 planar integrity regressions", () => {
  it("rejects unsplit exact T and X crossings even when a stray Vertex shares the crossing coordinate", () => {
    const unsplitT = serial(
      [
        { id: "v-1", xMm: 0, zMm: 0 },
        { id: "v-2", xMm: 1_000, zMm: 0 },
        { id: "v-3", xMm: 500, zMm: 0 },
        { id: "v-4", xMm: 500, zMm: 500 },
      ],
      [
        { id: "horizontal", startVertexId: "v-1", endVertexId: "v-2", thicknessMm: 100 },
        { id: "vertical", startVertexId: "v-3", endVertexId: "v-4", thicknessMm: 100 },
      ],
    );
    const unsplitX = serial(
      [
        { id: "v-1", xMm: 0, zMm: 0 },
        { id: "v-2", xMm: 1_000, zMm: 1_000 },
        { id: "v-3", xMm: 0, zMm: 1_000 },
        { id: "v-4", xMm: 1_000, zMm: 0 },
        { id: "v-5", xMm: 500, zMm: 500 },
      ],
      [
        { id: "descending", startVertexId: "v-1", endVertexId: "v-2", thicknessMm: 100 },
        { id: "ascending", startVertexId: "v-3", endVertexId: "v-4", thicknessMm: 100 },
      ],
    );

    for (const corruptedTopology of [unsplitT, unsplitX]) {
      expect(deserializeRevision(corruptedTopology)).toEqual({ ok: false, reason: "SERIALIZATION_INVALID" });
    }
  });

  it("returns a stable rejection instead of throwing for a fractional in-memory Revision", () => {
    const fractionalRevision = {
      schemaVersion: 1,
      vertices: [
        { id: "v-1", xMm: 0.5, zMm: 0 },
        { id: "v-2", xMm: 1_000, zMm: 0 },
      ],
      walls: [{ id: "existing", startVertexId: "v-1", endVertexId: "v-2", thicknessMm: 100 }],
    };

    const result = applyCommand(fractionalRevision as never, {
      kind: "AddWallSegment",
      wallId: "crossing",
      start: { xMm: 500, zMm: -500 },
      end: { xMm: 500, zMm: 500 },
      thicknessMm: 100,
      xIntersectionPolicy: "split",
    });

    expect(result).toMatchObject({ ok: false, reason: "SERIALIZATION_INVALID" });
    expect(serializeRevision(result.revision)).toBe(serializeRevision(createEmptyRevision()));
  });

  it.each([
    ["a null envelope", null],
    ["an unsupported schema version", { schemaVersion: 2, vertices: [], walls: [] }],
    ["a non-array vertex collection", { schemaVersion: 1, vertices: {}, walls: [] }],
    ["a non-array wall collection", { schemaVersion: 1, vertices: [], walls: {} }],
    [
      "a fractional wall thickness",
      {
        schemaVersion: 1,
        vertices: [
          { id: "v-1", xMm: 0, zMm: 0 },
          { id: "v-2", xMm: 1_000, zMm: 0 },
        ],
        walls: [{ id: "fractional-thickness", startVertexId: "v-1", endVertexId: "v-2", thicknessMm: 100.5 }],
      },
    ],
  ])("rejects %s before executing a command", (_label, revision) => {
    const empty = serializeRevision(createEmptyRevision());

    const result = applyCommand(revision as never, {
      kind: "AddWallSegment",
      wallId: "candidate",
      start: { xMm: 0, zMm: 0 },
      end: { xMm: 500, zMm: 0 },
      thicknessMm: 100,
      xIntersectionPolicy: "split",
    });

    expect(result).toMatchObject({ ok: false, reason: "SERIALIZATION_INVALID" });
    expect(serializeRevision(result.revision)).toBe(empty);
  });
});
