# Stock Management System - Complete Refactor and Operating Guide

## 1. Purpose of This Document

This document explains the current Stock Management System as implemented in the repository. It is intended for:

- developers maintaining the code;
- administrators configuring the system;
- operational actors testing workflows;
- reviewers comparing UI behavior with PostgreSQL data;
- future contributors deciding what is implemented and what still needs work.

The guide describes the current implementation, not only the desired future design. Where the documented business model and the live permission/code behavior differ, the difference is called out explicitly.

The application is a browser-based inventory and stock-control system for an organization such as a university or campus. It manages:

- users and role-based access;
- stores, departments, suppliers, categories, items, and locations;
- goods receiving and technical evaluation;
- GRN generation and stock posting;
- departmental requisitions;
- issue vouchers and stock issuing;
- material returns;
- inter-store transfers;
- fixed assets and disposals;
- stock-taking and reconciliation;
- gate verification for incoming and outgoing movements;
- notifications;
- audit logs;
- operational and financial reports.

---

## 2. System Architecture

The system has three main layers.

### 2.1 Frontend

Technology:

- React 18;
- Vite;
- React Router;
- Tailwind CSS;
- lucide-react icons;
- browser local storage for the JWT session and some notification read state.

Important frontend areas:

```text
frontend/src/
  App.jsx                         Route registration
  components/layout/              Dashboard shell, sidebar, topbar
  components/crud/CrudPage.jsx   Shared CRUD page for reference data
  components/ui/                  Card, Select, Table, Modal, Button, etc.
  context/AuthContext.jsx         Login/session state
  context/NotificationContext.jsx Notification loading and read state
  pages/dashboard/                Role-specific dashboards
  pages/audit/                    Audit Log page
  pages/reports/                  Reports page
  pages/goods-receipt/            Receiving and evaluation pages
  pages/requisitions/             Requisition workflow
  pages/issue-vouchers/           Issue voucher workflow
  pages/gate-pass/                Security verification page
  services/                       API service layer
  utils/rolePermissions.js        Frontend page/action visibility
  utils/buildNotifications.js     Derived role notifications
```

Frontend permission checks control usability. They hide navigation and buttons that a role should not use, but they are not the security boundary.

### 2.2 Backend

Technology:

- Node.js;
- Express;
- PostgreSQL;
- `pg` raw SQL client;
- JWT authentication;
- bcrypt password hashing;
- Helmet;
- CORS allowlist;
- login rate limiting.

Important backend areas:

```text
backend/src/
  app.js                          Express middleware and route mounting
  server.js                       Server startup and database health check
  routes/index.js                 API routes
  middleware/auth.js              JWT authentication
  middleware/authorize.js         Role/resource/action authorization
  controllers/                   HTTP handlers and non-stock SQL operations
  services/stockService.js        Atomic stock-changing business logic
  config/db.js                    PostgreSQL pool and transactions
  db/schema.sql                   Canonical database schema
  db/seed.sql                     Synthetic baseline data
  utils/permissions.js             Backend permission matrix
  utils/workflow.js                Allowed workflow transitions
  utils/audit.js                   Audit record insertion
  utils/notify.js                  Transactional notification insertion
  utils/refGenerator.js            Reference-number generation
```

Backend authorization is authoritative. A user who manually calls an API cannot bypass `requireAuth` and `requireRole` merely because a frontend button is hidden.

### 2.3 Database

PostgreSQL stores the authoritative operational state. The most important tables are:

| Area | Tables |
|---|---|
| Identity | `users` |
| Reference data | `departments`, `stores`, `categories`, `suppliers`, `locations`, `items` |
| Receiving | `goods_receipts`, `goods_receipt_items`, `grns`, `grn_items` |
| Stock truth | `items.qty_on_hand`, `stock_lots`, `stock_transactions`, `bin_cards`, `bin_card_movements` |
| Requests and issues | `requisitions`, `requisition_items`, `requisition_approvals`, `issue_vouchers`, `issue_voucher_items`, `issue_voucher_amendments` |
| Returns/transfers | `material_returns`, `material_transfers` |
| Assets/disposals | `fixed_assets`, `user_cards`, `disposals` |
| Stock control | `stock_taking_sessions`, `stock_taking_items` |
| Control and monitoring | `audit_logs`, `notifications`, `business_rules`, `ref_sequences` |

Stock-changing operations run through `withTransaction()` and `stockService.js`. A successful stock operation should update the item balance, FIFO lots, stock ledger, bin card, document status, audit record, and notifications as one transaction where applicable.

---

## 3. Normal Request Path

A normal UI action follows this path:

```text
User
  -> React page and form
  -> frontend service
  -> HTTP request with JWT
  -> Express route
  -> requireAuth
  -> requireRole(resource, action)
  -> controller validation
  -> stock service when stock changes
  -> PostgreSQL transaction
  -> audit and notification side effects
  -> JSON response
  -> frontend refresh and toast
```

For a stock movement, the critical rule is:

> Do not treat a document being created as a stock movement. Stock changes normally occur only when the appropriate posting, issue, return, transfer, disposal, or reconciliation action is executed.

Examples:

- creating a goods receipt does not increase stock;
- technical evaluation does not increase stock;
- generating a GRN does not necessarily post stock;
- posting a GRN increases stock;
- creating a requisition does not reduce stock;
- approving a requisition does not reduce stock;
- posting an issue voucher reduces stock;
- creating a transfer does not necessarily move stock;
- dispatching/receiving a transfer performs the transfer legs;
- a gate verification does not change stock; it records physical control verification.

---

## 4. Actors and Their Responsibilities

