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

// Every request waits here until MongoDB is actually connected.
// On the first-ever request this does the real connect; every request after
// that (including on a warm serverless instance) reuses the same connection
// instantly. This is what fixes requests hanging into a 504 on Vercel.
app.use(async (req, res, next) => {
  try {
    await connectDB();
    next();
  } catch (err) {
    console.error('❌ Failed to connect to MongoDB:', err.message);
    res.status(500).send({ message: 'Database connection failed, please try again' });
  }
});

app.use(userRoutes);
app.use(campaignRoutes);
app.use(contributionRoutes);
app.use(withdrawalRoutes);
app.use(paymentRoutes);
app.use(notificationRoutes);
app.use(reportRoutes);

// Only actually bind to a port when run directly (local `npm run dev`).
// On Vercel, the module is imported and its request handler is invoked
// directly per-request — app.listen() is never used there.
if (require.main === module) {
  app.listen(port, () => {
    console.log(`🚀 CrowdFundHub server listening on port ${port}`);
  });
}

module.exports = app;