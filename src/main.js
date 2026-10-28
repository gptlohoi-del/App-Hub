import './style.css';
import { Capacitor, CapacitorHttp } from '@capacitor/core';
import { CapacitorUpdater } from '@capgo/capacitor-updater';

const BASE = import.meta.env.BASE_URL;
const UPDATE_URL = 'https://gptlohoi-del.github.io/App-Hub/updates/latest.json';
const app = document.getElementById('app');
let modules = [];
let active = null;
let updating = false;

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
  header.append(top);

const updateSection = el('section', {
  className: 'update-section'
});

updateSection.append(
  statusBar,
  sync,
  createDiagnosticPanel()
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
  app.append(
  header,
  heading,
  grid,
  footer,
  updateSection
);
}

function openModule(mod) {
  active = mod;
  const view = el('div', { className: 'module-view' });
  const bar = el('div', { className: 'viewer-topbar' });
  const back = el('button', { className: 'back', type: 'button' }, '‹  App Hub');
  back.addEventListener('click', () => { active = null; createHome(); });
  bar.append(back, el('span', { className: 'viewer-title' }, mod.name));
  const frame = el('iframe', {
    className: 'module-frame', title: mod.name,
    src: `${BASE}modules/${encodeURIComponent(mod.id)}/${encodeURIComponent(mod.entry || 'index.html')}`,
    allow: 'accelerometer; gyroscope; autoplay; fullscreen; microphone',
  });
  view.append(bar, frame);
  app.replaceChildren(view);
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
  if (Capacitor.isNativePlatform()) {
    const response = await CapacitorHttp.get({ url: `${UPDATE_URL}?t=${Date.now()}`, connectTimeout: 5000, readTimeout: 5000 });
    if (response.status !== 200) throw new Error(`HTTP ${response.status}`);
    return typeof response.data === 'string' ? JSON.parse(response.data) : response.data;
  }
  const controller = new AbortController();
  const kill = setTimeout(() => controller.abort(), 6000);
  try {
    const response = await fetch(`${UPDATE_URL}?t=${Date.now()}`, { cache: 'no-store', signal: controller.signal });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    return await response.json();
  } finally {
    clearTimeout(kill);
  }
}

async function checkUpdate(manual = false) {
  if (updating || active) return;
  if (!Capacitor.isNativePlatform()) {
    if (manual) status('Kiểm tra OTA chỉ thực hiện trong APK Android.');
    return;
  }
  updating = true;
  const button = document.getElementById('syncButton');
  if (button) button.disabled = true;
  status('Đang kiểm tra bản cập nhật…');
  try {
    const latest = await getRemoteManifest();
    if (!latest || !/^\d+\.\d+\.\d+$/.test(latest.version) ||
        !/^https:\/\/gptlohoi-del\.github\.io\/App-Hub\/updates\/[a-zA-Z0-9._-]+\.zip$/.test(latest.url)) {
      throw new Error('Tệp cập nhật không hợp lệ');
    }
    const current = await CapacitorUpdater.current();
    const pending = await CapacitorUpdater.getNextBundle();
    if (current.bundle?.version === latest.version) {
      status('Đã sử dụng phiên bản mới nhất.', 'success');
      return;
    }
    if (pending?.version === latest.version) {
      status('Bản mới đã tải, sẽ kích hoạt khi khởi động lại.', 'success');
      return;
    }
    status('Đã có bản mới. Đang tải vào bộ nhớ điện thoại…');
    const bundle = await CapacitorUpdater.download({ url: latest.url, version: latest.version });
    await CapacitorUpdater.next({ id: bundle.id });
    status('Đã tải xong. Bản mới sẽ được kích hoạt khi ứng dụng chuyển nền hoặc khởi động lại.', 'success');
  } catch (e) {
    console.warn('OTA check:', e);
    status(manual ? 'Không kiểm tra được cập nhật. Các ứng dụng offline vẫn dùng bình thường.' : 'Đang sử dụng dữ liệu đã lưu trên điện thoại.');
  } finally {
    updating = false;
    const btn = document.getElementById('syncButton');
    if (btn) btn.disabled = false;
  }
}

async function boot() {
  if (Capacitor.isNativePlatform()) {
    // Must happen immediately, before any network requests: enables rollback if the new bundle fails to boot.
    void CapacitorUpdater.notifyAppReady().catch(error => console.warn('Updater ready:', error));
  }
  try {
    const response = await fetch(`${BASE}modules.json`, { cache: 'no-store' });
    if (!response.ok) throw new Error('modules.json missing');
    const data = await response.json();
    modules = Array.isArray(data.modules) ? data.modules : [];
  } catch (error) { console.error('Module registry:', error); }
  createHome();
  // Only the APP shell checks online; modules themselves are bundled as local assets.
  void checkUpdate();
}
boot();
