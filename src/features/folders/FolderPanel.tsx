import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Download, FileUp, FolderPlus, Plus, RotateCcw, Trash2 } from 'lucide-react';

import { logger } from '@/src/core/logger';

import { folderBackupService } from './FolderBackupService';
import { folderService } from './FolderService';
import {
  downloadFolderPayload,
  parseFolderExportPayload,
  toFolderExportPayload,
} from './FolderImportExportService';
import { readRecentConversations } from './RecentConversationService';
import { getActiveDeepSeekConversation } from './activeConversation';
import type { ConversationInput, Folder, FolderBackup, FolderData } from './types';

type FolderPanelMode = 'popup' | 'sidepanel' | 'embedded';

type FolderPanelProps = {
  mode: FolderPanelMode;
  currentConversation?: ConversationInput | null;
};

const log = logger.child('FolderPanel');

export function FolderPanel({ mode, currentConversation: providedConversation }: FolderPanelProps) {
  const [data, setData] = useState<FolderData | null>(null);
  const [backups, setBackups] = useState<FolderBackup[]>([]);
  const [currentConversation, setCurrentConversation] = useState<ConversationInput | null>(
    providedConversation ?? null,
  );
  const [recentConversations, setRecentConversations] = useState<ConversationInput[]>([]);
  const [pickerFolder, setPickerFolder] = useState<Folder | null>(null);
  const [pickerQuery, setPickerQuery] = useState('');
  const [selectedConversationIds, setSelectedConversationIds] = useState<Set<string>>(new Set());
  const [newFolderName, setNewFolderName] = useState('');
  const [message, setMessage] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  const refresh = useCallback(async (): Promise<void> => {
    const [nextData, nextBackups, cachedConversations] = await Promise.all([
      folderService.getData(),
      folderBackupService.list(),
      readRecentConversations(),
    ]);
    setData(nextData);
    setBackups(nextBackups);
    setRecentConversations(mergeConversations(currentConversation, cachedConversations));
  }, [currentConversation]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  useEffect(() => {
    if (providedConversation !== undefined) {
      setCurrentConversation(providedConversation);
      return;
    }

    void getActiveDeepSeekConversation()
      .then(setCurrentConversation)
      .catch((error) => log.warn('Failed to resolve active conversation', { error }));
  }, [providedConversation]);

  const rootFolders = useMemo(
    () => [...(data?.folders ?? [])].filter((folder) => !folder.parentId).sort(sortFolders),
    [data],
  );

  async function run(action: () => Promise<void>, success: string): Promise<void> {
    try {
      await action();
      await refresh();
      setMessage(success);
    } catch (error) {
      log.error('Folder panel action failed', { error });
      setMessage(error instanceof Error ? error.message : '操作失败');
    }
  }

  async function createFolder(parentId: string | null = null): Promise<void> {
    const name = parentId ? window.prompt('子文件夹名称') : newFolderName;
    if (!name?.trim()) return;

    await run(async () => {
      await folderService.createFolder(name, parentId);
    }, '文件夹已创建');
    setNewFolderName('');
  }

  async function renameFolder(folder: Folder): Promise<void> {
    const name = window.prompt('新的文件夹名称', folder.name);
    if (!name?.trim() || name === folder.name) return;

    await run(async () => {
      await folderService.renameFolder(folder.id, name);
    }, '文件夹已重命名');
  }

  async function deleteFolder(folder: Folder): Promise<void> {
    if (!window.confirm(`删除文件夹「${folder.name}」及其中的会话引用？`)) return;
    await run(async () => {
      await folderService.deleteFolder(folder.id);
    }, '文件夹已删除');
  }

  function openConversationPicker(folder: Folder): void {
    const alreadyAdded = new Set(
      data?.items
        .filter((item) => item.folderId === folder.id)
        .map((item) => item.conversationId) ?? [],
    );
    const initialSelection = new Set<string>();
    for (const conversation of recentConversations) {
      if (conversation.id === currentConversation?.id && !alreadyAdded.has(conversation.id)) {
        initialSelection.add(conversation.id);
      }
    }

    setPickerFolder(folder);
    setPickerQuery('');
    setSelectedConversationIds(initialSelection);
  }

  async function addSelectedConversations(): Promise<void> {
    if (!pickerFolder) return;

    const selected = recentConversations.filter((conversation) =>
      selectedConversationIds.has(conversation.id),
    );
    if (selected.length === 0) {
      setMessage('请选择至少一个对话');
      return;
    }

    await run(async () => {
      for (const conversation of selected) {
        await folderService.addConversation(pickerFolder.id, conversation);
      }
      setPickerFolder(null);
      setSelectedConversationIds(new Set());
    }, `已添加 ${selected.length} 个对话`);
  }

  async function exportFolders(): Promise<void> {
    const current = await folderService.getData();
    downloadFolderPayload(toFolderExportPayload(current));
    setMessage('文件夹数据已导出');
  }

  async function importFolders(file: File): Promise<void> {
    const text = await file.text();
    const payload = parseFolderExportPayload(JSON.parse(text));
    const strategy = window.confirm('确定覆盖当前文件夹数据？取消则合并导入。')
      ? 'overwrite'
      : 'merge';
    await run(async () => {
      await folderService.importData(payload, strategy);
    }, '文件夹数据已导入');
  }

  async function createBackup(): Promise<void> {
    await run(async () => folderService.createManualBackup(), '备份已创建');
  }

  async function restoreBackup(backupId: string): Promise<void> {
    if (!window.confirm('恢复备份会替换当前文件夹数据，继续？')) return;
    await run(async () => {
      await folderBackupService.restore(backupId);
    }, '备份已恢复');
  }

  const panelClass = `dse-panel ${mode === 'sidepanel' ? 'dse-panel--sidepanel' : ''} ${
    mode === 'embedded' ? 'dse-panel--embedded' : ''
  }`;

  return (
    <main className={panelClass}>
      <section className="p-3">
        <header className="mb-3">
          <h1 className="m-0 text-base font-semibold">DeepSeek Enhancer</h1>
          <p className="m-0 mt-1 text-xs text-slate-500">
            {currentConversation ? currentConversation.title : '未检测到当前 DeepSeek 对话'}
          </p>
        </header>

        <div className="mb-3 flex gap-2">
          <input
            className="dse-input"
            value={newFolderName}
            placeholder="新建文件夹"
            onChange={(event) => setNewFolderName(event.target.value)}
          />
          <button
            className="dse-button dse-button--primary"
            type="button"
            onClick={() => void createFolder()}
          >
            <FolderPlus size={14} />
          </button>
        </div>

        <div className="dse-card mb-3 p-2">
          {rootFolders.length === 0 ? (
            <p className="m-0 p-2 text-sm text-slate-500">暂无文件夹</p>
          ) : (
            rootFolders.map((folder) => (
              <FolderNode
                key={folder.id}
                folder={folder}
                data={data}
                onAddSubfolder={createFolder}
                onRename={renameFolder}
                onDelete={deleteFolder}
                onAddConversation={openConversationPicker}
              />
            ))
          )}
        </div>

        <div className="mb-3 flex flex-wrap gap-2">
          <button className="dse-button" type="button" onClick={() => void exportFolders()}>
            <Download size={14} /> 导出
          </button>
          <button
            className="dse-button"
            type="button"
            onClick={() => fileInputRef.current?.click()}
          >
            <FileUp size={14} /> 导入
          </button>
          <button className="dse-button" type="button" onClick={() => void createBackup()}>
            <RotateCcw size={14} /> 备份
          </button>
          <input
            ref={fileInputRef}
            hidden
            type="file"
            accept=".json,application/json"
            onChange={(event) => {
              const file = event.target.files?.[0];
              if (file) void importFolders(file);
              event.currentTarget.value = '';
            }}
          />
        </div>

        {backups.length > 0 && mode !== 'embedded' ? (
          <details className="dse-card mb-3 p-2">
            <summary className="cursor-pointer text-sm font-medium">备份</summary>
            <div className="mt-2 grid gap-1">
              {backups.slice(0, 6).map((backup) => (
                <button
                  key={backup.id}
                  className="dse-button justify-start"
                  type="button"
                  onClick={() => void restoreBackup(backup.id)}
                >
                  {new Date(backup.createdAt).toLocaleString()} · {backup.reason}
                </button>
              ))}
            </div>
          </details>
        ) : null}

        {message ? <p className="m-0 text-xs text-slate-500">{message}</p> : null}
      </section>

      {pickerFolder ? (
        <ConversationPicker
          folder={pickerFolder}
          data={data}
          conversations={recentConversations}
          query={pickerQuery}
          selectedIds={selectedConversationIds}
          onQueryChange={setPickerQuery}
          onSelectionChange={setSelectedConversationIds}
          onCancel={() => setPickerFolder(null)}
          onConfirm={() => void addSelectedConversations()}
        />
      ) : null}
    </main>
  );
}

function FolderNode(props: {
  folder: Folder;
  data: FolderData | null;
  onAddSubfolder: (parentId: string) => Promise<void>;
  onRename: (folder: Folder) => Promise<void>;
  onDelete: (folder: Folder) => Promise<void>;
  onAddConversation: (folder: Folder) => void;
}) {
  const children =
    props.data?.folders.filter((folder) => folder.parentId === props.folder.id).sort(sortFolders) ??
    [];
  const items =
    props.data?.items
      .filter((item) => item.folderId === props.folder.id)
      .sort((a, b) => a.order - b.order || a.addedAt - b.addedAt) ?? [];

  return (
    <div>
      <div className="dse-folder-row">
        <button
          className="min-w-0 border-0 bg-transparent p-0 text-left text-sm font-medium text-inherit"
          type="button"
          onClick={() => void props.onRename(props.folder)}
          title={props.folder.name}
        >
          <span className="block truncate">{props.folder.name}</span>
        </button>
        <div className="flex gap-1">
          {!props.folder.parentId ? (
            <button
              className="dse-button"
              type="button"
              onClick={() => void props.onAddSubfolder(props.folder.id)}
            >
              <Plus size={12} />
            </button>
          ) : null}
          <button
            className="dse-button"
            type="button"
            onClick={() => void props.onAddConversation(props.folder)}
          >
            加入
          </button>
          <button
            className="dse-button dse-button--danger"
            type="button"
            onClick={() => void props.onDelete(props.folder)}
          >
            <Trash2 size={12} />
          </button>
        </div>
      </div>

      <div className="ml-3 border-l border-slate-200 pl-2">
        {items.map((item) => (
          <a
            key={item.id}
            className="block truncate rounded px-2 py-1 text-xs text-slate-600 no-underline hover:bg-slate-100"
            href={item.url}
            title={item.title}
          >
            {item.title}
          </a>
        ))}
        {children.map((folder) => (
          <FolderNode key={folder.id} {...props} folder={folder} />
        ))}
      </div>
    </div>
  );
}

function sortFolders(a: Folder, b: Folder): number {
  if (a.pinned !== b.pinned) return a.pinned ? -1 : 1;
  return a.order - b.order || a.name.localeCompare(b.name, 'zh-CN');
}

function mergeConversations(
  current: ConversationInput | null,
  cached: ConversationInput[],
): ConversationInput[] {
  const byId = new Map<string, ConversationInput>();
  if (current) byId.set(current.id, current);
  for (const conversation of cached) byId.set(conversation.id, conversation);
  return Array.from(byId.values());
}

function ConversationPicker(props: {
  folder: Folder;
  data: FolderData | null;
  conversations: ConversationInput[];
  query: string;
  selectedIds: Set<string>;
  onQueryChange: (query: string) => void;
  onSelectionChange: (ids: Set<string>) => void;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  const alreadyAdded = new Set(
    props.data?.items
      .filter((item) => item.folderId === props.folder.id)
      .map((item) => item.conversationId) ?? [],
  );
  const query = props.query.trim().toLowerCase();
  const conversations = props.conversations.filter(
    (conversation) =>
      !query ||
      conversation.title.toLowerCase().includes(query) ||
      conversation.id.toLowerCase().includes(query),
  );

  function toggle(conversationId: string): void {
    const next = new Set(props.selectedIds);
    if (next.has(conversationId)) next.delete(conversationId);
    else next.add(conversationId);
    props.onSelectionChange(next);
  }

  return (
    <div className="dse-dialog" data-dse-root="true">
      <div className="dse-dialog__panel">
        <header className="mb-3">
          <h2 className="m-0 text-sm font-semibold">添加到「{props.folder.name}」</h2>
          <p className="m-0 mt-1 text-xs text-slate-500">搜索最近对话，勾选后加入文件夹。</p>
        </header>

        <input
          className="dse-input mb-3"
          value={props.query}
          placeholder="搜索标题或对话 ID"
          onChange={(event) => props.onQueryChange(event.target.value)}
        />

        <div className="dse-dialog__list">
          {conversations.length === 0 ? (
            <p className="m-0 p-2 text-sm text-slate-500">
              暂无最近对话。打开 DeepSeek 侧边栏后会自动缓存。
            </p>
          ) : (
            conversations.map((conversation) => {
              const disabled = alreadyAdded.has(conversation.id);
              return (
                <label key={conversation.id} className="dse-conversation-option">
                  <input
                    type="checkbox"
                    checked={disabled || props.selectedIds.has(conversation.id)}
                    disabled={disabled}
                    onChange={() => toggle(conversation.id)}
                  />
                  <span className="min-w-0">
                    <span className="block truncate text-sm">{conversation.title}</span>
                    <span className="block truncate text-xs text-slate-500">
                      {disabled ? '已在文件夹中' : conversation.id}
                    </span>
                  </span>
                </label>
              );
            })
          )}
        </div>

        <footer className="mt-3 flex justify-end gap-2">
          <button className="dse-button" type="button" onClick={props.onCancel}>
            取消
          </button>
          <button
            className="dse-button dse-button--primary"
            type="button"
            onClick={props.onConfirm}
          >
            添加
          </button>
        </footer>
      </div>
    </div>
  );
}
