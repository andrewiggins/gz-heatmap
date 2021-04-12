import { existsSync } from "fs";
import { readFile, mkdtemp } from "fs/promises";
import rimraf from "rimraf";
import { suite } from "uvu";
import * as assert from "uvu/assert";
import { execFileSync } from "child_process";
import { fixture, testPath } from "./utils/paths.js";
import { join } from "path";

/** @type {(path: string) => Promise<void>} */
const rimrafAsync = (path) =>
	new Promise((resolve, reject) =>
		rimraf(path, {}, (error) => (error ? reject(error) : resolve()))
	);

const binPath = testPath("../bin/gz-heatmap.js");
const bin = suite("bin");

bin.before.each(async (ctx) => {
	ctx.output = await mkdtemp("gz-heatmap-tests-");
});

bin.after.each(async (ctx) => {
	await rimrafAsync(ctx.output);
	ctx.output = null;
});

bin("HTML should only reference files that exist", async (ctx) => {
	const fixturePath = fixture("svg-7-hex/image.svg");
	execFileSync("node", [binPath, fixturePath, "--out", ctx.output]);
	const html = await readFile(join(ctx.output, "index.html"), "utf8");
	const scriptTags = html.matchAll(/<script src="(.+?)"/g);
	for (let match of scriptTags) {
		let expectedFile = match[1];
		assert.ok(
			existsSync(join(ctx.output, expectedFile)),
			`expected ${expectedFile} to exist in ${ctx.output}`
		);
	}
});

bin("should handle gz input", (ctx) => {
	const fixturePath = fixture("svg-7-hex/image.svg.gz");
	execFileSync("node", [binPath, fixturePath, "--out", ctx.output]);
	// TODO: assert that the JS/HTML file contains results. Maybe use puppeteer?
});

bin("should handle xml input", (ctx) => {});

bin("should handle text input", (ctx) => {});

bin("should handle js input", (ctx) => {});

bin.run();
