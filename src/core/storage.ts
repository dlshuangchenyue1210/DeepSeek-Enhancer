import { logger } from './logger';
import { browser } from 'wxt/browser';

const storageLogger = logger.child('Storage');

export type StorageArea = 'local' | 'sync';

export async function storageGet<T>(area: StorageArea, key: string): Promise<T | undefined> {
  try {
    const api = browser.storage?.[area];
    if (!api) {
      storageLogger.warn('Storage API unavailable', { area, key });
      return undefined;
    }

    const result = await api.get(key);
    return result[key] as T | undefined;
  } catch (error) {
    storageLogger.error('Storage read failed', { area, key, error });
    throw error;
  }
}

export async function storageSet<T>(area: StorageArea, key: string, value: T): Promise<void> {
  try {
    const api = browser.storage?.[area];
    if (!api) throw new Error(`chrome.storage.${area} is unavailable`);

    await api.set({ [key]: value });
    storageLogger.debug('Storage write completed', { area, key });
  } catch (error) {
    storageLogger.error('Storage write failed', { area, key, error });
    throw error;
  }
}

export async function storageRemove(area: StorageArea, key: string): Promise<void> {
  try {
    const api = browser.storage?.[area];
    if (!api) throw new Error(`chrome.storage.${area} is unavailable`);

    await api.remove(key);
    storageLogger.debug('Storage remove completed', { area, key });
  } catch (error) {
    storageLogger.error('Storage remove failed', { area, key, error });
    throw error;
  }
}

export function onStorageChanged(
  listener: (
    changes: Record<string, { oldValue?: unknown; newValue?: unknown }>,
    area: string,
  ) => void,
): () => void {
  browser.storage?.onChanged?.addListener(listener);
  return () => browser.storage?.onChanged?.removeListener(listener);
}
