# CrowdFundHub — Server

<p>
  <img src="https://img.shields.io/badge/Node.js-20-339933?logo=node.js&logoColor=white" alt="Node.js 20" />
  <img src="https://img.shields.io/badge/Express-4.x-000000?logo=express&logoColor=white" alt="Express" />
  <img src="https://img.shields.io/badge/MongoDB-Atlas-47A248?logo=mongodb&logoColor=white" alt="MongoDB" />
  <img src="https://img.shields.io/badge/Firebase_Admin-SDK-FFCA28?logo=firebase&logoColor=black" alt="Firebase Admin" />
  <img src="https://img.shields.io/badge/Stripe-Payments-635BFF?logo=stripe&logoColor=white" alt="Stripe" />
  <img src="https://img.shields.io/badge/Deployed%20on-Vercel-black?logo=vercel&logoColor=white" alt="Vercel" />
</p>

The REST API behind **CrowdFundHub** — a role-based crowdfunding platform where **Creators** launch campaigns, **Supporters** back them with platform credits, and **Admins** keep the marketplace safe and healthy.

This is the **server-side** repository. The client application lives separately and is linked below.

## 📌 Project Links

| | |
|---|---|
| 🔗 Live API | https://crowd-fund-hub-server.vercel.app |
| 🔗 Live Client | https://crowd-fund-hub-client.vercel.app |
| 🔗 Client Repository | https://github.com/fahim3101/CrowdFundHub-client |
| 🔐 Demo Admin Email | admin@gmail.com |
| 🔐 Demo Admin Password | Admin123 |

## ✨ Highlights

- **Verified Firebase authentication** — the `/jwt` endpoint validates the client's Firebase ID token with the Firebase Admin SDK before issuing a short-lived (1-day) JWT. Email addresses from the client are never trusted blindly.
- **Role-based authorization** — dedicated middleware (`verifySupporter`, `verifyCreator`, `verifyAdmin`, plus owner checks) gates every private route by the caller's actual role, not just token validity.
- **Full campaign lifecycle** — draft → pending → admin review → approved / rejected / suspended, with automatic supporter refunds when a campaign is removed.
- **Credit-hold contribution flow** — supporter credits are deducted at contribution time, then confirmed or refunded when the creator approves or rejects.
- **Withdrawal engine** — converts raised credits to dollars (20 credits = $1), enforces a 200-credit minimum, and settles balances across all of a creator's campaigns on payout.
- **Stripe integration** — server-side `PaymentIntent` creation keeps pricing authoritative; clients can never invent credits.
- **Database-side search & sort** — campaign discovery (text search, category filter, sorting) runs as a single MongoDB aggregation pipeline.
- **Dual notification system** — every key decision (contributions, campaigns, withdrawals) writes to a `notifications` collection **and** sends an email via Nodemailer.
- **Abuse reporting** — supporters can flag suspicious campaigns; admins can suspend or delete them.
- **Hardened for serverless** — lazy MongoDB initialization, a cached connection promise for cold starts, rate-limited auth routes with `trust proxy`, security headers (helmet), request logging, a `/health` probe, JSON 404s, and a centralized error handler that never leaks stack traces.

## 🎯 MVP Scope

**In scope** — verified Firebase auth + short-lived JWT, role-based route guards, full campaign lifecycle with refunds, credit-hold contributions, withdrawals with minimum + settlement, Stripe test-mode credit purchases, in-app notifications (email optional), campaign reports + admin moderation, serverless deployment.

**Intentionally out of scope** — automated test suite, live Stripe keys, production email deliverability (SPF/DKIM, templates), real-time updates via WebSockets, recurring/subscription payments, multi-currency support.

## 🧱 Tech Stack

| Layer | Technology |
|---|---|
| Runtime | Node.js 20 (pinned via `engines`) |
| Framework | Express.js 4 |
| Database | MongoDB Atlas (native driver, no ODM) |
| Auth | Firebase Admin SDK (ID-token verification) + custom JWT (`jsonwebtoken`) |
| Payments | Stripe (`PaymentIntent`) |
| Email | Nodemailer (Gmail SMTP, optional) |
| Hardening | helmet, morgan, express-async-errors |
| Hosting | Vercel (serverless functions) |

## 📁 Folder Structure

```
server/
├── config/
│   ├── db.js              # Lazy MongoDB client + cached connection promise
│   └── firebase.js        # Firebase Admin init (env vars only, never committed)
├── middleware/
│   ├── verifyToken.js      # JWT verification for private routes
│   ├── verifyRoles.js      # verifySupporter / verifyCreator / verifyAdmin
│   ├── verifyOwner.js      # Owner-or-admin check for :email routes
│   └── rateLimit.js        # In-memory rate limits for auth endpoints
├── routes/
│   ├── userRoutes.js         # /jwt, registration, roles, profiles
│   ├── campaignRoutes.js
│   ├── contributionRoutes.js
│   ├── withdrawalRoutes.js
│   ├── paymentRoutes.js
│   ├── notificationRoutes.js
│   └── reportRoutes.js
├── utils/
│   ├── notify.js           # Writes to the notifications collection
│   ├── mailer.js           # Nodemailer transport (skips cleanly if unset)
│   ├── emailTemplates.js   # Shared HTML email wrapper
│   └── validate.js         # ObjectId + role validators
├── seed/
│   └── seed.js             # Optional demo data (non-destructive re-runs)
├── index.js                 # App entry point (also the Vercel handler)
└── vercel.json               # Serverless routing config
```

