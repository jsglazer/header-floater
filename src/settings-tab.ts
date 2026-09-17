import { App, ColorComponent, ExtraButtonComponent, PluginSettingTab, Setting } from "obsidian";
import type HeaderFloaterPlugin from "./main";
import type { HeaderFloaterSettings } from "./core/settings";

type ColorKey = "activeRowColor" | "mouseRowColor";

export class HeaderFloaterSettingTab extends PluginSettingTab {
	constructor(app: App, private readonly plugin: HeaderFloaterPlugin) {
		super(app, plugin);
	}

	display(): void {
		const { containerEl } = this;
		containerEl.empty();

		new Setting(containerEl).setName("Row highlights").setHeading();

		new Setting(containerEl)
			.setName("Active row highlight")
			.setDesc("Tint the table row that holds the cursor while you edit a table in Live Preview.")
			.addToggle((toggle) => toggle.setValue(this.plugin.settings.activeRow).onChange((value) => this.apply({ activeRow: value })));
		this.colorSetting("Active row colour", "activeRowColor", "accent");

		new Setting(containerEl)
			.setName("Mouse row highlight")
			.setDesc("Tint the table row under the mouse pointer, in Reading view and Live Preview.")
			.addToggle((toggle) => toggle.setValue(this.plugin.settings.mouseRow).onChange((value) => this.apply({ mouseRow: value })));
		this.colorSetting("Mouse row colour", "mouseRowColor", "hover");
	}

	private colorSetting(name: string, key: ColorKey, themeName: string): void {
		const describe = (value: string) => (value ? `Custom colour ${value}. A light colour keeps text readable.` : `Using the theme's ${themeName} tint. Pick a colour to override it.`);
		const setting = new Setting(this.containerEl).setName(name).setDesc(describe(this.plugin.settings[key]));
		let picker: ColorComponent;
		let reset: ExtraButtonComponent;
		// The picker reports every step of a drag, so update in place rather than redrawing the tab under the pointer.
		const show = (value: string) => {
			setting.setDesc(describe(value));
			reset.extraSettingsEl.toggle(value !== "");
		};
		setting.addColorPicker((component) => {
			picker = component;
			if (this.plugin.settings[key]) component.setValue(this.plugin.settings[key]);
			component.onChange((value) => {
				this.apply({ [key]: value });
				show(value);
			});
		});
		setting.addExtraButton((button) => {
			reset = button.setIcon("rotate-ccw").setTooltip("Reset to theme default").onClick(() => {
				this.apply({ [key]: "" });
				picker.setValue("#000000");
				show("");
			});
		});
		show(this.plugin.settings[key]);
	}

	private apply(patch: Partial<HeaderFloaterSettings>): void {
		this.plugin.updateSettings(patch);
	}
}
