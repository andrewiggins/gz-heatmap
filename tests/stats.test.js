import { gzinflate } from "../src/inflate.js";
import { readFile, writeFile } from "fs/promises";
import { test } from "uvu";
import * as assert from "uvu/assert";
import { getTotalEncodedBitSize } from "./utils/log.js";
import { fixture, readFixture } from "./utils/paths.js";
import {
	computeStats,
	getBitsCompressed,
	getBytesCompressed,
	getBytesExpanded,
} from "../webapp/shared/computeStats.js";

const testFiles = [
	"simple/simple.txt",
	"svg-1-original/image.svg",
	"svg-2-svgo/image.svg",
	"svg-3-viewbox/image.svg",
	"svg-4-unclosed/image.svg",
	"svg-5-lowercase/image.svg",
	"svg-6-backrefs/image.svg",
	"svg-7-hex/image.svg",
];

testFiles.forEach((testFile) => {
	test(`should compute stats for ${testFile}`, async () => {
		const input = await readFile(fixture(testFile + ".gz"));
		const expectedOut = await readFixture(fixture(testFile));

		const statsFixturePath = fixture(testFile + ".stats.json");
		// const expectedStats = await readFixture(statsFixturePath);
		// const expectedStats = "{}";

		const out = Buffer.alloc(expectedOut.length);
		const { metadata } = gzinflate(input, out);
		const stats = computeStats(metadata);

		const actualStats = JSON.stringify(stats, null, 2);
		await writeFile(statsFixturePath, actualStats, "utf8");

		assert.is(out.toString("utf8"), expectedOut);

		// assert.fixture(actualStats, expectedStats);
		assert.is(getBytesExpanded(stats), expectedOut.length);
		assert.is(getBitsCompressed(stats), getTotalEncodedBitSize(metadata));
		assert.is(getBytesCompressed(stats), input.byteLength);
	});
});

test.run();
