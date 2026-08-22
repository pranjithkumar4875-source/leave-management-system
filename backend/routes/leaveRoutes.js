const express = require('express');
const router = express.Router();
const path = require('path');
const multer = require('multer');
const fs = require('fs');
const leaveController = require('../controllers/leaveController');
const authMiddleware = require('../middleware/authMiddleware');
const roleMiddleware = require('../middleware/roleMiddleware');

// Configure disk storage for supporting documents
const uploadDir = path.join(__dirname, '../../uploads');
if (!fs.existsSync(uploadDir)) {
    fs.mkdirSync(uploadDir, { recursive: true });
}

const storage = multer.diskStorage({
    destination: (req, file, cb) => cb(null, uploadDir),
    filename: (req, file, cb) => {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        const ext = path.extname(file.originalname);
        cb(null, 'doc-' + uniqueSuffix + ext);
    }
});

const upload = multer({
    storage,
    limits: { fileSize: 10 * 1024 * 1024 } // 10MB limit
});

// Leave Endpoints
router.post('/', authMiddleware, upload.single('document'), leaveController.applyLeave);
router.get('/', authMiddleware, leaveController.getAllLeaves);
router.get('/balances/:employeeId?', authMiddleware, leaveController.getLeaveBalances);
router.get('/:id', authMiddleware, leaveController.getLeaveById);
router.delete('/:id', authMiddleware, leaveController.cancelLeave);

// Approvals & Rejections (Admin / HR only)
router.post('/:id/approve', authMiddleware, roleMiddleware(['admin', 'hr']), leaveController.approveLeave);
router.post('/:id/reject', authMiddleware, roleMiddleware(['admin', 'hr']), leaveController.rejectLeave);

module.exports = router;
