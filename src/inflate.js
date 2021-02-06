// Algorithm here is adapted from a fork of [tiny-inflate](https://github.com/foliojs/tiny-inflate)
// with some functions from [fflate](https://github.com/101arrowz/fflate)

const TINF_OK = 0;
const TINF_DATA_ERROR = -3;

class Tree {
	constructor() {
		/** table of code length counts */
		this.table = new Uint16Array(16);
		/** code -> symbol translation table */
		this.trans = new Uint16Array(288);
	}
}

class Data {
	/**
	 * @param {Uint8Array} source
	 * @param {Uint8Array} dest
	 */
	constructor(source, dest) {
		/** Source array of bytes */
		this.source = source;
		/** Index of the next byte to load from source */
		this.sourceIndex = 0;

		/** Buffer containing yet to be consumed bits from source */
		this.tag = 0;
		/** The number of bits to consume from tag before loading more from source */
		this.bitcount = 0;

		/** Destination array of bytes */
		this.dest = dest;
		/** Number of bytes written to dest. Also the index to write they next byte to */
		this.destLen = 0;
	}
}

/* --------------------------------------------------- *
 * -- uninitialized global data (static structures) -- *
 * --------------------------------------------------- */

const fixedLiteralTree = new Tree();
const fixedDistTree = new Tree();

/* extra bits and base tables for length codes */
const lengthExtraBitsSize = new Uint8Array(30);
const lengthExtraBitsBase = new Uint16Array(30);

/* extra bits and base tables for distance codes */
const distExtraBitsSize = new Uint8Array(30);
const distExtraBitsBase = new Uint16Array(30);

/* special ordering of code length codes */
// prettier-ignore
const codeLengthCodesSymbols = new Uint8Array([
  16, 17, 18, 0, 8, 7, 9, 6,
  10, 5, 11, 4, 12, 3, 13, 2,
  14, 1, 15
]);

/* ----------------------- *
 * -- utility functions -- *
 * ----------------------- */

/** Build extra bits and base tables. Quick way to generate tables from
 * https://www.ietf.org/rfc/rfc1951.html#section-3.2.5
 * @param {Uint8Array} bits The array of the number of extra bits to read
 * @param {Uint16Array} base The array of of the base number to add to the read extra bits
 * @param {number} delta
 * @param {number} first
 */
function buildExtraBitArrays(bits, base, delta, first) {
	let i, sum;

	/* build bits table */
	for (i = 0; i < delta; ++i) bits[i] = 0;
	for (i = 0; i < 30 - delta; ++i) bits[i + delta] = (i / delta) | 0;

	/* build base table */
	for (sum = first, i = 0; i < 30; ++i) {
		base[i] = sum;
		sum += 1 << bits[i];
	}
}

/** Build the fixed huffman trees
 * @param {Tree} literalTree
 * @param {Tree} distTree
 */
function buildFixedTrees(literalTree, distTree) {
	// https://www.ietf.org/rfc/rfc1951.html#section-3.2.6

	let i;

	/* build fixed length tree */
	for (i = 0; i < 7; ++i) literalTree.table[i] = 0;

	literalTree.table[7] = 24;
	literalTree.table[8] = 152;
	literalTree.table[9] = 112;

	for (i = 0; i < 24; ++i) literalTree.trans[i] = 256 + i;
	for (i = 0; i < 144; ++i) literalTree.trans[24 + i] = i;
	for (i = 0; i < 8; ++i) literalTree.trans[24 + 144 + i] = 280 + i;
	for (i = 0; i < 112; ++i) literalTree.trans[24 + 144 + 8 + i] = 144 + i;

	/* build fixed distance tree */
	for (i = 0; i < 5; ++i) distTree.table[i] = 0;

	distTree.table[5] = 32;

	for (i = 0; i < 32; ++i) distTree.trans[i] = i;
}

const offs = new Uint16Array(16);

/** Given an array of code lengths, build a tree
 * @param {Tree} tree
 * @param {Uint8Array} codeLengths
 * @param {number} off TODO: Is this necessary
 * @param {number} num TODO: Is this necessary
 */
