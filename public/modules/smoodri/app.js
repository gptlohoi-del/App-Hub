'use strict';
/* SmooDri 8.0 — Đánh giá êm ái thử nghiệm, PWA offline. */
const $ = (id) => document.getElementById(id);
const clamp = (n, lo, hi) => Math.min(hi, Math.max(lo, n));
const finite = (v, fallback) => Number.isFinite(Number(v)) ? Number(v) : fallback;
const smoothFactor = (dt, tau) => 1 - Math.exp(-clamp(dt, 0, 0.3) / tau);
const STORAGE_KEY = 'smoodri_cfg_v8';
const GRAVITY = 9.80665;
const BASE_THRESHOLDS = Object.freeze({
  maxGa: 0.25, maxPhanh: 0.28, maxCua: 0.25,
  potholeThreshold: 0.30, maxJerk: 0.30
});
const THRESHOLD_KEYS = Object.keys(BASE_THRESHOLDS);
const METRICS = ['xoc', 'phanh', 'cua', 'ga'];
const WAVE_NAMES = { square: 'Bíp rõ', triangle: 'Bíp dịu', sine: 'Bíp nhẹ' };
const POTHOLE_NAMES = { sawtooth: 'Âm trầm', square: 'Âm mạnh', sine: 'Âm nhẹ' };
const DEFAULTS = {
  comfortLevel: 60, customThresholds: false,
  maxGa: 0.20, maxPhanh: 0.224, maxCua: 0.20,
  potholeThreshold: 0.24, maxJerk: 0.24,
  visibleMetrics: ['xoc', 'phanh', 'cua', 'ga'],
  soundEnabled: true, volumePercent: 70,
  waveType: 'square', potholeWave: 'sawtooth',
  startDelay: 1.5, scoreRecovery: 3,
  peakHoldTime: 1.5, alertHoldTime: 3,
  theme: 'light', chartType: 'bar'
};

function thresholdsFor(level) {
  // Nâng mức êm ái => giảm ngưỡng kích hoạt. 20 = linh hoạt; 100 = rất nhạy.
  const ratio = (140 - level) / 100;
  return {
    maxGa: +Math.max(0.05, BASE_THRESHOLDS.maxGa * ratio).toFixed(3),
    maxPhanh: +Math.max(0.05, BASE_THRESHOLDS.maxPhanh * ratio).toFixed(3),
    maxCua: +Math.max(0.05, BASE_THRESHOLDS.maxCua * ratio).toFixed(3),
    potholeThreshold: +Math.max(0.08, BASE_THRESHOLDS.potholeThreshold * ratio).toFixed(3),
    maxJerk: +Math.max(0.08, BASE_THRESHOLDS.maxJerk * ratio).toFixed(3)
  };
}
function loadConfig() {
  let raw = null;
  let migrated = false;
  try {
    raw = JSON.parse(localStorage.getItem(STORAGE_KEY));
    if (!raw) {
      raw = JSON.parse(localStorage.getItem('smoodri_cfg_v7'));
      migrated = Boolean(raw);
    }
  } catch (_) { raw = null; }
  const cfg = { ...DEFAULTS, ...thresholdsFor(DEFAULTS.comfortLevel) };
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return cfg;
  const savedLevel = migrated
    ? (140 - finite(raw.masterScale, 80))
    : finite(raw.comfortLevel, DEFAULTS.comfortLevel);
  cfg.comfortLevel = clamp(Math.round(savedLevel / 5) * 5, 20, 100);
  Object.assign(cfg, thresholdsFor(cfg.comfortLevel));
  THRESHOLD_KEYS.forEach((key) => {
    if (raw[key] !== undefined) cfg[key] = clamp(finite(raw[key], cfg[key]), key === 'potholeThreshold' || key === 'maxJerk' ? 0.08 : 0.05, 0.70);
  });
  cfg.customThresholds = migrated
    ? THRESHOLD_KEYS.some((k) => Math.abs(cfg[k] - thresholdsFor(cfg.comfortLevel)[k]) > 0.012)
    : Boolean(raw.customThresholds);
  cfg.theme = raw.theme === 'dark' ? 'dark' : 'light';
  cfg.chartType = raw.chartType === 'donut' ? 'donut' : 'bar';
  cfg.waveType = WAVE_NAMES[raw.waveType] ? raw.waveType : 'square';
  cfg.potholeWave = POTHOLE_NAMES[raw.potholeWave] ? raw.potholeWave : 'sawtooth';
  cfg.soundEnabled = raw.soundEnabled !== false;
  cfg.volumePercent = clamp(migrated ? finite(raw.volumeBoost, 2.8) * 25 : finite(raw.volumePercent, 70), 10, 100);
  cfg.startDelay = clamp(finite(raw.startDelay, 1.5), 1, 5);
  cfg.scoreRecovery = clamp(finite(raw.scoreRecovery, 3), 1, 20);
  cfg.peakHoldTime = clamp(finite(raw.peakHoldTime, 1.5), 0, 5);
  cfg.alertHoldTime = clamp(finite(raw.alertHoldTime, 3), 0.5, 8);
  const chosen = Array.isArray(raw.visibleMetrics) ? raw.visibleMetrics.filter((m) => METRICS.includes(m)) : METRICS;
  cfg.visibleMetrics = chosen.length ? [...new Set(chosen)] : [...METRICS];
  return cfg;
}
let config = loadConfig();
function saveConfig() {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(config)); }
  catch (_) { /* Trình duyệt có thể chặn lưu trữ; ứng dụng vẫn đo được. */ }
}

