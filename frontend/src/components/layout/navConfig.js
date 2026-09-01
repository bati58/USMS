import {
  LayoutDashboard,
  Warehouse,
  Tags,
  Boxes,
  MapPinned,
  Truck,
  Users,
  PackageCheck,
  ClipboardCheck,
  Archive,
  ScrollText,
  ArrowLeftRight,
  ClipboardList,
  FileText,
  Send,
  Landmark,
  Undo2,
  Repeat,
  Trash2,
  BarChart3,
  ShieldCheck,
  Shield,
  IdCard,
} from 'lucide-react'
import { ROLES } from '../../utils/constants'

// ---------------------------------------------------------------------------
// Sidebar navigation.
//
// Each actor gets the section labels and grouping recommended in
// docs/actorspage.md (§12). This layer is PRESENTATIONAL only — it decides
// how the sidebar is grouped and labelled per role. What a role may actually
// open is still enforced by ProtectedRoute -> canAccessPage() and by the
// backend permission matrix. Every item placed in a role's tree below is one
// that role can already reach, so there are no dead links here.
//
// To add a destination: register it once in NAV_ITEMS, then reference its id
// from each role's tree in ROLE_NAV.
// ---------------------------------------------------------------------------

// Single definition of every nav destination, referenced by id from ROLE_NAV.
const NAV_ITEMS = {
  dashboard: { to: '/', label: 'Dashboard', icon: LayoutDashboard },
  stores: { to: '/stores', label: 'Stores', icon: Warehouse },
  categories: { to: '/categories', label: 'Item Categories', icon: Tags },
  items: { to: '/items', label: 'Items', icon: Boxes },
  locations: { to: '/locations', label: 'Locations', icon: MapPinned },
  suppliers: { to: '/suppliers', label: 'Suppliers', icon: Truck },
  departments: { to: '/departments', label: 'Departments', icon: Users },
  goodsReceipt: { to: '/goods-receipt', label: 'Goods Receipt', icon: PackageCheck },
  evaluation: { to: '/goods-receipt/evaluation', label: 'Technical Evaluation', icon: ClipboardCheck },
  grnDocuments: { to: '/grn-documents', label: 'GRN Documents', icon: FileText },
  stockCards: { to: '/stock-cards', label: 'Stock Cards', icon: Archive },
  binCards: { to: '/bin-cards', label: 'Bin Cards', icon: ScrollText },
  stockTransfer: { to: '/stock-transfer', label: 'Bin Transfers', icon: ArrowLeftRight },
  requisitions: { to: '/requisitions', label: 'Store Requisitions', icon: ClipboardList },
  issueVouchers: { to: '/issue-vouchers', label: 'Issue Vouchers', icon: Send },
  gatePass: { to: '/gate-pass', label: 'Gate Pass Verification', icon: Shield },
  materialReturn: { to: '/material-return', label: 'Material Returns', icon: Undo2 },
  materialTransfer: { to: '/material-transfer', label: 'Material Transfers', icon: Repeat },
  stockTaking: { to: '/stock-taking', label: 'Stock Taking', icon: ClipboardCheck },
  reconciliation: { to: '/reconciliation', label: 'Reconciliation Report', icon: BarChart3 },
  fixedAssets: { to: '/fixed-assets', label: 'Fixed Assets', icon: Landmark },
  userCards: { to: '/user-cards', label: 'User Material Cards', icon: IdCard },
  disposal: { to: '/disposal', label: 'Disposal Management', icon: Trash2 },
  users: { to: '/users', label: 'Users', icon: Users },
  businessRules: { to: '/settings/business-rules', label: 'Business Rules', icon: ShieldCheck },
  reports: { to: '/reports', label: 'Reports', icon: BarChart3 },
  auditLog: { to: '/audit-log', label: 'Audit Log', icon: ShieldCheck },
}

