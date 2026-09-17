# header-floater — Project Log

> No `UpdateNN.md` was supplied, and the user asked to skip the build pipeline, so per the workflow fallback all activity is logged here.

Version: 1.0.0

Closed: 2026-09-17 12:10

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
Header Floater 1.0.0 is built, pushed to `jsglazer/header-floater` (main), and enabled in VaultSchar. I tested it by scrolling real tables in your running Obsidian: headers pin flush to the top of the pane in both Reading view and Live Preview.

**How it avoids the old plugin's problems:** the pinning is done by CSS, so nothing runs while you scroll.
- **Size checks only when something resizes.** One shared size watcher marks tables that fit their pane. It re-checks a table only when that table or its pane changes size.
- **Nothing piles up.** Each table is released when its note section or editor goes away. The old plugin kept adding scroll listeners on every layout change.
- **Every pane is covered.** Each editor watches only for table blocks being added or removed, so it never sees your typing.
- **Clean unload.** Disabling removes everything. I confirmed nothing was left behind, and re-enabling brought the pins back.

**How it behaves, per your choices:**
- Tables that fit pin their header. Wide tables keep their sideways scroll and don't pin.
- The pinned header uses your theme's background, so dark mode works too.
- Source mode, callouts and embeds are left alone.

**Found during testing:**
- **Obsidian clips every reading-view table.** It adds an inline sideways-scroll style to each table's wrapper, and that blocks pinning. My first reading-view test failed because of this. The plugin now lifts that style only for tables that fit, and the retest passed.
- **The original plugin's offset trick doesn't fit your vault.** A snippet or theme sets your editor's top padding to 0 instead of the usual 32px. Header Floater measures the real padding instead of assuming it.

**Other notes:**
- **Your notes and tabs:** while testing, I briefly opened a few notes in temporary reading-view tabs. I closed them all and gave focus back to your note, and no note content was changed.
- **Uninstall the old plugin:** if `sticky-table-headers` is installed in any vault, remove it rather than running both.
- **Colour override:** you can change the header colour with `--hf-header-background` in a CSS snippet.

Everything is logged in `header-floater-log.md`.

## 2026-09-17 12:05 — VaultDEV project folder

### Prompt
> fastantic, it works great. please build out a basic folder structure with Dev file, BuildLog, and Update folder at `/Users/josh/VaultDEV/2-Projects/Obsidian/header-floater/`

### Claude output
- Copied the layout of the sibling projects (`folder-follow`, `virtual-outliner`) and the `Templates/NewBuild` templates (`projDev.md`, `BuildLog.md`).
- **`header-floater Dev.md`:** frontmatter filled in (DevStatus Stable, Version 1.0.0, Local, Repo, public, Created, Platform Obsidian, LastShipCheck 2026-09-17), the New Update button, a General section, and a Claude Log with the build/deploy and folder-creation entries.
- **`BuildLog.md`:** Status Closed. The Gemini stages are marked as skipped (pipeline bypassed), with the plugin review recorded as the audit input. Claude Stage 3 holds the interview decisions; Stage 4 summarizes the build, the live-test findings, and the shipped commits.
- **`Updates/`:** created empty, ready for `UpdateNNN.md` files.
- **Resolver check:** `~/.claude/scripts/dev-resolve-project.sh header-floater` resolves the project (exit 0: Dev file, Updates folder, version 1.0.0, repo), so `/dev-deploy` and `/dev-nextupdate` will find it.

### Issue / Fix summary
| # | Issue | Fix |
|---|-------|-----|
| 1 | Project had no VaultDEV home, so the Dev skills (deploy, nextupdate, release) couldn't resolve it | Created the Dev file, BuildLog and Updates folder at `~/VaultDEV/2-Projects/Obsidian/header-floater/`, and confirmed the resolver finds it |

### Final summary delivered to user (verbatim)
I set up the VaultDEV project folder at `~/VaultDEV/2-Projects/Obsidian/header-floater/`, modelled on your other plugin projects and the NewBuild templates:

- **`header-floater Dev.md`:**
  - Frontmatter: `DevStatus: Stable`, `Version: 1.0.0`, Local and Repo paths, `RepoViz: public`, `LastShipCheck: 2026-09-17`.
  - The New Update button.
  - A Claude Log with the build/deploy entry.
