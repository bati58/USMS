const { query, withTransaction } = require('../config/db');
const asyncHandler = require('../utils/asyncHandler');
const AppError = require('../utils/AppError');
const { logAudit } = require('../utils/audit');

const TABLES = {
    'goods-receipts': { table: 'goods_receipts', ref: 'grn_ref', eligibleStatuses: ['Submitted', 'Pending Evaluation', 'Under Evaluation', 'Accepted', 'Partially Accepted', 'Rejected', 'GRN Generated', 'Posted'] },
    'issue-vouchers': { table: 'issue_vouchers', ref: 'siv_ref', eligibleStatuses: ['Approved', 'Posted'] }
};

const verify = asyncHandler(async (req, res) => {
    const target = TABLES[req.params.resource];
    if (!target) throw new AppError('Unsupported gate-pass document.', 404);

    const result = await withTransaction(async (client) => {
        const { rows: currentRows } = await client.query(`SELECT id, ${target.ref} AS reference, status, gate_verified FROM ${target.table} WHERE id = $1 FOR UPDATE`, [req.params.id]);
        if (!currentRows[0]) throw new AppError('Gate-pass document not found.', 404);
        if (!target.eligibleStatuses.includes(currentRows[0].status)) {
            throw new AppError('This document is not approved for gate verification.', 409);
        }
        if (currentRows[0].gate_verified) throw new AppError('This document has already been verified at the gate.', 409);

        const { rows } = await client.query(
            `UPDATE ${target.table}
     SET gate_verified = TRUE, gate_verified_by = $1, gate_verified_at = NOW(), updated_at = NOW()
     WHERE id = $2
     RETURNING id, ${target.ref} AS reference, gate_verified, gate_verified_by, gate_verified_at`,
            [req.user.name, req.params.id]
        );

        await logAudit(client, {
            userId: req.user.id,
            userName: req.user.name,
            userRole: req.user.role,
            action: `Verified gate pass ${rows[0].reference}`,
            module: 'Gate Pass',
            entityId: rows[0].id,
            entityReference: rows[0].reference,
            description: `${req.user.name} verified ${rows[0].reference} at the gate.`,
            metadata: { resource: req.params.resource }
        });

        return rows[0];
    });
    res.json(result);
});

module.exports = { verify };
