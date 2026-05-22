export type Folder = {
  id: string;
  name: string;
  parentId: string | null;
  order: number;
  pinned: boolean;
  createdAt: number;
  updatedAt: number;
};

export type FolderItem = {
  id: string;
  folderId: string;
  conversationId: string;
  title: string;
  url: string;
  addedAt: number;
  order: number;
};

export type FolderData = {
  folders: Folder[];
  items: FolderItem[];
  updatedAt: number;
};

export type FolderBackupReason = 'before-write' | 'before-import' | 'manual';

export type FolderBackup = {
  id: string;
  createdAt: number;
  reason: FolderBackupReason;
  data: FolderData;
};

export type FolderExportPayload = {
  format: 'deepseek-enhancer.folders.v1';
  version: string;
  exportedAt: string;
  data: FolderData;
};

export type ConversationInput = {
  id: string;
  title: string;
  url: string;
};
