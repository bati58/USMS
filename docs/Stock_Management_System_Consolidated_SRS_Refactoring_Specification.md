# Stock Management System — Consolidated SRS & Full-Stack Refactoring Specification

**Version:** 2.0 — Consolidated Implementation Baseline  
**Purpose:** Final business, workflow, role, frontend, backend, database and integration reference for refactoring the existing Stock Management System.

> **Important:** This document is a consolidated implementation baseline derived from the supplied SRS/gap analysis, the mentor's amended use cases, the Stock Management Manual, the Frontend SRS, Backend SRS, actor/permission guidance, and the existing end-to-end implementation guide. It is intended to guide an AI coding agent or full-stack development team while preserving the existing application and technology stack.

---

# 1. Executive Summary

The Stock Management System is a centralized web-based inventory and property management application for an institutional environment containing a main store and department/specialized stores.

The system must not be implemented as a collection of unrelated CRUD pages.

It must behave as a **connected transaction-processing system**:

```text
Master Data
    ↓
Receiving
    ↓
Inspection / Technical Evaluation
    ↓
Acceptance
    ↓
GRN / Model 19
    ↓
Stock Posting
    ↓
Stock Card + Bin Card
    ↓
Department Requisition
    ↓
Approval
    ↓
Preliminary SIV / ISIV
    ↓
SIV Approval / Amendment
    ↓
Final Issue
    ↓
Stock Reduction + FIFO
    ↓
Gate Verification where required
    ↓
Returns / Transfers / Stock Taking / Reconciliation / Disposal
    ↓
Audit + Notifications + Reports
```

Every important operation must be connected across:

```text
React Frontend
      ↓
REST API
      ↓
Express Backend
      ↓
Authentication
      ↓
Authorization
      ↓
Validation
      ↓
Controller
      ↓
Business Service
      ↓
PostgreSQL Transaction
      ↓
Stock Ledger / Bin Ledger / FIFO / Audit / Notification
      ↓
API Response
      ↓
Frontend Refresh
```

A page existing in the sidebar does **not** mean the feature is complete.

A feature is complete only when its page, CTA, permission, API, backend business rule, database persistence, stock effect, audit, notification, error handling and reporting are connected.

---

# 2. Source and Requirement Hierarchy

Use the supplied sources in this order when resolving conflicts:

1. Explicitly validated institutional/business requirements.
2. Mentor's amended operational use cases.
3. Stock Management Manual business procedures.
4. Original SRS functional/non-functional requirements.
5. Frontend/Backend SRS implementation contracts.
6. Existing implementation details only where they do not conflict with the above.

Do **not** invent institutional policy.

Where documentation is insufficient to determine:

- approval limits;
- exact approval hierarchy;
- partial acceptance rules;
- partial issue rules;
- exact transfer stock timing;
- exact gate-pass scenarios;
- disposal authority;
- adjustment authority;
- shelf-life thresholds;
- stock-taking frequency;

mark the item:

**BUSINESS DECISION REQUIRED**

and make the implementation configurable rather than hard-coding an unsupported policy.

---

# 3. Technology Baseline

The existing stack must be preserved.

## Frontend

- React
- React Router
- Existing styling/design system
- Existing shared components
- Existing authentication state
- Existing API client/service pattern

## Backend

- Node.js
- Express.js
- REST API
- JWT authentication
- bcrypt password hashing
- Existing validation approach, including Zod where already used
- Transaction-oriented business services

## Database

- PostgreSQL
- Relational integrity
- Foreign keys
- Unique constraints
- CHECK constraints
- Database transactions
- Indexing for operational queries

Do not migrate the application to another framework simply to solve a feature gap.

Do not create a second frontend design system.

Reuse existing components wherever practical.

---

# 4. Core Actors

The primary operational roles are:

1. **Administrator**
2. **Property Administration Officer (PAO)**
3. **Store Head**
4. **Storekeeper**
5. **Stock Clerk**
6. **Technical Evaluation Committee (TEC)**
7. **Department Head**
8. **Accountant**
9. **Security Officer**

Supplier is primarily an external party/master-data entity unless a separate supplier portal is explicitly approved.

---

# 5. Actor Responsibility Model

## 5.1 Administrator

### Purpose

Technical/system administration and overall system authority.

### Main responsibilities

- Manage users.
- Manage roles.
- Manage permissions.
- Activate/deactivate accounts.
- Configure system rules.
- Manage master data.
- View system-wide operational information.
- View audit logs.
- Monitor system health.
- Perform emergency operational overrides when justified.

### Administrator should normally NOT perform

- routine receiving;
- independent TEC evaluation;
- ordinary stock issue;
- ordinary physical stock counting;
- gate verification;
- routine disposal execution;
- replacing the responsible operational actor.

### Override rule

Administrator may have `SUPER_ADMIN` capability, but override must not silently bypass workflow.

Every override records:

```text
administrator
action
reason
timestamp
original status
resulting status
source document
override = true
```

---

# 6.2 Property Administration Officer (PAO)

PAO is the major property/inventory supervisory role.

### Responsibilities

- Overall stock-management oversight.
- Monitor stores.
- Review receiving and GRNs.
- Approve workflows assigned by policy.
- Supervise requisitions.
- Review transfers.
- Review returns.
- Monitor stock-taking and reconciliation.
- Manage/monitor fixed assets.
- Monitor disposal.
- Review inventory valuation.
- Generate operational/property reports.
- Review audit activity.

### PAO should NOT normally

- perform TEC technical evaluation;
- perform security gate verification;
- act as the routine physical storekeeper;
- directly edit generated stock balances.

PAO should have broad visibility and broad supervisory permissions, but operational actions must remain traceable to the actual performer.

---

# 6.3 Store Head

### Purpose

Supervises a store and its operational workflows.

### Responsibilities

- Review receiving records.
- Coordinate technical evaluation.
- Supervise storekeepers.
- Review stock.
- Review requisitions.
- Approve workflows assigned to Store Head.
- Review/approve SIV/ISIV where authorized.
- Review returns.
- Review transfers.
- Supervise stock taking.
- Review reconciliation.
- Monitor damaged/obsolete stock.
- Review disposal workflow.
- Generate store reports.

### Must not normally

- manage system users/roles;
- perform independent TEC evaluation;
- perform gate verification;
- perform accounting approval.

---

# 6.4 Storekeeper

The Storekeeper is the primary **physical stock custodian/operator**.

### Responsibilities

#### Receiving

- Receive goods.
- Check delivery.
- Check quantity.
- Check visible condition.
- Check against supporting documents.
- Record receipt.
- Submit receipt.
- Coordinate technical inspection.

#### Storage

- Assign storage location.
- Assign bin.
- Maintain physical custody.

#### Issuing

- View approved requisitions.
- Prepare SIV/ISIV.
- Select source stock/bin.
- Issue approved quantities.
- Perform final posting where authorized.

#### Returns

- Receive returned materials.
- Verify physical quantity.
- Record condition.
- Send return for inspection/evaluation.
- Return approved reusable material to stock.

