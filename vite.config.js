import { preact } from "@preact/preset-vite";
import { defineConfig } from "vite";

// https://vitejs.dev/config/
export default defineConfig({
	base: "/gz-heatmap/",
	plugins: [preact()],
	build: {
		modulePreload: { polyfill: false },
	},
});
