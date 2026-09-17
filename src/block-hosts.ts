import { FitTracker } from "./fit-tracker";

// A code block processor (Dataview and the like) renders into a .block-language-* element that replaces the <pre>, sometimes after the host has been handed to us.
const BLOCK_ROOT = ':scope > [class*="block-language-"]';

/**
 * Hosts are the containers that hold a rendered code block: the reading-view section div, or the Live Preview code-block widget. Each host is watched for its direct children only, so the block root is found when it appears or is replaced, and handed to the FitTracker as a "block" box while the feature is on.
 */
export class BlockHosts {
	private readonly hosts = new Map<HTMLElement, { observer: MutationObserver; box: HTMLElement | null }>();

	constructor(
		private readonly tracker: FitTracker,
		private enabled: boolean,
	) {}

	add(host: HTMLElement): void {
		if (this.hosts.has(host)) return;
		const observer = new MutationObserver(() => this.sync(host));
		observer.observe(host, { childList: true });
		this.hosts.set(host, { observer, box: null });
		this.sync(host);
	}

	remove(host: HTMLElement): void {
		const entry = this.hosts.get(host);
		if (!entry) return;
		entry.observer.disconnect();
		if (entry.box) this.tracker.untrack(entry.box);
		this.hosts.delete(host);
	}

	setEnabled(enabled: boolean): void {
		if (this.enabled === enabled) return;
		this.enabled = enabled;
		this.hosts.forEach((_, host) => this.sync(host));
	}

	dispose(): void {
		Array.from(this.hosts.keys()).forEach((host) => this.remove(host));
	}

	private sync(host: HTMLElement): void {
		const entry = this.hosts.get(host);
		if (!entry) return;
		const box = this.enabled ? host.querySelector<HTMLElement>(BLOCK_ROOT) : null;
		if (box === entry.box) return;
		if (entry.box) this.tracker.untrack(entry.box);
		if (box) this.tracker.track(box, "block");
		entry.box = box;
	}
}
