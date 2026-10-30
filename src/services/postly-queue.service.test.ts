import assert from 'node:assert/strict';
import { test } from 'node:test';
import { processNextPostlyQueueItem } from './postly-queue.service';

test('Postly queue dry-runs and does not call Postly when the live gate is closed', async () => {
  const originalFetch = globalThis.fetch;
  let fetchCalls = 0;
  globalThis.fetch = (async () => {
    fetchCalls += 1;
    throw new Error('Postly must not be called');
  }) as typeof fetch;
  try {
    const result = await processNextPostlyQueueItem();
    assert.equal(result.status, 'dry-run');
    assert.equal(result.called_publish, false);
    assert.equal(typeof result.reason, 'string');
    assert.equal(fetchCalls, 0);
  } finally {
    globalThis.fetch = originalFetch;
  }
});
