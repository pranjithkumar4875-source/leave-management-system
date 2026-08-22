/**
 * Notifications Logic
 */

async function loadNotificationsPage() {
    const listContainer = document.getElementById('notificationsList');
    if (!listContainer) return;

    try {
        const res = await API.get('/notifications');
        const notifs = res.notifications || [];

        if (notifs.length === 0) {
            listContainer.innerHTML = `
                <div class="table-empty">
                    <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9"></path>
                    </svg>
                    <p>No notifications yet.</p>
                </div>
            `;
            return;
        }

        listContainer.innerHTML = notifs.map(n => `
            <div style="padding:18px; border-bottom:1px solid var(--surface-border); display:flex; align-items:flex-start; justify-content:space-between; gap:16px; background:${n.is_read ? 'transparent' : 'rgba(99, 102, 241, 0.05)'};">
                <div>
                    <div style="display:flex; align-items:center; gap:8px; margin-bottom:4px;">
                        <strong>${n.title}</strong>
                        ${!n.is_read ? `<span class="badge badge-role" style="font-size:9px; padding:1px 5px;">New</span>` : ''}
                    </div>
                    <p style="color:var(--text-secondary); font-size:13px; margin-bottom:6px;">${n.message}</p>
                    <small class="text-muted">${formatDate(n.created_at)}</small>
                </div>
                <div>
                    ${!n.is_read ? `
                        <button class="btn btn-outline btn-sm" onclick="markNotificationRead(${n.id})">Mark as Read</button>
                    ` : `
                        <span class="text-muted" style="font-size:12px;">Read</span>
                    `}
                </div>
            </div>
        `).join('');
    } catch (err) {
        showToast('Failed to load notifications: ' + err.message, 'danger');
    }
}

async function markNotificationRead(id) {
    try {
        await API.put(`/notifications/${id}/read`, {});
        loadNotificationsPage();
    } catch (err) {
        showToast(err.message, 'danger');
    }
}

async function markAllNotificationsRead() {
    try {
        await API.put('/notifications/read-all', {});
        showToast('All notifications marked as read', 'success');
        loadNotificationsPage();
    } catch (err) {
        showToast(err.message, 'danger');
    }
}
