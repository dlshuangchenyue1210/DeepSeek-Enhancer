# DeepSeek Enhancer

一个面向 DeepSeek 网页版的浏览器扩展，提供文件夹管理、聊天记录导出和公式复制能力。

[![License: GPL-3.0](https://img.shields.io/badge/License-GPL--3.0-blue.svg)](LICENSE)
[![Built with WXT](https://img.shields.io/badge/Built%20with-WXT-5b7cff.svg)](https://wxt.dev/)
[![Chrome MV3](https://img.shields.io/badge/Chrome%20%2F%20Edge-MV3-34a853.svg)](https://developer.chrome.com/docs/extensions/develop/migrate/what-is-mv3)

> 让 DeepSeek 网页版多一层本地增强能力：整理会话、导出聊天记录、复制公式，并尽量不干扰 DeepSeek 原页面。

[English](docs/README.en.md) · [更新日志](CHANGELOG.md) · [发布版本](https://github.com/dlshuangchenyue1210/DeepSeek-Enhancer/releases)

## 功能

| 功能 | 说明 |
| --- | --- |
| 文件夹管理 | 支持文件夹与子文件夹，保存 DeepSeek 会话引用。 |
| 聊天记录导出 | 支持将当前对话导出为 Markdown，可选择全部消息、仅用户提问或仅 AI 回复，导出按钮可拖动调整位置。 |
| 公式复制 | AI 回复中的公式支持悬浮高亮、左键默认操作和右键菜单，可复制 TeX / MathML / SVG / PNG / JPG，或下载 SVG / PNG / JPG。 |
| 双 UI 入口 | 支持扩展 popup / side panel，也支持嵌入 DeepSeek 侧边栏。 |
| 数据备份 | 文件夹数据写入和导入前自动创建备份，也支持手动备份。 |
| 导入导出 | 文件夹数据可导出为 JSON，并支持合并或覆盖导入。 |
| 日志输出 | 关键生命周期、页面识别、文件夹读写和降级路径都会输出日志，方便排查问题。 |

## 当前状态

### 已实现

- 文件夹管理
- 聊天记录导出
- 公式复制

### 计划中

- 代码块、表格等特殊内容智能复制
- 长文本辅助，包括长文本转文件、文本文件附加到提示词、长指令折叠

## 安装开发版

```bash
bun install
bun run build:chrome
```

然后在 Chromium / Edge 中加载：

1. 打开 `chrome://extensions`
2. 开启开发者模式
3. 点击“加载已解压的扩展程序”
4. 选择 `.output/chrome-mv3`

## 开发

```bash
bun run dev:chrome
```

常用检查命令：

```bash
bun run typecheck
bun run test
bun run build:chrome
```

## 技术栈

- WXT
- React
- TypeScript
- Tailwind CSS
- Vitest
- Bun

## 数据说明

文件夹数据存储在 `chrome.storage.local`，不会依赖 DeepSeek 页面 DOM 保存。DeepSeek 页面更新时，最多会影响页面嵌入 UI 或页面识别能力，不应导致文件夹数据丢失。

文件夹写入由 background 串行处理。读取到损坏或不兼容的主数据时会拒绝覆盖；恢复有效备份前，原始异常数据会保留到 `dse.folderRecovery.v1`。

更多存储 key、备份策略和数据丢失风险见 [文件夹存储参考](docs/folder-storage-reference.md)。

备份格式使用：

```text
deepseek-enhancer.folders.v1
```

## 致谢

本项目是面向 DeepSeek 的重新实现，由 AI 主力开发（Codex-GPT）。开发过程要求禁止复制以下项目源码，但功能设计和问题分析受到它们启发。为减少授权边界的不确定性，本项目使用 GPL-3.0。

- Gemini Voyager: https://github.com/Nagi-ovo/gemini-voyager
- deepseek-voyager: https://github.com/Azurboy/deepseek-voyager

即使后续实现与参考项目差异继续扩大，本项目也会保留这份致谢。

## License

GPL-3.0。详见 [LICENSE](LICENSE)。