#### Transfers

- Prepare/dispatch approved transfers.
- Select source bins.
- Confirm dispatch quantities.

#### Stock taking

- Participate in physical counts.
- Enter count information where authorized.
- Report discrepancies.

### Must not

- approve their own transaction where separation is required;
- directly edit posted balances;
- manually alter system-generated bin-card balances;
- delete historical transactions.

---

# 6.5 Stock Clerk

The Stock Clerk is primarily a **record-keeping and stock-documentation actor**.

### Responsibilities

- Maintain permitted stock records.
- Search inventory.
- View Stock Cards.
- View Bin Cards.
- Support receiving documentation.
- Post/maintain records from approved source documents where authorized.
- Assist stock taking.
- Prepare reports.
- Maintain clerical records.

### Critical rule

The Stock Clerk must never manually change:

```text
qtyOnHand
bin balance
FIFO layers
posted stock transactions
```

Instead:

```text
Approved business transaction
        ↓
Stock Service
        ↓
Inventory balance
        ↓
Stock transaction
        ↓
Bin transaction
```

---

# 6.6 Technical Evaluation Committee (TEC)

TEC performs technical inspection/evaluation.

### Responsibilities

- View pending evaluations.
- Inspect received materials.
- Review specifications.
- Record findings.
- Record condition.
- Record accepted quantity.
- Record rejected quantity.
- Partially approve where policy permits.
- Reject where justified.
- Place on hold where supported.
- Attach evidence.
- Submit evaluation.

### Must not

- directly change inventory balances;
- issue stock;
- perform arbitrary adjustments;
- approve their own unrelated administrative/financial actions.

---

# 6.7 Department Head

### Responsibilities

- Manage requests for their department.
- Create requisitions.
- Edit draft requisitions.
- Submit requisitions.
- Approve departmental requests where authorized by policy.
- Track request fulfillment.
- Confirm receipt where applicable.
- Initiate material returns.
- View department assets.

### Security requirement

Backend must enforce department scope.

A Department Head belonging to Department A must never access Department B's records by changing an ID in the URL.

---

# 6.8 Accountant

### Purpose

Financial and valuation oversight.

### Responsibilities

- View inventory valuation.
- Review FIFO valuation.
- Review received stock value.
- Review issued stock value.
- Review return values.
- Review asset values.
- Review disposal values.
- Review stock adjustments.
- Generate/export financial reports.
- Review audit/financial history.

### Normally read-only for stock operations

Accountant should not normally:

- receive goods;
- issue goods;
- modify stock;
- approve TEC evaluations;
- perform gate verification.

---

# 6.9 Security Officer

Security is a **physical movement control point**, not an inventory-management role.

### Security becomes operational when material physically leaves/enters through a controlled gate.

Typical example:

```text
Approved SIV
    ↓
Issue Posted
    ↓
Material prepared for exit
    ↓
Security checks document
    ↓
Security verifies:
    - document number
    - approval
    - item
    - quantity
    - recipient
    - authorization
    ↓
Gate cleared
```

### Responsibilities

- Open/scan movement document.
- Verify document reference.
- Verify approval status.
- Verify item and quantity.
- Verify responsible recipient.
- Confirm outgoing movement.
- Reject invalid movement.
- Record gate verification.
- View verification history.

### Must not

- approve requisitions;
- create arbitrary issues;
- modify inventory;
- modify stock balances;
- approve their own gate verification.

---

# 7. Permission Model

Permissions must be action-based rather than simply page-based.

Recommended permission vocabulary:

```text
VIEW
CREATE
EDIT
SUBMIT
REVIEW
APPROVE
REJECT
POST
EXECUTE
VERIFY
EXPORT
CONFIGURE
ADMIN
```

The authorization decision must evaluate:

```text
Authenticated User
      +
Role
      +
Permission
      +
Resource Ownership
      +
Store/Department Scope
      +
Current Workflow Status
      +
Business Rules
      ↓
Allowed / Forbidden
```

Frontend permission checks are only UX controls.

Backend authorization is mandatory.

---

# 8. General CRUD Rules

## Create

Create should normally create a **draft or pending business document**, not immediately alter stock.

Examples:

- Receipt creation → no stock increase.
- Requisition creation → no stock decrease.
- Transfer creation → no stock change.
- Return request → no stock increase.
- Disposal request → no stock decrease.

## Edit

Editable only while the record is in an editable state.

Typical editable states:

```text
Draft
Returned for Correction
Pending Amendment
```

Do not allow silent editing of approved/posted historical transactions.

## Delete

Do not allow ordinary deletion of posted operational history.

Use:

```text
Cancel
Reject
Deactivate
Void
Reverse
Correct through controlled workflow
```

rather than destructive deletion.

## Approve

Approval changes authorization/workflow state.

Approval itself must only change stock if the documented workflow explicitly says approval is the posting point.

## Post

Posting is the action that creates the actual stock/accounting effect.

## Execute

Execution performs an approved physical/business action such as disposal.

## Verify

Verification confirms a control point, such as gate movement.

---

# 9. Mentor Use Cases

The system must cover all 26 mentor-defined use cases.

## UC-01 Manage Store Information

Manage:

- Main Store
- Department Stores
- Other authorized stores

Store information:

- code;
- name;
- type;
- department/organizational unit;
- location;
- store head;
- contact;
- status;
- description.

Actions:

```text
View
Create
Edit
Activate
Deactivate
Search
Filter
Details
```

---

## UC-02 Maintain Item Category

Category fields:

- code;
- name;
- description;
- applicable store;
- active/inactive.

Example categories:

- Office Supplies
- Laboratory Equipment
- Electrical Components
- Mechanical Tools
- Chemical Materials
- Civil Engineering Materials
- Computer Equipment
- Safety Equipment
- Spare Parts
- Furniture
- Consumables
- Fixed Assets

---

## UC-03 Maintain Item Location

Location hierarchy:

```text
Store
 ↓
Section
 ↓
Rack
 ↓
Shelf
 ↓
Bin
```

Example:

```text
Main Store
 → Electrical Section
 → Rack E-03
 → Shelf 02
 → Bin E03-02-04
```

Actions:

- create;
- edit;
- assign;
- move;
- search;
- view occupied;
- view available.

---

# 10. UC-04 Goods Receipt

Receiving must support:

- purchase;
- donation;
- other approved sources.

Receipt fields:

- receipt reference;
- supplier/source;
- purchase/order reference;
- delivery date;
- store;
- received by;
- items;
- quantity;
- unit;
- condition;
- supporting documents;
- fixed/non-fixed classification;
- notes;
- status.

Recommended lifecycle:

```text
Draft
 ↓
Submitted
 ↓
Pending Evaluation
 ↓
Under Evaluation
 ↓
Accepted / Partially Accepted / Rejected / On Hold
 ↓
GRN Generated
 ↓
Stock Posted
```

Creating a receipt must **never increase available stock**.

