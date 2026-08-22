/**
 * Employee Management & CSV Import Logic
 */

let currentEmployeesPage = 1;
let totalEmployeesCount = 0;

// 1. Load Employees Table
async function loadEmployeesTable(page = 1) {
    currentEmployeesPage = page;
    const tableBody = document.getElementById('employeesTableBody');
    if (!tableBody) return;

    const searchInput = document.getElementById('employeeSearchInput');
    const deptSelect = document.getElementById('employeeDeptFilter');
    const statusSelect = document.getElementById('employeeStatusFilter');

    const search = searchInput ? searchInput.value.trim() : '';
    const department = deptSelect ? deptSelect.value : '';
    const status = statusSelect ? statusSelect.value : '';

    try {
        const queryParams = new URLSearchParams({
            page,
            limit: 10,
            search,
            department,
            status
        });

        const res = await API.get(`/employees?${queryParams.toString()}`);
        const { employees, total, totalPages } = res;
        totalEmployeesCount = total;

        if (!employees || employees.length === 0) {
            tableBody.innerHTML = `<tr><td colspan="7" class="table-empty">No employees match your criteria.</td></tr>`;
            renderPagination(0, 1, 1);
            return;
        }

        const currentUser = Auth.getCurrentUser();
        const isAdmin = currentUser && currentUser.role === 'admin';

        tableBody.innerHTML = employees.map(emp => `
            <tr>
                <td class="cell-primary">${emp.employee_id}</td>
                <td>
                    <div style="font-weight:600; color:var(--text-primary);">${emp.full_name}</div>
                    <small class="text-muted">${emp.email}</small>
                </td>
                <td>${emp.department}</td>
                <td>${emp.designation}</td>
                <td>
                    <span class="badge badge-${emp.status === 'active' ? 'approved' : 'rejected'}">
                        ${emp.status}
                    </span>
                </td>
                <td>
                    <div class="table-actions">
                        <a href="/${currentUser.role}/employee-details.html?id=${emp.employee_id}" class="btn btn-outline btn-sm">View</a>
                        ${isAdmin ? `
                            <button class="btn btn-outline btn-sm" onclick="openEditEmployeeModal('${emp.employee_id}')">Edit</button>
                            <button class="btn ${emp.status === 'active' ? 'btn-danger' : 'btn-success'} btn-sm" onclick="toggleEmployeeStatus('${emp.employee_id}', '${emp.status}')">
                                ${emp.status === 'active' ? 'Deactivate' : 'Activate'}
                            </button>
                            ${emp.employee_id !== 'ADM001' ? `
                                <button class="btn btn-danger btn-sm" onclick="deleteEmployee('${emp.employee_id}')">Delete</button>
                            ` : ''}
                        ` : ''}
                    </div>
                </td>
            </tr>
        `).join('');

        renderPagination(total, page, totalPages);
    } catch (err) {
        showToast('Failed to load employees: ' + err.message, 'danger');
    }
}

function renderPagination(total, page, totalPages) {
    const paginationContainer = document.getElementById('employeePagination');
    if (!paginationContainer) return;

    if (total === 0) {
        paginationContainer.innerHTML = '';
        return;
    }

    paginationContainer.innerHTML = `
        <div>Showing page <strong>${page}</strong> of <strong>${totalPages || 1}</strong> (${total} total employees)</div>
        <div class="pagination-controls">
            <button class="page-btn" ${page <= 1 ? 'disabled' : ''} onclick="loadEmployeesTable(${page - 1})">&lsaquo;</button>
            <span style="font-size:13px; font-weight:600; padding:0 8px;">${page}</span>
            <button class="page-btn" ${page >= totalPages ? 'disabled' : ''} onclick="loadEmployeesTable(${page + 1})">&rsaquo;</button>
        </div>
    `;
}

// 2. Toggle Status & Delete
async function toggleEmployeeStatus(empId, currentStatus) {
    const newStatus = currentStatus === 'active' ? 'inactive' : 'active';
    if (!confirm(`Are you sure you want to ${newStatus === 'active' ? 'activate' : 'deactivate'} employee ${empId}?`)) return;

    try {
        const res = await API.put(`/employees/${empId}`, { status: newStatus });
        showToast(res.message || 'Status updated', 'success');
        loadEmployeesTable(currentEmployeesPage);
    } catch (err) {
        showToast(err.message, 'danger');
    }
}

