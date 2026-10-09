import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { watchDeepSeekPage, type DeepSeekPageChange } from './observer';

vi.mock('@/src/core/logger', () => {
  const log = { info: vi.fn(), warn: vi.fn(), child: () => log };
  return { logger: log };
});

describe('DeepSeek page observer', () => {
  let unwatch: (() => void) | undefined;

  beforeEach(() => {
    vi.useFakeTimers();
    document.body.innerHTML = '<main><div class="ds-virtual-list-items"><p>Reply</p></div></main>';
    document.title = 'DeepSeek';
  });

  afterEach(() => {
    unwatch?.();
    unwatch = undefined;
    vi.useRealTimers();
    document.body.innerHTML = '';
  });

  async function flush(): Promise<void> {
    await Promise.resolve();
    vi.advanceTimersByTime(150);
  }

  it('reports only changed message subtrees without refreshing conversations', async () => {
    const onChange = vi.fn<(change: DeepSeekPageChange) => void>();
    unwatch = watchDeepSeekPage(onChange);
    const paragraph = document.querySelector('p')!;
    paragraph.firstChild!.textContent = 'Streaming reply';
    const formula = document.createElement('span');
    formula.className = 'katex';
    paragraph.appendChild(formula);

    await flush();

    expect(onChange).toHaveBeenCalledOnce();
    expect(onChange).toHaveBeenCalledWith({
      conversationsChanged: false,
      formulaRoots: [paragraph],
    });
  });

  it('includes an added formula itself and discards detached roots', async () => {
    const onChange = vi.fn();
    unwatch = watchDeepSeekPage(onChange);
    const paragraph = document.querySelector('p')!;
    const formula = document.createElement('span');
    const removed = document.createElement('span');
    paragraph.append(formula, removed);
    removed.remove();

    await flush();

    expect(onChange).toHaveBeenCalledWith({
      conversationsChanged: false,
      formulaRoots: [formula],
    });
  });

  it('refreshes conversations for native links added, renamed or removed', async () => {
    const onChange = vi.fn();
    unwatch = watchDeepSeekPage(onChange);
    const link = document.createElement('a');
    link.href = '/a/chat/s/0123456789abcdef0123456789abcdef';
    link.textContent = 'Conversation';
    document.body.appendChild(link);
    await flush();
    expect(onChange.mock.lastCall?.[0].conversationsChanged).toBe(true);

    onChange.mockClear();
    link.firstChild!.textContent = 'Renamed';
    await flush();
    expect(onChange.mock.lastCall?.[0].conversationsChanged).toBe(true);

    onChange.mockClear();
    link.remove();
    await flush();
    expect(onChange).toHaveBeenCalledWith({ conversationsChanged: true, formulaRoots: [] });
  });

  it('refreshes conversations when native links are reused through href changes', async () => {
    const link = document.createElement('a');
    link.href = '/';
    document.body.appendChild(link);
    const onChange = vi.fn();
    unwatch = watchDeepSeekPage(onChange);
    link.href = '/a/chat/s/0123456789abcdef0123456789abcdef';
    await flush();
    expect(onChange.mock.lastCall?.[0].conversationsChanged).toBe(true);

    onChange.mockClear();
    link.href = '/';
    await flush();
    expect(onChange.mock.lastCall?.[0].conversationsChanged).toBe(true);
  });

  it('reports formula source attribute changes without observing extension markers', async () => {
    const formula = document.createElement('span');
    formula.className = 'katex';
    document.querySelector('p')!.appendChild(formula);
    const onChange = vi.fn();
    unwatch = watchDeepSeekPage(onChange);
    formula.dataset.tex = 'x^2';
    await flush();
    expect(onChange).toHaveBeenCalledWith({ conversationsChanged: false, formulaRoots: [formula] });

    onChange.mockClear();
    formula.dataset.dseFormulaCopy = 'true';
    await flush();
    expect(onChange).not.toHaveBeenCalled();
  });

  it('refreshes fallback conversation titles but ignores unrelated head changes', async () => {
    const onChange = vi.fn();
    unwatch = watchDeepSeekPage(onChange);
    document.head.appendChild(document.createElement('style'));
    await flush();
    expect(onChange).not.toHaveBeenCalled();

    document.querySelector('title')!.firstChild!.textContent = 'Renamed conversation';
    await flush();
    expect(onChange).toHaveBeenCalledWith({ conversationsChanged: true, formulaRoots: [] });
  });

  it('ignores extension insertion, text updates and removal', async () => {
    const onChange = vi.fn();
    unwatch = watchDeepSeekPage(onChange);
    const root = document.createElement('div');
    root.dataset.dseRoot = 'true';
    root.innerHTML = '<a href="/a/chat/s/0123456789abcdef0123456789abcdef">Owned</a>';
    document.body.appendChild(root);
    await flush();
    root.querySelector('a')!.firstChild!.textContent = 'Updated';
    await flush();
    root.remove();
    await flush();

    expect(onChange).not.toHaveBeenCalled();
  });

  it('does not postpone a pending native refresh for extension-only changes', async () => {
    const root = document.createElement('div');
    root.dataset.dseRoot = 'true';
    root.textContent = 'Owned';
    document.body.appendChild(root);
    const onChange = vi.fn();
    unwatch = watchDeepSeekPage(onChange);
    document.querySelector('p')!.append(' changed');
    await Promise.resolve();
    vi.advanceTimersByTime(100);
    root.firstChild!.textContent = 'Updated';
    await Promise.resolve();
    vi.advanceTimersByTime(50);

    expect(onChange).toHaveBeenCalledOnce();
  });

  it('performs a full refresh on route changes and restores history on disposal', async () => {
    const originalPushState = history.pushState;
    const onChange = vi.fn();
    unwatch = watchDeepSeekPage(onChange);
    history.pushState(null, '', '/a/chat/s/0123456789abcdef0123456789abcdef');
    await flush();

    expect(onChange).toHaveBeenCalledWith({
      conversationsChanged: true,
      formulaRoots: [document.body],
    });
    unwatch();
    unwatch = undefined;
    expect(history.pushState).toBe(originalPushState);
    history.replaceState(null, '', '/');
  });

  it('cancels pending refresh work when disposed', async () => {
    const onChange = vi.fn();
    unwatch = watchDeepSeekPage(onChange);
    document.querySelector('p')!.append(' changed');
    await Promise.resolve();
    unwatch();
    await flush();

    expect(onChange).not.toHaveBeenCalled();
  });
});
