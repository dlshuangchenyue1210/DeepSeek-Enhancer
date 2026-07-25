import { browser } from 'wxt/browser';

import {
  DIAGNOSTIC_LOG_MESSAGE_TYPE,
  type DiagnosticLogRecord,
} from './diagnosticLogProtocol';

export type LogLevel = 'debug' | 'info' | 'warn' | 'error';

export type LogContext = Record<string, unknown>;

let diagnosticLoggingEnabled = false;

export function setDiagnosticLoggingEnabled(enabled: boolean): void {
  diagnosticLoggingEnabled = enabled;
}

export class Logger {
  constructor(private readonly scope: string) {}

  child(scope: string): Logger {
    return new Logger(`${this.scope}:${scope}`);
  }

  debug(message: string, context?: LogContext): void {
    this.write('debug', message, context);
  }

  info(message: string, context?: LogContext): void {
    this.write('info', message, context);
  }

  warn(message: string, context?: LogContext): void {
    this.write('warn', message, context);
  }

  error(message: string, context?: LogContext): void {
    this.write('error', message, context);
  }

  private write(level: LogLevel, message: string, context?: LogContext): void {
    if (level === 'debug' && !import.meta.env.DEV && !diagnosticLoggingEnabled) return;
    const record: DiagnosticLogRecord = {
      timestamp: new Date().toISOString(),
      level,
      scope: this.scope,
      message,
      ...(context ? { context: sanitizeContext(context) } : {}),
    };

    if (level === 'debug') console.debug(record);
    else if (level === 'info') console.info(record);
    else if (level === 'warn') console.warn(record);
    else console.error(record);

    if (!diagnosticLoggingEnabled) return;
    void browser.runtime
      .sendMessage({
        type: DIAGNOSTIC_LOG_MESSAGE_TYPE,
        command: { operation: 'append', record },
      })
      .catch(() => undefined);
  }
}

export const logger = new Logger('App');

function sanitizeContext(context: LogContext): LogContext {
  return sanitizeValue(context, new WeakSet<object>(), 0) as LogContext;
}

function sanitizeValue(value: unknown, seen: WeakSet<object>, depth: number): unknown {
  if (value === null || typeof value === 'boolean') return value;
  if (typeof value === 'string') return value.slice(0, 500);
  if (typeof value === 'number') return Number.isFinite(value) ? value : String(value);
  if (typeof value === 'undefined') return '[undefined]';
  if (typeof value === 'bigint' || typeof value === 'symbol' || typeof value === 'function') {
    return String(value);
  }
  if (value instanceof Error) {
    return { name: value.name, message: value.message.slice(0, 500) };
  }
  if (depth >= 4) return '[truncated]';
  if (Array.isArray(value)) {
    return value.slice(0, 20).map((item) => sanitizeValue(item, seen, depth + 1));
  }
  if (typeof value === 'object') {
    if (seen.has(value)) return '[circular]';
    seen.add(value);
    const result: Record<string, unknown> = {};
    for (const [key, item] of Object.entries(value).slice(0, 20)) {
      result[key] = sanitizeValue(item, seen, depth + 1);
    }
    return result;
  }
  return String(value);
}
