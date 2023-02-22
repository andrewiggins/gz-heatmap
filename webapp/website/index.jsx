import * as comlink from "comlink";
import { render } from "preact";
import { useState, useRef } from "preact/hooks";

import { gzinflate } from "../../src/index.js";
import svgUrl from "../../tests/fixtures/svg-7-hex/image.svg";
import "../shared/GZHeatMap.js";

/**
 * @typedef {import("preact/hooks").StateUpdater<T>} StateUpdater
 * @template T
 */
/**
 * @typedef Data
 * @property {string} label
 * @property {number} size
 * @property {Metadata} metadata
 */

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
	const [data, setData] = useState(/**@type {Data | null}*/ (null));
	const [loading, setLoading] = useState(false);
	const [error, setError] = useState(/**@type {Error | null}*/ (null));

	/** @type {(url: string | null | undefined, file: File | null) => Promise<void>} */
	const runAnalysis = async (url, file) => {
		setData(null);
		setLoading(true);
		setError(null);

		try {
			/** @type {Uint8Array} */
			let compressed;
			const newPageURL = new URL(location.href);

			/** @type {string} */
			let label;
			if (url) {
				newPageURL.searchParams.set("url", url);
				history.pushState(null, "", newPageURL.toString());

				label = url;
				compressed = await worker.compressURL(url);
			} else if (file?.name) {
				newPageURL.searchParams.delete("url");
				history.pushState(null, "", newPageURL.toString());

				label = file.name;
				compressed = await worker.compressBuffer(await file.arrayBuffer());
			} else {
				newPageURL.searchParams.delete("url");
				history.pushState(null, "", newPageURL.toString());
				throw new Error(`Please enter in a URL or upload a file to analyze.`);
			}

			setData({
				label,
				size: compressed.byteLength,
				metadata: gzinflate(compressed).metadata,
			});
		} catch (e) {
			setError(/** @type {Error}*/ (e));
		} finally {
			setLoading(false);
		}
	};

	/** @type {(e: Event) => Promise<void>} */
	const onSubmit = async (e) => {
		e.preventDefault();

		const form = new FormData(/** @type {HTMLFormElement} */ (e.currentTarget));
		const url = form.get("url")?.toString();
		const file = /** @type {File | null} */ (form.get("file"));

		runAnalysis(url, file);
	};

	return (
		<>
			<h1>GZ Heatmap</h1>
			<p>Upload a text file to see how GZip compresses your file.</p>
			<form
				method="#"
				action="get"
				onSubmit={onSubmit}
				style={{
					display: "flex",
					gap: "8px",
					flexDirection: "column",
					marginBottom: "1rem",
				}}
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
				<div>
					<input type="submit" />
					<button
						type="button"
						data-test-id="load-example"
						onClick={() => runAnalysis(exampleURL, null)}
					>
						Load example
					</button>
				</div>
			</form>
			{error && (
				<>
					<p class="error">❌ An error occurred: {error.message}</p>
					<p>
						<pre>{error.stack}</pre>
					</p>
				</>
			)}
			{loading && <p>Analyzing input...</p>}
			{data && (
				<>
					<h2>{data.label}</h2>
					<p>Compressed size: {data.size} B</p>
					<gz-heatmap gzdata={data.metadata}></gz-heatmap>
				</>
			)}
			{!data && !loading && (
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
