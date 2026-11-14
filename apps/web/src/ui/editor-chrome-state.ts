/**
 * Leaving an editor changes only transient chrome: the next project always
 * opens on its Plan with secondary actions closed.
 */
export function projectHubChromeReset() {
	return {
		actionMenuOpen: false,
		viewMode: "plan" as const,
	};
}
