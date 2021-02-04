import { gzinflate } from "../src/inflate.js";
import { dirname, join } from "path";
import { fileURLToPath } from "url";
import { readFileSync, existsSync } from "fs";
import { test } from "uvu";
import { deepStrictEqual, strictEqual } from "assert";
import {
	formatMetadata,
	getTotalEncodedBitSize,
	logMetadata,
	reconstructBinary,
} from "./utils/log.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
/** @type {(...args: string[]) => string} */
const fixture = (...args) => join(__dirname, "fixtures", ...args);

/** @type {(path: string) => string} */
const readFixture = (path) => readFileSync(path, "utf8").replace(/\r\n/g, "\n");

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
	test(`should inflate ${testFile}`, () => {
		let input = readFileSync(fixture(testFile + ".gz"));
		let expectedOut = readFixture(fixture(testFile));

		let metadataPath = join(dirname(fixture(testFile)), "defdb.txt");
		let expectedMeta = null;
		if (existsSync(metadataPath)) {
			expectedMeta = readFixture(metadataPath)
				// Replace tab and line feed entries with their escape chars
				.replace(/^(\s?\[[0-9]+\] 0A)/gm, "$1  \\n")
				.replace(/^(\s?\[[0-9]+\] 09)/gm, "$1  \\t")
				// Remove extra code length lengths that don't exist in the original file
				.replace(/^\s?\[_\]\s+[0-9]+ CLL \(val: 0\)\n/gm, "");
		}

		let out = Buffer.alloc(expectedOut.length);
		let { metadata } = gzinflate(input, out);

		deepStrictEqual(out.toString("utf8"), expectedOut);

		if (expectedMeta) {
			deepStrictEqual(formatMetadata(metadata), expectedMeta);
		}

		// logMetadata(metadata);

		let bitSize = getTotalEncodedBitSize(metadata);
		let expectedLen = input.length * 8;
		let byteRoundedSize = bitSize + (bitSize % 8 == 0 ? 0 : 8 - (bitSize % 8));
		strictEqual(
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
		strictEqual(actualText, expectedOut);

		let reconstructedBits = reconstructBinary(metadata, input);
		deepStrictEqual(
			Array.from(reconstructedBits).map((v) => v.toString(2).padStart(8, "0")),
			Array.from(new Uint8Array(input)).map((v) =>
				v.toString(2).padStart(8, "0")
			),
			"reconstructed binary should match input binary"
		);
	});
});

test.run();
