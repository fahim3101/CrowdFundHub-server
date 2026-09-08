const express = require('express');
const jwt = require('jsonwebtoken');
const { ObjectId } = require('mongodb');
const { getCollections } = require('../config/db');
const verifyToken = require('../middleware/verifyToken');
const { verifyAdmin } = require('../middleware/verifyRoles');
const verifyOwner = require('../middleware/verifyOwner');
const { validateObjectId, ALLOWED_ROLES } = require('../utils/validate');

const router = express.Router();

// ---- Issue a JWT for an already-authenticated (Firebase) user ----
// Client calls this right after Firebase login/register succeeds.
// TODO(security): verify Firebase ID token with firebase-admin instead of trusting email.
// Until then: short expiry (1d), strict email format, and rate-limit this route via gateway.
router.post('/jwt', (req, res) => {
  const { email } = req.body;
  if (!email || typeof email !== 'string' || !email.includes('@') || email.length > 254) {
    return res.status(400).send({ message: 'Valid email is required' });
  }
  if (!process.env.JWT_SECRET) {
    return res.status(500).send({ message: 'Server misconfigured: JWT_SECRET missing' });
  }

  const token = jwt.sign({ email }, process.env.JWT_SECRET, { expiresIn: '1d' });
  res.send({ token });
});

// ---- Register a new user (called once, right after Firebase signup) ----
// NOTE: existing users are NEVER role-changed here. Role change is admin-only
// via PATCH /users/role/:id. This prevents role hijack + Google-login downgrade.
router.post('/users', async (req, res) => {
  const { usersCollection } = getCollections();
  const newUser = req.body;

  if (!newUser.email || !newUser.email.includes('@')) {
    return res.status(400).send({ message: 'Valid email is required' });
  }

  const existing = await usersCollection.findOne({ email: newUser.email });
  if (existing) {
    // Already exists - don't re-grant credits, don't touch role
    return res.send({ message: 'User already exists', insertedId: null });
  }

  // Normalize role to lowercase
  const userRole = (newUser.role || '').toLowerCase();
  const isCreator = userRole === 'creator';

  // Starting credits depend on role, granted exactly once, here at creation time
  const startingCredits = isCreator ? 20 : 50;

  const userDoc = {
    name: (newUser.name || '').slice(0, 100),
    email: newUser.email,
    photoURL: (newUser.photoURL || '').slice(0, 500),
    role: isCreator ? 'creator' : 'supporter',
    credits: startingCredits,
    createdAt: new Date(),
  };

  const result = await usersCollection.insertOne(userDoc);
  res.send(result);
});

// ---- Get a user's role + credits (used right after login to route the dashboard) ----
router.get('/users/role/:email', verifyToken, verifyOwner('email'), async (req, res) => {
  const { usersCollection } = getCollections();
  const user = await usersCollection.findOne({ email: req.params.email });
  if (!user) return res.status(404).send({ message: 'User not found' });
  res.send({ role: user.role, credits: user.credits, name: user.name, photoURL: user.photoURL });
});

// ---- Get single user credits (used a lot across the dashboard for the topbar) ----
router.get('/users/:email', verifyToken, verifyOwner('email'), async (req, res) => {
  const { usersCollection } = getCollections();
  const user = await usersCollection.findOne({ email: req.params.email });
  if (!user) return res.status(404).send({ message: 'User not found' });
  res.send(user);
});

// ---- Admin: get every user ----
router.get('/users', verifyToken, verifyAdmin, async (req, res) => {
  const { usersCollection } = getCollections();
  const users = await usersCollection.find().sort({ createdAt: -1 }).toArray();
  res.send(users);
});

// ---- Self: update own name / photo (profile page) ----
router.patch('/users/profile/:email', verifyToken, verifyOwner('email'), async (req, res) => {
  const { usersCollection } = getCollections();
  const updates = {};
  if (typeof req.body.name === 'string' && req.body.name.trim()) {
    updates.name = req.body.name.trim().slice(0, 100);
  }
  if (typeof req.body.photoURL === 'string') {
    updates.photoURL = req.body.photoURL.slice(0, 500);
  }
  if (Object.keys(updates).length === 0) {
    return res.status(400).send({ message: 'Nothing to update (name / photoURL)' });
  }
  const result = await usersCollection.updateOne(
    { email: req.params.email },
    { $set: updates }
  );
  res.send(result);
});

// ---- Admin: change a user's role ----
router.patch('/users/role/:id', verifyToken, verifyAdmin, validateObjectId('id'), async (req, res) => {
  const { usersCollection } = getCollections();
  const { role } = req.body;
  if (!ALLOWED_ROLES.includes(role)) {
    return res.status(400).send({ message: 'Invalid role. Allowed: supporter, creator, admin' });
  }
  const result = await usersCollection.updateOne(
    { _id: new ObjectId(req.params.id) },
    { $set: { role } }
  );
  res.send(result);
});

// ---- Admin: remove a user ----
router.delete('/users/:id', verifyToken, verifyAdmin, validateObjectId('id'), async (req, res) => {
  const { usersCollection } = getCollections();
  const result = await usersCollection.deleteOne({ _id: new ObjectId(req.params.id) });
  res.send(result);
});

module.exports = router;
