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
    function sendPipSettings() {
      try {
        const saved = JSON.parse(localStorage.getItem('smoodri_cfg_v8') || '{}');
        window.parent.postMessage({type:'APPHUB_SMOODRI_PIP_SETTINGS', settings: {
          pipRatio:saved.pipRatio, pipFontSize:saved.pipFontSize,
          pipFontWeight:saved.pipFontWeight, pipBgColor:saved.pipBgColor,
          pipTextColor:saved.pipTextColor, pipVisible:saved.pipVisible
        }},window.location.origin);
      } catch (_) { /* malformed local config: use App Hub defaults */ }
    }
    let lastSpeedMessage='';
    function sendWebSpeed() {
      const text=document.getElementById('speedValue')?.textContent?.trim() || '';
      const status=document.getElementById('gpsStatus')?.textContent?.trim() || '';
      const running=button.classList.contains('running');
      const lastFix=Number(document.documentElement.dataset.smoodriLastGpsAt)||0;
      const hasRecentFix=lastFix>0 && Date.now()-lastFix<5000;
      const speed=running && hasRecentFix && /^\d{1,3}$/.test(text) ? Number(text) : null;
      const fingerprint=String(speed)+'|'+status;
      if(fingerprint===lastSpeedMessage && !running) return;
      lastSpeedMessage=fingerprint;
      window.parent.postMessage({type:'APPHUB_SMOODRI_SPEED',speed,gpsStatus:status},window.location.origin);
    }
    window.addEventListener('smoodri:pip-config-changed',sendPipSettings);
    // Also react if a future SmooDri release saves settings without dispatching the custom event.
    window.addEventListener('storage', event => {
      if (event.key === 'smoodri_cfg_v8') sendPipSettings();
    });
    sendPipSettings();
    sendWebSpeed();
    setInterval(sendWebSpeed,1000);
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', install);
  else install();
})();
