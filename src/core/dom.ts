export function ensureElement<K extends keyof HTMLElementTagNameMap>(
  parent: HTMLElement,
  tagName: K,
  id: string,
): HTMLElementTagNameMap[K] {
  const existing = document.getElementById(id);
  if (existing && existing.tagName.toLowerCase() === tagName) {
    return existing as HTMLElementTagNameMap[K];
  }

  const element = document.createElement(tagName);
  element.id = id;
  parent.appendChild(element);
  return element;
}

export function removeElementById(id: string): void {
  document.getElementById(id)?.remove();
}

export function normalizeText(text: string | null | undefined): string {
  return String(text ?? '')
    .replace(/\u00a0/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}
