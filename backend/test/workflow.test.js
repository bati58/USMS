const test = require('node:test');
const assert = require('node:assert/strict');
const { pathToFileURL } = require('node:url');
const { assertTransition } = require('../src/utils/workflow');
const { canEditStockTakingCounts, isOpenStockTakingSession } = require('../src/utils/workflow');
const { canRead, canWrite, canAct, canDelete } = require('../src/utils/permissions');

test('only reusable return conditions can be restocked', () => {
    const isReusable = (condition) => ['good', 'usable', 'reusable'].includes(String(condition || '').trim().toLowerCase());
    assert.equal(isReusable('Good'), true);
    assert.equal(isReusable('Reusable'), true);
    assert.equal(isReusable('Damaged'), false);
    assert.equal(isReusable(undefined), false);
});

test('allows a receipt to move into technical evaluation', () => {
    assert.doesNotThrow(() => assertTransition('goodsReceipt', 'Pending', 'Under Evaluation'));
});

test('rejects a receipt that is already posted', () => {
    assert.doesNotThrow(() => assertTransition('goodsReceipt', 'GRN Generated', 'Posted'));
    assert.throws(
        () => assertTransition('goodsReceipt', 'Posted', 'Rejected'),
        (error) => error.statusCode === 409
    );
});

test('goods receipt workflow must follow storekeeper -> store head -> TEC -> posted flow', () => {
    assert.doesNotThrow(() => assertTransition('goodsReceipt', 'Draft', 'Submitted'));
    assert.doesNotThrow(() => assertTransition('goodsReceipt', 'Submitted', 'Pending Evaluation'));
    assert.doesNotThrow(() => assertTransition('goodsReceipt', 'Pending Evaluation', 'Under Evaluation'));
    assert.doesNotThrow(() => assertTransition('goodsReceipt', 'Under Evaluation', 'Accepted'));
    assert.doesNotThrow(() => assertTransition('goodsReceipt', 'Accepted', 'GRN Generated'));
    assert.doesNotThrow(() => assertTransition('goodsReceipt', 'GRN Generated', 'Posted'));
    assert.throws(
        () => assertTransition('goodsReceipt', 'Draft', 'Accepted'),
        (error) => error.statusCode === 409
    );
});

test('goods receipt submission routes approval to the receiving store head for that store', async () => {
    const { query } = require('../src/config/db');
    const { resolveStoreHeadForStore } = require('../src/controllers/_helpers');

    const { rows: mainStore } = await query("SELECT id, head_of_store FROM stores WHERE name = 'Main Store' LIMIT 1");
    const mainHeadId = await resolveStoreHeadForStore(mainStore[0].id);
    const { rows: mainUser } = await query('SELECT name FROM users WHERE id = $1 AND role = $2', [mainHeadId, 'Store Head']);

    assert.ok(mainHeadId, 'Main Store must resolve to a store head');
    assert.equal(mainUser[0].name, mainStore[0].head_of_store);

    const { rows: chemStore } = await query("SELECT id, head_of_store FROM stores WHERE name = 'Chemical Engineering Dept. Store' LIMIT 1");
    const chemHeadId = await resolveStoreHeadForStore(chemStore[0].id);
    const { rows: chemUser } = await query('SELECT name FROM users WHERE id = $1 AND role = $2', [chemHeadId, 'Store Head']);

    assert.ok(chemHeadId, 'Chemical Engineering Dept. Store must resolve to a store head');
    assert.equal(chemUser[0].name, chemStore[0].head_of_store);
});

test('all-store operational users must not be artificially scoped to a single store', async () => {
    const { query } = require('../src/config/db');
    const { getUserStoreVisibility } = require('../src/controllers/_helpers');

    const uniqueName = `Multi-Store User ${Date.now()}`;
    await query(`
      INSERT INTO stores (name, code, type, location, head_of_store, storekeeper, active)
      VALUES
        ($1, $2, 'Main Store', 'Test Hub', $3, 'Test Storekeeper 1', TRUE),
        ($4, $5, 'Department Store', 'Test Hub 2', $3, 'Test Storekeeper 2', TRUE)
      ON CONFLICT (code) DO NOTHING
    `, [
        `${uniqueName} A`, `${uniqueName.replace(/\s+/g, '-').toLowerCase()}-a`, uniqueName,
        `${uniqueName} B`, `${uniqueName.replace(/\s+/g, '-').toLowerCase()}-b`
    ]);

    try {
        const visibility = await getUserStoreVisibility({ role: 'Store Head', name: uniqueName }, { query });
        assert.equal(visibility.canViewAllStores, true);
        assert.equal(visibility.assignedStoreId, null);
        assert.equal(visibility.assignedStoreName, null);
        assert.equal(visibility.scope, 'ALL_STORES');
    } finally {
        await query('DELETE FROM stores WHERE head_of_store = $1', [uniqueName]);
    }
});

