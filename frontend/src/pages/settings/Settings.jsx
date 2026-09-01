import { useEffect, useState } from 'react'
import { Lock } from 'lucide-react'
import { useAuth } from '../../context/AuthContext'
import { useToast } from '../../context/ToastContext'
import { userService } from '../../services'
import PageHeader from '../../components/ui/PageHeader'
import Card from '../../components/ui/Card'
import Button from '../../components/ui/Button'
import Input from '../../components/ui/Input'

const DEFAULT_SETTINGS = {
    emailNotifications: true,
    pushNotifications: true
}

function prefsKey(userId) {
    return `sms_user_prefs_${userId}`
}

function RestrictedField({ label, value, tooltip }) {
    return (
        <div className="group">
            <label className="mb-2 block text-sm font-medium text-ink-700">{label}</label>
            <div className="relative">
                <Input type="text" value={value || ''} disabled className="pr-10" />
                <div className="pointer-events-none absolute inset-y-0 right-3 flex items-center opacity-0 transition-opacity duration-200 group-hover:opacity-100">
                    <span
                        title={tooltip}
                        className="flex h-7 w-7 items-center justify-center rounded-md border border-ink-200 bg-white text-ink-500 shadow-sm"
                    >
                        <Lock size={14} />
                    </span>
                </div>
            </div>
            <p className="mt-1 text-[11px] text-ink-400 opacity-0 transition-opacity duration-200 group-hover:opacity-100">
                {tooltip}
            </p>
        </div>
    )
}

