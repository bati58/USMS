const test = require('node:test');
const assert = require('node:assert/strict');
const { pathToFileURL } = require('node:url');
const { assertTransition } = require('../src/utils/workflow');
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

test('material returns require Store Head approval before Storekeeper stock receipt', () => {
    assert.doesNotThrow(() => assertTransition('materialReturn', 'Submitted', 'Approved'));
    assert.doesNotThrow(() => assertTransition('materialReturn', 'Approved', 'Returned to Stock'));
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

test('stock-taking follows submit -> approve -> post -> close', () => {
    assert.doesNotThrow(() => assertTransition('stockTaking', 'Submitted', 'Approved'));
    assert.doesNotThrow(() => assertTransition('stockTaking', 'Approved', 'Posted'));
    assert.doesNotThrow(() => assertTransition('stockTaking', 'Posted', 'Closed'));
    // Cannot skip approval and post a merely-submitted count.
    assert.throws(
        () => assertTransition('stockTaking', 'Submitted', 'Posted'),
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

test('store head is a supervisor with read access and no direct operational mutation authority', () => {
    assert.equal(canRead('stores', 'Store Head'), true);
    assert.equal(canRead('categories', 'Store Head'), true);
    assert.equal(canRead('items', 'Store Head'), true);
    assert.equal(canRead('locations', 'Store Head'), true);
    assert.equal(canRead('suppliers', 'Store Head'), true);
    assert.equal(canWrite('stores', 'Store Head'), true);
    assert.equal(canWrite('categories', 'Store Head'), false);
    assert.equal(canWrite('items', 'Store Head'), false);
    assert.equal(canWrite('locations', 'Store Head'), false);
    assert.equal(canWrite('goods-receipts', 'Store Head'), false);
    assert.equal(canAct('goods-receipts-notify-tec', 'Store Head'), true);
    assert.equal(canAct('goods-receipts-post', 'Store Head'), false);
    assert.equal(canAct('issue-voucher-post', 'Store Head'), false);
    assert.equal(canAct('stock-taking-post', 'Store Head'), false);
});

test('security officer can view supporting gate documents but cannot create or modify stock records', () => {
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

test('storekeeper has operational inventory rights but not master-data or system-admin permissions', () => {
    assert.equal(canRead('items', 'Storekeeper'), true);
    assert.equal(canRead('locations', 'Storekeeper'), true);
    assert.equal(canWrite('items', 'Storekeeper'), false);
    assert.equal(canWrite('locations', 'Storekeeper'), false);
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

test('stock clerk is limited to stock control and cannot execute inventory transfers', () => {
    assert.equal(canRead('stock-taking', 'Stock Clerk'), true);
    assert.equal(canWrite('stock-taking', 'Stock Clerk'), true);
    assert.equal(canWrite('bin-transfers', 'Stock Clerk'), false);
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

test('PAO gets approval alerts for submitted requisitions and pending transfer approvals', async () => {
    const { pathToFileURL } = require('node:url');
    const frontendUrl = pathToFileURL(require('node:path').resolve(__dirname, '../../frontend/src/utils/buildNotifications.js')).href;
    const { buildNotifications } = await import(frontendUrl);

    const notifications = buildNotifications(
        { role: 'Property Administration Officer' },
        {
            items: [],
            grns: [],
            reqs: [{ id: 1, status: 'Submitted', srRef: 'SR-1001', department: 'Operations', date: '2025-01-01' }],
            returns: [],
            transfers: [{ id: 2, status: 'Pending Approval', transferRef: 'TRF-2001', fromStore: 'Store A', toStore: 'Store B', date: '2025-01-01' }],
            disposals: [],
            vouchers: []
        }
    );

    assert.ok(notifications.some((n) => n.title === 'Approval Required' && n.message.includes('SR-1001')));
    assert.ok(notifications.some((n) => n.title === 'Transfer Pending' && n.message.includes('TRF-2001')));
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

