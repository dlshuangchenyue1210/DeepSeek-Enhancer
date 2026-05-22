import { logger } from '@/src/core/logger';

import { queryFirst, selectors } from './selectors';

const log = logger.child('DeepSeekSidebar');

export function getSidebarMountPoint(): HTMLElement | null {
  const sidebar = queryFirst(document, selectors.sidebarCandidates);
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
