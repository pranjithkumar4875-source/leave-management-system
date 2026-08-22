const db = require('../config/db');

/**
 * Record an audit log entry in the database
 */
async function logAudit({ userId, employeeId, userName, role, action, details, req }) {
    try {
        let ipAddress = '127.0.0.1';
        let userAgent = 'Unknown Device';

        if (req) {
            ipAddress = req.headers['x-forwarded-for'] || req.socket.remoteAddress || req.ip || '127.0.0.1';
            userAgent = req.headers['user-agent'] || 'Web Browser';
            if (!userId && req.user) userId = req.user.userId;
            if (!employeeId && req.user) employeeId = req.user.employeeId;
            if (!userName && req.user) userName = req.user.fullName || req.user.email;
            if (!role && req.user) role = req.user.role;
        }

        const formattedTime = new Date().toISOString().replace('T', ' ').substring(0, 19);

        await db.query(
            `INSERT INTO audit_logs (user_id, employee_id, user_name, role, action, details, ip_address, user_agent, created_at)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [userId || null, employeeId || null, userName || 'System', role || 'system', action, details || '', ipAddress, userAgent, formattedTime]
        );
    } catch (err) {
        console.error('Failed to write audit log:', err.message);
    }
}

module.exports = {
    logAudit
};
