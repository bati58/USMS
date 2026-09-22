# University Stock Management System
## Final Refactoring & Implementation Specification
### Global Item Master + Store-Level Inventory + Store-Specific Locations/Bins

**Document status:** Final recommended implementation specification  
**Purpose:** Refactor the existing system safely without rewriting the application or destroying existing data.  
**Primary stack:** React 18 + Vite, Node.js + Express, PostgreSQL, `pg`, JWT, bcrypt  
**Database:** PostgreSQL 18.4 in the current development environment

---

## 1. Executive Summary

The existing University Stock Management System already contains a broad set of operational modules: authentication, RBAC, stores, items, categories, goods receiving, technical evaluation, GRN, stock cards, bin cards, requisitions, issue vouchers, returns, material transfers, stock taking, reconciliation, fixed assets, disposal, reports, notifications, audit logging, and business rules.

The principal architectural correction is to separate three concepts that are currently mixed together:

1. **Item Master** — what an item is.
2. **Store Inventory** — how much of that item a particular store owns.
3. **Location/Bin Inventory** — where the store's quantity is physically kept.

The final target is:

```text
Institution
│
├── Global Categories
├── Global Item Master
│
└── Stores
    ├── Main Store
    ├── Department Store
    ├── Laboratory Store
    ├── Cafe Store
    └── Specialized Store
          ├── Store Inventory
          └── Locations / Bins
```

External supplier/donor goods enter the institution through the **Main Store** only.

Other stores obtain stock through authorized **Material Transfers** from the Main Store.

A single item definition can therefore exist in multiple stores without duplicating the item master record.

---

## 2. Critical Architectural Decision

### 2.1 Item identity

Use the existing `items` table as the final institution-wide Item Master rather than introducing a permanent second table called `global_items`.

Recommended final structure:

```text
items
-----
id
code                  UNIQUE
name
category_id
unit
description
min_stock_level
max_stock_level
reorder_level
expiry_tracked
active
created_at
updated_at
```

The final Item Master must not depend on:

```text
items.store_id
```

An item's identity is not determined by its store.

Example:

```text
ITM-001 | A4 Photocopy Paper | Administrative Supplies
```

Store quantities are then:

```text
Main Store        = 500
Laboratory Store  = 50
Cafe Store        = 20
```

There is still only one `ITM-001`.

---

## 3. Global Categories

Categories must be institution-wide.

A category describes the type of an item, not where the item is stored.

Examples:

```text
CAT-ADM  Administrative Supplies
CAT-ICT  ICT Equipment
CAT-LAB  Laboratory Equipment
CAT-FAC  Facility/Maintenance Materials
CAT-OFF  Office Supplies
CAT-CLE  Cleaning Materials
```

Recommended final structure:

```text
categories
----------
id
code UNIQUE
name
description
active
created_at
updated_at
```

Do not permanently maintain `categories.store_id`.

---

## 4. Store-Level Inventory

Create or refactor the existing per-store inventory mechanism into one authoritative store-level balance.

Recommended:

```text
store_inventory
---------------
id
store_id
item_id
qty_on_hand
created_at
updated_at

UNIQUE(store_id, item_id)
```

Meaning:

- `items` answers: **What is the item?**
- `store_inventory` answers: **How much does this store own?**

Example:

```text
Item Master:
ITM-001 | Digital Multimeter

Store Inventory:
Main Store        | ITM-001 | 100
Laboratory Store  | ITM-001 | 20
```

Do not duplicate the Item Master record for each store.

---

## 5. Physical Location and Bin Inventory

Store-level quantity and physical location must be separate concepts.

Example:

```text
Laboratory Store
Digital Multimeter
Total = 20

LAB-A01 = 12
LAB-A02 = 8
```

Therefore:

```text
Store Inventory = 20
```

and:

```text
Bin balances:
LAB-A01 = 12
LAB-A02 = 8
Total = 20
```

The system must validate this relationship.

---

## 6. Locations

Retain the existing hierarchical location model where practical:

```text
Store
└── Section
    └── Rack
        └── Shelf
            └── Bin
```

Every location must have a valid `store_id`.

Examples:

```text
Main Store:
MAIN-A01
MAIN-A02
MAIN-B01

Laboratory Store:
LAB-A01
LAB-A02
LAB-B01

Cafe Store:
CAFE-A01
CAFE-B01
```

A user operating Laboratory Store must never receive Main Store bins in a location dropdown.

