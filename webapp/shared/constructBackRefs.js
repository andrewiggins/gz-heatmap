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
	const style = document.createElement("style");
	root.appendChild(style);
	root.appendChild(container);

	container.classList.add("backrefs");
	container.addEventListener("mouseover", (e) => {
		const target = /** @type {Element} */ (e.target);
		let lz77Container;
		if (target.classList.contains("lz77")) {
			lz77Container = target;
		} else {
			let parent = target.parentElement;
			if (parent && parent.classList.contains("lz77")) {
				lz77Container = parent;
			}
		}

		let cssText = "";
		if (lz77Container) {
			let selector = lz77Container.getAttribute(backRefAttr);
			cssText = `${selector} {
				/* transform: scale(1.1); */
				transform: translateY(-5px);
				/* box-shadow: 0px 10px 20px 2px rgb(255 255 255 / 25%); */
				filter: drop-shadow(5px 5px 5px rgba(0,0,0,0.3));
				background-color: #4ab03d !important;
			}`;

			lz77Container.classList.add("selected");
			lz77Container.addEventListener(
				"mouseleave",
				(e) => {
					let target = /** @type {Element} */ (e.target);
					target.classList.remove("selected");
				},
				{ once: true }
			);
		}

		logger.debug("settings styles", cssText);
		style.textContent = cssText;
	});

	container.addEventListener("mouseleave", () => {
		logger.debug("clearing styles");
		style.textContent = "";
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