/* Giao diện và cài đặt */
function applyTheme(theme, persist = true) {
  config.theme = theme === 'dark' ? 'dark' : 'light';
  document.documentElement.dataset.theme = config.theme;
  $('metaThemeColor').content = config.theme === 'light' ? '#f1f5f9' : '#0b1120';
  $('lblThemeName').textContent = config.theme === 'light' ? 'Sáng' : 'Tối';
  $('btnThemeLight').classList.toggle('selected', config.theme === 'light');
  $('btnThemeDark').classList.toggle('selected', config.theme === 'dark');
  if (persist) saveConfig();
}
function applyChartType(type, persist = true) {
  config.chartType = type === 'donut' ? 'donut' : 'bar';
  $('barsView').classList.toggle('hidden', config.chartType !== 'bar');
  $('donutsView').classList.toggle('hidden', config.chartType !== 'donut');
  $('btnChartBar').classList.toggle('selected', config.chartType === 'bar');
  $('btnChartDonut').classList.toggle('selected', config.chartType === 'donut');
  $('lblChartType').textContent = config.chartType === 'bar' ? 'Thanh ngang' : 'Vòng tròn';
  if (persist) saveConfig();
}
function applyMetricVisibility(persist = true) {
  document.querySelectorAll('[data-metric]').forEach((el) => {
    el.classList.toggle('hidden-metric', !config.visibleMetrics.includes(el.dataset.metric));
  });
  document.querySelectorAll('[data-visible-metric]').forEach((el) => {
    el.checked = config.visibleMetrics.includes(el.dataset.visibleMetric);
    el.disabled = el.checked && config.visibleMetrics.length === 1;
  });
  $('donutsView').style.setProperty('--metric-columns', String(Math.min(4, config.visibleMetrics.length)));
  if (persist) saveConfig();
}
function applyWave(wave, persist = true) {
  config.waveType = WAVE_NAMES[wave] ? wave : 'square';
  $('lblWaveType').textContent = WAVE_NAMES[config.waveType];
  document.querySelectorAll('[data-wave]').forEach((el) => el.classList.toggle('selected', el.dataset.wave === config.waveType));
  if (persist) saveConfig();
}
function applyPotholeWave(wave, persist = true) {
  config.potholeWave = POTHOLE_NAMES[wave] ? wave : 'sawtooth';
  $('lblPotholeWave').textContent = POTHOLE_NAMES[config.potholeWave];
  document.querySelectorAll('[data-pothole]').forEach((el) => el.classList.toggle('selected', el.dataset.pothole === config.potholeWave));
  if (persist) saveConfig();
}
function syncThresholdSliders() {
  const fields = [
    ['rngMaxGa', 'lblMaxGa', 'maxGa', 'G'],
    ['rngMaxPhanh', 'lblMaxPhanh', 'maxPhanh', 'G'],
    ['rngMaxCua', 'lblMaxCua', 'maxCua', 'G'],
    ['rngPotholeThreshold', 'lblPotholeThreshold', 'potholeThreshold', 'G'],
    ['rngMaxJerk', 'lblMaxJerk', 'maxJerk', 'G/s']
  ];
  fields.forEach(([sliderId, labelId, key, unit]) => {
    $(sliderId).value = config[key];
    $(labelId).textContent = `${Number(config[key]).toFixed(3)} ${unit}`;
  });
  $('customBadge').classList.toggle('hidden', !config.customThresholds);
}
function levelLabel(level) {
  if (level >= 85) return 'Rất nhạy – yêu cầu êm ái cao';
  if (level >= 65) return 'Êm ái – phát hiện sớm';
  if (level >= 45) return 'Cân bằng – phù hợp hằng ngày';
  return 'Linh hoạt – ít nhạy hơn';
}
function syncComfortUI() {
  const level = config.comfortLevel;
  $('mainScaleLabel').textContent = String(level);
  $('lblComfort').textContent = `${level}/100`;
  $('rngComfort').value = String(level);
  $('comfortDescription').textContent = `${levelLabel(level)}. Nút + yêu cầu êm ái hơn, nút − linh hoạt hơn.`;
  $('btnComfortMinus').disabled = level <= 20;
  $('btnComfortPlus').disabled = level >= 100;
  syncThresholdSliders();
}
function setComfortLevel(level) {
  config.comfortLevel = clamp(Math.round(finite(level, 60) / 5) * 5, 20, 100);
  Object.assign(config, thresholdsFor(config.comfortLevel));
  config.customThresholds = false;
  syncComfortUI();
  saveConfig();
}
function bindNumericSlider(id, labelId, cfgKey, suffix, decimals, custom = false) {
  const el = $(id);
  el.value = config[cfgKey];
  $(labelId).textContent = `${Number(config[cfgKey]).toFixed(decimals)}${suffix}`;
  el.addEventListener('input', () => {
    config[cfgKey] = Number(el.value);
    $(labelId).textContent = `${Number(config[cfgKey]).toFixed(decimals)}${suffix}`;
    if (custom) {
      config.customThresholds = true;
      $('customBadge').classList.remove('hidden');
    }
    saveConfig();
  });
}

