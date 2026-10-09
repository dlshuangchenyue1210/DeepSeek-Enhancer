import { logger } from '@/src/core/logger';
import { normalizeText } from '@/src/core/dom';

import { buildConversationUrl, getConversationIdFromPath } from './routes';
import { EXTENSION_ROOT_SELECTOR, queryFirst, selectors } from './selectors';
import type { ConversationRef } from './types';

const log = logger.child('DeepSeekSidebar');
const DRAG_MIME = 'application/json';
const DRAG_ATTACHED_ATTR = 'data-dse-conversation-drag-attached';

export function getSidebarMountPoint(): HTMLElement | null {
  const sidebar = findConversationSidebar();
  if (!sidebar) {
    log.warn('Sidebar mount point not found', { pathname: location.pathname });
    return null;
  }

  let mount = document.getElementById('dse-embedded-folder-root');
  if (mount instanceof HTMLElement) return mount;

  mount = document.createElement('div');
  mount.id = 'dse-embedded-folder-root';
  sidebar.prepend(mount);
  log.info('Sidebar mount point created', { tag: sidebar.tagName });
  return mount;
}

export function enableSidebarConversationDragging(): () => void {
  const sidebar = findConversationSidebar();
  if (!sidebar) {
    log.warn('Sidebar drag setup skipped; sidebar unavailable');
    return () => undefined;
  }

  const attach = (root: Element) => {
    if (!sidebar.contains(root) || root.closest(EXTENSION_ROOT_SELECTOR)) return;
    const links = queryFirstConversationLinks(root);
    if (root instanceof HTMLElement && root.matches(selectors.conversationLinks.join(','))) {
      links.unshift(root);
    }
    for (const link of links) {
      if (link.closest(EXTENSION_ROOT_SELECTOR)) continue;
      if (link.getAttribute(DRAG_ATTACHED_ATTR) === 'true') continue;
      if (!getConversationFromLink(link)) continue;
      link.draggable = true;
      link.style.cursor = 'grab';
      link.setAttribute(DRAG_ATTACHED_ATTR, 'true');
    }
  };
  const getDragLink = (target: EventTarget | null): HTMLElement | null => {
    if (!(target instanceof Element) || target.closest(EXTENSION_ROOT_SELECTOR)) return null;
    const link = target.closest(`[${DRAG_ATTACHED_ATTR}="true"]`);
    return link instanceof HTMLElement && sidebar.contains(link) ? link : null;
  };
  const onDragStart = (event: DragEvent) => {
    const link = getDragLink(event.target);
    const conversation = link && getConversationFromLink(link);
    if (!link || !conversation) return;
    const payload = {
      type: 'conversation',
      conversationId: conversation.id,
      ...conversation,
    };
    if (event.dataTransfer) {
      event.dataTransfer.effectAllowed = 'move';
      event.dataTransfer.setData(DRAG_MIME, JSON.stringify(payload));
      event.dataTransfer.setData('text/plain', conversation.title);
      event.dataTransfer.setData('text/uri-list', conversation.url);
    }
    link.style.opacity = '0.55';
    log.debug('Native conversation drag started', { conversationId: conversation.id });
  };
  const onDragEnd = (event: DragEvent) => {
    const link = getDragLink(event.target);
    if (link) link.style.opacity = '';
  };

  attach(sidebar);
  sidebar.addEventListener('dragstart', onDragStart, true);
  sidebar.addEventListener('dragend', onDragEnd, true);
  const observer = new MutationObserver((mutations) => {
    for (const mutation of mutations) {
      if (mutation.target instanceof Element && mutation.target.closest(EXTENSION_ROOT_SELECTOR)) {
        continue;
      }
      if (mutation.type === 'attributes' && mutation.target instanceof Element) {
        attach(mutation.target);
      }
      for (const node of mutation.addedNodes) {
        if (node instanceof Element) attach(node);
      }
    }
  });
  observer.observe(sidebar, {
    childList: true,
    subtree: true,
    attributes: true,
    attributeFilter: ['href'],
  });

  return () => {
    observer.disconnect();
    sidebar.removeEventListener('dragstart', onDragStart, true);
    sidebar.removeEventListener('dragend', onDragEnd, true);
    for (const link of sidebar.querySelectorAll<HTMLElement>(`[${DRAG_ATTACHED_ATTR}="true"]`)) {
      if (link.closest(EXTENSION_ROOT_SELECTOR)) continue;
      link.removeAttribute(DRAG_ATTACHED_ATTR);
      link.draggable = false;
      link.style.cursor = '';
      link.style.opacity = '';
    }
    log.info('Sidebar drag setup destroyed');
  };
}

export function openConversationFromSidebar(conversation: ConversationRef): void {
  const link = findNativeConversationLink(conversation);
  if (link) {
    try {
      link.click();
      log.info('Opened conversation through DeepSeek native sidebar link', {
        conversationId: conversation.id,
      });
      return;
    } catch (error) {
      log.warn('Native sidebar link click failed; falling back to URL navigation', {
        conversationId: conversation.id,
        error,
      });
    }
  } else {
    log.warn('Native sidebar link not found; falling back to URL navigation', {
      conversationId: conversation.id,
    });
  }

  window.location.assign(conversation.url);
}

function findConversationSidebar(): HTMLElement | null {
  for (const linkSelector of selectors.conversationLinks) {
    const link = document.querySelector(linkSelector);
    if (!(link instanceof HTMLElement)) continue;

    const container = link.closest('.ds-scroll-area, [class*="ds-scroll"], aside, nav');
    if (container instanceof HTMLElement) return container;
  }

  return queryFirst(document, ['aside', 'nav', '[class*="sidebar" i]', '[class*="sider" i]']);
}

function findNativeConversationLink(conversation: ConversationRef): HTMLElement | null {
  for (const link of queryFirstConversationLinks(document)) {
    if (!link.isConnected || link.closest('#dse-embedded-folder-root')) continue;

    const nativeConversation = getConversationFromLink(link);
    if (nativeConversation?.id === conversation.id) return link;
  }

  return null;
}

function queryFirstConversationLinks(root: ParentNode): HTMLElement[] {
  const result: HTMLElement[] = [];
  const seen = new Set<HTMLElement>();

  for (const selector of selectors.conversationLinks) {
    root.querySelectorAll(selector).forEach((element) => {
      if (element instanceof HTMLElement && !seen.has(element)) {
        seen.add(element);
        result.push(element);
      }
    });
  }

  return result;
}

function getConversationFromLink(link: HTMLElement): ConversationRef | null {
  const href = link.getAttribute('href');
  if (!href) return null;

  let url: URL;
  try {
    url = new URL(href, location.origin);
  } catch {
    return null;
  }

  const id = getConversationIdFromPath(url.pathname);
  if (!id) return null;

  const title = normalizeText(link.textContent) || '未命名对话';
  return {
    id,
    title,
    url: buildConversationUrl(id),
  };
}