async function deleteEmployee(empId) {
    if (!confirm(`WARNING: Deleting employee ${empId} will remove their user account and history. Continue?`)) return;

    try {
        const res = await API.delete(`/employees/${empId}`);
        showToast(res.message || 'Employee deleted', 'success');
        loadEmployeesTable(currentEmployeesPage);
    } catch (err) {
        showToast(err.message, 'danger');
    }
}

// 3. Edit Employee Modal
async function openEditEmployeeModal(empId) {
    try {
        const res = await API.get(`/employees/${empId}`);
        const emp = res.employee;

        document.getElementById('editEmpId').value = emp.employee_id;
        document.getElementById('editFullName').value = emp.full_name;
        document.getElementById('editEmail').value = emp.email;
        document.getElementById('editPhone').value = emp.phone || '';
        document.getElementById('editDepartment').value = emp.department;
        document.getElementById('editDesignation').value = emp.designation;
        document.getElementById('editStatus').value = emp.status;

        openModal('editEmployeeModal');
    } catch (err) {
        showToast('Failed to load employee details: ' + err.message, 'danger');
    }
}

async function submitEditEmployee() {
    const empId = document.getElementById('editEmpId').value;
    const fullName = document.getElementById('editFullName').value;
    const phone = document.getElementById('editPhone').value;
    const department = document.getElementById('editDepartment').value;
    const designation = document.getElementById('editDesignation').value;
    const status = document.getElementById('editStatus').value;

    try {
        const res = await API.put(`/employees/${empId}`, {
            fullName,
            phone,
            department,
            designation,
            status
        });
        showToast(res.message, 'success');
        closeModal('editEmployeeModal');
        loadEmployeesTable(currentEmployeesPage);
    } catch (err) {
        showToast(err.message, 'danger');
    }
}

// 4. Employee Details Page Viewer
async function loadEmployeeDetailsPage() {
    const urlParams = new URLSearchParams(window.location.search);
    const id = urlParams.get('id');

    if (!id) {
        showToast('No employee ID specified', 'danger');
        return;
    }

    try {
        const res = await API.get(`/employees/${id}`);
        const emp = res.employee;

        // Populate fields
        const elName = document.getElementById('empDetailName');
        const elId = document.getElementById('empDetailId');
        const elEmail = document.getElementById('empDetailEmail');
        const elPhone = document.getElementById('empDetailPhone');
        const elDept = document.getElementById('empDetailDept');
        const elDesig = document.getElementById('empDetailDesig');
        const elJoining = document.getElementById('empDetailJoining');
        const elStatus = document.getElementById('empDetailStatus');
        const elCurrentLeave = document.getElementById('empDetailCurrentLeave');

        if (elName) elName.textContent = emp.full_name;
        if (elId) elId.textContent = emp.employee_id;
        if (elEmail) elEmail.textContent = emp.email;
        if (elPhone) elPhone.textContent = emp.phone || 'N/A';
        if (elDept) elDept.textContent = emp.department;
        if (elDesig) elDesig.textContent = emp.designation;
        if (elJoining) elJoining.textContent = formatDate(emp.joining_date);
        if (elStatus) elStatus.innerHTML = `<span class="badge badge-${emp.status === 'active' ? 'approved' : 'rejected'}">${emp.status}</span>`;
        if (elCurrentLeave) elCurrentLeave.textContent = emp.currentLeaveStatus || 'Active';

        // Balances
        const balanceContainer = document.getElementById('empDetailBalances');
        if (balanceContainer && emp.balances) {
            balanceContainer.innerHTML = emp.balances.map(b => `
                <div class="stat-card">
                    <span class="stat-title">${b.leave_type_name}</span>
                    <div class="stat-value">${b.available_days} <small style="font-size:12px; color:var(--text-muted);">/ ${b.total_days}</small></div>
                    <div class="stat-subtitle">Used: ${b.used_days} days</div>
                </div>
            `).join('');
        }

        // Leave History
        const historyTable = document.getElementById('empDetailLeaveHistory');
        if (historyTable && emp.leaveHistory) {
            if (emp.leaveHistory.length === 0) {
                historyTable.innerHTML = `<tr><td colspan="6" class="table-empty">No leave requests on record.</td></tr>`;
            } else {
                historyTable.innerHTML = emp.leaveHistory.map(l => `
                    <tr>
                        <td class="cell-primary">#REQ-${l.id}</td>
                        <td>${l.leave_type_name}</td>
                        <td>${formatDate(l.start_date)} &rarr; ${formatDate(l.end_date)}</td>
                        <td>${l.days} days</td>
                        <td><span class="badge badge-${l.status.toLowerCase()}">${l.status}</span></td>
                        <td>${l.reason}</td>
                    </tr>
                `).join('');
            }
        }
    } catch (err) {
        showToast('Failed to load employee details: ' + err.message, 'danger');
    }
}

