import './style.css';
import { Capacitor, CapacitorHttp, registerPlugin } from '@capacitor/core';
import { CapacitorUpdater } from '@capgo/capacitor-updater';

const BASE = import.meta.env.BASE_URL;
const UPDATE_URL = 'https://gptlohoi-del.github.io/App-Hub/updates/latest.json';
const app = document.getElementById('app');

// Android FGS belongs to App Hub, not to an individual Web module. A normal
// browser has no access to this plugin; the original SmooDri PWA is unchanged.
const SmooDriMotion = registerPlugin('SmooDriMotion');
const AppHubPiP = registerPlugin('AppHubPiP');
const hasNativeMotion = Capacitor.isNativePlatform() && Capacitor.isPluginAvailable('SmooDriMotion');
const hasNativePiP = Capacitor.isNativePlatform() && Capacitor.isPluginAvailable('AppHubPiP');
let nativeMotionStatus = null;
let nativeMotionError = '';
let lastAutoPipSetting = null;
let pipIsActive = false;
let pipSummaryTimer = null;

function safeNativeError(error) {
  return String(error?.message || error || 'Không xác định').slice(0, 180);
}
function motionSummary(s) {
  if (!s?.running) return 'Đo nền chưa chạy';
  return `Đang đo nền · Điểm ~${s.score ?? '--'} · GA ${s.ga ?? 0}% · Phanh ${s.phanh ?? 0}% · Cua ${s.cua ?? 0}% · Xóc ${s.xoc ?? 0}%`;
}
// Automatic Android PiP is active only when the SmooDri module is open AND
// the user has started the native sensor session. It is never enabled for other modules.
function syncAutoPiP() {
  if (!hasNativePiP) return;
  const enable = Boolean(active?.id === 'smoodri' && nativeMotionStatus?.running);
  if (enable === lastAutoPipSetting) return;
  lastAutoPipSetting = enable;
  void AppHubPiP.setAutoEnter({ enabled: enable }).catch((err) => {
    lastAutoPipSetting = null;
    console.warn('PiP auto mode:', safeNativeError(err));
  });
}
function renderMotionStatus() {
  const summary = motionSummary(nativeMotionStatus);
  for (const id of ['native-motion-home', 'native-motion-view']) {
    const panel = document.getElementById(id);
    if (!panel) continue;
    if (id === 'native-motion-home') panel.hidden = !nativeMotionStatus?.running && !nativeMotionError && !/thất bại|Không đăng ký|không có gia tốc/i.test(nativeMotionStatus?.status || '');
    const label = panel.querySelector('.native-motion-description');
    if (label) label.textContent = nativeMotionError || (!nativeMotionStatus?.running && nativeMotionStatus?.status !== 'Đã dừng đo nền' ? nativeMotionStatus?.status : summary);
    const stop = panel.querySelector('.native-motion-stop');
    if (stop) stop.hidden = !nativeMotionStatus?.running;
  }
  syncAutoPiP();
  refreshPipSummary();
}
async function refreshNativeMotion() {
  if (!hasNativeMotion) return;
  try {
    nativeMotionStatus = await SmooDriMotion.getStatus();
    renderMotionStatus();
  } catch (error) {
    nativeMotionError = 'Không đọc được cảm biến Android: ' + safeNativeError(error);
    renderMotionStatus();
  }
}
async function startNativeMotion(comfort = 60) {
  if (!hasNativeMotion) return;
  nativeMotionError = '';
  try {
    await SmooDriMotion.start({comfort: Math.max(20, Math.min(100, Number(comfort) || 60))});
    await refreshNativeMotion();
  } catch (error) {
    nativeMotionError = 'Không bật được đo nền: ' + safeNativeError(error);
    renderMotionStatus();
  }
}
async function stopNativeMotion() {
  if (!hasNativeMotion) return;
  nativeMotionError = '';
  try {
    await SmooDriMotion.stop();
    // Android processes stop action asynchronously.
    await refreshNativeMotion();
  } catch (error) {
    nativeMotionError = 'Không dừng được đo nền: ' + safeNativeError(error);
    renderMotionStatus();
  }
}
function nativeMotionPanel(id) {
  const box = el('div', { className: 'native-motion-panel', id });
  const label = el('span', { className: 'native-motion-description' }, 'Đo nền chưa chạy');
  const stop = el('button', { className: 'native-motion-stop', type: 'button' }, 'DỪNG ĐO NỀN');
  stop.hidden = true;
  stop.addEventListener('click', () => void stopNativeMotion());
  box.append(label, stop);
  return box;
}
// The offline SmooDri copy posts only to its SAME-ORIGIN parent. No other repo
// can start the sensor service by sending a forged message from another frame.
window.addEventListener('message', (event) => {
  if (event.origin !== window.location.origin || active?.id !== 'smoodri') return;
  const frame = document.querySelector('.module-frame');
  if (!frame || event.source !== frame.contentWindow) return;
  const type = event.data?.type;
  if (type === 'APPHUB_SMOODRI_START_NATIVE') void startNativeMotion(event.data.comfort);
  else if (type === 'APPHUB_SMOODRI_STOP_NATIVE') void stopNativeMotion();
});

