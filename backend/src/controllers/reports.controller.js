const { query } = require('../config/db');
const asyncHandler = require('../utils/asyncHandler');
const { ROLES } = require('../utils/permissions');

async function getAssignedStoreScope(req) {
  if (![ROLES.STORE_HEAD, ROLES.STOREKEEPER].includes(req.user.role)) return null;

  if (req.user.id) {
    const { rows } = await query(
      `SELECT DISTINCT s.id
       FROM store_user_assignments a
       JOIN stores s ON s.id = a.store_id
       WHERE a.user_id = $1 AND a.assignment_role = $2 AND a.active = TRUE AND s.active = TRUE
       UNION
       SELECT s.id
       FROM stores s
       WHERE s.active = TRUE AND (
         ($2 = 'Store Head' AND s.head_of_store = $3) OR
         ($2 = 'Storekeeper' AND s.storekeeper = $3)
       )
       ORDER BY id`,
      [req.user.id, req.user.role, req.user.name]
    );
    if (rows.length) return rows.map((row) => Number(row.id));
  }

  const assignmentColumn = req.user.role === ROLES.STORE_HEAD ? 'head_of_store' : 'storekeeper';
  const { rows } = await query(
    `SELECT id FROM stores WHERE ${assignmentColumn} = $1 AND active = TRUE ORDER BY id`,
    [req.user.name]
  );
  return rows.map((row) => Number(row.id));
}

async function addStoreScope(req, conditions, params, expression) {
  const storeScope = await getAssignedStoreScope(req);
  if (storeScope !== null) {
    const scopedExpression = expression.replace(/\?/g, () => {
      params.push(storeScope);
      return `$${params.length}`;
    });
    conditions.push(scopedExpression);
  }
}

function scopeForDepartmentHead(req, column) {
  if (req.user.role !== ROLES.DEPT_HEAD) return null;
  return { column, value: req.user.department || '' };
}

function dateConditions(column, queryParams, values) {
  const conditions = [];
  if (queryParams.from) {
    values.push(queryParams.from);
    conditions.push(`${column} >= $${values.length}::date`);
  }
  if (queryParams.to) {
    values.push(queryParams.to);
    conditions.push(`${column} <= $${values.length}::date`);
  }
  return conditions;
}

// GET /api/reports/inventory-summary
const inventorySummary = asyncHandler(async (req, res) => {
  const conditions = [];
  const params = [];
  await addStoreScope(req, conditions, params, 'i.store_id = ANY(?::int[])');
  const { rows } = await query(`
    SELECT i.code, i.name, s.name AS store, i.qty_on_hand, i.unit_price,
           (i.qty_on_hand * i.unit_price) AS value
    FROM items i JOIN stores s ON s.id = i.store_id
    ${conditions.length ? `WHERE ${conditions.join(' AND ')}` : ''}
    ORDER BY i.name
  `, params);
  res.json(
    rows.map((r) => ({
      code: r.code,
      name: r.name,
      store: r.store,
      qtyOnHand: Number(r.qty_on_hand),
      unitPrice: Number(r.unit_price),
      value: Number(r.value)
    }))
  );
});

// GET /api/reports/low-stock
const lowStock = asyncHandler(async (req, res) => {
  const conditions = ['i.qty_on_hand <= i.reorder_level'];
  const params = [];
  await addStoreScope(req, conditions, params, 'i.store_id = ANY(?::int[])');
  const { rows } = await query(`
    SELECT i.code, i.name, s.name AS store, i.qty_on_hand, i.reorder_level
    FROM items i JOIN stores s ON s.id = i.store_id
    WHERE ${conditions.join(' AND ')}
    ORDER BY i.name
  `, params);
  res.json(
    rows.map((r) => ({
      code: r.code,
      name: r.name,
      store: r.store,
      qtyOnHand: Number(r.qty_on_hand),
      reorderLevel: Number(r.reorder_level)
    }))
  );
});

