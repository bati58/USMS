import { ROLES, REQUISITION_STATUS } from './constants'

/**
 * Role-Based Access Control (RBAC) aligned with SRS section 4.4.8.
 * Maps each actor to pages and actions they may perform in the system.
 */

export const ROLE_PERMISSIONS = {
    [ROLES.ADMIN]: {
        name: 'Administrator',
        canAccessPages: [
            '/',
            '/settings',
            '/stores',
            '/categories',
            '/items',
            '/locations',
            '/suppliers',
            '/departments',
            '/goods-receipt',
            '/goods-receipt/evaluation',
            '/grn-documents',
            '/stock-cards',
            '/bin-cards',
            '/stock-transfer',
            '/requisitions',
            '/issue-vouchers',
            '/material-return',
            '/material-transfer',
            '/fixed-assets',
            '/user-cards',
            '/disposal',
            '/users',
            '/reports',
            '/audit-log',
            '/gate-pass', '/stock-taking', '/reconciliation', '/settings/business-rules'],
        canCreate: ['stores', 'categories', 'items', 'users', 'suppliers', 'departments', 'locations'],
        canEdit: ['stores', 'categories', 'items', 'users', 'suppliers', 'departments', 'locations'],
        canDelete: ['stores', 'categories', 'items', 'suppliers', 'departments', 'locations'],
        canApprove: [],
        canReject: [],
        canEvaluate: [],
        canVerifyGatePass: false,
        canAddUsers: true,
        canDeleteUsers: false,
        canViewAuditLog: true,
        canExportAuditLog: true,
        canViewFifoValuation: true,
        sidebar: 'full'
    },

    [ROLES.PAO]: {
        name: 'Property Administration Officer',
        // SRS: supervises property/inventory governance, approves requests, monitors activities
        canAccessPages: [
            '/',
            '/settings',
            '/stores',
            '/categories',
            '/items',
            '/locations',
            '/suppliers',
            '/departments',
            '/requisitions',
            '/issue-vouchers',
            '/material-return',
            '/material-transfer',
            '/fixed-assets',
            '/user-cards',
            '/disposal',
            '/stock-transfer',
            '/stock-cards',
            '/bin-cards',
            '/goods-receipt',
            '/grn-documents',
            '/reports',
            '/audit-log',
            '/stock-taking',
            '/reconciliation'
        ],
        canCreate: ['stores', 'categories', 'suppliers', 'departments', 'fixedAssets', 'userCards'],
        canEdit: ['stores', 'categories', 'suppliers', 'departments', 'fixedAssets', 'userCards'],
        canDelete: [],
        canApprove: ['requisitions', 'materialReturns', 'materialTransfers', 'disposals', 'stockTaking'],
        canReject: ['requisitions', 'materialReturns', 'materialTransfers', 'disposals'],
        canEvaluate: [],
        canVerifyGatePass: false,
        canAddUsers: false,
        canDeleteUsers: false,
        canViewAuditLog: true,
        canExportAuditLog: true,
        canViewFifoValuation: false,
        sidebar: 'limited'
    },

    [ROLES.STORE_HEAD]: {
        name: 'Store Head',
        canAccessPages: [
            '/',
            '/stores',
            '/items',
            '/locations',
            '/suppliers',
            '/goods-receipt',
            '/goods-receipt/evaluation',
            '/grn-documents',
            '/stock-cards',
            '/bin-cards',
            '/stock-transfer',
            '/requisitions',
            '/issue-vouchers',
            '/material-return',
            '/material-transfer',
            '/reports',
            '/categories',
            '/stock-taking',
            '/reconciliation',
            '/user-cards'
        ],
        canCreate: ['materialTransfers', 'fixedAssets', 'userCards'],
        canEdit: ['stores', 'fixedAssets', 'userCards'],
        canDelete: [],
        canApprove: ['issueVouchers', 'requisitions', 'materialReturns', 'materialTransfers', 'stockTaking'],
        canReject: ['issueVouchers', 'requisitions', 'materialReturns', 'materialTransfers', 'stockTaking'],
        canEvaluate: [],
        canVerifyGatePass: false,
        canAddUsers: false,
        canDeleteUsers: false,
        canViewAuditLog: false,
        canViewFifoValuation: false,
        sidebar: 'limited'
    },

    [ROLES.STOREKEEPER]: {
        name: 'Storekeeper',
        // SRS: receives and issues stock, updates inventory records (bin cards)
        canAccessPages: ['/', '/settings', '/items', '/locations', '/goods-receipt', '/grn-documents', '/stock-cards', '/bin-cards', '/requisitions', '/issue-vouchers', '/stock-transfer', '/material-return', '/material-transfer', '/user-cards', '/stock-taking', '/reports'],
        canCreate: ['goodsReceipts', 'issueVouchers', 'stockTransfer', 'materialTransfers', 'userCards'],
        canEdit: ['goodsReceipts', 'userCards'],
        canDelete: [],
        canApprove: [],
        canReject: [],
        canEvaluate: [],
        canVerifyGatePass: false,
        canAddUsers: false,
        canDeleteUsers: false,
        canViewAuditLog: false,
        canViewFifoValuation: false,
        sidebar: 'minimal'
    },

    [ROLES.STOCK_CLERK]: {
        name: 'Stock Clerk',
        // SRS: maintains stock records, updates transactions, prepares reports
        canAccessPages: ['/', '/settings', '/items', '/locations', '/stock-cards', '/bin-cards', '/reports', '/stock-taking', '/reconciliation'],
        canCreate: [],
        canEdit: [],
        canDelete: [],
        canApprove: [],
        canReject: [],
        canEvaluate: [],
        canVerifyGatePass: false,
        canAddUsers: false,
        canDeleteUsers: false,
        canViewAuditLog: false,
        canViewFifoValuation: false,
        sidebar: 'minimal'
    },

    [ROLES.TEC]: {
        name: 'Technical Evaluation Committee',
        canAccessPages: ['/', '/goods-receipt/evaluation', '/grn-documents', '/reports'],
        canCreate: [],
        canEdit: [],
        canDelete: [],
        canApprove: ['goodsReceipts'],
        canReject: ['goodsReceipts'],
        canEvaluate: ['goodsReceipts'],
        canVerifyGatePass: false,
        canAddUsers: false,
        canDeleteUsers: false,
        canViewAuditLog: false,
        canViewFifoValuation: false,
        sidebar: 'minimal'
    },

    [ROLES.DEPT_HEAD]: {
        name: 'Department Head',
        // SRS: approves requisitions from their department
        canAccessPages: ['/', '/settings', '/items', '/requisitions', '/material-return', '/material-transfer', '/user-cards', '/reports'],
        canCreate: ['requisitions', 'materialReturns', 'materialTransfers'],
        canEdit: [],
        canDelete: [],
        canApprove: ['requisitions'],
        canReject: ['requisitions'],
        canEvaluate: [],
        canVerifyGatePass: false,
        canAddUsers: false,
        canDeleteUsers: false,
        canViewAuditLog: false,
        canViewFifoValuation: false,
        sidebar: 'limited'
    },

    [ROLES.ACCOUNTANT]: {
        name: 'Accountant',
        // SRS: views financial reports and manages inventory valuation (FIFO)
        canAccessPages: ['/', '/settings', '/stores', '/categories', '/items', '/stock-cards', '/bin-cards', '/goods-receipt', '/grn-documents', '/issue-vouchers', '/material-return', '/material-transfer', '/reports', '/audit-log', '/suppliers', '/reconciliation'],
        canCreate: [],
        canEdit: [],
        canDelete: [],
        canApprove: [],
        canReject: [],
        canEvaluate: [],
        canVerifyGatePass: false,
        canAddUsers: false,
        canDeleteUsers: false,
        canViewAuditLog: true,
        canViewFifoValuation: true,
        sidebar: 'limited'
    },

    [ROLES.SECURITY]: {
        name: 'Security Officer',
        // SRS: gate verification only; view supporting delivery and issue docs at the campus boundary
        canAccessPages: ['/', '/settings', '/gate-pass', '/goods-receipt', '/issue-vouchers', '/reports', '/audit-log'],
        canCreate: [],
        canEdit: [],
        canDelete: [],
        canApprove: [],
        canReject: [],
        canEvaluate: [],
        canVerifyGatePass: true,
        canAddUsers: false,
        canDeleteUsers: false,
        canViewAuditLog: true,
        canViewFifoValuation: false,
        sidebar: 'minimal'
    }
}

