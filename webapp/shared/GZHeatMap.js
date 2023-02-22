import { computeStats, getBytesExpanded } from "./computeStats.js";
import { constructBackRefs } from "./constructBackRefs.js";
import { constructHeatMap } from "./constructHeatMap.js";
import { formatNum } from "./utils.js";

const template = document.createElement("template");
template.innerHTML = `
<style>
	:host {
		display: block;
	}
	:host([hidden]) {
		display: none;
	}

	.legend {
		display: flex;
		flex-wrap: wrap;
		list-style: none;
		margin: 0;
		padding: 0;
		font-family: monospace;
		text-shadow: 1px 1px 2px black;
		font-size: 1.5rem;
	}

	.legend > li {
		display: inline-block;
		padding: 0 8px;
	}

	.gz-container pre {
		color: #fff;
		white-space: pre-wrap;
		word-break: break-all;

		/* offset-x | offset-y | blur-radius | color */
		text-shadow: 1px 1px 2px black;
	}

	.heatmap span {
		/* padding: 2px 0; */
		/* line-height: 2.2rem; */
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

	.backrefs .literal {
		display: inline-block;
		background-color: #fba70f;
		transition: all ease 0.2s;
	}

	.backrefs .lz77 span {
		display: inline-block;
		background-color: #005fd3;
		transition: all ease 0.2s;
	}

	/* https://blog.logrocket.com/three-ways-style-css-box-shadow-effects/ */
	.backrefs .lz77.selected span {
		/* transform: scale(1.1); */
		transform: translateY(-5px);
		/* box-shadow: 0px 10px 20px 2px rgb(255 255 255 / 25%); */
		filter: drop-shadow(5px 5px 5px rgba(0,0,0,0.5));
	}

	table.stats {
		border-collapse: collapse;
    border-spacing: 0;
    text-align: left;
	}

	table.stats :is(td, th) {
		border-bottom: 0.05rem solid #dadee4;
		padding: 0.6rem 0.4rem;
	}

	table.stats > tbody  td:not(:first-child) {
		font-variant-numeric: tabular-nums;
		text-align: right;
	}
</style>

<h2>Stats</h2>
<div part="stats"></div>
<p class="message"></p>
<section class="heatmap">
	<h2>Heatmap</h2>
	<p>
	Each character in the gzip stream is given a color representing approximately
	the number of bytes it takes up in the gzip stream. Open the color legend to
	see what colors correspond to what byte sizes.
	</p>
	<details>
		<summary>Color legend</summary>
		<ol class="legend">
			<li class="size-1"><1 B</li>
			<li class="size-2"><2 B</li>
			<li class="size-3"><3 B</li>
			<li class="size-4"><4 B</li>
			<li class="size-5"><5 B</li>
			<li class="size-6"><6 B</li>
			<li class="size-7"><7 B</li>
			<li class="size-8"><8 B</li>
			<li class="size-9"><9 B</li>
			<li class="size-10"><10 B</li>
			<li class="size-11"><11 B</li>
			<li class="size-12"><12 B</li>
			<li class="size-13"><13 B</li>
			<li class="size-14"><14 B</li>
			<li class="size-15"><15 B</li>
			<li class="size-16"><16 B</li>
			<li class="size-17">>=17 B</li>
		</ol>
	</details>
	<div part="gz-container" class="gz-container heatmap"></div>
</section>
<section class="backref">
	<h2>Back references</h2>
	<p>
	Orange text represents literal text from the gzip stream.
	Blue text is test that is a back reference to previous text
	in the gzip stream. Hover over a back references to see what
	text it references.
	</p>
	<div part="gz-container" class="gz-container backref"></div>
</section>
`;

class GZHeatMap extends HTMLElement {
	/** @type {ShadowRoot} */
	#root;
	/** @type {Metadata | null | undefined} */
	#_gzdata;
	/** @type {HTMLElement} */
	#message;
	/** @type {HTMLElement} */
	#statsContainer;
	/** @type {HTMLElement} */
	#heatmapContainer;
	/** @type {HTMLElement} */
	#backrefContainer;

