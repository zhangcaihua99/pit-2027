/**
 * app.js - Main application logic
 */
const App = {
  state: {
    currentScreen: 'main',
    qrContext: null,
    cameraContext: null,
    deleteStore: null,
    deleteScreen: null,
    exportContext: null,
    dataViewSource: null, // 'main' or 'screen' — tracks which data view to refresh after delete
    // Temporary form data
    openpit: { qrCode: '', photo: '' },
    stockpile: { qrCode: '', photo: '' },
    transfer: { qrCode: '', photo: '' },
    breakdown: { qrCode: '', breakdownPhoto: '', newVehiclePhoto: '' },
    parking: { qrCode: '', parkingPhoto: '' }
  },

  // ==================== Init ====================
  init() {
    this.bindMainScreen();
    this.bindOpenPit();
    this.bindStockpile();
    this.bindTransfer();
    this.bindBreakdown();
    this.bindParking();
    this.bindModals();
    this.bindExportTab();
    this.bindBackupRestore();
    this.bindMainDataManagement();
    this.bindUpdateCheck();
    this.registerSW();
    this.requestPersistentStorage();
    // Fill main screen date/shift
    this.refreshMainScreen();
    // Restore person
    DB.getSetting('defaults_main').then(d => {
      if (d && d.person) document.getElementById('person').value = d.person;
    });
    // Show storage info on main screen
    this.updateStorageInfo();
  },

  // ==================== Persistent Storage ====================
  /**
   * Request the browser to mark this site's data as "persistent"
   * so it won't be automatically evicted during storage pressure
   * or when the user clears browsing data (some browsers respect this).
   */
  async requestPersistentStorage() {
    if (navigator.storage && navigator.storage.persist) {
      try {
        const isPersisted = await navigator.storage.persisted();
        if (!isPersisted) {
          const granted = await navigator.storage.persist();
          if (granted) {
            console.log('[OPMS] Persistent storage granted');
          } else {
            console.log('[OPMS] Persistent storage request denied (browser may auto-evict data)');
          }
        }
      } catch (e) {
        console.warn('[OPMS] persist() not supported:', e);
      }
    }
  },

  // ==================== Screen Management ====================
  showScreen(name) {
    document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
    const screen = document.getElementById('screen-' + name);
    if (screen) screen.classList.add('active');
    this.state.currentScreen = name;
    window.scrollTo(0, 0);

    if (name === 'main') this.refreshMainScreen();
    if (name === 'openpit') this.initOpenPitScreen();
    if (name === 'stockpile') this.initStockpileScreen();
    if (name === 'transfer') this.initTransferScreen();
    if (name === 'breakdown') this.initBreakdownScreen();
  },

  refreshMainScreen() {
    // Date and Shift removed from main screen per v1.5.0
  },

  bindMainScreen() {
    document.getElementById('btn-enter-site').addEventListener('click', () => {
      const person = document.getElementById('person').value.trim();
      if (!person) { Utils.toast('请输入数据录入人员<br><span class="en">Please enter operator</span>', 'error'); return; }
      const site = document.getElementById('working-site').value;
      if (!site) { Utils.toast('请选择工作区域<br><span class="en">Please select working site</span>', 'error'); return; }
      DB.setSetting('defaults_main', { person });
      this.showScreen(site);
    });

    document.querySelectorAll('.btn-back').forEach(btn => {
      btn.addEventListener('click', () => {
        const target = btn.getAttribute('data-back');
        this.showScreen(target);
      });
    });
  },

  // ==================== Open-pit Screen ====================
  async initOpenPitScreen() {
    // Auto-fill shift date and shift
    document.getElementById('op-shift-date').value = Utils.getShiftDateStr();
    document.getElementById('op-shift').value = Utils.getCurrentShift();

    const d = await Utils.loadDefaults('openpit');
    document.getElementById('op-location').value = d.location || '';
    document.getElementById('op-blasting').value = d.blasting || '';
    document.getElementById('op-shovel').value = d.shovel || '';
    document.getElementById('op-vehicle').value = '';
    if (d.vehicleType) document.getElementById('op-vehicle-type').value = d.vehicleType;
    if (d.formation) document.getElementById('op-formation').value = d.formation;
    if (d.grade) document.getElementById('op-grade').value = d.grade;
    if (d.hardness) document.getElementById('op-hardness').value = d.hardness;
    if (d.mineralType) document.getElementById('op-mineral-type').value = d.mineralType;
    if (d.destination) {
      document.getElementById('op-destination').value = d.destination;
    }
    document.getElementById('op-qr').value = '';
    document.getElementById('op-photo-preview').classList.add('hidden');
    document.getElementById('op-photo-preview').src = '';
    this.state.openpit.qrCode = '';
    this.state.openpit.photo = '';
  },

  bindOpenPit() {
    // Auto-trigger QR scan on destination change
    document.getElementById('op-destination').addEventListener('change', () => {
      const dest = document.getElementById('op-destination').value;
      if (!dest) return;
      this.startQRScan('openpit');
    });

    // Manual QR scan button
    document.getElementById('op-scan-qr').addEventListener('click', () => {
      this.startQRScan('openpit');
    });

    // Manual photo button
    document.getElementById('op-take-photo').addEventListener('click', () => {
      this.startCamera('openpit_photo');
    });

    // Submit
    document.getElementById('op-submit').addEventListener('click', () => this.submitOpenPit());

    // Data view
    document.getElementById('op-data-view').addEventListener('click', () => {
      this.showDataView('openpit', this.getOpenPitHeaders(), '采坑数据查看 (Open-pit Data)');
    });

    // Export
    document.getElementById('op-export').addEventListener('click', () => {
      this.state.exportContext = 'openpit';
      this.showExportModal();
    });

    // Delete
    document.getElementById('op-delete').addEventListener('click', () => {
      this.state.deleteStore = DB.STORES.openpit;
      this.state.deleteScreen = 'openpit';
      this.showDeleteOptions();
    });
  },

  getOpenPitHeaders() {
    return [
      { key: 'date', label: 'Shift_Date' },
      { key: 'shift', label: 'Shift' },
      { key: 'person', label: 'Person' },
      { key: 'location', label: 'Location' },
      { key: 'blasting', label: 'Blasting Area' },
      { key: 'shovel', label: 'Shovel' },
      { key: 'vehicleNo', label: 'Truck No.' },
      { key: 'vehicleType', label: 'Vehicle Type' },
      { key: 'formation', label: 'Formation' },
      { key: 'grade', label: 'Grade' },
      { key: 'hardness', label: 'Hardness' },
      { key: 'mineralType', label: 'Mineral Type' },
      { key: 'destination', label: 'Destination' },
      { key: 'qrCode', label: 'Tag (QR)' },
      { key: 'photo', label: 'Photo' },
      { key: 'timestamp', label: 'Timestamp' }
    ];
  },

  async submitOpenPit() {
    const person = document.getElementById('person').value.trim();
    const location = document.getElementById('op-location').value.trim();
    const blasting = document.getElementById('op-blasting').value.trim();
    const shovel = document.getElementById('op-shovel').value.trim();
    const vehicleNo = document.getElementById('op-vehicle').value.trim();
    const vehicleType = document.getElementById('op-vehicle-type').value;
    const formation = document.getElementById('op-formation').value;
    const grade = document.getElementById('op-grade').value;
    const hardness = document.getElementById('op-hardness').value;
    const mineralType = document.getElementById('op-mineral-type').value;
    const destination = document.getElementById('op-destination').value;
    const qrCode = this.state.openpit.qrCode || document.getElementById('op-qr').value.trim();
    const photo = this.state.openpit.photo;

    const fields = [
      [person, '录入人员', 'Operator'], [location, '作业平台', 'Location'], [blasting, '爆堆编号', 'Blasting Area'],
      [shovel, '挖机编号', 'Shovel'], [vehicleNo, '车辆编号', 'Vehicle No.'], [vehicleType, '车辆型号', 'Vehicle Type'],
      [formation, '地层', 'Formation'], [grade, '矿石品级', 'Grade'], [hardness, '硬度', 'Hardness'],
      [mineralType, '矿石类型', 'Mineral Type'], [destination, '矿岩去向', 'Destination'],
      [qrCode, '矿牌', 'Tag (QR)'], [photo, '车辆照片', 'Vehicle Photo']
    ];
    for (const [val, zh, en] of fields) {
      if (!val) { Utils.toast('请填写: ' + zh + '<br><span class="en">Please fill: ' + en + '</span>', 'error'); return; }
    }

    const record = {
      date: Utils.getShiftDateStr(),
      shift: Utils.getCurrentShift(),
      person, location, blasting, shovel, vehicleNo, vehicleType,
      formation, grade, hardness, mineralType, destination,
      qrCode, photo, timestamp: new Date().toISOString()
    };

    await DB.add(DB.STORES.openpit, record);

    // Save defaults
    await Utils.saveDefaults('openpit', { location, blasting, shovel, vehicleType, formation, grade, hardness, mineralType, destination });

    // Clear vehicle no, QR, photo — keep destination as default for next entry
    document.getElementById('op-vehicle').value = '';
    document.getElementById('op-qr').value = '';
    const preview = document.getElementById('op-photo-preview');
    preview.classList.add('hidden');
    preview.src = '';
    this.state.openpit.qrCode = '';
    this.state.openpit.photo = '';

    Utils.toast('数据上传成功!<br><span class="en">Data submitted!</span>', 'success');
  },

  // ==================== Stockpile Screen ====================
  async initStockpileScreen() {
    // Auto-fill shift date and shift
    document.getElementById('sp-shift-date').value = Utils.getShiftDateStr();
    document.getElementById('sp-shift').value = Utils.getCurrentShift();

    const d = await Utils.loadDefaults('stockpile');
    document.getElementById('sp-vehicle').value = '';
    if (d.destination) document.getElementById('sp-destination').value = d.destination;
    document.getElementById('sp-qr').value = '';
    const preview = document.getElementById('sp-photo-preview');
    preview.classList.add('hidden');
    preview.src = '';
    this.state.stockpile.qrCode = '';
    this.state.stockpile.photo = '';
  },

  bindStockpile() {
    // Auto-trigger QR scan on destination change
    document.getElementById('sp-destination').addEventListener('change', () => {
      const dest = document.getElementById('sp-destination').value;
      if (dest) {
        this.startQRScan('stockpile');
      }
    });

    document.getElementById('sp-scan-qr').addEventListener('click', () => {
      this.startQRScan('stockpile');
    });

    document.getElementById('sp-take-photo').addEventListener('click', () => {
      this.startCamera('stockpile_photo');
    });

    document.getElementById('sp-submit').addEventListener('click', () => this.submitStockpile());

    document.getElementById('sp-data-view').addEventListener('click', () => {
      this.showDataView('stockpile', this.getStockpileHeaders(), '堆场数据查看 (Stockpile Data)');
    });

    document.getElementById('sp-export').addEventListener('click', () => {
      this.state.exportContext = 'stockpile';
      this.showExportModal();
    });

    document.getElementById('sp-delete').addEventListener('click', () => {
      this.state.deleteStore = DB.STORES.stockpile;
      this.state.deleteScreen = 'stockpile';
      this.showDeleteOptions();
    });
  },

  getStockpileHeaders() {
    return [
      { key: 'date', label: 'Shift_Date' },
      { key: 'shift', label: 'Shift' },
      { key: 'person', label: 'Person' },
      { key: 'vehicleNo', label: 'Vehicle No.' },
      { key: 'destination', label: 'Destination' },
      { key: 'qrCode', label: 'Tag (QR)' },
      { key: 'photo', label: 'Photo' },
      { key: 'timestamp', label: 'Timestamp' }
    ];
  },

  async submitStockpile() {
    const person = document.getElementById('person').value.trim();
    const vehicleNo = document.getElementById('sp-vehicle').value.trim();
    const destination = document.getElementById('sp-destination').value;
    const qrCode = this.state.stockpile.qrCode || document.getElementById('sp-qr').value.trim();
    const photo = this.state.stockpile.photo;

    const fields = [
      [person, '录入人员', 'Operator'], [vehicleNo, '车辆编号', 'Vehicle No.'],
      [destination, '矿岩去向', 'Destination'], [qrCode, '矿牌', 'Tag (QR)'], [photo, '车辆照片', 'Vehicle Photo']
    ];
    for (const [val, zh, en] of fields) {
      if (!val) { Utils.toast('请填写: ' + zh + '<br><span class="en">Please fill: ' + en + '</span>', 'error'); return; }
    }

    const record = {
      date: Utils.getShiftDateStr(),
      shift: Utils.getCurrentShift(),
      person, vehicleNo, destination, qrCode, photo,
      timestamp: new Date().toISOString()
    };

    await DB.add(DB.STORES.stockpile, record);
    await Utils.saveDefaults('stockpile', { destination });

    document.getElementById('sp-vehicle').value = '';
    document.getElementById('sp-qr').value = '';
    const preview = document.getElementById('sp-photo-preview');
    preview.classList.add('hidden');
    preview.src = '';
    this.state.stockpile.qrCode = '';
    this.state.stockpile.photo = '';

    Utils.toast('数据上传成功!<br><span class="en">Data submitted!</span>', 'success');
  },

  // ==================== Transfer Screen ====================
  async initTransferScreen() {
    // Auto-fill shift date and shift
    document.getElementById('tr-shift-date').value = Utils.getShiftDateStr();
    document.getElementById('tr-shift').value = Utils.getCurrentShift();

    const d = await Utils.loadDefaults('transfer');
    document.getElementById('tr-vehicle').value = '';
    if (d.origin) document.getElementById('tr-origin').value = d.origin;
    if (d.destination) document.getElementById('tr-destination').value = d.destination;
    document.getElementById('tr-qr').value = '';
    const preview = document.getElementById('tr-photo-preview');
    preview.classList.add('hidden');
    preview.src = '';
    this.state.transfer.qrCode = '';
    this.state.transfer.photo = '';
  },

  bindTransfer() {
    // Auto-trigger QR scan on destination change
    document.getElementById('tr-destination').addEventListener('change', () => {
      const dest = document.getElementById('tr-destination').value;
      if (dest) {
        this.startQRScan('transfer');
      }
    });

    document.getElementById('tr-scan-qr').addEventListener('click', () => {
      this.startQRScan('transfer');
    });

    document.getElementById('tr-take-photo').addEventListener('click', () => {
      this.startCamera('transfer_photo');
    });

    document.getElementById('tr-submit').addEventListener('click', () => this.submitTransfer());

    document.getElementById('tr-data-view').addEventListener('click', () => {
      this.showDataView('transfer', this.getTransferHeaders(), '二次转运数据查看 (Secondary Transfer Data)');
    });

    document.getElementById('tr-export').addEventListener('click', () => {
      this.state.exportContext = 'transfer';
      this.showExportModal();
    });

    document.getElementById('tr-delete').addEventListener('click', () => {
      this.state.deleteStore = DB.STORES.transfer;
      this.state.deleteScreen = 'transfer';
      this.showDeleteOptions();
    });
  },

  getTransferHeaders() {
    return [
      { key: 'date', label: 'Shift_Date' },
      { key: 'shift', label: 'Shift' },
      { key: 'person', label: 'Person' },
      { key: 'origin', label: 'Origin' },
      { key: 'destination', label: 'Destination' },
      { key: 'vehicleNo', label: 'Vehicle No.' },
      { key: 'qrCode', label: 'Tag (QR)' },
      { key: 'photo', label: 'Photo' },
      { key: 'timestamp', label: 'Timestamp' }
    ];
  },

  async submitTransfer() {
    const person = document.getElementById('person').value.trim();
    const origin = document.getElementById('tr-origin').value.trim();
    const destination = document.getElementById('tr-destination').value.trim();
    const vehicleNo = document.getElementById('tr-vehicle').value.trim();
    const qrCode = this.state.transfer.qrCode || document.getElementById('tr-qr').value.trim();
    const photo = this.state.transfer.photo;

    const fields = [
      [person, '录入人员', 'Operator'], [origin, '出发地', 'Origin'], [destination, '目的地', 'Destination'],
      [vehicleNo, '车辆编号', 'Vehicle No.'],
      [qrCode, '矿牌', 'Tag (QR)'], [photo, '车辆照片', 'Vehicle Photo']
    ];
    for (const [val, zh, en] of fields) {
      if (!val) { Utils.toast('请填写: ' + zh + '<br><span class="en">Please fill: ' + en + '</span>', 'error'); return; }
    }

    const record = {
      date: Utils.getShiftDateStr(),
      shift: Utils.getCurrentShift(),
      person, origin, destination, vehicleNo, qrCode, photo,
      timestamp: new Date().toISOString()
    };

    await DB.add(DB.STORES.transfer, record);
    await Utils.saveDefaults('transfer', { origin, destination });

    document.getElementById('tr-vehicle').value = '';
    document.getElementById('tr-qr').value = '';
    const preview = document.getElementById('tr-photo-preview');
    preview.classList.add('hidden');
    preview.src = '';
    this.state.transfer.qrCode = '';
    this.state.transfer.photo = '';

    Utils.toast('数据上传成功!<br><span class="en">Data submitted!</span>', 'success');
  },

  // ==================== Breakdown Screen ====================
  initBreakdownScreen() {
    document.getElementById('bd-date').value = Utils.getShiftDateStr();
    document.getElementById('pk-date').value = Utils.getShiftDateStr();
    // Reset form fields
    this.resetBreakdownForm();
    this.resetParkingForm();
  },

  resetBreakdownForm() {
    document.getElementById('bd-shift').value = '';
    document.getElementById('bd-transfer-date').value = '';
    document.getElementById('bd-transfer-shift').value = '';
    document.getElementById('bd-qr').value = '';
    document.getElementById('bd-vehicle').value = '';
    document.getElementById('bd-new-vehicle').value = '';
    document.getElementById('bd-photo-preview').classList.add('hidden');
    document.getElementById('bd-new-photo-preview').classList.add('hidden');
    document.getElementById('bd-photo-preview').src = '';
    document.getElementById('bd-new-photo-preview').src = '';
    this.state.breakdown = { qrCode: '', breakdownPhoto: '', newVehiclePhoto: '' };
  },

  resetParkingForm() {
    document.getElementById('pk-shift').value = '';
    document.getElementById('pk-qr').value = '';
    document.getElementById('pk-vehicle').value = '';
    document.getElementById('pk-photo-preview').classList.add('hidden');
    document.getElementById('pk-photo-preview').src = '';
    this.state.parking = { qrCode: '', parkingPhoto: '' };
  },

  bindBreakdown() {
    // Tab switching
    document.querySelectorAll('.tab-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
        document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));
        btn.classList.add('active');
        document.getElementById(btn.getAttribute('data-tab')).classList.add('active');
      });
    });

    // Breakdown QR auto-trigger
    document.getElementById('bd-transfer-shift').addEventListener('change', () => {
      if (document.getElementById('bd-transfer-shift').value) {
        this.startQRScan('breakdown');
      }
    });
    document.getElementById('bd-scan-qr').addEventListener('click', () => this.startQRScan('breakdown'));

    // Breakdown photo auto-trigger on vehicle no. change
    document.getElementById('bd-vehicle').addEventListener('change', () => {
      const v = document.getElementById('bd-vehicle').value.trim();
      if (v) {
        document.getElementById('bd-photo-preview').classList.add('hidden');
        document.getElementById('bd-photo-preview').src = '';
        this.state.breakdown.breakdownPhoto = '';
        this.startCamera('breakdown_breakdownPhoto');
      }
    });
    document.getElementById('bd-take-photo').addEventListener('click', () => this.startCamera('breakdown_breakdownPhoto'));

    // New vehicle photo auto-trigger
    document.getElementById('bd-new-vehicle').addEventListener('change', () => {
      const v = document.getElementById('bd-new-vehicle').value.trim();
      if (v) {
        document.getElementById('bd-new-photo-preview').classList.add('hidden');
        document.getElementById('bd-new-photo-preview').src = '';
        this.state.breakdown.newVehiclePhoto = '';
        this.startCamera('breakdown_newVehiclePhoto');
      }
    });
    document.getElementById('bd-take-new-photo').addEventListener('click', () => this.startCamera('breakdown_newVehiclePhoto'));

    // Breakdown submit
    document.getElementById('bd-submit').addEventListener('click', () => this.submitBreakdown());
    document.getElementById('bd-data-view').addEventListener('click', () => {
      this.showDataView('breakdown', this.getBreakdownHeaders(), '故障车辆数据查看 (Breakdown Data)');
    });
    document.getElementById('bd-delete').addEventListener('click', () => {
      this.state.deleteStore = DB.STORES.breakdown;
      this.state.deleteScreen = 'breakdown';
      this.showDeleteOptions();
    });
  },

  getBreakdownHeaders() {
    return [
      { key: 'breakdownDate', label: 'Shift_Date' },
      { key: 'breakdownShift', label: 'Shift' },
      { key: 'breakdownVehicleNo', label: 'Breakdown Vehicle No.' },
      { key: 'breakdownPhoto', label: 'Breakdown Photo' },
      { key: 'transferDate', label: 'Transfer Date' },
      { key: 'transferShift', label: 'Transfer Shift' },
      { key: 'qrCode', label: 'Tag (QR)' },
      { key: 'newVehicleNo', label: 'New Vehicle No.' },
      { key: 'newVehiclePhoto', label: 'New Vehicle Photo' },
      { key: 'timestamp', label: 'Timestamp' }
    ];
  },

  async submitBreakdown() {
    const breakdownDate = document.getElementById('bd-date').value;
    const breakdownShift = document.getElementById('bd-shift').value;
    const transferDate = document.getElementById('bd-transfer-date').value;
    const transferShift = document.getElementById('bd-transfer-shift').value;
    const qrCode = this.state.breakdown.qrCode || document.getElementById('bd-qr').value.trim();
    const breakdownVehicleNo = document.getElementById('bd-vehicle').value.trim();
    const breakdownPhoto = this.state.breakdown.breakdownPhoto;
    const newVehicleNo = document.getElementById('bd-new-vehicle').value.trim();
    const newVehiclePhoto = this.state.breakdown.newVehiclePhoto;

    const fields = [
      [breakdownDate, '故障日期', 'Breakdown Date'], [breakdownShift, '故障班次', 'Breakdown Shift'],
      [breakdownVehicleNo, '故障车编号', 'Breakdown Vehicle No.'],
      [breakdownPhoto, '故障车照片', 'Breakdown Vehicle Photo'],
      [transferDate, '转运日期', 'Transfer Date'], [transferShift, '转运班次', 'Transfer Shift'],
      [qrCode, '矿牌', 'Tag (QR)'],
      [newVehicleNo, '新车编号', 'New Vehicle No.'], [newVehiclePhoto, '新车照片', 'New Vehicle Photo']
    ];
    for (const [val, zh, en] of fields) {
      if (!val) { Utils.toast('请填写: ' + zh + '<br><span class="en">Please fill: ' + en + '</span>', 'error'); return; }
    }

    const record = {
      breakdownDate, breakdownShift, transferDate, transferShift,
      qrCode, breakdownVehicleNo, breakdownPhoto, newVehicleNo, newVehiclePhoto,
      timestamp: new Date().toISOString()
    };

    await DB.add(DB.STORES.breakdown, record);
    this.resetBreakdownForm();
    document.getElementById('bd-date').value = Utils.getShiftDateStr();
    Utils.toast('数据上传成功!<br><span class="en">Data submitted!</span>', 'success');
  },

  // ==================== Parking Screen ====================
  bindParking() {
    // Parking QR auto-trigger on parking shift change
    document.getElementById('pk-shift').addEventListener('change', () => {
      if (document.getElementById('pk-shift').value) {
        this.startQRScan('parking');
      }
    });
    document.getElementById('pk-scan-qr').addEventListener('click', () => this.startQRScan('parking'));

    // Parking photo auto-trigger
    document.getElementById('pk-vehicle').addEventListener('change', () => {
      const v = document.getElementById('pk-vehicle').value.trim();
      if (v) {
        document.getElementById('pk-photo-preview').classList.add('hidden');
        document.getElementById('pk-photo-preview').src = '';
        this.state.parking.parkingPhoto = '';
        this.startCamera('parking_parkingPhoto');
      }
    });
    document.getElementById('pk-take-photo').addEventListener('click', () => this.startCamera('parking_parkingPhoto'));

    document.getElementById('pk-submit').addEventListener('click', () => this.submitParking());
    document.getElementById('pk-data-view').addEventListener('click', () => {
      this.showDataView('parking', this.getParkingHeaders(), '押矿车辆数据查看 (Parking Data)');
    });
    document.getElementById('pk-delete').addEventListener('click', () => {
      this.state.deleteStore = DB.STORES.parking;
      this.state.deleteScreen = 'parking';
      this.showDeleteOptions();
    });
  },

  getParkingHeaders() {
    return [
      { key: 'breakdownDate', label: 'Shift_Date' },
      { key: 'breakdownShift', label: 'Shift' },
      { key: 'qrCode', label: 'Tag (QR)' },
      { key: 'parkingVehicleNo', label: 'Parking Vehicle No.' },
      { key: 'parkingPhoto', label: 'Parking Photo' },
      { key: 'timestamp', label: 'Timestamp' }
    ];
  },

  async submitParking() {
    const breakdownDate = document.getElementById('pk-date').value;
    const breakdownShift = document.getElementById('pk-shift').value;
    const qrCode = this.state.parking.qrCode || document.getElementById('pk-qr').value.trim();
    const parkingVehicleNo = document.getElementById('pk-vehicle').value.trim();
    const parkingPhoto = this.state.parking.parkingPhoto;

    const fields = [
      [breakdownDate, '押矿日期', 'Parking Date'], [breakdownShift, '押矿班次', 'Parking Shift'],
      [qrCode, '矿牌', 'Tag (QR)'], [parkingVehicleNo, '押矿车辆编号', 'Parking Vehicle No.'], [parkingPhoto, '押矿车辆照片', 'Parking Vehicle Photo']
    ];
    for (const [val, zh, en] of fields) {
      if (!val) { Utils.toast('请填写: ' + zh + '<br><span class="en">Please fill: ' + en + '</span>', 'error'); return; }
    }

    const record = {
      breakdownDate, breakdownShift,
      qrCode, parkingVehicleNo, parkingPhoto,
      timestamp: new Date().toISOString()
    };

    await DB.add(DB.STORES.parking, record);
    this.resetParkingForm();
    document.getElementById('pk-date').value = Utils.getShiftDateStr();
    Utils.toast('数据上传成功!<br><span class="en">Data submitted!</span>', 'success');
  },

  // ==================== Export Tab (Breakdown/Parking) ====================
  bindExportTab() {
    document.getElementById('bd-export-excel').addEventListener('click', () => this.exportBreakdownData('excel'));
    document.getElementById('bd-export-png').addEventListener('click', () => this.exportBreakdownData('png'));
    // Load dates when export tab is shown
    document.querySelector('.tab-btn[data-tab="bd-export-tab"]').addEventListener('click', () => {
      this.loadBdExportDates();
    });
  },

  async loadBdExportDates() {
    const dateSet = new Set();
    const bdRecords = await DB.getAll(DB.STORES.breakdown);
    const pkRecords = await DB.getAll(DB.STORES.parking);
    bdRecords.forEach(r => { if (r.breakdownDate) dateSet.add(r.breakdownDate); });
    pkRecords.forEach(r => { if (r.breakdownDate) dateSet.add(r.breakdownDate); });
    CalendarPicker.init('bd-export-dates', Array.from(dateSet));
  },

  getBdExportSelectedDates() {
    return CalendarPicker.getSelectedDates('bd-export-dates');
  },

  async exportBreakdownData(type) {
    const exportType = document.getElementById('bd-export-type').value;
    const filterDates = this.getBdExportSelectedDates();
    const filterShift = document.getElementById('bd-export-shift').value;

    let records = [];
    let headers, label, filename, title;

    if (exportType === 'all') {
      // Merge breakdown + parking records
      const bdRecords = await DB.getAll(DB.STORES.breakdown);
      const pkRecords = await DB.getAll(DB.STORES.parking);
      // Normalize: add type field and unify field names
      bdRecords.forEach(r => { r.recordType = '故障车辆 (Breakdown)'; r.vehicleNo = r.breakdownVehicleNo; r.vehiclePhoto = r.breakdownPhoto; });
      pkRecords.forEach(r => { r.recordType = '押矿车辆 (Parking)'; r.vehicleNo = r.parkingVehicleNo; r.vehiclePhoto = r.parkingPhoto; });
      records = bdRecords.concat(pkRecords);

      if (filterDates) records = records.filter(r => r.breakdownDate && filterDates.includes(r.breakdownDate));
      if (filterShift) records = records.filter(r => Utils.normalizeShift(r.breakdownShift) === filterShift);
      records.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));

      headers = [
        { key: 'recordType', label: 'Type' },
        { key: 'breakdownDate', label: 'Shift_Date' },
        { key: 'breakdownShift', label: 'Shift' },
        { key: 'breakdownVehicleNo', label: 'Vehicle No.' },
        { key: 'breakdownPhoto', label: 'Vehicle Photo' },
        { key: 'transferDate', label: 'Transfer Date' },
        { key: 'transferShift', label: 'Transfer Shift' },
        { key: 'qrCode', label: 'Tag (QR)' },
        { key: 'newVehicleNo', label: 'New Vehicle No.' },
        { key: 'newVehiclePhoto', label: 'New Vehicle Photo' },
        { key: 'timestamp', label: 'Timestamp' }
      ];
      label = 'All';
      filename = label + '_' + Utils.getTimestampStr();
      title = '全部数据 (All Data)';
    } else {
      const storeName = exportType === 'parking' ? DB.STORES.parking : DB.STORES.breakdown;
      records = await DB.getAll(storeName);

      if (filterDates) records = records.filter(r => r.breakdownDate && filterDates.includes(r.breakdownDate));
      if (filterShift) records = records.filter(r => Utils.normalizeShift(r.breakdownShift) === filterShift);
      records.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));

      headers = exportType === 'parking' ? this.getParkingHeaders() : this.getBreakdownHeaders();
      label = exportType === 'parking' ? 'Parking' : 'Breakdown';
      filename = label + '_' + Utils.getTimestampStr();
      title = exportType === 'parking' ? '押矿车辆数据 (Vehicles in Parking Lot)' : '故障车辆数据 (Vehicle Breakdown)';
    }

    if (records.length === 0) {
      Utils.toast('没有数据可导出<br><span class="en">No data to export</span>', 'error');
      return;
    }

    if (type === 'excel') {
      Exporter.toExcel(records, headers, filename);
    } else {
      Exporter.toPNG(records, headers, filename, title);
    }
    Utils.toast('导出成功!<br><span class="en">Exported!</span>', 'success');
  },

  // ==================== QR Scanning ====================
  startQRScan(context) {
    this.state.qrContext = context;
    document.getElementById('qr-modal').classList.remove('hidden');
    // Clear reader container
    document.getElementById('qr-reader').innerHTML = '';
    setTimeout(() => {
      Scanner.start('qr-reader', (decodedText) => this.onQRScanned(decodedText));
    }, 100);
  },

  async onQRScanned(decodedText) {
    document.getElementById('qr-modal').classList.add('hidden');

    const ctx = this.state.qrContext;
    const qrInputMap = {
      openpit: 'op-qr',
      stockpile: 'sp-qr',
      transfer: 'tr-qr',
      breakdown: 'bd-qr',
      parking: 'pk-qr'
    };
    const inputId = qrInputMap[ctx];

    // Check duplicate FIRST — only within the SAME area
    const isDup = await DB.isQRRegisteredRecently(decodedText, ctx);
    if (isDup) {
      Utils.toast('重复扫描二维码<br><span class="en">Duplicate Scan Detected</span>', 'error');
      if (inputId) document.getElementById(inputId).value = '';
      this.state[ctx].qrCode = '';
      return;
    }

    // Only fill QR field after passing duplicate check
    if (inputId) document.getElementById(inputId).value = decodedText;
    this.state[ctx].qrCode = decodedText;

    Utils.toast('扫描成功!<br><span class="en">Scan successful!</span>', 'success');

    // For openpit, stockpile, and transfer, auto-open camera after QR scan
    if (ctx === 'openpit') {
      setTimeout(() => this.startCamera('openpit_photo'), 300);
    } else if (ctx === 'stockpile') {
      setTimeout(() => this.startCamera('stockpile_photo'), 300);
    } else if (ctx === 'transfer') {
      setTimeout(() => this.startCamera('transfer_photo'), 300);
    }
  },

  async handleManualQR(ctx, value) {
    if (!value) {
      this.state[ctx].qrCode = '';
      return;
    }
    const isDup = await DB.isQRRegisteredRecently(value, ctx);
    if (isDup) {
      Utils.toast('重复扫描二维码<br><span class="en">Duplicate Scan Detected</span>', 'error');
      const qrInputMap = { openpit: 'op-qr', stockpile: 'sp-qr', transfer: 'tr-qr', breakdown: 'bd-qr', parking: 'pk-qr' };
      const inputId = qrInputMap[ctx];
      if (inputId) document.getElementById(inputId).value = '';
      this.state[ctx].qrCode = '';
      return;
    }
    this.state[ctx].qrCode = value;
    Utils.toast('矿牌已录入<br><span class="en">Tag recorded</span>', 'success');
  },

  // ==================== Camera / Photo ====================
  startCamera(context) {
    this.state.cameraContext = context;
    const titles = {
      'openpit_photo': '车辆照片 (Vehicle Photo)',
      'stockpile_photo': '车辆照片 (Vehicle Photo)',
      'transfer_photo': '车辆照片 (Vehicle Photo)',
      'breakdown_breakdownPhoto': '故障车照片 (Breakdown Vehicle Photo)',
      'breakdown_newVehiclePhoto': '新车照片 (New Vehicle Photo)',
      'parking_parkingPhoto': '押矿车辆照片 (Parking Vehicle Photo)'
    };
    document.getElementById('camera-title').textContent = titles[context] || '拍照';
    document.getElementById('camera-modal').classList.remove('hidden');
    Camera.start('camera-video', (photoData) => this.onPhotoCaptured(photoData));
  },

  onPhotoCaptured(photoData) {
    document.getElementById('camera-modal').classList.add('hidden');
    Camera.stop();

    const ctx = this.state.cameraContext;
    const ctxParts = ctx.split('_');
    const screen = ctxParts[0];
    const photoKey = ctxParts[1];

    // Store photo data in state
    this.state[screen][photoKey] = photoData;

    // Show preview
    const previewMap = {
      'openpit_photo': 'op-photo-preview',
      'stockpile_photo': 'sp-photo-preview',
      'transfer_photo': 'tr-photo-preview',
      'breakdown_breakdownPhoto': 'bd-photo-preview',
      'breakdown_newVehiclePhoto': 'bd-new-photo-preview',
      'parking_parkingPhoto': 'pk-photo-preview'
    };
    const previewId = previewMap[ctx];
    if (previewId) {
      const img = document.getElementById(previewId);
      img.src = photoData;
      img.classList.remove('hidden');
    }
    Utils.toast('拍照成功!<br><span class="en">Photo taken!</span>', 'success');
  },

  // ==================== Data View ====================
  async showDataView(storeKey, headers, title) {
    this.state.dataViewSource = 'screen';
    const storeMap = {
      openpit: DB.STORES.openpit,
      stockpile: DB.STORES.stockpile,
      transfer: DB.STORES.transfer,
      breakdown: DB.STORES.breakdown,
      parking: DB.STORES.parking
    };
    let records = await DB.getAll(storeMap[storeKey]);
    records.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));

    document.getElementById('dataview-title').textContent = title;
    const content = document.getElementById('dataview-content');

    if (records.length === 0) {
      content.innerHTML = '<p class="empty-msg">暂无数据 (No data)</p>';
    } else {
      let html = '<table class="data-table"><thead><tr>';
      html += '<th>#</th>';
      headers.forEach(h => { html += `<th>${h.label}</th>`; });
      html += '<th>操作</th>';
      html += '</tr></thead><tbody>';
      records.forEach((r, i) => {
        html += `<tr>`;
        html += `<td>${i + 1}</td>`;
        headers.forEach(h => {
          let val = r[h.key];
          if (h.key === 'photo' || h.key === 'breakdownPhoto' || h.key === 'newVehiclePhoto' || h.key === 'parkingPhoto') {
            if (val) {
              html += `<td class="td-photo"><img src="${val}" onclick="App.showFullImage('${val}')" alt="photo"></td>`;
            } else {
              html += `<td>-</td>`;
            }
          } else if (h.key === 'timestamp') {
            html += `<td>${val ? new Date(val).toLocaleString('zh-CN') : ''}</td>`;
          } else {
            html += `<td>${Utils.escapeHtml(val)}</td>`;
          }
        });
        html += `<td class="td-actions"><button class="btn-delete-row" onclick="App.deleteRecord('${storeKey}', ${r.id})">删除</button></td>`;
        html += `</tr>`;
      });
      html += '</tbody></table>';
      content.innerHTML = html;
    }

    document.getElementById('dataview-modal').classList.remove('hidden');
  },

  showFullImage(srcOrIndex) {
    const src = typeof srcOrIndex === 'number'
      ? (App._tempImages || [])[srcOrIndex]
      : srcOrIndex;
    if (!src) return;
    const overlay = document.createElement('div');
    overlay.style.cssText = 'position:fixed;inset:0;z-index:10001;background:rgba(0,0,0,0.9);display:flex;align-items:center;justify-content:center;padding:20px;';
    overlay.onclick = () => overlay.remove();
    const img = document.createElement('img');
    img.src = src;
    img.style.cssText = 'max-width:95%;max-height:90vh;border-radius:8px;';
    overlay.appendChild(img);
    document.body.appendChild(overlay);
  },

  async deleteRecord(storeKey, id) {
    this.showPasswordModal(async () => {
      const storeMap = {
        openpit: DB.STORES.openpit,
        stockpile: DB.STORES.stockpile,
        transfer: DB.STORES.transfer,
        breakdown: DB.STORES.breakdown,
        parking: DB.STORES.parking
      };
      await DB.remove(storeMap[storeKey], id);
      Utils.toast('删除成功!<br><span class="en">Deleted!</span>', 'success');
      // Refresh the correct data view based on source
      if (this.state.dataViewSource === 'main') {
        this.loadMainDataView();
      } else {
        const headersMap = {
          openpit: this.getOpenPitHeaders(),
          stockpile: this.getStockpileHeaders(),
          transfer: this.getTransferHeaders(),
          breakdown: this.getBreakdownHeaders(),
          parking: this.getParkingHeaders()
        };
        const titlesMap = {
          openpit: '采坑数据查看 (Open-pit Data)',
          stockpile: '堆场数据查看 (Stockpile Data)',
          transfer: '二次转运数据查看 (Secondary Transfer Data)',
          breakdown: '故障车辆数据查看 (Breakdown Data)',
          parking: '押矿车辆数据查看 (Parking Data)'
        };
        this.showDataView(storeKey, headersMap[storeKey], titlesMap[storeKey]);
      }
    });
  },

  // ==================== Delete Options ====================
  showDeleteOptions() {
    document.getElementById('delete-modal').classList.remove('hidden');
  },

  // ==================== Export Modal ====================
  async showExportModal() {
    document.getElementById('export-modal').classList.remove('hidden');
    await this.loadSubExportDates();
  },

  async loadSubExportDates() {
    const ctx = this.state.exportContext;
    const storeMap = {
      openpit: DB.STORES.openpit,
      stockpile: DB.STORES.stockpile,
      transfer: DB.STORES.transfer
    };
    const dateSet = new Set();
    const records = await DB.getAll(storeMap[ctx]);
    records.forEach(r => {
      const d = r.date || r.breakdownDate;
      if (d) dateSet.add(d);
    });
    CalendarPicker.init('export-dates', Array.from(dateSet));
  },

  getSubExportSelectedDates() {
    return CalendarPicker.getSelectedDates('export-dates');
  },

  async doExport(type) {
    const ctx = this.state.exportContext;
    const filterDates = this.getSubExportSelectedDates();
    const filterShift = document.getElementById('export-shift').value;

    const storeMap = {
      openpit: DB.STORES.openpit,
      stockpile: DB.STORES.stockpile,
      transfer: DB.STORES.transfer
    };
    const headersMap = {
      openpit: this.getOpenPitHeaders(),
      stockpile: this.getStockpileHeaders(),
      transfer: this.getTransferHeaders()
    };
    const labelMap = {
      openpit: 'Open-pit',
      stockpile: 'Stockpile',
      transfer: 'Transfer'
    };
    const titleMap = {
      openpit: '采坑数据 (Open-pit Data)',
      stockpile: '堆场数据 (Stockpile Data)',
      transfer: '二次转运数据 (Secondary Transfer Data)'
    };

    let records = await DB.getAll(storeMap[ctx]);
    if (filterDates) records = records.filter(r => {
      const d = r.date || r.breakdownDate;
      return d && filterDates.includes(d);
    });
    if (filterShift) records = records.filter(r => Utils.normalizeShift(r.shift) === filterShift);
    records.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));

    if (records.length === 0) {
      Utils.toast('没有数据可导出<br><span class="en">No data to export</span>', 'error');
      return;
    }

    const headers = headersMap[ctx];
    const filename = labelMap[ctx] + '_' + Utils.getTimestampStr();
    const title = titleMap[ctx];

    if (type === 'excel') {
      Exporter.toExcel(records, headers, filename);
    } else {
      Exporter.toPNG(records, headers, filename, title);
    }
    Utils.toast('导出成功!<br><span class="en">Exported!</span>', 'success');
  },

  // ==================== Modals ====================
  bindModals() {
    // QR modal close
    document.getElementById('qr-close').addEventListener('click', () => {
      document.getElementById('qr-modal').classList.add('hidden');
      Scanner.stop();
    });

    // Camera modal
    document.getElementById('camera-close').addEventListener('click', () => {
      document.getElementById('camera-modal').classList.add('hidden');
      Camera.stop();
    });
    document.getElementById('camera-capture').addEventListener('click', () => {
      Camera.capture();
    });

    // Password modal
    document.getElementById('password-close').addEventListener('click', () => {
      document.getElementById('password-modal').classList.add('hidden');
      App._passwordCallback = null;
    });
    document.getElementById('password-confirm').addEventListener('click', () => {
      const pwd = document.getElementById('password-input').value;
      if (pwd === 'ckc2026') {
        document.getElementById('password-modal').classList.add('hidden');
        document.getElementById('password-input').value = '';
        const cb = App._passwordCallback;
        App._passwordCallback = null;
        if (cb) cb();
      } else {
        Utils.toast('密码错误!<br><span class="en">Wrong password!</span>', 'error');
      }
    });

    // Delete options modal
    document.getElementById('delete-close').addEventListener('click', () => {
      document.getElementById('delete-modal').classList.add('hidden');
    });
    document.getElementById('delete-single').addEventListener('click', () => {
      document.getElementById('delete-modal').classList.add('hidden');
      // Show data view with delete buttons
      const storeKey = this.state.deleteScreen;
      const headersMap = {
        openpit: this.getOpenPitHeaders(),
        stockpile: this.getStockpileHeaders(),
        transfer: this.getTransferHeaders(),
        breakdown: this.getBreakdownHeaders(),
        parking: this.getParkingHeaders()
      };
      const titlesMap = {
        openpit: '采坑数据查看 (点击删除)',
        stockpile: '堆场数据查看 (点击删除)',
        transfer: '二次转运数据查看 (点击删除)',
        breakdown: '故障车辆数据查看 (点击删除)',
        parking: '押矿车辆数据查看 (点击删除)'
      };
      this.showDataView(storeKey, headersMap[storeKey], titlesMap[storeKey]);
    });
    document.getElementById('delete-all').addEventListener('click', () => {
      document.getElementById('delete-modal').classList.add('hidden');
      this.showPasswordModal(async () => {
        await DB.clear(this.state.deleteStore);
        Utils.toast('全部数据已删除!<br><span class="en">All data deleted!</span>', 'success');
      });
    });

    // Data view modal
    document.getElementById('dataview-close').addEventListener('click', () => {
      document.getElementById('dataview-modal').classList.add('hidden');
    });

    // Export modal
    document.getElementById('export-close').addEventListener('click', () => {
      document.getElementById('export-modal').classList.add('hidden');
    });
    document.getElementById('export-excel-btn').addEventListener('click', () => {
      this.doExport('excel');
    });
    document.getElementById('export-png-btn').addEventListener('click', () => {
      this.doExport('png');
    });

    // Update banner refresh
    document.getElementById('btn-refresh-update').addEventListener('click', () => {
      if (App._waitingSW) {
        App._waitingSW.postMessage({ type: 'SKIP_WAITING' });
      } else {
        window.location.reload();
      }
    });
  },

  showPasswordModal(callback) {
    App._passwordCallback = callback;
    document.getElementById('password-input').value = '';
    document.getElementById('password-modal').classList.remove('hidden');
    setTimeout(() => document.getElementById('password-input').focus(), 100);
  },

  // ==================== Backup & Restore ====================
  bindBackupRestore() {
    document.getElementById('btn-backup').addEventListener('click', () => this.doBackup());
    // Restore needs password
    document.getElementById('btn-restore').addEventListener('click', () => {
      this.showPasswordModal(() => {
        document.getElementById('restore-file-input').click();
      });
    });
    // Hidden file input for restore
    document.getElementById('restore-file-input').addEventListener('change', (e) => this.doRestore(e));
  },

  /**
   * Export ALL data (all 4 stores + settings) as a single JSON file.
   * This is the primary defense against data loss from phone cleaning.
   */
  async doBackup() {
    try {
      const data = await DB.exportAll();
      const counts = await DB.countAll();
      const total = Object.values(counts).reduce((a, b) => a + b, 0);
      if (total === 0) {
        Utils.toast('暂无数据可备份<br><span class="en">No data to backup</span>', 'error');
        return;
      }
      const json = JSON.stringify(data);
      const blob = new Blob([json], { type: 'application/json' });
      const filename = 'OPMS_Backup_' + Utils.getTimestampStr() + '.json';
      Utils.downloadBlob(blob, filename);
      const summary = Object.entries(counts)
        .filter(([_, v]) => v > 0)
        .map(([k, v]) => k + ':' + v)
        .join(' ');
      Utils.toast('备份成功! 共' + total + '条 (' + summary + ')<br><span class="en">Backup saved! ' + total + ' records</span>', 'success');
    } catch (e) {
      console.error('Backup error:', e);
      Utils.toast('备份失败: ' + e.message + '<br><span class="en">Backup failed</span>', 'error');
    }
  },

  /**
   * Import data from a JSON backup file.
   * This OVERWRITES all existing data — password already verified before file selection.
   */
  async doRestore(event) {
    const file = event.target.files[0];
    // Reset input so the same file can be selected again
    event.target.value = '';
    if (!file) return;

    try {
      const text = await file.text();
      const data = JSON.parse(text);
      if (!data.appName || data.appName !== 'OPMS' || !data.stores) {
        Utils.toast('无效的备份文件<br><span class="en">Invalid backup file</span>', 'error');
        return;
      }
      const summary = await DB.importAll(data);
      const total = Object.values(summary).reduce((a, b) => a + b, 0);
      Utils.toast('恢复成功! 共' + total + '条数据<br><span class="en">Restored! ' + total + ' records</span>', 'success');
      // Refresh storage info
      this.updateStorageInfo();
    } catch (e) {
      console.error('Restore error:', e);
      Utils.toast('恢复失败: ' + e.message + '<br><span class="en">Restore failed</span>', 'error');
    }
  },

  /**
   * Show storage usage estimate (navigator.storage.estimate).
   * Also show persistent status and record counts.
   */
  async updateStorageInfo() {
    const el = document.getElementById('storage-info');
    if (!el) return;

    // Get record counts
    const counts = await DB.countAll();
    const total = Object.values(counts).reduce((a, b) => a + b, 0);

    // Get storage estimate
    let storageText = '';
    if (navigator.storage && navigator.storage.estimate) {
      try {
        const est = await navigator.storage.estimate();
        const usedMB = (est.usage / 1024 / 1024).toFixed(1);
        const quotaMB = (est.quota / 1024 / 1024).toFixed(0);
        storageText = usedMB + ' MB / ' + quotaMB + ' MB';
      } catch (e) {
        storageText = '--';
      }
    }

    // Check persistent status
    let persistText = '';
    if (navigator.storage && navigator.storage.persisted) {
      try {
        const persisted = await navigator.storage.persisted();
        persistText = persisted
          ? '已保护 ✓'
          : '未保护 ✗';
      } catch (e) {
        persistText = '--';
      }
    }

    el.innerHTML =
      '数据记录: ' + total + ' 条 (' +
      '采坑' + (counts.openpit || 0) +
      ' / 堆场' + (counts.stockpile || 0) +
      ' / 转运' + (counts.transfer || 0) +
      ' / 故障' + (counts.breakdown || 0) +
      ' / 押矿' + (counts.parking || 0) + ')' +
      '<br><span class="en">Storage: ' + storageText + ' · ' + persistText + '</span>';
  },

  // ==================== Main Screen Data Management ====================
  getHeadersByKey(key) {
    const map = {
      openpit: this.getOpenPitHeaders(),
      stockpile: this.getStockpileHeaders(),
      transfer: this.getTransferHeaders(),
      breakdown: this.getBreakdownHeaders(),
      parking: this.getParkingHeaders()
    };
    return map[key] || [];
  },

  /**
   * Render a data table as HTML string.
   * Uses App._tempImages array for photo references to avoid
   * very long base64 strings in onclick attributes.
   */
  renderDataTable(records, headers, storeKey) {
    if (!records || records.length === 0) {
      return '<p class="empty-msg">暂无数据 (No data)</p>';
    }
    App._tempImages = [];
    let html = '<table class="data-table"><thead><tr>';
    html += '<th>#</th>';
    headers.forEach(h => { html += `<th>${h.label}</th>`; });
    html += '<th>操作<br><span class="en">Action</span></th>';
    html += '</tr></thead><tbody>';
    records.forEach((r, i) => {
      html += `<tr>`;
      html += `<td>${i + 1}</td>`;
      headers.forEach(h => {
        let val = r[h.key];
        if (h.key === 'photo' || h.key === 'breakdownPhoto' || h.key === 'newVehiclePhoto' || h.key === 'parkingPhoto') {
          if (val) {
            const imgIdx = App._tempImages.length;
            App._tempImages.push(val);
            html += `<td class="td-photo"><img src="${val}" onclick="App.showFullImage(${imgIdx})" alt="photo"></td>`;
          } else {
            html += `<td>-</td>`;
          }
        } else if (h.key === 'timestamp') {
          html += `<td>${val ? new Date(val).toLocaleString('zh-CN') : ''}</td>`;
        } else {
          html += `<td>${Utils.escapeHtml(val)}</td>`;
        }
      });
      html += `<td class="td-actions"><button class="btn-delete-row" onclick="App.deleteRecord('${storeKey}', ${r.id})">删除<br><span class="en">Del</span></button></td>`;
      html += `</tr>`;
    });
    html += '</tbody></table>';
    return html;
  },

  bindMainDataManagement() {
    // ====== Data View ======
    document.getElementById('btn-main-dataview').addEventListener('click', () => {
      this.showMainDataView();
    });
    document.getElementById('main-dv-close').addEventListener('click', () => {
      document.getElementById('main-dataview-modal').classList.add('hidden');
    });
    document.getElementById('main-dv-query').addEventListener('click', () => {
      this.saveMainFilterSelections('dv');
      this.loadMainDataView();
    });
    // Chip toggle for data view sites
    document.querySelectorAll('#main-dv-sites .chip').forEach(chip => {
      chip.addEventListener('click', () => {
        chip.classList.toggle('active');
      });
    });

    // ====== Export ======
    document.getElementById('btn-main-export').addEventListener('click', () => {
      this.showMainExport();
    });
    document.getElementById('main-exp-close').addEventListener('click', () => {
      document.getElementById('main-export-modal').classList.add('hidden');
    });
    document.getElementById('main-exp-excel').addEventListener('click', () => {
      this.saveMainFilterSelections('exp');
      this.doMainExport('excel');
    });
    document.getElementById('main-exp-png').addEventListener('click', () => {
      this.saveMainFilterSelections('exp');
      this.doMainExport('png');
    });
    // Chip toggle for export sites
    document.querySelectorAll('#main-exp-sites .chip').forEach(chip => {
      chip.addEventListener('click', () => {
        chip.classList.toggle('active');
      });
    });

    // ====== Delete ======
    document.getElementById('btn-main-delete').addEventListener('click', () => {
      document.getElementById('main-delete-modal').classList.remove('hidden');
    });
    document.getElementById('main-del-close').addEventListener('click', () => {
      document.getElementById('main-delete-modal').classList.add('hidden');
    });
    document.getElementById('main-del-single').addEventListener('click', () => {
      document.getElementById('main-delete-modal').classList.add('hidden');
      const category = document.getElementById('main-del-category').value;
      if (category === 'all') {
        Utils.toast('请选择具体类别<br><span class="en">Please select a specific category</span>', 'error');
        return;
      }
      // Open main data view with only the selected category active
      this.setMainDvSites([category]);
      this.setMainDvDates(null);
      this.showMainDataView();
    });
    document.getElementById('main-del-category-all').addEventListener('click', () => {
      document.getElementById('main-delete-modal').classList.add('hidden');
      const category = document.getElementById('main-del-category').value;
      if (category === 'all') {
        Utils.toast('请选择具体类别<br><span class="en">Please select a specific category</span>', 'error');
        return;
      }
      const labelMap = {
        openpit: '采坑', stockpile: '堆场', transfer: '二次转运', breakdown: '故障车辆', parking: '押矿车辆'
      };
      this.showPasswordModal(async () => {
        await DB.clear(DB.STORES[category]);
        Utils.toast(labelMap[category] + '数据已删除!<br><span class="en">Category data deleted!</span>', 'success');
        this.updateStorageInfo();
      });
    });
    document.getElementById('main-del-all').addEventListener('click', () => {
      document.getElementById('main-delete-modal').classList.add('hidden');
      this.showPasswordModal(async () => {
        await DB.clear(DB.STORES.openpit);
        await DB.clear(DB.STORES.stockpile);
        await DB.clear(DB.STORES.transfer);
        await DB.clear(DB.STORES.breakdown);
        await DB.clear(DB.STORES.parking);
        Utils.toast('所有数据已删除!<br><span class="en">All data deleted!</span>', 'success');
        this.updateStorageInfo();
      });
    });
  },

  async showMainDataView() {
    this.state.dataViewSource = 'main';
    document.getElementById('main-dataview-modal').classList.remove('hidden');
    await this.loadAvailableDates('main-dv-dates');
    await this.restoreMainFilterSelections('dv');
    this.loadMainDataView();
  },

  async showMainExport() {
    document.getElementById('main-export-modal').classList.remove('hidden');
    await this.loadAvailableDates('main-exp-dates');
    await this.restoreMainFilterSelections('exp');
  },

  getSelectedSites(containerId) {
    return Array.from(document.querySelectorAll('#' + containerId + ' .chip.active')).map(c => c.dataset.value);
  },

  getSelectedDates(containerId) {
    return CalendarPicker.getSelectedDates(containerId);
  },

  async loadAvailableDates(containerId) {
    const dateSet = new Set();
    const stores = [DB.STORES.openpit, DB.STORES.stockpile, DB.STORES.transfer, DB.STORES.breakdown, DB.STORES.parking];
    for (const store of stores) {
      const records = await DB.getAll(store);
      records.forEach(r => {
        const d = r.date || r.breakdownDate;
        if (d) dateSet.add(d);
      });
    }
    CalendarPicker.init(containerId, Array.from(dateSet));
  },

  setMainDvSites(sites) {
    document.querySelectorAll('#main-dv-sites .chip').forEach(c => {
      c.classList.toggle('active', sites.includes(c.dataset.value));
    });
  },

  setMainDvDates(dates) {
    CalendarPicker.setSelectedDates('main-dv-dates', dates);
  },

  async saveMainFilterSelections(prefix) {
    const sitesContainer = prefix === 'dv' ? 'main-dv-sites' : 'main-exp-sites';
    const datesContainer = prefix === 'dv' ? 'main-dv-dates' : 'main-exp-dates';
    const sites = this.getSelectedSites(sitesContainer);
    const dates = this.getSelectedDates(datesContainer);
    await DB.setSetting({ id: 'defaults_mainFilter_' + prefix, sites, dates });
  },

  async restoreMainFilterSelections(prefix) {
    const sitesContainer = prefix === 'dv' ? 'main-dv-sites' : 'main-exp-sites';
    const datesContainer = prefix === 'dv' ? 'main-dv-dates' : 'main-exp-dates';
    const saved = await DB.getSetting('defaults_mainFilter_' + prefix);
    if (saved && saved.sites) {
      document.querySelectorAll('#' + sitesContainer + ' .chip').forEach(c => {
        c.classList.toggle('active', saved.sites.includes(c.dataset.value));
      });
    }
    if (saved && saved.dates !== undefined) {
      CalendarPicker.setSelectedDates(datesContainer, saved.dates);
    }
  },

  async loadMainDataView() {
    const sites = this.getSelectedSites('main-dv-sites');
    const filterDates = this.getSelectedDates('main-dv-dates');
    const content = document.getElementById('main-dv-content');
    App._tempImages = [];

    if (sites.length === 0) {
      content.innerHTML = '<p class="empty-msg">请选择工作区域<br><span class="en">Please select working site</span></p>';
      return;
    }

    const catLabels = {
      openpit: '采坑 (Open-pit)', stockpile: '堆场 (Stockpile)', transfer: '二次转运 (Secondary Transfer)',
      breakdown: '故障车辆 (Breakdown)', parking: '押矿车辆 (Parking)'
    };

    let html = '';
    for (const key of sites) {
      let records = await DB.getAll(DB.STORES[key]);
      if (filterDates) records = records.filter(r => {
        const d = r.date || r.breakdownDate;
        return d && filterDates.includes(d);
      });
      records.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
      const latest = sites.length > 1 ? records.slice(0, 10) : records;
      html += '<h4 class="section-title">' + catLabels[key] + ' <span class="count-badge">' + records.length + '</span></h4>';
      if (latest.length > 0) {
        html += this.renderDataTable(latest, this.getHeadersByKey(key), key);
      } else {
        html += '<p class="empty-msg">暂无数据 (No data)</p>';
      }
      html += '<hr class="section-divider">';
    }
    content.innerHTML = html || '<p class="empty-msg">暂无数据 (No data)</p>';
  },

  async doMainExport(type) {
    const sites = this.getSelectedSites('main-exp-sites');
    const filterDates = this.getSelectedDates('main-exp-dates');
    const filterShift = document.getElementById('main-exp-shift').value;

    if (sites.length === 0) {
      Utils.toast('请选择工作区域<br><span class="en">Please select working site</span>', 'error');
      return;
    }

    const labelMap = {
      openpit: 'Open-pit', stockpile: 'Stockpile', transfer: 'Transfer', breakdown: 'Breakdown', parking: 'Parking'
    };
    const titleMap = {
      openpit: '采坑数据 (Open-pit Data)', stockpile: '堆场数据 (Stockpile Data)',
      transfer: '二次转运数据 (Secondary Transfer Data)',
      breakdown: '故障车辆数据 (Breakdown Data)', parking: '押矿车辆数据 (Parking Data)'
    };

    const sheets = [];
    let totalRecords = 0;
    for (const key of sites) {
      let records = await DB.getAll(DB.STORES[key]);
      if (filterDates) records = records.filter(r => {
        const d = r.date || r.breakdownDate;
        return d && filterDates.includes(d);
      });
      if (filterShift) records = records.filter(r => Utils.normalizeShift(r.shift || r.breakdownShift) === filterShift);
      records.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
      totalRecords += records.length;
      sheets.push({ key: key, name: labelMap[key], records: records, headers: this.getHeadersByKey(key) });
    }

    if (totalRecords === 0) {
      Utils.toast('没有数据可导出<br><span class="en">No data to export</span>', 'error');
      return;
    }

    if (type === 'excel') {
      if (sheets.length > 1) {
        Exporter.toExcelMultiSheet(sheets, 'Export_' + Utils.getTimestampStr());
      } else {
        Exporter.toExcel(sheets[0].records, sheets[0].headers, labelMap[sheets[0].key] + '_' + Utils.getTimestampStr());
      }
    } else {
      if (sheets.length === 1) {
        Exporter.toPNG(sheets[0].records, sheets[0].headers, labelMap[sheets[0].key] + '_' + Utils.getTimestampStr(), titleMap[sheets[0].key]);
      } else {
        const allRecords = [];
        const allHeaders = [
          { key: 'category', label: 'Category' },
          { key: 'date', label: 'Shift_Date' },
          { key: 'shift', label: 'Shift' },
          { key: 'qrCode', label: 'Tag (QR)' },
          { key: 'vehicleNo', label: 'Vehicle No.' },
          { key: 'timestamp', label: 'Timestamp' }
        ];
        sheets.forEach(s => {
          s.records.forEach(r => {
            allRecords.push({
              category: s.name,
              date: r.date || r.breakdownDate || '',
              shift: r.shift || r.breakdownShift || '',
              qrCode: r.qrCode || '',
              vehicleNo: r.vehicleNo || r.breakdownVehicleNo || r.parkingVehicleNo || '',
              timestamp: r.timestamp || ''
            });
          });
        });
        Exporter.toPNG(allRecords, allHeaders, 'All_' + Utils.getTimestampStr(), '全部数据 (All Data)');
      }
    }
    Utils.toast('导出成功! 共' + totalRecords + '条<br><span class="en">Exported! ' + totalRecords + ' records</span>', 'success');
  },

  // ==================== Update Check ====================
  bindUpdateCheck() {
    document.getElementById('btn-check-update').addEventListener('click', () => {
      this.checkForUpdates();
    });
  },

  // ==================== Service Worker ====================
  registerSW() {
    if ('serviceWorker' in navigator) {
      window.addEventListener('load', () => {
        navigator.serviceWorker.register('sw.js').then(reg => {
          // Force check for updates on every page load
          reg.update();

          // If a new SW is already waiting, show banner immediately
          if (reg.waiting) {
            App._waitingSW = reg.waiting;
            document.getElementById('update-banner').classList.remove('hidden');
          }
          reg.addEventListener('updatefound', () => {
            const newWorker = reg.installing;
            if (newWorker) {
              newWorker.addEventListener('statechange', () => {
                if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
                  App._waitingSW = reg.waiting;
                  document.getElementById('update-banner').classList.remove('hidden');
                }
              });
            }
          });

          // Periodic check for updates every 5 minutes
          setInterval(() => {
            reg.update();
          }, 5 * 60 * 1000);
        }).catch(err => {
          console.error('SW registration failed:', err);
        });

        // Listen for controller change (new SW took over)
        let refreshing = false;
        navigator.serviceWorker.addEventListener('controllerchange', () => {
          if (refreshing) return;
          refreshing = true;
          window.location.reload();
        });
      });
    }
  },

  // Manual update check - triggered by user clicking "检查更新" button
  async checkForUpdates() {
    Utils.toast('正在检查更新...<br><span class="en">Checking for updates...</span>', 'info');
    try {
      // 1. Check version.json for a version mismatch (bypasses HTTP cache)
      const resp = await fetch('version.json?v=' + Date.now(), { cache: 'no-cache' });
      const data = resp.ok ? await resp.json() : null;
      const stored = localStorage.getItem('opms_app_version');

      if (data && data.version && stored !== data.version) {
        // New version detected — force clean update
        Utils.toast('发现新版本! 正在更新...<br><span class="en">New version! Updating...</span>', 'success');
        localStorage.setItem('opms_app_version', data.version);
        if ('serviceWorker' in navigator) {
          const regs = await navigator.serviceWorker.getRegistrations();
          await Promise.all(regs.map(r => r.unregister()));
          if ('caches' in window) {
            const keys = await caches.keys();
            await Promise.all(keys.map(k => caches.delete(k)));
          }
        }
        window.location.reload();
        return;
      }

      // 2. Also check if SW has a waiting worker
      if ('serviceWorker' in navigator) {
        const reg = await navigator.serviceWorker.getRegistration();
        if (reg) {
          await reg.update();
          if (reg.waiting) {
            App._waitingSW = reg.waiting;
            document.getElementById('update-banner').classList.remove('hidden');
            Utils.toast('发现新版本!<br><span class="en">New version found!</span>', 'success');
            return;
          }
        }
      }

      Utils.toast('已是最新版本<br><span class="en">Already up to date</span>', 'success');
    } catch (err) {
      // If update check fails (e.g., offline), force reload as fallback
      window.location.reload();
    }
  }
};

// Start the app
document.addEventListener('DOMContentLoaded', () => App.init());
