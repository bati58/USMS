const express = require('express');
const router = express.Router();

const { requireAuth } = require('../middleware/auth');
const { requireRole } = require('../middleware/authorize');

const authController = require('../controllers/auth.controller');
const usersController = require('../controllers/users.controller');
const storesController = require('../controllers/stores.controller');
const categoriesController = require('../controllers/categories.controller');
const itemsController = require('../controllers/items.controller');
const goodsReceiptsController = require('../controllers/goodsReceipts.controller');
const stockTransactionsController = require('../controllers/stockTransactions.controller');
const binCardsController = require('../controllers/binCards.controller');
const binTransfersController = require('../controllers/binTransfers.controller');
const requisitionsController = require('../controllers/requisitions.controller');
const issueVouchersController = require('../controllers/issueVouchers.controller');
const materialReturnsController = require('../controllers/materialReturns.controller');
const materialTransfersController = require('../controllers/materialTransfers.controller');
const fixedAssetsController = require('../controllers/fixedAssets.controller');
const disposalsController = require('../controllers/disposals.controller');
const auditLogsController = require('../controllers/auditLogs.controller');
const reportsController = require('../controllers/reports.controller');
const gatePassController = require('../controllers/gatePass.controller');
const userCardsController = require('../controllers/userCards.controller');
const locationsController = require('../controllers/locations.controller');
const suppliersController = require('../controllers/suppliers.controller');
const departmentsController = require('../controllers/departments.controller');
const stockTakingController = require('../controllers/stockTaking.controller');
const businessRulesController = require('../controllers/businessRules.controller');
const notificationsController = require('../controllers/notifications.controller');

// ---------------------------------------------------------------------------
// Auth (no requireAuth on login; requireAuth only on /me)
// ---------------------------------------------------------------------------
router.post('/auth/login', authController.login);
router.post('/auth/refresh', authController.refreshToken);
router.get('/auth/me', requireAuth, authController.me);
router.post('/auth/logout', requireAuth, authController.logout);
router.put('/auth/password', requireAuth, authController.changePassword);

// Every route below requires a valid session.
router.use(requireAuth);

router.get('/locations', requireRole('locations'), locationsController.list);
router.get('/locations/:id', requireRole('locations'), locationsController.getOne);
router.post('/locations', requireRole('locations'), locationsController.create);
router.put('/locations/:id', requireRole('locations'), locationsController.update);
router.delete('/locations/:id', requireRole('locations'), locationsController.remove);
router.get('/suppliers', requireRole('suppliers'), suppliersController.list);
router.get('/suppliers/:id', requireRole('suppliers'), suppliersController.getOne);
router.post('/suppliers', requireRole('suppliers'), suppliersController.create);
router.put('/suppliers/:id', requireRole('suppliers'), suppliersController.update);
router.delete('/suppliers/:id', requireRole('suppliers'), suppliersController.remove);
router.get('/departments', requireRole('departments'), departmentsController.list);
router.get('/departments/:id', requireRole('departments'), departmentsController.getOne);
router.post('/departments', requireRole('departments'), departmentsController.create);
router.put('/departments/:id', requireRole('departments'), departmentsController.update);
router.delete('/departments/:id', requireRole('departments'), departmentsController.remove);

router.post('/gate-pass/:resource/:id/verify', requireRole('gate-pass', 'action'), gatePassController.verify);

// ---------------------------------------------------------------------------
// Users — Administrator only (Backend-SRS §4.1/§4.2)
// ---------------------------------------------------------------------------
router.get('/users', requireRole('users'), usersController.list);
router.get('/users/:id', requireRole('users'), usersController.getOne);
router.post('/users', requireRole('users'), usersController.create);
router.put('/users/:id', requireRole('users'), usersController.update);
router.delete('/users/:id', requireRole('users'), usersController.remove);

// User material cards
router.get('/user-cards', requireRole('user-cards'), userCardsController.list);
router.get('/user-cards/:id', requireRole('user-cards'), userCardsController.getOne);
router.post('/user-cards', requireRole('user-cards'), userCardsController.create);
router.put('/user-cards/:id', requireRole('user-cards'), userCardsController.update);
router.delete('/user-cards/:id', requireRole('user-cards'), userCardsController.remove);

// ---------------------------------------------------------------------------
// Stores
// ---------------------------------------------------------------------------
router.get('/stores', requireRole('stores'), storesController.list);
router.get('/stores/:id', requireRole('stores'), storesController.getOne);
router.post('/stores', requireRole('stores'), storesController.create);
router.put('/stores/:id', requireRole('stores'), storesController.update);
router.delete('/stores/:id', requireRole('stores'), storesController.remove);

// ---------------------------------------------------------------------------
// Categories
// ---------------------------------------------------------------------------
router.get('/categories', requireRole('categories'), categoriesController.list);
router.get('/categories/:id', requireRole('categories'), categoriesController.getOne);
router.post('/categories', requireRole('categories'), categoriesController.create);
router.put('/categories/:id', requireRole('categories'), categoriesController.update);
router.delete('/categories/:id', requireRole('categories'), categoriesController.remove);