test('auth store resolver accepts the pg query function contract used in login', async () => {
    const { resolveAssignedStoreName } = require('../src/controllers/auth.controller');

    test('operational monitoring access follows the role matrix boundaries', () => {
        assert.equal(canRead('goods-receipts', 'Department Head'), false);
        assert.equal(canRead('bin-cards', 'Technical Evaluation Committee'), false);
        assert.equal(canRead('requisitions', 'Technical Evaluation Committee'), false);
        assert.equal(canRead('issue-vouchers', 'Technical Evaluation Committee'), false);
        assert.equal(canRead('material-transfers', 'Technical Evaluation Committee'), false);
        assert.equal(canRead('user-cards', 'Technical Evaluation Committee'), false);
        assert.equal(canRead('gate-pass', 'Property Administration Officer'), true);
        assert.equal(canRead('gate-pass', 'Store Head'), true);
        assert.equal(canRead('gate-pass', 'Storekeeper'), true);
        assert.equal(canWrite('bin-transfers', 'Stock Clerk'), true);
        assert.equal(canWrite('user-cards', 'Department Head'), true);
    });

    const multiStoreResult = await resolveAssignedStoreName('Multi Store User', 'Store Head', async () => ({
        rows: [{ name: 'Main Store' }, { name: 'Department Store' }]
    }));

    const singleStoreResult = await resolveAssignedStoreName('Sara Alemu', 'Storekeeper', async () => ({
        rows: [{ name: 'Main Store' }]
    }));

    assert.equal(multiStoreResult, null);
    assert.equal(singleStoreResult, 'Main Store');
});

test('stock clerk notifications only appear for the assigned clerk, not every clerk', async () => {
    const { pathToFileURL } = require('node:url');
    const frontendUrl = pathToFileURL(require('node:path').resolve(__dirname, '../../frontend/src/utils/buildNotifications.js')).href;
    const { buildNotifications } = await import(frontendUrl);

    const assigned = buildNotifications(
        { role: 'Stock Clerk', name: 'Kaleb Mulugeta' },
        {
            items: [],
            grns: [],
            reqs: [],
            returns: [],
            transfers: [],
            disposals: [],
            vouchers: [],
            stockTaking: [{ id: 1, status: 'Submitted', sessionRef: 'STK-2026-0002', store: 'Main Store', countDate: '2026-09-01', assignedTo: 'Kaleb Mulugeta', createdBy: 'Yonas Bekele' }]
        }
    );

    const notAssigned = buildNotifications(
        { role: 'Stock Clerk', name: 'Kaleb Mulugeta' },
        {
            items: [],
            grns: [],
            reqs: [],
            returns: [],
            transfers: [],
            disposals: [],
            vouchers: [],
            stockTaking: [{ id: 2, status: 'Submitted', sessionRef: 'STK-2026-0003', store: 'Main Store', countDate: '2026-09-01', assignedTo: 'Jane Doe', createdBy: 'Yonas Bekele' }]
        }
    );

    assert.ok(assigned.some((n) => n.title === 'Stock Count Submitted' && n.message.includes('STK-2026-0002')));
    assert.equal(notAssigned.some((n) => n.message.includes('STK-2026-0003')), false);
});

test('requires an approved transfer to be dispatched', () => {
    assert.throws(
        () => assertTransition('materialTransfer', 'Pending Approval', 'Dispatched'),
        (error) => error.statusCode === 409
    );
    assert.doesNotThrow(() => assertTransition('materialTransfer', 'Approved', 'Dispatched'));
});

test('a submitted requisition can be approved or returned for correction', () => {
    assert.doesNotThrow(() => assertTransition('requisition', 'Submitted', 'Approved'));
    assert.doesNotThrow(() => assertTransition('requisition', 'Submitted', 'Partially Approved'));
    assert.doesNotThrow(() => assertTransition('requisition', 'Submitted', 'Returned for Correction'));
    // A returned requisition can be resubmitted, closing the loop (no dead-end).
    assert.doesNotThrow(() => assertTransition('requisition', 'Returned for Correction', 'Submitted'));
});

test('material returns follow the real return lifecycle with review, receiving, and stock posting', () => {
    assert.doesNotThrow(() => assertTransition('materialReturn', 'Draft', 'Submitted'));
    assert.doesNotThrow(() => assertTransition('materialReturn', 'Submitted', 'Returned for Correction'));
    assert.doesNotThrow(() => assertTransition('materialReturn', 'Returned for Correction', 'Submitted'));
    assert.doesNotThrow(() => assertTransition('materialReturn', 'Submitted', 'Approved'));
    assert.doesNotThrow(() => assertTransition('materialReturn', 'Submitted', 'Pending Review'));
    assert.doesNotThrow(() => assertTransition('materialReturn', 'Pending Review', 'Approved'));
    assert.doesNotThrow(() => assertTransition('materialReturn', 'Pending Review', 'Rejected'));
    assert.doesNotThrow(() => assertTransition('materialReturn', 'Approved', 'Under Receiving'));
    assert.doesNotThrow(() => assertTransition('materialReturn', 'Under Receiving', 'Fully Accepted'));
    assert.doesNotThrow(() => assertTransition('materialReturn', 'Fully Accepted', 'Returned to Stock'));
    assert.doesNotThrow(() => assertTransition('materialReturn', 'Under Receiving', 'Partially Accepted'));
    assert.doesNotThrow(() => assertTransition('materialReturn', 'Under Receiving', 'Return Rejected'));
    assert.throws(
        () => assertTransition('materialReturn', 'Submitted', 'Returned to Stock'),
        (error) => error.statusCode === 409
    );
    assert.equal(canAct('material-returns', 'Property Administration Officer'), false);
    assert.equal(canAct('material-returns', 'Store Head'), true);
    assert.equal(canAct('material-returns-receive', 'Storekeeper'), true);
});

