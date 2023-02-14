import { getCodeLengthSize, getLZ77TotalBitSize } from "../../src/utils.js";

/**
 * @typedef Logger
 * @property {(...args: any) => void} debug
 *
 * @param {HeatMapOptions} options
 * @returns {Logger}
 */
function createLogger(options) {
	return {
		debug(...args) {
			if (options.debug) {
				console.log(...args);
			}
		},
	};
}

/**
 * @typedef {{ debug?: boolean }} HeatMapOptions
 *
 * @param {Metadata} metadata
 * @param {Node} container
 * @param {HeatMapOptions} [options]
 */
export function constructHeatMap(metadata, container, options = {}) {
	const logger = createLogger(options);
	logger.debug("metadata.length", metadata.length);

	let maxSize = 0; // Currently not using. Was previously used to normalize and distribute colors
	// for (let datum of metadata) {
	// 	if (datum.type == "literal" && datum.value.size > maxSize) {
	// 		maxSize = datum.value.size;
	// 	}
	// }

	// let counts = countCodeUsages(metadata);

	for (let datum of metadata) {
		// let huffmanSize = getHuffmanCodeSize(datum, counts);
		let huffmanSize = 0;

		if (datum.type == "literal") {
			let size = datum.value.size + huffmanSize;

			logger.debug("size:", size);
			let node = createNode(datum.value.decoded, size, maxSize);
			container.appendChild(node);
		} else if (datum.type == "lz77") {
			let totalSize = getLZ77TotalBitSize(datum);

			let size = totalSize / datum.length.value;
			// let size = Math.floor(totalSize / datum.length.value);

			let node = createNode(datum.chars, size, maxSize, "lz77");
			node.setAttribute("data-length", datum.length.value.toString());
			node.setAttribute("data-dist", datum.dist.value.toString());

			container.appendChild(node);
		}
	}
}

/** @type {(size: number, maxSize?: number) => string} */
const sizeToClass = (size, maxSize = 0) => {
	// size = Math.ceil(10 - maxSize + size);
	size = Math.ceil(size);
	return size < 17 ? `size-${size}` : "size-17";
};

/**
 * @param {number | number[]} text
 * @param {number} size
 * @param {string} [className]
 * @returns {HTMLElement}
 */
function createNode(text, size, maxSize = 0, className = "") {
	let span = document.createElement("span");
	span.textContent = Array.isArray(text)
		? String.fromCharCode(...text)
		: String.fromCharCode(text);
	span.className = sizeToClass(size, maxSize) + " " + className;

	return span;
}

/** @type {(key: any, mapName: string) => Error} */
const notFound = (key, mapName) =>
	new Error(`Could not find entry for ${key} in ${mapName}.`);

/**
 * @param {Metadata} metadata
 * @param {Logger} logger
 */
