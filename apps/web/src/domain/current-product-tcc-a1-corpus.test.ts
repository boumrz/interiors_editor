import { describe, expect, it } from "@rstest/core";

import {
	createCurrentProductLegacyTccA1Executor,
	createCurrentProductTccA1Executor,
	currentProductLegacyTccA1Corpus,
	currentProductTccA1Corpus,
	webCryptoTccA1HashPort,
} from "./current-product-tcc-a1-corpus";
import { runTccA1Corpus } from "./tcc-a1-corpus-runner";

describe("current product TCC-A1 corpus", () => {
	it("executes every required TCC-A1 family through an active domain boundary", async () => {
		const result = await runTccA1Corpus(
			currentProductTccA1Corpus,
			createCurrentProductTccA1Executor(),
			webCryptoTccA1HashPort,
		);

		expect(result).toEqual({
			kind: "passed",
			records: currentProductTccA1Corpus.fixtures.map((fixture) => ({
				fixtureId: fixture.fixtureId,
				kind: "matched",
			})),
		});
	});

	it("keeps immutable raw SHA-bound fixtures for every executable current-kernel family", () => {
		expect([
			...new Set(
				currentProductTccA1Corpus.fixtures.map(
					(fixture) => fixture.intent.family,
				),
			),
		]).toEqual([
			"directions",
			"contacts",
			"faces",
			"lineage-and-hosts",
			"measurement-and-projections",
			"commands-and-lifecycle",
		]);
		const allFixtures = currentProductTccA1Corpus.fixtures;
		expect(
			new Set(allFixtures.map((fixture) => fixture.rawInputSha256)).size,
		).toBe(allFixtures.length);
	});

	it("executes the source-owned active Alpha legacy closure through the PPJ-A1 parser", async () => {
		const result = await runTccA1Corpus(
			currentProductLegacyTccA1Corpus,
			createCurrentProductLegacyTccA1Executor(),
			webCryptoTccA1HashPort,
		);

		expect(result).toEqual({
			kind: "passed",
			records: currentProductLegacyTccA1Corpus.fixtures.map((fixture) => ({
				fixtureId: fixture.fixtureId,
				kind: "matched",
			})),
		});
		expect(
			currentProductLegacyTccA1Corpus.fixtures.map(
				(fixture) => fixture.fixtureId,
			),
		).toEqual([
			"TCC-A1-LEGACY-CURRENT-PPJ-A1",
			"TCC-A1-LEGACY-V1-LIKE",
			"TCC-A1-LEGACY-V2-LIKE",
			"TCC-A1-LEGACY-UNREGISTERED-FUTURE",
		]);
	});

	it("keeps the legacy classifier scoped to registered PPJ-A1 selection, not a V1/V2 fixture switch", () => {
		expect(currentProductTccA1Corpus.executorRole).toBe("domain-kernel");
		expect(currentProductLegacyTccA1Corpus.executorRole).toBe(
		"legacy-classifier",
	);
		expect(
		new Set(
			currentProductLegacyTccA1Corpus.fixtures.map(
				(fixture) => fixture.rawInputSha256,
			),
		).size,
	).toBe(currentProductLegacyTccA1Corpus.fixtures.length);
	});

	it("declares the complete raw-ingress direction minimum: -0, cardinal, signed diagonals, length-only, bounds, zero and unsupported", () => {
		expect(
			currentProductTccA1Corpus.fixtures.map((fixture) => fixture.fixtureId),
		).toEqual(
			expect.arrayContaining([
				"TCC-A1-DIR-NEGZERO",
				"TCC-A1-DIR-E",
				"TCC-A1-DIR-NE",
				"TCC-A1-DIR-NW",
				"TCC-A1-DIR-SE",
				"TCC-A1-DIR-SW",
				"TCC-A1-DIR-LENGTH",
				"TCC-A1-DIR-BOUNDS",
				"TCC-A1-DIR-ZERO",
				"TCC-A1-DIR-UNSUPPORTED",
			]),
		);
	});

	it("declares every required contact normalization and no-mutation vector against the current PlanGraph kernel", () => {
		expect(
			currentProductTccA1Corpus.fixtures.map((fixture) => fixture.fixtureId),
		).toEqual(
			expect.arrayContaining([
				"TCC-A1-CONTACT-ENDPOINT",
				"TCC-A1-CONTACT-T",
				"TCC-A1-CONTACT-JUNCTION",
				"TCC-A1-CONTACT-X",
				"TCC-A1-CONTACT-MULTI-X",
				"TCC-A1-CONTACT-FRACTIONAL",
				"TCC-A1-CONTACT-DUPLICATE",
				"TCC-A1-CONTACT-OVERLAP",
				"TCC-A1-CONTACT-SHORT-PARTITION",
			]),
		);
	});

	it("declares the face, exterior, usable-geometry and fail-closed ring minimum against production derivation", () => {
		expect(
			currentProductTccA1Corpus.fixtures.map((fixture) => fixture.fixtureId),
		).toEqual(
			expect.arrayContaining([
				"TCC-A1-FACE-EXTERIOR",
				"TCC-A1-FACE-MULTI-ROOM",
				"TCC-A1-FACE-VOID-RING",
				"TCC-A1-FACE-REPEATED-WALK",
				"TCC-A1-FACE-TOUCHING-RING",
				"TCC-A1-FACE-NESTED-RING",
				"TCC-A1-FACE-ODD-MITER",
				"TCC-A1-FACE-USABLE-COLLAPSE",
			]),
		);
	});

	it("declares Room lineage and host successor vectors against the production Project commands", () => {
		expect(
			currentProductTccA1Corpus.fixtures.map((fixture) => fixture.fixtureId),
		).toEqual(
			expect.arrayContaining([
				"TCC-A1-LINEAGE-ONE-TO-ONE",
				"TCC-A1-LINEAGE-ADD-SPLIT-HEIGHT",
				"TCC-A1-LINEAGE-OPENING-REHOME",
				"TCC-A1-LINEAGE-WALL-SURFACE-REHOME",
				"TCC-A1-LINEAGE-HOST-CONFLICT-PREVIEW",
			]),
		);
	});

	it.each(["TCC-A1-FACE-EXTERIOR", "TCC-A1-CURRENT-006"] as const)(
		"returns the declared domain outcome for %s without hiding an executor exception",
		async (fixtureId) => {
			const fixture = currentProductTccA1Corpus.fixtures.find(
				(candidate) => candidate.fixtureId === fixtureId,
			);
			if (!fixture) throw new Error(`Missing ${fixtureId}`);
			await expect(
				createCurrentProductTccA1Executor().evaluate({
					baseStateDigest: fixture.baseStateDigest,
					fixtureId: fixture.fixtureId,
					intent: fixture.intent,
					rawInputBytes: fixture.rawInputBytes,
				}),
			).resolves.toEqual(fixture.expected);
		},
	);
});
