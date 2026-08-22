const db = require('../config/db');
const { calculateDays, formatDate } = require('../utils/dateHelper');
const { logAudit } = require('../utils/auditLogger');

/**
 * Submit a new leave request
 */
async function applyLeave(req, res) {
    try {
        const { leaveTypeId, startDate, endDate, reason } = req.body;
        const employeeId = req.user.employeeId;
        const documentPath = req.file ? `/uploads/${req.file.filename}` : (req.body.documentPath || null);

        // 1. Validation
        if (!leaveTypeId || !startDate || !endDate || !reason) {
            return res.status(400).json({ success: false, message: 'Please provide leave type, start date, end date, and reason.' });
        }

        const start = new Date(startDate);
        const end = new Date(endDate);

        if (isNaN(start.getTime()) || isNaN(end.getTime())) {
            return res.status(400).json({ success: false, message: 'Invalid leave dates provided.' });
        }

        if (end < start) {
            return res.status(400).json({ success: false, message: 'End date cannot be earlier than start date.' });
        }

        // Calculate leave days
        const days = calculateDays(startDate, endDate);
        if (days <= 0) {
            return res.status(400).json({ success: false, message: 'Calculated leave duration must be at least 1 day.' });
        }

        // 2. Check Overlapping Requests for this employee (excluding Rejected/Cancelled)
        const allRequests = await db.query(
            `SELECT * FROM leave_requests
             WHERE employee_id = ? AND status IN ('Pending', 'Approved')`,
            [employeeId]
        );

        const isOverlapping = allRequests.some(r => {
            const rStart = formatDate(r.start_date);
            const rEnd = formatDate(r.end_date);
            return (startDate <= rEnd && endDate >= rStart);
        });

        if (isOverlapping) {
            return res.status(400).json({
                success: false,
                message: 'You already have an active or pending leave request overlapping with these dates.'
            });
        }

        // 3. Check Leave Balance
        const currentYear = start.getFullYear();
        const balances = await db.query(
            `SELECT b.*, lt.name AS leave_type_name
             FROM leave_balances b
             JOIN leave_types lt ON b.leave_type_id = lt.id
             WHERE b.employee_id = ? AND b.leave_type_id = ? AND b.year = ?`,
            [employeeId, leaveTypeId, currentYear]
        );

        if (!balances || balances.length === 0) {
            return res.status(400).json({ success: false, message: 'No leave balance allocation found for this leave category.' });
        }

        const balance = balances[0];
        if (balance.available_days < days) {
            return res.status(400).json({
                success: false,
                message: `Leave balance insufficient. Requested: ${days} day(s), Available: ${balance.available_days} day(s).`
            });
        }

        // 4. Create Pending Request
        const result = await db.query(
            `INSERT INTO leave_requests (employee_id, leave_type_id, start_date, end_date, days, reason, document_path, status)
             VALUES (?, ?, ?, ?, ?, ?, ?, 'Pending')`,
            [employeeId, leaveTypeId, startDate, endDate, days, reason, documentPath]
        );

        const requestId = result.insertId || 'REQ' + Date.now();

        // 5. Notify HR & Admin
        const adminsAndHrs = await db.query("SELECT * FROM users WHERE role IN ('admin', 'hr')");
        for (const adminUser of adminsAndHrs) {
            await db.query(
                `INSERT INTO notifications (user_id, employee_id, title, message, type, is_read, link)
                 VALUES (?, ?, 'New Leave Request', ?, 'info', 0, '/hr/hr-leave-requests.html')`,
                [adminUser.id, adminUser.employee_id, `${req.user.fullName || employeeId} applied for ${days} day(s) ${balance.leave_type_name}.`]
            );
        }

        // Notify Employee Confirmation
        await db.query(
            `INSERT INTO notifications (user_id, employee_id, title, message, type, is_read, link)
             VALUES (?, ?, 'Leave Request Submitted', ?, 'info', 0, '/employee/my-leaves.html')`,
            [req.user.userId, employeeId, `Your leave request for ${startDate} to ${endDate} (${days} days) has been submitted for review.`]
        );

        // 6. Audit Log
        await logAudit({
            userId: req.user.userId,
            employeeId,
            userName: req.user.fullName,
            role: req.user.role,
            action: 'Leave request created',
            details: `Applied for ${balance.leave_type_name} (${startDate} to ${endDate}, ${days} days).`,
            req
        });

        return res.status(201).json({
            success: true,
            message: 'Leave request submitted successfully!',
            requestId,
            days
        });
    } catch (err) {
        console.error('applyLeave error:', err);
        return res.status(500).json({ success: false, message: 'Server error submitting leave request.' });
    }
}