let modules = [];
let active = null;
let updating = false;
let otaStage = 'idle';
let otaProgress = null;
let lastVisibleError = null;
let remoteVersion = '';
let installedVersion = '';
const DIAG_KEY = 'apphub.ota.diagnostics.v2';
const STAGE_NAME = {
  idle: 'Chưa kiểm tra',
  server: 'Kết nối máy chủ cập nhật',
  manifest: 'Kiểm tra tệp latest.json',
  plugin: 'Đọc thông tin plugin OTA',
  current: 'Đọc phiên bản đang sử dụng',
  pending: 'Kiểm tra bản đang chờ kích hoạt',
  download: 'Tải và giải nén gói ZIP',
  schedule: 'Lên lịch kích hoạt bản mới',
  ready: 'Xác nhận ứng dụng khởi động',
  complete: 'Hoàn tất'
};

function shortError(error) {
  const message = typeof error === 'string' ? error : (error?.message || String(error));
  return String(message).replace(/([?&](?:token|key|password|signature|secret)=)[^&\s]+/gi, '$1[ẩn]')
    .replace(/\s+/g, ' ').slice(0, 420);
}
function errorCode(error) {
  const code = error?.code;
  if (typeof code === 'string' || typeof code === 'number') return String(code).slice(0, 80);
  if (error?.name === 'AbortError') return 'TIMEOUT';
  if (/network|connection|failed to fetch|unknown host/i.test(shortError(error))) return 'NETWORK';
  return 'OTA_ERROR';
}
function readHistory() {
  try { const value = JSON.parse(localStorage.getItem(DIAG_KEY) || '[]'); return Array.isArray(value) ? value : []; }
  catch { return []; }
}
function logEvent(level, stage, message, code = '') {
  const entry = { time: new Date().toISOString(), level, stage, message: String(message).slice(0, 500), code };
  const history = [...readHistory(), entry].slice(-30);
  try { localStorage.setItem(DIAG_KEY, JSON.stringify(history)); } catch { /* ignore private storage restrictions */ }
  console[level === 'error' ? 'error' : 'info']('[APPHUB OTA]', entry);
  showDiagnostics();
}
function setStage(stage, message, type = '') {
  otaStage = stage;
  status(message, type);
  showDiagnostics();
}
function advice(stage, message = '') {
  const text = String(message);
  if (/HTTP 404/i.test(text)) return 'Máy chủ không tìm thấy tệp: kiểm tra GitHub Pages và đường dẫn cập nhật.';
  if (/HTTP 401|HTTP 403/i.test(text)) return 'Máy chủ từ chối truy cập: kiểm tra quyền hoặc địa chỉ máy chủ.';
  if (stage === 'server') return 'Kiểm tra Wi-Fi/4G, thử mở latest.json trong trình duyệt. Nếu trình duyệt mở được, hãy sao chép nhật ký lỗi.';
  if (stage === 'manifest') return 'Kiểm tra version, URL ZIP và cấu trúc latest.json trên GitHub Pages.';
  if (stage === 'plugin' || stage === 'current' || stage === 'pending') return 'Có thể plugin native OTA chưa sẵn sàng hoặc không tương thích. Gửi nhật ký để xác định nguyên nhân.';
  if (stage === 'download') return 'Kiểm tra bộ nhớ trống, kết nối Internet và cấu trúc tệp ZIP cập nhật.';
  if (stage === 'schedule') return 'Gói có thể đã tải về nhưng chưa thể kích hoạt. Gửi nhật ký kỹ thuật để kiểm tra.';
  return 'Sao chép báo cáo lỗi và gửi để kiểm tra. Các ứng dụng đã cài vẫn dùng offline.';
}
function errorReport() {
  const lines = [
    'APP HUB — OTA DIAGNOSTIC REPORT',
    `Thời gian: ${new Date().toISOString()}`,
    `Nền tảng: ${Capacitor.getPlatform()}`,
    `Bước hiện tại: ${otaStage} (${STAGE_NAME[otaStage] || otaStage})`,
    `Phiên bản đang chạy: ${installedVersion || 'chưa đọc được'}`,
    `Phiên bản trên máy chủ: ${remoteVersion || 'chưa đọc được'}`,
    `Manifest: ${UPDATE_URL}`,
    '', 'NHẬT KÝ (mới nhất ở cuối):',
    ...readHistory().map(x => `${x.time} [${x.level.toUpperCase()}] [${x.stage}] ${x.code ? x.code + ': ' : ''}${x.message}`)
  ];
  return lines.join('\n');
}
async function copyReport() {
  const report = errorReport();
  try {
    if (navigator.clipboard?.writeText) await navigator.clipboard.writeText(report);
    else {
      const node = document.createElement('textarea');
      node.value = report; node.style.position = 'fixed'; node.style.opacity = '0';
      document.body.appendChild(node); node.select();
      if (!document.execCommand('copy')) throw new Error('Không sao chép được');
      node.remove();
    }
    status('Đã sao chép báo cáo. Bạn có thể dán vào ChatGPT.', 'success');
  } catch {
    // Expose a selectable fallback if clipboard is unavailable in WebView.
    const target = document.getElementById('ota-report-text');
    if (target) { target.closest('details').open = true; target.hidden = false; target.value = report; target.focus(); target.select(); }
    status('Không truy cập được bộ nhớ tạm. Hãy chọn và sao chép nội dung báo cáo bên dưới.');
  }
}
function showDiagnostics() {
  const step = document.getElementById('ota-stage');
  if (step) step.textContent = `Bước: ${STAGE_NAME[otaStage] || otaStage}`;
  const versions = document.getElementById('ota-versions');
  if (versions) versions.textContent = `Đang dùng: ${installedVersion || 'chưa rõ'} · Máy chủ: ${remoteVersion || 'chưa rõ'}`;
  const progress = document.getElementById('ota-progress-container');
  if (progress) progress.hidden = otaProgress === null;
  const bar = document.getElementById('ota-progress-bar');
  if (bar) { bar.style.width = `${otaProgress ?? 0}%`; bar.setAttribute('aria-valuenow', String(otaProgress ?? 0)); }
  const percent = document.getElementById('ota-progress-label');
  if (percent) percent.textContent = otaProgress === null ? '' : `${otaProgress}%`;
  const last = lastVisibleError;
  const panel = document.getElementById('ota-error');
  if (panel) {
    panel.hidden = !last;
    panel.replaceChildren();
    if (last) {
      panel.append(el('strong', {}, `Lỗi ${last.code || 'OTA_ERROR'} · ${STAGE_NAME[last.stage] || last.stage}`),
        el('div', {}, last.message), el('div', { className: 'ota-advice' }, advice(last.stage, last.message)));
    }
  }
  const report = document.getElementById('ota-report-text');
  if (report && !report.hidden) report.value = errorReport();
}
function createDiagnosticPanel() {
  const box = el('section', { className: 'ota-panel', 'aria-label': 'Chẩn đoán cập nhật' });
  box.append(el('div', { id: 'ota-stage', className: 'ota-stage' }, ''),
    el('div', { id: 'ota-versions', className: 'ota-versions' }, ''));
  const progress = el('div', { id: 'ota-progress-container', className: 'ota-progress-container' });
  progress.hidden = true;
  const track = el('div', { className: 'ota-track' });
  const bar = el('div', { className: 'ota-bar', role: 'progressbar', 'aria-valuemin': '0', 'aria-valuemax': '100', id: 'ota-progress-bar', 'aria-valuenow': '0' });
  track.append(bar);
  progress.append(track, el('span', { id: 'ota-progress-label' }, ''));
  box.append(progress);
  const error = el('div', { id: 'ota-error', className: 'ota-error' });
  error.hidden = true; box.append(error);
  const details = el('details', { className: 'ota-details' });
  details.append(el('summary', {}, 'Xem nhật ký kỹ thuật và sao chép báo cáo'));
  const copy = el('button', { className: 'ota-copy', type: 'button' }, 'Sao chép báo cáo lỗi');
  copy.addEventListener('click', () => void copyReport());
  const report = el('textarea', { id: 'ota-report-text', className: 'ota-report', readonly: 'readonly', rows: '9' });
  report.hidden = true;
  details.append(copy, report, el('p', { className: 'ota-note' }, 'Nhật ký được lưu cục bộ trên điện thoại, không tự gửi đi. Không chứa mật khẩu hoặc khóa GitHub.'));
  box.append(details);
  return box;
}


