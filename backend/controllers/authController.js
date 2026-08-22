const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const db = require('../config/db');
const { logAudit } = require('../utils/auditLogger');
require('dotenv').config();

const JWT_SECRET = process.env.JWT_SECRET || 'leave_management_super_secure_jwt_secret_key_2026';
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '1d';

/**
 * Register a new employee account
 */
async function register(req, res) {
    try {
        const { employeeId, fullName, email, phone, department, designation, password } = req.body;

        if (!employeeId || !fullName || !email || !password) {
            return res.status(400).json({ success: false, message: 'Please provide employeeId, fullName, email and password.' });
        }

        // Check if employee or user already exists
        const existingUsers = await db.query('SELECT * FROM users WHERE email = ? OR employee_id = ?', [email, employeeId]);
        if (existingUsers && existingUsers.length > 0) {
            return res.status(400).json({ success: false, message: 'An employee with this email or Employee ID already exists.' });
        }

        const hashedPassword = await bcrypt.hash(password, 10);
        const joiningDate = new Date().toISOString().substring(0, 10);

        // Insert into employees table
        await db.query(
            `INSERT INTO employees (employee_id, full_name, email, phone, department, designation, salary, joining_date, status)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'active')`,
            [employeeId, fullName, email, phone || '', department || 'General', designation || 'Staff', 0, joiningDate]
        );

        // Insert into users table
        const userResult = await db.query(
            `INSERT INTO users (employee_id, email, password, role, is_active)
             VALUES (?, ?, ?, 'employee', 1)`,
            [employeeId, email, hashedPassword]
        );

        // Initialize default leave balances for the new employee
        const leaveTypes = await db.query('SELECT * FROM leave_types WHERE is_active = 1');
        const year = new Date().getFullYear();
        if (leaveTypes && leaveTypes.length > 0) {
            for (const lt of leaveTypes) {
                await db.query(
                    `INSERT INTO leave_balances (employee_id, leave_type_id, total_days, used_days, available_days, year)
                     VALUES (?, ?, ?, 0, ?, ?)`,
                    [employeeId, lt.id, lt.max_days, lt.max_days, year]
                );
            }
        }

        // Notification for welcoming new user
        await db.query(
            `INSERT INTO notifications (user_id, employee_id, title, message, type, is_read, link)
             VALUES (?, ?, 'Welcome to HR Leave Portal', 'Your employee account has been created successfully.', 'success', 0, '/employee/employee-dashboard.html')`,
            [userResult.insertId || null, employeeId]
        );

        // Audit Log
        await logAudit({
            userId: userResult.insertId,
            employeeId,
            userName: fullName,
            role: 'employee',
            action: 'User Registered',
            details: `Employee ${employeeId} (${fullName}) registered.`,
            req
        });

        return res.status(201).json({
            success: true,
            message: 'Registration successful! You can now log in.'
        });
    } catch (err) {
        console.error('Registration error:', err);
        return res.status(500).json({ success: false, message: 'Server error during registration. Please try again.' });
    }
}

/**
 * Login handler returning JWT and user profile
 */
async function login(req, res) {
    try {
        const { emailOrId, password } = req.body;

        if (!emailOrId || !password) {
            return res.status(400).json({ success: false, message: 'Please enter your email or Employee ID and password.' });
        }

        // Query user by email OR employee_id
        const users = await db.query(
            `SELECT u.*, e.full_name, e.department, e.designation, e.salary, e.profile_photo, e.phone
             FROM users u
             LEFT JOIN employees e ON u.employee_id = e.employee_id
             WHERE (u.email = ? OR u.employee_id = ?)`,
            [emailOrId.trim(), emailOrId.trim()]
        );

        if (!users || users.length === 0) {
            return res.status(401).json({ success: false, message: 'Invalid email or password.' });
        }

        const user = users[0];

        if (user.is_active === 0) {
            return res.status(403).json({ success: false, message: 'Your account is deactivated. Please contact administrator.' });
        }

        // Verify password
        const isMatch = await bcrypt.compare(password, user.password);
        if (!isMatch) {
            return res.status(401).json({ success: false, message: 'Invalid email or password.' });
        }

        // Generate JWT Token
        const payload = {
            userId: user.id,
            employeeId: user.employee_id,
            role: user.role,
            email: user.email,
            fullName: user.full_name || user.email.split('@')[0]
        };

        const token = jwt.sign(payload, JWT_SECRET, { expiresIn: JWT_EXPIRES_IN });

        // Record Audit Log
        await logAudit({
            userId: user.id,
            employeeId: user.employee_id,
            userName: user.full_name,
            role: user.role,
            action: 'User logged in',
            details: `User logged in from ${req.ip || 'local'}`,
            req
        });

        return res.json({
            success: true,
            message: 'Login successful',
            token,
            user: {
                userId: user.id,
                employeeId: user.employee_id,
                role: user.role,
                email: user.email,
                fullName: user.full_name || 'User',
                department: user.department || '',
                designation: user.designation || '',
                salary: Number(user.salary) || 0,
                profilePhoto: user.profile_photo || ''
            }
        });
    } catch (err) {
        console.error('Login error:', err);
        return res.status(500).json({ success: false, message: 'Server error during login. Please try again.' });
    }
}

/**
 * Get current authenticated user details
 */