/* Âm thanh: mức khởi phát cố định = 100%. Không vượt biên độ số. */
let audioCtx = null;
let lastNormalBurst = -Infinity;
let lastPotholeBurst = -Infinity;
let lastWeaveBurst = -Infinity;
function initAudioContext() {
  const Ctor = window.AudioContext || window.webkitAudioContext;
  if (!Ctor) return false;
  try {
    if (!audioCtx) audioCtx = new Ctor();
    if (audioCtx.state === 'suspended') audioCtx.resume().catch(() => {});
    return true;
  } catch (_) { return false; }
}
function tone(freq, ms, delayMs = 0, wave = config.waveType, volumeFactor = 1) {
  if (!audioCtx || audioCtx.state === 'closed') return;
  const when = audioCtx.currentTime + delayMs / 1000;
  const osc = audioCtx.createOscillator();
  const gain = audioCtx.createGain();
  osc.type = wave;
  osc.frequency.setValueAtTime(freq, when);
  const amplitude = clamp(config.volumePercent / 100, 0.1, 1) * 0.13 * volumeFactor;
  const end = when + ms / 1000;
  gain.gain.setValueAtTime(0.0001, when);
  gain.gain.linearRampToValueAtTime(amplitude, when + 0.008);
  gain.gain.exponentialRampToValueAtTime(0.0001, Math.max(when + 0.014, end));
  osc.connect(gain); gain.connect(audioCtx.destination);
  osc.start(when); osc.stop(end + 0.02);
  osc.addEventListener('ended', () => { try { osc.disconnect(); gain.disconnect(); } catch (_) {} }, { once: true });
}
function burst(wave = config.waveType, frequency = 1550) {
  if (!initAudioContext()) return;
  for (let i = 0; i < 4; i++) tone(frequency + (i % 2) * 350, 60, i * 105, wave);
}
function potholeBurst() {
  if (!initAudioContext()) return;
  tone(850, 95, 0, config.potholeWave);
  tone(600, 95, 135, config.potholeWave);
}
function handleSoundAlerts(now, { drivingPct, potholePct, potholeNew, weaving }) {
  if (!config.soundEnabled) return;
  if (weaving) {
    if (now - lastWeaveBurst >= 1900) { lastWeaveBurst = now; burst('square', 2000); }
  } else if (potholeNew && potholePct >= 100) {
    if (now - lastPotholeBurst >= 850) { lastPotholeBurst = now; potholeBurst(); }
  } else if (drivingPct >= 100 && now - lastNormalBurst >= 2000) {
    lastNormalBurst = now;
    burst(config.waveType, 1550);
  }
}

