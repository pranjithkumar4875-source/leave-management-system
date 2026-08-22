/**
 * Leave Application, My Leaves, Details, and Approvals Management
 */

// Calculate days excluding weekends
function calculateLeaveDays(startDateStr, endDateStr) {
    if (!startDateStr || !endDateStr) return 0;
    const start = new Date(startDateStr);
    const end = new Date(endDateStr);

    if (isNaN(start.getTime()) || isNaN(end.getTime()) || end < start) return 0;

    let count = 0;
    const cur = new Date(start);
    while (cur <= end) {
        const day = cur.getDay();
        if (day !== 0 && day !== 6) count++;
        cur.setDate(cur.getDate() + 1);
    }
    return count > 0 ? count : 1;
}

// 1. Initialize Apply Leave Form
async function initApplyLeaveForm() {
    const leaveTypeSelect = document.getElementById('leaveTypeId');
    const startDateInput = document.getElementById('startDate');
    const endDateInput = document.getElementById('endDate');
    const daysDisplay = document.getElementById('calculatedDays');
    const balanceNotice = document.getElementById('balanceNotice');
    const form = document.getElementById('applyLeaveForm');

    // Set min date to today
    const todayStr = new Date().toISOString().split('T')[0];
    if (startDateInput) startDateInput.min = todayStr;
    if (endDateInput) endDateInput.min = todayStr;

    // Fetch leave types and balances
    try {
        const user = Auth.getCurrentUser();
        const [typesRes, balancesRes] = await Promise.all([
            API.get('/leave-types'),
            API.get(`/leaves/balances/${user.employeeId}`)
        ]);

        const types = typesRes.leaveTypes || [];
        const balances = balancesRes.balances || [];

        window.userBalances = balances;

        if (leaveTypeSelect) {
            leaveTypeSelect.innerHTML = '<option value="">-- Select Leave Category --</option>' +
                types.filter(t => t.is_active).map(t => {
                    const b = balances.find(item => item.leave_type_id === t.id);
                    const avail = b ? b.available_days : t.max_days;
                    return `<option value="${t.id}" data-avail="${avail}">${t.name} (${avail} days available)</option>`;
                }).join('');
        }
    } catch (err) {
        showToast('Error loading leave categories: ' + err.message, 'danger');
    }

    function updateCalculations() {
        const startVal = startDateInput ? startDateInput.value : '';
        const endVal = endDateInput ? endDateInput.value : '';
        const selectedOption = leaveTypeSelect ? leaveTypeSelect.options[leaveTypeSelect.selectedIndex] : null;
        const available = selectedOption && selectedOption.dataset.avail ? Number(selectedOption.dataset.avail) : 0;

        if (startVal && endDateInput) {
            endDateInput.min = startVal;
        }

        if (startVal && endVal) {
            if (endVal < startVal) {
                if (daysDisplay) daysDisplay.value = 'Invalid (End date before start)';
                if (balanceNotice) balanceNotice.innerHTML = '<span class="text-danger">End date cannot be earlier than start date.</span>';
                return;
            }

            const days = calculateLeaveDays(startVal, endVal);
            if (daysDisplay) daysDisplay.value = `${days} working day(s)`;

            if (selectedOption && selectedOption.value) {
                if (days > available) {
                    if (balanceNotice) balanceNotice.innerHTML = `<span class="text-danger">Warning: Requested duration (${days} days) exceeds available balance (${available} days).</span>`;
                } else {
                    if (balanceNotice) balanceNotice.innerHTML = `<span class="text-success">Leave balance is sufficient (${available - days} days will remain).</span>`;
                }
            }
        }
    }

    if (startDateInput) startDateInput.addEventListener('change', updateCalculations);
    if (endDateInput) endDateInput.addEventListener('change', updateCalculations);
    if (leaveTypeSelect) leaveTypeSelect.addEventListener('change', updateCalculations);

    if (form) {
        form.addEventListener('submit', async (e) => {
            e.preventDefault();
            const submitBtn = form.querySelector('button[type="submit"]');
            if (submitBtn) submitBtn.disabled = true;

            const formData = new FormData(form);

            try {
                const res = await API.post('/leaves', formData);
                showToast(res.message || 'Leave request submitted successfully!', 'success');
                setTimeout(() => {
                    window.location.href = '/employee/my-leaves.html';
                }, 1000);
            } catch (err) {
                showToast(err.message || 'Failed to submit leave request.', 'danger');
                if (submitBtn) submitBtn.disabled = false;
            }
        });
    }
}