function buildHuffmanTree(tree, codeLengths, off, num) {
	let i, sum;

	/* clear code length count table */
	for (i = 0; i < 16; ++i) tree.table[i] = 0;

	/* scan symbol lengths, and sum code length counts */
	for (i = 0; i < num; ++i) tree.table[codeLengths[off + i]]++;

	tree.table[0] = 0;

	/* compute offset table for distribution sort */
	for (sum = 0, i = 0; i < 16; ++i) {
		offs[i] = sum;
		sum += tree.table[i];
	}

	/* create code->symbol translation table (symbols sorted by code) */
	for (i = 0; i < num; ++i) {
		if (codeLengths[off + i]) {
			tree.trans[offs[codeLengths[off + i]]++] = i;
		}
	}
}

/* ---------------------- *
 * -- decode functions -- *
 * ---------------------- */

/** Get one bit from source stream
 * @param {Data} data
 */
function readBit(data) {
	/* check if tag is empty */
	if (!data.bitcount--) {
		/* load next byte into the buffer (i.e. tag) */
		data.tag = data.source[data.sourceIndex++];
		data.bitcount = 7; // bit count is seven since we are about to read a byte
	}

	/* shift bit out of tag */
	let bit = data.tag & 1;
	data.tag >>>= 1;

	return bit;
}

/** Read a num bit value from a stream
 * @param {Data} data The source data to read bits from
 * @param {number} num The number of bits to read
 */
function readBits(data, num) {
	// TODO: Not sure why 24 is the chosen buffer here... `num` seems to work but
	// other code paths also load 24 bits at a time
	while (data.bitcount < 24) {
		data.tag |= data.source[data.sourceIndex++] << data.bitcount;
		data.bitcount += 8;
	}

	// Need to AND tag with 0b1111 where the number of 1s in the binary number
	// equal the length of num. This line of code does that (up to 16 bits).
	// 0xffff is 16 1s. Shift that binary 16 - num to end up with a binary that is
	// of length num filled with 1s. In other words, if num is 2,
	// 0b1111111111111111 >>> 14 = 0b11. Use the result to read the 0b11 bits of
	// the tag.
	let val = data.tag & (0xffff >>> (16 - num));
	data.tag >>>= num;
	data.bitcount -= num;

	return val;
}

/** Given a data stream and a tree, decode a symbol
 * @param {Data} data
 * @param {Tree} tree
 * @returns {BitsRead}
 */
function decodeSymbol(data, tree) {
	while (data.bitcount < 24) {
		data.tag |= data.source[data.sourceIndex++] << data.bitcount;
		data.bitcount += 8;
	}

	let bits = 0;
	let sum = 0;
	let cur = 0;
	let size = 0;
	let tag = data.tag;

	/* get more bits while code value is above sum */
	do {
		bits = (bits << 1) | (tag & 1);

		cur = 2 * cur + (tag & 1);
		tag >>>= 1;
		++size;

		sum += tree.table[size];
		cur -= tree.table[size];
	} while (cur >= 0);

	data.tag = tag;
	data.bitcount -= size;

	return {
		bits,
		size,
		decoded: tree.trans[sum + cur],
	};
}

/** Given a data stream, decode dynamic trees from it
 * @param {Data} data
 * @param {Tree} literalTree
 * @param {Tree} distTree
 * @param {Metadata} metadata
 */
