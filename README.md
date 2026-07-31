# PKCS — Performance Rating System

A MERN-stack workforce rating and performance management application built for cleaning service staff at **PT Pertamina Geothermal Energy**. Deployed at [sarapanpagipge.com](https://sarapanpagipge.com) on Hostinger, with MongoDB Atlas as the database layer.

## Overview

PKCS lets supervisors and peers rate cleaning service workers on a recurring (monthly) basis, gives admins full oversight and approval control, and supports a bilingual (English/Indonesian) interface for a mixed-language workforce.

## Features

- **Three role tiers** — worker, supervisor, admin, each with a distinct dashboard and permission set
- **Peer-review ratings** — workers and supervisors rate colleagues on performance
- **Role-based access control (RBAC)** across all API routes and UI views
- **Bilingual UI** — English and Indonesian, switchable at runtime
- **Username-based login for workers**, email-based login for supervisors/admins, resolved through a single unified identifier field
- **Late submission requests** — workers can ask an admin to approve rating a colleague after a month has closed, instead of being hard-locked out
- **Rating edit window** — edits allowed up to two months back, with admin-approved exceptions beyond that
- **Data visualization for supervisors** — pie/bar breakdown of "not rated" workers, plus a tri-monthly (quarterly) view aggregating three months of ratings
- **Mobile-responsive** admin and worker views

## Tech Stack

| Layer | Technology |
|---|---|
| Frontend | React |
| Backend | Node.js, Express (v4) |
| Database | MongoDB (via Mongoose), MongoDB Atlas |
| Auth | Custom session/token auth with role-based middleware |
| i18n | Custom `LanguageContext` + `translations.js` |
| Hosting | Hostinger (Node.js app), MongoDB Atlas |

## Project Structure

```
pkcs/
├── backend/
│   └── src/
│       ├── config/        # DB connection, env config, demo data seeding
│       ├── models/        # Mongoose schemas (User, Rating, LateSubmissionRequest, ...)
│       ├── routes/        # Express route definitions
│       ├── controllers/   # Route handlers / business logic
│       ├── middleware/    # Auth, role checks, validation
│       └── utils/
└── frontend/
    └── src/
        ├── components/    # Shared UI components
        ├── pages/         # AdminHome, AdminUsers, SupervisorHome, WorkerHome, ...
        ├── context/        # LanguageContext
        ├── i18n/           # translations.js
        └── api.js          # Axios instance / API calls
```

---

## Step-by-Step: Building It From Scratch

### 1. Scaffold the backend

```bash
mkdir pkcs && cd pkcs
mkdir backend && cd backend
npm init -y
npm install express mongoose dotenv cors bcryptjs jsonwebtoken
```

Create a **structured** backend from day one (`config/`, `models/`, `routes/`, `controllers/`, `middleware/`) rather than a single `server.js` — it saves a painful refactor later.

```
backend/src/
├── server.js
├── config/db.js
├── models/
├── routes/
├── controllers/
├── middleware/
└── utils/
```

### 2. Connect to MongoDB Atlas

```js
// config/db.js
const mongoose = require('mongoose');

const connectDB = async () => {
  await mongoose.connect(process.env.MONGO_URI);
  console.log('MongoDB connected');
};

module.exports = connectDB;
```

Set `MONGO_URI` in a `.env` file locally, and later as an environment variable in Hostinger's hPanel for production.

### 3. Design the core models

Start with `User`, `Rating`, and later `LateSubmissionRequest`:

```js
// models/User.js
const userSchema = new mongoose.Schema({
  identifier: { type: String, required: true, unique: true, sparse: true }, // username OR email
  email:      { type: String, sparse: true },
  username:   { type: String, sparse: true },
  password:   { type: String, required: true },
  role:       { type: String, enum: ['worker', 'supervisor', 'admin'], required: true },
});
```

Using a single `identifier` field (resolved via a MongoDB `$or` query at login) lets workers log in with a username while supervisors/admins keep email login, without maintaining two separate auth flows.

```js
// models/Rating.js
const ratingSchema = new mongoose.Schema({
  ratedUser:  { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  ratedBy:    { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  month:      { type: String, required: true }, // e.g. "2026-07"
  score:      { type: Number, required: true },
  monthAverageRating: Number,
}, { timestamps: true });
```

### 4. Build authentication + RBAC middleware

```js
// middleware/auth.js
const requireAuth = (req, res, next) => { /* verify JWT, attach req.user */ };
const requireRole = (...roles) => (req, res, next) => {
  if (!roles.includes(req.user.role)) return res.status(403).json({ message: 'Forbidden' });
  next();
};
```

Apply `requireRole('admin')`, `requireRole('supervisor', 'admin')`, etc. on each route so permissions stay declarative and easy to audit.

### 5. Build the rating flow (worker/supervisor side)

- `POST /api/ratings` — submit a rating for a colleague, validated against the current open month
- `GET /api/ratings/:userId` — fetch a user's rating history
- Lock ratings once a month closes; only allow edits within a **two-month rolling window**, and only with a valid reason/approval beyond that

### 6. Add the late-submission-request feature

```js
// models/LateSubmissionRequest.js
const lateSubmissionSchema = new mongoose.Schema({
  requestedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  targetUser:  { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  month:       String,
  status:      { type: String, enum: ['pending', 'approved', 'rejected'], default: 'pending' },
}, { timestamps: true });
```

Wire up a controller + routes for workers to submit a request, and an admin approval endpoint that, once approved, temporarily unlocks that specific month/worker pair for rating.

### 7. Build supervisor data visualization

- Aggregate ratings per worker per month; flag workers with zero ratings as "Not Rated" for the pie/bar chart
- For the tri-monthly (quarterly) view, run three parallel API calls (one per month) and merge client-side, using `monthAverageRating` rather than the all-time average so each quarter reflects that period accurately

### 8. Build the React frontend

```bash
cd ../frontend
npx create-react-app .
npm install axios react-router-dom
```

- `AdminHome`, `AdminUsers`, `AdminApprovals`, `AdminDataTools` for admin
- `SupervisorHome`, `SupervisorDataVisuals` for supervisors
- `WorkerHome` for workers
- Shared `LoginPage` that toggles between username/email input depending on context

### 9. Add i18n (English/Indonesian)

```js
// context/LanguageContext.js
const LanguageContext = createContext();
// exposes t('common.save') -> resolves via dot-notation against translations.js
// persists chosen language in localStorage
```

Structure `translations.js` with nested keys (`common.*`, `admin.*`, `worker.*`) so pages can share common strings and only define page-specific ones.

### 10. Deploy

- **Backend:** Hostinger Node.js app — set `MONGO_URI` and other secrets via hPanel environment variables, not a committed `.env`
- **Express version:** stick to Express 4 if you need wildcard routes — Express 5's `path-to-regexp` v8 breaks legacy wildcard syntax
- **Frontend:** build the React app (`npm run build`) and serve the static build through the same Express server for a single-tunnel/single-origin setup
- **Database:** MongoDB Atlas, connection string via environment variable
- For quick production debugging without a full redeploy, Hostinger's file manager can be used to inject temporary logging into the built files

---

## Notes

- Prefer restrained color use and ghost-style action buttons for the admin UI — keeps dense tables readable
- Watch for encoding issues with emoji/special characters when editing files across different tools — corrupted UTF-8 in JSX literals is an easy silent bug