// 2. Load My Leaves Table
async function loadMyLeaves() {
    const tableBody = document.getElementById('myLeavesTableBody');
    if (!tableBody) return;

    try {
        const res = await API.get('/leaves');
        const leaves = res.leaves || [];

        if (leaves.length === 0) {
            tableBody.innerHTML = `<tr><td colspan="8" class="table-empty">You haven't submitted any leave requests yet.</td></tr>`;
            return;
        }

        tableBody.innerHTML = leaves.map(l => `
            <tr>
                <td class="cell-primary">#REQ-${l.id}</td>
                <td><strong>${l.leave_type_name}</strong></td>
                <td>${formatDate(l.start_date)}</td>
                <td>${formatDate(l.end_date)}</td>
                <td><strong>${l.days}</strong> day(s)</td>
                <td style="max-width:200px; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;" title="${l.reason}">${l.reason}</td>
                <td><span class="badge badge-${l.status.toLowerCase()}">${l.status}</span></td>
                <td>
                    <div class="table-actions">
                        <a href="/employee/leave-details.html?id=${l.id}" class="btn btn-outline btn-sm">View</a>
                        ${l.status === 'Pending' ? `
                            <button class="btn btn-danger btn-sm" onclick="cancelMyLeave(${l.id})">Cancel</button>
                        ` : ''}
                    </div>
                </td>
            </tr>
        `).join('');
    } catch (err) {
        showToast('Failed to load leave history: ' + err.message, 'danger');
    }
}

// Cancel Pending Leave
async function cancelMyLeave(requestId) {
    if (!confirm('Are you sure you want to cancel this pending leave request?')) return;
    try {
        const res = await API.delete(`/leaves/${requestId}`);
        showToast(res.message, 'success');
        loadMyLeaves();
    } catch (err) {
        showToast(err.message, 'danger');
    }
}

// 3. Load Leave Details Page
async function loadLeaveDetails() {
    const urlParams = new URLSearchParams(window.location.search);
    const id = urlParams.get('id');

    if (!id) {
        showToast('No leave ID specified.', 'danger');
        return;
    }

    try {
        const res = await API.get(`/leaves/${id}`);
        const leave = res.leave;

        const elId = document.getElementById('detailLeaveId');
        const elEmp = document.getElementById('detailEmpName');
        const elDept = document.getElementById('detailDepartment');
        const elType = document.getElementById('detailLeaveType');
        const elDates = document.getElementById('detailDates');
        const elDays = document.getElementById('detailDays');
        const elReason = document.getElementById('detailReason');
        const elStatus = document.getElementById('detailStatus');
        const elActionBy = document.getElementById('detailActionBy');
        const elRemarks = document.getElementById('detailRemarks');
        const elDoc = document.getElementById('detailDocument');

        if (elId) elId.textContent = `#REQ-${leave.id}`;
        if (elEmp) elEmp.textContent = `${leave.employee_name} (${leave.employee_id})`;
        if (elDept) elDept.textContent = leave.department || 'General';
        if (elType) elType.textContent = leave.leave_type_name;
        if (elDates) elDates.textContent = `${formatDate(leave.start_date)} to ${formatDate(leave.end_date)}`;
        if (elDays) elDays.textContent = `${leave.days} day(s)`;
        if (elReason) elReason.textContent = leave.reason;
        if (elStatus) {
            elStatus.innerHTML = `<span class="badge badge-${leave.status.toLowerCase()}">${leave.status}</span>`;
        }
        if (elActionBy) elActionBy.textContent = leave.actionByName || (leave.status === 'Pending' ? 'Pending Review' : 'System');
        if (elRemarks) elRemarks.textContent = leave.rejection_reason || 'None';

        if (elDoc) {
            if (leave.document_path) {
                elDoc.innerHTML = `<a href="${leave.document_path}" target="_blank" class="btn btn-outline btn-sm">Download Attachment</a>`;
            } else {
                elDoc.textContent = 'No attachment uploaded';
            }
        }
    } catch (err) {
        showToast('Failed to load leave details: ' + err.message, 'danger');
    }
}

// 4. Manage Leaves (Admin & HR)
let currentRejectRequestId = null;

