// Central place for roles, statuses and navigation permissions.
// Adjust ROLES to match whatever the backend team finalizes for auth claims.

export const ROLES = {
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
}

export const ALL_ROLES = Object.values(ROLES)

// Generic status vocabulary shared across GRN, Requisition, SIV, SRN, Transfer, Disposal
// Legacy (keeping for backward compatibility during transition)
export const STATUS = {
  DRAFT: 'Draft',
  PENDING: 'Pending',
  UNDER_EVALUATION: 'Under Evaluation',
  APPROVED: 'Approved',
  REJECTED: 'Rejected',
  ISSUED: 'Issued',
  COMPLETED: 'Completed',
  CANCELLED: 'Cancelled',
  ACTIVE: 'Active',
  INACTIVE: 'Inactive'
}

// Detailed workflow statuses per module
export const GRN_STATUS = {
  DRAFT: 'Draft',
  SUBMITTED: 'Submitted',
  STORE_HEAD_REVIEW: 'Store Head Review',
  PENDING_EVAL: 'Pending Evaluation',
  UNDER_EVAL: 'Under Evaluation',
  ACCEPTED: 'Accepted',
  PARTIALLY_ACCEPTED: 'Partially Accepted',
  REJECTED: 'Rejected',
  GRN_GENERATED: 'GRN Generated',
  POSTED: 'Posted'
}

export const REQUISITION_STATUS = {
  DRAFT: 'Draft',
  SUBMITTED: 'Submitted',
  PENDING: 'Pending',
  PENDING_APPROVAL: 'Pending Approval',
  PARTIALLY_APPROVED: 'Partially Approved',
  APPROVED: 'Approved',
  FULFILLED: 'Fulfilled',
  REJECTED: 'Rejected',
  RETURNED: 'Returned for Correction'
}

export const SIV_STATUS = {
  PRELIMINARY: 'Preliminary',
  PENDING_APPROVAL: 'Pending Approval',
  APPROVED: 'Approved',
  POSTED: 'Posted',
  REJECTED: 'Rejected'
}

export const TRANSFER_STATUS = {
  DRAFT: 'Draft',
  SUBMITTED: 'Submitted',
  PENDING_APPROVAL: 'Pending Approval',
  APPROVED: 'Approved',
  DISPATCHED: 'Dispatched',
  RECEIVED: 'Received',
  COMPLETED: 'Completed',
  RETURNED: 'Returned for Correction',
  REJECTED: 'Rejected'
}

export const RETURN_STATUS = {
  DRAFT: 'Draft',
  SUBMITTED: 'Submitted',
  PENDING_REVIEW: 'Pending Review',
  RETURNED_FOR_CORRECTION: 'Returned for Correction',
  APPROVED: 'Approved',
  UNDER_RECEIVING: 'Under Receiving',
  FULLY_ACCEPTED: 'Fully Accepted',
  PARTIALLY_ACCEPTED: 'Partially Accepted',
  RETURN_REJECTED: 'Return Rejected',
  REJECTED: 'Rejected',
  RETURNED_TO_STOCK: 'Returned to Stock'
}

export const DISPOSAL_STATUS = {
  FLAGGED: 'Flagged',
  QUARANTINED: 'Quarantined',
  UNDER_TECHNICAL_ASSESSMENT: 'Under Technical Assessment',
  REPAIRABLE: 'Repairable',
  UNUSABLE: 'Unusable',
  SEND_FOR_REPAIR: 'Send for Repair',
  RETURNED_TO_STOCK: 'Returned to Stock',
  DISPOSAL_REQUESTED: 'Disposal Requested',
  PENDING_STORE_HEAD_REVIEW: 'Pending Store Head Review',
  STORE_HEAD_REVIEW: 'Store Head Review',
  RECOMMENDED_FOR_DISPOSAL: 'Recommended for Disposal',
  PENDING_AUTHORIZATION: 'Pending Authorization',
  READY_FOR_DISPOSAL: 'Ready for Disposal',
  DISPOSED: 'Disposed',
  PENDING_CONFIRMATION: 'Pending Confirmation',
  CONFIRMED: 'Confirmed',
  POSTED: 'Posted',
  REQUESTED: 'Requested',
  PENDING_REVIEW: 'Pending Review',
  RETURNED_FOR_CORRECTION: 'Returned for Correction',
  APPROVED: 'Approved',
  REJECTED: 'Rejected',
  EXECUTED: 'Executed',
  COMPLETED: 'Completed',
  CLOSED: 'Closed'
}

export const ASSET_STATUS = {
  REGISTERED: 'Registered',
  IN_STORE: 'In Store',
  ASSIGNED: 'Assigned',
  IN_USE: 'In Use',
  MAINTENANCE: 'Maintenance',
  LOST: 'Lost',
  DAMAGED: 'Damaged',
  DISPOSED: 'Disposed'
}

export const AUDIT_OUTCOME_COLOR = {
  SUCCESS: 'bg-success-50 text-success-700',
  FAILED: 'bg-danger-50 text-danger-700',
  WARNING: 'bg-warning-50 text-warning-700'
}

