import { describe, expect, it } from "vitest";
import { ACTIVE_ROW_CLASS, ACTIVE_ROW_VAR, DEFAULT_SETTINGS, MOUSE_ROW_CLASS, MOUSE_ROW_VAR, bodyState, isHexColor, loadSettings } from "../src/core/settings";

describe("loadSettings", () => {
	it("returns defaults for missing data", () => {
		expect(loadSettings(null)).toEqual(DEFAULT_SETTINGS);
		expect(loadSettings(undefined)).toEqual(DEFAULT_SETTINGS);
	});

	it("keeps valid saved values", () => {
		expect(loadSettings({ activeRow: false, mouseRow: false, activeRowColor: "#FFEEAA", mouseRowColor: "#112233" })).toEqual({ activeRow: false, mouseRow: false, activeRowColor: "#ffeeaa", mouseRowColor: "#112233" });
	});

	it("drops malformed values", () => {
		expect(loadSettings({ activeRow: "no", mouseRow: 0, activeRowColor: "red", mouseRowColor: "#12345" })).toEqual(DEFAULT_SETTINGS);
	});
});

describe("isHexColor", () => {
	it("accepts #rrggbb only", () => {
		expect(isHexColor("#a1b2c3")).toBe(true);
		expect(isHexColor("#abc")).toBe(false);
		expect(isHexColor("url(x)")).toBe(false);
		expect(isHexColor(5)).toBe(false);
	});
});

describe("bodyState", () => {
	it("clears variables for theme defaults", () => {
		expect(bodyState(DEFAULT_SETTINGS)).toEqual({ classes: { [ACTIVE_ROW_CLASS]: true, [MOUSE_ROW_CLASS]: true }, vars: { [ACTIVE_ROW_VAR]: null, [MOUSE_ROW_VAR]: null } });
	});

	it("sets variables for custom colours and reflects toggles", () => {
		const state = bodyState({ activeRow: false, mouseRow: true, activeRowColor: "#ffeeaa", mouseRowColor: "" });
		expect(state.classes).toEqual({ [ACTIVE_ROW_CLASS]: false, [MOUSE_ROW_CLASS]: true });
		expect(state.vars).toEqual({ [ACTIVE_ROW_VAR]: "#ffeeaa", [MOUSE_ROW_VAR]: null });
	});
});
