/**
 * content/s1_oroshi_recore_mark.js
 *
 * S1：卸マーク / リコアマーク（商品名の上のマークバーに表示）
 *  - 商品名の先頭「□」→ 📦 卸 ／「■」→ 🏯 リコア
 *  - 2026-10-15：「■」でも グレード中古C以下（中古C／中古D(ジャンク)）かつ 買取単価¥1以下 の行は
 *    リコアマークを付けない（判定は shouldSuppressRecore に一本化）。
 */
(function () {
  'use strict';
  if (!window.OKURURU) window.OKURURU = {};
  if (!window.OKURURU.features) window.OKURURU.features = {};

  const FEATURE_KEY = 's1_oroshiRecoreMark';
  const BADGE_CLASS = 'shiwake-s1-badge';
  let enabled = true;

  const STYLE_O = 'padding:2px 8px;background:linear-gradient(180deg,#FBBF24 0%,#D97706 100%);color:#fff;border:1px solid #B45309;border-radius:3px;font-size:11px;font-weight:700;white-space:nowrap';
  const STYLE_R = 'padding:2px 8px;background:linear-gradient(180deg,#34D399 0%,#059669 100%);color:#fff;border:1px solid #047857;border-radius:3px;font-size:11px;font-weight:700;white-space:nowrap';

  // 先頭の空白・ノイズ記号（●○◎◆◇★☆♪※・「」【】（）() 等）をスキップしてから □/■ を判定。
  //  例：「●□クレ」「○■cocone」のように □/■ の前に記号が付いても卸/リコアを認識する。
  const LEAD_NOISE_RE = /^[\s　●○◎◆◇★☆♪♬※‼!・･「」『』【】〔〕（）()\[\]<>＜＞|｜~～\-—–]+/;
  function classify(name) {
    if (!name) return null;
    const head = String(name).replace(LEAD_NOISE_RE, '').charAt(0);
    if (head === '□') return 'oroshi';
    if (head === '■') return 'recore';
    return null;
  }

  // ── 2026-10-15 クロさん依頼：■でも「中古C以下」かつ「買取¥1以下」はリコアマークを付けない ──
  //  グレードIDは utils/selectors.js GRADE_MAP（4=中古C, 5=中古D(ジャンク)）。新品/未使用/未開封/開封未使用/中古A/B/買取不可 は対象外。
  const LOW_GRADE_IDS = [4, 5];
  const RECORE_SUPPRESS_BUY_MAX = 1;
  // 価格を数値化（カンマ・¥・空白を除去。小数も保持）。空・数値でない → null
  function toPriceNumber(v) {
    if (v == null) return null;
    if (typeof v === 'number') return isFinite(v) ? v : null;
    const raw = String(v).replace(/[,，¥￥円\s　]/g, '');
    if (raw === '' || !/^-?\d+(\.\d+)?$/.test(raw)) return null;
    const n = parseFloat(raw);
    return isFinite(n) ? n : null;
  }
  // 判定本体（純関数）：グレードID・買取単価のどちらかが取れないときは外さない（従来どおり■表示）
  function shouldSuppressRecore(gradeId, buyPrice) {
    const n = toPriceNumber(buyPrice);
    if (n == null) return false;
    if (gradeId == null || LOW_GRADE_IDS.indexOf(Number(gradeId)) < 0) return false;
    return n <= RECORE_SUPPRESS_BUY_MAX;
  }
  // 行からグレードIDを取得：①行内のグレード select ②無ければ行テキストの「グレード ○○」
  function rowGradeId(row) {
    try {
      const u = window.OKURURU.utils;
      const sel = u.selectors.findRowGradeSelect(row);
      if (sel) return u.selectors.detectGradeId(sel);
      const gm = u.GRADE_MAP || {};
      const m = String(row.textContent || '').replace(/\s+/g, ' ').match(/グレード\s*[:：]?\s*([^\s/｜|]+)/);
      if (!m) return null;
      const ids = Object.keys(gm).sort((a, b) => gm[b].name.length - gm[a].name.length);
      for (const id of ids) { if (m[1].indexOf(gm[id].name) === 0) return parseInt(id, 10); }
    } catch (e) { /* noop */ }
    return null;
  }
  function rowBuyPrice(row) {
    try {
      const p = window.OKURURU.utils.detector.extractRowPrices(row) || {};
      return p.buy ? p.buy.value : null;
    } catch (e) { return null; }
  }
  function isRecoreSuppressedRow(row) {
    if (!row) return false;
    return shouldSuppressRecore(rowGradeId(row), rowBuyPrice(row));
  }

  function markRow(row, strong) {
    if (!enabled || !strong) return;
    const name = (strong.textContent || '').trim();
    let kind = classify(name);
    if (kind === 'recore' && isRecoreSuppressedRow(row)) kind = null; // 中古C以下×買取¥1以下 → リコアマークを付けない（既存バッジも下で外す）
    if (!kind) {
      const eb = window.OKURURU.shiwake.rows.getExistingMarkBar(strong);
      const ex = eb && eb.querySelector('.' + BADGE_CLASS);
      if (ex) ex.remove();
      return;
    }
    const bar = window.OKURURU.shiwake.rows.getMarkBar(strong);
    if (!bar) return;
    const existing = bar.querySelector('.' + BADGE_CLASS);
    if (existing && existing.dataset.kind === kind) return;
    if (existing) existing.remove();
    const b = document.createElement('span');
    b.className = BADGE_CLASS;
    b.dataset.kind = kind;
    if (kind === 'oroshi') { b.textContent = '📦 卸'; b.style.cssText = STYLE_O; b.title = '商品名先頭「□」＝卸行き'; }
    else { b.textContent = '🏯 リコア'; b.style.cssText = STYLE_R; b.title = '商品名先頭「■」＝リコア在庫'; }
    bar.insertBefore(b, bar.firstChild); // 先頭（左端）に
  }

  function removeAll() { document.querySelectorAll('.' + BADGE_CLASS).forEach((e) => e.remove()); }

  async function init() {
    enabled = await window.OKURURU.utils.storage.isFeatureEnabled(FEATURE_KEY);
    if (!enabled) removeAll();
  }

  window.OKURURU.features.s1_oroshiRecoreMark = {
    init, markRow, removeAll, FEATURE_KEY, classify, shouldSuppressRecore, toPriceNumber, LOW_GRADE_IDS,
    isEnabled: () => enabled, setEnabled: (v) => { enabled = v; if (!v) removeAll(); }
  };
})();