function el(tag, attrs = {}, text = '') {
  const node = document.createElement(tag);
  for (const [key, val] of Object.entries(attrs)) {
    if (key === 'className') node.className = val;
    else node.setAttribute(key, val);
  }
  if (text) node.textContent = text;
  return node;
}

function status(message, type = '') {
  const node = document.getElementById('status');
  if (!node) return;
  node.textContent = message;
  node.dataset.type = type;
}

function createHome() {
  setPipMode(false);
  syncAutoPiP();
  app.replaceChildren();
  const header = el('header', { className: 'header' });
  const top = el('div', { className: 'brand' });
  const mark = el('div', { className: 'brand-mark', 'aria-hidden': 'true' }, '◈');
  const brandText = el('div');
  brandText.append(el('h1', {}, 'App Hub'), el('p', {}, 'Các ứng dụng của bạn • Hoạt động offline'));
  top.append(mark, brandText);
  const statusBar = el('div', { className: 'status', id: 'status', role: 'status', 'aria-live': 'polite' }, 'Có thể sử dụng khi không có mạng');
  const sync = el('button', { className: 'sync', type: 'button', id: 'syncButton' }, '↻  Kiểm tra cập nhật');
  sync.addEventListener('click', () => void checkUpdate(true));
  // Chỉ giữ logo và tên App Hub ở đầu trang.
  header.append(top);
  // Toàn bộ OTA (nút, trạng thái, tiến độ, chẩn đoán) nằm sau danh sách ứng dụng.
  const updateSection = el('section', { className: 'update-section' });
  updateSection.append(
    el('h2', { className: 'update-heading' }, 'Cập nhật ứng dụng'),
    statusBar,
    sync,
    createDiagnosticPanel(),
    el('p', { className: 'build-marker' }, 'Giao diện: PiP-FGS-v2 · 28/10/2026')
  );
  const heading = el('div', { className: 'section-heading' });
  heading.append(el('h2', {}, 'Tính năng'), el('span', { className: 'count' }, `${modules.length} ứng dụng`));
  const grid = el('div', { className: 'grid' });
  const icons = { smoodri: '🚘', tapluyenpiano: '🎹', kinhtest2: '🎧' };
  for (const mod of modules) {
    const btn = el('button', { className: 'module', type: 'button' });
    btn.append(el('div', { className: 'module-icon', 'aria-hidden': 'true' }, mod.icon || icons[mod.id] || '📱'),
      el('div', { className: 'module-title' }, mod.name),
      el('div', { className: 'module-desc' }, mod.description || 'Ứng dụng offline'),
      el('div', { className: 'module-meta' }, `v${mod.version || '1.0'}  ·  Sẵn sàng offline`));
    btn.addEventListener('click', () => openModule(mod));
    grid.append(btn);
  }
  if (!modules.length) grid.append(el('p', {}, 'Chưa có module nào trong bản đóng gói.'));
  const footer = el('p', { className: 'footer' }, 'Dùng được khi mất mạng. Nếu có mạng, App Hub tự kiểm tra bản cập nhật khi mở.');
  const motionBox = nativeMotionPanel('native-motion-home');
  motionBox.hidden = true;
  app.append(header, heading, grid, motionBox, footer, updateSection);
  renderMotionStatus();
  showDiagnostics();
}