export default function Settings() {
    const { user, updateUser, logout } = useAuth()
    const { push } = useToast()

    const [profileForm, setProfileForm] = useState({
        name: '',
        email: '',
        phone: ''
    })

    const [settings, setSettings] = useState(DEFAULT_SETTINGS)
    const [savingProfile, setSavingProfile] = useState(false)
    const [savingSettings, setSavingSettings] = useState(false)
    const [changingPassword, setChangingPassword] = useState(false)

    const [passwordForm, setPasswordForm] = useState({
        currentPassword: '',
        newPassword: '',
        confirmPassword: ''
    })

    useEffect(() => {
        if (!user) return
        setProfileForm({
            name: user.name || '',
            email: user.email || '',
            phone: user.phone || ''
        })
    }, [user])

    useEffect(() => {
        if (!user?.id) return
        const saved = localStorage.getItem(prefsKey(user.id))
        if (!saved) {
            setSettings(DEFAULT_SETTINGS)
            return
        }
        try {
            setSettings({ ...DEFAULT_SETTINGS, ...JSON.parse(saved) })
        } catch {
            setSettings(DEFAULT_SETTINGS)
        }
    }, [user?.id])

    const handleProfileChange = (key, value) => {
        setProfileForm((prev) => ({ ...prev, [key]: value }))
    }

    const handleSettingChange = (key, value) => {
        setSettings((prev) => ({
            ...prev,
            [key]: value
        }))
    }

    async function handleSaveProfile() {
        if (!user?.id) return
        if (!profileForm.name.trim()) {
            push('Full name is required', 'error')
            return
        }

        setSavingProfile(true)
        try {
            const updated = await userService.update(user.id, {
                name: profileForm.name.trim(),
                email: profileForm.email.trim(),
                phone: profileForm.phone.trim()
            })
            if (!updated) {
                push('Could not update profile. User record not found.', 'error')
                return
            }
            updateUser(updated)
            push('Account details updated successfully', 'success')
        } catch {
            push('Failed to update profile', 'error')
        } finally {
            setSavingProfile(false)
        }
    }

    function handleSaveSettings() {
        if (!user?.id) return
        setSavingSettings(true)
        try {
            localStorage.setItem(prefsKey(user.id), JSON.stringify(settings))
            push('Settings saved successfully', 'success')
        } catch {
            push('Failed to save settings', 'error')
        } finally {
            setSavingSettings(false)
        }
    }

    async function handlePasswordChange() {
        if (!user?.id) return
        if (!passwordForm.currentPassword) {
            push('Current password is required', 'error')
            return
        }
        if (passwordForm.newPassword !== passwordForm.confirmPassword) {
            push('Passwords do not match', 'error')
            return
        }
        if (passwordForm.newPassword.length < 8) {
            push('Password must be at least 8 characters', 'error')
            return
        }

        const hasStoredPassword = Boolean(user.password)
        if (hasStoredPassword && passwordForm.currentPassword !== user.password) {
            push('Current password is incorrect', 'error')
            return
        }
        if (!hasStoredPassword && passwordForm.currentPassword.length < 4) {
            push('Current password is incorrect', 'error')
            return
        }

        setChangingPassword(true)
        try {
            const updated = await userService.update(user.id, {
                password: passwordForm.newPassword
            })
            if (!updated) {
                push('Could not update password', 'error')
                return
            }
            updateUser(updated)
            setPasswordForm({
                currentPassword: '',
                newPassword: '',
                confirmPassword: ''
            })
            push('Password changed successfully', 'success')
        } catch {
            push('Failed to change password', 'error')
        } finally {
            setChangingPassword(false)
        }
    }

    return (
        <div className="mx-auto max-w-4xl">
            <PageHeader title="Settings" subtitle="Manage your account information and preferences" />

            <Card title="Account Management" className="mb-6">
                <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                    <div>
                        <label className="mb-2 block text-sm font-medium text-ink-700">Full name</label>
                        <Input
                            type="text"
                            value={profileForm.name}
                            onChange={(e) => handleProfileChange('name', e.target.value)}
                        />
                    </div>

                    <RestrictedField label="Username" value={user?.username || ''} tooltip="This value is system-managed and cannot be changed." />

                    <div>
                        <label className="mb-2 block text-sm font-medium text-ink-700">Email address</label>
                        <Input
                            type="email"
                            value={profileForm.email}
                            onChange={(e) => handleProfileChange('email', e.target.value)}
                        />
                    </div>

                    <RestrictedField label="Role" value={user?.role || ''} tooltip="Role assignment is controlled by the system administrator." />

                    <div className="md:col-span-2">
                        <label className="mb-2 block text-sm font-medium text-ink-700">Phone number</label>
                        <Input
                            type="text"
                            value={profileForm.phone}
                            placeholder="e.g. +251 900 000000"
                            onChange={(e) => handleProfileChange('phone', e.target.value)}
                        />
                    </div>
                </div>

                <div className="mt-5 flex flex-wrap items-center gap-3">
                    <Button onClick={handleSaveProfile} variant="primary" loading={savingProfile}>
                        Save profile
                    </Button>
                    <Button onClick={logout} variant="secondary">
                        Sign out
                    </Button>
                </div>
            </Card>

            <Card title="Notifications" className="mb-6">
                <div className="space-y-4">
                    <div className="flex items-center justify-between rounded-lg border border-ink-200 p-4 transition-colors hover:bg-ink-50">
                        <div>
                            <p className="font-medium text-ink-900">Email Notifications</p>
                            <p className="text-sm text-ink-600">Receive updates via email</p>
                        </div>
                        <label className="relative inline-flex cursor-pointer items-center">
                            <input
                                type="checkbox"
                                checked={settings.emailNotifications}
                                onChange={(e) => handleSettingChange('emailNotifications', e.target.checked)}
                                className="peer sr-only"
                            />
                            <div className="peer h-6 w-11 rounded-full bg-ink-300 after:absolute after:left-[2px] after:top-[2px] after:h-5 after:w-5 after:rounded-full after:border after:border-gray-300 after:bg-white after:transition-all after:content-[''] peer-checked:bg-brand-600 peer-checked:after:translate-x-full peer-checked:after:border-white peer-focus:outline-none"></div>
                        </label>
                    </div>

                    <div className="flex items-center justify-between rounded-lg border border-ink-200 p-4 transition-colors hover:bg-ink-50">
                        <div>
                            <p className="font-medium text-ink-900">Push Notifications</p>
                            <p className="text-sm text-ink-600">Receive browser push notifications</p>
                        </div>
                        <label className="relative inline-flex cursor-pointer items-center">
                            <input
                                type="checkbox"
                                checked={settings.pushNotifications}
                                onChange={(e) => handleSettingChange('pushNotifications', e.target.checked)}
                                className="peer sr-only"
                            />
                            <div className="peer h-6 w-11 rounded-full bg-ink-300 after:absolute after:left-[2px] after:top-[2px] after:h-5 after:w-5 after:rounded-full after:border after:border-gray-300 after:bg-white after:transition-all after:content-[''] peer-checked:bg-brand-600 peer-checked:after:translate-x-full peer-checked:after:border-white peer-focus:outline-none"></div>
                        </label>
                    </div>
                </div>

                <div className="mt-6">
                    <Button onClick={handleSaveSettings} variant="primary" loading={savingSettings}>
                        Save notification settings
                    </Button>
                </div>
            </Card>

            <Card title="Security" className="mb-6">
                <div className="space-y-4">
                    <div>
                        <label className="mb-2 block text-sm font-medium text-ink-700">Current Password</label>
                        <Input
                            type="password"
                            placeholder="Enter current password"
                            value={passwordForm.currentPassword}
                            onChange={(e) => setPasswordForm((prev) => ({ ...prev, currentPassword: e.target.value }))}
                        />
                    </div>

                    <div>
                        <label className="mb-2 block text-sm font-medium text-ink-700">New Password</label>
                        <Input
                            type="password"
                            placeholder="Enter new password"
                            value={passwordForm.newPassword}
                            onChange={(e) => setPasswordForm((prev) => ({ ...prev, newPassword: e.target.value }))}
                        />
                        <p className="mt-1 text-xs text-ink-500">Minimum 8 characters required</p>
                    </div>

                    <div>
                        <label className="mb-2 block text-sm font-medium text-ink-700">Confirm Password</label>
                        <Input
                            type="password"
                            placeholder="Confirm new password"
                            value={passwordForm.confirmPassword}
                            onChange={(e) => setPasswordForm((prev) => ({ ...prev, confirmPassword: e.target.value }))}
                        />
                    </div>

                    <Button onClick={handlePasswordChange} variant="primary" loading={changingPassword}>
                        Change Password
                    </Button>
                </div>
            </Card>

            <Card title="About" className="mb-6">
                <div className="space-y-3">
                    <div className="flex justify-between">
                        <span className="text-ink-600">Application</span>
                        <span className="font-medium text-ink-900">Stock Management System</span>
                    </div>
                    <div className="flex justify-between">
                        <span className="text-ink-600">Version</span>
                        <span className="font-medium text-ink-900">1.0.0</span>
                    </div>
                    <div className="flex justify-between">
                        <span className="text-ink-600">Build Date</span>
                        <span className="font-medium text-ink-900">{new Date().toLocaleDateString()}</span>
                    </div>
                </div>
            </Card>
        </div>
    )
}