// GET /api/reports/stock-movement?from=&to=&item=
const stockMovement = asyncHandler(async (req, res) => {
  const { from, to, item } = req.query;
  const conditions = [];
  const params = [];
  if (from) {
    params.push(from);
    conditions.push(`st.date >= $${params.length}`);
  }
  if (to) {
    params.push(to);
    conditions.push(`st.date <= $${params.length}`);
  }
  if (item) {
    params.push(item);
    conditions.push(`i.name = $${params.length}`);
  }
  await addStoreScope(req, conditions, params, 'i.store_id = ANY(?::int[])');

  const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
  const { rows } = await query(
    `SELECT st.date, i.name AS item, st.type, st.ref, st.qty_in, st.qty_out, st.balance
     FROM stock_transactions st
     JOIN items i ON i.id = st.item_id
     JOIN stores s ON s.id = i.store_id
     ${where}
     ORDER BY st.date DESC, st.id DESC`,
    params
  );
  res.json(
    rows.map((r) => ({
      date: r.date,
      item: r.item,
      type: r.type,
      ref: r.ref,
      qtyIn: Number(r.qty_in),
      qtyOut: Number(r.qty_out),
      balance: Number(r.balance)
    }))
  );
});

// GET /api/reports/grn-status
const grnStatus = asyncHandler(async (req, res) => {
  const params = [];
  const conditions = dateConditions('g.received_date', req.query, params);
  await addStoreScope(req, conditions, params, 'g.store_id = ANY(?::int[])');
  const { rows } = await query(`
    SELECT g.grn_ref, g.supplier, s.name AS store, g.received_date, g.status
    FROM goods_receipts g JOIN stores s ON s.id = g.store_id
    ${conditions.length ? `WHERE ${conditions.join(' AND ')}` : ''}
    ORDER BY g.received_date DESC
  `, params);
  res.json(
    rows.map((r) => ({ grnRef: r.grn_ref, supplier: r.supplier, store: r.store, receivedDate: r.received_date, status: r.status }))
  );
});

// GET /api/reports/requisition-status
const requisitionStatus = asyncHandler(async (req, res) => {
  const params = [];
  const conditions = dateConditions('date', req.query, params);
  await addStoreScope(req, conditions, params, 'r.store_id = ANY(?::int[])');
  const departmentScope = scopeForDepartmentHead(req, 'r.department');
  if (departmentScope) {
    params.push(departmentScope.value);
    conditions.push(`${departmentScope.column} = $${params.length}`);
  }
  const { rows } = await query(`
    SELECT r.sr_ref, r.department, r.date, r.status, s.name AS store
    FROM requisitions r JOIN stores s ON s.id = r.store_id
    ${conditions.length ? `WHERE ${conditions.join(' AND ')}` : ''}
    ORDER BY r.date DESC
  `, params);
  res.json(rows.map((r) => ({ srRef: r.sr_ref, department: r.department, date: r.date, status: r.status })));
});