// ---------------------------------------------------------------------------
// Items
// ---------------------------------------------------------------------------
router.get('/items', requireRole('items'), itemsController.list);
router.get('/items/:id', requireRole('items'), itemsController.getOne);
router.post('/items', requireRole('items'), itemsController.create);
router.put('/items/:id', requireRole('items'), itemsController.update);
router.delete('/items/:id', requireRole('items'), itemsController.remove);

// ---------------------------------------------------------------------------
// Goods Receipts (+ evaluate action — Technical Evaluation Committee)
// ---------------------------------------------------------------------------
router.get('/goods-receipts', requireRole('goods-receipts'), goodsReceiptsController.list);
router.get('/goods-receipts/:id', requireRole('goods-receipts'), goodsReceiptsController.getOne);
router.post('/goods-receipts', requireRole('goods-receipts'), goodsReceiptsController.create);
router.post('/goods-receipts/:id/submit', requireRole('goods-receipts'), goodsReceiptsController.setStatus);
router.post('/goods-receipts/:id/evaluate', requireRole('goods-receipts-evaluate', 'action'), goodsReceiptsController.evaluate);
router.post('/goods-receipts/:id/generate-grn', requireRole('goods-receipts', 'action'), goodsReceiptsController.generateGrn);
router.post('/goods-receipts/:id/post-stock', requireRole('goods-receipts-post', 'action'), goodsReceiptsController.postStock);
router.post('/goods-receipts/:id/status', requireRole('goods-receipts', 'action'), goodsReceiptsController.setStatus);
router.delete('/goods-receipts/:id', requireRole('goods-receipts'), goodsReceiptsController.remove);

// ---------------------------------------------------------------------------
// Stock Cards ledger + Bin Cards — both read-only, system-generated
// ---------------------------------------------------------------------------
router.get('/stock-transactions', requireRole('stock-transactions'), stockTransactionsController.list);
router.get('/bin-cards', requireRole('bin-cards'), binCardsController.list);
router.get('/bin-cards/:id/movements', requireRole('bin-cards'), binCardsController.movements);
router.get('/stock-taking', requireRole('stock-taking'), stockTakingController.list);
router.get('/stock-taking/:id', requireRole('stock-taking'), stockTakingController.getOne);
router.post('/stock-taking', requireRole('stock-taking'), stockTakingController.create);
router.put('/stock-taking/:id', requireRole('stock-taking'), stockTakingController.update);
router.post('/stock-taking/:id/submit', requireRole('stock-taking'), stockTakingController.submit);
router.post('/stock-taking/:id/request-recount', requireRole('stock-taking-recount', 'action'), stockTakingController.requestRecount);
router.post('/stock-taking/:id/approve', requireRole('stock-taking', 'action'), stockTakingController.approve);
router.post('/stock-taking/:id/post', requireRole('stock-taking-post', 'action'), stockTakingController.post);
router.get('/reconciliation', requireRole('reconciliation'), stockTakingController.reconciliation);

// ---------------------------------------------------------------------------
// Bin Transfers — immediate effect, no approval step
// ---------------------------------------------------------------------------
router.get('/bin-transfers', requireRole('bin-transfers'), binTransfersController.list);
router.post('/bin-transfers', requireRole('bin-transfers'), binTransfersController.create);

// ---------------------------------------------------------------------------
// Requisitions (+ approve action)
// ---------------------------------------------------------------------------
router.get('/requisitions', requireRole('requisitions'), requisitionsController.list);
router.get('/requisitions/:id', requireRole('requisitions'), requisitionsController.getOne);
router.post('/requisitions', requireRole('requisitions'), requisitionsController.create);
router.post('/requisitions/:id/submit', requireRole('requisitions'), requisitionsController.submit);
router.post('/requisitions/:id/approve', requireRole('requisitions', 'action'), requisitionsController.decide);
router.delete('/requisitions/:id', requireRole('requisitions'), requisitionsController.remove);

// ---------------------------------------------------------------------------
// Issue Vouchers (generated from an approved requisition)
// ---------------------------------------------------------------------------
router.get('/issue-vouchers', requireRole('issue-vouchers'), issueVouchersController.list);
router.get('/issue-vouchers/:id', requireRole('issue-vouchers'), issueVouchersController.getOne);
router.post('/issue-vouchers', requireRole('issue-vouchers'), issueVouchersController.create);
router.post('/issue-vouchers/:id/approve', requireRole('issue-vouchers', 'action'), issueVouchersController.approve);
router.post('/issue-vouchers/:id/amend', requireRole('issue-vouchers', 'action'), issueVouchersController.amend);
router.post('/issue-vouchers/:id/post', requireRole('issue-voucher-post', 'action'), issueVouchersController.post);

