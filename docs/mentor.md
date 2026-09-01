You are acting as a SENIOR BUSINESS ANALYST, SENIOR FRONTEND ARCHITECT,
UI/UX ENGINEER and ENTERPRISE STOCK MANAGEMENT SYSTEM DEVELOPER.

I already have an existing frontend-only Stock Management System project.



============================================================
1. PROJECT CONTEXT
============================================================

This is a university-style Stock Management System.

The system is designed for a university environment containing:

- Main Store
- Department Stores
- Engineering departments
- Applied sciences departments
- Pharmaceutical/laboratory-related departments
- Electrical and Computer Engineering
- Civil and Water Engineering
- Mechanical Engineering
- Chemical Engineering
- Other academic/administrative departments

The exact real institutional data is unknown.

Therefore:

USE REALISTIC DEMONSTRATION DATA.

Do not claim that the demo data represents actual institutional data.

Use realistic university stock-management examples such as:

- Laboratory equipment
- Electrical components
- Mechanical tools
- Chemical/laboratory materials
- Civil engineering materials
- Computer accessories
- Office supplies
- Safety equipment
- Spare parts
- Furniture
- Fixed assets
- Consumables

Use realistic Ethiopian-style currency where financial values are displayed,
but make all data clearly DEMO/MOCK data.

============================================================
2. CURRENT FRONTEND MUST BE PRESERVED
============================================================

The existing application already contains a working visual system.

The current design uses a professional enterprise dashboard style with:

- Left sidebar navigation
- Top header
- User/profile area
- Notification indicator
- Page title and description
- Primary action button
- Search controls
- Data tables
- Status badges
- Cards/statistics
- Modal/form patterns
- Pagination/table patterns
- Footer
- Role information
- Consistent spacing
- Consistent typography
- Existing color palette
- Existing icon system

PRESERVE ALL OF THESE.

Before modifying anything:

1. Inspect the entire source tree.
2. Identify the current routing architecture.
3. Identify reusable components.
4. Identify layout components.
5. Identify table components.
6. Identify form components.
7. Identify modal/dialog components.
8. Identify badge/status components.
9. Identify existing mock-data structures.
10. Identify current navigation structure.
11. Identify existing state-management approach.
12. Identify existing frontend conventions.

Reuse existing components wherever possible.

DO NOT duplicate components unnecessarily.

DO NOT create a second design system.

DO NOT introduce another CSS framework.

DO NOT migrate the project to another framework.

DO NOT change the existing stack unless absolutely required.

============================================================
3. PRIMARY OBJECTIVE
============================================================

Transform the current frontend from a collection of separate management
screens into a CONNECTED STOCK MANAGEMENT BUSINESS PROCESS.

Every major transaction must have a logical lifecycle.

For example:

GOODS RECEIPT
    ↓
TECHNICAL EVALUATION
    ↓
ACCEPT / REJECT
    ↓
GRN
    ↓
STOCK CARD UPDATE
    ↓
BIN CARD UPDATE
    ↓
AVAILABLE STOCK

Similarly:

STORE REQUISITION
    ↓
APPROVAL / REJECTION
    ↓
PRELIMINARY SIV / ISIV
    ↓
AMEND / APPROVE
    ↓
FINAL SIV / ISIV
    ↓
ISSUE MATERIAL
    ↓
STOCK CARD UPDATE
    ↓
BIN CARD UPDATE

RETURN:

ISSUED MATERIAL
    ↓
STORE RETURN REQUEST / SRN
    ↓
EVALUATION
    ↓
APPROVE / REJECT
    ↓
RETURN TO STOCK
    ↓
STOCK CARD UPDATE
    ↓
BIN CARD UPDATE

TRANSFER:

TRANSFER REQUEST
    ↓
APPROVAL / REJECTION
    ↓
SOURCE STORE DISPATCH
    ↓
DESTINATION STORE RECEIPT
    ↓
SOURCE STOCK DECREASE
    ↓
DESTINATION STOCK INCREASE
    ↓
BIN CARD UPDATE

DISPOSAL:

SHELF-LIFE / CONDITION MONITORING
    ↓
DISPOSAL FLAG
    ↓
DISPOSAL REQUEST
    ↓
APPROVAL
    ↓
DISPOSAL WORKFLOW
    ↓
STOCK REMOVAL
    ↓
AUDIT RECORD

The frontend must visually and logically demonstrate these relationships.

============================================================
4. MENTOR'S OFFICIAL OPERATIONAL USE CASES
============================================================

Implement the following mentor-defined use cases.

These are NOT independent pages.

They must be connected into operational workflows.

------------------------------------------------------------
UC-01 — MANAGE STORE INFORMATION
------------------------------------------------------------

Manage:

- Main Store
- Department Stores
- Other authorized stores

Each store should have:

- Store code
- Store name
- Store type
- Department/organizational unit
- Location
- Store head
- Contact information
- Status
- Description

Supported frontend operations:

- View
- Create
- Edit
- Activate
- Deactivate
- Search
- Filter
- View details

Store types may include:

- Main Store
- Department Store
- Specialized Store
- Laboratory Store
- Other Store

------------------------------------------------------------
UC-02 — MAINTAIN ITEM CATEGORIES
------------------------------------------------------------

Allow administrators/authorized users to manage categories.

Examples:

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

Each category should support:

- Category code
- Name
- Description
- Store applicability
- Active/inactive status

------------------------------------------------------------
UC-03 — MAINTAIN ITEM LOCATIONS
------------------------------------------------------------

Manage the physical location of materials.

Use a hierarchy such as:

Store
 → Section
 → Rack
 → Shelf
 → Bin

Example:

Main Store
 → Electrical Section
 → Rack E-03
 → Shelf 02
 → Bin E03-02-04

Allow users to:

- Create location
- Edit location
- Assign item to location
- Move item
- View occupied locations
- View available locations
- Search locations

------------------------------------------------------------
UC-04 — GOODS RECEIPT RECORD
------------------------------------------------------------

Create a goods receipt record for incoming materials.

Support:

- Purchase
- Donation
- Other approved source

Receipt information should include:

- Receipt reference
- Supplier/source
- Purchase/order reference
- Delivery date
- Store
- Received by
- Material
- Quantity
- Unit
- Condition
- Supporting document
- Fixed/non-fixed asset classification
- Notes
- Status

Possible statuses:

- Draft
- Submitted
- Pending Evaluation
- Under Evaluation
- Accepted
- Partially Accepted
- Rejected
- GRN Generated

Allow the Store Head to notify the Technical Evaluation Committee.

------------------------------------------------------------
UC-05 — EVALUATE MATERIALS FOR ACCEPTANCE
------------------------------------------------------------

Technical Evaluation Committee users must be able to:

- View pending receipts
- Inspect material
- Review specifications
- Record findings
- Approve
- Reject
- Partially approve
- Add remarks
- Attach evaluation information

Evaluation status:

- Pending
- Under Review
- Approved
- Rejected
- Partially Approved

After evaluation:

Receipt status must update.

Property Registration Officer should receive a notification when
material is accepted.

------------------------------------------------------------
UC-06 — GENERATE GOODS RECEIVING NOTE (GRN)
------------------------------------------------------------

For approved materials:

Generate a GRN / Model 19 representation.

The frontend should display:

- GRN number
- Date
- Store
- Supplier
- Source document
- Receipt reference
- Material lines
- Quantity
- Unit
- Unit price
- Total
- Acceptance status
- Store Head
- Technical Evaluation status
- Authorized personnel

Actions:

- View
- Print
- Export/download representation
- Generate GRN
- View linked receipt
- View evaluation

The GRN must be linked visually to the original Goods Receipt.

------------------------------------------------------------
UC-07 — AUTO-UPDATE STOCK CARD
------------------------------------------------------------

Stock Card must NOT be an isolated static page.

It must represent the material transaction history.

Whenever a relevant transaction occurs:

Receipt
Issue
Return
Transfer
Adjustment

the frontend mock state must demonstrate the stock balance changing.

Stock Card should display:

- Item
- Item code
- Store
- Date
- Transaction reference
- Transaction type
- Quantity In
- Quantity Out
- Balance
- Supporting document

Example transaction types:

GRN
SIV
ISIV
SRN
Transfer
Adjustment

------------------------------------------------------------
UC-08 — VIEW STOCK CARD
------------------------------------------------------------

Users can:

- Search item
- Filter by store
- Filter by date
- Filter by transaction
- View current quantity
- View transaction history
- View opening balance
- View closing balance

Provide a detailed Stock Card view.

------------------------------------------------------------
UC-09 — MANAGE BIN CARD
------------------------------------------------------------

Bin Cards must represent inventory at physical bin level.

A Bin Card should contain:

- Bin number
- Store
- Section
- Rack
- Shelf
- Item
- Item code
- Transaction date
- Transaction reference
- In
- Out
- Balance
- Location
- Supporting document

The system should demonstrate automatic balance calculation.

If a material enters a previously unused bin:

Create a Bin Card.

If material moves to another bin:

Create/update the appropriate Bin Card.

------------------------------------------------------------
UC-10 — STOCK TRANSFER BETWEEN BINS
------------------------------------------------------------

Allow authorized store users to move materials:

Bin A
    ↓
Bin B

Record:

- Item
- Quantity
- Source bin
- Destination bin
- Date
- User
- Reason
- Transfer reference

The UI should show:

Source balance decreases.

Destination balance increases.

Both bin histories are updated.

------------------------------------------------------------
UC-11 — MANAGE STORE REQUISITION
------------------------------------------------------------

Departments request materials from stores.

Store Requisition should include:

- Requisition number
- Requesting department
- Requester
- Store
- Date
- Required date
- Priority
- Items
- Quantity requested
- Purpose
- Remarks
- Status

Statuses:

- Draft
- Submitted
- Pending Approval
- Approved
- Rejected
- Partially Approved
- Fulfilled
- Cancelled

------------------------------------------------------------
UC-12 — APPROVE / REJECT STORE REQUISITION
------------------------------------------------------------

Authorized approvers should be able to:

- Review requisition
- Review requested quantities
- Check stock availability
- Approve
- Reject
- Partially approve
- Add comments

Approval history must be visible.

------------------------------------------------------------
UC-13 — CREATE PRELIMINARY SIV / ISIV
------------------------------------------------------------

After approved requisition:

Create preliminary:

- SIV
- ISIV

Model 20 representation.

Show:

- Voucher number
- Requisition
- Store
- Requesting department
- Items
- Requested quantity
- Approved quantity
- Issued quantity
- Status

------------------------------------------------------------
UC-14 — APPROVE AND AMEND SIV / ISIV
------------------------------------------------------------

Authorized personnel must be able to:

- Review voucher
- Amend quantities
- Add/remove eligible lines
- Approve
- Reject
- Return for correction

Maintain amendment history.

Do not silently overwrite previous values.

------------------------------------------------------------
UC-15 — GENERATE FINAL SIV / ISIV
------------------------------------------------------------

After approval:

Generate final voucher representation.

Show:

- Voucher number
- Type
- Department
- Store
- Items
- Quantities
- Authorized personnel
- Date
- Reference requisition

Actions:

- View
- Print
- Export/download representation

After issue:

Update mock inventory state.

------------------------------------------------------------
UC-16 — MANAGE FIXED ASSET REGISTRATION
------------------------------------------------------------

For materials classified as fixed assets:

Create asset records.

Fields:

- Asset tag
- Asset name
- Category
- Serial number
- Acquisition date
- Acquisition value
- Source
- Store
- Assigned department
- Assigned person/location
- Condition
- Status

Statuses:

- Registered
- In Store
- Assigned
- In Use
- Under Maintenance
- Lost
- Damaged
- Disposed

------------------------------------------------------------
UC-17 — MANAGE USER-CARD
------------------------------------------------------------

Create and manage user/material responsibility cards.

A User Card may track materials/assets assigned to a person.

Show:

- User
- Department
- Position
- Assigned item
- Asset tag/item code
- Quantity
- Date issued
- Return date
- Condition
- Status
- Supporting voucher

Provide:

- Issue
- Return
- View history
- Print/view card

------------------------------------------------------------
UC-18 — CREATE MATERIAL RETURN REQUEST / SRN
------------------------------------------------------------

Allow departments/users to return materials.

Store Return Note:

SRN

Include:

- SRN reference
- Department
- Requester
- Material
- Quantity
- Reason
- Condition
- Original issue reference
- Return date
- Status

Statuses:

- Draft
- Submitted
- Pending Review
- Approved
- Rejected
- Returned to Stock

