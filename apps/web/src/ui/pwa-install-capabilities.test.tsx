import { describe, expect, it } from "@rstest/core";

import { pwaInstallCapabilities } from "./pwa-install-capabilities";

describe("pwaInstallCapabilities", () => {
	it("uses only install capabilities, never a user-agent guess, for the iOS Share route", () => {
		expect(
			pwaInstallCapabilities(
				{ standalone: false },
				{ matchMedia: () => ({ matches: false }) },
			),
		).toEqual({ canUseIosShareInstall: true, isStandalone: false });
	});

	it("hides install guidance after the app is already running standalone", () => {
		expect(
			pwaInstallCapabilities(
				{ standalone: true },
				{ matchMedia: () => ({ matches: true }) },
			),
		).toEqual({ canUseIosShareInstall: false, isStandalone: true });
	});

	it("recognizes an iOS standalone context even when display-mode still reports browser", () => {
		expect(
			pwaInstallCapabilities(
				{ standalone: true },
				{ matchMedia: () => ({ matches: false }) },
			),
		).toEqual({ canUseIosShareInstall: false, isStandalone: true });
	});

	it("recognizes display-mode standalone with no iOS navigator marker", () => {
		let queriedMedia: string | undefined;
		expect(
			pwaInstallCapabilities({}, {
				matchMedia: (query) => {
					queriedMedia = query;
					return { matches: true };
				},
			}),
		).toEqual({ canUseIosShareInstall: false, isStandalone: true });
		expect(queriedMedia).toBe("(display-mode: standalone)");
	});

	it("remains safely in the browser route when matchMedia is unavailable", () => {
		expect(pwaInstallCapabilities({}, {})).toEqual({
		canUseIosShareInstall: false,
		isStandalone: false,
	});
	});

	it("does not pretend a generic browser has the iOS Share capability", () => {
		expect(
			pwaInstallCapabilities({}, { matchMedia: () => ({ matches: false }) }),
		).toEqual({ canUseIosShareInstall: false, isStandalone: false });
	});
});
