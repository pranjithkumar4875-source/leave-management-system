const mysql = require('mysql2/promise');
const path = require('path');
const fs = require('fs');
const bcrypt = require('bcryptjs');
require('dotenv').config();

// Global database connection / state
let pool = null;
let useFallbackDb = false;
let fallbackData = null;

const FALLBACK_DB_FILE = path.join(__dirname, '../../database/local_db.json');

// Initialize Demo Data for Fallback or Initial Seeding
async function getSeedData() {
    const passwordHash = await bcrypt.hash('admin123', 10);
    const hrPasswordHash = await bcrypt.hash('hr123', 10);
    const empPasswordHash = await bcrypt.hash('emp123', 10);

    return {
        users: [
            { id: 1, employee_id: 'ADM001', email: 'admin@example.com', password: passwordHash, role: 'admin', is_active: 1, reset_token: null, reset_token_expiry: null, created_at: '2026-01-01 09:00:00', updated_at: '2026-01-01 09:00:00' },
            { id: 2, employee_id: 'HR001', email: 'hr@example.com', password: hrPasswordHash, role: 'hr', is_active: 1, reset_token: null, reset_token_expiry: null, created_at: '2026-01-01 09:00:00', updated_at: '2026-01-01 09:00:00' },
            { id: 3, employee_id: 'EMP001', email: 'john.doe@example.com', password: empPasswordHash, role: 'employee', is_active: 1, reset_token: null, reset_token_expiry: null, created_at: '2026-01-01 09:00:00', updated_at: '2026-01-01 09:00:00' },
            { id: 4, employee_id: 'EMP002', email: 'jane.smith@example.com', password: empPasswordHash, role: 'employee', is_active: 1, reset_token: null, reset_token_expiry: null, created_at: '2026-01-01 09:00:00', updated_at: '2026-01-01 09:00:00' },
            { id: 5, employee_id: 'EMP003', email: 'alex.jones@example.com', password: empPasswordHash, role: 'employee', is_active: 1, reset_token: null, reset_token_expiry: null, created_at: '2026-01-01 09:00:00', updated_at: '2026-01-01 09:00:00' }
        ],
        employees: [
            { id: 1, employee_id: 'ADM001', full_name: 'System Administrator', email: 'admin@example.com', phone: '+1-555-0100', department: 'Administration', designation: 'IT Director', salary: 2400000, joining_date: '2022-01-10', profile_photo: '', status: 'active', created_at: '2022-01-10 09:00:00', updated_at: '2026-01-01 09:00:00' },
            { id: 2, employee_id: 'HR001', full_name: 'Sarah Jenkins', email: 'hr@example.com', phone: '+1-555-0101', department: 'Human Resources', designation: 'HR Manager', salary: 1800000, joining_date: '2022-03-15', profile_photo: '', status: 'active', created_at: '2022-03-15 09:00:00', updated_at: '2026-01-01 09:00:00' },
            { id: 3, employee_id: 'EMP001', full_name: 'John Doe', email: 'john.doe@example.com', phone: '+1-555-0102', department: 'Engineering', designation: 'Senior Full Stack Developer', salary: 1500000, joining_date: '2023-01-05', profile_photo: '', status: 'active', created_at: '2023-01-05 09:00:00', updated_at: '2026-01-01 09:00:00' },
            { id: 4, employee_id: 'EMP002', full_name: 'Jane Smith', email: 'jane.smith@example.com', phone: '+1-555-0103', department: 'Marketing', designation: 'Lead Marketing Strategist', salary: 1400000, joining_date: '2023-04-12', profile_photo: '', status: 'active', created_at: '2026-01-01 09:00:00', updated_at: '2026-01-01 09:00:00' },
            { id: 5, employee_id: 'EMP003', full_name: 'Alex Jones', email: 'alex.jones@example.com', phone: '+1-555-0104', department: 'Product Design', designation: 'UI/UX Designer', salary: 1300000, joining_date: '2023-06-20', profile_photo: '', status: 'active', created_at: '2023-06-20 09:00:00', updated_at: '2026-01-01 09:00:00' }
        ],
        leave_types: [
            { id: 1, name: 'Casual Leave', code: 'CL', max_days: 12, description: 'Annual casual leave allowance for personal matters', is_active: 1, created_at: '2026-01-01 00:00:00', updated_at: '2026-01-01 00:00:00' },
            { id: 2, name: 'Sick Leave', code: 'SL', max_days: 10, description: 'Leave for medical recovery and doctor appointments', is_active: 1, created_at: '2026-01-01 00:00:00', updated_at: '2026-01-01 00:00:00' },
            { id: 3, name: 'Earned Leave', code: 'EL', max_days: 15, description: 'Vacation and accumulated earned paid leave', is_active: 1, created_at: '2026-01-01 00:00:00', updated_at: '2026-01-01 00:00:00' },
            { id: 4, name: 'Maternity Leave', code: 'ML', max_days: 90, description: 'Parental maternity and infant care leave', is_active: 1, created_at: '2026-01-01 00:00:00', updated_at: '2026-01-01 00:00:00' },
            { id: 5, name: 'Emergency Leave', code: 'EML', max_days: 5, description: 'Special leave for unexpected family emergencies', is_active: 1, created_at: '2026-01-01 00:00:00', updated_at: '2026-01-01 00:00:00' }
        ],
        leave_requests: [
            { id: 1, employee_id: 'EMP001', leave_type_id: 1, start_date: '2026-08-10', end_date: '2026-08-11', days: 2, reason: 'Attending family reunion', document_path: null, status: 'Approved', rejection_reason: null, action_by: 'HR001', action_at: '2026-08-08 10:00:00', created_at: '2026-08-07 14:00:00', updated_at: '2026-08-08 10:00:00' },
            { id: 2, employee_id: 'EMP001', leave_type_id: 2, start_date: '2026-08-18', end_date: '2026-08-18', days: 1, reason: 'Viral fever recovery', document_path: null, status: 'Approved', rejection_reason: null, action_by: 'HR001', action_at: '2026-08-18 09:30:00', created_at: '2026-08-17 18:00:00', updated_at: '2026-08-18 09:30:00' },
            { id: 3, employee_id: 'EMP001', leave_type_id: 1, start_date: '2026-08-25', end_date: '2026-08-27', days: 3, reason: 'Short personal travel vacation', document_path: null, status: 'Pending', rejection_reason: null, action_by: null, action_at: null, created_at: '2026-08-20 11:30:00', updated_at: '2026-08-20 11:30:00' },
            { id: 4, employee_id: 'EMP002', leave_type_id: 3, start_date: '2026-08-15', end_date: '2026-08-18', days: 4, reason: 'Annual summer vacation', document_path: null, status: 'Approved', rejection_reason: null, action_by: 'ADM001', action_at: '2026-08-12 14:20:00', created_at: '2026-08-11 10:00:00', updated_at: '2026-08-12 14:20:00' },
            { id: 5, employee_id: 'EMP003', leave_type_id: 1, start_date: '2026-08-28', end_date: '2026-08-29', days: 2, reason: 'Attending design conference', document_path: null, status: 'Pending', rejection_reason: null, action_by: null, action_at: null, created_at: '2026-08-21 16:00:00', updated_at: '2026-08-21 16:00:00' }
        ],
        leave_balances: [
            { id: 1, employee_id: 'EMP001', leave_type_id: 1, total_days: 12, used_days: 2, available_days: 10, year: 2026, created_at: '2026-01-01 00:00:00', updated_at: '2026-08-08 10:00:00' },
            { id: 2, employee_id: 'EMP001', leave_type_id: 2, total_days: 10, used_days: 1, available_days: 9, year: 2026, created_at: '2026-01-01 00:00:00', updated_at: '2026-08-18 09:30:00' },
            { id: 3, employee_id: 'EMP001', leave_type_id: 3, total_days: 15, used_days: 0, available_days: 15, year: 2026, created_at: '2026-01-01 00:00:00', updated_at: '2026-01-01 00:00:00' },
            { id: 4, employee_id: 'EMP001', leave_type_id: 4, total_days: 90, used_days: 0, available_days: 90, year: 2026, created_at: '2026-01-01 00:00:00', updated_at: '2026-01-01 00:00:00' },
            { id: 5, employee_id: 'EMP001', leave_type_id: 5, total_days: 5, used_days: 0, available_days: 5, year: 2026, created_at: '2026-01-01 00:00:00', updated_at: '2026-01-01 00:00:00' },

            { id: 6, employee_id: 'EMP002', leave_type_id: 1, total_days: 12, used_days: 3, available_days: 9, year: 2026, created_at: '2026-01-01 00:00:00', updated_at: '2026-01-01 00:00:00' },
            { id: 7, employee_id: 'EMP002', leave_type_id: 2, total_days: 10, used_days: 0, available_days: 10, year: 2026, created_at: '2026-01-01 00:00:00', updated_at: '2026-01-01 00:00:00' },
            { id: 8, employee_id: 'EMP002', leave_type_id: 3, total_days: 15, used_days: 4, available_days: 11, year: 2026, created_at: '2026-01-01 00:00:00', updated_at: '2026-08-12 14:20:00' },
            { id: 9, employee_id: 'EMP002', leave_type_id: 4, total_days: 90, used_days: 0, available_days: 90, year: 2026, created_at: '2026-01-01 00:00:00', updated_at: '2026-01-01 00:00:00' },
            { id: 10, employee_id: 'EMP002', leave_type_id: 5, total_days: 5, used_days: 0, available_days: 5, year: 2026, created_at: '2026-01-01 00:00:00', updated_at: '2026-01-01 00:00:00' },

            { id: 11, employee_id: 'EMP003', leave_type_id: 1, total_days: 12, used_days: 1, available_days: 11, year: 2026, created_at: '2026-01-01 00:00:00', updated_at: '2026-01-01 00:00:00' },
            { id: 12, employee_id: 'EMP003', leave_type_id: 2, total_days: 10, used_days: 2, available_days: 8, year: 2026, created_at: '2026-01-01 00:00:00', updated_at: '2026-01-01 00:00:00' },
            { id: 13, employee_id: 'EMP003', leave_type_id: 3, total_days: 15, used_days: 0, available_days: 15, year: 2026, created_at: '2026-01-01 00:00:00', updated_at: '2026-01-01 00:00:00' },
            { id: 14, employee_id: 'EMP003', leave_type_id: 4, total_days: 90, used_days: 0, available_days: 90, year: 2026, created_at: '2026-01-01 00:00:00', updated_at: '2026-01-01 00:00:00' },
            { id: 15, employee_id: 'EMP003', leave_type_id: 5, total_days: 5, used_days: 0, available_days: 5, year: 2026, created_at: '2026-01-01 00:00:00', updated_at: '2026-01-01 00:00:00' }
        ],
        notifications: [
            { id: 1, user_id: 3, employee_id: 'EMP001', title: 'Leave Approved', message: 'Your Casual Leave request for Aug 10 - Aug 11 has been approved by HR.', type: 'success', is_read: 1, link: '/employee/my-leaves.html', created_at: '2026-08-08 10:00:00' },
            { id: 2, user_id: 3, employee_id: 'EMP001', title: 'Leave Application Received', message: 'Your Casual Leave request for Aug 25 - Aug 27 is currently Pending review.', type: 'info', is_read: 0, link: '/employee/my-leaves.html', created_at: '2026-08-20 11:30:00' },
            { id: 3, user_id: 2, employee_id: 'HR001', title: 'New Leave Request', message: 'John Doe (EMP001) submitted a leave request for 3 days.', type: 'info', is_read: 0, link: '/hr/hr-leave-requests.html', created_at: '2026-08-20 11:30:00' },
            { id: 4, user_id: 1, employee_id: 'ADM001', title: 'System Notice', message: 'Quarterly leave audit reminder: All pending requests must be reviewed by end of month.', type: 'warning', is_read: 0, link: '/admin/manage-leaves.html', created_at: '2026-08-21 09:00:00' }
        ],
        audit_logs: [
            { id: 1, user_id: 1, employee_id: 'ADM001', user_name: 'System Administrator', role: 'admin', action: 'System Initialized', details: 'Database and demo seeds configured.', ip_address: '127.0.0.1', user_agent: 'Leave Management Backend Engine', created_at: '2026-08-22 10:00:00' },
            { id: 2, user_id: 2, employee_id: 'HR001', user_name: 'Sarah Jenkins', role: 'hr', action: 'Leave request approved', details: 'Approved Casual Leave (2 days) for EMP001', ip_address: '127.0.0.1', user_agent: 'Mozilla/5.0 Chrome/120.0', created_at: '2026-08-22 10:15:00' },
            { id: 3, user_id: 3, employee_id: 'EMP001', user_name: 'John Doe', role: 'employee', action: 'Leave request created', details: 'Applied for Casual Leave: 2026-08-25 to 2026-08-27 (3 days)', ip_address: '127.0.0.1', user_agent: 'Mozilla/5.0 Chrome/120.0', created_at: '2026-08-22 10:30:00' }
        ]
    };
}

