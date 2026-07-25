import { browser } from 'wxt/browser';

import { initializeDiagnosticLogging } from '@/src/core/diagnosticLogging';
import { registerDiagnosticLogMessageHandler } from '@/src/core/diagnosticLogs';
import { logger } from '@/src/core/logger';
import { registerFolderMessageHandler } from '@/src/features/folders/FolderMessages';

const log = logger.child('Background');

export default defineBackground(() => {
  initializeDiagnosticLogging();
  registerDiagnosticLogMessageHandler();
  registerFolderMessageHandler();
  browser.runtime.onInstalled.addListener(() => {
    log.info('Extension installed');
  });
});
