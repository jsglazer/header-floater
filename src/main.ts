import { MarkdownRenderChild, Plugin } from "obsidian";
import { FitTracker, PIN_CLASS } from "./fit-tracker";
import { tableWatcher } from "./table-watcher";

// Scroll containers pad their content with --file-margins, and a sticky header pins at the padding edge. These offsets let it pin flush with the pane top instead.
const OFFSETS = [
	{ name: "--hf-lp-offset", scroller: ".view-content > .markdown-source-view.mod-cm6 > .cm-editor > .cm-scroller" },
	{ name: "--hf-rv-offset", scroller: ".markdown-reading-view > .markdown-preview-view" },
];

/** Keeps a reading-view table block tracked for as long as its rendered section exists. */
class TrackedTable extends MarkdownRenderChild {
	constructor(containerEl: HTMLElement, private readonly tracker: FitTracker) {
		super(containerEl);
	}

	onload(): void {
		this.tracker.track(this.containerEl);
	}

	onunload(): void {
		this.tracker.untrack(this.containerEl);
	}
}

export default class HeaderFloaterPlugin extends Plugin {
	private readonly tracker = new FitTracker();

	onload(): void {
		this.registerEditorExtension(tableWatcher(this.tracker));

		// Reading view wraps each table in a block div that Obsidian sets to scroll sideways.
		this.registerMarkdownPostProcessor((el, ctx) => {
			if (el.childElementCount === 1 && el.firstElementChild instanceof HTMLTableElement) {
				ctx.addChild(new TrackedTable(el, this.tracker));
			}
		});

		const sync = () => this.syncOffsets();
		this.app.workspace.onLayoutReady(sync);
		// One lookup per event, never per table or per scroll.
		this.registerEvent(this.app.workspace.on("css-change", sync));
		this.registerEvent(this.app.workspace.on("layout-change", sync));
	}

	onunload(): void {
		this.tracker.dispose();
		for (const { name } of OFFSETS) document.body.style.removeProperty(name);
		document.querySelectorAll(`.${PIN_CLASS}`).forEach((el) => el.classList.remove(PIN_CLASS));
	}

	private syncOffsets(): void {
		const body = document.body;
		for (const { name, scroller } of OFFSETS) {
			const el = document.querySelector(scroller);
			if (!el) continue;
			const padding = getComputedStyle(el).paddingTop;
			if (padding && body.style.getPropertyValue(name) !== padding) body.style.setProperty(name, padding);
		}
	}
}
