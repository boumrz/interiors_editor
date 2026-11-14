// Focused mutation evidence for the phone-only selected-item properties route.
// It runs in place against a fresh ephemeral development server; do not edit
// the selected AppShell ranges while Stryker is active.
export default {
	commandRunner: {
		command: [
			"node scripts/check-runtime.mjs",
			"sh -c 'set -e; INTERIORS_MUTATION_PORT=48174; INTERIORS_DEV_SERVER_PORT=$INTERIORS_MUTATION_PORT pnpm run dev >/dev/null 2>&1 & mutation_server_pid=$!; trap \"kill $mutation_server_pid\" EXIT; until curl -fsS http://127.0.0.1:$INTERIORS_MUTATION_PORT >/dev/null; do sleep 0.25; done; PLAYWRIGHT_BASE_URL=http://127.0.0.1:$INTERIORS_MUTATION_PORT pnpm exec playwright test --config playwright.config.mjs tests/browser/editor-workspace-e2e.spec.ts --grep \"EDITOR-E2E-13J\"'",
		].join(" && "),
	},
	concurrency: 1,
	coverageAnalysis: "off",
	inPlace: true,
	jsonReporter: {
		fileName: "reports/mutation/selected-item-overflow-mutation.json",
	},
	mutate: [
		"src/ui/AppShell.tsx:10139-10152",
		"src/ui/AppShell.tsx:11193-11209",
	],
	packageManager: "pnpm",
	reporters: ["clear-text", "json"],
	testRunner: "command",
	thresholds: { break: 80, high: 80, low: 70 },
};
