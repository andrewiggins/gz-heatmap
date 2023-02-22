/** @type {Intl.NumberFormat | undefined} */
let numberFormatter;
try {
	numberFormatter = new Intl.NumberFormat(navigator.language);
} catch (e) {
	// Oh well...
}

/** @type {(n: number) => string} */
export function formatNum(n) {
	return numberFormatter ? numberFormatter.format(n) : n.toString();
}
