// =============================================================================
// Single source of truth for server-side authorization.
//
// This is a direct backend translation of the frontend's
// src/utils/permissions.js and Backend-SRS.docx Section 4. Keep both in
// sync if either changes — a role/resource pair should never be permitted
// on one side and blocked on the other.
//
// Every protected route calls requireRole(resource) (see
// middleware/authorize.js), which reads this matrix. There is no other
// place in the codebase that should contain a role check — if you find
// yourself writing `if (req.user.role === 'Administrator')` in a
// controller, that logic belongs here instead.
// =============================================================================

const ROLES = {
  ADMIN: 'Administrator',
  PAO: 'Property Administration Officer',
  STORE_HEAD: 'Store Head',
  STOREKEEPER: 'Storekeeper',
  STOCK_CLERK: 'Stock Clerk',
  TEC: 'Technical Evaluation Committee',
  DEPT_HEAD: 'Department Head',
  ACCOUNTANT: 'Accountant',
  SECURITY: 'Security Officer'
};

const { ADMIN, PAO, STORE_HEAD, STOREKEEPER, STOCK_CLERK, TEC, DEPT_HEAD, ACCOUNTANT, SECURITY } = ROLES;
const REPORT_READERS = [ADMIN, PAO, STORE_HEAD, STOCK_CLERK, TEC, DEPT_HEAD, ACCOUNTANT];

// Who can GET this resource. `null` = every authenticated role.
const READ_PERMISSIONS = {
  stores: [...REPORT_READERS, STOREKEEPER, STOCK_CLERK],
  categories: [...REPORT_READERS, STOREKEEPER, STOCK_CLERK],
  items: [...REPORT_READERS, STOREKEEPER, STOCK_CLERK],
  locations: [...REPORT_READERS, STOREKEEPER, STOCK_CLERK],
  suppliers: [...REPORT_READERS, STOREKEEPER],
  departments: [...REPORT_READERS, STOREKEEPER],
  'stock-taking': [ADMIN, PAO, STORE_HEAD, STOREKEEPER, STOCK_CLERK],
  reconciliation: [ADMIN, PAO, STORE_HEAD, STOCK_CLERK, ACCOUNTANT],
  'goods-receipts': [...REPORT_READERS, STOREKEEPER, SECURITY],
  'stock-transactions': REPORT_READERS.concat(STOREKEEPER),
  'bin-cards': [...REPORT_READERS, STOREKEEPER],
  'bin-transfers': [ADMIN, PAO, STORE_HEAD, STOREKEEPER, STOCK_CLERK],
  requisitions: [...REPORT_READERS, STOREKEEPER],
  'issue-vouchers': [...REPORT_READERS, STOREKEEPER, SECURITY],
  'material-returns': [ADMIN, PAO, STORE_HEAD, STOREKEEPER, STOCK_CLERK, DEPT_HEAD, ACCOUNTANT],
  'material-transfers': [...REPORT_READERS, STOREKEEPER],
  'fixed-assets': REPORT_READERS,
  disposals: REPORT_READERS,
  users: [ADMIN],
  'audit-logs': [ADMIN, PAO, ACCOUNTANT, SECURITY],
  reports: [...REPORT_READERS, STOREKEEPER, SECURITY],
  'gate-pass': [ADMIN, SECURITY],
  'user-cards': [...REPORT_READERS, STOREKEEPER]
};

