/**
 * camera.js - Photo capture using getUserMedia
 */
const Camera = (function() {
  let stream = null;
  let videoEl = null;
  let captureCallback = null;

  function start(videoId, callback) {
    videoEl = document.getElementById(videoId);
    captureCallback = callback;
    if (!videoEl) return;

    navigator.mediaDevices.getUserMedia({
      video: { facingMode: 'environment' },
      audio: false
    }).then(s => {
      stream = s;
      videoEl.srcObject = s;
      videoEl.setAttribute('playsinline', 'true');
      videoEl.play();
    }).catch(err => {
      console.error('Camera error:', err);
      Utils.toast('无法访问摄像头，请检查权限<br><span class="en">Camera unavailable</span>', 'error');
    });
  }

  function capture() {
    if (!videoEl || !stream) {
      Utils.toast('摄像头未就绪<br><span class="en">Camera not ready</span>', 'error');
      return;
    }

    const canvas = document.createElement('canvas');
    canvas.width = videoEl.videoWidth;
    canvas.height = videoEl.videoHeight;
    const ctx = canvas.getContext('2d');
    ctx.drawImage(videoEl, 0, 0, canvas.width, canvas.height);

    const photoData = Utils.compressPhoto(canvas, 800);
    stop();
    if (captureCallback) {
      captureCallback(photoData);
    }
  }

  function stop() {
    if (stream) {
      stream.getTracks().forEach(t => t.stop());
      stream = null;
    }
    if (videoEl) {
      videoEl.srcObject = null;
    }
  }

  return { start, capture, stop };
})();