function countCodeUsages(metadata, logger) {
	/** @type {(map: Map<number, { count: number; datum: any; }>, key: number, mapName: string) => void} */
	const addOne = (map, key, mapName) => {
		let value = map.get(key);
		if (!value) throw notFound(key, mapName);
		value.count += 1;
	};

	/** @type {Map<number, {count: number, datum: HuffmanCodeLengths }>} */
	let codeLengthCodes = new Map();
	/** @type {Map<number, { count: number, datum: HuffmanCodeLengths | RepeatHuffmanCodeLengths}>} */
	let literalCodes = new Map();
	/** @type {Map<number, { count: number, datum: HuffmanCodeLengths | RepeatHuffmanCodeLengths}>} */
	let distCodes = new Map();

	for (let datum of metadata) {
		if (datum.type == "code_length") {
			if (datum.category == "run_length_table") {
				codeLengthCodes.set(datum.char, { count: 0, datum });
			} else if (datum.category == "lz77_length_table") {
				literalCodes.set(datum.char, { count: 0, datum });
				addOne(codeLengthCodes, datum.huffmanCodeLength, "codeLengthCodes");
			} else if (datum.category == "lz77_dist_table") {
				distCodes.set(datum.char, { count: 0, datum });
				addOne(codeLengthCodes, datum.huffmanCodeLength, "codeLengthCodes");
			}
		} else if (datum.type == "repeat_code_length") {
			addOne(codeLengthCodes, datum.symbol.decoded, "codeLengthCodes");

			for (let char of datum.chars) {
				if (datum.category == "lz77_length_table") {
					literalCodes.set(char, { count: 0, datum });
				} else if (datum.category == "lz77_dist_table") {
					distCodes.set(char, { count: 0, datum });
				}
			}
		} else if (datum.type == "literal") {
			let counts = literalCodes.get(datum.value.decoded);
			if (!counts) throw notFound(datum.value.decoded, "literalCodes");

			counts.count++;
		} else if (datum.type == "lz77") {
			let lengthSymbol = datum.length.symbol.decoded;
			let lengthCounts = literalCodes.get(lengthSymbol);
			let distSymbol = datum.dist.symbol.decoded;
			let distCounts = distCodes.get(distSymbol);

			if (!lengthCounts) throw notFound(lengthSymbol, "literalCodes");
			if (!distCounts) throw notFound(distSymbol, "distCodes");

			lengthCounts.count++;
			distCounts.count++;
		}
	}

	logger.debug("codeLengthCodes:\n", codeLengthCodes);
	logger.debug("literalCodes:\n", literalCodes);
	logger.debug("distCodes:\n", distCodes);

	return {
		codeLengthCodes,
		literalCodes,
		distCodes,
	};
}

/**
 * @param {BitInfo} datum
 * @param {ReturnType<typeof countCodeUsages>} counts
 * @param {Logger} logger
 * @returns {number}
 */
function getHuffmanCodeSize(
	datum,
	{ codeLengthCodes, literalCodes, distCodes },
	logger
) {
	let size = 0;

	if (datum.type == "literal") {
		let literal = datum.value.decoded;
		let huffmanCode = literalCodes.get(literal);
		if (!huffmanCode) throw notFound(literal, "literalCodes");
		let huffmanCodeSize =
			getCodeLengthSize(huffmanCode.datum) / huffmanCode.count;

		let codeLength = codeLengthCodes.get(huffmanCode.datum.huffmanCodeLength);
		if (!codeLength)
			throw notFound(huffmanCode.datum.huffmanCodeLength, "codeLengthCodes");

		// size = datum.value.size + huffmanCodeSize + 3 / codeLength.count;
		size = huffmanCodeSize + 3 / codeLength.count;

		if (huffmanCode.datum.type == "code_length") {
			let hCode = huffmanCode.datum;
			let cLCode = codeLength.datum;
			logger.debug({
				a_literal: {
					bits: datum.value.bits.toString(2),
					size: datum.value.size,
					decoded: String.fromCharCode(datum.value.decoded),
				},
				b_huffmanCode: {
					char: String.fromCharCode(hCode.char),
					bits: hCode.value.bits.toString(2),
					size: hCode.value.size,
					decoded: hCode.value.decoded,
					usedBy: huffmanCode.count,
				},
				c_codeLength: {
					bits: cLCode.value.bits.toString(2),
					size: cLCode.value.size,
					decoded: cLCode.value.decoded,
					usedBy: codeLength.count,
				},
				totalSize: size,
			});
		}
	} else if (datum.type == "lz77") {
		let literal = datum.length.symbol.decoded;
		let dist = datum.dist.symbol.decoded;

		let literalHuffmanCode = literalCodes.get(literal);
		let distHuffmanCode = distCodes.get(dist);
		if (!literalHuffmanCode) throw notFound(literal, "literalCodes");
		if (!distHuffmanCode) throw notFound(dist, "distCodes");

		// TODO
		size = 0;
	}

	return size;
}