// Per-role sidebar tree: ordered [section label, [item ids]]. Mirrors §12.
const ROLE_NAV = {
  [ROLES.ADMIN]: [
    ['Overview', ['dashboard']],
    ['System Administration', ['users', 'businessRules']],
    ['Master Data', ['stores', 'categories', 'items', 'locations', 'suppliers', 'departments']],
    ['Operational Monitoring', ['goodsReceipt', 'evaluation', 'grnDocuments', 'stockCards', 'binCards', 'stockTransfer', 'requisitions', 'issueVouchers', 'materialReturn', 'materialTransfer', 'stockTaking', 'reconciliation', 'fixedAssets', 'userCards', 'disposal', 'gatePass']],
    ['Reports & Audit', ['reports', 'auditLog']],
  ],

  [ROLES.PAO]: [
    ['Overview', ['dashboard']],
    ['Inventory Governance', ['stores', 'categories', 'items', 'locations', 'suppliers', 'departments']],
    ['Receiving & Registration', ['goodsReceipt', 'evaluation', 'grnDocuments']],
    ['Stock Control', ['stockCards', 'binCards', 'stockTransfer', 'stockTaking', 'reconciliation']],
    ['Requisitions & Issues', ['requisitions', 'issueVouchers']],
    ['Returns & Transfers', ['materialReturn', 'materialTransfer']],
    ['Assets & Disposal', ['fixedAssets', 'userCards', 'disposal']],
    ['Reports & Audit', ['reports', 'auditLog']],
  ],

  [ROLES.STORE_HEAD]: [
    ['Overview', ['dashboard']],
    ['Store Management', ['stores', 'categories', 'items', 'locations', 'suppliers']],
    ['Receiving', ['goodsReceipt', 'evaluation', 'grnDocuments']],
    ['Stock', ['stockCards', 'binCards', 'stockTransfer']],
    ['Requisitions & Issues', ['requisitions', 'issueVouchers']],
    ['Returns & Transfers', ['materialReturn', 'materialTransfer']],
    ['Stock Control', ['stockTaking', 'reconciliation']],
    ['Assets', ['userCards']],
    ['Reports', ['reports']],
  ],

  [ROLES.STOREKEEPER]: [
    ['Overview', ['dashboard']],
    ['Inventory', ['items', 'locations']],
    ['Receiving', ['goodsReceipt', 'grnDocuments']],
    ['Stock', ['stockCards', 'binCards', 'stockTransfer']],
    ['Issues', ['requisitions', 'issueVouchers']],
    ['Returns', ['materialReturn']],
    ['Transfers', ['materialTransfer']],
    ['Stock Control', ['stockTaking']],
    ['Assets', ['userCards']],
    ['Reports', ['reports']],
  ],

  [ROLES.STOCK_CLERK]: [
    ['Overview', ['dashboard']],
    ['Inventory', ['items', 'locations']],
    ['Stock Records', ['stockCards', 'binCards']],
    ['Stock Control', ['stockTaking', 'reconciliation']],
    ['Reports', ['reports']],
  ],

  [ROLES.DEPT_HEAD]: [
    ['Overview', ['dashboard']],
    ['Requisitions', ['requisitions']],
    ['Returns', ['materialReturn']],
    ['Transfers', ['materialTransfer']],
    ['User Materials', ['userCards']],
    ['Reports', ['reports']],
  ],

  [ROLES.TEC]: [
    ['Overview', ['dashboard']],
    ['Material Evaluation', ['evaluation']],
    ['Documents', ['grnDocuments']],
    ['Reports', ['reports']],
  ],

  [ROLES.ACCOUNTANT]: [
    ['Overview', ['dashboard']],
    ['Financial Inventory', ['goodsReceipt', 'issueVouchers', 'materialReturn', 'materialTransfer']],
    ['Reconciliation', ['reconciliation']],
    ['Reports & Audit', ['reports', 'auditLog']],
  ],

  [ROLES.SECURITY]: [
    ['Overview', ['dashboard']],
    ['Campus Movement', ['gatePass']],
    ['Reports & Audit', ['reports', 'auditLog']],
  ],
}

/**
 * Resolve the sidebar sections for a role into the shape the Sidebar renders:
 * [{ label, items: [{ to, label, icon }] }]. Unknown item ids are skipped and
 * empty sections dropped, so the tree is always safe to render.
 */
export function getNavSections(role) {
  const tree = ROLE_NAV[role]
  if (!tree) return []
  return tree
    .map(([label, ids]) => ({
      label,
      items: ids.map((id) => NAV_ITEMS[id]).filter(Boolean),
    }))
    .filter((section) => section.items.length > 0)
}
