const express = require('express');
const { ObjectId } = require('mongodb');
const { getCollections } = require('../config/db');
const verifyToken = require('../middleware/verifyToken');
const { verifyCreator, verifyAdmin } = require('../middleware/verifyRoles');
const sendNotification = require('../utils/notify');
const sendEmail = require('../utils/mailer');
const wrapEmail = require('../utils/emailTemplates');

const router = express.Router();
const CLIENT_URL = process.env.CLIENT_URL || 'http://localhost:5173';

const CREDITS_PER_DOLLAR = 20;
const MIN_WITHDRAW_CREDITS = 200;

// ---- Creator: request a withdrawal ----
router.post('/withdrawals', verifyToken, verifyCreator, async (req, res) => {
  const { withdrawalsCollection, campaignsCollection } = getCollections();
  const data = req.body;
  const credits = Number(data.withdrawal_credit);

  if (credits < MIN_WITHDRAW_CREDITS) {
    return res.status(400).send({ message: `Minimum withdrawal is ${MIN_WITHDRAW_CREDITS} credits` });
  }

  // total raised across every approved campaign this creator owns
  const campaigns = await campaignsCollection.find({ creator_email: data.creator_email }).toArray();
  const totalRaised = campaigns.reduce((sum, c) => sum + (c.amount_raised || 0), 0);

  if (credits > totalRaised) {
    return res.status(400).send({ message: 'Insufficient credit' });
  }

  const withdrawal = {
    creator_email: data.creator_email,
    creator_name: data.creator_name,
    withdrawal_credit: credits,
    withdrawal_amount: credits / CREDITS_PER_DOLLAR,
    payment_system: data.payment_system,
    account_number: data.account_number,
    withdraw_date: new Date(),
    status: 'pending',
  };

  const result = await withdrawalsCollection.insertOne(withdrawal);
  res.send(result);
});

// ---- Creator: their own withdrawal / payment history ----
router.get('/withdrawals/creator/:email', verifyToken, verifyCreator, async (req, res) => {
  const { withdrawalsCollection } = getCollections();
  const withdrawals = await withdrawalsCollection
    .find({ creator_email: req.params.email })
    .sort({ withdraw_date: -1 })
    .toArray();
  res.send(withdrawals);
});

// ---- Admin: withdrawal requests waiting on payment ----
router.get('/withdrawals/pending', verifyToken, verifyAdmin, async (req, res) => {
  const { withdrawalsCollection } = getCollections();
  const withdrawals = await withdrawalsCollection
    .find({ status: 'pending' })
    .sort({ withdraw_date: -1 })
    .toArray();
  res.send(withdrawals);
});

// ---- Admin: mark a withdrawal as paid ----
router.patch('/withdrawals/approve/:id', verifyToken, verifyAdmin, async (req, res) => {
  const { withdrawalsCollection, campaignsCollection } = getCollections();

  const withdrawal = await withdrawalsCollection.findOne({ _id: new ObjectId(req.params.id) });
  if (!withdrawal) return res.status(404).send({ message: 'Withdrawal request not found' });

  await withdrawalsCollection.updateOne(
    { _id: new ObjectId(req.params.id) },
    { $set: { status: 'approved' } }
  );

  // pull the paid-out credits back out of this creator's raised totals,
  // oldest campaign first, so "amount_raised" always reflects money still on the platform
  let remaining = withdrawal.withdrawal_credit;
  const campaigns = await campaignsCollection
    .find({ creator_email: withdrawal.creator_email, amount_raised: { $gt: 0 } })
    .toArray();

  for (const campaign of campaigns) {
    if (remaining <= 0) break;
    const deduction = Math.min(campaign.amount_raised, remaining);
    await campaignsCollection.updateOne(
      { _id: campaign._id },
      { $inc: { amount_raised: -deduction } }
    );
    remaining -= deduction;
  }

  await sendNotification({
    message: `Your withdrawal of $${withdrawal.withdrawal_amount} was approved and paid`,
    toEmail: withdrawal.creator_email,
    actionRoute: '/dashboard/payment-history',
  });

  await sendEmail({
    to: withdrawal.creator_email,
    subject: 'Your withdrawal has been paid',
    html: wrapEmail(
      'Withdrawal paid',
      `Your withdrawal of <strong>${withdrawal.withdrawal_credit} credits ($${withdrawal.withdrawal_amount})</strong> via ${withdrawal.payment_system} has been approved and paid out.`,
      `${CLIENT_URL}/dashboard/payment-history`
    ),
  });

  res.send({ message: 'Withdrawal approved' });
});

module.exports = router;
