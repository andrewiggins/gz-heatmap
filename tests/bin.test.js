import { existsSync, writeFileSync } from "fs";
import { readFile, writeFile, mkdtemp } from "fs/promises";
import { execFileSync } from "child_process";
import { join } from "path";
import { pathToFileURL } from "url";
import rimraf from "rimraf";
import { suite } from "uvu";
import * as assert from "uvu/assert";
import puppeteer from "puppeteer";
import prettier from "prettier";
import { fixture, testPath } from "./utils/paths.js";

/** @type {(path: string) => Promise<void>} */
const rimrafAsync = (path) =>
	new Promise((resolve, reject) =>
		rimraf(path, {}, (error) => (error ? reject(error) : resolve()))
	);

const binPath = testPath("../bin/gz-heatmap.js");

/**
 * @typedef BinSuiteContext
 * @property {import('puppeteer').Browser} browser
 * @property {import('puppeteer').Page} page
 * @property {string} output
 */

/**
 * @type {import('uvu').Test<BinSuiteContext>}
 */
const bin = suite("bin");

bin.before(async (ctx) => {
	ctx.browser = await puppeteer.launch();
});

bin.before.each(async (ctx) => {
	ctx.output = await mkdtemp("gz-heatmap-tests-");
	ctx.page = await ctx.browser.newPage();
});

bin.after.each(async (ctx) => {
	await ctx.page.close();
	await rimrafAsync(ctx.output);
	ctx.output = "";
});

bin.after(async (ctx) => {
	await ctx.browser.close();
});

/** @type {(outputDir: string) => string} */
const getIndexUrl = (outputDir) =>
	pathToFileURL(join(outputDir, "index.html")).toString();

/** @type {(rawHtml: string) => string} */
function formatHtml(rawHtml) {
	rawHtml = rawHtml
		.replace(/([^\n])<span /g, "$1\n<span ")
		.replace(/([^\n])<\/pre>/g, "$1\n</pre>");

	return prettier.format(rawHtml, { parser: "html" });
}

/**
 * @param {BinSuiteContext} ctx
 * @param {string} fixtureDir
 * @param {string} inputFile
 */
async function validateFixture(ctx, fixtureDir, inputFile) {
	const inputFixture = fixture(fixtureDir, inputFile);
	execFileSync("node", [binPath, inputFixture, "--out", ctx.output]);

	await ctx.page.goto(getIndexUrl(ctx.output), { waitUntil: "networkidle2" });
	const html = formatHtml(await ctx.page.content());

	const expectedFixture = fixture(fixtureDir, "expected.html");
	await writeFile(expectedFixture, html, "utf8");
	const expectedHtml = await readFile(expectedFixture, "utf8");

	assert.fixture(
		html,
		expectedHtml,
		`output doesn't match expected for "${inputFixture}"`
	);
}

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

bin("should handle gz input", async (ctx) => {
	await validateFixture(ctx, "svg-7-hex", "image.svg.gz");
});

bin("should handle xml input", async (ctx) => {
	await validateFixture(ctx, "svg-7-hex", "image.svg");
});

bin("should handle text input", async (ctx) => {
	await validateFixture(ctx, "simple", "simple.txt");
});

bin("should handle js input", async (ctx) => {
	// await validateFixture(ctx, "svg-7-hex", "image.svg.gz");
});

bin.run();
