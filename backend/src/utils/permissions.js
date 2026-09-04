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
  SECURITY: 'Security Officer',
  DISPOSAL_COMMITTEE: 'Disposal Committee'
};

const { ADMIN, PAO, STORE_HEAD, STOREKEEPER, STOCK_CLERK, TEC, DEPT_HEAD, ACCOUNTANT, SECURITY, DISPOSAL_COMMITTEE } = ROLES;
const REPORT_READERS = [ADMIN, PAO, STORE_HEAD, STOCK_CLERK, TEC, DEPT_HEAD, ACCOUNTANT];

// Who can GET this resource. `null` = every authenticated role.
const READ_PERMISSIONS = {
  stores: [...REPORT_READERS, STOREKEEPER, SECURITY],
  categories: [...REPORT_READERS, STOREKEEPER, SECURITY],
  items: [...REPORT_READERS, STOREKEEPER],
  locations: [ADMIN, PAO, STORE_HEAD, STOREKEEPER, STOCK_CLERK],
  suppliers: [...REPORT_READERS, STOREKEEPER],
  departments: [...REPORT_READERS, STOREKEEPER, SECURITY],
  'stock-taking': [ADMIN, PAO, STORE_HEAD, STOREKEEPER, STOCK_CLERK],
  reconciliation: [ADMIN, PAO, STORE_HEAD, STOCK_CLERK, ACCOUNTANT],
  'goods-receipts': [ADMIN, PAO, STORE_HEAD, STOREKEEPER, STOCK_CLERK, TEC, ACCOUNTANT, SECURITY],
  'stock-transactions': [ADMIN, PAO, STORE_HEAD, STOREKEEPER, STOCK_CLERK, DEPT_HEAD, ACCOUNTANT, TEC],
  'bin-cards': [ADMIN, PAO, STORE_HEAD, STOREKEEPER, STOCK_CLERK, ACCOUNTANT],
  'bin-transfers': [ADMIN, PAO, STORE_HEAD, STOREKEEPER, STOCK_CLERK],
  requisitions: [ADMIN, PAO, STORE_HEAD, STOREKEEPER, STOCK_CLERK, DEPT_HEAD, ACCOUNTANT],
  'issue-vouchers': [ADMIN, PAO, STORE_HEAD, STOREKEEPER, STOCK_CLERK, DEPT_HEAD, ACCOUNTANT, SECURITY],
  'material-returns': [ADMIN, PAO, STORE_HEAD, STOREKEEPER, STOCK_CLERK, DEPT_HEAD, ACCOUNTANT, TEC],
  'material-transfers': [ADMIN, PAO, STORE_HEAD, STOREKEEPER, STOCK_CLERK, DEPT_HEAD, ACCOUNTANT],
  'fixed-assets': REPORT_READERS,
  disposals: [ADMIN, PAO, STORE_HEAD, STOREKEEPER, STOCK_CLERK, ACCOUNTANT, TEC, DISPOSAL_COMMITTEE],
  users: [ADMIN],
  'audit-logs': [ADMIN, PAO, ACCOUNTANT, SECURITY],
  reports: [...REPORT_READERS, STOREKEEPER, SECURITY],
  'gate-pass': [ADMIN, PAO, STORE_HEAD, STOREKEEPER, SECURITY],
  'user-cards': [ADMIN, PAO, STORE_HEAD, STOREKEEPER, STOCK_CLERK, DEPT_HEAD, ACCOUNTANT],
  'stock-clerks': [ADMIN, PAO, STORE_HEAD, STOREKEEPER, STOCK_CLERK]
};

