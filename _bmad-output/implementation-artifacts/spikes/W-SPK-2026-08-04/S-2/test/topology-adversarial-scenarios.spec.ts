import { describe, expect, it } from "vitest";

import {
  applyCommand,
  createEmptyRevision,
  deserializeRevision,
  evaluateOpeningFit,
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

const serial = (vertices: unknown[], walls: unknown[]) => JSON.stringify({ schemaVersion: 1, vertices, walls });

describe("S-2 topology adversarial regression corpus", () => {
  it("materializes the rectangular starter with exact canonical vertices, wall identities, and usable-face metrics", () => {
    const starter = accepted(
      applyCommand(createEmptyRevision(), {
        kind: "CreateRectangle",
        innerWidthMm: 4_000,
        innerDepthMm: 3_000,
        wallThicknessMm: 100,
      }),
    );

    expect(starter.revision).toEqual({
      schemaVersion: 1,
      vertices: [
        { id: "v-1", xMm: 0, zMm: 0 },
        { id: "v-2", xMm: 4_100, zMm: 0 },
        { id: "v-3", xMm: 4_100, zMm: 3_100 },
        { id: "v-4", xMm: 0, zMm: 3_100 },
      ],
      walls: [
        { id: "w-1", startVertexId: "v-1", endVertexId: "v-2", thicknessMm: 100 },
        { id: "w-2", startVertexId: "v-2", endVertexId: "v-3", thicknessMm: 100 },
        { id: "w-3", startVertexId: "v-3", endVertexId: "v-4", thicknessMm: 100 },
        { id: "w-4", startVertexId: "v-4", endVertexId: "v-1", thicknessMm: 100 },
      ],
    });
    expect(starter.derivedFaces).toEqual([
      {
        faceFingerprint: "0,0|4100,0|4100,3100|0,3100",
        boundaryVertexIds: ["v-1", "v-2", "v-3", "v-4"],
        areaMm2: 12_000_000,
        usableWidthMm: 4_000,
        usableDepthMm: 3_000,
      },
    ]);
  });

  it("rejects each independently invalid opening value while accepting the exact top and side boundaries", () => {
    const valid = {
      wallLengthMm: 2_000,
      adjacentRoomHeightsMm: [2_400, 2_600] as const,
      opening: { offsetMm: 1_200, widthMm: 800, heightMm: 2_400, sillMm: 0 },
    };
    expect(evaluateOpeningFit(valid)).toEqual({ ok: true, wallHeightMm: 2_600, openingHeightLimitMm: 2_400 });

    const invalidInputs = [
      { ...valid, wallLengthMm: 0 },
      { ...valid, adjacentRoomHeightsMm: [0, 2_600] as const },
      { ...valid, adjacentRoomHeightsMm: [2_400, 0] as const },
      { ...valid, opening: { ...valid.opening, offsetMm: 1.5 } },
      { ...valid, opening: { ...valid.opening, widthMm: 0 } },
      { ...valid, opening: { ...valid.opening, heightMm: 0 } },
      { ...valid, opening: { ...valid.opening, sillMm: 0.5 } },
    ];
    for (const input of invalidInputs) {
      expect(evaluateOpeningFit(input)).toEqual({ ok: false, reason: "OPENING_OUT_OF_BOUNDS" });
    }
  });

  it("rejects malformed wall points and a reused wall ID without mutating the existing revision", () => {
    const first = accepted(addWall(createEmptyRevision(), "existing", { xMm: 0, zMm: 0 }, { xMm: 500, zMm: 0 }));
    const before = serializeRevision(first.revision);
    const malformed = rejected(
      applyCommand(first.revision, {
        kind: "AddWallSegment",
        wallId: "malformed",
        start: { xMm: "0", zMm: 0 },
        end: { xMm: 500, zMm: 0 },
        thicknessMm: 100,
        xIntersectionPolicy: "reject",
      } as never),
    );
    expect(malformed.reason).toBe("INVALID_DIMENSION");
    expect(serializeRevision(malformed.revision)).toBe(before);

    const reusedId = rejected(
      addWall(first.revision, "existing", { xMm: 1_000, zMm: 0 }, { xMm: 1_500, zMm: 0 }),
    );
    expect(reusedId.reason).toBe("INVALID_DIMENSION");
    expect(serializeRevision(reusedId.revision)).toBe(before);
  });

  it("handles negative-denominator X intersection math with the same explicit split behavior", () => {
    const first = accepted(
      addWall(createEmptyRevision(), "descending", { xMm: 1_000, zMm: 1_000 }, { xMm: 0, zMm: 0 }),
    );
    const split = accepted(
      addWall(first.revision, "ascending", { xMm: 1_000, zMm: 0 }, { xMm: 0, zMm: 1_000 }, 100, "split"),
    );

    expect(split.revision.walls.map((wall) => wall.id).sort()).toEqual([
      "ascending@0",
      "ascending@1",
      "descending@0",
      "descending@1",
    ]);
    expect(split.revision.vertices).toContainEqual(expect.objectContaining({ xMm: 500, zMm: 500 }));
  });

  it("detects collinear overlap no matter which segment contains the other and across vertical coordinates", () => {
    const contained = accepted(addWall(createEmptyRevision(), "contained", { xMm: 250, zMm: 0 }, { xMm: 750, zMm: 0 }));
    expect(
      rejected(addWall(contained.revision, "outer", { xMm: 0, zMm: 0 }, { xMm: 1_000, zMm: 0 })).reason,
    ).toBe("COLLINEAR_OVERLAP");

    const vertical = accepted(addWall(createEmptyRevision(), "vertical", { xMm: 0, zMm: 250 }, { xMm: 0, zMm: 750 }));
    expect(
      rejected(addWall(vertical.revision, "vertical-outer", { xMm: 0, zMm: 0 }, { xMm: 0, zMm: 1_000 })).reason,
    ).toBe("COLLINEAR_OVERLAP");
  });

  it("does not report a face for an open contour and derives exact usable metrics when an attached branch precedes a rectangle", () => {
    const openOne = accepted(addWall(createEmptyRevision(), "open-1", { xMm: 0, zMm: 0 }, { xMm: 1_000, zMm: 0 }));
    const openTwo = accepted(addWall(openOne.revision, "open-2", { xMm: 1_000, zMm: 0 }, { xMm: 1_000, zMm: 1_000 }));
    expect(openTwo.derivedFaces).toEqual([]);

    const branch = accepted(addWall(createEmptyRevision(), "branch", { xMm: 0, zMm: 0 }, { xMm: 0, zMm: -500 }, 200));
    const bottom = accepted(addWall(branch.revision, "bottom", { xMm: 0, zMm: 0 }, { xMm: 2_000, zMm: 0 }));
    const right = accepted(addWall(bottom.revision, "right", { xMm: 2_000, zMm: 0 }, { xMm: 2_000, zMm: 2_000 }));
    const top = accepted(addWall(right.revision, "top", { xMm: 2_000, zMm: 2_000 }, { xMm: 0, zMm: 2_000 }));
    const rectangle = accepted(addWall(top.revision, "left", { xMm: 0, zMm: 2_000 }, { xMm: 0, zMm: 0 }));

    expect(rectangle.derivedFaces).toEqual([
      {
        faceFingerprint: "0,0|2000,0|2000,2000|0,2000",
        boundaryVertexIds: expect.any(Array),
        areaMm2: 3_610_000,
        usableWidthMm: 1_900,
        usableDepthMm: 1_900,
      },
    ]);
  });

  it("rejects disconnected merge candidates and a proposed merged ID that already exists", () => {
    const first = accepted(addWall(createEmptyRevision(), "first", { xMm: 0, zMm: 0 }, { xMm: 500, zMm: 0 }));
    const disconnected = accepted(addWall(first.revision, "other", { xMm: 1_000, zMm: 0 }, { xMm: 1_500, zMm: 0 }));
    expect(
      rejected(
        applyCommand(disconnected.revision, {
          kind: "MergeCollinearSegments",
          firstWallId: "first",
          secondWallId: "other",
          mergedWallId: "merged",
          mergePolicy: "manual-only",
        }),
      ).reason,
    ).toBe("MERGE_NOT_COLLINEAR");
    expect(
      rejected(
        applyCommand(disconnected.revision, {
          kind: "MergeCollinearSegments",
          firstWallId: "first",
          secondWallId: "other",
          mergedWallId: "first",
          mergePolicy: "manual-only",
        }),
      ).reason,
    ).toBe("INVALID_DIMENSION");
  });

  it("rejects serialized records that violate each topological validation family", () => {
    const invalidRevisions = [
      serial(
        [
          { id: "v-1", xMm: 0, zMm: 0 },
          { id: "v-1", xMm: 100, zMm: 0 },
        ],
        [],
      ),
      serial(
        [
          { id: "v-1", xMm: 100_001, zMm: 0 },
          { id: "v-2", xMm: 0, zMm: 0 },
        ],
        [],
      ),
      serial(
        [
          { id: "v-1", xMm: 0, zMm: 0 },
          { id: "v-2", xMm: 100, zMm: 0 },
          { id: "v-3", xMm: 200, zMm: 0 },
        ],
        [
          { id: "same", startVertexId: "v-1", endVertexId: "v-2", thicknessMm: 100 },
          { id: "same", startVertexId: "v-2", endVertexId: "v-3", thicknessMm: 100 },
        ],
      ),
      serial(
        [{ id: "v-1", xMm: 0, zMm: 0 }],
        [{ id: "zero", startVertexId: "v-1", endVertexId: "v-1", thicknessMm: 100 }],
      ),
      serial(
        [
          { id: "v-1", xMm: 0, zMm: 0 },
          { id: "v-2", xMm: 100, zMm: 50 },
        ],
        [{ id: "unsupported", startVertexId: "v-1", endVertexId: "v-2", thicknessMm: 100 }],
      ),
      serial(
        [
          { id: "v-1", xMm: 0, zMm: 0 },
          { id: "v-2", xMm: 49, zMm: 0 },
        ],
        [{ id: "short", startVertexId: "v-1", endVertexId: "v-2", thicknessMm: 100 }],
      ),
      serial(
        [
          { id: "v-1", xMm: 0, zMm: 0 },
          { id: "v-2", xMm: 1_000, zMm: 0 },
        ],
        [
          { id: "a", startVertexId: "v-1", endVertexId: "v-2", thicknessMm: 100 },
          { id: "b", startVertexId: "v-2", endVertexId: "v-1", thicknessMm: 100 },
        ],
      ),
      serial(
        [
          { id: "v-1", xMm: 0, zMm: 0 },
          { id: "v-2", xMm: 1_000, zMm: 0 },
          { id: "v-3", xMm: 250, zMm: 0 },
          { id: "v-4", xMm: 750, zMm: 0 },
        ],
        [
          { id: "base", startVertexId: "v-1", endVertexId: "v-2", thicknessMm: 100 },
          { id: "overlap", startVertexId: "v-3", endVertexId: "v-4", thicknessMm: 100 },
        ],
      ),
      serial(
        [
          { id: "v-1", xMm: 0, zMm: 0 },
          { id: "v-2", xMm: 999, zMm: 999 },
          { id: "v-3", xMm: 0, zMm: 999 },
          { id: "v-4", xMm: 999, zMm: 0 },
        ],
        [
          { id: "a", startVertexId: "v-1", endVertexId: "v-2", thicknessMm: 100 },
          { id: "b", startVertexId: "v-3", endVertexId: "v-4", thicknessMm: 100 },
        ],
      ),
    ];

    for (const serialized of invalidRevisions) {
      expect(deserializeRevision(serialized)).toEqual({ ok: false, reason: "SERIALIZATION_INVALID" });
    }
  });

  it("rejects serialized values with invalid primitive types before topology validation", () => {
    const malformedVertex = serial([{ id: "v-1", xMm: "0", zMm: 0 }], []);
    const malformedWall = serial(
      [
        { id: "v-1", xMm: 0, zMm: 0 },
        { id: "v-2", xMm: 100, zMm: 0 },
      ],
      [{ id: "w", startVertexId: "v-1", endVertexId: "v-2", thicknessMm: "100" }],
    );
    expect(deserializeRevision(malformedVertex)).toEqual({ ok: false, reason: "SERIALIZATION_INVALID" });
    expect(deserializeRevision(malformedWall)).toEqual({ ok: false, reason: "SERIALIZATION_INVALID" });
  });
});
