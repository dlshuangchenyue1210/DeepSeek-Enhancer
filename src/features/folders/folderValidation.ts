import type { FolderData } from './types';

export function createEmptyFolderData(): FolderData {
  return {
    folders: [],
    items: [],
    updatedAt: Date.now(),
  };
}

export function validateFolderData(data: FolderData): string[] {
  const errors: string[] = [];

  if (!Array.isArray(data.folders)) errors.push('folders must be an array');
  if (!Array.isArray(data.items)) errors.push('items must be an array');

  const folderIds = new Set<string>();
  for (const folder of data.folders) {
    if (!folder.id) errors.push('folder.id is required');
    if (!folder.name) errors.push(`folder.name is required: ${folder.id}`);
    if (folderIds.has(folder.id)) errors.push(`duplicate folder id: ${folder.id}`);
    folderIds.add(folder.id);
  }

  for (const folder of data.folders) {
    if (folder.parentId && !folderIds.has(folder.parentId)) {
      errors.push(`missing parent folder: ${folder.parentId}`);
    }

    let depth = 0;
    let current = folder;
    while (current.parentId) {
      depth += 1;
      if (depth > 1) errors.push(`folder depth exceeds two levels: ${folder.id}`);
      const parent = data.folders.find((candidate) => candidate.id === current.parentId);
      if (!parent) break;
      if (parent.id === folder.id) errors.push(`folder cycle detected: ${folder.id}`);
      current = parent;
    }
  }

  const itemKeys = new Set<string>();
  for (const item of data.items) {
    if (!item.id) errors.push('item.id is required');
    if (!item.folderId || !folderIds.has(item.folderId)) {
      errors.push(`item folder is missing: ${item.id}`);
    }
    if (!item.conversationId) errors.push(`item.conversationId is required: ${item.id}`);
    if (!item.title) errors.push(`item.title is required: ${item.id}`);
    if (!item.url) errors.push(`item.url is required: ${item.id}`);

    const key = `${item.folderId}:${item.conversationId}`;
    if (itemKeys.has(key)) errors.push(`duplicate conversation in folder: ${key}`);
    itemKeys.add(key);
  }

  return errors;
}

export function assertValidFolderData(data: FolderData): void {
  const errors = validateFolderData(data);
  if (errors.length > 0) {
    throw new Error(`Invalid folder data: ${errors.join('; ')}`);
  }
}
