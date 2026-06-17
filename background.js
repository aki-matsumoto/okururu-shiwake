/**
 * background.js (MV3 service worker) — 仕分け支援拡張 アップデート通知
 *
 *  - release/latest.json を 30 分ごとに fetch（chrome.alarms）
 *  - 最新版情報を storage(OKURURU_SHIWAKE_update_info) に保存 → content の通知バナー(s7)が表示
 *  - "force_min_version" 未満なら自動 chrome.runtime.reload()（全PC確実更新）
 *
 *  ※ VERSION_FEED_URL の GitHub リポジトリは配布整備時に作成すること。
 */
const VERSION_FEED_URL = 'https://raw.githubusercontent.com/aki-matsumoto/okururu-shiwake/main/release/latest.json';
const ALARM = 'shiwake-version-check';

function parseSemver(v) { return String(v || '0.0.0').split('.').map((x) => parseInt(x, 10) || 0); }
function semverLt(a, b) {
  const pa = parseSemver(a), pb = parseSemver(b);
  for (let i = 0; i < 3; i++) { if ((pa[i] || 0) < (pb[i] || 0)) return true; if ((pa[i] || 0) > (pb[i] || 0)) return false; }
  return false;
}

async function checkForUpdate() {
  try {
    const resp = await fetch(VERSION_FEED_URL, { method: 'GET', credentials: 'omit', cache: 'no-cache' });
    if (!resp.ok) throw new Error('HTTP ' + resp.status);
    const info = await resp.json();
    if (!info || !info.version) throw new Error('no version field');
    await chrome.storage.local.set({ OKURURU_SHIWAKE_update_info: Object.assign({}, info, { fetched_at: new Date().toISOString() }) });
    console.info('[SHIWAKE] update check: latest=v' + info.version);
    if (info.force_min_version) {
      const cur = chrome.runtime.getManifest().version;
      if (semverLt(cur, info.force_min_version)) {
        console.warn('[SHIWAKE] FORCE RELOAD v' + cur + ' < v' + info.force_min_version);
        setTimeout(() => { try { chrome.runtime.reload(); } catch (e) { /* noop */ } }, 5000);
      }
    }
  } catch (e) { console.warn('[SHIWAKE] update check failed:', e && e.message || e); }
}

function registerAlarm() { try { chrome.alarms.create(ALARM, { periodInMinutes: 30 }); } catch (e) { /* noop */ } }

chrome.runtime.onInstalled.addListener(async (details) => {
  try {
    // 既定の機能ON（未設定キーのみ）
    const cur = await chrome.storage.local.get('OKURURU_features');
    const f = (cur && cur.OKURURU_features) || {};
    ['s1_oroshiRecoreMark','s2_brandMark','s3_itCodeMark','s4_itCodePrint','s5_conflictWarn','s6_hideFields','s7_updateNotifier'].forEach((k) => { if (f[k] === undefined) f[k] = true; });
    await chrome.storage.local.set({ OKURURU_features: f });
    if (details.reason === 'update') { try { await chrome.storage.local.remove('OKURURU_SHIWAKE_update_dismissed_v'); } catch (e) { /* noop */ } }
    registerAlarm(); checkForUpdate();
  } catch (e) { console.warn('[SHIWAKE] onInstalled error:', e); }
});
chrome.runtime.onStartup.addListener(() => { registerAlarm(); checkForUpdate(); });
chrome.alarms.onAlarm.addListener((a) => { if (a && a.name === ALARM) checkForUpdate(); });
chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (msg && msg.type === 'SHIWAKE_GET_VERSION') { sendResponse({ ok: true, version: chrome.runtime.getManifest().version }); return false; }
  if (msg && msg.type === 'SHIWAKE_CHECK_UPDATE') { checkForUpdate().then(() => sendResponse({ ok: true })); return true; }
  return false;
});
