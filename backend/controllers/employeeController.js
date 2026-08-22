const db = require('../config/db');
const bcrypt = require('bcryptjs');
const { logAudit } = require('../utils/auditLogger');

/**
 * Create an employee record. Salary is intentionally accepted only here,
 * behind the admin-only route.
 */
async function createEmployee(req, res) {
    try {
        const { employeeId, fullName, email, phone, department, designation, salary, password } = req.body;
        const annualSalary = Number(salary);

        if (!employeeId || !fullName || !email || !designation || !password) {
            return res.status(400).json({ success: false, message: 'Employee ID, name, email, designation, and password are required.' });
        }
        if (!Number.isFinite(annualSalary) || annualSalary < 0) {
            return res.status(400).json({ success: false, message: 'Salary must be a valid non-negative amount.' });
        }

        const existing = await db.query('SELECT * FROM users WHERE email = ? OR employee_id = ?', [email.trim(), employeeId.trim()]);
        if (existing.length > 0) {
            return res.status(400).json({ success: false, message: 'An employee with this email or Employee ID already exists.' });
        }

        const joinedOn = new Date().toISOString().substring(0, 10);
        await db.query(
            `INSERT INTO employees (employee_id, full_name, email, phone, department, designation, salary, joining_date, status)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'active')`,
            [employeeId.trim(), fullName.trim(), email.trim().toLowerCase(), phone || '', department || 'General', designation.trim(), annualSalary, joinedOn]
        );

        const passwordHash = await bcrypt.hash(password, 10);
        await db.query(
            `INSERT INTO users (employee_id, email, password, role, is_active)
             VALUES (?, ?, ?, 'employee', 1)`,
            [employeeId.trim(), email.trim().toLowerCase(), passwordHash]
        );

        const leaveTypes = await db.query('SELECT * FROM leave_types WHERE is_active = 1');
        const year = new Date().getFullYear();
        for (const leaveType of leaveTypes) {
            await db.query(
                `INSERT INTO leave_balances (employee_id, leave_type_id, total_days, used_days, available_days, year)
                 VALUES (?, ?, ?, 0, ?, ?)`,
                [employeeId.trim(), leaveType.id, leaveType.max_days, leaveType.max_days, year]
            );
        }

        await logAudit({
            userId: req.user.userId,
            employeeId: employeeId.trim(),
            userName: req.user.fullName,
            role: req.user.role,
            action: 'Employee created',
            details: `Created employee ${employeeId.trim()} with salary details.`,
            req
        });

        return res.status(201).json({ success: true, message: 'Employee created successfully.' });
    } catch (err) {
        console.error('createEmployee error:', err);
        return res.status(500).json({ success: false, message: 'Failed to create employee.' });
    }
}

/**
 * Get all employees with search, filtering, sorting, pagination
 */
async function getAllEmployees(req, res) {
    try {
        const { search = '', department = '', status = '', page = 1, limit = 50, sort = 'employee_id' } = req.query;

        let sql = `
            SELECT e.*, u.role, u.is_active, u.id AS user_id
            FROM employees e
            LEFT JOIN users u ON e.employee_id = u.employee_id
            WHERE 1=1
        `;
        const params = [];

        if (search) {
            sql += ` AND (e.full_name LIKE ? OR e.employee_id LIKE ? OR e.email LIKE ? OR e.designation LIKE ?)`;
            const searchPattern = `%${search}%`;
            params.push(searchPattern, searchPattern, searchPattern, searchPattern);
        }

        if (department) {
            sql += ` AND e.department = ?`;
            params.push(department);
        }

        if (status) {
            sql += ` AND e.status = ?`;
            params.push(status);
        }

        sql += ` ORDER BY e.id DESC`;

        const employees = await db.query(sql, params);

        // Calculate leave summary for each employee
        const allBalances = await db.query('SELECT * FROM leave_balances WHERE year = 2026');
        const enriched = employees.map(emp => {
            const empBalances = allBalances.filter(b => b.employee_id === emp.employee_id);
            const totalLeave = empBalances.reduce((acc, curr) => acc + (curr.total_days || 0), 0);
            const usedLeave = empBalances.reduce((acc, curr) => acc + (curr.used_days || 0), 0);
            const availableLeave = empBalances.reduce((acc, curr) => acc + (curr.available_days || 0), 0);
            return {
                ...emp,
                totalLeave,
                usedLeave,
                availableLeave,
                balances: empBalances
            };
        });

        // Pagination
        const pageNum = parseInt(page, 10) || 1;
        const pageSize = parseInt(limit, 10) || 50;
        const offset = (pageNum - 1) * pageSize;
        const paginated = enriched.slice(offset, offset + pageSize);

        return res.json({
            success: true,
            total: enriched.length,
            page: pageNum,
            limit: pageSize,
            totalPages: Math.ceil(enriched.length / pageSize),
            employees: paginated
        });
    } catch (err) {
        console.error('getAllEmployees error:', err);
        return res.status(500).json({ success: false, message: 'Failed to retrieve employees.' });
    }
}

