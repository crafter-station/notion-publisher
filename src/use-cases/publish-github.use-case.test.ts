import assert from 'node:assert/strict';
import { test } from 'node:test';
import { resolveGithubReleaseDraft } from './publish-github.use-case';

test('GitHub Release draft defaults to true when options.draft is omitted', () => {
  assert.equal(resolveGithubReleaseDraft(), true);
  assert.equal(resolveGithubReleaseDraft(undefined), true);
});

test('GitHub Release draft stays false only when the caller sets draft:false', () => {
  assert.equal(resolveGithubReleaseDraft(false), false);
  assert.equal(resolveGithubReleaseDraft(true), true);
});
