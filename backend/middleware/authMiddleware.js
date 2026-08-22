const jwt = require('jsonwebtoken');
require('dotenv').config();

const JWT_SECRET = process.env.JWT_SECRET || 'leave_management_super_secure_jwt_secret_key_2026';

/**
 * Middleware to verify JWT Token on protected routes
 */
function authMiddleware(req, res, next) {
    try {
        const authHeader = req.headers.authorization || req.headers.Authorization;

        if (!authHeader || !authHeader.startsWith('Bearer ')) {
            return res.status(401).json({
                success: false,
                message: 'Access denied. No token provided or invalid format.'
            });
        }

        const token = authHeader.split(' ')[1];

        if (!token) {
            return res.status(401).json({
                success: false,
                message: 'Access denied. Token missing.'
            });
        }

        const decoded = jwt.verify(token, JWT_SECRET);
        req.user = decoded; // Contains userId, employeeId, role, email, etc.
        next();
    } catch (err) {
        if (err.name === 'TokenExpiredError') {
            return res.status(401).json({
                success: false,
                message: 'Session expired. Please log in again.'
            });
        }
        return res.status(401).json({
            success: false,
            message: 'Invalid or malformed authentication token.'
        });
    }
}

module.exports = authMiddleware;