// Android Picture-in-Picture reuses the same App Hub Activity/WebView.
// Sensor samples are produced by the native foreground service, NOT by this timer.
function pipText(id, value) {
  const target = document.getElementById(id);
  if (target) target.textContent = String(value);
}
function refreshPipSummary() {
  if (!pipIsActive || active?.id !== 'smoodri') return;
  const data = nativeMotionStatus;
  const ready = Boolean(data?.running);
  pipText('pip-status', ready ? (data.status || 'ĐANG ĐO') : 'ĐÃ DỪNG');
  pipText('pip-score', ready ? `≈${data.score ?? '--'}` : '--');
  pipText('pip-ga', ready ? `${data.ga ?? 0}%` : '--');
  pipText('pip-brake', ready ? `${data.phanh ?? 0}%` : '--');
  pipText('pip-turn', ready ? `${data.cua ?? 0}%` : '--');
  pipText('pip-bump', ready ? `${data.xoc ?? 0}%` : '--');
}
function setPipMode(enabled) {
  const view = document.querySelector('.module-view');
  pipIsActive = Boolean(enabled && active?.id === 'smoodri' && view);
  if (view) view.classList.toggle('pip-mode', pipIsActive);
  if (pipSummaryTimer) clearInterval(pipSummaryTimer);
  pipSummaryTimer = null;
  if (pipIsActive) {
    refreshPipSummary();
    pipSummaryTimer = setInterval(refreshPipSummary, 1100);
  }
}
function makePipSummary() {
  const summary = el('div', { className: 'pip-summary', 'aria-label': 'SmooDri thu nhỏ' });
  summary.innerHTML = `
    <div class="pip-head"><strong>🚘 SmooDri</strong><span id="pip-status">ĐANG ĐO</span></div>
    <div class="pip-score-row"><span>ĐIỂM THAM KHẢO</span><strong id="pip-score">--</strong></div>
    <div class="pip-data">
      <span>GA <b id="pip-ga">--</b></span>
      <span>PHANH <b id="pip-brake">--</b></span>
      <span>CUA <b id="pip-turn">--</b></span>
      <span>Ổ GÀ <b id="pip-bump">--</b></span>
    </div>`;
  return summary;
}
window.addEventListener('apphub:native-pip', (event) => {
  setPipMode(Boolean(event.detail?.active));
});
async function enterSmoodriPiP() {
  if (active?.id !== 'smoodri') return;
  if (!hasNativePiP) {
    alert('Bản APK đang chạy chưa tích hợp PiP. Cần cài APK nền tảng mới.');
    return;
  }
  if (!nativeMotionStatus?.running) {
    alert('Hãy nhấn BẮT ĐẦU trong SmooDri, đợi đo nền hoạt động rồi mới thu nhỏ.');
    return;
  }
  try {
    const { supported } = await AppHubPiP.isSupported();
    if (!supported) throw new Error('Thiết bị không hỗ trợ PiP hoặc PiP bị tắt trong cài đặt Android.');
    setPipMode(true); // Prepare compact screen before native transition.
    await AppHubPiP.enter();
  } catch (error) {
    setPipMode(false);
    alert('Không mở được PiP: ' + safeNativeError(error));
  }
}

