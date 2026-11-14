import {
	expect,
	test,
	withFactoryBodyProof,
} from "../verification/browser-factory-native-test";
import type {} from "./browser-key-public-boundaries-harness";

test(
	"KEY176-PUBLIC-01: a future existing version with valid preserved Project stores is unavailable",
	withFactoryBodyProof(async ({ page }) => {
		await page.goto("/");
		const actual = await page.evaluate(() =>
			window.__browserKeyPublicBoundaries.existingVersion4(),
		);
		expect(actual.result).toEqual({ kind: "unavailable" });
		expect(
			actual.before.find((row) => row.name === "interiors-editor-projects")
				?.version,
		).toBe(4);
		expect(actual.after).toEqual(actual.before);
	}),
);
test(
	"KEY176-PUBLIC-02: an actual asynchronous VersionError is unavailable rather than an absent source",
	withFactoryBodyProof(async ({ page }) => {
		await page.goto("/");
		const actual = await page.evaluate(() =>
			window.__browserKeyPublicBoundaries.asynchronousVersionError(),
		);
		expect(actual.actualTerminal).toEqual({
			kind: "error",
			errorName: "VersionError",
		});
		expect(actual.result).toEqual({ kind: "unavailable" });
		expect(actual.handles.liveHandles).toBe(0);
		expect(actual.after).toEqual(actual.before);
	}),
);
for (const [suffix, namespace] of [
	["03", "legacy"],
	["04", "browser-registered"],
] as const) {
	test(
		`KEY176-PUBLIC-${suffix}: cancellation finishes before held ${namespace} native success delivery`,
		withFactoryBodyProof(async ({ page }) => {
			await page.goto("/");
			const actual = await page.evaluate(
				(namespace) =>
					window.__browserKeyPublicBoundaries.pendingSuccessCancellation(
						namespace,
					),
				namespace,
			);
			expect(actual.kind).toBe("held");
			if (actual.kind !== "held") return;
			expect(actual.beforeRelease).toEqual({
				kind: "fulfilled",
				value: { kind: "unavailable" },
			});
			expect(actual.result).toEqual({ kind: "unavailable" });
			expect(actual.handlesBeforeSnapshotOpen.liveHandles).toBe(0);
			expect(actual.handlesBeforeSnapshotOpen.closeCalls).toBe(1);
			expect(actual.after).toEqual(actual.before);
		}),
	);
}
test(
	"KEY176-PUBLIC-05: cancellation after actual readonly commit cannot adopt its held occupied result",
	withFactoryBodyProof(async ({ page }) => {
		await page.goto("/");
		const actual = await page.evaluate(() =>
			window.__browserKeyPublicBoundaries.cancellationAfterNativeCommit(),
		);
		expect(actual.kind).toBe("committed-held");
		if (actual.kind !== "committed-held") return;
		expect(actual.result).toEqual({ kind: "unavailable" });
		expect(actual.handlesBeforeSnapshotOpen.completeEvents).toBe(1);
		expect(actual.handlesBeforeSnapshotOpen.liveHandles).toBe(0);
		expect(actual.after).toEqual(actual.before);
	}),
);
test(
	"KEY176-PUBLIC-06: cancellation inside a held real upgrade preserves the existing version and every row",
	withFactoryBodyProof(async ({ page }) => {
		await page.goto("/");
		const actual = await page.evaluate(() =>
			window.__browserKeyPublicBoundaries.cancellationDuringActualUpgrade(),
		);
		expect(actual.kind).toBe("upgrade-held");
		if (actual.kind !== "upgrade-held") return;
		expect(actual.upgrade).toEqual({ oldVersion: 3, newVersion: 4 });
		expect(actual.actualTerminal.kind).toBe("error");
		expect(actual.result).toEqual({ kind: "unavailable" });
		expect(actual.handles.liveHandles).toBe(0);
		expect(actual.after).toEqual(actual.before);
	}),
);
