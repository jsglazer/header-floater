# Header Floater

An Obsidian plugin that pins a table's header row to the top of the pane while you scroll through a long table, in **Reading view** and **Live Preview**.

## How it works

Pinning is done by CSS (`position: sticky`), so **nothing runs while you scroll**.

Obsidian makes each table's box scroll sideways (a stylesheet rule in Live Preview, an inline style in Reading view), and a sideways-scrolling box blocks sticky positioning. The plugin uses one shared `ResizeObserver` to mark tables that fit their width, and CSS drops the sideways scrolling for just those tables. A table is re-checked only when it or its box changes size.

- **Tables that fit the pane** pin their header.
- **Wide tables** keep their normal sideways scrolling and don't pin.
- **Source mode** is untouched, since tables there are plain Markdown text.
- **Tables drawn by code blocks pin too**, such as the tables a `dataview` or `dataviewjs` block renders. A block can hold several tables: those that fit pin their headers, and a wide one scrolls sideways in its own row instead of blocking the rest. Turn this off under **Settings → Header Floater → Tables in rendered blocks**.
- **Only top-level tables and code blocks pin.** Tables inside callouts, embeds, or canvas cards are left alone.

The pinned header gets your theme's background colour, so it works in both light and dark mode.

## Row highlights

- **Active row highlight:** in Live Preview, tints the table row that holds the cursor while you edit a cell. It clears when the editor loses focus, just as Obsidian's own row handle does.
- **Mouse row highlight:** tints the table row under the mouse pointer, in Reading view and Live Preview. It's only active on devices with a mouse or trackpad, so a tap on a touch screen doesn't leave a row tinted.

Both are CSS only: the plugin switches a class on `body`, and no code runs as you move the mouse or cursor. Each tint is laid over the cell's own background, so theme striping still shows, and the header row is never tinted.

**Settings** (Settings → Header Floater): a toggle and a colour picker for each highlight. Without a custom colour, the active row uses a light tint of your accent colour and the mouse row uses your theme's hover shade. The reset button returns to that default.

**Commands:** `Toggle Active Row Highlight` and `Toggle Mouse Row Highlight`, which you can bind to hotkeys.

## Performance compared with other sticky-header plugins

| Concern | Header Floater |
|---|---|
| Work on scroll | None |
| Listener growth over a session | None. Tables are tracked per rendered section or editor and released when it goes away |
| Layout reads | Only when a table or its box changes size, or a rendered code block redraws, and only for that box |
| Editor typing | Not observed. Only top-level CodeMirror blocks being added or removed, and the contents of rendered code blocks, are watched |
| Unload | Disconnects every observer and removes all classes and CSS variables |

## Customising

Override these variables in a CSS snippet. A custom colour picked in settings takes precedence over a snippet.

```css
body {
	--hf-header-background: var(--background-primary); /* colour behind a pinned header */
	--hf-z-index: 3;
	--hf-active-row-background: color-mix(in srgb, var(--interactive-accent) 15%, transparent);
	--hf-mouse-row-background: var(--background-modifier-hover);
}
```

## Installation

Copy `main.js`, `manifest.json` and `styles.css` into `<vault>/.obsidian/plugins/header-floater/`, then enable **Header Floater** under Settings → Community plugins.

## Development

```bash
npm install
npm test        # unit tests for the fit logic
npm run build   # type-check and bundle to main.js
```

Requires Obsidian 1.5.12 or later.

## License

MIT