test('a pending-approval transfer can be approved, rejected, or returned', () => {
    assert.doesNotThrow(() => assertTransition('materialTransfer', 'Pending Approval', 'Approved'));
    assert.doesNotThrow(() => assertTransition('materialTransfer', 'Pending Approval', 'Rejected'));
    assert.doesNotThrow(() => assertTransition('materialTransfer', 'Pending Approval', 'Returned for Correction'));
    assert.doesNotThrow(() => assertTransition('materialTransfer', 'Returned for Correction', 'Pending Approval'));
});

test('stock-taking follows the amended operational review flow', () => {
    assert.doesNotThrow(() => assertTransition('stockTaking', 'Draft', 'Scheduled'));
    assert.doesNotThrow(() => assertTransition('stockTaking', 'Scheduled', 'In Progress'));
    assert.doesNotThrow(() => assertTransition('stockTaking', 'In Progress', 'Submitted'));
    assert.doesNotThrow(() => assertTransition('stockTaking', 'Submitted', 'Under Review'));
    assert.doesNotThrow(() => assertTransition('stockTaking', 'Under Review', 'Variance Detected'));
    assert.doesNotThrow(() => assertTransition('stockTaking', 'Variance Detected', 'Investigation'));
    assert.doesNotThrow(() => assertTransition('stockTaking', 'Investigation', 'Adjustment Proposed'));
    assert.doesNotThrow(() => assertTransition('stockTaking', 'Adjustment Proposed', 'Approved'));
    assert.doesNotThrow(() => assertTransition('stockTaking', 'Approved', 'Posted'));
    assert.doesNotThrow(() => assertTransition('stockTaking', 'Posted', 'Closed'));
    assert.doesNotThrow(() => assertTransition('stockTaking', 'Submitted', 'Recount Required'));
    assert.doesNotThrow(() => assertTransition('stockTaking', 'Recount Required', 'Submitted'));
    assert.throws(
        () => assertTransition('stockTaking', 'Submitted', 'Posted'),
        (error) => error.statusCode === 409
    );
});

test('disposal follows the full quarantine, assessment, review, execution, and closure lifecycle', () => {
    assert.doesNotThrow(() => assertTransition('disposal', 'Flagged', 'Quarantined'));
    assert.doesNotThrow(() => assertTransition('disposal', 'Quarantined', 'Under Technical Assessment'));
    assert.doesNotThrow(() => assertTransition('disposal', 'Under Technical Assessment', 'Repairable'));
    assert.doesNotThrow(() => assertTransition('disposal', 'Repairable', 'Send for Repair'));
    assert.doesNotThrow(() => assertTransition('disposal', 'Under Technical Assessment', 'Unusable'));
    assert.doesNotThrow(() => assertTransition('disposal', 'Unusable', 'Requested'));
    assert.doesNotThrow(() => assertTransition('disposal', 'Requested', 'Pending Review'));
    assert.doesNotThrow(() => assertTransition('disposal', 'Pending Review', 'Approved'));
    assert.doesNotThrow(() => assertTransition('disposal', 'Pending Review', 'Rejected'));
    assert.doesNotThrow(() => assertTransition('disposal', 'Pending Review', 'Returned for Correction'));
    assert.doesNotThrow(() => assertTransition('disposal', 'Returned for Correction', 'Requested'));
    assert.doesNotThrow(() => assertTransition('disposal', 'Approved', 'Executed'));
    assert.doesNotThrow(() => assertTransition('disposal', 'Executed', 'Completed'));
    assert.doesNotThrow(() => assertTransition('disposal', 'Completed', 'Closed'));
    assert.throws(
        () => assertTransition('disposal', 'Requested', 'Closed'),
        (error) => error.statusCode === 409
    );
});

