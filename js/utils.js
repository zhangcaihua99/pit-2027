/**
 * utils.js - Common utility functions
 */
const Utils = {
  /**
   * Get current date string YYYY-MM-DD (calendar date)
   */
  getTodayStr() {
    const d = new Date();
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
  },

  /**
   * Get shift date string YYYY-MM-DD.
   * Shift date: 07:00 ~ next day 07:00 = one complete date.
   * If current time is before 07:00, shift date = yesterday.
   * e.g. 2026-08-06 06:00 → shift date = 2026-08-05
   *      2026-08-06 08:00 → shift date = 2026-08-06
   */
  getShiftDateStr() {
    const d = new Date();
    if (d.getHours() < 7) {
      d.setDate(d.getDate() - 1);
    }
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
  },

  /**
   * Get current shift: "Day" (07:00-19:00) or "Night" (19:00-07:00)
   */
  getCurrentShift() {
    const h = new Date().getHours();
    if (h >= 7 && h < 19) return 'Day';
    return 'Night';
  },

  /**
   * Normalize shift value for backward compatibility.
   * "Day Shift" → "Day", "Night Shift" → "Night"
   */
  normalizeShift(shift) {
    if (!shift) return '';
    if (shift === 'Day' || shift === 'Night') return shift;
    if (shift.includes('Day')) return 'Day';
    if (shift.includes('Night')) return 'Night';
    return shift;
  },

  /**
   * Get timestamp string for filenames
   */
  getTimestampStr() {
    const d = new Date();
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    const h = String(d.getHours()).padStart(2, '0');
    const min = String(d.getMinutes()).padStart(2, '0');
    const s = String(d.getSeconds()).padStart(2, '0');
    return `${y}-${m}-${day}_${h}-${min}-${s}`;
  },

  /**
   * Show a toast message
   */
  toast(msg, type) {
    const el = document.getElementById('toast');
    el.innerHTML = msg;
    el.className = 'toast' + (type ? ' ' + type : '');
    setTimeout(() => el.classList.add('hidden'), 3000);
  },

  /**
   * Compress a photo from a video frame or image element
   * Returns base64 JPEG string
   */
  compressPhoto(canvas, maxWidth) {
    const ratio = Math.min(1, maxWidth / canvas.width);
    const w = Math.round(canvas.width * ratio);
    const h = Math.round(canvas.height * ratio);
    const c = document.createElement('canvas');
    c.width = w;
    c.height = h;
    const ctx = c.getContext('2d');
    ctx.drawImage(canvas, 0, 0, w, h);
    return c.toDataURL('image/jpeg', 0.7);
  },

  /**
   * Escape HTML to prevent XSS
   */
  escapeHtml(str) {
    if (str == null) return '';
    const div = document.createElement('div');
    div.textContent = String(str);
    return div.innerHTML;
  },

  /**
   * Save last-used values for a screen (for defaults)
   */
  async saveDefaults(prefix, data) {
    await DB.setSetting('defaults_' + prefix, data);
  },

  /**
   * Load last-used values for a screen
   */
  async loadDefaults(prefix) {
    return await DB.getSetting('defaults_' + prefix) || {};
  },

  /**
   * Download a blob as a file
   */
  downloadBlob(blob, filename) {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  },

  /**
   * Download a data URL as a file
   */
  downloadDataUrl(dataUrl, filename) {
    const a = document.createElement('a');
    a.href = dataUrl;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  }
};