---

# 11. Goods Receipt — Complete Example

Example:

```text
Supplier: ABC Office Supplies
Item: A4 Paper
Received: 500 boxes
Unit cost: ETB 450
Store: Main Store
```

### Step 1 — Storekeeper

Creates receipt.

```text
Draft
```

### Step 2 — Storekeeper

Checks delivery and submits.

```text
Submitted
```

### Step 3 — Store Head

Reviews documents and initiates/requests technical evaluation when required.

```text
Pending Evaluation
```

### Step 4 — TEC

Inspects.

Result:

```text
Accepted = 480
Rejected = 20
```

### Step 5 — Authorized approval/GRN stage

Only accepted quantity becomes eligible for GRN.

### Step 6 — GRN

Generate:

```text
GRN-2026-0001
Quantity = 480
```

### Step 7 — Stock posting

Atomically:

```text
Inventory +480
FIFO lot +480
Stock Card +480
Bin Card +480
Audit record
Notification
```

The rejected 20 do not become available stock.

---

# 12. UC-05 Technical Evaluation

Evaluation fields:

- receipt reference;
- evaluator;
- evaluation date;
- findings;
- condition;
- accepted quantity;
- rejected quantity;
- recommendation;
- evidence;
- remarks;
- status.

Possible states:

```text
Pending
Under Review
Approved
Rejected
Partially Approved
On Hold
```

Evaluation must be persisted separately from a generic receipt status when the data model requires evaluation history.

---

# 13. UC-06 GRN / Model 19

GRN must represent an accepted receiving transaction.

Fields:

- GRN number;
- date;
- store;
- supplier;
- source document;
- receipt reference;
- items;
- quantity;
- unit;
- unit price;
- total;
- acceptance status;
- Store Head;
- TEC result;
- authorized personnel.

Actions:

```text
Generate
View
Print
Export
Open Receipt
Open Evaluation
Open Stock Card
Open Bin Card
```

GRN cannot be generated for rejected/unaccepted material.

---

# 14. UC-07 / UC-08 Stock Cards

Stock Card is the authoritative quantity/value movement record.

It must show:

- item;
- item code;
- store;
- date;
- transaction reference;
- transaction type;
- quantity in;
- quantity out;
- balance;
- unit cost;
- supporting document.

Transaction types may include:

```text
Opening Balance
Receipt
Issue
Return
Transfer In
Transfer Out
Adjustment
Disposal
```

Stock Card must be automatically updated from approved/posting transactions.

It must not be a manually editable spreadsheet-like page.

---

# 15. UC-09 Bin Cards

Bin Card is the physical-location quantity record.

Fields:

- bin;
- store;
- section;
- rack;
- shelf;
- item;
- item code;
- transaction date;
- transaction reference;
- in;
- out;
- balance;
- location;
- supporting document.

If an item enters an unused bin:

```text
Create Bin Card
```

If it moves:

```text
Source Bin Card
    ↓
Transfer Out
    ↓
Destination Bin Card
    ↓
Transfer In
```

Bin balance is system-generated.

---

# 16. UC-10 Bin-to-Bin Transfer

Example:

```text
Bin A-01
A4 Paper = 100

Move 30

Bin A-02
```

After transaction:

```text
A-01 = 70
A-02 = 30
```

Total item quantity remains:

```text
100
```

The system must:

- validate source balance;
- prevent same source/destination;
- update both bin histories;
- preserve transfer reference;
- create audit record;
- keep total store stock unchanged.

---

# 17. UC-11 / UC-12 Store Requisition

A requisition represents a department request.

Fields:

- requisition number;
- department;
- requester;
- store;
- date;
- required date;
- priority;
- purpose;
- items;
- requested quantity;
- remarks;
- status.

Recommended lifecycle:

```text
Draft
 ↓
Submitted
 ↓
Pending Approval
 ↓
Approved / Partially Approved / Rejected
 ↓
Ready for Issue
 ↓
Partially Issued
 ↓
Fulfilled
```

Creation and approval do not reduce stock.

---

# 18. Requisition Example

Department requests:

```text
A4 Paper = 100 boxes
```

Department Head:

```text
Create
 ↓
Edit if necessary
 ↓
Submit
```

Authorized approver:

```text
Review
 ↓
Approve
```

Storekeeper receives notification:

```text
SR-2026-0040 is ready for issue
```

Only then can the issue workflow begin.

Rejected or pending requisitions cannot produce a valid final issue.

---

# 19. UC-13 / UC-14 / UC-15 SIV / ISIV

## Preliminary voucher

Created from an approved requisition.

Shows:

- SIV/ISIV number;
- requisition;
- store;
- department;
- items;
- requested quantity;
- approved quantity;
- issue quantity;
- status.

Lifecycle:

```text
Preliminary
 ↓
Pending Approval
 ↓
Amendment Required (if necessary)
 ↓
Approved
 ↓
Ready for Issue
 ↓
Posted / Issued
```

## Amendment

Authorized approver can:

- amend eligible quantities;
- remove/add eligible lines;
- return for correction;
- approve;
- reject.

Never silently overwrite previous approved versions.

Maintain amendment history.

## Final voucher

Generate final Model 22 representation after authorization.

Actions:

```text
View
Print
Export
Post Issue
```

---

# 20. Final Issue Posting

Final issue posting is the actual stock movement.

Example:

```text
Available A4 Paper = 480
Issue = 100
Remaining = 380
```

Posting must atomically:

1. lock relevant inventory;
2. validate approved requisition;
3. validate authorized SIV;
4. validate quantity;
5. validate available stock;
6. consume FIFO lots;
7. reduce inventory;
8. write stock transaction;
9. update bin card;
10. update requisition fulfillment;
11. mark SIV issued;
12. write audit;
13. create required notification.

If any step fails, the transaction rolls back.

---

# 21. FIFO Valuation

FIFO is a business requirement where retained by the specification.

Example:

```text
Lot 1: 100 units @ ETB 400
Lot 2: 200 units @ ETB 450
```

Issue:

```text
150 units
```

FIFO consumes:

```text
100 @ 400
50 @ 450
```

Issue value:

```text
100 × 400 + 50 × 450
= ETB 62,500
```

Do not calculate issue cost simply from the latest item unit price.

Maintain distinct receipt lots or equivalent replayable FIFO information.

The displayed item `unitPrice` may represent the latest receipt price, but transaction-level valuation must remain FIFO-correct.

---

# 22. Gate Verification

Gate verification occurs at the physical exit control point.

Typical sequence:

```text
Approved SIV
 ↓
Final issue
 ↓
Material prepared
 ↓
Gate
 ↓
Security opens SIV
 ↓
Checks authorization
 ↓
Checks item
 ↓
Checks quantity
 ↓
Checks recipient
 ↓
Checks document validity
 ↓
Gate Cleared / Rejected
```

Security must not create or post the stock issue.

Gate verification should preserve:

- document reference;
- verifier;
- date/time;
- item/quantity verified;
- recipient;
- result;
- rejection reason where applicable.

