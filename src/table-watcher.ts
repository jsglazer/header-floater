import { EditorView, ViewPlugin } from "@codemirror/view";
import { FitTracker } from "./fit-tracker";

const WIDGET_CLASS = "cm-table-widget";

// The scroller Obsidian pads with --file-margins in a note's main editor. Editors that don't match (table cells, canvas cards, embeds) are left alone.
const MAIN_SCROLLER = ".view-content > .markdown-source-view.mod-cm6 > .cm-editor > .cm-scroller";

function isWidget(node: Node): node is HTMLElement {
	return node instanceof HTMLElement && node.classList.contains(WIDGET_CLASS);
}

/**
 * Hands Live Preview table widgets to the shared FitTracker as they enter and leave an editor. A child-list MutationObserver on the content element is all that runs, and only when CodeMirror adds or removes top-level blocks — not on scroll or while typing in a cell.
 */
export function tableWatcher(tracker: FitTracker) {
	return ViewPlugin.fromClass(
		class {
			private mutations: MutationObserver | null = null;
			private readonly widgets = new Set<HTMLElement>();
			private readonly startFrame: number;

			constructor(private readonly view: EditorView) {
				// The editor DOM isn't attached yet during construction, so the scroller check has to wait a frame.
				this.startFrame = requestAnimationFrame(() => this.start());
			}

			private start(): void {
				if (!this.view.scrollDOM.matches(MAIN_SCROLLER)) return;

				// Table widgets are direct children of the content element, so no subtree observation is needed.
				this.mutations = new MutationObserver((records) => {
					for (const record of records) {
						record.removedNodes.forEach((node) => isWidget(node) && this.forget(node));
						record.addedNodes.forEach((node) => isWidget(node) && this.track(node));
					}
				});
				this.mutations.observe(this.view.contentDOM, { childList: true });

				for (const child of Array.from(this.view.contentDOM.children)) {
					if (isWidget(child)) this.track(child);
				}
			}

			private track(widget: HTMLElement): void {
				this.widgets.add(widget);
				tracker.track(widget);
			}

			private forget(widget: HTMLElement): void {
				this.widgets.delete(widget);
				tracker.untrack(widget);
			}

			destroy(): void {
				cancelAnimationFrame(this.startFrame);
				this.mutations?.disconnect();
				this.widgets.forEach((widget) => tracker.untrack(widget));
				this.widgets.clear();
			}
		},
	);
}
