# 文件夹功能索引

返回[文件索引入口](../file-index.md)。所有写入必须沿 `UI -> FolderServiceClient -> background FolderService -> FolderRepository -> chrome.storage.local` 进行。

## 数据与服务

| 文件                                                     | 定位与用途                                                                   | 不该出现的内容                                                      |
| -------------------------------------------------------- | ---------------------------------------------------------------------------- | ------------------------------------------------------------------- |
| `src/features/folders/types.ts`                          | 文件夹、会话项、主数据、备份及其摘要、恢复快照和导入导出 payload 类型。              | I/O、UI、校验实现、DeepSeek DOM 类型。                              |
| `src/features/folders/folderValidation.ts`               | 创建空数据，并校验 schema、两层深度、循环、唯一性和 DeepSeek URL。           | 自动修复损坏数据、storage I/O、UI 提示。                            |
| `src/features/folders/folderValidation.test.ts`          | 验证合法两层树及重复、畸形、循环、非法 URL 的拒绝。                          | 生产实现、真实 storage、UI 测试。                                   |
| `src/features/folders/FolderRepository.ts`               | 定义文件夹 storage keys，校验 local 读写，并保留恢复前异常主数据。           | 业务 mutation、UI、把无效主数据当空数据覆盖。                       |
| `src/features/folders/FolderRepository.test.ts`          | 验证缺失数据初始化、损坏数据拒绝和 recovery 快照保留。                       | 生产实现、真实浏览器存储、服务业务测试。                            |
| `src/features/folders/FolderBackupService.ts`            | 创建、分类裁剪、列出备份摘要和恢复备份，并处理 quota 降级。                          | UI、导入解析、跳过恢复前数据保护。                                  |
| `src/features/folders/FolderImportExportService.ts`      | 创建、严格解析并下载版本化 `deepseek-enhancer.folders.v1` JSON。             | storage 写入、合并策略、无版本格式。                                |
| `src/features/folders/FolderImportExportService.test.ts` | 验证当前导出格式 round-trip 及版本、时间戳拒绝。                             | 生产实现、文件下载 UI、真实 storage。                               |
| `src/features/folders/FolderService.ts`                  | background 唯一业务服务：串行 mutation、写前备份、导入、恢复和 ID 冲突处理。 | React UI、DeepSeek DOM、绕过 repository 的 storage 调用、无限层级。 |
| `src/features/folders/FolderService.test.ts`             | 验证失败关闭、并发串行、批量写、导入冲突、恢复保护和 no-op。                 | 生产实现、真实 runtime/UI、依赖执行顺序的共享状态。                 |
| `src/features/folders/FolderMessages.ts`                 | 定义 UI/background 命令协议、客户端和 background 路由处理器。                | 文件夹 mutation 实现、直接 storage 写入、DOM/UI。                   |
| `src/features/folders/FolderMessages.test.ts`            | 验证命令路由、可序列化错误和未知操作拒绝。                                   | 生产实现、真实 runtime、repository 细节测试。                       |
| `src/features/folders/RecentConversationService.ts`      | 在 local 中维护有上限的最近会话引用缓存，供稳定 UI 选取。                    | 文件夹主数据、聊天正文、远端删除同步。                              |
| `src/features/folders/RecentConversationService.test.ts` | 验证缓存置顶、标题更新、no-op 和畸形值忽略。                                 | 生产实现、真实 storage、页面 DOM。                                  |
| `src/features/folders/FolderSettingsService.ts`          | 为旧的 folder 命名提供 core settings 的兼容重导出。                          | 新设置实现、独立 storage key、业务逻辑。                            |
| `src/features/folders/activeConversation.ts`             | 从当前活动 tab 读取可加入文件夹的 DeepSeek 会话引用。                        | tabs 写操作、页面 DOM 解析、文件夹写入。                            |

## UI 与挂载

| 文件                                                     | 定位与用途                                                                     | 不该出现的内容                                                      |
| -------------------------------------------------------- | ------------------------------------------------------------------------------ | ------------------------------------------------------------------- |
| `src/features/folders/FolderPanel.tsx`                   | popup、side panel、嵌入页共用 UI；负责交互、设置、导入导出、备份和拖放调度。   | DeepSeek 选择器、直接写文件夹 storage、重复业务服务、第三层文件夹。 |
| `src/features/folders/FolderPanel.test.tsx`              | 验证嵌入模式不读取备份，以及 popup / side panel 的备份摘要展示。              | 生产实现、真实 storage/runtime、DeepSeek DOM。                     |
| `src/features/folders/EmbeddedFolderController.tsx`      | 管理共享 `FolderPanel` 在 DeepSeek 侧边栏的 React 生命周期和原生会话拖拽启停。 | 挂载点选择器、文件夹业务、无法挂载时抛出未捕获异常。                |
| `src/features/folders/EmbeddedFolderController.test.tsx` | 验证无会话时挂载、挂载点变化清理和相同会话不重复渲染。                         | 生产实现、真实 DeepSeek 页面、文件夹数据行为测试。                  |
