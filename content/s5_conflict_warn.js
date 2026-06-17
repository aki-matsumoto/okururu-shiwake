/**
 * content/s5_conflict_warn.js
 *
 * S5：既存「査定支援拡張(okuruuru-mistake-prevention)」との同時稼働を検知して警告。
 *  - 仕分け支援とデパコス/ITコード系バッジが重複するため、どちらか一方をOFF推奨。
 *  - 別拡張のJS空間は読めないので、DOM footprint（okururu- prefix の id/class）で検知。
 *  - 拡張は他拡張を自動で無効化できないため、警告バナー＋手動OFF誘導。
 */
(function () {
  'use strict';
  if (window.OKURURU_SHIWAKE_S5_loaded) return;
  window.OKURURU_SHIWAKE_S5_loaded = true;
  if (!window.OKURURU) window.OKURURU = {};
  if (!window.OKURURU.features) window.OKURURU.features = {};

  const FEATURE_KEY = 's5_conflictWarn';
  const BANNER_ID = 'shiwake-conflict-banner';
  let enabled = true;
  let dismissed = false;
  let timer = null;

  // 既存拡張の footprint（自拡張のものは shiwake- prefix なので衝突しない）
  function legacyPresent() {
    try {
      if (document.querySelector('.okururu-f7-badge, .okururu-depacos-badge, .okururu-f76-badge, .okururu-badge')) return true;
      if (document.querySelector('[id^="okururu-f"], #okururu-badge-host, [id^="okururu-f78"], [id^="okururu-f79"]')) return true;
    } catch (e) { /* noop */ }
    return false;
  }

  function showBanner() {
    if (document.getElementById(BANNER_ID)) return;
    const bar = document.createElement('div');
    bar.id = BANNER_ID;
    bar.style.cssText = 'position:fixed;top:0;left:0;right:0;z-index:2147483646;background:#B91C1C;color:#fff;font-size:13px;font-weight:700;padding:8px 44px 8px 14px;box-shadow:0 2px 8px rgba(0,0,0,0.3);text-align:center;font-family:-apple-system,Meiryo,sans-serif';
    bar.innerHTML = '⚠ 「査定支援拡張」が同時に動作中です。仕分け支援とマークが重複します。chrome://extensions でどちらか一方をOFFにしてください。';
    const x = document.createElement('button');
    x.textContent = '×';
    x.style.cssText = 'position:absolute;right:10px;top:50%;transform:translateY(-50%);background:transparent;border:none;color:#fff;font-size:18px;font-weight:700;cursor:pointer';
    x.title = '今は閉じる（再読み込みで再表示）';
    x.addEventListener('click', () => { dismissed = true; bar.remove(); });
    bar.appendChild(x);
    document.body.appendChild(bar);
  }
  function hideBanner() { const b = document.getElementById(BANNER_ID); if (b) b.remove(); }

  function check() {
    if (!enabled) { hideBanner(); return; }
    if (legacyPresent() && !dismissed) showBanner();
    else if (!legacyPresent()) hideBanner();
  }

  async function init() {
    enabled = await window.OKURURU.utils.storage.isFeatureEnabled(FEATURE_KEY);
    if (!enabled) { hideBanner(); return; }
    check();
    if (!timer) timer = setInterval(check, 2000);
  }

  window.OKURURU.features.s5_conflictWarn = {
    init, FEATURE_KEY, check,
    isEnabled: () => enabled,
    setEnabled: (v) => { enabled = v; if (!v) hideBanner(); else { dismissed = false; check(); } }
  };
})();
