import { normalizeText } from '@/src/core/dom';

const SKIP_SELECTORS = [
  'button',
  '[role="button"]',
  'nav',
  'menu',
  'svg',
  'style',
  'script',
  '[class*="copy" i]',
  '[class*="action" i]',
  '[class*="toolbar" i]',
  '[class*="think" i]',
  '[class*="reason" i]',
  '[class*="citation" i]',
  '[class*="reference" i]',
  'img[src*="cdn.deepseek.com/site-icons"]',
];

const CONTENT_SELECTORS = [
  '.ds-assistant-message-main-content',
  'message-content',
  '[data-message-content]',
  '[data-ds-message-content]',
  '[data-ds-markdown]',
  '[class*="markdown" i]',
];

export function extractMessageMarkdown(element: HTMLElement): string {
  const clone = element.cloneNode(true) as HTMLElement;
  cleanupClone(clone);
  return removeThoughtMarkers(normalizeMarkdown(renderChildren(getContentRoot(clone))));
}

function cleanupClone(element: HTMLElement): void {
  element.querySelectorAll(SKIP_SELECTORS.join(',')).forEach((node) => node.remove());

  element.querySelectorAll('*').forEach((node) => {
    if (!(node instanceof HTMLElement)) return;
    const text = normalizeText(node.textContent);
    if (/^已(?:深度)?思考[（(][^）)]*[）)]$/.test(text) || text === '思考过程') {
      node.remove();
      return;
    }

    if (isSearchArtifact(node, text)) {
      node.remove();
    }
  });
}

function getContentRoot(element: HTMLElement): HTMLElement {
  const candidates = Array.from(element.querySelectorAll(CONTENT_SELECTORS.join(','))).filter(
    (node): node is HTMLElement =>
      node instanceof HTMLElement && normalizeText(node.textContent).length > 0,
  );
  const topLevel = candidates.filter(
    (candidate) => !candidates.some((other) => other !== candidate && other.contains(candidate)),
  );

  if (topLevel.length === 0) return element;
  if (topLevel.length === 1) return topLevel[0] ?? element;

  const wrapper = document.createElement('div');
  topLevel.forEach((node) => wrapper.appendChild(node.cloneNode(true)));
  return wrapper;
}

function isSearchArtifact(element: HTMLElement, text: string): boolean {
  if (element.querySelector(CONTENT_SELECTORS.join(','))) return false;

  if (
    /^搜索到\s*\d+\s*个网页$/.test(text) ||
    /^浏览\s*\d+\s*个页面$/.test(text) ||
    /^查看全部$/.test(text) ||
    /^\d+\s*个网页$/.test(text)
  ) {
    return true;
  }

  const hasSiteIcon = Boolean(element.querySelector('img[src*="cdn.deepseek.com/site-icons"]'));
  const hasSearchSummary =
    /搜索到\s*\d+\s*个网页/.test(text) ||
    /浏览\s*\d+\s*个页面/.test(text) ||
    text.includes('查看全部');

  return text.length <= 1200 && (hasSiteIcon || hasSearchSummary);
}

function renderChildren(element: Element): string {
  return Array.from(element.childNodes).map((node) => renderNode(node)).join('');
}

function renderNode(node: Node): string {
  if (node.nodeType === Node.TEXT_NODE) return node.textContent ?? '';
  if (node.nodeType !== Node.ELEMENT_NODE) return '';

  const element = node as HTMLElement;
  const tag = element.tagName.toLowerCase();

  if (tag === 'annotation') return '';

  const tex = getTexAnnotation(element);
  if (tex) return isBlockMathElement(element) ? `\n\n\\[\n${tex}\n\\]\n\n` : `\\(${tex}\\)`;

  if (tag === 'br') return '\n';
  if (tag === 'hr') return '\n\n---\n\n';

  if (tag === 'pre') return renderCodeBlock(element);
  if (tag === 'code') return `\`${element.textContent ?? ''}\``;
  if (tag === 'strong' || tag === 'b') return renderStrong(element);
  if (tag === 'em' || tag === 'i') return renderEmphasis(element);
  if (tag === 'a') return renderLink(element);
  if (tag === 'img') return renderImage(element);
  if (/^h[1-6]$/.test(tag)) return renderHeading(element, Number(tag[1]));
  if (tag === 'table') return renderTable(element);
  if (tag === 'ul' || tag === 'ol') return renderList(element, tag === 'ol');
  if (tag === 'blockquote') return renderBlockquote(element);

  const content = renderChildren(element);
  if (isBlockElement(tag)) return block(content);
  return content;
}

function renderCodeBlock(element: HTMLElement): string {
  const codeElement = element.querySelector('code');
  const code = (codeElement?.textContent ?? element.textContent ?? '').replace(/\n+$/g, '');
  const language = Array.from(codeElement?.classList ?? [])
    .find((className) => className.startsWith('language-'))
    ?.replace(/^language-/, '');

  return `\n\n\`\`\`${language ?? ''}\n${code}\n\`\`\`\n\n`;
}

