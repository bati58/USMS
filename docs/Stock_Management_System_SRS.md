# Stock Management System — SRS

## SOFTWARE REQUIREMENTS SPECIFICATION

### Stock Management System (SMS)
*Property, Store and Fixed-Asset Administration Module*

**Prepared by:** [Your Name / Team Names]  
**Department:** Computer Science and Engineering  
**Submitted to:** [Company / Supervisor Name]  
**Version:** 2.0 — Revised with Official Property Administration Workflow  
**Date:** August 2026

---

## Table of Contents

1. [Acknowledgement](#acknowledgement)
2. [Abstract](#abstract)
3. [Chapter One: Introduction](#chapter-one-introduction)
4. [Chapter Two: Overall Description of the Existing System](#chapter-two-overall-description-of-the-existing-system)
5. [Chapter Three: Overall Description of the Proposed System](#chapter-three-overall-description-of-the-proposed-system)
6. [Chapter Four: System Design](#chapter-four-system-design)
7. [References](#references)
8. [Appendix A: Glossary](#appendix-a-glossary)
9. [Appendix B: Sample Forms](#appendix-b-sample-forms)
10. [Appendix C: Abbreviations and Acronyms](#appendix-c-abbreviations-and-acronyms)

---

## Acknowledgement

First and foremost, we would like to express our sincere gratitude to Almighty God for granting us the strength, wisdom, and determination to prepare this project requirement document.

We would also like to extend our heartfelt appreciation to our advisors and instructors for their valuable guidance, constructive comments, and continuous support throughout the analysis and design phases of this project.

Our special thanks go to the Department of Computer Science and Engineering and our university for providing us with the knowledge, resources, and academic environment necessary for the preparation of this work.

We are especially grateful to our company supervisor for providing the detailed official use-case workflow for goods receipt, technical evaluation, store issuing, fixed-asset registration, and disposal management, which forms the professional core of this revised specification.

We are also grateful to the staff members and stakeholders who shared their knowledge and experience in inventory and property management, which greatly contributed to the requirement-gathering and system-design activities.

Finally, we would like to thank our families and friends for their encouragement, patience, and moral support during the preparation of this project.

---

## Abstract

The Stock Management System (SMS) is a web-based application designed to automate and formalize property and inventory administration within an organization, in line with standard government property administration procedures. The system replaces manual, paper-based bin cards, stock record cards, requisition forms, and issue vouchers with an integrated, auditable digital platform.

Beyond basic stock receiving and issuing, the system implements the organization's official material lifecycle: temporary goods receipt pending Technical Evaluation Committee (TEC) inspection, formal Goods Receiving Note (GRN / Model 19) generation, automatic Stock Card and Bin Card maintenance, Store Requisition and Store/Inter-Store Issue Voucher (SIV/ISIV, Model 20 and Model 22) approval chains, fixed-asset registration with per-user asset custody cards, material return (Store Return Note) evaluation, inter-store transfers, and a full shelf-life monitoring and disposal workflow.

The system supports FIFO inventory valuation, role-based access control across all actors (Administrator, Property Administration Officer, Store Head, Technical Evaluation Committee, Property Registration Officer, Disposal Committee, Accountant, Department Head, Security Officer, and Supplier), and comprehensive audit logging to guarantee transparency and accountability.

The project follows the Agile software development methodology and will be implemented using React.js, Node.js, Express.js, and PostgreSQL. The proposed Stock Management System is expected to eliminate paper-based bottlenecks, enforce approval controls at every stage of the material lifecycle, and provide real-time, audit-ready inventory and asset information to support institutional decision-making.

---

## Chapter One: Introduction

### 1.1 Background

Inventory and property management play a vital role in the daily operations of organizations such as government institutions, universities, hospitals, warehouses, and private companies. Every organization depends on materials, equipment, and fixed assets to carry out its activities efficiently, and proper stewardship of these resources — from receipt through disposal — is essential to accountability and operational continuity.

Traditionally, many organizations manage inventory using manual methods: paper requisition forms, bin cards, stock record cards, handwritten Goods Receiving Notes (Model 19), and Store Issue Vouchers (Model 20/22). While these forms and controls are well established, performing them manually is time-consuming, difficult to reconcile, and highly vulnerable to human error, record loss, and delayed reporting.

The proposed Stock Management System digitizes this entire official workflow — including technical evaluation of received and returned materials, fixed-asset custody tracking, and a governed disposal process — while preserving the control points and approval chain the organization already relies on.

### 1.2 Statement of the Problem

The major problems of the existing manual system include:

- Difficulty tracking stock and fixed-asset movement across multiple stores.
- Human error during data recording on bin cards and stock record cards.
- Loss or duplication of paper-based requisition, GRN, and SIV/ISIV records.
- Delays in Technical Evaluation Committee inspection scheduling and reporting.
- Overstocking, stock shortages, and undetected shelf-life expiry.
- Inaccurate inventory and fixed-asset valuation.
- Poor monitoring of damaged, obsolete, and disposal-pending items.
- Lack of transparency in the approval chain for requisitions, issues, returns, and transfers.
- Limited real-time visibility into stock and asset custody.
- Difficulty conducting stock taking, reconciliation, and periodic asset verification.

### 1.3 Purpose of the Project

The purpose of this project is to design and develop a web-based Stock Management System that automates the organization's complete material and fixed-asset lifecycle — store setup, goods receipt and technical evaluation, GRN issuance, stock/bin card maintenance, requisitioning, issuing, fixed-asset custody, returns, inter-store transfers, and disposal — while minimizing manual work, reducing error, and improving transparency and accountability at every approval stage.

### 1.4 Objectives

#### 1.4.1 General Objective

To design and develop a computerized Stock and Property Management System that automates and governs the full material lifecycle in accordance with the organization's official procedures.

#### 1.4.2 Specific Objectives

- To develop a secure, role-based authentication and authorization system.
- To manage store, department, and cafeteria store information and their item categories and locations.
- To register suppliers and manage supplier information.
- To digitize goods receipt, Technical Evaluation Committee inspection, and GRN (Model 19) generation.
- To automatically maintain Stock Record Cards and Bin Cards for every material and storage location.
- To digitize Store Requisition, and Store/Inter-Store Issue Voucher approval and generation (Model 20/22).
- To register and track fixed assets and maintain per-custodian User-Cards.
- To manage material returns (Store Return Notes) with technical evaluation and approval.
- To manage inter-store material transfer requests and approvals.
- To automatically monitor shelf life/expiry and manage the disposal workflow.
- To implement FIFO inventory valuation.
- To monitor reorder levels and safety stock.
- To generate inventory, asset, and audit reports and analytics.
- To maintain a complete, tamper-evident audit log of all system activity.

### 1.5 Feasibility Study

#### 1.5.1 Technical Feasibility

The proposed system can be developed using modern, widely available technologies:

- **Frontend:** React.js / Next.js
- **Backend:** Node.js and Express.js
- **Database:** PostgreSQL
- **API:** REST API with JWT-based authentication
- **Version Control:** Git and GitHub

#### 1.5.2 Economic Feasibility

The project is economically feasible. The estimated development cost is 16,500 ETB (revised from the original estimate to reflect the expanded official workflow — see the updated cost schedule in Section 1.12). This cost is low relative to the long-term benefits: reduced paperwork, fewer inventory and asset losses from poor tracking, faster stock taking, and stronger audit compliance. The cost of continuing with the manual system — including losses from undetected shelf-life expiry, unrecorded asset custody, and delayed reconciliation — significantly exceeds the investment required.

#### 1.5.3 Operational Feasibility

The system is operationally feasible. It mirrors the organization's existing approval chain (Store Head, Technical Evaluation Committee, Property Registration Officer, PAO, Disposal Committee) rather than replacing it, so adoption requires workflow digitization and training rather than a change in institutional policy. Management support and the clear need to resolve current control gaps increase the likelihood of successful adoption.

#### 1.5.4 Schedule Feasibility

Given the expanded official-workflow scope, the total development period is revised to approximately 16 weeks (requirement gathering — 1 week, analysis — 1 week, design — 2 weeks, database design — 1.5 weeks, implementation — 6 weeks, testing — 2.5 weeks, deployment — 1 week, documentation — 1 week). This timeline is realistic for the additional modules (goods evaluation, fixed assets, disposal workflow) now in scope.

### 1.6 Scope and Limitations

#### 1.6.1 Scope

The system will provide the following functionalities:

- Store, department, and category setup and item location management
- Goods receipt, technical evaluation, and GRN (Model 19) generation
- Automated Stock Record Card and Bin Card maintenance
- Store Requisition and Store/Inter-Store Issue Voucher workflow (Model 20 and Model 22)
- Fixed-asset registration and per-custodian User-Card management
- Material return (Store Return Note) evaluation and approval
- Inter-store material transfer request and approval
- Automated shelf-life monitoring and governed disposal workflow
- Stock valuation using FIFO
- Stock taking and reconciliation
- Report generation and analytics dashboard
- Role-based access control and full audit logging

#### 1.6.2 Limitations

The first version of the system will not support:

- Native mobile application (the web interface will be responsive/mobile-friendly instead)
- AI-based demand forecasting
- Barcode/QR or RFID scanning hardware integration (the data model will be barcode-ready for a future phase)
- Offline synchronization for disconnected sites
- Direct integration with external banking or ERP/finance systems
- Multi-organization (multi-tenant) support beyond the single institution's stores

### 1.7 Significance of the Project

- Eliminating paper-based bin cards, stock cards, GRNs, and issue vouchers.
- Enforcing the official technical-evaluation and multi-level approval chain electronically.
- Improving inventory and fixed-asset accuracy and custody traceability.
- Increasing operational efficiency across receipt, issue, transfer, return, and disposal.
- Improving transparency and accountability through complete audit logs.
- Supporting better, faster institutional decision-making.
- Providing real-time inventory and asset information.
- Reducing losses from undetected expiry, damage, and unauthorized custody gaps.
- Simplifying stock taking, reconciliation, and periodic asset verification.

### 1.8 Methodology

The project follows the Agile software development methodology, comprising requirement gathering, system analysis, system design, implementation, testing, deployment, and maintenance.

#### 1.8.1 Requirement Gathering

Requirements were collected through interviews with the Property Administration Officer (PAO), Store Heads, Technical Evaluation Committee members, the Property Registration Officer, stock clerks, department heads, and the accountant; direct observation of the existing receipt, evaluation, issuing, return, transfer, and disposal procedures; and review of official forms including Model 19 (GRN), Model 20 (preliminary SIV/ISIV), and Model 22 (final SIV/ISIV).

From these activities, the following key information was obtained:

- The complete official material lifecycle from receipt to disposal
- The multi-stage approval chain and the actors responsible at each stage
- Required inventory and fixed-asset reports and the FIFO valuation method
- Business rules governing technical evaluation, issuing, and disposal

#### 1.8.2 System Analysis and Design

System requirements, architecture, database design, and user interfaces are analyzed and designed based on the gathered requirements and the official workflow described in Chapter Three.

#### 1.8.3 Development Tools

| Category | Tool |
|---|---|
| Frontend | React.js / Next.js |
| Backend | Node.js / Express.js |
| Database | PostgreSQL |
| API Testing | Postman |
| Design Tool | Figma |
| IDE | Visual Studio Code |
| Version Control | Git and GitHub |
| Documentation | Microsoft Word |

### 1.9 Testing Procedure

The following testing methods will be used to verify the system:

- Unit testing
- Integration testing
- System testing
- User acceptance testing (including PAO, TEC, and Store Head sign-off)
- Performance testing
- Security testing

### 1.10 Team Composition

| Role | Responsibility |
|---|---|
| Project Manager | Manages the project |
| System Analyst | Analyzes requirements |
| UI/UX Designer | Designs interfaces |
| Frontend Developer | Develops the user interface |
| Backend Developer | Develops APIs and business logic |
| Database Administrator | Designs and manages the database |
| Tester | Tests the system |
| Documentation Specialist | Prepares project documents |

### 1.11 Task and Schedule

| Task | Duration |
|---|---|
| Requirement gathering | 1 week |
| System analysis | 1 week |
| System design | 2 weeks |
| Database design | 1.5 weeks |
| Implementation | 6 weeks |
| Testing | 2.5 weeks |
| Deployment | 1 week |
| Documentation | 1 week |

### 1.12 Cost Schedule

| Item | Estimated Cost (ETB) |
|---|---|
| Internet and communication | 2,500 |
| Transportation | 2,000 |
| Documentation and printing | 2,500 |
| Software tools | 1,500 |
| Hosting and deployment | 4,500 |
| Miscellaneous expenses | 3,500 |
| **Total** | **16,500** |

---

## Chapter Two: Overall Description of the Existing System

### 2.1 Description of the Existing System

The existing property and inventory management process is primarily manual and paper-based. Departments request materials from the store using Store Requisition forms; storekeepers record receipt and issue on bin cards and stock record cards; and technical evaluation of received or returned materials is conducted informally and documented on paper.

The process spans store receiving, technical inspection, GRN preparation, storage, requisition, issuing, fixed-asset custody tracking, returns, inter-store transfers, and eventual disposal of damaged or obsolete materials — all currently performed with manual forms (Model 19, Model 20, Model 22) and physical signatures.

Although the current process embeds sound controls (technical evaluation, multi-level approval, gate passes), it lacks automation, real-time visibility, and reliable audit trails, making reconciliation, reporting, and asset accountability difficult.

### 2.2 Major Functions of the Existing System

- Registration and classification of store items by store and category.
- Receiving and technical inspection of goods.
- Preparation of Goods Receiving Notes (Model 19).
- Storage and bin/location assignment.
- Store Requisition, approval, and issuing via SIV/ISIV (Model 20/22).
- Fixed-asset registration and custody tracking via User-Cards.
- Material return, technical evaluation, and reinstatement or disposal referral.
- Inter-store material transfer.
- Monitoring shelf life, damage, and obsolescence.
- Disposal request and committee-approved disposal.
- Stock taking and reconciliation.
- Preparation of inventory and asset reports.

### 2.3 Users (Actors) of the Current System

**Administrator**
Manages user accounts, roles, and overall system configuration.

**Property Administration Officer (PAO)**
Supervises all inventory and property activities; approves store requisitions, issue vouchers, transfers, and disposal requests.

**Store Head**
Oversees a specific store (main store, department store, or cafeteria store); records goods receipt, prepares preliminary issue vouchers, and finalizes issuing.

**Storekeeper / Stock Clerk**
Receives, stores, and issues materials; updates bin cards and assists the Store Head with day-to-day stock records.

**Technical Evaluation Committee (TEC)**
Inspects received and returned materials and records acceptance/rejection or condition decisions.

**Property Registration Officer**
Finalizes GRNs, registers fixed assets, and maintains custodian User-Cards.

**Department Head**
Initiates and approves requisitions and returns on behalf of their department; accountable for assets held by their staff.

**Accountant**
Records the financial value of inventory and fixed assets and prepares financial and write-off reports.

**Disposal Committee**
Reviews disposal requests and approves the method of disposal (auction, destruction, donation, or write-off).

**Security Officer**
Controls the movement of materials entering or leaving the organization's premises, verifying issue vouchers and gate passes.

**Supplier**
External party supplying materials against purchase or donation documents.

### 2.4 Drawbacks of the Current System

- Heavy dependence on paper documents (Model 19, Model 20, Model 22, bin cards, stock cards).
- Time-consuming, multi-step manual approval routing.
- Difficulty tracking stock and fixed-asset movement across stores.
- High possibility of human error and duplicate or missing records.
- Delayed technical evaluation and report generation.
- Inaccurate inventory and asset valuation.
- Limited, non-real-time access to inventory and custody information.
- Lack of data security and tamper-evident audit trails.
- Poor, inconsistent monitoring of damaged, obsolete, and disposal-pending items.
- Difficulty verifying fixed-asset custody per user/office.
- Poor communication between store, technical evaluation, and approval actors.

### 2.5 Business Rules

- Every inventory item and fixed asset must have a unique item/asset code.
- All received goods must be recorded as a temporary receipt and inspected by the Technical Evaluation Committee before being accepted into stock.
- A Goods Receiving Note (Model 19) may only be generated after both Store Head confirmation and TEC approval are recorded.
- Only authorized personnel may approve requisitions, issue vouchers, transfers, returns, and disposal requests.
- Materials cannot be issued without an approved Store Requisition and an approved Store/Inter-Store Issue Voucher (Model 20, finalized as Model 22).
- Every inventory and asset transaction must be recorded and is immutable once posted (corrections require a reversing entry, not deletion).
- Every material must have a corresponding Stock Record Card and, per storage bin, a Bin Card, both maintained automatically by the system.
- Inventory valuation must follow the FIFO (First-In-First-Out) principle.
- Physical stock taking and fixed-asset verification must be conducted at least once every fiscal year.
- Returned materials must undergo Technical Evaluation Committee assessment before being reinstated to stock or referred for disposal.
- Damaged, expired, or obsolete items must be flagged, evaluated, and processed only through the formal disposal workflow.
- Disposal of any item requires Disposal Committee approval; no item may be removed from records without an approved disposal decision.
- Materials leaving the organization must be accompanied by an authorized, system-generated issue voucher and gate pass.
- Fixed assets must be assigned to a named custodian and reflected on that custodian's User-Card at all times.
- Reorder levels and safety stock must be maintained to avoid stock shortages.
- Only authenticated, authorized users may access inventory and asset information, scoped to their role.

---

## Chapter Three: Overall Description of the Proposed System

### 3.1 Functional Requirements

Functional requirements are grouped below by module, reflecting the official store and property administration workflow.

#### 3.1.1 Authentication, Users and Suppliers

- User login, logout, and password management with role-based access control.
- Register, update, and deactivate user accounts (accounts are deactivated, never hard-deleted, to preserve the audit trail).
- Assign and modify user roles and permissions.
- Register, update, and deactivate supplier records; search suppliers.

#### 3.1.2 Store, Category and Location Management

- Register and manage multiple stores (main store, department stores, cafeteria store, etc.).
- Maintain item categories scoped to the owning store.
- Maintain and update the physical location of materials within stores (warehouse, shelf, bin).

#### 3.1.3 Goods Receipt and Technical Evaluation

- Record temporary goods receipt for fixed and non-fixed assets, verified against purchase/donation documents.
- Notify the Technical Evaluation Committee automatically upon receipt.
- Record TEC evaluation decisions (approve/reject) with remarks.
- Generate the official Goods Receiving Note (GRN / Model 19) once all approvals are recorded.

#### 3.1.4 Stock Card and Bin Card Management

- Automatically create and update Stock Record Cards for every material on every transaction (receipt, issue, return, transfer).
- View current stock levels and full transaction history per item.
- Automatically generate and update Bin Cards per storage bin, capturing transaction direction, supporting document reference, and location.
- Transfer stock between bins within the same store with automatic balance recalculation.

#### 3.1.5 Store Requisition and Issuing

- Create and manage Store Requisition (SR) forms.
- Approve, reject, or amend Store Requisitions.
- Create preliminary Store/Inter-Store Issue Vouchers (SIV/ISIV, Model 20) from approved requisitions.
- Approve and amend preliminary SIV/ISIV records.
- Generate the final Store/Inter-Store Issue Voucher (Model 22) and automatically deduct issued stock.

#### 3.1.6 Fixed Asset Management

- Register fixed assets with unique tags, acquisition details, and custodian assignment.
- Maintain per-custodian User-Cards, automatically updated on transfer, return, or disposal.
- Track fixed-asset depreciation status and periodic verification schedule.

#### 3.1.7 Returns and Transfers

- Create Material Return Requests (Store Return Notes / SRN).
- Record Technical Evaluation Committee results for returned materials.
- Approve or reject store returns, reinstating serviceable stock or referring items to disposal.
- Initiate and approve/reject inter-store Material Transfer Requests.

#### 3.1.8 Shelf-Life Monitoring and Disposal

- Automatically monitor shelf life/expiry and material condition status.
- Flag damaged, expired, or obsolete items for disposal.
- Compile and route Disposal Requests with supporting documentation.
- Manage the full Disposal Committee workflow through to final write-off.

#### 3.1.9 Reporting and Audit

- Generate inventory, stock-movement, fixed-asset, supplier, disposal, and financial-valuation reports.
- Export reports to PDF/Excel and support printing.
- Record all user activity in a tamper-evident audit log; provide filterable audit-log viewing.
- Provide a role-specific analytics dashboard (stock levels, low-stock/reorder alerts, pending approvals, near-expiry items).

### 3.2 Non-Functional Requirements

#### Performance Requirements

- The system shall respond to standard user requests within 3 seconds under normal load.
- The system shall support at least 100 concurrent authenticated users without degradation.
- Report generation for up to 12 months of transaction data shall complete within 10 seconds.

#### Security Requirements

- All users must authenticate via a secure login mechanism before accessing the system.
- Passwords shall be stored using a strong, salted hashing algorithm (e.g. bcrypt).
- Role-based access control shall restrict every module and action to authorized roles only.
- All approval, disposal, and financial actions shall require re-confirmation and be permanently logged.
- The system shall enforce HTTPS/TLS for all client-server communication.

#### Reliability and Availability Requirements

- The system shall target 99.5% uptime during working hours.
- Automated daily database backups shall be maintained with a defined recovery point objective of 24 hours.
- Data consistency shall be enforced through database transactions, particularly for stock/bin card updates.

#### Usability Requirements

- The interface shall be simple, role-tailored, and usable with minimal training.
- The system shall be responsive and usable on desktop and tablet screen sizes.

#### Scalability and Maintainability Requirements

- The system shall support additional stores, categories, and future modules (e.g. barcode scanning) without redesign.
- The codebase shall follow a modular, layered architecture to simplify maintenance and updates.

### 3.3 System Model

The Stock Management System consists of the following components: User Interface Layer, Business Logic Layer, Database Layer, Authentication Module, Store/Inventory Module, Fixed Asset Module, Evaluation & Approval Module, Disposal Module, Reporting Module, and Notification Module.

#### 3.3.1 Representative Scenario: Goods Receipt through GRN

1. The Store Head logs into the system and records a temporary goods receipt against a purchase/donation document.
2. The system notifies the Technical Evaluation Committee.
3. The TEC inspects the materials and records an Approve/Reject decision.
4. On approval, the Property Registration Officer finalizes and the system generates the GRN (Model 19).
5. The system automatically updates the relevant Stock Card and Bin Card.
6. The materials become available for requisition and issuing.

### 3.4 Use Case Model

#### 3.4.1 Actor Identification

- Administrator
- Property Administration Officer (PAO)
- Store Head
- Storekeeper / Stock Clerk
- Technical Evaluation Committee (TEC)
- Property Registration Officer
- Department Head
- Accountant
- Disposal Committee
- Security Officer
- Supplier

#### 3.4.2 Use Case Identification

**Authentication, Users and Suppliers**
- Login
- Logout
- Manage Users and Roles
- Manage Suppliers

**Store and Item Setup**
- Manage Store Information
- Maintain Item Category
- Maintain Item Location

**Goods Receipt and Technical Evaluation**
- Record Goods Receipt
- Evaluate Materials for Acceptance
- Generate Goods Receiving Note (GRN – Model 19)

**Stock Card and Bin Card**
- Auto-Update Stock Card
- View Stock Card
- Manage Bin Card
- Transfer Stock Between Bins

**Store Requisition and Issuing**
- Manage Store Requisition
- Approve/Reject Store Requisition
- Create Preliminary SIV/ISIV (Model 20)
- Approve and Amend SIV/ISIV (Model 20)
- Generate SIV/ISIV (Model 22)

**Fixed Assets**
- Manage Fixed Assets Registration
- Manage User-Card

**Returns**
- Create Material Return Request (SRN)
- Record Technical Evaluation Result (Return)
- Approve/Reject Store Return

**Inter-Store Transfer**
- Initiate Material Transfer Request
- Approve/Reject Material Transfer

**Shelf-Life and Disposal**
- Auto-Monitor Shelf Life and Status
- Flag Items for Disposal
- Manage Disposal Request
- Manage Disposal Workflow

**Reporting and Audit**
- Generate Reports and Analytics
- View Audit Logs

#### 3.4.3 Use Case Descriptions

> Note: The use case diagram should be redrawn by the team to reflect the actors and use cases listed above; it is omitted here pending updated UML artwork.

---

### Authentication, Users and Suppliers

#### Use Case: Login

**Actor(s):** All registered users  
**Precondition:** A valid user account exists.

**Main Flow:**
1. User enters username and password (or organizational SSO credentials).
2. System validates the credentials and account status.
3. System establishes a role-based session and directs the user to their role-specific dashboard.

**Postcondition:** The user is authenticated and granted access appropriate to their assigned role.

---

#### Use Case: Logout

**Actor(s):** All registered users  
**Precondition:** The user has an active session.

**Main Flow:**
1. User selects logout.
2. System terminates the active session and clears session tokens.

**Postcondition:** The user's session is securely closed.

---

#### Use Case: Manage Users and Roles

**Actor(s):** Administrator  
**Precondition:** Administrator is authenticated.

**Main Flow:**
1. Administrator registers a new user and assigns a role (e.g. Store Head, TEC member, PAO, Accountant, Department Head).
2. Administrator may update user details or deactivate (not permanently delete) a user account to preserve the audit trail.
3. System enforces role-based access control on all subsequent actions by that user.

**Postcondition:** User accounts and role assignments are accurately maintained without loss of historical audit data.

---

#### Use Case: Manage Suppliers

**Actor(s):** PAO, Store Head  
**Precondition:** Administrator or authorized user is authenticated.

**Main Flow:**
1. User registers a new supplier with contact and business details.
2. User updates supplier information or deactivates a supplier no longer in use.
3. User searches and filters suppliers for reporting and procurement reference.

**Postcondition:** Supplier records are accurate and available for goods-receipt verification.

---

#### Use Case: Generate Reports and Analytics

**Actor(s):** PAO, Accountant, Store Head, Administrator  
**Precondition:** Relevant transactional data exists in the system.

**Main Flow:**
1. User selects a report type (stock status, movement, valuation, requisition, disposal, audit, etc.) and filter criteria.
2. System compiles the report from live transactional data.
3. System displays the report and allows export to PDF or Excel, and printing.

**Postcondition:** An accurate, current report is produced to support decision-making and compliance.

---

#### Use Case: View Audit Logs

**Actor(s):** Administrator, PAO  
**Precondition:** System activity has occurred.

**Main Flow:**
1. User opens the Audit Log module.
2. User filters logs by user, date range, module, or action type.
3. System displays a read-only, tamper-evident record of the selected activity.

**Postcondition:** Full traceability of system actions is available for accountability and compliance review.

---

### Store and Item Setup

#### Use Case: Manage Store Information

**Actor(s):** Administrator, Property Administration Officer (PAO)  
**Precondition:** User is authenticated with administrative privileges.

**Main Flow:**
1. User selects "Manage Stores" from the administration menu.
2. User registers a new store (e.g. Main Store, Department Store, Cafeteria Store) with store code, name, type, and responsible Store Head.
3. System validates that the store code is unique.
4. System saves the store record and links it to its parent organizational unit.

**Postcondition:** The store is registered and available for item, category, and requisition assignment.

---

#### Use Case: Maintain Item Category

**Actor(s):** Administrator, Store Head  
**Precondition:** The relevant store has been registered.

**Main Flow:**
1. User selects the store to which the category belongs (Main Store item, Department item, Cafeteria item, etc.).
2. User creates or updates a category, specifying category code, name, and store ownership.
3. System validates the category against existing codes for that store.
4. System saves the category for use during item registration.

**Postcondition:** Items can subsequently be classified under the correct store-specific category.

---

#### Use Case: Maintain Item Location

**Actor(s):** Store Head, Storekeeper  
**Precondition:** The item and its store are already registered in the system.

**Main Flow:**
1. User selects a material and views its current physical location (warehouse/shelf/bin).
2. User updates the location information when a material is physically relocated.
3. System validates that the new location belongs to the same store.
4. System records the change and timestamps the update for traceability.

**Postcondition:** The material's location record reflects its current physical position within the organization's stores.

---

### Goods Receipt and Technical Evaluation

#### Use Case: Record Goods Receipt

**Actor(s):** Store Head, Storekeeper  
**Precondition:** A supplier or donor has delivered materials (fixed or non-fixed assets) to the store.

**Main Flow:**
1. Store Head records the received materials, quantities, and descriptions in the system.
2. System requires the record to be verified against the corresponding purchase order or donation document.
3. System creates a temporary (pending) receipt record with status "Awaiting Evaluation".
4. System automatically notifies the Technical Evaluation Committee (TEC) that inspection is required.

**Alternative / Exception Flow:** If the delivered items do not match the purchase/donation document, the Store Head flags the discrepancy and the receipt is held for review before proceeding.

**Postcondition:** A temporary goods receipt record exists and the TEC has been notified for material inspection.

---

#### Use Case: Evaluate Materials for Acceptance

**Actor(s):** Technical Evaluation Committee (TEC)  
**Precondition:** A temporary goods receipt record with status "Awaiting Evaluation" exists.

**Main Flow:**
1. TEC member opens the pending receipt record and inspects the materials against specification and quality requirements.
2. TEC records the evaluation decision as Approved or Rejected, with supporting remarks.
3. System updates the status of the receipt record accordingly.
4. System notifies the Property Registration Officer of the outcome.

**Postcondition:** The receipt record is marked Approved or Rejected and the Property Registration Officer is informed to proceed with registration or return-to-supplier.

---

#### Use Case: Generate Goods Receiving Note (GRN)

**Actor(s):** Property Registration Officer, Store Head  
**Precondition:** The receipt record has been Approved by the Technical Evaluation Committee and confirmed by the Store Head.

**Main Flow:**
1. System confirms that all required approvals (Store Head and TEC) are recorded for the receipt.
2. System generates the official Goods Receiving Note (GRN / Model 19) with a unique GRN number.
3. System permanently records the materials into inventory and links the GRN to the Stock Card and Bin Card.
4. GRN is made available for printing and archival.

**Postcondition:** A finalized, numbered GRN (Model 19) exists and the received materials are posted into stock.

---

### Stock Card and Bin Card Management

#### Use Case: Auto-Update Stock Card

**Actor(s):** System (automated), Store Head  
**Precondition:** A stock transaction (receipt, issue, return, or transfer) has been posted.

**Main Flow:**
1. System detects a completed inventory transaction referencing a material.
2. System automatically creates a digital Stock Record Card (SRC) if none exists for that material.
3. System appends the transaction (quantity, date, reference document) to the existing SRC.
4. System recalculates the running balance using the FIFO valuation method.

**Postcondition:** The Stock Record Card for the material reflects an accurate, up-to-date running balance without manual entry.

---

#### Use Case: View Stock Card

**Actor(s):** Store Head, Stock Clerk, Accountant, PAO  
**Precondition:** The user has appropriate viewing permissions.

**Main Flow:**
1. User searches for a material by item code or name.
2. System displays the Stock Record Card showing current balance and full transaction history.
3. User may filter the history by date range or transaction type.
4. User may export the Stock Card as PDF or Excel.

**Postcondition:** The user obtains an accurate view of current stock levels and historical movement for the selected material.

---

#### Use Case: Manage Bin Card

**Actor(s):** System (automated), Store Head  
**Precondition:** A material is introduced to, or reassigned within, a storage bin.

**Main Flow:**
1. System detects that a material has been placed into a previously unused bin, or reassigned to a new bin location.
2. System dynamically generates a new Bin Card for that bin if one does not already exist.
3. System records every inventory movement on the Bin Card, capturing transaction direction (inbound/outbound), the supporting document reference (GRN, SIV/ISIV, or SRN), and the exact storage location.
4. System instantly recomputes and updates the quantity-on-hand for the bin after each transaction.

**Postcondition:** Each active bin maintains a perpetually accurate, self-updating record of quantity-on-hand and movement history.

---

#### Use Case: Transfer Stock Between Bins

**Actor(s):** Store Head, Storekeeper  
**Precondition:** The material and both source and destination bins exist within the same store.

**Main Flow:**
1. User selects the material, source bin, destination bin, and quantity to move.
2. System validates that sufficient quantity is available in the source bin.
3. System decreases the source Bin Card balance and increases (or creates) the destination Bin Card balance.
4. System logs the internal transfer for audit purposes.

**Postcondition:** Bin Card records for both bins reflect the new stock positions, with the movement fully traceable.

---

### Store Requisition and Issuing

#### Use Case: Manage Store Requisition

**Actor(s):** Department Head, Requesting Staff  
**Precondition:** The requesting department is registered in the system.

**Main Flow:**
1. User creates a Store Requisition (SR) Form specifying required items and quantities.
2. System validates item availability against current stock records.
3. User submits the requisition for approval.
4. System routes the requisition to the appropriate approver based on store and department rules.

**Postcondition:** A pending Store Requisition is created and routed for approval.

---

#### Use Case: Approve / Reject Store Requisition (SR)

**Actor(s):** Department Head, PAO  
**Precondition:** A pending Store Requisition exists.

**Main Flow:**
1. Approver reviews the requisition details and stock availability.
2. Approver approves or rejects the requisition, optionally amending requested quantities.
3. System updates the requisition status and records the approver's decision and remarks.
4. System notifies the Store Head when a requisition is approved and ready for issuing.

**Postcondition:** The Store Requisition is marked Approved or Rejected and, if approved, is available for issue voucher preparation.

---

#### Use Case: Create Preliminary Store Issue Voucher / Inter-Store Issue Voucher (SIV / ISIV) — Model 20

**Actor(s):** Store Head, Storekeeper  
**Precondition:** An approved Store Requisition exists.

**Main Flow:**
1. Store Head prepares a preliminary Store Issue Voucher / Inter-Store Issue Voucher (SIV/ISIV, Model 20) referencing the approved requisition.
2. System pre-fills item, quantity, and requesting department details from the requisition.
3. System marks the voucher as "Preliminary — Pending Approval".
4. Voucher is routed for approval and possible amendment.

**Postcondition:** A preliminary SIV/ISIV exists, awaiting approval prior to issuing.

---

#### Use Case: Approve and Amend Store Issue Voucher / ISIV (Model 20)

**Actor(s):** PAO, Department Head  
**Precondition:** A preliminary SIV/ISIV exists.

**Main Flow:**
1. Approver reviews the preliminary voucher against the approved requisition and stock availability.
2. Approver may amend item quantities before approving.
3. System records the approval (or rejection) with an audit trail of any amendments.
4. Approved voucher becomes available for final issue note generation.

**Postcondition:** The SIV/ISIV is approved (with any amendments recorded) and ready for finalization.

---

#### Use Case: Generate Store Issue Voucher / ISIV (Model 22)

**Actor(s):** Store Head, Storekeeper  
**Precondition:** An approved SIV/ISIV (Model 20) exists.

**Main Flow:**
1. Store Head finalizes the issuing of materials against the approved voucher.
2. System generates the official Store Issue Voucher / Inter-Store Issue Voucher (Model 22) with a unique reference number.
3. System deducts the issued quantity from the relevant Stock Card and Bin Card.
4. The finalized Model 22 voucher is made available for printing and archival, and the Security Officer is notified for gate clearance where materials leave the premises.

**Postcondition:** Stock quantities are reduced accordingly and an official, numbered issue voucher (Model 22) exists as proof of issue.

---

### Fixed Asset Management

#### Use Case: Manage Fixed Assets Registration

**Actor(s):** Property Registration Officer  
**Precondition:** A material has been received and approved via the GRN process and identified as a fixed asset (non-consumable, capitalizable item).

**Main Flow:**
1. Property Registration Officer registers the fixed asset with a unique asset tag/code, description, acquisition value, and acquisition date.
2. System links the fixed asset record to its originating GRN and to the responsible custodian/department.
3. System creates a corresponding User-Card for the asset custodian.
4. System places the asset under depreciation and periodic physical-verification tracking.

**Postcondition:** The fixed asset is registered in the Fixed Asset Register with a traceable custody chain from receipt to assignment.

---

#### Use Case: Manage User-Card

**Actor(s):** Property Registration Officer, Department Head  
**Precondition:** A fixed asset has been assigned to a staff member or office.

**Main Flow:**
1. System creates or updates a User-Card listing all fixed assets currently held by an individual user or office.
2. User-Card is updated automatically whenever an asset is transferred, returned, or disposed.
3. Property Registration Officer may print the User-Card for physical verification and sign-off.
4. Department Head confirms accuracy of assets held by their staff during periodic verification.

**Postcondition:** An accurate, up-to-date record of fixed-asset custody per user/office is maintained at all times.

---

### Returns Management

#### Use Case: Create Material Return Request (Store Return Note — SRN)

**Actor(s):** Department Head, Requesting Staff  
**Precondition:** The material was previously issued to the requesting department.

**Main Flow:**
1. User initiates a Store Return Note (SRN) specifying the material, quantity, and reason for return.
2. System validates the material against previous issue records.
3. System creates the SRN with status "Pending Technical Evaluation".
4. System notifies the Technical Evaluation Committee for inspection of the returned material.

**Postcondition:** A pending Store Return Note is created and routed for technical evaluation.

---

#### Use Case: Record Technical Evaluation Result (Return)

**Actor(s):** Technical Evaluation Committee (TEC)  
**Precondition:** A pending Store Return Note exists.

**Main Flow:**
1. TEC inspects the condition of the returned material (serviceable, damaged, or obsolete).
2. TEC records the evaluation result and condition classification on the SRN.
3. System updates the SRN status based on the recorded result.
4. System notifies the Store Head of the outcome for stock reinstatement or disposal referral.

**Postcondition:** The returned material's condition is documented and the SRN reflects the technical evaluation outcome.

---

#### Use Case: Approve / Reject Store Return

**Actor(s):** PAO, Store Head  
**Precondition:** The Store Return Note has a recorded technical evaluation result.

**Main Flow:**
1. Approver reviews the SRN and technical evaluation outcome.
2. Approver approves the return (reinstating serviceable stock) or rejects it (referring damaged/obsolete items for disposal).
3. System updates the Stock Card and Bin Card if the return is approved and reinstated.
4. System closes the SRN and archives it for audit purposes.

**Postcondition:** The return is finalized: stock is either reinstated or the item is routed toward the disposal workflow.

---

### Inter-Store Transfer

#### Use Case: Initiate Material Transfer Request

**Actor(s):** Store Head, Department Head  
**Precondition:** The material exists in the source store's inventory.

**Main Flow:**
1. User initiates a Material Transfer Request specifying source store, destination store, material, and quantity.
2. System validates stock availability at the source store.
3. System creates the transfer request with status "Pending Approval".
4. System routes the request to the PAO for approval.

**Postcondition:** A pending inter-store Material Transfer Request is created.

---

#### Use Case: Approve / Reject Material Transfer

**Actor(s):** PAO  
**Precondition:** A pending Material Transfer Request exists.

**Main Flow:**
1. PAO reviews the transfer request against operational need and stock levels at both stores.
2. PAO approves or rejects the request.
3. On approval, system deducts stock from the source store's Stock/Bin Card and posts it to the destination store's Stock/Bin Card via an Inter-Store Issue Voucher (ISIV).
4. System notifies both Store Heads of the completed transfer.

**Postcondition:** Stock records at both the source and destination stores accurately reflect the completed transfer.

---

### Shelf-Life Monitoring and Disposal Workflow

#### Use Case: Auto-Monitor Shelf Life and Status

**Actor(s):** System (automated)  
**Precondition:** Materials with an expiry date or defined obsolescence criteria exist in inventory.

**Main Flow:**
1. System periodically scans inventory records for items approaching or past their shelf-life/expiry date, or that are marked damaged.
2. System automatically updates the material's status (e.g. Near-Expiry, Expired, Damaged) on the Stock Card.
3. System generates an alert/notification to the Store Head and PAO for flagged items.
4. Flagged items become eligible for the disposal workflow.

**Postcondition:** Items nearing expiry, expired, or damaged are automatically identified without manual stock review.

---

#### Use Case: Flag Items for Disposal

**Actor(s):** Store Head, Technical Evaluation Committee  
**Precondition:** An item has been identified as damaged, obsolete, expired, or otherwise unserviceable.

**Main Flow:**
1. User (or the system, via shelf-life monitoring) flags the item as a candidate for disposal.
2. TEC confirms the item's condition and disposal justification.
3. System changes the item's status to "Pending Disposal" and removes it from usable stock counts.
4. System adds the item to the Disposal Request queue.

**Postcondition:** The item is excluded from available stock and queued for formal disposal processing.

---

#### Use Case: Manage Disposal Request

**Actor(s):** Store Head, PAO  
**Precondition:** One or more items are flagged "Pending Disposal".

**Main Flow:**
1. Store Head compiles flagged items into a formal Disposal Request.
2. System attaches supporting documentation (TEC evaluation, original GRN, current status).
3. PAO reviews the request and forwards it to the Disposal Committee for final decision.
4. System records the request status and routing history.

**Postcondition:** A documented Disposal Request is submitted to the Disposal Committee for approval.

---

#### Use Case: Manage Disposal Workflow

**Actor(s):** Disposal Committee, PAO, Accountant  
**Precondition:** A Disposal Request has been submitted for review.

**Main Flow:**
1. Disposal Committee reviews the request and decides the disposal method (auction, destruction, donation, or write-off).
2. Committee records its decision and required approvals in the system.
3. Upon final approval, system permanently removes the item from active inventory and Fixed Asset Register (where applicable).
4. Accountant is notified to record the corresponding financial write-off, and the system archives the complete disposal record for audit.

**Postcondition:** The disposed item is formally removed from stock/asset records with a complete, auditable disposal history.

---

### 3.5 Object Model

#### 3.5.1 Data Dictionary

| Entity | Description |
|---|---|
| User | Stores user account and authentication information |
| Role | Stores user roles and permissions |
| Store | Represents a store (main, department, cafeteria) |
| Category | Item categories, scoped to a store |
| Supplier | Supplier/donor details |
| Item | Master record of a material (fixed or non-fixed asset) |
| ItemLocation | Current physical location of an item within a store |
| GoodsReceipt | Temporary and finalized receipt records |
| TechnicalEvaluation | TEC inspection decisions for receipts and returns |
| GRN | Goods Receiving Note (Model 19) records |
| StockCard | Auto-maintained running balance and history per item |
| BinCard | Auto-maintained running balance and history per bin |
| StoreRequisition | Requisition (SR) records and approval status |
| IssueVoucher | Preliminary and final SIV/ISIV records (Model 20/22) |
| FixedAsset | Fixed asset register with custody and depreciation data |
| UserCard | Per-custodian record of assigned fixed assets |
| StoreReturnNote | Material return (SRN) records |
| MaterialTransfer | Inter-store transfer requests and approvals |
| DisposalRequest | Disposal candidates and committee decisions |
| Report | Generated report metadata |
| AuditLog | Immutable record of all system activity |

> Note: The class diagram, sequence diagrams, activity diagram, and state chart should be redrawn by the team using the entities and use cases above; existing UML artwork should be revised to include GoodsReceipt, TechnicalEvaluation, GRN, BinCard, IssueVoucher, FixedAsset, UserCard, StoreReturnNote, MaterialTransfer, and DisposalRequest.

### 3.6 Dynamic Model (Summary)

**Key Sequences**

- Login sequence: credential submission → validation → session grant.
- Goods receipt sequence: temporary receipt → TEC evaluation → GRN generation → stock/bin card update.
- Issuing sequence: requisition → approval → preliminary SIV/ISIV → approval/amendment → final SIV/ISIV → stock deduction.
- Disposal sequence: shelf-life flag or manual flag → TEC confirmation → disposal request → committee decision → write-off.

**Inventory / Fixed-Asset States**

- Pending Evaluation
- Available
- Reserved
- Issued
- Returned – Pending Evaluation
- Damaged
- Near-Expiry / Expired
- Pending Disposal
- Disposed

---

## Chapter Four: System Design

### 4.1 Overview

System design transforms the requirements gathered during analysis into a complete blueprint for implementation. The proposed Stock Management System follows a three-tier architecture consisting of the presentation layer, business logic layer, and database layer, designed to enforce the official approval workflow at each stage of the material lifecycle.

### 4.2 Purpose of the System Design

- To transform system requirements into technical specifications.
- To define the architecture and interaction of system components.
- To design a database structure that enforces the receipt-evaluation-issue-return-disposal lifecycle.
- To improve system performance and security.
- To simplify future maintenance and upgrades.
- To ensure data consistency, integrity, and full auditability.

### 4.3 Design Goals

| Goal | Description |
|---|---|
| **Security** | Protect user, inventory, and fixed-asset data through authentication, role-based authorization, and encryption. |
| **Reliability** | Provide accurate, dependable inventory and asset information at every workflow stage. |
| **Auditability** | Guarantee that every receipt, evaluation, issue, return, transfer, and disposal action is permanently and transparently logged. |
| **Scalability** | Support additional stores, categories, and future functionality (e.g. barcode scanning). |
| **Maintainability** | Support future updates via a modular architecture. |
| **Usability** | Present each actor with a role-tailored, simple interface. |

### 4.4 Proposed System Architecture

The system follows a three-tier architecture: Presentation layer (React.js frontend), Application layer (Node.js/Express.js backend with REST APIs), and Data layer (PostgreSQL database).

#### 4.4.1 Subsystem Decomposition

| Subsystem | Responsibility |
|---|---|
| Authentication Subsystem | Login, logout, password management, session management |
| User & Role Management Subsystem | User registration, update, deactivation, role/permission assignment |
| Store & Item Setup Subsystem | Store, category, and item-location management |
| Supplier Management Subsystem | Supplier registration, update, deactivation, search |
| Goods Receipt & Evaluation Subsystem | Temporary receipt, TEC evaluation, GRN (Model 19) generation |
| Stock/Bin Card Subsystem | Automated Stock Card and Bin Card maintenance, bin-to-bin transfer |
| Requisition & Issuing Subsystem | Store Requisition, SIV/ISIV (Model 20/22) approval and issuing |
| Fixed Asset Subsystem | Asset registration, depreciation tracking, User-Card management |
| Returns & Transfers Subsystem | Store Return Notes, technical evaluation of returns, inter-store transfers |
| Disposal Subsystem | Shelf-life monitoring, disposal flagging, disposal request and committee workflow |
| Reporting Subsystem | Report generation, analytics dashboard, export |
| Audit Subsystem | Activity tracking, tamper-evident audit logs, security monitoring |

#### 4.4.2 Hardware–Software Mapping

**Hardware Requirements**

| Component | Specification |
|---|---|
| Processor | Intel Core i5 or above |
| RAM | 8 GB minimum |
| Storage | 256 GB SSD |
| Network | Ethernet or Wi-Fi |
| Display | 1366 × 768 or higher |

**Software Requirements**

| Component | Technology |
|---|---|
| Operating System | Windows / Linux |
| Frontend | React.js / Next.js |
| Backend | Node.js / Express.js |
| Database | PostgreSQL |
| API Testing | Postman |
| IDE | Visual Studio Code |
| Version Control | Git and GitHub |

#### 4.4.3 Persistence Data Management

| Object / Class | Database Table |
|---|---|
| User | users |
| Role | roles |
| Store | stores |
| Category | categories |
| Supplier | suppliers |
| Item | items |
| ItemLocation | item_locations |
| GoodsReceipt | goods_receipts |
| TechnicalEvaluation | technical_evaluations |
| GRN | grns |
| StockCard | stock_cards |
| BinCard | bin_cards |
| StoreRequisition | store_requisitions |
| IssueVoucher | issue_vouchers |
| FixedAsset | fixed_assets |
| UserCard | user_cards |
| StoreReturnNote | store_return_notes |
| MaterialTransfer | material_transfers |
| DisposalRequest | disposal_requests |
| Report | reports |
| AuditLog | audit_logs |

The system will use foreign keys and constraints to maintain referential integrity; financial and stock-affecting tables (`goods_receipts`, `issue_vouchers`, `stock_cards`, `bin_cards`, `disposal_requests`) are append-only, with corrections handled via reversing entries rather than deletion.

#### 4.4.4 Access Control (Role-Based Access Control)

| Role | Access / Responsibility |
|---|---|
| Administrator | Full system access; manages users, roles, and configuration |
| Property Administration Officer (PAO) | Approves requisitions, transfers, and disposal requests; monitors all inventory activity |
| Store Head | Receives, stores, and issues stock; prepares preliminary vouchers; maintains item locations |
| Storekeeper / Stock Clerk | Assists with receiving, issuing, and stock/bin card record keeping |
| Technical Evaluation Committee (TEC) | Evaluates received and returned materials |
| Property Registration Officer | Finalizes GRNs; registers and tracks fixed assets and User-Cards |
| Department Head | Initiates and approves requisitions and returns for their department |
| Accountant | Views financial reports; manages inventory and asset valuation and write-offs |
| Disposal Committee | Reviews and approves disposal requests and disposal method |
| Security Officer | Verifies issue vouchers and gate passes for materials leaving the premises |

#### 4.4.5 User Interface (Key Screens)

| Screen | Key Features |
|---|---|
| Login Page | Username field, password field, login button |
| Dashboard | Total inventory/asset counts, low-stock and near-expiry alerts, pending approvals, recent transactions |
| Store & Item Setup | Manage stores, categories, and item locations |
| Goods Receipt Page | Record receipt, view TEC evaluation status, generate GRN (Model 19) |
| Stock Card / Bin Card Viewer | Search item/bin, view running balance and transaction history, export |
| Requisition & Issuing Page | Create requisition, approve/amend, generate SIV/ISIV (Model 20/22) |
| Fixed Asset Registration Page | Register assets, assign custodian, view/print User-Card |
| Returns & Transfers Page | Create SRN, record TEC result, approve return; initiate/approve inter-store transfer |
| Disposal Management Page | View flagged items, compile disposal request, record committee decision |
| Reports Page | Generate, export, and print inventory, asset, and audit reports |

---

## References

- Ministry of Finance and Economic Development (MoFED). *Stock Management Manual*, Addis Ababa, Ethiopia, 2010.
- IEEE Computer Society. *IEEE Recommended Practice for Software Requirements Specifications (IEEE 830-1998)*.
- Ian Sommerville, *Software Engineering*, 10th Edition, Pearson Education, 2015.
- Roger S. Pressman, *Software Engineering: A Practitioner's Approach*, 8th Edition, McGraw-Hill, 2014.
- Abraham Silberschatz, Henry Korth, and S. Sudarshan, *Database System Concepts*, 7th Edition.
- Official documentation for React.js, Node.js, Express.js, and PostgreSQL.

---

## Appendix A: Glossary

| Term | Meaning |
|---|---|
| FIFO | First In, First Out |
| SRS | Software Requirements Specification |
| RBAC | Role-Based Access Control |
| PAO | Property Administration Officer |
| TEC | Technical Evaluation Committee |
| GRN | Goods Receiving Note (Model 19) |
| SR | Store Requisition |
| SIV | Store Issue Voucher (Model 20 / Model 22) |
| ISIV | Inter-Store Issue Voucher |
| SRN | Store Return Note |
| SRC / Stock Card | Stock Record Card |
| Bin Card | Location-level record of stock movement and balance |
| API | Application Programming Interface |
| DBMS | Database Management System |

---

## Appendix B: Sample Forms

- Sample Store Requisition (SR) form
- Sample Goods Receiving Note (GRN – Model 19)
- Sample Store/Inter-Store Issue Voucher (Model 20 – preliminary)
- Sample Store/Inter-Store Issue Voucher (Model 22 – final)
- Sample Store Return Note (SRN)
- Sample Fixed Asset User-Card
- Sample stock/disposal report

---

## Appendix C: Abbreviations and Acronyms

| Abbreviation | Meaning |
|---|---|
| SMS | Stock Management System |
| ERD | Entity Relationship Diagram |
| UML | Unified Modeling Language |
| UI | User Interface |
| SQL | Structured Query Language |
| CRUD | Create, Read, Update, Delete |
| GRN | Goods Receiving Note |
| SIV/ISIV | Store Issue Voucher / Inter-Store Issue Voucher |
| SRN | Store Return Note |
| TEC | Technical Evaluation Committee |