The system has nine internal roles.

1. Administrator
2. Property Administration Officer (PAO)
3. Store Head
4. Storekeeper
5. Stock Clerk
6. Technical Evaluation Committee (TEC)
7. Department Head
8. Accountant
9. Security Officer

A supplier is treated as an external party. There is no supplier login in the current application.

### 4.1 Administrator

#### Purpose

The Administrator owns system administration, master data, users, configuration, monitoring, and emergency oversight.

#### Main pages

- Dashboard;
- Stores;
- Categories;
- Items;
- Locations;
- Suppliers;
- Departments;
- Goods Receipts;
- Technical Evaluation;
- GRN Documents;
- Stock Cards;
- Bin Cards;
- Bin Transfers;
- Requisitions;
- Issue Vouchers;
- Material Returns;
- Material Transfers;
- Stock Taking;
- Reconciliation;
- Fixed Assets;
- User Material Cards;
- Disposal Management;
- Gate Pass Verification;
- Users;
- Business Rules;
- Reports;
- Audit Log.

#### Can do

- create and edit users, including activation/deactivation;
- create and edit stores, categories, items, locations, suppliers, and departments;
- view operational data across the system, including receipts, evaluations, GRNs, stock cards, requisitions, issues, returns, transfers, stock-taking, reconciliation, assets, disposal, and gate records;
- configure Business Rules;
- view and export Audit Logs;
- access all reports.

#### Cannot or should not do operationally

The Administrator is read-only on ordinary operational workflows. The backend denies Administrator write/action requests for those resources, and the frontend hides their operational buttons.

Administrator cannot normally:

- create or edit goods receipts;
- evaluate or post goods receipts;
- create or approve requisitions;
- create, approve, amend, or post issue vouchers;
- create or approve material returns;
- create, approve, dispatch, or receive material transfers;
- create or execute bin transfers;
- create or post stock-taking sessions;
- create, approve, or execute disposals;
- create or edit fixed assets or user material cards;
- verify gate passes;
- delete operational or master records through ordinary delete actions.

The Administrator may view these pages for governance and monitoring. A future emergency override must be a separate reasoned, confirmed, audited action and must never silently behave like ordinary CRUD.

### 4.2 Property Administration Officer (PAO)

#### Purpose

PAO supervises property administration, inventory governance, approvals, stores, assets, disposals, reconciliation, and audit oversight.

#### Main pages

- Dashboard;
- stores, categories, items, locations, suppliers, departments;
- goods receipts and GRN documents;
- stock cards, bin cards, stock transfers;
- requisitions and issue vouchers;
- material returns and material transfers;
- fixed assets and user material cards;
- disposals;
- stock taking and reconciliation;
- reports;
- audit log.

#### Can do in the current implementation

- view broad operational data;
- create and edit stores;
- create and edit categories;
- create and edit suppliers;
- create and edit departments;
- edit disposal records where the page supports it;
- approve or reject requisitions;
- approve or reject material returns;
- approve or reject material transfers;
- approve or reject disposals;
- review reports;
- view and export audit logs;
- approve stock-taking sessions and post them according to the current backend action matrix.

#### Cannot or should not normally do

- create or edit users;
- perform routine physical receiving as the normal receiver;
- perform TEC technical evaluation as the normal evaluator;
- perform routine store issuing;
- act as the sole physical stock counter;
- perform normal gate verification.

The current frontend allows PAO to view more modules than it can modify. Backend permissions remain the final authority.

### 4.3 Store Head

#### Purpose

The Store Head supervises store operations and approvals. This role is responsible for store-level receiving review, issue supervision, stock oversight, and transfer/return decisions.

#### Can do

- view store, item, location, supplier, department, receiving, stock, requisition, issue, return, transfer, and report pages;
- create and edit stores, categories, goods receipts, requisitions, issue vouchers, returns, transfers, user cards, and locations where the page exposes those actions;
- approve or reject goods receipts, issue vouchers, returns, and transfers;
- generate or post receiving records according to the action route;
- create or approve supported stock-taking work;
- review store stock, cards, receipts, and pending requisitions.

#### Cannot or should not normally do

- create or manage users;
- perform TEC technical evaluation as the technical committee;
- perform Security gate verification as the normal control officer;
- delete most records through the current permission matrix;
- replace the department head's departmental approval responsibility when separation of duties is required.

### 4.4 Storekeeper

#### Purpose

The Storekeeper is the main physical inventory operator. This role receives goods, prepares issues, handles returns, executes store transfers, manages locations, and maintains physical stock records.

#### Can do

- view inventory, locations, goods receipts, GRNs, stock cards, bin cards, requisitions, issue vouchers, returns, transfers, user cards, suppliers, stock taking, and reports;
- create goods receipts;
- create issue vouchers;
- create bin transfers;
- create material transfers;
- create user material cards;
- create and edit locations;
- post goods receipts where the backend route permits;
- post issue vouchers where the backend route permits;
- dispatch and receive material transfers through execution actions;
- prepare and process material returns;
- count stock and submit stock-taking sessions;
- view current stock and operational reports.

#### Cannot do

- approve requisitions in the current backend action matrix;
- approve or reject returns as the approval authority;
- approve material transfers;
- approve issue vouchers as Store Head;
- perform TEC evaluation;
- modify `stock_transactions`, FIFO lots, or balances directly;
- perform gate verification;
- access the Audit Log page under current permissions;
- manage users, business rules, departments, or most administrative master data.

### 4.5 Stock Clerk

#### Purpose

The Stock Clerk maintains stock records, supports stock counts, reviews cards, and assists with reconciliation and reporting.

#### Can do

