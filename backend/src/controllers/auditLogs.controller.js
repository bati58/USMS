const { query } = require('../config/db');
const asyncHandler = require('../utils/asyncHandler');
const { mapAuditLog } = require('./_helpers');

const ROLE_MODULES = {
  'Property Administration Officer': ['Store', 'Item Category', 'User Management', 'Store Management', 'Departments', 'Suppliers', 'Goods Receipt', 'Technical Evaluation', 'Store Requisition', 'Issue Voucher', 'Material Return', 'Material Transfer', 'Fixed Assets', 'Disposal', 'Stock Taking', 'Reconciliation', 'Gate Pass', 'Business Rules'],
  Accountant: ['Goods Receipt', 'Store Requisition', 'Issue Voucher', 'Material Return', 'Material Transfer', 'Stock Taking', 'Reconciliation', 'Reports'],
  'Security Officer': ['Gate Pass', 'Authentication']
};

// Read-only — every row is inserted by logAudit() as a side effect of
// another action (Backend-SRS §6.10). No create/update/delete endpoint
// exists or should exist here.
const list = asyncHandler(async (req, res) => {
  const params = [];
  let scope = '';
  if (req.user.role !== 'Administrator') {
    const modules = ROLE_MODULES[req.user.role] || [];
    params.push(req.user.role, modules);
    scope = `WHERE (actor_role = $1 OR module = ANY($2::text[]))`;
  }
  const { rows } = await query(`SELECT * FROM audit_logs ${scope} ORDER BY created_at DESC LIMIT 500`, params);
  res.json(rows.map(mapAuditLog));
});

module.exports = { list };
