import { DisposableStack } from '@/src/core/events';
import { logger } from '@/src/core/logger';

import { EXTENSION_ROOT_SELECTOR, selectors } from './selectors';

const log = logger.child('DeepSeekObserver');
const CONVERSATION_CHANGE_SELECTOR = `${selectors.conversationLinks.join(',')}, title`;

export type DeepSeekPageChange = {
  conversationsChanged: boolean;
  formulaRoots: Element[];
};

export function watchDeepSeekPage(onChange: (change: DeepSeekPageChange) => void): () => void {
  const disposables = new DisposableStack();
  let href = location.href;
  let timer: number | undefined;
  let disposed = false;
  let pendingChange = false;
  let conversationsChanged = false;
  const formulaRoots = new Set<Element>();

  const notify = () => {
    if (disposed) return;
    if (timer !== undefined) window.clearTimeout(timer);
    timer = window.setTimeout(() => {
      timer = undefined;
      const routeChanged = href !== location.href;
      if (routeChanged) {
        href = location.href;
        log.info('Route changed', { pathname: location.pathname });
      }
      if (!routeChanged && !pendingChange) return;

      const roots = Array.from(formulaRoots).filter((root) => {
        if (!root.isConnected) return false;
        for (let parent = root.parentElement; parent; parent = parent.parentElement) {
          if (formulaRoots.has(parent)) return false;
        }
        return true;
      });
      const change: DeepSeekPageChange = {
        conversationsChanged: routeChanged || conversationsChanged,
        formulaRoots: routeChanged ? [document.body] : roots,
      };
      pendingChange = false;
      conversationsChanged = false;
      formulaRoots.clear();
      onChange(change);
    }, 150);
  };

  const observer = new MutationObserver((mutations) => {
    let relevantChange = false;
    for (const mutation of mutations) {
      const target =
        mutation.target instanceof Element ? mutation.target : mutation.target.parentElement;
      if (target?.closest(EXTENSION_ROOT_SELECTOR)) continue;
      const changedNodes = [...mutation.addedNodes, ...mutation.removedNodes];
      if (changedNodes.length > 0 && changedNodes.every(isExtensionNode)) continue;

      const conversationMutation = Boolean(
        target?.closest(CONVERSATION_CHANGE_SELECTOR) ||
        (mutation.attributeName === 'href' && target?.matches('a')) ||
        changedNodes.some(
          (node) =>
            node instanceof Element &&
            !isExtensionNode(node) &&
            (node.matches(CONVERSATION_CHANGE_SELECTOR) ||
              node.querySelector(CONVERSATION_CHANGE_SELECTOR)),
        ),
      );
      const inHead = Boolean(target?.closest('head'));
      if (inHead && !conversationMutation) continue;
      relevantChange = true;
      pendingChange = true;
      conversationsChanged ||= conversationMutation;

      if (!inHead) {
        for (const node of mutation.addedNodes) {
          if (isExtensionNode(node)) continue;
          if (node instanceof Element) formulaRoots.add(node);
          else if (target) formulaRoots.add(target);
        }
        if ((mutation.type === 'characterData' || mutation.type === 'attributes') && target) {
          formulaRoots.add(target);
        }
      }
    }
    if (relevantChange) notify();
  });
  const options = {
    childList: true,
    subtree: true,
    characterData: true,
    attributes: true,
    attributeFilter: ['href', 'data-math', 'data-tex', 'data-latex'],
  };
  observer.observe(document.body, options);
  if (document.head) observer.observe(document.head, options);
  disposables.add(() => observer.disconnect());

  window.addEventListener('popstate', notify);
  window.addEventListener('hashchange', notify);
  disposables.add(() => {
    window.removeEventListener('popstate', notify);
    window.removeEventListener('hashchange', notify);
  });

  for (const name of ['pushState', 'replaceState'] as const) {
    const original = history[name];
    history[name] = function patchedHistoryMethod(
      this: History,
      ...args: Parameters<History[typeof name]>
    ) {
      const result = original.apply(this, args);
      notify();
      return result;
    };
    disposables.add(() => {
      history[name] = original;
    });
  }
  disposables.add(() => {
    disposed = true;
    if (timer !== undefined) window.clearTimeout(timer);
    formulaRoots.clear();
  });

  log.info('Page observer attached');
  return () => disposables.dispose();
}

function isExtensionNode(node: Node): boolean {
  const element = node instanceof Element ? node : node.parentElement;
  return Boolean(element?.closest(EXTENSION_ROOT_SELECTOR));
}
