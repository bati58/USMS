const test = require('node:test');
const assert = require('node:assert/strict');
const { getUserStoreVisibility, buildOwnerScope, assertUserCanAccessStoreRecord } = require('../src/controllers/_helpers');

test('main store users are broad-store visible while regular store users are assigned-store only', async () => {
    const mainUser = { role: 'Store Head', name: 'Yonas Bekele' };
    const subUser = { role: 'Storekeeper', name: 'Sara Alemu' };

    const mainResult = await getUserStoreVisibility(mainUser, {
        query: async (sql, params) => ({
            rows: [{ id: 1, name: 'Main Store', type: 'Main Store', code: 'STR-MAIN' }]
        })
    });

    const subResult = await getUserStoreVisibility(subUser, {
        query: async (sql, params) => ({
            rows: [{ id: 2, name: 'Electrical Engineering Dept. Store', type: 'Department Store', code: 'STR-EEE' }]
        })
    });

    assert.equal(mainResult.isMainStoreUser, true);
    assert.equal(subResult.isMainStoreUser, false);
    assert.equal(subResult.assignedStoreId, 2);

    const ownerScope = buildOwnerScope({ role: 'Department Head', name: 'Chala' });
    assert.equal(ownerScope.scope, 'WHERE requested_by = $1');
    assert.deepEqual(ownerScope.params, ['Chala']);
});

test('store-assigned users cannot view records from another store', async () => {
    const subUser = { role: 'Storekeeper', name: 'Sara Alemu' };
    const db = {
        query: async () => ({
            rows: [{ id: 2, name: 'Electrical Engineering Dept. Store', type: 'Department Store', code: 'STR-EEE' }]
        })
    };

    await assertUserCanAccessStoreRecord(subUser, 2, db);
    await assert.rejects(async () => {
        await assertUserCanAccessStoreRecord(subUser, 999, db);
    }, /assigned store/i);
});
