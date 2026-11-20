/**
 * content/s8_wga_mark.js
 *
 * S8：未振り分け商品のテキストマーク（WGA / サプリ / 育毛剤 / カテゴリ注意 / 卸 / 香水 / ややこし）
 *   前提：卸(□)・リコア(■)・デパコス のどれも無い「未振り分け」行のみ対象。
 *
 *   優先順：買取¥1のWGA → カテゴリ注意 → 卸 → 化粧品WGA → サプリ → 育毛剤
 *            → 香水 → ややこし → 販売¥1/未入力のWGA。表示は1行1バッジ。
 *   computeKind(row, strong) は s3（ITコード）と s9（価格確認）でも参照する。
 */
(function () {
  'use strict';
  if (!window.OKURURU) window.OKURURU = {};
  if (!window.OKURURU.features) window.OKURURU.features = {};

  const FEATURE_KEY = 's8_wgaMark';
  const WGA_CLASS = 'shiwake-wga-badge';
  const PERFUME_CLASS = 'shiwake-perfume-badge';
  const YAYA_CLASS = 'shiwake-yaya-badge';
  const SUPP_CLASS = 'shiwake-supp-badge';
  const IKUMOU_CLASS = 'shiwake-ikumou-badge';
  const OROSHI_CLASS = 'shiwake-oroshi5-badge';
  const CATWARN_CLASS = 'shiwake-catwarn-badge';
  const MATOME_CLASS = 'shiwake-matome-badge'; // 旧（撤去）。残骸掃除用に保持。
  const ALL_CLASSES = [WGA_CLASS, PERFUME_CLASS, YAYA_CLASS, SUPP_CLASS, IKUMOU_CLASS, OROSHI_CLASS, CATWARN_CLASS, MATOME_CLASS];
  const BUY_MIN = 50;
  const CATALOG_MIN = 5;
  const COSMETIC_WGA_SELL_LIMIT = 4000;
  const COSMETIC_WGA_GRADE_IDS = [3, 4, 5];
  let enabled = true;

  const STYLE_WGA = 'padding:2px 8px;background:linear-gradient(180deg,#64748B 0%,#334155 100%);color:#fff;border:1px solid #1E293B;border-radius:3px;font-size:11px;font-weight:700;white-space:nowrap';
  const STYLE_PERFUME = 'padding:2px 8px;background:linear-gradient(180deg,#2DD4BF 0%,#0D9488 100%);color:#fff;border:1px solid #0F766E;border-radius:3px;font-size:11px;font-weight:700;white-space:nowrap';
  const STYLE_YAYA = 'padding:2px 8px;background:linear-gradient(180deg,#A78BFA 0%,#6D28D9 100%);color:#fff;border:1px solid #5B21B6;border-radius:3px;font-size:11px;font-weight:700;white-space:nowrap';
  const STYLE_SUPP = 'padding:2px 8px;background:linear-gradient(180deg,#38BDF8 0%,#0284C7 100%);color:#fff;border:1px solid #0369A1;border-radius:3px;font-size:11px;font-weight:700;white-space:nowrap';
  const STYLE_IKUMOU = 'padding:2px 8px;background:linear-gradient(180deg,#4ADE80 0%,#16A34A 100%);color:#fff;border:1px solid #15803D;border-radius:3px;font-size:11px;font-weight:700;white-space:nowrap';
  const STYLE_OROSHI = 'padding:2px 8px;background:linear-gradient(180deg,#FBBF24 0%,#D97706 100%);color:#fff;border:1px solid #B45309;border-radius:3px;font-size:11px;font-weight:700;white-space:nowrap';
  const STYLE_CATWARN = 'padding:2px 8px;background:linear-gradient(180deg,#FB7185 0%,#E11D48 100%);color:#fff;border:1px solid #BE123C;border-radius:3px;font-size:11px;font-weight:700;white-space:nowrap';

  const PERFUME_RE = /香水|フレグランス|オーデコロン|オードトワレ|オードパルファ|オードパルファム|パルファン|パルファム|EAU\s*DE/i;
  const COSMETIC_FAMILY_RE = /化粧品|コスメ|スキンケア|メイク|ファンデーション/i;
  const SUPP_GIFT_RE = /サプリ|サプリメント|健康食品|金券|ギフト券|商品券/i;
  const SUPPLEMENT_RE = /サプリ|サプリメント|健康食品/;
  const IKUMOU_RE = /育毛|養毛/;                 // 育毛剤・育毛トニック・養毛料 等
  const DEFAULT_CAT_RE = /デフォルト/;

  // カテゴリ経路（PDコード以降～価格列の手前）。親カテゴリ（サプリ/育毛剤/デフォルト等）も拾えるよう
  //  leaf ではなく経路全体で判定する。
  function categoryPath(rowText) {
    if (!rowText) return '';
    const txt = String(rowText).replace(/\s+/g, ' ');
    const pdIdx = txt.search(/PD[A-Z0-9]{10,12}/);
    let tail = pdIdx >= 0 ? txt.substring(pdIdx) : txt;
    tail = tail.replace(/\s\-\s\/\s/g, ' / ');
    const cut = tail.match(/^([^\[]+?)(?:\[|買取点数|販売単価|グレード|コンディション)/);
    if (cut) tail = cut[1];
    return tail;
  }
  function sameProductQty(row, strong) {
    try { return (window.OKURURU.shiwake && typeof window.OKURURU.shiwake.sameProductQty === 'function') ? window.OKURURU.shiwake.sameProductQty(row, strong) : 0; }
    catch (e) { return 0; }
  }
  function isSortedOrDepacos(strong) {
    try {
      const bar = window.OKURURU.shiwake.rows.getExistingMarkBar(strong);
      if (!bar) return false;
      return !!(bar.querySelector('.shiwake-s1-badge') || bar.querySelector('.shiwake-depacos-badge'));
    } catch (e) { return false; }
  }

  function dropAll(bar) {
    if (!bar) return;
    ALL_CLASSES.forEach(function (c) { const e = bar.querySelector('.' + c); if (e) e.remove(); });
  }

  function decideKind({ buy, sell, path, gradeId, sameQty, sortedOrDepa }) {
    if (sortedOrDepa) return null;
    if (buy === 1) return 'wga';

    const meetsBuyMin = buy != null && buy >= BUY_MIN;
    if (meetsBuyMin && DEFAULT_CAT_RE.test(path)) return 'catwarn';
    if (meetsBuyMin && sameQty >= CATALOG_MIN) return 'oroshi';

    const cosmetic = COSMETIC_FAMILY_RE.test(path);
    const perfume = PERFUME_RE.test(path);
    const supplement = SUPPLEMENT_RE.test(path);
    const ikumou = IKUMOU_RE.test(path);
    if (cosmetic && !perfume && !supplement && !ikumou &&
        Number.isFinite(sell) && sell < COSMETIC_WGA_SELL_LIMIT &&
        COSMETIC_WGA_GRADE_IDS.includes(gradeId)) return 'wga';
    if (supplement) return 'supp';
    if (ikumou) return 'ikumou';
    if (meetsBuyMin && perfume) return 'perfume';
    if (meetsBuyMin && path && !cosmetic && !SUPP_GIFT_RE.test(path)) return 'yaya';
    if (sell === 1 || sell === null) return 'wga';
    return null;
  }

  function computeKind(row, strong) {
    if (!row || !strong) return null;
    const { detector, selectors } = window.OKURURU.utils;
    let prices;
    try { prices = detector.extractRowPrices(row) || {}; }
    catch (e) { prices = {}; }
    const buy = selectors.parsePriceValue(prices.buy);
    return decideKind({
      buy,
      sell: selectors.parsePriceValue(prices.sell),
      path: categoryPath(row.textContent || ''),
      gradeId: selectors.getRowGradeId(row),
      sameQty: buy != null && buy >= BUY_MIN ? sameProductQty(row, strong) : 0,
      sortedOrDepa: isSortedOrDepacos(strong)
    });
  }

  const MAP = {
    wga: { cls: WGA_CLASS, text: 'WGA', style: STYLE_WGA, title: '未振り分け＋（買取¥1、販売¥1/未入力、または化粧品で販売¥4,000未満かつ中古B/C/D）→ WGA' },
    supp: { cls: SUPP_CLASS, text: '💊 サプリ', style: STYLE_SUPP, title: 'カテゴリ＝サプリ（販売単価によらずカテゴリ基準）' },
    ikumou: { cls: IKUMOU_CLASS, text: '🧴 育毛剤', style: STYLE_IKUMOU, title: 'カテゴリ＝育毛剤（販売単価によらずカテゴリ基準）' },
    catwarn: { cls: CATWARN_CLASS, text: '⚠ カテゴリ注意', style: STYLE_CATWARN, title: '買取¥50以上でカテゴリが「デフォルト」のまま。カテゴリを設定してください。' },
    oroshi: { cls: OROSHI_CLASS, text: '📦 卸', style: STYLE_OROSHI, title: '買取¥50以上＋同一商品5個以上（数量合算・グレード違い/カタログ分割もまとめる）→ 卸行き候補（ITコードは付けません）' },
    perfume: { cls: PERFUME_CLASS, text: '🌸 香水', style: STYLE_PERFUME, title: '未振り分け＋香水カテゴリ＋買取¥50以上 → 香水' },
    yaya: { cls: YAYA_CLASS, text: 'ややこし商品', style: STYLE_YAYA, title: '未振り分け＋非コスメ系カテゴリ＋買取¥50以上 → ややこし商品（ITコード対象）' }
  };

  function setBadge(bar, kind) {
    const def = MAP[kind];
    if (!def) { dropAll(bar); return; }
    // 他種を消す
    ALL_CLASSES.forEach(function (c) { if (c !== def.cls) { const e = bar.querySelector('.' + c); if (e) e.remove(); } });
    if (bar.querySelector('.' + def.cls)) return;
    const b = document.createElement('span');
    b.className = def.cls; b.textContent = def.text; b.style.cssText = def.style; b.title = def.title;
    bar.appendChild(b);
  }

  function markRow(row, strong) {
    if (!enabled || !row || !strong) return;
    const R = window.OKURURU.shiwake.rows;
    const kind = computeKind(row, strong);
    if (!kind) { dropAll(R.getExistingMarkBar(strong)); return; }
    const bar = R.getMarkBar(strong);
    if (!bar) return;
    setBadge(bar, kind);
  }

  function removeAll() { document.querySelectorAll('.' + ALL_CLASSES.join(',.')).forEach(function (e) { e.remove(); }); }

  async function init() {
    enabled = await window.OKURURU.utils.storage.isFeatureEnabled(FEATURE_KEY);
    if (!enabled) removeAll();
  }

  window.OKURURU.features.s8_wgaMark = {
    init, markRow, removeAll, computeKind, FEATURE_KEY,
    __test: { decideKind },
    isEnabled: function () { return enabled; }, setEnabled: function (v) { enabled = v; if (!v) removeAll(); }
  };
})();
