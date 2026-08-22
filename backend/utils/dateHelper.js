/**
 * Helper to calculate business/calendar days between two date strings (YYYY-MM-DD)
 */
function calculateDays(startDateStr, endDateStr, includeWeekends = false) {
    const start = new Date(startDateStr);
    const end = new Date(endDateStr);

    if (isNaN(start.getTime()) || isNaN(end.getTime())) {
        return 0;
    }

    if (end < start) {
        return -1;
    }

    if (includeWeekends) {
        const diffTime = Math.abs(end - start);
        return Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1;
    }

    // Default: Count week days (Monday - Friday) or all days if leave type requires
    let count = 0;
    const cur = new Date(start);
    while (cur <= end) {
        const dayOfWeek = cur.getDay();
        if (dayOfWeek !== 0 && dayOfWeek !== 6) { // 0 = Sunday, 6 = Saturday
            count++;
        }
        cur.setDate(cur.getDate() + 1);
    }

    // If span was within weekend only, return at least 1 day
    return count > 0 ? count : 1;
}

/**
 * Format Date to YYYY-MM-DD
 */
function formatDate(dateObj) {
    if (!dateObj) return '';
    if (typeof dateObj === 'string') return dateObj.substring(0, 10);
    const d = new Date(dateObj);
    const month = '' + (d.getMonth() + 1).toString().padStart(2, '0');
    const day = '' + d.getDate().toString().padStart(2, '0');
    const year = d.getFullYear();
    return [year, month, day].join('-');
}

module.exports = {
    calculateDays,
    formatDate
};
