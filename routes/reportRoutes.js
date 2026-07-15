const express = require('express');
const { ObjectId } = require('mongodb');
const { getCollections } = require('../config/db');
const verifyToken = require('../middleware/verifyToken');
const { verifySupporter, verifyAdmin } = require('../middleware/verifyRoles');

const router = express.Router();

// ---- Supporter: report a campaign as suspicious/fraudulent ----
router.post('/reports', verifyToken, verifySupporter, async (req, res) => {
  const { reportsCollection } = getCollections();
  const data = req.body;

  const report = {
    campaign_id: data.campaign_id,
    campaign_title: data.campaign_title,
    reporter_name: data.reporter_name,
    reporter_email: data.reporter_email,
    reason: data.reason,
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
router.patch('/reports/suspend/:campaignId', verifyToken, verifyAdmin, async (req, res) => {
  const { campaignsCollection } = getCollections();
  const result = await campaignsCollection.updateOne(
    { _id: new ObjectId(req.params.campaignId) },
    { $set: { status: 'suspended' } }
  );
  res.send(result);
});

// ---- Admin: delete the reported campaign entirely ----
router.delete('/reports/:reportId/:campaignId', verifyToken, verifyAdmin, async (req, res) => {
  const { campaignsCollection, reportsCollection } = getCollections();
  await campaignsCollection.deleteOne({ _id: new ObjectId(req.params.campaignId) });
  const result = await reportsCollection.deleteOne({ _id: new ObjectId(req.params.reportId) });
  res.send(result);
});

module.exports = router;
