const express = require('express');
const { ObjectId } = require('mongodb');
const { getCollections } = require('../config/db');
const verifyToken = require('../middleware/verifyToken');
const { verifySupporter, verifyAdmin } = require('../middleware/verifyRoles');
const { validateObjectId, isValidObjectId } = require('../utils/validate');

const router = express.Router();

// ---- Supporter: report a campaign as suspicious/fraudulent ----
router.post('/reports', verifyToken, verifySupporter, async (req, res) => {
  const { reportsCollection } = getCollections();
  const data = req.body;

  if (data.reporter_email !== req.decoded.email) {
    return res.status(403).send({ message: 'You can only report from your own account' });
  }
  if (!data.campaign_id || !isValidObjectId(data.campaign_id)) {
    return res.status(400).send({ message: 'Valid campaign_id is required' });
  }
  if (!data.reason || !String(data.reason).trim()) {
    return res.status(400).send({ message: 'Reason is required' });
  }

  // Prevent duplicate open reports from same user on same campaign
  const dup = await reportsCollection.findOne({
    campaign_id: data.campaign_id,
    reporter_email: data.reporter_email,
    status: 'open',
  });
  if (dup) return res.status(400).send({ message: 'You already reported this campaign' });

  const report = {
    campaign_id: data.campaign_id,
    campaign_title: String(data.campaign_title || '').slice(0, 200),
    reporter_name: String(data.reporter_name || '').slice(0, 100),
    reporter_email: data.reporter_email,
    reason: String(data.reason).slice(0, 1000),
    date: new Date(),
    status: 'open',
  };

  const result = await reportsCollection.insertOne(report);
  res.send(result);
});

// ---- Admin: every report ----
router.get('/reports', verifyToken, verifyAdmin, async (req, res) => {
  const { reportsCollection } = getCollections();
  const reports = await reportsCollection.find().sort({ date: -1 }).toArray();
  res.send(reports);
});

// ---- Admin: suspend the reported campaign (keeps it, hides it from supporters) ----
router.patch('/reports/suspend/:campaignId', verifyToken, verifyAdmin, validateObjectId('campaignId'), async (req, res) => {
  const { campaignsCollection } = getCollections();
  const result = await campaignsCollection.updateOne(
    { _id: new ObjectId(req.params.campaignId) },
    { $set: { status: 'suspended' } }
  );
  res.send(result);
});

// ---- Admin: delete the reported campaign entirely ----
router.delete('/reports/:reportId/:campaignId', verifyToken, verifyAdmin, async (req, res) => {
  if (!isValidObjectId(req.params.reportId) || !isValidObjectId(req.params.campaignId)) {
    return res.status(400).send({ message: 'Invalid ID format' });
  }
  const { campaignsCollection, reportsCollection, contributionsCollection, usersCollection } = getCollections();
  const refundable = await contributionsCollection
    .find({ campaign_id: req.params.campaignId, status: { $in: ['pending', 'approved'] } })
    .toArray();
  for (const c of refundable) {
    await usersCollection.updateOne(
      { email: c.supporter_email },
      { $inc: { credits: c.contribution_amount } }
    );
  }
  await campaignsCollection.deleteOne({ _id: new ObjectId(req.params.campaignId) });
  await contributionsCollection.deleteMany({ campaign_id: req.params.campaignId });
  await reportsCollection.deleteMany({ campaign_id: req.params.campaignId });
  const result = await reportsCollection.deleteOne({ _id: new ObjectId(req.params.reportId) });
  res.send({ ...result, refundedCount: refundable.length });
});

module.exports = router;
