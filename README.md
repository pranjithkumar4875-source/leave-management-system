# Leave Request Management System (Full Stack)

A complete, production-ready, dark-themed Leave Request Management System built with **HTML5, CSS3, Vanilla JavaScript, Node.js, Express.js, JWT Authentication, bcrypt, and MySQL**.

---

## 🌟 Key Features

### 👤 Role-Based Portals
- **Employee Portal**:
  - Personalized Dashboard with real-time leave balance cards (Casual, Sick, Earned, Other).
  - Quick Leave Application with automatic day calculations (excluding weekends).
  - Overlap validation & balance sufficiency checks.
  - Attachment/document upload support.
  - Leave History table with status badges and ability to cancel pending requests.
  - Dedicated Leave Details inspector.
  - Real-time Notifications & Announcement feed.
  - Profile manager with password change security.

- **HR Portal**:
  - HR Operations Dashboard with real-time approval queues and absenteeism trackers.
  - Complete Staff Directory with leave quotas and profile viewers.
  - Leave Request Reviewer with one-click approvals and mandatory rejection reasoning.
  - Interactive monthly Leave Calendar with department/status filters.
  - Departmental and monthly Leave Reports with CSV export and print view.

- **Admin Portal**:
  - Executive Dashboard with department usage charts and monthly trends.
  - Staff Management (CRUD operations, activate/deactivate toggle, deletion).
  - CSV Employee Batch Importer with duplicate Employee ID & Email validation.
  - Global Leave Request management & approval workflow.
  - Leave Type & Quota Management (Add/Edit/Delete leave categories, maximum allowances).
  - Interactive Company Leave Calendar.
  - Multi-angle analytics and printable reports.
  - Immutable Security & System Audit Logs tracking all user actions.

---

## 🔐 Demo User Credentials

| Role | Email | Employee ID | Password | Access Dashboard |
| :--- | :--- | :--- | :--- | :--- |
| **Admin** | `admin@example.com` | `ADM001` | `admin123` | `/admin/admin-dashboard.html` |
| **HR Officer** | `hr@example.com` | `HR001` | `hr123` | `/hr/hr-dashboard.html` |
| **Employee 1** | `john.doe@example.com` | `EMP001` | `emp123` | `/employee/employee-dashboard.html` |
| **Employee 2** | `jane.smith@example.com` | `EMP002` | `emp123` | `/employee/employee-dashboard.html` |
| **Employee 3** | `alex.jones@example.com` | `EMP003` | `emp123` | `/employee/employee-dashboard.html` |

*(Tip: On the login page, you can click any of the quick demo chips to autofill credentials instantly!)*

---

## 🚀 Getting Started

### 1. Prerequisites
- **Node.js**: v18+ or LTS (v20+)
- **MySQL Database Server**: 5.7+ / 8.0+ *(Optional: The server includes an automatic built-in fallback store if MySQL service is not yet running on your machine)*.

### 2. Installation
1. Clone or open the repository folder.
2. Install npm dependencies:
```bash
npm install
```

### 3. Environment Configuration
Create or review the `.env` file in the root directory:
```env
PORT=3000
DB_HOST=localhost
DB_PORT=3306
DB_USER=root
DB_PASSWORD=your_mysql_password
DB_NAME=leave_management
JWT_SECRET=leave_management_super_secure_jwt_secret_key_2026
JWT_EXPIRES_IN=1d
```

### 4. Database Setup (MySQL)
To import the schema into your MySQL server manually:
```bash
mysql -u root -p < database/schema.sql
```
*Note: If MySQL is running, the backend server will automatically check and initialize the database tables on launch.*

### 5. Running the Application
Start the Node.js Express server:
```bash
npm start
```
or for development:
```bash
npm run dev
```

Open your browser and navigate to:
**`http://localhost:3000`** (or `http://localhost:3000/login.html`)

---

## 📁 Project Architecture

