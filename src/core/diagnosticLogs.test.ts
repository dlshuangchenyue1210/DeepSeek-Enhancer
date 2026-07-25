import { beforeEach, describe, expect, it, vi } from 'vitest';

const storage = vi.hoisted(() => ({
  get: vi.fn(),
  remove: vi.fn(),
  set: vi.fn(),
}));

vi.mock('./storage', () => ({
  storageGet: storage.get,
  storageRemove: storage.remove,
  storageSet: storage.set,
}));

vi.mock('wxt/browser', () => ({
  browser: { runtime: { onMessage: { addListener: vi.fn(), removeListener: vi.fn() } } },
}));

import {
  DIAGNOSTIC_LOGS_KEY,
  DiagnosticLogService,
  toDiagnosticLogExport,
} from './diagnosticLogs';

const log = {
  timestamp: '2026-07-23T00:00:00.000Z',
  level: 'info' as const,
  scope: 'App:Test',
  message: 'Test event',
};

describe('DiagnosticLogService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    storage.get.mockResolvedValue([]);
    storage.set.mockResolvedValue(undefined);
    storage.remove.mockResolvedValue(undefined);
  });

  it('stores a bounded, structured local log record without recursively logging storage writes', async () => {
    const service = new DiagnosticLogService();

    await service.append(log);

    expect(storage.get).toHaveBeenCalledWith('local', DIAGNOSTIC_LOGS_KEY, { silent: true });
    expect(storage.set).toHaveBeenCalledWith('local', DIAGNOSTIC_LOGS_KEY, [log], {
      silent: true,
    });
  });

  it('exports a versioned, Agent-readable JSON payload', () => {
    const payload = toDiagnosticLogExport([log]);

    expect(payload).toMatchObject({
      format: 'deepseek-enhancer.logs.v1',
      logs: [log],
    });
    expect(Number.isFinite(Date.parse(payload.exportedAt))).toBe(true);
  });

  it('clears local diagnostic logs without emitting another storage log', async () => {
    const service = new DiagnosticLogService();

    await service.clear();

    expect(storage.remove).toHaveBeenCalledWith('local', DIAGNOSTIC_LOGS_KEY, { silent: true });
  });
});
