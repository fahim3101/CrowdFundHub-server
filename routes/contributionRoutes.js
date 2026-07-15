const express = require('express');
const { ObjectId } = require('mongodb');
const { getCollections } = require('../config/db');
const verifyToken = require('../middleware/verifyToken');
const { verifySupporter, verifyCreator } = require('../middleware/verifyRoles');
const sendNotification = require('../utils/notify');
const sendEmail = require('../utils/mailer');
const wrapEmail = require('../utils/emailTemplates');

const router = express.Router();
const CLIENT_URL = process.env.CLIENT_URL || 'http://localhost:5173';

// ---- Supporter: contribute credits to a campaign ----
router.post('/contributions', verifyToken, verifySupporter, async (req, res) => {
  const { contributionsCollection, usersCollection, campaignsCollection } = getCollections();
  const data = req.body;
  const amount = Number(data.contribution_amount);

  const supporter = await usersCollection.findOne({ email: data.supporter_email });
  if (!supporter || supporter.credits < amount) {
    return res.status(400).send({ message: 'Not enough credits for this contribution' });
  }

  const contribution = {
    campaign_id: data.campaign_id,
    campaign_title: data.campaign_title,
    contribution_amount: amount,
    supporter_email: data.supporter_email,
    supporter_name: data.supporter_name,
    creator_email: data.creator_email,
    creator_name: data.creator_name,
    current_date: new Date(),
    status: 'pending',
  };

  const result = await contributionsCollection.insertOne(contribution);

  // Hold the credits by deducting immediately; rejection refunds them later
  await usersCollection.updateOne(
    { email: data.supporter_email },
    { $inc: { credits: -amount } }
  );

  await sendNotification({
    message: `${data.supporter_name} contributed ${amount} credits to ${data.campaign_title}`,
    toEmail: data.creator_email,
    actionRoute: '/dashboard/creator-home',
  });

  await sendEmail({
    to: data.creator_email,
    subject: 'New contribution to review',
    html: wrapEmail(
      'New contribution received',
      `${data.supporter_name} contributed <strong>${amount} credits</strong> to <strong>${data.campaign_title}</strong>. It's waiting for your approval.`,
      `${CLIENT_URL}/dashboard/creator-home`
    ),
  });

  res.send(result);
});

// ---- Creator: contributions awaiting a decision, for their campaigns ----
router.get('/contributions/pending/:creatorEmail', verifyToken, verifyCreator, async (req, res) => {
  const { contributionsCollection } = getCollections();
  const contributions = await contributionsCollection
    .find({ creator_email: req.params.creatorEmail, status: 'pending' })
    .sort({ current_date: -1 })
    .toArray();
  res.send(contributions);
});

// ---- Supporter: every contribution they've made (paginated) ----
router.get('/contributions/supporter/:email', verifyToken, verifySupporter, async (req, res) => {
  const { contributionsCollection } = getCollections();
  const page = parseInt(req.query.page) || 0;
  const limit = parseInt(req.query.limit) || 5;

  const query = { supporter_email: req.params.email };
  const total = await contributionsCollection.countDocuments(query);
  const contributions = await contributionsCollection
    .find(query)
    .sort({ current_date: -1 })
    .skip(page * limit)
    .limit(limit)
    .toArray();

  res.send({ contributions, total });
});

// ---- Supporter: only the approved ones, for the home page state table ----
router.get('/contributions/approved/:email', verifyToken, verifySupporter, async (req, res) => {
  const { contributionsCollection } = getCollections();
  const contributions = await contributionsCollection
    .find({ supporter_email: req.params.email, status: 'approved' })
    .sort({ current_date: -1 })
    .toArray();
  res.send(contributions);
});

// ---- Creator: approve or reject one contribution ----
router.patch('/contributions/status/:id', verifyToken, verifyCreator, async (req, res) => {
  const { contributionsCollection, campaignsCollection, usersCollection } = getCollections();
  const { status } = req.body; // 'approved' | 'rejected'

  const contribution = await contributionsCollection.findOne({ _id: new ObjectId(req.params.id) });
  if (!contribution) return res.status(404).send({ message: 'Contribution not found' });

  await contributionsCollection.updateOne(
    { _id: new ObjectId(req.params.id) },
    { $set: { status } }
  );

  if (status === 'approved') {
    await campaignsCollection.updateOne(
      { _id: new ObjectId(contribution.campaign_id) },
      { $inc: { amount_raised: contribution.contribution_amount } }
    );
  }

  if (status === 'rejected') {
    // credits were deducted at contribution time, give them back
    await usersCollection.updateOne(
      { email: contribution.supporter_email },
      { $inc: { credits: contribution.contribution_amount } }
    );
  }

  await sendNotification({
    message: `Your contribution of ${contribution.contribution_amount} credits to ${contribution.campaign_title} was ${status} by ${contribution.creator_name}`,
    toEmail: contribution.supporter_email,
    actionRoute: '/dashboard/supporter-home',
  });

  await sendEmail({
    to: contribution.supporter_email,
    subject: `Your contribution was ${status}`,
    html: wrapEmail(
      `Contribution ${status}`,
      `Your contribution of <strong>${contribution.contribution_amount} credits</strong> to <strong>${contribution.campaign_title}</strong> was ${status} by ${contribution.creator_name}.`,
      `${CLIENT_URL}/dashboard/supporter-home`
    ),
  });

  res.send({ message: `Contribution ${status}` });
});

module.exports = router;
