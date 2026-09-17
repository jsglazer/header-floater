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
