import { ROLES, STATUS } from './constants.js'

/**
 * Build role-relevant notifications from live inventory data (SRS-aligned).
 * Each notification uses a stable `id` so read/dismiss state can persist.
 */
export function buildNotifications(user, data) {
  if (!user) return []

  const {
    items = [],
    grns = [],
    reqs = [],
    returns = [],
    transfers = [],
    disposals = [],
    vouchers = [],
    stockTaking = []
  } = data

  const notes = []
  const userStore = user.store || user.assignedStore || user.departmentStore
  const userDept = user.department

  const lowStock = items.filter((i) => Number(i.qtyOnHand) <= Number(i.reorderLevel))
  const expiringItems = items.filter((item) => {
    if (!item.expiryTracked || !item.expiryDate) return false
    const daysUntilExpiry = (new Date(item.expiryDate) - new Date()) / (1000 * 60 * 60 * 24)
    return daysUntilExpiry <= 90
  })
  const pendingReqs = reqs.filter((r) => [STATUS.PENDING, 'Submitted', 'Returned for Correction'].includes(r.status))
  const pendingGrns = grns.filter((g) => [
    STATUS.PENDING,
    'Submitted',
    'Store Head Review',
    'Pending Evaluation',
    STATUS.UNDER_EVALUATION
  ].includes(g.status))
  const pendingDisposals = disposals.filter((d) => [
    'Flagged', 'Quarantined', 'Under Technical Assessment', 'Repairable', 'Unusable',
    'Send for Repair', 'Disposal Requested', 'Pending Store Head Review', 'Store Head Review',
    'Recommended for Disposal', 'Pending Authorization', 'Ready for Disposal', 'Disposed',
    'Pending Confirmation', STATUS.PENDING, STATUS.APPROVED, 'Returned for Correction'
  ].includes(d.status))
  const pendingTransfers = transfers.filter((t) => ![STATUS.COMPLETED, STATUS.CANCELLED, STATUS.REJECTED].includes(t.status))
  const pendingReturns = returns.filter((r) => [STATUS.SUBMITTED, STATUS.PENDING, STATUS.UNDER_EVALUATION].includes(r.status))
  const pendingGateIn = grns.filter((g) => !g.gateVerified && ['Submitted', 'Store Head Review', 'Pending Evaluation', 'Under Evaluation', 'Accepted', 'Partially Accepted', 'Rejected', 'GRN Generated', 'Posted'].includes(g.status))

  function push(id, title, message, type, route, timestamp, options = {}) {
    notes.push({ id, title, message, type, route, timestamp: timestamp || new Date(), read: false, ...options })
  }

  function pushInventoryAlert(id, title, message, route, timestamp, conditionKey) {
    push(`${id}-${conditionKey}`, title, message, 'warning', route, timestamp, { conditionAlert: true })
  }

  function pushExpiryAlerts(filteredItems = expiringItems) {
    filteredItems.slice(0, 6).forEach((item) => {
      pushInventoryAlert(
        `expiry-${item.id}`,
        'Expiry Alert',
        `${item.name} at ${item.store} expires on ${item.expiryDate}`,
        '/items',
        item.expiryDate,
        item.expiryDate
      )
    })
  }

  switch (user.role) {
    case ROLES.ADMIN:
      lowStock.slice(0, 5).forEach((item) => {
        push(
          `lowstock-${item.id}-${item.qtyOnHand}-${item.reorderLevel}`,
          'Low Stock Alert',
          `${item.name} at ${item.store} is at ${item.qtyOnHand} ${item.unit} (reorder: ${item.reorderLevel})`,
          'warning',
          '/items',
          item.updatedAt,
          { conditionAlert: true }
        )
      })
      pushExpiryAlerts()
      pendingGrns.slice(0, 5).forEach((g) => {
        push(
          `grn-${g.id}`,
          'Goods Receipt Pending',
          `${g.grnRef} from ${g.supplier} — ${g.status}`,
          'info',
          '/goods-receipt',
          g.receivedDate
        )
      })
      pendingReqs.slice(0, 5).forEach((r) => {
        push(
          `req-${r.id}`,
          'Requisition Pending',
          `${r.srRef} from ${r.department} awaiting approval`,
          'warning',
          '/requisitions',
          r.date
        )
      })
      break

    case ROLES.STORE_HEAD:
      lowStock
        .filter((item) => !userStore || item.store === userStore)
        .slice(0, 5)
        .forEach((item) => {
          push(
            `lowstock-${item.id}-${item.qtyOnHand}-${item.reorderLevel}`,
            'Low Stock Alert',
            `${item.name} at ${item.store} is at ${item.qtyOnHand} ${item.unit} (reorder: ${item.reorderLevel})`,
            'warning',
            '/items',
            item.updatedAt,
            { conditionAlert: true }
          )
        })
      pushExpiryAlerts(expiringItems.filter((item) => !userStore || item.store === userStore))

      pendingGrns
        .filter((g) => !userStore || g.store === userStore)
        .slice(0, 5)
        .forEach((g) => {
          push(
            `grn-${g.id}`,
            'Goods Receipt Pending',
            `${g.grnRef} from ${g.supplier} — ${g.status}`,
            'info',
            '/goods-receipt',
            g.receivedDate
          )
        })

      pendingReturns
        .filter((r) => !userStore || r.store === userStore || r.department === userDept)
        .slice(0, 6)
        .forEach((r) => {
          push(
            `return-${r.id}`,
            'Material Return Review',
            `${r.srnRef} from ${r.department} requires store review`,
            'info',
            '/material-return',
            r.date
          )
        })

      pendingTransfers
        .filter((t) => !userStore || [t.fromStore, t.toStore].includes(userStore))
        .slice(0, 6)
        .forEach((t) => {
          push(
            `transfer-${t.id}`,
            'Store Transfer Review',
            `${t.transferRef}: ${t.fromStore} → ${t.toStore} is awaiting action`,
            'info',
            '/material-transfer',
            t.date
          )
        })

      pendingDisposals
        .filter((d) => !userStore || d.store === userStore)
        .slice(0, 6)
        .forEach((d) => {
          push(
            `disposal-${d.id}`,
            'Disposal Approval',
            `${d.disposalRef} for ${d.item} needs review`,
            'warning',
            '/disposal',
            d.dateFlagged
          )
        })
      break

    case ROLES.PAO: {
      // Stage 2 of the two-stage approval: the PAO acts on requisitions that a Department
      // Head has already endorsed (status 'Pending Approval').
      reqs
        .filter((r) => r.status === 'Pending Approval')
        .slice(0, 8)
        .forEach((r) => {
          push(
            `req-${r.id}`,
            'Approval Required',
            `${r.srRef} from ${r.department} needs your approval`,
            'warning',
            '/requisitions',
            r.date
          )
        })
      // AUTHORIZED REVIEW: the PAO authorizes the Store Head's prepared voucher before issue.
      vouchers
        .filter((v) => ['Preliminary', 'Pending Approval'].includes(v.status))
        .slice(0, 6)
        .forEach((v) => {
          push(
            `voucher-authorize-${v.id}`,
            'Authorize Issue Voucher',
            `${v.sivRef} from ${v.srRef || 'a requisition'} is awaiting your authorization`,
            'warning',
            '/issue-vouchers',
            v.date
          )
        })
      pendingTransfers.slice(0, 5).forEach((t) => {
        push(
          `transfer-${t.id}`,
          'Transfer Pending',
          `${t.transferRef}: ${t.fromStore} → ${t.toStore}`,
          'info',
          '/material-transfer',
          t.date
        )
      })
      pendingDisposals.slice(0, 5).forEach((d) => {
        push(
          `disposal-${d.id}`,
          'Disposal Request',
          `${d.disposalRef} for ${d.item} requires action`,
          'warning',
          '/disposal',
          d.dateFlagged
        )
      })
      break
    }

    case ROLES.STOREKEEPER:
      pendingDisposals
        .filter((d) => ['Ready for Disposal', 'Disposed'].includes(d.status))
        .slice(0, 6)
        .forEach((d) => push(`disposal-${d.id}`, 'Disposal Execution', `${d.disposalRef} is ready for store action (${d.status})`, 'warning', '/disposal', d.dateFlagged))
      pendingGrns.slice(0, 6).forEach((g) => {
        push(
          `grn-${g.id}`,
          'Record Receipt',
          `${g.grnRef} at ${g.store} needs processing`,
          'info',
          '/goods-receipt',
          g.receivedDate
        )
      })
      grns
        .filter((g) => ['Accepted', 'Partially Accepted'].includes(g.status))
        .slice(0, 6)
        .forEach((g) => {
          push(
            `grn-accepted-${g.id}`,
            'Goods Receipt Accepted',
            `${g.grnRef} at ${g.store} was accepted by TEC. Generate the official GRN and post stock.`,
            'success',
            '/goods-receipt',
            g.receivedDate
          )
        })
      pendingTransfers
        .filter((t) => {
          if (!userStore) return true
          if (t.status === 'Approved') return t.fromStore === userStore
          if (t.status === 'Dispatched') return t.toStore === userStore
          return false
        })
        .filter((t) => ['Approved', 'Dispatched'].includes(t.status))
        .slice(0, 6)
        .forEach((t) => {
          push(
            `transfer-${t.id}`,
            t.status === 'Dispatched' ? 'Transfer Ready to Receive' : 'Transfer Approved',
            t.status === 'Dispatched'
              ? `${t.transferRef}: ${t.fromStore} → ${t.toStore} was dispatched and is ready to receive`
              : `${t.transferRef}: ${t.fromStore} → ${t.toStore} is approved and ready to dispatch`,
            t.status === 'Dispatched' ? 'info' : 'success',
            '/material-transfer',
            t.date
          )
        })
      // The Storekeeper no longer generates vouchers — they issue the ones the PAO has
      // authorized (voucher status 'Approved'); posting fulfils the requisition.
      vouchers
        .filter((v) => v.status === 'Approved')
        .slice(0, 6)
        .forEach((v) => {
          push(
            `voucher-issue-${v.id}`,
            'Issue Authorized Voucher',
            `${v.sivRef} was authorized — issue the materials and post stock`,
            'success',
            '/issue-vouchers',
            v.date
          )
        })
      reqs
        .filter((r) => [STATUS.APPROVED, 'Partially Approved'].includes(r.status) && (!userStore || r.store === userStore))
        .slice(0, 6)
        .forEach((r) => {
          const isReplenishment = r.requesterRole === ROLES.STOREKEEPER
          push(
            `req-next-${r.id}`,
            isReplenishment ? 'Replenishment Transfer Required' : 'Generate Issue Voucher',
            isReplenishment
              ? `${r.srRef} is approved — prepare the replenishment through Material Transfers`
              : `${r.srRef} is approved — generate the preliminary issue voucher`,
            'success',
            isReplenishment ? '/material-transfer' : '/issue-vouchers',
            r.date
          )
        })
      pendingReturns.slice(0, 6).forEach((r) => {
        push(
          `eval-return-${r.id}`,
          'Return Review Required',
          `${r.srnRef} from ${r.department} needs store review`,
          'info',
          '/material-return',
          r.date
        )
      })
      returns
        .filter((r) => r.status === 'Approved')
        .slice(0, 6)
        .forEach((r) => {
          push(
            `return-approved-${r.id}`,
            'Material Return Approved',
            `${r.srnRef} was approved by the Store Head. Receive it and return it to stock.`,
            'success',
            '/material-return',
            r.date
          )
        })
      break

    case ROLES.TEC:
      pendingDisposals
        .filter((d) => ['Quarantined', 'Under Technical Assessment', 'Send for Repair'].includes(d.status))
        .slice(0, 8)
        .forEach((d) => push(`disposal-${d.id}`, 'Disposal Assessment', `${d.disposalRef} requires technical assessment (${d.status})`, 'info', '/disposal', d.dateFlagged))
      grns.filter((g) => ['Under Evaluation', 'Pending Evaluation'].includes(g.status)).slice(0, 6).forEach((g) => {
        push(
          `eval-grn-${g.id}`,
          'Technical Evaluation',
          `${g.grnRef} at ${g.store} awaiting evaluation`,
          'info',
          '/goods-receipt/evaluation',
          g.receivedDate
        )
      })
      break

    case ROLES.DISPOSAL_COMMITTEE:
      pendingDisposals
        .filter((d) => ['Pending Authorization', 'Pending Confirmation', 'Confirmed'].includes(d.status))
        .slice(0, 8)
        .forEach((d) => push(`disposal-${d.id}`, 'Disposal Review', `${d.disposalRef} requires committee action (${d.status})`, 'warning', '/disposal', d.dateFlagged))
      break

    case ROLES.STOCK_CLERK:
      stockTaking
        .filter((s) => ['Draft', 'Scheduled', 'In Progress', 'Submitted', 'Under Review', 'Approved', 'Recount Required'].includes(s.status))
        .filter((session) => session.assignedTo === user.name || session.createdBy === user.name)
        .slice(0, 6)
        .forEach((session) => {
          const title = session.status === 'Recount Required'
            ? 'Stock recount required'
            : session.status === 'Under Review'
              ? 'Stock count under review'
              : session.status === 'Submitted'
                ? 'Stock Count Submitted'
                : session.status === 'Approved'
                  ? 'Stock count approved'
                  : 'Stock Count In Progress'

          push(
            `stock-taking-${session.id}`,
            title,
            `${session.sessionRef} at ${session.store} requires stock-control attention.`,
            session.status === 'Recount Required' || session.status === 'Under Review' ? 'warning' : 'info',
            '/stock-taking',
            session.countDate
          )
        })
      lowStock.slice(0, 6).forEach((item) => {
        push(
          `lowstock-${item.id}-${item.qtyOnHand}-${item.reorderLevel}`,
          'Reorder Watch',
          `${item.name} (${item.qtyOnHand} ${item.unit}) at ${item.store}`,
          'warning',
          '/stock-cards',
          null,
          { conditionAlert: true }
        )
      })
      pushExpiryAlerts()
      break

    case ROLES.DEPT_HEAD:
      reqs
        .filter((r) => [STATUS.PENDING, 'Submitted'].includes(r.status) && r.department === userDept && r.requestedBy !== user.name)
        .slice(0, 6)
        .forEach((r) => {
          push(
            `dept-approve-${r.id}`,
            'Department Approval',
            `${r.srRef} from ${r.requestedBy} needs your approval`,
            'warning',
            '/requisitions',
            r.date
          )
        })
      reqs
        .filter((r) => r.requestedBy === user.name && [STATUS.APPROVED, 'Partially Approved'].includes(r.status))
        .slice(0, 4)
        .forEach((r) => {
          push(
            `dept-approved-${r.id}`,
            'Requisition Approved',
            `${r.srRef} approved — awaiting store issue`,
            'success',
            '/requisitions',
            r.date
          )
        })
      break

    case ROLES.ACCOUNTANT:
      if (lowStock.length > 0) {
        push(
          'accountant-reorder-risk',
          'Inventory at Reorder Risk',
          `${lowStock.length} item(s) at or below reorder level — review valuation impact`,
          'warning',
          '/reports',
          null
        )
      }
      push(
        'accountant-fifo',
        'FIFO Valuation Available',
        'Run the FIFO inventory valuation report for financial records',
        'info',
        '/reports',
        null
      )
      break

    case ROLES.SECURITY:
      pendingGateIn.slice(0, 6).forEach((g) => {
        push(
          `gate-in-${g.id}`,
          'Incoming Delivery',
          `${g.grnRef} from ${g.supplier} — verify at gate`,
          'info',
          '/gate-pass',
          g.receivedDate
        )
      })
      break

    default:
      break
  }

  // Store-scoped filter for store head
  if (user.role === ROLES.STORE_HEAD && userStore) {
    return notes.filter((n) => {
      if (n.id.startsWith('lowstock-')) {
        const item = items.find((i) => n.id.startsWith(`lowstock-${i.id}-`))
        return item?.store === userStore
      }
      if (n.id.startsWith('grn-')) {
        const grn = grns.find((g) => `grn-${g.id}` === n.id)
        return grn?.store === userStore
      }
      return true
    })
  }

  return notes.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp))
}