------------------------------------------------------------
UC-19 — RECORD TECHNICAL EVALUATION RESULT
------------------------------------------------------------

For returned/damaged/questionable materials:

Record technical evaluation.

Possible result:

- Good / reusable
- Repair required
- Damaged
- Obsolete
- Scrap
- Return to stock
- Recommend disposal

Record:

- Evaluator
- Date
- Findings
- Recommendation
- Remarks
- Status

------------------------------------------------------------
UC-20 — APPROVE / REJECT STORE RETURN
------------------------------------------------------------

Authorized personnel review SRN.

Actions:

- Approve
- Reject
- Request clarification

If approved:

Material is returned to appropriate inventory/bin.

Stock Card and Bin Card must reflect the return.

------------------------------------------------------------
UC-21 — INITIATE MATERIAL TRANSFER REQUEST
------------------------------------------------------------

Allow transfer requests between stores.

Example:

Main Store
→ Electrical Engineering Store

or:

Mechanical Engineering Store
→ Chemical Engineering Store

Request fields:

- Transfer reference
- Source store
- Destination store
- Requested by
- Item
- Quantity
- Reason
- Date
- Priority

------------------------------------------------------------
UC-22 — APPROVE / REJECT MATERIAL TRANSFER
------------------------------------------------------------

Authorized users review transfer.

Actions:

- Approve
- Reject
- Partially approve
- Request amendment

Show approval history.

After approval:

Transfer becomes eligible for dispatch.

------------------------------------------------------------
UC-23 — AUTO-MONITOR SHELF LIFE AND STATUS
------------------------------------------------------------

The frontend must demonstrate monitoring.

For applicable materials show:

- Expiry date
- Days remaining
- Batch
- Condition
- Shelf-life status

Status examples:

- Normal
- Expiring Soon
- Expired
- Damaged
- Obsolete
- Quarantine

Dashboard should show alerts.

Examples:

"5 items expiring within 30 days"

"3 expired materials"

"2 damaged materials"

------------------------------------------------------------
UC-24 — FLAG ITEMS FOR DISPOSAL
------------------------------------------------------------

Authorized personnel can flag items.

Reasons:

- Expired
- Obsolete
- Damaged
- Beyond economical repair
- Unsafe
- Unusable

Show:

- Disposal reference
- Item
- Quantity
- Store
- Reason
- Date flagged
- Flagged by
- Status

------------------------------------------------------------
UC-25 — MANAGE DISPOSAL REQUEST
------------------------------------------------------------

Create disposal requests from flagged materials.

Include:

- Disposal request number
- Item
- Quantity
- Reason
- Supporting information
- Requested by
- Date
- Status

Statuses:

- Draft
- Submitted
- Under Review
- Approved
- Rejected
- Completed

------------------------------------------------------------
UC-26 — MANAGE DISPOSAL WORKFLOW
------------------------------------------------------------

Represent the full disposal lifecycle:

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
Inventory Removal
 ↓
Audit Record

Do not simply change the status manually without showing the workflow.

============================================================
5. ADDITIONAL NECESSARY OPERATIONAL USE CASES
============================================================

Where necessary, introduce supporting use cases required to make the
mentor's workflows complete.

Examples:

- Login / Authentication
- Role Management
- Notification Management
- Dashboard Monitoring
- Inventory Search
- Inventory Adjustment
- Stock Reconciliation
- Physical Stock Taking
- Supplier Management
- Report Management
- Audit Trail
- Document/Reference Management
- Approval History
- Transaction History

Do NOT add random features.

Only add supporting functionality that logically belongs to the
stock-management workflow.

============================================================
6. ROLE-BASED FRONTEND BEHAVIOR
============================================================

The frontend must demonstrate role-based access.

Create realistic demo roles such as:

1. Administrator
2. Store Head
3. Storekeeper
4. Stock Clerk
5. Property Administration Officer
6. Technical Evaluation Committee Member
7. Department Head
8. Department Requester
9. Asset/Property Officer
10. Auditor / Security Officer

Each role should see appropriate actions.

Example:

STOREKEEPER:
- Goods Receipt
- Stock Cards
- Bin Cards
- Issues
- Returns
- Transfers

STORE HEAD:
- Goods Receipt approval workflow
- Requisitions
- SIV/ISIV
- Transfers
- Returns
- Stock monitoring

TEC MEMBER:
- Technical Evaluation
- Acceptance decisions
- Evaluation history

DEPARTMENT HEAD:
- Store Requisitions
- Approvals
- Material transfers
- Returns

PROPERTY OFFICER:
- GRN
- Fixed Assets
- User Cards
- Asset registration

ADMINISTRATOR:
- Users
- Roles
- Stores
- Categories
- Locations
- System configuration
- Audit log

AUDITOR:
- Reports
- Audit Log
- Transaction history
- Approval history

IMPORTANT:

This is frontend-only.

Therefore role-based access may be simulated through frontend mock
authentication/state.

Do NOT pretend this is secure backend authorization.

============================================================
7. CONNECT THE EXISTING SIDEBAR
============================================================

Do not destroy the existing sidebar.

Improve it only where necessary.

Organize the navigation logically.

Recommended structure:

DASHBOARD

INVENTORY SETUP
  - Stores
  - Item Categories
  - Items & Locations

STOCK RECEIVING
  - Goods Receipt (GRN)
  - Technical Evaluation
  - GRN Documents

STOCK RECORDS
  - Stock Cards
  - Bin Cards
  - Stock Transfer Between Bins
  - Inventory Monitoring

REQUISITIONS & ISSUES
  - Store Requisitions
  - Issue Vouchers (SIV / ISIV)

RETURNS & TRANSFERS
  - Material Returns (SRN)
  - Material Transfers
  - Transfer Approvals

ASSETS & DISPOSAL
  - Fixed Assets
  - User Cards
  - Disposal Management

REPORTS

ADMINISTRATION
  - Users
  - Roles
  - Audit Log
  - Settings

Only change the navigation where needed to expose mentor-required
functionality.

============================================================
8. WORKFLOW LINKING
============================================================

THIS IS ONE OF THE MOST IMPORTANT REQUIREMENTS.

Every related record must be clickable and traceable.

Example:

GRN-2026-0001

should allow:

GRN
 → Goods Receipt
 → Technical Evaluation
 → Stock Card
 → Bin Card

Similarly:

SR-2026-0040
 → Approval
 → SIV-2026-0011
 → Stock Card
 → Bin Card

Similarly:

SRN-2026-0011
 → Technical Evaluation
 → Return Approval
 → Stock Card
 → Bin Card

Similarly:

TRF-2026-0007
 → Transfer Approval
 → Source Store
 → Destination Store
 → Stock Cards
 → Bin Cards

Similarly:

DSP-2026-0003
 → Disposal Request
 → Approval
 → Disposal Execution
 → Inventory adjustment
 → Audit Log

Use clickable references, detail drawers, modals or detail pages while
preserving the current UI pattern.

============================================================
9. STATUS WORKFLOW ENGINE
============================================================

Do not use arbitrary statuses.

Define controlled status transitions.

Example:

Goods Receipt:

DRAFT
→ SUBMITTED
→ PENDING_EVALUATION
→ UNDER_EVALUATION
→ ACCEPTED / REJECTED
→ GRN_GENERATED

Requisition:

DRAFT
→ SUBMITTED
→ PENDING_APPROVAL
→ APPROVED / REJECTED
→ FULFILLED

SIV:

DRAFT
→ PRELIMINARY
→ PENDING_APPROVAL
→ AMENDMENT_REQUIRED
→ APPROVED
→ ISSUED

Transfer:

DRAFT
→ SUBMITTED
→ PENDING_APPROVAL
→ APPROVED
→ DISPATCHED
→ RECEIVED
→ COMPLETED

Return:

DRAFT
→ SUBMITTED
→ UNDER_REVIEW
→ EVALUATION
→ APPROVED / REJECTED
→ RETURNED_TO_STOCK

Disposal:

FLAGGED
→ REQUESTED
→ UNDER_REVIEW
→ APPROVED
→ EXECUTED
→ COMPLETED

The UI should prevent impossible transitions.

For example:

A rejected requisition should not directly generate a final SIV.

A receipt awaiting technical evaluation should not generate a final GRN.

A pending transfer should not immediately reduce stock.

============================================================
10. REALISTIC MOCK DATA
============================================================

Create a centralized mock-data layer.

Do not scatter hardcoded records throughout components.

Create realistic demo records.

Example stores:

- Main Store
- Electrical Engineering Department Store
- Mechanical Engineering Department Store
- Chemical Engineering Department Store
- Civil and Water Engineering Department Store
- Applied Sciences Department Store
- Pharmaceutical/Laboratory Store
- Computing Laboratory Store

Example items:

- A4 Photocopy Paper
- Digital Multimeter
- Arduino Uno R3
- Oscilloscope
- HP LaserJet Printer
- Laboratory Glassware
- PPE Safety Gloves
- Chemical Storage Container
- Welding Electrode
- Ballpoint Pen
- Network Switch
- Desktop Computer
- Electrical Cable
- Mechanical Bearing
- Steel Measuring Tape
- Laboratory Balance

Use realistic quantities and prices.

Create enough records to demonstrate:

- Empty state
- Normal state
- Low stock
- Pending approval
- Approved
- Rejected
- Expiring
- Expired
- Damaged
- Disposal pending
- Completed transactions

============================================================
11. DASHBOARD
============================================================

Improve the existing dashboard without redesigning it.

Display useful operational KPIs:

- Total Items
- Total Stores
- Total Stock Value
- Low Stock Items
- Pending Requisitions
- Pending Goods Receipts
- Pending Evaluations
- Pending Transfers
- Pending Returns
- Expiring Items
- Disposal Pending
- Fixed Assets

Include recent activity.

Examples:

"GRN-2026-0001 generated"

"Store Requisition SR-2026-0040 approved"

"Transfer TRF-2026-0007 approved"

"3 items approaching expiry"

"Disposal request DSP-2026-0003 pending approval"

============================================================
12. NOTIFICATIONS
============================================================

Use the existing notification UI.

Generate realistic notifications based on workflow state.

Examples:

- New goods receipt awaiting evaluation
- Requisition awaiting approval
- Transfer awaiting approval
- Material return awaiting review
- Item approaching expiry
- Item below reorder level
- Disposal request awaiting approval
- GRN generated
- SIV ready for approval

Notifications should link to the relevant module.

============================================================
13. AUDIT LOG
============================================================

Preserve the existing Audit Log page.

Expand it to show meaningful operational activity.

Columns:

- Timestamp
- User
- Role
- Module
- Action
- Reference
- Previous Status
- New Status

Examples:

Storekeeper
Created GRN-2026-0001

TEC Member
Approved technical evaluation for GRN-2026-0001

Store Head
Approved SR-2026-0040

Property Officer
Registered asset FA-2026-0102

Storekeeper
Issued SIV-2026-0011

Administrator
Created user account

The audit trail should demonstrate that important workflow transitions
are traceable.

============================================================
14. REPORTS
============================================================

Preserve the current Reports design.

Provide frontend report views such as:

- Inventory Summary
- Stock Balance Report
- Stock Card Report
- Bin Card Report
- Goods Receipt Report
- GRN Report
- Issue Voucher Report
- Requisition Report
- Return Report
- Transfer Report
- Fixed Asset Report
- Disposal Report
- Low Stock Report
- Expiry Report
- Transaction History Report

Support:

- Search
- Filter
- Date range
- Store filter
- Department filter
- Item filter
- Status filter
- Print-friendly view
- CSV-style export simulation if already supported

============================================================
15. FORMS AND VALIDATION
============================================================

Every important action must use proper forms.

Do not allow obviously invalid data.

Examples:

Quantity must be greater than zero.

Transfer quantity cannot exceed available source quantity.

Issue quantity cannot exceed available stock.

Required fields cannot be empty.

Expiry date must be logically valid.

A disposal quantity cannot exceed available quantity.

A GRN cannot be generated before acceptance.

A final SIV cannot be generated before approval.

Use the project's existing validation/UI patterns.

============================================================
16. MODALS / DETAIL VIEWS
============================================================

Use the existing UI pattern.

When a user clicks:

View
Edit
Approve
Reject
Generate
Evaluate
Transfer
Return
Dispose

show an appropriate modal, drawer or detail view.

Do not create unnecessary new page types.

Keep interaction consistent with the current application.

============================================================
17. FRONTEND STATE
============================================================

Because this implementation is frontend-only:

Create a clean mock state architecture.

