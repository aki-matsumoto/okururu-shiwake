/**
 * content/s7_update_notifier.js
 *
 * S7：アップデート通知バナー
 *  - background が保存した OKURURU_SHIWAKE_update_info の version と現バージョンを比較し、
 *    新版があれば上部にバナー表示。× で当該バージョンは非表示（次の新版で再表示）。
 *  - 強制リロード(force_min_version)は background が担当。ここは「お知らせ」表示のみ。
 */
(function () {
  'use strict';
  if (window.OKURURU_SHIWAKE_S7_loaded) return;
  window.OKURURU_SHIWAKE_S7_loaded = true;
  if (!window.OKURURU) window.OKURURU = {};
  if (!window.OKURURU.features) window.OKURURU.features = {};

  const FEATURE_KEY = 's7_updateNotifier';
  const BANNER_ID = 'shiwake-update-banner';
  let enabled = true;
  let timer = null;

  function parseSemver(v) { return String(v || '0.0.0').split('.').map((x) => parseInt(x, 10) || 0); }
  function semverLt(a, b) { const pa = parseSemver(a), pb = parseSemver(b); for (let i = 0; i < 3; i++) { if ((pa[i] || 0) < (pb[i] || 0)) return true; if ((pa[i] || 0) > (pb[i] || 0)) return false; } return false; }

  function getLocal(keys) { return new Promise((res) => { try { chrome.storage.local.get(keys, (r) => res(r || {})); } catch (e) { res({}); } }); }
  function setLocal(obj) { return new Promise((res) => { try { chrome.storage.local.set(obj, res); } catch (e) { res(); } }); }
  function curVersion() { try { return chrome.runtime.getManifest().version; } catch (e) { return '0.0.0'; } }

  function showBanner(info, onDismiss) {
    if (document.getElementById(BANNER_ID)) return;
    const bar = document.createElement('div');
    bar.id = BANNER_ID;
    bar.style.cssText = 'position:fixed;top:0;left:0;right:0;z-index:2147483645;background:#1D4ED8;color:#fff;font-size:13px;font-weight:700;padding:8px 80px 8px 14px;box-shadow:0 2px 8px rgba(0,0,0,0.3);text-align:center;font-family:-apple-system,Meiryo,sans-serif';
    const msg = (info.message ? '：' + String(info.message).slice(0, 90) : '');
    bar.textContent = '🆕 仕分け支援の新バージョン v' + info.version + ' があります' + msg;
    const reload = document.createElement('button');
    reload.textContent = '今すぐ更新';
    reload.style.cssText = 'position:absolute;right:44px;top:50%;transform:translateY(-50%);background:#fff;color:#1D4ED8;border:none;border-radius:4px;font-size:12px;font-weight:700;padding:3px 8px;cursor:pointer';
    reload.title = '拡張を再読み込みして最新版を取り込みます';
    reload.addEventListener('click', () => { try { chrome.runtime.reload(); } catch (e) { location.reload(); } });
    const x = document.createElement('button');
    x.textContent = '×';
    x.style.cssText = 'position:absolute;right:12px;top:50%;transform:translateY(-50%);background:transparent;border:none;color:#fff;font-size:18px;font-weight:700;cursor:pointer';
    x.addEventListener('click', () => { bar.remove(); if (onDismiss) onDismiss(); });
    bar.appendChild(reload); bar.appendChild(x);
    document.body.appendChild(bar);
  }
  function hideBanner() { const b = document.getElementById(BANNER_ID); if (b) b.remove(); }

  async function check() {
    if (!enabled) { hideBanner(); return; }
    const r = await getLocal(['OKURURU_SHIWAKE_update_info', 'OKURURU_SHIWAKE_update_dismissed_v']);
    const info = r.OKURURU_SHIWAKE_update_info;
    if (!info || !info.version) return;
    if (!semverLt(curVersion(), info.version)) { hideBanner(); return; } // 新版でない
    if (r.OKURURU_SHIWAKE_update_dismissed_v === info.version) return; // この版は閉じた
    showBanner(info, () => setLocal({ OKURURU_SHIWAKE_update_dismissed_v: info.version }));
  }

  async function init() {
    enabled = await window.OKURURU.utils.storage.isFeatureEnabled(FEATURE_KEY);
    if (!enabled) { hideBanner(); return; }
    check();
    if (!timer) timer = setInterval(check, 60000);
  }

  window.OKURURU.features.s7_updateNotifier = {
    init, check, FEATURE_KEY,
    isEnabled: () => enabled,
    setEnabled: (v) => { enabled = v; if (!v) hideBanner(); else check(); }
  };
})();
