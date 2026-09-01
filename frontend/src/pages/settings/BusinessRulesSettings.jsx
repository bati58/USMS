import { useState, useEffect } from 'react'
import { useAuth } from '../../context/AuthContext'
import { useToast } from '../../context/ToastContext'
import { businessRulesService } from '../../services'
import Card from '../../components/ui/Card'
import Button from '../../components/ui/Button'
import Badge from '../../components/ui/Badge'
import EmptyState from '../../components/ui/EmptyState'
import { AlertCircle, Save, RotateCcw } from 'lucide-react'

export default function BusinessRulesSettings() {
    const { user } = useAuth()
    const { push } = useToast()

    const [categories, setCategories] = useState([])
    const [selectedCategory, setSelectedCategory] = useState('')
    const [rules, setRules] = useState([])
    const [editingRules, setEditingRules] = useState({})
    const [loading, setLoading] = useState(false)
    const [isSaving, setIsSaving] = useState(false)

    // Only admin can access this page
    useEffect(() => {
        if (user?.role !== 'Administrator') {
            push('You do not have access to business rules configuration', 'error')
            return
        }

        loadCategories()
    }, [user])

    const loadCategories = async () => {
        try {
            setLoading(true)
            const cats = await businessRulesService.getCategories()
            setCategories(cats.categories || [])
            if (cats.categories && cats.categories.length > 0) {
                setSelectedCategory(cats.categories[0])
            }
        } catch (error) {
            push(`Error loading categories: ${error.message}`, 'error')
        } finally {
            setLoading(false)
        }
    }

    useEffect(() => {
        if (selectedCategory) {
            loadRulesByCategory(selectedCategory)
        }
    }, [selectedCategory])

    const loadRulesByCategory = async (category) => {
        try {
            setLoading(true)
            const data = await businessRulesService.getByCategory(category)
            setRules(data.data || [])
            setEditingRules({})
        } catch (error) {
            push(`Error loading rules: ${error.message}`, 'error')
        } finally {
            setLoading(false)
        }
    }

    const handleRuleChange = (ruleId, value) => {
        setEditingRules({
            ...editingRules,
            [ruleId]: value
        })
    }

    const handleSave = async (rule) => {
        if (editingRules[rule.id] === undefined) {
            push('No changes to save', 'info')
            return
        }

        try {
            setIsSaving(true)
            await businessRulesService.updateRule(
                rule.rule_name,
                editingRules[rule.id],
                rule.description
            )
            push(`Rule "${rule.rule_name}" updated successfully`, 'success')
            await loadRulesByCategory(selectedCategory)
        } catch (error) {
            push(`Error saving rule: ${error.message}`, 'error')
        } finally {
            setIsSaving(false)
        }
    }

    const handleReset = (rule) => {
        const newEditing = { ...editingRules }
        delete newEditing[rule.id]
        setEditingRules(newEditing)
    }

    const renderInputField = (rule) => {
        const currentValue = editingRules[rule.id] !== undefined ? editingRules[rule.id] : rule.rule_value
        const hasChanges = editingRules[rule.id] !== undefined

        switch (rule.rule_type) {
            case 'integer':
                return (
                    <div className="flex items-center gap-2">
                        <input
                            type="number"
                            value={currentValue}
                            onChange={(e) => handleRuleChange(rule.id, e.target.value)}
                            className={`flex-1 px-3 py-2 border rounded-lg ${hasChanges ? 'border-yellow-400 bg-yellow-50' : 'border-gray-300'
                                }`}
                            min={rule.min_value}
                            max={rule.max_value}
                        />
                        {rule.min_value && <span className="text-xs text-gray-500">Min: {rule.min_value}</span>}
                        {rule.max_value && <span className="text-xs text-gray-500">Max: {rule.max_value}</span>}
                    </div>
                )

            case 'decimal':
                return (
                    <div className="flex items-center gap-2">
                        <input
                            type="number"
                            step="0.01"
                            value={currentValue}
                            onChange={(e) => handleRuleChange(rule.id, e.target.value)}
                            className={`flex-1 px-3 py-2 border rounded-lg ${hasChanges ? 'border-yellow-400 bg-yellow-50' : 'border-gray-300'
                                }`}
                            min={rule.min_value}
                            max={rule.max_value}
                        />
                        {rule.min_value && <span className="text-xs text-gray-500">Min: {rule.min_value}</span>}
                        {rule.max_value && <span className="text-xs text-gray-500">Max: {rule.max_value}</span>}
                    </div>
                )

            case 'boolean':
                return (
                    <select
                        value={currentValue === 'true' || currentValue === true ? 'true' : 'false'}
                        onChange={(e) => handleRuleChange(rule.id, e.target.value === 'true' ? 'true' : 'false')}
                        className={`flex-1 px-3 py-2 border rounded-lg ${hasChanges ? 'border-yellow-400 bg-yellow-50' : 'border-gray-300'
                            }`}
                    >
                        <option value="true">Enabled</option>
                        <option value="false">Disabled</option>
                    </select>
                )

            case 'enum':
                let allowedValues = []
                try {
                    allowedValues = rule.allowed_values ? JSON.parse(rule.allowed_values) : []
                } catch {
                    allowedValues = []
                }
                return (
                    <select
                        value={currentValue}
                        onChange={(e) => handleRuleChange(rule.id, e.target.value)}
                        className={`flex-1 px-3 py-2 border rounded-lg ${hasChanges ? 'border-yellow-400 bg-yellow-50' : 'border-gray-300'
                            }`}
                    >
                        {allowedValues.map((val) => (
                            <option key={val} value={val}>
                                {val}
                            </option>
                        ))}
                    </select>
                )

            case 'text':
            default:
                return (
                    <input
                        type="text"
                        value={currentValue}
                        onChange={(e) => handleRuleChange(rule.id, e.target.value)}
                        className={`flex-1 px-3 py-2 border rounded-lg ${hasChanges ? 'border-yellow-400 bg-yellow-50' : 'border-gray-300'
                            }`}
                    />
                )
        }
    }

    return (
        <div className="max-w-6xl mx-auto p-6 bg-gray-50 min-h-screen">
            <div className="mb-8">
                <h1 className="text-3xl font-bold text-gray-900">Business Rules Configuration</h1>
                <p className="text-gray-600 mt-2">
                    Configure system-wide business rules and thresholds. Changes take effect immediately.
                </p>
            </div>

            {/* Admin-only warning */}
            {user?.role !== 'Administrator' && (
                <Card className="mb-6 border-red-200 bg-red-50">
                    <div className="flex items-center gap-3">
                        <AlertCircle className="w-5 h-5 text-red-600" />
                        <p className="text-red-700">
                            Only administrators can access this page. Your changes may not be saved.
                        </p>
                    </div>
                </Card>
            )}

            <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
                {/* Category Navigation */}
                <div>
                    <Card>
                        <h2 className="font-semibold text-gray-900 mb-4">Categories</h2>
                        {loading && categories.length === 0 ? (
                            <p className="text-gray-500 text-sm">Loading categories...</p>
                        ) : categories.length === 0 ? (
                            <EmptyState title="No Categories" message="Run the database seed to add the default rule categories." />
                        ) : (
                            <div className="space-y-2">
                                {categories.map((category) => (
                                    <button
                                        key={category}
                                        onClick={() => setSelectedCategory(category)}
                                        className={`w-full text-left px-4 py-2 rounded-lg transition-colors ${selectedCategory === category
                                            ? 'bg-blue-100 text-blue-900 font-semibold'
                                            : 'text-gray-700 hover:bg-gray-100'
                                            }`}
                                    >
                                        {category}
                                    </button>
                                ))}
                            </div>
                        )}
                    </Card>
                </div>

                {/* Rules Display */}
                <div className="lg:col-span-3">
                    {loading && !rules.length ? (
                        <Card>
                            <p className="text-center text-gray-500">Loading rules...</p>
                        </Card>
                    ) : rules.length === 0 ? (
                        <EmptyState
                            title="No Rules"
                            message="No active rules found for this category."
                        />
                    ) : (
                        <div className="space-y-4">
                            {rules.map((rule) => {
                                const hasChanges = editingRules[rule.id] !== undefined
                                return (
                                    <Card
                                        key={rule.id}
                                        className={`${hasChanges ? 'border-yellow-300 bg-yellow-50' : 'border-gray-200'
                                            }`}
                                    >
                                        <div className="space-y-4">
                                            {/* Rule Header */}
                                            <div className="flex items-start justify-between">
                                                <div>
                                                    <h3 className="font-semibold text-gray-900 font-mono text-sm">
                                                        {rule.rule_name}
                                                    </h3>
                                                    <p className="text-gray-600 text-sm mt-1">{rule.description}</p>
                                                </div>
                                                <Badge variant={rule.rule_type === 'enum' ? 'info' : 'secondary'}>
                                                    {rule.rule_type}
                                                </Badge>
                                            </div>

                                            {/* Rule Input */}
                                            <div className="space-y-2">
                                                <label className="text-xs font-semibold text-gray-700 uppercase">
                                                    Current Value
                                                </label>
                                                {renderInputField(rule)}
                                            </div>

                                            {/* Action Buttons */}
                                            {hasChanges && (
                                                <div className="flex gap-2 justify-end pt-2 border-t border-gray-200">
                                                    <Button
                                                        variant="secondary"
                                                        size="sm"
                                                        onClick={() => handleReset(rule)}
                                                        startIcon={<RotateCcw className="w-4 h-4" />}
                                                    >
                                                        Reset
                                                    </Button>
                                                    <Button
                                                        size="sm"
                                                        onClick={() => handleSave(rule)}
                                                        disabled={isSaving}
                                                        startIcon={<Save className="w-4 h-4" />}
                                                    >
                                                        {isSaving ? 'Saving...' : 'Save'}
                                                    </Button>
                                                </div>
                                            )}

                                            {/* Info */}
                                            <div className="text-xs text-gray-500 pt-2 border-t border-gray-200">
                                                Last updated by {rule.updated_by || 'System'} at{' '}
                                                {new Date(rule.updated_at).toLocaleString()}
                                            </div>
                                        </div>
                                    </Card>
                                )
                            })}
                        </div>
                    )}
                </div>
            </div>
        </div>
    )
}
