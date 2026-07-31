/**
 * scanner.js - QR code scanning using html5-qrcode
 */
const Scanner = (function() {
  let html5Qr = null;
  let onScanCallback = null;
  let scanning = false;
  let stopping = false;

  function start(containerId, callback) {
    onScanCallback = callback;
    scanning = false;
    stopping = false;
    const container = document.getElementById(containerId);
    if (!container) return;

    // Clear previous content
    container.innerHTML = '';

    try {
      const fmts = (typeof Html5QrcodeSupportedFormats !== 'undefined')
        ? { formatsToSupport: [Html5QrcodeSupportedFormats.QR_CODE] }
        : {};
      html5Qr = new Html5Qrcode(containerId, fmts);
    } catch(e) {
      console.error('Scanner init error:', e);
      Utils.toast('扫码初始化失败<br><span class="en">Scanner init failed</span>', 'error');
      return;
    }

    const config = {
      fps: 10,
      qrbox: function(w, h) {
        const min = Math.min(w, h);
        const size = Math.floor(min * 0.7);
        return { width: size, height: size };
      },
      aspectRatio: 1.0
    };

    html5Qr.start(
      { facingMode: "environment" },
      config,
      onScanSuccess,
      onScanFailure
    ).then(() => {
      scanning = true;
    }).catch(err => {
      console.error('Camera start error:', err);
      Utils.toast('无法访问摄像头，请检查权限<br><span class="en">Camera unavailable</span>', 'error');
    });
  }

  function onScanSuccess(decodedText) {
    if (!scanning) return;
    scanning = false;
    stop();
    if (onScanCallback) {
      onScanCallback(decodedText);
    }
  }

  function onScanFailure(error) {
    // Scan frame failed, ignore - will retry
  }

  function stop() {
    scanning = false;
    if (stopping || !html5Qr) return;
    stopping = true;
    const qr = html5Qr;
    html5Qr = null;
    qr.stop().then(() => {
      qr.clear();
      stopping = false;
    }).catch(() => {
      stopping = false;
    });
  }

  return { start, stop };
})();
