export default {
  testRunner: "vitest",
  coverageAnalysis: "perTest",
  mutate: ["src/topology-kernel.ts"],
  reporters: ["clear-text", "html", "json"],
  jsonReporter: {
    fileName: "reports/mutation/mutation.json",
  },
  tsconfigFile: "tsconfig.json",
  concurrency: 4,
  incremental: false,
  thresholds: {
    high: 80,
    low: 60,
    break: 80,
  },
};
