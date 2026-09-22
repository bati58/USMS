# Stock Management System — Backend

Node.js / Express / PostgreSQL REST API implementing `Backend-SRS.docx` in
full: every entity, endpoint, role permission, and stock-quantity business
rule (FIFO valuation, GRN→evaluation, requisition→issue, returns,
transfers, disposal) described in that document.

This project is fully wired to the frontend.

## 1. Prerequisites

- Node.js 18+
- PostgreSQL 14+ (running locally, or a connection string to a hosted instance)

## 2. Setup

```bash
cd backend
npm install
```

Make sure you have a `.env` file configured:

```
DATABASE_URL=postgresql://<user>:<password>@localhost:5432/sms_db
JWT_SECRET=<replace with a long random string>
```

Build the schema and load demo data:

```bash
npm run db:migrate
npm run db:schema
npm run db:seed
```
`npm run db:migrate` applies numbered changes to an existing database and records them in `schema_migrations`. It is safe to run repeatedly. `schema.sql` is the current fresh-install baseline and does not run historical data backfills. For a safe cleanup that preserves the core master data (`users`, `items`, `stores`, and `suppliers`) while rebuilding reference/demo data, use `npm run db:fresh-seed`.

## 3. Run it

```bash
npm run dev
```

Database migrations are explicit and are not run when the API starts.

API is live at `http://localhost:4000`. Check `http://localhost:4000/health`
for a quick liveness check.

## 4. Demo login

Every seeded user's password is **`sms@1234`**:

```
admin | pao | storehead | storekeeper | clerk | tec | depthead | accountant | security | disposal
```

## 5. Project structure

```
src/
  app.js, server.js        Express app setup and entry point
  config/db.js             PostgreSQL pool + withTransaction() helper
  db/
    schema.sql             Full DDL for all tables and triggers
    seed.sql               Demo data matching the frontend's seed.js
    runSql.js              Runs a .sql file against DATABASE_URL
  middleware/
    auth.js                JWT verification
    authorize.js           Role permission enforcement (requireRole)
    errorHandler.js        Consistent { message } error responses
  utils/
    permissions.js         THE role x resource matrix (Backend-SRS §4)
    refGenerator.js        Safe concurrent GRN-2026-0001 style numbering
    audit.js               logAudit() helper, called by every mutation
    workflow.js            Strict state transition definitions (Approvals, Rejections, etc)
    AppError.js, asyncHandler.js
  services/
    stockService.js        ALL quantity-mutating business logic (§6):
                           FIFO consumption, GRN approval, issue
                           voucher generation, returns, transfers,
                           disposal — each wrapped in one DB transaction
  controllers/             One file per resource; _helpers.js holds
                           shared name<->ID resolution and DB row ->
                           camelCase JSON mappers
  routes/index.js          Protected endpoints use requireAuth and
               requireRole(resource) or requireRole(action, 'action')
```

## 6. Design notes worth knowing before you modify this

- **`stockService.js` is the only place that changes `items.qty_on_hand`.**
  Every workflow (GRN approval, issue voucher creation, return approval,
  transfer approval, disposal approval, bin transfer) goes through it. If
  you add a new way for stock to move, put the logic there, not in a
  controller — this is what keeps `stock_transactions`, `bin_cards`, and
  `items.qty_on_hand` from ever drifting out of sync with each other.
- **Every multi-step mutation runs inside `withTransaction()`.** A half-
  completed GRN approval (stock updated but the ledger row failed to
  insert, for example) is worse than one that fails cleanly and can be
  retried — that's why every service function takes a transaction
  `client`, never the plain pool.
- **FIFO is real**, not a single `unitPrice` field. `stock_lots` tracks
  each receipt as its own priced lot; `consumeFifo()` walks lots oldest-
  first on every issue, transfer, and disposal, per MoFED manual §5.4.
- **Reference numbers (`GRN-2026-0004` etc.) are generated server-side**
  with row-level locking (`ref_sequences` + `FOR UPDATE` semantics via the
  upsert in `refGenerator.js`), specifically because a client-generated
  number can't be trusted not to collide under concurrent users.
- **Authorization lives in exactly one file** (`utils/permissions.js`).
  Protected routes require authentication. Resource and action routes use
  `requireRole`; the dashboard-summary endpoint is authenticated and performs
  role-scoped aggregation in its controller. Don't add role checks inside
  controllers when the rule belongs in the permission matrix.
- **Disposal workflow** is status-driven: quarantine and technical assessment
  precede repair/return or disposal request; Store Head review and PAO/Disposal
  Committee authorization precede Storekeeper execution; PAO or the Disposal
  Committee confirms, posts the FIFO stock removal, completes, and closes the
  record. The disposal routes expose these stages as separate actions.
- **Audit actor identity** is stored in `audit_logs.actor_id`, `user_name`, and
  `actor_role`, alongside the entity and before/after change data. Stock
  transactions and bin-card movements persist actor names; `audit_logs` is the
  authoritative source for actor identity and role filtering.
