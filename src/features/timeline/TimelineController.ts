import type { DeepSeekAdapter, ChatMessage } from '@/src/platform/deepseek/types';
import { logger } from '@/src/core/logger';

const ROOT_ID = 'dse-timeline-root';

const log = logger.child('Timeline');

export class TimelineController {
  private root: HTMLElement | null = null;
  private track: HTMLElement | null = null;
  private tooltip: HTMLElement | null = null;
  private observer: IntersectionObserver | null = null;
  private markers: ChatMessage[] = [];
  private signature = '';
  private hiddenNativeTimeline: HTMLElement[] = [];

  constructor(private readonly adapter: DeepSeekAdapter) {}

  mount(): void {
    if (!this.adapter.isConversationPage()) {
      this.destroy();
      return;
    }

    this.root = this.ensureRoot();
    this.sync();
    log.info('Timeline mounted');
  }

  sync(): void {
    if (!this.root || !this.adapter.isConversationPage()) return;

    const nextMarkers = this.adapter.getMessages().filter((message) => message.role === 'user');
    const nextSignature = nextMarkers
      .map((message) => `${message.id}:${message.text.slice(0, 48)}`)
      .join('|');

    if (nextSignature === this.signature) {
      this.updateActiveObserverTargets(nextMarkers);
      return;
    }

    this.signature = nextSignature;
    this.markers = nextMarkers;
    this.rebuildDots();
  }

  rebuild(): void {
    this.sync();
  }

  private rebuildDots(): void {
    if (!this.root || !this.track) return;

    this.track.querySelectorAll('.dse-timeline__dot').forEach((node) => node.remove());

    if (this.markers.length === 0) {
      this.root.hidden = true;
      log.warn('Timeline rebuild skipped; no user messages found');
      return;
    }

    this.root.hidden = false;
    const fragment = document.createDocumentFragment();

    for (const marker of this.markers) {
      const dot = document.createElement('button');
      dot.type = 'button';
      dot.className = 'dse-timeline__dot';
      dot.title = marker.text.slice(0, 120);
      dot.setAttribute('aria-label', `跳转到消息 ${marker.index + 1}`);
      dot.dataset.messageId = marker.id;
      dot.dataset.preview = marker.text.slice(0, 240);
      dot.addEventListener('click', () => this.adapter.scrollToMessage(marker.id));
      dot.addEventListener('mouseenter', () => this.showTooltip(dot, marker.text));
      dot.addEventListener('focus', () => this.showTooltip(dot, marker.text));
      dot.addEventListener('mouseleave', () => this.hideTooltip());
      dot.addEventListener('blur', () => this.hideTooltip());
      fragment.appendChild(dot);
    }

    this.track.appendChild(fragment);
    this.attachIntersectionObserver();
    this.hideNativeTimeline();
    log.info('Timeline rebuilt', { markerCount: this.markers.length });
  }

  destroy(): void {
    this.observer?.disconnect();
    this.observer = null;
    this.restoreNativeTimeline();
    this.root?.remove();
    this.root = null;
    this.track = null;
    this.tooltip = null;
    this.markers = [];
    this.signature = '';
    log.info('Timeline destroyed');
  }

  private ensureRoot(): HTMLElement {
    const existing = document.getElementById(ROOT_ID);
    if (existing instanceof HTMLElement) {
      this.track = existing.querySelector('.dse-timeline__track');
      this.tooltip = existing.querySelector('.dse-timeline__tooltip');
      return existing;
    }

    const root = document.createElement('nav');
    root.id = ROOT_ID;
    root.className = 'dse-timeline';
    root.dataset.dseRoot = 'true';
    root.setAttribute('aria-label', 'DeepSeek 对话时间轴');

    const track = document.createElement('div');
    track.className = 'dse-timeline__track';
    root.appendChild(track);

    const tooltip = document.createElement('div');
    tooltip.className = 'dse-timeline__tooltip';
    tooltip.hidden = true;
    root.appendChild(tooltip);

    document.body.appendChild(root);
    this.track = track;
    this.tooltip = tooltip;
    return root;
  }

  private attachIntersectionObserver(): void {
    this.observer?.disconnect();
    this.observer = new IntersectionObserver(
      (entries) => {
        const visible = entries
          .filter((entry) => entry.isIntersecting)
          .sort((a, b) => b.intersectionRatio - a.intersectionRatio)[0];
        if (!visible) return;

        const message = this.markers.find((marker) => marker.element === visible.target);
        if (message) this.setActive(message.id);
      },
      {
        root: null,
        threshold: [0.15, 0.35, 0.6],
      },
    );

    for (const marker of this.markers) {
      this.observer.observe(marker.element);
    }
  }

  private updateActiveObserverTargets(nextMarkers: ChatMessage[]): void {
    this.markers = nextMarkers;
  }

  private setActive(messageId: string): void {
    this.root?.querySelectorAll<HTMLButtonElement>('.dse-timeline__dot').forEach((dot) => {
      dot.classList.toggle('dse-timeline__dot--active', dot.dataset.messageId === messageId);
    });
  }

  private showTooltip(dot: HTMLElement, text: string): void {
    if (!this.root || !this.tooltip) return;

    const rootRect = this.root.getBoundingClientRect();
    const dotRect = dot.getBoundingClientRect();
    this.tooltip.textContent = text.slice(0, 240);
    this.tooltip.hidden = false;
    this.tooltip.style.top = `${dotRect.top - rootRect.top + dotRect.height / 2}px`;
  }

  private hideTooltip(): void {
    if (this.tooltip) this.tooltip.hidden = true;
  }

  private hideNativeTimeline(): void {
    const candidates = Array.from(
      document.querySelectorAll<HTMLElement>(
        '[class*="timeline" i], [aria-label*="时间轴"], [aria-label*="timeline" i]',
      ),
    ).filter(
      (element) =>
        !element.closest('[data-dse-root="true"]') &&
        element.offsetParent !== null &&
        element.getBoundingClientRect().right > window.innerWidth * 0.65,
    );

    for (const element of candidates) {
      if (this.hiddenNativeTimeline.includes(element)) continue;
      element.dataset.dseNativeTimelineDisplay = element.style.display;
      element.style.display = 'none';
      this.hiddenNativeTimeline.push(element);
    }

    if (candidates.length > 0) {
      log.info('Native DeepSeek timeline hidden', { count: candidates.length });
    }
  }

  private restoreNativeTimeline(): void {
    for (const element of this.hiddenNativeTimeline) {
      element.style.display = element.dataset.dseNativeTimelineDisplay ?? '';
      delete element.dataset.dseNativeTimelineDisplay;
    }
    this.hiddenNativeTimeline = [];
  }
}