function openModule(mod) {
  setPipMode(false);
  active = mod;
  syncAutoPiP();
  const view = el('div', { className: 'module-view' });
  const bar = el('div', { className: 'viewer-topbar' });
  const back = el('button', { className: 'back', type: 'button' }, '‹  App Hub');
  back.addEventListener('click', () => { setPipMode(false); active = null; syncAutoPiP(); createHome(); });
  bar.append(back, el('span', { className: 'viewer-title' }, mod.name));
  if (mod.id === 'smoodri') {
    // The Android PiP bridge is shared by App Hub and only activated on user action.
    const pipButton = el('button', { className: 'pip-button', type: 'button' }, '◱ Thu nhỏ PiP');
    pipButton.addEventListener('click', () => void enterSmoodriPiP());
    bar.append(pipButton, nativeMotionPanel('native-motion-view'));
  }
  const frame = el('iframe', {
    className: 'module-frame', title: mod.name,
    src: `${BASE}modules/${encodeURIComponent(mod.id)}/${encodeURIComponent(mod.entry || 'index.html')}`,
    allow: 'accelerometer; gyroscope; autoplay; fullscreen; microphone',
  });
  view.append(bar, frame);
  if (mod.id === 'smoodri' && hasNativePiP) view.append(makePipSummary());
  app.replaceChildren(view);
  renderMotionStatus();
  if (mod.id === 'smoodri') void refreshNativeMotion();
}