---

## 7. Store-Specific Item Assignment

When a Store Head wants to add an item to their store:

```text
Select global Item Master item
        ↓
Select existing location/bin belonging to user's store
        ↓
Assign/initialize store inventory
```

Do not create a new Item Master record.

Example:

Main Store:

```text
Item: Digital Multimeter
Bin:
  MAIN-A01
  MAIN-A02
  MAIN-B01
```

Laboratory Store:

```text
Item: Digital Multimeter
Bin:
  LAB-A01
  LAB-A02
  LAB-B01
```

The backend must enforce the same restriction.

---

## 8. Goods Receipt — Final Workflow

External goods receiving is centralized.

### Rule

**External supplier/donor Goods Receipt is allowed only at the Main Store.**

Other stores must not directly receive supplier deliveries through Goods Receipt.

### Workflow

```text
Supplier / Donor
       ↓
Security / Gate Verification
       ↓
Main Store Storekeeper
       ↓
Goods Receipt
       ↓
Main Store Head Review
       ↓
Technical Evaluation where required
       ↓
Acceptance
       ↓
GRN Generation
       ↓
Ready for Posting
       ↓
Authorized Stock Posting
       ↓
Main Store Inventory
```

### Stock timing

Creating a Goods Receipt:

```text
NO STOCK CHANGE
```

Submitting:

```text
NO STOCK CHANGE
```

Store Head approval:

```text
NO STOCK CHANGE
```

TEC acceptance:

```text
NO STOCK CHANGE
```

GRN generation:

```text
NO STOCK CHANGE
```

Only authorized inventory posting changes stock.

Example:

```text
Before receipt:
90

Accepted:
20

After GRN generation:
90

After posting:
110
```

---

## 9. Goods Receipt Data Rules

The system should distinguish:

```text
expected_qty
received_qty
accepted_qty
rejected_qty
posted_qty
```

Example:

```text
Expected = 100
Received = 98
Accepted = 95
Rejected = 3
Posted = 95
```

Enforce:

```text
posted_qty <= accepted_qty
```

and:

```text
goods_receipt.store_id = Main Store
```

The frontend must not be the only enforcement point.

---

## 10. Material Transfer — Final Workflow

Material Transfer is an internal inventory movement, not a Goods Receipt.

Normal workflow:

```text
Destination Store
       ↓
Store Requisition
       ↓
Main Store Review
       ↓
Required Approval
       ↓
Material Transfer
       ↓
Main Store Storekeeper Dispatch
       ↓
Destination Storekeeper Receive
       ↓
Destination Store Inventory
```

Example:

```text
Main Store = 100
Transfer 20
Main Store after dispatch = 80
Laboratory Store after receipt = 20
Institution total = 100
```

Internal transfer must not create a supplier GRN.

---

## 11. Material Transfer Store Rules

For the normal replenishment workflow:

```text
source_store = Main Store
destination_store = requesting store
```

The backend must enforce this.

Do not trust browser-supplied `from_store_id`.

---

## 12. Destination Bin Selection

The destination bin must NOT be selected by the source Storekeeper.

At dispatch:

```text
Source Storekeeper
→ item
→ quantity
→ source stock
```

At receipt:

```text
Destination Storekeeper
→ transfer
→ received quantity
→ destination bin
```

Destination bin must be:

```text
active
AND
belong to destination store
```

Backend must validate:

```text
destination_location.store_id = transfer.to_store_id
```

---

## 13. Bin Transfer — Final Workflow

Bin Transfer is different from Material Transfer.

Material Transfer:

```text
Store A → Store B
```

Bin Transfer:

```text
Same Store:
Bin A → Bin B
```

Example:

```text
Laboratory Store

LAB-A01 = 30
LAB-A02 = 20

Move 10:
LAB-A01 → LAB-B01

Result:
LAB-A01 = 20
LAB-B01 = 10
Store total = 50
```

The store total must remain unchanged.

---

## 14. Bin Transfer Source Selection

When a Storekeeper selects an item, the system must show only bins that currently contain that item.

Example:

```text
Digital Multimeter

LAB-A01 — Available: 12
LAB-A02 — Available: 8
```

The source bin must not be arbitrary text.

Backend validates:

```text
source bin belongs to user's store
source bin contains selected item
source quantity >= requested quantity
```

---

## 15. Bin Transfer Destination

Destination must contain only active bins belonging to the same store.

