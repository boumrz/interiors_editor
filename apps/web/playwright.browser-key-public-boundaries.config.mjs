import { defineConfig } from "@playwright/test";
import { makePublicConfig } from "./scripts/additive-public-config.mjs";
export default defineConfig(makePublicConfig("key"));
