import { browser } from 'wxt/browser';

import { logger } from '@/src/core/logger';
import { registerFolderMessageHandler } from '@/src/features/folders/FolderMessages';

const log = logger.child('Background');

export default defineBackground(() => {
  registerFolderMessageHandler();
  browser.runtime.onInstalled.addListener(() => {
    log.info('Extension installed');
  });
});
