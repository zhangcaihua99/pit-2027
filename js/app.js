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
    // Temporary form data
    openpit: { qrCode: '', photo: '' },
    stockpile: { qrCode: '', photo: '' },
    breakdown: { qrCode: '', breakdownPhoto: '', newVehiclePhoto: '' },
    parking: { qrCode: '', parkingPhoto: '' }
  },

  // ==================== Init ====================
  init() {
    this.bindMainScreen();
    this.bindOpenPit();
    this.bindStockpile();
    this.bindBreakdown();
    this.bindParking();
    this.bindModals();
    this.bindExportTab();
    this.registerSW();
    // Fill main screen date/shift
    this.refreshMainScreen();
    // Restore person
    DB.getSetting('defaults_main').then(d => {
      if (d && d.person) document.getElementById('person').value = d.person;
    });
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
    if (name === 'breakdown') this.initBreakdownScreen();
  },

  refreshMainScreen() {
    document.getElementById('main-date').value = Utils.getTodayStr();
    document.getElementById('main-shift').value = Utils.getCurrentShift();
  },

  bindMainScreen() {
    document.getElementById('btn-enter-site').addEventListener('click', () => {
      const person = document.getElementById('person').value.trim();
      if (!person) { Utils.toast('请输入数据录入人员', 'error'); return; }
      const site = document.getElementById('working-site').value;
      if (!site) { Utils.toast('请选择工作区域', 'error'); return; }
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
    document.getElementById('op-destination').value = '';
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
      if (dest) {
        this.startQRScan('openpit');
      }
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
      { key: 'date', label: 'Date' },
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
    const qrCode = this.state.openpit.qrCode;
    const photo = this.state.openpit.photo;

    // Validation
    const fields = [
      [person, '录入人员'], [location, '作业平台'], [blasting, '爆堆编号'],
      [shovel, '挖机编号'], [vehicleNo, '车辆编号'], [vehicleType, '车辆型号'],
      [formation, '地层'], [grade, '矿石品级'], [hardness, '硬度'],
      [mineralType, '矿石类型'], [destination, '矿岩去向'], [qrCode, '矿牌'], [photo, '车辆照片']
    ];
    for (const [val, name] of fields) {
      if (!val) { Utils.toast('请填写: ' + name, 'error'); return; }
    }

    const record = {
      date: Utils.getTodayStr(),
      shift: Utils.getCurrentShift(),
      person, location, blasting, shovel, vehicleNo, vehicleType,
      formation, grade, hardness, mineralType, destination,
      qrCode, photo, timestamp: new Date().toISOString()
    };

    await DB.add(DB.STORES.openpit, record);

    // Save defaults
    await Utils.saveDefaults('openpit', { location, blasting, shovel, vehicleType, formation, grade, hardness, mineralType });

    // Clear vehicle no, QR, photo, destination
    document.getElementById('op-vehicle').value = '';
    document.getElementById('op-destination').value = '';
    document.getElementById('op-qr').value = '';
    const preview = document.getElementById('op-photo-preview');
    preview.classList.add('hidden');
    preview.src = '';
    this.state.openpit.qrCode = '';
    this.state.openpit.photo = '';

    Utils.toast('数据上传成功!', 'success');
  },

  // ==================== Stockpile Screen ====================
  async initStockpileScreen() {
    const d = await Utils.loadDefaults('stockpile');
    document.getElementById('sp-vehicle').value = '';
    if (d.stockpile) document.getElementById('sp-stockpile').value = d.stockpile;
    if (d.mineralType) document.getElementById('sp-mineral-type').value = d.mineralType;
    document.getElementById('sp-qr').value = '';
    const preview = document.getElementById('sp-photo-preview');
    preview.classList.add('hidden');
    preview.src = '';
    this.state.stockpile.qrCode = '';
    this.state.stockpile.photo = '';
  },

  bindStockpile() {
    // Auto-trigger QR scan on mineral type change
    document.getElementById('sp-mineral-type').addEventListener('change', () => {
      const mt = document.getElementById('sp-mineral-type').value;
      if (mt) {
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
      { key: 'date', label: 'Date' },
      { key: 'shift', label: 'Shift' },
      { key: 'person', label: 'Person' },
      { key: 'stockpile', label: 'Stockpile' },
      { key: 'vehicleNo', label: 'Vehicle No.' },
      { key: 'mineralType', label: 'Mineral Type' },
      { key: 'qrCode', label: 'Tag (QR)' },
      { key: 'photo', label: 'Photo' },
      { key: 'timestamp', label: 'Timestamp' }
    ];
  },

  async submitStockpile() {
    const person = document.getElementById('person').value.trim();
    const stockpile = document.getElementById('sp-stockpile').value;
    const vehicleNo = document.getElementById('sp-vehicle').value.trim();
    const mineralType = document.getElementById('sp-mineral-type').value;
    const qrCode = this.state.stockpile.qrCode;
    const photo = this.state.stockpile.photo;

    const fields = [
      [person, '录入人员'], [stockpile, '堆场位置'], [vehicleNo, '车辆编号'],
      [mineralType, '矿石类型'], [qrCode, '矿牌'], [photo, '车辆照片']
    ];
    for (const [val, name] of fields) {
      if (!val) { Utils.toast('请填写: ' + name, 'error'); return; }
    }

    const record = {
      date: Utils.getTodayStr(),
      shift: Utils.getCurrentShift(),
      person, stockpile, vehicleNo, mineralType, qrCode, photo,
      timestamp: new Date().toISOString()
    };

    await DB.add(DB.STORES.stockpile, record);
    await Utils.saveDefaults('stockpile', { stockpile, mineralType });

    document.getElementById('sp-vehicle').value = '';
    document.getElementById('sp-qr').value = '';
    const preview = document.getElementById('sp-photo-preview');
    preview.classList.add('hidden');
    preview.src = '';
    this.state.stockpile.qrCode = '';
    this.state.stockpile.photo = '';

    Utils.toast('数据上传成功!', 'success');
  },

  // ==================== Breakdown Screen ====================
  initBreakdownScreen() {
    document.getElementById('bd-date').value = Utils.getTodayStr();
    document.getElementById('pk-date').value = Utils.getTodayStr();
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
    document.getElementById('pk-transfer-date').value = '';
    document.getElementById('pk-transfer-shift').value = '';
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
      { key: 'breakdownDate', label: 'Breakdown Date' },
      { key: 'breakdownShift', label: 'Breakdown Shift' },
      { key: 'transferDate', label: 'Transfer Date' },
      { key: 'transferShift', label: 'Transfer Shift' },
      { key: 'qrCode', label: 'Tag (QR)' },
      { key: 'breakdownVehicleNo', label: 'Breakdown Vehicle No.' },
      { key: 'breakdownPhoto', label: 'Breakdown Photo' },
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
    const qrCode = this.state.breakdown.qrCode;
    const breakdownVehicleNo = document.getElementById('bd-vehicle').value.trim();
    const breakdownPhoto = this.state.breakdown.breakdownPhoto;
    const newVehicleNo = document.getElementById('bd-new-vehicle').value.trim();
    const newVehiclePhoto = this.state.breakdown.newVehiclePhoto;

    const fields = [
      [breakdownDate, '故障日期'], [breakdownShift, '故障班次'],
      [transferDate, '计划转运日期'], [transferShift, '计划转运班次'],
      [qrCode, '矿牌'], [breakdownVehicleNo, '故障车编号'],
      [breakdownPhoto, '故障车照片'], [newVehicleNo, '新车编号'], [newVehiclePhoto, '新车照片']
    ];
    for (const [val, name] of fields) {
      if (!val) { Utils.toast('请填写: ' + name, 'error'); return; }
    }

    const record = {
      breakdownDate, breakdownShift, transferDate, transferShift,
      qrCode, breakdownVehicleNo, breakdownPhoto, newVehicleNo, newVehiclePhoto,
      timestamp: new Date().toISOString()
    };

    await DB.add(DB.STORES.breakdown, record);
    this.resetBreakdownForm();
    document.getElementById('bd-date').value = Utils.getTodayStr();
    Utils.toast('数据上传成功!', 'success');
  },

  // ==================== Parking Screen ====================
  bindParking() {
    // Parking QR auto-trigger
    document.getElementById('pk-transfer-shift').addEventListener('change', () => {
      if (document.getElementById('pk-transfer-shift').value) {
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
      { key: 'breakdownDate', label: 'Breakdown Date' },
      { key: 'breakdownShift', label: 'Breakdown Shift' },
      { key: 'transferDate', label: 'Transfer Date' },
      { key: 'transferShift', label: 'Transfer Shift' },
      { key: 'qrCode', label: 'Tag (QR)' },
      { key: 'parkingVehicleNo', label: 'Parking Vehicle No.' },
      { key: 'parkingPhoto', label: 'Parking Photo' },
      { key: 'timestamp', label: 'Timestamp' }
    ];
  },

  async submitParking() {
    const breakdownDate = document.getElementById('pk-date').value;
    const breakdownShift = document.getElementById('pk-shift').value;
    const transferDate = document.getElementById('pk-transfer-date').value;
    const transferShift = document.getElementById('pk-transfer-shift').value;
    const qrCode = this.state.parking.qrCode;
    const parkingVehicleNo = document.getElementById('pk-vehicle').value.trim();
    const parkingPhoto = this.state.parking.parkingPhoto;

    const fields = [
      [breakdownDate, '故障日期'], [breakdownShift, '故障班次'],
      [transferDate, '计划转运日期'], [transferShift, '计划转运班次'],
      [qrCode, '矿牌'], [parkingVehicleNo, '押矿车辆编号'], [parkingPhoto, '押矿车辆照片']
    ];
    for (const [val, name] of fields) {
      if (!val) { Utils.toast('请填写: ' + name, 'error'); return; }
    }

    const record = {
      breakdownDate, breakdownShift, transferDate, transferShift,
      qrCode, parkingVehicleNo, parkingPhoto,
      timestamp: new Date().toISOString()
    };

    await DB.add(DB.STORES.parking, record);
    this.resetParkingForm();
    document.getElementById('pk-date').value = Utils.getTodayStr();
    Utils.toast('数据上传成功!', 'success');
  },

  // ==================== Export Tab (Breakdown/Parking) ====================
  bindExportTab() {
    document.getElementById('bd-export-excel').addEventListener('click', () => this.exportBreakdownData('excel'));
    document.getElementById('bd-export-png').addEventListener('click', () => this.exportBreakdownData('png'));
  },

  async exportBreakdownData(type) {
    const exportType = document.getElementById('bd-export-type').value;
    const filterDate = document.getElementById('bd-export-date').value;
    const filterShift = document.getElementById('bd-export-shift').value;

    const storeName = exportType === 'parking' ? DB.STORES.parking : DB.STORES.breakdown;
    let records = await DB.getAll(storeName);

    if (filterDate) {
      records = records.filter(r => (r.breakdownDate || r.date) === filterDate);
    }
    if (filterShift) {
      records = records.filter(r => (r.breakdownShift || r.shift) === filterShift);
    }

    records.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));

    const headers = exportType === 'parking' ? this.getParkingHeaders() : this.getBreakdownHeaders();
    const label = exportType === 'parking' ? 'Stockpile' : 'Breakdown';
    const filename = label + '_' + Utils.getTimestampStr();
    const title = exportType === 'parking' ? '押矿车辆数据 (Vehicles in Parking Lot)' : '故障车辆数据 (Vehicle Breakdown)';

    if (records.length === 0) {
      Utils.toast('没有数据可导出', 'error');
      return;
    }

    if (type === 'excel') {
      Exporter.toExcel(records, headers, filename);
    } else {
      Exporter.toPNG(records, headers, filename, title);
    }
    Utils.toast('导出成功!', 'success');
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
    Scanner.stop();

    // Check duplicate (3 hours)
    const isDup = await DB.isQRRegisteredRecently(decodedText);
    if (isDup) {
      Utils.toast('QR code already registered.', 'error');
      return;
    }

    const ctx = this.state.qrContext;
    // Fill QR field and store in state
    const qrInputMap = {
      openpit: 'op-qr',
      stockpile: 'sp-qr',
      breakdown: 'bd-qr',
      parking: 'pk-qr'
    };
    const inputId = qrInputMap[ctx];
    if (inputId) document.getElementById(inputId).value = decodedText;
    this.state[ctx].qrCode = decodedText;

    Utils.toast('扫描成功!', 'success');

    // For openpit and stockpile, auto-open camera after QR scan
    if (ctx === 'openpit') {
      setTimeout(() => this.startCamera('openpit_photo'), 300);
    } else if (ctx === 'stockpile') {
      setTimeout(() => this.startCamera('stockpile_photo'), 300);
    }
  },

  // ==================== Camera / Photo ====================
  startCamera(context) {
    this.state.cameraContext = context;
    const titles = {
      'openpit_photo': '车辆照片 (Vehicle Photo)',
      'stockpile_photo': '车辆照片 (Vehicle Photo)',
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
    Utils.toast('拍照成功!', 'success');
  },

  // ==================== Data View ====================
  async showDataView(storeKey, headers, title) {
    const storeMap = {
      openpit: DB.STORES.openpit,
      stockpile: DB.STORES.stockpile,
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

  showFullImage(src) {
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
        breakdown: DB.STORES.breakdown,
        parking: DB.STORES.parking
      };
      await DB.remove(storeMap[storeKey], id);
      Utils.toast('删除成功!', 'success');
      // Refresh data view
      const headersMap = {
        openpit: this.getOpenPitHeaders(),
        stockpile: this.getStockpileHeaders(),
        breakdown: this.getBreakdownHeaders(),
        parking: this.getParkingHeaders()
      };
      const titlesMap = {
        openpit: '采坑数据查看 (Open-pit Data)',
        stockpile: '堆场数据查看 (Stockpile Data)',
        breakdown: '故障车辆数据查看 (Breakdown Data)',
        parking: '押矿车辆数据查看 (Parking Data)'
      };
      this.showDataView(storeKey, headersMap[storeKey], titlesMap[storeKey]);
    });
  },

  // ==================== Delete Options ====================
  showDeleteOptions() {
    document.getElementById('delete-modal').classList.remove('hidden');
  },

  // ==================== Export Modal ====================
  showExportModal() {
    document.getElementById('export-modal').classList.remove('hidden');
  },

  async doExport(type) {
    const ctx = this.state.exportContext;
    const filterDate = document.getElementById('export-date').value;
    const filterShift = document.getElementById('export-shift').value;

    const storeMap = {
      openpit: DB.STORES.openpit,
      stockpile: DB.STORES.stockpile
    };
    const headersMap = {
      openpit: this.getOpenPitHeaders(),
      stockpile: this.getStockpileHeaders()
    };
    const labelMap = {
      openpit: 'Open-pit',
      stockpile: 'Stockpile'
    };
    const titleMap = {
      openpit: '采坑数据 (Open-pit Data)',
      stockpile: '堆场数据 (Stockpile Data)'
    };

    let records = await DB.getAll(storeMap[ctx]);
    if (filterDate) records = records.filter(r => r.date === filterDate);
    if (filterShift) records = records.filter(r => r.shift === filterShift);
    records.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));

    if (records.length === 0) {
      Utils.toast('没有数据可导出', 'error');
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
    Utils.toast('导出成功!', 'success');
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
        Utils.toast('密码错误!', 'error');
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
        breakdown: this.getBreakdownHeaders(),
        parking: this.getParkingHeaders()
      };
      const titlesMap = {
        openpit: '采坑数据查看 (点击删除)',
        stockpile: '堆场数据查看 (点击删除)',
        breakdown: '故障车辆数据查看 (点击删除)',
        parking: '押矿车辆数据查看 (点击删除)'
      };
      this.showDataView(storeKey, headersMap[storeKey], titlesMap[storeKey]);
    });
    document.getElementById('delete-all').addEventListener('click', () => {
      document.getElementById('delete-modal').classList.add('hidden');
      this.showPasswordModal(async () => {
        await DB.clear(this.state.deleteStore);
        Utils.toast('全部数据已删除!', 'success');
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

  // ==================== Service Worker ====================
  registerSW() {
    if ('serviceWorker' in navigator) {
      window.addEventListener('load', () => {
        navigator.serviceWorker.register('sw.js').then(reg => {
          // Check for updates
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
  }
};

// Start the app
document.addEventListener('DOMContentLoaded', () => App.init());