- view items, locations, stores, categories, suppliers, stock cards, bin cards, stock transfers, reports, stock taking, and reconciliation;
- create supported bin/stock transfer records according to the frontend and backend matrices;
- participate in stock counting;
- submit stock-taking sessions in the current implementation;
- view low-stock information and stock movement reports;
- review reconciliation data.

#### Cannot do

- create or edit users;
- approve requisitions, receipts, returns, transfers, or disposals;
- post stock-taking adjustments under the intended segregation rule;
- create normal goods receipts or issue vouchers;
- modify stock ledger rows directly;
- access gate verification;
- access Audit Log;
- manage Business Rules.

### 4.6 Technical Evaluation Committee (TEC)

#### Purpose

TEC evaluates the quality, quantity, condition, and technical acceptability of received goods.

#### Can do

- view goods receipt and technical evaluation pages;
- review receipts awaiting evaluation;
- claim or move a receipt into evaluation when the action permits;
- record accepted, partially accepted, or rejected evaluation outcomes;
- enter evaluation notes, findings, conditions, evidence, and evaluator details;
- view GRN-related reports;
- view reports allowed for the TEC role.

#### Cannot do

- create ordinary goods receipts;
- post stock into inventory;
- approve requisitions;
- issue materials;
- create or approve transfers;
- process returns as a store or PAO authority;
- perform gate verification;
- manage users or Business Rules;
- access Audit Log under current permissions.

### 4.7 Department Head

#### Purpose

The Department Head represents a department. This role creates requests for departmental materials, approves requests from the department where applicable, and manages departmental return/transfer requests.

#### Can do

- view the Department Head dashboard;
- view items available for request;
- create requisitions;
- view requisitions scoped to the department or requested by the current user;
- submit requisitions for approval;
- approve departmental requisitions when the current role and department scope allow it;
- return or reject requisitions when permitted;
- create material returns;
- create material transfer requests;
- view department-relevant reports;
- view department/user-material information available to the role.

#### Cannot do

- create or edit users;
- manage stores, suppliers, departments, categories, or locations;
- receive or post goods;
- perform technical evaluation;
- issue stock;
- approve PAO/store-level transfers outside the permitted departmental scope;
- approve returns as the store/PAO authority;
- perform gate verification;
- view Audit Log;
- change Business Rules.

The backend scopes Department Head requisition list access by department or requester identity. This prevents the normal list API from returning unrelated departmental requests.

### 4.8 Accountant

#### Purpose

The Accountant monitors inventory value, receipts, issues, returns, adjustments, reconciliation, FIFO valuation, and financial reports.

#### Can do

- view financial and operational reports;
- view inventory, stock cards, bin cards, receipts, GRNs, issue vouchers, returns, transfers, suppliers, and reconciliation;
- view FIFO valuation;
- review inventory value and movement values;
- view Audit Log;
- export Audit Log;
- review transaction and reconciliation information.

#### Cannot do

- create or edit stock documents;
- approve operational workflows;
- receive or post goods;
- issue materials;
- create or approve requisitions and transfers;
- manage users or Business Rules;
- perform gate verification;
- modify stock balances or financial values directly.

### 4.9 Security Officer

#### Purpose

Security verifies that approved materials are physically allowed to enter or leave the campus or organization's premises. Security is a control-point role, not an inventory-management role.

#### Can do

- view the Security dashboard;
- open Gate Pass Verification;
- view eligible incoming goods receipts;
- view eligible outgoing issue vouchers;
- verify an approved/generated incoming delivery at the gate;
- clear an approved/posted outgoing issue voucher at the gate;
- record verifier name and verification timestamp;
- view security-related reports;
- view Audit Log for gate and authentication activity;
- view and export permitted audit information.

#### Cannot do

- create requisitions;
- approve requisitions;
- receive goods into stock;
- evaluate goods technically;
- post GRNs;
- issue materials;
- approve or dispatch store transfers;
- modify stock quantities;
- create arbitrary gate documents;
- manage users, departments, stores, suppliers, items, or Business Rules;
- approve its own source transaction.

The current Security interface is intentionally limited to incoming goods receipts and outgoing issue vouchers. Store-to-store material transfers are not exposed as a Security management module in the current navigation and permission refactor. If transfer gate verification is required by policy, it should be implemented as a separate verification-only document flow rather than giving Security transfer-management permissions.

---

## 5. Permission Model

There are two permission matrices that must stay synchronized:

- `backend/src/utils/permissions.js` is authoritative for API access;
- `frontend/src/utils/rolePermissions.js` controls page visibility and button visibility.

The matrices distinguish several concepts:

- READ: can view a resource;
- WRITE: can create, update, or delete a resource when the route supports it;
- ACTION: can perform a workflow action such as approve, evaluate, post, execute, or verify;
- EXPORT: can export permitted data;
- CONFIGURE: can change system rules.

### Important authorization rule

A page being visible does not mean every action on the page is allowed. For example:

- a Storekeeper may view a requisition but cannot approve it;
- TEC may view a goods receipt and evaluate it but cannot normally post stock;
- Security may view issue vouchers for gate verification but cannot create them;
- Accountant may view reports but cannot modify transaction data.

### Current notable permission boundaries

| Resource/action | Main permitted roles |
|---|---|
| Users | Administrator only |
| Business Rules | Administrator only |
| Audit Log | Administrator, PAO, Accountant, Security Officer |
| Gate verification | Security Officer |
| Goods receipt creation/write | Store Head, Storekeeper |
| Goods receipt evaluation | TEC |
| Goods receipt posting | Store Head, Storekeeper |
| Requisition approval | PAO, Store Head, Department Head |
| Issue voucher posting | Store Head, Storekeeper |
| Transfer approval | PAO, Store Head, Department Head |
| Transfer execution | Store Head, Storekeeper |
| Stock-taking post | PAO, Store Head |
| Reports | Role-scoped report catalogue and backend resource permissions |

