# CrowdFundHub — Server Side

The backend API for **CrowdFundHub**, a crowdfunding platform where Creators launch campaigns, Supporters back them with platform credits, and Admins keep everything running smoothly.

- 🔗 **Live API URL:** _paste your Vercel server URL here_
- 🔗 **Client Repository:** _paste your client GitHub repo link here_
- 🔐 **Admin Email:** _paste the admin email you seeded_
- 🔐 **Admin Password:** _paste the admin password you used at Firebase signup_

## Features

- Role-based JWT authorization with dedicated middleware for Supporter, Creator, and Admin routes.
- Full campaign lifecycle: create → pending → admin approval → live → funded/closed, with edit and delete (including automatic supporter refunds on delete).
- Contribution flow that holds a supporter's credits on submission and either confirms or refunds them the moment a creator approves or rejects.
- Withdrawal system that converts raised credits to dollars (20 credits = $1) and only unlocks once a creator has raised at least 200 credits.
- Stripe PaymentIntent integration for buying credit packages.
- Search, category filter, and sort on Explore Campaigns built with MongoDB's **aggregation framework** ($match + $sort pipeline).
- A notifications collection that fires on every status change (contribution approved/rejected, campaign approved/rejected, withdrawal approved, new contribution received) — paired with an **automated email** (via Nodemailer/Gmail) for the same events.
- Suspicious-campaign reporting with admin suspend/delete actions.
- Paginated contribution history for supporters.
- Clean separation of concerns: `config/`, `middleware/`, `routes/`, `utils/`.

## Tech Stack

Node.js · Express · MongoDB (native driver) · JSON Web Token · Stripe · CORS · dotenv

## Getting Started Locally

1. `npm install`
2. Copy `.env.example` to `.env` and fill in your own `MONGODB_URI`, `JWT_SECRET`, and `STRIPE_SECRET_KEY`.
3. `npm run dev`
4. Server runs at `http://localhost:5000`

## Main Collections

`users` · `campaigns` · `contributions` · `withdrawals` · `payments` · `notifications` · `reports`