test('administrator has system-admin access but no operational transaction write or action rights', () => {
    assert.equal(canRead('goods-receipts', 'Administrator'), true);
    assert.equal(canWrite('goods-receipts', 'Administrator'), false);
    assert.equal(canAct('goods-receipts-evaluate', 'Administrator'), false);
    assert.equal(canAct('requisitions', 'Administrator'), false);
    assert.equal(canRead('business-rules', 'Administrator'), true);
    assert.equal(canWrite('business-rules', 'Administrator'), true);
    assert.equal(canAct('business-rules', 'Administrator'), true);
    assert.equal(canRead('business-rules', 'Store Head'), false);
    assert.equal(canWrite('users', 'Administrator'), true);
    assert.equal(canDelete('users', 'Administrator'), false);
    assert.equal(canAct('stock-taking-post', 'Administrator'), false);
    assert.equal(canWrite('fixed-assets', 'Administrator'), false);
    assert.equal(canWrite('user-cards', 'Administrator'), false);
    assert.equal(canWrite('disposals', 'Administrator'), false);
    assert.equal(canAct('goods-receipts-notify-tec', 'Store Head'), true);
    assert.equal(canAct('goods-receipts-notify-tec', 'Storekeeper'), false);
    assert.equal(canAct('goods-receipts-post', 'Storekeeper'), true);
    assert.equal(canAct('goods-receipts-post', 'Store Head'), false);
});

test('TEC is restricted to technical evaluation and cannot access general receipt operations', () => {
    assert.equal(canRead('goods-receipts', 'Technical Evaluation Committee'), true);
    assert.equal(canWrite('goods-receipts', 'Technical Evaluation Committee'), false);
    assert.equal(canAct('goods-receipts-evaluate', 'Technical Evaluation Committee'), true);
    assert.equal(canAct('goods-receipts-notify-tec', 'Technical Evaluation Committee'), false);
    assert.equal(canAct('goods-receipts-post', 'Technical Evaluation Committee'), false);
    assert.equal(canWrite('requisitions', 'Technical Evaluation Committee'), false);
    assert.equal(canWrite('issue-vouchers', 'Technical Evaluation Committee'), false);
    assert.equal(canWrite('material-transfers', 'Technical Evaluation Committee'), false);
});

test('TEC evaluation workflow distinguishes pending work from completed history', () => {
    assert.doesNotThrow(() => assertTransition('goodsReceipt', 'Pending Evaluation', 'Under Evaluation'));
    assert.doesNotThrow(() => assertTransition('goodsReceipt', 'Under Evaluation', 'Accepted'));
    assert.doesNotThrow(() => assertTransition('goodsReceipt', 'Under Evaluation', 'Rejected'));
    assert.throws(
        () => assertTransition('goodsReceipt', 'Accepted', 'Under Evaluation'),
        (error) => error.statusCode === 409
    );
});

test('store head has scoped master-data access and owns stock-taking sessions', () => {
    assert.equal(canRead('stores', 'Store Head'), true);
    assert.equal(canRead('categories', 'Store Head'), true);
    assert.equal(canRead('items', 'Store Head'), true);
    assert.equal(canRead('locations', 'Store Head'), true);
    assert.equal(canRead('suppliers', 'Store Head'), true);
    assert.equal(canWrite('stores', 'Store Head'), false);
    assert.equal(canWrite('categories', 'Store Head'), true);
    assert.equal(canWrite('suppliers', 'Store Head'), true);
    assert.equal(canWrite('items', 'Store Head'), true);
    assert.equal(canWrite('locations', 'Store Head'), true);
    assert.equal(canWrite('goods-receipts', 'Store Head'), false);
    assert.equal(canWrite('stock-taking', 'Store Head'), true);
    assert.equal(canAct('goods-receipts-notify-tec', 'Store Head'), true);
    assert.equal(canAct('goods-receipts-post', 'Store Head'), false);
    assert.equal(canAct('issue-voucher-post', 'Store Head'), false);
    assert.equal(canAct('stock-taking-post', 'Store Head'), true);
});

test('security officer can view supporting gate documents but cannot create or modify stock records', () => {
    assert.equal(canRead('stores', 'Security Officer'), true);
    assert.equal(canRead('categories', 'Security Officer'), true);
    assert.equal(canRead('departments', 'Security Officer'), true);
    assert.equal(canRead('items', 'Security Officer'), false);
    assert.equal(canRead('locations', 'Security Officer'), false);
    assert.equal(canRead('suppliers', 'Security Officer'), false);
    assert.equal(canRead('gate-pass', 'Security Officer'), true);
    assert.equal(canRead('goods-receipts', 'Security Officer'), true);
    assert.equal(canRead('issue-vouchers', 'Security Officer'), true);
    assert.equal(canWrite('goods-receipts', 'Security Officer'), false);
    assert.equal(canWrite('issue-vouchers', 'Security Officer'), false);
    assert.equal(canAct('goods-receipts-post', 'Security Officer'), false);
    assert.equal(canAct('issue-voucher-post', 'Security Officer'), false);
    assert.equal(canAct('stock-taking-post', 'Security Officer'), false);
    assert.equal(canRead('audit-logs', 'Security Officer'), true);
    assert.equal(canRead('reports', 'Security Officer'), true);
});