// GET /api/reports/dashboard-summary — role-aware aggregate counts for the
// per-role dashboards. Computes server-side so a Department Head's browser
// never receives other departments' raw data (Backend-SRS §7).
const dashboardSummary = asyncHandler(async (req, res) => {
  const role = req.user.role;
  const summary = {};
  const assignedStoreScope = await getAssignedStoreScope(req);
  const itemStoreCondition = assignedStoreScope === null ? 's.active = TRUE' : 's.active = TRUE AND i.store_id = ANY($1::int[])';
  const itemStoreParams = assignedStoreScope === null ? [] : [assignedStoreScope];

  if (role === ROLES.ADMIN) {
    const overviewQ = await query(`
      SELECT
        (SELECT COUNT(*) FROM users) AS total_users,
        (SELECT COUNT(*) FROM users WHERE active = TRUE) AS active_users,
        (SELECT COUNT(*) FROM users WHERE active = FALSE) AS inactive_users,
        (SELECT COUNT(*) FROM users WHERE active = FALSE) AS pending_user_activations,
        (SELECT COUNT(DISTINCT role) FROM users) AS total_roles,
        (SELECT COUNT(*) FROM departments WHERE active = TRUE) AS total_departments,
        (SELECT COUNT(*) FROM stores WHERE active = TRUE) AS total_stores,
        (SELECT COUNT(*) FROM categories WHERE active = TRUE) AS total_categories,
        (SELECT COUNT(*) FROM locations WHERE active = TRUE) AS total_locations,
        (SELECT COUNT(*) FROM items i JOIN stores s ON s.id = i.store_id WHERE s.active = TRUE) AS total_items,
        (SELECT COUNT(*) FROM suppliers WHERE active = TRUE) AS total_suppliers,
        (SELECT COUNT(*) FROM goods_receipts g JOIN stores s ON s.id = g.store_id WHERE s.active = TRUE AND g.status IN ('Pending Evaluation', 'Under Evaluation')) AS pending_technical_evaluations,
        (SELECT COUNT(*) FROM goods_receipts g JOIN stores s ON s.id = g.store_id WHERE s.active = TRUE AND g.status IN ('Accepted', 'GRN Generated', 'Posted')) AS pending_grns,
        (SELECT COUNT(*) FROM issue_vouchers WHERE status IN ('Preliminary', 'Pending Approval')) AS pending_siv_approvals,
        (SELECT COUNT(*) FROM material_returns WHERE status IN ('Submitted', 'Pending', 'Pending Review')) AS pending_returns,
        (SELECT COUNT(*) FROM material_transfers WHERE status IN ('Submitted', 'Pending', 'Pending Approval')) AS pending_material_transfers,
        (SELECT COUNT(*) FROM stock_taking_sessions WHERE status IN ('Submitted', 'Pending Approval', 'Approved')) AS pending_stock_taking,
        (SELECT COUNT(*) FROM stock_taking_items sti JOIN stock_taking_sessions st ON st.id = sti.session_id WHERE sti.variance <> 0 AND st.status IN ('Submitted', 'Pending Approval', 'Approved')) AS pending_reconciliation,
        (SELECT COUNT(*) FROM disposals WHERE status IN ('Flagged', 'Quarantined', 'Under Technical Assessment', 'Repairable', 'Unusable', 'Send for Repair', 'Requested', 'Pending Review', 'Returned for Correction')) AS pending_disposal_requests,
        (SELECT COUNT(*) FROM goods_receipts WHERE gate_verified = FALSE AND status IN ('GRN Generated', 'Posted')) AS pending_gate_verification,
        (SELECT COUNT(*) FROM items i JOIN stores s ON s.id = i.store_id WHERE s.active = TRUE AND i.expiry_tracked = TRUE AND i.expiry_date IS NOT NULL AND i.expiry_date < CURRENT_DATE + INTERVAL '30 days' AND i.expiry_date >= CURRENT_DATE) AS expiring_items,
        (SELECT COUNT(*) FROM items i JOIN stores s ON s.id = i.store_id WHERE s.active = TRUE AND i.expiry_tracked = TRUE AND i.expiry_date IS NOT NULL AND i.expiry_date < CURRENT_DATE) AS expired_items,
        (SELECT COUNT(*) FROM items WHERE LOWER(COALESCE(item_condition, '')) LIKE '%damaged%') AS damaged_items,
        (SELECT COUNT(*) FROM items WHERE LOWER(COALESCE(item_condition, '')) LIKE '%quarantine%') AS quarantine_items,
        (SELECT COUNT(*) FROM disposals WHERE status IN ('Flagged', 'Quarantined', 'Under Technical Assessment', 'Repairable', 'Unusable', 'Send for Repair', 'Requested', 'Pending Review', 'Returned for Correction', 'Approved', 'Executed', 'Completed', 'Closed')) AS disposal_flags,
        (SELECT COUNT(*) FROM audit_logs WHERE outcome = 'FAILED' AND created_at >= NOW() - INTERVAL '7 days') AS failed_operations
    `);
    const overview = overviewQ.rows[0];
    summary.systemOverview = {
      totalUsers: Number(overview.total_users),
      activeUsers: Number(overview.active_users),
      inactiveUsers: Number(overview.inactive_users),
      pendingUserActivations: Number(overview.pending_user_activations),
      totalRoles: Number(overview.total_roles),
      totalDepartments: Number(overview.total_departments),
      totalStores: Number(overview.total_stores),
      totalCategories: Number(overview.total_categories),
      totalLocations: Number(overview.total_locations),
      totalItems: Number(overview.total_items),
      totalSuppliers: Number(overview.total_suppliers),
      pendingTechnicalEvaluations: Number(overview.pending_technical_evaluations),
      pendingGrns: Number(overview.pending_grns),
      pendingSivApprovals: Number(overview.pending_siv_approvals),
      pendingReturns: Number(overview.pending_returns),
      pendingMaterialTransfers: Number(overview.pending_material_transfers),
      pendingStockTaking: Number(overview.pending_stock_taking),
      pendingReconciliation: Number(overview.pending_reconciliation),
      pendingDisposalRequests: Number(overview.pending_disposal_requests),
      pendingGateVerification: Number(overview.pending_gate_verification),
      expiringItems: Number(overview.expiring_items),
      expiredItems: Number(overview.expired_items),
      damagedItems: Number(overview.damaged_items),
      quarantineItems: Number(overview.quarantine_items),
      disposalFlags: Number(overview.disposal_flags),
      failedOperations: Number(overview.failed_operations)
    };
  }

  const totalValueQ = await query(`
    SELECT COALESCE(SUM(i.qty_on_hand * i.unit_price), 0) AS total
    FROM items i
    JOIN stores s ON s.id = i.store_id
    WHERE ${itemStoreCondition}
  `, itemStoreParams);
  summary.totalInventoryValue = Number(totalValueQ.rows[0].total);

  const lowStockQ = await query(`
    SELECT COUNT(*) AS count
    FROM items i
    JOIN stores s ON s.id = i.store_id
    WHERE ${itemStoreCondition} AND i.qty_on_hand <= i.reorder_level
  `, itemStoreParams);
  summary.itemsAtReorderLevel = Number(lowStockQ.rows[0].count);

  const expiringItemsQ = await query(`
    SELECT COUNT(*) AS count
    FROM items i
    JOIN stores s ON s.id = i.store_id
    WHERE ${itemStoreCondition} AND i.expiry_tracked = TRUE AND i.expiry_date IS NOT NULL AND i.expiry_date < CURRENT_DATE + INTERVAL '30 days' AND i.expiry_date >= CURRENT_DATE
  `, itemStoreParams);
  summary.expiringItems = Number(expiringItemsQ.rows[0].count);

  const expiredItemsQ = await query(`
    SELECT COUNT(*) AS count
    FROM items i
    JOIN stores s ON s.id = i.store_id
    WHERE ${itemStoreCondition} AND i.expiry_tracked = TRUE AND i.expiry_date IS NOT NULL AND i.expiry_date < CURRENT_DATE
  `, itemStoreParams);
  summary.expiredItems = Number(expiredItemsQ.rows[0].count);

  const pendingGrnQ = await query(`
    SELECT COUNT(*) AS count
    FROM goods_receipts g
    JOIN stores s ON s.id = g.store_id
    WHERE s.active = TRUE AND g.status IN ('Pending','Under Evaluation')${assignedStoreScope === null ? '' : ' AND g.store_id = ANY($1::int[])'}
  `, itemStoreParams);
  summary.pendingGoodsReceipts = Number(pendingGrnQ.rows[0].count);

  if (role === ROLES.ADMIN) {
    const adminActivityQ = await query(`
      SELECT
        (SELECT COUNT(*) FROM audit_logs WHERE created_at >= NOW() - INTERVAL '7 days') AS recent_audit_events,
        (SELECT COUNT(*) FROM audit_logs WHERE created_at >= NOW() - INTERVAL '7 days' AND actor_role IS NOT NULL) AS recent_user_activity,
        (SELECT COUNT(*) FROM audit_logs WHERE outcome = 'FAILED' AND created_at >= NOW() - INTERVAL '7 days') AS failed_operations
    `);
    const activity = adminActivityQ.rows[0];
    summary.recentAuditEvents = Number(activity.recent_audit_events);
    summary.recentUserActivity = Number(activity.recent_user_activity);
    summary.failedOperations = Number(activity.failed_operations);
  }

  if (role === ROLES.DEPT_HEAD) {
    // Stage-1 approval queue: requisitions from my department awaiting my endorsement
    // (Submitted), excluding ones I raised myself (I can't approve my own).
    const mine = await query(
      "SELECT COUNT(*) AS count FROM requisitions WHERE department = $1 AND status = 'Submitted' AND requested_by <> $2",
      [req.user.department || req.user.name, req.user.name]
    );
    summary.pendingRequisitions = Number(mine.rows[0].count);
    const myReturns = await query(
      `SELECT COUNT(*) AS count FROM material_returns mr
       JOIN requisitions r ON r.department = mr.department
       WHERE mr.status = 'Pending'`
    );
    summary.pendingReturns = Number(myReturns.rows[0].count);
  } else if (assignedStoreScope === null) {
    // Stage-2 approval queue (PAO/Admin): requisitions endorsed and awaiting final approval.
    const pendingReqQ = await query("SELECT COUNT(*) AS count FROM requisitions WHERE status = 'Pending Approval'");
    summary.pendingRequisitions = Number(pendingReqQ.rows[0].count);
  } else {
    const pendingReqQ = await query("SELECT COUNT(*) AS count FROM requisitions WHERE store_id = ANY($1::int[]) AND status = 'Pending Approval'", itemStoreParams);
    summary.pendingRequisitions = Number(pendingReqQ.rows[0].count);
  }

  if (role === ROLES.TEC) {
    const pendingReturnsQ = await query("SELECT COUNT(*) AS count FROM material_returns WHERE status = 'Pending'");
    summary.pendingReturnEvaluations = Number(pendingReturnsQ.rows[0].count);
  }

  if (role === ROLES.PAO || role === ROLES.ADMIN) {
    const pendingTransfersQ = await query("SELECT COUNT(*) AS count FROM material_transfers WHERE status = 'Pending'");
    summary.pendingTransfers = Number(pendingTransfersQ.rows[0].count);
    const pendingDisposalsQ = await query("SELECT COUNT(*) AS count FROM disposals WHERE status = 'Pending'");
    summary.pendingDisposals = Number(pendingDisposalsQ.rows[0].count);
  }

  res.json(summary);
});

