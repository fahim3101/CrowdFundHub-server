const express = require('express');
const Stripe = require('stripe');
const { getCollections } = require('../config/db');
const verifyToken = require('../middleware/verifyToken');
const { verifySupporter, verifyAdmin } = require('../middleware/verifyRoles');
const verifyOwner = require('../middleware/verifyOwner');

const router = express.Router();
const stripe = Stripe(process.env.STRIPE_SECRET_KEY);

// Server is the source of truth for price -> credits. Client can't invent credits.
const ALLOWED_PACKAGES = {
  10: 100,
  25: 300,
  60: 800,
  110: 1500,
};

// ---- Create a Stripe PaymentIntent for a credit package ----
router.post('/create-payment-intent', verifyToken, verifySupporter, async (req, res) => {
  const { price } = req.body; // price in whole dollars

  if (!ALLOWED_PACKAGES[price]) {
    return res.status(400).send({ message: 'Invalid package. Allowed prices: 10, 25, 60, 110' });
  }

  try {
    const paymentIntent = await stripe.paymentIntents.create({
      amount: Math.round(price * 100), // Stripe wants cents
      currency: 'usd',
      payment_method_types: ['card'],
    });

    res.send({ clientSecret: paymentIntent.client_secret });
  } catch (err) {
    console.error('Stripe intent failed:', err.message);
    res.status(500).send({ message: 'Could not create payment intent' });
  }
});

// ---- Save a completed payment + top up the supporter's credits ----
router.post('/payments', verifyToken, verifySupporter, async (req, res) => {
  const { paymentsCollection, usersCollection } = getCollections();
  const data = req.body;

  if (data.email !== req.decoded.email) {
    return res.status(403).send({ message: 'You can only top up your own account' });
  }
  if (!data.transactionId) {
    return res.status(400).send({ message: 'transactionId is required' });
  }
  const price = Number(data.price);
  const expectedCredits = ALLOWED_PACKAGES[price];
  if (!expectedCredits) {
    return res.status(400).send({ message: 'Invalid package price' });
  }
  if (Number(data.credits) !== expectedCredits) {
    return res.status(400).send({ message: 'Credits do not match price package' });
  }

  // Prevent replay: same Stripe intent can't credit twice
  const dup = await paymentsCollection.findOne({ transactionId: data.transactionId });
  if (dup) return res.status(400).send({ message: 'This payment was already processed' });

  // Verify with Stripe that this intent really succeeded for this amount
  try {
    const intent = await stripe.paymentIntents.retrieve(data.transactionId);
    if (intent.status !== 'succeeded') {
      return res.status(400).send({ message: 'Payment not succeeded yet' });
    }
    if (intent.amount !== Math.round(price * 100)) {
      return res.status(400).send({ message: 'Payment amount mismatch' });
    }
  } catch (err) {
    console.error('Stripe verify failed:', err.message);
    return res.status(400).send({ message: 'Could not verify payment with Stripe' });
  }

  const payment = {
    email: data.email,
    price,
    credits: expectedCredits,
    transactionId: data.transactionId,
    date: new Date(),
  };

  const result = await paymentsCollection.insertOne(payment);

  await usersCollection.updateOne(
    { email: data.email },
    { $inc: { credits: expectedCredits } }
  );

  res.send(result);
});

// ---- Supporter: their payment history ----
router.get('/payments/:email', verifyToken, verifySupporter, verifyOwner('email'), async (req, res) => {
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
