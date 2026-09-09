const express = require('express');
const { ObjectId } = require('mongodb');
const { getCollections } = require('../config/db');
const verifyToken = require('../middleware/verifyToken');
const { verifyCreator, verifyAdmin } = require('../middleware/verifyRoles');
const verifyOwner = require('../middleware/verifyOwner');
const { validateObjectId, ALLOWED_CAMPAIGN_STATUS } = require('../utils/validate');
const sendNotification = require('../utils/notify');
const sendEmail = require('../utils/mailer');
const wrapEmail = require('../utils/emailTemplates');

const router = express.Router();
const CLIENT_URL = process.env.CLIENT_URL || 'http://localhost:5173';

const ALLOWED_CATEGORIES = ['Technology', 'Art', 'Community', 'Health', 'Environment', 'Education'];

const escapeRegex = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

// ---- Public: browse approved, still-open campaigns (Explore Campaigns page) ----
// Supports ?search=&category=&sort=
// Built with the MongoDB aggregation framework ($match + $sort) so filtering
// happens on the database side, not by pulling every document into Node first.
router.get('/campaigns', async (req, res) => {
  const { campaignsCollection } = getCollections();
  const search = typeof req.query.search === 'string' ? req.query.search.slice(0, 100) : '';
  const category = typeof req.query.category === 'string' ? req.query.category.slice(0, 50) : 'all';
  const sort = typeof req.query.sort === 'string' ? req.query.sort : '';

  const matchStage = {
    status: 'approved',
    deadline: { $gte: new Date().toISOString().slice(0, 10) },
  };
  if (category && category !== 'all' && ALLOWED_CATEGORIES.includes(category)) matchStage.category = category;
  if (search) matchStage.campaign_title = { $regex: escapeRegex(search), $options: 'i' };

  const sortStage = {};
  if (sort === 'goal-asc') sortStage.funding_goal = 1;
  else if (sort === 'goal-desc') sortStage.funding_goal = -1;
  else if (sort === 'deadline') sortStage.deadline = 1;
  else sortStage.createdAt = -1;

  const pipeline = [
    { $match: matchStage },
    { $sort: sortStage },
  ];

  const campaigns = await campaignsCollection.aggregate(pipeline).toArray();
  res.send(campaigns);
});

// ---- Public: top 6 funded campaigns for the homepage ----
router.get('/campaigns/top-funded', async (req, res) => {
  const { campaignsCollection } = getCollections();
  const campaigns = await campaignsCollection
    .find({ status: 'approved', deadline: { $gte: new Date().toISOString().slice(0, 10) } })
    .sort({ amount_raised: -1 })
    .limit(6)
    .toArray();
  res.send(campaigns);
});

// ---- Creator: campaigns they launched ----
router.get('/campaigns/creator/:email', verifyToken, verifyCreator, verifyOwner('email'), async (req, res) => {
  const { campaignsCollection } = getCollections();
  const campaigns = await campaignsCollection
    .find({ creator_email: req.params.email })
    .sort({ deadline: -1 })
    .toArray();
  res.send(campaigns);
});

// ---- Admin: campaigns waiting for approval ----
router.get('/campaigns/pending', verifyToken, verifyAdmin, async (req, res) => {
  const { campaignsCollection } = getCollections();
  const campaigns = await campaignsCollection.find({ status: 'pending' }).toArray();
  res.send(campaigns);
});

// ---- Admin: every campaign, for the Manage Campaigns table ----
router.get('/campaigns/all', verifyToken, verifyAdmin, async (req, res) => {
  const { campaignsCollection } = getCollections();
  const campaigns = await campaignsCollection.find().sort({ createdAt: -1 }).toArray();
  res.send(campaigns);
});

// ---- Single campaign details ----
router.get('/campaigns/:id', validateObjectId('id'), async (req, res) => {
  const { campaignsCollection } = getCollections();
  const campaign = await campaignsCollection.findOne({ _id: new ObjectId(req.params.id) });
  if (!campaign) return res.status(404).send({ message: 'Campaign not found' });
  res.send(campaign);
});

