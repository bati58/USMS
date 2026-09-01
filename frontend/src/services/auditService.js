const NAMESPACE = 'sms_v1_'
const SENSITIVE_KEYS = /password|passphrase|secret|token|jwt|api[_ -]?key|authorization|cookie|session/i

export const AUDIT_OUTCOMES = {
    SUCCESS: 'SUCCESS',
    FAILED: 'FAILED',
    WARNING: 'WARNING'
}

function nextAuditId() {
    const rows = JSON.parse(localStorage.getItem(`${NAMESPACE}auditLogs`) || '[]')
    const nextNumber = rows.length + 1
    return `AUD-${new Date().getFullYear()}-${String(nextNumber).padStart(5, '0')}`
}

function isObject(value) {
    return value !== null && typeof value === 'object' && !Array.isArray(value)
}

export function sanitizeAuditData(value, parentKey = '') {
    if (Array.isArray(value)) {
        return value.map((item) => sanitizeAuditData(item, parentKey))
    }

    if (isObject(value)) {
        return Object.entries(value).reduce((acc, [key, entryValue]) => {
            if (SENSITIVE_KEYS.test(key) || (parentKey && SENSITIVE_KEYS.test(parentKey))) {
                return acc
            }
            acc[key] = sanitizeAuditData(entryValue, key)
            return acc
        }, {})
    }

    return value
}

export function buildAuditChanges(beforeData = {}, afterData = {}) {
    const before = sanitizeAuditData(beforeData)
    const after = sanitizeAuditData(afterData)
    const allKeys = [...new Set([...Object.keys(before), ...Object.keys(after)])]

    return allKeys
        .filter((key) => JSON.stringify(before[key]) !== JSON.stringify(after[key]))
        .map((key) => ({
            field: key,
            oldValue: before[key],
            newValue: after[key]
        }))
}

export function normalizeAuditRecord(record = {}) {
    const timestamp = record.timestamp || record.date || new Date().toISOString()
    const actorName = record.actorName || record.user || record.actor?.name || 'System'
    const actorRole = record.actorRole || record.role || record.actor?.role || 'System'
    const actorId = record.actorId || record.actor?.id || 'SYS'
    const action = record.action || 'SYSTEM_EVENT'
    const module = record.module || 'System'
    const entityType = record.entityType || record.entity || 'System'
    const entityId = record.entityId || record.entityReference || record.reference || 'N/A'
    const entityReference = record.entityReference || record.reference || entityId
    const outcome = record.outcome || 'SUCCESS'

    return {
        id: record.id || nextAuditId(),
        timestamp: new Date(timestamp).toISOString(),
        actorId,
        actorName,
        actorRole,
        action,
        module,
        entityType,
        entityId,
        entityReference,
        description: record.description || `${action} in ${module}`,
        outcome,
        beforeData: sanitizeAuditData(record.beforeData || {}),
        afterData: sanitizeAuditData(record.afterData || {}),
        changes: Array.isArray(record.changes) ? record.changes : buildAuditChanges(record.beforeData, record.afterData),
        ipAddress: record.ipAddress || 'N/A',
        userAgent: record.userAgent || 'Frontend (Browser)',
        metadata: sanitizeAuditData(record.metadata || {})
    }
}

export async function logAuditEvent(event = {}) {
    const record = normalizeAuditRecord({
        ...event,
        beforeData: sanitizeAuditData(event.beforeData || {}),
        afterData: sanitizeAuditData(event.afterData || {}),
        metadata: sanitizeAuditData(event.metadata || {}),
        changes: event.changes || buildAuditChanges(event.beforeData, event.afterData)
    })

    const rows = JSON.parse(localStorage.getItem(`${NAMESPACE}auditLogs`) || '[]')
    const nextRows = [record, ...rows]
    localStorage.setItem(`${NAMESPACE}auditLogs`, JSON.stringify(nextRows))

    return record
}

export function exportAuditCsv(rows = []) {
    const header = ['Timestamp', 'User', 'Role', 'Action', 'Module', 'Entity', 'Reference', 'Description', 'Outcome']
    const body = rows.map((row) => {
        const record = normalizeAuditRecord(row)
        return [
            record.timestamp,
            record.actorName,
            record.actorRole,
            record.action,
            record.module,
            record.entityId,
            record.entityReference,
            record.description,
            record.outcome
        ]
            .map((value) => `"${String(value ?? '').replace(/"/g, '""')}"`)
            .join(',')
    })

    const csv = [header.join(','), ...body].join('\n')
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const anchor = document.createElement('a')
    anchor.href = url
    anchor.download = 'audit-log.csv'
    anchor.click()
    URL.revokeObjectURL(url)
}
