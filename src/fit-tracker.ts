import { innerWidth, shouldPin } from "./core/fit";

export const PIN_CLASS = "hf-pin";

// A box is the element Obsidian makes scroll sideways around a table: the Live Preview table widget (holding a .table-wrapper) or the reading-view block div (holding the table).
const CONTENT = ":scope > .table-wrapper, :scope > table";

/**
 * Marks table boxes whose table fits their width with PIN_CLASS, so CSS can lift the sideways scrolling and pin the header. One ResizeObserver serves every tracked box, and a box is re-checked only when it or its table changes size — never on scroll.
 */
export class FitTracker {
	// Tracked box -> the content element currently observed inside it.
	private readonly contentOf = new Map<HTMLElement, HTMLElement | null>();
	private readonly observer = new ResizeObserver((entries) => {
		const boxes = new Set<HTMLElement>();
		for (const { target } of entries) {
			const el = target as HTMLElement;
			const box = this.contentOf.has(el) ? el : el.parentElement;
			if (box && this.contentOf.has(box)) boxes.add(box);
		}
		boxes.forEach((box) => this.check(box));
	});

	track(box: HTMLElement): void {
		if (this.contentOf.has(box)) return;
		this.contentOf.set(box, null);
		// ResizeObserver reports every new target once, which runs the first check.
		this.observer.observe(box);
	}

	untrack(box: HTMLElement): void {
		if (!this.contentOf.has(box)) return;
		const content = this.contentOf.get(box);
		if (content) this.observer.unobserve(content);
		this.observer.unobserve(box);
		this.contentOf.delete(box);
	}

	dispose(): void {
		this.observer.disconnect();
		this.contentOf.forEach((_, box) => box.classList.remove(PIN_CLASS));
		this.contentOf.clear();
	}

	private check(box: HTMLElement): void {
		if (!box.isConnected) {
			this.untrack(box);
			return;
		}

		// Live Preview builds the wrapper after the widget loads and may rebuild it; observe whichever element is current.
		let content = this.contentOf.get(box) ?? null;
		if (!content || content.parentElement !== box) {
			const current = box.querySelector<HTMLElement>(CONTENT);
			if (current !== content) {
				if (content) this.observer.unobserve(content);
				if (current) this.observer.observe(current);
				content = current;
				this.contentOf.set(box, current);
			}
		}

		let pin = false;
		if (content) {
			const style = getComputedStyle(box);
			pin = shouldPin(content.offsetWidth, innerWidth(box.clientWidth, style.paddingLeft, style.paddingRight));
		}
		if (box.classList.contains(PIN_CLASS) !== pin) box.classList.toggle(PIN_CLASS, pin);
	}
}
