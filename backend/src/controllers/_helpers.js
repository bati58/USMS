const { query } = require('../config/db');
const AppError = require('../utils/AppError');

// The frontend's mock data always used human-readable names (e.g.
// item.store === 'Main Store') rather than numeric IDs, since it never
// talked to a real relational database. To keep the API contract
// identical and require zero frontend changes, every response below
// resolves foreign keys back to their name for the JSON payload, and
// every create/update accepts a name string and resolves it to an ID
// server-side.

async function resolveStoreId(storeName, client = { query }) {
  if (!storeName) return null;
  const { rows } = await client.query('SELECT id FROM stores WHERE name = $1', [storeName]);
  if (!rows[0]) throw new AppError(`Unknown store: "${storeName}".`, 400);
  return rows[0].id;
}

async function resolveStoreHeadForStore(storeId, client = { query }) {
  if (!storeId) return null;
  const { rows } = await client.query(
    `SELECT u.id
     FROM store_user_assignments a
     JOIN users u ON u.id = a.user_id AND u.role = 'Store Head' AND u.active = TRUE
     JOIN stores s ON s.id = a.store_id AND s.active = TRUE
     WHERE a.store_id = $1 AND a.assignment_role = 'Store Head' AND a.active = TRUE
     LIMIT 1`,
    [storeId]
  );
  if (rows[0]?.id) return rows[0].id;

  const legacyRows = await client.query(
    `SELECT u.id
     FROM stores s
     LEFT JOIN users u ON u.name = s.head_of_store AND u.role = 'Store Head' AND u.active = TRUE
     WHERE s.id = $1 AND s.active = TRUE
     LIMIT 1`,
    [storeId]
  );
  return legacyRows.rows[0]?.id || null;
}

async function resolveSupplierId(supplierName, client = { query }) {
  if (!supplierName) return null;
  const { rows } = await client.query('SELECT id FROM suppliers WHERE name = $1 OR code = $1', [supplierName]);
  if (!rows[0]) throw new AppError(`Unknown supplier: "${supplierName}".`, 400);
  return rows[0].id;
}

async function resolveCategoryId(categoryName, client = { query }) {
  if (!categoryName) return null;
  const { rows } = await client.query('SELECT id FROM categories WHERE name = $1', [categoryName]);
  if (!rows[0]) throw new AppError(`Unknown category: "${categoryName}".`, 400);
  return rows[0].id;
}

async function resolveItemId(itemName, client = { query }, storeId = null) {
  if (!itemName) return null;

  if (storeId != null) {
    const { rows: legacyRows } = await client.query(
      'SELECT id FROM items WHERE name = $1 AND store_id = $2',
      [itemName, storeId]
    );
    if (legacyRows[0]) return legacyRows[0].id;

    const { rows: inventoryRows } = await client.query(
      `SELECT i.id
       FROM items i
       JOIN item_inventory ii ON ii.item_id = i.id AND ii.store_id = $2
       WHERE i.name = $1`,
      [itemName, storeId]
    );
    if (inventoryRows[0]) return inventoryRows[0].id;
  }

  const { rows } = await client.query('SELECT id FROM items WHERE name = $1', [itemName]);
  if (!rows[0]) {
    throw new AppError(
      storeId == null ? `Unknown item: "${itemName}".` : `Unknown item: "${itemName}" in the selected store.`,
      400
    );
  }
  return rows[0].id;
}

async function resolveLocationId(locationId, storeId, client = { query }) {
  if (!locationId) return null;
  const { rows } = await client.query('SELECT id FROM locations WHERE id = $1 AND store_id = $2', [locationId, storeId]);
  if (!rows[0]) throw new AppError('Location does not belong to the selected store.', 400);
  return rows[0].id;
}

// ---- Row -> JSON mappers (snake_case DB columns -> camelCase API fields,
// matching src/services/seed.js field names exactly) ----

function mapUser(row) {
  return {
    id: row.id,
    name: row.name,
    username: row.username,
    role: row.role,
    email: row.email,
    department: row.department,
    active: row.active
  };
}

function mapStore(row) {
  return {
    id: row.id,
    name: row.name,
    code: row.code,
    type: row.type,
    department: row.department || null,
    location: row.location,
    headOfStore: row.head_of_store,
    storekeeper: row.storekeeper,
    description: row.description,
    contactInfo: row.contact_info,
    active: row.active
  };
}

