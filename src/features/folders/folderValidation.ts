import type { ConversationInput, Folder, FolderData, FolderItem } from './types';

export function createEmptyFolderData(): FolderData {
  return { folders: [], items: [], updatedAt: Date.now() };
}

export function validateFolderData(input: unknown): string[] {
  const errors: string[] = [];
  if (!isRecord(input)) return ['folder data must be an object'];

  const foldersInput = input.folders;
  const itemsInput = input.items;
  if (!Array.isArray(foldersInput)) errors.push('folders must be an array');
  if (!Array.isArray(itemsInput)) errors.push('items must be an array');
  if (!isNonNegativeFiniteNumber(input.updatedAt)) {
    errors.push('updatedAt must be a non-negative finite number');
  }
  if (!Array.isArray(foldersInput) || !Array.isArray(itemsInput)) return errors;

  const folders: Folder[] = [];
  const folderIds = new Set<string>();
  for (const [index, value] of foldersInput.entries()) {
    const folder = validateFolder(value, index, errors);
    if (!folder) continue;
    if (folderIds.has(folder.id)) errors.push(`duplicate folder id: ${folder.id}`);
    folderIds.add(folder.id);
    folders.push(folder);
  }

  const foldersById = new Map(folders.map((folder) => [folder.id, folder]));
  for (const folder of folders) validateFolderParent(folder, foldersById, errors);

  const itemIds = new Set<string>();
  const itemKeys = new Set<string>();
  for (const [index, value] of itemsInput.entries()) {
    if (isRecord(value) && isNonEmptyString(value.id)) {
      if (itemIds.has(value.id)) errors.push(`duplicate item id: ${value.id}`);
      itemIds.add(value.id);
    }
    const item = validateFolderItem(value, index, errors);
    if (!item) continue;
    if (!folderIds.has(item.folderId)) errors.push(`item folder is missing: ${item.id}`);

    const key = `${item.folderId}:${item.conversationId}`;
    if (itemKeys.has(key)) errors.push(`duplicate conversation in folder: ${key}`);
    itemKeys.add(key);
  }

  return errors;
}

export function assertValidFolderData(data: unknown): asserts data is FolderData {
  const errors = validateFolderData(data);
  if (errors.length > 0) throw new Error(`Invalid folder data: ${errors.join('; ')}`);
}

export function assertValidConversationInput(input: unknown): asserts input is ConversationInput {
  if (!isRecord(input)) throw new Error('Conversation must be an object');
  if (!isNonEmptyString(input.id)) throw new Error('Conversation id is required');
  if (typeof input.title !== 'string') throw new Error('Conversation title must be a string');
  if (!isNonEmptyString(input.url) || !isValidConversationUrl(input.url, input.id)) {
    throw new Error('Conversation URL must match its DeepSeek conversation id');
  }
}

function validateFolder(value: unknown, index: number, errors: string[]): Folder | null {
  if (!isRecord(value)) {
    errors.push(`folder must be an object: ${index}`);
    return null;
  }

  const label = typeof value.id === 'string' && value.id ? value.id : String(index);
  let valid = true;
  valid = requireNonEmptyString(value.id, `folder.id is required: ${label}`, errors) && valid;
  valid = requireNonEmptyString(value.name, `folder.name is required: ${label}`, errors) && valid;
  if (value.parentId !== null && !isNonEmptyString(value.parentId)) {
    errors.push(`folder.parentId must be null or a non-empty string: ${label}`);
    valid = false;
  }
  if (!isNonNegativeInteger(value.order)) {
    errors.push(`folder.order must be a non-negative integer: ${label}`);
    valid = false;
  }
  if (typeof value.pinned !== 'boolean') {
    errors.push(`folder.pinned must be a boolean: ${label}`);
    valid = false;
  }
  if (!isNonNegativeFiniteNumber(value.createdAt)) {
    errors.push(`folder.createdAt must be a non-negative finite number: ${label}`);
    valid = false;
  }
  if (!isNonNegativeFiniteNumber(value.updatedAt)) {
    errors.push(`folder.updatedAt must be a non-negative finite number: ${label}`);
    valid = false;
  }
  return valid ? (value as Folder) : null;
}

function validateFolderItem(value: unknown, index: number, errors: string[]): FolderItem | null {
  if (!isRecord(value)) {
    errors.push(`item must be an object: ${index}`);
    return null;
  }

  const label = typeof value.id === 'string' && value.id ? value.id : String(index);
  let valid = true;
  valid = requireNonEmptyString(value.id, `item.id is required: ${label}`, errors) && valid;
  valid = requireNonEmptyString(value.folderId, `item.folderId is required: ${label}`, errors) && valid;
  valid = requireNonEmptyString(
    value.conversationId,
    `item.conversationId is required: ${label}`,
    errors,
  ) && valid;
  valid = requireNonEmptyString(value.title, `item.title is required: ${label}`, errors) && valid;
  valid = requireNonEmptyString(value.url, `item.url is required: ${label}`, errors) && valid;
  if (
    isNonEmptyString(value.url) &&
    isNonEmptyString(value.conversationId) &&
    !isValidConversationUrl(value.url, value.conversationId)
  ) {
    errors.push(`item.url is not a matching DeepSeek conversation URL: ${label}`);
    valid = false;
  }
  if (!isNonNegativeFiniteNumber(value.addedAt)) {
    errors.push(`item.addedAt must be a non-negative finite number: ${label}`);
    valid = false;
  }
  if (!isNonNegativeInteger(value.order)) {
    errors.push(`item.order must be a non-negative integer: ${label}`);
    valid = false;
  }
  return valid ? (value as FolderItem) : null;
}

function validateFolderParent(
  folder: Folder,
  foldersById: Map<string, Folder>,
  errors: string[],
): void {
  const visited = new Set<string>([folder.id]);
  let current = folder;
  let depth = 0;

  while (current.parentId) {
    const parent = foldersById.get(current.parentId);
    if (!parent) {
      errors.push(`missing parent folder: ${current.parentId}`);
      return;
    }
    if (visited.has(parent.id)) {
      errors.push(`folder cycle detected: ${folder.id}`);
      return;
    }
    visited.add(parent.id);
    depth += 1;
    if (depth > 1) {
      errors.push(`folder depth exceeds two levels: ${folder.id}`);
      return;
    }
    current = parent;
  }
}

function isValidConversationUrl(value: string, conversationId: string): boolean {
  try {
    const url = new URL(value);
    const parts = url.pathname.split('/').filter(Boolean);
    return (
      url.protocol === 'https:' &&
      url.hostname === 'chat.deepseek.com' &&
      parts.length === 4 &&
      parts[0] === 'a' &&
      parts[1] === 'chat' &&
      parts[2] === 's' &&
      parts[3] === conversationId
    );
  } catch {
    return false;
  }
}

function requireNonEmptyString(value: unknown, error: string, errors: string[]): boolean {
  if (isNonEmptyString(value)) return true;
  errors.push(error);
  return false;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0;
}

function isNonNegativeFiniteNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value) && value >= 0;
}

function isNonNegativeInteger(value: unknown): value is number {
  return isNonNegativeFiniteNumber(value) && Number.isInteger(value);
}
