# DeepSeek Enhancer

一个面向 DeepSeek 网页版的浏览器扩展，提供文件夹管理能力。

[English](docs/README.en.md)

## 功能

- 文件夹管理：支持文件夹与子文件夹，保存 DeepSeek 会话引用。
- 双 UI 入口：支持扩展 popup / side panel，也支持嵌入 DeepSeek 侧边栏。
- 数据备份：文件夹数据写入和导入前自动创建备份，也支持手动备份。
- 导入导出：文件夹数据可导出为 JSON，并支持合并或覆盖导入。
- 日志输出：关键生命周期、页面识别、文件夹读写和降级路径都会输出日志，方便排查问题。

## 当前状态

第一阶段已实现：

1. 文件夹管理

后续计划：

1. 聊天记录导出
2. 公式、代码块、表格等特殊内容智能复制
3. 长文本辅助，包括长文本转文件、文本文件附加到提示词、长指令折叠

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

备份格式使用：

```text
deepseek-enhancer.folders.v1
```

## 致谢

本项目是面向 DeepSeek 的重新实现，没有复制以下项目源码，但功能设计和问题分析受到它们启发：

- Gemini Voyager: https://github.com/Nagi-ovo/gemini-voyager
- deepseek-voyager: https://github.com/Azurboy/deepseek-voyager

即使后续实现与参考项目差异继续扩大，本项目也会保留这份致谢。

## License

MIT
