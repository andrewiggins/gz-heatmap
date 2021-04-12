import { fileURLToPath } from "url";
import { dirname, join } from "path";
import { readFile } from "fs/promises";

const __dirname = dirname(fileURLToPath(import.meta.url));

/** @type {(...args: string[]) => string} */
export const testPath = (...args) => join(__dirname, "..", ...args);

/** @type {(...args: string[]) => string} */
export const fixture = (...args) => testPath("fixtures", ...args);

/** @type {(path: string) => Promise<string>} */
export const readFixture = async (path) =>
	(await readFile(path, "utf8")).replace(/\r\n/g, "\n");
