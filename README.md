# CrowdFundHub — Server

<p>
  <img src="https://img.shields.io/badge/Node.js-18+-339933?logo=node.js&logoColor=white" alt="Node.js" />
  <img src="https://img.shields.io/badge/Express-4.x-000000?logo=express&logoColor=white" alt="Express" />
  <img src="https://img.shields.io/badge/MongoDB-Atlas-47A248?logo=mongodb&logoColor=white" alt="MongoDB" />
  <img src="https://img.shields.io/badge/Stripe-Payments-635BFF?logo=stripe&logoColor=white" alt="Stripe" />
  <img src="https://img.shields.io/badge/Deployed%20on-Vercel-black?logo=vercel&logoColor=white" alt="Vercel" />
</p>

The REST API for **CrowdFundHub**, a role-based crowdfunding platform where Creators launch campaigns, Supporters back them with platform credits, and Admins keep the marketplace healthy.

This is the **server-side** repository. The client application lives in a separate repository, linked below.

## 📌 Project Links

| | |
|---|---|
| 🔗 Live API | https://crowd-fund-hub-server.vercel.app |
| 🔗 Live Client | https://crowd-fund-hub-client.vercel.app |
| 🔗 Client Repository | _paste your client GitHub repo link here_ |
| 🔐 Admin Email | _paste the admin email here_ |
| 🔐 Admin Password | _paste the admin password here_ |

## ✨ Highlights

- **Role-based authorization** — custom middleware (`verifySupporter`, `verifyCreator`, `verifyAdmin`) gates every private route by the caller's role, not just a valid token.
- **JWT session handling** — a short-lived token is issued right after Firebase authentication and verified on every private request.
- **Full campaign lifecycle** — draft → pending → admin-reviewed → approved/rejected/suspended, with automatic supporter refunds on delete.
- **Credit-hold contribution flow** — a supporter's credits are deducted the moment they contribute and only confirmed (or refunded) once the creator approves or rejects it.
- **Withdrawal engine** — converts raised credits to dollars (20 credits = $1), enforces a 200-credit minimum, and settles balances across a creator's campaigns on payout.
- **Stripe integration** — server-side `PaymentIntent` creation for the credit-purchase flow.
- **MongoDB aggregation pipeline** — campaign search, category filtering, and sorting run as a single `$match` + `$sort` pipeline on the database side.
- **Dual notification system** — every status change (contribution/campaign/withdrawal decisions, new contributions) writes to a `notifications` collection **and** sends an automated email via Nodemailer.
- **Abuse reporting** — supporters can flag suspicious campaigns; admins can suspend or delete them.
- **Serverless-ready connection handling** — a cached connection promise means every request (even on a cold Vercel invocation) waits for a real MongoDB connection instead of racing it.

## 🧱 Tech Stack

| Layer | Technology |
|---|---|
| Runtime | Node.js |
| Framework | Express.js |
| Database | MongoDB Atlas (native driver, no ODM) |
| Auth | Firebase-issued identity + custom JWT (jsonwebtoken) |
| Payments | Stripe |
| Email | Nodemailer (Gmail SMTP) |
| Hosting | Vercel (serverless functions) |

## 📁 Folder Structure

```
server/
├── config/
│   └── db.js              # MongoDB connection (cached for serverless)
├── middleware/
│   ├── verifyToken.js      # JWT verification
│   └── verifyRoles.js      # verifySupporter / verifyCreator / verifyAdmin
├── routes/
│   ├── userRoutes.js
│   ├── campaignRoutes.js
│   ├── contributionRoutes.js
│   ├── withdrawalRoutes.js
│   ├── paymentRoutes.js
│   ├── notificationRoutes.js
│   └── reportRoutes.js
├── utils/
│   ├── notify.js           # writes to the notifications collection
│   ├── mailer.js           # Nodemailer transport
│   └── emailTemplates.js   # shared HTML email wrapper
├── seed/
│   └── seed.js             # optional demo campaign data
├── index.js                 # app entry point
└── vercel.json               # serverless build config
```

## 🔌 API Reference

All private routes require `Authorization: Bearer <token>`.

### Users & Auth
| Method | Route | Access |
|---|---|---|
| POST | `/jwt` | Public |
| POST | `/users` | Public (register) |
| GET | `/users/role/:email` | Private |
| GET | `/users/:email` | Private |
| GET | `/users` | Admin |
| PATCH | `/users/role/:id` | Admin |
| DELETE | `/users/:id` | Admin |

### Campaigns
| Method | Route | Access |
|---|---|---|
| GET | `/campaigns` | Public — search, category, sort |
| GET | `/campaigns/top-funded` | Public |
| GET | `/campaigns/:id` | Public |
| GET | `/campaigns/creator/:email` | Creator |
| POST | `/campaigns` | Creator |
| PATCH | `/campaigns/:id` | Creator |
| DELETE | `/campaigns/:id` | Creator |
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
| PATCH | `/contributions/status/:id` | Creator |

### Withdrawals
| Method | Route | Access |
|---|---|---|
| POST | `/withdrawals` | Creator |
| GET | `/withdrawals/creator/:email` | Creator |
| GET | `/withdrawals/pending` | Admin |
| PATCH | `/withdrawals/approve/:id` | Admin |

### Payments
| Method | Route | Access |
|---|---|---|
| POST | `/create-payment-intent` | Supporter |
| POST | `/payments` | Supporter |
| GET | `/payments/:email` | Supporter |
| GET | `/payments-count` | Admin |

### Notifications & Reports
| Method | Route | Access |
|---|---|---|
| GET | `/notifications/:email` | Private |
| POST | `/reports` | Supporter |
| GET | `/reports` | Admin |
| PATCH | `/reports/suspend/:campaignId` | Admin |
| DELETE | `/reports/:reportId/:campaignId` | Admin |

## ⚙️ Environment Variables

Create a `.env` file (see `.env.example`):

```dotenv
MONGODB_URI=
JWT_SECRET=
STRIPE_SECRET_KEY=
CLIENT_URL=
EMAIL_USER=
EMAIL_PASS=
```

## 🚀 Getting Started Locally

```bash
git clone <this-repo-url>
cd server
npm install
cp .env.example .env   # then fill in the values above
npm run dev
```

The API runs at `http://localhost:5000`.

Optional — seed a handful of demo campaigns:

```bash
node seed/seed.js
```

## ☁️ Deployment

Deployed on **Vercel** as a serverless function (see `vercel.json`). Push to `main` to trigger an automatic redeploy.

## 🗄️ Database Collections

`users` · `campaigns` · `contributions` · `withdrawals` · `payments` · `notifications` · `reports`

## 📄 License

MIT