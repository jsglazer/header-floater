"use strict";
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);

// src/main.ts
var main_exports = {};
__export(main_exports, {
  default: () => HeaderFloaterPlugin
});
module.exports = __toCommonJS(main_exports);
var import_obsidian2 = require("obsidian");

// src/core/settings.ts
var DEFAULT_SETTINGS = {
  activeRow: true,
  mouseRow: true,
  activeRowColor: "",
  mouseRowColor: ""
};
var HEX = /^#[0-9a-f]{6}$/i;
function isHexColor(value) {
  return typeof value === "string" && HEX.test(value);
}
function loadSettings(data) {
  const saved = data && typeof data === "object" ? data : {};
  const bool = (key) => typeof saved[key] === "boolean" ? saved[key] : DEFAULT_SETTINGS[key];
  const color = (key) => isHexColor(saved[key]) ? saved[key].toLowerCase() : "";
  return {
    activeRow: bool("activeRow"),
    mouseRow: bool("mouseRow"),
    activeRowColor: color("activeRowColor"),
    mouseRowColor: color("mouseRowColor")
  };
}
var ACTIVE_ROW_CLASS = "hf-active-row";
var MOUSE_ROW_CLASS = "hf-mouse-row";
var ACTIVE_ROW_VAR = "--hf-active-row-background";
var MOUSE_ROW_VAR = "--hf-mouse-row-background";
function bodyState(settings) {
  return {
    classes: { [ACTIVE_ROW_CLASS]: settings.activeRow, [MOUSE_ROW_CLASS]: settings.mouseRow },
    vars: { [ACTIVE_ROW_VAR]: settings.activeRowColor || null, [MOUSE_ROW_VAR]: settings.mouseRowColor || null }
  };
}

// src/core/fit.ts
var FIT_TOLERANCE_PX = 1;
function shouldPin(tableWidth, availableWidth) {
  if (!(tableWidth > 0) || !(availableWidth > 0)) return false;
  return tableWidth <= availableWidth + FIT_TOLERANCE_PX;
}
function innerWidth(clientWidth, paddingStart, paddingEnd) {
  return clientWidth - (parseFloat(paddingStart) || 0) - (parseFloat(paddingEnd) || 0);
}

