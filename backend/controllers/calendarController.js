const db = require('../config/db');

/**
 * Get leave calendar events
 */
async function getCalendarEvents(req, res) {
    try {
        const { month, year, department, employeeId, leaveTypeId, status } = req.query;

        let sql = `
            SELECT r.id, r.employee_id, r.start_date, r.end_date, r.days, r.status, r.reason,
                   lt.name AS leave_type_name, lt.code AS leave_type_code,
                   e.full_name AS employee_name, e.department, e.designation
            FROM leave_requests r
            JOIN leave_types lt ON r.leave_type_id = lt.id
            JOIN employees e ON r.employee_id = e.employee_id
            WHERE 1=1
        `;
        const params = [];

        // If employee role, can view all department leaves or approved leaves in calendar to avoid overlap
        if (department) {
            sql += ` AND e.department = ?`;
            params.push(department);
        }

        if (employeeId) {
            sql += ` AND r.employee_id = ?`;
            params.push(employeeId);
        }

        if (leaveTypeId) {
            sql += ` AND r.leave_type_id = ?`;
            params.push(Number(leaveTypeId));
        }

        if (status) {
            sql += ` AND r.status = ?`;
            params.push(status);
        } else {
            // By default show Approved and Pending
            sql += ` AND r.status IN ('Approved', 'Pending')`;
        }

        if (year && month) {
            const formattedMonth = month.toString().padStart(2, '0');
            const startMonth = `${year}-${formattedMonth}-01`;
            const endMonth = `${year}-${formattedMonth}-31`;
            sql += ` AND (r.start_date <= ? AND r.end_date >= ?)`;
            params.push(endMonth, startMonth);
        }

        sql += ` ORDER BY r.start_date ASC`;

        const events = await db.query(sql, params);

        return res.json({
            success: true,
            totalEvents: events.length,
            events
        });
    } catch (err) {
        console.error('getCalendarEvents error:', err);
        return res.status(500).json({ success: false, message: 'Failed to retrieve calendar events.' });
    }
}

module.exports = {
    getCalendarEvents
};
