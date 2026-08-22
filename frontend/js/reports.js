/**
 * Reports & Analytics Component with CSV Export and Print Logic
 */

let currentReportData = null;

async function loadReports() {
    const reportTypeSelect = document.getElementById('reportTypeSelect');
    const startInput = document.getElementById('reportStartDate');
    const endInput = document.getElementById('reportEndDate');
    const deptSelect = document.getElementById('reportDeptSelect');

    const reportType = reportTypeSelect ? reportTypeSelect.value : 'monthly';
    const startDate = startInput ? startInput.value : '';
    const endDate = endInput ? endInput.value : '';
    const department = deptSelect ? deptSelect.value : '';

    try {
        const queryParams = new URLSearchParams({
            reportType,
            startDate,
            endDate,
            department
        });

        const res = await API.get(`/reports?${queryParams.toString()}`);
        currentReportData = res;

        // Render Summary Counters
        const elTotal = document.getElementById('repTotalLeaves');
        const elApproved = document.getElementById('repApprovedLeaves');
        const elPending = document.getElementById('repPendingLeaves');
        const elRejected = document.getElementById('repRejectedLeaves');

        if (elTotal) elTotal.textContent = res.statusSummary.total || 0;
        if (elApproved) elApproved.textContent = res.statusSummary.approved || 0;
        if (elPending) elPending.textContent = res.statusSummary.pending || 0;
        if (elRejected) elRejected.textContent = res.statusSummary.rejected || 0;

        // Render Report Table based on active type
        renderReportTable(reportType, res);
    } catch (err) {
        showToast('Error generating report: ' + err.message, 'danger');
    }
}

function renderReportTable(type, data) {
    const headerRow = document.getElementById('reportTableHeader');
    const tableBody = document.getElementById('reportTableBody');
    if (!headerRow || !tableBody) return;

    if (type === 'monthly') {
        headerRow.innerHTML = `
            <th>Month (YYYY-MM)</th>
            <th>Total Requests</th>
            <th>Total Days</th>
            <th>Approved</th>
            <th>Pending</th>
            <th>Rejected</th>
        `;
        tableBody.innerHTML = data.monthly.map(m => `
            <tr>
                <td class="cell-primary">${m.month}</td>
                <td><strong>${m.totalRequests}</strong></td>
                <td>${m.totalDays} days</td>
                <td><span class="badge badge-approved">${m.approved}</span></td>
                <td><span class="badge badge-pending">${m.pending}</span></td>
                <td><span class="badge badge-rejected">${m.rejected}</span></td>
            </tr>
        `).join('') || `<tr><td colspan="6" class="table-empty">No monthly data available.</td></tr>`;
    } else if (type === 'department') {
        headerRow.innerHTML = `
            <th>Department</th>
            <th>Total Requests</th>
            <th>Total Approved Days</th>
            <th>Approved</th>
            <th>Rejected</th>
        `;
        tableBody.innerHTML = data.departments.map(d => `
            <tr>
                <td class="cell-primary">${d.department}</td>
                <td>${d.totalRequests}</td>
                <td><strong>${d.totalDays}</strong> days</td>
                <td><span class="badge badge-approved">${d.approved}</span></td>
                <td><span class="badge badge-rejected">${d.rejected}</span></td>
            </tr>
        `).join('') || `<tr><td colspan="5" class="table-empty">No department records available.</td></tr>`;
    } else if (type === 'leave_type') {
        headerRow.innerHTML = `
            <th>Leave Category</th>
            <th>Total Requests</th>
            <th>Total Days Taken</th>
        `;
        tableBody.innerHTML = data.leaveTypes.map(lt => `
            <tr>
                <td class="cell-primary">${lt.leaveType}</td>
                <td>${lt.count} applications</td>
                <td><strong>${lt.days}</strong> days approved</td>
            </tr>
        `).join('') || `<tr><td colspan="3" class="table-empty">No records.</td></tr>`;
    } else if (type === 'employee') {
        headerRow.innerHTML = `
            <th>Employee ID</th>
            <th>Employee Name</th>
            <th>Department</th>
            <th>Total Requests</th>
            <th>Approved Days</th>
            <th>Pending</th>
        `;
        tableBody.innerHTML = data.employees.map(e => `
            <tr>
                <td class="cell-primary">${e.employeeId}</td>
                <td><strong>${e.name}</strong></td>
                <td>${e.department}</td>
                <td>${e.totalRequests}</td>
                <td><strong>${e.approvedDays}</strong> days</td>
                <td><span class="badge badge-pending">${e.pendingRequests}</span></td>
            </tr>
        `).join('') || `<tr><td colspan="6" class="table-empty">No employee data.</td></tr>`;
    } else {
        // Detailed Requests
        headerRow.innerHTML = `
            <th>Request ID</th>
            <th>Employee</th>
            <th>Department</th>
            <th>Leave Type</th>
            <th>Dates</th>
            <th>Days</th>
            <th>Status</th>
        `;
        tableBody.innerHTML = data.records.map(r => `
            <tr>
                <td class="cell-primary">#REQ-${r.id}</td>
                <td>${r.employee_name} (${r.employee_id})</td>
                <td>${r.department}</td>
                <td>${r.leave_type_name}</td>
                <td>${formatDate(r.start_date)} - ${formatDate(r.end_date)}</td>
                <td><strong>${r.days}</strong> d</td>
                <td><span class="badge badge-${r.status.toLowerCase()}">${r.status}</span></td>
            </tr>
        `).join('') || `<tr><td colspan="7" class="table-empty">No records found.</td></tr>`;
    }
}

// Export CSV Functionality
function exportReportCsv() {
    if (!currentReportData || !currentReportData.records || currentReportData.records.length === 0) {
        showToast('No report records to export.', 'warning');
        return;
    }

    const headers = ['Request ID', 'Employee ID', 'Employee Name', 'Department', 'Leave Type', 'Start Date', 'End Date', 'Days', 'Status', 'Reason', 'Action By'];
    const rows = currentReportData.records.map(r => [
        `"REQ-${r.id}"`,
        `"${r.employee_id}"`,
        `"${r.employee_name || ''}"`,
        `"${r.department || ''}"`,
        `"${r.leave_type_name || ''}"`,
        `"${r.start_date.substring(0, 10)}"`,
        `"${r.end_date.substring(0, 10)}"`,
        r.days,
        `"${r.status}"`,
        `"${(r.reason || '').replace(/"/g, '""')}"`,
        `"${r.action_by || 'N/A'}"`
    ]);

    const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map(e => e.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `leave_report_${new Date().toISOString().substring(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    showToast('Report downloaded as CSV!', 'success');
}

// Print Report Functionality
function printReport() {
    window.print();
}
