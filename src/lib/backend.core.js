// Pure, environment-free routing logic (unit-tested in backend.core.test.js).
//
// Testers sign in on the normal login page with a demo account. A demo session
// is routed to a separate, seeded database — the "/demo" backend running on the
// same server — so testers never see or touch live Solucio data. Every other
// sign-in is untouched and uses the live backend exactly as before.

// Accounts that, when used to sign in, switch the session into demo mode.
// These must NOT exist as real staff emails (checked before adding one).
export const DEMO_EMAILS = ['demo@solucio.com'];

export function isDemoLogin(email) {
  return DEMO_EMAILS.includes(String(email || '').trim().toLowerCase());
}

// Given whether this is a demo session and the live backend coordinates,
// return the API base URL, the origin for avatar/upload URLs, and the
// socket.io path. Demo sessions point at the /demo backend on the same host.
export function resolveBackend({ demo, liveApi, liveOrigin }) {
  if (!demo) {
    return { apiBase: liveApi, avatarOrigin: liveOrigin, socketPath: '/socket.io' };
  }
  return {
    apiBase: `${liveOrigin}/demo/api`,
    avatarOrigin: `${liveOrigin}/demo`,
    socketPath: '/demo/socket.io',
  };
}