// src/fit-tracker.ts
var PIN_CLASS = "hf-pin";
var CONTENT = ":scope > .table-wrapper, :scope > table";
var FitTracker = class {
  constructor() {
    // Tracked box -> the content element currently observed inside it.
    this.contentOf = /* @__PURE__ */ new Map();
    this.observer = new ResizeObserver((entries) => {
      const boxes = /* @__PURE__ */ new Set();
      for (const { target } of entries) {
        const el = target;
        const box = this.contentOf.has(el) ? el : el.parentElement;
        if (box && this.contentOf.has(box)) boxes.add(box);
      }
      boxes.forEach((box) => this.check(box));
    });
  }
  track(box) {
    if (this.contentOf.has(box)) return;
    this.contentOf.set(box, null);
    this.observer.observe(box);
  }
  untrack(box) {
    if (!this.contentOf.has(box)) return;
    const content = this.contentOf.get(box);
    if (content) this.observer.unobserve(content);
    this.observer.unobserve(box);
    this.contentOf.delete(box);
  }
  dispose() {
    this.observer.disconnect();
    this.contentOf.forEach((_, box) => box.classList.remove(PIN_CLASS));
    this.contentOf.clear();
  }
  check(box) {
    var _a;
    if (!box.isConnected) {
      this.untrack(box);
      return;
    }
    let content = (_a = this.contentOf.get(box)) != null ? _a : null;
    if (!content || content.parentElement !== box) {
      const current = box.querySelector(CONTENT);
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
};

// src/settings-tab.ts
var import_obsidian = require("obsidian");
var HeaderFloaterSettingTab = class extends import_obsidian.PluginSettingTab {
  constructor(app, plugin) {
    super(app, plugin);
    this.plugin = plugin;
  }
  display() {
    const { containerEl } = this;
    containerEl.empty();
    new import_obsidian.Setting(containerEl).setName("Row highlights").setHeading();
    new import_obsidian.Setting(containerEl).setName("Active row highlight").setDesc("Tint the table row that holds the cursor while you edit a table in Live Preview.").addToggle((toggle) => toggle.setValue(this.plugin.settings.activeRow).onChange((value) => this.apply({ activeRow: value })));
    this.colorSetting("Active row colour", "activeRowColor", "accent");
    new import_obsidian.Setting(containerEl).setName("Mouse row highlight").setDesc("Tint the table row under the mouse pointer, in Reading view and Live Preview.").addToggle((toggle) => toggle.setValue(this.plugin.settings.mouseRow).onChange((value) => this.apply({ mouseRow: value })));
    this.colorSetting("Mouse row colour", "mouseRowColor", "hover");
  }
  colorSetting(name, key, themeName) {
    const describe = (value) => value ? `Custom colour ${value}. A light colour keeps text readable.` : `Using the theme's ${themeName} tint. Pick a colour to override it.`;
    const setting = new import_obsidian.Setting(this.containerEl).setName(name).setDesc(describe(this.plugin.settings[key]));
    let picker;
    let reset;
    const show = (value) => {
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
  apply(patch) {
    this.plugin.updateSettings(patch);
  }
};

// src/table-watcher.ts
var import_view = require("@codemirror/view");
var WIDGET_CLASS = "cm-table-widget";
var MAIN_SCROLLER = ".view-content > .markdown-source-view.mod-cm6 > .cm-editor > .cm-scroller";
function isWidget(node) {
  return node instanceof HTMLElement && node.classList.contains(WIDGET_CLASS);
}
function tableWatcher(tracker) {
  return import_view.ViewPlugin.fromClass(
    class {
      constructor(view) {
        this.view = view;
        this.mutations = null;
        this.widgets = /* @__PURE__ */ new Set();
        this.startFrame = requestAnimationFrame(() => this.start());
      }
      start() {
        if (!this.view.scrollDOM.matches(MAIN_SCROLLER)) return;
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
      track(widget) {
        this.widgets.add(widget);
        tracker.track(widget);
      }
      forget(widget) {
        this.widgets.delete(widget);
        tracker.untrack(widget);
      }
      destroy() {
        var _a;
        cancelAnimationFrame(this.startFrame);
        (_a = this.mutations) == null ? void 0 : _a.disconnect();
        this.widgets.forEach((widget) => tracker.untrack(widget));
        this.widgets.clear();
      }
    }
  );
}

// src/main.ts
var OFFSETS = [
  { name: "--hf-lp-offset", scroller: ".view-content > .markdown-source-view.mod-cm6 > .cm-editor > .cm-scroller" },
  { name: "--hf-rv-offset", scroller: ".markdown-reading-view > .markdown-preview-view" }
];
var TrackedTable = class extends import_obsidian2.MarkdownRenderChild {
  constructor(containerEl, tracker) {
    super(containerEl);
    this.tracker = tracker;
  }
  onload() {
    this.tracker.track(this.containerEl);
  }
  onunload() {
    this.tracker.untrack(this.containerEl);
  }
};
var HeaderFloaterPlugin = class extends import_obsidian2.Plugin {
  constructor() {
    super(...arguments);
    this.tracker = new FitTracker();
    this.settings = { ...DEFAULT_SETTINGS };
    // Popout windows get their own body, so highlight classes and colours are applied to each.
    this.bodies = /* @__PURE__ */ new Set();
    // Colour pickers report every step of a drag; apply each step at once but write to disk once it settles.
    this.requestSave = (0, import_obsidian2.debounce)(() => this.saveData(this.settings), 500, true);
  }
  async onload() {
    this.settings = loadSettings(await this.loadData());
    this.addSettingTab(new HeaderFloaterSettingTab(this.app, this));
    this.bodies.add(document.body);
    this.registerEvent(
      this.app.workspace.on("window-open", (_win, win) => {
        this.bodies.add(win.document.body);
        this.applyHighlights();
      })
    );
    this.registerEvent(this.app.workspace.on("window-close", (_win, win) => this.bodies.delete(win.document.body)));
    this.applyHighlights();
    this.addCommand({
      id: "toggle-active-row-highlight",
      name: "Toggle Active Row Highlight",
      callback: () => this.toggle("activeRow", "Active row highlight")
    });
    this.addCommand({
      id: "toggle-mouse-row-highlight",
      name: "Toggle Mouse Row Highlight",
      callback: () => this.toggle("mouseRow", "Mouse row highlight")
    });
    this.registerEditorExtension(tableWatcher(this.tracker));
    this.registerMarkdownPostProcessor((el, ctx) => {
      if (el.childElementCount === 1 && el.firstElementChild instanceof HTMLTableElement) {
        ctx.addChild(new TrackedTable(el, this.tracker));
      }
    });
    const sync = () => this.syncOffsets();
    this.app.workspace.onLayoutReady(sync);
    this.registerEvent(this.app.workspace.on("css-change", sync));
    this.registerEvent(this.app.workspace.on("layout-change", sync));
  }
  onunload() {
    this.requestSave.run();
    const { classes, vars } = bodyState(this.settings);
    for (const body of this.bodies) {
      for (const name of Object.keys(classes)) body.classList.remove(name);
      for (const name of Object.keys(vars)) body.style.removeProperty(name);
    }
    this.bodies.clear();
    this.tracker.dispose();
    for (const { name } of OFFSETS) document.body.style.removeProperty(name);
    document.querySelectorAll(`.${PIN_CLASS}`).forEach((el) => el.classList.remove(PIN_CLASS));
  }
  syncOffsets() {
    const body = document.body;
    for (const { name, scroller } of OFFSETS) {
      const el = document.querySelector(scroller);
      if (!el) continue;
      const padding = getComputedStyle(el).paddingTop;
      if (padding && body.style.getPropertyValue(name) !== padding) body.style.setProperty(name, padding);
    }
  }
  updateSettings(patch) {
    this.settings = { ...this.settings, ...patch };
    this.applyHighlights();
    this.requestSave();
  }
  toggle(key, label) {
    this.updateSettings({ [key]: !this.settings[key] });
    new import_obsidian2.Notice(`${label} ${this.settings[key] ? "on" : "off"}`);
  }
  applyHighlights() {
    const { classes, vars } = bodyState(this.settings);
    for (const body of this.bodies) {
      for (const [name, on] of Object.entries(classes)) body.classList.toggle(name, on);
      for (const [name, value] of Object.entries(vars)) {
        if (value) body.style.setProperty(name, value);
        else body.style.removeProperty(name);
      }
    }
  }
};
