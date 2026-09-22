import { useState } from 'react'
import { KeyRound } from 'lucide-react'
import CrudPage from '../../components/crud/CrudPage'
import StatusBadge from '../../components/ui/StatusBadge'
import Modal from '../../components/ui/Modal'
import Button from '../../components/ui/Button'
import { userService } from '../../services'
import { ALL_ROLES } from '../../utils/constants'
import { useToast } from '../../context/ToastContext'

export default function UserList() {
  const { push } = useToast()
  const [target, setTarget] = useState(null)
  const [temporaryPassword, setTemporaryPassword] = useState('')
  const [loading, setLoading] = useState(false)

  async function resetPassword() {
    setLoading(true)
    try {
      const result = await userService.resetPassword(target.id)
      setTemporaryPassword(result.temporaryPassword)
      push('Temporary password generated. It is shown only once.', 'success')
    } catch (err) {
      push(err.message || 'Could not reset the user password.', 'error')
      setTarget(null)
    } finally {
      setLoading(false)
    }
  }

  return (
    <>
      <CrudPage
        title="Users"
        subtitle="Create accounts and assign roles that drive access across the system."
        service={userService}
        addLabel="Add User"
        entityType="users"
        searchKeys={['name', 'username', 'role', 'email']}
        emptyTitle="No users yet"
        emptyMessage="Add the first user account."
        extraRowActions={(row) => (
          <button
            type="button"
            onClick={() => { setTarget(row); setTemporaryPassword('') }}
            className="rounded-md p-1.5 text-ink-500 hover:bg-ink-100 hover:text-brand-600 transition-colors"
            title="Reset Password"
          >
            <KeyRound size={15} />
          </button>
        )}
        columns={[
          { key: 'name', header: 'Full Name' },
          { key: 'username', header: 'Username' },
          { key: 'role', header: 'Role' },
          { key: 'email', header: 'Email' },
          {
            key: 'active',
            header: 'Status',
            render: (row) => <StatusBadge status={row.active ? 'Approved' : 'Cancelled'} />
          }
        ]}
        fields={[
          { name: 'name', label: 'Full Name', required: true, placeholder: 'e.g. Abel Tesfaye' },
          { name: 'username', label: 'Username', required: true, placeholder: 'e.g. abel.tesfaye' },
          { name: 'email', label: 'Email', type: 'email', required: true, placeholder: 'e.g. abel@example.com' },
          { name: 'role', label: 'Role', type: 'select', required: true, options: ALL_ROLES, placeholder: 'Select a role...' },
          { name: 'active', label: 'Active', type: 'checkbox' }
        ]}
      />

      <Modal open={Boolean(target)} onClose={() => !loading && setTarget(null)} title="Reset Password">
        {temporaryPassword ? (
          <div className="space-y-4">
            <p className="text-sm text-ink-700">Give this temporary password to <strong>{target?.name}</strong>. It will be shown only once and must be changed at next login.</p>
            <div className="rounded border border-amber-200 bg-amber-50 px-4 py-3 text-center font-mono text-lg text-amber-900">{temporaryPassword}</div>
            <Button className="w-full justify-center" onClick={() => { setTarget(null); setTemporaryPassword('') }}>Done</Button>
          </div>
        ) : (
          <div className="space-y-4">
            <p className="text-sm text-ink-700">Generate a new temporary password for <strong>{target?.name}</strong>? Existing sessions will be invalidated.</p>
            <div className="flex justify-end gap-3">
              <Button variant="secondary" onClick={() => setTarget(null)}>Cancel</Button>
              <Button loading={loading} onClick={resetPassword}>Reset Password</Button>
            </div>
          </div>
        )}
      </Modal>
    </>
  )
}