// 5. CSV Import Handler
let parsedImportRecords = [];

function initCsvImport() {
    const fileInput = document.getElementById('csvFileInput');
    const previewContainer = document.getElementById('csvPreviewContainer');
    const previewTableBody = document.getElementById('csvPreviewTableBody');
    const errorBox = document.getElementById('importErrorsBox');
    const importBtn = document.getElementById('submitImportBtn');

    if (fileInput) {
        fileInput.addEventListener('change', (e) => {
            const file = e.target.files[0];
            if (!file) return;

            const reader = new FileReader();
            reader.onload = function (event) {
                const text = event.target.result;
                parseCsvAndPreview(text);
            };
            reader.readAsText(file);
        });
    }

    function parseCsvAndPreview(csvText) {
        const lines = csvText.split(/\r?\n/).filter(line => line.trim().length > 0);
        if (lines.length < 2) {
            showToast('CSV file is empty or missing data rows.', 'warning');
            return;
        }

        const headers = lines[0].split(',').map(h => h.trim().toLowerCase());
        parsedImportRecords = [];

        for (let i = 1; i < lines.length; i++) {
            const cols = lines[i].split(',').map(c => c.trim());
            if (cols.length >= 4) {
                parsedImportRecords.push({
                    employee_id: cols[0],
                    name: cols[1],
                    email: cols[2],
                    department: cols[3] || 'General',
                    designation: cols[4] || 'Staff',
                    phone: cols[5] || ''
                });
            }
        }

        // Send preview validation request
        API.post('/employees/import', { employeesList: parsedImportRecords, previewOnly: true })
            .then(res => {
                if (previewContainer) previewContainer.style.display = 'block';

                if (res.errors && res.errors.length > 0) {
                    if (errorBox) {
                        errorBox.style.display = 'block';
                        errorBox.innerHTML = `<strong>Validation Issues Found:</strong><br>` + res.errors.map(err => `&bull; ${err}`).join('<br>');
                    }
                } else if (errorBox) {
                    errorBox.style.display = 'none';
                }

                if (previewTableBody && res.preview) {
                    previewTableBody.innerHTML = res.preview.map(r => `
                        <tr>
                            <td class="cell-primary">${r.empId}</td>
                            <td>${r.name}</td>
                            <td>${r.email}</td>
                            <td>${r.department}</td>
                            <td>${r.designation}</td>
                        </tr>
                    `).join('');
                }

                if (importBtn) importBtn.disabled = res.validCount === 0;
            })
            .catch(err => {
                showToast(err.message, 'danger');
            });
    }

    if (importBtn) {
        importBtn.addEventListener('click', async () => {
            if (parsedImportRecords.length === 0) return;
            importBtn.disabled = true;

            try {
                const res = await API.post('/employees/import', { employeesList: parsedImportRecords });
                showToast(res.message || 'Employees imported successfully!', 'success');
                setTimeout(() => {
                    window.location.href = '/admin/manage-employees.html';
                }, 1200);
            } catch (err) {
                showToast(err.message || 'Import failed.', 'danger');
                importBtn.disabled = false;
            }
        });
    }
}