// Load or Save Fallback Data
function saveFallbackData() {
    try {
        const dir = path.dirname(FALLBACK_DB_FILE);
        if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
        fs.writeFileSync(FALLBACK_DB_FILE, JSON.stringify(fallbackData, null, 2), 'utf-8');
    } catch (err) {
        console.error('Error saving local fallback database:', err.message);
    }
}

async function initDatabase() {
    try {
        const host = process.env.DB_HOST || 'localhost';
        const port = process.env.DB_PORT || 3306;
        const user = process.env.DB_USER || 'root';
        const password = process.env.DB_PASSWORD || '';
        const database = process.env.DB_NAME || 'leave_management';

        console.log(`Connecting to MySQL at ${host}:${port} as ${user}...`);

        // Connect without database first to ensure database exists
        const rootConn = await mysql.createConnection({
            host,
            port,
            user,
            password,
            connectTimeout: 2000
        });

        await rootConn.query(`CREATE DATABASE IF NOT EXISTS \`${database}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;`);
        await rootConn.end();

        // Create connection pool
        pool = mysql.createPool({
            host,
            port,
            user,
            password,
            database,
            waitForConnections: true,
            connectionLimit: 10,
            queueLimit: 0
        });

        // Run schema.sql if tables do not exist
        const [tables] = await pool.query("SHOW TABLES LIKE 'users'");
        if (tables.length === 0) {
            console.log('Initializing MySQL tables from schema.sql...');
            const schemaSqlPath = path.join(__dirname, '../../database/schema.sql');
            if (fs.existsSync(schemaSqlPath)) {
                const schemaSql = fs.readFileSync(schemaSqlPath, 'utf8');
                const statements = schemaSql
                    .split(';')
                    .map(s => s.trim())
                    .filter(s => s.length > 0 && !s.startsWith('--') && !s.toLowerCase().startsWith('use '));

                for (const statement of statements) {
                    try {
                        await pool.query(statement);
                    } catch (e) {
                        // ignore minor duplicate errors during seed
                    }
                }
            }
        }

        // Backward-compatible migration for databases created before salary support.
        try {
            await pool.query('ALTER TABLE employees ADD COLUMN salary DECIMAL(12,2) NOT NULL DEFAULT 0.00 AFTER designation');
        } catch (migrationErr) {
            if (migrationErr.code !== 'ER_DUP_FIELDNAME') throw migrationErr;
        }

        console.log('✓ Successfully connected to MySQL database: ' + database);
        useFallbackDb = false;
    } catch (err) {
        console.warn(`[DB Notice] MySQL connection not established (${err.message}). Activating built-in persistent local database store.`);
        useFallbackDb = true;

        if (fs.existsSync(FALLBACK_DB_FILE)) {
            try {
                fallbackData = JSON.parse(fs.readFileSync(FALLBACK_DB_FILE, 'utf-8'));
            } catch (e) {
                fallbackData = await getSeedData();
                saveFallbackData();
            }
        } else {
            fallbackData = await getSeedData();
            saveFallbackData();
        }
        let fallbackUpdated = false;
        const demoSalaries = { ADM001: 2400000, HR001: 1800000, EMP001: 1500000, EMP002: 1400000, EMP003: 1300000 };
        (fallbackData.employees || []).forEach((employee) => {
            if (employee.salary === undefined) {
                employee.salary = demoSalaries[employee.employee_id] || 0;
                fallbackUpdated = true;
            }
        });
        if (fallbackUpdated) saveFallbackData();
        console.log('✓ Local database store initialized with full demo dataset.');
    }
}

