# 扩展入口与 core 索引

返回[文件索引入口](../file-index.md)。

## 扩展入口

| 文件                                      | 定位与用途                                                                               | 不该出现的内容                                         |
| ----------------------------------------- | ---------------------------------------------------------------------------------------- | ------------------------------------------------------ |
| `entrypoints/background.ts`               | 初始化 background 日志，并注册诊断日志与文件夹消息处理器。                               | UI、DeepSeek DOM 选择器、多个 `FolderService` 写实例。 |
| `entrypoints/content.tsx`                 | DeepSeek content script 组合根：创建 adapter，挂载文件夹、导出、公式功能并监听页面变化。 | 具体选择器、文件夹存储实现、功能内部算法。             |
| `entrypoints/popup/index.html`            | popup 的最小 HTML 容器与模块入口。                                                       | 业务 DOM、内联脚本、持久化数据。                       |
| `entrypoints/popup/main.tsx`              | 初始化诊断日志并把 `FolderPanel` 挂到 popup root。                                       | 文件夹业务逻辑、DeepSeek 页面访问、独立数据层。        |
| `entrypoints/sidepanel/index.html`        | side panel 的最小 HTML 容器与模块入口。                                                  | 业务 DOM、内联脚本、持久化数据。                       |
| `entrypoints/sidepanel/main.tsx`          | 初始化诊断日志并把共享 `FolderPanel` 挂到 side panel root。                              | popup 的重复实现、文件夹写逻辑、DeepSeek 选择器。      |
| `entrypoints/formula-renderer/index.html` | 隔离 MathJax renderer 的最小扩展页面容器。                                               | 可见 UI、content script 逻辑、外部脚本。               |
| `entrypoints/formula-renderer/main.ts`    | 校验父页面渲染请求，调用图像 renderer，并通过 `MessagePort` 返回 Blob。                  | 未校验消息处理、公式交互 UI、DeepSeek DOM 查询。       |

## 通用 core

| 文件                                | 定位与用途                                                               | 不该出现的内容                                          |
| ----------------------------------- | ------------------------------------------------------------------------ | ------------------------------------------------------- |
| `src/core/storage.ts`               | 对 `chrome.storage.local/sync` 的统一 get/set/remove/change 封装与日志。 | feature 专属 key、业务 schema、绕过错误传播的静默失败。 |
| `src/core/settings.ts`              | `dse.settings` schema、默认值、兼容归一化和 sync 读写。                  | 文件夹主数据、DeepSeek 选择器、组件状态。               |
| `src/core/settings.test.ts`         | 验证设置默认值、旧字段兼容和按钮位置校验。                               | 生产实现、真实 storage 依赖、无关 feature 测试。        |
| `src/core/logger.ts`                | 统一结构化 logger、上下文清洗和可选诊断日志转发。                        | 未清洗的聊天正文、标题、完整 URL、feature 业务决策。    |
| `src/core/logger.test.ts`           | 验证日志开关、结构化记录和敏感上下文清洗。                               | 生产实现、真实 runtime 消息、其他服务行为测试。         |
| `src/core/diagnosticLogProtocol.ts` | 诊断日志消息类型、记录类型与导出格式常量。                               | storage I/O、UI、消息监听器实现。                       |
| `src/core/diagnosticLogs.ts`        | background 诊断日志队列、local 存储、客户端、消息处理与 JSON 下载。      | 普通业务日志调用、聊天内容、无上限日志保留。            |
| `src/core/diagnosticLogs.test.ts`   | 验证日志上限、静默存储、版本化导出和清理。                               | 生产实现、真实用户日志、文件夹服务测试。                |
| `src/core/diagnosticLogging.ts`     | 各运行上下文一次性读取并监听诊断日志开关。                               | 日志存储实现、UI、重复注册业务监听器。                  |
| `src/core/events.ts`                | 通用 `DisposableStack` 与 debounce 工具。                                | feature 状态、DOM 选择器、持久化逻辑。                  |
| `src/core/dom.ts`                   | 通用元素创建/移除与文本归一化工具。                                      | DeepSeek 专属选择器、React 组件、业务解析规则。         |

## 共享表现与声明

| 文件                     | 定位与用途                                                   | 不该出现的内容                                                     |
| ------------------------ | ------------------------------------------------------------ | ------------------------------------------------------------------ |
| `src/styles.css`         | Tailwind 导入和扩展自有 popup、嵌入 UI、导出、公式交互样式。 | DeepSeek hash class 依赖、业务状态机、第三方页面的全局破坏性覆盖。 |
| `src/types/mathjax.d.ts` | 为项目实际使用的 MathJax ESM 路径提供最小模块声明。          | 运行时代码、未使用包声明、伪造完整 MathJax API 类型。              |
