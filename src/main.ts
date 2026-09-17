import { debounce, MarkdownRenderChild, Notice, Plugin } from "obsidian";
import { BlockHosts } from "./block-hosts";
import { bodyState, DEFAULT_SETTINGS, HeaderFloaterSettings, loadSettings } from "./core/settings";
import { FitTracker, PIN_CLASS, SCROLL_CLASS, TABLE_CLASS } from "./fit-tracker";
import { HeaderFloaterSettingTab } from "./settings-tab";
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

/** Keeps a reading-view code-block section watched for its rendered block for as long as the section exists. */
class TrackedBlockHost extends MarkdownRenderChild {
	constructor(containerEl: HTMLElement, private readonly blocks: BlockHosts) {
		super(containerEl);
	}

	onload(): void {
		this.blocks.add(this.containerEl);
	}

	onunload(): void {
		this.blocks.remove(this.containerEl);
	}
}

export default class HeaderFloaterPlugin extends Plugin {
	private readonly tracker = new FitTracker();
	private blocks!: BlockHosts;
	settings: HeaderFloaterSettings = { ...DEFAULT_SETTINGS };
	// Popout windows get their own body, so highlight classes and colours are applied to each.
	private readonly bodies = new Set<HTMLElement>();
	// Colour pickers report every step of a drag; apply each step at once but write to disk once it settles.
	private readonly requestSave = debounce(() => this.saveData(this.settings), 500, true);

	async onload(): Promise<void> {
		this.settings = loadSettings(await this.loadData());
		this.blocks = new BlockHosts(this.tracker, this.settings.renderedBlocks);
		this.addSettingTab(new HeaderFloaterSettingTab(this.app, this));

		this.bodies.add(document.body);
		this.registerEvent(
			this.app.workspace.on("window-open", (_win, win) => {
				this.bodies.add(win.document.body);
				this.applyHighlights();
			}),
		);
		this.registerEvent(this.app.workspace.on("window-close", (_win, win) => this.bodies.delete(win.document.body)));
		this.applyHighlights();

		this.addCommand({
			id: "toggle-active-row-highlight",
			name: "Toggle Active Row Highlight",
			callback: () => this.toggle("activeRow", "Active row highlight"),
		});
		this.addCommand({
			id: "toggle-mouse-row-highlight",
			name: "Toggle Mouse Row Highlight",
			callback: () => this.toggle("mouseRow", "Mouse row highlight"),
		});

		this.registerEditorExtension(tableWatcher(this.tracker, this.blocks));

		// Reading view wraps each table in a block div that Obsidian sets to scroll sideways, and each code block in a section div that a code block processor renders into.
		this.registerMarkdownPostProcessor((el, ctx) => {
			if (el.childElementCount !== 1) return;
			if (el.firstElementChild?.tagName === "TABLE") ctx.addChild(new TrackedTable(el, this.tracker));
			else if (el.classList.contains("el-pre")) ctx.addChild(new TrackedBlockHost(el, this.blocks));
		});

		const sync = () => this.syncOffsets();
		this.app.workspace.onLayoutReady(sync);
		// One lookup per event, never per table or per scroll.
		this.registerEvent(this.app.workspace.on("css-change", sync));
		this.registerEvent(this.app.workspace.on("layout-change", sync));
	}

	onunload(): void {
		this.requestSave.run();
		const { classes, vars } = bodyState(this.settings);
		for (const body of this.bodies) {
			for (const name of Object.keys(classes)) body.classList.remove(name);
			for (const name of Object.keys(vars)) body.style.removeProperty(name);
		}
		this.bodies.clear();
		this.blocks.dispose();
		this.tracker.dispose();
		for (const { name } of OFFSETS) document.body.style.removeProperty(name);
		document.querySelectorAll(`.${PIN_CLASS}`).forEach((el) => el.classList.remove(PIN_CLASS));
		for (const name of [TABLE_CLASS, SCROLL_CLASS]) document.querySelectorAll(`.${name}`).forEach((el) => el.classList.remove(name));
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

	updateSettings(patch: Partial<HeaderFloaterSettings>): void {
		this.settings = { ...this.settings, ...patch };
		this.blocks.setEnabled(this.settings.renderedBlocks);
		this.applyHighlights();
		this.requestSave();
	}

	private toggle(key: "activeRow" | "mouseRow", label: string): void {
		this.updateSettings({ [key]: !this.settings[key] });
		new Notice(`${label} ${this.settings[key] ? "on" : "off"}`);
	}

	private applyHighlights(): void {
		const { classes, vars } = bodyState(this.settings);
		for (const body of this.bodies) {
			for (const [name, on] of Object.entries(classes)) body.classList.toggle(name, on);
			for (const [name, value] of Object.entries(vars)) {
				if (value) body.style.setProperty(name, value);
				else body.style.removeProperty(name);
			}
		}
	}
}