/**
 * Universal Query Engine supporting MySQL pool & Fallback Store
 */
async function query(sql, params = []) {
    if (!useFallbackDb && pool) {
        const [results] = await pool.query(sql, params);
        return results;
    }

    return executeFallbackQuery(sql, params);
}

/**
 * Helper to execute standard SQL operations on local JSON state
 */
function executeFallbackQuery(sql, params = []) {
    const trimmed = sql.trim();
    const upper = trimmed.toUpperCase();

    // SELECT queries
    if (upper.startsWith('SELECT')) {
        return handleFallbackSelect(trimmed, params);
    }

    // INSERT queries
    if (upper.startsWith('INSERT')) {
        return handleFallbackInsert(trimmed, params);
    }

    // UPDATE queries
    if (upper.startsWith('UPDATE')) {
        return handleFallbackUpdate(trimmed, params);
    }

    // DELETE queries
    if (upper.startsWith('DELETE')) {
        return handleFallbackDelete(trimmed, params);
    }

    return [];
}

function handleFallbackSelect(sql, params) {
    const fromMatch = sql.match(/FROM\s+([a-zA-Z0-9_]+)/i);
    if (!fromMatch) return [];

    const primaryTable = fromMatch[1].toLowerCase();
    let records = fallbackData[primaryTable] ? [...fallbackData[primaryTable]] : [];

    // Simple join simulation if leave_types or employees joined
    if (/JOIN\s+leave_types/i.test(sql)) {
        records = records.map(r => {
            const lt = fallbackData.leave_types?.find(t => t.id === r.leave_type_id) || {};
            return {
                ...r,
                leave_type_name: lt.name,
                leave_type_code: lt.code,
                max_days: lt.max_days
            };
        });
    }

    if (/JOIN\s+employees/i.test(sql)) {
        records = records.map(r => {
            const emp = fallbackData.employees?.find(e => e.employee_id === r.employee_id) || {};
            return {
                ...r,
                employee_name: emp.full_name,
                full_name: emp.full_name,
                department: emp.department,
                designation: emp.designation,
                salary: emp.salary || 0,
                email: emp.email
            };
        });
    }

    if (/JOIN\s+users/i.test(sql)) {
        records = records.map(r => {
            const u = fallbackData.users?.find(usr => usr.employee_id === r.employee_id) || {};
            return {
                ...r,
                user_role: u.role,
                is_active: u.is_active
            };
        });
    }

    // Filter by WHERE clauses
    if (/WHERE/i.test(sql)) {
        let paramIndex = 0;
        const whereClause = sql.substring(sql.search(/WHERE/i) + 5);

        // Simple parameter matchers
        if (/u\.email\s*=\s*\?|email\s*=\s*\?/i.test(sql)) {
            const emailVal = params[paramIndex++];
            records = records.filter(r => r.email && r.email.toLowerCase() === (emailVal || '').toLowerCase());
        } else if (/employee_id\s*=\s*\?/i.test(sql)) {
            const empIdVal = params[paramIndex++];
            records = records.filter(r => r.employee_id === empIdVal);
        } else if (/r\.id\s*=\s*\?|id\s*=\s*\?/i.test(sql)) {
            const idVal = Number(params[paramIndex++]);
            records = records.filter(r => r.id === idVal);
        }

        if (/status\s*=\s*\?/i.test(whereClause)) {
            const statusVal = params[paramIndex++];
            records = records.filter(r => r.status === statusVal);
        }
    }

    // Simple ORDER BY
    if (/ORDER BY/i.test(sql)) {
        if (/created_at\s+DESC/i.test(sql) || /id\s+DESC/i.test(sql)) {
            records.sort((a, b) => (b.id || 0) - (a.id || 0));
        }
    }

    // Simple LIMIT
    const limitMatch = sql.match(/LIMIT\s+(\d+)/i);
    if (limitMatch) {
        const limitCount = parseInt(limitMatch[1], 10);
        records = records.slice(0, limitCount);
    }

    return records;
}

