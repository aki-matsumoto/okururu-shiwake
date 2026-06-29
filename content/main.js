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

  function evaluateAll() {
    const ru = rowsUtil();
    if (!ru || !ru.isCaseDetailPage()) return;
    if (ru.isScrolling()) return;
    const u = window.OKURURU.utils;
    if (!u || !u.selectors || typeof u.selectors.findAssessmentRows !== 'function') return;
    let rows;
    try { rows = u.selectors.findAssessmentRows() || []; } catch (e) { return; }
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
})();
