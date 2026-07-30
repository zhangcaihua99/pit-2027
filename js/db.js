/**
 * db.js - IndexedDB wrapper for data persistence
 */
const DB = (function() {
  const DB_NAME = 'MiningManagementDB';
  const DB_VERSION = 1;
  const STORES = {
    openpit: 'openpit',
    stockpile: 'stockpile',
    breakdown: 'breakdown',
    parking: 'parking',
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
   * Check if a QR code was registered within the last 3 hours across all stores
   */
  async function isQRRegisteredRecently(qrCode) {
    if (!qrCode) return false;
    const threeHoursAgo = Date.now() - 3 * 60 * 60 * 1000;
    const allStores = [STORES.openpit, STORES.stockpile, STORES.breakdown, STORES.parking];
    for (const s of allStores) {
      const records = await getAll(s);
      for (const r of records) {
        if (r.qrCode === qrCode && r.timestamp >= threeHoursAgo) {
          return true;
        }
      }
    }
    return false;
  }

  return { add, getAll, remove, clear, getSetting, setSetting, isQRRegisteredRecently, STORES };
})();
