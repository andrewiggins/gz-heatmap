/** @type {(size: number, maxSize?: number) => string} */
const sizeToClass = (size, maxSize = 0) => {
	// size = Math.ceil(10 - maxSize + size);
	size = Math.ceil(size);
	return size < 10 ? `size-${size}` : "size-l";
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
 * @param {Metadata} metadata
 * @returns {HTMLElement}
 */
export function constructHeatmap(metadata) {
	const container = document.createElement("pre");
	container.classList.add("gz-heatmap-container");

	// TODO: Need to incorporate huffman code table costs amortized over each
	// usage of the huffman code length. Who pays for repeat of zeros?

	// TODO: Remove max size adjustment. I don't think this is correct.
	const maxSize = metadata.reduce(
		(max, datum) =>
			datum.type == "literal" && datum.value.size > max
				? datum.value.size
				: max,
		0
	);

	for (let datum of metadata) {
		if (datum.type == "literal") {
			let node = createNode(datum.value.decoded, datum.value.size, maxSize);
			container.appendChild(node);
		} else if (datum.type == "lz77") {
			let size = getLZ77TotalBitSize(datum);
			let node = createNode(datum.chars, size / datum.length.value, maxSize);
			// let node = createNode(datum.chars, Math.floor(size / datum.length.value), maxSize);

			node.classList.add("lz77");
			node.setAttribute("data-length", datum.length.value.toString());
			node.setAttribute("data-dist", datum.dist.value.toString());

			container.appendChild(node);
		}
	}

	return container;
}

const styleId = "gz-heatmap-styles";
export function setupStyles() {
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
