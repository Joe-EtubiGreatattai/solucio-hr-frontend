import { test } from 'node:test';
import assert from 'node:assert/strict';
import { isDemoLogin, resolveBackend } from './backend.core.js';

test('isDemoLogin matches the demo account, case/space-insensitively', () => {
  assert.equal(isDemoLogin('demo@solucio.com'), true);
  assert.equal(isDemoLogin('  Demo@Solucio.com '), true);
});

test('isDemoLogin rejects live accounts and junk', () => {
  assert.equal(isDemoLogin('admin@solucio.com'), false);
  assert.equal(isDemoLogin('tijani@solucio.com'), false);
  assert.equal(isDemoLogin(''), false);
  assert.equal(isDemoLogin(undefined), false);
});

test('resolveBackend leaves live sessions on the live backend', () => {
  const r = resolveBackend({ demo: false, liveApi: 'https://host/api', liveOrigin: 'https://host' });
  assert.deepEqual(r, { apiBase: 'https://host/api', avatarOrigin: 'https://host', socketPath: '/socket.io' });
});

test('resolveBackend routes demo sessions to the /demo backend on the same host', () => {
  const r = resolveBackend({ demo: true, liveApi: 'https://host/api', liveOrigin: 'https://host' });
  assert.deepEqual(r, { apiBase: 'https://host/demo/api', avatarOrigin: 'https://host/demo', socketPath: '/demo/socket.io' });
});
