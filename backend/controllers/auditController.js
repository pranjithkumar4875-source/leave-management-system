const db = require('../config/db');

/**
 * Get system audit logs (Admin only)
 */
async function getAuditLogs(req, res) {
    try {
        const { action, employeeId, limit = 100 } = req.query;

        let sql = `SELECT * FROM audit_logs WHERE 1=1`;
        const params = [];

        if (action) {
            sql += ` AND action LIKE ?`;
            params.push(`%${action}%`);
        }

        if (employeeId) {
            sql += ` AND employee_id = ?`;
            params.push(employeeId);
        }

        sql += ` ORDER BY id DESC LIMIT ?`;
        params.push(Number(limit));

        const logs = await db.query(sql, params);

        return res.json({
            success: true,
            total: logs.length,
            logs
        });
    } catch (err) {
        console.error('getAuditLogs error:', err);
        return res.status(500).json({ success: false, message: 'Failed to retrieve audit logs.' });
    }
}

module.exports = {
    getAuditLogs
};
