import { redactDiagnosticText } from '../privacy.js';
import { setTimeout as delay } from 'node:timers/promises';

export class ProviderError extends Error {
  constructor(public readonly provider: string, public readonly code: string, message: string,
    public readonly details?: Record<string, unknown>) {
    super(message); this.name = 'ProviderError';
  }
}

/** Provider errors must never copy raw HTTP bodies, request headers or credentials. */
export function safeProviderError(provider: string, error: unknown): ProviderError {
  if (error instanceof ProviderError) return error;
  const value = error as { status?: number; statusCode?: number; code?: string } | null;
  const candidate = value?.status ?? value?.statusCode;
  const status = typeof candidate === 'number' && Number.isInteger(candidate) && candidate >= 400 && candidate <= 599 ? candidate : undefined;
  return new ProviderError(provider, status ? `HTTP_${status}` : 'REQUEST_FAILED',
    `${provider} request failed${status ? ` (HTTP ${status})` : ''}. Check server-side configuration and provider access.`);
}

export async function pollUntil<T>(read: () => Promise<T>, accept: (value: T) => boolean,
  options: { timeoutMs: number; intervalMs?: number; signal?: AbortSignal; description: string }): Promise<T> {
  const started = Date.now();
  while (true) {
    options.signal?.throwIfAborted();
    const value = await read();
    if (accept(value)) return value;
    if (Date.now() - started >= options.timeoutMs) {
      throw new ProviderError('provider', 'POLL_TIMEOUT', `Timed out waiting for ${options.description}.`);
    }
    await delay(options.intervalMs ?? 1500, undefined, { signal: options.signal });
  }
}

export function boundedText(value: string, max = 16_384): string {
  const redacted = redactDiagnosticText(value);
  return redacted.length > max ? `${redacted.slice(0, max)}\n[output truncated]` : redacted;
}