	constructor() {
		super();
		this.#root = this.attachShadow({ mode: "open" });
		this.#_gzdata = null;

		this.#root.appendChild(template.content.cloneNode(true));
		this.#message = /** @type {HTMLElement} */ (
			this.#root.querySelector(".message")
		);
		this.#statsContainer = /** @type {HTMLElement} */ (
			this.#root.querySelector("[part=stats]")
		);
		this.#heatmapContainer = /** @type {HTMLElement} */ (
			this.#root.querySelector(".gz-container.heatmap")
		);
		this.#backrefContainer = /** @type {HTMLElement} */ (
			this.#root.querySelector(".gz-container.backref")
		);
	}

	connectedCallback() {
		this.#upgradeProperty("gzdata");
	}

	/** @param {Metadata | null | undefined} value */
	set gzdata(value) {
		this.#render(value);
		this.#_gzdata = value;
	}
	/** @returns {Metadata | null | undefined} */
	get gzdata() {
		return this.#_gzdata;
	}

	get debug() {
		return this.hasAttribute("debug");
	}
	set debug(value) {
		if (value) {
			this.setAttribute("debug", "");
		} else {
			this.removeAttribute("debug");
		}
	}

	/**
	 * Check if a property has an instance value. If so, copy the value, and
	 * delete the instance property so it doesn't shadow the class property
	 * setter. Finally, pass the value to the class property setter so it can
	 * trigger any side effects. This is to safe guard against cases where, for
	 * instance, a framework may have added the element to the page and set a
	 * value on one of its properties, but lazy loaded its definition. Without
	 * this guard, the upgraded element would miss that property and the instance
	 * property would prevent the class property setter from ever being called.
	 * @see https://web.dev/custom-elements-best-practices/#make-properties-lazy
	 * @param {keyof GZHeatMap} prop
	 */
	#upgradeProperty(prop) {
		if (this.hasOwnProperty(prop)) {
			let value = this[prop];
			delete this[prop];
			// @ts-expect-error this[prop] is using all properties of HTMLElement,
			// some of which are readonly. We only care about local properties, e.g.
			// `data`
			this[prop] = value;
		}
	}

	/** @param {Metadata | null | undefined} gzdata */
	#render(gzdata) {
		const heatmapSection = /**@type {HTMLElement}*/ (
			this.#root.querySelector("section.heatmap")
		);
		const backRefSection = /**@type {HTMLElement}*/ (
			this.#root.querySelector("section.backref")
		);

		this.#message.textContent = "";
		this.#heatmapContainer.textContent = "";
		this.#backrefContainer.textContent = "";

		if (gzdata) {
			const debug = this.debug;
			// const debug = true;
			const stats = computeStats(gzdata);
			this.#setStats(stats);

			const bytesExpanded = getBytesExpanded(stats);
			if (bytesExpanded < 50e3) {
				// Only show character breakdown for small files
				heatmapSection.hidden = false;
				backRefSection.hidden = false;
				constructHeatMap(gzdata, this.#heatmapContainer, { debug });
				constructBackRefs(gzdata, this.#backrefContainer, { debug });
			} else {
				heatmapSection.hidden = true;
				backRefSection.hidden = true;

				const sizeStr = formatNum(bytesExpanded);
				this.#message.textContent = `File too large to show character breakdown analysis (size: ${sizeStr} B)`;
			}
		}
	}

	/** @param {import('../shared/computeStats').Stats} stats*/
	#setStats(stats) {
		this.#statsContainer.innerHTML = `
			<table class="stats">
				<thead>
					<tr>
						<th></th>
						<th>Count</th>
						<th>Compressed bytes</th><th>Expanded bytes</th>
					</tr>
				</thead>
				<tbody>
					<tr>
						<td>Literals</td>
						<td>${formatNum(stats.literals.count)}</td>
						<td>${formatNum(bitsToBytes(stats.literals.bitsCompressed))} B</td>
						<td>${formatNum(stats.literals.bytesExpanded)} B</td>
					</tr>
					<tr>
						<td>LZ77 Backrefs</td>
						<td>${formatNum(stats.lz77s.count)}</td>
						<td>${formatNum(bitsToBytes(stats.lz77s.bitsCompressed))} B</td>
						<td>${formatNum(stats.lz77s.bytesExpanded)} B</td>
					</tr>
				</tbody>
			</table>
		`;
	}
}

/** @type {(bits: number) => number} */
function bitsToBytes(bits) {
	return Math.ceil(bits / 8);
}

window.customElements.define("gz-heatmap", GZHeatMap);
