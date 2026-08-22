const express = require('express');
const router = express.Router();
const auditController = require('../controllers/auditController');
const authMiddleware = require('../middleware/authMiddleware');
const roleMiddleware = require('../middleware/roleMiddleware');

// Protected: Admin only
router.get('/', authMiddleware, roleMiddleware(['admin']), auditController.getAuditLogs);

module.exports = router;
