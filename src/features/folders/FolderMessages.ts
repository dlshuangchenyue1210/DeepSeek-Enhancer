import { logger } from '@/src/core/logger';
import { browser } from 'wxt/browser';

import { FolderService } from './FolderService';
import type { ConversationInput, FolderBackup, FolderData, FolderExportPayload } from './types';

const MESSAGE_TYPE = 'dse.folder.command';
const log = logger.child('FolderMessages');

export type FolderCommand =
  | { operation: 'getData' }
  | { operation: 'createFolder'; name: string; parentId: string | null }
  | { operation: 'renameFolder'; folderId: string; name: string }
  | { operation: 'deleteFolder'; folderId: string }
  | { operation: 'addConversations'; folderId: string; conversations: ConversationInput[] }
  | { operation: 'removeConversation'; itemId: string }
  | {
      operation: 'transferConversation';
      itemId: string;
      targetFolderId: string;
      action: 'move' | 'copy';
    }
  | { operation: 'importData'; payload: FolderExportPayload; strategy: 'merge' | 'overwrite' }
  | { operation: 'createManualBackup' }
  | { operation: 'listBackups' }
  | { operation: 'restoreBackup'; backupId: string };

type FolderMessage = { type: typeof MESSAGE_TYPE; command: FolderCommand };
type FolderResponse = { ok: true; value: unknown } | { ok: false; error: string };

export class FolderServiceClient {
  async getData(): Promise<FolderData> {
    return this.send<FolderData>({ operation: 'getData' });
  }

  async createFolder(name: string, parentId: string | null = null): Promise<FolderData> {
    return this.send<FolderData>({ operation: 'createFolder', name, parentId });
  }

  async renameFolder(folderId: string, name: string): Promise<FolderData> {
    return this.send<FolderData>({ operation: 'renameFolder', folderId, name });
  }

  async deleteFolder(folderId: string): Promise<FolderData> {
    return this.send<FolderData>({ operation: 'deleteFolder', folderId });
  }

  async addConversation(folderId: string, conversation: ConversationInput): Promise<FolderData> {
    return this.addConversations(folderId, [conversation]);
  }

  async addConversations(
    folderId: string,
    conversations: ConversationInput[],
  ): Promise<FolderData> {
    return this.send<FolderData>({ operation: 'addConversations', folderId, conversations });
  }

  async removeConversation(itemId: string): Promise<FolderData> {
    return this.send<FolderData>({ operation: 'removeConversation', itemId });
  }

  async transferConversation(
    itemId: string,
    targetFolderId: string,
    action: 'move' | 'copy',
  ): Promise<FolderData> {
    return this.send<FolderData>({
      operation: 'transferConversation',
      itemId,
      targetFolderId,
      action,
    });
  }

  async importData(
    payload: FolderExportPayload,
    strategy: 'merge' | 'overwrite',
  ): Promise<FolderData> {
    return this.send<FolderData>({ operation: 'importData', payload, strategy });
  }

  async createManualBackup(): Promise<void> {
    await this.send<void>({ operation: 'createManualBackup' });
  }

  async listBackups(): Promise<FolderBackup[]> {
    return this.send<FolderBackup[]>({ operation: 'listBackups' });
  }

  async restoreBackup(backupId: string): Promise<FolderData> {
    return this.send<FolderData>({ operation: 'restoreBackup', backupId });
  }

  private async send<T>(command: FolderCommand): Promise<T> {
    const response = (await browser.runtime.sendMessage({
      type: MESSAGE_TYPE,
      command,
    } satisfies FolderMessage)) as FolderResponse;
    if (!response?.ok) throw new Error(response?.error ?? 'Folder service did not respond');
    return response.value as T;
  }
}

export function registerFolderMessageHandler(service = new FolderService()): () => void {
  const listener = (message: unknown): Promise<FolderResponse> | undefined => {
    if (!isFolderMessage(message)) return undefined;
    return executeFolderCommand(service, message.command).then(
      (value) => ({ ok: true, value }),
      (error) => {
        log.error('Folder command failed', { operation: message.command.operation, error });
        return { ok: false, error: error instanceof Error ? error.message : String(error) };
      },
    );
  };
  browser.runtime.onMessage.addListener(listener);
  log.info('Folder message handler registered');
  return () => browser.runtime.onMessage.removeListener(listener);
}

export async function executeFolderCommand(
  service: FolderService,
  command: FolderCommand,
): Promise<unknown> {
  switch (command.operation) {
    case 'getData':
      return service.getData();
    case 'createFolder':
      return service.createFolder(command.name, command.parentId);
    case 'renameFolder':
      return service.renameFolder(command.folderId, command.name);
    case 'deleteFolder':
      return service.deleteFolder(command.folderId);
    case 'addConversations':
      return service.addConversations(command.folderId, command.conversations);
    case 'removeConversation':
      return service.removeConversation(command.itemId);
    case 'transferConversation':
      return service.transferConversation(
        command.itemId,
        command.targetFolderId,
        command.action,
      );
    case 'importData':
      return service.importData(command.payload, command.strategy);
    case 'createManualBackup':
      return service.createManualBackup();
    case 'listBackups':
      return service.listBackups();
    case 'restoreBackup':
      return service.restoreBackup(command.backupId);
    default:
      throw new Error(
        `Unsupported folder command: ${String((command as { operation?: unknown }).operation)}`,
      );
  }
}

function isFolderMessage(message: unknown): message is FolderMessage {
  return (
    typeof message === 'object' &&
    message !== null &&
    (message as Partial<FolderMessage>).type === MESSAGE_TYPE &&
    typeof (message as Partial<FolderMessage>).command?.operation === 'string'
  );
}

export const folderService = new FolderServiceClient();
