/**
 * content/s4_itcode_print.js
 *
 * S4：ITコードラベル印刷（個別＋一括）— 既存 F79 方式（実機確定 2026-06-15）
 *  - ITコード=在庫ラベル。印刷は各行の「ラベル印刷」dropdown-item を click。
 *  - 買取確定(STOCKED)後のみ印刷可。
 *  - 個別=その行を1回／一括=📌ITコードマーク行を500ms間隔で順次。確認+ESC中止。
 *  - 個別印刷ボタンは商品名の上のマークバーに置く。
 */
(function () {
  'use strict';
  if (!window.OKURURU) window.OKURURU = {};
  if (!window.OKURURU.features) window.OKURURU.features = {};

  const FEATURE_KEY = 's4_itCodePrint';
  const BULK_BTN_ID = 'shiwake-s4-bulk-print';
  const ROW_BTN_CLASS = 'shiwake-s4-row-print';
  const ITCODE_BADGE_CLASS = 'shiwake-itcode-badge';
  const PRINT_INTERVAL_MS = 500;
  let enabled = true;
  let pollTimer = null;
  let printing = false;
  let cancelRequested = false;

  function isCaseDetailPage() { return /\/(bad\/)?case\/\d+/.test(location.pathname); }

  function isStockedOrAfter() {
    try {
      const api = window.OKURURU && window.OKURURU.utils && window.OKURURU.utils.recoreApi;
      if (api && typeof api.getCaseBody === 'function') {
        const body = api.getCaseBody();
        if (body && body.status) return /^(STOCKED|PAID|SHIPPED|DELIVERED|COMPLETED|FINISHED|RECEIVED)/.test(String(body.status).toUpperCase());
      }
    } catch (e) { /* noop */ }
    try { if (/買取完了|入庫済|支払済|発送済/.test(document.body.textContent || '')) return true; } catch (e) { /* noop */ }
    return false;
  }

  function findCustomerUrlBtn() {
    const btns = document.querySelectorAll('button.btn-block, button');
    for (const b of btns) { if (/お客様用ページ.*URL|URL.*取得/.test((b.textContent || '').trim())) return b; }
    return null;
  }

  function findRowLabelPrintItem(fromEl) {
    let row = fromEl;
    for (let i = 0; i < 16 && row; i++) {
      if (row.querySelector) {
        const items = row.querySelectorAll('a.dropdown-item, button');
        for (const it of items) {
          const t = (it.textContent || '').trim();
          if (/ラベル印刷/.test(t) && !/ケース/.test(t) && !/一括/.test(t)) return it;
        }
      }
      row = row.parentElement;
    }
    return null;
  }

  function collectPrintTargets() {
    const targets = [];
    document.querySelectorAll('.' + ITCODE_BADGE_CLASS).forEach((badge) => {
      const item = findRowLabelPrintItem(badge);
      if (item && targets.indexOf(item) === -1) targets.push(item);
    });
    return targets;
  }
  function countMarked() { return document.querySelectorAll('.' + ITCODE_BADGE_CLASS).length; }

  function showToast(msg, color) {
    let t = document.getElementById('shiwake-s4-toast');
    if (!t) { t = document.createElement('div'); t.id = 'shiwake-s4-toast'; t.style.cssText = 'position:fixed;top:80px;right:24px;z-index:100100;background:#fff;border:2px solid #2563EB;border-radius:8px;padding:10px 14px;font-size:13px;font-weight:700;box-shadow:0 4px 12px rgba(0,0,0,0.2);max-width:320px'; document.body.appendChild(t); }
    t.style.borderColor = color || '#2563EB'; t.style.color = color || '#1E3A8A'; t.textContent = msg;
  }
  function hideToast() { const t = document.getElementById('shiwake-s4-toast'); if (t && t.parentElement) t.parentElement.removeChild(t); }

  async function printTargets(targets, label) {
    printing = true; cancelRequested = false;
    const onKey = (ev) => { if (ev.key === 'Escape') cancelRequested = true; };
    document.addEventListener('keydown', onKey, true);
    let i = 0; const total = targets.length;
    for (const target of targets) {
      if (cancelRequested) { showToast('⏹ 中止：' + i + '/' + total + ' 印刷済', '#E68A00'); break; }
      i++; showToast('🖨 ' + label + ' ' + i + '/' + total + ' ...（ESCで中止）', '#2563EB');
      try { target.click(); } catch (e) { /* noop */ }
      if (i < total) await new Promise(r => setTimeout(r, PRINT_INTERVAL_MS));
    }
    if (!cancelRequested) showToast('✅ 完了：' + total + ' 件のITコードを印刷指示しました', '#059669');
    setTimeout(hideToast, 4000);
    document.removeEventListener('keydown', onKey, true); printing = false;
  }

  async function printOne(fromEl) {
    if (printing) return;
    if (!isStockedOrAfter()) { alert('⏳ 買取確定(STOCKED)以降ではないため、ITコードはまだ印刷できません。'); return; }
    const item = findRowLabelPrintItem(fromEl);
    if (!item) { alert('この行の「ラベル印刷」が見つかりませんでした。行メニュー（⋮）を確認してください。'); return; }
    await printTargets([item], '個別印刷');
  }

  async function bulkPrint() {
    if (printing) return;
    if (!isStockedOrAfter()) { alert('⏳ 買取確定(STOCKED)以降ではないため、ITコードはまだ印刷できません。'); return; }
    const targets = collectPrintTargets();
    if (targets.length === 0) { alert('印刷対象が見つかりませんでした。📌ITコードマーク行＋その行に「ラベル印刷」が必要です。'); return; }
    const ok = confirm('🖨 ITコード一括印刷\n\n' + targets.length + ' 件を順次プリンタへ送ります。\n（約 ' + (PRINT_INTERVAL_MS * targets.length / 1000).toFixed(1) + ' 秒・ESCで中止可）\n\n実行しますか？');
    if (!ok) return;
    await printTargets(targets, '印刷中');
  }

  // 個別印刷ボタンを商品名の上のマークバー（ITコードバッジの隣）に置く
  function decorateRow(row, strong) {
    if (!enabled || !row || !strong) return;
    const bar = window.OKURURU.shiwake.rows.getExistingMarkBar(strong);
    if (!bar) return;
    const badge = bar.querySelector('.' + ITCODE_BADGE_CLASS);
    const existingBtn = bar.querySelector('.' + ROW_BTN_CLASS);
    if (!badge) { if (existingBtn) existingBtn.remove(); return; }
    if (existingBtn) return;
    const btn = document.createElement('button');
    btn.type = 'button'; btn.className = ROW_BTN_CLASS; btn.textContent = '🖨 個別印刷';
    btn.style.cssText = 'padding:1px 7px;background:#fff;color:#1D4ED8;border:1px solid #2563EB;border-radius:3px;font-size:11px;font-weight:700;cursor:pointer;white-space:nowrap';
    btn.title = 'この行のITコード(在庫ラベル)を1枚印刷。買取確定後のみ。';
    btn.addEventListener('click', (ev) => { ev.preventDefault(); ev.stopPropagation(); printOne(badge); });
    bar.appendChild(btn);
  }

  function ensureBulkButton() {
    if (!enabled || !isCaseDetailPage()) { const old = document.getElementById(BULK_BTN_ID); if (old && old.parentElement) old.parentElement.removeChild(old); return; }
    const total = countMarked();
    const canPrint = isStockedOrAfter();
    const anchor = findCustomerUrlBtn();
    if (!anchor) return;
    const disabled = (total === 0) || !canPrint;
    let btn = document.getElementById(BULK_BTN_ID);
    if (!btn) {
      btn = document.createElement('button'); btn.id = BULK_BTN_ID; btn.type = 'button'; btn.className = 'btn btn-block';
      btn.style.cssText = 'background:#2563EB;color:#fff;border:none;margin-top:6px;font-weight:700';
      btn.addEventListener('click', (ev) => { ev.preventDefault(); ev.stopPropagation(); if (!btn.disabled) bulkPrint(); });
      if (anchor.parentElement) anchor.parentElement.insertBefore(btn, anchor.nextSibling);
    }
    btn.innerHTML = '🖨 ITコード一括印刷（' + total + ' 枚）';
    btn.disabled = disabled; btn.style.opacity = disabled ? '0.55' : '1'; btn.style.cursor = disabled ? 'not-allowed' : 'pointer';
    btn.title = !canPrint ? '買取確定(STOCKED)後に印刷できます' : (total === 0 ? '📌ITコードマーク行がありません' : total + ' 件を順次印刷します');
  }

  function removeAll() {
    const b = document.getElementById(BULK_BTN_ID); if (b && b.parentElement) b.parentElement.removeChild(b);
    document.querySelectorAll('.' + ROW_BTN_CLASS).forEach((e) => e.remove());
  }
  function startPoll() { if (pollTimer) return; ensureBulkButton(); pollTimer = setInterval(ensureBulkButton, 1500); }

  async function init() {
    enabled = await window.OKURURU.utils.storage.isFeatureEnabled(FEATURE_KEY);
    if (enabled) startPoll(); else removeAll();
  }

  window.OKURURU.features.s4_itCodePrint = {
    init, decorateRow, ensureBulkButton, removeAll, FEATURE_KEY,
    isEnabled: () => enabled, setEnabled: (v) => { enabled = v; if (v) startPoll(); else removeAll(); }
  };
})();
