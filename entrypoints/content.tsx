import '@/src/styles.css';

import { initializeDiagnosticLogging } from '@/src/core/diagnosticLogging';
import { logger } from '@/src/core/logger';
import { createDeepSeekAdapter } from '@/src/platform/deepseek/adapter';
import { isDeepSeekHost } from '@/src/platform/deepseek/routes';
import { watchDeepSeekPage } from '@/src/platform/deepseek/observer';
import { EmbeddedFolderController } from '@/src/features/folders/EmbeddedFolderController';
import { cacheRecentConversations } from '@/src/features/folders/RecentConversationService';
import { ChatExportController } from '@/src/features/chatExport/ChatExportController';
import { FormulaCopyService } from '@/src/features/formulaCopy';

export default defineContentScript({
  matches: ['https://chat.deepseek.com/*'],
  runAt: 'document_idle',
  main() {
    initializeDiagnosticLogging();
    const log = logger.child('Content');

    if (!isDeepSeekHost()) {
      log.debug('Skipped unsupported host', { hostname: location.hostname });
      return;
    }

    const adapter = createDeepSeekAdapter();
    const embeddedFolders = new EmbeddedFolderController(adapter);
    const chatExport = new ChatExportController(adapter);
    const formulaCopy = new FormulaCopyService(adapter.findFormulaFromTarget);
    let recentConversationFingerprint = '';

    const refresh = () => {
      try {
        embeddedFolders.refresh();

        if (!adapter.isConversationPage()) {
          chatExport.destroy();
          formulaCopy.destroy();
          return;
        }

        chatExport.refresh();
        adapter.markFormulaElements();
        formulaCopy.initialize();
        const recentConversations = adapter.getRecentConversations();
        const fingerprint = JSON.stringify(recentConversations);
        if (fingerprint !== recentConversationFingerprint) {
          recentConversationFingerprint = fingerprint;
          void cacheRecentConversations(recentConversations).catch((error) => {
            recentConversationFingerprint = '';
            log.warn('Recent conversation cache failed', { error });
          });
        }
      } catch (error) {
        log.error('Content refresh failed', { error });
      }
    };

    log.info('Content script initializing', { pathname: location.pathname });
    refresh();

    const unwatch = watchDeepSeekPage(refresh);

    window.addEventListener(
      'beforeunload',
      () => {
        unwatch();
        embeddedFolders.destroy();
        chatExport.destroy();
        formulaCopy.destroy();
      },
      { once: true },
    );
  },
});