/**
 * Get employee details by ID or Employee ID
 */
async function getEmployeeById(req, res) {
    try {
        const idOrCode = req.params.id;

        // Employees can only view their own profile unless HR/Admin
        if (req.user.role === 'employee' && req.user.employeeId !== idOrCode && req.user.userId != idOrCode) {
            return res.status(403).json({ success: false, message: 'You are not authorized to view other employee details.' });
        }

        const employees = await db.query(
            `SELECT e.*, u.role, u.is_active, u.id AS user_id
             FROM employees e
             LEFT JOIN users u ON e.employee_id = u.employee_id
             WHERE e.employee_id = ? OR e.id = ?`,
            [idOrCode, idOrCode]
        );

        if (!employees || employees.length === 0) {
            return res.status(404).json({ success: false, message: 'Employee not found.' });
        }

        const employee = employees[0];

        // Fetch leave balances
        const balances = await db.query(
            `SELECT b.*, lt.name AS leave_type_name, lt.code AS leave_type_code
             FROM leave_balances b
             JOIN leave_types lt ON b.leave_type_id = lt.id
             WHERE b.employee_id = ? AND b.year = 2026`,
            [employee.employee_id]
        );

        // Fetch leave history
        const leaveHistory = await db.query(
            `SELECT r.*, lt.name AS leave_type_name, lt.code AS leave_type_code
             FROM leave_requests r
             JOIN leave_types lt ON r.leave_type_id = lt.id
             WHERE r.employee_id = ?
             ORDER BY r.id DESC`,
            [employee.employee_id]
        );

        // Check if currently on leave today
        const today = new Date().toISOString().substring(0, 10);
        const currentLeave = leaveHistory.find(
            l => l.status === 'Approved' && l.start_date <= today && l.end_date >= today
        );

        const currentLeaveStatus = currentLeave ? `On Leave (${currentLeave.leave_type_name})` : 'Active / Working';

        return res.json({
            success: true,
            employee: {
                ...employee,
                currentLeaveStatus,
                balances,
                leaveHistory
            }
        });
    } catch (err) {
        console.error('getEmployeeById error:', err);
        return res.status(500).json({ success: false, message: 'Failed to retrieve employee details.' });
    }
}

/**
 * Update employee details
 */
