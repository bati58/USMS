const { query, withTransaction } = require('../config/db');
const asyncHandler = require('../utils/asyncHandler');
const AppError = require('../utils/AppError');
const { nextRef } = require('../utils/refGenerator');
const { logAudit } = require('../utils/audit');
const { resolveStoreId, resolveItemId, getUserStoreVisibility, assertUserCanAccessStoreRecord } = require('./_helpers');
const stockService = require('../services/stockService');
const { notify } = require('../utils/notify');

const SELECT = `
  SELECT st.*, s.name AS store_name
  FROM stock_taking_sessions st
  JOIN stores s ON s.id = st.store_id
`;

function mapSession(row, items = []) {
    return {
        id: row.id,
        sessionRef: row.session_ref,
        store: row.store_name,
        countDate: row.count_date,
        status: row.status,
        createdBy: row.created_by,
        assignedTo: row.assigned_to,
        assignedUserId: row.assigned_user_id,
        approvedBy: row.approved_by,
        approvedAt: row.approved_at,
        closedBy: row.closed_by,
        closedAt: row.closed_at,
        items: items.map((item) => ({
            id: item.id,
            itemId: item.item_id,
            item: item.item_name,
            bin: item.bin,
            systemQty: Number(item.system_qty),
            physicalQty: item.physical_qty == null ? null : Number(item.physical_qty),
            variance: item.variance == null ? null : Number(item.variance),
            recountPhysicalQty: item.recount_physical_qty == null ? null : Number(item.recount_physical_qty),
            recountVariance: item.recount_variance == null ? null : Number(item.recount_variance),
            recountedBy: item.recounted_by,
            recountedAt: item.recounted_at,
            reason: item.reason,
            counter: item.counter,
            verifiedBy: item.verified_by,
            adjustmentRef: item.adjustment_ref
        }))
    };
}

async function fetchSession(id, dbClient = { query }) {
    const { rows } = await dbClient.query(`${SELECT} WHERE st.id = $1`, [id]);
    if (!rows[0]) return null;
    const { rows: items } = await dbClient.query(
        `SELECT sti.*, i.name AS item_name FROM stock_taking_items sti JOIN items i ON i.id = sti.item_id WHERE sti.session_id = $1 ORDER BY sti.id`,
        [id]
    );
    return mapSession(rows[0], items);
}

const list = asyncHandler(async (req, res) => {
    let scope = '';
    let params = [];

    if (['Store Head', 'Storekeeper'].includes(req.user.role)) {
        const visibility = await getUserStoreVisibility(req.user, { query });
        if (visibility.canViewAllStores) {
            scope = 'WHERE 1 = 1';
        } else if (visibility.assignedStoreId) {
            scope = 'WHERE st.store_id = $1';
            params = [visibility.assignedStoreId];
        }
    } else if (req.user.role === 'Stock Clerk') {
        scope = 'WHERE st.assigned_user_id = $1';
        params = [req.user.id];
    }

    const { rows } = await query(`${SELECT} ${scope} ORDER BY st.id DESC`, params);
    const results = [];
    for (const row of rows) results.push(await fetchSession(row.id));
    res.json(results);
});

const getOne = asyncHandler(async (req, res) => {
    let scope = '';
    let params = [req.params.id];

    if (['Store Head', 'Storekeeper'].includes(req.user.role)) {
        const visibility = await getUserStoreVisibility(req.user, { query });
        if (visibility.canViewAllStores) {
            scope = '';
        } else if (visibility.assignedStoreId) {
            scope = ' AND st.store_id = $2';
            params.push(visibility.assignedStoreId);
        } else {
            throw new AppError('You are not assigned to any store scope.', 403);
        }
    } else if (req.user.role === 'Stock Clerk') {
        scope = ' AND st.assigned_user_id = $2';
        params.push(req.user.id);
    }

    const { rows } = await query(`${SELECT} WHERE st.id = $1${scope}`, params);
    if (!rows[0]) throw new AppError('Stock-taking session not found.', 404);

    if (['Store Head', 'Storekeeper'].includes(req.user.role)) {
        await assertUserCanAccessStoreRecord(req.user, rows[0].store_id, { query });
    }

    const session = await fetchSession(rows[0].id);
    res.json(session);
});

