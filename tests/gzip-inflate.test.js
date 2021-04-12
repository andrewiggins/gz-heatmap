import { gzinflate } from "../src/inflate.js";
import { dirname, join } from "path";
import { existsSync } from "fs";
import { readFile, writeFile } from "fs/promises";
import { test } from "uvu";
import * as assert from "uvu/assert";
import {
	formatMetadata,
	getTotalEncodedBitSize,
	logMetadata,
	reconstructBinary,
} from "./utils/log.js";
import { fixture, readFixture } from "./utils/paths.js";

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
	test(`should inflate ${testFile}`, async () => {
		let input = await readFile(fixture(testFile + ".gz"));
		let expectedOut = await readFixture(fixture(testFile));

		let metadataPath = join(dirname(fixture(testFile)), "defdb.txt");
		let expectedMeta = null;
		if (existsSync(metadataPath)) {
			expectedMeta = (await readFixture(metadataPath))
				// Replace tab and line feed entries with their escape chars
				.replace(/^(\s?\[[0-9]+\] 0A)/gm, "$1  \\n")
				.replace(/^(\s?\[[0-9]+\] 09)/gm, "$1  \\t")
				// Remove extra code length lengths that don't exist in the original file
				.replace(/^\s?\[_\]\s+[0-9]+ CLL \(val: 0\)\n/gm, "");
		}

		let out = Buffer.alloc(expectedOut.length);
		let { metadata } = gzinflate(input, out);

		assert.is(out.toString("utf8"), expectedOut);

		if (expectedMeta) {
			assert.is(formatMetadata(metadata), expectedMeta);
		}

		// logMetadata(metadata);
		// await writeFile(
		// 	fixture(testFile + "-metadata.json"),
		// 	JSON.stringify(metadata, null, 2),
		// 	"utf8"
		// );
		const metadataFixturePath = fixture(testFile + "-metadata.json");
		const metadataFixture = await readFixture(metadataFixturePath);
		assert.fixture(JSON.stringify(metadata, null, 2), metadataFixture);

		let bitSize = getTotalEncodedBitSize(metadata);
		let expectedLen = input.length * 8;
		let byteRoundedSize = bitSize + (bitSize % 8 == 0 ? 0 : 8 - (bitSize % 8));
		assert.is(
			byteRoundedSize,
			expectedLen,
			"compute size does not match actual size"
		);

		let actualText = metadata.reduce(
			(s, d) =>
				d.type == "literal"
					? s + String.fromCharCode(d.value.decoded)
					: d.type == "lz77"
					? s + d.chars.map((v) => String.fromCharCode(v)).join("")
					: s,
			""
		);
		assert.is(actualText, expectedOut);

		let reconstructedBits = reconstructBinary(metadata, input);
		assert.equal(
			Array.from(reconstructedBits).map((v) => v.toString(2).padStart(8, "0")),
			Array.from(new Uint8Array(input)).map((v) =>
				v.toString(2).padStart(8, "0")
			),
			"reconstructed binary should match input binary"
		);
	});
});

test.run();