async function updateEmployee(req, res) {
    try {
        const idOrCode = req.params.id;
        const { fullName, phone, department, designation, salary, status, profilePhoto } = req.body;

        // Verify permission: Employee can only update own phone/photo/profile, Admin/HR can update all
        if (req.user.role === 'employee' && req.user.employeeId !== idOrCode && req.user.userId != idOrCode) {
            return res.status(403).json({ success: false, message: 'You cannot edit other employees.' });
        }

        const employees = await db.query('SELECT * FROM employees WHERE employee_id = ? OR id = ?', [idOrCode, idOrCode]);
        if (!employees || employees.length === 0) {
            return res.status(404).json({ success: false, message: 'Employee not found.' });
        }

        const emp = employees[0];
        const updatedName = fullName !== undefined ? fullName : emp.full_name;
        const updatedPhone = phone !== undefined ? phone : emp.phone;
        const updatedDept = (req.user.role === 'admin' || req.user.role === 'hr') && department !== undefined ? department : emp.department;
        const updatedDesig = (req.user.role === 'admin' || req.user.role === 'hr') && designation !== undefined ? designation : emp.designation;
        const updatedSalary = req.user.role === 'admin' && salary !== undefined ? Number(salary) : Number(emp.salary || 0);
        const updatedStatus = (req.user.role === 'admin' || req.user.role === 'hr') && status !== undefined ? status : emp.status;
        const updatedPhoto = profilePhoto !== undefined ? profilePhoto : emp.profile_photo;

        if (!Number.isFinite(updatedSalary) || updatedSalary < 0) {
            return res.status(400).json({ success: false, message: 'Salary must be a valid non-negative amount.' });
        }

        await db.query(
            `UPDATE employees
             SET full_name = ?, phone = ?, department = ?, designation = ?, salary = ?, status = ?, profile_photo = ?
             WHERE employee_id = ?`,
            [updatedName, updatedPhone, updatedDept, updatedDesig, updatedSalary, updatedStatus, updatedPhoto, emp.employee_id]
        );

        if (status && (req.user.role === 'admin' || req.user.role === 'hr')) {
            const isActive = updatedStatus === 'active' ? 1 : 0;
            await db.query('UPDATE users SET is_active = ? WHERE employee_id = ?', [isActive, emp.employee_id]);
        }

        await logAudit({
            userId: req.user.userId,
            employeeId: emp.employee_id,
            userName: req.user.fullName,
            role: req.user.role,
            action: 'Employee updated',
            details: `Updated details for ${emp.employee_id} (${updatedName})`,
            req
        });

        return res.json({ success: true, message: 'Employee profile updated successfully.' });
    } catch (err) {
        console.error('updateEmployee error:', err);
        return res.status(500).json({ success: false, message: 'Failed to update employee.' });
    }
}

/**
 * Delete / Deactivate employee
 */
async function deleteEmployee(req, res) {
    try {
        const idOrCode = req.params.id;

        const employees = await db.query('SELECT * FROM employees WHERE employee_id = ? OR id = ?', [idOrCode, idOrCode]);
        if (!employees || employees.length === 0) {
            return res.status(404).json({ success: false, message: 'Employee not found.' });
        }

        const emp = employees[0];
        if (emp.employee_id === 'ADM001') {
            return res.status(400).json({ success: false, message: 'Primary System Administrator cannot be deleted.' });
        }

        // Delete from users and employees
        await db.query('DELETE FROM users WHERE employee_id = ?', [emp.employee_id]);
        await db.query('DELETE FROM employees WHERE employee_id = ?', [emp.employee_id]);

        await logAudit({
            userId: req.user.userId,
            employeeId: emp.employee_id,
            userName: req.user.fullName,
            role: req.user.role,
            action: 'Employee deleted',
            details: `Removed employee record: ${emp.employee_id} (${emp.full_name})`,
            req
        });

        return res.json({ success: true, message: 'Employee deleted successfully.' });
    } catch (err) {
        console.error('deleteEmployee error:', err);
        return res.status(500).json({ success: false, message: 'Failed to delete employee.' });
    }
}

/**
 * Import employees from CSV/Array with validation
 */
