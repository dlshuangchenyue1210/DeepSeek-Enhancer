import { describe, expect, it } from 'vitest';

import {
  formatChatExport,
  normalizeMessageHeadingDepth,
  type ChatExportTurn,
} from './ChatExportService';

const turns: ChatExportTurn[] = [
  {
    id: 't1',
    index: 0,
    user: { role: 'user', markdown: '# 问题\n\n内容', previewText: '问题 内容' },
    assistant: { role: 'assistant', markdown: '## 回复\n\n答案', previewText: '回复 答案' },
  },
  {
    id: 't2',
    index: 1,
    user: { role: 'user', markdown: '第二问', previewText: '第二问' },
    assistant: { role: 'assistant', markdown: '第二答', previewText: '第二答' },
  },
];

describe('normalizeMessageHeadingDepth', () => {
  it('moves level 1 headings under the turn heading level', () => {
    expect(normalizeMessageHeadingDepth('# A\n\n## B')).toBe('### A\n\n#### B');
  });

  it('moves level 2 headings under the turn heading level', () => {
    expect(normalizeMessageHeadingDepth('## A\n\n### B')).toBe('### A\n\n#### B');
  });

  it('leaves level 3 headings unchanged', () => {
    expect(normalizeMessageHeadingDepth('### A\n\n#### B')).toBe('### A\n\n#### B');
  });

  it('does not rewrite headings inside fenced code blocks', () => {
    expect(normalizeMessageHeadingDepth('# A\n\n```md\n# B\n```\n')).toBe(
      '### A\n\n```md\n# B\n```',
    );
  });
});

describe('formatChatExport', () => {
  it('exports a single selected message without wrapper content', () => {
    expect(
      formatChatExport(turns, {
        conversation: { id: 'c1', title: '标题', url: 'https://chat.deepseek.com' },
        mode: 'assistant',
        selectedTurnIds: new Set(['t2']),
      }),
    ).toBe('第二答');
  });

  it('exports selected turns in chronological order', () => {
    expect(
      formatChatExport(turns, {
        conversation: { id: 'c1', title: '标题', url: 'https://chat.deepseek.com' },
        mode: 'user',
        selectedTurnIds: new Set(['t2', 't1']),
      }),
    ).toBe(
      '# 标题\n\n## Turn 1\n\n> <span class="dse-export-role" data-dse-role="user">用户提问</span>\n\n### 问题\n\n内容\n\n## Turn 2\n\n> <span class="dse-export-role" data-dse-role="user">用户提问</span>\n\n第二问\n',
    );
  });

  it('labels user and assistant content when exporting all messages', () => {
    expect(
      formatChatExport(turns.slice(0, 1), {
        conversation: { id: 'c1', title: '标题', url: 'https://chat.deepseek.com' },
        mode: 'all',
        selectedTurnIds: new Set(['t1']),
      }),
    ).toBe(
      '# 标题\n\n## Turn 1\n\n> <span class="dse-export-role" data-dse-role="user">用户提问</span>\n\n### 问题\n\n内容\n\n> <span class="dse-export-role" data-dse-role="assistant">AI 回复</span>\n\n### 回复\n\n答案\n',
    );
  });
});