async function getMe(req, res) {
    try {
        const users = await db.query(
            `SELECT u.id, u.employee_id, u.email, u.role, u.is_active,
                    e.full_name, e.department, e.designation, e.salary, e.phone, e.joining_date, e.profile_photo, e.status
             FROM users u
             LEFT JOIN employees e ON u.employee_id = e.employee_id
             WHERE u.id = ?`,
            [req.user.userId]
        );

        if (!users || users.length === 0) {
            return res.status(404).json({ success: false, message: 'User not found.' });
        }

        const user = users[0];
        return res.json({
            success: true,
            user: {
                userId: user.id,
                employeeId: user.employee_id,
                role: user.role,
                email: user.email,
                fullName: user.full_name || '',
                department: user.department || '',
                designation: user.designation || '',
                salary: Number(user.salary) || 0,
                phone: user.phone || '',
                joiningDate: user.joining_date || '',
                profilePhoto: user.profile_photo || '',
                status: user.status || 'active'
            }
        });
    } catch (err) {
        console.error('getMe error:', err);
        return res.status(500).json({ success: false, message: 'Error retrieving user profile.' });
    }
}

/**
 * Change password
 */
async function changePassword(req, res) {
    try {
        const { currentPassword, newPassword } = req.body;
        if (!currentPassword || !newPassword) {
            return res.status(400).json({ success: false, message: 'Please provide both current and new passwords.' });
        }

        const users = await db.query('SELECT * FROM users WHERE id = ?', [req.user.userId]);
        if (!users || users.length === 0) {
            return res.status(404).json({ success: false, message: 'User account not found.' });
        }

        const user = users[0];
        const isMatch = await bcrypt.compare(currentPassword, user.password);
        if (!isMatch) {
            return res.status(400).json({ success: false, message: 'Incorrect current password.' });
        }

        const hashedPassword = await bcrypt.hash(newPassword, 10);
        await db.query('UPDATE users SET password = ? WHERE id = ?', [hashedPassword, req.user.userId]);

        await logAudit({
            userId: user.id,
            employeeId: user.employee_id,
            userName: req.user.fullName,
            role: user.role,
            action: 'Password changed',
            details: 'User updated their security password.',
            req
        });

        return res.json({ success: true, message: 'Password updated successfully.' });
    } catch (err) {
        console.error('changePassword error:', err);
        return res.status(500).json({ success: false, message: 'Failed to change password.' });
    }
}

/**
 * Forgot password request flow
 */
async function forgotPassword(req, res) {
    try {
        const { email } = req.body;
        if (!email) return res.status(400).json({ success: false, message: 'Please provide your registered email.' });

        const users = await db.query('SELECT * FROM users WHERE email = ?', [email.trim()]);
        if (!users || users.length === 0) {
            return res.status(404).json({ success: false, message: 'No registered user found with this email address.' });
        }

        // Generate simple simulated reset token
        const resetToken = Math.floor(100000 + Math.random() * 900000).toString();
        const expiry = new Date(Date.now() + 3600000).toISOString().replace('T', ' ').substring(0, 19);

        await db.query('UPDATE users SET reset_token = ?, reset_token_expiry = ? WHERE email = ?', [resetToken, expiry, email]);

        await logAudit({
            userId: users[0].id,
            employeeId: users[0].employee_id,
            userName: users[0].email,
            role: users[0].role,
            action: 'Password Reset Requested',
            details: `Reset code generated: ${resetToken}`,
            req
        });

        return res.json({
            success: true,
            message: 'Password reset code generated and sent to your email (Demo Code: ' + resetToken + ')',
            demoCode: resetToken
        });
    } catch (err) {
        console.error('forgotPassword error:', err);
        return res.status(500).json({ success: false, message: 'Server error processing password reset.' });
    }
}

/**
 * Reset password using verification code
 */
async function resetPassword(req, res) {
    try {
        const { email, resetToken, newPassword } = req.body;
        if (!email || !resetToken || !newPassword) {
            return res.status(400).json({ success: false, message: 'Email, verification code, and new password are required.' });
        }

        const users = await db.query('SELECT * FROM users WHERE email = ? AND reset_token = ?', [email.trim(), resetToken.trim()]);
        if (!users || users.length === 0) {
            return res.status(400).json({ success: false, message: 'Invalid or expired verification code.' });
        }

        const hashedPassword = await bcrypt.hash(newPassword, 10);
        await db.query('UPDATE users SET password = ?, reset_token = NULL, reset_token_expiry = NULL WHERE email = ?', [hashedPassword, email]);

        await logAudit({
            userId: users[0].id,
            employeeId: users[0].employee_id,
            userName: users[0].email,
            role: users[0].role,
            action: 'Password Reset Completed',
            details: 'Password was successfully reset using verification token.',
            req
        });

        return res.json({ success: true, message: 'Password has been successfully reset! You can now log in.' });
    } catch (err) {
        console.error('resetPassword error:', err);
        return res.status(500).json({ success: false, message: 'Server error resetting password.' });
    }
}

/**
 * Logout handler
 */
async function logout(req, res) {
    if (req.user) {
        await logAudit({
            userId: req.user.userId,
            employeeId: req.user.employeeId,
            userName: req.user.fullName,
            role: req.user.role,
            action: 'User logged out',
            details: 'Session ended',
            req
        });
    }
    return res.json({ success: true, message: 'Logged out successfully.' });
}

module.exports = {
    register,
    login,
    logout,
    getMe,
    changePassword,
    forgotPassword,
    resetPassword
};
