/**
 * Dashboard Component Logic (Employee, HR, Admin)
 */

async function loadDashboardData() {
    try {
        const response = await API.get('/dashboard/stats');
        if (!response.success) return;

        const { role, stats, recentRequests, leaveBalances, notifications, departmentUsage, monthlyChart } = response;

        // 1. If Employee Dashboard
        if (role === 'employee') {
            // Update Stat counters
            const elTotal = document.getElementById('statTotalLeave');
            const elAvail = document.getElementById('statAvailLeave');
            const elUsed = document.getElementById('statUsedLeave');
            const elPending = document.getElementById('statPending');

            if (elTotal) elTotal.textContent = stats.totalLeave || 0;
            if (elAvail) elAvail.textContent = stats.availableLeave || 0;
            if (elUsed) elUsed.textContent = stats.usedLeave || 0;
            if (elPending) elPending.textContent = stats.pendingRequests || 0;

            // Render category cards (Casual, Sick, Earned, Other)
            const balanceCardsContainer = document.getElementById('leaveBalanceCards');
            if (balanceCardsContainer && leaveBalances) {
                balanceCardsContainer.innerHTML = leaveBalances.map(b => `
                    <div class="stat-card">
                        <div class="stat-top">
                            <span class="stat-title">${b.leave_type_name}</span>
                            <span class="badge ${b.available_days > 0 ? 'badge-approved' : 'badge-rejected'}">${b.available_days} Left</span>
                        </div>
                        <div class="stat-value">${b.available_days} <small style="font-size:13px; font-weight:normal; color:var(--text-muted);">/ ${b.total_days} days</small></div>
                        <div class="stat-subtitle">Used: ${b.used_days} days this year</div>
                    </div>
                `).join('');
            }

            // Render Recent Requests Table
            const recentTableBody = document.getElementById('recentLeavesTable');
            if (recentTableBody) {
                if (!recentRequests || recentRequests.length === 0) {
                    recentTableBody.innerHTML = `<tr><td colspan="6" class="table-empty">No leave requests found.</td></tr>`;
                } else {
                    recentTableBody.innerHTML = recentRequests.map(r => `
                        <tr>
                            <td class="cell-primary">#REQ-${r.id}</td>
                            <td>${r.leave_type_name}</td>
                            <td>${formatDate(r.start_date)} &rarr; ${formatDate(r.end_date)}</td>
                            <td><strong>${r.days}</strong> day(s)</td>
                            <td><span class="badge badge-${r.status.toLowerCase()}">${r.status}</span></td>
                            <td>
                                <a href="/employee/leave-details.html?id=${r.id}" class="btn btn-outline btn-sm">Details</a>
                            </td>
                        </tr>
                    `).join('');
                }
            }

            // Render Recent Notifications Widget
            const notifWidget = document.getElementById('dashboardNotifWidget');
            if (notifWidget && notifications) {
                if (notifications.length === 0) {
                    notifWidget.innerHTML = `<p class="text-muted" style="font-size:13px;">No new notifications</p>`;
                } else {
                    notifWidget.innerHTML = notifications.map(n => `
                        <div style="padding:10px; border-bottom:1px solid var(--surface-border); font-size:13px;">
                            <div style="font-weight:600; color:var(--text-primary); margin-bottom:2px;">${n.title}</div>
                            <div style="color:var(--text-secondary); font-size:12px;">${n.message}</div>
                        </div>
                    `).join('');
                }
            }
        }

        // 2. If HR or Admin Dashboard
        if (role === 'admin' || role === 'hr') {
            const elTotalEmp = document.getElementById('statTotalEmployees');
            const elPending = document.getElementById('statPendingRequests');
            const elApproved = document.getElementById('statApprovedRequests');
            const elRejected = document.getElementById('statRejectedRequests');
            const elOnLeaveToday = document.getElementById('statOnLeaveToday');

            if (elTotalEmp) elTotalEmp.textContent = stats.totalEmployees || 0;
            if (elPending) elPending.textContent = stats.pendingRequests || 0;
            if (elApproved) elApproved.textContent = stats.approvedRequests || 0;
            if (elRejected) elRejected.textContent = stats.rejectedRequests || 0;
            if (elOnLeaveToday) elOnLeaveToday.textContent = stats.employeesOnLeaveToday || 0;

            // Render Recent Leaves Table
            const adminLeavesTable = document.getElementById('adminRecentLeavesTable');
            if (adminLeavesTable && recentRequests) {
                if (recentRequests.length === 0) {
                    adminLeavesTable.innerHTML = `<tr><td colspan="7" class="table-empty">No recent leave requests.</td></tr>`;
                } else {
                    adminLeavesTable.innerHTML = recentRequests.map(r => `
                        <tr>
                            <td class="cell-primary">#REQ-${r.id}</td>
                            <td>
                                <div><strong>${r.full_name || r.employee_id}</strong></div>
                                <small class="text-muted">${r.department || 'General'}</small>
                            </td>
                            <td>${r.leave_type_name}</td>
                            <td>${formatDate(r.start_date)} - ${formatDate(r.end_date)}</td>
                            <td><strong>${r.days}</strong> d</td>
                            <td><span class="badge badge-${r.status.toLowerCase()}">${r.status}</span></td>
                            <td>
                                ${r.status === 'Pending' ? `
                                    <div class="table-actions">
                                        <button class="btn btn-success btn-sm" onclick="quickApprove(${r.id})">Approve</button>
                                        <button class="btn btn-danger btn-sm" onclick="openRejectModal(${r.id})">Reject</button>
                                    </div>
                                ` : `
                                    <span class="text-muted" style="font-size:12px;">Processed</span>
                                `}
                            </td>
                        </tr>
                    `).join('');
                }
            }

            // Render Department Usage Breakdown
            const deptContainer = document.getElementById('deptUsageList');
            if (deptContainer && departmentUsage) {
                const entries = Object.entries(departmentUsage);
                if (entries.length === 0) {
                    deptContainer.innerHTML = `<p class="text-muted" style="font-size:13px;">No approved leaves yet.</p>`;
                } else {
                    const maxVal = Math.max(...entries.map(([_, v]) => v), 1);
                    deptContainer.innerHTML = entries.map(([dept, count]) => `
                        <div style="margin-bottom:14px;">
                            <div style="display:flex; justify-content:space-between; font-size:13px; margin-bottom:4px;">
                                <span>${dept}</span>
                                <strong>${count} days</strong>
                            </div>
                            <div style="height:6px; background:var(--surface-border); border-radius:3px; overflow:hidden;">
                                <div style="width:${Math.min((count / maxVal) * 100, 100)}%; height:100%; background:var(--primary); border-radius:3px;"></div>
                            </div>
                        </div>
                    `).join('');
                }
            }

            // Render Monthly Chart Bars
            const chartContainer = document.getElementById('monthlyLeaveChart');
            if (chartContainer && monthlyChart) {
                const entries = Object.entries(monthlyChart);
                const maxVal = Math.max(...entries.map(([_, v]) => v), 5);

                chartContainer.innerHTML = entries.map(([month, val]) => `
                    <div class="chart-bar-group">
                        <div class="chart-bar" style="height: ${Math.max((val / maxVal) * 100, 5)}%;" title="${month}: ${val} days"></div>
                        <div class="chart-label">${month}</div>
                    </div>
                `).join('');
            }
        }
    } catch (err) {
        showToast(err.message || 'Failed to load dashboard data', 'danger');
    }
}

async function quickApprove(requestId) {
    if (!confirm(`Approve leave request #REQ-${requestId}?`)) return;
    try {
        const res = await API.post(`/leaves/${requestId}/approve`, { remarks: 'Approved from Dashboard' });
        showToast(res.message, 'success');
        loadDashboardData();
    } catch (err) {
        showToast(err.message, 'danger');
    }
}
