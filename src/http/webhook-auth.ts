import { timingSafeEqual } from 'node:crypto';
import { IncomingMessage } from 'node:http';

export const WEBHOOK_TOKEN_MIN_LENGTH = 32;

export function isWebhookTokenConfigured(token: string | undefined): token is string {
  return typeof token === 'string' && token.length >= WEBHOOK_TOKEN_MIN_LENGTH;
}

/** Throws if WEBHOOK_TOKEN is missing or shorter than 32 characters. */
export function requireWebhookToken(token: string | undefined): string {
  if (!isWebhookTokenConfigured(token)) {
    throw new Error('WEBHOOK_TOKEN is missing or shorter than 32 characters');
  }
  return token;
}

/**
 * Constant-time Bearer compare, same shape as createTypefullyWebhook()
 * on codex/open-publisher-review-2026-09-29.
 */
export function authorizeWebhookRequest(req: IncomingMessage, token: string): boolean {
  const supplied = Buffer.from(req.headers.authorization || '');
  const expected = Buffer.from(`Bearer ${token}`);
  if (supplied.length !== expected.length) return false;
  return timingSafeEqual(supplied, expected);
}