// ---- Creator: launch a new campaign (goes in as "pending") ----
router.post('/campaigns', verifyToken, verifyCreator, async (req, res) => {
  const { campaignsCollection } = getCollections();
  const data = req.body;

  // Ownership: creators can only launch as themselves (prevents spoofing other creators).
  if (data.creator_email !== req.decoded.email) {
    return res.status(403).send({ message: 'You can only launch campaigns as yourself' });
  }
  const title = String(data.campaign_title || '').trim();
  const story = String(data.campaign_story || '').trim();
  const reward = String(data.reward_info || '').trim();
  const category = String(data.category || '').trim();
  const goal = Number(data.funding_goal);
  const minCon = Number(data.minimum_contribution);
  const deadline = String(data.deadline || '').slice(0, 10);
  const today = new Date().toISOString().slice(0, 10);

  if (!title || title.length > 200) return res.status(400).send({ message: 'Campaign title is required (max 200 chars)' });
  if (!story) return res.status(400).send({ message: 'Campaign story is required' });
  if (!ALLOWED_CATEGORIES.includes(category)) return res.status(400).send({ message: `Invalid category. Allowed: ${ALLOWED_CATEGORIES.join(', ')}` });
  if (!Number.isInteger(goal) || goal <= 0) return res.status(400).send({ message: 'Funding goal must be a positive integer' });
  if (!Number.isInteger(minCon) || minCon <= 0) return res.status(400).send({ message: 'Minimum contribution must be a positive integer' });
  if (minCon > goal) return res.status(400).send({ message: 'Minimum contribution cannot exceed funding goal' });
  if (!/^\d{4}-\d{2}-\d{2}$/.test(deadline) || deadline < today) {
    return res.status(400).send({ message: 'Deadline must be today or later (YYYY-MM-DD)' });
  }
  if (!reward) return res.status(400).send({ message: 'Reward info is required' });

  const campaign = {
    campaign_title: title.slice(0, 200),
    campaign_story: story,
    category,
    funding_goal: goal,
    minimum_contribution: minCon,
    deadline,
    reward_info: reward.slice(0, 1000),
    campaign_image_url: String(data.campaign_image_url || '').slice(0, 1000),
    creator_email: data.creator_email,
    creator_name: String(data.creator_name || '').slice(0, 100),
    amount_raised: 0,
    status: 'pending',
    createdAt: new Date(),
  };

  const result = await campaignsCollection.insertOne(campaign);
  res.send(result);
});

// ---- Creator: edit title / story / reward only ----
router.patch('/campaigns/:id', verifyToken, verifyCreator, validateObjectId('id'), async (req, res) => {
  const { campaignsCollection } = getCollections();

  const campaign = await campaignsCollection.findOne({ _id: new ObjectId(req.params.id) });
  if (!campaign) return res.status(404).send({ message: 'Campaign not found' });
  if (campaign.creator_email !== req.decoded.email) {
    return res.status(403).send({ message: 'You do not own this campaign' });
  }

  const updates = {};
  if (req.body.campaign_title !== undefined) {
    const t = String(req.body.campaign_title || '').trim();
    if (!t) return res.status(400).send({ message: 'Campaign title cannot be empty' });
    updates.campaign_title = t.slice(0, 200);
  }
  if (req.body.campaign_story !== undefined) {
    const s = String(req.body.campaign_story || '').trim();
    if (!s) return res.status(400).send({ message: 'Campaign story cannot be empty' });
    updates.campaign_story = s;
  }
  if (req.body.reward_info !== undefined) {
    const r = String(req.body.reward_info || '').trim();
    if (!r) return res.status(400).send({ message: 'Reward info cannot be empty' });
    updates.reward_info = r.slice(0, 1000);
  }
  if (Object.keys(updates).length === 0) {
    return res.status(400).send({ message: 'Nothing to update (campaign_title / campaign_story / reward_info)' });
  }

  const result = await campaignsCollection.updateOne(
    { _id: new ObjectId(req.params.id) },
    { $set: updates }
  );
  res.send(result);
});