Frontend and backend permission drift must be treated as a bug. If a role sees a link but receives `403`, either the sidebar or backend matrix needs correction.

---

## 6. Transaction Workflows

### 6.1 Goods Receipt and GRN Workflow

#### Business purpose

Record goods delivered by a supplier, evaluate their technical acceptability, generate a GRN, and post accepted quantity into inventory.

#### Responsible actors

1. Storekeeper or receiving operator creates the receipt.
2. Store Head reviews or advances receiving work where required.
3. TEC evaluates quality and acceptance.
4. Authorized Store Head/Administrator generates or posts the GRN according to the active route.
5. Storekeeper/authorized posting actor posts stock.
6. Security verifies eligible incoming goods at the gate.

#### Typical lifecycle

```text
Draft
  -> Submitted
  -> Pending Evaluation
  -> Under Evaluation
  -> Accepted / Partially Accepted / Rejected
  -> GRN Generated
  -> Posted
```

#### Database effects

Creating the receipt writes:

- `goods_receipts`;
- `goods_receipt_items`;
- audit activity;
- workflow notification when the appropriate submit action occurs.

Technical evaluation updates:

- receipt status;
- evaluation status/date;
- accepted and rejected quantities on receipt lines;
- evaluation notes/findings/condition/evidence;
- evaluator identity;
- audit log.

GRN generation writes:

- `grns`;
- `grn_items`;
- generated reference number;
- receipt status update;
- audit log.

Posting the GRN changes stock atomically:

- increments `items.qty_on_hand`;
- creates a `stock_lots` FIFO layer;
- creates a `stock_transactions` receipt row;
- updates or creates `bin_cards`;
- creates `bin_card_movements`;
- changes receipt status to `Posted`;
- writes audit data.

#### Important distinction

A receipt can exist without changing inventory. Stock should be checked after the final posting action, not after the first form submission.

### 6.2 Requisition Workflow

#### Business purpose

Allow a department to request stock from a store and route that request through departmental and property/store approval.

#### Responsible actors

1. Department Head or requester creates the requisition.
2. Department Head may approve requests from the department depending on the request and current scope.
3. PAO or Store Head may approve the requisition according to the configured workflow.
4. Storekeeper prepares the issue voucher after approval.
5. Store Head reviews/approves the issue voucher.
6. Storekeeper or authorized issuer posts the issue.
7. Security verifies the outgoing issue voucher if it is a campus movement.

#### Typical lifecycle

```text
Draft
  -> Submitted / Pending
  -> Approved / Partially Approved
  -> Ready for Issue
  -> Fulfilled / Partially Issued
```

Rejected and returned-for-correction paths may return the request to the requester.

#### Database effects

Creating a requisition writes:

- `requisitions`;
- `requisition_items`;
- audit log.

Approval writes:

- requisition status;
- approved quantity per line;
- `requisition_approvals`;
- audit log;
- notification to the next responsible actor where implemented.

No stock changes at creation or approval.

### 6.3 Issue Voucher / SIV / ISIV Workflow

#### Business purpose

Convert an approved requisition into a controlled issue document, approve it, post the material issue, and optionally clear it at the gate.

#### Responsible actors

1. Storekeeper creates a preliminary issue voucher.
2. Store Head approves the voucher.
3. Authorized Storekeeper, Store Head, or Administrator posts the voucher.
4. Security verifies the outgoing voucher at the gate.
5. The receiving department/user accepts the physical material outside the current gate verification action.

#### Typical lifecycle

```text
Preliminary
  -> Pending Approval
  -> Approved
  -> Posted / Issued
  -> Gate Cleared
```

#### Database effects of posting

Posting an issue voucher:

- locks the item row;
- checks available `qty_on_hand`;
- consumes FIFO lots oldest first;
- decreases `items.qty_on_hand`;
- writes an Issue row to `stock_transactions`;
- updates `bin_cards` and movement history;
- marks the voucher posted/issued;
- updates the requisition fulfillment state;
- writes audit information.

If available stock is insufficient, the transaction must fail and roll back.

### 6.4 Material Return / SRN Workflow

#### Business purpose

Return previously issued material to the store, evaluate its condition, and restore only eligible usable quantity to stock.

#### Responsible actors

1. Department Head/requester creates a return request.
2. Storekeeper receives and prepares the physical return.
3. Store Head or PAO reviews and approves/rejects it.
4. The stock service restores approved usable quantity.

#### Typical lifecycle

```text
Draft
  -> Submitted / Pending Review
  -> Approved / Rejected
  -> Returned to Stock
```

#### Database effects

The return document stores:

- return reference;
- department and requester;
- item and quantity;
- reason and condition;
- original issue reference;
- evaluation information;
- status.

An approved reusable return should:

- increase `items.qty_on_hand`;
- add a FIFO lot;
- write a Return stock transaction;
- update the bin card;
- record audit activity.

Damaged, lost, or otherwise non-reusable material should not be silently added back to usable stock.

### 6.5 Material Transfer Workflow

#### Business purpose

Move approved stock from one store to another while preserving both the outgoing and incoming stock effects.

#### Responsible actors

1. Storekeeper or Department Head creates a transfer request depending on the use case.
2. PAO, Store Head, or authorized approver reviews and approves it.
3. Source Storekeeper dispatches it.
4. Destination Storekeeper receives it.
5. The gate role may verify a movement only if a separate gate-document integration is implemented; Security does not manage the transfer itself in the current UI.

