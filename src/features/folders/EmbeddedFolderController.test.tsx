import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import type { DeepSeekAdapter } from '@/src/platform/deepseek/types';

import { EmbeddedFolderController } from './EmbeddedFolderController';

const mocks = vi.hoisted(() => ({
  createRoot: vi.fn(),
  render: vi.fn(),
  unmount: vi.fn(),
  dragCleanup: vi.fn(),
}));

vi.mock('react-dom/client', () => ({
  createRoot: mocks.createRoot,
}));

describe('EmbeddedFolderController', () => {
  beforeEach(() => {
    mocks.createRoot.mockReturnValue({
      render: mocks.render,
      unmount: mocks.unmount,
    });
  });

  afterEach(() => {
    document.body.innerHTML = '';
    vi.clearAllMocks();
  });

  it('mounts when the sidebar is available even before a conversation route exists', () => {
    const mountPoint = document.createElement('div');
    document.body.appendChild(mountPoint);
    const adapter = createAdapter({
      isConversationPage: vi.fn(() => false),
      getSidebarMountPoint: vi.fn(() => mountPoint),
    });

    new EmbeddedFolderController(adapter).refresh();

    expect(adapter.getSidebarMountPoint).toHaveBeenCalled();
    expect(adapter.isConversationPage).not.toHaveBeenCalled();
    expect(mocks.createRoot).toHaveBeenCalledWith(mountPoint);
    expect(mocks.render).toHaveBeenCalledOnce();
    expect(adapter.enableSidebarConversationDragging).toHaveBeenCalledOnce();
  });

  it('cleans up the old root and drag handlers when the sidebar mount changes', () => {
    const firstMount = document.createElement('div');
    const secondMount = document.createElement('div');
    document.body.append(firstMount, secondMount);
    const adapter = createAdapter({
      getSidebarMountPoint: vi.fn(() => firstMount),
    });
    const controller = new EmbeddedFolderController(adapter);

    controller.refresh();
    vi.mocked(adapter.getSidebarMountPoint).mockReturnValue(secondMount);
    controller.mount();

    expect(mocks.unmount).toHaveBeenCalledOnce();
    expect(mocks.dragCleanup).toHaveBeenCalledOnce();
    expect(mocks.createRoot).toHaveBeenCalledWith(secondMount);
  });

  it('does not rerender when repeated page mutations keep the same conversation', () => {
    const mountPoint = document.createElement('div');
    document.body.appendChild(mountPoint);
    const adapter = createAdapter({
      getSidebarMountPoint: vi.fn(() => mountPoint),
      getCurrentConversation: vi.fn(() => ({
        id: 'conversation',
        title: 'Conversation',
        url: 'https://chat.deepseek.com/a/chat/s/conversation',
      })),
    });
    const controller = new EmbeddedFolderController(adapter);

    controller.refresh();
    controller.refresh();

    expect(mocks.render).toHaveBeenCalledOnce();
  });
});

function createAdapter(overrides: Partial<DeepSeekAdapter> = {}): DeepSeekAdapter {
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
    enableSidebarConversationDragging: vi.fn(() => mocks.dragCleanup),
    openConversation: vi.fn(),
    scrollToMessage: vi.fn(),
    ...overrides,
  };
}
