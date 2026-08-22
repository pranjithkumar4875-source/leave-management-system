const express = require('express');
const router = express.Router();
const leaveTypeController = require('../controllers/leaveTypeController');
const authMiddleware = require('../middleware/authMiddleware');
const roleMiddleware = require('../middleware/roleMiddleware');

// Anyone authenticated can view active leave types
router.get('/', authMiddleware, leaveTypeController.getAllLeaveTypes);

// Admin only operations
router.post('/', authMiddleware, roleMiddleware(['admin']), leaveTypeController.createLeaveType);
router.put('/:id', authMiddleware, roleMiddleware(['admin']), leaveTypeController.updateLeaveType);
router.delete('/:id', authMiddleware, roleMiddleware(['admin']), leaveTypeController.deleteLeaveType);

module.exports = router;