function decodeTrees(data, literalTree, distTree, metadata) {
	/* get 5 bits HLIT (257-286) */
	// Read 5 bits to get the length of the literal/length huffman bit lengths
	let hlitBits = readBits(data, 5);
	let hlit = hlitBits + 257;
	metadata.push({
		type: "hlit",
		value: {
			bits: hlitBits,
			size: 5,
			decoded: hlit,
		},
	});

	/* get 5 bits HDIST (1-32) */
	// Read 5 bits to get the length of the distance huffman bit lengths
	let hdistBits = readBits(data, 5);
	let hdist = hdistBits + 1;
	metadata.push({
		type: "hdist",
		value: {
			bits: hdistBits,
			size: 5,
			decoded: hdist,
		},
	});

	/* get 4 bits HCLEN (4-19) */
	// Read 4 bits to get the length of the run-length encoding huffman bit
	// lengths
	let hclenBits = readBits(data, 4);
	let hclen = hclenBits + 4;
	metadata.push({
		type: "hclen",
		value: {
			bits: hclenBits,
			size: 4,
			decoded: hclen,
		},
	});

	const codeTree = new Tree();
	const codeLengths = new Uint8Array(288 + 32);

	// Read run-length encoding bit lengths run-length encoding alphabet
	for (let i = 0; i < hclen; ++i) {
		/* get 3 bits code length (0-7) */
		let clen = readBits(data, 3);
		codeLengths[codeLengthCodesSymbols[i]] = clen;

		metadata.push({
			type: "code_length",
			category: "run_length_table",
			huffmanCodeLength: clen,
			char: codeLengthCodesSymbols[i],
			value: {
				bits: clen,
				size: 3,
				decoded: clen,
			},
		});
	}

	// Build run-length encoding huffman tree
	buildHuffmanTree(codeTree, codeLengths, 0, 19);

	// Decode the run-length encoded huffman bit counts for the literal/length
	// huffman tree and distance huffman tree. Here we can just read the bit
	// counts together into one array and then split the array at the end
	for (let num = 0; num < hlit + hdist; ) {
		const symbol = decodeSymbol(data, codeTree);

		/** @type {CodeLengthCategory} */
		const category = num < hlit ? "lz77_length_table" : "lz77_dist_table";
		/** @type {(num: number) => number} Get the "character" in this table's alphabet this symbol represents */
		const getChar = (num) =>
			// For the lz77_length table, we think of characters as the values 0 - 287.
			// But for the distance table we think of characters as the values 0 - 31
			category == "lz77_length_table" ? num : num - hlit;

		switch (symbol.decoded) {
			case 16: {
				/* copy previous code length 3-6 times (read 2 bits) */
				let prev = codeLengths[num - 1];

				let chars = [];
				let repeatCountBits = readBits(data, 2);
				let repeatCount = repeatCountBits + 3;

				for (let length = repeatCount; length; --length) {
					let sym = num++;
					codeLengths[sym] = prev;

					chars.push(getChar(sym));
				}

				metadata.push({
					type: "repeat_code_length",
					category,
					huffmanCodeLength: prev,
					chars,
					symbol,
					repeatCount: {
						bits: repeatCountBits,
						size: 2,
						decoded: repeatCount,
					},
				});
				break;
			}
			case 17: {
				/* repeat code length 0 for 3-10 times (read 3 bits) */
				let repeatCountBits = readBits(data, 3);
				let repeatCount = repeatCountBits + 3;

				let chars = [];
				for (let length = repeatCount; length; --length) {
					let sym = num++;
					codeLengths[sym] = 0;

					chars.push(getChar(sym));
				}

				metadata.push({
					type: "repeat_code_length",
					huffmanCodeLength: 0,
					category,
					chars,
					symbol,
					repeatCount: {
						bits: repeatCountBits,
						size: 3,
						decoded: repeatCount,
					},
				});
				break;
			}
			case 18: {
				/* repeat code length 0 for 11-138 times (read 7 bits) */
				let repeatCountBits = readBits(data, 7);
				let repeatCount = repeatCountBits + 11;

				let chars = [];
				for (let length = repeatCount; length; --length) {
					let sym = num++;
					codeLengths[sym] = 0;

					chars.push(getChar(sym));
				}

				metadata.push({
					type: "repeat_code_length",
					huffmanCodeLength: 0,
					category,
					chars,
					symbol,
					repeatCount: {
						bits: repeatCountBits,
						size: 7,
						decoded: repeatCount,
					},
				});
				break;
			}
			default: {
				/* values 0-15 represent the actual code lengths */
				codeLengths[num++] = symbol.decoded;
				metadata.push({
					type: "code_length",
					category,
					huffmanCodeLength: symbol.decoded,
					char: getChar(num - 1),
					value: symbol,
				});
				break;
			}
		}
	}

	/* build dynamic trees */
	buildHuffmanTree(literalTree, codeLengths, 0, hlit);
	buildHuffmanTree(distTree, codeLengths, hlit, hdist);
}

/* ----------------------------- *
 * -- block inflate functions -- *
 * ----------------------------- */

