import { innerWidth, planBlock, shouldPin } from "./core/fit";

export const PIN_CLASS = "hf-pin";
export const TABLE_CLASS = "hf-table";
// On a wide table's own wrapper inside a pinned block, so that table keeps scrolling sideways on its own.
export const SCROLL_CLASS = "hf-scroll";

/**
 * What a box holds.
 * - "table": the element Obsidian makes scroll sideways around one Markdown table — the Live Preview table widget (holding a .table-wrapper) or the reading-view block div (holding the table).
 * - "block": a rendered code block's root (.block-language-*), such as a Dataview block, which Obsidian also makes scroll sideways and which can hold any number of tables.
 */
export type BoxKind = "table" | "block";

const TABLE_CONTENT = ":scope > .table-wrapper, :scope > table";
// Tables inside these keep their own clipping and scrolling, so their headers are left alone.
const NESTED_SCOPE = "table, .callout, .internal-embed, .markdown-embed";

interface Plan {
	/** The contents list that was measured; a plan for an older list is dropped. */
	contents: HTMLElement[];
	pin: boolean;
	/** Per content element, in order: whether it fits. */
	fits: boolean[];
}

interface Box {
	kind: BoxKind;
	/** Elements whose width decides the fit, each observed for size changes. */
	contents: HTMLElement[];
	/** Rendered blocks redraw their tables without always changing size, so they are also watched for added and removed nodes. */
	mutations: MutationObserver | null;
}

// Tag checks rather than instanceof: popout windows have their own element constructors.
function tableOf(content: HTMLElement): HTMLElement | null {
	return content.tagName === "TABLE" ? content : content.querySelector<HTMLElement>(":scope > table");
}

function blockTables(box: HTMLElement): HTMLElement[] {
	return Array.from(box.querySelectorAll<HTMLElement>("table")).filter((table) => {
		const outer = table.parentElement?.closest(NESTED_SCOPE);
		return !outer || !box.contains(outer);
	});
}

/**
 * Marks boxes that can drop their sideways scrolling with PIN_CLASS, the tables in them that fit with TABLE_CLASS, and the wrappers of wide tables in a pinned block with SCROLL_CLASS, so CSS can lift the sideways scrolling and pin the headers. One ResizeObserver serves every tracked box, and a box is re-checked only when it or one of its tables changes size, or a rendered block redraws — never on scroll.
 */
export class FitTracker {
	private readonly boxes = new Map<HTMLElement, Box>();
	// Observed content element -> the box it belongs to.
	private readonly ownerOf = new Map<HTMLElement, HTMLElement>();
	// Class writes waiting for the next frame. Checks measure inside the ResizeObserver callback, while the elements are laid out, but toggling classes there resizes observed elements and trips the browser's resize-loop guard.
	private readonly pending = new Map<HTMLElement, Plan>();
	// One frame per window: a popout's boxes wait on its own frames, which keep running while the main window is covered and throttled.
	private readonly frames = new Map<Window, number>();
	private readonly observer = new ResizeObserver((entries) => {
		const due = new Set<HTMLElement>();
		for (const { target } of entries) {
			const el = target as HTMLElement;
			const box = this.boxes.has(el) ? el : this.ownerOf.get(el);
			if (box) due.add(box);
		}
		for (const box of due) {
			const plan = this.measure(box);
			if (!plan) continue;
			this.pending.set(box, plan);
			const win = box.ownerDocument.defaultView;
			if (win && !this.frames.has(win)) this.frames.set(win, win.requestAnimationFrame(() => this.flush(win)));
		}
	});

	track(box: HTMLElement, kind: BoxKind = "table"): void {
		if (this.boxes.has(box)) return;
		let mutations: MutationObserver | null = null;
		if (kind === "block") {
			// Child-list changes only: the classes this tracker toggles never re-trigger it.
			mutations = new MutationObserver(() => this.check(box));
			mutations.observe(box, { childList: true, subtree: true });
		}
		this.boxes.set(box, { kind, contents: [], mutations });
		// ResizeObserver reports every new target once, which runs the first check.
		this.observer.observe(box);
	}

	untrack(box: HTMLElement): void {
		const state = this.boxes.get(box);
		if (!state) return;
		state.mutations?.disconnect();
		for (const content of state.contents) this.release(content);
		this.observer.unobserve(box);
		this.boxes.delete(box);
		this.pending.delete(box);
		box.classList.remove(PIN_CLASS);
	}

	dispose(): void {
		this.frames.forEach((frame, win) => win.cancelAnimationFrame(frame));
		this.frames.clear();
		this.pending.clear();
		Array.from(this.boxes.keys()).forEach((box) => this.untrack(box));
		this.observer.disconnect();
	}

	private release(content: HTMLElement): void {
		this.observer.unobserve(content);
		this.ownerOf.delete(content);
		tableOf(content)?.classList.remove(TABLE_CLASS);
		content.parentElement?.classList.remove(SCROLL_CLASS);
	}

	private flush(win: Window): void {
		this.frames.delete(win);
		this.pending.forEach((plan, box) => {
			if (box.ownerDocument.defaultView !== win) return;
			this.pending.delete(box);
			this.apply(box, plan);
		});
	}

	/** Measures and applies at once, for callers outside a ResizeObserver callback. */
	private check(box: HTMLElement): void {
		const plan = this.measure(box);
		if (plan) this.apply(box, plan);
	}

	private measure(box: HTMLElement): Plan | null {
		const state = this.boxes.get(box);
		// Reading view detaches sections scrolled far away and reattaches them later; the owner untracks a box when it's really gone.
		if (!state || !box.isConnected) return null;

		// Live Preview builds the table wrapper after the widget loads and may rebuild it, and rendered blocks redraw their tables; observe whichever elements are current.
		const current = state.kind === "block" ? blockTables(box) : Array.from(box.querySelectorAll<HTMLElement>(TABLE_CONTENT)).slice(0, 1);
		for (const old of state.contents) if (!current.includes(old)) this.release(old);
		for (const content of current) {
			if (this.ownerOf.has(content)) continue;
			this.ownerOf.set(content, box);
			this.observer.observe(content);
		}
		state.contents = current;

		const style = getComputedStyle(box);
		const available = innerWidth(box.clientWidth, style.paddingLeft, style.paddingRight);
		let pin: boolean;
		let fits: boolean[];
		if (state.kind === "block") {
			({ pin, fits } = planBlock(
				current.map((table) => ({ width: table.offsetWidth, ownWrapper: table.parentElement !== box && table.parentElement?.childElementCount === 1 })),
				available,
			));
		} else {
			pin = current.length > 0 && shouldPin(current[0].offsetWidth, available);
			fits = [pin];
		}
		return { contents: current, pin, fits };
	}

	private apply(box: HTMLElement, { contents, pin, fits }: Plan): void {
		const state = this.boxes.get(box);
		// A newer measurement has already been applied.
		if (!state || state.contents !== contents) return;
		if (box.classList.contains(PIN_CLASS) !== pin) box.classList.toggle(PIN_CLASS, pin);
		contents.forEach((content, i) => {
			tableOf(content)?.classList.toggle(TABLE_CLASS, pin && fits[i]);
			if (state.kind === "block") content.parentElement?.classList.toggle(SCROLL_CLASS, pin && !fits[i]);
		});
	}
}
