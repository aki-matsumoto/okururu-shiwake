/**
 * content/s8_wga_mark.js
 *
 * S8：WGAマーク ／ まとめ待ちマーク（クロさん 2026-06-15 確定）
 *
 *  前提：卸(□)・リコア(■)・デパコス のどのマークも無い「未振り分け」商品のみ対象。
 *
 *  WGA（グレー）:
 *    (a) 販売単価 ¥1 または 未入力（空）、または
 *    (b) 販売単価 1500〜3999円 かつ グレードが 中古B・中古C
 *  まとめ待ち（ティール）:
 *    販売単価 1500〜3999円 かつ グレードが 未開封・未使用・開封未使用・中古A
 *
 *  ※ 買取不可グレードは対象外。ITコード/メルカリ禁止の有無は条件に含めない。
 *  main.js で s1/s2/s3 の後に呼ぶこと。
 */
(function () {
  'use strict';
  if (!window.OKURURU) window.OKURURU = {};
  if (!window.OKURURU.features) window.OKURURU.features = {};

  const FEATURE_KEY = 's8_wgaMark';
  const WGA_CLASS = 'shiwake-wga-badge';
  const MATOME_CLASS = 'shiwake-matome-badge';
  const BAND_MIN = 1500, BAND_MAX = 3999;
  const UPPER_GRADES = ['未開封', '未使用', '開封未使用', '中古A'];
  const LOWER_GRADES = ['中古B', '中古C'];
  let enabled = true;

  const STYLE_WGA = 'padding:2px 8px;background:linear-gradient(180deg,#64748B 0%,#334155 100%);color:#fff;border:1px solid #1E293B;border-radius:3px;font-size:11px;font-weight:700;white-space:nowrap';
  const STYLE_MATOME = 'padding:2px 8px;background:linear-gradient(180deg,#A78BFA 0%,#6D28D9 100%);color:#fff;border:1px solid #5B21B6;border-radius:3px;font-size:11px;font-weight:700;white-space:nowrap';

  function gradeText(row) {
    try {
      const sel = window.OKURURU.utils.detector.extractRowGradeSelect(row);
      if (sel && sel.selectedIndex >= 0 && sel.options[sel.selectedIndex]) {
        return (sel.options[sel.selectedIndex].textContent || '').trim();
      }
    } catch (e) { /* noop */ }
    return '';
  }

  function sellValue(row) {
    try { return window.OKURURU.utils.selectors.parsePriceValue((window.OKURURU.utils.detector.extractRowPrices(row) || {}).sell); }
    catch (e) { return null; }
  }

  function dropBoth(bar) {
    if (!bar) return;
    const a = bar.querySelector('.' + WGA_CLASS); if (a) a.remove();
    const b = bar.querySelector('.' + MATOME_CLASS); if (b) b.remove();
  }

  function decide(row) {
    const sell = sellValue(row);
    // (a) ¥1 または 未入力 → WGA
    if (sell === 1 || sell === null) return 'wga';
    // 価格帯 1500〜3999
    if (sell >= BAND_MIN && sell <= BAND_MAX) {
      const g = gradeText(row);
      if (LOWER_GRADES.indexOf(g) !== -1) return 'wga';
      if (UPPER_GRADES.indexOf(g) !== -1) return 'matome';
    }
    return null;
  }

  function markRow(row, strong) {
    if (!enabled || !row || !strong) return;
    const R = window.OKURURU.shiwake.rows;
    const existBar = R.getExistingMarkBar(strong);
    // 卸/リコア(s1) or デパコス(s2) が有れば対象外
    const blocked = !!(existBar && (existBar.querySelector('.shiwake-s1-badge') || existBar.querySelector('.shiwake-depacos-badge')));
    if (blocked) { dropBoth(existBar); return; }

    const kind = decide(row);
    if (!kind) { dropBoth(existBar); return; }

    const bar = R.getMarkBar(strong);
    if (!bar) return;
    if (kind === 'wga') {
      const m = bar.querySelector('.' + MATOME_CLASS); if (m) m.remove();
      if (!bar.querySelector('.' + WGA_CLASS)) {
        const b = document.createElement('span');
        b.className = WGA_CLASS; b.textContent = 'WGA'; b.style.cssText = STYLE_WGA;
        b.title = '未振り分け＋（販売¥1/未入力 もしくは 販売1500〜3999円かつ中古B・C）→ WGA';
        bar.appendChild(b);
      }
    } else { // matome
      const w = bar.querySelector('.' + WGA_CLASS); if (w) w.remove();
      if (!bar.querySelector('.' + MATOME_CLASS)) {
        const b = document.createElement('span');
        b.className = MATOME_CLASS; b.textContent = '⏳ まとめ待ち'; b.style.cssText = STYLE_MATOME;
        b.title = '未振り分け＋販売1500〜3999円かつ未開封/未使用/開封未使用/中古A → まとめ待ち';
        bar.appendChild(b);
      }
    }
  }

  function removeAll() { document.querySelectorAll('.' + WGA_CLASS + ',.' + MATOME_CLASS).forEach((e) => e.remove()); }

  async function init() {
    enabled = await window.OKURURU.utils.storage.isFeatureEnabled(FEATURE_KEY);
    if (!enabled) removeAll();
  }

  window.OKURURU.features.s8_wgaMark = {
    init, markRow, removeAll, FEATURE_KEY,
    isEnabled: () => enabled, setEnabled: (v) => { enabled = v; if (!v) removeAll(); }
  };
})();