const create = asyncHandler(async (req, res) => {
    const { store, countDate, items, assignedTo } = req.body;
    if (!store || !Array.isArray(items) || items.length === 0) throw new AppError('store and at least one counted item are required.', 400);

    const result = await withTransaction(async (client) => {
        const storeId = await resolveStoreId(store, client);

        const { rows: openSessions } = await client.query(
            `SELECT session_ref FROM stock_taking_sessions WHERE store_id = $1 AND status IN ('Draft', 'Submitted', 'Approved')`,
            [storeId]
        );
        if (openSessions.length > 0) {
            throw new AppError(`There is already an open stock-taking session (${openSessions[0].session_ref}) for this store. Please complete or cancel it first.`, 400);
        }

        const sessionRef = await nextRef(client, 'STK');
        const { rows: assignedUsers } = await client.query(
            `SELECT id, name FROM users WHERE name = $1 AND role = 'Stock Clerk' AND active = TRUE`,
            [assignedTo || null]
        );
        if (!assignedUsers[0]) throw new AppError('Select an active Stock Clerk to assign this session.', 400);
        const { rows } = await client.query(
            `INSERT INTO stock_taking_sessions (session_ref, store_id, count_date, created_by, assigned_to, assigned_user_id) VALUES ($1, $2, $3, $4, $5, $6) RETURNING id`,
            [sessionRef, storeId, countDate || null, req.user.name, assignedUsers[0].name, assignedUsers[0].id]
        );
        for (const line of items) {
            const itemId = await resolveItemId(line.item, client, storeId);
            if (!itemId) throw new AppError(`Unknown item: "${line.item}".`, 400);
            const { rows: stockRows } = await client.query('SELECT qty_on_hand, store_id, bin FROM items WHERE id = $1 AND store_id = $2', [itemId, storeId]);
            if (!stockRows[0]) throw new AppError(`Item "${line.item}" does not belong to the selected store.`, 400);
            const systemQty = Number(stockRows[0].qty_on_hand);
            await client.query(
                `INSERT INTO stock_taking_items (session_id, item_id, bin, system_qty, physical_qty, variance, reason, counter)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
                [rows[0].id, itemId, line.bin || stockRows[0].bin, systemQty, null, null, null, null]
            );
        }
        await logAudit(client, { userId: req.user.id, userName: req.user.name, userRole: req.user.role, action: `Created stock-taking session ${sessionRef}`, module: 'Stock Taking', entityType: 'stock_taking_session', entityId: rows[0].id, entityReference: sessionRef });
        return fetchSession(rows[0].id, client);
    });
    res.status(201).json(result);
});

const submit = asyncHandler(async (req, res) => {
    await withTransaction(async (client) => {
        const { rows } = await client.query(
            `SELECT st.status, st.session_ref, st.assigned_user_id, s.head_of_store, u.id AS store_head_id
             FROM stock_taking_sessions st
             JOIN stores s ON s.id = st.store_id
             LEFT JOIN users u ON u.name = s.head_of_store AND u.role = 'Store Head' AND u.active = TRUE
             WHERE st.id = $1 FOR UPDATE OF st`,
            [req.params.id]
        );
        if (!rows[0]) throw new AppError('Stock-taking session not found.', 404);
        if (!['Draft', 'Scheduled', 'In Progress', 'Recount Required', 'Submitted'].includes(rows[0].status)) throw new AppError(`Cannot submit session in status: ${rows[0].status}`, 400);
        if (rows[0].status !== 'Submitted' && req.user.role !== 'Stock Clerk') {
            throw new AppError('Only the assigned Stock Clerk can submit physical counts.', 403);
        }
        if (rows[0].status !== 'Submitted' && rows[0].assigned_user_id !== req.user.id) {
            throw new AppError('Only the Stock Clerk assigned to this session can submit physical counts.', 403);
        }

        const countColumn = rows[0].status === 'Recount Required' ? 'recount_physical_qty' : 'physical_qty';
        const { rows: incomplete } = await client.query(
            `SELECT COUNT(*)::int AS missing FROM stock_taking_items WHERE session_id = $1 AND ${countColumn} IS NULL`,
            [req.params.id]
        );
        if (incomplete[0].missing > 0) {
            throw new AppError('Every item must have a physical count before the session can be submitted.', 400);
        }

        const nextStatus = rows[0].status === 'Submitted' ? 'Under Review' : 'Submitted';
        await client.query('UPDATE stock_taking_sessions SET status = $1, updated_at = NOW() WHERE id = $2', [nextStatus, req.params.id]);
        await logAudit(client, { userName: req.user.name, action: `Submitted stock-taking session ${rows[0].session_ref} to ${nextStatus}`, module: 'Stock Taking' });
        await notify(client, {
            userId: rows[0].store_head_id || undefined,
            role: rows[0].store_head_id ? undefined : 'Store Head',
            title: 'Stock-taking session awaiting approval',
            message: `${rows[0].session_ref} is ready for review.`,
            type: 'warning',
            route: '/stock-taking',
            entityType: 'stock_taking_session',
            entityId: req.params.id
        });
    });
    res.json(await fetchSession(req.params.id));
});

const update = asyncHandler(async (req, res) => {
    const { items = [] } = req.body;
    if (!Array.isArray(items) || items.length === 0) throw new AppError('At least one count line is required.', 400);

    await withTransaction(async (client) => {
        const { rows: sessions } = await client.query('SELECT * FROM stock_taking_sessions WHERE id = $1 FOR UPDATE', [req.params.id]);
        const session = sessions[0];
        if (!session) throw new AppError('Stock-taking session not found.', 404);
        if (!['Draft', 'Recount Required', 'Approved'].includes(session.status)) throw new AppError('Submitted stock counts are historical and cannot be edited.', 409);
        if (req.user.role === 'Stock Clerk' && session.assigned_user_id !== req.user.id) {
            throw new AppError('You are not assigned to this stock-taking session.', 403);
        }

        for (const line of items) {
            const physicalQty = Number(line.physicalQty);
            if (!Number.isFinite(physicalQty) || physicalQty < 0) throw new AppError('Physical quantity must be zero or greater.', 400);
            const { rows: current } = await client.query(
                `SELECT sti.id, sti.system_qty, i.name FROM stock_taking_items sti JOIN items i ON i.id = sti.item_id
                 WHERE sti.session_id = $1 AND sti.item_id = $2 FOR UPDATE`,
                [req.params.id, line.itemId]
            );
            if (!current[0]) throw new AppError(`Item line "${line.itemId}" is not part of this session.`, 400);
            const variance = physicalQty - Number(current[0].system_qty);
            if (session.status === 'Recount Required') {
                await client.query(
                    `UPDATE stock_taking_items SET recount_physical_qty = $1, recount_variance = $2, recounted_by = $3, recounted_at = NOW(), reason = $4 WHERE id = $5`,
                    [physicalQty, variance, req.user.name, line.reason || null, current[0].id]
                );
            } else {
                await client.query('UPDATE stock_taking_items SET physical_qty = $1, variance = $2, reason = $3 WHERE id = $4', [physicalQty, variance, line.reason || null, current[0].id]);
            }
        }

        if (['Draft', 'Scheduled'].includes(session.status)) {
            await client.query("UPDATE stock_taking_sessions SET status = 'In Progress', updated_at = NOW() WHERE id = $1", [req.params.id]);
        }

        await logAudit(client, { userId: req.user.id, userName: req.user.name, userRole: req.user.role, action: `Saved stock-taking counts for ${session.session_ref}`, module: 'Stock Taking', entityType: 'stock_taking_session', entityId: req.params.id, entityReference: session.session_ref });
    });
    res.json(await fetchSession(req.params.id));
});

const requestRecount = asyncHandler(async (req, res) => {
    const { reason } = req.body;
    if (!reason || !String(reason).trim()) throw new AppError('A recount reason is required.', 400);
    await withTransaction(async (client) => {
        const { rows } = await client.query(
            `SELECT st.status, st.session_ref, st.store_id, st.created_by, st.assigned_user_id
             FROM stock_taking_sessions st
             WHERE st.id = $1 FOR UPDATE OF st`,
            [req.params.id]
        );
        if (!rows[0]) throw new AppError('Stock-taking session not found.', 404);
        await assertUserCanAccessStoreRecord(req.user, rows[0].store_id, client);
        if (rows[0].status !== 'Submitted') throw new AppError(`Cannot request recount in status: ${rows[0].status}`, 409);
        await client.query("UPDATE stock_taking_sessions SET status = 'Recount Required', updated_at = NOW() WHERE id = $1", [req.params.id]);
        await logAudit(client, { userId: req.user.id, userName: req.user.name, userRole: req.user.role, action: `Requested recount for ${rows[0].session_ref}`, module: 'Stock Taking', entityType: 'stock_taking_session', entityId: req.params.id, entityReference: rows[0].session_ref, metadata: { reason } });
        if (!rows[0].assigned_user_id) {
            throw new AppError('This session is not assigned to any Stock Clerk. Assign a clerk before requesting a recount.', 400);
        }
        await notify(client, { userId: rows[0].assigned_user_id, title: 'Stock recount required', message: `${rows[0].session_ref} requires a recount. Reason: ${reason}`, type: 'warning', route: '/stock-taking', entityType: 'stock_taking_session', entityId: req.params.id });
    });
    res.json(await fetchSession(req.params.id));
});

const verify = asyncHandler(async (req, res) => {
    await withTransaction(async (client) => {
        const { rows } = await client.query('SELECT store_id FROM stock_taking_sessions WHERE id = $1', [req.params.id]);
        if (!rows[0]) throw new AppError('Stock-taking session not found.', 404);
        await assertUserCanAccessStoreRecord(req.user, rows[0].store_id, client);
        await stockService.verifyStockTaking(client, { sessionId: req.params.id, actorName: req.user.name });
    });
    res.json(await fetchSession(req.params.id));
});

const reconcile = asyncHandler(async (req, res) => {
    await withTransaction(async (client) => {
        const { rows } = await client.query('SELECT store_id FROM stock_taking_sessions WHERE id = $1', [req.params.id]);
        if (!rows[0]) throw new AppError('Stock-taking session not found.', 404);
        await assertUserCanAccessStoreRecord(req.user, rows[0].store_id, client);
        await stockService.reconcileStockTaking(client, { sessionId: req.params.id, actorName: req.user.name });
        await notify(client, {
            role: 'Property Administration Officer',
            title: 'Stock-taking adjustment approval required',
            message: `Stock-taking session ${req.params.id} has a variance requiring adjustment approval.`,
            type: 'warning',
            route: '/stock-taking',
            entityType: 'stock-taking-session',
            entityId: req.params.id
        });
    });
    res.json(await fetchSession(req.params.id));
});

const approve = asyncHandler(async (req, res) => {
    await withTransaction(async (client) => {
        const { rows } = await client.query('SELECT store_id FROM stock_taking_sessions WHERE id = $1', [req.params.id]);
        if (!rows[0]) throw new AppError('Stock-taking session not found.', 404);
        await assertUserCanAccessStoreRecord(req.user, rows[0].store_id, client);
        await stockService.approveStockTaking(client, { sessionId: req.params.id, actorName: req.user.name });
    });
    res.json(await fetchSession(req.params.id));
});

const post = asyncHandler(async (req, res) => {
    await withTransaction(async (client) => {
        const { rows } = await client.query('SELECT store_id FROM stock_taking_sessions WHERE id = $1', [req.params.id]);
        if (!rows[0]) throw new AppError('Stock-taking session not found.', 404);
        await assertUserCanAccessStoreRecord(req.user, rows[0].store_id, client);
        await stockService.postStockTaking(client, { sessionId: req.params.id, actorName: req.user.name });
    });
    res.json(await fetchSession(req.params.id));
});

const reconciliation = asyncHandler(async (req, res) => {
    const { rows } = await query(`
    SELECT st.session_ref, st.count_date, st.status, s.name AS store, i.name AS item,
           sti.bin, sti.system_qty, sti.physical_qty, sti.variance, sti.reason, sti.adjustment_ref
    FROM stock_taking_items sti
    JOIN stock_taking_sessions st ON st.id = sti.session_id
    JOIN stores s ON s.id = st.store_id
    JOIN items i ON i.id = sti.item_id
    WHERE sti.variance <> 0
    ORDER BY st.count_date DESC, sti.id DESC
  `);
    res.json(rows.map((row) => ({ ...row, systemQty: Number(row.system_qty), physicalQty: Number(row.physical_qty), variance: Number(row.variance) })));
});

module.exports = { list, getOne, create, update, submit, requestRecount, verify, reconcile, approve, post, reconciliation };