Gate pass requirements remain configurable if institutional policy is not fully specified.

---

# 23. UC-16 Fixed Assets

Fixed assets originate from accepted fixed-asset receipts.

Fields:

- asset tag;
- name;
- category;
- serial number;
- acquisition date;
- acquisition value;
- source;
- store;
- department;
- assigned person;
- location;
- condition;
- status.

Possible states:

```text
Registered
In Store
Assigned
In Use
Under Maintenance
Lost
Damaged
Disposed
```

An asset should be traceable:

```text
Receipt
 ↓
GRN
 ↓
Asset Registration
 ↓
Assignment
 ↓
Movement
 ↓
Maintenance
 ↓
Disposal
```

Disposal must not delete the historical asset.

---

# 24. UC-17 User Material Card

A user/material card tracks custody of materials/assets assigned to a person.

Fields:

- user;
- department;
- position;
- item;
- asset tag/item code;
- quantity;
- issue date;
- return date;
- condition;
- status;
- supporting voucher.

Actions:

```text
Assign
Issue
Return
View History
Print
```

Editing a user card must not substitute for the actual SIV/SRN transaction.

The card is a custody record linked to the real transaction.

---

# 25. UC-18 / UC-19 / UC-20 Material Return / SRN

Return starts from previously issued material.

Example:

```text
Original SIV:
A4 Paper = 100
```

Department returns:

```text
20
```

System validates:

```text
20 <= previously issued quantity
```

Storekeeper receives the physical return.

TEC or authorized evaluator determines:

```text
15 reusable
5 damaged
```

Only approved reusable quantity enters usable stock.

Lifecycle:

```text
Draft
 ↓
Submitted
 ↓
Pending Review
 ↓
Evaluation
 ↓
Approved / Rejected
 ↓
Returned to Stock
```

Approved reusable return:

```text
Inventory +15
FIFO return lot +15
Stock Card +15
Bin Card +15
Audit
Notification
```

Damaged material enters damaged/quarantine/disposal handling instead.

---

# 26. UC-21 / UC-22 Material Transfer

Example:

```text
Main Store
    ↓
Electrical Engineering Store
```

Request:

```text
100 A4 Paper
```

Lifecycle:

```text
Draft
 ↓
Submitted
 ↓
Pending Approval
 ↓
Approved
 ↓
Dispatch
 ↓
Security Verification where required
 ↓
Destination Receipt
 ↓
Completed
```

A pending transfer must not silently reduce stock.

The exact point at which source stock is reduced and destination stock increased must follow the approved institutional policy.

If policy requires dispatch-based posting:

```text
Dispatch → source decreases
Destination receipt → destination increases
```

If policy requires atomic transfer posting:

```text
Completion → source decreases + destination increases
```

This is a configurable/business-decision area if not explicitly established.

One transfer reference must connect both stores.

---

# 27. UC-23 Shelf-Life and Stock Monitoring

Applicable items should support:

- batch/lot;
- expiry date;
- condition;
- days remaining;
- shelf-life status.

Statuses:

```text
Normal
Expiring Soon
Expired
Damaged
Obsolete
Quarantine
```

Examples:

```text
5 items expiring within configured threshold
3 expired materials
2 damaged materials
```

Monitoring should also detect:

- low stock;
- slow-moving stock;
- dormant stock;
- overstock;
- damaged stock;
- obsolete stock.

Thresholds must be configurable if institutional policy is not fixed.

---

# 28. UC-24 / UC-25 / UC-26 Disposal

Disposal must be a controlled workflow.

Example:

```text
5 damaged laboratory items
```

Lifecycle:

```text
Flagged
 ↓
Disposal Requested
 ↓
Under Review
 ↓
Approved
 ↓
Execution
 ↓
Inventory Removed
 ↓
Completed
```

### Critical rule

**Approval must not automatically mean physical disposal.**

The system must separate:

```text
Approval
```

from:

```text
Execution
```

Execution creates the actual inventory transaction.

After execution:

```text
Inventory decreases
Stock Card records disposal
Bin Card records disposal
Audit record created
Notification generated
Disposal history retained
```

Never delete the disposal history.

---

# 29. Stock Taking

Stock taking is a physical verification process.

Example:

System:

```text
A4 Paper = 380
```

Physical count:

```text
374
```

Variance:

```text
-6
```

Correct workflow:

```text
Stock-Taking Session
 ↓
Physical Count
 ↓
System vs Physical Comparison
 ↓
Variance
 ↓
Investigation
 ↓
Reason
 ↓
Approval
 ↓
Adjustment Transaction
 ↓
New Balance
 ↓
Session Closure
```

Never simply edit:

```text
380 → 374
```

The adjustment must be traceable.

Closed sessions cannot be silently modified.

---

# 30. Reconciliation

Reconciliation connects:

- system balance;
- physical count;
- source documents;
- transaction history;
- variance;
- investigation;
- approval;
- adjustment.

Possible statuses:

```text
Open
Under Investigation
Awaiting Approval
Adjusted
Resolved
Closed
```

Every adjustment must create:

- adjustment transaction;
- audit;
- reason;
- approver;
- reference.

---

# 31. Notifications

Notifications should be workflow-driven, preferably persisted in PostgreSQL.

Examples:

| Event | Recipient |
|---|---|
| Receipt submitted | Store Head / next receiving actor |
| Receipt awaiting evaluation | TEC |
| Evaluation completed | PAO / Store Head / property actor |
| GRN generated | Relevant store/property actor |
| Requisition submitted | Approver |
| Requisition approved | Storekeeper |
| SIV ready for approval | Store Head / authorized approver |
| SIV approved | Storekeeper |
| Transfer approved | Source/destination store actors |
| Transfer dispatched | Destination actor / Security where applicable |
| Return submitted | Store Head / evaluator |
| Disposal approved | Disposal executor |
| Stock-taking variance | Store Head / approver |
| Low stock | Store/stock responsible actor |
| Expiry warning | Store Head / Storekeeper / PAO |
| Gate verification required | Security |
| Gate verification failed | Relevant supervisor |

Every notification should link to the exact source record.

Example:

```text
"SR-2026-0040 is approved and ready for issue"
        ↓
Open requisition/SIV detail
```

---

# 32. Audit Trail

Every state-changing operation must be auditable.

Minimum audit data:

```text
timestamp
user
role
module
action
reference
previous status
new status
outcome
reason where required
```

For sensitive changes also capture:

```text
entity
entity ID
before state
after state
IP/device metadata where supported
override flag
override reason
```

Audit records are system-generated.

Ordinary users must not directly edit audit rows.

---

# 33. Reports

Reports must be based on authoritative backend/database data.

Required report families:

- Inventory Summary
- Current Stock Balance
- Stock Movement
- Stock Card
- Bin Card
- Goods Receipt
- GRN
- Requisition
- SIV / ISIV
- Material Return / SRN
- Store Transfer
- Bin Transfer
- Stock Taking
- Reconciliation
- Fixed Asset Register
- User Material Card
- Disposal
- Low Stock
- Expiry/Shelf Life
- FIFO Valuation
- Transaction History
- Audit