test('fixed-asset create/edit permissions match the backend policy', () => {
    assert.equal(canWrite('fixed-assets', 'Administrator'), false);
    assert.equal(canWrite('fixed-assets', 'Property Administration Officer'), true);
    assert.equal(canWrite('fixed-assets', 'Store Head'), true);
});

test('user material cards are managed by operational and supervisory roles, not by administrators', () => {
    assert.equal(canWrite('user-cards', 'Administrator'), false);
    assert.equal(canWrite('user-cards', 'Storekeeper'), true);
    assert.equal(canWrite('user-cards', 'Store Head'), true);
    assert.equal(canWrite('user-cards', 'Property Administration Officer'), true);
});

test('storekeeper has limited location rights and read-only master-data visibility', () => {
    assert.equal(canRead('stores', 'Storekeeper'), true);
    assert.equal(canRead('categories', 'Storekeeper'), true);
    assert.equal(canRead('items', 'Storekeeper'), true);
    assert.equal(canRead('locations', 'Storekeeper'), true);
    assert.equal(canRead('suppliers', 'Storekeeper'), true);
    assert.equal(canRead('departments', 'Storekeeper'), true);
    assert.equal(canWrite('items', 'Storekeeper'), false);
    assert.equal(canWrite('locations', 'Storekeeper'), true);
    assert.equal(canWrite('stores', 'Storekeeper'), false);
    assert.equal(canWrite('categories', 'Storekeeper'), false);
    assert.equal(canWrite('suppliers', 'Storekeeper'), false);
    assert.equal(canWrite('departments', 'Storekeeper'), false);
    assert.equal(canWrite('goods-receipts', 'Storekeeper'), true);
    assert.equal(canAct('issue-voucher-post', 'Storekeeper'), true);
    assert.equal(canAct('stock-taking-post', 'Storekeeper'), false);
    assert.equal(canWrite('business-rules', 'Storekeeper'), false);
});

test('department head can create but cannot approve or delete transfers', () => {
    assert.equal(canWrite('material-transfers', 'Department Head'), true);
    assert.equal(canAct('material-transfers', 'Department Head'), false);
    assert.equal(canDelete('material-transfers', 'Department Head'), false);
    assert.equal(canRead('user-cards', 'Department Head'), true);
});

test('stock clerk has limited transfer support but cannot execute material transfers', () => {
    assert.equal(canRead('stock-taking', 'Stock Clerk'), true);
    assert.equal(canWrite('stock-taking', 'Stock Clerk'), true);
    assert.equal(canWrite('stock-taking', 'Storekeeper'), false);
    assert.equal(canWrite('bin-transfers', 'Stock Clerk'), true);
    assert.equal(canAct('material-transfers-execute', 'Stock Clerk'), false);
    assert.equal(canAct('stock-taking-post', 'Stock Clerk'), false);
    assert.equal(canWrite('goods-receipts', 'Stock Clerk'), false);
    assert.equal(canWrite('issue-vouchers', 'Stock Clerk'), false);
    assert.equal(canWrite('items', 'Stock Clerk'), false);
    assert.equal(canWrite('locations', 'Stock Clerk'), false);
    assert.doesNotThrow(() => assertTransition('stockTaking', 'Submitted', 'Approved'));
    assert.throws(
        () => assertTransition('stockTaking', 'Submitted', 'Posted'),
        (error) => error.statusCode === 409
    );
});

test('stock-taking supports a controlled recount loop without skipping review', () => {
    assert.doesNotThrow(() => assertTransition('stockTaking', 'Submitted', 'Recount Required'));
    assert.doesNotThrow(() => assertTransition('stockTaking', 'Recount Required', 'Submitted'));
    assert.throws(
        () => assertTransition('stockTaking', 'Recount Required', 'Approved'),
        (error) => error.statusCode === 409
    );
    assert.equal(canEditStockTakingCounts('Recount Required'), true);
    assert.equal(canEditStockTakingCounts('Approved'), false);
    assert.equal(isOpenStockTakingSession('Pending Approval'), true);
    assert.equal(isOpenStockTakingSession('Closed'), false);
});

test('resolveItemId respects the selected store when names are duplicated across stores', async () => {
    const { resolveItemId } = require('../src/controllers/_helpers');
    const client = {
        query: async (sql, params) => {
            if (sql.includes('AND store_id = $2')) {
                assert.deepEqual(params, ['Bolt', 7]);
                return { rows: [{ id: 42 }] };
            }
            return { rows: [{ id: 999 }] };
        }
    };

    const itemId = await resolveItemId('Bolt', client, 7);
    assert.equal(itemId, 42);
});

test('storekeeper receives an alert when an approved transfer is ready for dispatch', async () => {
    const { pathToFileURL } = require('node:url');
    const frontendUrl = pathToFileURL(require('node:path').resolve(__dirname, '../../frontend/src/utils/buildNotifications.js')).href;
    const { buildNotifications } = await import(frontendUrl);

    const notifications = buildNotifications(
        { role: 'Storekeeper' },
        {
            items: [],
            grns: [],
            reqs: [],
            returns: [],
            transfers: [{ id: 3, status: 'Approved', transferRef: 'TRF-3001', fromStore: 'Store A', toStore: 'Store B', date: '2025-01-02' }],
            disposals: [],
            vouchers: []
        }
    );

    assert.ok(notifications.some((n) => n.title === 'Transfer Approved' && n.message.includes('TRF-3001')));
});

