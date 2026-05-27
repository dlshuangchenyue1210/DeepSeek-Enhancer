import {
  type DragEvent as ReactDragEvent,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import {
  ChevronDown,
  ChevronRight,
  Download,
  FileUp,
  Folder as FolderIcon,
  FolderPlus,
  Plus,
  RotateCcw,
  Trash2,
} from 'lucide-react';

import { logger } from '@/src/core/logger';
import { onStorageChanged } from '@/src/core/storage';

import { folderBackupService } from './FolderBackupService';
import {
  SETTINGS_KEY,
  type FormulaCopyFormat,
  type FolderItemDropAction,
  type FolderSettings,
  getFolderSettings,
  normalizeFolderSettings,
  updateFolderSettings,
} from './FolderSettingsService';
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
  onOpenConversation?: (conversation: ConversationInput) => void;
};

type EmbeddedFolderTreeProps = {
  data: FolderData | null;
  rootFolders: Folder[];
  expandedFolderIds: Set<string>;
  message: string;
  onAddRootFolder: () => void;
  onAddSubfolder: (parentId: string) => void;
  onDelete: (folder: Folder) => void;
  folderItemDropAction: FolderItemDropAction;
  onDropConversation: (folder: Folder, event: ReactDragEvent<HTMLElement>) => void;
  onDropRemoveConversation: (event: ReactDragEvent<HTMLElement>) => void;
  onFolderItemDragEnd: () => void;
  onFolderItemDragStart: (itemId: string, event: ReactDragEvent<HTMLElement>) => void;
  onOpenConversation?: (conversation: ConversationInput) => void;
  onRename: (folder: Folder) => void;
  removingFolderItem: boolean;
  onToggle: (folderId: string) => void;
};

type EmbeddedFolderNodeProps = {
  folder: Folder;
  level: number;
} & Omit<EmbeddedFolderTreeProps, 'rootFolders' | 'message' | 'onAddRootFolder'>;

const log = logger.child('FolderPanel');
const FOLDER_ITEM_DRAG_TYPE = 'folder-item';
const FOLDER_ITEM_DRAG_MIME = 'application/x-dse-folder-item';
const SUCCESS_MESSAGE_TIMEOUT_MS = 2000;
const ERROR_MESSAGE_TIMEOUT_MS = 4000;

