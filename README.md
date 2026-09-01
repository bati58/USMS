# Stock Management System

A full-stack Stock Management System built for university inventory control, covering store setup, item classification, goods receipt, stock transfers, material returns, disposals, requisitions, and audit logging.

This project is divided into two parts, both of which are fully integrated and wired together:
- **[frontend](./frontend)**: A React 18 SPA (Vite + Tailwind CSS + lucide-react) or in future we may switch to nextjs
- **[backend](./backend)**: A Node.js/Express REST API backed by PostgreSQL

## Features
- **Role-Based Access Control**: Secure routing and action permissions across 9 distinct actor roles (Administrator, Store Head, PAO, etc.).
- **Full Inventory Lifecycle**: Handles GRN (Goods Receiving), SIV (Store Issue), Returns, Transfers, Stock Taking, and Disposals.
- **FIFO Valuation**: Evaluates stock pricing and tracks item history seamlessly.
- **Document Generation**: Produces necessary operational references (e.g., GRN-2026-0004, SIV-2026-0001) systematically.

## Quick Start
Ensure you have Node.js 18+ and PostgreSQL installed.

### 1. Database & Backend
```bash
cd backend
npm install
npm run db:schema
npm run db:seed
npm run dev
```

### 2. Frontend
```bash
cd frontend
npm install
npm run dev
```

The frontend will run at `http://localhost:5174` and communicate automatically with the backend API at `http://localhost:4000/api`.

### Demo Login
You can log in with any seeded user using the password **`sms1234`** (e.g., `admin`, `storekeeper`, `pao`).

Please refer to the `frontend/README.md` and `backend/README.md` for specific details about the architecture of each stack.