test('storekeeper receives an alert when a dispatched transfer is ready to receive', async () => {
    const { pathToFileURL } = require('node:url');
    const frontendUrl = pathToFileURL(require('node:path').resolve(__dirname, '../../frontend/src/utils/buildNotifications.js')).href;
    const { buildNotifications } = await import(frontendUrl);

    const notifications = buildNotifications(
        { role: 'Storekeeper', store: 'Store B' },
        {
            items: [],
            grns: [],
            reqs: [],
            returns: [],
            transfers: [{ id: 6, status: 'Dispatched', transferRef: 'TRF-3002', fromStore: 'Store A', toStore: 'Store B', date: '2025-01-03' }],
            disposals: [],
            vouchers: []
        }
    );

    assert.ok(notifications.some((n) => n.title === 'Transfer Ready to Receive' && n.message.includes('TRF-3002')));
});

test('store head and TEC receive the correct GRN workflow notifications', async () => {
    const { pathToFileURL } = require('node:url');
    const frontendUrl = pathToFileURL(require('node:path').resolve(__dirname, '../../frontend/src/utils/buildNotifications.js')).href;
    const { buildNotifications } = await import(frontendUrl);

    const storeHeadNotifications = buildNotifications(
        { role: 'Store Head' },
        {
            items: [],
            grns: [{ id: 4, status: 'Submitted', grnRef: 'GRN-2026-0003', store: 'Main Store', receivedDate: '2025-01-02' }],
            reqs: [],
            returns: [],
            transfers: [],
            disposals: [],
            vouchers: []
        }
    );

    const tecNotifications = buildNotifications(
        { role: 'Technical Evaluation Committee' },
        {
            items: [],
            grns: [{ id: 5, status: 'Pending Evaluation', grnRef: 'GRN-2026-0004', store: 'Main Store', receivedDate: '2025-01-03' }],
            reqs: [],
            returns: [],
            transfers: [],
            disposals: [],
            vouchers: []
        }
    );

    assert.ok(storeHeadNotifications.some((n) => n.title === 'Goods Receipt Pending' && n.message.includes('GRN-2026-0003')));
    assert.ok(tecNotifications.some((n) => n.title === 'Technical Evaluation' && n.message.includes('GRN-2026-0004')));
});

test('storekeeper is notified when TEC accepts a receipt for GRN generation', async () => {
    const { pathToFileURL } = require('node:url');
    const frontendUrl = pathToFileURL(require('node:path').resolve(__dirname, '../../frontend/src/utils/buildNotifications.js')).href;
    const { buildNotifications } = await import(frontendUrl);

    const notifications = buildNotifications(
        { role: 'Storekeeper' },
        {
            items: [],
            grns: [{ id: 7, status: 'Accepted', grnRef: 'GRN-2026-0005', store: 'Main Store', receivedDate: '2025-01-04' }],
            reqs: [],
            returns: [],
            transfers: [],
            disposals: [],
            vouchers: []
        }
    );

    assert.ok(notifications.some((n) => n.title === 'Goods Receipt Accepted' && n.message.includes('GRN-2026-0005')));
});

test('PAO gets approval alerts for endorsed requisitions and pending transfer approvals', async () => {
    const { pathToFileURL } = require('node:url');
    const frontendUrl = pathToFileURL(require('node:path').resolve(__dirname, '../../frontend/src/utils/buildNotifications.js')).href;
    const { buildNotifications } = await import(frontendUrl);

    const notifications = buildNotifications(
        { role: 'Property Administration Officer' },
        {
            items: [],
            grns: [],
            reqs: [{ id: 1, status: 'Pending Approval', srRef: 'SR-1001', department: 'Operations', date: '2025-01-01' }],
            returns: [],
            transfers: [{ id: 2, status: 'Pending Approval', transferRef: 'TRF-2001', fromStore: 'Store A', toStore: 'Store B', date: '2025-01-01' }],
            disposals: [],
            vouchers: [{ id: 9, status: 'Preliminary', sivRef: 'SIV-2026-0009', srRef: 'SR-1001', date: '2025-01-02' }]
        }
    );

    assert.ok(notifications.some((n) => n.title === 'Approval Required' && n.message.includes('SR-1001')));
    assert.ok(notifications.some((n) => n.title === 'Authorize Issue Voucher' && n.message.includes('SIV-2026-0009')));
    assert.ok(notifications.some((n) => n.title === 'Transfer Pending' && n.message.includes('TRF-2001')));
});