Actions should visibly update the application.

Example:

Approve Requisition
→ status changes to APPROVED

Generate SIV
→ SIV appears in Issue Vouchers

Issue SIV
→ stock quantity decreases

Stock Card
→ new OUT transaction appears

Bin Card
→ new OUT transaction appears

Approve SRN
→ stock quantity increases

Transfer
→ source quantity decreases
→ destination quantity increases

Dispose
→ available quantity decreases
→ disposal transaction appears
→ audit event appears

The user should be able to demonstrate the entire business process
without a backend.

Use local state/context/localStorage or the project's existing state
architecture as appropriate.

Do not add a backend.

============================================================
18. DATA RELATIONSHIPS
============================================================

Create frontend mock relationships between entities.

Example:

Store
  ├── Items
  ├── Locations
  ├── Bins
  ├── Stock Cards
  └── Bin Cards

Goods Receipt
  ├── Receipt Items
  ├── Technical Evaluation
  └── GRN

GRN
  ├── Stock Card Transaction
  └── Bin Card Transaction

Requisition
  └── SIV/ISIV

SIV/ISIV
  ├── Stock Card Transaction
  └── Bin Card Transaction

SRN
  ├── Evaluation
  └── Stock Return Transaction

Transfer
  ├── Source Store
  ├── Destination Store
  ├── Source Bin
  └── Destination Bin

Fixed Asset
  └── User Card / Assignment

Disposal
  ├── Flag
  ├── Request
  ├── Approval
  └── Execution

============================================================
19. UI QUALITY REQUIREMENTS
============================================================

The final system must look like ONE professionally designed application.

DO NOT create:

- random colors
- inconsistent buttons
- different table designs
- different typography
- different modal styles
- inconsistent spacing
- unnecessary animations
- oversized cards
- unrelated dashboards
- unrelated icons

Maintain the existing visual language.

When a new page is necessary:

COPY THE EXISTING DESIGN PATTERN.

For example, if the current list pages use:

Page Title
Description
Primary Action
Search
Table
Status Badge
Actions

then new pages must follow that pattern.

============================================================
20. RESPONSIVENESS
============================================================

Do not break the current desktop layout.

Also ensure that:

- tables can scroll horizontally
- sidebar remains usable
- forms adapt to screen size
- modals remain usable
- cards wrap correctly

Do not redesign the desktop interface just to achieve responsiveness.

============================================================
21. ACCESSIBILITY
============================================================

Use:

- meaningful button labels
- accessible form labels
- keyboard-friendly controls
- appropriate contrast
- clear status indicators
- confirmation before destructive operations

Do not rely on color alone to communicate status.

============================================================
22. DESTRUCTIVE ACTIONS
============================================================

For:

- Delete
- Reject
- Dispose
- Cancel
- Remove

use confirmation dialogs.

Show clear consequences.

Example:

"Are you sure you want to reject this Store Requisition?
This action will prevent it from generating an issue voucher."

============================================================
23. DO NOT FAKE BACKEND FEATURES
============================================================

This is a FRONTEND implementation.

Do not create fake API calls pretending a real backend exists.

If API integration is not present:

Use mock services/data.

Clearly structure the code so that a future backend can replace the
mock service layer.

Example:

services/
  mock/
    storeService
    itemService
    receiptService
    requisitionService
    issueService
    transferService
    returnService
    assetService
    disposalService

The UI should not need to be completely rewritten when the backend
is later connected.

============================================================
24. CODE QUALITY
============================================================

Before modifying code:

UNDERSTAND the existing architecture.

Then:

- Reuse components
- Avoid duplication
- Keep modules organized
- Use meaningful names
- Keep business logic separate from UI where practical
- Centralize mock data
- Centralize status definitions
- Centralize role definitions
- Centralize navigation configuration
- Keep forms maintainable
- Keep tables reusable

Do not create giant monolithic components.

============================================================
25. IMPLEMENTATION ORDER
============================================================

Do NOT implement everything randomly.

Implement in this order:

PHASE 1 — FOUNDATION

1. Inspect existing codebase.
2. Identify existing pages/components.
3. Identify existing navigation.
4. Identify existing mock state/data.
5. Identify reusable components.
6. Create/organize shared domain types/constants if appropriate.

PHASE 2 — INVENTORY SETUP

7. Stores
8. Item Categories
9. Items & Locations
10. Bin/location management

PHASE 3 — RECEIVING

11. Goods Receipt
12. Technical Evaluation
13. Acceptance/Rejection
14. GRN generation
15. Stock Card integration
16. Bin Card integration

PHASE 4 — ISSUE PROCESS

17. Store Requisition
18. Requisition approval
19. Preliminary SIV/ISIV
20. SIV/ISIV amendment
21. SIV/ISIV approval
22. Final voucher
23. Stock update
24. Bin update

PHASE 5 — RETURNS

25. SRN
26. Technical evaluation
27. Return approval
28. Return to stock
29. Stock Card update
30. Bin Card update

PHASE 6 — TRANSFERS

31. Transfer request
32. Transfer approval
33. Bin-to-bin transfer
34. Store-to-store transfer
35. Dispatch
36. Receive
37. Stock synchronization

PHASE 7 — ASSETS

38. Fixed Assets
39. User Cards
40. Asset assignment
41. Asset history

PHASE 8 — MONITORING

42. Shelf-life monitoring
43. Expiry alerts
44. Low-stock alerts
45. Damaged/obsolete monitoring

PHASE 9 — DISPOSAL

46. Disposal flag
47. Disposal request
48. Disposal approval
49. Disposal execution
50. Inventory removal
51. Audit trail

PHASE 10 — ADMINISTRATION

52. Users
53. Roles
54. Notifications
55. Audit Log
56. Settings

PHASE 11 — REPORTING

57. Inventory reports
58. Transaction reports
59. Stock reports
60. Asset reports
61. Disposal reports

PHASE 12 — FINAL INTEGRATION

62. Dashboard
63. Notifications
64. Cross-module navigation
65. Workflow validation
66. Demo data consistency
67. Empty states
68. Loading states
69. Error states
70. Final UI consistency review

============================================================
26. IMPORTANT: DO NOT MODIFY EXISTING STYLING
============================================================

This is a HARD REQUIREMENT.

Before adding or modifying a page, inspect an existing page that has the
same pattern.

For example:

New approval page
→ copy the design language of existing table pages.

New detail page
→ copy the existing detail/modal pattern.

New form
→ copy existing form components.

New report
→ copy existing Reports page.

New workflow
→ use existing badges/buttons/modals.

DO NOT redesign.

DO NOT replace Tailwind/Bootstrap/custom CSS with another styling system.

DO NOT change the global theme.

============================================================
27. DEMO SCENARIO
============================================================

The finished application must support a complete demonstration scenario.

SCENARIO:

1. A department requests Digital Multimeters.

2. Department creates:
   SR-2026-0040

3. Store Head reviews and approves it.

4. System creates:
   SIV-2026-0011

5. Storekeeper prepares the issue.

6. Storekeeper issues the materials.

7. Inventory decreases.

8. Stock Card records OUT transaction.

9. Bin Card records OUT transaction.

10. Later, two unused multimeters are returned.

11. Department creates:
    SRN-2026-0011

12. Return is evaluated.

13. Return is approved.

14. Inventory increases.

15. Stock Card records RETURN.

16. Bin Card records IN transaction.

17. Another department requests material transfer.

18. Transfer is approved.

19. Source store quantity decreases.

20. Destination store quantity increases.

21. Dashboard reflects updated quantities.

22. Audit Log records all important actions.

This complete demonstration must work using frontend mock state.

============================================================
28. ACCEPTANCE CRITERIA
============================================================

The implementation is considered successful only if:

1. Existing UI style remains intact.

2. Existing pages continue working.

3. Mentor's 26 use cases are represented.

4. Use cases are connected into workflows.

5. Status transitions are logical.

6. Roles influence available actions.

7. Mock data is realistic.

8. Transactions visibly affect stock.

9. Stock Cards reflect transactions.

10. Bin Cards reflect transactions.

11. GRNs are connected to receipts/evaluations.

12. SIVs are connected to requisitions.

13. SRNs are connected to returns/evaluations.

14. Transfers are connected to source/destination stores.

15. Fixed assets can be registered and assigned.

16. User Cards can show assigned materials/assets.

17. Shelf-life alerts are visible.

18. Disposal has a complete workflow.

19. Notifications correspond to pending actions.

20. Audit Log records important actions.

21. Reports reflect mock data.

22. Search/filter functionality remains consistent.

23. Forms contain validation.

24. Destructive actions require confirmation.

25. No backend is required.

26. No fake API implementation is introduced.

27. The application remains maintainable.

28. The entire frontend can be demonstrated as one coherent
    university stock-management system.

============================================================
29. HOW YOU MUST WORK
============================================================

DO NOT immediately generate hundreds of files.

First:

STEP 1:
Analyze the existing project.

STEP 2:
Produce a concise implementation map showing:

- Existing pages
- Existing components
- Existing routes
- Existing reusable components
- Existing mock data
- Missing mentor functionality
- Components that can be reused
- Components that need extension
- New components actually required

STEP 3:
Identify conflicts between existing implementation and mentor workflows.

STEP 4:
Create a phased implementation plan.

STEP 5:
Implement one coherent module/workflow at a time.

STEP 6:
After each major workflow, verify that existing pages have not been
visually or functionally broken.

STEP 7:
Run the application and check all routes.

STEP 8:
Fix errors.

STEP 9:
Perform a final workflow consistency review.

IMPORTANT:

Do not stop after creating pages.

The objective is not the NUMBER OF PAGES.

The objective is a CONNECTED OPERATIONAL STOCK MANAGEMENT FRONTEND.

============================================================
30. FINAL BUSINESS-ANALYST RULE
============================================================

When a requirement is ambiguous, do not randomly invent behavior.

Use standard university/institutional stock-management business logic.

Prefer:

- clear approval stages
- traceability
- separation of duties
- transaction history
- document references
- stock integrity
- auditability
- controlled status transitions
- realistic operational workflows

If clarification is genuinely required, document the assumption in code
comments or an implementation-notes file rather than silently implementing
contradictory behavior.

The mentor explicitly stated that adjustments and clarification may be
required during implementation.

Therefore the architecture must remain flexible enough to accommodate
reasonable business-rule changes later.

FINAL INSTRUCTION:

START BY ANALYZING MY EXISTING FRONTEND.

DO NOT START CODING YET.

FIRST SHOW ME:

A. Existing frontend modules discovered
B. Existing routes discovered
C. Existing reusable components discovered
D. Existing mentor use cases already covered
E. Mentor use cases partially covered
F. Mentor use cases missing
G. Required workflow connections
H. Proposed implementation order

Then wait for implementation approval before making large structural
changes.




### Actors Roles Clearly

You are acting as a senior Business Analyst, System Architect, UX Engineer, and Frontend Engineer.

I already have a working frontend for a University Stock Management System.

IMPORTANT:
DO NOT rebuild the project from scratch.
DO NOT replace the existing UI design.
DO NOT change the existing color palette, typography, layout, sidebar style, cards, tables, modals, buttons, spacing, responsiveness, or overall visual identity unless a change is absolutely required for correctness.

Your task is to AUDIT the existing frontend and correctly implement the operational actors, role-based access control, dashboards, navigation, actions, and workflows.

==================================================
1. BUSINESS CONTEXT
==================================================

This is a realistic university Stock Management System similar to the operational environment of a large Ethiopian university.

The system manages:

- Stores
- Items
- Categories
- Locations
- Bins
- Goods receiving
- Technical evaluation
- Goods Receiving Notes (GRN)
- Stock Cards
- Bin Cards
- Store Requisitions
- Store Issue Vouchers (SIV)
- Inter-Store Issue Vouchers (ISIV)
- Fixed Assets
- User Cards
- Material Returns / Store Return Notes (SRN)
- Material Transfers
- Shelf-life monitoring
- Disposal
- Reports
- Audit activities

The system must follow realistic separation of duties.

Do not treat this as a generic CRUD application where every user can edit everything.

==================================================
2. AUTHORITATIVE OPERATIONAL ACTORS
==================================================

The system must use exactly these 9 operational roles unless your audit proves that a tiny correction is necessary:

1. Administrator
2. Property Administration Officer (PAO)
3. Store Head
4. Storekeeper
5. Stock Clerk
6. Technical Evaluation Committee (TEC)
7. Department Head
8. Accountant
9. Security Officer

Do NOT create separate roles for individual schools/departments.