```
leave-management-system/
│
├── frontend/
│   ├── index.html                  # Landing & auto-redirect portal
│   ├── login.html                  # Authentication login page with quick demo chips
│   ├── register.html               # Employee registration with client-side validation
│   ├── forgot-password.html        # Password recovery and reset flow
│   │
│   ├── employee/
│   │   ├── employee-dashboard.html # Welcome banner, balance cards, stats, recent leaves
│   │   ├── employee-profile.html   # Personal info, contact details, password change
│   │   ├── apply-leave.html        # Apply form, real-time days calculator, balance check
│   │   ├── my-leaves.html          # Leave history table with status badges & cancellation
│   │   ├── leave-details.html      # Comprehensive leave request inspector
│   │   └── notifications.html      # Notification list with mark-as-read
│   │
│   ├── admin/
│   │   ├── admin-dashboard.html    # Company metrics, department usage & monthly charts
│   │   ├── manage-employees.html   # Employee table, search, filter, pagination, edit
│   │   ├── employee-details.html   # Staff details, quotas, and historical requests
│   │   ├── import-employees.html   # Batch CSV import with preview and validation
│   │   ├── manage-leaves.html      # Full leave queue, approvals & rejection with reason
│   │   ├── leave-calendar.html     # Interactive schedule view with filters
│   │   ├── reports.html            # Monthly, dept, employee analytics, CSV export, print
│   │   ├── leave-types.html        # Add/edit/delete leave types and allowances
│   │   └── audit-logs.html         # Audit trail for logins, applications, and updates
│   │
│   ├── hr/
│   │   ├── hr-dashboard.html       # HR overview, pending queue, attendance metrics
│   │   ├── hr-employees.html       # Staff directory viewer
│   │   ├── hr-leave-requests.html  # Process leave requests
│   │   ├── hr-calendar.html        # Company leave schedule
│   │   ├── hr-reports.html         # HR analytics with CSV/print
│   │   ├── hr-profile.html         # HR profile manager
│   │   └── employee-details.html   # Employee details viewer
│   │
│   ├── css/
│   │   ├── style.css               # Design system, CSS variables, tokens, badges, modals
│   │   ├── auth.css                # Authentication layout and demo cards
│   │   ├── dashboard.css           # Sidebar, navbar, stat cards, responsive charts
│   │   ├── tables.css              # Data tables, pagination, action buttons
│   │   └── responsive.css          # Mobile drawer and print media stylesheet
│   │
│   └── js/
│       ├── api.js                  # Central API client with Bearer token injection
│       ├── auth.js                 # Login, logout, JWT management, requireRole guard
│       ├── common.js               # Sidebar generator, navbar, toasts, modal helpers
│       ├── dashboard.js            # Dashboard data loader and visualization charts
│       ├── leaves.js               # Apply form, days calculation, approvals, rejections
│       ├── employees.js            # Employee directory CRUD and CSV parser
│       ├── calendar.js             # Interactive monthly calendar engine
│       ├── reports.js              # Aggregated report builder and CSV/print generator
│       └── notifications.js        # Notification feeds and updates
│
├── backend/
│   ├── server.js                   # Express server, CORS, static routing, error handling
│   ├── config/
│   │   └── db.js                   # MySQL pool + local resilient fallback store
│   ├── controllers/
│   │   ├── authController.js       # Auth, login, register, password change & reset
│   │   ├── employeeController.js   # Employee CRUD, search, pagination, CSV import
│   │   ├── leaveController.js      # Leave requests, balance deductions, approvals
│   │   ├── leaveTypeController.js  # Category management and balance allocation
│   │   ├── reportController.js     # Analytics aggregations
│   │   ├── calendarController.js   # Calendar event scheduler
│   │   ├── notificationController.js # Notifications and read updates
│   │   ├── auditController.js      # Audit log retrieval
│   │   └── dashboardController.js  # Role-tailored metrics
│   ├── middleware/
│   │   ├── authMiddleware.js       # JWT verification
│   │   └── roleMiddleware.js       # Role-Based Access Control (RBAC)
│   ├── routes/                     # REST API routing endpoints
│   └── utils/
│       ├── auditLogger.js          # Audit logging helper
│       └── dateHelper.js           # Working days calculation & date formatting
│
├── database/
│   └── schema.sql                  # Complete MySQL DDL & initial demo seed dataset
│
├── uploads/                        # Supporting document attachments directory
├── .env                            # Environment configuration
├── .env.example                    # Environment template
└── package.json                    # Dependencies and scripts
```

---

## 🛡️ Security & Business Logic Highlights

1. **JWT Authentication & Passwords**:
   - Industry-standard JWT tokens with expiration handling.
   - Passwords hashed securely using `bcrypt` (10 salt rounds). Plaintext passwords are never stored.

2. **Role-Based Authorization**:
   - Routes protected on both backend (`roleMiddleware`) and frontend (`requireRole`).
   - If an employee tries to open an Admin or HR URL directly, the system blocks access and redirects appropriately.

3. **Leave Processing Integrity**:
   - Dates validated (`End Date >= Start Date`, valid format).
   - Weekends automatically excluded from standard leave day counts.
   - Overlapping leave applications for the same employee are prevented.
   - Leave balances verified before submission.
   - Leave balances are deducted **only upon approval**. Rejections leave the balance intact.
   - Rejection requires an explicit reason/remarks recorded for the employee.

4. **Audit Trail**:
   - All critical actions (`User logged in`, `Leave request created`, `Leave request approved`, `Leave request rejected`, `Employee updated`, `Employee imported`, `Password changed`) are logged with timestamps, user details, and IP addresses.
