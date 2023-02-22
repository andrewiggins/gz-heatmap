/// <reference path="../../src/global.d.ts" />

import { getLZ77TotalBitSize } from "../../src/utils.js";

/**
 * @param {Metadata} metadata
 */
export function logMetadata(metadata) {
	console.log(formatMetadata(metadata));
}

const lengthCodeLabels = [
	"3",
	"4",
	"5",
	"6",
	"7",
	"8",
	"9",
	"10",
	"[11-12]",
	"[13-14]",
	"[15-16]",
	"[17-18]",
	"[19-22]",
	"[23-26]",
	"[27-30]",
];

const distanceCodeLabels = [
	"1",
	"2",
	"3",
	"4",
	"[5-6]",
	"[7-8]",
	"[9-12]",
	"[13-16]",
	"[17-24]",
	"[25-32]",
	"[33-48]",
	"[49-64]",
	"[65-96]",
	"[97-128]",
	"[129-192]",
];

/**
 * @param {Metadata} metadata
 */
export function formatMetadata(metadata) {
	let out = "";

	for (let info of metadata) {
		switch (info.type) {
			case "bfinal":
				let bfinal = info.value.decoded;
				out += log({
					size: info.value.size,
					msg:
						bfinal == 1
							? `Last block (val: ${bfinal})`
							: `Not final (val: ${bfinal})`,
				});
				break;

			case "btype":
				let btype = info.value.decoded;
				let msg =
					btype == 0
						? `Uncompressed block (val: ${btype})`
						: btype == 1
						? `Fixed Huffman Tree block (val: ${btype})`
						: `Dynamic Huffman Tree block (val: ${btype})`;

				out += log({ size: info.value.size, msg });
				break;

			case "hlit":
				let hlit = info.value.decoded;
				out += log({
					size: info.value.size,
					msg: `HLIT  ${hlit.toString().padStart(3)} (val:${hlit - 257})`,
				});
				break;

			case "hdist":
				let hdist = info.value.decoded;
				out += log({
					size: info.value.size,
					msg: `HDIST ${hdist.toString().padStart(3)} (val:${hdist - 1})`,
				});
				break;

			case "hclen":
				let hclen = info.value.decoded;
				out += log({
					size: info.value.size,
					msg: `HCLEN ${hclen.toString().padStart(3)} (val:${hclen - 4})`,
				});
				break;

			case "code_length": {
				out += log({
					size: info.value.size,
					msg: getCodeLengthMessage(
						info.category,
						info.char,
						info.huffmanCodeLength
					),
				});
				break;
			}
			case "repeat_code_length": {
				let label = info.huffmanCodeLength == 0 ? "ZREP" : "LREP";
				out += log({
					size: info.symbol.size + info.repeatCount.size,
					msg: `${label} (${info.repeatCount.decoded} times)`,
				});

				for (let symbol of info.chars) {
					out += log({
						size: null,
						msg: getCodeLengthMessage(
							info.category,
							symbol,
							info.huffmanCodeLength
						),
					});
				}

				break;
			}
			case "literal": {
				let sym = info.value.decoded;
				out += log({
					size: info.value.size,
					msg: `${toHex(sym)}  ${toChar(sym)}`,
				});
				break;
			}
			case "lz77": {
				out += log({
					size: getLZ77TotalBitSize(info),
					msg: `(${info.length.value},${info.dist.value})`,
				});
				break;
			}
			case "block_end":
				out += log({
					size: info.value.size,
					msg: `EofB`,
				});
				break;
		}
	}

	return out;
}

/**
 * @param {{ size: number | null; msg: string; }} props
 */
function log({ size, msg }) {
	if (size == null) {
		return ` [_] ${msg}\n`;
	} else if (size < 10) {
		return ` [${size}] ${msg}\n`;
	} else {
		return `[${size}] ${msg}\n`;
	}
}

/**
 * @param {CodeLengthCategory} category
 * @param {number} symbol
 * @param {number} huffmanCodeLength
 */
function getCodeLengthMessage(category, symbol, huffmanCodeLength) {
	let symbolLabel;
	if (category == "run_length_table") {
		symbolLabel = symbol.toString(10).padStart(2);
	} else if (category == "lz77_length_table") {
		if (symbol < 256) {
			symbolLabel = `0x${toHex(symbol)}`;
		} else if (symbol == 256) {
			symbolLabel = `EofB`;
		} else {
			symbolLabel = `l_${(symbol - 257).toString(10).padStart(2, "0")}`;
		}
	} else {
		symbolLabel = `d_${symbol.toString(10).padStart(2, "0")}`;
	}

	let suffix = "";
	if (category == "lz77_length_table" && symbol > 256) {
		let index = symbol - 257;
		let label = "length" + (index < 8 ? "" : "s");
		suffix = ` (${label} ${lengthCodeLabels[index]})`;
	} else if (category == "lz77_dist_table") {
		let label = "distance" + (symbol < 4 ? "" : "s");
		suffix = ` (${label} ${distanceCodeLabels[symbol]})`;
	}

	let cat = category == "run_length_table" ? "CLL" : "CL";
	return `${symbolLabel} ${cat} (val: ${huffmanCodeLength})${suffix}`;
}

/**
 * @param {number} num
 * @returns {string}
 */
function toHex(num) {
	return num.toString(16).toUpperCase().padStart(2, "0");
}

/**
 * @param {number} num
 * @returns {string}
 */
function toChar(num) {
	let ch = String.fromCharCode(num);
	if (/\s/.test(ch)) {
		return JSON.stringify(ch).slice(1, -1);
	} else {
		return ch;
	}
}

/**
 * @param {Uint8Array} uint8
 */
