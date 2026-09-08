const { initializeApp, getApps, cert } = require('firebase-admin/app');
const { getAuth } = require('firebase-admin/auth');

// Initializes firebase-admin ONCE, purely from environment variables.
// Never hardcode or commit the service-account JSON.
//
// Required env vars (server/.env, and same in Vercel dashboard):
//   FIREBASE_PROJECT_ID=crowdfundhub
//   FIREBASE_CLIENT_EMAIL=firebase-adminsdk-...@crowdfundhub.iam.gserviceaccount.com
//   FIREBASE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\n....\n-----END PRIVATE KEY-----\n"
//     NOTE: keep the surrounding quotes. If the key comes from Vercel with
//     literal \n, we convert them to real newlines below.
//
// If any var is missing, verifyFirebaseIdToken throws a clear
// misconfiguration error instead of crashing.
function ensureInitialized() {
  if (getApps().length) return;

  const { FIREBASE_PROJECT_ID, FIREBASE_CLIENT_EMAIL, FIREBASE_PRIVATE_KEY } = process.env;

  if (!FIREBASE_PROJECT_ID || !FIREBASE_CLIENT_EMAIL || !FIREBASE_PRIVATE_KEY) {
    throw new Error(
      'Server misconfigured: FIREBASE_PROJECT_ID / FIREBASE_CLIENT_EMAIL / FIREBASE_PRIVATE_KEY missing'
    );
  }

  // Vercel / .env often store newlines as literal \n — restore them.
  // Also strip surrounding quotes if the user kept them in the value.
  let privateKey = FIREBASE_PRIVATE_KEY.replace(/\\n/g, '\n').trim();
  if (
    (privateKey.startsWith('"') && privateKey.endsWith('"')) ||
    (privateKey.startsWith("'") && privateKey.endsWith("'"))
  ) {
    privateKey = privateKey.slice(1, -1);
  }

  initializeApp({
    credential: cert({
      projectId: FIREBASE_PROJECT_ID,
      clientEmail: FIREBASE_CLIENT_EMAIL,
      privateKey,
    }),
  });
}

async function verifyFirebaseIdToken(idToken) {
  ensureInitialized();
  return getAuth().verifyIdToken(idToken);
}

module.exports = { verifyFirebaseIdToken };