Example:

```text
Laboratory Store

Destination:
LAB-A02
LAB-B01
LAB-B02
```

Never show:

```text
MAIN-A01
CAFE-A01
```

A location-ID based model is preferred:

```text
bin_transfers
-------------
id
store_id
item_id
from_location_id
to_location_id
qty
transferred_by
created_at
```

---

## 16. FIFO Inventory

FIFO must be store-aware.

Recommended:

```text
stock_lots
----------
id
item_id
store_id
received_date
unit_price
qty_received
qty_remaining
source_ref
```

A Laboratory Store issue must never consume Main Store FIFO lots.

---

## 17. Stock Transactions

Stock-changing operations include:

```text
Receipt
Issue
Transfer-Out
Transfer-In
Return
Adjustment
Disposal
Bin Transfer
```

Every stock-changing operation must have clear store context.

All stock-changing operations must use PostgreSQL transactions.

Conceptually:

```text
BEGIN
    update stock
    create transaction
    update FIFO
    update bin card
    write audit
COMMIT
```

On failure:

```text
ROLLBACK
```

---

## 18. Stock Card

Stock Card represents store-level item movement.

Example:

```text
Laboratory Store
Digital Multimeter

Opening = 10
Receipt = +20
Issue = -5
Transfer-In = +10
Balance = 35
```

Do not combine different stores into one store-level balance.

---

## 19. Bin Card

Bin Card represents physical movement at a location.

Example:

```text
LAB-A01

Opening = 10
Transfer-In = +5
Bin Transfer-Out = -3
Current = 12
```

The sum of active bin balances should equal the store inventory balance for the item.

---

## 20. Store User Assignments

Keep the relational assignment model:

```text
store_user_assignments
----------------------
store_id
user_id
assignment_role
active
effective_from
effective_to
```

Store Head:

```text
one assigned store
```

Storekeeper:

```text
one assigned store
```

Backend authorization must resolve the active assignment.

---

## 21. Authorization

Every store-scoped API must verify authorization server-side.

Examples:

```text
GET /locations
POST /items/assign
POST /bin-transfers
POST /material-transfers
POST /stock-adjustments
POST /goods-receipts
POST /issue-vouchers
POST /material-returns
```

Never trust client-supplied:

```text
store_id
user_id
role
location_id
```

without server-side validation.

---

## 22. PAO Role

PAO is an institution-level governance and approval role.

Recommended PAO responsibilities:

- Material Transfer approval where required
- Stock Taking oversight
- Reconciliation review
- Stock Adjustment authorization
- Disposal authorization
- Fixed Asset oversight
- User Material Card oversight
- Goods Receipt/GRN oversight where policy requires
- Institution-wide reports
- Audit visibility

PAO should not become the routine master-data editor or physical store operator.

---

## 23. Administrator Role

Administrator manages:

- Users
- Roles/permissions
- System configuration
- Business Rules
- Master-data governance
- Controlled overrides
- Audit/governance
- System monitoring

Administrator should not routinely perform physical stock operations.

All controlled overrides must be audited.

---

## 24. Material Return

Recommended:

```text
Department/User
       ↓
Return Request
       ↓
Store Head Review
       ↓
Storekeeper Physical Receipt
       ↓
Inspection / TEC where required
       ↓
Accepted / Rejected / Repairable / Disposal
       ↓
Authorized Stock Posting
```

Returned goods must not automatically become usable stock before acceptance.

---

## 25. Stock Taking and Reconciliation

Recommended:

```text
Store Head
    ↓
Create/Schedule
    ↓
Stock Clerk Counts
    ↓
Submit
    ↓
Store Head Verification
    ↓
Variance Investigation
    ↓
Recount if required
    ↓
Reconciliation
    ↓
PAO Adjustment Approval
    ↓
Authorized Adjustment Posting
```

No silent direct quantity editing.

---

## 26. Disposal

Recommended:

```text
Identified
   ↓
Quarantined
   ↓
Technical Assessment
   ↓
Repairable / Unusable / Return to Stock
   ↓
Disposal Recommendation
   ↓
Authorization
   ↓
Ready for Disposal
   ↓
Physical Disposal
   ↓
Execution Confirmation
   ↓
Inventory Disposal Posting
   ↓
Completed
```

Approval must not automatically remove stock.

---

## 27. Database Migration Strategy

Do not immediately delete:

```text
items.store_id
stores.department
stores.head_of_store
stores.storekeeper
```