async function importEmployees(req, res) {
    try {
        let { employeesList } = req.body;

        // If file uploaded via multer, or parsed text
        if (req.file) {
            const fileContent = req.file.buffer ? req.file.buffer.toString('utf-8') : '';
            const lines = fileContent.split(/\r?\n/).filter(line => line.trim().length > 0);
            if (lines.length > 1) {
                const headers = lines[0].split(',').map(h => h.trim().toLowerCase());
                employeesList = [];
                for (let i = 1; i < lines.length; i++) {
                    const cols = lines[i].split(',').map(c => c.trim());
                    if (cols.length >= 4) {
                        employeesList.push({
                            employee_id: cols[0],
                            name: cols[1],
                            email: cols[2],
                            department: cols[3] || 'General',
                            designation: cols[4] || 'Staff',
                            phone: cols[5] || ''
                        });
                    }
                }
            }
        }

        if (!employeesList || !Array.isArray(employeesList) || employeesList.length === 0) {
            return res.status(400).json({ success: false, message: 'No valid employee records provided for import.' });
        }

        const existingUsers = await db.query('SELECT employee_id, email FROM users');
        const existingEmpIds = new Set(existingUsers.map(u => u.employee_id.toUpperCase()));
        const existingEmails = new Set(existingUsers.map(u => u.email.toLowerCase()));

        const errors = [];
        const validRecords = [];
        const seenInBatchIds = new Set();
        const seenInBatchEmails = new Set();

        employeesList.forEach((emp, index) => {
            const rowNum = index + 1;
            const empId = (emp.employee_id || emp.employeeId || '').trim();
            const name = (emp.name || emp.full_name || emp.fullName || '').trim();
            const email = (emp.email || '').trim().toLowerCase();
            const department = (emp.department || 'General').trim();
            const designation = (emp.designation || 'Staff').trim();
            const phone = (emp.phone || '').trim();

            if (!empId) {
                errors.push(`Row ${rowNum}: Employee ID is required.`);
                return;
            }
            if (!name) {
                errors.push(`Row ${rowNum}: Full Name is required.`);
                return;
            }
            if (!email || !email.includes('@')) {
                errors.push(`Row ${rowNum}: Valid email is required.`);
                return;
            }

            if (existingEmpIds.has(empId.toUpperCase()) || seenInBatchIds.has(empId.toUpperCase())) {
                errors.push(`Row ${rowNum}: Duplicate Employee ID '${empId}'.`);
                return;
            }

            if (existingEmails.has(email) || seenInBatchEmails.has(email)) {
                errors.push(`Row ${rowNum}: Duplicate Email '${email}'.`);
                return;
            }

            seenInBatchIds.add(empId.toUpperCase());
            seenInBatchEmails.add(email);
            validRecords.push({ empId, name, email, department, designation, phone });
        });

        // If preview only requested
        if (req.body.previewOnly) {
            return res.json({
                success: true,
                totalProcessed: employeesList.length,
                validCount: validRecords.length,
                errorCount: errors.length,
                errors,
                preview: validRecords
            });
        }

        if (validRecords.length === 0) {
            return res.status(400).json({
                success: false,
                message: 'Import failed. No valid records found.',
                errors
            });
        }

        const defaultPasswordHash = await bcrypt.hash('emp123', 10);
        const joiningDate = new Date().toISOString().substring(0, 10);
        const leaveTypes = await db.query('SELECT * FROM leave_types WHERE is_active = 1');
        const year = new Date().getFullYear();

        for (const record of validRecords) {
            await db.query(
                `INSERT INTO employees (employee_id, full_name, email, phone, department, designation, joining_date, status)
                 VALUES (?, ?, ?, ?, ?, ?, ?, 'active')`,
                [record.empId, record.name, record.email, record.phone, record.department, record.designation, joiningDate]
            );

            await db.query(
                `INSERT INTO users (employee_id, email, password, role, is_active)
                 VALUES (?, ?, ?, 'employee', 1)`,
                [record.empId, record.email, defaultPasswordHash]
            );

            // Populate initial leave balances
            if (leaveTypes && leaveTypes.length > 0) {
                for (const lt of leaveTypes) {
                    await db.query(
                        `INSERT INTO leave_balances (employee_id, leave_type_id, total_days, used_days, available_days, year)
                         VALUES (?, ?, ?, 0, ?, ?)`,
                        [record.empId, lt.id, lt.max_days, lt.max_days, year]
                    );
                }
            }
        }

        await logAudit({
            userId: req.user.userId,
            employeeId: req.user.employeeId,
            userName: req.user.fullName,
            role: req.user.role,
            action: 'Employee imported',
            details: `Imported ${validRecords.length} employee records via CSV batch.`,
            req
        });

        return res.json({
            success: true,
            message: `Employee imported successfully: ${validRecords.length} records added.`,
            importedCount: validRecords.length,
            errors
        });
    } catch (err) {
        console.error('importEmployees error:', err);
        return res.status(500).json({ success: false, message: 'Server error during employee import.' });
    }
}

module.exports = {
    createEmployee,
    getAllEmployees,
    getEmployeeById,
    updateEmployee,
    deleteEmployee,
    importEmployees
};
