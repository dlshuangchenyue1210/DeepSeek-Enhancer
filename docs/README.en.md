# DeepSeek Enhancer

A browser extension for DeepSeek Chat, focused on folder management, chat export, and formula copying.

[中文](../README.md)

## Features

- Folder management: organize DeepSeek conversations with folders and subfolders.
- Chat export: export the current conversation as Markdown, with options for all messages, user prompts only, or AI replies only; the export button can be dragged to a custom position.
- Formula copy: hover-highlight formulas in AI replies, configure the left-click default action, and use the formula context menu to copy TeX / MathML / SVG / PNG / JPG or download SVG / PNG / JPG.
- Dual UI entry points: extension popup / side panel and an embedded DeepSeek sidebar view.
- Data backups: automatic backups before folder writes and imports, plus manual backups.
- Import and export: export folder data to JSON, then merge or overwrite on import.
- Diagnostic logging: lifecycle, page detection, folder writes, backups, and fallback paths are logged.

## Current Status

Implemented in the first phase:

1. Folder management
2. Chat export
3. Formula copy

Planned next:

1. Smart copy for code blocks, tables, and similar content
2. Long-text assistance, including text-to-file, text-file prompt attachment, and long prompt collapsing

## Install Development Build

```bash
bun install
bun run build:chrome
```

Then load it in Chromium / Edge:

1. Open `chrome://extensions`
2. Enable Developer mode
3. Click "Load unpacked"
4. Select `.output/chrome-mv3`

## Development

```bash
bun run dev:chrome
bun run typecheck
bun run test
bun run build:chrome
```

## Stack

- WXT
- React
- TypeScript
- Tailwind CSS
- Vitest
- Bun

## Data Safety

Folder data is stored in `chrome.storage.local` and is not stored through DeepSeek DOM state. If DeepSeek changes its page structure, the embedded UI or page recognition may fail, but folder data should not be deleted.

Backup format:

```text
deepseek-enhancer.folders.v1
```

## Acknowledgements

This project is a reimplementation for DeepSeek and does not copy source code from the projects below, but their feature ideas and maintenance lessons informed this work:

- Gemini Voyager: https://github.com/Nagi-ovo/gemini-voyager
- deepseek-voyager: https://github.com/Azurboy/deepseek-voyager

This acknowledgement will remain even if the implementation diverges substantially over time.

## License

GPL-3.0. See [LICENSE](../LICENSE).