For example:

- School of Electrical Engineering and Computing
- School of Civil Engineering and Water Engineering
- School of Mechanical Engineering
- School of Chemical Engineering
- School of Applied Sciences
- Pharmacy
- Laboratories

should be represented as departments/organizational units under the single:

Department Head

role.

==================================================
3. ROLE RESPONSIBILITIES
==================================================

ADMINISTRATOR
----------------
System administration.

Allowed:
- Manage users
- Activate/deactivate users
- Assign roles
- Manage system configuration
- Manage stores
- Manage categories
- Manage units
- Manage locations
- View system-wide information
- View audit logs
- Manage system settings

Should NOT normally perform operational transactions such as:
- Goods receiving
- Technical evaluation
- Stock issuing
- Requisition approval
- Physical stock movement
- Disposal execution

Preserve separation of duties.

--------------------------------------------------

PROPERTY ADMINISTRATION OFFICER (PAO)
--------------------------------------------------

Responsible for property administration and fixed assets.

Allowed:
- View accepted goods receipts
- Review GRN information
- Manage fixed asset registration
- Register fixed assets
- Generate/assign asset identification
- Manage asset assignments
- View asset history
- Manage property records
- Monitor asset movements
- Participate in disposal/property workflow
- Generate property reports
- View inventory/property valuation information

Should NOT perform TEC technical evaluation.

--------------------------------------------------

STORE HEAD
--------------------------------------------------

Overall operational store supervisor.

Allowed:
- Manage/oversee store operations
- Review goods receipts
- Submit/coordinate materials for TEC evaluation
- Monitor technical evaluation
- Approve/reject requisitions according to workflow
- Approve/amend SIV/ISIV
- Approve/reject store returns
- Approve/reject material transfers
- Review stock cards and bin cards
- Monitor stock levels
- Review disposal requests
- Approve disposal workflow
- Monitor shelf-life alerts
- View operational reports

The Store Head should have one of the broadest operational dashboards.

--------------------------------------------------

STOREKEEPER
--------------------------------------------------

Responsible for physical store operations.

Allowed:
- Record goods receipts
- Verify received quantities
- Record receiving documents
- Assign materials to locations/bins
- Prepare materials for storage
- Process approved requisitions
- Create preliminary SIV/ISIV
- Process material issues
- Receive returned materials
- Process SRN operationally
- Prepare material transfers
- Dispatch materials
- Receive transferred materials
- View stock cards
- View bin cards
- Monitor physical stock
- Flag damaged/obsolete materials

The Storekeeper should NOT:
- Perform TEC evaluation
- Approve their own transactions
- Approve their own requisitions/SIVs
- Modify historical transactions directly

--------------------------------------------------

STOCK CLERK
--------------------------------------------------

Responsible for inventory records and stock transaction accuracy.

Allowed:
- View/manage stock cards
- View/manage bin cards
- Record inventory transactions where appropriate
- Monitor stock balances
- Maintain stock records
- Track material locations
- Monitor stock discrepancies
- View receipts
- View issues
- View returns
- View transfers
- Assist with stock-taking
- Generate stock reports

The system should automatically update stock balances whenever valid transactions occur.

--------------------------------------------------

TECHNICAL EVALUATION COMMITTEE (TEC)
--------------------------------------------------

Responsible ONLY for technical evaluation of received materials.

Allowed:
- View materials awaiting evaluation
- Inspect material information
- Review specifications/documents
- Record technical evaluation
- Approve/accept material
- Reject material
- Add technical remarks
- View evaluation history

TEC should NOT:
- Issue stock
- Approve requisitions
- Create SIV
- Change inventory balances
- Register fixed assets

--------------------------------------------------

DEPARTMENT HEAD
--------------------------------------------------

Responsible for departmental material requests and department-level operations.

Allowed:
- View department information
- Create store requisition
- Edit draft requisition
- Submit requisition
- Track requisition
- Cancel eligible requisition
- Review department issued materials
- Create material return request/SRN
- Track returns
- Initiate material transfer request
- Track transfer requests
- View department stock information where applicable

Department Head permissions must be scoped to their department wherever appropriate.

--------------------------------------------------

ACCOUNTANT
--------------------------------------------------

Responsible for financial/valuation visibility.

Allowed:
- View inventory values
- View stock valuation
- View acquisition values
- View fixed asset values
- View disposal values
- View financial inventory reports
- Export financial reports where permitted

Accountant should generally be READ-ONLY regarding physical inventory transactions.

Do NOT allow Accountant to:
- Issue stock
- Receive physical goods
- Modify stock quantities
- Perform technical evaluation
- Approve operational stock transactions unless explicitly required by an established workflow.

--------------------------------------------------

SECURITY OFFICER
--------------------------------------------------

Responsible for physical movement verification.

Allowed:
- View approved SIV/ISIV
- Verify outgoing materials
- Verify incoming transfers
- Verify asset movement
- Record gate-out verification
- Record gate-in verification
- Record security verification
- View security movement history

Security Officer should NOT:
- Create inventory transactions
- Modify stock balances
- Approve requisitions
- Perform technical evaluation
- Register assets
- Modify SIV quantities

==================================================
4. MENTOR'S OPERATIONAL USE CASES
==================================================

The frontend must support the following use cases:

1. Manage Store Information
2. Maintain Item Category
3. Maintain Item Location
4. Goods Receipt Record
5. Evaluate Materials for Acceptance
6. Generate Goods Receiving Note (GRN)
7. Auto-Update Stock Card
8. View Stock Card
9. Manage Bin Card
10. Stock Transfer Between Bins
11. Manage Store Requisition
12. Approve/Reject Store Requisition
13. Create Preliminary SIV/ISIV
14. Approve and Amend SIV/ISIV
15. Generate SIV/ISIV
16. Manage Fixed Assets Registration
17. Manage User-Card
18. Create Material Return Request / SRN
19. Record Technical Evaluation Result
20. Approve/Reject Store Return
21. Initiate Material Transfer Request
22. Approve/Reject Material Transfer
23. Auto-Monitor Shelf Life and Status
24. Flag Items for Disposal
25. Manage Disposal Request
26. Manage Disposal Workflow

Also identify supporting operational functionality required for these workflows.

Do not remove existing useful functionality simply because it was not explicitly listed above.

==================================================
5. WORKFLOW RULE
==================================================

The frontend must represent workflows, not just CRUD.

For example:

GOODS RECEIVING:

Receive material
    ↓
Record receipt
    ↓
Submit for evaluation
    ↓
TEC evaluates
    ↓
Accepted / Rejected
    ↓
If accepted
    ↓
Generate GRN
    ↓
Update stock records
    ↓
Update Stock Card
    ↓
Update Bin Card

Do NOT allow a user to arbitrarily select "Accepted" from a normal dropdown if that decision belongs to TEC.

--------------------------------------------------

REQUISITION:

Draft
 ↓
Submitted
 ↓
Review
 ↓
Approved / Rejected
 ↓
Approved
 ↓
Store prepares issue
 ↓
SIV/ISIV
 ↓
Issue
 ↓
Stock automatically updated

--------------------------------------------------

TRANSFER:

Draft
 ↓
Submitted
 ↓
Pending Approval
 ↓
Approved / Rejected
 ↓
Dispatched
 ↓
Received
 ↓
Completed

--------------------------------------------------

RETURN:

Draft
 ↓
Submitted
 ↓
Pending Review
 ↓
Approved / Rejected
 ↓
Returned to Stock

--------------------------------------------------

DISPOSAL:

Flagged
 ↓
Requested
 ↓
Pending Review
 ↓
Approved / Rejected
 ↓
Executed
 ↓
Completed

==================================================
6. ROLE-BASED DASHBOARDS
==================================================

Audit the current dashboards and ensure every role sees information relevant to their responsibility.

Administrator:
- Users
- Roles
- System configuration
- Stores
- Audit
- System-wide summary

PAO:
- Accepted receipts
- GRNs
- Fixed assets
- Asset assignments
- Asset movements
- Disposal/property information

Store Head:
- Overall stock
- Pending receipts
- Pending evaluations
- Requisitions
- SIVs
- Returns
- Transfers
- Disposal
- Alerts
- Reports

Storekeeper:
- Receipts
- Storage
- Issues
- Returns
- Transfers
- Physical stock
- Pending operational tasks

Stock Clerk:
- Stock cards
- Bin cards
- Inventory transactions
- Locations
- Stock discrepancies
- Stock reports

TEC:
- Pending evaluations
- Under evaluation
- Accepted
- Rejected
- Evaluation history

Department Head:
- Department requisitions
- Requisition status
- Issued materials
- Returns
- Transfers

Accountant:
- Inventory valuation
- Asset valuation
- Acquisition values
- Disposal values
- Financial reports

Security:
- SIV verification
- ISIV verification
- Gate movements
- Asset movements
- Security history

==================================================
7. RBAC AUDIT
==================================================

Inspect the entire existing codebase.

Find:

- Role definitions
- Permission definitions
- Route guards
- Protected routes
- Sidebar navigation
- Dashboard routing
- User context/authentication
- Role checks
- Permission checks
- Action buttons
- Create/Edit/Delete buttons
- Approve/Reject buttons
- Workflow buttons
- Tables
- Modals
- Forms
- Status handling

Identify every place where permissions are incorrectly assigned.

Examples of problems to detect:

- Storekeeper seeing Administrator pages
- Accountant seeing operational editing controls
- TEC seeing SIV approval
- Security Officer editing inventory
- Department Head accessing another department's records
- Ordinary users seeing unrestricted administrative controls
- Users being able to approve their own transactions
- Users being able to change workflow statuses manually
- Unauthorized delete buttons
- Unauthorized edit buttons
- Incorrect dashboard statistics
- Incorrect sidebar navigation

==================================================
8. DEPARTMENT SCOPING
==================================================

Department Head users must be scoped to their department.

For example:

Department Head - Electrical Engineering

should not automatically see or modify:

Civil Engineering requisitions.

The frontend should support:

- current user's department
- department-specific requisitions
- department-specific issued materials
- department-specific returns
- department-specific transfers

Do not create separate roles for each department.

==================================================
9. TRANSACTION IMMUTABILITY
==================================================

Official transactions should not simply be deleted.

Once a transaction has entered an official workflow:

Do NOT provide unrestricted DELETE.

Instead use:

- Cancel
- Reject
- Amend
- Reverse
- Correct through controlled workflow

Historical transactions must remain traceable.

==================================================
10. STATUS MANAGEMENT
==================================================

Use the existing status constants where they are correct:

GRN_STATUS
REQUISITION_STATUS
SIV_STATUS
TRANSFER_STATUS
RETURN_STATUS
DISPOSAL_STATUS
ASSET_STATUS

Do not replace them with one generic status system unless there is a strong technical reason.

Status changes must happen through valid workflow actions.

Example:

Correct:

[Submit for Evaluation]

Incorrect:

Status:
[Draft ▼ Accepted ▼ Rejected ▼]

unless the current user has authority to make that exact transition.

==================================================
11. AUTO-GENERATED SYSTEM BEHAVIOR
==================================================

Identify operations that should be system-driven.

Especially:

AUTO-UPDATE STOCK CARD

When a valid stock transaction occurs:

Receipt:
Stock Card + quantity

Issue:
Stock Card - quantity

Return:
Stock Card + quantity

Transfer Out:
Source Stock Card - quantity

Transfer In:
Destination Stock Card + quantity

Bin Card must also reflect the movement.

Do not make users manually edit calculated stock balances.

--------------------------------------------------

AUTO-MONITOR SHELF LIFE

The system should identify:

- Expired items
- Near-expiry items
- Damaged items
- Obsolete items
- Low-stock items
- Items requiring disposal review

Show these as alerts/cards in appropriate dashboards.

==================================================
12. CURRENT UI MUST BE PRESERVED
==================================================

This is extremely important.

Do NOT redesign the application.

Preserve:

- Existing theme
- Existing colors
- Existing typography
- Existing sidebar
- Existing navbar
- Existing cards
- Existing table components
- Existing forms
- Existing modal components
- Existing status badges
- Existing responsive behavior
- Existing page structure
- Existing visual language

Reuse existing components wherever possible.

Only modify components when required to correctly implement role-based behavior.

==================================================
13. DO NOT CREATE PLACEHOLDER FUNCTIONALITY
==================================================

Do not solve missing functionality by creating fake buttons that do nothing.

Every visible action must either:

1. Work correctly using the existing frontend state/data architecture, OR
2. Be clearly connected to the existing mock/local data mechanism if this frontend is currently frontend-only.