#### Typical lifecycle

```text
Draft
  -> Submitted / Pending Approval
  -> Approved
  -> Dispatched
  -> Received
  -> Completed
```

#### Database effects

Approval does not necessarily change stock.

Dispatch/receive execution should:

- deduct source-store quantity;
- consume FIFO stock at the source;
- create a Transfer-Out ledger row;
- update the source bin card;
- add destination quantity on receipt;
- create a Transfer-In ledger row;
- update the destination bin card;
- record dispatch/receipt actor and timestamps;
- finish the transfer status;
- write audit records.

### 6.6 Disposal Workflow

#### Business purpose

Flag unusable or obsolete stock and remove it through an authorized disposal process.

#### Responsible actors

1. Storekeeper or store operator identifies the material.
2. Store Head/PAO reviews the disposal request.
3. Authorized actor approves it.
4. Authorized execution actor performs the disposal.
5. Security may verify physical removal only through a supported gate-document flow.

#### Typical lifecycle

```text
Flagged / Requested
  -> Pending Review
  -> Approved / Rejected
  -> Executed
  -> Completed
```

#### Database effects of execution

An executed disposal should:

- consume stock through FIFO;
- decrease `items.qty_on_hand`;
- write a Disposal stock transaction;
- update bin cards;
- store the reason and responsible actor;
- record audit activity.

Disposal is not just deleting an item from the catalog. It is a controlled stock-out event.

### 6.7 Stock Taking and Reconciliation Workflow

#### Business purpose

Compare physical quantities with system quantities and apply controlled adjustments after review.

#### Responsible actors

1. Stock Clerk, Storekeeper, Store Head, or authorized counter creates a session.
2. Counter records physical quantities and variance reasons.
3. Authorized reviewer submits or approves the session.
4. PAO, Store Head, or Administrator posts approved adjustments.
5. Reconciliation displays resulting variances.

#### Typical lifecycle

```text
Draft
  -> Submitted
  -> Approved
  -> Posted
  -> Closed
```

#### Database effects

Creating a session writes:

- `stock_taking_sessions`;
- `stock_taking_items`;
- system quantity, physical quantity, variance, reason, counter.

Posting an approved session should:

- apply shortages by consuming FIFO where appropriate;
- apply surpluses by adding an adjustment lot where appropriate;
- update item balances;
- create Adjustment ledger rows;
- update bin cards;
- store adjustment references;
- audit the actor and result.

A variance without a reason should be rejected before posting.

### 6.8 Gate Pass Verification Workflow

#### Business purpose

Control whether an approved physical movement is allowed through the campus or organization gate.

#### Incoming path

1. Goods Receipt is evaluated and becomes `GRN Generated`.
2. Incoming document appears to Security as eligible.
3. Security verifies the reference, supplier, destination store, and status.
4. The backend sets `gate_verified`, `gate_verified_by`, and `gate_verified_at`.
5. An audit event records the verification.

#### Outgoing path

1. Issue voucher becomes `Approved` or `Posted`.
2. Voucher appears in the outgoing gate queue.
3. Security verifies the issue reference and recipient.
4. The backend sets gate verification fields.
5. An audit event records the clearance.

Gate verification does not alter stock. The issue posting or GRN posting already controls stock quantity.

---

## 7. Notification System

Notifications have two sources.

### 7.1 Persisted backend notifications

Critical workflow actions can call `notify()` inside a PostgreSQL transaction. This inserts rows into `notifications` for a specific user or every active user with a target role.

A persisted notification contains:

- title;
- message;
- type;
- route;
- entity type;
- entity ID;
- created timestamp;
- read timestamp.

The frontend loads these through `GET /api/notifications`.

When clicked, the frontend:

1. marks the notification read;
2. navigates to the stored route;
3. closes the notification menu.

Deep-link routes such as `/requisitions/:id` are supported by the requisition page so a notification can open the matching record.

### 7.2 Derived browser notifications

`buildNotifications.js` derives role-relevant alerts from currently loaded live data. Examples:

- Administrator/Store Head: low stock, pending receipts, pending requisitions;
- PAO: requisitions, transfers, disposals requiring action;
- Storekeeper: pending receipts, approved requisitions, returns;
- TEC: receipts under evaluation;
- Department Head: departmental approvals and approved requests;
- Accountant: reorder risk and FIFO report availability;
- Security: gate-eligible incoming and outgoing movements.

These derived alerts are useful for convenience, but they are not a replacement for transactional backend notifications. Backend notification delivery is the reliable source for workflow events.

### 7.3 Notification safety rules

A notification should:

- be sent only to the responsible next actor;
- use a route that exists;
- include the correct entity ID;
- be inserted in the same transaction as the business action when consistency matters;
- not expose records outside the recipient's permission scope.

---

## 8. Role-Specific Dashboard Quick Cards

Each role has its own dashboard renderer in `frontend/src/pages/dashboard/Dashboard.jsx`. The dashboard data sources are selected by role, so each role does not need to load every operational service.

### 8.1 Administrator dashboard

System Overview cards:

- Total Users;
- Active Users;
- Inactive Users;
- Total Roles;
- Total Departments;
- Total Stores;
- Total Items;
- Total Suppliers.

The overview values come from a server-side aggregate query. Total Roles currently means distinct role values present in the `users` table because there is no separate roles table.

Operational cards and panels:

- Total Inventory Value;
- Items at Reorder Level;
- Pending Goods Receipts;
- Pending Requisitions;
- Low-Stock Alerts;
- Recent Transactions;
- Inventory Value by Category;
- Recent Goods Receipts.