test('Department Head is alerted to endorse a submitted requisition from their own department', async () => {
    const { pathToFileURL } = require('node:url');
    const frontendUrl = pathToFileURL(require('node:path').resolve(__dirname, '../../frontend/src/utils/buildNotifications.js')).href;
    const { buildNotifications } = await import(frontendUrl);

    const notifications = buildNotifications(
        { role: 'Department Head', name: 'Dawit Bekele', department: 'Operations' },
        {
            items: [],
            grns: [],
            reqs: [
                { id: 1, status: 'Submitted', srRef: 'SR-1001', department: 'Operations', requestedBy: 'Sara Tesfaye', date: '2025-01-01' },
                // Own request — a Department Head may not endorse their own requisition.
                { id: 2, status: 'Submitted', srRef: 'SR-1002', department: 'Operations', requestedBy: 'Dawit Bekele', date: '2025-01-01' },
                // Another department — outside this Department Head's scope.
                { id: 3, status: 'Submitted', srRef: 'SR-1003', department: 'Finance', requestedBy: 'Helen Girma', date: '2025-01-01' }
            ],
            returns: [],
            transfers: [],
            disposals: [],
            vouchers: []
        }
    );

    assert.ok(notifications.some((n) => n.title === 'Department Approval' && n.message.includes('SR-1001')));
    assert.ok(!notifications.some((n) => n.message.includes('SR-1002')));
    assert.ok(!notifications.some((n) => n.message.includes('SR-1003')));
});

test('approved requisitions route the next action according to the requester role', async () => {
    const { pathToFileURL } = require('node:url');
    const frontendUrl = pathToFileURL(require('node:path').resolve(__dirname, '../../frontend/src/utils/buildNotifications.js')).href;
    const { buildNotifications } = await import(frontendUrl);

    const notifications = buildNotifications(
        { role: 'Storekeeper', store: 'Electrical Engineering Dept. Store' },
        {
            items: [],
            grns: [],
            reqs: [
                { id: 10, status: 'Approved', requesterRole: 'Department Head', srRef: 'SR-2010', department: 'Electrical Engineering', store: 'Electrical Engineering Dept. Store', date: '2026-09-04' },
                { id: 11, status: 'Approved', requesterRole: 'Storekeeper', srRef: 'SR-2011', department: 'Electrical Engineering', store: 'Electrical Engineering Dept. Store', date: '2026-09-04' }
            ],
            returns: [],
            transfers: [],
            disposals: [],
            vouchers: []
        }
    );

    assert.ok(notifications.some((n) => n.title === 'Generate Issue Voucher' && n.route === '/issue-vouchers' && n.message.includes('SR-2010')));
    assert.ok(notifications.some((n) => n.title === 'Replenishment Transfer Required' && n.route === '/material-transfer' && n.message.includes('SR-2011')));
});

test('store-requisition and issue-voucher permissions enforce segregation of duties', () => {
    // Department Head can endorse, and Store Head approves for the issuing store.
    assert.equal(canAct('requisitions', 'Department Head'), true);
    assert.equal(canAct('requisitions', 'Property Administration Officer'), true);
    assert.equal(canAct('requisitions', 'Store Head'), true);

    // Storekeeper prepares the issue voucher; Store Head authorizes it.
    assert.equal(canWrite('issue-vouchers', 'Store Head'), false);
    assert.equal(canWrite('issue-vouchers', 'Storekeeper'), true);

    // AUTHORIZED REVIEW: the Store Head authorizes a prepared voucher.
    assert.equal(canAct('issue-vouchers', 'Property Administration Officer'), false);
    assert.equal(canAct('issue-vouchers', 'Store Head'), true);

    // The Store Head reviews and amends the Storekeeper's preliminary voucher.
    assert.equal(canAct('issue-voucher-amend', 'Store Head'), true);
    assert.equal(canAct('issue-voucher-amend', 'Property Administration Officer'), false);

    // ISSUE MATERIAL: only the Storekeeper posts an authorized voucher — preparer != authorizer != issuer.
    assert.equal(canAct('issue-voucher-post', 'Storekeeper'), true);
    assert.equal(canAct('issue-voucher-post', 'Store Head'), false);
    assert.equal(canAct('issue-voucher-post', 'Property Administration Officer'), false);
});

test('issue vouchers require authorization before posting and notify the Storekeeper', async () => {
    assert.doesNotThrow(() => assertTransition('issueVoucher', 'Preliminary', 'Approved'));
    assert.doesNotThrow(() => assertTransition('issueVoucher', 'Approved', 'Posted'));
    assert.throws(
        () => assertTransition('issueVoucher', 'Preliminary', 'Posted'),
        (error) => error.statusCode === 409
    );

    const { pathToFileURL } = require('node:url');
    const frontendUrl = pathToFileURL(require('node:path').resolve(__dirname, '../../frontend/src/utils/buildNotifications.js')).href;
    const { buildNotifications } = await import(frontendUrl);
    const notifications = buildNotifications(
        { role: 'Storekeeper', store: 'Main Store' },
        {
            items: [],
            grns: [],
            reqs: [],
            returns: [],
            transfers: [],
            disposals: [],
            vouchers: [{ id: 21, status: 'Approved', sivRef: 'SIV-2026-0021', date: '2026-09-04' }]
        }
    );
    assert.ok(notifications.some((n) => n.title === 'Issue Authorized Voucher' && n.route === '/issue-vouchers'));
});