Do not create:

- dead buttons
- fake approval buttons
- fake workflow transitions
- duplicate pages
- meaningless dashboards
- hardcoded role behavior scattered throughout components

Centralize role/permission logic.

==================================================
14. CODE QUALITY
==================================================

Before modifying code:

1. Inspect the entire project structure.
2. Identify the framework and architecture.
3. Find existing auth/role implementation.
4. Find existing constants.
5. Find existing pages.
6. Find existing components.
7. Find existing routing.
8. Find existing mock data/state management.
9. Find existing API/data layer if present.

Then produce an internal audit.

Do NOT immediately start rewriting files.

Use the existing architecture wherever possible.

Avoid duplicate logic.

Create reusable utilities/components where appropriate, such as:

- ProtectedRoute
- RoleGuard
- PermissionGuard
- RoleBasedSidebar
- Can component
- WorkflowAction component
- usePermissions()
- useCurrentUser()
- workflow transition helpers

Use the project's existing conventions rather than introducing unnecessary libraries.

==================================================
15. REQUIRED ROLE/PERMISSION MODEL
==================================================

The system should conceptually distinguish:

ROLE

from

PERMISSION

For example:

Storekeeper

may have:

- receiving.view
- receiving.create
- receiving.update
- inventory.view
- issue.create
- transfer.create
- return.create
- bin.view
- stockcard.view

while Store Head may have:

- requisition.approve
- siv.approve
- transfer.approve
- return.approve
- disposal.approve

Do not hardcode hundreds of unrelated role checks inside JSX.

Centralize permissions.

==================================================
16. AUDIT REPORT BEFORE CHANGES
==================================================

Before modifying the project, provide a concise report:

A. Current actors found
B. Current role implementation
C. Current permission implementation
D. Current dashboards
E. Current protected routes
F. Current sidebar/navigation
G. Incorrect permissions found
H. Missing permissions found
I. Missing workflow actions
J. Duplicate/conflicting roles
K. Status/workflow problems
L. Department-scoping problems
M. Recommended changes

Then implement the corrections.

==================================================
17. FINAL ACCEPTANCE TEST
==================================================

After implementation, test every role.

Test:

ADMINISTRATOR
- Can access admin pages
- Cannot perform restricted operational approvals unnecessarily

PAO
- Can access property/asset workflows
- Cannot perform TEC evaluation

STORE HEAD
- Can supervise and approve operational workflows

STOREKEEPER
- Can perform physical store operations
- Cannot approve their own transactions

STOCK CLERK
- Can manage/view stock records appropriately

TEC
- Can evaluate materials
- Cannot issue stock

DEPARTMENT HEAD
- Can manage their department's requests
- Cannot access unrestricted data belonging to other departments

ACCOUNTANT
- Can access financial/valuation information
- Cannot modify physical stock

SECURITY OFFICER
- Can verify material/asset movement
- Cannot modify inventory

Also test:

- Unauthorized URL access
- Unauthorized buttons
- Unauthorized sidebar items
- Unauthorized CRUD actions
- Unauthorized status transitions
- Department isolation
- Workflow transitions

==================================================
18. IMPORTANT IMPLEMENTATION RULE
==================================================

If you discover that my current implementation conflicts with the business workflow described above:

DO NOT blindly preserve the incorrect implementation.

Correct it.

If you discover a genuine ambiguity between the existing frontend and the operational workflow:

- keep the existing UI
- make the smallest reasonable architectural correction
- document the assumption
- choose the most realistic university stock-management interpretation

Do not expand the scope unnecessarily.

==================================================
FINAL GOAL
==================================================

After your work, the frontend should behave like a realistic university stock management system with:

9 properly implemented operational actors
+
role-based dashboards
+
role-based navigation
+
centralized permissions
+
department scoping
+
separation of duties
+
workflow-based actions
+
correct status transitions
+
stock transaction automation
+
auditability
+
no unauthorized CRUD
+
no dead workflow buttons

The goal is NOT merely to make the UI look correct.

The goal is to make the EXISTING frontend behave correctly according to the operational business processes.

START NOW:

1. Inspect the entire existing frontend.
2. Audit the current actor/role implementation.
3. Report the problems found.
4. Implement the corrections.
5. Preserve the existing UI/design.
6. Run/build/lint the project.
7. Fix any errors introduced.
8. Provide a final summary of every role and permission change made.


### operational database schema
-- ============================================================
-- UNIVERSITY STOCK MANAGEMENT SYSTEM
-- Operational PostgreSQL Database Schema
-- ============================================================
-- Clean baseline schema
-- PostgreSQL 14+
--
-- Core workflow:
--
-- Stores
--   -> Items / Categories / Locations / Bins
--   -> Goods Receipt
--   -> Technical Evaluation
--   -> GRN
--   -> Stock Card / Bin Card
--   -> Requisition
--   -> SIV / ISIV
--   -> Returns / SRN
--   -> Transfers
--   -> Stock Taking
--   -> Fixed Assets
--   -> Shelf-life / Disposal
--   -> Audit
--
-- Operational actors:
-- 1. Administrator
-- 2. Property Administration Officer
-- 3. Store Head
-- 4. Storekeeper
-- 5. Stock Clerk
-- 6. Technical Evaluation Committee
-- 7. Department Head
-- 8. Accountant
-- 9. Security Officer
-- ============================================================


CREATE EXTENSION IF NOT EXISTS pgcrypto;


-- ============================================================
-- 1. ORGANIZATION
-- ============================================================

CREATE TABLE departments (
    id                  TEXT PRIMARY KEY,
    code                TEXT UNIQUE NOT NULL,
    name                TEXT NOT NULL,
    description         TEXT,
    status              TEXT NOT NULL DEFAULT 'ACTIVE',
    created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CONSTRAINT ck_departments_status
        CHECK (status IN ('ACTIVE', 'INACTIVE'))
);


CREATE TABLE stores (
    id                  TEXT PRIMARY KEY,
    code                TEXT UNIQUE NOT NULL,
    name                TEXT NOT NULL,
    store_type          TEXT NOT NULL,
    department_id       TEXT REFERENCES departments(id),
    address             TEXT,
    description         TEXT,
    status              TEXT NOT NULL DEFAULT 'ACTIVE',
    created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CONSTRAINT ck_stores_type
        CHECK (
            store_type IN (
                'MAIN',
                'DEPARTMENT',
                'CAFE',
                'LABORATORY',
                'OTHER'
            )
        ),

    CONSTRAINT ck_stores_status
        CHECK (status IN ('ACTIVE', 'INACTIVE'))
);


-- ============================================================
-- 2. RBAC
-- ============================================================

CREATE TABLE roles (
    id                  TEXT PRIMARY KEY,
    name                TEXT UNIQUE NOT NULL,
    description         TEXT,
    created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);


CREATE TABLE permissions (
    id                  TEXT PRIMARY KEY,
    name                TEXT UNIQUE NOT NULL,
    description         TEXT,
    created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);


CREATE TABLE users (
    id                  TEXT PRIMARY KEY,
    username            TEXT UNIQUE NOT NULL,
    password_hash       TEXT NOT NULL,
    full_name           TEXT NOT NULL,
    email               TEXT UNIQUE,
    phone               TEXT,
    department_id       TEXT REFERENCES departments(id),
    default_store_id    TEXT REFERENCES stores(id),
    status              TEXT NOT NULL DEFAULT 'ACTIVE',
    created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CONSTRAINT ck_users_status
        CHECK (status IN ('ACTIVE', 'INACTIVE', 'LOCKED'))
);


CREATE TABLE user_roles (
    id                  TEXT PRIMARY KEY,
    user_id             TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    role_id             TEXT NOT NULL REFERENCES roles(id) ON DELETE CASCADE,
    created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    UNIQUE (user_id, role_id)
);


CREATE TABLE role_permissions (
    id                  TEXT PRIMARY KEY,
    role_id             TEXT NOT NULL REFERENCES roles(id) ON DELETE CASCADE,
    permission_id       TEXT NOT NULL REFERENCES permissions(id) ON DELETE CASCADE,
    created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    UNIQUE (role_id, permission_id)
);


-- ============================================================
-- 3. ITEM MASTER DATA
-- ============================================================

CREATE TABLE units (
    id                  TEXT PRIMARY KEY,
    code                TEXT UNIQUE NOT NULL,
    name                TEXT NOT NULL,
    description         TEXT,
    status              TEXT NOT NULL DEFAULT 'ACTIVE',
    created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CONSTRAINT ck_units_status
        CHECK (status IN ('ACTIVE', 'INACTIVE'))
);


CREATE TABLE categories (
    id                  TEXT PRIMARY KEY,
    code                TEXT UNIQUE NOT NULL,
    name                TEXT NOT NULL,
    description         TEXT,
    parent_id           TEXT REFERENCES categories(id),
    store_type          TEXT,
    status              TEXT NOT NULL DEFAULT 'ACTIVE',
    created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CONSTRAINT ck_categories_status
        CHECK (status IN ('ACTIVE', 'INACTIVE'))
);


CREATE TABLE suppliers (
    id                  TEXT PRIMARY KEY,
    code                TEXT UNIQUE NOT NULL,
    name                TEXT NOT NULL,
    contact_person      TEXT,
    phone               TEXT,
    email               TEXT,
    address             TEXT,
    tax_number          TEXT,
    status              TEXT NOT NULL DEFAULT 'ACTIVE',
    created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CONSTRAINT ck_suppliers_status
        CHECK (status IN ('ACTIVE', 'INACTIVE'))
);


CREATE TABLE items (
    id                  TEXT PRIMARY KEY,
    item_code           TEXT UNIQUE NOT NULL,
    name                TEXT NOT NULL,
    description         TEXT,
    category_id         TEXT NOT NULL REFERENCES categories(id),
    unit_id             TEXT NOT NULL REFERENCES units(id),
    item_type           TEXT NOT NULL DEFAULT 'CONSUMABLE',
    asset_type          TEXT,
    reorder_level       NUMERIC(14,3) NOT NULL DEFAULT 0,
    maximum_level       NUMERIC(14,3),
    shelf_life_days     INTEGER,
    requires_evaluation BOOLEAN NOT NULL DEFAULT FALSE,
    is_fixed_asset      BOOLEAN NOT NULL DEFAULT FALSE,
    status              TEXT NOT NULL DEFAULT 'ACTIVE',
    created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CONSTRAINT ck_items_type
        CHECK (
            item_type IN (
                'CONSUMABLE',
                'NON_CONSUMABLE',
                'FIXED_ASSET',
                'SPARE_PART',
                'CHEMICAL',
                'MEDICAL',
                'OTHER'
            )
        ),

    CONSTRAINT ck_items_status
        CHECK (status IN ('ACTIVE', 'INACTIVE')),

    CONSTRAINT ck_items_reorder
        CHECK (reorder_level >= 0)
);


-- ============================================================
-- 4. PHYSICAL STORE LOCATIONS
-- ============================================================

CREATE TABLE locations (
    id                  TEXT PRIMARY KEY,
    store_id            TEXT NOT NULL REFERENCES stores(id),
    code                TEXT NOT NULL,
    name                TEXT NOT NULL,
    description         TEXT,
    status              TEXT NOT NULL DEFAULT 'ACTIVE',
    created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    UNIQUE (store_id, code),

    CONSTRAINT ck_locations_status
        CHECK (status IN ('ACTIVE', 'INACTIVE'))
);


CREATE TABLE bins (
    id                  TEXT PRIMARY KEY,
    location_id         TEXT NOT NULL REFERENCES locations(id),
    code                TEXT NOT NULL,
    name                TEXT NOT NULL,
    capacity            NUMERIC(14,3),
    description         TEXT,
    status              TEXT NOT NULL DEFAULT 'ACTIVE',
    created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    UNIQUE (location_id, code),

    CONSTRAINT ck_bins_status
        CHECK (status IN ('ACTIVE', 'INACTIVE'))
);


-- ============================================================
-- 5. ITEM STORAGE ASSIGNMENT
-- ============================================================

CREATE TABLE item_locations (
    id                  TEXT PRIMARY KEY,
    item_id             TEXT NOT NULL REFERENCES items(id),
    store_id            TEXT NOT NULL REFERENCES stores(id),
    location_id         TEXT REFERENCES locations(id),
    bin_id              TEXT REFERENCES bins(id),
    minimum_quantity    NUMERIC(14,3) NOT NULL DEFAULT 0,
    maximum_quantity    NUMERIC(14,3),
    created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    UNIQUE (item_id, store_id, location_id, bin_id)
);


