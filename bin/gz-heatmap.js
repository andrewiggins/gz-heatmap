#!/usr/bin/env node

import * as path from "path";
import sade from "sade";
import { getTheAnswer } from "../src/index.js";

sade("gz-heatmap <file>", true)
	.describe(
		"Produce a heatmap of gzip files to better understand how gzip compresses your code"
	)
	.example("build.js")
	.example("build.js -o /tmp/directory")
	.option(
		"-o --out",
		"The directory to output files too",
		path.join(process.cwd(), "gz-heatmap")
	)
	.option("--open", "Open the resulting webapp in a web browser", false)
	.action((filePath) => {
		console.log(`${filePath}:`, getTheAnswer());
	})
	.parse(process.argv);
