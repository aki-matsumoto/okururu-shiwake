/**
 * background.js (MV3 service worker) — 仕分け支援拡張 自動更新
 *
 * v0.8.2: GitHub raw（release/latest.json）の取得をやめ、ディスク上の manifest.json を見る方式に変更。
 *
 * なぜ変えたか：
 *   リポジトリを非公開にすると raw.githubusercontent.com は認証なしで必ず 404 になり、
 *   旧 checkForUpdate() は毎回失敗して握りつぶされ、force_min_version による自動リロードが止まる
 *   （査定支援拡張 okuruuru-mistake-prevention v1.79.54 で実測済みの同じ症状）。
 *
 * 仕組み（okuruuru-mistake-prevention の checkDiskVersionAndReload を移植）：
 *   「パッケージ化されていない拡張」のリソースはその都度ディスクから読まれるので、
 *   共有フォルダに置かれた新しい manifest.json を chrome.runtime.getURL() で読める。
 *   一方 chrome.runtime.getManifest().version は読み込み時点の版を返す。
 *   ディスク版の方が新しければ＝新しいファイルが届いている＝chrome.runtime.reload() する。
 *   ネットワークに一切依存しない。30 分ごとのアラーム・ブラウザ起動時・インストール/更新時に走る。
 *
 * 旧 force_min_version（latest.json で指定した版未満を強制リロード）の代わり：
 *   ディスク版 > 読み込み版 なら常にリロードするので、「共有フォルダを新版に差し替える」こと自体が
 *   全PC強制更新の合図になる（最長 30 分以内、または Chrome 起動時）。
 */
const ALARM = 'shiwake-version-check';

function parseSemver(v) { return String(v || '0.0.0').split('.').map((x) => parseInt(x, 10) || 0); }
function semverLt(a, b) {
  const pa = parseSemver(a), pb = parseSemver(b);
  for (let i = 0; i < 3; i++) { if ((pa[i] || 0) < (pb[i] || 0)) return true; if ((pa[i] || 0) > (pb[i] || 0)) return false; }
  return false;
}

async function checkDiskVersionAndReload() {
  try {
    const loaded = chrome.runtime.getManifest().version;
    const resp = await fetch(chrome.runtime.getURL('manifest.json'), { cache: 'no-store' });
    if (!resp.ok) return;
    const onDisk = ((await resp.json()) || {}).version;
    if (!onDisk || onDisk === loaded) return;
    if (semverLt(loaded, onDisk)) {
      console.warn('[SHIWAKE] DISK RELOAD: loaded=v' + loaded + ' < disk=v' + onDisk + ' → reloading in 5s');
      setTimeout(() => {
        try { chrome.runtime.reload(); } catch (e) { console.warn('[SHIWAKE] chrome.runtime.reload() failed:', e); }
      }, 5000);
    }
  } catch (e) { console.warn('[SHIWAKE] disk version check failed:', e && e.message || e); }
}

// 呼び出し側（onInstalled / onStartup / alarm / popup の SHIWAKE_CHECK_UPDATE）の互換のため名前を残す
async function checkForUpdate() { await checkDiskVersionAndReload(); }

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
