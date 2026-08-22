const db = require('../config/db');

/**
 * Get user notifications
 */
async function getNotifications(req, res) {
    try {
        const employeeId = req.user.employeeId;
        const userId = req.user.userId;

        // Fetch notifications specific to this user or employee
        let notifications = await db.query(
            `SELECT * FROM notifications
             WHERE employee_id = ? OR user_id = ? OR employee_id IS NULL
             ORDER BY id DESC
             LIMIT 50`,
            [employeeId, userId]
        );

        const unreadCount = notifications.filter(n => n.is_read === 0).length;

        return res.json({
            success: true,
            unreadCount,
            notifications
        });
    } catch (err) {
        console.error('getNotifications error:', err);
        return res.status(500).json({ success: false, message: 'Failed to retrieve notifications.' });
    }
}

/**
 * Mark a notification as read
 */
async function markAsRead(req, res) {
    try {
        const id = req.params.id;
        await db.query('UPDATE notifications SET is_read = 1 WHERE id = ?', [id]);
        return res.json({ success: true, message: 'Notification marked as read.' });
    } catch (err) {
        console.error('markAsRead error:', err);
        return res.status(500).json({ success: false, message: 'Failed to update notification.' });
    }
}

/**
 * Mark all notifications as read
 */
async function markAllAsRead(req, res) {
    try {
        const employeeId = req.user.employeeId;
        await db.query('UPDATE notifications SET is_read = 1 WHERE employee_id = ? OR user_id = ?', [employeeId, req.user.userId]);
        return res.json({ success: true, message: 'All notifications marked as read.' });
    } catch (err) {
        console.error('markAllAsRead error:', err);
        return res.status(500).json({ success: false, message: 'Failed to mark notifications as read.' });
    }
}

module.exports = {
    getNotifications,
    markAsRead,
    markAllAsRead
};
