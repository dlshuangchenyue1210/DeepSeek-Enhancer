# DeepSeek Enhancer

A browser extension for DeepSeek Chat, focused on folder management.

[中文](../README.md)

## Features

- Folder management: organize DeepSeek conversations with folders and subfolders.
- Dual UI entry points: extension popup / side panel and an embedded DeepSeek sidebar view.
- Data backups: automatic backups before folder writes and imports, plus manual backups.
- Import and export: export folder data to JSON, then merge or overwrite on import.
- Diagnostic logging: lifecycle, page detection, folder writes, backups, and fallback paths are logged.

## Current Status

Implemented in the first phase:

1. Folder management

Planned next:

1. Chat export
2. Smart copy for formulas, code blocks, tables, and similar content
3. Long-text assistance, including text-to-file, text-file prompt attachment, and long prompt collapsing

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

MIT