// GET /api/reports/issue-status
const issueStatus = asyncHandler(async (req, res) => {
  const params = [];
  const conditions = dateConditions('iv.date', req.query, params);
  await addStoreScope(req, conditions, params, 'r.store_id = ANY(?::int[])');
  const departmentScope = scopeForDepartmentHead(req, 'r.department');
  if (departmentScope) {
    params.push(departmentScope.value);
    conditions.push(`${departmentScope.column} = $${params.length}`);
  }
  const { rows } = await query(`
    SELECT iv.siv_ref, iv.type, iv.sr_ref, iv.issued_to, iv.issued_by, iv.date, iv.status
    FROM issue_vouchers iv
    LEFT JOIN requisitions r ON r.sr_ref = iv.sr_ref
    LEFT JOIN stores s ON s.id = r.store_id
    ${conditions.length ? `WHERE ${conditions.join(' AND ')}` : ''} ORDER BY iv.date DESC
  `, params);
  res.json(rows.map((r) => ({
    sivRef: r.siv_ref, type: r.type, srRef: r.sr_ref, issuedTo: r.issued_to,
    issuedBy: r.issued_by, date: r.date, status: r.status
  })));
});

// GET /api/reports/return-status
const returnStatus = asyncHandler(async (req, res) => {
  const params = [];
  const conditions = dateConditions('mr.date', req.query, params);
  await addStoreScope(req, conditions, params, 'i.store_id = ANY(?::int[])');
  const departmentScope = scopeForDepartmentHead(req, 'mr.department');
  if (departmentScope) {
    params.push(departmentScope.value);
    conditions.push(`${departmentScope.column} = $${params.length}`);
  }
  const { rows } = await query(`
    SELECT mr.srn_ref, mr.department, i.name AS item, mr.qty, mr.status, mr.date
    FROM material_returns mr
    LEFT JOIN items i ON i.id = mr.item_id
    LEFT JOIN stores s ON s.id = i.store_id
    ${conditions.length ? `WHERE ${conditions.join(' AND ')}` : ''}
    ORDER BY mr.date DESC
  `, params);
  res.json(rows.map((r) => ({
    srnRef: r.srn_ref, department: r.department, item: r.item,
    qty: Number(r.qty), status: r.status, date: r.date
  })));
});

