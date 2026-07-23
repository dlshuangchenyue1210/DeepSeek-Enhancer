# Folder Storage Reference

本文记录文件夹相关信息的当前存储方式、代码位置和主要丢失风险，作为后续维护文件夹功能时的参考。

## 存储位置

文件夹核心数据不写入项目文件，也不依赖 DeepSeek 页面 DOM 保存。运行时数据由浏览器扩展存储管理。

```text
chrome.storage.local
  dse.folders.v1              文件夹树和会话引用
  dse.folderBackups.v1        文件夹备份
  dse.folderRecovery.v1       恢复备份前保留的异常主数据，最多 3 份
  dse.recentConversations.v1  最近会话缓存

chrome.storage.sync
  dse.settings                文件夹 UI 设置和其他功能设置
```

物理磁盘位置由 Chrome / Edge 的用户 Profile 和扩展 ID 决定，不在仓库中。开发版加载方式、扩展 ID 或浏览器 Profile 改变后，新扩展实例可能读不到旧实例的存储数据。

## 核心文件

- `src/features/folders/FolderRepository.ts`：定义 `dse.folders.v1` 和 `dse.folderBackups.v1`，通过统一 storage service 读写 `chrome.storage.local`。
- `src/features/folders/FolderMessages.ts`：UI 客户端和 background 消息入口。
- `src/features/folders/FolderService.ts`：background 中的文件夹业务入口和串行写入队列，UI 不应直接写 storage。
- `src/features/folders/FolderBackupService.ts`：创建、裁剪和恢复文件夹备份。
- `src/features/folders/FolderImportExportService.ts`：导入导出 JSON 格式。
- `src/features/folders/RecentConversationService.ts`：缓存 DeepSeek 最近会话引用。
- `src/core/settings.ts`：保存 `folderItemDropAction` 等 UI 设置到 `chrome.storage.sync`。
- `src/core/storage.ts`：统一 storage service。

## 数据结构

主数据 key 是 `dse.folders.v1`，结构为：

```ts
type FolderData = {
  folders: Folder[];
  items: FolderItem[];
  updatedAt: number;
};
```

`folders` 保存文件夹和子文件夹。两层结构通过 `parentId` 表示：

```text
文件夹
  子文件夹
    会话引用
```

`items` 保存文件夹内的 DeepSeek 会话引用，包含 `conversationId`、`title`、`url`、`folderId`、`addedAt` 和 `order` 等字段。这里不保存 DeepSeek 会话正文。

导入导出的 JSON 格式标识是：

```text
deepseek-enhancer.folders.v1
```

## 写入和备份流程

文件夹写入应保持以下路径：

```text
UI -> FolderServiceClient -> background FolderService -> FolderRepository -> chrome.storage.local
```

正常写入前会创建 `before-write` 备份；导入前会创建 `before-import` 备份；用户也可以创建 `manual` 手动备份。

当前备份保留数量：

```text
before-write   20
before-import  10
manual         20
```

备份数据也存放在 `chrome.storage.local` 的 `dse.folderBackups.v1`。这可以防误操作和部分导入覆盖问题，但不能防浏览器扩展存储整体丢失。

读取或校验主数据失败时，写操作会直接失败，不会回退为空数据。恢复有效备份时，如果当前主数据无法校验，会先把原始值写入 `dse.folderRecovery.v1`，确认保留成功后才恢复备份。恢复快照最多保留 3 份。

## 数据丢失风险

正常使用下，文件夹数据不容易因为 DeepSeek 页面结构变化而丢失。DeepSeek DOM 变化最多应导致页面嵌入 UI 或页面识别能力失效，不应删除 `chrome.storage.local` 中的文件夹数据。

以下情况可能导致数据丢失，或导致用户看起来像数据丢失：

1. 卸载扩展。浏览器通常会删除该扩展对应的 `chrome.storage.local`。
2. 删除、重置或损坏浏览器用户 Profile。
3. 开发模式下扩展 ID 变化。旧数据可能还在旧扩展 ID 下，但新实例读不到。
4. 浏览器清理工具、隐私清理软件或手动清理用户数据目录删除 extension storage。
5. 覆盖导入不符合预期的数据。导入前有 `before-import` 备份，但用户仍可能看到当前文件夹被替换。
6. 主数据和备份同处 `chrome.storage.local`。如果扩展存储整体丢失，主数据和备份会一起丢失。

## 故障保护和验证

- schema 校验覆盖字段类型、两层深度、循环引用、folder/item ID 唯一性和 DeepSeek 会话 URL。
- 合并导入发生 ID 冲突时会重映射文件夹和 item ID，不会把导入会话挂到同 ID 的本地文件夹。
- popup、side panel 和页面嵌入 UI 的写操作统一发送到 background，由同一个队列串行执行。
- 批量添加会话只生成一次 `before-write` 快照；没有实际变化的操作不会写 storage。
- 自动化测试覆盖损坏数据拒绝覆盖、循环终止、并发写入、导入冲突和异常主数据恢复。

主数据、备份和恢复快照仍位于同一个扩展存储中，不能防止卸载扩展或整个 Profile 损坏。定期导出 JSON 到磁盘仍是防浏览器存储整体丢失的最有效方式。
