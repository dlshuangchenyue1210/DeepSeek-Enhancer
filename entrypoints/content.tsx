import '@/src/styles.css';

import { logger } from '@/src/core/logger';
import { createDeepSeekAdapter } from '@/src/platform/deepseek/adapter';
import { isDeepSeekHost } from '@/src/platform/deepseek/routes';
import { watchDeepSeekPage } from '@/src/platform/deepseek/observer';
import { TimelineController } from '@/src/features/timeline/TimelineController';
import { EmbeddedFolderController } from '@/src/features/folders/EmbeddedFolderController';
import { cacheRecentConversations } from '@/src/features/folders/RecentConversationService';

export default defineContentScript({
  matches: ['https://chat.deepseek.com/*'],
  runAt: 'document_idle',
  main() {
    const log = logger.child('Content');

    if (!isDeepSeekHost()) {
      log.debug('Skipped unsupported host', { hostname: location.hostname });
      return;
    }

    const adapter = createDeepSeekAdapter();
    const timeline = new TimelineController(adapter);
    const embeddedFolders = new EmbeddedFolderController(adapter);

    const refresh = () => {
      try {
        if (!adapter.isConversationPage()) {
          timeline.destroy();
          embeddedFolders.destroy();
          return;
        }

        timeline.mount();
        timeline.sync();
        embeddedFolders.refresh();
        void cacheRecentConversations(adapter.getRecentConversations()).catch((error) =>
          log.warn('Recent conversation cache failed', { error }),
        );
      } catch (error) {
        log.error('Content refresh failed', { error });
      }
    };

    log.info('Content script initializing', { href: location.href });
    refresh();

    const unwatch = watchDeepSeekPage(refresh);

    window.addEventListener(
      'beforeunload',
      () => {
        unwatch();
        timeline.destroy();
        embeddedFolders.destroy();
      },
      { once: true },
    );
  },
});
