#!/usr/bin/env node

import * as path from "path";
import { fileURLToPath, pathToFileURL } from "url";
import { readFile, writeFile, copyFile, mkdir } from "fs/promises";
import { gzip } from "zlib";
import { promisify } from "util";
import sade from "sade";
import open from "open";
import { gzinflate } from "../src/index.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
/** @type {(...args: string[]) => string} */
const p = (...args) => path.join(__dirname, "..", ...args);
const gzipAsync = promisify(gzip);

/**
 * @typedef {{ out: string; open: boolean; }} Options
 * @param {string} filePath
 * @param {Options} options
 */
async function main(filePath, options) {
	/** @type {Buffer} */
	let rawGzip;
	if (filePath.endsWith(".gz")) {
		rawGzip = await readFile(filePath);
	} else {
		rawGzip = await gzipAsync(await readFile(filePath));
	}

	const { result, metadata } = gzinflate(rawGzip);

	await mkdir(options.out, { recursive: true });

	const metadataJSON = JSON.stringify(metadata);
	const jsContents = `window.GZHeatmapData = JSON.parse(\`${metadataJSON}\`);`;
	await writeFile(
		path.join(options.out, "gz-heatmap-data.js"),
		jsContents,
		"utf8"
	);

	const indexPath = path.join(options.out, "index.html");
	await copyFile(p("bin/template.html"), indexPath);
	await copyFile(
		p("bin/gz-heatmap-webapp.js"),
		path.join(options.out, "gz-heatmap-webapp.js")
	);

	if (options.open) {
		await open(pathToFileURL(indexPath).toString());
		console.log(`Done! Opening ${indexPath} in your browser...`);
	} else {
		console.log(`Done! Open ${indexPath} in your browser.`);
	}
}

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
	.action(main)
	.parse(process.argv);
