import { useEffect, useState } from 'react'
import CrudPage from '../../components/crud/CrudPage'
import { fixedAssetService, goodsReceiptService, userService, departmentService } from '../../services'
import { formatCurrency, formatDate } from '../../utils/formatters'

export default function FixedAssetList() {
  const [receipts, setReceipts] = useState([])
  const [custodianOptions, setCustodianOptions] = useState([])

  function toDateInputValue(value) {
    if (!value) return ''
    return String(value).slice(0, 10)
  }

  useEffect(() => {
    goodsReceiptService.list()
      .then((rows) => setReceipts(rows.filter((row) => row.status === 'Posted' && row.type === 'Fixed Asset')))
      .catch(() => setReceipts([]))
    Promise.all([userService.listAssetCustodians(), departmentService.list()])
      .then(([users, departments]) => {
        const userOptions = users
          .filter((user) => user.active !== false)
          .map((user) => ({ value: user.name, label: `${user.name} (${user.role})` }))
        const departmentOptions = departments
          .filter((department) => department.active !== false)
          .map((department) => ({ value: department.name, label: `${department.name} (Office)` }))
        setCustodianOptions([...userOptions, ...departmentOptions])
      })
      .catch(() => setCustodianOptions([]))
  }, [])

  const receiptOptions = receipts.map((receipt) => ({ value: receipt.grnRef, label: `${receipt.grnRef} - ${receipt.supplier} - ${receipt.store}` }))
  const selectedReceipt = (form) => receipts.find((receipt) => receipt.grnRef === form.sourceGrnRef)
  const assetLineOptions = (form) => selectedReceipt(form)?.items?.map((line) => line.item) || []

  return (
    <CrudPage
      title="Fixed Assets"
      subtitle="Register fixed assets from posted Fixed Asset goods receipts and track custody."
      service={fixedAssetService}
      addLabel="Register Asset"
      entityType="fixedAssets"
      searchKeys={['assetTag', 'name', 'category', 'assignedTo']}
      emptyTitle="No fixed assets yet"
      emptyMessage="Register an asset such as a printer or lab instrument."
      initialValues={() => ({ status: 'In Store' })}
      columns={[
        { key: 'assetTag', header: 'Asset Tag' },
        { key: 'name', header: 'Asset Name' },
        { key: 'category', header: 'Category' },
        { key: 'assignedTo', header: 'Assigned To' },
        { key: 'status', header: 'Status' },
        { key: 'acquisitionDate', header: 'Acquired', render: (r) => formatDate(r.acquisitionDate) },
        { key: 'value', header: 'Value', render: (r) => formatCurrency(r.value) }
      ]}
      fields={[
        {
          name: 'sourceGrnRef',
          label: 'Posted Fixed Asset GRN',
          type: 'select',
          required: (form) => !form.id,
          disabled: (form) => Boolean(form.id),
          options: receiptOptions,
          placeholder: receipts.length ? 'Select the posted Fixed Asset GRN...' : 'No posted Fixed Asset GRNs available',
          onChange: (e, { setForm }) => {
            const receipt = receipts.find((row) => row.grnRef === e.target.value)
            const firstLine = receipt?.items?.[0]
            setForm((prev) => ({
              ...prev,
              sourceGrnRef: e.target.value,
              name: firstLine?.item || '',
              store: receipt?.store || '',
              category: firstLine?.category || '',
              acquisitionDate: toDateInputValue(receipt?.receivedDate),
              value: firstLine?.unitPrice || ''
            }))
          }
        },
        { name: 'assetTag', label: 'Asset Tag (optional)', required: false, placeholder: 'Leave blank to generate automatically' },
        {
          name: 'name',
          label: 'Asset Name',
          type: 'select',
          required: true,
          options: assetLineOptions,
          disabled: (form) => !form.sourceGrnRef,
          onChange: (e, { setForm, form }) => {
            const line = selectedReceipt(form)?.items?.find((entry) => entry.item === e.target.value)
            setForm((prev) => ({ ...prev, name: e.target.value, category: line?.category || '', value: line?.unitPrice || prev.value }))
          }
        },
        { name: 'category', label: 'Category', required: false, disabled: true },
        { name: 'store', label: 'Store', required: false, disabled: true },
        {
          name: 'assignedTo',
          label: 'Assigned To (Custodian or Office)',
          type: 'select',
          required: true,
          options: custodianOptions,
          placeholder: custodianOptions.length ? 'Select the responsible custodian...' : 'No custodians available',
          onChange: (e, { setForm }) => {
            setForm((prev) => ({
              ...prev,
              assignedTo: e.target.value,
              status: e.target.value && prev.status === 'In Store' ? 'Assigned' : prev.status
            }))
          }
        },
        { name: 'status', label: 'Status', type: 'select', required: true, options: ['Registered', 'In Store', 'Assigned', 'In Use', 'Maintenance', 'Under Repair', 'Lost', 'Damaged', 'Disposed'] },
        { name: 'acquisitionDate', label: 'Acquisition Date', type: 'date', required: true, disabled: (form) => Boolean(form.sourceGrnRef) },
        { name: 'value', label: 'Value (Birr)', type: 'number', required: true, placeholder: 'e.g. 85000.00', disabled: (form) => Boolean(form.sourceGrnRef) }
      ]}
    />
  )
}
