# 聊天导出与公式复制索引

返回[文件索引入口](../file-index.md)。这两个 feature 只能通过 `DeepSeekAdapter` 获取页面信息，不得直接加入 DeepSeek 选择器。

## 聊天导出

| 文件                                                    | 定位与用途                                                        | 不该出现的内容                                     |
| ------------------------------------------------------- | ----------------------------------------------------------------- | -------------------------------------------------- |
| `src/features/chatExport/ChatExportService.ts`          | 把结构化轮次筛选、格式化为 Markdown，规范标题层级并生成下载文件。 | DeepSeek DOM 查询、React 状态、文件夹存储。        |
| `src/features/chatExport/ChatExportService.test.ts`     | 验证标题层级、代码围栏、单消息和多轮导出格式。                    | 生产实现、真实 DOM 解析、浏览器下载。              |
| `src/features/chatExport/ExportChatButton.tsx`          | 可拖动导出按钮、轮次/角色选择对话框、位置设置和下载交互。         | DeepSeek 选择器、消息解析算法、独立 storage 封装。 |
| `src/features/chatExport/ExportChatButton.test.tsx`     | 验证预览压缩和按钮视口位置约束。                                  | 生产实现、真实下载、adapter DOM 解析。             |
| `src/features/chatExport/ChatExportController.tsx`      | 在会话页创建、复用和销毁聊天导出 React root。                     | 导出格式化、DeepSeek 选择器、持久化逻辑。          |
| `src/features/chatExport/ChatExportController.test.tsx` | 验证重复刷新只挂载一次及 destroy 幂等。                           | 生产实现、真实 React DOM 页面、导出内容测试。      |

## 公式复制

| 文件                                                     | 定位与用途                                                                      | 不该出现的内容                                             |
| -------------------------------------------------------- | ------------------------------------------------------------------------------- | ---------------------------------------------------------- |
| `src/features/formulaCopy/index.ts`                      | 公式复制 feature 的最小公开导出面。                                             | 实现逻辑、未使用重导出、页面选择器。                       |
| `src/features/formulaCopy/FormulaCopyService.ts`         | 处理公式点击/右键菜单、默认动作、剪贴板降级、下载和 toast 生命周期。            | DeepSeek 公式选择器、MathJax 初始化、设置 schema。         |
| `src/features/formulaCopy/FormulaCopyService.test.ts`    | 验证 TeX 格式、左键复制反馈和右键 MathML 操作。                                 | 生产实现、真实剪贴板、图像 renderer 集成测试。             |
| `src/features/formulaCopy/FormulaRenderProtocol.ts`      | iframe 公式渲染请求/响应类型与运行时请求校验。                                  | DOM 渲染、消息监听、feature UI。                           |
| `src/features/formulaCopy/FormulaRenderProtocol.test.ts` | 验证合法请求接受及空 TeX、非法格式拒绝。                                        | 生产实现、iframe、MathJax 测试。                           |
| `src/features/formulaCopy/FormulaImageRendererClient.ts` | content 侧惰性创建隐藏扩展 iframe，以限定 origin 的 `MessageChannel` 请求图像。 | MathJax 代码、DeepSeek DOM 查询、宽松 `postMessage('*')`。 |
| `src/features/formulaCopy/FormulaImageRenderer.ts`       | 隔离页内惰性加载 MathJax，生成 SVG 并转换 PNG/JPG Blob。                        | 公式点击 UI、content script 生命周期、DeepSeek 选择器。    |
| `src/features/formulaCopy/FormulaImageRenderer.test.ts`  | 验证 TeX 可生成有效 SVG 且不触发无效 MathJax 配置警告。                         | 生产实现、真实页面公式、剪贴板行为。                       |
