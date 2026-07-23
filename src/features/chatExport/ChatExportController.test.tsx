import { afterEach, describe, expect, it, vi } from 'vitest';

import type { DeepSeekAdapter } from '@/src/platform/deepseek/types';

const mocks = vi.hoisted(() => ({
  createRoot: vi.fn(),
  render: vi.fn(),
  unmount: vi.fn(),
}));

vi.mock('react-dom/client', () => ({ createRoot: mocks.createRoot }));

import { ChatExportController } from './ChatExportController';

describe('ChatExportController', () => {
  afterEach(() => {
    document.body.innerHTML = '';
    vi.clearAllMocks();
  });

  it('mounts once across repeated page mutation refreshes', () => {
    mocks.createRoot.mockReturnValue({ render: mocks.render, unmount: mocks.unmount });
    const adapter = createAdapter();
    const controller = new ChatExportController(adapter);

    controller.refresh();
    controller.refresh();

    expect(mocks.createRoot).toHaveBeenCalledOnce();
    expect(mocks.render).toHaveBeenCalledOnce();
  });

  it('ignores repeated destroy calls after unmounting', () => {
    mocks.createRoot.mockReturnValue({ render: mocks.render, unmount: mocks.unmount });
    const controller = new ChatExportController(createAdapter());

    controller.refresh();
    controller.destroy();
    controller.destroy();

    expect(mocks.unmount).toHaveBeenCalledOnce();
  });
});

function createAdapter(): DeepSeekAdapter {
  return {
    isConversationPage: vi.fn(() => true),
    getCurrentConversation: vi.fn(() => null),
    getRecentConversations: vi.fn(() => []),
    getMessages: vi.fn(() => []),
    getTurns: vi.fn(() => []),
    findFormulaFromTarget: vi.fn(() => null),
    markFormulaElements: vi.fn(() => 0),
    getInput: vi.fn(() => null),
    getSidebarMountPoint: vi.fn(() => null),
    enableSidebarConversationDragging: vi.fn(() => () => undefined),
    openConversation: vi.fn(),
    scrollToMessage: vi.fn(),
  };
}
