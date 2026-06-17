/**
 * content/s4_itcode_print.js
 *
 * S4：ITコード（在庫ラベル）印刷
 *
 *  実機＋ReCOREヘルプ確認（2026-06-17）で確定:
 *   - ITコード = 在庫コード（在庫ラベル）。PDコード = カタログ（商品マスタ）で別物。
 *   - ケース詳細画面では、ITコード印刷は page-level の「在庫ラベルを印刷する」ボタンのみ。
 *     行ごとの個別印刷UIは ReCORE 側に存在しない（個別は在庫リスト/在庫詳細画面）。
 *   - 旧実装（行の「ラベル印刷」dropdown を click）は対象が無く失敗していた。本版で是正。
 *
 *  動作:
 *   - 一括ボタン / 行の個別ボタン とも、ReCORE 標準の「在庫ラベルを印刷する」を実行（確認モーダル付き）。
 *     ＝ケース内の在庫ラベル（ITコード）がまとめて出力される。
 *   - 「在庫ラベルを印刷する」は買取確定後（在庫=ITコード生成後）にのみ表示されるため、その有無で可否判定。
 */
(function () {
  'use strict';
  if (!window.OKURURU) window.OKURURU = {};
  if (!window.OKURURU.features) window.OKURURU.features = {};

  const FEATURE_KEY = 's4_itCodePrint';
  const BULK_BTN_ID = 'shiwake-s4-bulk-print';
  const ROW_BTN_CLASS = 'shiwake-s4-row-print';
  const ITCODE_BADGE_CLASS = 'shiwake-itcode-badge';
  let enabled = true;
  let pollTimer = null;
  let printing = false;

  function isCaseDetailPage() { return /\/(bad\/)?case\/\d+/.test(location.pathname); }

  function findStockLabelBtn() {
    const btns = document.querySelectorAll('button');
    for (const b of btns) {
      const t = (b.textContent || '').trim();
      if (/在庫ラベルを印刷する/.test(t) && !/一括/.test(t)) return b;
    }
    return null;
  }

  function findCustomerUrlBtn() {
    const btns = document.querySelectorAll('button.btn-block, button');
    for (const b of btns) { if (/お客様用ページ.*URL|URL.*取得/.test((b.textContent || '').trim())) return b; }
    return null;
  }

  function countMarked() { return document.querySelectorAll('.' + ITCODE_BADGE_CLASS).length; }

  function showToast(msg, color) {
    let t = document.getElementById('shiwake-s4-toast');
    if (!t) { t = document.createElement('div'); t.id = 'shiwake-s4-toast'; t.style.cssText = 'position:fixed;top:80px;right:24px;z-index:100100;background:#fff;border:2px solid #2563EB;border-radius:8px;padding:10px 14px;font-size:13px;font-weight:700;box-shadow:0 4px 12px rgba(0,0,0,0.2);max-width:320px'; document.body.appendChild(t); }
    t.style.borderColor = color || '#2563EB'; t.style.color = color || '#1E3A8A'; t.textContent = msg;
  }
  function hideToast() { const t = document.getElementById('shiwake-s4-toast'); if (t && t.parentElement) t.parentElement.removeChild(t); }

  function printStockLabels() {
    if (printing) return;
    const btn = findStockLabelBtn();
    if (!btn) {
      alert('「在庫ラベルを印刷する」ボタンが見つかりません。\nITコード（在庫ラベル）は買取確定後に生成され、確定後に印刷できます。');
      return;
    }
    const ok = confirm('🖨 ITコード（在庫ラベル）印刷\n\nReCORE標準の「在庫ラベルを印刷する」を実行します。\n（このケースの在庫ラベルがまとめて出力されます）\n\n実行しますか？');
    if (!ok) return;
    printing = true;
    showToast('🖨 在庫ラベル印刷を実行しました', '#059669');
    try { btn.click(); } catch (e) { /* noop */ }
    setTimeout(hideToast, 4000);
    setTimeout(function () { printing = false; }, 1000);
  }

  function decorateRow(row, strong) {
    if (!enabled || !row || !strong) return;
    const bar = window.OKURURU.shiwake.rows.getExistingMarkBar(strong);
    if (!bar) return;
    const badge = bar.querySelector('.' + ITCODE_BADGE_CLASS);
    const existingBtn = bar.querySelector('.' + ROW_BTN_CLASS);
    if (!badge) { if (existingBtn) existingBtn.remove(); return; }
    if (existingBtn) return;
    const btn = document.createElement('button');
    btn.type = 'button'; btn.className = ROW_BTN_CLASS; btn.textContent = '🖨 在庫ラベル印刷';
    btn.style.cssText = 'padding:1px 7px;background:#fff;color:#1D4ED8;border:1px solid #2563EB;border-radius:3px;font-size:11px;font-weight:700;cursor:pointer;white-space:nowrap';
    btn.title = 'ReCOREの「在庫ラベルを印刷する」を実行（この画面ではケース単位でまとめて出力）。買取確定後のみ。';
    btn.addEventListener('click', function (ev) { ev.preventDefault(); ev.stopPropagation(); printStockLabels(); });
    bar.appendChild(btn);
  }

  function ensureBulkButton() {
    if (!enabled || !isCaseDetailPage()) { const old = document.getElementById(BULK_BTN_ID); if (old && old.parentElement) old.parentElement.removeChild(old); return; }
    const anchor = findCustomerUrlBtn();
    if (!anchor) return;
    const canPrint = !!findStockLabelBtn();
    const marked = countMarked();
    let btn = document.getElementById(BULK_BTN_ID);
    if (!btn) {
      btn = document.createElement('button'); btn.id = BULK_BTN_ID; btn.type = 'button'; btn.className = 'btn btn-block';
      btn.style.cssText = 'background:#2563EB;color:#fff;border:none;margin-top:6px;font-weight:700';
      btn.addEventListener('click', function (ev) { ev.preventDefault(); ev.stopPropagation(); if (!btn.disabled) printStockLabels(); });
      if (anchor.parentElement) anchor.parentElement.insertBefore(btn, anchor.nextSibling);
    }
    btn.innerHTML = '🖨 ITコード（在庫ラベル）印刷' + (marked ? '（対象 ' + marked + ' 行）' : '');
    btn.disabled = !canPrint;
    btn.style.opacity = canPrint ? '1' : '0.55';
    btn.style.cursor = canPrint ? 'pointer' : 'not-allowed';
    btn.title = canPrint ? 'ReCOREの「在庫ラベルを印刷する」を実行（ケース内の在庫ラベルをまとめて出力）' : '買取確定後（在庫=ITコード生成後）に印刷できます';
  }

  function removeAll() {
    const b = document.getElementById(BULK_BTN_ID); if (b && b.parentElement) b.parentElement.removeChild(b);
    document.querySelectorAll('.' + ROW_BTN_CLASS).forEach(function (e) { e.remove(); });
  }
  function startPoll() { if (pollTimer) return; ensureBulkButton(); pollTimer = setInterval(ensureBulkButton, 1500); }

  async function init() {
    enabled = await window.OKURURU.utils.storage.isFeatureEnabled(FEATURE_KEY);
    if (enabled) startPoll(); else removeAll();
  }

  window.OKURURU.features.s4_itCodePrint = {
    init, decorateRow, ensureBulkButton, removeAll, FEATURE_KEY,
    isEnabled: function () { return enabled; }, setEnabled: function (v) { enabled = v; if (v) startPoll(); else removeAll(); }
  };
})();