/** Given a stream and two trees, inflate a block of data
 * @param {Data} data The source and destination data
 * @param {Tree} literalTree The main huffman codes/tree. Includes the literal
 * symbols and LZ77 length symbols (the length part of the LZ77 back reference)
 * @param {Tree} distTree The LZ77 distance huffman codes/tree (the distance
 * part of the LZ77 back reference)
 * @param {Metadata} metadata
 */
function inflateBlockData(data, literalTree, distTree, metadata) {
	while (1) {
		let value = decodeSymbol(data, literalTree);

		/* check for end of block */
		if (value.decoded === 256) {
			metadata.push({ type: "block_end", value });
			return TINF_OK;
		}

		if (value.decoded < 256) {
			metadata.push({ type: "literal", value });

			data.dest[data.destLen++] = value.decoded;
		} else {
			let i;

			/** @type {BitsRead} */
			let lengthSymbol = value;

			// Convert the length symbol into an index into the lengthExtraBitsSize
			// and lengthExtraBitsBase arrays
			let lengthIndex = value.decoded - 257;

			// https://tools.ietf.org/html/rfc1951#section-3.2.5
			// Read the extra bits for this LZ77 length symbol, and add the "base"
			// length (the lowest length this symbol can represent) to the integer the
			// extra bits represent
			let lengthExtraBits = readBits(data, lengthExtraBitsSize[lengthIndex]);
			let lengthValue = lengthExtraBitsBase[lengthIndex] + lengthExtraBits;

			// Read the LZ77 distance symbol using the distance huffman tree
			let distSymbol = decodeSymbol(data, distTree);
			let distIndex = distSymbol.decoded;

			// https://tools.ietf.org/html/rfc1951#section-3.2.5
			// Read the extra bits for the LZ77 distance symbol, and its "base"
			// distance to the integer represented by the extra bits. Then subtract
			// that distance from the current length of the destination buffer to get
			// the offset this LZ77 back reference stats at
			let distExtraBits = readBits(data, distExtraBitsSize[distIndex]);
			let distValue = distExtraBitsBase[distIndex] + distExtraBits;

			// The offset in the dest array to begin copying
			let offset = data.destLen - distValue;

			// Copy the symbols represented by this LZ77 back reference to the end of
			// the destination buffer
			let values = [];
			for (i = offset; i < offset + lengthValue; ++i) {
				let value = data.dest[i];
				data.dest[data.destLen++] = value;
				values.push(value);
			}

			metadata.push({
				type: "lz77",
				chars: values,
				length: {
					value: lengthValue,
					symbol: lengthSymbol,
					extraBits: {
						bits: lengthExtraBits,
						size: lengthExtraBitsSize[lengthIndex],
						decoded: lengthExtraBits,
					},
				},
				dist: {
					value: distValue,
					symbol: distSymbol,
					extraBits: {
						bits: distExtraBits,
						size: distExtraBitsSize[distIndex],
						decoded: distExtraBits,
					},
				},
			});
		}
	}
}

/** Inflate an uncompressed block of data
 * @param {Data} data
 */
function inflateUncompressedBlock(data) {
	let length, invlength;
	let i;

	/* unread from bitbuffer */
	while (data.bitcount > 8) {
		data.sourceIndex--;
		data.bitcount -= 8;
	}

	/* get length */
	length = data.source[data.sourceIndex + 1];
	length = 256 * length + data.source[data.sourceIndex];

	/* get one's complement of length */
	invlength = data.source[data.sourceIndex + 3];
	invlength = 256 * invlength + data.source[data.sourceIndex + 2];

	/* check length */
	if (length !== (~invlength & 0x0000ffff)) {
		return TINF_DATA_ERROR;
	}

	data.sourceIndex += 4;

	/* copy block */
	for (i = length; i; --i) {
		data.dest[data.destLen++] = data.source[data.sourceIndex++];
	}

	/* make sure we start next block on a byte boundary */
	data.bitcount = 0;

	return TINF_OK;
}

/** Inflate stream from source to dest
 * @param {Uint8Array} source
 * @param {Uint8Array} dest
 * @returns {{ result: Uint8Array, metadata: Metadata }}
 */
