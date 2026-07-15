const express = require('express');
const { getCollections } = require('../config/db');
const verifyToken = require('../middleware/verifyToken');

const router = express.Router();

// ---- Get all notifications for the logged-in user, newest first ----
router.get('/notifications/:email', verifyToken, async (req, res) => {
  const { notificationsCollection } = getCollections();
  const notifications = await notificationsCollection
    .find({ toEmail: req.params.email })
    .sort({ time: -1 })
    .limit(30)
    .toArray();
  res.send(notifications);
});

module.exports = router;
