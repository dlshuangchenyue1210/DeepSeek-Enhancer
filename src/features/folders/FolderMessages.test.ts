import { beforeEach, describe, expect, it, vi } from 'vitest';

const runtime = vi.hoisted(() => ({
  addListener: vi.fn(),
  removeListener: vi.fn(),
  sendMessage: vi.fn(),
}));

vi.mock('wxt/browser', () => ({
  browser: {
    runtime: {
      onMessage: {
        addListener: runtime.addListener,
        removeListener: runtime.removeListener,
      },
      sendMessage: runtime.sendMessage,
    },
  },
}));

import { FolderService } from './FolderService';
import { registerFolderMessageHandler } from './FolderMessages';

describe('folder background message handler', () => {
  beforeEach(() => vi.clearAllMocks());

  it('routes extension UI commands through the background service', async () => {
    const service = {
      createFolder: vi.fn().mockResolvedValue({ folders: [], items: [], updatedAt: 1 }),
    } as unknown as FolderService;
    registerFolderMessageHandler(service);
    const listener = runtime.addListener.mock.calls[0]?.[0];

    const response = await listener({
      type: 'dse.folder.command',
      command: { operation: 'createFolder', name: 'Folder', parentId: null },
    });

    expect(service.createFolder).toHaveBeenCalledWith('Folder', null);
    expect(response).toEqual({ ok: true, value: { folders: [], items: [], updatedAt: 1 } });
  });

  it('returns serializable errors to callers', async () => {
    const service = {
      deleteFolder: vi.fn().mockRejectedValue(new Error('Folder not found')),
    } as unknown as FolderService;
    registerFolderMessageHandler(service);
    const listener = runtime.addListener.mock.calls[0]?.[0];

    await expect(
      listener({
        type: 'dse.folder.command',
        command: { operation: 'deleteFolder', folderId: 'missing' },
      }),
    ).resolves.toEqual({ ok: false, error: 'Folder not found' });
  });

  it('rejects unknown runtime operations', async () => {
    registerFolderMessageHandler({} as FolderService);
    const listener = runtime.addListener.mock.calls[0]?.[0];

    await expect(
      listener({ type: 'dse.folder.command', command: { operation: 'unknown' } }),
    ).resolves.toEqual({ ok: false, error: 'Unsupported folder command: unknown' });
  });
});
