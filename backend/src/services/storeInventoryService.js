const AppError = require('../utils/AppError');

async function addStockLot(client, { itemId, storeId, receivedDate, unitPrice, qty, sourceRef }) {
    await client.query(
        `INSERT INTO stock_lots (item_id, store_id, received_date, unit_price, qty_received, qty_remaining, source_ref)
     VALUES ($1, $2, $3, $4, $5, $5, $6)`,
        [itemId, storeId, receivedDate, unitPrice, qty, sourceRef]
    );
}

async function getStoreItemForUpdate(client, itemId, storeId) {
    const { rows } = await client.query(
        `SELECT i.*, ii.qty_on_hand AS inventory_qty_on_hand, ii.bin AS inventory_bin,
            ii.location_id AS inventory_location_id, ii.unit_price AS inventory_unit_price,
            ii.store_id AS inventory_store_id
     FROM items i
     JOIN item_inventory ii ON ii.item_id = i.id AND ii.store_id = $2
     WHERE i.id = $1
     FOR UPDATE OF ii`,
        [itemId, storeId]
    );
    if (!rows[0]) throw new AppError(`Item ${itemId} is not assigned to store ${storeId}.`, 404);

    return {
        ...rows[0],
        qty_on_hand: rows[0].inventory_qty_on_hand,
        bin: rows[0].inventory_bin,
        location_id: rows[0].inventory_location_id,
        unit_price: rows[0].inventory_unit_price,
        store_id: rows[0].inventory_store_id
    };
}

async function updateStoreInventory(client, { itemId, storeId, qty, unitPrice, bin, locationId }) {
    if (!Number.isFinite(Number(qty)) || Number(qty) < 0) {
        throw new AppError('Store inventory quantity must be a non-negative number.', 400);
    }

    const item = await getStoreItemForUpdate(client, itemId, storeId);
    const nextUnitPrice = unitPrice == null ? item.unit_price : unitPrice;
    await client.query(
        `UPDATE item_inventory
         SET qty_on_hand = $1,
                 unit_price = $2,
                 bin = COALESCE($3, bin),
                 location_id = COALESCE($4, location_id),
                 updated_at = NOW()
         WHERE item_id = $5 AND store_id = $6`,
        [qty, nextUnitPrice, bin, locationId, itemId, storeId]
    );

    return {
        ...item,
        qty_on_hand: Number(qty),
        unit_price: Number(nextUnitPrice),
        bin: bin == null ? item.bin : bin,
        location_id: locationId == null ? item.location_id : locationId
    };
}

async function setStoreQuantity(client, { itemId, storeId, qty, unitPrice }) {
    return updateStoreInventory(client, { itemId, storeId, qty, unitPrice });
}

async function increaseStoreQuantity(client, { itemId, storeId, qty, unitPrice }) {
    const item = await getStoreItemForUpdate(client, itemId, storeId);
    const nextQty = Number(item.qty_on_hand) + Number(qty);
    return setStoreQuantity(client, { itemId, storeId, qty: nextQty, unitPrice });
}

async function decreaseStoreQuantity(client, { itemId, storeId, qty, unitPrice }) {
    const item = await getStoreItemForUpdate(client, itemId, storeId);
    const amount = Number(qty);
    if (!Number.isFinite(amount) || amount <= 0) {
        throw new AppError('Store inventory decrease quantity must be positive.', 400);
    }
    if (Number(item.qty_on_hand) < amount) {
        throw new AppError(`Insufficient stock to fulfil this request: short by ${amount - Number(item.qty_on_hand)} unit(s).`, 400);
    }
    return setStoreQuantity(client, { itemId, storeId, qty: Number(item.qty_on_hand) - amount, unitPrice });
}

async function consumeFifo(client, itemId, qty, storeId) {
    const item = await getStoreItemForUpdate(client, itemId, storeId);
    const storeClause = ' AND sl.store_id = $2';
    const params = [itemId, storeId];
    const { rows: fifoRows } = await client.query(
        `SELECT COALESCE(SUM(sl.qty_remaining), 0) AS fifo_remaining
     FROM stock_lots sl
     WHERE sl.item_id = $1 AND sl.store_id = $2 AND sl.qty_remaining > 0`,
        params
    );
    const untrackedQty = Math.max(0, Number(item.qty_on_hand || 0) - Number(fifoRows[0]?.fifo_remaining || 0));
    if (untrackedQty > 0.0001) {
        await addStockLot(client, {
            itemId,
            storeId,
            receivedDate: new Date(),
            unitPrice: Number(item.unit_price || 0),
            qty: untrackedQty,
            sourceRef: 'SYSTEM-QUANTITY-ADJUSTMENT'
        });
    }

    const { rows: lots } = await client.query(
        `SELECT id, unit_price, qty_remaining
     FROM stock_lots sl
     WHERE item_id = $1 AND qty_remaining > 0${storeClause}
     ORDER BY received_date ASC, id ASC
     FOR UPDATE`,
        params
    );

    let remaining = Number(qty);
    let totalCost = 0;
    let totalConsumed = 0;
    for (const lot of lots) {
        if (remaining <= 0) break;
        const take = Math.min(Number(lot.qty_remaining), remaining);
        await client.query('UPDATE stock_lots SET qty_remaining = qty_remaining - $1 WHERE id = $2', [take, lot.id]);
        totalCost += take * Number(lot.unit_price);
        totalConsumed += take;
        remaining -= take;
    }
    if (remaining > 0.0001) {
        throw new AppError(`Insufficient stock to fulfil this request: short by ${remaining} unit(s).`, 400);
    }
    return totalConsumed > 0 ? totalCost / totalConsumed : 0;
}

module.exports = {
    addStockLot,
    getStoreItemForUpdate,
    updateStoreInventory,
    setStoreQuantity,
    increaseStoreQuantity,
    decreaseStoreQuantity,
    consumeFifo
};