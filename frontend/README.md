# Stock Management System — Frontend

A clean, responsive, professional frontend for a university Stock Management
System, built to satisfy the use cases in the project SRS (store setup, item
classification, goods receipt & technical evaluation, stock cards/bin cards,
requisitions & issue vouchers, fixed assets, returns, transfers, disposal,
reports and audit logging).

Stack: **React 18 + Vite + React Router + Tailwind CSS + lucide-react**.

The app runs and connects to the Node/Express API running on port 4000. 
It uses real-time REST API requests to communicate with the database securely.

## 1. Prerequisites

- Node.js 18+ and npm (check with `node -v` and `npm -v`)
- VS Code (recommended extensions: **ES7+ React/Redux/React-Native snippets**, **Tailwind CSS IntelliSense**, **Prettier**)

## 2. Setup

Open a terminal in this folder (`frontend`) and run:

```bash
npm install
npm run dev
```

Vite will start a dev server (default `http://localhost:5174`) and open it
in your browser automatically. It connects to the backend API via the `VITE_API_BASE_URL` env variable.

### Demo login

All seeded demo users below use the password `sms1234`:

```
admin | pao | storehead | storekeeper | clerk | tec | depthead | accountant | security
```

### Other scripts

```bash
npm run build     # production build to dist/
npm run preview   # preview the production build locally
npm run lint      # eslint
```

## 3. Project structure

```
src/
  components/
    ui/            reusable UI kit (Button, Input, Table, Modal, ...)
    layout/        Sidebar, Topbar, DashboardLayout, nav config
    crud/          generic config-driven CrudPage used by simpler modules
  context/         AuthContext, ToastContext
  pages/           one folder per module, mirrors the sidebar navigation
  router/          ProtectedRoute guard
  services/        entityService factory + apiClient (real API)
  utils/           constants.js (roles/status/units), formatters.js
```

## 4. How the module pages map to the SRS use cases

| Page | Route | SRS Use Case(s) |
|---|---|---|
| Stores | `/stores` | UC1 Manage Store Information |
| Item Categories | `/categories` | UC2 Maintain Items Category |
| Items | `/items` | UC3 Maintain Items Location |
| Goods Receipt | `/goods-receipt` | UC4 Goods Receipt Record |
| Technical Evaluation | `/goods-receipt/evaluation` | UC5 Evaluate Materials, UC6 Generate GRN |
| Stock Cards | `/stock-cards` | UC7 Auto-Update Stock Card, UC8 View Stock Card |
| Bin Cards | `/bin-cards` | UC9 Manage Bin Card |
| Stock Transfer | `/stock-transfer` | UC10 Stock Transfer Between Bins |
| Store Requisitions | `/requisitions` | UC11 Manage Requisition, UC12 Approve/Reject SR |
| Issue Vouchers | `/issue-vouchers` | UC13-15 SIV/ISIV create, approve, generate |
| Fixed Assets | `/fixed-assets` | UC16 Manage Fixed Assets Registration |
| Users | `/users` | UC17 Manage User-Card |
| Material Returns | `/material-return` | UC18-20 SRN create, technical eval, approve/reject |
| Material Transfers | `/material-transfer` | UC21-22 Initiate/Approve Transfer |
| Disposal | `/disposal` | UC23-26 Shelf-life monitor, flag, manage disposal |
| Reports | `/reports` | Report Management (inventory, low-stock, movement, GRN & SR status) |
| Audit Log | `/audit-log` | Audit Management |

## 5. Design notes

- Tailwind theme (`tailwind.config.js`) defines a `brand` (blue) and `ink` (slate) palette used consistently across the UI kit.
- The sidebar/nav is entirely config-driven from `src/components/layout/navConfig.js`.
- Every list page follows the same shape: search box, table with pagination, a modal form for create/edit, and a confirm dialog for delete.
- Status vocabulary (`Draft/Pending/Under Evaluation/Approved/Rejected/...`) and its colors are centralized in `src/utils/constants.js`.
