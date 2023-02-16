import { createLogger } from "./logger";

/**
 * @param {number} value
 * @param {string} [extraClass]
 * @returns {HTMLSpanElement}
 */
function createNode(value, extraClass = "") {
	const span = document.createElement("span");
	span.textContent = String.fromCharCode(value);
	span.className = extraClass;
	return span;
}

const backRefAttr = "data-backref-selector";

/**
 * @param {Metadata} metadata
 * @param {Element} root
 */
export function constructBackRefs(metadata, root, options = {}) {
	const logger = createLogger(options);

	const container = document.createElement("pre");
	root.appendChild(container);

	// TODO: Use more cross browser approach (perhaps style tag) over
	// constructable stylesheets. Perhaps insert style tag before 'pre' tag.
	// Consider using `insertRule` and `deleteRule`.
	const styleRoot = /** @type {ShadowRoot} */ (container.getRootNode());
	const stylesheet = new CSSStyleSheet();
	styleRoot.adoptedStyleSheets = [...styleRoot.adoptedStyleSheets, stylesheet];

	container.classList.add("backrefs");
	container.addEventListener("mouseover", (e) => {
		const target = /** @type {Element} */ (e.target);
		let selector;
		if (target.classList.contains("lz77")) {
			selector = target.getAttribute(backRefAttr);
		} else {
			let parent = target.parentElement;
			if (parent && parent.classList.contains("lz77")) {
				selector = parent.getAttribute(backRefAttr);
			}
		}

		let cssText = "";
		if (selector) {
			cssText = `${selector} { background-color: #bfd000 !important; }`;
		}

		stylesheet.replace(cssText);
	});

	container.addEventListener("mouseleave", () => {
		stylesheet.replace("");
	});

	let pos = 0;
	for (let datum of metadata) {
		if (datum.type == "literal") {
			let className = `literal pos-${pos++}`;
			let node = createNode(datum.value.decoded, className);
			container.appendChild(node);
		} else if (datum.type == "lz77") {
			let literalStart = pos - datum.dist.value;
			let backRefLiteralSelector = `.pos-${literalStart}`;
			for (let i = 1; i < datum.length.value; i++) {
				backRefLiteralSelector += `, .pos-${literalStart + i}`;
			}

			const lz77Wrapper = document.createElement("span");
			lz77Wrapper.className = "lz77";
			lz77Wrapper.setAttribute(backRefAttr, backRefLiteralSelector);

			for (let char of datum.chars) {
				let node = createNode(char, `pos-${pos++}`);
				lz77Wrapper.appendChild(node);
			}

			container.appendChild(lz77Wrapper);
		}
	}
}