-- ============================================================
-- 6. GOODS RECEIPT
-- ============================================================

CREATE TABLE goods_receipts (
    id                  TEXT PRIMARY KEY,
    receipt_no          TEXT UNIQUE NOT NULL,
    store_id            TEXT NOT NULL REFERENCES stores(id),
    supplier_id         TEXT REFERENCES suppliers(id),
    source_type         TEXT NOT NULL,
    purchase_reference  TEXT,
    donation_reference  TEXT,
    invoice_no          TEXT,
    delivery_note_no    TEXT,
    received_by         TEXT NOT NULL REFERENCES users(id),
    received_date       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    status              TEXT NOT NULL DEFAULT 'DRAFT',
    notes               TEXT,
    created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CONSTRAINT ck_goods_receipts_source
        CHECK (
            source_type IN (
                'PURCHASE',
                'DONATION',
                'TRANSFER',
                'OTHER'
            )
        ),

    CONSTRAINT ck_goods_receipts_status
        CHECK (
            status IN (
                'DRAFT',
                'SUBMITTED',
                'PENDING_EVALUATION',
                'UNDER_EVALUATION',
                'ACCEPTED',
                'REJECTED',
                'GRN_GENERATED'
            )
        )
);


CREATE TABLE goods_receipt_items (
    id                  TEXT PRIMARY KEY,
    goods_receipt_id    TEXT NOT NULL REFERENCES goods_receipts(id) ON DELETE CASCADE,
    item_id             TEXT NOT NULL REFERENCES items(id),
    quantity_received   NUMERIC(14,3) NOT NULL,
    unit_cost           NUMERIC(14,4) NOT NULL DEFAULT 0,
    batch_no            TEXT,
    serial_no           TEXT,
    manufacturing_date  DATE,
    expiry_date         DATE,
    condition           TEXT,
    accepted_quantity   NUMERIC(14,3) DEFAULT 0,
    rejected_quantity   NUMERIC(14,3) DEFAULT 0,
    remarks             TEXT,

    CONSTRAINT ck_receipt_item_quantity
        CHECK (quantity_received > 0),

    CONSTRAINT ck_receipt_item_accepted
        CHECK (accepted_quantity >= 0),

    CONSTRAINT ck_receipt_item_rejected
        CHECK (rejected_quantity >= 0)
);


-- ============================================================
-- 7. TECHNICAL EVALUATION
-- ============================================================

CREATE TABLE technical_evaluations (
    id                  TEXT PRIMARY KEY,
    evaluation_no       TEXT UNIQUE NOT NULL,
    goods_receipt_id    TEXT NOT NULL REFERENCES goods_receipts(id),
    evaluated_by        TEXT NOT NULL REFERENCES users(id),
    evaluation_date     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    decision            TEXT NOT NULL,
    technical_condition TEXT,
    remarks             TEXT,

    CONSTRAINT ck_evaluation_decision
        CHECK (
            decision IN (
                'ACCEPTED',
                'REJECTED'
            )
        )
);


CREATE TABLE technical_evaluation_items (
    id                  TEXT PRIMARY KEY,
    evaluation_id       TEXT NOT NULL REFERENCES technical_evaluations(id) ON DELETE CASCADE,
    goods_receipt_item_id TEXT NOT NULL REFERENCES goods_receipt_items(id),
    decision             TEXT NOT NULL,
    remarks              TEXT,

    CONSTRAINT ck_evaluation_item_decision
        CHECK (
            decision IN (
                'ACCEPTED',
                'REJECTED'
            )
        )
);


-- ============================================================
-- 8. GOODS RECEIVING NOTE
-- ============================================================

CREATE TABLE grns (
    id                  TEXT PRIMARY KEY,
    grn_no              TEXT UNIQUE NOT NULL,
    goods_receipt_id    TEXT NOT NULL REFERENCES goods_receipts(id),
    generated_by        TEXT NOT NULL REFERENCES users(id),
    generated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    status              TEXT NOT NULL DEFAULT 'GENERATED',
    remarks             TEXT,

    CONSTRAINT ck_grn_status
        CHECK (
            status IN (
                'GENERATED',
                'POSTED',
                'CANCELLED'
            )
        )
);


CREATE TABLE grn_items (
    id                  TEXT PRIMARY KEY,
    grn_id              TEXT NOT NULL REFERENCES grns(id) ON DELETE CASCADE,
    goods_receipt_item_id TEXT NOT NULL REFERENCES goods_receipt_items(id),
    item_id             TEXT NOT NULL REFERENCES items(id),
    quantity            NUMERIC(14,3) NOT NULL,
    unit_cost           NUMERIC(14,4) NOT NULL DEFAULT 0,

    CONSTRAINT ck_grn_item_quantity
        CHECK (quantity > 0)
);


-- ============================================================
-- 9. INVENTORY BALANCE
-- ============================================================

CREATE TABLE inventory_balances (
    id                  TEXT PRIMARY KEY,
    item_id             TEXT NOT NULL REFERENCES items(id),
    store_id            TEXT NOT NULL REFERENCES stores(id),
    quantity_on_hand    NUMERIC(14,3) NOT NULL DEFAULT 0,
    reserved_quantity   NUMERIC(14,3) NOT NULL DEFAULT 0,
    available_quantity  NUMERIC(14,3) NOT NULL DEFAULT 0,
    average_cost        NUMERIC(14,4) NOT NULL DEFAULT 0,
    last_transaction_at TIMESTAMPTZ,
    updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    UNIQUE (item_id, store_id),

    CONSTRAINT ck_inventory_quantity
        CHECK (quantity_on_hand >= 0),

    CONSTRAINT ck_inventory_reserved
        CHECK (reserved_quantity >= 0),

    CONSTRAINT ck_inventory_available
        CHECK (available_quantity >= 0)
);


-- ============================================================
-- 10. INVENTORY TRANSACTIONS
-- ============================================================

CREATE TABLE inventory_transactions (
    id                  TEXT PRIMARY KEY,
    transaction_no      TEXT UNIQUE NOT NULL,
    item_id             TEXT NOT NULL REFERENCES items(id),
    store_id            TEXT NOT NULL REFERENCES stores(id),
    location_id         TEXT REFERENCES locations(id),
    bin_id              TEXT REFERENCES bins(id),
    transaction_type    TEXT NOT NULL,
    direction           TEXT NOT NULL,
    quantity            NUMERIC(14,3) NOT NULL,
    unit_cost           NUMERIC(14,4) NOT NULL DEFAULT 0,
    reference_type      TEXT,
    reference_id        TEXT,
    performed_by        TEXT NOT NULL REFERENCES users(id),
    transaction_date    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    remarks             TEXT,

    CONSTRAINT ck_inventory_direction
        CHECK (direction IN ('IN', 'OUT')),

    CONSTRAINT ck_inventory_quantity_positive
        CHECK (quantity > 0),

    CONSTRAINT ck_inventory_transaction_type
        CHECK (
            transaction_type IN (
                'OPENING_BALANCE',
                'RECEIPT',
                'ISSUE',
                'RETURN',
                'TRANSFER_OUT',
                'TRANSFER_IN',
                'ADJUSTMENT',
                'DISPOSAL'
            )
        )
);


-- ============================================================
-- 11. STOCK CARDS
-- ============================================================

CREATE TABLE stock_cards (
    id                  TEXT PRIMARY KEY,
    item_id             TEXT NOT NULL REFERENCES items(id),
    store_id            TEXT NOT NULL REFERENCES stores(id),
    opening_balance     NUMERIC(14,3) NOT NULL DEFAULT 0,
    current_balance     NUMERIC(14,3) NOT NULL DEFAULT 0,
    last_transaction_at TIMESTAMPTZ,
    created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    UNIQUE (item_id, store_id)
);


CREATE TABLE stock_card_transactions (
    id                  TEXT PRIMARY KEY,
    stock_card_id       TEXT NOT NULL REFERENCES stock_cards(id) ON DELETE CASCADE,
    inventory_transaction_id TEXT NOT NULL
        REFERENCES inventory_transactions(id),
    quantity_in         NUMERIC(14,3) NOT NULL DEFAULT 0,
    quantity_out        NUMERIC(14,3) NOT NULL DEFAULT 0,
    balance_after       NUMERIC(14,3) NOT NULL,
    transaction_date    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);


-- ============================================================
-- 12. BIN CARDS
-- ============================================================

CREATE TABLE bin_cards (
    id                  TEXT PRIMARY KEY,
    item_id             TEXT NOT NULL REFERENCES items(id),
    store_id            TEXT NOT NULL REFERENCES stores(id),
    location_id         TEXT REFERENCES locations(id),
    bin_id              TEXT NOT NULL REFERENCES bins(id),
    current_balance     NUMERIC(14,3) NOT NULL DEFAULT 0,
    created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    UNIQUE (item_id, bin_id)
);


CREATE TABLE bin_card_transactions (
    id                  TEXT PRIMARY KEY,
    bin_card_id         TEXT NOT NULL REFERENCES bin_cards(id) ON DELETE CASCADE,
    inventory_transaction_id TEXT NOT NULL
        REFERENCES inventory_transactions(id),
    direction           TEXT NOT NULL,
    quantity            NUMERIC(14,3) NOT NULL,
    balance_after       NUMERIC(14,3) NOT NULL,
    document_type       TEXT,
    document_reference  TEXT,
    transaction_date    TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CONSTRAINT ck_bin_transaction_direction
        CHECK (direction IN ('IN', 'OUT')),

    CONSTRAINT ck_bin_transaction_quantity
        CHECK (quantity > 0)
);


-- ============================================================
-- 13. STORE REQUISITIONS
-- ============================================================

CREATE TABLE requisitions (
    id                  TEXT PRIMARY KEY,
    requisition_no      TEXT UNIQUE NOT NULL,
    department_id       TEXT NOT NULL REFERENCES departments(id),
    requested_by        TEXT NOT NULL REFERENCES users(id),
    store_id            TEXT NOT NULL REFERENCES stores(id),
    requested_date      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    required_date       DATE,
    purpose             TEXT NOT NULL,
    status              TEXT NOT NULL DEFAULT 'DRAFT',
    reviewed_by         TEXT REFERENCES users(id),
    reviewed_at         TIMESTAMPTZ,
    rejection_reason    TEXT,
    created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CONSTRAINT ck_requisition_status
        CHECK (
            status IN (
                'DRAFT',
                'SUBMITTED',
                'APPROVED',
                'REJECTED',
                'PARTIALLY_ISSUED',
                'FULFILLED',
                'CANCELLED'
            )
        )
);


CREATE TABLE requisition_items (
    id                  TEXT PRIMARY KEY,
    requisition_id      TEXT NOT NULL REFERENCES requisitions(id) ON DELETE CASCADE,
    item_id             TEXT NOT NULL REFERENCES items(id),
    requested_quantity  NUMERIC(14,3) NOT NULL,
    approved_quantity   NUMERIC(14,3) NOT NULL DEFAULT 0,
    issued_quantity     NUMERIC(14,3) NOT NULL DEFAULT 0,
    remarks             TEXT,

    CONSTRAINT ck_requisition_requested
        CHECK (requested_quantity > 0),

    CONSTRAINT ck_requisition_approved
        CHECK (approved_quantity >= 0),

    CONSTRAINT ck_requisition_issued
        CHECK (issued_quantity >= 0)
);


-- ============================================================
-- 14. STORE ISSUE VOUCHER / INTER STORE ISSUE VOUCHER
-- ============================================================

CREATE TABLE issue_vouchers (
    id                  TEXT PRIMARY KEY,
    voucher_no          TEXT UNIQUE NOT NULL,
    voucher_type        TEXT NOT NULL,
    requisition_id      TEXT REFERENCES requisitions(id),
    source_store_id     TEXT NOT NULL REFERENCES stores(id),
    destination_department_id TEXT REFERENCES departments(id),
    created_by          TEXT NOT NULL REFERENCES users(id),
    approved_by         TEXT REFERENCES users(id),
    approved_at         TIMESTAMPTZ,
    issued_by           TEXT REFERENCES users(id),
    issued_at           TIMESTAMPTZ,
    status              TEXT NOT NULL DEFAULT 'DRAFT',
    remarks             TEXT,

    CONSTRAINT ck_issue_voucher_type
        CHECK (
            voucher_type IN (
                'SIV',
                'ISIV'
            )
        ),

    CONSTRAINT ck_issue_voucher_status
        CHECK (
            status IN (
                'DRAFT',
                'SUBMITTED',
                'APPROVED',
                'AMENDED',
                'ISSUED',
                'COMPLETED',
                'CANCELLED'
            )
        )
);