Filters should include where applicable:

- item;
- store;
- department;
- category;
- status;
- date range;
- reference;
- supplier.

Support:

```text
Search
Filter
Pagination
Print
CSV Export
```

A report must never display a successful result that contradicts PostgreSQL.

---

# 34. Role-Specific Dashboards

Every dashboard must answer:

1. What requires my attention?
2. What can I do?
3. What is waiting for my approval?
4. What happened recently?
5. What exceptions exist?
6. What stock information matters to my role?

General structure:

```text
KPI Cards
+
Pending Queues
+
Alerts
+
Recent Activities
+
Quick Actions
+
Relevant Reports/Charts
```

## Administrator dashboard

- Active users;
- inactive users;
- roles;
- permissions;
- system health;
- database status;
- failed logins;
- audit activity;
- workflow exceptions;
- configuration status;
- system-wide operational summary.

## PAO dashboard

- total inventory value;
- total stock;
- stores;
- pending receipts;
- pending evaluations;
- pending GRNs;
- pending requisitions;
- pending SIV approvals;
- pending returns;
- pending transfers;
- stock-taking sessions;
- reconciliation variances;
- assets awaiting registration;
- assets awaiting assignment;
- disposal requests;
- damaged/obsolete stock;
- low-stock alerts;
- expiry alerts;
- audit alerts.

## Store Head dashboard

- store stock;
- today's/period receipts;
- pending receiving reviews;
- evaluations;
- pending requisitions;
- SIV approvals;
- returns;
- transfers;
- stock-taking;
- reconciliation;
- low stock;
- expiry;
- disposal;
- recent activities.

## Storekeeper dashboard

- today's receipts;
- pending receiving tasks;
- available stock;
- low stock;
- approved requisitions ready for issue;
- pending SIV tasks;
- returns;
- transfers awaiting dispatch;
- bins requiring attention.

## Stock Clerk dashboard

- stock balances;
- stock movements;
- receiving records;
- issue records;
- bin balances;
- stock-taking tasks;
- clerical work queue;
- operational reports.

## TEC dashboard

- pending evaluations;
- under-review materials;
- accepted quantity;
- rejected quantity;
- partial evaluations;
- findings;
- evaluation history.

## Department Head dashboard

- draft requisitions;
- submitted requisitions;
- pending approvals;
- approved requests;
- partially fulfilled requests;
- fulfilled requests;
- rejected requests;
- returns;
- department assets.

## Accountant dashboard

- inventory value;
- FIFO valuation;
- received value;
- issued value;
- return value;
- asset value;
- disposal value;
- adjustment value;
- valuation trends.

## Security dashboard

- pending gate verifications;
- approved outgoing issues;
- transfer dispatches;
- asset movements;
- invalid/suspicious documents;
- verification history.

---

# 35. Sidebar Design

Every sidebar item must open its own corresponding page.

Never allow:

```text
Stock Reconciliation
    ↓
Dashboard
```

It must open:

```text
/reconciliation
```

Every sidebar module must have:

- correct route;
- correct page;
- correct role authorization;
- correct API;
- correct loading state;
- correct empty state;
- correct error state;
- correct CTAs;
- correct CRUD/action permissions.

Recommended modules:

```text
Dashboard

Inventory Setup
  Stores
  Departments
  Categories
  Items
  Locations
  Suppliers

Stock Receiving
  Goods Receipts
  Technical Evaluations
  GRN Documents

Stock Records
  Stock Cards
  Bin Cards
  Bin Transfers
  Inventory Monitoring

Requisitions & Issues
  Store Requisitions
  SIV / ISIV
  Issue History

Returns & Transfers
  Material Returns / SRN
  Material Transfers
  Transfer Approvals

Stock Controls
  Stock Taking
  Reconciliation

Assets & Disposal
  Fixed Assets
  User Material Cards
  Disposal Management

Security
  Gate Verification
  Verification History

Reports

Notifications

Administration
  Users
  Roles
  Permissions
  Business Rules
  Audit Log
  System Settings
```

Only expose modules appropriate to each actor.

---

# 36. Page Completion Standard

Every page must have:

```text
Page
+
Correct actor
+
Correct route
+
Correct sidebar placement
+
Correct API
+
Correct permission
+
Correct data scope
+
Correct table/list
+
Correct detail view
+
Correct create CTA where permitted
+
Correct edit CTA where permitted
+
Correct workflow CTA
+
Correct validation
+
Loading state
+
Empty state
+
Error state
+
Success feedback
+
Database persistence
+
Audit
+
Notification where applicable
+
Refresh/re-fetch
```

---

# 37. CTA Rules

Every button must perform the action it advertises.

Examples:

```text
+ New Receipt
    ↓
Open receipt creation form
```

```text
View
    ↓
Open exact record detail
```

```text
Approve
    ↓
POST /api/.../:id/approve
```

```text
Reject
    ↓
POST /api/.../:id/reject
```

```text
Evaluate
    ↓
Open evaluation workflow
```

```text
Generate GRN
    ↓
Generate GRN from accepted receipt
```

```text
Post Issue
    ↓
POST /api/.../:id/post
```

```text
Execute Disposal
    ↓
POST /api/.../:id/execute
```

```text
Verify Gate
    ↓
POST /api/.../:id/verify
```

No decorative CTA is acceptable.

---

# 38. Frontend ↔ Backend ↔ Database Contract

The frontend must never simulate important stock effects locally.

Correct:

```text
User clicks Approve
      ↓
React calls API
      ↓
Express authenticates
      ↓
Express authorizes
      ↓
Validation
      ↓
Business service
      ↓
PostgreSQL transaction
      ↓
Audit/notification
      ↓
Response
      ↓
React refreshes
```

Incorrect:

```text
User clicks Approve
      ↓
React changes status in local state
      ↓
Toast "Success"
```

A success toast with no database change is a broken feature.

---

# 39. REST API Requirements

Standard resources should follow a consistent REST pattern:

```http
GET    /api/{resource}
GET    /api/{resource}/:id
POST   /api/{resource}
PUT    /api/{resource}/:id
DELETE /api/{resource}/:id
```

Workflow-specific endpoints should use explicit actions:

```http
POST /api/goods-receipts/:id/evaluate
POST /api/goods-receipts/:id/generate-grn
POST /api/goods-receipts/:id/post

POST /api/requisitions/:id/approve
POST /api/requisitions/:id/reject

POST /api/issue-vouchers/:id/approve
POST /api/issue-vouchers/:id/reject
POST /api/issue-vouchers/:id/post

POST /api/material-returns/:id/evaluate
POST /api/material-returns/:id/approve
POST /api/material-returns/:id/reject

POST /api/material-transfers/:id/approve
POST /api/material-transfers/:id/dispatch
POST /api/material-transfers/:id/receive
POST /api/material-transfers/:id/complete

POST /api/disposals/:id/approve
POST /api/disposals/:id/execute

POST /api/gate-pass/:id/verify

POST /api/stock-taking/:id/approve
POST /api/stock-taking/:id/adjust
POST /api/stock-taking/:id/close
```

