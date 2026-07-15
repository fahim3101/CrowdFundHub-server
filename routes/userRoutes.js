const express = require('express');
const jwt = require('jsonwebtoken');
const { ObjectId } = require('mongodb');
const { getCollections } = require('../config/db');
const verifyToken = require('../middleware/verifyToken');
const { verifyAdmin } = require('../middleware/verifyRoles');

const router = express.Router();

// ---- Issue a JWT for an already-authenticated (Firebase) user ----
// Client calls this right after Firebase login/register succeeds.
router.post('/jwt', (req, res) => {
  const { email } = req.body;
  if (!email) return res.status(400).send({ message: 'Email is required' });

  const token = jwt.sign({ email }, process.env.JWT_SECRET, { expiresIn: '7d' });
  res.send({ token });
});

// ---- Register a new user (called once, right after Firebase signup) ----
router.post('/users', async (req, res) => {
  const { usersCollection } = getCollections();
  const newUser = req.body;

  // Log the full request for debugging
  console.log('=== Creating user ===');
  console.log('Email:', newUser.email);
  console.log('Role sent:', newUser.role);
  console.log('=====================');

  const existing = await usersCollection.findOne({ email: newUser.email });
  if (existing) {
    // Check if role needs to be updated (e.g., supporter -> creator)
    const userRole = (newUser.role || '').toLowerCase();
    console.log('Existing role:', existing.role, 'New role:', userRole);
    if (existing.role !== userRole && (userRole === 'creator' || userRole === 'supporter')) {
      await usersCollection.updateOne(
        { email: newUser.email },
        { $set: { role: userRole } }
      );
      console.log('Updated user role to:', userRole);
      return res.send({ message: 'User role updated', insertedId: existing._id });
    }
    // Already exists - don't re-grant credits
    return res.send({ message: 'User already exists', insertedId: null });
  }

  // Normalize role to lowercase
  const userRole = (newUser.role || '').toLowerCase();
  const isCreator = userRole === 'creator';

  console.log('Final userRole:', userRole, 'isCreator:', isCreator);

  // Starting credits depend on role, granted exactly once, here at creation time
  const startingCredits = isCreator ? 20 : 50;

  const userDoc = {
    name: newUser.name,
    email: newUser.email,
    photoURL: newUser.photoURL || '',
    role: isCreator ? 'creator' : 'supporter',
    credits: startingCredits,
    createdAt: new Date(),
  };

  console.log('Inserting userDoc with role:', userDoc.role);

  const result = await usersCollection.insertOne(userDoc);
  res.send(result);
});

// ---- Get a user's role + credits (used right after login to route the dashboard) ----
router.get('/users/role/:email', verifyToken, async (req, res) => {
  const { usersCollection } = getCollections();
  const user = await usersCollection.findOne({ email: req.params.email });
  if (!user) return res.status(404).send({ message: 'User not found' });
  res.send({ role: user.role, credits: user.credits, name: user.name, photoURL: user.photoURL });
});

// ---- Get single user credits (used a lot across the dashboard for the topbar) ----
router.get('/users/:email', verifyToken, async (req, res) => {
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

// ---- Admin: change a user's role ----
router.patch('/users/role/:id', verifyToken, verifyAdmin, async (req, res) => {
  const { usersCollection } = getCollections();
  const { role } = req.body;
  const result = await usersCollection.updateOne(
    { _id: new ObjectId(req.params.id) },
    { $set: { role } }
  );
  res.send(result);
});

// ---- Admin: remove a user ----
router.delete('/users/:id', verifyToken, verifyAdmin, async (req, res) => {
  const { usersCollection } = getCollections();
  const result = await usersCollection.deleteOne({ _id: new ObjectId(req.params.id) });
  res.send(result);
});

module.exports = router;
