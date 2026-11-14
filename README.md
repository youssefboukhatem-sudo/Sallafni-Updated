# Sallafni — "Why buy it when you can borrow it"

A neighbourhood lending platform: lend what you don't use, borrow what you need from people near you.
**Frontend:** Angular 22 (standalone components + signals) · **Backend:** Node.js + Express · **Database:** SQLite

## Why these choices

| Layer | Choice | Reason |
|---|---|---|
| Frontend | Angular | Typed, structured (services, guards, interceptors) — fits a multi-page app with auth |
| Backend | Express | Minimal REST API, easy to read and document |
| Database | SQLite (`better-sqlite3`) | Real relational DB with **zero setup** — one file, created and seeded automatically |
| Auth | JWT + bcrypt | Stateless sessions; passwords are hashed, never stored in clear |

## Features

- **Accounts:** register / log in, profile (name, phone, address, optional GPS location)
- **Borrow:** browse items, filter by category / free-only / search; request with pick-up & return dates;
  distance to the lender; the exact street address is revealed **only after the lender accepts**
- **Lend:** add items (with photo upload), see incoming requests, accept / decline, mark loans returned, dashboard stats
- **Ratings:** after a return, each side rates the other (1–10 + comment); scores are shown on items and requests
- **Rules enforced by the server:** no borrowing your own item, no past dates, no double-booking of an item,
  only the lender can accept/decline, each side can rate once, ratings only after return

## Run it

Requirements: **Node.js 20+** (22 recommended) and npm.

```bash
# 1. install everything (frontend + backend)
npm run setup

# 2. start API (http://localhost:3000) and Angular (http://localhost:4200) together
npm run dev
```

Open **http://localhost:4200** and log in with the demo account:

    demo@sallafni.tn  /  password123

(other seeded users, e.g. `sara@sallafni.tn`, `jeff@sallafni.tn`, all use `password123`)

The database file is created automatically at `backend/data/sallafni.db` and filled with demo data on first start.

Or run them in two terminals:

```bash
npm --prefix backend start     # terminal 1 — API on :3000
npm start                      # terminal 2 — Angular on :4200 (proxies /api and /uploads to :3000)
```

### Single-server mode (production-style)

```bash
npm run build                  # builds Angular to dist/sallafni/browser
npm --prefix backend start     # API now also serves the built app at http://localhost:3000
```

### Useful commands

| Command | What it does |
|---|---|
| `npm --prefix backend test` | Runs the 6 API integration tests (auth, items, full request→accept→return→rate flow, rules) |
| `npm --prefix backend run reset` | Wipes the database and re-seeds demo data |
| `backend/.env.example` | Copy to `backend/.env` to change port / JWT secret / DB path |

## API reference (base `/api`)

`🔒` = needs `Authorization: Bearer <token>`

| Method & path | Description |
|---|---|
| `POST /auth/register` `{email,password}` | Create account → `{token,user}` |
| `POST /auth/login` `{email,password}` | Log in → `{token,user}` |
| 🔒 `GET /auth/me` · `PUT /auth/me` | Read / update own profile |
| `GET /items?category=&free=1&q=` | List items (public; owner shown as name, city, area, score only) |
| `GET /items/:id` | One item |
| 🔒 `GET /items/mine` | My items |
| 🔒 `POST /items` (multipart: `name, category, condition, price, photo`) | Add item (JPG/PNG/WebP/GIF ≤ 5 MB) |
| 🔒 `DELETE /items/:id` | Delete my item (not while on loan) |
| 🔒 `POST /requests` `{itemId, from, to, note?}` | Ask to borrow (dates `YYYY-MM-DD`) |
| 🔒 `GET /requests/outgoing` | Requests I made (address included once accepted) |
| 🔒 `GET /requests/incoming` | Requests for my items |
| 🔒 `GET /requests/stats` | Lender dashboard numbers |
| 🔒 `POST /requests/:id/accept` · `/decline` | Lender answers a pending request |
| 🔒 `POST /requests/:id/return` | Lender or borrower marks an accepted loan returned |
| 🔒 `POST /requests/:id/rate` `{score:1-10, comment?}` | Rate the other party (once, after return) |
| `GET /users/:id` | Public profile + reviews |
| `GET /health` | Health check |

## Database schema (SQLite)

```
users     id, email (unique), password_hash, first_name, last_name, country, phone, street, line2,
          city, area, state, zip, lat, lng, rating_sum, rating_count, created_at
items     id, owner_id → users, name, description, category, price, condition, image, created_at
requests  id, item_id → items, borrower_id → users, date_from, date_to, note,
          status (pending | accepted | declined | returned), total_price, returned_at, created_at
ratings   id, request_id → requests, rater_id → users, ratee_id → users, score (1-10), comment,
          UNIQUE(request_id, rater_id)
```

## Project structure

```
backend/
  src/server.js        Express app, static serving of uploads (+ built Angular if present)
  src/db.js            schema (created automatically)
  src/seed.js          demo data
  src/auth.js          JWT middleware        src/serialize.js   what each endpoint exposes
  src/routes/          auth · items · requests · users
  test/api.test.js     integration tests
src/app/
  core/                api.ts (HTTP + JWT interceptor) · store.ts (state, signals) · auth.guard.ts · models · format
  pages/               home · login (login + register) · profile · choose · borrower · lender
  shared/              item-card · request-dialog · rate-dialog
proxy.conf.json        dev proxy  /api, /uploads → :3000
```

## Troubleshooting

- **"Cannot reach the server"** in the UI → the API isn't running; start it (`npm run dev`).
- **Port already in use** → set `PORT=3001` in `backend/.env` **and** change the target in `proxy.conf.json`.
- **`better-sqlite3` install error** → make sure you're on Node 20+; delete `backend/node_modules` and run `npm run setup` again.
- **Start fresh** → `npm --prefix backend run reset`.