// GET /api/reports/transfer-status
const transferStatus = asyncHandler(async (req, res) => {
  const params = [];
  const conditions = dateConditions('mt.date', req.query, params);
  await addStoreScope(req, conditions, params, '(mt.from_store_id = ANY(?::int[]) OR mt.to_store_id = ANY(?::int[]))');
  const departmentScope = scopeForDepartmentHead(req, 'mt.department');
  if (departmentScope) {
    params.push(departmentScope.value);
    conditions.push(`${departmentScope.column} = $${params.length}`);
  }
  const { rows } = await query(`
    SELECT mt.transfer_ref, fs.name AS from_store, ts.name AS to_store,
           i.name AS item, mt.qty, mt.status, mt.date
    FROM material_transfers mt
    LEFT JOIN stores fs ON fs.id = mt.from_store_id
    LEFT JOIN stores ts ON ts.id = mt.to_store_id
    LEFT JOIN items i ON i.id = mt.item_id
    ${conditions.length ? `WHERE ${conditions.join(' AND ')}` : ''}
    ORDER BY mt.date DESC
  `, params);
  res.json(rows.map((r) => ({
    transferRef: r.transfer_ref, fromStore: r.from_store, toStore: r.to_store,
    item: r.item, qty: Number(r.qty), status: r.status, date: r.date
  })));
});

