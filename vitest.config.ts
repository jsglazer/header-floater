import { defineConfig } from "vitest/config";

// Core tests import only from `src/core/*`, which has no `obsidian` or DOM dependency, so they run fully headless with no module stubbing.
export default defineConfig({
	test: {
		include: ["tests/**/*.test.ts"],
		environment: "node",
	},
});
