# header-floater — Project Log

> No `UpdateNN.md` was supplied, and the user asked to skip the build pipeline, so per the workflow fallback all activity is logged here.

Version: 1.0.0

Closed: 2026-09-17 11:28

## 2026-09-17 — Initial build: replacement for sticky-table-headers 0.3.0

### Prompt
> I need this capability but I don't have time to go through our build pipeline. can you make a plugin that does the same thing--pin/float table header row--with none of the performance issues of this plugin? Interview me if you have questions. use repo `https://github.com/jsglazer/header-floater`. Build in `~/Dev/2-Projects/Obsidian/header-floater`

Context: the previous exchange reviewed `sticky-table-headers-0.3.0` and found no security issues, but found scroll listeners that pile up on every `layout-change`, layout reads on every scroll event, a one-editor-only `querySelector`, a fixed 100ms delay in the post-processor, and CSS side effects (`overflow: visible !important` on all tables, `z-index: 1000`, a light-only `#FAFAFA` default).

### Interview
- **Wide tables:** Hybrid (recommended). CSS pinning for tables that fit; wide tables keep sideways scrolling and don't pin.
- **Pinned header background:** theme colour (recommended), no settings.
- **Views:** Reading view and Live Preview.
- **Deploy:** to a vault → `~/VaultSchar`.
- **Permission granted:** read-only access to Obsidian's built-in stylesheet (`~/Library/Application Support/obsidian/obsidian-1.13.7.asar`). Recorded in `.claude/settings.local.json` along with the VaultSchar plugin-folder deploy permissions.

### Claude output
- Extracted Obsidian 1.13.7 `app.css` and `app.js` to the scratchpad and confirmed the DOM:
  - Live Preview tables are `.cm-content > .cm-embed-block.cm-table-widget > .table-wrapper > table.table-editor`, and the widget has `overflow-x: auto; overflow-y: hidden`.
  - The scrollers are `.cm-scroller` and `.markdown-preview-view`, both padded with `var(--file-margins)`.
- Scaffolded the project to match the sibling plugins (esbuild 0.28, TS 6, vitest 4, MIT, CI workflow). `@codemirror/view` and `@codemirror/state` are pinned to the peer versions `obsidian` 1.13.1 requires.
- **`src/core/fit.ts`:** pure `shouldPin(tableWidth, availableWidth)` with 1px tolerance, plus `innerWidth`. Covered by 6 vitest tests.
- **`src/fit-tracker.ts`:** one shared `ResizeObserver`. Tracks table boxes, finds the current content element (`:scope > .table-wrapper, :scope > table`), toggles `hf-pin` only when the state changes, and cleans up in `untrack`/`dispose`.
- **`src/table-watcher.ts`:** CodeMirror `ViewPlugin`.
  - Starts one frame after construction and only for main-editor scrollers, which skips table-cell editors, canvas cards and embeds.
  - Watches `contentDOM` with a child-list-only `MutationObserver`, since table widgets are direct children. It never sees typing inside cells.
  - Hands widgets to the tracker and releases them in `destroy`.
- **`src/main.ts`:**
  - Registers the editor extension.
  - Adds a reading-view post-processor that tracks single-table blocks through a `MarkdownRenderChild`, so they are released when the section unloads.
  - Keeps `--hf-lp-offset` and `--hf-rv-offset` in sync with the scrollers' real top padding (one lookup per `css-change`/`layout-change`).
  - `onunload` disposes the tracker and removes the CSS variables and classes.
- **`styles.css`:**
  - Only `.hf-pin` boxes get `overflow: visible !important`.
  - Only top-level header cells get `position: sticky`, a `top` offset from the measured padding, and `z-index: 3`.
  - The background is `--hf-header-background` (default `--background-primary`) with the theme header tint and alternate-column tint layered on top.
  - An inset bottom-border shadow replaces the collapsed border that doesn't travel with sticky cells.
- Built (`main.js` 6.7 KB), deployed to `~/VaultSchar/.obsidian/plugins/header-floater`, and enabled through the Obsidian CLI.
- **Live verification in the running Obsidian (VaultSchar):**
  - **Live Preview:** the table scrolled 4,000px past the pane top, and the header sat exactly at the scroller top (64px). The widget's overflow was `visible`, the background opaque, z-index 3. It still pinned after the refactor.
  - **Reading view (first attempt, failed):** the rule applied, but the header scrolled away. The ancestor chain showed `div.el-table` with `overflow-x: auto` set as an inline style by Obsidian's renderer on every table (in `app.js`: `o.style.overflowX="auto"` when a table is its block's only child).
  - **Fix:** extended the fit tracking to reading-view blocks and used `!important` in the overflow override.
  - **Reading view (re-test, passed):** a narrow 200-row table in a real reading view, with Obsidian's inline style, pinned exactly (header 72px = pane top 72px, table top −1428px). A real wide table (1253px in a 1205px box) stayed unpinned with `overflow-x: auto`.
  - **Unload:** 0 `hf-pin` classes and both CSS variables removed. Re-enabling restored the pins.
  - **Test tabs:** closed afterwards, and focus returned to the user's note.
- Measured Live Preview scroller padding is `0px` in this vault, while `--file-margins-y` is 32px. Measuring rather than assuming the variable was necessary.

### Issue / Fix summary
| # | Issue | Fix |
|---|-------|-----|
| 1 | Original plugin added scroll listeners on every `layout-change` without removing old ones (listeners and memory grow for the whole session) | No scroll listeners at all. Pinning is CSS `position: sticky`; JS only observes size changes and releases tables through `MarkdownRenderChild.onunload` / `ViewPlugin.destroy` |
| 2 | Original plugin forced layout reads and sent a bubbling event on every scroll event for every table | One shared `ResizeObserver` re-checks a table only when it or its box resizes, and toggles the class only on a state change |
| 3 | Original edit-view handling only saw the first `.markdown-source-view` in the window and missed tables rendered later | A per-editor CodeMirror `ViewPlugin` with a child-list `MutationObserver` on `contentDOM` catches every table widget as it's added, in every pane |
| 4 | Original reading-view processor used a fixed 100ms `setTimeout` and never cleaned up | Post-processor attaches a `MarkdownRenderChild`, with no timers; lifecycle follows the rendered section |
| 5 | Original `overflow: visible !important` on every table made wide tables spill past the pane | Hybrid: overflow lifted only on boxes marked `hf-pin` (table fits); wide tables keep sideways scrolling and don't pin |
| 6 | Original `z-index: 1000` could cover menus and popovers; `#FAFAFA` default is wrong in dark mode | `z-index: 3`; background from `--background-primary` with the theme header tint layered on; both overridable variables |
| 7 | Original set `--file-margins-top` on body and never removed it | Offsets measured from the real scroller padding and removed on unload; verified 0 leftovers |
| 8 | Reading view didn't pin on first live test: Obsidian sets inline `overflow-x: auto` on every table block | Reading-view blocks tracked by the same fit tracker; `div.hf-pin` gets `overflow: visible !important`; re-verified pinning live |
| 9 | Assuming `--file-margins-y` for the pin offset would put Live Preview headers 32px off in this vault (actual scroller padding is 0) | Measure `paddingTop` of the real scrollers on `css-change`/`layout-change`; `--file-margins-y` only as a fallback |

### Final summary delivered to user (verbatim)
SUMMARY_PLACEHOLDER