function mapCategory(row) {
  return {
    id: row.id,
    code: row.code,
    name: row.name,
    storeId: row.store_id || null,
    store: row.store_name || null,
    description: row.description,
    active: row.active
  };
}

function mapItem(row) {
  return {
    id: row.id,
    code: row.code,
    name: row.name,
    category: row.category_name || null,
    store: row.store_name || null,
    storeId: row.store_id || null,
    locationId: row.location_id || null,
    location: row.location_name || null,
    bin: row.bin,
    unit: row.unit,
    minLevel: Number(row.min_level),
    maxLevel: Number(row.max_level),
    reorderLevel: Number(row.reorder_level),
    qtyOnHand: Number(row.qty_on_hand),
    unitPrice: Number(row.unit_price),
    expiryTracked: Boolean(row.expiry_tracked),
    expiryDate: row.expiry_date ? row.expiry_date.toISOString().split('T')[0] : null,
    batchNo: row.batch_no || null,
    condition: row.item_condition || null
  };
}

function mapLocation(row) {
  return {
    id: row.id,
    storeId: row.store_id,
    store: row.store_name || null,
    parentId: row.parent_id,
    parent: row.parent_name || null,
    type: row.type,
    code: row.code,
    name: row.name,
    active: row.active
  };
}

function mapGoodsReceipt(row, items = []) {
  return {
    id: row.id,
    grnRef: row.official_grn_ref || row.grn_ref,
    receiptRef: row.grn_ref,
    supplier: row.supplier,
    poRef: row.po_ref,
    type: row.material_type,
    docRef: row.supporting_document_ref,
    condition: row.condition_on_arrival,
    receivedDate: row.received_date,
    receivedBy: row.received_by,
    store: row.store_name || null,
    status: row.status,
    generatedBy: row.official_grn_generated_by || null,
    generatedAt: row.official_grn_generated_at || null,
    evaluationNote: row.evaluation_note,
    evaluationDate: row.evaluation_date,
    evaluationFindings: row.evaluation_findings,
    evaluationCondition: row.evaluation_condition,
    evaluationEvidence: row.evaluation_evidence,
    evaluatedBy: row.evaluated_by,
    gateVerified: row.gate_verified,
    gateVerifiedBy: row.gate_verified_by,
    gateVerifiedAt: row.gate_verified_at,
    items: items.map((i) => ({
      item: i.item_name,
      category: i.category_name || 'Uncategorized',
      qty: Number(i.qty),
      qtyAccepted: i.qty_accepted == null ? null : Number(i.qty_accepted),
      qtyRejected: i.qty_rejected == null ? null : Number(i.qty_rejected),
      unitPrice: Number(i.unit_price)
    }))
  };
}
function mapStockTransaction(row) {
  return {
    id: row.id,
    itemId: row.item_id,
    item: row.item_name,
    date: row.date,
    type: row.type,
    ref: row.ref,
    qtyIn: Number(row.qty_in),
    qtyOut: Number(row.qty_out),
    unitPrice: Number(row.unit_price),
    balance: Number(row.balance),
    actorName: row.actor_name || null,
    store: row.store_name || null,
    storeId: row.store_id || null,
    bin: row.bin || null,
    reason: row.reason || null,
    sourceType: row.source_type || null,
    sourceId: row.source_id || null
  };
}

function mapBinCard(row) {
  return {
    id: row.id,
    bin: row.bin,
    itemId: row.item_id,
    storeId: row.store_id,
    store: row.store_name || null,
    item: row.item_name || null,
    itemQtyOnHand: row.item_qty_on_hand == null ? null : Number(row.item_qty_on_hand),
    lastMovement: row.last_movement,
    balance: Number(row.balance)
  };
}

function mapBinTransfer(row) {
  return {
    id: row.id,
    item: row.item_name,
    fromBin: row.from_bin,
    toBin: row.to_bin,
    qty: Number(row.qty),
    date: row.date,
    transferredBy: row.transferred_by
  };
}

function mapRequisition(row, items = [], approvals = []) {
  return {
    id: row.id,
    srRef: row.sr_ref,
    department: row.department,
    requestedBy: row.requested_by,
    requesterRole: row.requester_role || null,
    date: row.date,
    store: row.store_name || null,
    issuingStore: row.issuing_store_name || null,
    priority: row.priority || 'Normal',
    reason: row.reason || null,
    status: row.status,
    items: items.map((i) => ({ item: i.item_name, qty: Number(i.qty), qtyApproved: i.qty_approved == null ? Number(i.qty) : Number(i.qty_approved) })),
    approvals: approvals.map((a) => ({ decision: a.decision, comments: a.comments, approvedBy: a.approved_by, approvedAt: a.approved_at }))
  };
}

