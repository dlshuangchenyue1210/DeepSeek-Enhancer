# Rules

本项目是 DeepSeek Enhancer，一个面向 DeepSeek 网页版的浏览器扩展。开发时优先保持实现简单、变更可验证、用户数据安全。

## 技术栈

- 使用 WXT、React、TypeScript、Tailwind CSS、Vitest。
- 使用 Bun 管理依赖和运行脚本。
- 第一阶段只保证 Chrome / Edge Manifest V3。
- 不要引入 Redux、Zustand 或大型状态管理库，除非已有明确复杂度需要。

## 架构规则

所有 DeepSeek 页面 DOM 依赖必须集中在：

```text
src/platform/deepseek/
```

feature 层不得直接写 DeepSeek 选择器。feature 层只能通过 adapter 消费结构化数据。

推荐模块边界：

```text
src/entrypoints/       扩展入口
src/platform/deepseek/ DeepSeek 页面适配
src/features/          功能模块
src/core/              存储、日志、消息、DOM 工具
```

## 文件夹功能规则

文件夹管理必须共用一套数据和服务层。

允许两个 UI：

- popup / side panel：稳定主入口
- DeepSeek 侧边栏嵌入：快捷入口，可失败、可降级

禁止两个 UI 各自维护数据或重复实现业务逻辑。

写入路径必须是：

```text
UI -> FolderServiceClient -> background FolderService -> FolderRepository -> chrome.storage.local
```

不要让 UI 直接调用 `chrome.storage` 写文件夹数据。所有文件夹写操作必须通过 background 中的单一 `FolderService` 实例串行执行。

第一版文件夹只支持两层：

```text
文件夹
  子文件夹
    会话
```

不要第一版实现复杂拖拽、批量选择、自动删除远端已不存在会话或云同步。

## 数据安全和备份

用户数据安全优先于交互便利。

文件夹数据写入前必须：

1. 读取当前数据
2. 校验当前数据
3. 创建 `before-write` 快照
4. 应用变更
5. 校验新数据
6. 写入 `chrome.storage.local`

导入前必须创建 `before-import` 快照。

手动备份、导入、导出必须使用带版本的 JSON 格式：

```text
deepseek-enhancer.folders.v1
```

不要因为 DeepSeek 页面结构变化而删除用户数据。无法识别页面时，只记录日志并禁用依赖页面的入口。

## 存储规则

使用统一 storage service。

建议：

- `chrome.storage.sync`：功能开关、UI 设置、语言、阈值
- `chrome.storage.local`：文件夹数据、备份、大体积数据
- `localStorage`：尽量不用，只能作为页面级临时状态

storage key 使用统一前缀：

```text
dse.settings
dse.folders.v1
dse.folderBackups.v1
```

## 日志规则

必须建立统一 logger。不要在业务代码中随意散落 `console.log`。

日志必须包含模块名和上下文。

建议格式：

```ts
logger.warn('DeepSeek sidebar mount point not found', { pathname: location.pathname });
logger.error('Folder write failed', { error, operation: 'addConversation' });
```

日志级别：

- `debug`：选择器命中、候选节点数量、内部计算
- `info`：初始化、挂载、销毁、用户触发操作
- `warn`：可恢复问题、降级路径
- `error`：功能失败、数据读写失败、不可恢复异常

content script 初始化、路由变化、adapter 识别、文件夹写入和备份必须打日志。

## DeepSeek 页面嵌入规则

页面嵌入 UI 必须可失败。

DeepSeek DOM 观察记录作为带日期的开发参考使用。调整 DeepSeek 页面选择器或消息解析逻辑时，先对照 `docs/deepseek-dom-observation.md` 和实际页面，不要把 hash class 当作稳定依据。

如果无法找到侧边栏挂载点：

- 记录 `warn`
- 不抛出未捕获异常
- 不影响 popup / side panel
- 不写坏任何数据

不要完全接管 DeepSeek 页面。不要接管登录、真实发送、流式响应、文件上传底层协议或 DeepSeek 内部 API。

## 开发验证

完成代码变更后至少运行：

```bash
bun run typecheck
bun run test
```

如果已经建立构建脚本，还要运行：

```bash
bun run build
```

涉及 UI 的变更，需要在 Chrome / Edge 中手动加载扩展验证。

## 版本更新

进行运行时代码修改后，必须根据 `docs/RELEASE.md` 判断是否更新版本。

涉及用户可见功能、行为、存储格式、备份格式或扩展权限变化时，不要跳过版本判断。

提交前必须完成版本更新判断，并同步维护 `CHANGELOG.md`。

## 文档维护

当功能边界、数据格式、存储 key、备份策略或支持平台变化时，同步更新 `README.md`。

当开发规则、目录约束、验证命令或架构边界变化时，同步更新 `AGENTS.md`。