// ---- Creator: delete a campaign + refund every non-rejected supporter ----
router.delete('/campaigns/:id', verifyToken, verifyCreator, validateObjectId('id'), async (req, res) => {
  const { campaignsCollection, contributionsCollection, usersCollection, reportsCollection } = getCollections();
  const campaignId = req.params.id;

  const campaign = await campaignsCollection.findOne({ _id: new ObjectId(campaignId) });
  if (!campaign) return res.status(404).send({ message: 'Campaign not found' });
  if (campaign.creator_email !== req.decoded.email) {
    return res.status(403).send({ message: 'You do not own this campaign' });
  }

  // Both pending (held) and approved credits were deducted at contribute time, so refund both.
  // Rejected were already refunded — skip them.
  const refundable = await contributionsCollection
    .find({ campaign_id: campaignId, status: { $in: ['pending', 'approved'] } })
    .toArray();

  for (const c of refundable) {
    await usersCollection.updateOne(
      { email: c.supporter_email },
      { $inc: { credits: c.contribution_amount } }
    );
  }

  await campaignsCollection.deleteOne({ _id: new ObjectId(campaignId) });
  await contributionsCollection.deleteMany({ campaign_id: campaignId });
  await reportsCollection.deleteMany({ campaign_id: campaignId });

  res.send({ message: 'Campaign deleted and supporters refunded', refundedCount: refundable.length });
});

// ---- Admin: approve or reject a campaign ----
router.patch('/campaigns/status/:id', verifyToken, verifyAdmin, validateObjectId('id'), async (req, res) => {
  const { campaignsCollection } = getCollections();
  const { status } = req.body; // 'approved' | 'rejected'
  if (!ALLOWED_CAMPAIGN_STATUS.includes(status)) {
    return res.status(400).send({ message: 'Invalid status. Allowed: approved, rejected' });
  }

  const campaign = await campaignsCollection.findOne({ _id: new ObjectId(req.params.id) });
  if (!campaign) return res.status(404).send({ message: 'Campaign not found' });

  // Approving an already-expired campaign hides it from Explore instantly — block it.
  if (status === 'approved' && campaign.deadline) {
    const today = new Date().toISOString().slice(0, 10);
    if (campaign.deadline < today) {
      return res.status(400).send({ message: 'Cannot approve an expired campaign (deadline in the past)' });
    }
  }

  await campaignsCollection.updateOne(
    { _id: new ObjectId(req.params.id) },
    { $set: { status } }
  );

  await sendNotification({
    message: `Your campaign "${campaign.campaign_title}" was ${status} by the admin`,
    toEmail: campaign.creator_email,
    actionRoute: '/dashboard/my-campaigns',
  });

  await sendEmail({
    to: campaign.creator_email,
    subject: `Your campaign was ${status}`,
    html: wrapEmail(
      `Campaign ${status}`,
      `Your campaign <strong>${campaign.campaign_title}</strong> was ${status} by the admin.`,
      `${CLIENT_URL}/dashboard/my-campaigns`
    ),
  });

  res.send({ message: `Campaign ${status}` });
});

// ---- Admin: delete any campaign from Manage Campaigns ----
router.delete('/campaigns/admin/:id', verifyToken, verifyAdmin, validateObjectId('id'), async (req, res) => {
  const { campaignsCollection, contributionsCollection, usersCollection, reportsCollection } = getCollections();
  const campaignId = req.params.id;

  const campaign = await campaignsCollection.findOne({ _id: new ObjectId(campaignId) });
  if (!campaign) return res.status(404).send({ message: 'Campaign not found' });

  const refundable = await contributionsCollection
    .find({ campaign_id: campaignId, status: { $in: ['pending', 'approved'] } })
    .toArray();
  for (const c of refundable) {
    await usersCollection.updateOne(
      { email: c.supporter_email },
      { $inc: { credits: c.contribution_amount } }
    );
  }

  await campaignsCollection.deleteOne({ _id: new ObjectId(campaignId) });
  await contributionsCollection.deleteMany({ campaign_id: campaignId });
  await reportsCollection.deleteMany({ campaign_id: campaignId });

  await sendNotification({
    message: `Your campaign "${campaign.campaign_title}" was removed by the admin. ${refundable.length} supporter(s) refunded.`,
    toEmail: campaign.creator_email,
    actionRoute: '/dashboard/my-campaigns',
  });

  res.send({ message: 'Campaign deleted and supporters refunded', refundedCount: refundable.length });
});

module.exports = router;
