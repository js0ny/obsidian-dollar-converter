# Math Dollar Converter

An Obsidian plugin that converts $\LaTeX$ bracket delimiters to Obsidian's dollar-delimited maths syntax.

| Formula | Before | After |
| --- | --- | --- |
| Inline | `\(x + y\)` | `$x + y$` |
| Display | `\[x + y\]` | `$$x + y$$` |

Convert automatically when pasting, or convert a selection or the current note on demand.

## Usage

### Convert on paste

Paste text into a Markdown editor. Conversion is enabled by default and uses the plain-text clipboard content.

The pasted text is checked in the context of the note after replacing the current selection. For example, bracket formulae pasted inside a code block are left unchanged.

### Convert existing text

Open the command palette and run either command:

- **Math Dollar Converter: Convert bracket maths in selection**
- **Math Dollar Converter: Convert bracket maths in current note**

You can also select text, open the editor context menu, and select **Convert bracket maths in selection**. A formula must be entirely inside the selection to be converted.

Conversion requires a single selection or cursor. Automatic conversion is skipped when multiple selections are active.

## Settings

Open **Settings → Math Dollar Converter**.

| Setting | Default | Behaviour |
| --- | --- | --- |
| **Convert on paste** | On | Convert bracket formulae from plain-text clipboard content. |
| **Commands after conversion** | Empty | Run the listed Obsidian command IDs after conversion, one full ID per line.  |
| **Command selection** | Include dollar delimiters | Select either the complete dollar-delimited formula or its body before running each command.  |

- Body-only selection removes only the delimiters.

## Installation from source

```sh
npm ci
npm run package
```

The commands above produce:

```text
target/
├── manifest.json
└── main.js
```

1. Create `<Vault>/.obsidian/plugins/math-dollar-converter/`.
2. Copy both files from `target/` into that folder.
3. Reload Obsidian.
4. Enable **Math Dollar Converter** under **Settings → Community plugins**.

## Development

```sh
npm run dev      # Watch source files and rebuild main.js
npm run build    # Type-check and create a production main.js
npm run lint     # Run ESLint
npm run package  # Build and copy main.js and manifest.json into target/
```

## Privacy

The converter works locally and makes no network requests or telemetry submissions. 

## Licence

SPDX: [0-BSD](https://spdx.org/licenses/0BSD.html).
