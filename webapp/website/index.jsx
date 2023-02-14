import * as comlink from "comlink";
import { render } from "preact";
import { useState, useRef } from "preact/hooks";

import { gzinflate } from "../../src/index.js";
import svgUrl from "../../tests/fixtures/svg-6-backrefs/image.svg";
import "../shared/GZHeatMap.js";

const exampleURL = svgUrl;
const defaultURL = "";
// const defaultURL =
// 	"https://unpkg.com/react-dom@18.2.0/umd/react-dom.production.min.js";
// const defaultURL =
// 	"https://unpkg.com/preact@11.0.0-experimental.1/dist/preact.min.js";
// const defaultURL = "https://unpkg.com/preact";

function App() {
	/** @type {import('preact').RefObject<import("./compress").CompressionWorker>} */
	const workerRef = useRef(null);
	if (!workerRef.current) {
		workerRef.current = comlink.wrap(
			new Worker(new URL("./compress.js", import.meta.url), { type: "module" })
		);
	}

	const worker = workerRef.current;
	/** @type {[Metadata | null, import("preact/hooks").StateUpdater<Metadata | null>]} */
	const [metadata, setMetadata] = useState(/**@type {any}*/ (null));
	const [value, setValue] = useState("");

	/** @type {(e: Event) => Promise<void>} */
	const onSubmit = async (e) => {
		e.preventDefault();

		const form = new FormData(/** @type {HTMLFormElement} */ (e.currentTarget));
		const url = form.get("url")?.toString();
		const file = /** @type {File | null} */ (form.get("file"));

		/** @type {Uint8Array} */
		let compressed;
		if (url) {
			compressed = await worker.compressURL(url);
		} else if (file) {
			compressed = await worker.compressBuffer(await file.arrayBuffer());
		} else {
			throw new Error(`Oh no! URL: ${url} FILE: ${file}`);
		}
		setMetadata(gzinflate(compressed).metadata);
	};

	return (
		<>
			<form
				method="#"
				action="get"
				onSubmit={onSubmit}
				style={{ marginBottom: "1rem" }}
			>
				<label style={{ display: "flex", gap: "8px" }}>
					URL:
					<input
						type="text"
						name="url"
						defaultValue={defaultURL.toString()}
						style={{ flex: "1 1 auto", minWidth: "150px", maxWidth: "768px" }}
					/>
				</label>
				<label style={{ display: "flex", gap: "8px" }}>
					Upload file:
					<input type="file" name="file" />
				</label>
				<input type="submit" />
				<button
					type="button"
					onClick={() => {
						worker
							.compressURL(exampleURL)
							.then((compressed) =>
								setMetadata(gzinflate(compressed).metadata)
							);
					}}
				>
					Load example
				</button>
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
