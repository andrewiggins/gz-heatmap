import * as comlink from "comlink";
import { render } from "preact";
import { useState, useRef } from "preact/hooks";

import { gzinflate } from "../../src/index.js";
import "../shared/GZHeatMap.js";

function App() {
	/** @type {import('preact').RefObject<import("./compress").CompressionWorker>} */
	const workerRef = useRef(null);
	if (!workerRef.current) {
		workerRef.current = comlink.wrap(
			new Worker(new URL("./compress.js", import.meta.url), { type: "module" })
		);
	}

	const worker = workerRef.current;
	const [url, setUrl] = useState(
		"https://unpkg.com/preact@11.0.0-experimental.1/dist/preact.min.js"
		// "/tests/fixtures/svg-6-backrefs/image.svg"
	);
	/** @type {[Metadata | null, import("preact/hooks").StateUpdater<Metadata | null>]} */
	const [metadata, setMetadata] = useState(/**@type {any}*/ (null));

	/** @type {(e: Event) => Promise<void>} */
	const onSubmit = async (e) => {
		e.preventDefault();
		console.log(e);

		const form = new FormData(/** @type {HTMLFormElement} */ (e.currentTarget));
		const url = form.get("url")?.toString();
		if (!url) {
			throw new Error(`Oh no: ${url}`);
		}

		const compresssed = await worker.compressURL(url);
		setMetadata(gzinflate(compresssed).metadata);
	};

	return (
		<>
			<form method="#" action="get" onSubmit={onSubmit}>
				<label>
					URL:{" "}
					<input
						type="text"
						name="url"
						value={url}
						onInput={(e) => setUrl(e.currentTarget.value)}
					/>
				</label>
				<input type="submit" />
			</form>
			{metadata && <gz-heatmap gzdata={metadata}></gz-heatmap>}
			{!metadata && (
				<div>
					Input a URL or upload a file to view a heatmap of how well your file
					compresses
				</div>
			)}
		</>
	);
}

const container = /** @type {HTMLElement} */ (document.getElementById("main"));
render(<App />, container);
