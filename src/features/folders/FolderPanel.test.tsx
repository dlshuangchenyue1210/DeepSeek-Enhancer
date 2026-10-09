import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const services = vi.hoisted(() => ({
  getData: vi.fn(),
  listBackups: vi.fn(),
  recent: vi.fn(),
  settings: vi.fn(),
  logs: vi.fn(),
}));

vi.mock('./FolderMessages', () => ({
  folderService: { getData: services.getData, listBackups: services.listBackups },
}));
vi.mock('./RecentConversationService', () => ({ readRecentConversations: services.recent }));
vi.mock('./FolderSettingsService', async (importOriginal) => ({
  ...(await importOriginal<typeof import('./FolderSettingsService')>()),
  getFolderSettings: services.settings,
}));
vi.mock('@/src/core/storage', () => ({ onStorageChanged: () => () => undefined }));
vi.mock('@/src/core/diagnosticLogs', () => ({ diagnosticLogService: { list: services.logs } }));

import { normalizeSettings } from '@/src/core/settings';

import { FolderPanel } from './FolderPanel';

describe('FolderPanel backup loading', () => {
  let root: Root;
  let container: HTMLDivElement;

  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true);
    services.getData.mockResolvedValue({ folders: [], items: [], updatedAt: 1 });
    services.listBackups.mockResolvedValue([{ id: 'backup-1', createdAt: 1, reason: 'manual' }]);
    services.recent.mockResolvedValue([]);
    services.settings.mockResolvedValue(normalizeSettings(undefined));
    services.logs.mockResolvedValue([]);
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
  });

  afterEach(async () => {
    await act(async () => root.unmount());
    container.remove();
    vi.unstubAllGlobals();
  });

  it('does not request backups in embedded mode, including on conversation changes', async () => {
    await act(async () => root.render(<FolderPanel mode="embedded" currentConversation={null} />));
    await act(async () =>
      root.render(
        <FolderPanel
          mode="embedded"
          currentConversation={{
            id: 'conversation',
            title: 'Conversation',
            url: 'https://chat.deepseek.com/a/chat/s/conversation',
          }}
        />,
      ),
    );

    expect(services.getData).toHaveBeenCalled();
    expect(services.listBackups).not.toHaveBeenCalled();
  });

  it.each(['popup', 'sidepanel'] as const)(
    'still displays backup summaries in %s mode',
    async (mode) => {
      await act(async () => root.render(<FolderPanel mode={mode} currentConversation={null} />));

      expect(services.listBackups).toHaveBeenCalledOnce();
      expect(container.textContent).toContain('备份');
      expect(container.textContent).toContain('manual');
    },
  );
});