/**
 * Check if a user role can perform a specific action
 */
export function canPerformAction(userRole, action, entityType) {
    const perms = ROLE_PERMISSIONS[userRole]
    if (!perms) return false

    switch (action) {
        case 'create':
            return perms.canCreate.includes(entityType)
        case 'edit':
            return perms.canEdit.includes(entityType)
        case 'delete':
            return perms.canDelete.includes(entityType)
        case 'approve':
            return perms.canApprove.includes(entityType)
        case 'reject':
            return perms.canReject.includes(entityType)
        case 'evaluate':
            return perms.canEvaluate.includes(entityType)
        case 'verifyGatePass':
            return perms.canVerifyGatePass
        case 'addUser':
            return perms.canAddUsers
        case 'deleteUser':
            return perms.canDeleteUsers
        case 'viewAuditLog':
            return Boolean(perms.canViewAuditLog)
        case 'exportAuditLog':
            return Boolean(perms.canExportAuditLog)
        case 'viewFifoValuation':
            return Boolean(perms.canViewFifoValuation)
        default:
            return false
    }
}

/**
 * Check if a user can access a specific page
 */
export function canAccessPage(userRole, pagePath) {
    const perms = ROLE_PERMISSIONS[userRole]
    if (!perms) return false
    // Exact match
    if (perms.canAccessPages.includes(pagePath)) return true
    // Sub-path match: /goods-receipt/evaluation matches /goods-receipt
    // Also handles detail routes like /stock-cards/123
    return perms.canAccessPages.some((allowed) => {
        if (allowed === '/') return false // don't match root to everything
        return pagePath.startsWith(allowed + '/') || pagePath === allowed
    })
}

