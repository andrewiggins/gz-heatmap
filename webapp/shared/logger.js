/**
 * @typedef Logger
 * @property {(...args: any) => void} debug
 *
 * @param {{ debug?: boolean }} options
 * @returns {Logger}
 */
export function createLogger(options) {
	return {
		debug(...args) {
			if (options.debug) {
				console.log(...args);
			}
		},
	};
}
