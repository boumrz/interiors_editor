import {
	expect,
	test,
	withFactoryBodyProof,
} from "../verification/browser-factory-native-test";
import type {} from "./browser-registered-cancellation-harness";

test(
	"F415-CANCEL-01: caller cancellation finishes an actual held native lookup and preserves both local owners",
	withFactoryBodyProof(async ({ page }) => {
		await page.goto("/");
		const actual = await page.evaluate(() =>
			window.__browserRegisteredCancellationHarness.run("file-abort"),
		);
		expect(actual.kind).toBe("held-lookup");
		if (actual.kind !== "held-lookup") return;
		expect(actual.seeded.kind).toBe("durable");
		expect(actual.held).toEqual({
			name: "interiors-editor-projects",
			version: 3,
		});
		expect(actual.completionBeforeLookupDeadline).toMatchObject({
			kind: "fulfilled",
			value: { kind: "rejected", reasonCode: "PORTABLE_BACKUP_CANCELLED" },
		});
		expect(actual.completion).toEqual({
			kind: "rejected",
			reasonCode: "PORTABLE_BACKUP_CANCELLED",
		});
		expect(actual.handlesBeforeAnySnapshotOpen).toEqual({
			requests: 1,
			successEvents: 1,
			closeCalls: 1,
		});
		expect(actual.idsAfterDrain).toBe(actual.idsAtCancellation);
		expect(actual.after).toEqual(actual.before);
	}),
);

test(
	"F415-CANCEL-02: runtime disposal revokes a held real lookup without publishing or changing either local owner",
	withFactoryBodyProof(async ({ page }) => {
		await page.goto("/");
		const actual = await page.evaluate(() =>
			window.__browserRegisteredCancellationHarness.run("runtime-dispose"),
		);
		expect(actual.kind).toBe("held-lookup");
		if (actual.kind !== "held-lookup") return;
		expect(actual.seeded.kind).toBe("durable");
		expect(actual.held).toEqual({
			name: "interiors-editor-projects",
			version: 3,
		});
		expect(actual.completionBeforeLookupDeadline.kind).toBe("fulfilled");
		expect(actual.completion.kind).not.toBe("durable");
		expect(actual.rejectsNewAdmission).toBe(true);
		expect(actual.handlesBeforeAnySnapshotOpen).toEqual({
			requests: 1,
			successEvents: 1,
			closeCalls: 1,
		});
		expect(actual.idsAfterDrain).toBe(actual.idsAtCancellation);
		expect(actual.after).toEqual(actual.before);
	}),
);