function mapIssueVoucher(row, items = []) {
  return {
    id: row.id,
    sivRef: row.siv_ref,
    type: row.type,
    srRef: row.sr_ref,
    issuedTo: row.issued_to,
    issuedBy: row.issued_by,
    store: row.store_name || null,
    date: row.date,
    status: row.status,
    gateVerified: row.gate_verified,
    gateVerifiedBy: row.gate_verified_by,
    gateVerifiedAt: row.gate_verified_at,
    items: items.map((i) => ({ item: i.item_name, qty: Number(i.qty), unitPrice: Number(i.unit_price) }))
  };
}

function mapFixedAsset(row) {
  return {
    id: row.id,
    assetTag: row.asset_tag,
    name: row.name,
    category: row.category,
    store: row.store_name || null,
    assignedTo: row.assigned_to,
    status: row.status,
    acquisitionDate: row.acquisition_date ? String(row.acquisition_date).slice(0, 10) : null,
    value: Number(row.value),
    sourceGrnRef: row.source_grn_ref || null
  };
}

function mapMaterialReturn(row) {
  return {
    id: row.id,
    srnRef: row.srn_ref,
    department: row.department,
    store: row.store_name || null,
    returnedBy: row.created_by || null,
    item: row.item_name || null,
    qty: Number(row.qty),
    qtyApproved: row.qty_approved == null ? null : Number(row.qty_approved),
    qtyReceived: row.qty_received == null ? null : Number(row.qty_received),
    qtyAccepted: row.qty_accepted == null ? null : Number(row.qty_accepted),
    qtyRejected: row.qty_rejected == null ? null : Number(row.qty_rejected),
    receivingBy: row.receiving_by || null,
    receivingAt: row.receiving_at || null,
    receivingCondition: row.receiving_condition || null,
    receivingRemarks: row.receiving_remarks || null,
    reason: row.reason,
    condition: row.condition,
    originalIssueRef: row.original_issue_ref,
    evaluatedBy: row.evaluated_by,
    evaluatedAt: row.evaluated_at,
    evaluationFindings: row.evaluation_findings,
    evaluationRecommendation: row.evaluation_recommendation,
    date: row.date,
    status: row.status
  };
}

function mapMaterialTransfer(row) {
  return {
    id: row.id,
    transferRef: row.transfer_ref,
    requisitionId: row.requisition_id || null,
    requestedBy: row.requested_by || null,
    fromStore: row.from_store_name || null,
    toStore: row.to_store_name || null,
    item: row.item_name || null,
    qty: Number(row.qty),
    date: row.date,
    status: row.status,
    destinationBin: row.destination_bin || null,
    dispatchedBy: row.dispatched_by || null,
    dispatchedAt: row.dispatched_at || null,
    receivedBy: row.received_by || null,
    receivedAt: row.received_at || null,
    transferUnitPrice: row.transfer_unit_price == null ? null : Number(row.transfer_unit_price),
    gateVerified: row.gate_verified,
    gateVerifiedBy: row.gate_verified_by,
    gateVerifiedAt: row.gate_verified_at
  };
}

function mapDisposal(row) {
  return {
    id: row.id,
    disposalRef: row.disposal_ref,
    item: row.item_name || null,
    store: row.store_name || null,
    qty: Number(row.qty),
    reason: row.reason,
    dateFlagged: row.date_flagged,
    status: row.status,
    createdBy: row.created_by || null,
    approvedBy: row.approved_by || null,
    approvedAt: row.approved_at || null,
    executedBy: row.executed_by || null,
    executedAt: row.executed_at || null,
    disposalDate: row.disposal_date || null,
    disposalMethod: row.disposal_method || null,
    witness: row.witness || null,
    supportingDocument: row.supporting_document || null,
    assessmentResult: row.assessment_result || null,
    assessmentNotes: row.assessment_notes || null,
    reviewedBy: row.reviewed_by || null,
    reviewedAt: row.reviewed_at || null,
    confirmedBy: row.confirmed_by || null,
    confirmedAt: row.confirmed_at || null,
    postedBy: row.posted_by || null,
    postedAt: row.posted_at || null
  };
}

