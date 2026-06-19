/**
 * content/s8_wga_mark.js
 *
 * S8：未振り分け商品のテキストマーク（WGA / 香水 / ややこし商品）
 *   クロさん 2026-06-17 確定。前提：卸(□)・リコア(■)・デパコス のどれも無い「未振り分け」のみ対象。
 *
 *   🌸 香水（ティール）   : カテゴリ=香水 かつ 買取単価¥50以上
 *   ややこし商品（バイオレット）: カテゴリが 化粧品/香水/サプリ/金券 以外（ゲーム/おもちゃ/日用雑貨 等）かつ 買取単価¥50以上
 *   WGA（グレー）         : 販売単価 ¥1 または 未入力
 *
 *   優先順位：香水 > ややこし商品 > WGA。
 *   ITコードの付与は s3 が同条件（買取¥50以上の香水/非コスメ・未振り分け）で行う。
 *   ※ 旧「まとめ待ち」と販売1500〜3999のWGA分岐は廃止。
 */
(function () {
  'use strict';
  if (!window.OKURURU) window.OKURURU = {};
  if (!window.OKURURU.features) window.OKURURU.features = {};

  const FEATURE_KEY = 's8_wgaMark';
  const WGA_CLASS = 'shiwake-wga-badge';
  const PERFUME_CLASS = 'shiwake-perfume-badge';
  const YAYA_CLASS = 'shiwake-yaya-badge';
  const MATOME_CLASS = 'shiwake-matome-badge'; // 旧（撤去）。残骸掃除用に保持。
  const BUY_MIN = 50;
  let enabled = true;

  const STYLE_WGA = 'padding:2px 8px;background:linear-gradient(180deg,#64748B 0%,#334155 100%);color:#fff;border:1px solid #1E293B;border-radius:3px;font-size:11px;font-weight:700;white-space:nowrap';
  const STYLE_PERFUME = 'padding:2px 8px;background:linear-gradient(180deg,#2DD4BF 0%,#0D9488 100%);color:#fff;border:1px solid #0F766E;border-radius:3px;font-size:11px;font-weight:700;white-space:nowrap';
  const STYLE_YAYA = 'padding:2px 8px;background:linear-gradient(180deg,#A78BFA 0%,#6D28D9 100%);color:#fff;border:1px solid #5B21B6;border-radius:3px;font-size:11px;font-weight:700;white-space:nowrap';

  const PERFUME_RE = /香水|フレグランス|オーデコロン|オードトワレ|オードパルファ|オードパルファム|パルファン|パルファム|EAU\s*DE/i;
  const COSMETIC_FAMILY_RE = /化粧品|コスメ|スキンケア|メイク|ファンデーション/i;
  const SUPP_GIFT_RE = /サプリ|サプリメント|金券|ギフト券|商品券/i;

  function extractCategoryFromRowText(rowText) {
    if (!rowText) return '';
    const txt = String(rowText).replace(/\s+/g, ' ');
    const pdIdx = txt.search(/PD[A-Z0-9]{10,12}/);
    let tail = pdIdx >= 0 ? txt.substring(pdIdx) : txt;
    tail = tail.replace(/\s\-\s\/\s/g, ' / ');
    const cut = tail.match(/^([^\[]+?)(?:\[|買取点数|販売単価|グレード|コンディション)/);
    if (cut) tail = cut[1];
    const segs = tail.split('/').map(s => s.trim()).filter(s => s && !/^PD[A-Z0-9]{10,12}$/.test(s) && s !== '-');
    return segs.length ? segs[segs.length - 1] : '';
  }
  function buyValue(row) {
    try { return window.OKURURU.utils.selectors.parsePriceValue((window.OKURURU.utils.detector.extractRowPrices(row) || {}).buy); }
    catch (e) { return null; }
  }
  function sellValue(row) {
    try { return window.OKURURU.utils.selectors.parsePriceValue((window.OKURURU.utils.detector.extractRowPrices(row) || {}).sell); }
    catch (e) { return null; }
  }

  function dropAll(bar) {
    if (!bar) return;
    [WGA_CLASS, PERFUME_CLASS, YAYA_CLASS, MATOME_CLASS].forEach(function (c) { const e = bar.querySelector('.' + c); if (e) e.remove(); });
  }

  function decide(row) {
    const buy = buyValue(row);
    const cat = extractCategoryFromRowText(row.textContent || '');
    if (buy != null && buy >= BUY_MIN && cat) {
      if (PERFUME_RE.test(cat)) return 'perfume';
      if (!COSMETIC_FAMILY_RE.test(cat) && !SUPP_GIFT_RE.test(cat)) return 'yaya';
    }
    const sell = sellValue(row);
    if (sell === 1 || sell === null) return 'wga';
    return null;
  }

  function setBadge(bar, kind) {
    const map = {
      wga: { cls: WGA_CLASS, text: 'WGA', style: STYLE_WGA, title: '未振り分け＋販売¥1または未入力 → WGA' },
      perfume: { cls: PERFUME_CLASS, text: '🌸 香水', style: STYLE_PERFUME, title: '未振り分け＋香水カテゴリ＋買取¥50以上 → 香水（ITコード対象）' },
      yaya: { cls: YAYA_CLASS, text: 'ややこし商品', style: STYLE_YAYA, title: '未振り分け＋非コスメ系カテゴリ＋買取¥50以上 → ややこし商品（ITコード対象）' }
    };
    const def = map[kind];
    // 他種を消す
    [WGA_CLASS, PERFUME_CLASS, YAYA_CLASS, MATOME_CLASS].forEach(function (c) { if (c !== def.cls) { const e = bar.querySelector('.' + c); if (e) e.remove(); } });
    if (bar.querySelector('.' + def.cls)) return;
    const b = document.createElement('span');
    b.className = def.cls; b.textContent = def.text; b.style.cssText = def.style; b.title = def.title;
    bar.appendChild(b);
  }

  function markRow(row, strong) {
    if (!enabled || !row || !strong) return;
    const R = window.OKURURU.shiwake.rows;
    const existBar = R.getExistingMarkBar(strong);
    const blocked = !!(existBar && (existBar.querySelector('.shiwake-s1-badge') || existBar.querySelector('.shiwake-depacos-badge')));
    if (blocked) { dropAll(existBar); return; }
    const kind = decide(row);
    if (!kind) { dropAll(existBar); return; }
    const bar = R.getMarkBar(strong);
    if (!bar) return;
    setBadge(bar, kind);
  }

  function removeAll() { document.querySelectorAll('.' + WGA_CLASS + ',.' + PERFUME_CLASS + ',.' + YAYA_CLASS + ',.' + MATOME_CLASS).forEach(function (e) { e.remove(); }); }

  async function init() {
    enabled = await window.OKURURU.utils.storage.isFeatureEnabled(FEATURE_KEY);
    if (!enabled) removeAll();
  }

  window.OKURURU.features.s8_wgaMark = {
    init, markRow, removeAll, FEATURE_KEY,
    isEnabled: function () { return enabled; }, setEnabled: function (v) { enabled = v; if (!v) removeAll(); }
  };
})();
