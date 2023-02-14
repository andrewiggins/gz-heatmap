import * as comlink from "comlink";
import { render } from "preact";
import { useState, useRef } from "preact/hooks";

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
	);

	/** @type {(e: Event) => Promise<void>} */
	const onSubmit = async (e) => {
		e.preventDefault();
		console.log(e);

		const form = new FormData(/** @type {HTMLFormElement} */ (e.currentTarget));
		const url = form.get("url")?.toString();
		if (!url) {
			throw new Error(`Oh no: ${url}`);
		}

		console.log(await worker.compressURL(url));
	};

	return (
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
	);
}

const container = /** @type {HTMLElement} */ (document.getElementById("main"));
render(<App />, container);
