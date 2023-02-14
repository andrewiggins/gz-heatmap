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
 * @typedef CompressionWorker
 * @property {(url: string) => Promise<Uint8Array>} compressURL
 * @property {(input: ArrayBuffer) => Promise<Uint8Array>} compressBuffer
 */

/** @type {CompressionWorker} */
const compressWorker = {
	async compressURL(url) {
		return this.compressBuffer(await fetchData(url));
	},
	async compressBuffer(input) {
		return pako.gzip(input, { memLevel: 9 });
	},
};

comlink.expose(compressWorker);