// ---------------------------------------------------------------------------
// Material Returns (+ approve action)
// ---------------------------------------------------------------------------
router.get('/material-returns', requireRole('material-returns'), materialReturnsController.list);
router.get('/material-returns/:id', requireRole('material-returns'), materialReturnsController.getOne);
router.post('/material-returns', requireRole('material-returns'), materialReturnsController.create);
router.post('/material-returns/:id/submit', requireRole('material-returns'), materialReturnsController.submit);
router.post('/material-returns/:id/approve', requireRole('material-returns', 'action'), materialReturnsController.decide);
router.post('/material-returns/:id/receive', requireRole('material-returns-receive', 'action'), materialReturnsController.receive);
router.delete('/material-returns/:id', requireRole('material-returns'), materialReturnsController.remove);

// ---------------------------------------------------------------------------
// Material Transfers (+ approve action)
// ---------------------------------------------------------------------------
router.get('/material-transfers', requireRole('material-transfers'), materialTransfersController.list);
router.get('/material-transfers/:id', requireRole('material-transfers'), materialTransfersController.getOne);
router.post('/material-transfers', requireRole('material-transfers'), materialTransfersController.create);
router.post('/material-transfers/:id/approve', requireRole('material-transfers', 'action'), materialTransfersController.decide);
router.post('/material-transfers/:id/execute', requireRole('material-transfers-execute', 'action'), materialTransfersController.execute);
router.post('/material-transfers/:id/resubmit', requireRole('material-transfers'), materialTransfersController.resubmit);
router.delete('/material-transfers/:id', requireRole('material-transfers'), materialTransfersController.remove);

// ---------------------------------------------------------------------------
// Fixed Assets
// ---------------------------------------------------------------------------
router.get('/fixed-assets', requireRole('fixed-assets'), fixedAssetsController.list);
router.get('/fixed-assets/:id', requireRole('fixed-assets'), fixedAssetsController.getOne);
router.post('/fixed-assets', requireRole('fixed-assets'), fixedAssetsController.create);
router.put('/fixed-assets/:id', requireRole('fixed-assets'), fixedAssetsController.update);
router.delete('/fixed-assets/:id', requireRole('fixed-assets'), fixedAssetsController.remove);

// ---------------------------------------------------------------------------
// Disposals (+ approve action)
// ---------------------------------------------------------------------------
router.get('/disposals', requireRole('disposals'), disposalsController.list);
router.get('/disposals/:id', requireRole('disposals'), disposalsController.getOne);
router.post('/disposals', requireRole('disposals'), disposalsController.create);
router.put('/disposals/:id', requireRole('disposals'), disposalsController.update);
router.post('/disposals/:id/approve', requireRole('disposals', 'action'), disposalsController.decide);
router.post('/disposals/:id/execute', requireRole('disposals', 'action'), disposalsController.execute);
router.delete('/disposals/:id', requireRole('disposals'), disposalsController.remove);

// ---------------------------------------------------------------------------
// Audit Log — read-only
// ---------------------------------------------------------------------------
router.get('/audit-logs', requireRole('audit-logs'), auditLogsController.list);

// ---------------------------------------------------------------------------
// Reports — read-only, server-computed
// ---------------------------------------------------------------------------
router.get('/reports/inventory-summary', requireRole('reports'), reportsController.inventorySummary);
router.get('/reports/low-stock', requireRole('reports'), reportsController.lowStock);
router.get('/reports/stock-movement', requireRole('reports'), reportsController.stockMovement);
router.get('/reports/grn-status', requireRole('reports'), reportsController.grnStatus);
router.get('/reports/requisition-status', requireRole('reports'), reportsController.requisitionStatus);
router.get('/reports/issue-status', requireRole('reports'), reportsController.issueStatus);
router.get('/reports/return-status', requireRole('reports'), reportsController.returnStatus);
router.get('/reports/transfer-status', requireRole('reports'), reportsController.transferStatus);
router.get('/reports/asset-summary', requireRole('reports'), reportsController.assetSummary);
router.get('/reports/disposal-status', requireRole('reports'), reportsController.disposalStatus);
router.get('/reports/fifo-valuation', requireRole('reports'), reportsController.fifoValuation);
// dashboard-summary is intentionally open to every authenticated role (no
// requireRole) since every role's dashboard needs it — the controller
// itself scopes the numbers per role.
router.get('/reports/dashboard-summary', reportsController.dashboardSummary);
router.get('/reports/export-csv', requireRole('reports'), reportsController.exportCsv);

// ---------------------------------------------------------------------------
// Business Rules Configuration — Admin only
// ---------------------------------------------------------------------------
router.get('/business-rules', requireRole('business-rules'), businessRulesController.list);
router.get('/business-rules/category/:category', requireRole('business-rules'), businessRulesController.listByCategory);
router.get('/business-rules/rule/:ruleName', requireRole('business-rules'), businessRulesController.getRule);
router.put('/business-rules/rule/:ruleName', requireRole('business-rules', 'action'), businessRulesController.updateRule);
router.get('/business-rules/categories', requireRole('business-rules'), businessRulesController.getCategories);
router.get('/business-rules/all', requireRole('business-rules'), businessRulesController.getAllRulesAsObject);
router.get('/notifications', notificationsController.list);
router.post('/notifications/:id/read', notificationsController.markRead);

module.exports = router;
