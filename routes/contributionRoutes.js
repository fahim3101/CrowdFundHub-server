const express = require('express');
const { ObjectId } = require('mongodb');
const { getCollections } = require('../config/db');
const verifyToken = require('../middleware/verifyToken');
const { verifySupporter, verifyCreator } = require('../middleware/verifyRoles');
const verifyOwner = require('../middleware/verifyOwner');
const { validateObjectId, ALLOWED_CONTRIBUTION_STATUS } = require('../utils/validate');
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

  // Basic sanity: positive integer amount, and supporter can only spend their own credits
  if (!Number.isFinite(amount) || !Number.isInteger(amount) || amount <= 0) {
    return res.status(400).send({ message: 'Contribution amount must be a positive integer' });
  }
  if (data.supporter_email !== req.decoded.email) {
    return res.status(403).send({ message: 'You can only contribute from your own account' });
  }
  if (!data.campaign_id) {
    return res.status(400).send({ message: 'campaign_id is required' });
  }

  // Campaign must exist, be approved, not expired
  let campaign;
  try {
    campaign = await campaignsCollection.findOne({ _id: new ObjectId(data.campaign_id) });
  } catch {
    return res.status(400).send({ message: 'Invalid campaign_id' });
  }
  if (!campaign) return res.status(404).send({ message: 'Campaign not found' });
  if (campaign.status !== 'approved') {
    return res.status(400).send({ message: 'This campaign is not accepting contributions right now' });
  }
  const today = new Date().toISOString().slice(0, 10);
  if (campaign.deadline && campaign.deadline < today) {
    return res.status(400).send({ message: 'This campaign has expired' });
  }
  if (amount < (campaign.minimum_contribution || 1)) {
    return res.status(400).send({ message: `Minimum contribution is ${campaign.minimum_contribution} credits` });
  }

  // Atomic hold: deduct only if balance is enough. Prevents double-spend on parallel requests.
  const deductRes = await usersCollection.updateOne(
    { email: data.supporter_email, credits: { $gte: amount } },
    { $inc: { credits: -amount } }
  );
  if (deductRes.modifiedCount === 0) {
    return res.status(400).send({ message: 'Not enough credits for this contribution' });
  }

  const contribution = {
    campaign_id: data.campaign_id,
    campaign_title: campaign.campaign_title,
    contribution_amount: amount,
    supporter_email: data.supporter_email,
    supporter_name: (data.supporter_name || '').slice(0, 100),
    creator_email: campaign.creator_email,
    creator_name: campaign.creator_name,
    current_date: new Date(),
    status: 'pending',
  };

  let result;
  try {
    result = await contributionsCollection.insertOne(contribution);
  } catch (err) {
    // Roll back the hold if insert fails
    await usersCollection.updateOne(
      { email: data.supporter_email },
      { $inc: { credits: amount } }
    );
    return res.status(500).send({ message: 'Could not save contribution' });
  }

  await sendNotification({
    message: `${contribution.supporter_name} contributed ${amount} credits to ${campaign.campaign_title}`,
    toEmail: campaign.creator_email,
    actionRoute: '/dashboard/creator-home',
  });

  await sendEmail({
    to: campaign.creator_email,
    subject: 'New contribution to review',
    html: wrapEmail(
      'New contribution received',
      `${contribution.supporter_name} contributed <strong>${amount} credits</strong> to <strong>${campaign.campaign_title}</strong>. It's waiting for your approval.`,
      `${CLIENT_URL}/dashboard/creator-home`
    ),
  });

  res.send(result);
});

// ---- Creator: contributions awaiting a decision, for their campaigns ----
router.get('/contributions/pending/:creatorEmail', verifyToken, verifyCreator, verifyOwner('creatorEmail'), async (req, res) => {
  const { contributionsCollection } = getCollections();
  const contributions = await contributionsCollection
    .find({ creator_email: req.params.creatorEmail, status: 'pending' })
    .sort({ current_date: -1 })
    .toArray();
  res.send(contributions);
});

// ---- Supporter: every contribution they've made (paginated) ----
router.get('/contributions/supporter/:email', verifyToken, verifySupporter, verifyOwner('email'), async (req, res) => {
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
router.get('/contributions/approved/:email', verifyToken, verifySupporter, verifyOwner('email'), async (req, res) => {
  const { contributionsCollection } = getCollections();
  const contributions = await contributionsCollection
    .find({ supporter_email: req.params.email, status: 'approved' })
    .sort({ current_date: -1 })
    .toArray();
  res.send(contributions);
});

// ---- Creator: approve or reject one contribution ----
router.patch('/contributions/status/:id', verifyToken, verifyCreator, validateObjectId('id'), async (req, res) => {
  const { contributionsCollection, campaignsCollection, usersCollection } = getCollections();
  const { status } = req.body; // 'approved' | 'rejected'
  if (!ALLOWED_CONTRIBUTION_STATUS.includes(status)) {
    return res.status(400).send({ message: 'Invalid status. Allowed: approved, rejected' });
  }

  const contribution = await contributionsCollection.findOne({ _id: new ObjectId(req.params.id) });
  if (!contribution) return res.status(404).send({ message: 'Contribution not found' });

  // Ownership: only the campaign owner can decide. Prevents creator A approving creator B's funds.
  if (contribution.creator_email !== req.decoded.email) {
    return res.status(403).send({ message: 'You do not own this campaign' });
  }

  // Idempotency: only pending can transition. Prevents double amount_raised / double refund.
  if (contribution.status !== 'pending') {
    return res.status(400).send({ message: `Already ${contribution.status}. Only pending contributions can be decided.` });
  }

  await contributionsCollection.updateOne(
    { _id: new ObjectId(req.params.id), status: 'pending' },
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