## 🔌 API Reference

All private routes require `Authorization: Bearer <token>`.

### Users & Auth
| Method | Route | Access |
|---|---|---|
| GET | `/health` | Public — liveness probe (no DB required) |
| GET | `/` | Public — service banner |
| POST | `/jwt` | Public, rate-limited — verifies Firebase ID token, issues 1-day JWT |
| POST | `/users` | Public registration, rate-limited — never overwrites existing roles |
| GET | `/users/role/:email` | Private (owner or admin) |
| GET | `/users/:email` | Private (owner or admin) |
| PATCH | `/users/profile/:email` | Private (owner — update own name/photo) |
| GET | `/users` | Admin |
| PATCH | `/users/role/:id` | Admin |
| DELETE | `/users/:id` | Admin |

### Campaigns
| Method | Route | Access |
|---|---|---|
| GET | `/campaigns` | Public — search, category filter, sort |
| GET | `/campaigns/top-funded` | Public |
| GET | `/campaigns/:id` | Public |
| GET | `/campaigns/creator/:email` | Creator |
| POST | `/campaigns` | Creator |
| PATCH | `/campaigns/:id` | Creator |
| DELETE | `/campaigns/:id` | Creator (refunds supporters) |
| GET | `/campaigns/pending` | Admin |
| GET | `/campaigns/all` | Admin |
| PATCH | `/campaigns/status/:id` | Admin |
| DELETE | `/campaigns/admin/:id` | Admin |

### Contributions
| Method | Route | Access |
|---|---|---|
| POST | `/contributions` | Supporter |
| GET | `/contributions/supporter/:email` | Supporter — paginated |
| GET | `/contributions/approved/:email` | Supporter |
| GET | `/contributions/pending/:creatorEmail` | Creator |
| PATCH | `/contributions/status/:id` | Creator (approve / reject + refund) |

### Withdrawals
| Method | Route | Access |
|---|---|---|
| POST | `/withdrawals` | Creator (200-credit minimum) |
| GET | `/withdrawals/creator/:email` | Creator |
| GET | `/withdrawals/pending` | Admin |
| PATCH | `/withdrawals/approve/:id` | Admin |

### Payments
| Method | Route | Access |
|---|---|---|
| POST | `/create-payment-intent` | Supporter |
| POST | `/payments` | Supporter (records purchase after Stripe confirms) |
| GET | `/payments/:email` | Supporter |
| GET | `/payments-count` | Admin |

### Notifications & Reports
| Method | Route | Access |
|---|---|---|
| GET | `/notifications/:email` | Private (owner or admin) |
| PATCH | `/notifications/read/:email` | Private (owner — mark all as read) |
| POST | `/reports` | Supporter |
| GET | `/reports` | Admin |
| PATCH | `/reports/suspend/:campaignId` | Admin |
| DELETE | `/reports/:reportId/:campaignId` | Admin |

## ⚙️ Environment Variables

Create a `.env` file (see `.env.example`). Never commit real values:

```dotenv
MONGODB_URI=
JWT_SECRET=
STRIPE_SECRET_KEY=
CLIENT_URL=http://localhost:5173
EMAIL_USER=          # optional — Gmail address for notifications
EMAIL_PASS=          # optional — 16-char Gmail App Password
PORT=5000
# Firebase Admin service account (Firebase Console → Project Settings → Service Accounts)
FIREBASE_PROJECT_ID=
FIREBASE_CLIENT_EMAIL=
FIREBASE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----\n"
```

> The service-account JSON must never be committed — only these three fields go into env vars, locally and in the Vercel dashboard.

## 🚀 Getting Started Locally

```bash
git clone https://github.com/fahim3101/CrowdFundHub-server.git
cd CrowdFundHub-server
npm install
cp .env.example .env   # then fill in the values above
npm run dev
```

The API runs at `http://localhost:5000`.

Optional — seed demo campaigns, users, and payments (safe to re-run):

```bash
node seed/seed.js
```

## ☁️ Deployment

Deployed on **Vercel** as a serverless function (see `vercel.json`). Pushing to `main` triggers an automatic redeploy. Mirror every `.env` value — especially the three `FIREBASE_*` vars — in the Vercel dashboard's Environment Variables and redeploy after changing them.

## 🗄️ Database Collections

`users` · `campaigns` · `contributions` · `withdrawals` · `payments` · `notifications` · `reports`

## 📄 License

MIT
