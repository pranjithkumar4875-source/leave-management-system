/**
 * Middleware for Role-Based Access Control (RBAC)
 * @param {Array<string>|string} allowedRoles - Role(s) permitted to access the route
 */
function roleMiddleware(allowedRoles) {
    return (req, res, next) => {
        if (!req.user || !req.user.role) {
            return res.status(401).json({
                success: false,
                message: 'Authentication required before verifying role.'
            });
        }

        const roles = Array.isArray(allowedRoles) ? allowedRoles : [allowedRoles];

        if (!roles.includes(req.user.role)) {
            return res.status(403).json({
                success: false,
                message: `You are not authorized. Required role: [${roles.join(', ')}], your role: '${req.user.role}'.`
            });
        }

        next();
    };
}

module.exports = roleMiddleware;