// Route bundled links from the Links module to other offline modules.
// Only messages from the active, same-origin iframe are accepted.
window.addEventListener('message', (event) => {
  if (event.origin !== window.location.origin || !active || active.id !== 'linktong') return;
  const frame = document.querySelector('.module-frame');
  if (!frame || event.source !== frame.contentWindow) return;
  if (event.data?.type !== 'APPHUB_OPEN_MODULE') return;
  const id = event.data.id;
  if (typeof id !== 'string') return;
  const target = modules.find(mod => mod.id === id);
  if (target) openModule(target);
});

async function getRemoteManifest() {
  const url = `${UPDATE_URL}?t=${Date.now()}`;
  let nativeFailure = null;
  if (Capacitor.isNativePlatform()) {
    try {
      const response = await CapacitorHttp.get({
        url, connectTimeout: 8000, readTimeout: 10000,
        headers: { 'Cache-Control': 'no-cache' }
      });
      if (response.status !== 200) throw new Error(`HTTP ${response.status} từ CapacitorHttp`);
      return typeof response.data === 'string' ? JSON.parse(response.data) : response.data;
    } catch (err) {
      nativeFailure = shortError(err);
      logEvent('warn', 'server', `Native HTTP thất bại: ${nativeFailure}; thử Web fetch thay thế.`, errorCode(err));
    }
  }
  const controller = new AbortController();
  const kill = setTimeout(() => controller.abort(), 12000);
  try {
    const response = await fetch(url, { cache: 'no-store', signal: controller.signal });
    if (!response.ok) throw new Error(`HTTP ${response.status} từ fetch`);
    const value = await response.json();
    if (nativeFailure) logEvent('info', 'server', 'Web fetch hoạt động dù Native HTTP thất bại.');
    return value;
  } catch (err) {
    throw new Error(nativeFailure ? `Native HTTP: ${nativeFailure}; Web fetch: ${shortError(err)}` : shortError(err));
  } finally { clearTimeout(kill); }
}

async function checkUpdate(manual = false) {
  if (updating || active) return;
  if (!Capacitor.isNativePlatform()) {
    if (manual) setStage('idle', 'Kiểm tra OTA được thực hiện bên trong APK Android.');
    return;
  }
  updating = true;
  lastVisibleError = null;
  otaProgress = null;
  remoteVersion = '';
  const button = document.getElementById('syncButton');
  if (button) button.disabled = true;
  try {
    setStage('server', 'Đang kết nối GitHub Pages…');
    logEvent('info', 'server', 'Bắt đầu kiểm tra cập nhật.');
    const latest = await getRemoteManifest();
    otaStage = 'manifest';
    if (!latest || !/^\d+\.\d+\.\d+$/.test(latest.version) ||
        !/^https:\/\/gptlohoi-del\.github\.io\/App-Hub\/updates\/[a-zA-Z0-9._-]+\.zip$/.test(latest.url)) {
      throw new Error('latest.json không có version hoặc URL ZIP hợp lệ');
    }
    remoteVersion = latest.version;
    logEvent('info', 'manifest', `Máy chủ báo bản ${latest.version}, dung lượng ZIP ${latest.sizeBytes ?? '?'} bytes.`);
    setStage('current', 'Đang kiểm tra phiên bản hiện có trong APK…');
    const current = await CapacitorUpdater.current();
    installedVersion = current?.bundle?.version || current?.bundle?.id || 'builtin';
    logEvent('info', 'current', `Đang chạy: ${installedVersion}, bundle id: ${current?.bundle?.id || 'không có'}.`);
    setStage('pending', 'Đang kiểm tra bản cập nhật chờ kích hoạt…');
    const pending = await CapacitorUpdater.getNextBundle();
    const pendingBundle = pending?.bundle || pending;
    if (current?.bundle?.version === latest.version) {
      setStage('complete', `App Hub đã sử dụng bản mới nhất (${latest.version}).`, 'success');
      logEvent('info', 'complete', 'Đang dùng bản mới nhất.');
      return;
    }
    if (pendingBundle?.version === latest.version) {
      setStage('complete', `Bản ${latest.version} đã tải xong. Hãy đóng rồi mở lại ứng dụng để kích hoạt.`, 'success');
      logEvent('info', 'complete', 'Bản mới đang chờ kích hoạt.');
      return;
    }
    otaProgress = 0;
    setStage('download', `Phát hiện bản ${latest.version}. Đang tải gói cập nhật…`);
    // Capgo Android requires a checksum for each downloadable ZIP bundle.
    // latest.sha256 must be the SHA-256 of the ZIP itself, not a hash of dist/ files.
    if (typeof latest.sha256 !== 'string' || !/^[0-9a-f]{64}$/i.test(latest.sha256)) {
      throw new Error('latest.json thiếu SHA-256 hợp lệ của file ZIP cập nhật');
    }
    const bundle = await CapacitorUpdater.download({
      url: latest.url,
      version: latest.version,
      checksum: latest.sha256.toLowerCase()
    });
    if (!bundle?.id) throw new Error('Plugin download không trả về Bundle ID');
    logEvent('info', 'download', `Đã tải và giải nén bản ${latest.version}; bundle id: ${bundle.id}.`);
    otaProgress = 100;
    setStage('schedule', 'Đang lên lịch kích hoạt bản mới…');
    await CapacitorUpdater.next({ id: bundle.id });
    setStage('complete', `Đã tải bản ${latest.version}. Hãy đóng và mở lại App Hub để sử dụng.`, 'success');
    logEvent('info', 'complete', `Đã lên lịch kích hoạt bản ${latest.version}.`);
  } catch (err) {
    const stage = otaStage;
    const code = errorCode(err);
    lastVisibleError = { stage, message: shortError(err), code };
    logEvent('error', stage, shortError(err), code);
    setStage(stage, `Không cập nhật được · ${STAGE_NAME[stage] || stage} · ${code}. Nhấn “Xem nhật ký” để biết chi tiết.`, 'error');
  } finally {
    updating = false;
    const btn = document.getElementById('syncButton');
    if (btn) btn.disabled = false;
  }
}

