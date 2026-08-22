const db = require('../config/db');
const { formatDate } = require('../utils/dateHelper');

/**
 * Get aggregated dashboard metrics tailored for Employee, HR, or Admin
 */
async function getDashboardStats(req, res) {
    try {
        const role = req.user.role;
        const employeeId = req.user.employeeId;
        const today = new Date().toISOString().substring(0, 10);
        const year = new Date().getFullYear();

        if (role === 'employee') {
            // Employee specific statistics
            const balances = await db.query(
                `SELECT b.*, lt.name AS leave_type_name, lt.code AS leave_type_code
                 FROM leave_balances b
                 JOIN leave_types lt ON b.leave_type_id = lt.id
                 WHERE b.employee_id = ? AND b.year = ?`,
                [employeeId, year]
            );

            const allEmployeeLeaves = await db.query(
                `SELECT r.*, lt.name AS leave_type_name
                 FROM leave_requests r
                 JOIN leave_types lt ON r.leave_type_id = lt.id
                 WHERE r.employee_id = ?
                 ORDER BY r.id DESC`,
                [employeeId]
            );

            const totalLeave = balances.reduce((sum, b) => sum + (b.total_days || 0), 0);
            const usedLeave = balances.reduce((sum, b) => sum + (b.used_days || 0), 0);
            const availableLeave = balances.reduce((sum, b) => sum + (b.available_days || 0), 0);

            const pendingRequests = allEmployeeLeaves.filter(r => r.status === 'Pending').length;
            const approvedRequests = allEmployeeLeaves.filter(r => r.status === 'Approved').length;
            const rejectedRequests = allEmployeeLeaves.filter(r => r.status === 'Rejected').length;

            const recentRequests = allEmployeeLeaves.slice(0, 5);

            const notifications = await db.query(
                `SELECT * FROM notifications
                 WHERE employee_id = ? OR employee_id IS NULL
                 ORDER BY id DESC LIMIT 5`,
                [employeeId]
            );

            return res.json({
                success: true,
                role: 'employee',
                employee: {
                    employeeId,
                    name: req.user.fullName,
                    email: req.user.email
                },
                stats: {
                    totalLeave,
                    usedLeave,
                    availableLeave,
                    pendingRequests,
                    approvedRequests,
                    rejectedRequests
                },
                leaveBalances: balances,
                recentRequests,
                notifications
            });
        }

        // Admin and HR Dashboard Metrics
        const employees = await db.query("SELECT * FROM employees WHERE status = 'active'");
        const allLeaves = await db.query(
            `SELECT r.*, lt.name AS leave_type_name, e.full_name, e.department
             FROM leave_requests r
             JOIN leave_types lt ON r.leave_type_id = lt.id
             JOIN employees e ON r.employee_id = e.employee_id
             ORDER BY r.id DESC`
        );

        const totalEmployees = employees.length;
        const pendingRequests = allLeaves.filter(r => r.status === 'Pending').length;
        const approvedRequests = allLeaves.filter(r => r.status === 'Approved').length;
        const rejectedRequests = allLeaves.filter(r => r.status === 'Rejected').length;

        // Employees on leave today
        const onLeaveToday = allLeaves.filter(
            r => r.status === 'Approved' && formatDate(r.start_date) <= today && formatDate(r.end_date) >= today
        );

        // Department-wise Leave Usage
        const deptUsageMap = {};
        allLeaves.forEach(l => {
            if (l.status === 'Approved') {
                const dept = l.department || 'General';
                deptUsageMap[dept] = (deptUsageMap[dept] || 0) + (l.days || 0);
            }
        });

        // Monthly Leave Chart Data (last 6 months)
        const monthCounts = {};
        const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
        for (let i = 0; i < 12; i++) {
            monthCounts[months[i]] = 0;
        }

        allLeaves.forEach(l => {
            if (l.status === 'Approved' && l.start_date) {
                const mIdx = new Date(l.start_date).getMonth();
                const mName = months[mIdx];
                monthCounts[mName] = (monthCounts[mName] || 0) + (l.days || 0);
            }
        });

        const recentRequests = allLeaves.slice(0, 6);

        return res.json({
            success: true,
            role,
            stats: {
                totalEmployees,
                pendingRequests,
                approvedRequests,
                rejectedRequests,
                employeesOnLeaveToday: onLeaveToday.length
            },
            onLeaveTodayList: onLeaveToday,
            recentRequests,
            departmentUsage: deptUsageMap,
            monthlyChart: monthCounts
        });
    } catch (err) {
        console.error('getDashboardStats error:', err);
        return res.status(500).json({ success: false, message: 'Failed to retrieve dashboard statistics.' });
    }
}

module.exports = {
    getDashboardStats
};