Exact endpoint names should match the existing project's established conventions.

---

# 40. API Error Contract

Use consistent errors:

```json
{
  "message": "Human-readable error"
}
```

Recommended HTTP codes:

```text
400 Validation/business rule error
401 Unauthenticated
403 Unauthorized
404 Not found
409 Conflict
500 Unexpected server error
```

Examples:

```text
Cannot issue more than available stock.
Receipt has not completed technical evaluation.
This requisition does not belong to your department.
Transfer source has insufficient stock.
This SIV has already been posted.
This disposal has already been executed.
```

---

# 41. Database Integrity

The database must enforce important invariants.

Examples:

```text
item code unique
store code unique
reference numbers unique
quantity > 0 where appropriate
qtyOnHand >= 0
foreign keys valid
posted records immutable
```

Indexes should cover:

- item code;
- store;
- status;
- reference fields;
- transaction item/date;
- department ownership;
- notification recipient/read status where applicable.

Every multi-table stock operation must use a database transaction.

---

# 42. Core Database Concepts

The exact existing schema should be preserved where possible, but the logical model must support:

## Master data

- users;
- roles;
- permissions;
- departments;
- stores;
- sections;
- racks;
- shelves;
- bins;
- categories;
- items;
- suppliers;
- units.

## Receiving

- goods receipts;
- receipt items;
- technical evaluations;
- evaluation findings/evidence;
- GRNs;
- GRN items.

## Inventory

- inventory balances;
- stock transactions;
- stock lots/FIFO layers;
- bin cards;
- bin transactions.

## Requisitions/issues

- requisitions;
- requisition items;
- approvals;
- issue vouchers;
- issue voucher items;
- amendment history.

## Returns

- returns/SRN;
- return items;
- return evaluations;
- return approvals.

## Transfers

- material transfers;
- transfer items;
- transfer approvals;
- dispatch records;
- destination receipt.

## Controls

- stock-taking sessions;
- physical count lines;
- variances;
- reconciliation;
- adjustments.

## Assets

- fixed assets;
- asset assignments;
- asset movements;
- user material cards.

## Disposal

- disposal flags;
- disposal requests;
- disposal approvals;
- disposal executions.

## Security

- gate verification;
- verification history.

## Cross-cutting

- notifications;
- audit logs;
- business rules/configuration.

Do not add tables merely for appearance. Add a table when the workflow needs independent lifecycle/history/relationship data.

---

# 43. Stock Movement Invariants

Every stock-changing transaction must preserve:

```text
Who
What
When
Where
Why
Source Document
Previous Balance
New Balance
Quantity
Cost/FIFO Effect
Stock Card Effect
Bin Card Effect
Audit Effect
Notification Effect
```

For an issue:

```text
SIV
 ↓
Stock transaction
 ↓
Inventory balance
 ↓
FIFO consumption
 ↓
Bin transaction
 ↓
Audit
```

For a receipt:

```text
GRN
 ↓
Receipt transaction
 ↓
Inventory increase
 ↓
FIFO lot
 ↓
Bin transaction
 ↓
Audit
```

---

# 44. Transaction Rollback

Example:

An issue of 100 units requires:

```text
inventory update
FIFO update
stock transaction
bin update
SIV status
requisition fulfillment
audit
notification
```

If the bin update fails:

```text
NONE of the preceding stock changes may remain.
```

The entire database transaction rolls back.

This is mandatory for stock integrity.

---

# 45. Status Transition Engine

Never allow arbitrary status changes.

Example:

## Receipt

```text
Draft
 → Submitted
 → Pending Evaluation
 → Under Evaluation
 → Accepted / Partially Accepted / Rejected / On Hold
 → GRN Generated
 → Posted
```

## Requisition

```text
Draft
 → Submitted
 → Pending Approval
 → Approved / Partially Approved / Rejected
 → Ready for Issue
 → Partially Issued
 → Fulfilled
```

## SIV

```text
Preliminary
 → Pending Approval
 → Amendment Required
 → Approved
 → Posted / Issued
 → Gate Cleared where applicable
```

## Transfer

```text
Draft
 → Submitted
 → Pending Approval
 → Approved
 → Dispatched
 → Received
 → Completed
```

## Return

```text
Draft
 → Submitted
 → Pending Review
 → Evaluation
 → Approved / Rejected
 → Returned to Stock
```

## Disposal

```text
Flagged
 → Requested
 → Under Review
 → Approved
 → Executed
 → Completed
```

---

# 46. Invalid Workflow Examples

The system must reject:

```text
Rejected requisition → Final SIV
Pending receipt → GRN
Unapproved SIV → Stock posting
Pending transfer → Stock decrease
Return > previously issued quantity
Issue > available stock
Disposal > eligible quantity
Closed stock-taking → silent edit
Posted transaction → delete
TEC → direct inventory update
Security → direct stock posting
Stock Clerk → manual bin balance update
```

---

# 47. Traceability

Every major document must provide related-record navigation.

Example:

```text
GRN-2026-0001
   ↓
Goods Receipt
   ↓
Technical Evaluation
   ↓
GRN
   ↓
Stock Transaction
   ↓
Stock Card
   ↓
Bin Card
```

Requisition:

```text
SR-2026-0040
   ↓
Approval
   ↓
SIV-2026-0011
   ↓
Issue
   ↓
Stock Card
   ↓
Bin Card
   ↓
Gate Verification
```

Return:

```text
SRN-2026-0011
   ↓
Original SIV
   ↓
Evaluation
   ↓
Approval
   ↓
Return Transaction
   ↓
Stock Card
   ↓
Bin Card
```

Transfer:

```text
TRF-2026-0007
   ↓
Approval
   ↓
Dispatch
   ↓
Security
   ↓
Destination Receipt
   ↓
Source Stock
   ↓
Destination Stock
```

Disposal:

```text
DSP-2026-0003
   ↓
Flag
   ↓
Request
   ↓
Review
   ↓
Approval
   ↓
Execution
   ↓
Inventory Transaction
   ↓
Audit
```

---

# 48. Realistic Demonstration Data

Use realistic demo data only.

Do not claim it is actual institutional data.

Example stores:

- Main Store
- Electrical Engineering Store
- Mechanical Engineering Store
- Chemical Engineering Store
- Civil Engineering Store
- Applied Sciences Store
- Laboratory Store
- Computing Store

Example materials:

- A4 Photocopy Paper
- Digital Multimeter
- Arduino Uno
- Oscilloscope
- Laser Printer
- Laboratory Glassware
- Safety Gloves
- Chemical Storage Container
- Welding Electrodes
- Ballpoint Pens
- Network Switch
- Desktop Computer
- Electrical Cable
- Mechanical Bearing
- Measuring Tape
- Laboratory Balance