function handleFallbackInsert(sql, params) {
    const tableMatch = sql.match(/INSERT\s+INTO\s+([a-zA-Z0-9_]+)/i);
    if (!tableMatch) return { insertId: 0, affectedRows: 0 };

    const tableName = tableMatch[1].toLowerCase();
    if (!fallbackData[tableName]) fallbackData[tableName] = [];

    // Extract columns from (col1, col2, ...)
    const colsMatch = sql.match(/\(([^)]+)\)\s+VALUES/i);
    let newRecord = { id: (fallbackData[tableName].length ? Math.max(...fallbackData[tableName].map(r => r.id || 0)) + 1 : 1) };

    if (colsMatch) {
        const cols = colsMatch[1].split(',').map(c => c.trim().replace(/[`"]/g, ''));
        cols.forEach((col, idx) => {
            newRecord[col] = params[idx] !== undefined ? params[idx] : null;
        });
    }

    if (!newRecord.created_at) newRecord.created_at = new Date().toISOString().replace('T', ' ').substring(0, 19);
    if (!newRecord.updated_at) newRecord.updated_at = new Date().toISOString().replace('T', ' ').substring(0, 19);

    fallbackData[tableName].push(newRecord);
    saveFallbackData();

    return { insertId: newRecord.id, affectedRows: 1 };
}

function handleFallbackUpdate(sql, params) {
    const tableMatch = sql.match(/UPDATE\s+([a-zA-Z0-9_]+)/i);
    if (!tableMatch) return { affectedRows: 0 };

    const tableName = tableMatch[1].toLowerCase();
    const table = fallbackData[tableName];
    if (!table) return { affectedRows: 0 };

    // Update leave request status / action
    if (tableName === 'leave_requests' && /SET\s+status\s*=\s*\?/i.test(sql)) {
        const [status, rejReason, actionBy, actionAt, id] = params;
        const record = table.find(r => r.id === Number(id));
        if (record) {
            record.status = status;
            record.rejection_reason = rejReason || record.rejection_reason;
            record.action_by = actionBy || record.action_by;
            record.action_at = actionAt || new Date().toISOString().replace('T', ' ').substring(0, 19);
            saveFallbackData();
            return { affectedRows: 1 };
        }
    }

    // Update leave balances
    if (tableName === 'leave_balances' && /used_days/i.test(sql)) {
        const [used, avail, empId, ltId] = params;
        const record = table.find(r => r.employee_id === empId && r.leave_type_id === Number(ltId));
        if (record) {
            record.used_days = used;
            record.available_days = avail;
            saveFallbackData();
            return { affectedRows: 1 };
        }
    }

    // Update employees
    if (tableName === 'employees' && /WHERE\s+id\s*=\s*\?|WHERE\s+employee_id\s*=\s*\?/i.test(sql)) {
        const idParam = params[params.length - 1];
        const record = table.find(r => r.id === Number(idParam) || r.employee_id === idParam);
        if (record) {
            if (/full_name\s*=\s*\?/i.test(sql)) record.full_name = params[0];
            if (/phone\s*=\s*\?/i.test(sql)) record.phone = params[1];
            if (/department\s*=\s*\?/i.test(sql)) record.department = params[2];
            if (/designation\s*=\s*\?/i.test(sql)) record.designation = params[3];
            if (/salary\s*=\s*\?/i.test(sql)) record.salary = params[4];
            if (/status\s*=\s*\?/i.test(sql)) record.status = params[5] || params[0];
            saveFallbackData();
            return { affectedRows: 1 };
        }
    }

    // Update notification read
    if (tableName === 'notifications' && /is_read\s*=\s*1/i.test(sql)) {
        const idParam = params[0];
        const record = table.find(r => r.id === Number(idParam));
        if (record) {
            record.is_read = 1;
            saveFallbackData();
            return { affectedRows: 1 };
        }
    }

    saveFallbackData();
    return { affectedRows: 1 };
}

function handleFallbackDelete(sql, params) {
    const tableMatch = sql.match(/DELETE\s+FROM\s+([a-zA-Z0-9_]+)/i);
    if (!tableMatch) return { affectedRows: 0 };

    const tableName = tableMatch[1].toLowerCase();
    if (!fallbackData[tableName]) return { affectedRows: 0 };

    const idVal = Number(params[0]);
    const initialLen = fallbackData[tableName].length;
    fallbackData[tableName] = fallbackData[tableName].filter(r => r.id !== idVal);
    saveFallbackData();

    return { affectedRows: initialLen - fallbackData[tableName].length };
}

module.exports = {
    initDatabase,
    query,
    getFallbackData: () => fallbackData,
    saveFallbackData
};
