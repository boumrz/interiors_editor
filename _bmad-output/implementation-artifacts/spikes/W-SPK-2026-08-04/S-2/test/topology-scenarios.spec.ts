import fc from "fast-check";
import { describe, expect, it } from "vitest";

import {
  applyCommand,
  applyInverse,
  createEmptyRevision,
  deserializeRevision,
  evaluateOpeningFit,
  reconcileRoomIdentityCandidates,
  serializeRevision,
} from "../src/topology-kernel.js";

const expectAccepted = <T extends { ok: boolean }>(result: T) => {
  expect(result.ok).toBe(true);
  if (!result.ok) {
    throw new Error("Expected a validated topology command");
  }
  return result as Extract<T, { ok: true }>;
};

const expectRejected = <T extends { ok: boolean }>(result: T) => {
  expect(result.ok).toBe(false);
  if (result.ok) {
    throw new Error("Expected a rejected topology command");
  }
  return result as Extract<T, { ok: false }>;
};

const addWall = (
  revision: ReturnType<typeof createEmptyRevision>,
  wallId: string,
  start: { xMm: number; zMm: number },
  end: { xMm: number; zMm: number },
  xIntersectionPolicy: "reject" | "split" = "reject",
) =>
  applyCommand(revision, {
    kind: "AddWallSegment",
    wallId,
    start,
    end,
    thicknessMm: 100,
    xIntersectionPolicy,
  });