Seed data must demonstrate:

```text
Normal
Low Stock
Pending
Approved
Rejected
Partially Approved
Expiring
Expired
Damaged
Quarantine
Disposal Pending
Completed
```

---

# 49. Security Requirements

Mandatory:

- bcrypt password hashing;
- JWT authentication;
- strong environment-configured JWT secret;
- server-side authorization;
- input validation;
- login rate limiting;
- restricted CORS;
- security headers where compatible;
- protected routes;
- organizational scope checks;
- no password hashes in responses;
- safe error messages;
- audit sensitive operations.

Frontend authorization is not security.

---

# 50. Performance Requirements

List endpoints should support:

```text
page
pageSize
search
filter
date range
sort
```

Use server-side filtering for large datasets.

Do not load the entire database into the browser simply to calculate dashboard values.

Dashboard endpoints should return role-scoped aggregates.

---

# 51. Final End-to-End Example — 20 Laptops

Suppose the store receives:

```text
20 laptops
```

## Receiving

Storekeeper records:

```text
Supplier
Purchase reference
20 laptops
Condition
Serial information
Store
```

Receipt remains:

```text
Pending Evaluation
```

## Evaluation

TEC inspects.

Result:

```text
18 accepted
2 rejected
```

## GRN

GRN is generated for:

```text
18 laptops
```

## Stock posting

System creates:

```text
18 inventory units
18 FIFO acquisition records/layers as appropriate
Stock Card receipt
Bin Card receipt
Audit
Notification
```

The 2 rejected units are not usable stock.

## Requisition

Department requests:

```text
5 laptops
```

Department Head submits.

Approver approves.

## SIV

Storekeeper prepares preliminary SIV.

Store Head/authorized approver approves.

## Issue

Storekeeper posts:

```text
18 - 5 = 13 laptops
```

FIFO cost is applied.

Stock Card and Bin Card decrease.

## Gate

Security verifies the outgoing SIV and recipient.

Gate clearance is recorded.

## Return

Department returns:

```text
1 laptop
```

Inspection determines:

```text
Reusable = 1
```

After approval:

```text
13 + 1 = 14
```

## Transfer

Another store requests:

```text
3 laptops
```

Transfer is approved.

Source/destination processing follows configured transfer policy.

## Stock taking

System:

```text
14
```

Physical:

```text
13
```

Variance:

```text
-1
```

Investigation and approval occur before adjustment.

## Disposal

Suppose one damaged laptop is later flagged.

Workflow:

```text
Flag
 ↓
Disposal Request
 ↓
Review
 ↓
Approval
 ↓
Execution
 ↓
Inventory removal
 ↓
Audit
```

Historical records remain intact.

---

# 52. Complete Feature Matrix

| Feature | Create | Edit | Approve/Review | Post/Execute | View | Direct Stock Effect |
|---|---|---|---|---|---|---|
| Stores | Authorized admin/PAO/store authority | Authorized | Where applicable | No | Authorized | No |
| Categories | Authorized master-data role | Authorized | No | No | Authorized | No |
| Items | Authorized master-data role | Authorized | No | No | Authorized | No |
| Locations | Authorized store/admin role | Authorized | No | No | Authorized | No |
| Suppliers | Authorized role | Authorized | No | No | Authorized | No |
| Goods Receipt | Storekeeper | Before submission | Store Head/TEC/authorized | Posting stage | Relevant roles | Accepted qty only |
| Technical Evaluation | TEC | Before submission | TEC | No direct stock post | Relevant roles | No direct effect |
| GRN | Authorized property/store role | Restricted | Authorized | Generate/post | Relevant roles | Accepted qty |
| Stock Card | System-generated | No manual balance edit | No | System | Relevant roles | Derived |
| Bin Card | System-generated | No manual balance edit | No | System | Relevant roles | Derived |
| Bin Transfer | Store operational role | Before completion | Policy dependent | Execute | Store roles | Bin only |
| Requisition | Department Head/requester | Draft only | Authorized approver | No | Relevant roles | No |
| SIV | Storekeeper | Preliminary only | Store Head/authorized | Storekeeper/authorized | Relevant roles | Final post |
| Return | Department Head/requester | Draft only | Store Head/PAO/evaluator | Stock service | Relevant roles | Approved usable qty |
| Material Transfer | Authorized requester | Draft | PAO/Store Head/authorized | Dispatch/receive | Relevant roles | According to transfer state |
| Stock Taking | Store operational role | Open session | Authorized approver | Adjustment | Relevant roles | Adjustment only |
| Reconciliation | Authorized role | Open case | Authorized approver | Adjustment | Relevant roles | Controlled adjustment |
| Fixed Asset | Property/authorized role | Restricted | Property authority | Assignment/movement | Relevant roles | Asset record |
| User Card | Property/store authority | Restricted | Where required | Issue/return link | Authorized | Custody record |
| Disposal | Authorized role | Draft/request | PAO/authorized authority | Disposal executor | Relevant roles | Execution only |
| Gate Verification | No inventory creation | No | No stock approval | Security verifies | Security/authorized | No direct stock change |
| Reports | No | No | No | No | Authorized | No |
| Audit Log | System | No | No | System | Authorized | No |
| Notifications | System | Read/dismiss | No | System | User | No |

---

# 53. Refactoring Strategy for an Existing Application

Do not rebuild the project from scratch.

First:

```text
Inspect
 ↓
Map
 ↓
Compare against requirements
 ↓
Identify gaps
 ↓
Fix highest-risk workflows
 ↓
Test
 ↓
Regression test
```

Preserve:

- current design;
- routes where valid;
- shared components;
- working API conventions;
- existing database data;
- existing seed data;
- existing working functionality.

Refactor only where needed to satisfy the consolidated requirements.

---

# 54. Implementation Order

Recommended sequence:

1. Authentication and RBAC.
2. Master data.
3. Receiving.
4. Technical evaluation.
5. GRN.
6. Stock ledger and FIFO.
7. Stock Cards/Bin Cards.
8. Requisitions.
9. SIV/ISIV.
10. Final issue.
11. Gate verification.
12. Returns.
13. Transfers.
14. Bin transfers.
15. Stock taking.
16. Reconciliation/adjustments.
17. Fixed assets.
18. User material cards.
19. Shelf-life/monitoring.
20. Disposal.
21. Notifications.
22. Reports.
23. Audit/traceability.
24. Testing.
25. Security/performance hardening.

After every phase:

```text
Frontend build
 ↓
Lint/static checks
 ↓
Backend syntax/tests
 ↓
API tests
 ↓
Database tests
 ↓
Authorization tests
 ↓
Workflow tests
 ↓
UI verification
 ↓
Regression tests
```

---

# 55. Acceptance Test Set

The complete system must demonstrate:

### Master Data

- create item;
- search item;
- edit item;
- deactivate item;
- create supplier;
- create store;
- create location;
- assign item location.

