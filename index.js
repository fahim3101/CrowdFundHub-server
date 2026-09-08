require('dotenv').config();
// Patches Express 4 so thrown errors inside async route handlers are
// forwarded to the error middleware instead of crashing the function.
require('express-async-errors');
const express = require('express');
const helmet = require('helmet');
const morgan = require('morgan');
const cors = require('cors');
const { connectDB, getCollections } = require('./config/db');

const userRoutes = require('./routes/userRoutes');
const campaignRoutes = require('./routes/campaignRoutes');
const contributionRoutes = require('./routes/contributionRoutes');
const withdrawalRoutes = require('./routes/withdrawalRoutes');
const paymentRoutes = require('./routes/paymentRoutes');
const notificationRoutes = require('./routes/notificationRoutes');
const reportRoutes = require('./routes/reportRoutes');

const app = express();
const port = process.env.PORT || 5000;

// Behind Vercel's proxy every request would otherwise share one IP,
// which breaks IP-based rate limiting (one user could block everyone).
app.set('trust proxy', 1);

app.disable('x-powered-by');
app.use(helmet());
app.use(morgan('tiny')); // access logs go to stdout → Vercel Runtime Logs

// CORS whitelist: never reflect arbitrary origins with credentials.
const allowedOrigins = (process.env.CLIENT_URL || 'http://localhost:5173')
  .split(',')
  .map((s) => s.trim())
  .filter(Boolean);

app.use(
  cors({
    origin: (origin, cb) => {
      // Allow server-to-server / curl (no origin) + whitelisted web origins
      if (!origin || allowedOrigins.includes(origin)) return cb(null, true);
      return cb(new Error('Not allowed by CORS'));
    },
    credentials: true,
  })
);
app.use(express.json({ limit: '100kb' }));

// Liveness probe — intentionally BEFORE the DB gate so uptime checks
// never pay for (or fail on) a database connection.
app.get('/health', (req, res) => {
  const dbReady = Object.keys(getCollections()).length > 0;
  res.send({ status: 'ok', uptime: Math.floor(process.uptime()), db: dbReady ? 'connected' : 'cold' });
});

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

// Unknown routes → clean JSON instead of Express's HTML page.
app.use((req, res) => {
  res.status(404).send({ message: 'Not found' });
});

// Centralized error handler (receives async errors via express-async-errors).
// Never leaks stack traces to clients in production — check Vercel Runtime Logs.
app.use((err, req, res, next) => {
  console.error(`❌ ${req.method} ${req.path}:`, err.message);
  const status = err.status && Number.isInteger(err.status) ? err.status : 500;
  res.status(status).send({
    message: status === 500 ? 'Internal server error' : err.message,
  });
});

// Only actually bind to a port when run directly (local `npm run dev`).
// On Vercel, the module is imported and its request handler is invoked
// directly per-request — app.listen() is never used there.
if (require.main === module) {
  app.listen(port, () => {
    console.log(`🚀 CrowdFundHub server listening on port ${port}`);
  });
}

module.exports = app;