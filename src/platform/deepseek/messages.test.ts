import { afterEach, describe, expect, it, vi } from 'vitest';

import { extractMessageMarkdown } from './markdown';
import { getTurns } from './messages';

describe('DeepSeek messages', () => {
  afterEach(() => {
    document.body.innerHTML = '';
    vi.restoreAllMocks();
  });

  it('groups a user message and the following assistant message into one turn', () => {
    document.body.innerHTML = `
      <main>
        <div>页面其它内容</div>
      </main>
      <div class="ds-virtual-list-items">
        <div class="d29f3d7d ds-message">用户问题 1</div>
        <div class="ds-assistant-message-main-content ds-markdown">AI 回复 1</div>
        <div class="d29f3d7d ds-message">用户问题 2</div>
        <div class="ds-assistant-message-main-content ds-markdown">AI 回复 2</div>
      </div>
    `;

    const turns = getTurns();

    expect(turns).toHaveLength(2);
    expect(turns[0]?.user?.text).toBe('用户问题 1');
    expect(turns[0]?.assistant?.text).toBe('AI 回复 1');
    expect(turns[1]?.user?.text).toBe('用户问题 2');
    expect(turns[1]?.assistant?.text).toBe('AI 回复 2');
  });

  it('keeps only the outermost resolved message, even across non-message wrappers', () => {
    document.body.innerHTML = `
      <div class="ds-virtual-list-items">
        <div data-role="assistant"><section><div data-role="assistant">Reply</div></section></div>
        <div data-testid="message-wrapper"><div data-role="user">Question</div></div>
      </div>
    `;

    const turns = getTurns();

    expect(turns).toHaveLength(2);
    expect(turns[0]?.assistant?.element.parentElement?.className).toBe('ds-virtual-list-items');
    expect(turns[1]?.user?.text).toBe('Question');
  });

  it('does not compare every pair of candidates in a long conversation', () => {
    document.body.innerHTML = '<div class="ds-virtual-list-items">' +
      Array.from({ length: 300 }, (_, index) =>
        `<div data-role="${index % 2 ? 'assistant' : 'user'}">Message ${index}</div>`,
      ).join('') + '</div>';
    const candidates = new Set(document.querySelectorAll('[data-role]'));
    const contains = vi.spyOn(Node.prototype, 'contains');

    expect(getTurns()).toHaveLength(150);
    const pairwiseChecks = contains.mock.calls.filter(([other], index) =>
      candidates.has(contains.mock.contexts[index] as Element) && candidates.has(other as Element),
    );
    expect(pairwiseChecks).toHaveLength(0);
  });

  it('ignores unknown message candidates instead of alternating roles', () => {
    document.body.innerHTML = `
      <div class="ds-virtual-list-items">
        <div data-testid="message-wrapper">未知候选</div>
        <div class="ds-message">用户问题</div>
      </div>
    `;

    const turns = getTurns();

    expect(turns).toHaveLength(1);
    expect(turns[0]?.user?.text).toBe('用户问题');
    expect(turns[0]?.assistant).toBeUndefined();
  });

  it('keeps unanswered user messages as user-only turns', () => {
    document.body.innerHTML = `
      <div class="ds-virtual-list-items">
        <div class="ds-message">用户问题 1</div>
        <div class="ds-message">用户问题 2</div>
        <div class="ds-assistant-message-main-content">AI 回复 2</div>
      </div>
    `;

    const turns = getTurns();

    expect(turns).toHaveLength(2);
    expect(turns[0]?.user?.text).toBe('用户问题 1');
    expect(turns[0]?.assistant).toBeUndefined();
    expect(turns[1]?.user?.text).toBe('用户问题 2');
    expect(turns[1]?.assistant?.text).toBe('AI 回复 2');
  });

  it('keeps orphan assistant messages as assistant-only turns', () => {
    document.body.innerHTML = `
      <div class="ds-virtual-list-items">
        <div class="ds-assistant-message-main-content">孤立回复</div>
        <div class="ds-message">用户问题</div>
      </div>
    `;

    const turns = getTurns();

    expect(turns).toHaveLength(2);
    expect(turns[0]?.user).toBeUndefined();
    expect(turns[0]?.assistant?.text).toBe('孤立回复');
    expect(turns[1]?.user?.text).toBe('用户问题');
    expect(turns[1]?.assistant).toBeUndefined();
  });

  it('removes thinking duration markers from extracted markdown', () => {
    const element = document.createElement('div');
    element.innerHTML = '<p>已思考（用时 5 秒）真正回复内容</p>';

    expect(extractMessageMarkdown(element)).toBe('真正回复内容');
  });

  it('strips DeepSeek web search artifacts while preserving answer markdown', () => {
    const element = document.createElement('div');
    element.innerHTML = `
      <section>
        <div>
          <p>搜索到 39 个网页</p>
          <img src="https://cdn.deepseek.com/site-icons/csdn.net" />
          <a href="https://example.com/source">来源标题</a>
          <span>浏览 8 个页面</span>
          <button>查看全部</button>
        </div>
        <div class="ds-markdown">
          <p>SillyTavern 以高自由度著称<a href="https://example.com/ref">-17</a>。</p>
          <ul>
            <li><strong>轻量化</strong>：纯 API 调用即可运行<a href="https://example.com/ref2">-4</a></li>
          </ul>
        </div>
        <div>
          <img src="https://cdn.deepseek.com/site-icons/npmjs.com" />
          <span>39 个网页</span>
        </div>
      </section>
    `;

    const markdown = extractMessageMarkdown(element);

    expect(markdown).toContain('SillyTavern 以高自由度著称。');
    expect(markdown).toContain('- **轻量化**：纯 API 调用即可运行');
    expect(markdown).not.toContain('搜索到 39 个网页');
    expect(markdown).not.toContain('浏览 8 个页面');
    expect(markdown).not.toContain('查看全部');
    expect(markdown).not.toContain('来源标题');
    expect(markdown).not.toContain('site-icons');
    expect(markdown).not.toContain('example.com/ref');
  });
});
