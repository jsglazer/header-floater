export interface HeaderFloaterSettings {
	/** Tint the Live Preview table row that holds the cursor. */
	activeRow: boolean;
	/** Tint the table row under the mouse. */
	mouseRow: boolean;
	/** Custom `#rrggbb` background for the active row, or "" for the theme default. */
	activeRowColor: string;
	/** Custom `#rrggbb` background for the mouse row, or "" for the theme default. */
	mouseRowColor: string;
}

export const DEFAULT_SETTINGS: HeaderFloaterSettings = {
	activeRow: true,
	mouseRow: true,
	activeRowColor: "",
	mouseRowColor: "",
};

const HEX = /^#[0-9a-f]{6}$/i;

export function isHexColor(value: unknown): value is string {
	return typeof value === "string" && HEX.test(value);
}

/** Builds settings from saved data, falling back to defaults for anything missing or malformed. */
export function loadSettings(data: unknown): HeaderFloaterSettings {
	const saved = (data && typeof data === "object" ? data : {}) as Record<string, unknown>;
	const bool = (key: "activeRow" | "mouseRow") => (typeof saved[key] === "boolean" ? (saved[key] as boolean) : DEFAULT_SETTINGS[key]);
	const color = (key: "activeRowColor" | "mouseRowColor") => (isHexColor(saved[key]) ? (saved[key] as string).toLowerCase() : "");
	return {
		activeRow: bool("activeRow"),
		mouseRow: bool("mouseRow"),
		activeRowColor: color("activeRowColor"),
		mouseRowColor: color("mouseRowColor"),
	};
}

export const ACTIVE_ROW_CLASS = "hf-active-row";
export const MOUSE_ROW_CLASS = "hf-mouse-row";
export const ACTIVE_ROW_VAR = "--hf-active-row-background";
export const MOUSE_ROW_VAR = "--hf-mouse-row-background";

/** Body classes to switch on or off, and CSS variables to set (a value) or clear (null), for the given settings. */
export function bodyState(settings: HeaderFloaterSettings): { classes: Record<string, boolean>; vars: Record<string, string | null> } {
	return {
		classes: { [ACTIVE_ROW_CLASS]: settings.activeRow, [MOUSE_ROW_CLASS]: settings.mouseRow },
		vars: { [ACTIVE_ROW_VAR]: settings.activeRowColor || null, [MOUSE_ROW_VAR]: settings.mouseRowColor || null },
	};
}
