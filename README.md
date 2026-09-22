# Stock Management System — Complete System Overview

A full-stack, role-based inventory and stock-control application for universities, campuses, or any multi-store organisation. The system manages the entire stock lifecycle — from goods receipt through technical evaluation, GRN generation, stock posting, departmental requisitions, issue vouchers, material returns, inter-store transfers, fixed-asset tracking, disposals, stock-taking, reconciliation, gate verification, audit logging, and operational/financial reporting.

---

## Table of Contents

1. [Technology Stack](#1-technology-stack)
2. [System Architecture](#2-system-architecture)
3. [Actors and Roles](#3-actors-and-roles)
4. [RBAC Implementation — How It Works](#4-rbac-implementation--how-it-works)
5. [Complete Permission Matrix](#5-complete-permission-matrix)
6. [Implemented Workflows](#6-implemented-workflows)
7. [Database Schema — All Tables](#7-database-schema--all-tables)
8. [Notification System](#8-notification-system)
9. [Reporting System](#9-reporting-system)
10. [Audit Logging](#10-audit-logging)
11. [Business Rules Engine](#11-business-rules-engine)
12. [Getting Started](#12-getting-started)
13. [Project Structure](#13-project-structure)
14. [Developer Guidelines](#14-developer-guidelines)

---

## 1. Technology Stack

| Layer | Technology | Purpose |
|-------|-----------|---------|
| **Frontend** | React 18, Vite, React Router v6, Tailwind CSS, lucide-react, Recharts | SPA with role-specific dashboards, CRUD pages, workflow UIs |
| **Backend** | Node.js 18+, Express 4, JWT, bcryptjs, Helmet, CORS, express-rate-limit, Zod | REST API, authentication, authorization, request validation |
| **Database** | PostgreSQL 14+ (via `pg` driver) | Normalised relational schema, ACID transactions, CHECK constraints |
| **Dev Tooling** | nodemon, ESLint, Vite HMR | Hot-reload development for both stacks |

---

## 2. System Architecture

```
┌─────────────────────────────────────────────────────────────────────────┐
│                          Browser (User)                                │
└──────────────────────────────┬──────────────────────────────────────────┘
                               │ HTTPS
┌──────────────────────────────▼──────────────────────────────────────────┐
│                     Frontend (React + Vite)                            │
│  ┌─────────────┐  ┌──────────────────┐  ┌──────────────────────────┐  │
│  │ AuthContext  │  │ rolePermissions  │  │ pages/ (per module)      │  │
│  │ (JWT store)  │  │ (sidebar/action  │  │ dashboard/ goods-receipt │  │
│  │             │  │  visibility)     │  │ requisitions/ reports/   │  │
│  └─────────────┘  └──────────────────┘  └──────────────────────────┘  │
│                    services/apiClient  ──── Bearer token on every call │
└──────────────────────────────┬──────────────────────────────────────────┘
                               │ REST API  (http://localhost:4000/api)
┌──────────────────────────────▼──────────────────────────────────────────┐
│                     Backend (Express)                                  │
│  ┌────────────┐  ┌──────────────┐  ┌──────────────────────────────┐   │
│  │ auth.js    │  │ authorize.js │  │ routes/index.js              │   │
│  │ JWT verify │  │ requireRole  │  │ requireAuth + requireRole    │   │
│  │ → req.user │  │ (permissions │  │ on every protected route     │   │
│  │            │  │  .js matrix) │  │                              │   │
│  └────────────┘  └──────────────┘  └──────────────┬───────────────┘   │
│                                                    │                   │
│  ┌────────────────────┐  ┌─────────────────────────▼───────────────┐  │
│  │ controllers/       │  │ services/stockService.js                │  │
│  │ (thin HTTP layer;  │◀─│ ONLY place that mutates qty_on_hand     │  │
│  │  validate → call   │  │ FIFO lots, stock ledger, bin cards,     │  │
│  │  service → respond)│  │ all inside withTransaction()            │  │
│  └────────────────────┘  └─────────────────────────────────────────┘  │
│  ┌─────────────────────────────────────────────────────────────────┐  │
│  │ utils/: permissions.js │ workflow.js │ audit.js │ refGenerator  │  │
│  └─────────────────────────────────────────────────────────────────┘  │
└──────────────────────────────┬──────────────────────────────────────────┘
                               │ SQL (pg pool)
┌──────────────────────────────▼──────────────────────────────────────────┐
│                     PostgreSQL Database                                │
│  schema.sql (28 tables) + seed.sql (demo data)                        │
│  withTransaction() → BEGIN → service logic → COMMIT / ROLLBACK        │
└─────────────────────────────────────────────────────────────────────────┘
```

### Key architectural principles

- **Authentication**: JWT issued at `/api/auth/login`, refreshed via `/api/auth/refresh`. The token payload contains `{ id, role, name, username }` and is attached to every subsequent request as a Bearer header.
- **Authoritative security boundary**: The **backend** enforces all permissions. The frontend hides navigation and buttons for usability, but is never the security boundary.
- **Transaction safety**: Every multi-step mutation runs inside `withTransaction(callback)` in `config/db.js`. The helper retries client acquisition for `53300` (pool-exhausted) errors, rolls back on any thrown exception, and releases the client in a `finally` block.
- **Single point of stock mutation**: `services/stockService.js` is the **only** file that changes `items.qty_on_hand`. Every receipt, issue, return, transfer, disposal, and stock-taking adjustment goes through it.

---

## 3. Actors and Roles

The system defines **10 internal roles**. There is no supplier login.

| # | Role | Purpose |
|---|------|---------|
| 1 | **Administrator** | System administration, master data, users, configuration, monitoring, audit. Read-only on operational workflows. |
| 2 | **Property Administration Officer (PAO)** | Property governance, approval authority for requisitions, transfers, disposals, returns. Stock-taking oversight. |
| 3 | **Store Head** | Supervises store operations — receiving review, issue approval, transfer/return decisions, stock-taking ownership. |
| 4 | **Storekeeper** | Primary physical inventory operator — receives goods, prepares issues, executes transfers, handles returns, posts stock. |
| 5 | **Stock Clerk** | Maintains stock records, supports physical counts, reviews bin/stock cards, assists reconciliation. |
| 6 | **Technical Evaluation Committee (TEC)** | Evaluates quality, quantity, condition, and technical acceptability of received goods. |
| 7 | **Department Head** | Creates departmental requisitions, approves department-level requests, initiates returns and transfers. |
| 8 | **Accountant** | Monitors inventory value, FIFO valuation, receipts/issues/returns, financial reports. Read-only. |
| 9 | **Security Officer** | Gate-control role — verifies incoming deliveries and outgoing issues at the gate. Not an inventory-management role. |
| 10 | **Disposal Committee** | Authorizes and confirms disposal of unusable assets. |

---

## 4. RBAC Implementation — How It Works

The RBAC system is implemented through **three coordinated layers** that work together to enforce separation of duties across the entire application.

### 4.1 Layer 1 — Backend Permission Matrix (`backend/src/utils/permissions.js`)

This is the **single source of truth** for API authorization. It defines four permission categories:

```
READ_PERMISSIONS    — Who can GET a resource
WRITE_PERMISSIONS   — Who can POST/PUT a resource
ACTION_PERMISSIONS  — Who can perform workflow actions (approve, evaluate, post, execute, verify)
DELETE_PERMISSIONS  — Who can DELETE a resource
```

Each category maps **resource names** → **arrays of allowed role strings**:

```javascript
// Example from the actual code:
const READ_PERMISSIONS = {
  'goods-receipts': [ADMIN, PAO, STORE_HEAD, STOREKEEPER, STOCK_CLERK, TEC, ACCOUNTANT, SECURITY],
  users: [ADMIN],
  // ...
};
const ACTION_PERMISSIONS = {
  'goods-receipts-evaluate': [TEC],
  'goods-receipts-post':     [STOREKEEPER],
  'issue-vouchers':          [STORE_HEAD],
  'issue-voucher-post':      [STOREKEEPER],
  // ...
};
```

Four helper functions resolve access at runtime:

| Function | Logic |
|----------|-------|
| `canRead(resource, role)` | Returns `true` if the role is in `READ_PERMISSIONS[resource]`, or if the resource has no entry (unrestricted). |
| `canWrite(resource, role)` | Checks `WRITE_PERMISSIONS` first; falls back to `READ_PERMISSIONS` if no explicit write rule exists. |
| `canAct(resource, role)` | Checks `ACTION_PERMISSIONS`; falls back to `canWrite` if the resource has no action entry. |
| `canDelete(resource, role)` | Checks `DELETE_PERMISSIONS`; falls back to `canWrite`. |

### 4.2 Layer 2 — Authorization Middleware (`backend/src/middleware/authorize.js`)

The `requireRole(resource, mode)` middleware sits on protected resource and
action routes in `routes/index.js`. The dashboard-summary endpoint is
authenticated and performs role-scoped aggregation in its controller:

```javascript
// From the actual middleware:
function requireRole(resource, mode = 'resource') {
  return (req, res, next) => {
    const isWrite  = ['POST', 'PUT', 'PATCH', 'DELETE'].includes(req.method);
    const isDelete = req.method === 'DELETE';
    const allowed  = mode === 'action'
      ? canAct(resource, req.user.role)
      : isWrite
        ? isDelete ? canDelete(resource, req.user.role) : canWrite(resource, req.user.role)
        : canRead(resource, req.user.role);

    if (!allowed) return next(new AppError(`...`, 403));
    next();
  };
}
```

**How routes are protected** — every line in `routes/index.js` chains `requireAuth` (JWT verification) with `requireRole`:

```javascript
// Standard resource protection:
router.get('/items',     requireRole('items'),          itemsController.list);
router.post('/items',    requireRole('items'),          itemsController.create);

// Workflow action protection (mode = 'action'):
router.post('/goods-receipts/:id/evaluate',  requireRole('goods-receipts-evaluate', 'action'), ...);
router.post('/issue-vouchers/:id/post',      requireRole('issue-voucher-post', 'action'),      ...);
```

The `mode = 'action'` parameter triggers `canAct()` instead of `canWrite()`, enabling fine-grained action permissions like "TEC can evaluate but cannot post stock".

### 4.3 Layer 3 — Frontend Visibility (`frontend/src/utils/rolePermissions.js`)

The frontend maintains a **parallel permission map** that controls:

- **Sidebar navigation**: which links each role sees
- **Button visibility**: which action buttons appear on each page
- **Page access**: which routes are accessible per role

```
Frontend permissions control usability (what the user sees).
Backend permissions control security (what the user can do).
```

> **Critical rule**: Frontend and backend permission drift is treated as a bug. If a role sees a button but receives `403`, either the sidebar matrix or the backend matrix needs correction.

### 4.4 RBAC Flow — End to End

```
User clicks "Post GRN"
  → Frontend checks rolePermissions.js → button is visible
  → apiClient sends POST /api/goods-receipts/:id/post-stock with Bearer token
  → auth.js middleware verifies JWT → extracts { id, role, name, username }
  → authorize.js middleware calls canAct('goods-receipts-post', 'Storekeeper')
  → permissions.js lookup: ACTION_PERMISSIONS['goods-receipts-post'] = [STOREKEEPER]
  → ✅ Storekeeper is in the list → next()
  → controller validates → stockService.postReceipt() → PostgreSQL transaction
  → logAudit() records who did what
```

---

## 5. Complete Permission Matrix

### 5.1 Read Permissions

| Resource | Administrator | PAO | Store Head | Storekeeper | Stock Clerk | TEC | Dept Head | Accountant | Security | Disposal Committee |
|----------|:---:|:---:|:---:|:---:|:---:|:---:|:---:|:---:|:---:|:---:|:---:|
| stores | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | — |
| categories | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | — |
| items | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | — | — |
| locations | ✅ | ✅ | ✅ | ✅ | ✅ | — | — | — | — | — |
| suppliers | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | — | — |
| departments | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | — |
| goods-receipts | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | — | ✅ | ✅ | — |
| stock-transactions | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | — | — |
| bin-cards | ✅ | ✅ | ✅ | ✅ | ✅ | — | — | ✅ | — | — |
| requisitions | ✅ | ✅ | ✅ | ✅ | ✅ | — | ✅ | ✅ | — | — |
| issue-vouchers | ✅ | ✅ | ✅ | ✅ | ✅ | — | ✅ | ✅ | ✅ | — |
| material-returns | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | — | — |
| material-transfers | ✅ | ✅ | ✅ | ✅ | ✅ | — | ✅ | ✅ | — | — |
| fixed-assets | ✅ | ✅ | ✅ | — | ✅ | ✅ | ✅ | ✅ | — | — |
| disposals | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | — | ✅ | — | ✅ |
| stock-taking | ✅ | ✅ | ✅ | ✅ | ✅ | — | — | — | — | — |
| users | ✅ | — | — | — | — | — | — | — | — | — |
| audit-logs | ✅ | ✅ | — | — | — | — | — | ✅ | ✅ | — |
| reports | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | — |
| business-rules | ✅ | — | — | — | — | — | — | — | — | — |

### 5.2 Write Permissions (Create / Update)

| Resource | Allowed Roles |
|----------|---------------|
| stores | Administrator, PAO |
| categories | Administrator, PAO, Store Head |
| items | Administrator, Store Head |
| locations | Administrator, Store Head, Storekeeper |
| suppliers | Administrator, PAO, Store Head |
| departments | Administrator, PAO |
| goods-receipts | Storekeeper |
| requisitions | PAO, Store Head, Storekeeper, Department Head |
| issue-vouchers | Storekeeper |
| material-returns | Store Head, Department Head |
| material-transfers | PAO, Store Head, Storekeeper, Department Head |
| fixed-assets | PAO, Store Head |
| disposals | Store Head |
| stock-taking | Store Head, Stock Clerk |
| users | Administrator |
| stock-transactions | *(system-generated only — no direct writes)* |
| audit-logs | *(system-generated only)* |
| reports | *(read-only)* |

### 5.3 Action Permissions (Workflow Actions)

| Action | Allowed Roles |
|--------|---------------|
| **Goods Receipt: evaluate** | TEC |
| **Goods Receipt: status change** | Store Head, Storekeeper, TEC |
| **Goods Receipt: post stock** | Storekeeper |
| **Requisition: approve/reject** | Department Head, PAO, Store Head |
| **Issue Voucher: approve** | Store Head |
| **Issue Voucher: amend** | Store Head |
| **Issue Voucher: post** | Storekeeper |
| **Material Return: approve** | Store Head |
| **Material Return: receive** | Storekeeper |
| **Material Transfer: approve** | PAO, Store Head |
| **Material Transfer: execute** | Storekeeper |
| **Stock-Taking: submit/manage** | Store Head, PAO |
| **Stock-Taking: request recount** | Store Head |
| **Stock-Taking: verify** | Store Head |
| **Stock-Taking: reconcile** | Store Head |
| **Stock-Taking: approve adjustment** | PAO |
| **Stock-Taking: post** | Store Head, PAO |
| **Disposal: approve** | PAO |
| **Disposal: quarantine** | Storekeeper, Store Head |
| **Disposal: assess / reassess** | TEC |
| **Disposal: send for repair** | Storekeeper |
| **Disposal: request** | Store Head |
| **Disposal: review / recommend** | Store Head |
| **Disposal: authorize** | PAO, Disposal Committee |
| **Disposal: confirm** | PAO, Disposal Committee |
| **Disposal: execute** | Storekeeper |
| **Disposal: post** | PAO, Disposal Committee |
| **Disposal: complete / close** | PAO, Disposal Committee |
| **Gate Pass: verify** | Security Officer |
| **Business Rules: configure** | Administrator |

---

## 6. Implemented Workflows

### 6.1 Goods Receipt & GRN Workflow

**Purpose**: Record goods delivered by a supplier, evaluate technical acceptability, generate a GRN, and post accepted quantity into inventory.

```
Draft → Submitted → Pending Evaluation → Under Evaluation
  → Accepted / Partially Accepted / Rejected
  → GRN Generated → Posted
```

| Step | Actor | Database Effect |
|------|-------|-----------------|
| Create receipt | Storekeeper | Writes `goods_receipts` + `goods_receipt_items` + audit |
| Submit | Storekeeper | Status change + notification to TEC |
| Evaluate | TEC | Updates evaluation status/findings/quantities + audit |
| Generate GRN | Store Head | Creates `grns` + `grn_items` + reference number + audit |
| Post stock | Storekeeper | Increments `items.qty_on_hand` + creates `stock_lots` FIFO layer + writes `stock_transactions` + updates `bin_cards` + `bin_card_movements` + audit |
| Gate verify | Security | Sets `gate_verified` fields — no stock change |

> **Critical rule**: Creating a receipt does NOT increase stock. Stock changes only at the final posting step.

### 6.2 Requisition Workflow

**Purpose**: Allow a department to request stock and route the request through approval.

```
Draft → Submitted / Pending → Pending Approval
  → Approved / Partially Approved / Rejected / Returned for Correction
```

| Step | Actor | Database Effect |
|------|-------|-----------------|
| Create | Department Head | Writes `requisitions` + `requisition_items` + audit |
| Submit | Department Head | Status change + notification |
| Approve/Reject | Dept Head / PAO / Store Head | `requisition_approvals` + approved quantities + audit |

> No stock changes at creation or approval.

### 6.3 Issue Voucher (SIV / ISIV) Workflow

**Purpose**: Convert an approved requisition into a controlled issue document and post the material issue.

```
Preliminary → Pending Approval → Approved → Posted
```

| Step | Actor | Database Effect |
|------|-------|-----------------|
| Create preliminary | Storekeeper | Writes `issue_vouchers` + `issue_voucher_items` + ref number |
| Amend | Store Head | Creates `issue_voucher_amendments` records |
| Approve | Store Head | Status + `approved_by` + `approved_at` + audit |
| Post | Storekeeper | **FIFO consumption** (oldest lots first) → decreases `items.qty_on_hand` → writes Issue `stock_transactions` → updates `bin_cards` → marks voucher posted → updates requisition fulfillment → audit |
| Gate verify | Security | Sets gate-verification fields — no stock change |

> If available stock is insufficient, the transaction fails and rolls back entirely.

### 6.4 Material Return (SRN) Workflow

**Purpose**: Return previously issued material to the store; restore only eligible reusable quantity to stock.

```
Draft → Submitted → Pending Review → Approved / Rejected
  → Under Receiving → Fully Accepted / Partially Accepted
  → Returned to Stock
```

| Step | Actor | Database Effect |
|------|-------|-----------------|
| Create | Department Head | Writes `material_returns` + audit |
| Approve | Store Head | Status + qty_approved + audit |
| Receive | Storekeeper | Physical inspection + qty_accepted/rejected |
| Return to stock | System | Increases `items.qty_on_hand` + adds FIFO lot + Return `stock_transactions` + bin card + audit |

### 6.5 Material Transfer Workflow

**Purpose**: Move approved stock from one store to another.

```
Draft → Submitted → Pending Approval → Approved → Dispatched → Received
```

| Step | Actor | Database Effect |
|------|-------|-----------------|
| Create | Storekeeper / Dept Head | Writes `material_transfers` + audit |
| Approve | PAO / Store Head | Status change + audit |
| Dispatch | Source Storekeeper | FIFO consumption at source → Transfer-Out `stock_transactions` → source `bin_cards` update |
| Receive | Destination Storekeeper | Adds quantity at destination → Transfer-In `stock_transactions` → destination `bin_cards` update |

### 6.6 Disposal Workflow

**Purpose**: Flag unusable or obsolete stock and remove it through an authorised multi-step disposal process.

```
Flagged → Quarantined → Under Technical Assessment
  → Repairable → Send for Repair → (re-assessment or return to stock)
  → Unusable → Disposal Requested → Store Head Review
  → Recommended for Disposal → Pending Authorization → Ready for Disposal
  → Disposed → Pending Confirmation → Confirmed → Posted → Completed → Closed
```

| Step | Actor |
|------|-------|
| Flag / Quarantine | Storekeeper / Store Head |
| Technical assessment | TEC |
| Request disposal | Store Head |
| Review / recommend | Store Head |
| Authorize | PAO / Disposal Committee (`POST /api/disposals/:id/authorize`) |
| Execute | Storekeeper (`POST /api/disposals/:id/execute`) — records the physical disposal method and witness |
| Confirm | PAO / Disposal Committee (`POST /api/disposals/:id/confirm`) |
| Post (stock out) | PAO / Disposal Committee (`POST /api/disposals/:id/post`) — FIFO consumption → decreases qty → Disposal `stock_transactions` → bin cards → audit |
| Complete / close | PAO / Disposal Committee (`POST /api/disposals/:id/complete`, then `/close`) |

The workflow also exposes separate `quarantine`, `start-assessment`, `assess`,
`repair`, `reassess`, `request`, `review`, `recommend`,
`submit-authorization`, and `submit-confirmation` actions. The legacy
`approve` action is PAO-only and is retained for compatible approval paths.

### 6.7 Stock-Taking & Reconciliation Workflow

**Purpose**: Compare physical quantities with system quantities and apply controlled adjustments.

```
Draft → Scheduled → In Progress → Submitted → Under Review
  → Recount Required (loop back) / Variance Detected → Investigation
  → Adjustment Proposed → Pending Approval → Approved → Posted → Closed
```

| Step | Actor | Database Effect |
|------|-------|-----------------|
| Create session | Store Head / Stock Clerk | Writes `stock_taking_sessions` + `stock_taking_items` |
| Record counts | Counter | Stores system_qty, physical_qty, variance, reason |
| Submit | Counter | Status change |
| Verify / Reconcile | Store Head | Status change |
| Approve adjustment | PAO | Status change |
| Post | Store Head / PAO | FIFO consumption for shortages, adjustment lot for surpluses → `items.qty_on_hand` → Adjustment `stock_transactions` → bin cards → audit |

### 6.8 Gate Pass Verification Workflow

**Purpose**: Security control point for physical movement of goods into or out of the premises.

| Direction | Eligible Documents | Trigger |
|-----------|--------------------|---------|
| **Incoming** | Goods receipts with status `GRN Generated` | Security verifies supplier/store/reference |
| **Outgoing** | Issue vouchers with status `Approved` or `Posted` | Security verifies recipient/reference |

Gate verification **does not alter stock** — it records `gate_verified`, `gate_verified_by`, and `gate_verified_at`.

---

## 7. Database Schema — All Tables

The schema is defined in `backend/src/db/schema.sql` (617 lines). All tables use `SERIAL PRIMARY KEY`, foreign-key constraints, and CHECK constraints for status enums.

### Identity & Access

| Table | Columns (key) | Purpose |
|-------|---------------|---------|
| `users` | id, name, username, password_hash, **role** (TEXT), email, department, active, failed_login_attempts, locked_until | User accounts. Role is stored as a text string, not a FK. |

### Reference / Master Data

| Table | Purpose |
|-------|---------|
| `stores` | Store locations (code, type, department, head_of_store, storekeeper, active) |
| `store_user_assignments` | Relational store↔user ownership with assignment_role (`Store Head` / `Storekeeper`), effective dates, unique-active indexes |
| `categories` | Item categorisation (code, name, store_id, active) |
| `items` | Item catalogue — code, name, category_id, **store_id**, bin, unit, min/max/reorder levels, **qty_on_hand** (CHECK ≥ 0), unit_price, expiry_tracked, location_id |
| `item_inventory` | Per-store inventory for multi-store items (item_id + store_id unique), mirrors item-level fields |
| `locations` | Hierarchical store locations — type IN (`SECTION`, `RACK`, `SHELF`, `BIN`), parent_id self-reference |
| `suppliers` | External suppliers (code, name, contact, address, active) |
| `departments` | Departments with head_user_id FK to users |

### Goods Receiving

| Table | Purpose |
|-------|---------|
| `goods_receipts` | Receipt metadata — grn_ref, supplier, po_ref, material_type, condition_on_arrival, status (12-value CHECK), evaluation fields, gate verification fields |
| `goods_receipt_items` | Line items — item_id, qty, unit_price, qty_accepted, qty_rejected |
| `grns` | Generated GRN documents — grn_number (unique), goods_receipt_id, generated_by/at |
| `grn_items` | GRN line items — grn_id, item_id, qty, unit_price |

### Stock Truth (FIFO & Ledger)

| Table | Purpose |
|-------|---------|
| `stock_lots` | **FIFO costing layers** — item_id, store_id, received_date, unit_price, qty_received, **qty_remaining** (CHECK ≥ 0), source_ref. Indexed on `(item_id, received_date, id)` for oldest-first consumption. |
| `stock_transactions` | **Stock card ledger** — item_id, date, type IN (`Receipt`, `Issue`, `Return`, `Transfer-Out`, `Transfer-In`, `Adjustment`, `Disposal`), ref, qty_in, qty_out, unit_price, **balance**, actor_name, store_id, source_type/id |
| `bin_cards` | Physical bin state — bin + store_id + item_id (unique), balance |
| `bin_card_movements` | Movement history per bin card — movement_date, reference, type, qty_in, qty_out, balance |
| `bin_transfers` | Immediate bin-to-bin transfers (no approval step) — item_id, from_bin, to_bin, qty |

### Requisitions & Issues

| Table | Purpose |
|-------|---------|
| `requisitions` | Store requisitions — sr_ref, department, department_id, store_id, priority, reason, status (12-value CHECK) |
| `requisition_items` | Line items — item_id, qty, qty_approved |
| `requisition_approvals` | Approval history — decision, comments, approved_by, approved_at |
| `issue_vouchers` | Issue documents — siv_ref, type (`SIV`/`ISIV`), sr_ref, status (6-value CHECK), approved_by/at, posted_by/at, gate verification fields |
| `issue_voucher_items` | Line items — item_id, qty, unit_price |
| `issue_voucher_amendments` | Amendment history — previous_qty, amended_qty, reason, amended_by/at |

### Returns & Transfers

| Table | Purpose |
|-------|---------|
| `material_returns` | SRN documents — srn_ref, department, item_id, qty, reason, condition, original_issue_ref, status (12-value CHECK), qty_approved/received/accepted/rejected, evaluation fields, receiving fields |
| `material_transfers` | Store-to-store transfers — transfer_ref, from_store_id, to_store_id, item_id, qty, status (10-value CHECK), dispatched_by/at, received_by/at, gate verification fields |

### Assets & Disposals

| Table | Purpose |
|-------|---------|
| `fixed_assets` | Asset register — asset_tag (unique), name, category, store_id, assigned_to, status (9-value CHECK), acquisition_date, value, source_grn_ref |
| `user_cards` | Per-user material custody cards — user_id, item_id, issue_ref, issue_date, qty, status (`In Use`/`Maintenance`/`Lost`/`Damaged`/`Returned`) |
| `disposals` | Disposal lifecycle — disposal_ref, item_id, store_id, qty, reason, status (26-value CHECK covering the full multi-step lifecycle), assessment/review/approval/execution/confirmation/posting fields |

### Stock Control

| Table | Purpose |
|-------|---------|
| `stock_taking_sessions` | Physical count sessions — session_ref, store_id, count_date, status (14-value CHECK), created_by, assigned_to, approved_by/at, closed_by/at |
| `stock_taking_items` | Count lines — session_id, item_id, bin, system_qty, physical_qty, variance, reason, counter, verified_by, adjustment_ref |

### System & Monitoring

| Table | Purpose |
|-------|---------|
| `ref_sequences` | Atomic reference number generator — prefix + year → next_val. Used with `FOR UPDATE` row locking for GRN-2026-0004 style numbering. |
| `audit_logs` | Immutable audit trail — user_name, action, module, actor_id/role, entity_type/id/reference, description, outcome, **before_data** (JSONB), **after_data** (JSONB), **changes** (JSONB), **metadata** (JSONB) |
| `business_rules` | Configurable rules — rule_name (unique), rule_category, rule_value, rule_type (`integer`/`decimal`/`boolean`/`text`/`enum`), validation constraints |
| `notifications` | Persisted workflow notifications — user_id, title, message, type (`info`/`success`/`warning`/`error`), route, entity_type/id, read_at |

---

## 8. Notification System

### Backend-persisted notifications

Critical workflow actions call `notify()` inside a PostgreSQL transaction, inserting rows into `notifications` for a specific user or every active user with a target role. Loaded via `GET /api/notifications`. Clicking a notification marks it read and navigates to the stored deep-link route (e.g., `/requisitions/:id`).

### Browser-derived notifications

`frontend/src/utils/buildNotifications.js` derives role-relevant alerts from currently loaded data — low stock, pending receipts, pending approvals, gate-eligible movements, etc. These are convenience alerts, not a substitute for transactional backend notifications.

---

## 9. Reporting System

Reports are served by `GET /api/reports/*` endpoints and scoped per role.

| Report Family | Data Source |
|---------------|------------|
| Current stock balance | `items.qty_on_hand` |
| Stock card | `stock_transactions` |
| Bin card | `bin_cards` + `bin_card_movements` |
| Low / reorder stock | `items` with level thresholds |
| Stock movement | `stock_transactions` |
| FIFO inventory valuation | `stock_lots` |
| Goods receipt status | `goods_receipts` |
| GRN report | `grns` + `grn_items` |
| Requisition status | `requisitions` |
| SIV / ISIV status | `issue_vouchers` |
| Department consumption | `issue_vouchers` by department |
| Transfer report | `material_transfers` |
| Material return / SRN | `material_returns` |
| Fixed asset register | `fixed_assets` |
| Disposal report | `disposals` |
| Supplier transactions | `goods_receipts` by supplier |
| Dashboard summary | Aggregated counts per role |

All reports support filtering by store, category, status, date range, and text search. CSV export is available via `GET /api/reports/export-csv`.

---

## 10. Audit Logging

Every mutation calls `logAudit()` from `utils/audit.js`. Audit entries are **immutable** and include:

- Timestamp, actor ID, actor name, actor role
- Action, module, entity type, entity ID/reference
- Description, outcome (`SUCCESS` / `FAILED`)
- **before_data** and **after_data** (JSONB snapshots)
- **changes** (field-level diff array)
- **metadata** (IP address, user-agent for auth events)

Audit visibility is role-scoped:
- **Administrator**: full system visibility
- **PAO**: property/approval-related modules
- **Accountant**: financial-related modules
- **Security**: gate and authentication activity
- **Disposal Committee**: disposal records and disposal workflow activity

Audit records expose actor ID, actor name, and actor role. Stock transactions
and bin-card movements currently persist actor names; `audit_logs` is the
authoritative source for actor identity and role filtering.

---

## 11. Business Rules Engine

Stored in the `business_rules` table. Administrator-only configuration via `GET/PUT /api/business-rules/*`.

Currently enforced: `SHELF_LIFE_WARNING_DAYS` — number of days before expiry when an item is highlighted.

Rules support typed values (`integer`, `decimal`, `boolean`, `text`, `enum`) validated against min/max and allowed values.

---

## 12. Getting Started

### Prerequisites

- Node.js 18+
- PostgreSQL 14+

### Backend

```bash
cd backend
cp .env.example .env          # Set DATABASE_URL, JWT_SECRET
npm install
npm run db:schema              # Create all tables
npm run db:seed                # Load demo data
npm run dev                    # API at http://localhost:4000
```

### Frontend

```bash
cd frontend
cp .env.example .env           # Optional port config
npm install
npm run dev                    # Vite dev server at http://localhost:5174
```

### Demo Login

All seeded users share the password **`sms@1234`**:

```
admin | pao | storehead | storekeeper | clerk | tec | depthead | accountant | security | disposal
```

### Database Commands

| Command | Purpose |
|---------|---------|
| `npm run db:schema` | Create/update all tables (idempotent) |
| `npm run db:seed` | Load demo data |
| `npm run db:reset` | Schema + seed combined |
| `npm run db:fresh-seed` | Preserves master data, rebuilds demo/reference data |
| `npm run db:migrate` | Apply numbered migrations (records in `schema_migrations`) |

---

## 13. Project Structure

```
stock-management-system/
├── backend/
│   └── src/
│       ├── app.js                          Express middleware + route mounting
│       ├── server.js                       Server startup + DB health check
│       ├── config/db.js                    PG pool + query() + withTransaction()
│       ├── middleware/
│       │   ├── auth.js                     JWT verification → req.user
│       │   ├── authorize.js                requireRole() middleware
│       │   └── errorHandler.js             Consistent { message } errors
│       ├── utils/
│       │   ├── permissions.js              THE role × resource matrix
│       │   ├── workflow.js                 Allowed state transitions
│       │   ├── audit.js                    logAudit() helper
│       │   ├── notify.js                   Transactional notification insertion
│       │   ├── refGenerator.js             Atomic GRN-2026-0001 numbering
│       │   ├── AppError.js                 Custom error class
│       │   └── asyncHandler.js             Async route wrapper
│       ├── services/
│       │   └── stockService.js             ALL quantity-mutating logic (59 KB)
│       ├── controllers/                    One file per resource (26 files)
│       ├── routes/index.js                 Every API endpoint, all guarded
│       └── db/
│           ├── schema.sql                  Full DDL (617 lines, 28 tables)
│           ├── seed.sql                    Demo data
│           ├── migrations/                 Numbered migration files
│           ├── migrate.js                  Migration runner
│           ├── runSql.js                   SQL file executor
│           └── freshSeed.js               Safe demo data rebuild
│
├── frontend/
│   └── src/
│       ├── App.jsx                         Route registration
│       ├── main.jsx                        Vite entry point
│       ├── index.css                       Tailwind + custom styles
│       ├── components/
│       │   ├── layout/                     Sidebar, Topbar, DashboardLayout
│       │   ├── crud/CrudPage.jsx           Shared CRUD page framework
│       │   └── ui/                         Card, Table, Modal, Button, Select…
│       ├── context/
│       │   ├── AuthContext.jsx             Login/session state (JWT in localStorage)
│       │   └── NotificationContext.jsx     Notification loading + read state
│       ├── pages/                          One folder per module
│       │   ├── dashboard/                  Role-specific dashboards (9 variants)
│       │   ├── goods-receipt/              Receiving + evaluation pages
│       │   ├── requisitions/               Requisition workflow
│       │   ├── issue-vouchers/             Issue voucher workflow
│       │   ├── gate-pass/                  Security verification
│       │   ├── reports/                    Reports page
│       │   ├── audit/                      Audit log page
│       │   └── …                           (all other modules)
│       ├── services/                       API client + entity service factory
│       ├── router/                         ProtectedRoute guard
│       └── utils/
│           ├── rolePermissions.js          Frontend page/action visibility
│           ├── buildNotifications.js       Derived browser notifications
│           ├── constants.js                Roles, statuses, units, colours
│           └── formatters.js              Display formatting helpers
│
└── docs/
    └── COMPLETE_SYSTEM_REFACTOR_GUIDE.md   1588-line operational guide
```

---

## 14. Developer Guidelines

### When adding or modifying a workflow

1. Define the responsible actor and next actor first.
2. Add or update backend permission rules in `utils/permissions.js`.
3. Add the frontend route and role navigation in `utils/rolePermissions.js`.
4. Add controller validation.
5. Put **all** stock mutation in `services/stockService.js`.
6. Wrap multi-table operations in `withTransaction()`.
7. Add audit information with actor and entity context via `logAudit()`.
8. Add a persisted notification for the next responsible actor via `notify()`.
9. Update the dashboard cards for relevant roles.
10. Add report/filter support if the transaction should be reportable.
11. Test UI and PostgreSQL state together.
12. Update documentation.

### Invariants

- **`stockService.js` is the only file that changes `items.qty_on_hand`.** Never update it from a controller.
- **Every multi-step mutation runs inside `withTransaction()`.** Half-completed operations are worse than clean failures.
- **FIFO is real.** `stock_lots` tracks each receipt as its own priced lot; `consumeFifo()` walks lots oldest-first.
- **Reference numbers are server-generated** with row-level locking (`ref_sequences` + `FOR UPDATE`).
- **Authorization lives in exactly one file** (`utils/permissions.js`). Don't add `if (req.user.role === ...)` in controllers — extend the matrix instead.

### Completion standard

A workflow is complete only when this entire chain works:

```
Actor → permitted page → permitted action → API route → authentication
→ authorization → validation → business service → PostgreSQL transaction
→ document + stock state → audit → notification → refreshed UI → report visibility
```

---

## Further Documentation

- [`backend/README.md`](./backend/README.md) — Backend setup, migrations, design notes
- [`frontend/README.md`](./frontend/README.md) — Frontend architecture, route map, SRS use-case mapping
- [`docs/COMPLETE_SYSTEM_REFACTOR_GUIDE.md`](./docs/COMPLETE_SYSTEM_REFACTOR_GUIDE.md) — 1588-line deep-dive into every actor, workflow, permission, dashboard, and testing procedure
