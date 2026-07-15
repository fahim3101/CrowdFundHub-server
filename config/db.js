const { MongoClient, ServerApiVersion } = require('mongodb');

const uri = process.env.MONGODB_URI;

const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  },
});

// All collections live here once connected, so every route file
// can just call getCollections() instead of connecting again.
let collections = {};

async function connectDB() {
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

  await client.db('admin').command({ ping: 1 });
  console.log('✅ MongoDB connected successfully');

  return collections;
}

function getCollections() {
  return collections;
}

module.exports = { connectDB, getCollections };