// GET /api/reports/asset-summary
const assetSummary = asyncHandler(async (req, res) => {
  const params = [];
  const conditions = dateConditions('fa.acquisition_date', req.query, params);
  await addStoreScope(req, conditions, params, 'fa.store_id = ANY(?::int[])');
  const { rows } = await query(`
    SELECT fa.asset_tag, fa.name, fa.category, s.name AS store, fa.assigned_to,
           fa.status, fa.acquisition_date, fa.value
    FROM fixed_assets fa LEFT JOIN stores s ON s.id = fa.store_id
    ${conditions.length ? `WHERE ${conditions.join(' AND ')}` : ''}
    ORDER BY fa.acquisition_date DESC
  `, params);
  res.json(rows.map((r) => ({
    assetTag: r.asset_tag, name: r.name, category: r.category, store: r.store,
    assignedTo: r.assigned_to, status: r.status, acquisitionDate: r.acquisition_date,
    value: Number(r.value)
  })));
});

// GET /api/reports/disposal-status
const disposalStatus = asyncHandler(async (req, res) => {
  const params = [];
  const conditions = dateConditions('d.date_flagged', req.query, params);
  await addStoreScope(req, conditions, params, 'd.store_id = ANY(?::int[])');
  const { rows } = await query(`
    SELECT d.disposal_ref, i.name AS item, s.name AS store, d.qty, d.reason,
           d.date_flagged, d.status
    FROM disposals d
    LEFT JOIN items i ON i.id = d.item_id
    LEFT JOIN stores s ON s.id = i.store_id
    ${conditions.length ? `WHERE ${conditions.join(' AND ')}` : ''}
    ORDER BY d.date_flagged DESC
  `, params);
  res.json(rows.map((r) => ({
    disposalRef: r.disposal_ref, item: r.item, store: r.store,
    qty: Number(r.qty), reason: r.reason, dateFlagged: r.date_flagged, status: r.status
  })));
});

