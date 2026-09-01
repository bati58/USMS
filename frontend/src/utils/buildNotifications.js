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
  const pendingReqs = reqs.filter((r) => [STATUS.PENDING, 'Submitted', 'Returned for Correction'].includes(r.status))
  const pendingGrns = grns.filter((g) => [
    STATUS.PENDING,
    'Submitted',
    'Pending Evaluation',
    STATUS.UNDER_EVALUATION
  ].includes(g.status))
  const pendingDisposals = disposals.filter((d) => [STATUS.PENDING, STATUS.APPROVED].includes(d.status))
  const pendingTransfers = transfers.filter((t) => ![STATUS.COMPLETED, STATUS.CANCELLED, STATUS.REJECTED].includes(t.status))
  const pendingReturns = returns.filter((r) => [STATUS.SUBMITTED, STATUS.PENDING, STATUS.UNDER_EVALUATION].includes(r.status))
  const approvedAwaitingIssue = reqs.filter((r) => r.status === STATUS.APPROVED)
  const pendingGateIn = grns.filter((g) => !g.gateVerified && ['Submitted', 'Pending Evaluation', 'Under Evaluation', 'Accepted', 'Partially Accepted', 'Rejected', 'GRN Generated', 'Posted'].includes(g.status))

  function push(id, title, message, type, route, timestamp) {
    notes.push({ id, title, message, type, route, timestamp: timestamp || new Date(), read: false })
  }

  switch (user.role) {
    case ROLES.ADMIN:
      lowStock.slice(0, 5).forEach((item) => {
        push(
          `lowstock-${item.id}`,
          'Low Stock Alert',
          `${item.name} at ${item.store} is at ${item.qtyOnHand} ${item.unit} (reorder: ${item.reorderLevel})`,
          'warning',
          '/items',
          item.updatedAt
        )
      })
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
            `lowstock-${item.id}`,
            'Low Stock Alert',
            `${item.name} at ${item.store} is at ${item.qtyOnHand} ${item.unit} (reorder: ${item.reorderLevel})`,
            'warning',
            '/items',
            item.updatedAt
          )
        })

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

      pendingReqs
        .filter((r) => !userStore || r.store === userStore)
        .slice(0, 6)
        .forEach((r) => {
          push(
            `req-${r.id}`,
            'Approval Required',
            `${r.srRef} from ${r.department} needs store review`,
            'warning',
            '/requisitions',
            r.date
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

    case ROLES.PAO:
      pendingReqs.slice(0, 8).forEach((r) => {
        push(
          `req-${r.id}`,
          'Approval Required',
          `${r.srRef} from ${r.department} needs your approval`,
          'warning',
          '/requisitions',
          r.date
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

    case ROLES.STOREKEEPER:
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
        .filter((t) => !userStore || t.fromStore === userStore || t.toStore === userStore)
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
      approvedAwaitingIssue.slice(0, 6).forEach((r) => {
        push(
          `issue-${r.id}`,
          'Issue Approved Requisition',
          `${r.srRef} approved — generate issue voucher`,
          'success',
          '/issue-vouchers',
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

    case ROLES.STOCK_CLERK:
      stockTaking
        .filter((s) => ['Draft', 'Submitted', 'Approved'].includes(s.status))
        .slice(0, 6)
        .forEach((session) => {
          push(
            `stock-taking-${session.id}`,
            session.status === 'Draft' ? 'Stock Count In Progress' : session.status === 'Submitted' ? 'Stock Count Submitted' : 'Stock Count Approved',
            `${session.sessionRef} at ${session.store} requires stock-control attention.`,
            session.status === 'Submitted' ? 'warning' : 'info',
            '/stock-taking',
            session.countDate
          )
        })
      lowStock.slice(0, 6).forEach((item) => {
        push(
          `lowstock-${item.id}`,
          'Reorder Watch',
          `${item.name} (${item.qtyOnHand} ${item.unit}) at ${item.store}`,
          'warning',
          '/stock-cards',
          null
        )
      })
      break

    case ROLES.TEC:
      grns.filter((g) => [STATUS.UNDER_EVALUATION, 'Pending Evaluation'].includes(g.status)).slice(0, 6).forEach((g) => {
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
        .filter((r) => r.requestedBy === user.name && r.status === STATUS.APPROVED)
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
        const item = items.find((i) => `lowstock-${i.id}` === n.id)
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
