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
var import_obsidian = require("obsidian");

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
var TrackedTable = class extends import_obsidian.MarkdownRenderChild {
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
var HeaderFloaterPlugin = class extends import_obsidian.Plugin {
  constructor() {
    super(...arguments);
    this.tracker = new FitTracker();
  }
  onload() {
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
};