const ACTION_PERMISSIONS = {
  'goods-receipts': [STORE_HEAD, STOREKEEPER, TEC], // Admin is monitoring-only for goods receipts; operational actions stay with store/TEC roles.
  requisitions: [PAO, STORE_HEAD, DEPT_HEAD],
  'material-returns': [STORE_HEAD],
  // Approve/Reject/Return only. Storekeeper is intentionally excluded so it cannot
  // approve its own transfer; it dispatches/receives via 'material-transfers-execute'.
  'material-transfers': [PAO, STORE_HEAD],
  'issue-vouchers': [STORE_HEAD],
  disposals: [PAO, STORE_HEAD],
  'gate-pass': [SECURITY]
};
ACTION_PERMISSIONS['issue-voucher-post'] = [STOREKEEPER];
ACTION_PERMISSIONS['goods-receipts-evaluate'] = [TEC];
ACTION_PERMISSIONS['goods-receipts-notify-tec'] = [STORE_HEAD];
ACTION_PERMISSIONS['goods-receipts-post'] = [STOREKEEPER];
ACTION_PERMISSIONS['material-returns-receive'] = [STOREKEEPER];
ACTION_PERMISSIONS['material-transfers-execute'] = [STORE_HEAD, STOREKEEPER]; // dispatch/receive: the store operators, not the approver
ACTION_PERMISSIONS['stock-taking'] = [PAO, STORE_HEAD];
ACTION_PERMISSIONS['stock-taking-post'] = [PAO]; // Store Head may recommend, but PAO/authorized approver performs the actual stock adjustment
ACTION_PERMISSIONS['stock-taking-recount'] = [STORE_HEAD];

ACTION_PERMISSIONS['business-rules'] = [ADMIN];

// Who can POST/PUT/DELETE this resource. If a resource has no entry here,
// every role in READ_PERMISSIONS for it may also write. If a resource's
// value here is an empty array, NO ONE writes directly — it only changes
// as the side effect of another action (see services/stockService.js).
const WRITE_PERMISSIONS = {
  stores: [ADMIN, PAO, STORE_HEAD],
  categories: [ADMIN, PAO],
  items: [ADMIN],
  locations: [ADMIN],
  suppliers: [ADMIN, PAO],
  departments: [ADMIN, PAO],
  'stock-taking': [STORE_HEAD, STOREKEEPER, STOCK_CLERK],
  reconciliation: [],
  'goods-receipts': [STOREKEEPER],
  'stock-transactions': [], // system-generated only
  'bin-cards': [STOREKEEPER, STOCK_CLERK],
  'bin-transfers': [STORE_HEAD, STOREKEEPER],
  requisitions: [PAO, STORE_HEAD, DEPT_HEAD],
  'issue-vouchers': [STOREKEEPER],
  'material-returns': [STORE_HEAD, DEPT_HEAD],
  'material-transfers': [PAO, STORE_HEAD, STOREKEEPER, DEPT_HEAD],
  'fixed-assets': [PAO, STORE_HEAD],
  disposals: [STORE_HEAD],
  users: [ADMIN],
  'audit-logs': [],
  reports: [],
  'gate-pass': [SECURITY],
  'user-cards': [STOREKEEPER, PAO, STORE_HEAD],
  'business-rules': [ADMIN]
};

const DELETE_PERMISSIONS = {
  users: [],
  requisitions: [],
  'material-returns': [],
  'material-transfers': [],
  'user-cards': []
};

// Business Rules configuration permissions
READ_PERMISSIONS['business-rules'] = [ADMIN];

function canRead(resource, role) {
  const allowed = READ_PERMISSIONS[resource];
  if (allowed === undefined) return true; // resource not in the matrix = unrestricted
  return allowed.includes(role);
}

function canWrite(resource, role) {
  const readAllowed = READ_PERMISSIONS[resource];
  const writeAllowed = WRITE_PERMISSIONS[resource];
  if (writeAllowed === undefined) {
    // No explicit write rule -> defer to the read rule.
    if (readAllowed === undefined) return true;
    return readAllowed.includes(role);
  }
  return writeAllowed.includes(role);
}

function canAct(resource, role) {
  const allowed = ACTION_PERMISSIONS[resource];
  return allowed ? allowed.includes(role) : canWrite(resource, role);
}

function canDelete(resource, role) {
  const allowed = DELETE_PERMISSIONS[resource];
  if (allowed !== undefined) return allowed.includes(role);
  return canWrite(resource, role);
}

module.exports = { ROLES, READ_PERMISSIONS, WRITE_PERMISSIONS, DELETE_PERMISSIONS, ACTION_PERMISSIONS, canRead, canWrite, canAct, canDelete };
