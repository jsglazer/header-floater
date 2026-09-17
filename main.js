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

// src/block-hosts.ts
var BLOCK_ROOT = ':scope > [class*="block-language-"]';
var BlockHosts = class {
  constructor(tracker, enabled) {
    this.tracker = tracker;
    this.enabled = enabled;
    this.hosts = /* @__PURE__ */ new Map();
  }
  add(host) {
    if (this.hosts.has(host)) return;
    const observer = new MutationObserver(() => this.sync(host));
    observer.observe(host, { childList: true });
    this.hosts.set(host, { observer, box: null });
    this.sync(host);
  }
  remove(host) {
    const entry = this.hosts.get(host);
    if (!entry) return;
    entry.observer.disconnect();
    if (entry.box) this.tracker.untrack(entry.box);
    this.hosts.delete(host);
  }
  setEnabled(enabled) {
    if (this.enabled === enabled) return;
    this.enabled = enabled;
    this.hosts.forEach((_, host) => this.sync(host));
  }
  dispose() {
    Array.from(this.hosts.keys()).forEach((host) => this.remove(host));
  }
  sync(host) {
    const entry = this.hosts.get(host);
    if (!entry) return;
    const box = this.enabled ? host.querySelector(BLOCK_ROOT) : null;
    if (box === entry.box) return;
    if (entry.box) this.tracker.untrack(entry.box);
    if (box) this.tracker.track(box, "block");
    entry.box = box;
  }
};

