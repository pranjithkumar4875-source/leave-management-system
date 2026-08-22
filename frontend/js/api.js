/**
 * Unified API Client for Leave Request Management System
 */

const API_BASE = '/api';

const API = {
    /**
     * Generic fetch wrapper with Bearer token and automatic JSON parsing
     */
    async request(endpoint, options = {}) {
        const token = localStorage.getItem('lms_token');
        const headers = options.headers || {};

        if (token) {
            headers['Authorization'] = `Bearer ${token}`;
        }

        if (!(options.body instanceof FormData)) {
            headers['Content-Type'] = 'application/json';
        }

        const config = {
            ...options,
            headers
        };

        try {
            const response = await fetch(`${API_BASE}${endpoint}`, config);
            const data = await response.json().catch(() => ({}));

            if (!response.ok) {
                // If 401 Unauthorized or Session Expired, redirect to login
                if (response.status === 401 && !window.location.pathname.includes('login.html')) {
                    localStorage.removeItem('lms_token');
                    localStorage.removeItem('lms_user');
                    window.location.href = '/login.html?expired=true';
                }

                throw new Error(data.message || `Request failed with status ${response.status}`);
            }

            return data;
        } catch (error) {
            console.error(`API Error [${endpoint}]:`, error.message);
            throw error;
        }
    },

    // HTTP Methods
    get(endpoint) {
        return this.request(endpoint, { method: 'GET' });
    },

    post(endpoint, body) {
        return this.request(endpoint, {
            method: 'POST',
            body: body instanceof FormData ? body : JSON.stringify(body)
        });
    },

    put(endpoint, body) {
        return this.request(endpoint, {
            method: 'PUT',
            body: body instanceof FormData ? body : JSON.stringify(body)
        });
    },

    delete(endpoint) {
        return this.request(endpoint, { method: 'DELETE' });
    }
};

window.API = API;
