export type LogLevel = 'debug' | 'info' | 'warn' | 'error';

export type LogContext = Record<string, unknown>;

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
    if (level === 'debug' && !import.meta.env.DEV) return;
    const prefix = `[DeepSeek Enhancer][${this.scope}]`;
    const args = context ? [prefix, message, context] : [prefix, message];

    if (level === 'debug') console.debug(...args);
    else if (level === 'info') console.info(...args);
    else if (level === 'warn') console.warn(...args);
    else console.error(...args);
  }
}

export const logger = new Logger('App');