### Receiving

- create receipt;
- submit receipt;
- inspect;
- evaluate;
- approve;
- reject;
- partially accept;
- generate GRN;
- post accepted stock.

### Inventory

- view Stock Card;
- view Bin Card;
- perform bin transfer;
- verify FIFO;
- monitor low stock;
- monitor expiry.

### Requisition/Issue

- create requisition;
- submit;
- approve;
- reject;
- partially approve;
- prepare SIV;
- amend SIV;
- approve SIV;
- post issue;
- verify stock reduction;
- verify FIFO;
- verify gate linkage.

### Returns

- create SRN;
- validate original issue;
- inspect return;
- approve;
- reject;
- restore reusable stock;
- quarantine damaged stock.

### Transfers

- create transfer;
- approve;
- reject;
- dispatch;
- gate verify;
- receive;
- complete;
- verify source/destination stock.

### Stock Control

- create stock-taking session;
- enter physical count;
- calculate variance;
- investigate;
- approve;
- adjust;
- close;
- generate reconciliation report.

### Assets

- register asset;
- assign asset;
- move asset;
- view history;
- return/maintenance;
- dispose without deleting history.

### Disposal

- flag;
- create request;
- review;
- approve;
- execute;
- verify inventory removal;
- retain history.

### Cross-cutting

- notifications;
- audit;
- reports;
- CSV export;
- role-specific dashboards;
- role-specific sidebars;
- correct CTAs.

---

# 56. Negative Tests

Test every critical workflow with invalid scenarios.

Examples:

```text
Wrong role → 403
Wrong department → 403
Wrong store → 403
Invalid status → 400/409
Insufficient stock → 400
Duplicate reference → 409
Duplicate posting → 409
Missing required field → 400
Return > issued → 400
Transfer > source balance → 400
Issue > available stock → 400
GRN before acceptance → reject
SIV before approval → reject
Disposal execution before approval → reject
Posted transaction deletion → reject
Closed stock-taking edit → reject
```

---

# 57. Three-Layer Verification

For every major action, verify all three layers.

## Frontend

Check:

- button exists only for authorized actor;
- button invokes correct API;
- loading state works;
- success feedback works;
- error feedback works;
- data refreshes;
- route is correct.

## Backend

Check:

- authentication;
- authorization;
- ownership/scope;
- status;
- validation;
- business rules;
- transaction;
- response.

## Database

Check:

- expected row created/updated;
- stock balance correct;
- stock transaction created;
- FIFO correct;
- bin transaction correct;
- audit created;
- notification created;
- no partial changes.

---

# 58. Refactoring Completion Definition

The system is considered production-like only when:

```text
Every required page exists
        +
Every sidebar route works
        +
Every actor has correct permissions
        +
Every CTA performs its intended action
        +
Every CRUD operation respects workflow
        +
Every workflow has controlled statuses
        +
Frontend communicates with API
        +
API communicates with PostgreSQL
        +
Business logic is server-side
        +
Stock changes are transactional
        +
FIFO is correct
        +
Stock Cards update automatically
        +
Bin Cards update automatically
        +
Audit is generated
        +
Notifications are generated where required
        +
Reports reflect database state
        +
Historical records are preserved
        +
Negative/security tests pass
        +
Regression tests pass
```

---

# 59. Final AI Coding-Agent Instruction

When using this document with Copilot or another coding agent:

> **Do not blindly modify the project.**
>
> First inspect the existing source tree, routes, components, services, controllers, business services, database schema, seed data, authorization configuration and API client.
>
> Build a requirement-to-code gap matrix.
>
> For every requirement classify it:
>
> - IMPLEMENTED
> - PARTIALLY IMPLEMENTED
> - MISSING
> - INCORRECT
> - BROKEN
> - UNVERIFIED
> - BUSINESS DECISION REQUIRED
>
> Show the evidence before making destructive changes.
>
> Preserve working functionality.
>
> Reuse existing architecture and UI.
>
> Do not migrate technologies.
>
> Do not create duplicate pages for functionality that can correctly live in an existing workflow page.
>
> Fix workflows from the database/business-service layer upward.
>
> Do not solve database/business-rule problems with frontend-only state.
>
> For every modified feature verify:
>
> ```text
> Actor
> → Permission
> → Route
> → CTA
> → API
> → Controller
> → Service
> → PostgreSQL
> → Transaction
> → Stock effect
> → Stock Card
> → Bin Card
> → Audit
> → Notification
> → Response
> → UI refresh
> ```
>
> Never claim a feature is complete merely because its page renders.
>
> Never allow arbitrary status changes.
>
> Never allow unauthorized actors to perform operations simply because a frontend button exists.
>
> Never allow stock to be changed by directly editing balances.
>
> Never delete historical posted transactions.
>
> Never allow a rejected/pending document to bypass its required workflow.
>
> Never silently create a second unrelated route for an existing sidebar item.
>
> Before finalizing, run the complete acceptance and negative test matrix and report exactly what passed, failed, remains incomplete, or requires business validation.

---

# 60. Final System Mental Model

The simplest way to understand the complete system is:

```text
                 MASTER DATA
                     │
       ┌─────────────┼─────────────┐
       │             │             │
    Stores        Items        Suppliers
       │             │             │
       └─────────────┼─────────────┘
                     ↓
                 RECEIVING
                     ↓
             TEC EVALUATION
                     ↓
              ACCEPT / REJECT
                     ↓
                    GRN
                     ↓
              STOCK POSTING
                     ↓
          ┌──────────┴──────────┐
          ↓                     ↓
     STOCK CARD              BIN CARD
          │                     │
          └──────────┬──────────┘
                     ↓
                AVAILABLE STOCK
                     │
        ┌────────────┼─────────────┐
        ↓            ↓             ↓
   REQUISITION    TRANSFER       RETURN
        ↓            ↓             ↓
    APPROVAL      APPROVAL     EVALUATION
        ↓            ↓             ↓
      SIV          DISPATCH      APPROVAL
        ↓            ↓             ↓
     APPROVAL     RECEIPT       STOCK IN
        ↓            ↓
     ISSUE        STOCK MOVE
        ↓
   STOCK OUT / FIFO
        ↓
   GATE VERIFICATION
        │
        └──────────────┐
                       ↓
            STOCK CONTROL
            ┌──────────┼───────────┐
            ↓          ↓           ↓
       STOCK TAKING  RECONCILE  MONITORING
            ↓          ↓           ↓
        VARIANCE    ADJUSTMENT   DISPOSAL
                                   ↓
                              APPROVAL
                                   ↓
                               EXECUTION
                                   ↓
                             STOCK REMOVAL

ALL TRANSACTIONS
       ↓
AUDIT
       +
NOTIFICATIONS
       +
REPORTS
```

**The core principle is simple:**

> **Documents authorize transactions. Transactions change stock. Stock changes create ledger records. Ledger records feed cards, reports, audit and notifications. Roles control who may perform each step. PostgreSQL preserves the final truth.**
