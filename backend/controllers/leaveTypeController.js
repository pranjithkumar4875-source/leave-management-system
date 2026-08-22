const db = require('../config/db');
const { logAudit } = require('../utils/auditLogger');

/**
 * Get all leave types
 */
async function getAllLeaveTypes(req, res) {
    try {
        const types = await db.query('SELECT * FROM leave_types ORDER BY id ASC');
        return res.json({ success: true, leaveTypes: types });
    } catch (err) {
        console.error('getAllLeaveTypes error:', err);
        return res.status(500).json({ success: false, message: 'Failed to retrieve leave types.' });
    }
}

/**
 * Add a new leave type
 */
async function createLeaveType(req, res) {
    try {
        const { name, code, maxDays, description, isActive = 1 } = req.body;

        if (!name || !code || !maxDays) {
            return res.status(400).json({ success: false, message: 'Name, code, and max days are required.' });
        }

        const existing = await db.query('SELECT * FROM leave_types WHERE name = ? OR code = ?', [name.trim(), code.trim()]);
        if (existing && existing.length > 0) {
            return res.status(400).json({ success: false, message: 'A leave type with this name or code already exists.' });
        }

        const result = await db.query(
            `INSERT INTO leave_types (name, code, max_days, description, is_active)
             VALUES (?, ?, ?, ?, ?)`,
            [name.trim(), code.trim().toUpperCase(), Number(maxDays), description || '', isActive ? 1 : 0]
        );

        const newTypeId = result.insertId;

        // Auto-allocate this new leave type balance to all existing employees for current year
        const employees = await db.query('SELECT employee_id FROM employees');
        const year = new Date().getFullYear();
        for (const emp of employees) {
            await db.query(
                `INSERT INTO leave_balances (employee_id, leave_type_id, total_days, used_days, available_days, year)
                 VALUES (?, ?, ?, 0, ?, ?)`,
                [emp.employee_id, newTypeId, Number(maxDays), Number(maxDays), year]
            );
        }

        await logAudit({
            userId: req.user.userId,
            employeeId: req.user.employeeId,
            userName: req.user.fullName,
            role: req.user.role,
            action: 'Leave type created',
            details: `Created new leave category: ${name} (${code}) with ${maxDays} days`,
            req
        });

        return res.status(201).json({ success: true, message: 'Leave type created successfully.', id: newTypeId });
    } catch (err) {
        console.error('createLeaveType error:', err);
        return res.status(500).json({ success: false, message: 'Failed to create leave type.' });
    }
}

/**
 * Update leave type
 */
async function updateLeaveType(req, res) {
    try {
        const id = req.params.id;
        const { name, code, maxDays, description, isActive } = req.body;

        const types = await db.query('SELECT * FROM leave_types WHERE id = ?', [id]);
        if (!types || types.length === 0) {
            return res.status(404).json({ success: false, message: 'Leave type not found.' });
        }

        const current = types[0];
        const updatedName = name !== undefined ? name.trim() : current.name;
        const updatedCode = code !== undefined ? code.trim().toUpperCase() : current.code;
        const updatedMaxDays = maxDays !== undefined ? Number(maxDays) : current.max_days;
        const updatedDesc = description !== undefined ? description : current.description;
        const updatedActive = isActive !== undefined ? (isActive ? 1 : 0) : current.is_active;

        await db.query(
            `UPDATE leave_types
             SET name = ?, code = ?, max_days = ?, description = ?, is_active = ?
             WHERE id = ?`,
            [updatedName, updatedCode, updatedMaxDays, updatedDesc, updatedActive, id]
        );

        await logAudit({
            userId: req.user.userId,
            employeeId: req.user.employeeId,
            userName: req.user.fullName,
            role: req.user.role,
            action: 'Leave type updated',
            details: `Updated leave type #${id} (${updatedName})`,
            req
        });

        return res.json({ success: true, message: 'Leave type updated successfully.' });
    } catch (err) {
        console.error('updateLeaveType error:', err);
        return res.status(500).json({ success: false, message: 'Failed to update leave type.' });
    }
}

/**
 * Delete leave type
 */
async function deleteLeaveType(req, res) {
    try {
        const id = req.params.id;

        const types = await db.query('SELECT * FROM leave_types WHERE id = ?', [id]);
        if (!types || types.length === 0) {
            return res.status(404).json({ success: false, message: 'Leave type not found.' });
        }

        // Check if there are active leave requests with this type
        const requests = await db.query('SELECT id FROM leave_requests WHERE leave_type_id = ? LIMIT 1', [id]);
        if (requests && requests.length > 0) {
            // Soft delete / disable instead of hard delete to preserve referential integrity
            await db.query('UPDATE leave_types SET is_active = 0 WHERE id = ?', [id]);
            return res.json({ success: true, message: 'Leave type is used in historical requests; it has been disabled instead of removed.' });
        }

        await db.query('DELETE FROM leave_balances WHERE leave_type_id = ?', [id]);
        await db.query('DELETE FROM leave_types WHERE id = ?', [id]);

        await logAudit({
            userId: req.user.userId,
            employeeId: req.user.employeeId,
            userName: req.user.fullName,
            role: req.user.role,
            action: 'Leave type deleted',
            details: `Deleted leave type #${id} (${types[0].name})`,
            req
        });

        return res.json({ success: true, message: 'Leave type deleted successfully.' });
    } catch (err) {
        console.error('deleteLeaveType error:', err);
        return res.status(500).json({ success: false, message: 'Failed to delete leave type.' });
    }
}

module.exports = {
    getAllLeaveTypes,
    createLeaveType,
    updateLeaveType,
    deleteLeaveType
};
