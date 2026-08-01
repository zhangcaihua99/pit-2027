/**
 * exporter.js - Excel and PNG export functions
 */
const Exporter = {
  /**
   * Export data to Excel file
   * @param {Array} records - data records
   * @param {Array} headers - [{key, label}] column definitions
   * @param {string} filename - output filename (without extension)
   */
  toExcel(records, headers, filename) {
    const data = records.map(r => {
      const row = {};
      headers.forEach(h => {
        let val = r[h.key];
        if (h.key === 'photo' || h.key === 'breakdownPhoto' || h.key === 'newVehiclePhoto' || h.key === 'parkingPhoto' || h.key === 'vehiclePhoto') {
          val = val ? '[Photo]' : '';
        }
        row[h.label] = val != null ? val : '';
      });
      return row;
    });

    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Data');
    XLSX.writeFile(wb, filename + '.xlsx');
  },

  /**
   * Export multiple data sets to a single Excel workbook with multiple sheets.
   * @param {Array} sheets - [{ name, records, headers }] each sheet definition
   * @param {string} filename - output filename (without extension)
   */
  toExcelMultiSheet(sheets, filename) {
    const wb = XLSX.utils.book_new();
    sheets.forEach(sheet => {
      const data = sheet.records.map(r => {
        const row = {};
        sheet.headers.forEach(h => {
          let val = r[h.key];
          if (h.key === 'photo' || h.key === 'breakdownPhoto' || h.key === 'newVehiclePhoto' || h.key === 'parkingPhoto' || h.key === 'vehiclePhoto') {
            val = val ? '[Photo]' : '';
          }
          row[h.label] = val != null ? val : '';
        });
        return row;
      });
      // Sheet name max 31 chars (Excel limit)
      const sheetName = (sheet.name || 'Sheet').substring(0, 31);
      // If no data, add a single row indicating empty
      const wsData = data.length > 0 ? data : [{ 'Info': 'No data' }];
      const ws = XLSX.utils.json_to_sheet(wsData);
      XLSX.utils.book_append_sheet(wb, ws, sheetName);
    });
    // Ensure at least one sheet exists
    if (wb.SheetNames.length === 0) {
      const ws = XLSX.utils.json_to_sheet([{ 'Info': 'No data' }]);
      XLSX.utils.book_append_sheet(wb, ws, 'Empty');
    }
    XLSX.writeFile(wb, filename + '.xlsx');
  },

  /**
   * Export data to PNG image
   * @param {Array} records - data records
   * @param {Array} headers - [{key, label}] column definitions
   * @param {string} filename - output filename (without extension)
   * @param {string} title - table title
   */
  toPNG(records, headers, filename, title) {
    // Create a temporary container for rendering
    const container = document.createElement('div');
    container.style.cssText = 'position:absolute;left:-9999px;top:0;background:#fff;padding:20px;font-family:sans-serif;';

    const titleEl = document.createElement('h2');
    titleEl.textContent = title || '';
    titleEl.style.cssText = 'text-align:center;margin-bottom:12px;color:#1565c0;font-size:18px;';
    container.appendChild(titleEl);

    if (records.length === 0) {
      const empty = document.createElement('p');
      empty.textContent = 'No data';
      empty.style.cssText = 'text-align:center;color:#999;padding:20px;';
      container.appendChild(empty);
    } else {
      const table = document.createElement('table');
      table.className = 'export-table';
      table.style.cssText = 'border-collapse:collapse;font-size:13px;width:100%;';

      // Header row
      const thead = document.createElement('thead');
      const tr = document.createElement('tr');
      headers.forEach(h => {
        const th = document.createElement('th');
        th.textContent = h.label;
        th.style.cssText = 'background:#1565c0;color:#fff;padding:8px;border:1px solid #cfd8dc;text-align:center;white-space:nowrap;';
        tr.appendChild(th);
      });
      thead.appendChild(tr);
      table.appendChild(thead);

      // Data rows
      const tbody = document.createElement('tbody');
      records.forEach((r, i) => {
        const row = document.createElement('tr');
        if (i % 2 === 1) row.style.background = '#f5f5f5';
        headers.forEach(h => {
          const td = document.createElement('td');
          let val = r[h.key];
          if (h.key === 'photo' || h.key === 'breakdownPhoto' || h.key === 'newVehiclePhoto' || h.key === 'parkingPhoto' || h.key === 'vehiclePhoto') {
            if (val) {
              const img = document.createElement('img');
              img.src = val;
              img.style.cssText = 'width:50px;height:38px;object-fit:cover;border-radius:3px;';
              td.appendChild(img);
            } else {
              td.textContent = '';
            }
          } else {
            td.textContent = val != null ? val : '';
          }
          td.style.cssText = 'padding:6px 8px;border:1px solid #cfd8dc;text-align:center;white-space:nowrap;';
          row.appendChild(td);
        });
        tbody.appendChild(row);
      });
      table.appendChild(tbody);
      container.appendChild(table);
    }

    document.body.appendChild(container);

    html2canvas(container, {
      scale: 2,
      backgroundColor: '#ffffff',
      useCORS: true
    }).then(canvas => {
      document.body.removeChild(container);
      const dataUrl = canvas.toDataURL('image/png');
      Utils.downloadDataUrl(dataUrl, filename + '.png');
    }).catch(err => {
      document.body.removeChild(container);
      console.error('PNG export error:', err);
      Utils.toast('PNG导出失败<br><span class="en">PNG export failed</span>', 'error');
    });
  }
};
