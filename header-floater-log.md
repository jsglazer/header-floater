# header-floater — Project Log

> No `UpdateNN.md` was supplied, and the user asked to skip the build pipeline, so per the workflow fallback all activity is logged here.

Version: 1.0.1

Closed: 2026-09-17 12:22

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
  - Frontmatter: `DevStatus: Stable`, `Version: 1.0.1`, Local and Repo paths, `RepoViz: public`, `LastShipCheck: 2026-09-17`.
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

## 2026-09-17 12:22 — Build: active-row and mouse-row highlights (v1.0.1)

### Prompt
> build it.  create settings page and add options to toggle both features; option to select BG color for each; create new commands to Toggle Active Row Highight and Toggle Mouse Row Highlight; build and deploy to VaultShar

### Claude output
- **Checked the DOM first:** in a temporary Live Preview tab (`Operations.md`), placing the cursor in a table cell focuses a `.cm-content` inside the `td`, so the row matches `tr:focus-within`. Obsidian marks the same row with `mod-active-row-handle`. On blur, both clear.
- **Open plan questions** the user didn't answer, resolved with defaults:
  - The active row clears on blur (CSS only, same as Obsidian's handle).
  - The mouse row applies to all rendered tables.
  - Source mode is not included.
  - A custom colour is used as picked, with no opacity setting.
- **`src/core/settings.ts`:**
  - Settings interface and defaults (both on, colours `""` = theme default).
  - `loadSettings` validates saved data (booleans; `#rrggbb` colours, lowercased).
  - `bodyState` maps settings to body classes (`hf-active-row`, `hf-mouse-row`) and inline variables (`--hf-active-row-background`, `--hf-mouse-row-background`, cleared for theme default).
  - Covered by 6 new vitest tests (12 total, all pass).
- **`src/settings-tab.ts`:**
  - "Row highlights" heading, a toggle for each highlight, and a colour setting for each (colour picker, description, and a reset button shown only when a custom colour is set).
  - The picker updates the description and reset button in place, since it reports every drag step and redrawing the tab would break the drag.
- **`src/main.ts`:**
  - Loads settings and registers the settings tab.
  - Commands `toggle-active-row-highlight` ("Toggle Active Row Highlight") and `toggle-mouse-row-highlight` ("Toggle Mouse Row Highlight"), each with an on/off Notice.
  - `updateSettings` applies classes and variables right away, and saves once changes settle (debounced 500ms, flushed on unload).
  - Highlights are applied to the main body and each popout window's body (`window-open`/`window-close`).
  - `onunload` removes the classes and variables.
- **`styles.css`:**
  - Default variables: accent at 15% via `color-mix` for the active row, `--background-modifier-hover` for the mouse row.
  - Mouse row: `body.hf-mouse-row .markdown-rendered table > tbody > tr:hover > td`, inside `@media (hover: hover)`.
  - Active row: `body.hf-active-row .markdown-source-view.mod-cm6 .cm-table-widget table > tbody > tr:focus-within > td`.
  - A combined rule stacks both layers. Each tint is a `background-image` gradient, so the cell's `background-color` striping stays visible.
- **Other files:** README gains a "Row highlights" section and the new variables. Version is now 1.0.1 (manifest, package.json, versions.json, Dev file).
- **Build and deploy:** built (`main.js` 12.3 KB), copied to `~/VaultSchar/.obsidian/plugins/header-floater/`, and reloaded through the CLI.
- **Live verification:**
  - Both commands are registered, and body classes are on by default.
  - **Why a substitute test:** the Obsidian window wasn't in front, so Chromium wouldn't match `:focus-within`/`:hover` from script, and a scripted cursor move no longer opened the cell editor. The plugin's live CSS rules were copied into a temporary stylesheet with those pseudo-classes swapped for test classes, then removed.
  - **Live Preview:** active row = accent tint layer, hover row = hover layer, both = two layers, other rows `none`.
  - **Reading view:** hover tints the row, and the active rule doesn't apply there.
  - **Settings and colours:** turning both settings off clears the tints, and a custom `#ffe08a` applies, then resets.
  - **Commands:** they flip the classes and the saved setting.
  - **Settings tab:** renders 4 settings plus the heading, with the reset buttons hidden at theme default.
  - **Unload:** disable leaves no `hf-` classes, variables or pins. Re-enabled afterwards.
  - **Data and errors:** `data.json` was restored to defaults, and no new errors were logged.
  - **Workspace:** the test tab was closed, focus returned to the user's note, and no notes were changed.

### Issue / Fix summary
| # | Issue | Fix |
|---|-------|-----|
| 1 | Feature: tint the table row holding the cursor | CSS `tr:focus-within` on Live Preview table widgets, active when body has `hf-active-row`; accent tint layered over cell background |
| 2 | Feature: tint the table row under the mouse, different colour | CSS `tr:hover` on all rendered tables under `@media (hover: hover)`, active when body has `hf-mouse-row`; theme hover shade; both layers stack when a row is hovered and active |
| 3 | Feature: settings page with toggles and background colours | `HeaderFloaterSettingTab` with toggle, colour picker and reset per highlight; settings validated by `loadSettings`, applied as body classes and inline CSS variables |
| 4 | Feature: commands to toggle each highlight | `Toggle Active Row Highlight` and `Toggle Mouse Row Highlight` commands, with notice and saved setting |
| 5 | Colour picker fires on every drag step; redrawing the tab or writing to disk each step would break the drag and thrash `data.json` | Description and reset button update in place; save debounced 500ms and flushed on unload |
| 6 | Popout windows have their own body and wouldn't get the classes | Track main and popout bodies via `window-open`/`window-close` and apply to each |
| 7 | Couldn't trigger real hover/focus from script with the window in the background | Confirmed focus DOM with a real cell editor earlier; verified the exact live rules with pseudo-classes swapped for test classes in both views |

### Final summary delivered to user (verbatim)
Header Floater 1.0.1 is built, pushed, and deployed to VaultSchar, where it's reloaded and running.

**What's new**
- **Settings page** (Settings → Header Floater), with two groups:
  - **Active row highlight:** a toggle and a colour picker.
  - **Mouse row highlight:** a toggle and a colour picker.
  - With no colour picked, each highlight follows your theme: a light accent tint for the active row, and the theme's hover shade for the mouse row. Once you pick a colour, a reset button appears to return to the theme colour.
- **Commands:** `Toggle Active Row Highlight` and `Toggle Mouse Row Highlight`. Each shows a brief on/off notice and saves the setting.
- **Both highlights are CSS only.** The plugin just switches a class on the page, so nothing runs as you move the mouse or cursor. The tint sits on top of your theme's row striping, and the header row is never tinted. Popout windows get the highlights too.

**Choices I made on the questions you skipped**
- **Active row:** Live Preview only, and it clears when you click out of the table. That's how Obsidian's own active-row handle behaves.
- **Mouse row:** applies to every table, including callouts and embeds, but only on devices with a mouse or trackpad.
- **Source mode:** not included.
- **Colours:** a picked colour is used exactly as chosen, with no transparency, so choose a light one. If you'd like an opacity slider as well, it's a small addition.

**Verified in your running Obsidian**
- **The active row is detected:** placing the cursor in a Live Preview cell marks its row as the active one.
- **Highlights in both views:** hover, active, both at once, a custom colour, each toggle off, and header rows untouched. Obsidian's window wasn't in front, so the browser wouldn't register real mouse hover or cursor focus. I tested the plugin's exact rules with hover and focus swapped for a test marker.
- **Settings and commands:** the settings page shows all four options. Both commands exist and toggle their highlight.
- **Clean up:** disabling the plugin removes every class and style it added, and no new errors were logged.
- **Tests and tabs:** 12 unit tests pass. I used a temporary tab, then closed it and returned focus to your Econ inventory note; no notes were changed.

**Worth trying yourself:** hover a row and click into a cell, since those are the two things I couldn't trigger for real.

Logged in `header-floater-log.md`, and the Dev file version is now 1.0.1.

## 2026-09-17 — Acknowledgement

### Prompt
> awesome

### Claude output
- No changes. The late background notification (the stalled cell-focus probe) was confirmed harmless in the previous reply.

### Final summary delivered to user (verbatim)
Glad it's working. Happy highlighting!

## 2026-09-17 — Plan: floating headers for Dataview tables (plan only, nothing built)

### Prompt
> tables like the ones on this page don't benefit from the the header-floater plugin you built. is there a way to get these table headers to float? Plan only, build nothing now
> /Users/josh/VaultSchar/Classes/2026-B/Econ - PUBP 720/Econ - PUBP 720 Progress.md

### Claude output
- Read the note, `Views/inventory-progress.js`, `Views/_viewcache.js`, the plugin source (`src/main.ts`, `src/table-watcher.ts`, `src/fit-tracker.ts`, `styles.css`) and Dataview's `styles.css`. No code or notes were changed; no version bump, no commit.
- Plan and diagnosis are in the final summary below.

### Final summary delivered to user (verbatim)
Yes, it can be done. It needs the plugin to find tables by what they are, not by where they sit on the page.

**Why these tables don't float**
Everything below the two small legend tables on that page is drawn by `dv.view('Views/inventory-progress')`. The plugin misses those tables for three reasons:
1. **It never finds them.** In Reading view, the plugin only picks up a page block that holds a bare table and nothing else. A Dataview block holds a script container, and the tables are added later, after the script finishes. In Live Preview, the plugin only watches table widgets, and a Dataview block is a different kind of widget.
2. **The CSS rules don't match them.** Every sticky rule is written for a fixed spot: `sizer > div.hf-pin > table` in Reading view, or `.cm-table-widget > .table-wrapper > table` in Live Preview. Dataview tables sit a few levels deeper, inside `div.block-language-dataviewjs`.
3. **A wrapper may cut them off.** A sticky header only floats if nothing between the table and the pane's scroll area clips or scrolls. Code-block widgets and Dataview's own CSS may do that. For example, Dataview gives `.block-language-dataview` `overflow-y: auto`. I haven't checked the `dataviewjs` wrappers yet; the first step does that.

**Plan**
0. **Quick test (about 10 minutes, no code).** Open that page in DevTools and set `position: sticky; top: 0` on one Dataview `th`. Walk up from the table and note every parent whose `overflow` isn't `visible`, in both views. This tells us whether step 3 is needed at all.
1. **Mark tables with a class.** When the tracker approves a table, it adds `hf-table` to it. The sticky, background and alt-column rules then target `table.hf-table > thead > tr > th` wherever the table sits. The existing Markdown tables get the same class, so both cases share one set of rules.
2. **Find tables inside rendered blocks.**
   - **Reading view:** the Markdown post-processor also accepts page blocks that contain a code-block container. It attaches one `MutationObserver` (child and subtree changes) to each such block, and the observer tracks `table`s as they appear or disappear.
   - **Live Preview:** `tableWatcher` also picks up `.cm-preview-code-block` / `.cm-embed-block` widgets and gives them the same kind of observer.
   - **Cost:** the observers only fire when a block re-renders. Nothing runs on scroll. This also covers `_viewcache`'s approach of building a view off-page and then swapping it in: removed tables stop being tracked, and new ones start.
3. **Remove clipping only when it's safe.** For each tracked table, the tracker walks up to the pane's scroll area and collects any parent that clips or scrolls. If the table fits its width, those parents get `hf-pin` (so `overflow: visible`). If it's too wide, nothing changes: it keeps scrolling sideways and its header doesn't float, same as today. This reuses the existing fit check and the one `ResizeObserver`.
4. **Offsets.** Same scroll areas, so the existing `--hf-rv-offset` / `--hf-lp-offset` values work unchanged.
5. **Limits.**
   - Only tables in the main note count; embeds, canvas cards and hover previews stay excluded, as now.
   - Tables inside callouts or `%% col-break %%` column layouts are out of scope for now. Their clipping is on purpose.
   - A Dataview header will float only while its own table is on screen, then scroll away with it. That's the right behaviour for a page with several small tables.
6. **Setting.** Add a toggle, "Float headers in rendered blocks (Dataview, etc.)", on by default.
7. **Tests.** Add unit tests for the parent-clipping walk and for tracking tables that are added and removed. Then check it in the running app, in both views, on the Econ Progress page, including a re-render after editing an item note.

**Simpler option:** if step 0 shows no clipping parents, a CSS snippet of about 10 lines targeting `.block-language-dataviewjs table.table-view-table > thead th` would float these headers today. It would have no width check, so a wide Dataview table could break. That's fine as a stopgap, but the plugin route is more reliable.

Plan logged in `header-floater-log.md`; nothing built, no version bump.

## 2026-09-17 13:45 — v1.0.2: floating headers for Dataview tables

### Prompt
> build it

### Claude output
- **Step 0 (DOM check), both views:** the only clipping element around a Dataview table is the code block's root `div.block-language-dataviewjs`, which carries an inline `overflow-x: auto`. Each Dataview table sits alone in its own wrapper div. The Live Preview widget (`.cm-preview-code-block`) has `contain: paint`, which doesn't block pinning.
- **`src/block-hosts.ts` (new):** `BlockHosts` watches each code-block host (the Reading view `el-pre` section or the Live Preview `.cm-preview-code-block` widget). It watches direct children only, finds the `.block-language-*` root when it appears or is replaced, and hands it to the tracker as a "block" box while the setting is on.
- **`src/fit-tracker.ts`:** boxes are now `"table"` (Markdown, unchanged behaviour) or `"block"` (any number of tables, plus a MutationObserver for redraws). Fitting tables get `hf-table`, the box gets `hf-pin`, and a wide table inside a pinned block gets `hf-scroll` on its own wrapper so it scrolls sideways alone. Measurements happen in the ResizeObserver callback, while elements are laid out. Class writes happen on the next frame of the box's own window, which avoids the browser's "ResizeObserver loop" warning, and a stale plan is dropped. Disconnected boxes are skipped rather than untracked, because Reading view detaches and reattaches sections.
- **`src/core/fit.ts`:** `planBlock()` decides pin and per-table fit for a block. There are 4 new unit tests, plus the settings tests updated for the new field (16 tests pass).
- **`src/table-watcher.ts`, `src/main.ts`:** Live Preview code-block widgets and Reading view `el-pre` sections are handed to `BlockHosts`. `instanceof` checks became tag and nodeType checks, because popout windows have their own constructors.
- **`styles.css`:** the sticky rules now target `.hf-pin table.hf-table` instead of fixed layout paths, `.hf-scroll` gets `overflow-x: auto`, and pinned Live Preview code-block widgets override Obsidian's `.cm-embed-block:not(.cm-table-widget):hover { overflow: hidden }`.
- **Setting:** "Tables in rendered blocks" (on by default) under a new "Floating headers" heading.
- **Version:** 1.0.2 (manifest, package.json, versions.json, Dev file). README updated. Built, deployed to VaultSchar, reloaded.
- **Verified in running Obsidian:**
  - Dataview headers float in Reading view and Live Preview, including with `:hover` forced on the widget through the DevTools Protocol.
  - A narrow popout made the Summary table too wide: it scrolled on its own while the other tables pinned.
  - Pinning survives `dataview:refresh-views`, and the setting toggles classes off and back on.
  - Markdown legend tables still pin in both views.
  - No errors or warnings from the plugin. The only errors came from advanced-canvas reacting to popouts.
- **Note:** my first mode-switch probe ran on whichever tab was active after the user switched tabs, so it briefly flipped the note `pubp720-cpicvnomyrs` between views; it ended in Live Preview. All later tests used a popout or a temporary tab that was closed with focus restored.
- **Known limit:** in a popout window, if the main window is fully covered, resize notifications can be delayed. That was already true in 1.0.1.

| # | Issue | Fix |
|---|---|---|
| 1 | Dataview tables never tracked (post-processor and watcher only handled bare Markdown tables) | `BlockHosts` finds `.block-language-*` roots in Reading view sections and Live Preview code-block widgets |
| 2 | Sticky CSS tied to fixed Markdown table paths | Rules target `hf-pin` / `hf-table` classes set by the tracker |
| 3 | Code block root has inline `overflow-x: auto`, blocking sticky | Pinned block gets `overflow: visible !important` |
| 4 | One wide table in a block would block pinning for all its tables | `planBlock`: wide tables with their own wrapper scroll sideways via `hf-scroll`; the rest pin |
| 5 | Hovering a Live Preview code block sets `overflow: hidden` (Obsidian app.css), killing the float | Override on `.cm-preview-code-block:has(> .hf-pin)` |
| 6 | Class writes inside ResizeObserver callback caused "ResizeObserver loop" warning | Measure in callback, apply classes next frame on the box's own window |
| 7 | `instanceof` checks fail for popout-window elements | Tag name / nodeType checks |
| 8 | Dataview redraws replace tables without resizing the block | MutationObserver per block box re-checks on child-list changes |

### Final summary delivered to user (verbatim)
Header Floater 1.0.2 is deployed and reloaded in VaultSchar. On your Econ PUBP 720 Progress page, the Dataview table headers now stay at the top of the pane as you scroll, in both Reading view and Live Preview. The new code is pushed to GitHub.

**What changed**
- **Dataview tables are found.** The plugin now watches code blocks as well as plain Markdown tables. It picks up the tables a `dataviewjs` block draws and starts tracking them again whenever Dataview redraws them.
- **One wide table no longer blocks the rest.** Every table that fits gets a floating header. A table too wide for the pane scrolls sideways on its own. I checked this in a narrow window, where the 12-column Summary table was too wide.
- **Setting:** a new toggle, "Tables in rendered blocks", under Settings → Header Floater. It's on by default.

**Two problems found and fixed while testing**
- **Hovering broke it in Live Preview.** Obsidian's own CSS sets a code block to `overflow: hidden` while the mouse is over it, which stopped the header floating exactly when you'd be reading the table. The plugin now overrides that for blocks whose headers float. The hover shadow still shows.
- **A new console warning** ("ResizeObserver loop") came from the first version of this change. It's gone now.

**Verified in your running Obsidian**
- Headers float in both views, including with hover forced on in Live Preview.
- Floating still works after a Dataview refresh, and the setting turns it off and back on cleanly.
- The two legend tables at the bottom still float, and the plugin logged no errors.

**One thing to know:** while you switched tabs during my first test, my view-mode toggles landed on your note `pubp720-cpicvnomyrs`. It ended in Live Preview, and its content wasn't changed. After that I tested only in popouts and temporary tabs, and focus went back to your tab each time.

Logged in `header-floater-log.md`, and the Dev file version is now 1.0.2.
