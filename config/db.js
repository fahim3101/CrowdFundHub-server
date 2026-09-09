const { MongoClient, ServerApiVersion } = require('mongodb');

// NOTE: MongoClient is created LAZILY inside connectDB(), never at import time.
// If we did `new MongoClient(process.env.MONGODB_URI)` at the top level and the
// env var was missing on Vercel, the require() itself would throw and EVERY
// route (even GET /) would return FUNCTION_INVOCATION_FAILED. Lazy init turns
// that into a clean 500 JSON via index.js's try/catch instead.
let client = null;

// All collections live here once connected, so every route file
// can just call getCollections() instead of connecting again.
let collections = {};

// Cache the connection PROMISE (not just a boolean), so that if several
// requests arrive at once on a cold serverless start, they all await the
// same in-flight connection instead of each trying to connect separately.
let connectionPromise = null;

async function connectDB() {
  if (connectionPromise) return connectionPromise;

  connectionPromise = (async () => {
    const uri = process.env.MONGODB_URI;
    if (!uri) {
      throw new Error('Server misconfigured: MONGODB_URI missing');
    }
    if (!client) {
      client = new MongoClient(uri, {
        serverApi: {
          version: ServerApiVersion.v1,
          strict: true,
          deprecationErrors: true,
        },
        // Fail fast instead of hanging forever if Atlas is unreachable —
        // this is what turns a silent 504 timeout into a real, visible error.
        serverSelectionTimeoutMS: 8000,
      });
    }
    await client.connect();
    const db = client.db('crowdfundHubDB');

    collections = {
      usersCollection: db.collection('users'),
      campaignsCollection: db.collection('campaigns'),
      contributionsCollection: db.collection('contributions'),
      withdrawalsCollection: db.collection('withdrawals'),
      paymentsCollection: db.collection('payments'),
      notificationsCollection: db.collection('notifications'),
      reportsCollection: db.collection('reports'),
    };

    // Indexes for common queries (safe to re-run, no-ops if they exist)
    try {
      await collections.usersCollection.createIndex({ email: 1 }, { unique: true });
      await collections.campaignsCollection.createIndex({ status: 1, deadline: 1 });
      await collections.campaignsCollection.createIndex({ creator_email: 1 });
      await collections.contributionsCollection.createIndex({ supporter_email: 1, current_date: -1 });
      await collections.contributionsCollection.createIndex({ creator_email: 1, status: 1 });
      await collections.withdrawalsCollection.createIndex({ creator_email: 1, status: 1 });
      await collections.paymentsCollection.createIndex({ transactionId: 1 }, { unique: true });
      await collections.notificationsCollection.createIndex({ toEmail: 1, time: -1 });
    } catch (idxErr) {
      console.error('Index creation warning:', idxErr.message);
    }

    await client.db('admin').command({ ping: 1 });

    return collections;
  })();

  try {
    return await connectionPromise;
  } catch (err) {
    // Let the next request try again instead of being stuck with a dead promise forever
    connectionPromise = null;
    throw err;
  }
}

function getCollections() {
  return collections;
}

// Closes the shared client (used by tests / graceful shutdown).
// Safe to call when never connected.
async function closeDB() {
  connectionPromise = null;
  collections = {};
  if (client) {
    const c = client;
    client = null;
    await c.close();
  }
}

module.exports = { connectDB, getCollections, closeDB };