/**
 * Get all leave requests with filters
 */
async function getAllLeaves(req, res) {
    try {
        const { status, employeeId, department, leaveTypeId, startDate, endDate, page = 1, limit = 100 } = req.query;

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

        // Role scoping: Employees only view their own
        if (req.user.role === 'employee') {
            sql += ` AND r.employee_id = ?`;
            params.push(req.user.employeeId);
        } else if (employeeId) {
            sql += ` AND r.employee_id = ?`;
            params.push(employeeId);
        }

        if (status) {
            sql += ` AND r.status = ?`;
            params.push(status);
        }

        if (department) {
            sql += ` AND e.department = ?`;
            params.push(department);
        }

        if (leaveTypeId) {
            sql += ` AND r.leave_type_id = ?`;
            params.push(Number(leaveTypeId));
        }

        if (startDate) {
            sql += ` AND r.start_date >= ?`;
            params.push(startDate);
        }

        if (endDate) {
            sql += ` AND r.end_date <= ?`;
            params.push(endDate);
        }

        sql += ` ORDER BY r.id DESC`;

        const leaves = await db.query(sql, params);

        return res.json({
            success: true,
            total: leaves.length,
            leaves
        });
    } catch (err) {
        console.error('getAllLeaves error:', err);
        return res.status(500).json({ success: false, message: 'Failed to retrieve leave requests.' });
    }
}

/**
 * Get leave details by request ID
 */
async function getLeaveById(req, res) {
    try {
        const id = req.params.id;

        const leaves = await db.query(
            `SELECT r.*,
                    lt.name AS leave_type_name, lt.code AS leave_type_code,
                    e.full_name AS employee_name, e.department, e.designation, e.email AS employee_email, e.phone
             FROM leave_requests r
             JOIN leave_types lt ON r.leave_type_id = lt.id
             JOIN employees e ON r.employee_id = e.employee_id
             WHERE r.id = ?`,
            [id]
        );

        if (!leaves || leaves.length === 0) {
            return res.status(404).json({ success: false, message: 'Leave request not found.' });
        }

        const leave = leaves[0];

        // Security check: Employee can only view their own leave details
        if (req.user.role === 'employee' && req.user.employeeId !== leave.employee_id) {
            return res.status(403).json({ success: false, message: 'Unauthorized access to leave request details.' });
        }

        // Get action taker details if approved/rejected
        let actionByName = leave.action_by || 'N/A';
        if (leave.action_by) {
            const approver = await db.query('SELECT full_name FROM employees WHERE employee_id = ?', [leave.action_by]);
            if (approver && approver.length > 0) {
                actionByName = `${approver[0].full_name} (${leave.action_by})`;
            }
        }

        return res.json({
            success: true,
            leave: {
                ...leave,
                actionByName
            }
        });
    } catch (err) {
        console.error('getLeaveById error:', err);
        return res.status(500).json({ success: false, message: 'Failed to retrieve leave details.' });
    }
}

/**
 * Approve leave request (Admin or HR)
 */