const ACTION_PERMISSIONS = {
  'goods-receipts': [STORE_HEAD, STOREKEEPER], // Admin and TEC monitor; technical evaluation uses its dedicated action.
  // Department requisitions are approved by the issuing Store Head. Storekeeper
  // replenishment requests continue to route through PAO for transfer approval.
  requisitions: [DEPT_HEAD, PAO, STORE_HEAD],
  'material-returns': [STORE_HEAD],
  // Approve/Reject/Return only. Storekeeper is intentionally excluded so it cannot
  // approve its own transfer; it dispatches/receives via 'material-transfers-execute'.
  'material-transfers': [PAO, STORE_HEAD],
  // Store Head authorizes what the Storekeeper prepared before the Storekeeper posts it.
  'issue-vouchers': [STORE_HEAD],
  disposals: [PAO],
  'gate-pass': [SECURITY]
};
ACTION_PERMISSIONS['issue-voucher-post'] = [STOREKEEPER];
ACTION_PERMISSIONS['issue-voucher-amend'] = [STORE_HEAD]; // Store Head revises or returns the Storekeeper's preliminary voucher
ACTION_PERMISSIONS['goods-receipts-evaluate'] = [TEC];
ACTION_PERMISSIONS['goods-receipts-notify-tec'] = [STORE_HEAD];
ACTION_PERMISSIONS['goods-receipts-post'] = [STOREKEEPER];
ACTION_PERMISSIONS['material-returns-receive'] = [STOREKEEPER];
ACTION_PERMISSIONS['material-transfers-execute'] = [STOREKEEPER]; // dispatch/receive belongs to the physical storekeeper, not the approving Store Head
ACTION_PERMISSIONS['stock-taking'] = [STORE_HEAD, PAO]; // Store Head owns the session; PAO retains oversight/authorization
ACTION_PERMISSIONS['stock-taking-post'] = [STORE_HEAD, PAO]; // Store Head closes the cycle; PAO remains a valid authorized reviewer
ACTION_PERMISSIONS['stock-taking-recount'] = [STORE_HEAD];
ACTION_PERMISSIONS['stock-taking-verify'] = [STORE_HEAD];
ACTION_PERMISSIONS['stock-taking-reconcile'] = [STORE_HEAD];
ACTION_PERMISSIONS['stock-taking-approve-adjustment'] = [PAO];

ACTION_PERMISSIONS['business-rules'] = [ADMIN];
ACTION_PERMISSIONS['disposals-approve'] = [PAO];
ACTION_PERMISSIONS['disposals-execute'] = [STOREKEEPER];
ACTION_PERMISSIONS['disposals-quarantine'] = [STOREKEEPER, STORE_HEAD];
ACTION_PERMISSIONS['disposals-assess'] = [TEC];
ACTION_PERMISSIONS['disposals-repair'] = [STOREKEEPER];
ACTION_PERMISSIONS['disposals-reassess'] = [TEC];
ACTION_PERMISSIONS['disposals-request'] = [STORE_HEAD];
ACTION_PERMISSIONS['disposals-review'] = [STORE_HEAD];
ACTION_PERMISSIONS['disposals-authorize'] = [PAO, DISPOSAL_COMMITTEE];
ACTION_PERMISSIONS['disposals-submit-confirmation'] = [STOREKEEPER];
ACTION_PERMISSIONS['disposals-confirm'] = [PAO, DISPOSAL_COMMITTEE];
ACTION_PERMISSIONS['disposals-post'] = [PAO, DISPOSAL_COMMITTEE];

// Who can POST/PUT/DELETE this resource. If a resource has no entry here,
// every role in READ_PERMISSIONS for it may also write. If a resource's
// value here is an empty array, NO ONE writes directly — it only changes
// as the side effect of another action (see services/stockService.js).
const WRITE_PERMISSIONS = {
  stores: [ADMIN, PAO],
  categories: [ADMIN, PAO, STORE_HEAD],
  items: [ADMIN, STORE_HEAD],
  locations: [ADMIN, STORE_HEAD, STOREKEEPER],
  suppliers: [ADMIN, PAO, STORE_HEAD],
  departments: [ADMIN, PAO],
  'stock-taking': [STORE_HEAD, STOCK_CLERK],
  reconciliation: [],
  'goods-receipts': [STOREKEEPER],
  'stock-transactions': [], // system-generated only
  'bin-cards': [STOREKEEPER, STOCK_CLERK],
  'bin-transfers': [STORE_HEAD, STOREKEEPER, STOCK_CLERK],
  requisitions: [PAO, STORE_HEAD, STOREKEEPER, DEPT_HEAD],
  'issue-vouchers': [STOREKEEPER], // Storekeeper prepares the preliminary voucher from an approved requisition
  'material-returns': [STORE_HEAD, DEPT_HEAD],
  'material-transfers': [PAO, STORE_HEAD, STOREKEEPER, DEPT_HEAD],
  'fixed-assets': [PAO, STORE_HEAD],
  disposals: [STORE_HEAD],
  users: [ADMIN],
  'audit-logs': [],
  reports: [],
  'gate-pass': [SECURITY],
  'user-cards': [STOREKEEPER, PAO, STORE_HEAD, DEPT_HEAD],
  'business-rules': [ADMIN]
};

const DELETE_PERMISSIONS = {
  stores: [ADMIN],
  categories: [ADMIN],
  items: [ADMIN],
  locations: [ADMIN, STORE_HEAD],
  suppliers: [ADMIN],
  departments: [ADMIN],
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
