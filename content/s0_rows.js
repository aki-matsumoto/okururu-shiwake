/**
 * content/s0_rows.js
 *
 * 仕分け拡張 共通：査定行の商品名 strong 検出／マークバー（商品名の上）／scrollガード。
 * 既存拡張 F7/F73 の isLikelyProductName / findAssessmentRows パターンを流用。
 */
(function () {
  'use strict';
  if (!window.OKURURU) window.OKURURU = {};
  if (!window.OKURURU.shiwake) window.OKURURU.shiwake = {};

  const SKIP_PREFIX = /^(買取|販売|単価|点数|数量|個数|グレード|コンディション|店舗|担当|ステータス|要対応|顧客|本人確認|集荷|タイムライン|アンケート|銀行|住所|氏名|電話|メール|会社|発送|返送|ケース|案件|備考|参考|他店|商品コード|商品メモ|ITコード|JAN|ポイント|小計|合計|割引|送料|手数料|キャンセル|返品|注意|履歴|フィルタ|並び|表示|有効|棚番号|在庫属性)/;

  function isLikelyProductName(strongEl) {
    try {
      if (!strongEl || strongEl.children.length > 0) return false;
      if (!strongEl.offsetParent) return false;
      let txt = (strongEl.textContent || '').trim();
      const body = txt.replace(/^[\s　]*[□■◇◆]+[\s　]*/, '');
      if (!body || body.length < 2 || body.length > 250) return false;
      if (SKIP_PREFIX.test(body)) return false;
      if (/^[0-9¥￥,.\s%／/-]+$/.test(body)) return false;
      const parent = strongEl.parentElement;
      if (parent && /text-truncate/.test((parent.className || '').toString())) return true;
      return false;
    } catch (e) { return false; }
  }

  function findProductNameStrong(row) {
    try {
      const strongs = row.querySelectorAll('strong');
      for (const s of strongs) { if (isLikelyProductName(s)) return s; }
    } catch (e) { /* noop */ }
    return null;
  }

  /**
   * マークバー：商品名の「上」に全マーク／ボタンをまとめて置く帯。
   * 商品名の line（.d-flex.line-height-sm）の直前に1つだけ生成し、各機能はここに append する。
   */
  function getMarkBar(strong) {
    if (!strong) return null;
    const line = strong.closest('.d-flex.line-height-sm') || strong.parentElement;
    if (!line || !line.parentElement) return null;
    const prev = line.previousElementSibling;
    if (prev && prev.classList && prev.classList.contains('shiwake-markbar')) return prev;
    const bar = document.createElement('div');
    bar.className = 'shiwake-markbar';
    bar.style.cssText = 'display:flex;flex-wrap:wrap;align-items:center;gap:4px;margin:0 0 3px 0;line-height:1.6;';
    line.parentElement.insertBefore(bar, line);
    return bar;
  }

  // scroll ガード
  let _scrolling = false;
  let _idleTimer = null;
  function markScroll() {
    _scrolling = true;
    if (_idleTimer) clearTimeout(_idleTimer);
    _idleTimer = setTimeout(() => { _scrolling = false; }, 450);
  }
  try {
    window.addEventListener('scroll', markScroll, { passive: true, capture: true });
    window.addEventListener('wheel', markScroll, { passive: true, capture: true });
    window.addEventListener('touchmove', markScroll, { passive: true, capture: true });
  } catch (e) { /* noop */ }

  function getExistingMarkBar(strong) {
    if (!strong) return null;
    const line = strong.closest('.d-flex.line-height-sm') || strong.parentElement;
    if (!line) return null;
    const prev = line.previousElementSibling;
    return (prev && prev.classList && prev.classList.contains('shiwake-markbar')) ? prev : null;
  }

  function isCaseDetailPage() { return /\/(bad\/)?case\/\d+/.test(location.pathname); }

  window.OKURURU.shiwake.rows = { isLikelyProductName, findProductNameStrong, getMarkBar, getExistingMarkBar, isScrolling: () => _scrolling, isCaseDetailPage };
})();
