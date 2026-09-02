const test = require('node:test');
const assert = require('node:assert/strict');
const { resolveNotificationRecipients } = require('../src/utils/notify');

test('notification recipients resolve to the assigned store or department owner, not every role member', async () => {
    const db = {
        query: async (sql, params) => {
            if (sql.includes('FROM stores')) {
                return { rows: [{ actor_name: 'Mekonnen' }] };
            }
            if (sql.includes('FROM users WHERE name = $1 AND role = $2 AND active = TRUE')) {
                return {
                    rows: params[0] === 'Mekonnen' && params[1] === 'Store Head'
                        ? [{ id: 42, name: 'Mekonnen' }]
                        : []
                };
            }
            if (sql.includes('JOIN departments d ON d.head_user_id = u.id')) {
                return { rows: [{ id: 55 }] };
            }
            return { rows: [] };
        }
    };

    const recipients = await resolveNotificationRecipients({ db, role: 'Store Head', storeId: 7, department: 'Electrical Engineering' });

    assert.equal(recipients.length, 1);
    assert.deepEqual(recipients.map((r) => r.userId), [42]);
});