- **`BuildLog.md`:**
  - Status Closed.
  - The Gemini interview and audit stages are marked as skipped, since you bypassed the pipeline. The review of the old plugin is recorded as the audit input.
  - Stages 3–4 hold your interview decisions, the build summary, the reading-view issue found in testing, and the shipped commits.
- **`Updates/`:** empty, ready for your New Update button.

Your resolver script finds the new project (Dev file, Updates folder, version 1.0.0, repo), so `/dev-deploy header-floater` and `/dev-nextupdate header-floater` will work. I also logged this in the repo's `header-floater-log.md`.

## 2026-09-17 12:10 — Plan: cursor-row and hover-row highlight (no build)

### Prompt
> if you add a feature that would lightly highlight the row the cursor is in and (different color) the row the mouse is over, how would you build it?  Plan only, no build yet

### Claude output
- Plan only. No code was changed and the version stays 1.0.0.
- Proposed building both highlights in pure CSS, with no new JS: `tr:hover` for the mouse row and `tr:focus-within` for the cursor row, since Obsidian's Live Preview table puts the cursor in a small editor inside the cell.
- Each highlight is a translucent `background-image` layer on the row's `td` cells, so theme striping stays visible underneath. Two new override variables are proposed.
- Hover is limited to `@media (hover: hover)` so the highlight doesn't stick after a tap on mobile. The cursor highlight applies to Live Preview only, since Reading view has no cursor.
- The DOM still needs checking in the running Obsidian before building: that focus in a cell really matches `tr:focus-within`, and what happens with multi-cell selections.
- Open questions for the user: colours, which tables, cursor highlight when the editor loses focus, and source mode.

### Issue / Fix summary
| # | Issue | Fix |
|---|-------|-----|
| 1 | User asked how a cursor-row and hover-row highlight would be built | Wrote a plan: a CSS-only design, the checks to run first, the build steps, and the open questions. Nothing built yet |

### Final summary delivered to user (verbatim)
Plan only. Nothing is built yet, and the version stays at 1.0.0.

**Short version:** both highlights can be done with CSS alone, so no new JavaScript would run while you scroll, type, or move the mouse.

**How it would work**
- **Mouse row:** CSS already knows which row the mouse is over (`tr:hover`), so it can tint that row. It works in Reading view and Live Preview. It would only apply on devices with a real mouse, so a tap on mobile doesn't leave a row stuck highlighted.
- **Cursor row:** in Live Preview, clicking into a table puts the cursor in a small editor inside that cell. CSS can see that the row holds the cursor (`tr:focus-within`), so the row stays highlighted as you arrow between cells. Reading view has no cursor, so this is Live Preview only.
- **Header row:** neither highlight touches it, so the pinned header keeps its look.
- **Colours:** each highlight is a see-through tint laid over the row, so your theme's striping still shows. A row that is both hovered and holding the cursor shows both tints.
  - Mouse row: your theme's standard hover shade.
  - Cursor row: a light tint of your accent colour.
  - Both can be overridden in a CSS snippet with `--hf-hover-row-background` and `--hf-cursor-row-background`.

**Build steps**
1. **Check the DOM first** in the running VaultSchar Obsidian, using temporary tabs as before:
   - Confirm that clicking into a cell makes its row match `:focus-within`.
   - Check what a multi-cell selection or a whole-table selection does.
   - Check that editing a cell doesn't redraw the row and drop the highlight.
   - If focus doesn't reach the row, fall back to one lightweight focus listener that adds a class to the row, costing one lookup per cell change.
2. Add the rules and the two variables to `styles.css`, at a lower layer than the pinned header.
3. Test it live: hover and cursor in both views, dark mode, wide tables, the pinned header, and disabling the plugin.
4. Update the README, bump to 1.0.1 (and the Dev file's `Version:`), commit, push, and deploy to VaultSchar.

**Questions before building**
1. **Cursor leaves the editor:** when you click into the sidebar, should the cursor row stay highlighted? CSS alone clears it; keeping it needs a small listener.
2. **Which tables:** all tables, including callouts and embeds (easy for hover), or only the top-level tables that pin?
3. **Source mode:** should the cursor's table line also be highlighted there? That would need an editor decoration, which is more work.
4. **Settings:** are CSS variables enough, or do you want on/off toggles and colour pickers in a settings tab?
5. **Plugin name:** does this belong in Header Floater, given the name, or in a separate plugin?