function renderStrong(element: HTMLElement): string {
  const text = normalizeInline(renderChildren(element));
  return text ? `**${text}**` : '';
}

function renderEmphasis(element: HTMLElement): string {
  const text = normalizeInline(renderChildren(element));
  return text ? `*${text}*` : '';
}

function renderLink(element: HTMLElement): string {
  const text = normalizeInline(renderChildren(element)) || normalizeText(element.textContent);
  const href = element.getAttribute('href');
  if (isCitationText(text)) return '';
  if (!href || href.startsWith('javascript:') || !text) return text;
  return `[${text}](${href})`;
}

function isCitationText(text: string): boolean {
  return /^\[?-?\d+\]?$/.test(text.trim());
}

function renderImage(element: HTMLElement): string {
  const src = element.getAttribute('src');
  if (!src) return '';
  const alt = element.getAttribute('alt') ?? '';
  return `![${alt}](${src})`;
}

function renderHeading(element: HTMLElement, level: number): string {
  const text = normalizeInline(renderChildren(element));
  if (!text) return '';
  return `\n\n${'#'.repeat(level)} ${text}\n\n`;
}

function renderTable(element: HTMLElement): string {
  const rows = Array.from(element.querySelectorAll('tr'))
    .map((row) =>
      Array.from(row.querySelectorAll('th,td')).map((cell) =>
        normalizeText(cell.textContent).replace(/\|/g, '\\|'),
      ),
    )
    .filter((row) => row.length > 0);

  if (rows.length === 0) return '';

  const columnCount = Math.max(...rows.map((row) => row.length));
  const normalizedRows = rows.map((row) => [
    ...row,
    ...Array.from({ length: columnCount - row.length }, () => ''),
  ]);
  const [head, ...body] = normalizedRows;
  if (!head) return '';

  const lines = [
    `| ${head.join(' | ')} |`,
    `| ${head.map(() => '---').join(' | ')} |`,
    ...body.map((row) => `| ${row.join(' | ')} |`),
  ];

  return `\n\n${lines.join('\n')}\n\n`;
}

function renderList(element: HTMLElement, ordered: boolean): string {
  const items = Array.from(element.children).filter((child) => child.tagName.toLowerCase() === 'li');
  if (items.length === 0) return block(renderChildren(element));

  const lines = items.map((item, index) => {
    const content = normalizeMarkdown(renderChildren(item)).replace(/\n/g, '\n  ');
    const marker = ordered ? `${index + 1}.` : '-';
    return `${marker} ${content}`;
  });

  return `\n\n${lines.join('\n')}\n\n`;
}

function renderBlockquote(element: HTMLElement): string {
  const content = normalizeMarkdown(renderChildren(element));
  if (!content) return '';
  return `\n\n${content
    .split('\n')
    .map((line) => `> ${line}`)
    .join('\n')}\n\n`;
}

function block(content: string): string {
  const normalized = normalizeMarkdown(content);
  return normalized ? `\n\n${normalized}\n\n` : '';
}

function isBlockElement(tag: string): boolean {
  return [
    'article',
    'aside',
    'div',
    'li',
    'main',
    'ol',
    'p',
    'section',
    'ul',
  ].includes(tag);
}

function getTexAnnotation(element: Element): string | null {
  if (element.tagName.toLowerCase() === 'annotation') {
    const encoding = element.getAttribute('encoding') ?? '';
    if (/tex/i.test(encoding)) return normalizeMarkdown(element.textContent ?? '');
  }

  const tag = element.tagName.toLowerCase();
  const canContainTex =
    tag === 'math' ||
    tag === 'semantics' ||
    element.classList.contains('katex') ||
    element.classList.contains('katex-display');
  if (!canContainTex) return null;

  const annotation = element.querySelector('annotation[encoding*="tex" i]');
  return annotation ? normalizeMarkdown(annotation.textContent ?? '') : null;
}

function isBlockMathElement(element: Element): boolean {
  return (
    element.classList.contains('katex-display') ||
    element.closest('.katex-display') === element ||
    element.getAttribute('display') === 'block'
  );
}

function normalizeInline(text: string): string {
  return text.replace(/[ \t\r\n]+/g, ' ').trim();
}

function normalizeMarkdown(text: string): string {
  return text
    .replace(/\r\n?/g, '\n')
    .replace(/\u00a0/g, ' ')
    .split('\n')
    .map((line) => line.replace(/[ \t]+$/g, ''))
    .join('\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

function removeThoughtMarkers(markdown: string): string {
  return markdown
    .split('\n')
    .map((line) => line.replace(/^已(?:深度)?思考[（(][^）)]*[）)]\s*/, ''))
    .filter((line) => line.trim() !== '思考过程')
    .join('\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}