First:

1. Back up the database.
2. Create new structures.
3. Migrate data.
4. Update backend.
5. Update frontend.
6. Run consistency checks.
7. Confirm all references are migrated.
8. Remove obsolete columns only after verification.

---

## 28. Duplicate Item Migration

Do not automatically merge all duplicates.

Safe example:

```text
ITM-001 A4 Paper Main Store
ITM-001 A4 Paper Laboratory Store
```

These can likely map to one Item Master.

Ambiguous example:

```text
ITM-010 Printer Main Store
ITM-010 Printer Laboratory Store
```

If specifications, units, brands, or identities differ, require manual review.

Create a duplicate review report before merging ambiguous records.

---

## 29. Migration Mapping

Use temporary mappings:

```text
temp_item_map
-------------
old_item_id
new_item_id
decision
notes
```

and:

```text
temp_category_map
-----------------
old_category_id
new_category_id
decision
notes
```

Remove temporary mappings after successful migration.

---

## 30. Migration Runner

Use:

```text
schema_migrations
-----------------
version
name
applied_at
```

Command:

```bash
npm run db:migrate
```

Runner:

1. Reads migration files.
2. Checks applied versions.
3. Runs missing migrations.
4. Records successful migrations.
5. Stops on failure.
6. Does not silently skip failures.

Do not run migrations from `server.js` every startup.

---

## 31. `schema.sql`

`schema.sql` must represent the clean current schema for a fresh database.

Historical changes belong in:

```text
backend/migrations/
```

Avoid repeated:

```text
CREATE TABLE
ALTER TABLE
ALTER TABLE IF NOT EXISTS
```

for the same feature.

---

## 32. Backend Refactoring

Inspect all:

- controllers
- services
- routes
- middleware
- SQL queries
- reports
- notifications
- audit logging

Search for:

```text
items.store_id
categories.store_id
item.store_id
store_inventory
stock_lots
stock_transactions
bin_cards
bin_transfers
location_id
```

Affected workflows:

- Items
- Categories
- Goods Receipt
- GRN
- Stock Cards
- Bin Cards
- Bin Transfers
- Requisitions
- Issue Vouchers
- Material Returns
- Material Transfers
- Stock Taking
- Reconciliation
- Disposal
- Reports
- Audit Logs
- Notifications

---

## 33. Central Store Inventory Service

Create or refactor:

```text
services/storeInventoryService.js
```

Responsibilities:

- get store/item balance
- create store-item inventory record
- increase quantity
- decrease quantity
- validate availability
- transfer quantities
- handle adjustments
- coordinate FIFO
- coordinate bin balances

Controllers should not independently implement stock mutation logic.

---

## 34. Frontend Changes

### Item dropdown

Use the global Item Master.

### Location dropdown

Filter by the logged-in user's authorized store.

### Goods Receipt

Display:

```text
Receiving Store: Main Store
```

as controlled/read-only information.

### Material Transfer

Source:

```text
Main Store
```

Destination:

```text
authorized destination store
```

Destination bin is selected during receipt.

### Bin Transfer

Source:

```text
actual bins containing the selected item
```

Destination:

```text
active bins in same store
```

Show available quantity for each source bin.

---

## 35. Recommended API Structure

Do not create unnecessary duplicate APIs.

The existing `/api/items` can represent the Item Master if it is cleanly refactored.

Recommended:

```text
GET  /api/items
POST /api/items
PUT  /api/items/:id
```

Store inventory:

```text
GET /api/stores/:storeId/inventory
GET /api/stores/:storeId/inventory/:itemId
```

Bin balances:

```text
GET /api/bin-balances?storeId=...&itemId=...
```

Locations:

```text
GET /api/locations?storeId=...
```

The API should remain simple and domain-oriented.

---

## 36. Reporting

Reports must use the global Item Master plus store inventory.

Example:

```text
Digital Multimeter

Main Store             100
Laboratory Store        20
Cafe Store                0
Department Store        10
--------------------------------
Institution Total      130
```

Filters:

- Store
- Category
- Item
- Location
- Status
- Date
- Transaction type

---

## 37. Audit Logging

Audit at minimum:

- Item Master changes
- Category changes
- Store inventory changes
- Goods Receipt
- GRN
- Stock posting
- Material Transfer
- Bin Transfer
- Issue
- Material Return
- Stock Taking
- Adjustment
- Disposal
- Store assignment
- Business Rule changes

