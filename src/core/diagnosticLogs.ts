import { browser } from 'wxt/browser';

import { storageGet, storageRemove, storageSet } from './storage';
import {
  DIAGNOSTIC_LOG_FORMAT,
  DIAGNOSTIC_LOG_MESSAGE_TYPE,
  type DiagnosticLogExport,
  type DiagnosticLogRecord,
} from './diagnosticLogProtocol';

export const DIAGNOSTIC_LOGS_KEY = 'dse.diagnosticLogs.v1';

const MAX_DIAGNOSTIC_LOGS = 500;

type DiagnosticLogCommand =
  | { operation: 'append'; record: DiagnosticLogRecord }
  | { operation: 'list' }
  | { operation: 'clear' };

type DiagnosticLogMessage = {
  type: typeof DIAGNOSTIC_LOG_MESSAGE_TYPE;
  command: DiagnosticLogCommand;
};

type DiagnosticLogResponse = { ok: true; value: unknown } | { ok: false; error: string };

export class DiagnosticLogService {
  private queue: Promise<void> = Promise.resolve();

  async append(record: DiagnosticLogRecord): Promise<void> {
    await this.enqueue(async () => {
      const logs = await this.read();
      try {
        await storageSet('local', DIAGNOSTIC_LOGS_KEY, [...logs, record].slice(-MAX_DIAGNOSTIC_LOGS), {
          silent: true,
        });
      } catch (error) {
        if (String((error as Error)?.message ?? error).toLowerCase().includes('quota')) {
          await storageSet(
            'local',
            DIAGNOSTIC_LOGS_KEY,
            [...logs, record].slice(-Math.ceil(MAX_DIAGNOSTIC_LOGS / 2)),
            { silent: true },
          ).catch(() => undefined);
        } else {
          throw error;
        }
      }
    });
  }

  async list(): Promise<DiagnosticLogRecord[]> {
    return this.enqueue(() => this.read());
  }

  async clear(): Promise<void> {
    await this.enqueue(() => storageRemove('local', DIAGNOSTIC_LOGS_KEY, { silent: true }));
  }

  private async read(): Promise<DiagnosticLogRecord[]> {
    const stored = await storageGet<unknown>('local', DIAGNOSTIC_LOGS_KEY, { silent: true });
    if (!Array.isArray(stored)) return [];
    return stored.filter(isDiagnosticLogRecord).slice(-MAX_DIAGNOSTIC_LOGS);
  }

  private enqueue<T>(task: () => Promise<T>): Promise<T> {
    const result = this.queue.then(task, task);
    this.queue = result.then(
      () => undefined,
      () => undefined,
    );
    return result;
  }
}

export class DiagnosticLogClient {
  async list(): Promise<DiagnosticLogRecord[]> {
    return this.send<DiagnosticLogRecord[]>({ operation: 'list' });
  }

  async clear(): Promise<void> {
    await this.send<void>({ operation: 'clear' });
  }

  private async send<T>(command: Exclude<DiagnosticLogCommand, { operation: 'append' }>): Promise<T> {
    const response = (await browser.runtime.sendMessage({
      type: DIAGNOSTIC_LOG_MESSAGE_TYPE,
      command,
    } satisfies DiagnosticLogMessage)) as DiagnosticLogResponse;
    if (!response?.ok) throw new Error(response?.error ?? 'Diagnostic log service did not respond');
    return response.value as T;
  }
}

export function registerDiagnosticLogMessageHandler(
  service = new DiagnosticLogService(),
): () => void {
  const listener = (message: unknown): Promise<DiagnosticLogResponse> | undefined => {
    if (!isDiagnosticLogMessage(message)) return undefined;
    return executeDiagnosticLogCommand(service, message.command).then(
      (value) => ({ ok: true, value }),
      (error) => ({ ok: false, error: error instanceof Error ? error.message : String(error) }),
    );
  };
  browser.runtime.onMessage.addListener(listener);
  return () => browser.runtime.onMessage.removeListener(listener);
}

export async function executeDiagnosticLogCommand(
  service: DiagnosticLogService,
  command: DiagnosticLogCommand,
): Promise<unknown> {
  switch (command.operation) {
    case 'append':
      if (!isDiagnosticLogRecord(command.record)) throw new Error('Invalid diagnostic log record');
      return service.append(command.record);
    case 'list':
      return service.list();
    case 'clear':
      return service.clear();
  }
}

export function toDiagnosticLogExport(logs: DiagnosticLogRecord[]): DiagnosticLogExport {
  return {
    format: DIAGNOSTIC_LOG_FORMAT,
    exportedAt: new Date().toISOString(),
    logs,
  };
}

export function downloadDiagnosticLogExport(payload: DiagnosticLogExport): void {
  const blob = new Blob([JSON.stringify(payload, null, 2)], {
    type: 'application/json;charset=utf-8',
  });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `deepseek-enhancer-logs-${new Date().toISOString().slice(0, 10)}.json`;
  link.click();
  window.setTimeout(() => {
    link.remove();
    URL.revokeObjectURL(url);
  }, 1000);
}

function isDiagnosticLogMessage(message: unknown): message is DiagnosticLogMessage {
  if (!message || typeof message !== 'object') return false;
  const candidate = message as Partial<DiagnosticLogMessage>;
  return (
    candidate.type === DIAGNOSTIC_LOG_MESSAGE_TYPE &&
    typeof (candidate.command as Partial<DiagnosticLogCommand> | undefined)?.operation === 'string'
  );
}

function isDiagnosticLogRecord(value: unknown): value is DiagnosticLogRecord {
  if (!value || typeof value !== 'object') return false;
  const record = value as Partial<DiagnosticLogRecord>;
  return (
    typeof record.timestamp === 'string' &&
    Number.isFinite(Date.parse(record.timestamp)) &&
    ['debug', 'info', 'warn', 'error'].includes(String(record.level)) &&
    typeof record.scope === 'string' &&
    typeof record.message === 'string' &&
    (record.context === undefined || typeof record.context === 'object')
  );
}

export const diagnosticLogService = new DiagnosticLogClient();