async function approveLeave(req, res) {
    try {
        const id = req.params.id;
        const { remarks } = req.body;

        const leaves = await db.query(
            `SELECT r.*, lt.name AS leave_type_name
             FROM leave_requests r
             JOIN leave_types lt ON r.leave_type_id = lt.id
             WHERE r.id = ?`,
            [id]
        );

        if (!leaves || leaves.length === 0) {
            return res.status(404).json({ success: false, message: 'Leave request not found.' });
        }

        const leave = leaves[0];

        if (leave.status !== 'Pending') {
            return res.status(400).json({ success: false, message: `Cannot approve request with current status: ${leave.status}` });
        }

        const currentYear = new Date(leave.start_date).getFullYear();

        // 1. Fetch employee leave balance
        const balances = await db.query(
            `SELECT * FROM leave_balances
             WHERE employee_id = ? AND leave_type_id = ? AND year = ?`,
            [leave.employee_id, leave.leave_type_id, currentYear]
        );

        if (!balances || balances.length === 0) {
            return res.status(400).json({ success: false, message: 'Leave balance not configured for this employee.' });
        }

        const balance = balances[0];
        if (balance.available_days < leave.days) {
            return res.status(400).json({
                success: false,
                message: `Insufficient leave balance to approve. Requested: ${leave.days} day(s), Available: ${balance.available_days} day(s).`
            });
        }

        // 2. Deduct days from balance
        const newUsed = (balance.used_days || 0) + leave.days;
        const newAvail = (balance.available_days || 0) - leave.days;

        await db.query(
            `UPDATE leave_balances
             SET used_days = ?, available_days = ?
             WHERE employee_id = ? AND leave_type_id = ? AND year = ?`,
            [newUsed, newAvail, leave.employee_id, leave.leave_type_id, currentYear]
        );

        // 3. Update Leave Request Status
        const now = new Date().toISOString().replace('T', ' ').substring(0, 19);
        await db.query(
            `UPDATE leave_requests
             SET status = 'Approved', rejection_reason = ?, action_by = ?, action_at = ?
             WHERE id = ?`,
            [remarks || 'Approved by HR/Admin', req.user.employeeId, now, id]
        );

        // 4. Create Notification for Employee
        await db.query(
            `INSERT INTO notifications (employee_id, title, message, type, is_read, link)
             VALUES (?, 'Leave Approved', ?, 'success', 0, '/employee/my-leaves.html')`,
            [
                leave.employee_id,
                `Your ${leave.leave_type_name} request for ${formatDate(leave.start_date)} to ${formatDate(leave.end_date)} (${leave.days} days) has been APPROVED.`
            ]
        );

        // 5. Add Audit Log
        await logAudit({
            userId: req.user.userId,
            employeeId: req.user.employeeId,
            userName: req.user.fullName,
            role: req.user.role,
            action: 'Leave request approved',
            details: `Approved ${leave.days} day(s) ${leave.leave_type_name} for ${leave.employee_id}. Remarks: ${remarks || 'None'}`,
            req
        });

        return res.json({
            success: true,
            message: 'Leave request approved successfully.'
        });
    } catch (err) {
        console.error('approveLeave error:', err);
        return res.status(500).json({ success: false, message: 'Server error during leave approval.' });
    }
}

/**
 * Reject leave request (Admin or HR)
 */