// src/core/settings.ts
var DEFAULT_SETTINGS = {
  renderedBlocks: true,
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
    renderedBlocks: bool("renderedBlocks"),
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
function planBlock(tables, availableWidth) {
  const fits = tables.map((table) => shouldPin(table.width, availableWidth));
  const pin = availableWidth > 0 && fits.some(Boolean) && tables.every((table, i) => fits[i] || table.ownWrapper);
  return { pin, fits };
}

// src/fit-tracker.ts
var PIN_CLASS = "hf-pin";
var TABLE_CLASS = "hf-table";
var SCROLL_CLASS = "hf-scroll";
var TABLE_CONTENT = ":scope > .table-wrapper, :scope > table";
var NESTED_SCOPE = "table, .callout, .internal-embed, .markdown-embed";
function tableOf(content) {
  return content.tagName === "TABLE" ? content : content.querySelector(":scope > table");
}
function blockTables(box) {
  return Array.from(box.querySelectorAll("table")).filter((table) => {
    var _a;
    const outer = (_a = table.parentElement) == null ? void 0 : _a.closest(NESTED_SCOPE);
    return !outer || !box.contains(outer);
  });
}
var FitTracker = class {
  constructor() {
    this.boxes = /* @__PURE__ */ new Map();
    // Observed content element -> the box it belongs to.
    this.ownerOf = /* @__PURE__ */ new Map();
    // Class writes waiting for the next frame. Checks measure inside the ResizeObserver callback, while the elements are laid out, but toggling classes there resizes observed elements and trips the browser's resize-loop guard.
    this.pending = /* @__PURE__ */ new Map();
    // One frame per window: a popout's boxes wait on its own frames, which keep running while the main window is covered and throttled.
    this.frames = /* @__PURE__ */ new Map();
    this.observer = new ResizeObserver((entries) => {
      const due = /* @__PURE__ */ new Set();
      for (const { target } of entries) {
        const el = target;
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
  }
  track(box, kind = "table") {
    if (this.boxes.has(box)) return;
    let mutations = null;
    if (kind === "block") {
      mutations = new MutationObserver(() => this.check(box));
      mutations.observe(box, { childList: true, subtree: true });
    }
    this.boxes.set(box, { kind, contents: [], mutations });
    this.observer.observe(box);
  }
  untrack(box) {
    var _a;
    const state = this.boxes.get(box);
    if (!state) return;
    (_a = state.mutations) == null ? void 0 : _a.disconnect();
    for (const content of state.contents) this.release(content);
    this.observer.unobserve(box);
    this.boxes.delete(box);
    this.pending.delete(box);
    box.classList.remove(PIN_CLASS);
  }
  dispose() {
    this.frames.forEach((frame, win) => win.cancelAnimationFrame(frame));
    this.frames.clear();
    this.pending.clear();
    Array.from(this.boxes.keys()).forEach((box) => this.untrack(box));
    this.observer.disconnect();
  }
  release(content) {
    var _a, _b;
    this.observer.unobserve(content);
    this.ownerOf.delete(content);
    (_a = tableOf(content)) == null ? void 0 : _a.classList.remove(TABLE_CLASS);
    (_b = content.parentElement) == null ? void 0 : _b.classList.remove(SCROLL_CLASS);
  }
  flush(win) {
    this.frames.delete(win);
    this.pending.forEach((plan, box) => {
      if (box.ownerDocument.defaultView !== win) return;
      this.pending.delete(box);
      this.apply(box, plan);
    });
  }
  /** Measures and applies at once, for callers outside a ResizeObserver callback. */
  check(box) {
    const plan = this.measure(box);
    if (plan) this.apply(box, plan);
  }
  measure(box) {
    const state = this.boxes.get(box);
    if (!state || !box.isConnected) return null;
    const current = state.kind === "block" ? blockTables(box) : Array.from(box.querySelectorAll(TABLE_CONTENT)).slice(0, 1);
    for (const old of state.contents) if (!current.includes(old)) this.release(old);
    for (const content of current) {
      if (this.ownerOf.has(content)) continue;
      this.ownerOf.set(content, box);
      this.observer.observe(content);
    }
    state.contents = current;
    const style = getComputedStyle(box);
    const available = innerWidth(box.clientWidth, style.paddingLeft, style.paddingRight);
    let pin;
    let fits;
    if (state.kind === "block") {
      ({ pin, fits } = planBlock(
        current.map((table) => {
          var _a;
          return { width: table.offsetWidth, ownWrapper: table.parentElement !== box && ((_a = table.parentElement) == null ? void 0 : _a.childElementCount) === 1 };
        }),
        available
      ));
    } else {
      pin = current.length > 0 && shouldPin(current[0].offsetWidth, available);
      fits = [pin];
    }
    return { contents: current, pin, fits };
  }
  apply(box, { contents, pin, fits }) {
    const state = this.boxes.get(box);
    if (!state || state.contents !== contents) return;
    if (box.classList.contains(PIN_CLASS) !== pin) box.classList.toggle(PIN_CLASS, pin);
    contents.forEach((content, i) => {
      var _a, _b;
      (_a = tableOf(content)) == null ? void 0 : _a.classList.toggle(TABLE_CLASS, pin && fits[i]);
      if (state.kind === "block") (_b = content.parentElement) == null ? void 0 : _b.classList.toggle(SCROLL_CLASS, pin && !fits[i]);
    });
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
    new import_obsidian.Setting(containerEl).setName("Floating headers").setHeading();
    new import_obsidian.Setting(containerEl).setName("Tables in rendered blocks").setDesc("Also float the headers of tables drawn by code blocks, such as Dataview. Markdown tables always float.").addToggle((toggle) => toggle.setValue(this.plugin.settings.renderedBlocks).onChange((value) => this.apply({ renderedBlocks: value })));
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
var BLOCK_CLASS = "cm-preview-code-block";
var MAIN_SCROLLER = ".view-content > .markdown-source-view.mod-cm6 > .cm-editor > .cm-scroller";
function isWidget(node) {
  return node.nodeType === Node.ELEMENT_NODE && node.classList.contains(WIDGET_CLASS);
}
function isBlock(node) {
  return node.nodeType === Node.ELEMENT_NODE && node.classList.contains(BLOCK_CLASS);
}
function tableWatcher(tracker, blocks) {
  return import_view.ViewPlugin.fromClass(
    class {
      constructor(view) {
        this.view = view;
        this.mutations = null;
        this.widgets = /* @__PURE__ */ new Set();
        this.hosts = /* @__PURE__ */ new Set();
        this.startFrame = requestAnimationFrame(() => this.start());
      }
      start() {
        if (!this.view.scrollDOM.matches(MAIN_SCROLLER)) return;
        this.mutations = new MutationObserver((records) => {
          for (const record of records) {
            record.removedNodes.forEach((node) => this.forget(node));
            record.addedNodes.forEach((node) => this.track(node));
          }
        });
        this.mutations.observe(this.view.contentDOM, { childList: true });
        for (const child of Array.from(this.view.contentDOM.children)) this.track(child);
      }
      track(node) {
        if (isWidget(node)) {
          this.widgets.add(node);
          tracker.track(node);
        } else if (isBlock(node)) {
          this.hosts.add(node);
          blocks.add(node);
        }
      }
      forget(node) {
        if (isWidget(node)) {
          this.widgets.delete(node);
          tracker.untrack(node);
        } else if (isBlock(node)) {
          this.hosts.delete(node);
          blocks.remove(node);
        }
      }
      destroy() {
        var _a;
        cancelAnimationFrame(this.startFrame);
        (_a = this.mutations) == null ? void 0 : _a.disconnect();
        this.widgets.forEach((widget) => tracker.untrack(widget));
        this.widgets.clear();
        this.hosts.forEach((host) => blocks.remove(host));
        this.hosts.clear();
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
var TrackedBlockHost = class extends import_obsidian2.MarkdownRenderChild {
  constructor(containerEl, blocks) {
    super(containerEl);
    this.blocks = blocks;
  }
  onload() {
    this.blocks.add(this.containerEl);
  }
  onunload() {
    this.blocks.remove(this.containerEl);
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
    this.blocks = new BlockHosts(this.tracker, this.settings.renderedBlocks);
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
    this.registerEditorExtension(tableWatcher(this.tracker, this.blocks));
    this.registerMarkdownPostProcessor((el, ctx) => {
      var _a;
      if (el.childElementCount !== 1) return;
      if (((_a = el.firstElementChild) == null ? void 0 : _a.tagName) === "TABLE") ctx.addChild(new TrackedTable(el, this.tracker));
      else if (el.classList.contains("el-pre")) ctx.addChild(new TrackedBlockHost(el, this.blocks));
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
    this.blocks.dispose();
    this.tracker.dispose();
    for (const { name } of OFFSETS) document.body.style.removeProperty(name);
    document.querySelectorAll(`.${PIN_CLASS}`).forEach((el) => el.classList.remove(PIN_CLASS));
    for (const name of [TABLE_CLASS, SCROLL_CLASS]) document.querySelectorAll(`.${name}`).forEach((el) => el.classList.remove(name));
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
    this.blocks.setEnabled(this.settings.renderedBlocks);
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
