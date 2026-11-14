import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    exclude: ["**/.stryker-tmp/**", "**/node_modules/**"],
    coverage: {
      provider: "v8",
      reporter: ["text", "json", "html"],
      include: ["src/**/*.ts"],
    },
  },
});
