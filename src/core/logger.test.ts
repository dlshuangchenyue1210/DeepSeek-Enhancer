import { beforeEach, describe, expect, it, vi } from 'vitest';

const runtime = vi.hoisted(() => ({
  sendMessage: vi.fn(),
}));

vi.mock('wxt/browser', () => ({
  browser: { runtime },
}));

import { DIAGNOSTIC_LOG_MESSAGE_TYPE } from './diagnosticLogProtocol';
import { logger, setDiagnosticLoggingEnabled } from './logger';

describe('logger', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    runtime.sendMessage.mockResolvedValue(undefined);
    setDiagnosticLoggingEnabled(false);
  });

  it('records a sanitized structured event when diagnostic logging is enabled', () => {
    const error = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    setDiagnosticLoggingEnabled(true);

    logger.child('Test').error('Operation failed', {
      error: new Error('Unsafe detail'),
      nested: { value: 1 },
    });

    expect(error).toHaveBeenCalledWith(
      expect.objectContaining({
        level: 'error',
        scope: 'App:Test',
        message: 'Operation failed',
        context: {
          error: { name: 'Error', message: 'Unsafe detail' },
          nested: { value: 1 },
        },
      }),
    );
    expect(runtime.sendMessage).toHaveBeenCalledWith(
      expect.objectContaining({
        type: DIAGNOSTIC_LOG_MESSAGE_TYPE,
        command: expect.objectContaining({ operation: 'append' }),
      }),
    );
  });

  it('does not persist events while diagnostic logging is disabled', () => {
    const info = vi.spyOn(console, 'info').mockImplementation(() => undefined);

    logger.info('Normal lifecycle event');

    expect(info).toHaveBeenCalledOnce();
    expect(runtime.sendMessage).not.toHaveBeenCalled();
  });
});
