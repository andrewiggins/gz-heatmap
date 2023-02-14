import "../shared/GZHeatMap.js";

/**
 * @param {Metadata} metadata
 * @param {HTMLElement} container
 */
export function renderIntoDom(metadata, container) {
	const gzheatmap = /** @type {import('../shared/GZHeatMap').GZHeatMap} */ (
		document.createElement("gz-heatmap")
	);
	gzheatmap.gzdata = metadata;

	container.textContent = "";
	container.appendChild(gzheatmap);
}