The System Overview cards link to the relevant master-data pages. Pending Goods Receipts and Pending Requisitions should link to their respective pages when they are displayed as quick cards.

### 8.2 PAO dashboard

Quick cards:

- Total Inventory Value;
- Pending Approvals;
- Pending GRNs;
- Stock Variances;
- Pending Requisitions;
- Pending Transfers;
- Disposal Requests;
- Asset Statistics.

Additional panels:

- approval queue;
- asset status breakdown;
- recent audit events;
- inventory value by category.

### 8.3 Store Head dashboard

Quick cards:

- Items at Reorder Level;
- Pending Goods Receipts;
- Approved Requisitions Awaiting Issue;
- Pending Requisitions.

Additional panels:

- low-stock alerts scoped to the linked store where possible;
- recent store transactions;
- recent goods receipts.

If the Store Head account has no store association, the dashboard shows a company-wide fallback and warns that the scope is not store-specific.

### 8.4 Storekeeper dashboard

Quick cards:

- Stock on Hand;
- Pending Receipts;
- Pending Issues;
- Pending Returns;
- Low Stock;
- Today's Transactions.

Additional panels:

- operational To Do list;
- recent stock movements.

### 8.5 Stock Clerk dashboard

Quick cards:

- Items at Reorder Level;
- Total Line Items in Catalog;
- Open Variances.

Additional panels:

- recent stock movements;
- low-stock awareness list.

### 8.6 TEC dashboard

Quick cards:

- Pending Evaluations;
- Under Review;
- Approved;
- Partially Accepted;
- Rejected;
- Evaluation History.

Additional panels:

- evaluation queue;
- completed evaluation history.

### 8.7 Department Head dashboard

Quick cards:

- My Pending Requisitions;
- Awaiting Your Approval;
- Approved Requisitions;
- Partially Fulfilled;
- Pending Returns;
- Department Stock.

Additional panels:

- requisitions awaiting approval;
- recent requests;
- return requests.

The data should be limited to the Department Head's department and requests created by that user.

### 8.8 Accountant dashboard

Quick cards:

- Inventory Value;
- Receipts Value;
- Issue Value;
- Return Value;
- Adjustments;
- Reconciliation Variances.

Additional panels:

- inventory value by category;
- FIFO Inventory Valuation shortcut;
- Financial Reports shortcuts.

### 8.9 Security Officer dashboard

Security is a gate-control dashboard, not a stock-management dashboard.

Quick cards:

- Gate Passes Today;
- Pending Verification;
- Approved Passes;
- Rejected Passes;
- Completed Exits;
- Completed Entries.

The cards should be interpreted as follows:

- Gate Passes Today: eligible incoming and outgoing gate documents dated today;
- Pending Verification: eligible documents not yet verified;
- Approved Passes: documents approved/generated and eligible for gate review;
- Rejected Passes: source documents explicitly rejected by their workflow;
- Completed Exits: outgoing issue vouchers cleared at the gate;
- Completed Entries: incoming generated GRNs verified at the gate.

Security dashboard queue entries must link to Gate Pass Verification. Security must not be given transfer-management cards merely because transfers may physically move between stores.

---

## 9. Audit Log Behavior

The Audit Log is a read-only operational record. Users do not create audit rows directly from the Audit page.

### 9.1 What is recorded

A rich audit entry can contain:

- timestamp;
- actor ID and actor name;
- actor role;
- action;
- module;
- entity type;
- entity ID/reference;
- description;
- outcome;
- before data;
- after data;
- field-level changes;
- metadata;
- IP address;
- user-agent/browser details.

Authentication audit records capture the client IP and browser user-agent in metadata. The API maps these fields to the detail view.

### 9.2 Actor-specific visibility

The backend restricts the audit feed for permitted non-Administrators by role-relevant actor/module scope. Administrator has broad system visibility. PAO, Accountant, and Security receive narrower audit views appropriate to their responsibilities.

The exact visibility policy should remain conservative. A role should not receive unrelated sensitive audit records simply because a module name happens to match a broad category.

### 9.3 Audit filters

The Audit Log supports:

- free-text search;
- sort by newest, oldest, user, action, module, or outcome;
- role filter;
- module filter;
- outcome filter;
- from-date filter;
- to-date filter.

Date filtering is calendar-aware. Selecting the current date as both the start and end date should include events from the beginning through the end of that day.

The summary cards must describe the currently filtered results, not the entire unfiltered dataset.

### 9.4 Audit detail card

A login event normally has:

- Actor;
- Role;
- Authentication module;
- Login action;
- SUCCESS or FAILED outcome;
- timestamp;
- IP address;
- browser user-agent.

Entity, reference, store, and department may be `System`/`N/A` for authentication because a login does not operate on inventory.

---

## 10. Reports Behavior

Reports are role-scoped. The report catalogue should show only reports that a role is permitted and expected to use.

### 10.1 Main report families

- current stock balance;
- stock card;
- bin card;
- low/reorder stock;
- stock movement;
- stock variance;
- expiring items;
- goods receipt status;
- GRN report;
- material evaluation;
- requisition status;
- SIV/ISIV status;
- department consumption;
- transfer report;
- material return/SRN report;
- fixed asset register;
- asset assignment;
- disposal report;
- supplier transactions;
- inventory valuation;
- stock movement value;
- FIFO inventory valuation for Accountant and permitted roles.

### 10.2 Report filtering

The Reports page supports:

- report type;
- store;
- category;
- status where applicable;
- text search;
- from date;
- to date.

