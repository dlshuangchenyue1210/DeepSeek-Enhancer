export class DisposableStack {
  private disposables: Array<() => void> = [];

  add(dispose: () => void): void {
    this.disposables.push(dispose);
  }

  dispose(): void {
    const next = [...this.disposables].reverse();
    this.disposables = [];

    for (const dispose of next) {
      try {
        dispose();
      } catch (error) {
        console.warn('[DeepSeek Enhancer][DisposableStack] dispose failed', error);
      }
    }
  }
}

export function debounce<T extends (...args: never[]) => void>(fn: T, delayMs: number): T {
  let timer: number | undefined;
  return ((...args: Parameters<T>) => {
    if (timer) window.clearTimeout(timer);
    timer = window.setTimeout(() => fn(...args), delayMs);
  }) as T;
}
