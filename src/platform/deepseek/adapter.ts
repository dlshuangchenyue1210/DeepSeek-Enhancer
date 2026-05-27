import { logger } from '@/src/core/logger';

import { getCurrentConversation, getRecentConversations } from './conversations';
import { getInput } from './input';
import { findFormulaFromTarget, markFormulaElements } from './math';
import { getMessages, getTurns } from './messages';
import { isConversationRoute } from './routes';
import {
  enableSidebarConversationDragging,
  getSidebarMountPoint,
  openConversationFromSidebar,
} from './sidebar';
import type { DeepSeekAdapter } from './types';

const log = logger.child('DeepSeekAdapter');

export function createDeepSeekAdapter(): DeepSeekAdapter {
  return {
    isConversationPage: () => isConversationRoute(),
    getCurrentConversation,
    getRecentConversations,
    getMessages,
    getTurns,
    findFormulaFromTarget,
    markFormulaElements,
    getInput,
    getSidebarMountPoint,
    enableSidebarConversationDragging,
    openConversation: openConversationFromSidebar,
    scrollToMessage(id: string) {
      const message = getMessages().find((item) => item.id === id);
      if (!message) {
        log.warn('Cannot scroll to message; id not found', { id });
        return;
      }

      message.element.scrollIntoView({ behavior: 'smooth', block: 'start' });
      message.element.dataset.dseFocused = 'true';
      window.setTimeout(() => {
        delete message.element.dataset.dseFocused;
      }, 1200);
      log.info('Scrolled to message', { id });
    },
  };
}