/* Lấy mẫu chuyển động và cân chỉnh tư thế điện thoại. */
let isRunning = false;
let isCountingDown = false;
let isCalibrated = false;
let countdownTimer = null;
let watchdogTimer = null;
let sessionGeneration = 0;
let wakeLock = null;
let lastSensorArrival = 0;
let lastSampleTime = 0;
let recentSamples = [];
let calibrationSamples = [];
let rawSensor = { x: 0, y: 0, z: 1 };
let manualOffset = { x: 0, y: 0, z: 1 };
let slopeBaselineLon = 0;
let slopeHasEstimate = false;
let vertBaseline = 0;
let smoothG = { x: 0, lon: 0, vert: 0 };
let prevLateralG = 0;
let lastSignX = 0;
let lastReversalAt = 0;
let reversalTimestamps = [];
let instantScore = 100;
let tripPenalty = 0;
let violationCount = 0;
let isCurrentlyViolating = false;
let lastViolationAt = -Infinity;
let lastPotholePct = 0;
let lastSlopeUpdate = 0;
const peaks = { Ga: { val: 0, time: 0 }, Phanh: { val: 0, time: 0 }, Cua: { val: 0, time: 0 }, Xoc: { val: 0, time: 0 } };
const alertHold = { lastAt: -Infinity, peaks: { Ga: 0, Phanh: 0, Cua: 0, Xoc: 0 }, weaving: false };
function setBanner(title, subtitle, state = '') {
  $('alertBanner').className = state ? `alert-banner ${state}` : 'alert-banner';
  $('alertTitle').textContent = title;
  $('alertSub').textContent = subtitle;
}
function averageOffsets(samples) {
  const n = samples.length;
  if (n < 6) return null;
  const av = { x: 0, y: 0, z: 0 };
  for (const s of samples) { av.x += s.x; av.y += s.y; av.z += s.z; }
  av.x /= n; av.y /= n; av.z /= n;
  const variation = Math.sqrt(samples.reduce((sum, s) => sum +
    (s.x - av.x) ** 2 + (s.y - av.y) ** 2 + (s.z - av.z) ** 2, 0) / n);
  // Sai lệch lớn cho thấy máy đang rung/chuyển động, cần đứng yên để lấy gốc 0G.
  return variation <= 0.07 && Math.hypot(av.x, av.y, av.z) >= 0.55 ? av : null;
}
function resetSamplesAndScores(resetTrip) {
  slopeBaselineLon = 0; slopeHasEstimate = false; vertBaseline = 0;
  smoothG = { x: 0, lon: 0, vert: 0 };
  prevLateralG = 0; lastSignX = 0; lastReversalAt = 0; reversalTimestamps = [];
  lastPotholePct = 0;
  Object.values(peaks).forEach((pk) => { pk.val = 0; pk.time = 0; });
  alertHold.lastAt = -Infinity; alertHold.weaving = false;
  Object.keys(alertHold.peaks).forEach((k) => { alertHold.peaks[k] = 0; });
  isCurrentlyViolating = false;
  if (resetTrip) {
    instantScore = 100; tripPenalty = 0; violationCount = 0;
    lastViolationAt = -Infinity;
    $('scoreValue').textContent = '100';
    $('scoreValue').style.color = 'var(--green)';
    $('instantScore').textContent = 'Hiện tại: 100';
    $('violationCount').textContent = '0';
  }
}
async function requestWakeLock() {
  if (!navigator.wakeLock || !isRunning) return;
  try { wakeLock = await navigator.wakeLock.request('screen'); } catch (_) {}
}
function stopApp(title = 'ĐÃ DỪNG', subtitle = 'Bấm Bắt đầu để đo chuyến đi mới') {
  isRunning = false; isCountingDown = false; isCalibrated = false;
  sessionGeneration++;
  clearTimeout(countdownTimer); countdownTimer = null;
  clearInterval(watchdogTimer); watchdogTimer = null;
  window.removeEventListener('devicemotion', handleMotion);
  if (wakeLock) { wakeLock.release().catch(() => {}); wakeLock = null; }
  $('btnStart').classList.remove('running');
  $('btnStart').innerHTML = '<span>▶ BẮT ĐẦU</span>';
  setBanner(title, subtitle);
}
async function startApp() {
  if (isRunning) { stopApp(); return; }
  if (typeof DeviceMotionEvent !== 'undefined' && typeof DeviceMotionEvent.requestPermission === 'function') {
    try {
      const permission = await DeviceMotionEvent.requestPermission();
      if (permission !== 'granted') {
        setBanner('CHƯA CÓ QUYỀN CẢM BIẾN', 'Hãy cho phép cảm biến chuyển động trong trình duyệt', 'warn-100');
        return;
      }
    } catch (_) {
      setBanner('KHÔNG MỞ ĐƯỢC CẢM BIẾN', 'Hãy mở bằng HTTPS và cấp quyền chuyển động', 'warn-100');
      return;
    }
  }
  initAudioContext();
  isRunning = true; isCountingDown = true; isCalibrated = false;
  const generation = ++sessionGeneration;
  calibrationSamples = []; recentSamples = [];
  lastSensorArrival = 0; lastSampleTime = 0;
  $('btnStart').classList.add('running');
  $('btnStart').innerHTML = '<span>⏹ DỪNG</span>';
  setBanner('ĐANG CÂN CHỈNH...', `Giữ điện thoại cố định ${config.startDelay.toFixed(1)} giây`, 'warn-70');
  window.addEventListener('devicemotion', handleMotion);
  requestWakeLock();
  countdownTimer = setTimeout(() => {
    if (!isRunning || generation !== sessionGeneration) return;
    const offsets = averageOffsets(calibrationSamples);
    if (!offsets) {
      stopApp('CHƯA CÂN CHỈNH ĐƯỢC', calibrationSamples.length < 6
        ? 'Không nhận cảm biến. Kiểm tra quyền, HTTPS và thiết bị.'
        : 'Điện thoại đang rung. Dừng xe và thử lại.');
      return;
    }
    manualOffset = offsets; isCountingDown = false; isCalibrated = true;
    lastSampleTime = performance.now();
    resetSamplesAndScores(true);
    setBanner('ĐANG THEO DÕI', 'Đã cân chỉnh • Lái xe nhẹ nhàng');
  }, config.startDelay * 1000);
  watchdogTimer = setInterval(() => {
    if (isRunning && !isCountingDown && performance.now() - lastSensorArrival > 3000) {
      setBanner('MẤT TÍN HIỆU CẢM BIẾN', 'Không có mẫu chuyển động mới; kiểm tra điện thoại', 'warn-100');
    }
  }, 1000);
}
function quickCalibrate() {
  if (!isRunning || isCountingDown || !isCalibrated) {
    setBanner('CHƯA THỂ ĐẶT LẠI 0G', 'Bắt đầu theo dõi và để máy đứng yên trước.');
    return;
  }
  const offsets = averageOffsets(recentSamples.slice(-35));
  if (!offsets) {
    setBanner('GIỮ ĐIỆN THOẠI ỔN ĐỊNH', 'Chỉ đặt lại 0G khi xe dừng, máy không rung', 'warn-70');
    return;
  }
  manualOffset = offsets;
  resetSamplesAndScores(false); lastSampleTime = performance.now();
  setBanner('ĐÃ ĐẶT LẠI 0G', 'Giữ nguyên vị trí lắp điện thoại');
}
function updateSlopeBadge(degrees, valid, now) {
  if (now - lastSlopeUpdate < 650) return;
  lastSlopeUpdate = now;
  $('slopeBadge').classList.toggle('mountain-active', valid && Math.abs(degrees) >= 3);
  $('slopeText').textContent = valid
    ? `Dốc tương đối ≈ ${degrees > 0 ? '+' : ''}${degrees}°`
    : 'Độ dốc: chưa xác định';
}
function handleMotion(event) {
  if (!isRunning) return;
  const ag = event.accelerationIncludingGravity;
  if (!ag || ![ag.x, ag.y, ag.z].every((x) => typeof x === 'number' && Number.isFinite(x))) return;
  const now = performance.now();
  const sensor = { x: ag.x / GRAVITY, y: ag.y / GRAVITY, z: ag.z / GRAVITY };
  rawSensor = sensor; lastSensorArrival = now;
  recentSamples.push(sensor);
  if (recentSamples.length > 60) recentSamples.shift();
  if (isCountingDown) {
    calibrationSamples.push(sensor);
    if (calibrationSamples.length > 150) calibrationSamples.shift();
    return;
  }
  if (!isCalibrated) return;
  if (!lastSampleTime) { lastSampleTime = now; return; }
  const dt = clamp((now - lastSampleTime) / 1000, 0.012, 0.15);
  lastSampleTime = now;
  const dx = sensor.x - manualOffset.x;
  const dy = sensor.y - manualOffset.y;
  const dz = sensor.z - manualOffset.z;
  const normYZ = Math.hypot(manualOffset.y, manualOffset.z);
  const norm3 = Math.hypot(manualOffset.x, manualOffset.y, manualOffset.z) || 1;
  const toLong = (y, z) => normYZ > 0.25 ? (y * manualOffset.z - z * manualOffset.y) / normYZ : y;
  const lonCal = toLong(dy, dz);
  const vertCal = (dx * manualOffset.x + dy * manualOffset.y + dz * manualOffset.z) / norm3;
  vertBaseline += (vertCal - vertBaseline) * smoothFactor(dt, 0.55);
  let dynamicVert = Math.abs(vertCal - vertBaseline);
  let dynamicX = dx;
  let dynamicLon = lonCal;
  const lin = event.acceleration;
  const hasLin = lin && [lin.x, lin.y, lin.z].every((x) => typeof x === 'number' && Number.isFinite(x));
  if (hasLin) {
    const lx = lin.x / GRAVITY, ly = lin.y / GRAVITY, lz = lin.z / GRAVITY;
    const linLon = toLong(ly, lz);
    const linVert = Math.abs((lx * manualOffset.x + ly * manualOffset.y + lz * manualOffset.z) / norm3);
    // Trừ gia tốc tịnh tiến trước khi ước lượng độ dốc; không công bố là độ dốc tuyệt đối.
    if (Math.hypot(lx, ly, lz) < 0.12) {
      slopeBaselineLon += ((lonCal - linLon) - slopeBaselineLon) * smoothFactor(dt, 5);
      slopeHasEstimate = true;
    }
    dynamicX = 0.25 * dx + 0.75 * lx;
    dynamicLon = 0.25 * (lonCal - slopeBaselineLon) + 0.75 * linLon;
    dynamicVert = 0.35 * dynamicVert + 0.65 * linVert;
  } else {
    // Thiếu dữ liệu gia tốc tuyến tính => không suy đoán độ dốc từ lực tăng tốc kéo dài.
    dynamicLon = lonCal;
    slopeHasEstimate = false;
  }
  const deg = slopeHasEstimate ? Math.round(Math.asin(clamp(slopeBaselineLon, -1, 1)) * 180 / Math.PI) : 0;
  updateSlopeBadge(deg, slopeHasEstimate, now);
  if (dynamicVert < 0.015) dynamicVert = 0;
  smoothG.x += (dynamicX - smoothG.x) * smoothFactor(dt, 0.20);
  smoothG.lon += (dynamicLon - smoothG.lon) * smoothFactor(dt, 0.25);
  smoothG.vert += (dynamicVert - smoothG.vert) * smoothFactor(dt, 0.085);
  const jerkX = Math.abs(smoothG.x - prevLateralG) / dt;
  prevLateralG = smoothG.x;
  const currentSign = Math.abs(smoothG.x) >= config.maxCua * 0.52 ? Math.sign(smoothG.x) : 0;
  if (currentSign && lastSignX && currentSign !== lastSignX && now - lastReversalAt > 250 && jerkX > config.maxJerk * 0.25) {
    lastReversalAt = now;
    reversalTimestamps.push(now);
  }
  if (currentSign) lastSignX = currentSign;
  reversalTimestamps = reversalTimestamps.filter((t) => now - t <= 3200);
  const weaving = reversalTimestamps.length >= 2; // Không kết luận chỉ từ 1 cú cua hoặc 1 đỉnh jerk.
  evaluateAndRender(smoothG.x, smoothG.lon, smoothG.vert, weaving, dt, now);
}
function levelColor(pct) {
  if (pct >= 100) return 'var(--red)';
  if (pct >= 85) return 'var(--orange)';
  if (pct >= 65) return 'var(--yellow)';
  return 'var(--green)';
}
function updateMetric(key, percentage, now) {
  const pk = peaks[key];
  const holdMs = config.peakHoldTime * 1000;
  if (percentage >= pk.val) { pk.val = percentage; if (percentage > 0) pk.time = now; }
  else if (holdMs <= 0 || now - pk.time >= holdMs) pk.val = percentage;
  const peakPct = Math.round(pk.val);
  const liveClamped = clamp(percentage, 0, 100);
  const peakClamped = clamp(peakPct, 0, 100);
  const bar = $(`bar${key}`);
  bar.style.width = `${liveClamped}%`; bar.style.backgroundColor = levelColor(percentage);
  $(`val${key}`).textContent = `${peakPct}%`;
  $(`val${key}`).style.color = peakPct >= 65 ? levelColor(peakPct) : 'var(--text)';
  const mark = $(`peak${key}`);
  mark.style.opacity = holdMs > 0 && peakPct >= 15 ? '1' : '0';
  mark.style.left = `calc(${Math.min(99, peakClamped)}% - 2px)`;
  mark.style.backgroundColor = levelColor(peakPct);
  const circumference = 2 * Math.PI * 30;
  const ring = $(`donut${key}`);
  ring.style.strokeDashoffset = String(circumference * (1 - peakClamped / 100));
  ring.style.stroke = levelColor(peakPct);
  $(`donutVal${key}`).textContent = `${peakPct}%`;
  $(`donutVal${key}`).style.color = peakPct >= 65 ? levelColor(peakPct) : 'var(--text)';
}
function evaluateAndRender(gx, glon, gvert, weaving, dt, now) {
  const ga = Math.max(0, glon);
  const phanh = Math.max(0, -glon);
  const cua = Math.abs(gx);
  const values = {
    Ga: Math.min(150, Math.round(ga / config.maxGa * 100)),
    Phanh: Math.min(150, Math.round(phanh / config.maxPhanh * 100)),
    Cua: Math.min(150, Math.round(cua / config.maxCua * 100)),
    Xoc: Math.min(150, Math.round(gvert / config.potholeThreshold * 100))
  };
  for (const key of Object.keys(values)) updateMetric(key, values[key], now);
  const driveMax = Math.max(values.Ga, values.Phanh, values.Cua);
  const maxAll = Math.max(driveMax, values.Xoc);
  const potholeNew = values.Xoc >= 100 && lastPotholePct < 75;
  lastPotholePct = values.Xoc;
  handleSoundAlerts(now, { drivingPct: driveMax, potholePct: values.Xoc, potholeNew, weaving });

  const cup = $('cupCircle');
  const radius = Math.max(23, cup.clientWidth / 2 - 16);
  const limit = Math.max(config.maxGa, config.maxPhanh, config.maxCua);
  const nx = clamp(gx / limit, -1, 1);
  const ny = clamp(glon / limit, -1, 1);
  const color = weaving ? 'var(--red)' : levelColor(maxAll);
  $('gBall').style.transform = `translate(${(nx * radius).toFixed(1)}px, ${(-ny * radius).toFixed(1)}px)`;
  $('gBall').style.backgroundColor = color;
  $('gBall').style.boxShadow = `0 0 12px ${color}`;
  $('cupReadout').textContent = `${Math.hypot(gx, glon).toFixed(2)} G`;

  if (weaving || maxAll >= 100) {
    if (!isCurrentlyViolating && now - lastViolationAt >= 1000) {
      violationCount++; $('violationCount').textContent = String(violationCount);
      lastViolationAt = now;
    }
    isCurrentlyViolating = true;
  } else if (maxAll < 85 && !weaving) isCurrentlyViolating = false;

  // Điểm hiện tại hồi phục theo thời gian; điểm chuyến đi tích lũy KHÔNG tự hồi phục.
  const excess = (pct) => Math.max(0, (pct - 95) / 35);
  const discomfort = excess(values.Ga) * 0.8 + excess(values.Phanh) * 1.15 +
    excess(values.Cua) * 0.95 + excess(values.Xoc) * 1.40 + (weaving ? 1.8 : 0);
  tripPenalty += dt * discomfort * 1.9 + (potholeNew ? 0.55 : 0);
  instantScore = discomfort > 0
    ? Math.max(0, instantScore - dt * discomfort * 6)
    : Math.min(100, instantScore + dt * config.scoreRecovery);
  const tripScore = Math.round(Math.max(0, 100 - tripPenalty));
  $('scoreValue').textContent = String(tripScore);
  $('scoreValue').style.color = tripScore >= 85 ? 'var(--green)' : tripScore >= 65 ? 'var(--yellow)' : 'var(--red)';
  $('instantScore').textContent = `Hiện tại: ${Math.round(instantScore)}`;

  const alertHoldMs = config.alertHoldTime * 1000;
  const triggered = weaving || maxAll >= 100;
  if (triggered) {
    if (now - alertHold.lastAt > alertHoldMs) {
      for (const key of Object.keys(values)) alertHold.peaks[key] = 0;
      alertHold.weaving = false;
    }
    alertHold.lastAt = now;
    for (const key of Object.keys(values)) {
      if (values[key] >= 100) alertHold.peaks[key] = Math.max(alertHold.peaks[key], values[key]);
    }
    alertHold.weaving ||= weaving;
  }
  if (now - alertHold.lastAt <= alertHoldMs) {
    const texts = [];
    if (alertHold.weaving) texts.push('LẮC NGANG LIÊN TỤC');
    for (const [key, label] of [['Xoc', 'Xóc'], ['Phanh', 'Phanh'], ['Cua', 'Cua'], ['Ga', 'Ga']]) {
      if (alertHold.peaks[key] >= 100) texts.push(`${label}: ${alertHold.peaks[key]}%`);
    }
    setBanner(texts.join(' • ') || 'VƯỢT NGƯỠNG', triggered ? 'Hãy điều khiển êm hơn khi điều kiện an toàn cho phép' : 'Đang giữ cảnh báo vừa xuất hiện', 'warn-100');
  } else if (maxAll >= 85) {
    setBanner('GẦN NGƯỠNG', 'Giảm thao tác đột ngột nếu an toàn', 'warn-80');
  } else {
    setBanner('LÁI XE ÊM ÁI', 'Đang đo chuyển động của xe');
  }
}