// GET /api/reports/fifo-valuation
const fifoValuation = asyncHandler(async (req, res) => {
  const conditions = ['sl.qty_remaining > 0'];
  const params = [];
  await addStoreScope(req, conditions, params, 'i.store_id = ANY(?::int[])');
  const { rows } = await query(`
    SELECT i.code, i.name, i.unit, sl.unit_price, sl.qty_remaining,
           (sl.unit_price * sl.qty_remaining) AS lot_value,
           sl.received_date, sl.source_ref
    FROM stock_lots sl
    JOIN items i ON i.id = sl.item_id
    WHERE ${conditions.join(' AND ')}
    ORDER BY i.name, sl.received_date ASC
  `, params);
  res.json(rows.map((r) => ({
    code: r.code, name: r.name, unit: r.unit, unitPrice: Number(r.unit_price),
    qtyRemaining: Number(r.qty_remaining), lotValue: Number(r.lot_value),
    receivedDate: r.received_date, sourceRef: r.source_ref
  })));
});

// ---------------------------------------------------------------------------
// Generic CSV export — GET /api/reports/export-csv?report=<reportName>
// Calls the matching report handler internally and converts the JSON array
// into a downloadable CSV file.
// ---------------------------------------------------------------------------
function jsonToCsv(rows) {
  if (!rows || rows.length === 0) return '';
  const headers = Object.keys(rows[0]);
  const escape = (val) => {
    if (val == null) return '';
    const str = String(val);
    return str.includes(',') || str.includes('"') || str.includes('\n')
      ? `"${str.replace(/"/g, '""')}"`
      : str;
  };
  const lines = [headers.join(',')];
  for (const row of rows) {
    lines.push(headers.map((h) => escape(row[h])).join(','));
  }
  return lines.join('\n');
}

const REPORT_HANDLERS = {
  'inventory-summary': inventorySummary,
  'low-stock': lowStock,
  'stock-movement': stockMovement,
  'grn-status': grnStatus,
  'requisition-status': requisitionStatus,
  'issue-status': issueStatus,
  'return-status': returnStatus,
  'transfer-status': transferStatus,
  'asset-summary': assetSummary,
  'disposal-status': disposalStatus,
  'fifo-valuation': fifoValuation
};

const exportCsv = asyncHandler(async (req, res) => {
  const reportName = req.query.report;
  if (!reportName || !REPORT_HANDLERS[reportName]) {
    return res.status(400).json({ message: `Unknown report: "${reportName}". Available: ${Object.keys(REPORT_HANDLERS).join(', ')}` });
  }

  // Capture the JSON output by shimming res.json
  let capturedData;
  const fakeRes = {
    json: (data) => { capturedData = data; },
    status: () => fakeRes
  };
  await REPORT_HANDLERS[reportName](req, fakeRes, () => { });

  const csv = jsonToCsv(Array.isArray(capturedData) ? capturedData : [capturedData]);
  const filename = `${reportName}_${new Date().toISOString().slice(0, 10)}.csv`;

  res.setHeader('Content-Type', 'text/csv');
  res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
  res.send(csv);
});

module.exports = {
  inventorySummary, lowStock, stockMovement, grnStatus, requisitionStatus,
  dashboardSummary, issueStatus, returnStatus, transferStatus, assetSummary,
  disposalStatus, fifoValuation, exportCsv
};
