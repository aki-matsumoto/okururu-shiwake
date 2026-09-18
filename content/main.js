/**
 * content/main.js — 仕分け支援拡張 オーケストレーター
 *  - s1卸/リコア・s2デパコス/禁止・s3ITコード・s4印刷ボタンを商品名上のマークバーに集約
 *  - s5被り警告・s6項目非表示 を初期化
 *  - MutationObserver + scroll ガード + throttle、/bad/case/<id> で稼働
 */
(function () {
  'use strict';
  if (window.OKURURU_SHIWAKE_MAIN_loaded) return;
  window.OKURURU_SHIWAKE_MAIN_loaded = true;
  if (!window.OKURURU) window.OKURURU = {};

  const F = () => window.OKURURU.features || {};
  const rowsUtil = () => window.OKURURU.shiwake && window.OKURURU.shiwake.rows;

  // 同一商品ごとの数量合算マップ。s8「卸タグ(買取¥50以上・同一商品5個以上)」判定に使う。
  //  2026-09-18 現場FB：グレード違いでカタログ(PDコード)が分かれても、同名商品は同一商品として
  //   数量を合算して数える（PDコード単位の行数では5個に届かないケースがあったため）。
  //  キー＝正規化した商品名（先頭ノイズ記号・□■・空白を除去して大文字化）。値＝数量(買取点数)の合計。
  const _NAME_LEAD_RE = /^[\s　●○◎◆◇★☆♪♬※‼!・･「」『』【】〔〕（）()\[\]<>＜＞|｜~～\-—–□■]+/;
  let _prodQty = {};
  function productKeyOf(row, strong) {
    try {
      let name = '';
      if (strong && strong.textContent) name = strong.textContent;
      else { try { name = window.OKURURU.utils.detector.extractRowProductName(row) || ''; } catch (e) { name = ''; } }
      name = String(name).replace(_NAME_LEAD_RE, '').replace(/[\s　]+/g, '').toUpperCase();
      return name.length >= 2 ? name : null;
    } catch (e) { return null; }
  }
  function rowQty(row) {
    try { const n = window.OKURURU.utils.detector.extractRowQuantity(row); return (typeof n === 'number' && n > 0) ? n : 1; }
    catch (e) { return 1; }
  }
  // 同一商品（同名）の数量合計を返す。s8/s3 から参照。
  function sameProductQty(row, strong) {
    const k = productKeyOf(row, strong);
    return k ? (_prodQty[k] || 0) : 0;
  }

  function evaluateAll() {
    const ru = rowsUtil();
    if (!ru || !ru.isCaseDetailPage()) return;
    if (ru.isScrolling()) return;
    const u = window.OKURURU.utils;
    if (!u || !u.selectors || typeof u.selectors.findAssessmentRows !== 'function') return;
    let rows;
    try { rows = u.selectors.findAssessmentRows() || []; } catch (e) { return; }
    // 同一商品の数量合計を先に集計（商品名単位・数量合算。カタログ分割/グレード違いをまとめる）
    _prodQty = {};
    for (const row of rows) {
      let s = null;
      try { s = ru.findProductNameStrong(row); } catch (e) { /* noop */ }
      const k = productKeyOf(row, s);
      if (k) _prodQty[k] = (_prodQty[k] || 0) + rowQty(row);
    }
    const feat = F();
    for (const row of rows) {
      let strong = null;
      try { strong = ru.findProductNameStrong(row); } catch (e) { /* noop */ }
      if (!strong) continue;
      try { if (feat.s1_oroshiRecoreMark) feat.s1_oroshiRecoreMark.markRow(row, strong); } catch (e) {}
      try { if (feat.s2_brandMark) feat.s2_brandMark.markRow(row, strong); } catch (e) {}
      try { if (feat.s3_itCodeMark) feat.s3_itCodeMark.markRow(row, strong); } catch (e) {}
      try { if (feat.s8_wgaMark) feat.s8_wgaMark.markRow(row, strong); } catch (e) {}
      try { if (feat.s9_priceCheck) feat.s9_priceCheck.markRow(row, strong); } catch (e) {}
      try { if (feat.s4_itCodePrint) feat.s4_itCodePrint.decorateRow(row, strong); } catch (e) {}
    }
    try { if (feat.s4_itCodePrint) feat.s4_itCodePrint.ensureBulkButton(); } catch (e) {}
    try { if (feat.s9_priceCheck) feat.s9_priceCheck.ensureFloatButton(); } catch (e) {}
    // 空のマークバーを掃除
    try { document.querySelectorAll('.shiwake-markbar').forEach((b) => { if (!b.children.length) b.remove(); }); } catch (e) {}
  }

  let pending = false;
  function scheduleEvaluate() {
    if (pending) return;
    pending = true;
    setTimeout(() => { pending = false; evaluateAll(); }, 500);
  }

  function startObserver() {
    try { new MutationObserver(scheduleEvaluate).observe(document.body, { childList: true, subtree: true }); } catch (e) { /* noop */ }
    document.addEventListener('input', scheduleEvaluate, true);
    document.addEventListener('change', scheduleEvaluate, true);
    window.addEventListener('popstate', scheduleEvaluate);
  }

  async function init() {
    const feat = F();
    const inits = [];
    ['s1_oroshiRecoreMark', 's2_brandMark', 's3_itCodeMark', 's4_itCodePrint', 's5_conflictWarn', 's6_hideFields', 's7_updateNotifier', 's8_wgaMark', 's9_priceCheck'].forEach((k) => {
      if (feat[k] && typeof feat[k].init === 'function') inits.push(feat[k].init());
    });
    try { await Promise.all(inits); } catch (e) { /* noop */ }
    evaluateAll();
    startObserver();
  }

  function boot() {
    if (window.OKURURU && window.OKURURU.utils && window.OKURURU.utils.storage) init();
    else setTimeout(boot, 300);
  }
  boot();

  window.OKURURU.shiwake = window.OKURURU.shiwake || {};
  window.OKURURU.shiwake.evaluateAll = evaluateAll;
  window.OKURURU.shiwake.sameProductQty = sameProductQty;
})();
