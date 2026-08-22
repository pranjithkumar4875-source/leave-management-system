const express = require('express');
const router = express.Router();
const calendarController = require('../controllers/calendarController');
const authMiddleware = require('../middleware/authMiddleware');

router.get('/', authMiddleware, calendarController.getCalendarEvents);

module.exports = router;
