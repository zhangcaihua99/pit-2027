/**
 * calendar.js - Calendar date picker component
 * Supports: single date selection, multiple date selection, range selection (click first then last)
 */
const CalendarPicker = {
  instances: {}, // { containerId: { selectedDates: Set, rangeStart: null, currentMonth: Date, availableDates: Set, allActive: bool } }

  /**
   * Initialize a calendar in the given container.
   * @param {string} containerId - DOM element ID
   * @param {string[]} availableDates - array of 'YYYY-MM-DD' strings that have data
   */
  init(containerId, availableDates) {
    const today = new Date();
    // Start calendar on the month of the most recent available date, or current month
    let startMonth = new Date(today.getFullYear(), today.getMonth(), 1);
    if (availableDates && availableDates.length > 0) {
      const sorted = [...availableDates].sort().reverse();
      const latest = sorted[0].split('-').map(Number);
      startMonth = new Date(latest[0], latest[1] - 1, 1);
    }

    // Preserve selected dates if already initialized
    const existing = this.instances[containerId];
    this.instances[containerId] = {
      selectedDates: existing ? existing.selectedDates : new Set(),
      rangeStart: null,
      currentMonth: startMonth,
      availableDates: new Set(availableDates || []),
      allActive: existing ? existing.allActive : true
    };
    this.render(containerId);
  },

  /**
   * Render the calendar HTML.
   */
  render(containerId) {
    const inst = this.instances[containerId];
    const container = document.getElementById(containerId);
    if (!inst || !container) return;

    const year = inst.currentMonth.getFullYear();
    const month = inst.currentMonth.getMonth();

    let html = '<div class="cal">';

    // Header: All button + month navigation
    html += '<div class="cal-header">';
    html += '<button type="button" class="cal-all-btn' + (inst.allActive ? ' active' : '') + '" data-cal-all="' + containerId + '">';
    html += '\u5168\u90e8<br><span class="en">(All)</span></button>';
    html += '<div class="cal-nav">';
    html += '<button type="button" class="cal-prev" data-cal-prev="' + containerId + '">&#8249;</button>';
    html += '<span class="cal-month">' + year + '\u5e74' + (month + 1) + '\u6708</span>';
    html += '<button type="button" class="cal-next" data-cal-next="' + containerId + '">&#8250;</button>';
    html += '</div>';
    html += '</div>';

    // Weekday headers
    html += '<div class="cal-grid cal-weekdays">';
    var weekdays = ['\u65e5', '\u4e00', '\u4e8c', '\u4e09', '\u56db', '\u4e94', '\u516d'];
    weekdays.forEach(function(w) {
      html += '<div class="cal-wd">' + w + '</div>';
    });
    html += '</div>';

    // Days grid
    var firstDay = new Date(year, month, 1).getDay(); // 0=Sunday
    var daysInMonth = new Date(year, month + 1, 0).getDate();

    html += '<div class="cal-grid cal-days">';
    // Empty cells before first day
    for (var i = 0; i < firstDay; i++) {
      html += '<div class="cal-empty"></div>';
    }
    for (var day = 1; day <= daysInMonth; day++) {
      var dateStr = year + '-' + String(month + 1).padStart(2, '0') + '-' + String(day).padStart(2, '0');
      var hasData = inst.availableDates.has(dateStr);
      var selected = inst.selectedDates.has(dateStr);
      var isRangeStart = inst.rangeStart === dateStr;
      var classes = 'cal-day';
      if (selected) classes += ' selected';
      if (isRangeStart) classes += ' range-start';
      if (hasData) classes += ' has-data';
      html += '<div class="' + classes + '" data-cal-day="' + dateStr + '" data-cal-container="' + containerId + '">' + day + '</div>';
    }
    html += '</div>';

    // Selected count info
    if (inst.selectedDates.size > 0) {
      var dates = Array.from(inst.selectedDates).sort();
      html += '<div class="cal-info">\u5df2\u9009 ' + dates.length + ' \u4e2a\u65e5\u671f';
      if (dates.length <= 3) {
        html += ' (' + dates.map(function(d) {
          var p = d.split('-');
          return p[1] + '-' + p[2];
        }).join(', ') + ')';
      }
      html += '<br><span class="en">' + dates.length + ' date(s) selected</span></div>';
    }

    html += '</div>';
    container.innerHTML = html;
  },

  /**
   * Handle a day cell click.
   */
  handleDayClick(containerId, dateStr) {
    var inst = this.instances[containerId];
    if (!inst) return;

    inst.allActive = false; // Deactivate "All" when selecting individual dates

    if (inst.rangeStart && inst.rangeStart !== dateStr) {
      // Range selection: select all dates from rangeStart to dateStr (inclusive)
      var start = inst.rangeStart < dateStr ? inst.rangeStart : dateStr;
      var end = inst.rangeStart < dateStr ? dateStr : inst.rangeStart;
      var startParts = start.split('-').map(Number);
      var endParts = end.split('-').map(Number);
      var startDate = new Date(startParts[0], startParts[1] - 1, startParts[2]);
      var endDate = new Date(endParts[0], endParts[1] - 1, endParts[2]);
      var current = new Date(startDate);
      while (current <= endDate) {
        var ds = current.getFullYear() + '-' + String(current.getMonth() + 1).padStart(2, '0') + '-' + String(current.getDate()).padStart(2, '0');
        inst.selectedDates.add(ds);
        current.setDate(current.getDate() + 1);
      }
      inst.rangeStart = null;
    } else if (inst.rangeStart === dateStr) {
      // Click same date again -> deselect
      inst.selectedDates.delete(dateStr);
      inst.rangeStart = null;
    } else {
      // First click -> select and set as range start
      if (inst.selectedDates.has(dateStr)) {
        inst.selectedDates.delete(dateStr);
        inst.rangeStart = null;
      } else {
        inst.selectedDates.add(dateStr);
        inst.rangeStart = dateStr;
      }
    }

    // If no dates selected, re-activate "All"
    if (inst.selectedDates.size === 0) {
      inst.allActive = true;
    }

    this.render(containerId);
  },

  /**
   * Handle "All" button click.
   */
  handleAllClick(containerId) {
    var inst = this.instances[containerId];
    if (!inst) return;
    inst.allActive = !inst.allActive;
    if (inst.allActive) {
      inst.selectedDates.clear();
      inst.rangeStart = null;
    }
    this.render(containerId);
  },

  /**
   * Handle month navigation.
   */
  handleMonthChange(containerId, delta) {
    var inst = this.instances[containerId];
    if (!inst) return;
    inst.currentMonth = new Date(inst.currentMonth.getFullYear(), inst.currentMonth.getMonth() + delta, 1);
    inst.rangeStart = null;
    this.render(containerId);
  },

  /**
   * Get selected dates for a container.
   * @returns {string[]|null} null means "all dates", array means specific dates
   */
  getSelectedDates(containerId) {
    var inst = this.instances[containerId];
    if (!inst) return null;
    if (inst.allActive) return null;
    return Array.from(inst.selectedDates).sort();
  },

  /**
   * Set selected dates for a container.
   * @param {string} containerId
   * @param {string[]|null} dates - null for "all", array for specific dates
   */
  setSelectedDates(containerId, dates) {
    var inst = this.instances[containerId];
    if (!inst) return;
    if (!dates || dates === null) {
      inst.allActive = true;
      inst.selectedDates.clear();
      inst.rangeStart = null;
    } else if (Array.isArray(dates) && dates.length > 0) {
      inst.allActive = false;
      inst.selectedDates = new Set(dates);
      inst.rangeStart = null;
    } else {
      inst.allActive = true;
      inst.selectedDates.clear();
      inst.rangeStart = null;
    }
    this.render(containerId);
  }
};

// Global click handler for calendar elements (event delegation)
document.addEventListener('click', function(e) {
  var dayEl = e.target.closest('[data-cal-day]');
  if (dayEl) {
    CalendarPicker.handleDayClick(dayEl.dataset.calContainer, dayEl.dataset.calDay);
    return;
  }
  var allEl = e.target.closest('[data-cal-all]');
  if (allEl) {
    CalendarPicker.handleAllClick(allEl.dataset.calAll);
    return;
  }
  var prevEl = e.target.closest('[data-cal-prev]');
  if (prevEl) {
    CalendarPicker.handleMonthChange(prevEl.dataset.calPrev, -1);
    return;
  }
  var nextEl = e.target.closest('[data-cal-next]');
  if (nextEl) {
    CalendarPicker.handleMonthChange(nextEl.dataset.calNext, 1);
    return;
  }
});
