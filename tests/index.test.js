import { test } from "uvu";
import * as assert from "uvu/assert";
import { getTheAnswer } from "../src/index.js";

test("it works", () => {
	assert.equal(
		getTheAnswer(),
		42,
		"The answer to life, the universe, and everything."
	);
});

test.run();
