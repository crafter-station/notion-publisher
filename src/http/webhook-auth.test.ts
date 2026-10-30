import assert from 'node:assert/strict';
import { IncomingMessage } from 'node:http';
import { test } from 'node:test';
import {
  authorizeWebhookRequest,
  requireWebhookToken,
  WEBHOOK_TOKEN_MIN_LENGTH,
} from './webhook-auth';

const TOKEN = 'a'.repeat(WEBHOOK_TOKEN_MIN_LENGTH);

function req(authorization?: string): IncomingMessage {
  return { headers: authorization ? { authorization } : {} } as IncomingMessage;
}

test('requireWebhookToken rejects missing and short tokens', () => {
  assert.throws(() => requireWebhookToken(undefined), /32 characters/);
  assert.throws(() => requireWebhookToken(''), /32 characters/);
  assert.throws(() => requireWebhookToken('short'), /32 characters/);
  assert.equal(requireWebhookToken(TOKEN), TOKEN);
});

test('authorizeWebhookRequest accepts only the exact Bearer token', () => {
  assert.equal(authorizeWebhookRequest(req(`Bearer ${TOKEN}`), TOKEN), true);
  assert.equal(authorizeWebhookRequest(req(), TOKEN), false);
  assert.equal(authorizeWebhookRequest(req(`Bearer ${'b'.repeat(32)}`), TOKEN), false);
  assert.equal(authorizeWebhookRequest(req(TOKEN), TOKEN), false);
});