Include:

```text
actor
role
module
action
entity
entity_id
before_data
after_data
changes
timestamp
outcome
```

Stock operations should also record:

```text
store_id
item_id
location_id where applicable
transaction reference
```

---

## 38. Business Rules

Good configurable rules:

```text
LOW_STOCK_THRESHOLD
SHELF_LIFE_WARNING_DAYS
RECOUNT_VARIANCE_THRESHOLD
TEC_EVALUATION_REQUIRED
TRANSFER_APPROVAL_REQUIRED
RETURN_EVALUATION_REQUIRED
```

Do not allow Business Rules to bypass fundamental security:

```text
ALLOW_STOREKEEPER_TO_EDIT_ANY_STORE
ALLOW_EXTERNAL_RECEIPT_AT_ANY_STORE
BYPASS_STOCK_APPROVAL
```

Those must remain hard backend controls.

---

## 39. Testing Requirements

### Test 1 — Global Item Master

Create:

```text
ITM-001
A4 Photocopy Paper
```

Verify one Item Master record.

### Test 2 — Main Store Receipt

Receive:

```text
500
```

Verify:

```text
Main Store = 500
```

### Test 3 — Laboratory Transfer

Transfer:

```text
50
```

Verify:

```text
Main Store = 450
Laboratory Store = 50
```

### Test 4 — Bin Distribution

```text
LAB-A01 = 30
LAB-A02 = 20
```

Total:

```text
50
```

### Test 5 — Bin Transfer

Move:

```text
10
LAB-A01 → LAB-B01
```

Expected:

```text
LAB-A01 = 20
LAB-B01 = 10
Store total = 50
```

### Test 6 — Cross-Store Bin Attack

Laboratory user attempts:

```text
MAIN-A01
```

Expected:

```text
HTTP 403
```

### Test 7 — External Receipt Attack

Attempt Goods Receipt into Laboratory Store.

Expected:

```text
HTTP 403 / validation error
```

### Test 8 — Pre-Posting Stock

Accepted GRN exists but is not posted.

Expected:

```text
stock unchanged
```

### Test 9 — Posting

Post accepted quantity.

Expected:

```text
stock increases exactly by posted quantity
```

### Test 10 — FIFO Isolation

Verify each store consumes only its own FIFO lots.

---

## 40. Data Consistency

Do not assume a simple transaction sum is always the authoritative balance.

Define ledger rules first.

Then compare:

```text
store_inventory
```

against:

```text
authorized stock ledger balance
```

and compare:

```text
sum(bin balances)
```

against:

```text
store_inventory.qty_on_hand
```

Any discrepancy must be investigated before migration is finalized.

---

## 41. PostgreSQL Connection Safety

Preserve the centralized PostgreSQL Pool.

Search:

```text
new Pool
new Client
pool.connect
```

Ensure transaction clients are released.

Do not increase PostgreSQL `max_connections` to hide leaks.

---

## 42. Development Environment

Use the actual environment:

```text
Windows
Node.js
PostgreSQL 18.4
PowerShell
```

Docker should not be mandatory.

---

## 43. Recommended Implementation Order

### Phase 1 — Inspection

- Back up database.
- Inspect schema.
- Inspect migrations.
- Inspect controllers/services.
- Search legacy `store_id`.
- Search stock mutation logic.
- Produce dependency report.

### Phase 2 — Master Data

- Make Categories global.
- Make `items` the global Item Master.
- Remove conceptual item-store ownership.

### Phase 3 — Inventory

- Create/refactor `store_inventory`.
- Migrate store quantities.
- Make FIFO store-aware.
- Make transactions store-aware.

### Phase 4 — Locations

- Validate store-owned locations.
- Implement store-filtered location APIs.
- Implement bin balances.
- Refactor bin cards.

### Phase 5 — Bin Transfer

- Live source-bin balances.
- Same-store enforcement.
- Location-ID based transfers.
- Atomic updates.

### Phase 6 — Goods Receipt

- Main Store-only external receiving.
- Review/evaluation/GRN workflow.
- Authorized posting.
- No premature stock changes.

### Phase 7 — Material Transfer

- Main Store source.
- Destination store.
- Dispatch.
- Destination receipt.
- Destination bin selection at receipt.

### Phase 8 — Other Stock Workflows

- Issue
- Returns
- Stock Taking
- Reconciliation
- Disposal
- Fixed Assets

