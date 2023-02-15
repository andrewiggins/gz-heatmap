import { readdirSync } from "fs";
import { readFile, writeFile } from "fs/promises";
import { ChildProcess, spawn } from "child_process";
import { join, dirname } from "path";
import { fileURLToPath } from "url";
import { suite } from "uvu";
import * as assert from "uvu/assert";
import puppeteer from "puppeteer";
import prettier from "prettier";
import stripAnsi from "strip-ansi";
import treeKill from "tree-kill";
import { fixture } from "./utils/paths.js";
import ViteConfig from "../vite.config.js";
import { promisify } from "util";

const __dirname = dirname(fileURLToPath(import.meta.url));
/** @type {(...args: string[]) => string} */
const repoRoot = (...args) => join(__dirname, "..", ...args);

const viteConfig = /** @type {import('vite').UserConfig} */ (ViteConfig);
const treeKillAsync = promisify(treeKill);

/**
 * @typedef WebsiteSuiteContext
 * @property {import('puppeteer').Browser} browser
 * @property {import('puppeteer').Page} page
 * @property {{url: string; server: ChildProcess }} serverInfo
 */
/**
 * @typedef {import('puppeteer').Page} Page
 */

/** @type {import('uvu').Test<WebsiteSuiteContext>} */
const website = suite("website");

const serverInfo = await startServer();
const browser = await puppeteer.launch();

website.before.each(async (ctx) => {
	ctx.serverInfo = serverInfo;
	ctx.browser = browser;
	ctx.page = await ctx.browser.newPage();
	ctx.page.setDefaultTimeout(10e3);
});

website.after.each(async (ctx) => {
	await ctx.page.close();
});

website.after(async (ctx) => {
	if (ctx.serverInfo && ctx.serverInfo.server.pid) {
		await treeKillAsync(ctx.serverInfo.server.pid);
	}
	await ctx.browser?.close();
});

/** @returns {Promise<{url: string; server: ChildProcess }>} */
function startServer(timeoutMs = 3e3) {
	return new Promise((resolve, reject) => {
		const server = spawn("npm", ["run", "preview"], {
			cwd: repoRoot(),
			stdio: "pipe",
		});

		/** @type {NodeJS.Timeout} */
		let timeout;
		if (timeoutMs > 0) {
			timeout = setTimeout(() => {
				server.off("data", onStdOutChunk);
				server.kill();
				reject(
					new Error(
						"Timed out waiting for Vite server to get set up. Did it output a URL?"
					)
				);
			}, timeoutMs);
		}

		// Look for lines like:
		// Local:   http://localhost:4173/gz-heatmap/
		const urlLine = /Local:\s+(https?:\/\/localhost:[0-9]+\/gz-heatmap\/?)/;
		let output = "";

		/** @param {Buffer | string} chunk */
		function onStdOutChunk(chunk) {
			chunk = chunk.toString("utf8");

			process.stdout.write(chunk);
			output += stripAnsi(chunk);
			let match = output.match(urlLine);
			if (match) {
				server.off("data", onStdOutChunk);
				clearTimeout(timeout);
				resolve({ url: match[1], server });
			}
		}

		server.stdout.on("data", onStdOutChunk);
	});
}

/**
 * @param {import('puppeteer').Page} page
 * @returns {Promise<string>}
 */
async function getPageContent(page) {
	const gzHeatMapEndTag = `</gz-heatmap>`;
	let content = await page.content();
	if (content.includes(gzHeatMapEndTag)) {
		const heatmapContents = await page.evaluate(() =>
			Array.from(document.querySelectorAll("gz-heatmap")).map(
				(el) => el.shadowRoot?.innerHTML ?? ""
			)
		);

		let i = 0;
		content = content.replace(gzHeatMapEndTag, () => {
			return heatmapContents[i++] + gzHeatMapEndTag;
		});
	}

	return content;
}

/** @type {(rawHtml: string) => string} */
function formatHtml(rawHtml) {
	rawHtml = rawHtml
		.replace(/([^\n])<span /g, "$1\n<span ")
		.replace(/([^\n])<\/pre>/g, "$1\n</pre>");

	return prettier.format(rawHtml, { parser: "html" });
}

/**
 * @param {WebsiteSuiteContext} ctx
 * @param {string} fixtureDir
 */
async function validateFixture(ctx, fixtureDir = "svg-7-hex") {
	let html = formatHtml(await getPageContent(ctx.page));

	const expectedFixture = fixture(fixtureDir, "websiteExpected.html");
	let expectedHtml = await readFile(expectedFixture, "utf8");

	const indexHashRegex = /index-\w+\.js/g;
	html = html.replace(indexHashRegex, "index.js");
	expectedHtml = html.replace(indexHashRegex, "index.js");

	await writeFile(expectedFixture, html, "utf8");

	assert.fixture(
		html,
		expectedHtml,
		`page html did not match expected fixture`
	);
}

