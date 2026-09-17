# Header Floater

An Obsidian plugin that pins a table's header row to the top of the pane while you scroll through a long table, in **Reading view** and **Live Preview**.

## How it works

Pinning is done by CSS (`position: sticky`), so **nothing runs while you scroll**.

Obsidian makes each table's box scroll sideways (a stylesheet rule in Live Preview, an inline style in Reading view), and a sideways-scrolling box blocks sticky positioning. The plugin uses one shared `ResizeObserver` to mark tables that fit their width, and CSS drops the sideways scrolling for just those tables. A table is re-checked only when it or its box changes size.

- **Tables that fit the pane** pin their header.
- **Wide tables** keep their normal sideways scrolling and don't pin.
- **Source mode** is untouched, since tables there are plain Markdown text.
- **Only top-level tables pin.** Tables inside callouts, embeds, or canvas cards are left alone.

The pinned header gets your theme's background colour, so it works in both light and dark mode.

## Performance compared with other sticky-header plugins

| Concern | Header Floater |
|---|---|
| Work on scroll | None |
| Listener growth over a session | None. Tables are tracked per rendered section or editor and released when it goes away |
| Layout reads | Only when a table or its box changes size, and only for that table |
| Editor typing | Not observed. Only top-level CodeMirror blocks being added or removed are watched |
| Unload | Disconnects every observer and removes all classes and CSS variables |

## Customising

Override these variables in a CSS snippet:

```css
body {
	--hf-header-background: var(--background-primary); /* colour behind a pinned header */
	--hf-z-index: 3;
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