CREATE TABLE issue_voucher_items (
    id                  TEXT PRIMARY KEY,
    issue_voucher_id    TEXT NOT NULL REFERENCES issue_vouchers(id) ON DELETE CASCADE,
    item_id             TEXT NOT NULL REFERENCES items(id),
    quantity            NUMERIC(14,3) NOT NULL,
    unit_cost           NUMERIC(14,4) NOT NULL DEFAULT 0,
    location_id         TEXT REFERENCES locations(id),
    bin_id              TEXT REFERENCES bins(id),

    CONSTRAINT ck_issue_quantity
        CHECK (quantity > 0)
);


-- ============================================================
-- 15. MATERIAL RETURNS / SRN
-- ============================================================

CREATE TABLE return_requests (
    id                  TEXT PRIMARY KEY,
    return_no           TEXT UNIQUE NOT NULL,
    department_id       TEXT NOT NULL REFERENCES departments(id),
    requested_by        TEXT NOT NULL REFERENCES users(id),
    store_id            TEXT NOT NULL REFERENCES stores(id),
    reason              TEXT NOT NULL,
    status              TEXT NOT NULL DEFAULT 'DRAFT',
    reviewed_by         TEXT REFERENCES users(id),
    reviewed_at         TIMESTAMPTZ,
    return_date         TIMESTAMPTZ,
    remarks             TEXT,
    created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CONSTRAINT ck_return_status
        CHECK (
            status IN (
                'DRAFT',
                'SUBMITTED',
                'PENDING_REVIEW',
                'APPROVED',
                'REJECTED',
                'RETURNED_TO_STOCK',
                'CANCELLED'
            )
        )
);


CREATE TABLE return_request_items (
    id                  TEXT PRIMARY KEY,
    return_request_id   TEXT NOT NULL REFERENCES return_requests(id) ON DELETE CASCADE,
    item_id             TEXT NOT NULL REFERENCES items(id),
    quantity            NUMERIC(14,3) NOT NULL,
    condition           TEXT,
    remarks             TEXT,

    CONSTRAINT ck_return_quantity
        CHECK (quantity > 0)
);


-- ============================================================
-- 16. MATERIAL TRANSFER
-- ============================================================

CREATE TABLE transfer_requests (
    id                  TEXT PRIMARY KEY,
    transfer_no         TEXT UNIQUE NOT NULL,
    source_store_id     TEXT NOT NULL REFERENCES stores(id),
    destination_store_id TEXT NOT NULL REFERENCES stores(id),
    requested_by        TEXT NOT NULL REFERENCES users(id),
    approved_by         TEXT REFERENCES users(id),
    requested_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    approved_at         TIMESTAMPTZ,
    dispatched_at       TIMESTAMPTZ,
    received_at         TIMESTAMPTZ,
    status              TEXT NOT NULL DEFAULT 'DRAFT',
    reason              TEXT,
    remarks             TEXT,

    CONSTRAINT ck_transfer_status
        CHECK (
            status IN (
                'DRAFT',
                'SUBMITTED',
                'PENDING_APPROVAL',
                'APPROVED',
                'DISPATCHED',
                'RECEIVED',
                'COMPLETED',
                'REJECTED',
                'CANCELLED'
            )
        ),

    CONSTRAINT ck_transfer_different_stores
        CHECK (source_store_id <> destination_store_id)
);


CREATE TABLE transfer_request_items (
    id                  TEXT PRIMARY KEY,
    transfer_request_id TEXT NOT NULL REFERENCES transfer_requests(id) ON DELETE CASCADE,
    item_id             TEXT NOT NULL REFERENCES items(id),
    quantity            NUMERIC(14,3) NOT NULL,
    source_location_id  TEXT REFERENCES locations(id),
    source_bin_id       TEXT REFERENCES bins(id),
    destination_location_id TEXT REFERENCES locations(id),
    destination_bin_id  TEXT REFERENCES bins(id),

    CONSTRAINT ck_transfer_quantity
        CHECK (quantity > 0)
);


-- ============================================================
-- 17. FIXED ASSETS
-- ============================================================

CREATE TABLE fixed_assets (
    id                  TEXT PRIMARY KEY,
    asset_tag           TEXT UNIQUE NOT NULL,
    item_id             TEXT NOT NULL REFERENCES items(id),
    serial_number       TEXT UNIQUE,
    model               TEXT,
    manufacturer        TEXT,
    acquisition_date    DATE,
    acquisition_cost    NUMERIC(14,2) NOT NULL DEFAULT 0,
    useful_life_years   INTEGER,
    current_location_id TEXT REFERENCES locations(id),
    department_id       TEXT REFERENCES departments(id),
    custodian_user_id   TEXT REFERENCES users(id),
    status              TEXT NOT NULL DEFAULT 'REGISTERED',
    created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CONSTRAINT ck_asset_status
        CHECK (
            status IN (
                'REGISTERED',
                'IN_STORE',
                'ASSIGNED',
                'IN_USE',
                'MAINTENANCE',
                'LOST',
                'DAMAGED',
                'DISPOSED'
            )
        )
);


CREATE TABLE asset_assignments (
    id                  TEXT PRIMARY KEY,
    asset_id            TEXT NOT NULL REFERENCES fixed_assets(id),
    assigned_to_user_id TEXT REFERENCES users(id),
    department_id       TEXT REFERENCES departments(id),
    assigned_by         TEXT NOT NULL REFERENCES users(id),
    assigned_at         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    returned_at         TIMESTAMPTZ,
    remarks             TEXT
);


CREATE TABLE asset_movements (
    id                  TEXT PRIMARY KEY,
    asset_id            TEXT NOT NULL REFERENCES fixed_assets(id),
    from_location_id    TEXT REFERENCES locations(id),
    to_location_id      TEXT REFERENCES locations(id),
    from_department_id  TEXT REFERENCES departments(id),
    to_department_id    TEXT REFERENCES departments(id),
    moved_by            TEXT NOT NULL REFERENCES users(id),
    movement_date       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    reason              TEXT
);


-- ============================================================
-- 18. USER CARD
-- ============================================================

CREATE TABLE user_cards (
    id                  TEXT PRIMARY KEY,
    card_no             TEXT UNIQUE NOT NULL,
    user_id             TEXT UNIQUE NOT NULL REFERENCES users(id),
    issued_date         DATE NOT NULL DEFAULT CURRENT_DATE,
    status              TEXT NOT NULL DEFAULT 'ACTIVE',
    remarks             TEXT,

    CONSTRAINT ck_user_card_status
        CHECK (status IN ('ACTIVE', 'INACTIVE', 'LOST', 'REPLACED'))
);


CREATE TABLE user_card_transactions (
    id                  TEXT PRIMARY KEY,
    user_card_id        TEXT NOT NULL REFERENCES user_cards(id) ON DELETE CASCADE,
    item_id             TEXT NOT NULL REFERENCES items(id),
    issue_voucher_id    TEXT REFERENCES issue_vouchers(id),
    quantity            NUMERIC(14,3) NOT NULL,
    transaction_type    TEXT NOT NULL,
    transaction_date    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    remarks             TEXT,

    CONSTRAINT ck_user_card_transaction_type
        CHECK (
            transaction_type IN (
                'ISSUE',
                'RETURN',
                'ADJUSTMENT'
            )
        )
);


-- ============================================================
-- 19. STOCK TAKING
-- ============================================================

CREATE TABLE stock_takes (
    id                  TEXT PRIMARY KEY,
    stock_take_no       TEXT UNIQUE NOT NULL,
    store_id            TEXT NOT NULL REFERENCES stores(id),
    initiated_by        TEXT NOT NULL REFERENCES users(id),
    start_date          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    end_date            TIMESTAMPTZ,
    status              TEXT NOT NULL DEFAULT 'OPEN',
    remarks             TEXT,

    CONSTRAINT ck_stock_take_status
        CHECK (
            status IN (
                'OPEN',
                'COUNTING',
                'RECONCILED',
                'CLOSED',
                'CANCELLED'
            )
        )
);


CREATE TABLE stock_take_items (
    id                  TEXT PRIMARY KEY,
    stock_take_id       TEXT NOT NULL REFERENCES stock_takes(id) ON DELETE CASCADE,
    item_id             TEXT NOT NULL REFERENCES items(id),
    location_id         TEXT REFERENCES locations(id),
    bin_id              TEXT REFERENCES bins(id),
    system_quantity     NUMERIC(14,3) NOT NULL DEFAULT 0,
    counted_quantity    NUMERIC(14,3),
    variance            NUMERIC(14,3),
    remarks             TEXT
);


-- ============================================================
-- 20. INVENTORY ADJUSTMENTS
-- ============================================================

CREATE TABLE inventory_adjustments (
    id                  TEXT PRIMARY KEY,
    adjustment_no       TEXT UNIQUE NOT NULL,
    store_id            TEXT NOT NULL REFERENCES stores(id),
    requested_by        TEXT NOT NULL REFERENCES users(id),
    approved_by         TEXT REFERENCES users(id),
    reason              TEXT NOT NULL,
    status              TEXT NOT NULL DEFAULT 'PENDING',
    requested_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    approved_at         TIMESTAMPTZ,
    posted_at           TIMESTAMPTZ,

    CONSTRAINT ck_adjustment_status
        CHECK (
            status IN (
                'PENDING',
                'APPROVED',
                'REJECTED',
                'POSTED',
                'CANCELLED'
            )
        )
);


CREATE TABLE inventory_adjustment_items (
    id                  TEXT PRIMARY KEY,
    adjustment_id       TEXT NOT NULL REFERENCES inventory_adjustments(id) ON DELETE CASCADE,
    item_id             TEXT NOT NULL REFERENCES items(id),
    location_id         TEXT REFERENCES locations(id),
    bin_id              TEXT REFERENCES bins(id),
    quantity_difference NUMERIC(14,3) NOT NULL,
    unit_cost           NUMERIC(14,4) NOT NULL DEFAULT 0,
    reason              TEXT
);


-- ============================================================
-- 21. SHELF LIFE MONITORING
-- ============================================================

CREATE TABLE shelf_life_alerts (
    id                  TEXT PRIMARY KEY,
    item_id             TEXT NOT NULL REFERENCES items(id),
    store_id            TEXT NOT NULL REFERENCES stores(id),
    batch_no            TEXT,
    expiry_date         DATE NOT NULL,
    alert_type          TEXT NOT NULL,
    days_remaining      INTEGER,
    status              TEXT NOT NULL DEFAULT 'OPEN',
    created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    resolved_at         TIMESTAMPTZ,

    CONSTRAINT ck_shelf_alert_type
        CHECK (
            alert_type IN (
                'EXPIRING_SOON',
                'EXPIRED',
                'DAMAGED',
                'OBSOLETE'
            )
        ),

    CONSTRAINT ck_shelf_alert_status
        CHECK (
            status IN (
                'OPEN',
                'ACKNOWLEDGED',
                'RESOLVED'
            )
        )
);


-- ============================================================
-- 22. DISPOSAL
-- ============================================================

CREATE TABLE disposal_flags (
    id                  TEXT PRIMARY KEY,
    item_id             TEXT NOT NULL REFERENCES items(id),
    store_id            TEXT NOT NULL REFERENCES stores(id),
    reason              TEXT NOT NULL,
    flagged_by          TEXT NOT NULL REFERENCES users(id),
    flagged_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    status              TEXT NOT NULL DEFAULT 'FLAGGED',

    CONSTRAINT ck_disposal_flag_status
        CHECK (
            status IN (
                'FLAGGED',
                'REQUESTED',
                'RESOLVED'
            )
        )
);


CREATE TABLE disposal_requests (
    id                  TEXT PRIMARY KEY,
    disposal_no         TEXT UNIQUE NOT NULL,
    store_id            TEXT NOT NULL REFERENCES stores(id),
    requested_by        TEXT NOT NULL REFERENCES users(id),
    approved_by         TEXT REFERENCES users(id),
    reason              TEXT NOT NULL,
    status              TEXT NOT NULL DEFAULT 'REQUESTED',
    requested_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    approved_at         TIMESTAMPTZ,
    completed_at        TIMESTAMPTZ,
    remarks             TEXT,

    CONSTRAINT ck_disposal_status
        CHECK (
            status IN (
                'REQUESTED',
                'PENDING_REVIEW',
                'APPROVED',
                'REJECTED',
                'EXECUTED',
                'COMPLETED',
                'CANCELLED'
            )
        )
);


