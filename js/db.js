/**
 * db.js - IndexedDB wrapper for data persistence
 */
const DB = (function() {
  const DB_NAME = 'MiningManagementDB';
  const DB_VERSION = 2;
  const STORES = {
    openpit: 'openpit',
    stockpile: 'stockpile',
    breakdown: 'breakdown',
    parking: 'parking',
    transfer: 'transfer',
    settings: 'settings'
  };
  let dbInstance = null;

  function open() {
    return new Promise((resolve, reject) => {
      if (dbInstance) return resolve(dbInstance);
      const req = indexedDB.open(DB_NAME, DB_VERSION);
      req.onerror = () => reject(req.error);
      req.onsuccess = () => { dbInstance = req.result; resolve(dbInstance); };
      req.onupgradeneeded = (e) => {
        const db = e.target.result;
        if (!db.objectStoreNames.contains(STORES.openpit)) {
          db.createObjectStore(STORES.openpit, { keyPath: 'id', autoIncrement: true });
        }
        if (!db.objectStoreNames.contains(STORES.stockpile)) {
          db.createObjectStore(STORES.stockpile, { keyPath: 'id', autoIncrement: true });
        }
        if (!db.objectStoreNames.contains(STORES.breakdown)) {
          db.createObjectStore(STORES.breakdown, { keyPath: 'id', autoIncrement: true });
        }
        if (!db.objectStoreNames.contains(STORES.parking)) {
          db.createObjectStore(STORES.parking, { keyPath: 'id', autoIncrement: true });
        }
        if (!db.objectStoreNames.contains(STORES.transfer)) {
          db.createObjectStore(STORES.transfer, { keyPath: 'id', autoIncrement: true });
        }
        if (!db.objectStoreNames.contains(STORES.settings)) {
          db.createObjectStore(STORES.settings, { keyPath: 'key' });
        }
      };
    });
  }

  function tx(storeName, mode) {
    return open().then(db => db.transaction(storeName, mode).objectStore(storeName));
  }

  async function add(storeName, record) {
    const store = await tx(storeName, 'readwrite');
    return new Promise((resolve, reject) => {
      const req = store.add(record);
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
  }

  async function getAll(storeName) {
    const store = await tx(storeName, 'readonly');
    return new Promise((resolve, reject) => {
      const req = store.getAll();
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
  }

  async function remove(storeName, id) {
    const store = await tx(storeName, 'readwrite');
    return new Promise((resolve, reject) => {
      const req = store.delete(id);
      req.onsuccess = () => resolve(true);
      req.onerror = () => reject(req.error);
    });
  }

  async function clear(storeName) {
    const store = await tx(storeName, 'readwrite');
    return new Promise((resolve, reject) => {
      const req = store.clear();
      req.onsuccess = () => resolve(true);
      req.onerror = () => reject(req.error);
    });
  }

  async function getSetting(key) {
    const store = await tx(STORES.settings, 'readonly');
    return new Promise((resolve, reject) => {
      const req = store.get(key);
      req.onsuccess = () => resolve(req.result ? req.result.value : null);
      req.onerror = () => reject(req.error);
    });
  }

  async function setSetting(key, value) {
    const store = await tx(STORES.settings, 'readwrite');
    return new Promise((resolve, reject) => {
      const req = store.put({ key, value });
      req.onsuccess = () => resolve(true);
      req.onerror = () => reject(req.error);
    });
  }

  /**
   * Check if a QR code was registered in the SAME area within last 3 hours on the SAME DAY.
   * @param {string} qrCode - The scanned QR code value
   * @param {string} storeName - Only check within this specific area/store
   */
  async function isQRRegisteredRecently(qrCode, storeName) {
    if (!qrCode) return false;
    const now = Date.now();
    const threeHoursAgo = now - 3 * 60 * 60 * 1000;
    const today = new Date(now).toISOString().slice(0, 10);
    const records = await getAll(storeName);
    for (const r of records) {
      if (r.qrCode !== qrCode) continue;
      const recordTime = new Date(r.timestamp).getTime();
      if (r.timestamp.slice(0, 10) === today && recordTime >= threeHoursAgo) {
        return true;
      }
    }
    return false;
  }

  /**
   * Export ALL data from every store as a JSON-serializable object.
   * Includes openpit, stockpile, breakdown, parking, and settings.
   * @returns {Promise<Object>} { version, exportDate, stores: {...} }
   */
  async function exportAll() {
    const result = {
      appName: 'OPMS',
      version: 1,
      exportDate: new Date().toISOString(),
      stores: {}
    };
    for (const key of Object.keys(STORES)) {
      const storeName = STORES[key];
      result.stores[key] = await getAll(storeName);
    }
    return result;
  }

  /**
   * Import data from a JSON object previously created by exportAll().
   * Clears ALL existing data before importing (destructive operation).
   * @param {Object} data - The parsed JSON backup object
   * @returns {Promise<Object>} { imported: { storeName: count } }
   */
  async function importAll(data) {
    if (!data || !data.stores) throw new Error('Invalid backup file');
    const summary = {};
    for (const key of Object.keys(STORES)) {
      const storeName = STORES[key];
      // Clear existing data
      await clear(storeName);
      // Import records
      const records = data.stores[key] || [];
      for (const r of records) {
        // Remove auto-increment id to let DB assign new ones
        if ('id' in r) delete r.id;
        await add(storeName, r);
      }
      summary[key] = records.length;
    }
    return summary;
  }

  /**
   * Count records in all data stores (excluding settings).
   * @returns {Promise<Object>} { openpit: N, stockpile: N, ... }
   */
  async function countAll() {
    const counts = {};
    for (const key of Object.keys(STORES)) {
      if (key === 'settings') continue;
      const records = await getAll(STORES[key]);
      counts[key] = records.length;
    }
    return counts;
  }

  return { add, getAll, remove, clear, getSetting, setSetting, isQRRegisteredRecently, exportAll, importAll, countAll, STORES };
})();
