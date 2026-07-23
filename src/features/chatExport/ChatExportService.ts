import type { ChatTurn, ConversationRef } from '@/src/platform/deepseek/types';

export type ChatExportMode = 'all' | 'user' | 'assistant';

export type ChatExportMessage = {
  role: 'user' | 'assistant';
  markdown: string;
  previewText: string;
};

export type ChatExportTurn = {
  id: string;
  index: number;
  user?: ChatExportMessage;
  assistant?: ChatExportMessage;
};

export type ChatExportOptions = {
  conversation: ConversationRef | null;
  mode: ChatExportMode;
  selectedTurnIds: Set<string>;
};

export function toChatExportTurns(turns: ChatTurn[]): ChatExportTurn[] {
  return turns.map((turn, index) => ({
    id: turn.id,
    index,
    user: turn.user
      ? {
          role: 'user',
          markdown: turn.user.markdown?.trim() || turn.user.text,
          previewText: turn.user.markdown?.trim() || turn.user.text,
        }
      : undefined,
    assistant: turn.assistant
      ? {
          role: 'assistant',
          markdown: turn.assistant.markdown?.trim() || turn.assistant.text,
          previewText: turn.assistant.markdown?.trim() || turn.assistant.text,
        }
      : undefined,
  }));
}

export function formatChatExport(turns: ChatExportTurn[], options: ChatExportOptions): string {
  const selected = turns
    .filter((turn) => options.selectedTurnIds.has(turn.id))
    .sort((a, b) => a.index - b.index);
  const exportableTurns = selected
    .map((turn) => ({ turn, messages: getMessagesForMode(turn, options.mode) }))
    .filter((item) => item.messages.length > 0);
  const messageCount = exportableTurns.reduce((count, item) => count + item.messages.length, 0);

  if (messageCount === 0) {
    throw new Error('没有可导出的消息');
  }

  if (messageCount === 1) {
    return exportableTurns[0]?.messages[0]?.markdown.trim() ?? '';
  }

  const lines: string[] = [`# ${formatTitle(options.conversation)}`, ''];

  exportableTurns.forEach(({ messages }, index) => {
    lines.push(`## Turn ${index + 1}`, '');

    if (options.mode === 'all') {
      const [first, second] = messages;
      if (first) {
        lines.push(formatRoleLabel(first.role), '', normalizeMessageHeadingDepth(first.markdown));
      }
      if (first && second) lines.push('');
      if (second) {
        lines.push(formatRoleLabel(second.role), '', normalizeMessageHeadingDepth(second.markdown));
      }
    } else {
      const message = messages[0];
      if (message) {
        lines.push(formatRoleLabel(message.role), '', normalizeMessageHeadingDepth(message.markdown));
      }
    }

    lines.push('');
  });

  return normalizeDocument(lines.join('\n'));
}

export function downloadChatExport(content: string, filename: string): void {
  const blob = new Blob([content], { type: 'text/markdown;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  window.setTimeout(() => {
    anchor.remove();
    URL.revokeObjectURL(url);
  }, 0);
}

export function chatExportFilename(conversation: ConversationRef | null): string {
  const title = sanitizeFilename(conversation?.title || 'DeepSeek 对话').slice(0, 48);
  const now = new Date();
  const pad = (value: number) => String(value).padStart(2, '0');
  const stamp = `${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(now.getDate())}-${pad(
    now.getHours(),
  )}${pad(now.getMinutes())}${pad(now.getSeconds())}`;
  return `${title || 'DeepSeek 对话'}-${stamp}.md`;
}

export function normalizeMessageHeadingDepth(markdown: string): string {
  const minimumLevel = getMinimumHeadingLevel(markdown);
  const delta = minimumLevel === 1 ? 2 : minimumLevel === 2 ? 1 : 0;
  if (delta === 0) return markdown.trim();

  return mapLinesOutsideFences(markdown, (line) => {
    const match = /^(#{1,6})([ \t]+.+)$/.exec(line);
    if (!match) return line;

    const heading = match[1] ?? '';
    const rest = match[2] ?? '';
    const nextLevel = Math.min(heading.length + delta, 6);
    return `${'#'.repeat(nextLevel)}${rest}`;
  }).trim();
}

function getMessagesForMode(turn: ChatExportTurn, mode: ChatExportMode): ChatExportMessage[] {
  if (mode === 'user') return turn.user ? [turn.user] : [];
  if (mode === 'assistant') return turn.assistant ? [turn.assistant] : [];
  return [turn.user, turn.assistant].filter((message): message is ChatExportMessage =>
    Boolean(message),
  );
}

function formatRoleLabel(role: ChatExportMessage['role']): string {
  const label = role === 'user' ? '用户提问' : 'AI 回复';
  return `> <span class="dse-export-role" data-dse-role="${role}">${label}</span>`;
}

function getMinimumHeadingLevel(markdown: string): number | null {
  let minimum: number | null = null;

  mapLinesOutsideFences(markdown, (line) => {
    const match = /^(#{1,6})([ \t]+.+)$/.exec(line);
    if (match) {
      const level = (match[1] ?? '').length;
      minimum = minimum === null ? level : Math.min(minimum, level);
    }
    return line;
  });

  return minimum;
}

function mapLinesOutsideFences(markdown: string, mapLine: (line: string) => string): string {
  let inFence = false;
  let fenceMarker = '';

  return markdown
    .split('\n')
    .map((line) => {
      const fence = /^([`~]{3,})/.exec(line.trimStart());
      if (fence) {
        const fenceText = fence[1] ?? '';
        const marker = fenceText[0];
        if (!marker) return line;
        if (!inFence) {
          inFence = true;
          fenceMarker = marker;
        } else if (marker === fenceMarker) {
          inFence = false;
          fenceMarker = '';
        }
        return line;
      }

      return inFence ? line : mapLine(line);
    })
    .join('\n');
}

function formatTitle(conversation: ConversationRef | null): string {
  return (conversation?.title || 'DeepSeek 对话').replace(/\s+/g, ' ').trim();
}

function normalizeDocument(markdown: string): string {
  return `${markdown
    .replace(/\r\n?/g, '\n')
    .split('\n')
    .map((line) => line.replace(/[ \t]+$/g, ''))
    .join('\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim()}\n`;
}

function sanitizeFilename(filename: string): string {
  return filename
    .split('')
    .map((character) => (character.charCodeAt(0) < 32 ? ' ' : character))
    .join('')
    .replace(/[<>:"/\\|?*]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}
