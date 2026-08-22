/**
 * Interactive Leave Calendar Component
 */

let currentCalMonth = new Date().getMonth();
let currentCalYear = new Date().getFullYear();

async function initLeaveCalendar() {
    const prevBtn = document.getElementById('calPrevBtn');
    const nextBtn = document.getElementById('calNextBtn');
    const deptFilter = document.getElementById('calDeptFilter');
    const statusFilter = document.getElementById('calStatusFilter');

    if (prevBtn) {
        prevBtn.addEventListener('click', () => {
            currentCalMonth--;
            if (currentCalMonth < 0) {
                currentCalMonth = 11;
                currentCalYear--;
            }
            renderCalendarMonth();
        });
    }

    if (nextBtn) {
        nextBtn.addEventListener('click', () => {
            currentCalMonth++;
            if (currentCalMonth > 11) {
                currentCalMonth = 0;
                currentCalYear++;
            }
            renderCalendarMonth();
        });
    }

    if (deptFilter) deptFilter.addEventListener('change', renderCalendarMonth);
    if (statusFilter) statusFilter.addEventListener('change', renderCalendarMonth);

    renderCalendarMonth();
}

async function renderCalendarMonth() {
    const monthTitle = document.getElementById('calMonthTitle');
    const calGrid = document.getElementById('calGrid');
    const deptFilter = document.getElementById('calDeptFilter');
    const statusFilter = document.getElementById('calStatusFilter');

    if (!calGrid) return;

    const monthNames = [
        'January', 'February', 'March', 'April', 'May', 'June',
        'July', 'August', 'September', 'October', 'November', 'December'
    ];

    if (monthTitle) {
        monthTitle.textContent = `${monthNames[currentCalMonth]} ${currentCalYear}`;
    }

    // Fetch calendar events from backend
    let events = [];
    try {
        const queryParams = new URLSearchParams({
            month: currentCalMonth + 1,
            year: currentCalYear,
            department: deptFilter ? deptFilter.value : '',
            status: statusFilter ? statusFilter.value : ''
        });

        const res = await API.get(`/calendar?${queryParams.toString()}`);
        events = res.events || [];
    } catch (e) {
        console.error('Error fetching calendar events:', e);
    }

    // Calculate calendar grid days
    const firstDay = new Date(currentCalYear, currentCalMonth, 1).getDay(); // 0 = Sun
    const totalDaysInMonth = new Date(currentCalYear, currentCalMonth + 1, 0).getDate();

    let gridHtml = '';

    // Day of week headers
    const daysOfWeek = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    gridHtml += '<div style="display:grid; grid-template-columns:repeat(7, 1fr); gap:8px; margin-bottom:8px;">';
    daysOfWeek.forEach(d => {
        gridHtml += `<div style="text-align:center; font-weight:700; font-size:12px; color:var(--text-muted); text-transform:uppercase; padding:6px 0;">${d}</div>`;
    });
    gridHtml += '</div>';

    // Calendar Cells Grid
    gridHtml += '<div style="display:grid; grid-template-columns:repeat(7, 1fr); gap:8px;">';

    // Blank cells before first day
    for (let i = 0; i < firstDay; i++) {
        gridHtml += `<div style="min-height:90px; background:rgba(0,0,0,0.1); border-radius:var(--radius-sm); border:1px dashed var(--surface-border); opacity:0.3;"></div>`;
    }

    // Current month day cells
    const today = new Date();
    const isThisMonth = today.getMonth() === currentCalMonth && today.getFullYear() === currentCalYear;

    for (let day = 1; day <= totalDaysInMonth; day++) {
        const isToday = isThisMonth && today.getDate() === day;
        const dateStr = `${currentCalYear}-${(currentCalMonth + 1).toString().padStart(2, '0')}-${day.toString().padStart(2, '0')}`;

        // Find events on this day
        const dayEvents = events.filter(e => {
            const start = e.start_date.substring(0, 10);
            const end = e.end_date.substring(0, 10);
            return dateStr >= start && dateStr <= end;
        });

        gridHtml += `
            <div style="min-height:100px; background:var(--surface-card); border:1px solid ${isToday ? 'var(--primary)' : 'var(--surface-border)'}; border-radius:var(--radius-md); padding:8px; display:flex; flex-direction:column;">
                <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:6px;">
                    <span style="font-weight:700; font-size:13px; color:${isToday ? 'var(--primary)' : 'var(--text-primary)'};">${day}</span>
                    ${isToday ? `<span class="badge badge-role" style="font-size:9px; padding:1px 5px;">Today</span>` : ''}
                </div>
                <div style="display:flex; flex-direction:column; gap:4px; overflow-y:auto; max-height:80px;">
                    ${dayEvents.map(ev => `
                        <div style="background:${ev.status === 'Approved' ? 'var(--success-light)' : 'var(--warning-light)'}; border-left:3px solid ${ev.status === 'Approved' ? 'var(--success)' : 'var(--warning)'}; padding:3px 6px; border-radius:3px; font-size:11px; color:var(--text-primary); cursor:pointer;" onclick="viewLeaveModal(${ev.id})" title="${ev.employee_name}: ${ev.leave_type_name} (${ev.reason})">
                            <strong>${ev.employee_name.split(' ')[0]}</strong>: ${ev.leave_type_code || ev.leave_type_name}
                        </div>
                    `).join('')}
                </div>
            </div>
        `;
    }

    gridHtml += '</div>';
    calGrid.innerHTML = gridHtml;
}