export const STATUS_COLOR = {
  // Legacy
  [STATUS.DRAFT]: 'bg-ink-100 text-ink-500',
  [STATUS.PENDING]: 'bg-warning-50 text-warning-700',
  [STATUS.UNDER_EVALUATION]: 'bg-info-50 text-info-700',
  [STATUS.APPROVED]: 'bg-success-50 text-success-700',
  [STATUS.REJECTED]: 'bg-danger-50 text-danger-700',
  [STATUS.ISSUED]: 'bg-info-50 text-info-700',
  [STATUS.COMPLETED]: 'bg-success-50 text-success-700',
  [STATUS.CANCELLED]: 'bg-ink-200 text-ink-600',
  [STATUS.ACTIVE]: 'bg-success-50 text-success-700',
  [STATUS.INACTIVE]: 'bg-ink-200 text-ink-600',
  [SIV_STATUS.PRELIMINARY]: 'bg-ink-100 text-ink-600',
  [SIV_STATUS.PENDING_APPROVAL]: 'bg-warning-50 text-warning-700',
  [SIV_STATUS.POSTED]: 'bg-success-50 text-success-700',

  // GRN
  [GRN_STATUS.STORE_HEAD_REVIEW]: 'bg-warning-50 text-warning-700',
  [GRN_STATUS.SUBMITTED]: 'bg-warning-50 text-warning-700',
  [GRN_STATUS.PENDING_EVAL]: 'bg-warning-50 text-warning-700',
  [GRN_STATUS.ACCEPTED]: 'bg-success-50 text-success-700',
  [GRN_STATUS.PARTIALLY_ACCEPTED]: 'bg-info-50 text-info-700',
  [GRN_STATUS.GRN_GENERATED]: 'bg-success-50 text-success-700',
  [GRN_STATUS.POSTED]: 'bg-success-50 text-success-700',

  // Requisition
  [REQUISITION_STATUS.PARTIALLY_APPROVED]: 'bg-info-50 text-info-700',
  [REQUISITION_STATUS.FULFILLED]: 'bg-success-50 text-success-700',

  // Shared correction state (Requisition + Transfer + Disposal all use this string)
  [REQUISITION_STATUS.RETURNED]: 'bg-warning-50 text-warning-700',

  // Transfer
  [TRANSFER_STATUS.PENDING_APPROVAL]: 'bg-warning-50 text-warning-700',
  [TRANSFER_STATUS.DISPATCHED]: 'bg-info-50 text-info-700',
  [TRANSFER_STATUS.RECEIVED]: 'bg-success-50 text-success-700',

  // Return
  [RETURN_STATUS.PENDING_REVIEW]: 'bg-warning-50 text-warning-700',
  [RETURN_STATUS.RETURNED_FOR_CORRECTION]: 'bg-warning-50 text-warning-700',
  [RETURN_STATUS.APPROVED]: 'bg-info-50 text-info-700',
  [RETURN_STATUS.UNDER_RECEIVING]: 'bg-info-50 text-info-700',
  [RETURN_STATUS.FULLY_ACCEPTED]: 'bg-success-50 text-success-700',
  [RETURN_STATUS.PARTIALLY_ACCEPTED]: 'bg-success-50 text-success-700',
  [RETURN_STATUS.RETURN_REJECTED]: 'bg-danger-50 text-danger-700',
  [RETURN_STATUS.RETURNED_TO_STOCK]: 'bg-success-50 text-success-700',

  // Disposal
  [DISPOSAL_STATUS.FLAGGED]: 'bg-warning-50 text-warning-700',
  [DISPOSAL_STATUS.QUARANTINED]: 'bg-orange-50 text-orange-700',
  [DISPOSAL_STATUS.UNDER_TECHNICAL_ASSESSMENT]: 'bg-indigo-50 text-indigo-700',
  [DISPOSAL_STATUS.REPAIRABLE]: 'bg-cyan-50 text-cyan-700',
  [DISPOSAL_STATUS.UNUSABLE]: 'bg-red-50 text-red-700',
  [DISPOSAL_STATUS.SEND_FOR_REPAIR]: 'bg-amber-50 text-amber-700',
  [DISPOSAL_STATUS.REQUESTED]: 'bg-info-50 text-info-700',
  [DISPOSAL_STATUS.PENDING_REVIEW]: 'bg-warning-50 text-warning-700',
  [DISPOSAL_STATUS.RETURNED_FOR_CORRECTION]: 'bg-orange-50 text-orange-700',
  [DISPOSAL_STATUS.EXECUTED]: 'bg-success-50 text-success-700',
  [DISPOSAL_STATUS.COMPLETED]: 'bg-emerald-50 text-emerald-700',
  [DISPOSAL_STATUS.CLOSED]: 'bg-slate-200 text-slate-700',

  // Assets
  [ASSET_STATUS.REGISTERED]: 'bg-ink-100 text-ink-600',
  [ASSET_STATUS.IN_STORE]: 'bg-brand-50 text-brand-700',
  [ASSET_STATUS.ASSIGNED]: 'bg-warning-50 text-warning-700',
  [ASSET_STATUS.IN_USE]: 'bg-success-50 text-success-700',
  [ASSET_STATUS.MAINTENANCE]: 'bg-danger-50 text-danger-700',
  [ASSET_STATUS.LOST]: 'bg-danger-50 text-danger-700',
  [ASSET_STATUS.DAMAGED]: 'bg-danger-50 text-danger-700',
  [ASSET_STATUS.DISPOSED]: 'bg-ink-200 text-ink-500'
}

export const UNITS = [
  'pcs',
  'pair',
  'dozen',
  'pack',
  'box',
  'carton',
  'crate',
  'pallet',
  'bag',
  'sack',
  'can',
  'tin',
  'bottle',
  'jar',
  'tube',
  'vial',
  'ampoule',
  'tablet',
  'capsule',
  'sachet',
  'roll',
  'ream',
  'set',
  'bundle',
  'kg',
  'gram',
  'litre',
  'millilitre',
  'meter',
  'square meter'
]
