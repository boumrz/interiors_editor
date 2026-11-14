/**
 * Install guidance is intentionally based on browser capabilities instead of
 * a user-agent promise. `navigator.standalone` is the capability exposed by
 * WebKit contexts that can use the iOS Share → Add to Home Screen route.
 */
export interface InstallCapabilityNavigator {
	readonly standalone?: boolean;
}

export interface InstallCapabilityWindow {
	matchMedia?(query: string): { readonly matches: boolean };
}

export interface PwaInstallCapabilities {
	readonly isStandalone: boolean;
	readonly canUseIosShareInstall: boolean;
}

export function pwaInstallCapabilities(
	navigatorLike: object,
	windowLike: InstallCapabilityWindow,
): PwaInstallCapabilities {
	const navigatorCapabilities = navigatorLike as InstallCapabilityNavigator;
	const hasStandaloneCapability = "standalone" in navigatorLike;
	const isStandalone =
		navigatorCapabilities.standalone === true ||
		windowLike.matchMedia?.("(display-mode: standalone)").matches === true;

	return {
		canUseIosShareInstall:
			!isStandalone && hasStandaloneCapability,
		isStandalone,
	};
}