describe("S-2 topology evidence scenarios", () => {
  it("creates a canonical integer-mm rectangular room with one derived face", () => {
    const result = expectAccepted(
      applyCommand(createEmptyRevision(), {
        kind: "CreateRectangle",
        innerWidthMm: 4_000,
        innerDepthMm: 3_000,
        wallThicknessMm: 100,
      }),
    );

    expect(result.revision.vertices).toHaveLength(4);
    expect(result.revision.walls).toHaveLength(4);
    expect(result.derivedFaces).toHaveLength(1);
    expect(result.derivedFaces[0]).toMatchObject({
      usableWidthMm: 4_000,
      usableDepthMm: 3_000,
      areaMm2: 12_000_000,
    });
  });

  it("accepts orthogonal and 45-degree walls, but rejects zero-length and unsupported directions without changing a revision", () => {
    const empty = createEmptyRevision();
    const horizontal = expectAccepted(
      addWall(empty, "horizontal", { xMm: 0, zMm: 0 }, { xMm: 1_000, zMm: 0 }),
    );
    const vertical = expectAccepted(
      addWall(horizontal.revision, "vertical", { xMm: 2_000, zMm: 0 }, { xMm: 2_000, zMm: 1_000 }),
    );
    const diagonal = expectAccepted(
      addWall(vertical.revision, "diagonal", { xMm: 3_000, zMm: 0 }, { xMm: 3_750, zMm: 750 }),
    );

    const beforeRejectedCommand = serializeRevision(diagonal.revision);
    const zero = expectRejected(
      addWall(diagonal.revision, "zero", { xMm: 5_000, zMm: 0 }, { xMm: 5_000, zMm: 0 }),
    );
    expect(zero.reason).toBe("ZERO_LENGTH");
    expect(serializeRevision(zero.revision)).toBe(beforeRejectedCommand);

    const unsupported = expectRejected(
      addWall(diagonal.revision, "unsupported", { xMm: 5_000, zMm: 0 }, { xMm: 5_500, zMm: 250 }),
    );
    expect(unsupported.reason).toBe("UNSUPPORTED_DIRECTION");
    expect(serializeRevision(unsupported.revision)).toBe(beforeRejectedCommand);
  });

  it("rejects an orientation-independent duplicate without changing the revision", () => {
    const original = expectAccepted(
      addWall(createEmptyRevision(), "original", { xMm: 0, zMm: 0 }, { xMm: 1_000, zMm: 0 }),
    );
    const beforeDuplicate = serializeRevision(original.revision);

    const duplicate = expectRejected(
      addWall(original.revision, "reverse", { xMm: 1_000, zMm: 0 }, { xMm: 0, zMm: 0 }),
    );

    expect(duplicate.reason).toBe("DUPLICATE_SEGMENT");
    expect(serializeRevision(duplicate.revision)).toBe(beforeDuplicate);
  });

  it("atomically splits a T intersection at the shared integer-mm vertex", () => {
    const base = expectAccepted(
      addWall(createEmptyRevision(), "base", { xMm: 0, zMm: 0 }, { xMm: 1_000, zMm: 0 }),
    );
    const tIntersection = expectAccepted(
      addWall(base.revision, "tee", { xMm: 500, zMm: 0 }, { xMm: 500, zMm: 1_000 }),
    );

    expect(tIntersection.revision.walls).toHaveLength(3);
    expect(tIntersection.revision.walls.map((wall) => wall.id)).not.toContain("base");
    expect(tIntersection.revision.vertices).toContainEqual({ id: "v-3", xMm: 500, zMm: 0 });
  });

  it("requires explicit X-intersection behavior instead of accepting a library default", () => {
    const base = expectAccepted(
      addWall(createEmptyRevision(), "diagonal-a", { xMm: 0, zMm: 0 }, { xMm: 1_000, zMm: 1_000 }),
    );
    const beforeRejectedX = serializeRevision(base.revision);

    const rejectedX = expectRejected(
      addWall(base.revision, "diagonal-b", { xMm: 0, zMm: 1_000 }, { xMm: 1_000, zMm: 0 }, "reject"),
    );
    expect(rejectedX.reason).toBe("AMBIGUOUS_INTERSECTION");
    expect(serializeRevision(rejectedX.revision)).toBe(beforeRejectedX);

    const splitX = expectAccepted(
      addWall(base.revision, "diagonal-b", { xMm: 0, zMm: 1_000 }, { xMm: 1_000, zMm: 0 }, "split"),
    );
    expect(splitX.revision.walls).toHaveLength(4);
    expect(splitX.revision.vertices.some((vertex) => vertex.xMm === 500 && vertex.zMm === 500)).toBe(true);
  });

  it("rejects non-lattice X intersections because persisted topology cannot create half-millimetre vertices", () => {
    const base = expectAccepted(
      addWall(createEmptyRevision(), "diagonal-a", { xMm: 0, zMm: 0 }, { xMm: 999, zMm: 999 }),
    );
    const beforeHalfMillimetreX = serializeRevision(base.revision);

    const result = expectRejected(
      addWall(base.revision, "diagonal-b", { xMm: 0, zMm: 999 }, { xMm: 999, zMm: 0 }, "split"),
    );

    expect(result.reason).toBe("AMBIGUOUS_INTERSECTION");
    expect(serializeRevision(result.revision)).toBe(beforeHalfMillimetreX);
  });

  it("does not auto-merge collinear walls and only performs an explicit candidate merge", () => {
    const first = expectAccepted(
      addWall(createEmptyRevision(), "left", { xMm: 0, zMm: 0 }, { xMm: 500, zMm: 0 }),
    );
    const second = expectAccepted(
      addWall(first.revision, "right", { xMm: 500, zMm: 0 }, { xMm: 1_000, zMm: 0 }),
    );
    expect(second.revision.walls).toHaveLength(2);

    const merged = expectAccepted(
      applyCommand(second.revision, {
        kind: "MergeCollinearSegments",
        firstWallId: "left",
        secondWallId: "right",
        mergedWallId: "merged",
        mergePolicy: "manual-only",
      }),
    );

    expect(merged.revision.walls).toEqual([
      expect.objectContaining({ id: "merged", thicknessMm: 100 }),
    ]);
    expect(merged.revision.vertices).toEqual([
      expect.objectContaining({ xMm: 0, zMm: 0 }),
      expect.objectContaining({ xMm: 1_000, zMm: 0 }),
    ]);
  });

  it("keeps a failed merge atomic and labels it with a stable candidate reason", () => {
    const horizontal = expectAccepted(
      addWall(createEmptyRevision(), "horizontal", { xMm: 0, zMm: 0 }, { xMm: 500, zMm: 0 }),
    );
    const vertical = expectAccepted(
      addWall(horizontal.revision, "vertical", { xMm: 500, zMm: 0 }, { xMm: 500, zMm: 500 }),
    );
    const beforeMerge = serializeRevision(vertical.revision);

    const failedMerge = expectRejected(
      applyCommand(vertical.revision, {
        kind: "MergeCollinearSegments",
        firstWallId: "horizontal",
        secondWallId: "vertical",
        mergedWallId: "not-used",
        mergePolicy: "manual-only",
      }),
    );

    expect(failedMerge.reason).toBe("MERGE_NOT_COLLINEAR");
    expect(serializeRevision(failedMerge.revision)).toBe(beforeMerge);
  });

  it("derives two bounded face candidates after a divider and refuses a silent Room-ID transfer", () => {
    const rectangle = expectAccepted(
      applyCommand(createEmptyRevision(), {
        kind: "CreateRectangle",
        innerWidthMm: 4_000,
        innerDepthMm: 3_000,
        wallThicknessMm: 100,
      }),
    );
    const split = expectAccepted(
      addWall(
        rectangle.revision,
        "divider",
        { xMm: 2_050, zMm: 0 },
        { xMm: 2_050, zMm: 3_100 },
      ),
    );

    expect(split.derivedFaces).toHaveLength(2);
    const reconciliation = reconcileRoomIdentityCandidates(
      [{ roomId: "room-original", faceFingerprint: rectangle.derivedFaces[0]!.faceFingerprint }],
      split.derivedFaces,
    );

    expect(reconciliation).toEqual({
      kind: "ambiguous",
      reason: "ROOM_IDENTITY_AMBIGUOUS",
      inheritedRoomIds: [],
    });
  });

  it("uses the maximum adjacent Room height for a shared wall and the minimum height for its opening", () => {
    const valid = evaluateOpeningFit({
      wallLengthMm: 4_000,
      adjacentRoomHeightsMm: [2_400, 3_000],
      opening: { offsetMm: 600, widthMm: 900, heightMm: 2_400, sillMm: 0 },
    });
    expect(valid).toEqual({
      ok: true,
      wallHeightMm: 3_000,
      openingHeightLimitMm: 2_400,
    });

    const tooTall = evaluateOpeningFit({
      wallLengthMm: 4_000,
      adjacentRoomHeightsMm: [2_400, 3_000],
      opening: { offsetMm: 600, widthMm: 900, heightMm: 2_401, sillMm: 0 },
    });
    expect(tooTall).toEqual({
      ok: false,
      reason: "OPENING_OUT_OF_BOUNDS",
    });

    const tooWide = evaluateOpeningFit({
      wallLengthMm: 4_000,
      adjacentRoomHeightsMm: [2_400, 3_000],
      opening: { offsetMm: 3_300, widthMm: 701, heightMm: 2_000, sillMm: 0 },
    });
    expect(tooWide).toEqual({
      ok: false,
      reason: "OPENING_OUT_OF_BOUNDS",
    });
  });

  it("round-trips a revision through canonical serialization and restores it through the inverse", () => {
    const before = createEmptyRevision();
    const applied = expectAccepted(
      addWall(before, "original", { xMm: 100, zMm: 200 }, { xMm: 1_100, zMm: 1_200 }),
    );
    const serialized = serializeRevision(applied.revision);
    const restored = expectAccepted(deserializeRevision(serialized));

    expect(serializeRevision(restored.revision)).toBe(serialized);
    expect(serializeRevision(applyInverse(applied.inverse))).toBe(serializeRevision(before));
  });

  it("requires an explicit X policy at runtime instead of treating an absent field as a default", () => {
    const malformedCommand = {
      kind: "AddWallSegment",
      wallId: "missing-policy",
      start: { xMm: 0, zMm: 0 },
      end: { xMm: 1_000, zMm: 1_000 },
      thicknessMm: 100,
    };

    const rejected = expectRejected(
      applyCommand(createEmptyRevision(), malformedCommand as never),
    );
    expect(rejected.reason).toBe("POLICY_REQUIRED");
  });

  it("keeps legal integer-mm wall candidates reversible and serialization-stable across randomized directions", () => {
    const coordinate = fc.integer({ min: -5_000, max: 5_000 });
    const length = fc.integer({ min: 50, max: 2_000 });
    const direction = fc.constantFrom("horizontal", "vertical", "diagonal-up", "diagonal-down");

    fc.assert(
      fc.property(coordinate, coordinate, length, direction, (xMm, zMm, lengthMm, directionName) => {
        const end =
          directionName === "horizontal"
            ? { xMm: xMm + lengthMm, zMm }
            : directionName === "vertical"
              ? { xMm, zMm: zMm + lengthMm }
              : directionName === "diagonal-up"
                ? { xMm: xMm + lengthMm, zMm: zMm + lengthMm }
                : { xMm: xMm + lengthMm, zMm: zMm - lengthMm };
        const before = createEmptyRevision();
        const applied = applyCommand(before, {
          kind: "AddWallSegment",
          wallId: "random-wall",
          start: { xMm, zMm },
          end,
          thicknessMm: 100,
          xIntersectionPolicy: "reject",
        });

        if (!applied.ok) {
          return false;
        }

        const roundTripped = deserializeRevision(serializeRevision(applied.revision));
        return (
          roundTripped.ok &&
          serializeRevision(roundTripped.revision) === serializeRevision(applied.revision) &&
          serializeRevision(applyInverse(applied.inverse)) === serializeRevision(before)
        );
      }),
      { numRuns: 250 },
    );
  });

  it("keeps a reversed duplicate rejected and unchanged across randomized legal segments", () => {
    const coordinate = fc.integer({ min: -5_000, max: 5_000 });
    const length = fc.integer({ min: 50, max: 2_000 });

    fc.assert(
      fc.property(coordinate, coordinate, length, (xMm, zMm, lengthMm) => {
        const before = createEmptyRevision();
        const original = applyCommand(before, {
          kind: "AddWallSegment",
          wallId: "original",
          start: { xMm, zMm },
          end: { xMm: xMm + lengthMm, zMm: zMm + lengthMm },
          thicknessMm: 100,
          xIntersectionPolicy: "reject",
        });
        if (!original.ok) {
          return false;
        }

        const beforeDuplicate = serializeRevision(original.revision);
        const duplicate = applyCommand(original.revision, {
          kind: "AddWallSegment",
          wallId: "reverse",
          start: { xMm: xMm + lengthMm, zMm: zMm + lengthMm },
          end: { xMm, zMm },
          thicknessMm: 100,
          xIntersectionPolicy: "reject",
        });

        return (
          !duplicate.ok &&
          duplicate.reason === "DUPLICATE_SEGMENT" &&
          serializeRevision(duplicate.revision) === beforeDuplicate
        );
      }),
      { numRuns: 250 },
    );
  });
});
