require('dotenv').config();
const express = require('express');
const cors = require('cors');
const { connectDB } = require('./config/db');

const userRoutes = require('./routes/userRoutes');
const campaignRoutes = require('./routes/campaignRoutes');
const contributionRoutes = require('./routes/contributionRoutes');
const withdrawalRoutes = require('./routes/withdrawalRoutes');
const paymentRoutes = require('./routes/paymentRoutes');
const notificationRoutes = require('./routes/notificationRoutes');
const reportRoutes = require('./routes/reportRoutes');

const app = express();
const port = process.env.PORT || 5000;

app.use(cors({ origin: true, credentials: true }));
app.use(express.json());

app.get('/', (req, res) => {
  res.send('CrowdFundHub server is running');
});

app.use(userRoutes);
app.use(campaignRoutes);
app.use(contributionRoutes);
app.use(withdrawalRoutes);
app.use(paymentRoutes);
app.use(notificationRoutes);
app.use(reportRoutes);

// Connect to MongoDB once, then start accepting requests.
connectDB()
  .then(() => {
    app.listen(port, () => {
      console.log(`🚀 CrowdFundHub server listening on port ${port}`);
    });
  })
  .catch((err) => {
    console.error('❌ Failed to connect to MongoDB:', err.message);
  });

module.exports = app;
