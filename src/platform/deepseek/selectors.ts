export const selectors = {
  messageRootCandidates: ['.ds-virtual-list-items'],
  messageCandidates: [
    '.ds-message',
    '.ds-assistant-message-main-content',
    '[class*="ds-message"]',
    '[data-role="user"]',
    '[data-role="assistant"]',
    '[data-testid*="message" i]',
  ],
  inputCandidates: [
    'textarea',
    '[contenteditable="true"]',
    '[role="textbox"]',
    'div[contenteditable]',
  ],
  conversationLinks: ['a[href*="/a/chat/s/"]', 'a[href*="/chat/s/"]'],
  sidebarCandidates: [
    '.ds-scroll-area',
    '[class*="ds-scroll"]',
    'aside',
    'nav',
    '[class*="sidebar" i]',
    '[class*="sider" i]',
  ],
  scrollCandidates: ['main', '[class*="scroll" i]', '.ds-scroll-area'],
} as const;

export function queryFirst(root: ParentNode, candidates: readonly string[]): HTMLElement | null {
  for (const selector of candidates) {
    try {
      const element = root.querySelector(selector);
      if (element instanceof HTMLElement) return element;
    } catch {
      continue;
    }
  }
  return null;
}

export function queryAll(root: ParentNode, candidates: readonly string[]): HTMLElement[] {
  const result: HTMLElement[] = [];
  const seen = new Set<HTMLElement>();

  for (const selector of candidates) {
    try {
      root.querySelectorAll(selector).forEach((element) => {
        if (element instanceof HTMLElement && !seen.has(element)) {
          seen.add(element);
          result.push(element);
        }
      });
    } catch {
      continue;
    }
  }

  return result;
}