For a single-day query:

```text
From date = 2026-08-28
To date   = 2026-08-28
```

The backend date query should include rows whose date is equal to that day. The frontend also applies the filters before displaying server-returned rows. Summary cards are recalculated from the same filtered rows as the table.

### 10.3 Report data integrity

Reports should be derived from operational truth:

- stock reports use item balances and/or stock transactions;
- FIFO reports use `stock_lots`;
- receipt reports use goods receipt and GRN tables;
- issue reports use issue vouchers;
- return reports use material returns;
- transfer reports use material transfers;
- reconciliation reports use stock-taking variances;
- audit reports use `audit_logs`.

A report showing zero after a clean reset is correct. It means no operational transaction has been created yet, not that the report feature is broken.

---

## 11. Business Rules

Business Rules are Administrator-only configuration values stored in `business_rules`.

Currently enforced rule:

- `SHELF_LIFE_WARNING_DAYS`: number of days before expiry when an item is highlighted by the Items page.

The Business Rules page supports typed values:

- integer;
- decimal;
- boolean;
- text;
- enum.

Values are validated against min/max and allowed enum values by the backend. The UI allows an Administrator to edit a value and save it immediately.

Do not add an editable rule merely because it sounds useful. A rule should be displayed only when the application has a corresponding runtime consumer. A setting called `REQUIRE_GATE_VERIFICATION`, for example, would be misleading unless the gate workflow actually checks it.

---

## 12. Master Data and Active Status

Reference data is shared through the CRUD framework.

The Active checkbox is used for:

- users;
- stores;
- categories;
- suppliers;
- departments;
- locations.

The correct behavior is:

1. create form starts Active by default;
2. user may uncheck Active;
3. frontend sends a real boolean;
4. backend persists the boolean on create/update;
5. list page shows Active/Inactive status;
6. inactive records are excluded from appropriate selectors or operational queries.

The shared CRUD checkbox must use `checked`, not only `value`, so edit forms accurately reflect the saved boolean state.

Items currently do not have the same complete active/deactivate model as the other reference data entities. Item stock availability is separate from item catalog activation and should be implemented deliberately rather than inferred from quantity.

---

## 13. Database Testing and Clean Test State

For manual end-to-end testing, start with:

- master data present;
- users present;
- all operational transactions absent;
- item balances equal to zero;
- audit logs empty if a completely new test run is required;
- notifications empty;
- reference counters reset.

The clean test process is:

1. log in as the responsible actor;
2. perform one workflow action;
3. observe the UI response and notification;
4. refresh the relevant page;
5. inspect the corresponding PostgreSQL rows;
6. continue as the next responsible actor;
7. verify both document state and stock truth after posting.

Suggested database checks:

```sql
SELECT * FROM goods_receipts ORDER BY id DESC;
SELECT * FROM goods_receipt_items ORDER BY id DESC;
SELECT * FROM grns ORDER BY id DESC;
SELECT * FROM items ORDER BY id;
SELECT * FROM stock_lots ORDER BY id DESC;
SELECT * FROM stock_transactions ORDER BY id DESC;
SELECT * FROM bin_cards ORDER BY id DESC;
SELECT * FROM requisitions ORDER BY id DESC;
SELECT * FROM issue_vouchers ORDER BY id DESC;
SELECT * FROM material_returns ORDER BY id DESC;
SELECT * FROM material_transfers ORDER BY id DESC;
SELECT * FROM audit_logs ORDER BY created_at DESC;
SELECT * FROM notifications ORDER BY created_at DESC;
```

For every stock-changing operation, compare:

```text
items.qty_on_hand
stock_lots.qty_remaining
stock_transactions balance and qty_in/qty_out
bin_cards.balance
business document status
created audit row
created notification row, when applicable
```

These values should agree. If one changes and the others do not, the operation is not transactionally complete.

---

## 14. What Is Already Strong

The current refactor provides several good foundations:

- backend authorization is independent of frontend visibility;
- stock mutations are centralized in `stockService.js`;
- PostgreSQL transactions and row locks protect multi-step stock changes;
- FIFO stock lots are maintained for posted receipts and stock-outs;
- stock ledger and bin-card updates are part of stock workflows;
- document references are generated through a shared reference generator;
- workflow transitions are centralized in `workflow.js`;
- audit records include rich before/after/change structures;
- notifications can be persisted in the same business transaction;
- dashboards are role-specific rather than one generic dashboard;
- Audit and Reports filters are date-aware;
- Security is separated from ordinary transfer management;
- active status is persisted by the shared master-data forms;
- environment examples are provided without committing real secrets.

---

## 15. Important Remaining Gaps and Risks

These items should be understood before treating the system as production-ready.

### 15.1 Permission matrix duplication

Frontend and backend permission matrices are separate files. A role can accidentally see a link that the backend rejects, or be denied in the frontend even though the backend permits it. These matrices should eventually be generated from a shared contract or validated automatically in CI.

### 15.2 Role storage is code-defined

There is no database `roles` table or permission administration UI. Roles are text values stored on users and recognized by code. The Administrator's Total Roles card therefore counts distinct roles in the users table, not a separately managed role catalogue.

### 15.3 Audit scope is module-based for some roles

Module-based role filters are useful but can be broader than entity-level authorization. A future implementation should support filtering by actor, entity type, entity ID, and department/store scope, not only module names.

### 15.4 Some notifications are derived in the browser

Browser-derived notifications depend on the data the current user can load. They can be stale, missing, or different between roles. Critical workflow notifications should be persisted by the backend.

### 15.5 Report coverage is not identical to the specification

