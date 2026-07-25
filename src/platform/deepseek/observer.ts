import { debounce, DisposableStack } from '@/src/core/events';
import { logger } from '@/src/core/logger';

const log = logger.child('DeepSeekObserver');

export function watchDeepSeekPage(onChange: () => void): () => void {
  const disposables = new DisposableStack();
  let href = location.href;

  const notify = debounce(() => {
    const routeChanged = href !== location.href;
    if (routeChanged) {
      href = location.href;
      log.info('Route changed', { pathname: location.pathname });
    }
    onChange();
  }, 150);

  const observer = new MutationObserver((mutations) => {
    const onlyExtensionMutations = mutations.every((mutation) => {
      const target = mutation.target;
      if (!(target instanceof Element)) return false;
      if (target.closest('[data-dse-root="true"], #dse-embedded-folder-root')) {
        return true;
      }

      return Array.from(mutation.addedNodes).every(
        (node) =>
          node instanceof Element &&
          Boolean(node.closest('[data-dse-root="true"], #dse-embedded-folder-root')),
      );
    });

    if (!onlyExtensionMutations) notify();
  });
  observer.observe(document.body, { childList: true, subtree: true });
  disposables.add(() => observer.disconnect());

  const onPopState = () => notify();
  window.addEventListener('popstate', onPopState);
  window.addEventListener('hashchange', onPopState);
  disposables.add(() => {
    window.removeEventListener('popstate', onPopState);
    window.removeEventListener('hashchange', onPopState);
  });

  for (const name of ['pushState', 'replaceState'] as const) {
    const original = history[name];
    history[name] = function patchedHistoryMethod(
      this: History,
      ...args: Parameters<History[typeof name]>
    ) {
      const result = original.apply(this, args);
      window.setTimeout(notify, 0);
      return result;
    };
    disposables.add(() => {
      history[name] = original;
    });
  }

  log.info('Page observer attached');
  return () => disposables.dispose();
}
