const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
require('dotenv').config();

const { initDatabase } = require('./config/db');

// Import routes
const authRoutes = require('./routes/authRoutes');
const employeeRoutes = require('./routes/employeeRoutes');
const leaveRoutes = require('./routes/leaveRoutes');
const leaveTypeRoutes = require('./routes/leaveTypeRoutes');
const reportRoutes = require('./routes/reportRoutes');
const calendarRoutes = require('./routes/calendarRoutes');
const notificationRoutes = require('./routes/notificationRoutes');
const auditRoutes = require('./routes/auditRoutes');
const dashboardRoutes = require('./routes/dashboardRoutes');

const app = express();
const PORT = process.env.PORT || 3000;

// Enable CORS & JSON parsing
app.use(cors({
    origin: '*',
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization']
}));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Ensure uploads folder exists
const uploadsDir = path.join(__dirname, '../uploads');
if (!fs.existsSync(uploadsDir)) {
    fs.mkdirSync(uploadsDir, { recursive: true });
}
app.use('/uploads', express.static(uploadsDir));

// Serve Frontend static assets
const frontendDir = path.join(__dirname, '../frontend');
app.use(express.static(frontendDir));

// Health check endpoint
app.get('/api/health', (req, res) => {
    res.json({ status: 'ok', time: new Date().toISOString() });
});

// API Routes
app.use('/api/auth', authRoutes);
app.use('/api/employees', employeeRoutes);
app.use('/api/leaves', leaveRoutes);
app.use('/api/leave-types', leaveTypeRoutes);
app.use('/api/reports', reportRoutes);
app.use('/api/calendar', calendarRoutes);
app.use('/api/notifications', notificationRoutes);
app.use('/api/audit-logs', auditRoutes);
app.use('/api/dashboard', dashboardRoutes);

// Fallback for SPA/HTML direct routes or root redirect
app.get('/', (req, res) => {
    res.sendFile(path.join(frontendDir, 'index.html'));
});

// 404 handler for API routes
app.use('/api/*', (req, res) => {
    res.status(404).json({ success: false, message: 'API route not found' });
});

// Global Centralized Error Handler
app.use((err, req, res, next) => {
    console.error('Unhandled Application Error:', err.stack || err);
    res.status(err.status || 500).json({
        success: false,
        message: err.message || 'Internal Server Error. Please contact system administrator.'
    });
});

// Start Server and Initialize DB
async function startServer() {
    await initDatabase();
    app.listen(PORT, () => {
        console.log(`=======================================================`);
        console.log(`🚀 Leave Request Management System is RUNNING!`);
        console.log(`🌐 Server URL: http://localhost:${PORT}`);
        console.log(`📄 Frontend UI: http://localhost:${PORT}/login.html`);
        console.log(`=======================================================`);
    });
}

startServer().catch(err => {
    console.error('Failed to start server:', err);
});

module.exports = app;
