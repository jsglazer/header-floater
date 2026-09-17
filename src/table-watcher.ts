import { EditorView, ViewPlugin } from "@codemirror/view";
import { BlockHosts } from "./block-hosts";
import { FitTracker } from "./fit-tracker";

const WIDGET_CLASS = "cm-table-widget";
// Rendered code blocks (Dataview and the like). Embeds use a different widget and stay excluded.
const BLOCK_CLASS = "cm-preview-code-block";

// The scroller Obsidian pads with --file-margins in a note's main editor. Editors that don't match (table cells, canvas cards, embeds) are left alone.
const MAIN_SCROLLER = ".view-content > .markdown-source-view.mod-cm6 > .cm-editor > .cm-scroller";

function isWidget(node: Node): node is HTMLElement {
	return node.nodeType === Node.ELEMENT_NODE && (node as HTMLElement).classList.contains(WIDGET_CLASS);
}

function isBlock(node: Node): node is HTMLElement {
	return node.nodeType === Node.ELEMENT_NODE && (node as HTMLElement).classList.contains(BLOCK_CLASS);
}

/**
 * Hands Live Preview table widgets to the shared FitTracker, and rendered code-block widgets to BlockHosts, as they enter and leave an editor. A child-list MutationObserver on the content element is all that runs, and only when CodeMirror adds or removes top-level blocks — not on scroll or while typing in a cell.
 */
export function tableWatcher(tracker: FitTracker, blocks: BlockHosts) {
	return ViewPlugin.fromClass(
		class {
			private mutations: MutationObserver | null = null;
			private readonly widgets = new Set<HTMLElement>();
			private readonly hosts = new Set<HTMLElement>();
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
						record.removedNodes.forEach((node) => this.forget(node));
						record.addedNodes.forEach((node) => this.track(node));
					}
				});
				this.mutations.observe(this.view.contentDOM, { childList: true });

				for (const child of Array.from(this.view.contentDOM.children)) this.track(child);
			}

			private track(node: Node): void {
				if (isWidget(node)) {
					this.widgets.add(node);
					tracker.track(node);
				} else if (isBlock(node)) {
					this.hosts.add(node);
					blocks.add(node);
				}
			}

			private forget(node: Node): void {
				if (isWidget(node)) {
					this.widgets.delete(node);
					tracker.untrack(node);
				} else if (isBlock(node)) {
					this.hosts.delete(node);
					blocks.remove(node);
				}
			}

			destroy(): void {
				cancelAnimationFrame(this.startFrame);
				this.mutations?.disconnect();
				this.widgets.forEach((widget) => tracker.untrack(widget));
				this.widgets.clear();
				this.hosts.forEach((host) => blocks.remove(host));
				this.hosts.clear();
			}
		},
	);
}