async function rejectLeave(req, res) {
    try {
        const id = req.params.id;
        const { rejectionReason, remarks } = req.body;

        const reason = rejectionReason || remarks;
        if (!reason || reason.trim().length === 0) {
            return res.status(400).json({ success: false, message: 'When rejecting a request, a rejection reason is required.' });
        }

        const leaves = await db.query(
            `SELECT r.*, lt.name AS leave_type_name
             FROM leave_requests r
             JOIN leave_types lt ON r.leave_type_id = lt.id
             WHERE r.id = ?`,
            [id]
        );

        if (!leaves || leaves.length === 0) {
            return res.status(404).json({ success: false, message: 'Leave request not found.' });
        }

        const leave = leaves[0];

        if (leave.status !== 'Pending') {
            return res.status(400).json({ success: false, message: `Cannot reject request with status: ${leave.status}` });
        }

        // Update Request status to Rejected (DO NOT reduce leave balance)
        const now = new Date().toISOString().replace('T', ' ').substring(0, 19);
        await db.query(
            `UPDATE leave_requests
             SET status = 'Rejected', rejection_reason = ?, action_by = ?, action_at = ?
             WHERE id = ?`,
            [reason.trim(), req.user.employeeId, now, id]
        );

        // Create Notification for Employee
        await db.query(
            `INSERT INTO notifications (employee_id, title, message, type, is_read, link)
             VALUES (?, 'Leave Rejected', ?, 'danger', 0, '/employee/my-leaves.html')`,
            [
                leave.employee_id,
                `Your ${leave.leave_type_name} request for ${formatDate(leave.start_date)} to ${formatDate(leave.end_date)} was REJECTED. Reason: ${reason}`
            ]
        );

        // Add Audit Log
        await logAudit({
            userId: req.user.userId,
            employeeId: req.user.employeeId,
            userName: req.user.fullName,
            role: req.user.role,
            action: 'Leave request rejected',
            details: `Rejected ${leave.days} day(s) ${leave.leave_type_name} for ${leave.employee_id}. Reason: ${reason}`,
            req
        });

        return res.json({
            success: true,
            message: 'Leave request rejected successfully.'
        });
    } catch (err) {
        console.error('rejectLeave error:', err);
        return res.status(500).json({ success: false, message: 'Server error during leave rejection.' });
    }
}

/**
 * Cancel pending leave request (by Employee or Admin)
 */
async function cancelLeave(req, res) {
    try {
        const id = req.params.id;

        const leaves = await db.query('SELECT * FROM leave_requests WHERE id = ?', [id]);
        if (!leaves || leaves.length === 0) {
            return res.status(404).json({ success: false, message: 'Leave request not found.' });
        }

        const leave = leaves[0];

        // Only owner or admin can cancel
        if (req.user.role === 'employee' && req.user.employeeId !== leave.employee_id) {
            return res.status(403).json({ success: false, message: 'You can only cancel your own leave requests.' });
        }

        if (leave.status !== 'Pending') {
            return res.status(400).json({ success: false, message: 'Only Pending leave requests can be cancelled.' });
        }

        const now = new Date().toISOString().replace('T', ' ').substring(0, 19);
        await db.query(
            `UPDATE leave_requests
             SET status = 'Cancelled', action_by = ?, action_at = ?
             WHERE id = ?`,
            [req.user.employeeId, now, id]
        );

        await logAudit({
            userId: req.user.userId,
            employeeId: req.user.employeeId,
            userName: req.user.fullName,
            role: req.user.role,
            action: 'Leave cancelled',
            details: `Cancelled leave request #${id} (${leave.days} days).`,
            req
        });

        return res.json({
            success: true,
            message: 'Leave request has been cancelled.'
        });
    } catch (err) {
        console.error('cancelLeave error:', err);
        return res.status(500).json({ success: false, message: 'Failed to cancel leave request.' });
    }
}

/**
 * Get leave balances for an employee
 */
async function getLeaveBalances(req, res) {
    try {
        const employeeId = req.params.employeeId || req.user.employeeId;
        const year = req.query.year || new Date().getFullYear();

        if (req.user.role === 'employee' && req.user.employeeId !== employeeId) {
            return res.status(403).json({ success: false, message: 'Access denied.' });
        }

        const balances = await db.query(
            `SELECT b.*, lt.name AS leave_type_name, lt.code AS leave_type_code, lt.description
             FROM leave_balances b
             JOIN leave_types lt ON b.leave_type_id = lt.id
             WHERE b.employee_id = ? AND b.year = ? AND lt.is_active = 1`,
            [employeeId, year]
        );

        return res.json({
            success: true,
            balances
        });
    } catch (err) {
        console.error('getLeaveBalances error:', err);
        return res.status(500).json({ success: false, message: 'Failed to retrieve leave balances.' });
    }
}

module.exports = {
    applyLeave,
    getAllLeaves,
    getLeaveById,
    approveLeave,
    rejectLeave,
    cancelLeave,
    getLeaveBalances
};
