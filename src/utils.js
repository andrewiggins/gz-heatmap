/**
 * @param {LZ77BitInfo} info
 * @returns {number}
 */
export function getLZ77TotalBitSize(info) {
	let length = info.length;
	let dist = info.dist;

	return (
		length.symbol.size +
		length.extraBits.size +
		dist.symbol.size +
		dist.extraBits.size
	);
}

/**
 * @param {HuffmanCodeLengths | RepeatHuffmanCodeLengths} datum
 * @returns {number}
 */
export function getCodeLengthSize(datum) {
	if (datum.type == "code_length") {
		return datum.value.size;
	} else {
		return datum.symbol.size + datum.repeatCount.size;
	}
}