async function loadManageLeaves() {
    const tableBody = document.getElementById('manageLeavesTableBody');
    if (!tableBody) return;

    const statusFilter = document.getElementById('filterStatus') ? document.getElementById('filterStatus').value : '';
    const searchFilter = document.getElementById('filterSearch') ? document.getElementById('filterSearch').value.toLowerCase() : '';

    try {
        let endpoint = '/leaves';
        if (statusFilter) endpoint += `?status=${statusFilter}`;

        const res = await API.get(endpoint);
        let leaves = res.leaves || [];

        if (searchFilter) {
            leaves = leaves.filter(l =>
                (l.employee_name && l.employee_name.toLowerCase().includes(searchFilter)) ||
                (l.employee_id && l.employee_id.toLowerCase().includes(searchFilter)) ||
                (l.leave_type_name && l.leave_type_name.toLowerCase().includes(searchFilter))
            );
        }

        if (leaves.length === 0) {
            tableBody.innerHTML = `<tr><td colspan="8" class="table-empty">No leave requests found.</td></tr>`;
            return;
        }

        tableBody.innerHTML = leaves.map(l => `
            <tr>
                <td class="cell-primary">#REQ-${l.id}</td>
                <td>
                    <strong>${l.employee_name || l.employee_id}</strong>
                    <div class="text-muted" style="font-size:11px;">${l.department} &bull; ${l.employee_id}</div>
                </td>
                <td>${l.leave_type_name}</td>
                <td>${formatDate(l.start_date)} &rarr; ${formatDate(l.end_date)}</td>
                <td><strong>${l.days}</strong> d</td>
                <td style="max-width:180px; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;" title="${l.reason}">${l.reason}</td>
                <td><span class="badge badge-${l.status.toLowerCase()}">${l.status}</span></td>
                <td>
                    <div class="table-actions">
                        ${l.status === 'Pending' ? `
                            <button class="btn btn-success btn-sm" onclick="approveLeaveRequest(${l.id})">Approve</button>
                            <button class="btn btn-danger btn-sm" onclick="openRejectModal(${l.id})">Reject</button>
                        ` : `
                            <button class="btn btn-outline btn-sm" onclick="viewLeaveModal(${l.id})">View</button>
                        `}
                    </div>
                </td>
            </tr>
        `).join('');
    } catch (err) {
        showToast('Failed to load leave requests: ' + err.message, 'danger');
    }
}

async function approveLeaveRequest(id) {
    if (!confirm(`Approve leave request #REQ-${id}?`)) return;
    try {
        const res = await API.post(`/leaves/${id}/approve`, { remarks: 'Approved by Administrator/HR' });
        showToast(res.message, 'success');
        loadManageLeaves();
    } catch (err) {
        showToast(err.message, 'danger');
    }
}

function openRejectModal(id) {
    currentRejectRequestId = id;
    const input = document.getElementById('rejectReasonInput');
    if (input) input.value = '';
    openModal('rejectLeaveModal');
}

async function submitRejectLeave() {
    if (!currentRejectRequestId) return;
    const input = document.getElementById('rejectReasonInput');
    const reason = input ? input.value.trim() : '';

    if (!reason) {
        showToast('Rejection reason is required.', 'warning');
        return;
    }

    try {
        const res = await API.post(`/leaves/${currentRejectRequestId}/reject`, { rejectionReason: reason });
        showToast(res.message, 'success');
        closeModal('rejectLeaveModal');
        loadManageLeaves();
        if (typeof loadDashboardData === 'function') loadDashboardData();
    } catch (err) {
        showToast(err.message, 'danger');
    }
}

async function viewLeaveModal(id) {
    try {
        const res = await API.get(`/leaves/${id}`);
        const leave = res.leave;

        const body = document.getElementById('viewLeaveModalBody');
        if (body) {
            body.innerHTML = `
                <div style="display:grid; grid-template-columns:1fr 1fr; gap:16px; font-size:13px;">
                    <div><span class="text-muted">Employee:</span> <strong>${leave.employee_name} (${leave.employee_id})</strong></div>
                    <div><span class="text-muted">Department:</span> <strong>${leave.department}</strong></div>
                    <div><span class="text-muted">Leave Type:</span> <strong>${leave.leave_type_name}</strong></div>
                    <div><span class="text-muted">Duration:</span> <strong>${leave.days} day(s)</strong></div>
                    <div><span class="text-muted">Dates:</span> <strong>${formatDate(leave.start_date)} to ${formatDate(leave.end_date)}</strong></div>
                    <div><span class="text-muted">Status:</span> <span class="badge badge-${leave.status.toLowerCase()}">${leave.status}</span></div>
                    <div style="grid-column:1 / -1;"><span class="text-muted">Reason:</span> <p style="margin-top:4px;">${leave.reason}</p></div>
                    ${leave.rejection_reason ? `<div style="grid-column:1 / -1; color:var(--danger);"><span class="text-muted">Remarks/Reason:</span> <p>${leave.rejection_reason}</p></div>` : ''}
                    <div><span class="text-muted">Action Taken By:</span> <strong>${leave.actionByName || 'N/A'}</strong></div>
                    <div><span class="text-muted">Action Timestamp:</span> <strong>${leave.action_at ? formatDate(leave.action_at) : 'N/A'}</strong></div>
                </div>
            `;
            openModal('viewLeaveModal');
        }
    } catch (err) {
        showToast('Error loading details: ' + err.message, 'danger');
    }
}
