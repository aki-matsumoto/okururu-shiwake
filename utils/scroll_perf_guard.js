/**
 * utils/scroll_perf_guard.js (v1.71.5 / 2026-05-21)
 *
 * スクロール中に画面に常時表示されている拡張機能の DOM 群を
 * 一時的に visibility:hidden にして、ReCORE 本体の重い rendering と
 * 拡張 DOM の rendering が二重に走るのを防ぐ。
 *
 *  実測（2026-05-21 Chrome MCP 計測 case 89502 で実施）：
 *    ガイドモード ON  : LoAF 47 個・worst 1015ms・longtaskTotal 2958ms
 *    ガイドモード OFF : LoAF 2 個・worst 71ms・longtaskTotal 242ms
 *    （ガイドモード OFF で F18/F3-A/F21 が消えただけで 12 倍改善）
 *
 *  仕組み：
 *    - scroll start で `<html data-okururu-scrolling="1">` を立てる
 *    - styles/extension.css の `html[data-okururu-scrolling="1"] #okururu-...`
 *      ルールで対象要素を visibility:hidden に
 *    - scroll end 検知（150ms debounce）で属性を削除 → 元通り表示
 *    - capture:true / passive:true で listener オーバーヘッドゼロ
 *
 *  対象（F14 操作ガイドパネルは含めない — ユーザー操作中の可能性大）：
 *    - #okururu-f18-modal-overlay  (F18 査定ガイド モーダルオーバーレイ)
 *    - #okururu-badge-f3a         (F3-A 申込書チェック バッジ)
 *    - #okururu-f3a-reopen        (F3-A 申込書チェック 再表示青◯)
 *    - #okururu-badge-f21         (F21 当日件数 バッジ)
 *    - #okururu-f21-reopen        (F21 当日件数 再表示緑◯)
 *
 *  注意：
 *    - visibility:hidden は layout には残るので reflow には影響しない
 *      （opacity:0 や display:none よりも安全）
 *    - スクロール終了時に瞬時に元に戻るので、ユーザーは点滅程度しか感じない
 */
(function () {
  'use strict';
  if (window.OKURURU_SCROLL_GUARD_loaded) return;
  window.OKURURU_SCROLL_GUARD_loaded = true;

  const ATTR = 'data-okururu-scrolling';
  const SCROLL_END_DELAY_MS = 150;

  let scrolling = false;
  let endTimer = null;

  function start() {
    if (scrolling) return;
    scrolling = true;
    try { document.documentElement.setAttribute(ATTR, '1'); } catch (e) { /* noop */ }
  }

  function end() {
    if (!scrolling) return;
    scrolling = false;
    try { document.documentElement.removeAttribute(ATTR); } catch (e) { /* noop */ }
  }

  function onScroll() {
    if (!scrolling) start();
    if (endTimer) clearTimeout(endTimer);
    endTimer = setTimeout(end, SCROLL_END_DELAY_MS);
  }

  try {
    // capture:true で document の真下の scroll を全部拾う（要素別 scroll も対応）
    window.addEventListener('scroll', onScroll, { capture: true, passive: true });
    window.addEventListener('wheel', onScroll, { capture: true, passive: true });
    window.addEventListener('touchmove', onScroll, { capture: true, passive: true });
  } catch (e) {
    // フォールバック：旧 API
    try {
      window.addEventListener('scroll', onScroll, true);
    } catch (e2) { /* noop */ }
  }
})();
