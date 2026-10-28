/* App Hub native bridge for the COPY of SmooDri. No changes to the original repo.
   A deliberate tap on SmooDri's own START/STOP button controls the native FGS.
   Neither this file nor WebView sensor events run the background service itself. */
(() => {
  if (!window.__APP_HUB__ || window.parent === window) return;
  function install() {
    const button = document.getElementById('btnStart');
    if (!button) return;
    let wasRunning = button.classList.contains('running');
    const observer = new MutationObserver(() => {
      const nowRunning = button.classList.contains('running');
      if (wasRunning === nowRunning) return;
      wasRunning = nowRunning;
      let comfort = 60;
      try {
        const saved = JSON.parse(localStorage.getItem('smoodri_cfg_v8') || '{}');
        if (Number.isFinite(Number(saved.comfortLevel))) comfort = Number(saved.comfortLevel);
      } catch (_) { /* default comfort level */ }
      window.parent.postMessage({
        type: nowRunning ? 'APPHUB_SMOODRI_START_NATIVE' : 'APPHUB_SMOODRI_STOP_NATIVE',
        comfort
      }, window.location.origin);
    });
    observer.observe(button, { attributes: true, attributeFilter: ['class'] });
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', install);
  else install();
})();