### Phase 9 — Security

- Store assignment enforcement.
- Cross-store API protection.
- PAO permissions.
- Admin governance.
- Audit coverage.

### Phase 10 — Cleanup

- Remove obsolete columns.
- Clean `schema.sql`.
- Finalize migrations.
- Update reports and documentation.
- Run full regression tests.

---

## 44. Acceptance Criteria

The refactor is complete only when:

- [ ] One institution-wide Item Master
- [ ] Globally unique item codes
- [ ] Global Categories
- [ ] Store-level inventory
- [ ] Store-aware FIFO
- [ ] Store-specific locations
- [ ] Store-specific bins
- [ ] Store-specific bin dropdowns
- [ ] Live source-bin balances
- [ ] Same-store Bin Transfer
- [ ] Main Store-only external Goods Receipt
- [ ] Goods Receipt does not immediately change stock
- [ ] GRN workflow preserved
- [ ] Authorized stock posting
- [ ] Main Store → destination Material Transfer
- [ ] Destination Storekeeper receives transfer
- [ ] Destination bin selected at receipt
- [ ] Store assignments enforce authorization
- [ ] Stock Card remains consistent
- [ ] Bin Card remains consistent
- [ ] Stock ledger remains consistent
- [ ] Material Return preserved
- [ ] Stock Taking preserved
- [ ] Reconciliation preserved
- [ ] Disposal preserved
- [ ] PAO approval boundaries correct
- [ ] Administrator governance preserved
- [ ] Audit logging preserved
- [ ] Notifications preserved
- [ ] Reports updated
- [ ] Business Rules preserved
- [ ] Existing data migrated safely
- [ ] No destructive migration without verification
- [ ] No permanent duplicate Item Master architecture
- [ ] `schema.sql` represents final current schema
- [ ] Historical changes are represented by migrations
- [ ] `server.js` does not run schema migrations on startup
- [ ] No cross-store authorization bypass
- [ ] PostgreSQL connection pool remains healthy
- [ ] Frontend builds and runs
- [ ] Backend starts successfully
- [ ] Login works
- [ ] Major workflows pass end-to-end tests

---

## 45. Final Target Architecture

```text
                         UNIVERSITY
                             │
             ┌───────────────┴───────────────┐
             │                               │
       CATEGORIES                        ITEM MASTER
             │                               │
             └───────────────┬───────────────┘
                             │
                       ITEM DEFINITION
                             │
              ┌──────────────┼──────────────┐
              │              │              │
         MAIN STORE      LAB STORE      CAFE STORE
              │              │              │
       Store Inventory Store Inventory Store Inventory
              │              │              │
          Locations       Locations       Locations
              │              │              │
             Bins           Bins           Bins
```

External flow:

```text
Supplier
   ↓
Security
   ↓
Main Store
   ↓
Goods Receipt
   ↓
Store Head Review
   ↓
TEC
   ↓
GRN
   ↓
Authorized Posting
   ↓
Main Store Inventory
```

Internal distribution:

```text
Destination Store
       ↓
Requisition
       ↓
Main Store Approval
       ↓
Material Transfer
       ↓
Main Store Dispatch
       ↓
Destination Store Receive
       ↓
Destination Bin
       ↓
Destination Store Inventory
```

Bin movement:

```text
Same Store
    │
    ├── Source Bin
    │      ↓
    │   Quantity Check
    │      ↓
    └── Destination Bin

Store total remains unchanged.
```

---

## 46. Final Engineering Rules

1. Do not rewrite the application.
2. Do not create a permanent duplicate Item Master architecture.
3. Do not destroy existing data without backup and verification.
4. Do not trust frontend store IDs for authorization.
5. Do not allow external receiving outside Main Store.
6. Do not allow arbitrary bin selection.
7. Do not change stock merely because a document was created.
8. Do not allow direct quantity editing to bypass the stock ledger.
9. Keep store assignments as the authorization boundary.
10. Keep stock mutation logic centralized.
11. Keep FIFO store-aware.
12. Keep bin balances store-aware.
13. Keep audit history immutable.
14. Separate current schema from historical migrations.
15. Test every migration against a database copy before applying it to the main development database.

Final source-of-truth chain:

```text
Item Master
     ↓
Store Inventory
     ↓
Location/Bin Inventory
     ↓
Stock Transaction Ledger
     ↓
FIFO Lots
     ↓
Audit Trail
```