async function installUpdaterDiagnostics() {
  if (!Capacitor.isNativePlatform()) return;
  try {
    await CapacitorUpdater.addListener('download', (info) => {
      if (!updating || otaStage !== 'download' || !Number.isFinite(info?.percent)) return;
      otaProgress = Math.max(0, Math.min(100, Math.round(info.percent)));
      status(`Đang tải bản ${remoteVersion}… ${otaProgress}%`);
      showDiagnostics();
    });
    await CapacitorUpdater.addListener('downloadFailed', (info) => {
      logEvent('error', 'download', `Native downloadFailed: ${info?.version || 'không rõ phiên bản'}`, 'DOWNLOAD_FAILED');
    });
    await CapacitorUpdater.addListener('updateFailed', (info) => {
      lastVisibleError = { stage: 'ready', message: `Bản mới không khởi chạy được: ${info?.bundle?.version || 'không rõ phiên bản'}`, code: 'UPDATE_FAILED' };
      logEvent('error', 'ready', lastVisibleError.message, 'UPDATE_FAILED');
    });
  } catch (error) {
    logEvent('warn', 'plugin', `Không đăng ký được listener OTA: ${shortError(error)}`, errorCode(error));
  }
}

async function boot() {
  if (Capacitor.isNativePlatform()) void installUpdaterDiagnostics();
  try {
    const response = await fetch(`${BASE}modules.json`, { cache: 'no-store' });
    if (!response.ok) throw new Error('modules.json missing');
    const data = await response.json();
    modules = Array.isArray(data.modules) ? data.modules : [];
  } catch (error) { console.error('Module registry:', error); }
  createHome();
  // Chỉ xác nhận phiên bản Web đã sẵn sàng sau khi giao diện được khởi tạo.
  // Không chờ kết nối Internet; gọi trước bước kiểm tra OTA.
  if (Capacitor.isNativePlatform()) {
    void CapacitorUpdater.notifyAppReady().catch(err => {
      lastVisibleError = { stage: 'ready', message: `notifyAppReady(): ${shortError(err)}`, code: errorCode(err) };
      logEvent('error', 'ready', lastVisibleError.message, lastVisibleError.code);
    });
  }
  // Các tính năng offline phải mở được trước khi kiểm tra mạng.
  void refreshNativeMotion();
  // Poll only a tiny status payload: actual sensor acquisition and scoring run
  // on the Android service's sensor thread even when this WebView is suspended.
  if (hasNativeMotion) {
    setInterval(() => void refreshNativeMotion(), 1500);
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'visible') void refreshNativeMotion();
    });
  }
  void checkUpdate(false);
}
boot();
