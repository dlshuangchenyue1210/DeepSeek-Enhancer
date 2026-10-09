import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { enableSidebarConversationDragging } from './sidebar';

const ID = '0123456789abcdef0123456789abcdef';
const DRAG_ATTRIBUTE = 'data-dse-conversation-drag-attached';

describe('DeepSeek sidebar dragging', () => {
  let cleanup: (() => void) | undefined;

  beforeEach(() => {
    document.body.innerHTML = `
      <aside>
        <a href="/a/chat/s/${ID}"><span>Native conversation</span></a>
        <div id="dse-embedded-folder-root" data-dse-root="true">
          <a href="/a/chat/s/${ID}">Embedded conversation</a>
        </div>
      </aside>
    `;
  });

  afterEach(() => {
    cleanup?.();
    cleanup = undefined;
    document.body.innerHTML = '';
    vi.restoreAllMocks();
  });

  function drag(target: Element, type = 'dragstart') {
    const dataTransfer = { effectAllowed: '', setData: vi.fn() };
    const event = new Event(type, { bubbles: true });
    Object.defineProperty(event, 'dataTransfer', { value: dataTransfer });
    target.dispatchEvent(event);
    return dataTransfer;
  }

  it('delegates drag events without per-link listeners and reads the latest title', () => {
    const native = document.querySelector<HTMLAnchorElement>('aside > a')!;
    const listeners = vi.spyOn(native, 'addEventListener');
    cleanup = enableSidebarConversationDragging();
    const span = native.querySelector('span')!;
    span.textContent = 'Renamed';

    const transfer = drag(span);

    expect(listeners).not.toHaveBeenCalled();
    expect(native.draggable).toBe(true);
    expect(transfer.effectAllowed).toBe('move');
    expect(JSON.parse(transfer.setData.mock.calls[0]![1])).toEqual({
      type: 'conversation',
      conversationId: ID,
      id: ID,
      title: 'Renamed',
      url: `https://chat.deepseek.com/a/chat/s/${ID}`,
    });
    expect(native.style.opacity).toBe('0.55');
    drag(span, 'dragend');
    expect(native.style.opacity).toBe('');
  });

  it('does not mark embedded links or rescan the sidebar for extension changes', async () => {
    cleanup = enableSidebarConversationDragging();
    const sidebar = document.querySelector('aside')!;
    const queries = vi.spyOn(sidebar, 'querySelectorAll');
    const root = document.querySelector('#dse-embedded-folder-root')!;
    const embedded = root.querySelector<HTMLAnchorElement>('a')!;
    root.appendChild(document.createElement('span'));
    await Promise.resolve();

    expect(queries).not.toHaveBeenCalled();
    expect(embedded.hasAttribute(DRAG_ATTRIBUTE)).toBe(false);
    expect(drag(embedded).setData).not.toHaveBeenCalled();
  });

  it('marks only newly inserted links without rescanning existing sidebar links', async () => {
    cleanup = enableSidebarConversationDragging();
    const sidebar = document.querySelector('aside')!;
    const queries = vi.spyOn(sidebar, 'querySelectorAll');
    const link = document.createElement('a');
    link.href = `/a/chat/s/${ID}`;
    link.textContent = 'New conversation';
    const listeners = vi.spyOn(link, 'addEventListener');
    sidebar.appendChild(link);
    await Promise.resolve();

    expect(queries).not.toHaveBeenCalled();
    expect(listeners).not.toHaveBeenCalled();
    expect(link.draggable).toBe(true);
    expect(drag(link).setData).toHaveBeenCalled();
  });

  it('handles reused links whose href becomes a conversation URL', async () => {
    const link = document.createElement('a');
    link.href = '/';
    link.textContent = 'Reused';
    document.querySelector('aside')!.appendChild(link);
    cleanup = enableSidebarConversationDragging();
    expect(link.hasAttribute(DRAG_ATTRIBUTE)).toBe(false);

    link.href = `/a/chat/s/${ID}`;
    await Promise.resolve();

    expect(link.getAttribute(DRAG_ATTRIBUTE)).toBe('true');
    expect(drag(link).setData).toHaveBeenCalled();
  });

  it('handles drag events even when a native descendant stops propagation', () => {
    cleanup = enableSidebarConversationDragging();
    const span = document.querySelector('aside > a > span')!;
    span.addEventListener('dragstart', (event) => event.stopPropagation());

    expect(drag(span).setData).toHaveBeenCalled();
  });

  it('does not mark added links that have already left the sidebar', async () => {
    cleanup = enableSidebarConversationDragging();
    const link = document.createElement('a');
    link.href = `/a/chat/s/${ID}`;
    document.querySelector('aside')!.appendChild(link);
    document.body.appendChild(link);
    await Promise.resolve();

    expect(link.hasAttribute(DRAG_ATTRIBUTE)).toBe(false);
  });

  it('removes markers even when a link no longer has a conversation URL', async () => {
    cleanup = enableSidebarConversationDragging();
    const link = document.querySelector<HTMLAnchorElement>('aside > a')!;
    link.href = '/';
    await Promise.resolve();
    cleanup();
    cleanup = undefined;

    expect(link.hasAttribute(DRAG_ATTRIBUTE)).toBe(false);
    expect(link.style.cursor).toBe('');
  });

  it('removes delegated handlers and markers when disposed', async () => {
    cleanup = enableSidebarConversationDragging();
    cleanup();
    cleanup = undefined;
    const link = document.querySelector<HTMLAnchorElement>('aside > a')!;

    expect(link.draggable).toBe(false);
    expect(link.hasAttribute(DRAG_ATTRIBUTE)).toBe(false);
    expect(link.style.cursor).toBe('');
    expect(drag(link).setData).not.toHaveBeenCalled();
    const added = link.cloneNode(true) as HTMLAnchorElement;
    document.querySelector('aside')!.appendChild(added);
    await Promise.resolve();
    expect(added.draggable).toBe(false);
  });
});
