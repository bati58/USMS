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

  const sql = storeId == null
    ? 'SELECT id FROM items WHERE name = $1'
    : 'SELECT id FROM items WHERE name = $1 AND store_id = $2';
  const params = storeId == null
    ? [itemName]
    : [itemName, storeId];

  const { rows } = await client.query(sql, params);
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
    location: row.location,
    headOfStore: row.head_of_store,
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
    locationId: row.location_id || null,
    location: row.location_name || null,
    bin: row.bin,
    unit: row.unit,
    minLevel: Number(row.min_level),
    maxLevel: Number(row.max_level),
    reorderLevel: Number(row.reorder_level),
    qtyOnHand: Number(row.qty_on_hand),
    unitPrice: Number(row.unit_price),
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
    grnRef: row.grn_ref,
    supplier: row.supplier,
    poRef: row.po_ref,
    receivedDate: row.received_date,
    receivedBy: row.received_by,
    store: row.store_name || null,
    status: row.status,
    evaluationNote: row.evaluation_note,
    evaluatedBy: row.evaluated_by,
    gateVerified: row.gate_verified,
    gateVerifiedBy: row.gate_verified_by,
    gateVerifiedAt: row.gate_verified_at,
    items: items.map((i) => ({ item: i.item_name, qty: Number(i.qty), unitPrice: Number(i.unit_price) }))
  };
}

function mapStockTransaction(row) {
  return {
    id: row.id,
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
    store: row.store_name || null,
    item: row.item_name || null,
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
    date: row.date,
    store: row.store_name || null,
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
    acquisitionDate: row.acquisition_date,
    value: Number(row.value)
  };
}

function mapMaterialReturn(row) {
  return {
    id: row.id,
    srnRef: row.srn_ref,
    department: row.department,
    store: row.store_name || null,
    item: row.item_name || null,
    qty: Number(row.qty),
    qtyApproved: row.qty_approved == null ? null : Number(row.qty_approved),
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
    status: row.status
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

module.exports = {
  resolveStoreId,
  resolveSupplierId,
  resolveCategoryId,
  resolveItemId,
  resolveLocationId,
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