/* Tất cả nút bấm/cài đặt */
$('btnStart').addEventListener('click', startApp);
$('btnQuickCalib').addEventListener('click', quickCalibrate);
$('btnComfortPlus').addEventListener('click', () => setComfortLevel(config.comfortLevel + 5));
$('btnComfortMinus').addEventListener('click', () => setComfortLevel(config.comfortLevel - 5));
$('rngComfort').addEventListener('input', (e) => setComfortLevel(Number(e.target.value)));
$('btnSettings').addEventListener('click', () => {
  $('settingsModal').classList.add('open');
  $('btnCloseModal').focus();
});
function closeSettings() { $('settingsModal').classList.remove('open'); $('btnSettings').focus(); }
$('btnCloseModal').addEventListener('click', closeSettings);
$('settingsModal').addEventListener('click', (e) => { if (e.target.id === 'settingsModal') closeSettings(); });
document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && $('settingsModal').classList.contains('open')) closeSettings(); });
$('btnThemeLight').addEventListener('click', () => applyTheme('light'));
$('btnThemeDark').addEventListener('click', () => applyTheme('dark'));
$('btnChartBar').addEventListener('click', () => applyChartType('bar'));
$('btnChartDonut').addEventListener('click', () => applyChartType('donut'));
document.querySelectorAll('[data-visible-metric]').forEach((input) => input.addEventListener('change', () => {
  const checked = METRICS.filter((key) => document.querySelector(`[data-visible-metric="${key}"]`).checked);
  if (checked.length === 0) { input.checked = true; return; }
  config.visibleMetrics = checked;
  applyMetricVisibility();
}));
$('btnShowAll').addEventListener('click', () => { config.visibleMetrics = [...METRICS]; applyMetricVisibility(); });
$('chkSoundEnabled').addEventListener('change', (e) => { config.soundEnabled = e.target.checked; saveConfig(); });
for (const wave of ['square', 'triangle', 'sine']) {
  $({square:'btnWaveSquare',triangle:'btnWaveTriangle',sine:'btnWaveSine'}[wave]).addEventListener('click', () => {
    applyWave(wave); if (config.soundEnabled) burst(wave, 1200);
  });
}
for (const wave of ['sawtooth', 'square', 'sine']) {
  $({sawtooth:'btnPotholeSaw',square:'btnPotholeSquare',sine:'btnPotholeSine'}[wave]).addEventListener('click', () => {
    applyPotholeWave(wave); if (config.soundEnabled) potholeBurst();
  });
}
$('btnTestBeepHigh').addEventListener('click', () => burst());
$('btnTestPothole').addEventListener('click', potholeBurst);
function bindSliders() {
  bindNumericSlider('rngVolumeBoost', 'lblVolumeBoost', 'volumePercent', '%', 0);
  bindNumericSlider('rngStartDelay', 'lblStartDelay', 'startDelay', ' giây', 1);
  bindNumericSlider('rngScoreRecovery', 'lblScoreRecovery', 'scoreRecovery', ' đ/s', 0);
  bindNumericSlider('rngPeakHoldTime', 'lblPeakHoldTime', 'peakHoldTime', ' giây', 1);
  bindNumericSlider('rngAlertHoldTime', 'lblAlertHoldTime', 'alertHoldTime', ' giây', 1);
  for (const [id, label, key, unit] of [
    ['rngMaxGa','lblMaxGa','maxGa',' G'],
    ['rngMaxPhanh','lblMaxPhanh','maxPhanh',' G'],
    ['rngMaxCua','lblMaxCua','maxCua',' G'],
    ['rngPotholeThreshold','lblPotholeThreshold','potholeThreshold',' G'],
    ['rngMaxJerk','lblMaxJerk','maxJerk',' G/s']
  ]) bindNumericSlider(id, label, key, unit, 3, true);
}
function syncAllSettings() {
  applyTheme(config.theme, false);
  applyChartType(config.chartType, false);
  applyMetricVisibility(false);
  applyWave(config.waveType, false);
  applyPotholeWave(config.potholeWave, false);
  $('chkSoundEnabled').checked = config.soundEnabled;
  for (const [id, label, key, suffix, decimals] of [
    ['rngVolumeBoost','lblVolumeBoost','volumePercent','%',0],
    ['rngStartDelay','lblStartDelay','startDelay',' giây',1],
    ['rngScoreRecovery','lblScoreRecovery','scoreRecovery',' đ/s',0],
    ['rngPeakHoldTime','lblPeakHoldTime','peakHoldTime',' giây',1],
    ['rngAlertHoldTime','lblAlertHoldTime','alertHoldTime',' giây',1]
  ]) {
    $(id).value = config[key]; $(label).textContent = `${Number(config[key]).toFixed(decimals)}${suffix}`;
  }
  syncComfortUI();
}
$('btnResetDefaults').addEventListener('click', () => {
  if (!window.confirm('Khôi phục tất cả cài đặt về mặc định? Điểm của chuyến đi đang chạy không bị xóa.')) return;
  config = { ...DEFAULTS, visibleMetrics: [...METRICS], ...thresholdsFor(DEFAULTS.comfortLevel) };
  syncAllSettings();
  saveConfig();
});
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'visible' && isRunning) {
    requestWakeLock();
    // Không tính dồn thời gian chạy ngầm thành 1 mẫu chuyển động.
    lastSampleTime = performance.now();
  }
});

if (!window.__APP_HUB__ && 'serviceWorker' in navigator && location.protocol !== 'file:') {
  window.addEventListener('load', () => navigator.serviceWorker.register('./sw.js').catch(() => {}));
}
bindSliders();
syncAllSettings();
$('slopeText').textContent = 'Độ dốc: chưa xác định';