export function FolderPanel({
  mode,
  currentConversation: providedConversation,
  onOpenConversation,
}: FolderPanelProps) {
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
  const [expandedFolderIds, setExpandedFolderIds] = useState<Set<string>>(new Set());
  const [draggingFolderItemId, setDraggingFolderItemId] = useState<string | null>(null);
  const [folderItemDropAction, setFolderItemDropAction] =
    useState<FolderItemDropAction>('move');
  const [formulaCopyFormat, setFormulaCopyFormat] = useState<FormulaCopyFormat>('dollar');
  const fileInputRef = useRef<HTMLInputElement>(null);
  const messageTimerRef = useRef<number | null>(null);

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

  useEffect(
    () => () => {
      if (messageTimerRef.current !== null) window.clearTimeout(messageTimerRef.current);
    },
    [],
  );

  useEffect(() => {
    void getFolderSettings()
      .then((settings) => {
        setFolderItemDropAction(settings.folderItemDropAction);
        setFormulaCopyFormat(settings.formulaCopyFormat);
      })
      .catch((error) => log.warn('Failed to load folder settings', { error }));

    return onStorageChanged((changes, area) => {
      if (area !== 'sync' || !changes[SETTINGS_KEY]) return;
      const settings = normalizeFolderSettings(
        changes[SETTINGS_KEY].newValue as Partial<FolderSettings> | undefined,
      );
      setFolderItemDropAction(settings.folderItemDropAction);
      setFormulaCopyFormat(settings.formulaCopyFormat);
    });
  }, []);

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

  useEffect(() => {
    if (mode !== 'embedded') return;
    setExpandedFolderIds((current) => {
      const next = new Set(current);
      for (const folder of data?.folders ?? []) next.add(folder.id);
      return next;
    });
  }, [data?.folders, mode]);

  async function run(action: () => Promise<void>, success: string): Promise<void> {
    try {
      await action();
      await refresh();
      showMessage(success, SUCCESS_MESSAGE_TIMEOUT_MS);
    } catch (error) {
      log.error('Folder panel action failed', { error });
      showMessage(error instanceof Error ? error.message : '操作失败', ERROR_MESSAGE_TIMEOUT_MS);
    }
  }

  function showMessage(text: string, timeoutMs: number): void {
    if (messageTimerRef.current !== null) window.clearTimeout(messageTimerRef.current);
    setMessage(text);
    messageTimerRef.current = window.setTimeout(() => {
      setMessage('');
      messageTimerRef.current = null;
    }, timeoutMs);
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

  async function changeFolderItemDropAction(action: FolderItemDropAction): Promise<void> {
    try {
      const settings = await updateFolderSettings({ folderItemDropAction: action });
      setFolderItemDropAction(settings.folderItemDropAction);
      showMessage('设置已保存', SUCCESS_MESSAGE_TIMEOUT_MS);
    } catch (error) {
      log.error('Folder settings update failed', { error });
      showMessage(
        error instanceof Error ? error.message : '设置保存失败',
        ERROR_MESSAGE_TIMEOUT_MS,
      );
    }
  }

  async function changeFormulaCopyFormat(format: FormulaCopyFormat): Promise<void> {
    try {
      const settings = await updateFolderSettings({ formulaCopyFormat: format });
      setFormulaCopyFormat(settings.formulaCopyFormat);
      showMessage('设置已保存', SUCCESS_MESSAGE_TIMEOUT_MS);
    } catch (error) {
      log.error('Formula copy settings update failed', { error });
      showMessage(
        error instanceof Error ? error.message : '设置保存失败',
        ERROR_MESSAGE_TIMEOUT_MS,
      );
    }
  }

  async function restoreBackup(backupId: string): Promise<void> {
    if (!window.confirm('恢复备份会替换当前文件夹数据，继续？')) return;
    await run(async () => {
      await folderBackupService.restore(backupId);
    }, '备份已恢复');
  }

  async function createFolderFromPrompt(parentId: string | null = null): Promise<void> {
    const name = window.prompt(parentId ? '子文件夹名称' : '文件夹名称');
    if (!name?.trim()) return;

    await run(async () => {
      await folderService.createFolder(name, parentId);
    }, '文件夹已创建');
  }

  function toggleEmbeddedFolder(folderId: string): void {
    setExpandedFolderIds((current) => {
      const next = new Set(current);
      if (next.has(folderId)) next.delete(folderId);
      else next.add(folderId);
      return next;
    });
  }

  async function addDroppedConversation(folder: Folder, dataTransfer: DataTransfer): Promise<void> {
    const conversation = readDraggedConversation(dataTransfer);
    if (!conversation) {
      showMessage('无法识别拖入的对话', ERROR_MESSAGE_TIMEOUT_MS);
      return;
    }

    await run(async () => {
      await folderService.addConversation(folder.id, conversation);
    }, '对话已加入文件夹');
    setExpandedFolderIds((current) => new Set(current).add(folder.id));
  }

  async function handleFolderDrop(folder: Folder, event: ReactDragEvent<HTMLElement>): Promise<void> {
    event.preventDefault();
    event.stopPropagation();
    event.currentTarget.classList.remove('dse-embedded-folder-row--dragover');

    const folderItemId = readDraggedFolderItemId(event.dataTransfer);
    if (folderItemId) {
      await run(async () => {
        await folderService.transferConversation(folderItemId, folder.id, folderItemDropAction);
      }, folderItemDropAction === 'move' ? '对话已迁移' : '对话已复制');
      setDraggingFolderItemId(null);
      setExpandedFolderIds((current) => new Set(current).add(folder.id));
      return;
    }

    await addDroppedConversation(folder, event.dataTransfer);
  }

  function startFolderItemDrag(itemId: string, event: ReactDragEvent<HTMLElement>): void {
    setDraggingFolderItemId(itemId);
    event.dataTransfer.effectAllowed = 'move';
    event.dataTransfer.setData(
      'application/json',
      JSON.stringify({
        type: FOLDER_ITEM_DRAG_TYPE,
        itemId,
      }),
    );
    event.dataTransfer.setData(FOLDER_ITEM_DRAG_MIME, itemId);
  }

  async function removeDroppedFolderItem(event: ReactDragEvent<HTMLElement>): Promise<void> {
    event.preventDefault();
    event.stopPropagation();
    event.currentTarget.classList.remove('dse-embedded-remove-zone--dragover');

    const itemId = readDraggedFolderItemId(event.dataTransfer);
    if (!itemId) {
      setDraggingFolderItemId(null);
      showMessage('无法识别要移除的对话', ERROR_MESSAGE_TIMEOUT_MS);
      return;
    }

    await run(async () => {
      await folderService.removeConversation(itemId);
    }, '已从文件夹移除');
    setDraggingFolderItemId(null);
  }

  if (mode === 'embedded') {
    return (
      <EmbeddedFolderTree
        data={data}
        rootFolders={rootFolders}
        expandedFolderIds={expandedFolderIds}
        folderItemDropAction={folderItemDropAction}
        message={message}
        onAddRootFolder={() => void createFolderFromPrompt()}
        onAddSubfolder={(parentId) => void createFolderFromPrompt(parentId)}
        onDelete={(folder) => void deleteFolder(folder)}
        onDropConversation={(folder, event) => void handleFolderDrop(folder, event)}
        onDropRemoveConversation={(event) => void removeDroppedFolderItem(event)}
        onFolderItemDragEnd={() => setDraggingFolderItemId(null)}
        onFolderItemDragStart={startFolderItemDrag}
        onOpenConversation={onOpenConversation}
        onRename={(folder) => void renameFolder(folder)}
        removingFolderItem={draggingFolderItemId !== null}
        onToggle={toggleEmbeddedFolder}
      />
    );
  }

  const panelClass = `dse-panel ${mode === 'sidepanel' ? 'dse-panel--sidepanel' : ''}`;

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

        {backups.length > 0 ? (
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

        <details className="dse-card mb-3 p-2">
          <summary className="cursor-pointer text-sm font-medium">设置</summary>
          <label className="mt-2 flex items-center justify-between gap-2 text-sm">
            <span>文件夹内对话拖到其他文件夹</span>
            <select
              className="dse-input w-auto"
              value={folderItemDropAction}
              onChange={(event) =>
                void changeFolderItemDropAction(event.target.value as FolderItemDropAction)
              }
            >
              <option value="move">迁移</option>
              <option value="copy">复制</option>
            </select>
          </label>
          <label className="mt-2 flex items-center justify-between gap-2 text-sm">
            <span>公式复制格式</span>
            <select
              className="dse-input w-auto"
              value={formulaCopyFormat}
              onChange={(event) =>
                void changeFormulaCopyFormat(event.target.value as FormulaCopyFormat)
              }
            >
              <option value="dollar">美元符号 $...$</option>
              <option value="native">DeepSeek 原生 \(...\)</option>
            </select>
          </label>
        </details>

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

function EmbeddedFolderTree(props: EmbeddedFolderTreeProps) {
  return (
    <aside className="dse-embedded-folders" data-dse-root="true">
      <header className="dse-embedded-folders__header">
        <div className="dse-embedded-folders__title">
          <FolderIcon size={17} />
          <span>文件夹</span>
        </div>
        <button
          className="dse-embedded-folders__icon-button"
          type="button"
          title="新建文件夹"
          onClick={props.onAddRootFolder}
        >
          <Plus size={15} />
        </button>
      </header>

      <div className="dse-embedded-folders__list">
        {props.rootFolders.length === 0 ? (
          <div className="dse-embedded-folders__empty">拖动左侧对话到这里整理</div>
        ) : (
          props.rootFolders.map((folder) => (
            <EmbeddedFolderNode key={folder.id} {...props} folder={folder} level={0} />
          ))
        )}
      </div>

      {props.message ? <div className="dse-embedded-folders__message">{props.message}</div> : null}
      {props.removingFolderItem ? (
        <RemoveConversationDropZone onDropRemoveConversation={props.onDropRemoveConversation} />
      ) : null}
    </aside>
  );
}

function RemoveConversationDropZone(props: {
  onDropRemoveConversation: (event: ReactDragEvent<HTMLElement>) => void;
}) {
  function onDragOver(event: ReactDragEvent<HTMLElement>): void {
    event.preventDefault();
    event.stopPropagation();
    event.dataTransfer.dropEffect = 'move';
    event.currentTarget.classList.add('dse-embedded-remove-zone--dragover');
  }

  function onDragLeave(event: ReactDragEvent<HTMLElement>): void {
    const rect = event.currentTarget.getBoundingClientRect();
    if (
      event.clientX <= rect.left ||
      event.clientX >= rect.right ||
      event.clientY <= rect.top ||
      event.clientY >= rect.bottom
    ) {
      event.currentTarget.classList.remove('dse-embedded-remove-zone--dragover');
    }
  }

  return (
    <div
      className="dse-embedded-remove-zone"
      onDragLeave={onDragLeave}
      onDragOver={onDragOver}
      onDrop={props.onDropRemoveConversation}
    >
      拖到此处从文件夹移除
    </div>
  );
}

function EmbeddedFolderNode(props: EmbeddedFolderNodeProps) {
  const expanded = props.expandedFolderIds.has(props.folder.id);
  const children =
    props.data?.folders.filter((folder) => folder.parentId === props.folder.id).sort(sortFolders) ??
    [];
  const items =
    props.data?.items
      .filter((item) => item.folderId === props.folder.id)
      .sort((a, b) => a.order - b.order || a.addedAt - b.addedAt) ?? [];

  function onDragOver(event: ReactDragEvent<HTMLElement>): void {
    if (!event.dataTransfer.types.includes('application/json')) return;
    event.preventDefault();
    event.stopPropagation();
    event.dataTransfer.dropEffect = 'move';
    event.currentTarget.classList.add('dse-embedded-folder-row--dragover');
  }

  function onDragLeave(event: ReactDragEvent<HTMLElement>): void {
    const rect = event.currentTarget.getBoundingClientRect();
    if (
      event.clientX <= rect.left ||
      event.clientX >= rect.right ||
      event.clientY <= rect.top ||
      event.clientY >= rect.bottom
    ) {
      event.currentTarget.classList.remove('dse-embedded-folder-row--dragover');
    }
  }

  return (
    <div className="dse-embedded-folder" data-folder-id={props.folder.id}>
      <div
        className="dse-embedded-folder-row"
        style={{ paddingLeft: `${props.level * 14 + 8}px` }}
        onDragLeave={onDragLeave}
        onDragOver={onDragOver}
        onDrop={(event) => props.onDropConversation(props.folder, event)}
      >
        <button
          className="dse-embedded-folders__icon-button"
          type="button"
          title={expanded ? '折叠' : '展开'}
          onClick={() => props.onToggle(props.folder.id)}
        >
          {expanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
        </button>

        <FolderIcon className="dse-embedded-folder-row__folder-icon" size={16} />

        <button
          className="dse-embedded-folder-row__name"
          type="button"
          title={props.folder.name}
          onClick={() => props.onToggle(props.folder.id)}
          onDoubleClick={() => props.onRename(props.folder)}
        >
          {props.folder.name}
        </button>

        {!props.folder.parentId ? (
          <button
            className="dse-embedded-folders__icon-button"
            type="button"
            title="新建子文件夹"
            onClick={() => props.onAddSubfolder(props.folder.id)}
          >
            <Plus size={13} />
          </button>
        ) : null}

        <button
          className="dse-embedded-folders__icon-button dse-embedded-folders__icon-button--danger"
          type="button"
          title="删除文件夹"
          onClick={() => props.onDelete(props.folder)}
        >
          <Trash2 size={13} />
        </button>
      </div>

      {expanded ? (
        <div className="dse-embedded-folder__content">
          {items.map((item) => (
            <a
              key={item.id}
              className="dse-embedded-folder-conversation"
              draggable
              href={item.url}
              onClick={(event) => {
                if (!props.onOpenConversation) return;
                event.preventDefault();
                event.stopPropagation();
                props.onOpenConversation({
                  id: item.conversationId,
                  title: item.title,
                  url: item.url,
                });
              }}
              onDragEnd={props.onFolderItemDragEnd}
              onDragStart={(event) => props.onFolderItemDragStart(item.id, event)}
              style={{ paddingLeft: `${props.level * 14 + 34}px` }}
              title={item.title}
            >
              {item.title}
            </a>
          ))}
          {children.map((folder) => (
            <EmbeddedFolderNode key={folder.id} {...props} folder={folder} level={props.level + 1} />
          ))}
        </div>
      ) : null}
    </div>
  );
}

function sortFolders(a: Folder, b: Folder): number {
  if (a.pinned !== b.pinned) return a.pinned ? -1 : 1;
  return a.order - b.order || a.name.localeCompare(b.name, 'zh-CN');
}

function readDraggedConversation(dataTransfer: DataTransfer): ConversationInput | null {
  const raw = dataTransfer.getData('application/json');
  if (!raw) return null;

  try {
    const payload = JSON.parse(raw) as Partial<ConversationInput> & {
      conversationId?: unknown;
      type?: unknown;
    };
    if (payload.type !== 'conversation') return null;

    const id =
      typeof payload.conversationId === 'string'
        ? payload.conversationId
        : typeof payload.id === 'string'
          ? payload.id
          : '';
    const title = typeof payload.title === 'string' ? payload.title : '未命名对话';
    const url = typeof payload.url === 'string' ? payload.url : '';

    if (!id || !url) return null;
    return { id, title, url };
  } catch {
    return null;
  }
}

function readDraggedFolderItemId(dataTransfer: DataTransfer): string | null {
  const itemId = dataTransfer.getData(FOLDER_ITEM_DRAG_MIME);
  if (itemId) return itemId;

  const raw = dataTransfer.getData('application/json');
  if (!raw) return null;

  try {
    const payload = JSON.parse(raw) as { itemId?: unknown; type?: unknown };
    if (payload.type !== FOLDER_ITEM_DRAG_TYPE || typeof payload.itemId !== 'string') {
      return null;
    }
    return payload.itemId;
  } catch {
    return null;
  }
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
