import { describe, expect, it } from "vitest";
import { innerWidth, shouldPin } from "../src/core/fit";

describe("shouldPin", () => {
	it("pins a table narrower than its box", () => {
		expect(shouldPin(400, 700)).toBe(true);
	});

	it("pins a table that exactly fills its box, allowing sub-pixel rounding", () => {
		expect(shouldPin(700, 700)).toBe(true);
		expect(shouldPin(700.8, 700)).toBe(true);
	});

	it("does not pin a table wider than its box", () => {
		expect(shouldPin(702, 700)).toBe(false);
	});

	it("does not pin before layout (zero or invalid sizes)", () => {
		expect(shouldPin(0, 700)).toBe(false);
		expect(shouldPin(400, 0)).toBe(false);
		expect(shouldPin(Number.NaN, 700)).toBe(false);
	});
});

describe("innerWidth", () => {
	it("subtracts both paddings", () => {
		expect(innerWidth(732, "16px", "16px")).toBe(700);
	});

	it("treats unparseable padding as zero", () => {
		expect(innerWidth(700, "", "auto")).toBe(700);
	});
});
