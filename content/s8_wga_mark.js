/**
 * content/s8_wga_mark.js
 *
 * S8：未振り分け商品のテキストマーク（WGA / サプリ / 育毛剤 / カテゴリ注意 / 卸 / 香水 / ややこし）
 *   前提：卸(□)・リコア(■)・デパコス のどれも無い「未振り分け」行のみ対象。
 *
 *   ▼ 2026-09-14 現場FB で判定を再整理。競合時は下記の優先順で「1つだけ」表示する。
 *     0) 買取単価 ¥1 かつ 非リコア/非卸        → WGA（固定。デパコス/ややこし等は出さない）  ［req#3］
 *     1) カテゴリ＝サプリ                        → 💊 サプリ（販売単価によらずカテゴリ基準）      ［req#2］
 *     2) カテゴリ＝育毛剤                        → 🧴 育毛剤（販売単価によらずカテゴリ基準）      ［req#2］
 *     3) 買取¥50以上 かつ カテゴリ＝デフォルト   → ⚠ カテゴリ注意（カテゴリ未設定の検出）        ［req#5］
 *     4) 買取¥50以上 かつ 同一カタログ5個以上    → 📦 卸（卸行き候補。ITコードは出さない）        ［req#4］
 *     5) 買取¥50以上 かつ 香水カテゴリ           → 🌸 香水                                        ［既存］
 *     6) 買取¥50以上 かつ 非コスメ系             → ややこし商品                                   ［既存］
 *     7) 販売単価 ¥1 または 未入力               → WGA                                            ［既存］
 *
 *   ITコード（s3）との対応：
 *     - サプリ / 育毛剤 / 卸(カタログ5+) の3種は s3 側で ITコード を付けない（クロさん 2026-09-14）。
 *     - 香水 / ややこし / カテゴリ注意 は従来どおり ITコード が付く（買取¥50以上・未振り分け）。
 *   computeKind(row, strong) を純関数として公開し、s3 が同じ判定を参照する。
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
  const SUPP_GIFT_RE = /サプリ|サプリメント|金券|ギフト券|商品券/i;
  const SUPPLEMENT_RE = /サプリ|サプリメント/;
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
  function buyValue(row) {
    try { return window.OKURURU.utils.selectors.parsePriceValue((window.OKURURU.utils.detector.extractRowPrices(row) || {}).buy); }
    catch (e) { return null; }
  }
  function sellValue(row) {
    try { return window.OKURURU.utils.selectors.parsePriceValue((window.OKURURU.utils.detector.extractRowPrices(row) || {}).sell); }
    catch (e) { return null; }
  }
  function catalogCount(row) {
    try { return (window.OKURURU.shiwake && typeof window.OKURURU.shiwake.catalogCount === 'function') ? window.OKURURU.shiwake.catalogCount(row) : 0; }
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

  /**
   * 未振り分け行の分類（純関数）。卸/リコア/デパコスが付いた行は null（対象外）。
   *  返り値: 'wga' | 'supp' | 'ikumou' | 'catwarn' | 'oroshi' | 'perfume' | 'yaya' | null
   *  s3（ITコード）からも参照される。
   */
  function computeKind(row, strong) {
    if (!row || !strong) return null;
    if (isSortedOrDepacos(strong)) return null; // 卸/リコア/デパコスは対象外
    const buy = buyValue(row);
    // 0) 買取¥1（非リコア/非卸）→ WGA 固定
    if (buy === 1) return 'wga';
    const path = categoryPath(row.textContent || '');
    // 1) サプリ（価格によらずカテゴリ基準）
    if (SUPPLEMENT_RE.test(path)) return 'supp';
    // 2) 育毛剤（価格によらずカテゴリ基準）
    if (IKUMOU_RE.test(path)) return 'ikumou';
    // 3) 買取¥50以上 × デフォルトカテゴリ → カテゴリ注意
    if (buy != null && buy >= BUY_MIN && DEFAULT_CAT_RE.test(path)) return 'catwarn';
    // 4) 買取¥50以上 × 同一カタログ5個以上 → 卸
    if (buy != null && buy >= BUY_MIN && catalogCount(row) >= CATALOG_MIN) return 'oroshi';
    // 5) 買取¥50以上 × 香水
    if (buy != null && buy >= BUY_MIN && PERFUME_RE.test(path)) return 'perfume';
    // 6) 買取¥50以上 × 非コスメ系（化粧品/香水/サプリ/金券/育毛剤 以外）。カテゴリ未取得の行は対象外。
    if (buy != null && buy >= BUY_MIN && path && !COSMETIC_FAMILY_RE.test(path) && !SUPP_GIFT_RE.test(path) && !PERFUME_RE.test(path) && !IKUMOU_RE.test(path)) return 'yaya';
    // 7) 販売¥1/未入力 → WGA
    const sell = sellValue(row);
    if (sell === 1 || sell === null) return 'wga';
    return null;
  }

  const MAP = {
    wga: { cls: WGA_CLASS, text: 'WGA', style: STYLE_WGA, title: '未振り分け＋（買取¥1 または 販売¥1/未入力）→ WGA' },
    supp: { cls: SUPP_CLASS, text: '💊 サプリ', style: STYLE_SUPP, title: 'カテゴリ＝サプリ（販売単価によらずカテゴリ基準）' },
    ikumou: { cls: IKUMOU_CLASS, text: '🧴 育毛剤', style: STYLE_IKUMOU, title: 'カテゴリ＝育毛剤（販売単価によらずカテゴリ基準）' },
    catwarn: { cls: CATWARN_CLASS, text: '⚠ カテゴリ注意', style: STYLE_CATWARN, title: '買取¥50以上でカテゴリが「デフォルト」のまま。カテゴリを設定してください。' },
    oroshi: { cls: OROSHI_CLASS, text: '📦 卸', style: STYLE_OROSHI, title: '買取¥50以上＋同一カタログ5個以上 → 卸行き候補（ITコードは付けません）' },
    perfume: { cls: PERFUME_CLASS, text: '🌸 香水', style: STYLE_PERFUME, title: '未振り分け＋香水カテゴリ＋買取¥50以上 → 香水（ITコード対象）' },
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
    isEnabled: function () { return enabled; }, setEnabled: function (v) { enabled = v; if (!v) removeAll(); }
  };
})();
