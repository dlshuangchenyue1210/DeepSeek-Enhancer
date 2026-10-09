# 文件索引

本索引帮助 Agent 在修改前找到正确文件，并守住模块边界。每个条目只回答三件事：文件在哪里、负责什么、里面不该出现什么。

## 使用方式

1. 先按目录进入下面的分册。
2. 修改前阅读目标文件及其调用链，索引不能替代源码。
3. 新增、移动、删除文件或改变职责时，同步更新对应分册。

## 索引范围

索引覆盖 Git 跟踪的项目文件和索引文件本身，不逐项记录 `.git/`、`node_modules/`、`.wxt/`、`.output/`、`dist/`、`coverage/` 与 `*.log` 等外部依赖、缓存、构建产物和本地日志。

## 分册

| 分册                                                        | 覆盖范围                                                |
| ----------------------------------------------------------- | ------------------------------------------------------- |
| [根目录、文档与 Agent 配置](file-index/root-and-docs.md)    | 根配置、说明文档、发布规则、仓库内 skill                |
| [扩展入口与 core](file-index/entrypoints-and-core.md)       | WXT 入口、通用存储、设置、日志、DOM 与样式              |
| [DeepSeek 页面适配](file-index/deepseek-platform.md)        | `src/platform/deepseek/` 下全部 DOM、路由和页面解析代码 |
| [文件夹功能](file-index/folders.md)                         | 文件夹 UI、background 服务、仓库、备份、导入导出与测试  |
| [聊天导出与公式复制](file-index/chat-export-and-formula.md) | `chatExport`、`formulaCopy` 及其测试                    |

## 通用边界

- 索引描述职责，不保存实现副本、代码片段、工作日志、临时调查结论或待办清单。
- `src/platform/deepseek/` 之外不得出现 DeepSeek 页面选择器或页面 DOM 解析。
- UI 不得直接写文件夹数据；写入必须经过 background `FolderService`。
- 测试文件不得承载生产实现，观察文档不得被当作永远稳定的页面契约。
- 此索引不覆盖 `AGENTS.md`、`docs/RELEASE.md` 或源码中的约束；冲突时以这些权威来源为准。
