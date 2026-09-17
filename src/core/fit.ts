// Pure layout decisions — no `obsidian` or DOM imports, so tests run headless.

/** Sub-pixel rounding slack, so a table that exactly fills its box still pins. */
export const FIT_TOLERANCE_PX = 1;

/**
 * A Live Preview table can pin only when it fits its widget without horizontal scrolling: pinning requires `overflow: visible`, which would otherwise make a wide table spill past the pane edge instead of scrolling.
 */
export function shouldPin(tableWidth: number, availableWidth: number): boolean {
	if (!(tableWidth > 0) || !(availableWidth > 0)) return false;
	return tableWidth <= availableWidth + FIT_TOLERANCE_PX;
}

/** Width inside an element's padding, given its clientWidth and padding values. */
export function innerWidth(clientWidth: number, paddingStart: string, paddingEnd: string): number {
	return clientWidth - (parseFloat(paddingStart) || 0) - (parseFloat(paddingEnd) || 0);
}

export interface BlockTable {
	width: number;
	/** The table sits alone in its own wrapper, which can take over the sideways scrolling if the table is too wide. */
	ownWrapper: boolean;
}

export interface BlockPlan {
	/** Drop the block's sideways scrolling. */
	pin: boolean;
	/** Per table: true pins its header, false scrolls it sideways in its own wrapper. Meaningful only when `pin` is set. */
	fits: boolean[];
}

/**
 * A rendered block (such as Dataview) can hold several tables. The block drops its sideways scrolling when every table either fits or can scroll inside a wrapper of its own; fitting tables then pin their headers. A wide table with no wrapper of its own would spill past the pane, so it keeps the whole block scrolling.
 */
export function planBlock(tables: readonly BlockTable[], availableWidth: number): BlockPlan {
	const fits = tables.map((table) => shouldPin(table.width, availableWidth));
	const pin = availableWidth > 0 && fits.some(Boolean) && tables.every((table, i) => fits[i] || table.ownWrapper);
	return { pin, fits };
}
