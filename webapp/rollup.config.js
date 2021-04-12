import { fileURLToPath } from "url";
import { dirname, join } from "path";
import { nodeResolve } from "@rollup/plugin-node-resolve";

const __dirname = dirname(fileURLToPath(import.meta.url));
/** @type {(...args: string[]) => string} */
const p = (...args) => join(__dirname, "..", ...args);

export default {
	input: p("./webapp/index.js"),
	output: {
		file: p("./bin/gz-heatmap-webapp.js"),
		format: "iife",
		name: "GZHeatmap",
	},
	plugins: [nodeResolve()],
};
