const express = require('express');
const Stripe = require('stripe');
const { getCollections } = require('../config/db');
const verifyToken = require('../middleware/verifyToken');
const { verifySupporter, verifyAdmin } = require('../middleware/verifyRoles');

const router = express.Router();
const stripe = Stripe(process.env.STRIPE_SECRET_KEY);

// ---- Create a Stripe PaymentIntent for a credit package ----
router.post('/create-payment-intent', verifyToken, verifySupporter, async (req, res) => {
  const { price } = req.body; // price in whole dollars

  if (!price || price < 1) {
    return res.status(400).send({ message: 'Invalid price' });
  }

  const paymentIntent = await stripe.paymentIntents.create({
    amount: Math.round(price * 100), // Stripe wants cents
    currency: 'usd',
    payment_method_types: ['card'],
  });

  res.send({ clientSecret: paymentIntent.client_secret });
});

// ---- Save a completed payment + top up the supporter's credits ----
router.post('/payments', verifyToken, verifySupporter, async (req, res) => {
  const { paymentsCollection, usersCollection } = getCollections();
  const data = req.body;

  const payment = {
    email: data.email,
    price: data.price,
    credits: data.credits,
    transactionId: data.transactionId,
    date: new Date(),
  };

  const result = await paymentsCollection.insertOne(payment);

  await usersCollection.updateOne(
    { email: data.email },
    { $inc: { credits: data.credits } }
  );

  res.send(result);
});

// ---- Supporter: their payment history ----
router.get('/payments/:email', verifyToken, verifySupporter, async (req, res) => {
  const { paymentsCollection } = getCollections();
  const payments = await paymentsCollection
    .find({ email: req.params.email })
    .sort({ date: -1 })
    .toArray();
  res.send(payments);
});

// ---- Admin: total payments processed platform-wide (for Admin Home states) ----
router.get('/payments-count', verifyToken, verifyAdmin, async (req, res) => {
  const { paymentsCollection } = getCollections();
  const count = await paymentsCollection.countDocuments();
  res.send({ count });
});

module.exports = router;
