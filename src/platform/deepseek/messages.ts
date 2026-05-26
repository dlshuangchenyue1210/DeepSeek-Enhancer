import { normalizeText } from '@/src/core/dom';
import { logger } from '@/src/core/logger';

import { queryAll, selectors } from './selectors';
import type { ChatMessage, ChatTurn, MessageRole } from './types';

const log = logger.child('DeepSeekMessages');

function isTopLevelMessage(element: HTMLElement, all: HTMLElement[]): boolean {
  return !all.some((other) => other !== element && other.contains(element));
}

function inferRole(element: HTMLElement): MessageRole {
  const datasetRole = element.getAttribute('data-role')?.toLowerCase();
  if (datasetRole === 'user' || datasetRole === 'assistant') return datasetRole;

  const aria = element.getAttribute('aria-label')?.toLowerCase() ?? '';
  const className = element.className.toString().toLowerCase();

  if (element.matches('.d29f3d7d.ds-message, .d29f3d7d')) return 'user';
  if (aria.includes('user') || className.includes('user')) return 'user';
  if (aria.includes('assistant') || className.includes('assistant') || className.includes('ai')) {
    return 'assistant';
  }

  const previous = element.previousElementSibling;
  if (!previous) return 'user';
  return 'assistant';
}

function messageId(element: HTMLElement, index: number): string {
  const existing = element.dataset.dseMessageId;
  if (existing) return existing;

  const basis = normalizeText(element.textContent).slice(0, 80) || `message-${index}`;
  let hash = 2166136261;
  for (let i = 0; i < basis.length; i++) {
    hash ^= basis.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }

  const id = `dse-message-${index}-${(hash >>> 0).toString(36)}`;
  element.dataset.dseMessageId = id;
  return id;
}

export function getMessageRoot(): HTMLElement {
  return document.querySelector('main') ?? document.body;
}

export function getMessages(): ChatMessage[] {
  const root = getMessageRoot();
  const all = queryAll(root, selectors.messageCandidates)
    .filter((element) => normalizeText(element.textContent).length > 0)
    .filter((element, _index, list) => isTopLevelMessage(element, list));

  const messages = all.map((element, index): ChatMessage => {
    const role = inferRole(element);
    return {
      id: messageId(element, index),
      role,
      text: normalizeText(element.textContent),
      element,
      index,
    };
  });

  log.debug('Messages collected', {
    count: messages.length,
    userCount: messages.filter((message) => message.role === 'user').length,
  });

  return messages;
}

export function getTurns(): ChatTurn[] {
  const messages = getMessages();
  const turns: ChatTurn[] = [];

  for (const message of messages) {
    if (message.role === 'user' || turns.length === 0) {
      turns.push({ id: message.id, user: message.role === 'user' ? message : undefined });
    } else {
      const last = turns[turns.length - 1];
      if (last && !last.assistant) last.assistant = message;
      else turns.push({ id: message.id, assistant: message });
    }
  }

  return turns.filter((turn) => turn.user || turn.assistant);
}