CREATE TABLE disposal_items (
    id                  TEXT PRIMARY KEY,
    disposal_request_id TEXT NOT NULL REFERENCES disposal_requests(id) ON DELETE CASCADE,
    item_id             TEXT NOT NULL REFERENCES items(id),
    quantity            NUMERIC(14,3) NOT NULL,
    unit_cost           NUMERIC(14,4) NOT NULL DEFAULT 0,
    reason              TEXT,

    CONSTRAINT ck_disposal_quantity
        CHECK (quantity > 0)
);


CREATE TABLE disposal_approvals (
    id                  TEXT PRIMARY KEY,
    disposal_request_id TEXT NOT NULL REFERENCES disposal_requests(id) ON DELETE CASCADE,
    approved_by         TEXT NOT NULL REFERENCES users(id),
    decision            TEXT NOT NULL,
    decision_date       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    remarks             TEXT,

    CONSTRAINT ck_disposal_decision
        CHECK (decision IN ('APPROVED', 'REJECTED'))
);


CREATE TABLE disposal_executions (
    id                  TEXT PRIMARY KEY,
    disposal_request_id TEXT NOT NULL REFERENCES disposal_requests(id),
    executed_by         TEXT NOT NULL REFERENCES users(id),
    execution_date      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    method              TEXT NOT NULL,
    certificate_no      TEXT,
    remarks             TEXT
);


-- ============================================================
-- 23. SECURITY / GATE PASS
-- ============================================================

CREATE TABLE gate_passes (
    id                  TEXT PRIMARY KEY,
    gate_pass_no        TEXT UNIQUE NOT NULL,
    issue_voucher_id    TEXT REFERENCES issue_vouchers(id),
    transfer_request_id TEXT REFERENCES transfer_requests(id),
    asset_id            TEXT REFERENCES fixed_assets(id),
    requested_by        TEXT NOT NULL REFERENCES users(id),
    verified_by         TEXT REFERENCES users(id),
    direction           TEXT NOT NULL,
    status              TEXT NOT NULL DEFAULT 'PENDING',
    issued_at           TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    verified_at         TIMESTAMPTZ,
    remarks             TEXT,

    CONSTRAINT ck_gate_direction
        CHECK (direction IN ('OUT', 'IN')),

    CONSTRAINT ck_gate_status
        CHECK (
            status IN (
                'PENDING',
                'VERIFIED',
                'REJECTED',
                'CANCELLED'
            )
        )
);


-- ============================================================
-- 24. AUDIT LOG
-- ============================================================

CREATE TABLE audit_logs (
    id                  TEXT PRIMARY KEY,
    user_id             TEXT REFERENCES users(id),
    action              TEXT NOT NULL,
    entity_type         TEXT NOT NULL,
    entity_id           TEXT,
    reference           TEXT,
    old_data            JSONB,
    new_data            JSONB,
    ip_address          INET,
    user_agent          TEXT,
    created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);


-- ============================================================
-- 25. NOTIFICATIONS
-- ============================================================

CREATE TABLE notifications (
    id                  TEXT PRIMARY KEY,
    user_id             TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    title               TEXT NOT NULL,
    message             TEXT NOT NULL,
    type                TEXT NOT NULL DEFAULT 'INFO',
    reference_type      TEXT,
    reference_id        TEXT,
    is_read             BOOLEAN NOT NULL DEFAULT FALSE,
    created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CONSTRAINT ck_notification_type
        CHECK (
            type IN (
                'INFO',
                'SUCCESS',
                'WARNING',
                'ERROR',
                'WORKFLOW'
            )
        )
);


-- ============================================================
-- 26. INDEXES
-- ============================================================

CREATE INDEX idx_users_department
    ON users(department_id);

CREATE INDEX idx_users_store
    ON users(default_store_id);

CREATE INDEX idx_stores_department
    ON stores(department_id);

CREATE INDEX idx_items_category
    ON items(category_id);

CREATE INDEX idx_locations_store
    ON locations(store_id);

CREATE INDEX idx_bins_location
    ON bins(location_id);

CREATE INDEX idx_receipts_store
    ON goods_receipts(store_id);

CREATE INDEX idx_receipts_status
    ON goods_receipts(status);

CREATE INDEX idx_receipt_items_receipt
    ON goods_receipt_items(goods_receipt_id);

CREATE INDEX idx_evaluations_receipt
    ON technical_evaluations(goods_receipt_id);

CREATE INDEX idx_inventory_item_store
    ON inventory_transactions(item_id, store_id);

CREATE INDEX idx_inventory_reference
    ON inventory_transactions(reference_type, reference_id);

CREATE INDEX idx_stock_cards_item_store
    ON stock_cards(item_id, store_id);

CREATE INDEX idx_bin_cards_item
    ON bin_cards(item_id);

CREATE INDEX idx_requisitions_department
    ON requisitions(department_id);

CREATE INDEX idx_requisitions_status
    ON requisitions(status);

CREATE INDEX idx_issue_vouchers_status
    ON issue_vouchers(status);

CREATE INDEX idx_returns_status
    ON return_requests(status);

CREATE INDEX idx_transfers_status
    ON transfer_requests(status);

CREATE INDEX idx_assets_department
    ON fixed_assets(department_id);

CREATE INDEX idx_assets_status
    ON fixed_assets(status);

CREATE INDEX idx_stock_takes_store
    ON stock_takes(store_id);

CREATE INDEX idx_disposals_status
    ON disposal_requests(status);

CREATE INDEX idx_gate_pass_status
    ON gate_passes(status);

CREATE INDEX idx_audit_user
    ON audit_logs(user_id);

CREATE INDEX idx_audit_entity
    ON audit_logs(entity_type, entity_id);

CREATE INDEX idx_audit_created
    ON audit_logs(created_at DESC);

CREATE INDEX idx_notifications_user
    ON notifications(user_id, is_read);


-- ============================================================
-- 27. INITIAL ROLES
-- ============================================================

INSERT INTO roles (id, name, description) VALUES
('ROLE-ADMIN', 'Administrator',
 'System administration and configuration'),

('ROLE-PAO', 'Property Administration Officer',
 'Property and inventory administration'),

('ROLE-STORE-HEAD', 'Store Head',
 'Store supervision and operational approval'),

('ROLE-STOREKEEPER', 'Storekeeper',
 'Physical store operations'),

('ROLE-STOCK-CLERK', 'Stock Clerk',
 'Inventory records and stock transaction support'),

('ROLE-TEC', 'Technical Evaluation Committee',
 'Technical evaluation of received materials'),

('ROLE-DEPT-HEAD', 'Department Head',
 'Department material requisition and control'),

('ROLE-ACCOUNTANT', 'Accountant',
 'Financial and inventory valuation'),

('ROLE-SECURITY', 'Security Officer',
 'Physical property movement verification');


-- ============================================================
-- 28. INITIAL PERMISSIONS
-- ============================================================

INSERT INTO permissions (id, name, description) VALUES

-- Users
('PERM-USER-VIEW', 'user.view', 'View users'),
('PERM-USER-CREATE', 'user.create', 'Create users'),
('PERM-USER-UPDATE', 'user.update', 'Update users'),
('PERM-USER-DEACTIVATE', 'user.deactivate', 'Deactivate users'),

-- Stores
('PERM-STORE-VIEW', 'store.view', 'View stores'),
('PERM-STORE-MANAGE', 'store.manage', 'Manage stores'),

-- Items
('PERM-ITEM-VIEW', 'item.view', 'View items'),
('PERM-ITEM-MANAGE', 'item.manage', 'Manage items'),

-- Categories
('PERM-CATEGORY-VIEW', 'category.view', 'View categories'),
('PERM-CATEGORY-MANAGE', 'category.manage', 'Manage categories'),

-- Locations
('PERM-LOCATION-VIEW', 'location.view', 'View locations'),
('PERM-LOCATION-MANAGE', 'location.manage', 'Manage locations'),

-- Receiving
('PERM-RECEIVING-VIEW', 'receiving.view', 'View goods receipts'),
('PERM-RECEIVING-CREATE', 'receiving.create', 'Create goods receipts'),
('PERM-RECEIVING-UPDATE', 'receiving.update', 'Update goods receipts'),
('PERM-RECEIVING-SUBMIT', 'receiving.submit', 'Submit receipt for evaluation'),

-- Evaluation
('PERM-EVALUATION-VIEW', 'evaluation.view', 'View evaluations'),
('PERM-EVALUATION-CREATE', 'evaluation.create', 'Perform technical evaluation'),
('PERM-EVALUATION-DECIDE', 'evaluation.decide', 'Accept or reject materials'),

-- GRN
('PERM-GRN-VIEW', 'grn.view', 'View GRNs'),
('PERM-GRN-GENERATE', 'grn.generate', 'Generate GRNs'),

-- Stock
('PERM-STOCK-VIEW', 'stock.view', 'View stock'),
('PERM-STOCK-UPDATE', 'stock.update', 'Update stock through transactions'),

-- Bin
('PERM-BIN-VIEW', 'bin.view', 'View bin cards'),
('PERM-BIN-MANAGE', 'bin.manage', 'Manage bin cards'),

-- Requisition
('PERM-REQUISITION-VIEW', 'requisition.view', 'View requisitions'),
('PERM-REQUISITION-CREATE', 'requisition.create', 'Create requisitions'),
('PERM-REQUISITION-SUBMIT', 'requisition.submit', 'Submit requisitions'),
('PERM-REQUISITION-APPROVE', 'requisition.approve', 'Approve requisitions'),
('PERM-REQUISITION-REJECT', 'requisition.reject', 'Reject requisitions'),

-- SIV
('PERM-SIV-VIEW', 'siv.view', 'View SIV/ISIV'),
('PERM-SIV-CREATE', 'siv.create', 'Create SIV/ISIV'),
('PERM-SIV-APPROVE', 'siv.approve', 'Approve SIV/ISIV'),
('PERM-SIV-AMEND', 'siv.amend', 'Amend SIV/ISIV'),
('PERM-SIV-ISSUE', 'siv.issue', 'Issue materials'),

-- Returns
('PERM-RETURN-VIEW', 'return.view', 'View returns'),
('PERM-RETURN-CREATE', 'return.create', 'Create return requests'),
('PERM-RETURN-APPROVE', 'return.approve', 'Approve returns'),
('PERM-RETURN-POST', 'return.post', 'Return materials to stock'),

-- Transfers
('PERM-TRANSFER-VIEW', 'transfer.view', 'View transfers'),
('PERM-TRANSFER-CREATE', 'transfer.create', 'Create transfer requests'),
('PERM-TRANSFER-APPROVE', 'transfer.approve', 'Approve transfers'),
('PERM-TRANSFER-DISPATCH', 'transfer.dispatch', 'Dispatch transfers'),
('PERM-TRANSFER-RECEIVE', 'transfer.receive', 'Receive transfers'),

-- Assets
('PERM-ASSET-VIEW', 'asset.view', 'View fixed assets'),
('PERM-ASSET-MANAGE', 'asset.manage', 'Manage fixed assets'),
('PERM-ASSET-ASSIGN', 'asset.assign', 'Assign fixed assets'),

-- Stock Taking
('PERM-STOCKTAKE-VIEW', 'stocktake.view', 'View stock taking'),
('PERM-STOCKTAKE-CREATE', 'stocktake.create', 'Create stock take'),
('PERM-STOCKTAKE-COUNT', 'stocktake.count', 'Count stock'),
('PERM-STOCKTAKE-RECONCILE', 'stocktake.reconcile', 'Reconcile stock'),

-- Disposal
('PERM-DISPOSAL-VIEW', 'disposal.view', 'View disposal'),
('PERM-DISPOSAL-CREATE', 'disposal.create', 'Create disposal request'),
('PERM-DISPOSAL-APPROVE', 'disposal.approve', 'Approve disposal'),
('PERM-DISPOSAL-EXECUTE', 'disposal.execute', 'Execute disposal'),

-- Security
('PERM-GATE-VIEW', 'gate.view', 'View gate passes'),
('PERM-GATE-VERIFY', 'gate.verify', 'Verify gate movement'),

-- Reports
('PERM-REPORT-VIEW', 'report.view', 'View reports'),
('PERM-REPORT-EXPORT', 'report.export', 'Export reports'),

-- Audit
('PERM-AUDIT-VIEW', 'audit.view', 'View audit logs');


-- ============================================================
-- END OF SCHEMA
-- ============================================================