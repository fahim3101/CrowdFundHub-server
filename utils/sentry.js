// Optional error tracking — completely inert unless SENTRY_DSN is set.
// Add the DSN to server/.env locally and to Vercel env vars when ready;
// without it, not even the SDK is loaded.
let Sentry = null;

function initSentry() {
  if (!process.env.SENTRY_DSN || Sentry) return;
  Sentry = require('@sentry/node');
  Sentry.init({
    dsn: process.env.SENTRY_DSN,
    tracesSampleRate: 0.1,
  });
}

function captureError(err) {
  if (!Sentry) return;
  try {
    Sentry.captureException(err);
  } catch {
    // tracking must never break the response path
  }
}

module.exports = { initSentry, captureError };