export function inflate(source, dest) {
	/** @type {Metadata} */
	let metadata = [];

	const data = new Data(source, dest);
	let bfinal, btype, res;

	do {
		/* read final block flag */
		bfinal = readBit(data);
		metadata.push({
			type: "bfinal",
			value: {
				bits: bfinal,
				size: 1,
				decoded: bfinal,
			},
		});

		/* read block type (2 bits) */
		btype = readBits(data, 2);
		metadata.push({
			type: "btype",
			value: {
				bits: btype,
				size: 2,
				decoded: btype,
			},
		});

		/* decompress block */
		switch (btype) {
			case 0:
				/* decompress uncompressed block */
				res = inflateUncompressedBlock(data);
				break;
			case 1:
				/* decompress block with fixed huffman trees */
				res = inflateBlockData(data, fixedLiteralTree, fixedDistTree, metadata);
				break;
			case 2:
				let literalTree = new Tree();
				let distTree = new Tree();

				/* decompress block with dynamic huffman trees */
				decodeTrees(data, literalTree, distTree, metadata);
				res = inflateBlockData(data, literalTree, distTree, metadata);
				break;
			default:
				res = TINF_DATA_ERROR;
		}

		if (res !== TINF_OK) throw new Error("Data error");
	} while (!bfinal);

	let result = data.dest;
	if (data.destLen < data.dest.length) {
		if (typeof data.dest.slice === "function") {
			result = data.dest.slice(0, data.destLen);
		} else {
			result = data.dest.subarray(0, data.destLen);
		}
	}

	return { result, metadata };
}

/**
 * Get the index of the start of the compressed data
 * @param {Uint8Array} d
 */
const getGzipStart = (d) => {
	// From https://github.com/101arrowz/fflate/blob/8cd81460b67bb2c92c6549ea51ca7bbb2c8c9869/src/index.ts#L1013
	if (d[0] != 31 || d[1] != 139 || d[2] != 8) throw "invalid gzip data";
	const flg = d[3];
	let st = 10;
	if (flg & 4) st += d[10] | ((d[11] << 8) + 2);
	// @ts-ignore
	for (let zs = ((flg >> 3) & 1) + ((flg >> 4) & 1); zs > 0; zs -= !d[st++]);
	return st + (flg & 2);
};

/** Get GZip length
 * @param {Uint8Array} d
 */
function getGzipLength(d) {
	// gzip footer: -8 to -4 = CRC, -4 to -0 is length
	// From https://github.com/101arrowz/fflate/blob/8cd81460b67bb2c92c6549ea51ca7bbb2c8c9869/src/index.ts#L1013
	const l = d.length;
	return (d[l - 4] | (d[l - 3] << 8) | (d[l - 2] << 16)) + 2 * (d[l - 1] << 23);
}

/** Inflate stream from source to dest
 * @param {Uint8Array} source
 * @param {Uint8Array} [dest]
 * @returns {{ result: Uint8Array, metadata: Metadata }}
 */
export function gzinflate(
	source,
	dest = new Uint8Array(getGzipLength(source))
) {
	const gzipDataStart = getGzipStart(source);
	const gzipDataEnd = -8; // Gzip footer: -0 to -4 is length, -4 to -8 is CRC
	let { result, metadata } = inflate(
		source.subarray(gzipDataStart, gzipDataEnd),
		dest
	);

	return {
		result,
		metadata: [
			{
				type: "gzip_header",
				bytes: source.subarray(0, gzipDataStart),
			},
			...metadata,
			{
				type: "gzip_footer",
				bytes: source.subarray(gzipDataEnd),
			},
		],
	};
}

/* -------------------- *
 * -- initialization -- *
 * -------------------- */

/* build fixed huffman trees */
buildFixedTrees(fixedLiteralTree, fixedDistTree);

/* build extra bits and base tables */
buildExtraBitArrays(lengthExtraBitsSize, lengthExtraBitsBase, 4, 3);
buildExtraBitArrays(distExtraBitsSize, distExtraBitsBase, 2, 1);

/* fix a special case */
lengthExtraBitsSize[28] = 0;
lengthExtraBitsBase[28] = 258;
