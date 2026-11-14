import { describe, expect, it } from "vitest";

import {
  applyCommand,
  createEmptyRevision,
  deserializeRevision,
  evaluateOpeningFit,
  reconcileRoomIdentityCandidates,
  serializeRevision,
} from "../src/topology-kernel.js";

const accepted = <T extends { ok: boolean }>(result: T): Extract<T, { ok: true }> => {
  expect(result.ok).toBe(true);
  if (!result.ok) {
    throw new Error("Expected a validated command");
  }
  return result as Extract<T, { ok: true }>;
};

const rejected = <T extends { ok: boolean }>(result: T): Extract<T, { ok: false }> => {
  expect(result.ok).toBe(false);
  if (result.ok) {
    throw new Error("Expected a rejected command");
  }
  return result as Extract<T, { ok: false }>;
};

const addWall = (
  revision: ReturnType<typeof createEmptyRevision>,
  wallId: string,
  start: { xMm: number; zMm: number },
  end: { xMm: number; zMm: number },
  thicknessMm = 100,
  xIntersectionPolicy: "reject" | "split" = "reject",
) =>
  applyCommand(revision, {
    kind: "AddWallSegment",
    wallId,
    start,
    end,
    thicknessMm,
    xIntersectionPolicy,
  });

describe("S-2 topology boundary corpus", () => {
  it("rejects malformed command envelopes and malformed revisions without guessing a policy", () => {
    expect(rejected(applyCommand(createEmptyRevision(), null)).reason).toBe("POLICY_REQUIRED");
    expect(rejected(applyCommand(createEmptyRevision(), { kind: "Unknown" })).reason).toBe("POLICY_REQUIRED");

    const invalidRevision = { schemaVersion: 0, vertices: [], walls: [] };
    const result = rejected(applyCommand(invalidRevision as never, { kind: "Unknown" }));
    expect(result.reason).toBe("SERIALIZATION_INVALID");
    expect(serializeRevision(result.revision)).toBe(serializeRevision(createEmptyRevision()));
  });

  it("rejects invalid rectangular starters at dimension, thickness, existing-plan, and project-boundary edges", () => {
    const empty = createEmptyRevision();
    const cases = [
      { innerWidthMm: 0, innerDepthMm: 1_000, wallThicknessMm: 100, reason: "INVALID_DIMENSION" },
      { innerWidthMm: 1_000, innerDepthMm: 1_000, wallThicknessMm: 19, reason: "INVALID_DIMENSION" },
      { innerWidthMm: 1_000, innerDepthMm: 1_000, wallThicknessMm: 1_001, reason: "INVALID_DIMENSION" },
      { innerWidthMm: 100_000, innerDepthMm: 1_000, wallThicknessMm: 100, reason: "PROJECT_BOUNDS_EXCEEDED" },
    ] as const;

    for (const testCase of cases) {
      const result = rejected(
        applyCommand(empty, { kind: "CreateRectangle", ...testCase }),
      );
      expect(result.reason).toBe(testCase.reason);
      expect(result.revision).toBe(empty);
    }

    const starter = accepted(
      applyCommand(empty, {
        kind: "CreateRectangle",
        innerWidthMm: 1_000,
        innerDepthMm: 1_000,
        wallThicknessMm: 100,
      }),
    );
    expect(
      rejected(
        applyCommand(starter.revision, {
          kind: "CreateRectangle",
          innerWidthMm: 1_000,
          innerDepthMm: 1_000,
          wallThicknessMm: 100,
        }),
      ).reason,
    ).toBe("INVALID_DIMENSION");
  });

  it("rejects invalid wall IDs, thicknesses, bounds, and sub-minimum segments before changing state", () => {
    const empty = createEmptyRevision();
    const cases = [
      {
        command: {
          kind: "AddWallSegment",
          wallId: "",
          start: { xMm: 0, zMm: 0 },
          end: { xMm: 100, zMm: 0 },
          thicknessMm: 100,
          xIntersectionPolicy: "reject",
        },
        reason: "INVALID_DIMENSION",
      },
      {
        command: {
          kind: "AddWallSegment",
          wallId: "thin",
          start: { xMm: 0, zMm: 0 },
          end: { xMm: 100, zMm: 0 },
          thicknessMm: 19,
          xIntersectionPolicy: "reject",
        },
        reason: "INVALID_DIMENSION",
      },
      {
        command: {
          kind: "AddWallSegment",
          wallId: "short",
          start: { xMm: 0, zMm: 0 },
          end: { xMm: 49, zMm: 0 },
          thicknessMm: 100,
          xIntersectionPolicy: "reject",
        },
        reason: "INVALID_DIMENSION",
      },
      {
        command: {
          kind: "AddWallSegment",
          wallId: "outside",
          start: { xMm: 100_000, zMm: 0 },
          end: { xMm: 100_001, zMm: 0 },
          thicknessMm: 100,
          xIntersectionPolicy: "reject",
        },
        reason: "PROJECT_BOUNDS_EXCEEDED",
      },
    ] as const;

    for (const testCase of cases) {
      const result = rejected(applyCommand(empty, testCase.command));
      expect(result.reason).toBe(testCase.reason);
      expect(result.revision).toBe(empty);
    }
  });

  it("rejects collinear interior overlap while allowing a shared endpoint to remain an explicit graph vertex", () => {
    const base = accepted(addWall(createEmptyRevision(), "base", { xMm: 0, zMm: 0 }, { xMm: 1_000, zMm: 0 }));
    const beforeOverlap = serializeRevision(base.revision);
    const overlap = rejected(addWall(base.revision, "overlap", { xMm: 250, zMm: 0 }, { xMm: 750, zMm: 0 }));
    expect(overlap.reason).toBe("COLLINEAR_OVERLAP");
    expect(serializeRevision(overlap.revision)).toBe(beforeOverlap);

    const endpointTouch = accepted(addWall(base.revision, "touch", { xMm: 1_000, zMm: 0 }, { xMm: 1_000, zMm: 500 }));
    expect(endpointTouch.revision.walls).toHaveLength(2);
  });

  it("splits the incoming segment when it crosses an existing endpoint, without treating that T as an X decision", () => {
    const base = accepted(addWall(createEmptyRevision(), "base", { xMm: 0, zMm: 0 }, { xMm: 1_000, zMm: 0 }));
    const result = accepted(
      addWall(base.revision, "vertical", { xMm: 0, zMm: -500 }, { xMm: 0, zMm: 500 }),
    );

    expect(result.revision.walls.map((wall) => wall.id).sort()).toEqual(["base", "vertical@0", "vertical@1"]);
    expect(result.revision.vertices.some((vertex) => vertex.xMm === 0 && vertex.zMm === 0)).toBe(true);
  });

  it("sorts multiple X split points along a segment before generating deterministic pieces", () => {
    const lower = accepted(addWall(createEmptyRevision(), "lower", { xMm: 0, zMm: 0 }, { xMm: 1_000, zMm: 0 }));
    const upper = accepted(addWall(lower.revision, "upper", { xMm: 0, zMm: 1_000 }, { xMm: 1_000, zMm: 1_000 }));
    const result = accepted(
      addWall(
        upper.revision,
        "spine",
        { xMm: 500, zMm: -500 },
        { xMm: 500, zMm: 1_500 },
        100,
        "split",
      ),
    );

    expect(result.revision.walls.map((wall) => wall.id).sort()).toEqual([
      "lower@0",
      "lower@1",
      "spine@0",
      "spine@1",
      "spine@2",
      "upper@0",
      "upper@1",
    ]);
    expect(result.revision.vertices.filter((vertex) => vertex.xMm === 500).map((vertex) => vertex.zMm).sort((a, b) => a - b)).toEqual([
      -500,
      0,
      1_000,
      1_500,
    ]);
  });

  it("makes manual merge failure modes explicit and rejects a merge that would leave a branch at an unsplit junction", () => {
    const left = accepted(addWall(createEmptyRevision(), "left", { xMm: 0, zMm: 0 }, { xMm: 500, zMm: 0 }));
    const right = accepted(addWall(left.revision, "right", { xMm: 500, zMm: 0 }, { xMm: 1_000, zMm: 0 }, 200));

    expect(
      rejected(
        applyCommand(right.revision, {
          kind: "MergeCollinearSegments",
          firstWallId: "left",
          secondWallId: "right",
          mergedWallId: "wrong-thickness",
          mergePolicy: "manual-only",
        }),
      ).reason,
    ).toBe("MERGE_NOT_COLLINEAR");

    expect(
      rejected(
        applyCommand(left.revision, {
          kind: "MergeCollinearSegments",
          firstWallId: "left",
          secondWallId: "missing",
          mergedWallId: "not-used",
          mergePolicy: "manual-only",
        }),
      ).reason,
    ).toBe("WALL_NOT_FOUND");

    expect(
      rejected(
        applyCommand(left.revision, {
          kind: "MergeCollinearSegments",
          firstWallId: "left",
          secondWallId: "left",
          mergedWallId: "not-used",
          mergePolicy: "manual-only",
        }),
      ).reason,
    ).toBe("INVALID_DIMENSION");

    const sameThicknessRight = accepted(addWall(left.revision, "same", { xMm: 500, zMm: 0 }, { xMm: 1_000, zMm: 0 }));
    const branch = accepted(addWall(sameThicknessRight.revision, "branch", { xMm: 500, zMm: 0 }, { xMm: 500, zMm: 500 }));
    const merged = rejected(
      applyCommand(branch.revision, {
        kind: "MergeCollinearSegments",
        firstWallId: "left",
        secondWallId: "same",
        mergedWallId: "merged",
        mergePolicy: "manual-only",
      }),
    );
    expect(merged.reason).toBe("AMBIGUOUS_INTERSECTION");
    expect(merged.revision).toBe(branch.revision);
  });

  it("rejects an unapproved merge policy rather than silently choosing the manual option", () => {
    const wall = accepted(addWall(createEmptyRevision(), "wall", { xMm: 0, zMm: 0 }, { xMm: 500, zMm: 0 }));
    expect(
      rejected(
        applyCommand(wall.revision, {
          kind: "MergeCollinearSegments",
          firstWallId: "wall",
          secondWallId: "wall",
          mergedWallId: "not-used",
          mergePolicy: "automatic",
        } as never),
      ).reason,
    ).toBe("POLICY_REQUIRED");
  });

  it("derives a non-rectangular diagonal face as a centerline candidate and keeps its fingerprint independent of insertion order", () => {
    const first = accepted(addWall(createEmptyRevision(), "a", { xMm: 0, zMm: 1_000 }, { xMm: 1_000, zMm: 2_000 }));
    const second = accepted(addWall(first.revision, "b", { xMm: 1_000, zMm: 2_000 }, { xMm: 2_000, zMm: 1_000 }));
    const third = accepted(addWall(second.revision, "c", { xMm: 2_000, zMm: 1_000 }, { xMm: 1_000, zMm: 0 }));
    const diamond = accepted(addWall(third.revision, "d", { xMm: 1_000, zMm: 0 }, { xMm: 0, zMm: 1_000 }));

    expect(diamond.derivedFaces).toEqual([
      expect.objectContaining({
        areaMm2: 2_000_000,
        faceFingerprint: "0,1000|1000,0|2000,1000|1000,2000",
      }),
    ]);
    expect(diamond.derivedFaces[0]?.usableWidthMm).toBeUndefined();

    const reorderedFirst = accepted(addWall(createEmptyRevision(), "c", { xMm: 2_000, zMm: 1_000 }, { xMm: 1_000, zMm: 0 }));
    const reorderedSecond = accepted(addWall(reorderedFirst.revision, "a", { xMm: 0, zMm: 1_000 }, { xMm: 1_000, zMm: 2_000 }));
    const reorderedThird = accepted(addWall(reorderedSecond.revision, "d", { xMm: 1_000, zMm: 0 }, { xMm: 0, zMm: 1_000 }));
    const reorderedDiamond = accepted(addWall(reorderedThird.revision, "b", { xMm: 1_000, zMm: 2_000 }, { xMm: 2_000, zMm: 1_000 }));
    expect(reorderedDiamond.derivedFaces[0]?.faceFingerprint).toBe(diamond.derivedFaces[0]?.faceFingerprint);
  });

  it("does not apply rectangular usable-area arithmetic to a face with mixed wall thicknesses", () => {
    const bottom = accepted(addWall(createEmptyRevision(), "bottom", { xMm: 0, zMm: 0 }, { xMm: 2_000, zMm: 0 }, 100));
    const right = accepted(addWall(bottom.revision, "right", { xMm: 2_000, zMm: 0 }, { xMm: 2_000, zMm: 2_000 }, 200));
    const top = accepted(addWall(right.revision, "top", { xMm: 2_000, zMm: 2_000 }, { xMm: 0, zMm: 2_000 }, 100));
    const mixed = accepted(addWall(top.revision, "left", { xMm: 0, zMm: 2_000 }, { xMm: 0, zMm: 0 }, 100));

    expect(mixed.derivedFaces).toEqual([
      expect.objectContaining({ areaMm2: 4_000_000 }),
    ]);
    expect(mixed.derivedFaces[0]?.usableWidthMm).toBeUndefined();
  });

  it("only carries an existing Room ID for an exact face-fingerprint match", () => {
    const matched = reconcileRoomIdentityCandidates(
      [{ roomId: "r-1", faceFingerprint: "same" }],
      [{ faceFingerprint: "same", boundaryVertexIds: [], areaMm2: 1 }],
    );
    expect(matched).toEqual({ kind: "matched", inheritedRoomIds: ["r-1"] });

    const unmatched = reconcileRoomIdentityCandidates(
      [{ roomId: "r-1", faceFingerprint: "old" }],
      [{ faceFingerprint: "new", boundaryVertexIds: [], areaMm2: 1 }],
    );
    expect(unmatched).toEqual({ kind: "ambiguous", reason: "ROOM_IDENTITY_AMBIGUOUS", inheritedRoomIds: [] });
  });

  it("checks every opening boundary rather than only height", () => {
    const base = {
      wallLengthMm: 2_000,
      adjacentRoomHeightsMm: [2_400, 2_400] as const,
    };
    expect(
      evaluateOpeningFit({ ...base, opening: { offsetMm: -1, widthMm: 800, heightMm: 2_000, sillMm: 0 } }),
    ).toEqual({ ok: false, reason: "OPENING_OUT_OF_BOUNDS" });
    expect(
      evaluateOpeningFit({ ...base, opening: { offsetMm: 0, widthMm: 800, heightMm: 2_000, sillMm: -1 } }),
    ).toEqual({ ok: false, reason: "OPENING_OUT_OF_BOUNDS" });
    expect(
      evaluateOpeningFit({ ...base, opening: { offsetMm: 1_200, widthMm: 800, heightMm: 2_000, sillMm: 400 } }),
    ).toEqual({ ok: true, wallHeightMm: 2_400, openingHeightLimitMm: 2_400 });
  });

  it("normalizes serialization order and refuses malformed or topologically invalid serialized revisions", () => {
    const unordered = {
      schemaVersion: 1 as const,
      vertices: [
        { id: "v-2", xMm: 1_000, zMm: 0 },
        { id: "v-1", xMm: 0, zMm: 0 },
      ],
      walls: [{ id: "w-1", startVertexId: "v-1", endVertexId: "v-2", thicknessMm: 100 }],
    };
    expect(serializeRevision(unordered)).toBe(
      "{\"schemaVersion\":1,\"vertices\":[{\"id\":\"v-1\",\"xMm\":0,\"zMm\":0},{\"id\":\"v-2\",\"xMm\":1000,\"zMm\":0}],\"walls\":[{\"id\":\"w-1\",\"startVertexId\":\"v-1\",\"endVertexId\":\"v-2\",\"thicknessMm\":100}]}",
    );

    const invalidSerializations = [
      "not-json",
      JSON.stringify({ schemaVersion: 2, vertices: [], walls: [] }),
      JSON.stringify({ schemaVersion: 1, vertices: "wrong", walls: [] }),
      JSON.stringify({
        schemaVersion: 1,
        vertices: [{ id: "v-1", xMm: 0, zMm: 0 }],
        walls: [{ id: "w-1", startVertexId: "v-1", endVertexId: "missing", thicknessMm: 100 }],
      }),
      JSON.stringify({
        schemaVersion: 1,
        vertices: [
          { id: "v-1", xMm: 0, zMm: 0 },
          { id: "v-2", xMm: 0, zMm: 0 },
        ],
        walls: [],
      }),
      JSON.stringify({
        schemaVersion: 1,
        vertices: [
          { id: "v-1", xMm: 0, zMm: 0 },
          { id: "v-2", xMm: 100, zMm: 100 },
          { id: "v-3", xMm: 0, zMm: 100 },
          { id: "v-4", xMm: 100, zMm: 0 },
        ],
        walls: [
          { id: "a", startVertexId: "v-1", endVertexId: "v-2", thicknessMm: 100 },
          { id: "b", startVertexId: "v-3", endVertexId: "v-4", thicknessMm: 100 },
        ],
      }),
    ];

    for (const serialized of invalidSerializations) {
      expect(deserializeRevision(serialized)).toEqual({ ok: false, reason: "SERIALIZATION_INVALID" });
    }
  });
});
