import { getCodeLengthSize, getLZ77TotalBitSize } from "../../src/utils.js";

/**
 * @typedef CompressedStats
 * @property {number} count
 * @property {number} bitsCompressed
 * @property {number} bytesExpanded
 *
 * @typedef Stats
 * @property {{byteLength: number}} gzipHeader
 * @property {{byteLength: number}} gzipFooter
 * @property {{bitsCompressed: number}} metadata
 * @property {{bitsCompressed: number}} codeLengthTables
 * @property {CompressedStats} literals
 * @property {CompressedStats} lz77s
 *
 * @param {Metadata} data
 * @returns {Stats}
 */
export function computeStats(data) {
	/** @type {Stats} */
	const stats = {
		gzipHeader: { byteLength: 0 },
		gzipFooter: { byteLength: 0 },
		metadata: { bitsCompressed: 0 },
		codeLengthTables: { bitsCompressed: 0 },
		literals: { count: 0, bitsCompressed: 0, bytesExpanded: 0 },
		lz77s: { count: 0, bitsCompressed: 0, bytesExpanded: 0 },
	};

	for (let datum of data) {
		switch (datum.type) {
			case "gzip_header":
				// TODO: Why is this null when running in the bin test?
				stats.gzipHeader.byteLength = datum.bytes?.byteLength ?? 0;
				break;
			case "gzip_footer":
				// TODO: Why is this null when running in the bin test?
				stats.gzipFooter.byteLength = datum.bytes?.byteLength ?? 0;
				break;
			case "bfinal":
			case "btype":
			case "hlit":
			case "hdist":
			case "hclen":
			case "block_end":
				stats.metadata.bitsCompressed += datum.value.size;
				break;
			case "literal":
				stats.literals.count += 1;
				stats.literals.bitsCompressed += datum.value.size;
				stats.literals.bytesExpanded += 1;
				break;
			case "lz77":
				stats.lz77s.count += 1;
				stats.lz77s.bitsCompressed += getLZ77TotalBitSize(datum);
				stats.lz77s.bytesExpanded += datum.chars.length;
				break;
			case "code_length":
			case "repeat_code_length":
				stats.codeLengthTables.bitsCompressed += getCodeLengthSize(datum);
				break;
			default:
				assertNever(
					datum,
					`Metadata type not handled: ${JSON.stringify(datum)}`
				);
		}
	}

	return stats;
}

/** @type {(stats: Stats) => number} */
export function getBitsCompressed(stats) {
	return (
		stats.gzipHeader.byteLength * 8 +
		stats.gzipFooter.byteLength * 8 +
		stats.metadata.bitsCompressed +
		stats.codeLengthTables.bitsCompressed +
		stats.literals.bitsCompressed +
		stats.lz77s.bitsCompressed
	);
}

/** @type {(stats: Stats) => number} */
export function getBytesCompressed(stats) {
	return Math.ceil(getBitsCompressed(stats) / 8);
}

/** @type {(stats: Stats) => number} */
export function getBytesExpanded(stats) {
	return stats.literals.bytesExpanded + stats.lz77s.bytesExpanded;
}

/**
 * @param {never} val
 * @param {string} msg
 */
function assertNever(val, msg) {
	throw new Error(msg);
}
