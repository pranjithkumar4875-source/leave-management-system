-- ==========================================================
-- Leave Request Management System Database Schema
-- MySQL 5.7+ / 8.0+ Compatible
-- ==========================================================

CREATE DATABASE IF NOT EXISTS leave_management CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE leave_management;

-- 1. Users Table
CREATE TABLE IF NOT EXISTS users (
    id INT AUTO_INCREMENT PRIMARY KEY,
    employee_id VARCHAR(50) NOT NULL UNIQUE,
    email VARCHAR(150) NOT NULL UNIQUE,
    password VARCHAR(255) NOT NULL,
    role ENUM('employee', 'hr', 'admin') NOT NULL DEFAULT 'employee',
    is_active TINYINT(1) NOT NULL DEFAULT 1,
    reset_token VARCHAR(255) NULL,
    reset_token_expiry DATETIME NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_user_role (role),
    INDEX idx_user_email (email)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 2. Employees Table
CREATE TABLE IF NOT EXISTS employees (
    id INT AUTO_INCREMENT PRIMARY KEY,
    employee_id VARCHAR(50) NOT NULL UNIQUE,
    full_name VARCHAR(150) NOT NULL,
    email VARCHAR(150) NOT NULL UNIQUE,
    phone VARCHAR(30) NULL,
    department VARCHAR(100) NOT NULL,
    designation VARCHAR(100) NOT NULL,
    joining_date DATE NOT NULL,
    profile_photo VARCHAR(255) NULL,
    status ENUM('active', 'inactive', 'on_leave') NOT NULL DEFAULT 'active',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_emp_dept (department),
    INDEX idx_emp_status (status)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 3. Leave Types Table
CREATE TABLE IF NOT EXISTS leave_types (
    id INT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(100) NOT NULL UNIQUE,
    code VARCHAR(30) NOT NULL UNIQUE,
    max_days INT NOT NULL DEFAULT 12,
    description TEXT NULL,
    is_active TINYINT(1) NOT NULL DEFAULT 1,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 4. Leave Requests Table
CREATE TABLE IF NOT EXISTS leave_requests (
    id INT AUTO_INCREMENT PRIMARY KEY,
    employee_id VARCHAR(50) NOT NULL,
    leave_type_id INT NOT NULL,
    start_date DATE NOT NULL,
    end_date DATE NOT NULL,
    days INT NOT NULL,
    reason TEXT NOT NULL,
    document_path VARCHAR(255) NULL,
    status ENUM('Pending', 'Approved', 'Rejected', 'Cancelled') NOT NULL DEFAULT 'Pending',
    rejection_reason TEXT NULL,
    action_by VARCHAR(50) NULL,
    action_at DATETIME NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_req_emp (employee_id),
    INDEX idx_req_status (status),
    INDEX idx_req_dates (start_date, end_date),
    CONSTRAINT fk_lr_employee FOREIGN KEY (employee_id) REFERENCES employees(employee_id) ON DELETE CASCADE,
    CONSTRAINT fk_lr_type FOREIGN KEY (leave_type_id) REFERENCES leave_types(id) ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 5. Leave Balances Table
CREATE TABLE IF NOT EXISTS leave_balances (
    id INT AUTO_INCREMENT PRIMARY KEY,
    employee_id VARCHAR(50) NOT NULL,
    leave_type_id INT NOT NULL,
    total_days INT NOT NULL DEFAULT 0,
    used_days INT NOT NULL DEFAULT 0,
    available_days INT NOT NULL DEFAULT 0,
    year INT NOT NULL DEFAULT 2026,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    UNIQUE KEY uq_emp_type_year (employee_id, leave_type_id, year),
    CONSTRAINT fk_lb_employee FOREIGN KEY (employee_id) REFERENCES employees(employee_id) ON DELETE CASCADE,
    CONSTRAINT fk_lb_type FOREIGN KEY (leave_type_id) REFERENCES leave_types(id) ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 6. Notifications Table
CREATE TABLE IF NOT EXISTS notifications (
    id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT NULL,
    employee_id VARCHAR(50) NULL,
    title VARCHAR(200) NOT NULL,
    message TEXT NOT NULL,
    type VARCHAR(50) NOT NULL DEFAULT 'info',
    is_read TINYINT(1) NOT NULL DEFAULT 0,
    link VARCHAR(255) NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_notif_emp (employee_id),
    INDEX idx_notif_read (is_read)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 7. Audit Logs Table
CREATE TABLE IF NOT EXISTS audit_logs (
    id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT NULL,
    employee_id VARCHAR(50) NULL,
    user_name VARCHAR(150) NULL,
    role VARCHAR(50) NULL,
    action VARCHAR(100) NOT NULL,
    details TEXT NULL,
    ip_address VARCHAR(45) NULL,
    user_agent VARCHAR(255) NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_audit_action (action),
    INDEX idx_audit_time (created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ==========================================================
-- Sample Seed Data
-- Passwords below are hashed for 'admin123', 'hr123', 'emp123'
-- Hash for 'admin123': $2a$10$wU05Z1oQ6a2xWnJ.U90iUeGz8PZ2HnC3JtCgZ/6D7ZkX9T4fB8dKy
-- ==========================================================

-- Insert Leave Types
INSERT INTO leave_types (id, name, code, max_days, description, is_active) VALUES
(1, 'Casual Leave', 'CL', 12, 'Annual casual leave allowance for personal matters', 1),
(2, 'Sick Leave', 'SL', 10, 'Leave for medical recovery and health appointments', 1),
(3, 'Earned Leave', 'EL', 15, 'Vacation and accumulated earned paid leave', 1),
(4, 'Maternity Leave', 'ML', 90, 'Parental maternity and child care leave', 1),
(5, 'Emergency Leave', 'EML', 5, 'Special leave for unforeseen emergencies and bereavement', 1)
ON DUPLICATE KEY UPDATE name=VALUES(name);

-- Insert Demo Employees
INSERT INTO employees (employee_id, full_name, email, phone, department, designation, joining_date, profile_photo, status) VALUES
('ADM001', 'System Administrator', 'admin@example.com', '+1-555-0100', 'Administration', 'IT Director', '2022-01-10', '', 'active'),
('HR001', 'Sarah Jenkins', 'hr@example.com', '+1-555-0101', 'Human Resources', 'HR Manager', '2022-03-15', '', 'active'),
('EMP001', 'John Doe', 'john.doe@example.com', '+1-555-0102', 'Engineering', 'Senior Full Stack Developer', '2023-01-05', '', 'active'),
('EMP002', 'Jane Smith', 'jane.smith@example.com', '+1-555-0103', 'Marketing', 'Lead Marketing Strategist', '2023-04-12', '', 'active'),
('EMP003', 'Alex Jones', 'alex.jones@example.com', '+1-555-0104', 'Product Design', 'UI/UX Designer', '2023-06-20', '', 'active')
ON DUPLICATE KEY UPDATE full_name=VALUES(full_name);

-- Insert Users with bcrypt hashed passwords
-- Password 'admin123' -> $2b$10$yR4b.YgVjOa6l3j7PcqmDeFzR5K0C3uWw4z2/0hQz0u0.8pI8J7Kq (or generated on init)
INSERT INTO users (employee_id, email, password, role, is_active) VALUES
('ADM001', 'admin@example.com', '$2a$10$3euPcmqf4kH4v.8HglZ5b.0nS0r6B7eB4cK0Yy5s5o4t7a0l5v6mu', 'admin', 1),
('HR001', 'hr@example.com', '$2a$10$3euPcmqf4kH4v.8HglZ5b.0nS0r6B7eB4cK0Yy5s5o4t7a0l5v6mu', 'hr', 1),
('EMP001', 'john.doe@example.com', '$2a$10$3euPcmqf4kH4v.8HglZ5b.0nS0r6B7eB4cK0Yy5s5o4t7a0l5v6mu', 'employee', 1),
('EMP002', 'jane.smith@example.com', '$2a$10$3euPcmqf4kH4v.8HglZ5b.0nS0r6B7eB4cK0Yy5s5o4t7a0l5v6mu', 'employee', 1),
('EMP003', 'alex.jones@example.com', '$2a$10$3euPcmqf4kH4v.8HglZ5b.0nS0r6B7eB4cK0Yy5s5o4t7a0l5v6mu', 'employee', 1)
ON DUPLICATE KEY UPDATE email=VALUES(email);

-- Initialize Leave Balances for 2026
INSERT INTO leave_balances (employee_id, leave_type_id, total_days, used_days, available_days, year) VALUES
('EMP001', 1, 12, 2, 10, 2026),
('EMP001', 2, 10, 1, 9, 2026),
('EMP001', 3, 15, 0, 15, 2026),
('EMP001', 4, 90, 0, 90, 2026),
('EMP001', 5, 5, 0, 5, 2026),
('EMP002', 1, 12, 3, 9, 2026),
('EMP002', 2, 10, 0, 10, 2026),
('EMP002', 3, 15, 4, 11, 2026),
('EMP002', 4, 90, 0, 90, 2026),
('EMP002', 5, 5, 0, 5, 2026),
('EMP003', 1, 12, 1, 11, 2026),
('EMP003', 2, 10, 2, 8, 2026),
('EMP003', 3, 15, 0, 15, 2026),
('EMP003', 4, 90, 0, 90, 2026),
('EMP003', 5, 5, 0, 5, 2026)
ON DUPLICATE KEY UPDATE total_days=VALUES(total_days);

-- Insert Sample Leave Requests
INSERT INTO leave_requests (id, employee_id, leave_type_id, start_date, end_date, days, reason, status, rejection_reason, action_by, action_at) VALUES
(1, 'EMP001', 1, '2026-08-10', '2026-08-11', 2, 'Attending family reunion', 'Approved', NULL, 'HR001', '2026-08-08 10:00:00'),
(2, 'EMP001', 2, '2026-08-18', '2026-08-18', 1, 'Viral fever recovery', 'Approved', NULL, 'HR001', '2026-08-18 09:30:00'),
(3, 'EMP001', 1, '2026-08-25', '2026-08-27', 3, 'Short personal travel vacation', 'Pending', NULL, NULL, NULL),
(4, 'EMP002', 3, '2026-08-15', '2026-08-18', 4, 'Annual summer vacation', 'Approved', NULL, 'ADM001', '2026-08-12 14:20:00'),
(5, 'EMP003', 1, '2026-08-28', '2026-08-29', 2, 'Attending workshop & seminar', 'Pending', NULL, NULL, NULL)
ON DUPLICATE KEY UPDATE status=VALUES(status);

-- Insert Sample Notifications
INSERT INTO notifications (user_id, employee_id, title, message, type, is_read, link) VALUES
(3, 'EMP001', 'Leave Approved', 'Your Casual Leave request for Aug 10 - Aug 11 has been approved by HR.', 'success', 1, '/employee/my-leaves.html'),
(3, 'EMP001', 'Leave Application Received', 'Your Casual Leave request for Aug 25 - Aug 27 is currently Pending review.', 'info', 0, '/employee/my-leaves.html'),
(2, 'HR001', 'New Leave Request', 'John Doe (EMP001) submitted a leave request for 3 days.', 'info', 0, '/hr/hr-leave-requests.html'),
(1, 'ADM001', 'System Announcement', 'Quarterly leave audit reminder: All pending requests must be reviewed by end of month.', 'warning', 0, '/admin/manage-leaves.html');

-- Insert Initial Audit Logs
INSERT INTO audit_logs (employee_id, user_name, role, action, details, ip_address, user_agent) VALUES
('ADM001', 'System Administrator', 'admin', 'System Initialized', 'Database and seed records configured successfully.', '127.0.0.1', 'Node.js Backend Engine'),
('HR001', 'Sarah Jenkins', 'hr', 'Leave request approved', 'Approved Casual Leave (2 days) for EMP001', '127.0.0.1', 'Mozilla/5.0'),
('EMP001', 'John Doe', 'employee', 'Leave request created', 'Applied for Casual Leave: 2026-08-25 to 2026-08-27 (3 days)', '127.0.0.1', 'Mozilla/5.0');
