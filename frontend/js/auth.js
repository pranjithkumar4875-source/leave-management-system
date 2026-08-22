/**
 * Frontend Authentication Utility & Route Guard
 */

const Auth = {
    /**
     * Authenticate with email/employee ID and password
     */
    async login(emailOrId, password) {
        const response = await API.post('/auth/login', { emailOrId, password });
        if (response.success && response.token) {
            localStorage.setItem('lms_token', response.token);
            localStorage.setItem('lms_user', JSON.stringify(response.user));
            return response;
        }
        throw new Error(response.message || 'Login failed');
    },

    /**
     * Clear auth tokens and redirect to login page
     */
    async logout() {
        try {
            await API.post('/auth/logout', {});
        } catch (e) {
            // Ignore if backend logout fails
        }
        localStorage.removeItem('lms_token');
        localStorage.removeItem('lms_user');
        window.location.href = '/login.html';
    },

    /**
     * Get stored JWT token
     */
    getToken() {
        return localStorage.getItem('lms_token');
    },

    /**
     * Get currently logged-in user profile
     */
    getCurrentUser() {
        const userStr = localStorage.getItem('lms_user');
        try {
            return userStr ? JSON.parse(userStr) : null;
        } catch (e) {
            return null;
        }
    },

    /**
     * Check if user is currently authenticated
     */
    isAuthenticated() {
        return !!this.getToken() && !!this.getCurrentUser();
    },

    /**
     * Route protection: requires user to be logged in
     */
    requireAuth() {
        if (!this.isAuthenticated()) {
            window.location.href = '/login.html';
            return false;
        }
        return true;
    },

    /**
     * Role-based Route Guard: requires user to have one of the allowed roles
     * Redirects to the user's appropriate home portal if unauthorized
     */
    requireRole(allowedRoles) {
        if (!this.requireAuth()) return false;

        const user = this.getCurrentUser();
        const roles = Array.isArray(allowedRoles) ? allowedRoles : [allowedRoles];

        if (!roles.includes(user.role)) {
            // Redirect to appropriate dashboard
            alert(`Unauthorized access! You do not have permission for this portal.`);
            if (user.role === 'admin') {
                window.location.href = '/admin/admin-dashboard.html';
            } else if (user.role === 'hr') {
                window.location.href = '/hr/hr-dashboard.html';
            } else {
                window.location.href = '/employee/employee-dashboard.html';
            }
            return false;
        }

        return true;
    },

    /**
     * Redirect user to their corresponding role dashboard after login
     */
    redirectByRole(role) {
        if (role === 'admin') {
            window.location.href = '/admin/admin-dashboard.html';
        } else if (role === 'hr') {
            window.location.href = '/hr/hr-dashboard.html';
        } else {
            window.location.href = '/employee/employee-dashboard.html';
        }
    }
};

window.Auth = Auth;
