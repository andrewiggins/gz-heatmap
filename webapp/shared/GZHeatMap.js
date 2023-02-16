import { constructBackRefs } from "./constructBackRefs";
import { constructHeatMap } from "./constructHeatMap";

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
		background-color: #fba70f;
	}

	.backrefs .lz77 {
		background-color: #005fd3;
	}
</style>
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
`;

class GZHeatMap extends HTMLElement {
	/** @type {ShadowRoot} */
	#root;
	/** @type {Metadata | null | undefined} */
	#_gzdata;
	/** @type {HTMLElement} */
	#heatmapContainer;
	/** @type {HTMLElement} */
	#backrefContainer;

	constructor() {
		super();
		/** @type {ShadowRoot} */
		this.#root = this.attachShadow({ mode: "open" });
		/** @type {Metadata | null} */
		this.#_gzdata = null;

		this.#root.appendChild(template.content.cloneNode(true));
		this.#heatmapContainer = document.createElement("div");
		this.#backrefContainer = document.createElement("div");

		this.#heatmapContainer.className = "gz-container";
		this.#backrefContainer.className = "gz-container";

		this.#root.appendChild(this.#heatmapContainer);
		this.#root.appendChild(this.#backrefContainer);
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
		this.#heatmapContainer.textContent = "";
		this.#backrefContainer.textContent = "";

		if (gzdata) {
			const debug = this.debug;
			// const debug = true;
			constructHeatMap(gzdata, this.#heatmapContainer, { debug });
			constructBackRefs(gzdata, this.#backrefContainer, { debug });
		}
	}
}

window.customElements.define("gz-heatmap", GZHeatMap);
