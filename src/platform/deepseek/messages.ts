import { normalizeText } from '@/src/core/dom';
import { logger } from '@/src/core/logger';

import { extractMessageMarkdown } from './markdown';
import { queryAll, queryFirst, selectors } from './selectors';
import type { ChatMessage, ChatTurn, MessageRole } from './types';

const log = logger.child('DeepSeekMessages');
const NON_MESSAGE_ANCESTOR_SELECTOR = 'textarea, input, button, [role="button"]';

type MessageCandidate = {
  element: HTMLElement;
  role: MessageRole;
};

function isTopLevelMessage(candidate: MessageCandidate, all: MessageCandidate[]): boolean {
  return !all.some(
    (other) => other.element !== candidate.element && other.element.contains(candidate.element),
  );
}

function inferExplicitRole(element: HTMLElement): MessageRole | null {
  const datasetRole = element.getAttribute('data-role')?.toLowerCase();
  if (datasetRole === 'user' || datasetRole === 'assistant') return datasetRole;

  const aria = element.getAttribute('aria-label')?.toLowerCase() ?? '';
  const className = element.className.toString().toLowerCase();

  if (aria.includes('user') || hasRoleToken(className, 'user')) return 'user';
  if (
    aria.includes('assistant') ||
    hasRoleToken(className, 'assistant') ||
    hasRoleToken(className, 'ai')
  ) {
    return 'assistant';
  }

  return null;
}

function inferObservedRole(element: HTMLElement): MessageRole | null {
  if (element.matches('.ds-assistant-message-main-content')) return 'assistant';

  if (
    element.matches('.ds-message') &&
    !element.querySelector('.ds-assistant-message-main-content') &&
    !element.closest(NON_MESSAGE_ANCESTOR_SELECTOR)
  ) {
    return 'user';
  }

  return null;
}

function inferMessageRole(element: HTMLElement): MessageRole | null {
  if (element.matches('.ds-assistant-message-main-content')) return 'assistant';
  return inferExplicitRole(element) ?? inferObservedRole(element);
}

function hasRoleToken(className: string, role: string): boolean {
  return new RegExp(`(^|[-_\\s])${role}([-_\\s]|$)`).test(className);
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
  return (
    queryFirst(document, selectors.messageRootCandidates) ??
    document.querySelector('main') ??
    document.body
  );
}

export function getMessages(): ChatMessage[] {
  const root = getMessageRoot();
  const candidates = queryAll(root, selectors.messageCandidates)
    .map((element): MessageCandidate | null => {
      if (normalizeText(element.textContent).length === 0) return null;
      const role = inferMessageRole(element);
      return role ? { element, role } : null;
    })
    .filter((candidate): candidate is MessageCandidate => Boolean(candidate))
    .filter((candidate, _index, list) => isTopLevelMessage(candidate, list))
    .sort((a, b) => sortByDocumentOrder(a.element, b.element));

  const messages = candidates.map(({ element, role }, index): ChatMessage => ({
    id: messageId(element, index),
    role,
    text: normalizeText(element.textContent),
    markdown: extractMessageMarkdown(element),
    element,
    index,
  }));

  log.debug('Messages collected', {
    count: messages.length,
    userCount: messages.filter((message) => message.role === 'user').length,
  });

  return messages;
}

function sortByDocumentOrder(a: HTMLElement, b: HTMLElement): number {
  if (a === b) return 0;
  return a.compareDocumentPosition(b) & Node.DOCUMENT_POSITION_FOLLOWING ? -1 : 1;
}

export function getTurns(): ChatTurn[] {
  const messages = getMessages();
  const turns: ChatTurn[] = [];

  for (const message of messages) {
    if (message.role === 'user') {
      turns.push({ id: message.id, user: message });
      continue;
    }

    const last = turns[turns.length - 1];
    if (last?.user && !last.assistant) last.assistant = message;
    else turns.push({ id: message.id, assistant: message });
  }

  return turns.filter((turn) => turn.user || turn.assistant);
}
