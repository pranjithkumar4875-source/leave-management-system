const express = require('express');
const router = express.Router();
const multer = require('multer');
const employeeController = require('../controllers/employeeController');
const authMiddleware = require('../middleware/authMiddleware');
const roleMiddleware = require('../middleware/roleMiddleware');

// Configure memory storage for CSV upload
const upload = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: 5 * 1024 * 1024 } // 5MB
});

// Protected: All employees can fetch profile, HR/Admin can view all
router.get('/', authMiddleware, roleMiddleware(['admin', 'hr']), employeeController.getAllEmployees);
router.get('/:id', authMiddleware, employeeController.getEmployeeById);
router.put('/:id', authMiddleware, employeeController.updateEmployee);

// Admin only routes
router.delete('/:id', authMiddleware, roleMiddleware(['admin']), employeeController.deleteEmployee);
router.post('/import', authMiddleware, roleMiddleware(['admin']), upload.single('file'), employeeController.importEmployees);

module.exports = router;
