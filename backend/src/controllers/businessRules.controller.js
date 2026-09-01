const db = require('../config/db');
const asyncHandler = require('../utils/asyncHandler');
const AppError = require('../utils/AppError');
const { logAudit } = require('../utils/audit');

// Get all business rules (for admin configuration)
exports.list = asyncHandler(async (req, res) => {
    const result = await db.query(`
    SELECT 
      id, rule_name, rule_category, rule_value, rule_type, description,
      is_active, min_value, max_value, allowed_values, updated_by, updated_at
    FROM business_rules
    ORDER BY rule_category, rule_name
  `);

    res.json({
        success: true,
        data: result.rows,
        count: result.rows.length
    });
});

// Get rules by category
exports.listByCategory = asyncHandler(async (req, res) => {
    const { category } = req.params;

    const result = await db.query(`
    SELECT 
      id, rule_name, rule_category, rule_value, rule_type, description,
      is_active, min_value, max_value, allowed_values, updated_by, updated_at
    FROM business_rules
    WHERE rule_category = $1 AND is_active = true
    ORDER BY rule_name
  `, [category]);

    res.json({
        success: true,
        category,
        data: result.rows,
        count: result.rows.length
    });
});

// Get single rule value (lightweight, for application logic)
exports.getRule = asyncHandler(async (req, res) => {
    const { ruleName } = req.params;

    const result = await db.query(`
    SELECT rule_value, rule_type, allowed_values
    FROM business_rules
    WHERE rule_name = $1 AND is_active = true
  `, [ruleName]);

    if (result.rows.length === 0) {
        throw new AppError(`Rule not found: ${ruleName}`, 404);
    }

    const rule = result.rows[0];
    let parsedValue = rule.rule_value;

    // Parse value based on type
    if (rule.rule_type === 'integer') {
        parsedValue = parseInt(rule.rule_value, 10);
    } else if (rule.rule_type === 'decimal') {
        parsedValue = parseFloat(rule.rule_value);
    } else if (rule.rule_type === 'boolean') {
        parsedValue = rule.rule_value === 'true';
    } else if (rule.rule_type === 'enum') {
        parsedValue = rule.rule_value;
    }

    res.json({
        success: true,
        ruleName,
        value: parsedValue,
        type: rule.rule_type
    });
});

// Update business rule (admin only)
exports.updateRule = asyncHandler(async (req, res) => {
    const { ruleName } = req.params;
    const { ruleValue, description } = req.body;

    if (!ruleValue && ruleValue !== '0' && ruleValue !== 'false') {
        throw new AppError('Rule value is required', 400);
    }

    // Get current rule first for audit
    const currentResult = await db.query(`
    SELECT * FROM business_rules WHERE rule_name = $1
  `, [ruleName]);

    if (currentResult.rows.length === 0) {
        throw new AppError(`Rule not found: ${ruleName}`, 404);
    }

    const currentRule = currentResult.rows[0];

    // Validate value against constraints
    if (currentRule.rule_type === 'integer') {
        const intValue = parseInt(ruleValue, 10);
        if (isNaN(intValue)) {
            throw new AppError('Invalid integer value', 400);
        }
        if (currentRule.min_value && intValue < parseInt(currentRule.min_value, 10)) {
            throw new AppError(`Value must be >= ${currentRule.min_value}`, 400);
        }
        if (currentRule.max_value && intValue > parseInt(currentRule.max_value, 10)) {
            throw new AppError(`Value must be <= ${currentRule.max_value}`, 400);
        }
    } else if (currentRule.rule_type === 'decimal') {
        const decValue = parseFloat(ruleValue);
        if (isNaN(decValue)) {
            throw new AppError('Invalid decimal value', 400);
        }
        if (currentRule.min_value && decValue < parseFloat(currentRule.min_value)) {
            throw new AppError(`Value must be >= ${currentRule.min_value}`, 400);
        }
        if (currentRule.max_value && decValue > parseFloat(currentRule.max_value)) {
            throw new AppError(`Value must be <= ${currentRule.max_value}`, 400);
        }
    } else if (currentRule.rule_type === 'enum' && currentRule.allowed_values) {
        const allowedValues = JSON.parse(currentRule.allowed_values);
        if (!allowedValues.includes(ruleValue)) {
            throw new AppError(`Invalid value. Allowed: ${allowedValues.join(', ')}`, 400);
        }
    }

    // Update rule
    const result = await db.query(`
    UPDATE business_rules
    SET rule_value = $1, description = $2, updated_by = $3, updated_at = NOW()
    WHERE rule_name = $4
    RETURNING *
  `, [ruleValue, description || currentRule.description, req.user.username, ruleName]);

    // Audit log
    await logAudit(db.query.bind(db), {
        userId: req.user.id,
        userName: req.user.name,
        userRole: req.user.role,
        action: `Updated business rule ${ruleName}`,
        module: 'Business Rules',
        entityType: 'business_rule',
        entityReference: ruleName,
        beforeData: { value: currentRule.rule_value },
        afterData: { value: ruleValue },
        metadata: { description }
    });

    res.json({
        success: true,
        message: `Rule ${ruleName} updated successfully`,
        data: result.rows[0]
    });
});

// Get all active categories (for frontend)
exports.getCategories = asyncHandler(async (req, res) => {
    const result = await db.query(`
    SELECT DISTINCT rule_category
    FROM business_rules
    WHERE is_active = true
    ORDER BY rule_category
  `);

    res.json({
        success: true,
        categories: result.rows.map(r => r.rule_category)
    });
});

// Get all rules as a lookup object (for caching on application startup)
exports.getAllRulesAsObject = asyncHandler(async (req, res) => {
    const result = await db.query(`
    SELECT rule_name, rule_value, rule_type
    FROM business_rules
    WHERE is_active = true
  `);

    const rulesObject = {};
    result.rows.forEach(row => {
        let value = row.rule_value;
        if (row.rule_type === 'integer') {
            value = parseInt(row.rule_value, 10);
        } else if (row.rule_type === 'decimal') {
            value = parseFloat(row.rule_value);
        } else if (row.rule_type === 'boolean') {
            value = row.rule_value === 'true';
        }
        rulesObject[row.rule_name] = value;
    });

    res.json({
        success: true,
        rules: rulesObject
    });
});