function mapAuditLog(row) {
  return {
    id: row.id,
    actorId: row.actor_id,
    actorName: row.user_name,
    actorRole: row.actor_role,
    action: row.action,
    module: row.module,
    entityType: row.entity_type,
    entityId: row.entity_id,
    entityReference: row.entity_reference,
    description: row.description,
    outcome: row.outcome,
    beforeData: row.before_data,
    afterData: row.after_data,
    changes: row.changes,
    ipAddress: row.metadata?.ip || null,
    userAgent: row.metadata?.userAgent || null,
    metadata: row.metadata,
    timestamp: row.created_at
  };
}

async function getUserStoreVisibility(user, db = { query }) {
  const storeRole = ['Store Head', 'Storekeeper'].includes(user?.role);
  if (!storeRole) {
    return {
      isMainStoreUser: false,
      assignedStoreId: null,
      assignedStoreName: null,
      scope: 'NONE',
      canViewAllStores: false,
      storeFilter: null
    };
  }

  const assignmentQuery = user?.id
    ? `SELECT s.id, s.name, s.type, s.code
       FROM store_user_assignments a
       JOIN stores s ON s.id = a.store_id
       WHERE a.user_id = $1 AND a.assignment_role = $2 AND a.active = TRUE AND s.active = TRUE
       ORDER BY s.id`
    : `SELECT s.id, s.name, s.type, s.code
       FROM stores s
       WHERE s.active = TRUE AND (s.head_of_store = $1 OR s.storekeeper = $1)
       ORDER BY s.id`;
  const { rows } = await db.query(assignmentQuery, user?.id ? [user.id, user.role] : [user?.name || '']);

  const stores = rows || [];
  const hasMultipleStores = stores.length > 1;
  const assignedStore = hasMultipleStores ? null : stores[0] || null;
  const isMainStoreUser = Boolean(!hasMultipleStores && assignedStore && assignedStore.type === 'Main Store');

  return {
    isMainStoreUser,
    assignedStoreId: assignedStore?.id || null,
    assignedStoreName: assignedStore?.name || null,
    assignedStoreType: assignedStore?.type || null,
    scope: hasMultipleStores ? 'ALL_STORES' : 'ASSIGNED_STORE_ONLY',
    canViewAllStores: hasMultipleStores,
    storeFilter: assignedStore ? { id: assignedStore.id, name: assignedStore.name } : null
  };
}

async function assertUserCanAccessStoreRecord(user, storeId, db = { query }) {
  if (!['Store Head', 'Storekeeper'].includes(user?.role)) return;
  if (storeId == null || storeId === '') return;

  const visibility = await getUserStoreVisibility(user, db);
  if (visibility.canViewAllStores) return;
  if (!visibility.assignedStoreId) {
    throw new AppError('You are not assigned to any store scope.', 403);
  }
  if (Number(storeId) !== Number(visibility.assignedStoreId)) {
    throw new AppError('This record does not belong to your assigned store.', 403);
  }
}

async function assertUserCanAccessDepartmentRecord(user, department, db = { query }) {
  if (user?.role !== 'Department Head') return;
  if (!department) {
    throw new AppError('Your account is not assigned to a department.', 403);
  }
  if (!user.department) {
    throw new AppError('Your account is not assigned to a department.', 403);
  }
  if (department !== user.department) {
    throw new AppError('This record does not belong to your department.', 403);
  }
}

function buildOwnerScope(user) {
  if (!user) return { scope: '', params: [] };

  if (user.role === 'Department Head') {
    return {
      scope: 'WHERE requested_by = $1',
      params: [user.name]
    };
  }

  if (['Store Head', 'Storekeeper'].includes(user.role)) {
    return {
      scope: 'WHERE created_by = $1 OR requested_by = $1 OR dispatched_by = $1 OR received_by = $1',
      params: [user.name]
    };
  }

  return { scope: '', params: [] };
}

module.exports = {
  resolveStoreId,
  resolveStoreHeadForStore,
  resolveSupplierId,
  resolveCategoryId,
  resolveItemId,
  resolveLocationId,
  getUserStoreVisibility,
  assertUserCanAccessStoreRecord,
  assertUserCanAccessDepartmentRecord,
  buildOwnerScope,
  mapUser,
  mapStore,
  mapCategory,
  mapItem,
  mapLocation,
  mapGoodsReceipt,
  mapStockTransaction,
  mapBinCard,
  mapBinTransfer,
  mapRequisition,
  mapIssueVoucher,
  mapFixedAsset,
  mapMaterialReturn,
  mapMaterialTransfer,
  mapDisposal,
  mapAuditLog
};
