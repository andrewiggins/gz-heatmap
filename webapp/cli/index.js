import { getCodeLengthSize, getLZ77TotalBitSize } from "../../src/utils.js";

/** @type {(size: number, maxSize?: number) => string} */
const sizeToClass = (size, maxSize = 0) => {
	// size = Math.ceil(10 - maxSize + size);
	size = Math.ceil(size);
	return size < 17 ? `size-${size}` : "size-17";
};

/**
 * @param {number | number[]} text
 * @param {number} size
 * @returns {HTMLElement}
 */
function createNode(text, size, maxSize = 0) {
	let span = document.createElement("span");
	span.textContent = Array.isArray(text)
		? text.map((c) => String.fromCharCode(c)).join("")
		: String.fromCharCode(text);
	span.classList.add(sizeToClass(size, maxSize));

	return span;
}

/**
 * @param {Metadata} metadata
 * @param {HTMLElement} container
 */
export function renderIntoDom(metadata, container) {
	setupStyles();
	const markup = constructHeatmap(metadata);
	container.appendChild(markup);
}

/**
 * @param {Metadata} metadata
 * @returns {HTMLElement}
 */
function constructHeatmap(metadata) {
	const container = document.createElement("pre");
	container.classList.add("gz-heatmap-container");

	const maxSize = metadata.reduce(
		(max, datum) =>
			datum.type == "literal" && datum.value.size > max
				? datum.value.size
				: max,
		0
	);

	// let counts = countCodeUsages(metadata);

	for (let datum of metadata) {
		// let huffmanSize = getHuffmanCodeSize(datum, counts);
		let huffmanSize = 0;

		if (datum.type == "literal") {
			let size = datum.value.size + huffmanSize;

			console.log("size:", size);
			let node = createNode(datum.value.decoded, size, maxSize);
			container.appendChild(node);
		} else if (datum.type == "lz77") {
			let totalSize = getLZ77TotalBitSize(datum);

			let size = totalSize / datum.length.value;
			// let size = Math.floor(totalSize / datum.length.value);

			let node = createNode(datum.chars, size, maxSize);
			node.classList.add("lz77");
			node.setAttribute("data-length", datum.length.value.toString());
			node.setAttribute("data-dist", datum.dist.value.toString());

			container.appendChild(node);
		}
	}

	return container;
}

const styleId = "gz-heatmap-styles";
function setupStyles() {
	if (document.getElementById(styleId) != null) {
		return;
	}

	const style = document.createElement("style");
	style.id = styleId;
	style.textContent = `
		.gz-heatmap-container {
			color: #fff;
			white-space: pre-wrap;
			word-break: break-all;

			/* offset-x | offset-y | blur-radius | color */
			text-shadow: 1px 1px 2px black;
		}

		.gz-heatmap-container span {
			padding: 2px 0;
			line-height: 2.2rem;
		}

		.size-1  { background-color: #000560; } /* midnight blue */
		.size-2  { background-color: #023d9a; } /* dark blue */
		.size-3  { background-color: #005fd3; } /* royal blue */
		.size-4  { background-color: #0186c0; } /* teal */
		.size-5  { background-color: #4ab03d; } /* emerald green */
		.size-6  { background-color: #b5d000; } /* chartreuse (lime green) */
		.size-7  { background-color: #ebd109; } /* yellow */
		.size-8  { background-color: #fba70f; } /* orange */
		.size-9  { background-color: #ee0000; } /* bright red */
		.size-10 { background-color: #d00000; } /* dark red 1 */
		.size-11 { background-color: #b20000; } /* dark red 2 */
		.size-12 { background-color: #950000; } /* dark red 3 */
		.size-13 { background-color: #770000; } /* dark red 4 */
		.size-14 { background-color: #5a0000; } /* dark red 5 */
		.size-15 { background-color: #3c0000; } /* dark red 6 */
		.size-16 { background-color: #1e0000; } /* dark red 7 */
		.size-17 { background-color: #000000; } /* dark red 8 */
	`;

	document.head.appendChild(style);
}

/** @type {(key: any, mapName: string) => Error} */
const notFound = (key, mapName) =>
	new Error(`Could not find entry for ${key} in ${mapName}.`);

/**
 * @param {Metadata} metadata
 */
function countCodeUsages(metadata) {
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

	console.log("codeLengthCodes:\n", codeLengthCodes);
	console.log("literalCodes:\n", literalCodes);
	console.log("distCodes:\n", distCodes);

	return {
		codeLengthCodes,
		literalCodes,
		distCodes,
	};
}

/**
 * @param {BitInfo} datum
 * @param {ReturnType<typeof countCodeUsages>} counts
 * @returns {number}
 */
function getHuffmanCodeSize(
	datum,
	{ codeLengthCodes, literalCodes, distCodes }
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
			console.log({
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