export function uint8ToBitString(uint8) {
	return Array.from(uint8)
		.map((v) => v.toString(2))
		.join("");
}

/**
 * @param {number} num
 */
function toByteStr(num) {
	return num.toString(2).padStart(8, "0");
}

/**
 * @param {number} value
 * @param {number} length
 */
function invertBits(value, length) {
	let invertedValue = 0;
	while (length--) {
		invertedValue = (invertedValue << 1) | (value & 1);
		value >>>= 1;
	}

	return invertedValue;
}

/**
 * @param {Metadata} metadata
 * @returns {number}
 */
export function getTotalEncodedBitSize(metadata) {
	return metadata.reduce((sum, datum) => {
		if (datum.type == "lz77") {
			return sum + getLZ77TotalBitSize(datum);
		} else if (datum.type == "repeat_code_length") {
			return sum + datum.symbol.size + datum.repeatCount.size;
		} else if (datum.type == "gzip_header" || datum.type == "gzip_footer") {
			return sum + datum.bytes.length * 8;
		} else {
			return sum + datum.value.size;
		}
	}, 0);
}

/**
 * @param {Metadata} metadata
 * @param {Uint8Array} inputUint8
 * @returns {Uint8Array}
 */
export function reconstructBinary(metadata, inputUint8) {
	const input = Array.from(inputUint8);

	// Relevant section from spec:
	// 3.1.1. Packing into bytes
	//
	// This document does not address the issue of the order in which bits of a
	// byte are transmitted on a bit-sequential medium, since the final data
	// format described here is byte- rather than bit-oriented.  However, we
	// describe the compressed block format in below, as a sequence of data
	// elements of various bit lengths, not a sequence of bytes.  We must
	// therefore specify how to pack these data elements into bytes to form the
	// final compressed byte sequence:
	//
	//      * Data elements are packed into bytes in order of
	//        increasing bit number within the byte, i.e., starting
	//        with the least-significant bit of the byte.
	//      * Data elements other than Huffman codes are packed
	//        starting with the least-significant bit of the data
	//        element.
	//      * Huffman codes are packed starting with the most-
	//        significant bit of the code.
	//
	//  In other words, if one were to print out the compressed data as a sequence
	//  of bytes, starting with the first byte at the *right* margin and
	//  proceeding to the *left*, with the most- significant bit of each byte on
	//  the left as usual, one would be able to parse the result from right to
	//  left, with fixed-width elements in the correct MSB-to-LSB order and
	//  Huffman codes in bit-reversed order (i.e., with the first bit of the code
	//  in the relative LSB position).

	let byteSize = Math.ceil(getTotalEncodedBitSize(metadata) / 8);

	let resultIndex = 0;
	let byteBuffer = 0;
	let bitCount = 0;
	let result = new Uint8Array(byteSize);

	/** @type {(bits: number, length: number) => void} */
	const writeBitsToResult = (bits, length) => {
		while (length--) {
			let bitToSet = bits & 1;
			bits = bits >> 1;

			byteBuffer = byteBuffer | (bitToSet << bitCount);
			bitCount++;

			if (bitCount == 8) {
				if (byteBuffer !== input[resultIndex]) {
					throw new Error(
						`Expected ${toByteStr(byteBuffer)} to be ${toByteStr(
							input[resultIndex]
						)} at index ${resultIndex}.`
					);
				}

				result.set([byteBuffer], resultIndex);
				resultIndex++;
				byteBuffer = bitCount = 0;
			}
		}
	};

	for (let datum of metadata) {
		switch (datum.type) {
			case "gzip_header":
				result.set(datum.bytes, resultIndex);
				resultIndex += datum.bytes.length;
				break;
			case "gzip_footer":
				if (bitCount > 0) {
					result.set([byteBuffer], resultIndex);
					resultIndex++;
					byteBuffer = bitCount = 0;
				}

				result.set(datum.bytes, resultIndex);
				resultIndex += datum.bytes.length;
				break;
			case "bfinal":
			case "btype":
			case "hlit":
			case "hdist":
			case "hclen":
				writeBitsToResult(datum.value.bits, datum.value.size);
				break;
			case "block_end":
			case "literal": {
				let datumSize = datum.value.size;
				let datumValue = invertBits(datum.value.bits, datumSize);
				writeBitsToResult(datumValue, datumSize);
				break;
			}
			case "code_length": {
				let datumLength = datum.value.size;
				let datumValue = datum.value.bits;
				if (datum.category !== "run_length_table") {
					datumValue = invertBits(datumValue, datumLength);
				}

				writeBitsToResult(datumValue, datumLength);
				break;
			}
			case "repeat_code_length": {
				let invertedBits = invertBits(datum.symbol.bits, datum.symbol.size);
				writeBitsToResult(invertedBits, datum.symbol.size);
				writeBitsToResult(datum.repeatCount.bits, datum.repeatCount.size);
				break;
			}
			case "lz77": {
				let info = datum.length;
				let invertedValue = invertBits(info.symbol.bits, info.symbol.size);
				writeBitsToResult(invertedValue, info.symbol.size);
				writeBitsToResult(info.extraBits.bits, info.extraBits.size);

				info = datum.dist;
				invertedValue = invertBits(info.symbol.bits, info.symbol.size);
				writeBitsToResult(invertedValue, info.symbol.size);
				writeBitsToResult(info.extraBits.bits, info.extraBits.size);
				break;
			}
			default:
				assertNever(
					datum,
					`Metadata type not handled: ${JSON.stringify(datum)}`
				);
		}
	}

	return result;
}

/**
 * @param {never} val
 * @param {string} msg
 */
function assertNever(val, msg) {
	throw new Error(msg);
}