test('Gate Pass is Security-only and covers outgoing approved vouchers', async () => {
    assert.equal(canAct('gate-pass', 'Security Officer'), true);
    assert.equal(canAct('gate-pass', 'Store Head'), false);
    assert.equal(canAct('gate-pass', 'Property Administration Officer'), false);

    const { pathToFileURL } = require('node:url');
    const frontendUrl = pathToFileURL(require('node:path').resolve(__dirname, '../../frontend/src/utils/buildNotifications.js')).href;
    const { buildNotifications } = await import(frontendUrl);
    const notifications = buildNotifications(
        { role: 'Security Officer' },
        {
            items: [],
            grns: [],
            reqs: [],
            returns: [],
            transfers: [],
            disposals: [],
            vouchers: [{ id: 31, status: 'Approved', sivRef: 'SIV-2026-0031', issuedTo: 'Electrical Engineering', gateVerified: false, date: '2026-09-04' }]
        }
    );
    assert.ok(notifications.some((n) => n.title === 'Outgoing Materials' && n.route === '/gate-pass' && n.message.includes('SIV-2026-0031')));
});

test('stock card ledger rows retain item and store identity', () => {
    const { mapStockTransaction } = require('../src/controllers/_helpers');
    const mapped = mapStockTransaction({
        id: 41,
        item_id: 7,
        item_name: 'Shared Item Name',
        store_id: 2,
        store_name: 'Main Store',
        date: '2026-09-04',
        type: 'Receipt',
        ref: 'GRN-2026-0041',
        qty_in: '10',
        qty_out: '0',
        unit_price: '25',
        balance: '110'
    });
    assert.equal(mapped.itemId, 7);
    assert.equal(mapped.storeId, 2);
    assert.equal(mapped.balance, 110);
});

test('bin card rows retain item/store identity and compareable item balance', () => {
    const { mapBinCard } = require('../src/controllers/_helpers');
    const mapped = mapBinCard({
        id: 51,
        bin: 'SEC-2026-01-R01-S01-B01',
        item_id: 7,
        store_id: 2,
        store_name: 'Main Store',
        item_name: 'Shared Item Name',
        item_qty_on_hand: '110',
        last_movement: '2026-09-04',
        balance: '110'
    });
    assert.equal(mapped.itemId, 7);
    assert.equal(mapped.storeId, 2);
    assert.equal(mapped.itemQtyOnHand, 110);
    assert.equal(mapped.balance, 110);
});

test('material transfer requires approval, dispatch, and receipt in order', () => {
    assert.doesNotThrow(() => assertTransition('materialTransfer', 'Pending Approval', 'Approved'));
    assert.doesNotThrow(() => assertTransition('materialTransfer', 'Approved', 'Dispatched'));
    assert.doesNotThrow(() => assertTransition('materialTransfer', 'Dispatched', 'Received'));
    assert.throws(
        () => assertTransition('materialTransfer', 'Pending Approval', 'Received'),
        (error) => error.statusCode === 409
    );
});

test('accountant is read-only financial observer with no operational permissions', () => {
    assert.equal(canRead('goods-receipts', 'Accountant'), true);
    assert.equal(canWrite('goods-receipts', 'Accountant'), false);
    assert.equal(canRead('reconciliation', 'Accountant'), true);
    assert.equal(canRead('audit-logs', 'Accountant'), true);
    assert.equal(canRead('reports', 'Accountant'), true);
    assert.equal(canWrite('requisitions', 'Accountant'), false);
    assert.equal(canWrite('issue-vouchers', 'Accountant'), false);
    assert.equal(canAct('goods-receipts-evaluate', 'Accountant'), false);
    assert.equal(canAct('stock-taking-post', 'Accountant'), false);
});

test('admin delete APIs exist for master-data resources exposed by the UI', () => {
    const departmentsController = require('../src/controllers/departments.controller');
    const suppliersController = require('../src/controllers/suppliers.controller');
    const locationsController = require('../src/controllers/locations.controller');
    const routes = require('node:fs').readFileSync(require('node:path').resolve(__dirname, '../src/routes/index.js'), 'utf8');

    assert.equal(typeof departmentsController.remove, 'function');
    assert.equal(typeof suppliersController.remove, 'function');
    assert.equal(typeof locationsController.remove, 'function');
    assert.match(routes, /router\.delete\('\/departments\/:id'|router\.delete\("\/departments\/:id"/);
    assert.match(routes, /router\.delete\('\/suppliers\/:id'|router\.delete\("\/suppliers\/:id"/);
    assert.match(routes, /router\.delete\('\/locations\/:id'|router\.delete\("\/locations\/:id"/);
});