Some report catalogue entries are computed locally, some are served by backend endpoints, and some planned reports may not have dedicated endpoints yet. A report should not be advertised as complete until its data source, filters, export, and permission behavior are all tested.

### 15.6 Validation needs continued strengthening

The database has useful checks, but all request handlers should validate:

- positive quantities;
- valid statuses;
- valid role values;
- valid dates;
- valid references;
- allowed transitions;
- duplicate or repeated operations.

### 15.7 Stock integrity must remain service-owned

No UI or controller should directly change `items.qty_on_hand` for a business transaction. Opening balances, receipts, returns, transfers, issues, disposals, and adjustments need a traceable ledger/lots/bin-card path.

### 15.8 Deactivation and deletion safeguards

The system should prevent:

- deleting the last Administrator;
- self-deactivation without a recovery path;
- deleting records already referenced by posted transactions;
- selecting inactive stores, suppliers, departments, or locations for new transactions.

### 15.9 Gate verification model is simplified

The current gate flow derives eligibility from generated GRNs and approved/posted issue vouchers. A fuller institutional model may require a dedicated `gate_passes` entity with explicit direction, rejection reason, security status, vehicle/person details, and verification history.

### 15.10 Audit event metadata completeness

Authentication now records IP and browser metadata. Other operations may still omit IP, browser, store, department, or entity context. Those fields should be populated consistently from the request and actor context.

### 15.11 Existing API and UI naming differences

The system uses names in many frontend request payloads and resolves them to database IDs in helpers. This is convenient but fragile if names are duplicated or renamed. Stable IDs should eventually become the primary client contract.

---

## 16. Recommended End-to-End Test Sequence

### A. Receiving

1. Log in as Storekeeper.
2. Create a receipt.
3. Confirm no stock increase.
4. Submit the receipt.
5. Log in as TEC.
6. Evaluate it.
7. Log in as Store Head or authorized actor.
8. Generate a GRN.
9. Log in as Storekeeper.
10. Post the GRN.
11. Verify item quantity, FIFO lot, ledger, and bin card.
12. Log in as Security.
13. Verify the incoming gate document if it is eligible.

### B. Requisition and Issue

1. Log in as Department Head.
2. Create and submit a requisition.
3. Verify no stock decrease.
4. Approve it as the responsible approver.
5. Log in as Storekeeper.
6. Create a preliminary issue voucher.
7. Log in as Store Head.
8. Approve the voucher.
9. Log in as authorized issuer.
10. Post the voucher.
11. Verify FIFO consumption and stock ledger changes.
12. Log in as Security.
13. Clear the outgoing voucher.

### C. Return

1. Log in as Department Head.
2. Create a material return.
3. Confirm no immediate stock increase.
4. Log in as Store Head or PAO.
5. Review condition and approve.
6. Verify only approved reusable quantity returns to stock.
7. Check FIFO, stock transaction, bin card, audit, and notification rows.

### D. Transfer

1. Create a transfer from the source store.
2. Approve it as PAO or Store Head.
3. Dispatch it as the source Storekeeper.
4. Receive it as the destination Storekeeper.
5. Compare source and destination balances, lots, ledgers, and bin cards.
6. Confirm Security does not have transfer-management controls.

### E. Stock Taking

1. Create a stock-taking session.
2. Record physical quantities.
3. Provide a reason for every non-zero variance.
4. Submit the session.
5. Approve it as an authorized reviewer.
6. Post it as an authorized posting actor.
7. Compare reconciliation, item balance, FIFO, stock ledger, bin card, and audit rows.

### F. Audit and Reports

1. Open Audit Log as each permitted role.
2. Confirm each role sees only appropriate audit information.
3. Select today's date as both date filters.
4. Confirm only today's records appear.
5. Open a login event and inspect IP/user-agent fields.
6. Open Reports.
7. Select a date range and confirm the table and summary cards agree.
8. Test store, category, status, search, print, and export behavior.

---

## 17. Developer Rules for Future Changes

When adding or modifying a workflow:

1. Define the responsible actor and next actor first.
2. Add or update backend permission rules.
3. Add the frontend route and role navigation only if appropriate.
4. Add controller validation.
5. Put all stock mutation in the stock service.
6. Use a database transaction for multi-table state changes.
7. Add audit information with actor and entity context.
8. Add a persisted notification for the next responsible actor.
9. Add or update the dashboard card/queue only for relevant roles.
10. Add report/filter support if the transaction should be reportable.
11. Test the UI and PostgreSQL state together.
12. Update this guide and the relevant workflow documentation.

The completion standard is not merely that a button appears. A workflow is complete only when this chain works:

```text
Actor
  -> permitted page
  -> permitted form/action
  -> API route
  -> authentication
  -> authorization
  -> validation
  -> business service
  -> PostgreSQL transaction
  -> document and stock state
  -> audit
  -> notification
  -> refreshed UI
  -> report visibility
```

---

## 18. Summary

The Stock Management System is a role-based inventory and transaction-control application. Its most important design principle is separation of duties:

- Storekeeper handles physical inventory operations;
- TEC evaluates technical acceptability;
- PAO and Store Head supervise and approve;
- Department Head requests and handles departmental responsibility;
- Accountant reviews financial information;
- Security verifies physical movement at the gate;
- Stock Clerk supports records and counting;
- Administrator manages the system and retains controlled override capability.

The database is the source of operational truth. The UI is a workflow surface over that truth. For every test, verify both:

- what the user sees;
- what PostgreSQL stores.

That comparison is the most reliable way to find incomplete workflows, incorrect permissions, misleading dashboard cards, broken notifications, or report/filter inconsistencies.