/** @type {string} */
let exampleURL = "";
/** @type {string} */
let examplePath = "";

/** @type {(...args: string[]) => string} */
const assetsDir = (...args) => repoRoot("dist/assets", ...args);
for (let entry of readdirSync(assetsDir())) {
	if (entry.endsWith(".svg")) {
		examplePath = assetsDir(entry);
		exampleURL = examplePath
			.replace(repoRoot("dist"), viteConfig.base ?? "/")
			.replace(/\/\//g, "/");
	}
}

if (!examplePath || !exampleURL) {
	serverInfo.server.kill();
	await browser.close();
	throw new Error(`Could not find example SVG in assets dir: ${assetsDir()}`);
}

/** @type {(page: Page, url: string) => Promise<void>} */
async function loadURL(page, url = exampleURL) {
	// Click the input 3 times to select all text in the input so what we type
	// next overrides any existing value
	await page.click(`input[name=url]`, { clickCount: 3 });
	await page.type(`input[name=url]`, url);
	await page.click(`input[type=submit]`);
}

/** @type {(page: Page) => Promise<void>} */
async function validateSuccessfulLoad(page) {
	const gzheatmap = await page.waitForSelector("gz-heatmap");
	assert.ok(gzheatmap, `Expected to find a gz-heatmap element.`);

	const errorElements = await page.$$(".error");
	assert.equal(
		errorElements.length,
		0,
		`Expected 0 error elements. Got ${errorElements.length}.`
	);
}

/** @type {(page: Page) => Promise<void>} */
async function validateErrorUI(page) {
	const errorElements = await page.waitForSelector(".error");
	assert.ok(errorElements, `Expected an error element.`);

	const gzheatmap = await page.$$("gz-heatmap");
	assert.equal(
		gzheatmap.length,
		0,
		`Expected 0 gz-heatmap element. Got ${gzheatmap.length}.`
	);
}

/** @type {(page: Page, expectedURLParam?: string) => Promise<void>} */
async function validateURL(page, expectedURLParam = exampleURL) {
	const url = new URL(page.url());
	const actual = url.searchParams.get("url");

	if (expectedURLParam) {
		assert.equal(
			actual,
			expectedURLParam,
			`Expected "url" param to be "${expectedURLParam}". Got "${actual}"`
		);
	} else {
		assert.ok(
			!url.searchParams.has("url") || actual === "",
			`Expected not to have a url parameter or have an empty url parameter. Got "${actual}" instead.`
		);
	}
}

website("should show gz analysis for valid URL", async (ctx) => {
	await ctx.page.goto(serverInfo.url);
	await loadURL(ctx.page, exampleURL);
	await validateSuccessfulLoad(ctx.page);
	await validateURL(ctx.page);
	await validateFixture(ctx);
});

website("should show gz analysis for valid file upload", async (ctx) => {
	await ctx.page.goto(serverInfo.url);
	const [fileChooser] = await Promise.all([
		ctx.page.waitForFileChooser(),
		ctx.page.click("input[type=file]"),
	]);
	await fileChooser.accept([examplePath]);
	await ctx.page.click("input[type=submit]");

	await validateSuccessfulLoad(ctx.page);
});

website("should load example", async (ctx) => {
	await ctx.page.goto(serverInfo.url);
	await ctx.page.click("button[data-test-id=load-example]");
	await validateSuccessfulLoad(ctx.page);
	await validateURL(ctx.page);
});

website("should show error for submitting empty form", async (ctx) => {
	await ctx.page.goto(serverInfo.url);
	await loadURL(ctx.page, "");
	await validateErrorUI(ctx.page);
	await validateURL(ctx.page, "");
});

website("should show error for submitting a 404 URL", async (ctx) => {
	const url = "/fake-url/does-not-exist";
	await ctx.page.goto(serverInfo.url);
	await loadURL(ctx.page, url);
	await validateErrorUI(ctx.page);
	await validateURL(ctx.page, url);
});

website(
	"should clear error and update URL when recovering from bad URL",
	async (ctx) => {
		const url = "/fake-url/does-not-exist";

		await ctx.page.goto(serverInfo.url);
		await loadURL(ctx.page, url);
		await validateErrorUI(ctx.page);
		await validateURL(ctx.page, url);

		await loadURL(ctx.page, exampleURL);
		await validateSuccessfulLoad(ctx.page);
		await validateURL(ctx.page);
	}
);

website(
	"should clear gz analysis and update URL when changing to bad URL",
	async (ctx) => {
		const url = "/fake-url/does-not-exist";

		await ctx.page.goto(serverInfo.url);
		await loadURL(ctx.page, exampleURL);
		await validateSuccessfulLoad(ctx.page);
		await validateURL(ctx.page);

		await loadURL(ctx.page, url);
		await validateErrorUI(ctx.page);
		await validateURL(ctx.page, url);
	}
);

website.run();