/**
 * Get all pages a role can access
 */
export function getAccessiblePages(userRole) {
    const perms = ROLE_PERMISSIONS[userRole]
    if (!perms) return []
    return perms.canAccessPages
}

/**
 * Get sidebar view type for a role
 */
export function getSidebarType(userRole) {
    const perms = ROLE_PERMISSIONS[userRole]
    if (!perms) return 'none'
    return perms.sidebar
}

/**
 * Department heads may only approve requisitions raised for their department.
 * A requisition awaits a decision in status 'Submitted' (the status the backend
 * actually sets on submit); 'Pending' is accepted too for any legacy record.
 */
const REQUISITION_AWAITING_DECISION = [REQUISITION_STATUS.SUBMITTED, REQUISITION_STATUS.PENDING]

export function canApproveRequisition(user, requisition) {
    if (!user || !requisition) return false
    if (!canPerformAction(user.role, 'approve', 'requisitions')) return false
    if (!REQUISITION_AWAITING_DECISION.includes(requisition.status)) return false
    if (user.role === ROLES.DEPT_HEAD) {
        const dept = user.department || ''
        return requisition.department === dept && requisition.requestedBy !== user.name
    }
    return true
}

export function canRejectRequisition(user, requisition) {
    if (!user || !requisition) return false
    if (!canPerformAction(user.role, 'reject', 'requisitions')) return false
    if (!REQUISITION_AWAITING_DECISION.includes(requisition.status)) return false
    if (user.role === ROLES.DEPT_HEAD) {
        const dept = user.department || ''
        return requisition.department === dept && requisition.requestedBy !== user.name
    }
    return true
}


