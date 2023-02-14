/// <reference lib="webworker" />
import * as comlink from "comlink";
import pako from "pako";

/**
 * @param {string} url
 * @returns {Promise<ArrayBuffer>}
 */
function fetchData(url) {
	return fetch(url).then((res) => {
		if (!res.ok) {
			throw new Error(`Response indicated failure: ${res.status}`);
		}
		return res.arrayBuffer();
	});
}

/**
 * @param {string} url
 * @returns {Promise<Uint8Array>}
 */
async function compressURL(url) {
	const input = await fetchData(url);
	return pako.gzip(input, { memLevel: 9 });
}

/**
 * @typedef CompressionWorker
 * @property {typeof compressURL} compressURL
 */

/** @type {CompressionWorker} */
const compressWorker = {
	compressURL,
};

comlink.expose(compressWorker);
