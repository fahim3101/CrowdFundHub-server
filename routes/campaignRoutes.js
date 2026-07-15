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

// ---- Public: browse approved, still-open campaigns (Explore Campaigns page) ----
// Supports ?search=&category=&sort=
// Built with the MongoDB aggregation framework ($match + $sort) so filtering
// happens on the database side, not by pulling every document into Node first.
router.get('/campaigns', async (req, res) => {
  const { campaignsCollection } = getCollections();
  const { search, category, sort } = req.query;

  const matchStage = {
    status: 'approved',
    deadline: { $gte: new Date().toISOString().slice(0, 10) },
  };
  if (category && category !== 'all') matchStage.category = category;
  if (search) matchStage.campaign_title = { $regex: search, $options: 'i' };

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
    .find({ status: 'approved' })
    .sort({ amount_raised: -1 })
    .limit(6)
    .toArray();
  res.send(campaigns);
});

// ---- Creator: campaigns they launched ----
router.get('/campaigns/creator/:email', verifyToken, verifyCreator, async (req, res) => {
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
router.get('/campaigns/:id', async (req, res) => {
  const { campaignsCollection } = getCollections();
  const campaign = await campaignsCollection.findOne({ _id: new ObjectId(req.params.id) });
  if (!campaign) return res.status(404).send({ message: 'Campaign not found' });
  res.send(campaign);
});

// ---- Creator: launch a new campaign (goes in as "pending") ----
router.post('/campaigns', verifyToken, verifyCreator, async (req, res) => {
  const { campaignsCollection } = getCollections();
  const data = req.body;

  const campaign = {
    campaign_title: data.campaign_title,
    campaign_story: data.campaign_story,
    category: data.category,
    funding_goal: Number(data.funding_goal),
    minimum_contribution: Number(data.minimum_contribution),
    deadline: data.deadline,
    reward_info: data.reward_info,
    campaign_image_url: data.campaign_image_url,
    creator_email: data.creator_email,
    creator_name: data.creator_name,
    amount_raised: 0,
    status: 'pending',
    createdAt: new Date(),
  };

  const result = await campaignsCollection.insertOne(campaign);
  res.send(result);
});

// ---- Creator: edit title / story / reward only ----
router.patch('/campaigns/:id', verifyToken, verifyCreator, async (req, res) => {
  const { campaignsCollection } = getCollections();
  const { campaign_title, campaign_story, reward_info } = req.body;

  const result = await campaignsCollection.updateOne(
    { _id: new ObjectId(req.params.id) },
    { $set: { campaign_title, campaign_story, reward_info } }
  );
  res.send(result);
});

// ---- Creator: delete a campaign + refund every approved supporter ----
router.delete('/campaigns/:id', verifyToken, verifyCreator, async (req, res) => {
  const { campaignsCollection, contributionsCollection, usersCollection } = getCollections();
  const campaignId = req.params.id;

  const approvedContributions = await contributionsCollection
    .find({ campaign_id: campaignId, status: 'approved' })
    .toArray();

  for (const c of approvedContributions) {
    await usersCollection.updateOne(
      { email: c.supporter_email },
      { $inc: { credits: c.contribution_amount } }
    );
  }

  await campaignsCollection.deleteOne({ _id: new ObjectId(campaignId) });
  await contributionsCollection.deleteMany({ campaign_id: campaignId });

  res.send({ message: 'Campaign deleted and supporters refunded', refundedCount: approvedContributions.length });
});

// ---- Admin: approve or reject a campaign ----
router.patch('/campaigns/status/:id', verifyToken, verifyAdmin, async (req, res) => {
  const { campaignsCollection } = getCollections();
  const { status } = req.body; // 'approved' | 'rejected'

  const campaign = await campaignsCollection.findOne({ _id: new ObjectId(req.params.id) });
  if (!campaign) return res.status(404).send({ message: 'Campaign not found' });

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
router.delete('/campaigns/admin/:id', verifyToken, verifyAdmin, async (req, res) => {
  const { campaignsCollection } = getCollections();
  const result = await campaignsCollection.deleteOne({ _id: new ObjectId(req.params.id) });
  res.send(result);
});

module.exports = router;
