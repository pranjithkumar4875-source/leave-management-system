const db = require('../config/db');

/**
 * Generate Reports with multiple aggregations & filter criteria
 */
async function getReports(req, res) {
    try {
        const { reportType = 'monthly', startDate, endDate, department, employeeId, leaveTypeId } = req.query;

        // Fetch all leave requests matching base date/department filter
        let sql = `
            SELECT r.*,
                   lt.name AS leave_type_name, lt.code AS leave_type_code,
                   e.full_name AS employee_name, e.department, e.designation, e.email AS employee_email
            FROM leave_requests r
            JOIN leave_types lt ON r.leave_type_id = lt.id
            JOIN employees e ON r.employee_id = e.employee_id
            WHERE 1=1
        `;
        const params = [];

        if (startDate) {
            sql += ` AND r.start_date >= ?`;
            params.push(startDate);
        }

        if (endDate) {
            sql += ` AND r.end_date <= ?`;
            params.push(endDate);
        }

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

        sql += ` ORDER BY r.start_date DESC`;

        const leaves = await db.query(sql, params);

        // 1. Monthly Report Breakdown
        const monthlyMap = {};
        leaves.forEach(l => {
            const month = l.start_date.substring(0, 7); // YYYY-MM
            if (!monthlyMap[month]) {
                monthlyMap[month] = { month, totalRequests: 0, totalDays: 0, approved: 0, pending: 0, rejected: 0 };
            }
            monthlyMap[month].totalRequests++;
            monthlyMap[month].totalDays += (l.days || 0);
            if (l.status === 'Approved') monthlyMap[month].approved++;
            else if (l.status === 'Pending') monthlyMap[month].pending++;
            else if (l.status === 'Rejected') monthlyMap[month].rejected++;
        });

        // 2. Department Breakdown
        const departmentMap = {};
        leaves.forEach(l => {
            const dept = l.department || 'General';
            if (!departmentMap[dept]) {
                departmentMap[dept] = { department: dept, totalRequests: 0, totalDays: 0, approved: 0, rejected: 0 };
            }
            departmentMap[dept].totalRequests++;
            if (l.status === 'Approved') {
                departmentMap[dept].totalDays += (l.days || 0);
                departmentMap[dept].approved++;
            } else if (l.status === 'Rejected') {
                departmentMap[dept].rejected++;
            }
        });

        // 3. Leave Type Breakdown
        const leaveTypeMap = {};
        leaves.forEach(l => {
            const typeName = l.leave_type_name;
            if (!leaveTypeMap[typeName]) {
                leaveTypeMap[typeName] = { leaveType: typeName, count: 0, days: 0 };
            }
            leaveTypeMap[typeName].count++;
            if (l.status === 'Approved') {
                leaveTypeMap[typeName].days += (l.days || 0);
            }
        });

        // 4. Employee Summary
        const employeeMap = {};
        leaves.forEach(l => {
            const empId = l.employee_id;
            if (!employeeMap[empId]) {
                employeeMap[empId] = {
                    employeeId: empId,
                    name: l.employee_name,
                    department: l.department,
                    totalRequests: 0,
                    approvedDays: 0,
                    pendingRequests: 0
                };
            }
            employeeMap[empId].totalRequests++;
            if (l.status === 'Approved') employeeMap[empId].approvedDays += (l.days || 0);
            if (l.status === 'Pending') employeeMap[empId].pendingRequests++;
        });

        // 5. Status distribution
        const statusSummary = {
            total: leaves.length,
            approved: leaves.filter(l => l.status === 'Approved').length,
            pending: leaves.filter(l => l.status === 'Pending').length,
            rejected: leaves.filter(l => l.status === 'Rejected').length,
            cancelled: leaves.filter(l => l.status === 'Cancelled').length
        };

        return res.json({
            success: true,
            reportType,
            filters: { startDate, endDate, department, employeeId, leaveTypeId },
            statusSummary,
            monthly: Object.values(monthlyMap),
            departments: Object.values(departmentMap),
            leaveTypes: Object.values(leaveTypeMap),
            employees: Object.values(employeeMap),
            records: leaves
        });
    } catch (err) {
        console.error('getReports error:', err);
        return res.status(500).json({ success: false, message: 'Failed to generate report.' });
    }
}

module.exports = {
    getReports
};
