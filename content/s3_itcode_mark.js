/**
 * content/s3_itcode_mark.js
 *
 * S3：ITコードマーク（📌 ITコード、商品名の上のマークバーに表示）
 *  対象（OR）：
 *   (1) スマホ・タブレット：買取¥1以上
 *   (2) 買取¥3,000以上 かつ カテゴリが 香水/化粧品/サプリ/金券 以外
 *   (3) 販売¥4,000以上（全カテゴリ）
 *   (4) 貴金属：買取¥3,000以上
 *   (5) ブランド品 かつ 非コスメ系
 *  既存 F7 ロジック流用＋ルール5のカテゴリ除外。
 */
(function () {
  'use strict';
  if (!window.OKURURU) window.OKURURU = {};
  if (!window.OKURURU.features) window.OKURURU.features = {};

  const FEATURE_KEY = 's3_itCodeMark';
  const BADGE_CLASS = 'shiwake-itcode-badge';
  const BUY_THRESHOLD = 3000;
  const SELL_THRESHOLD = 4000;
  const SMARTPHONE_THRESHOLD = 1;
  let enabled = true;

  const STYLE = 'padding:2px 8px;background:linear-gradient(180deg,#60A5FA 0%,#2563EB 100%);color:#fff;border:1px solid #1D4ED8;border-radius:3px;font-size:11px;font-weight:700;white-space:nowrap';

  const SMARTPHONE_TABLET_RE = /スマートフォン[・･]タブレット\s*>|>\s*スマートフォン[・･]タブレット/;
  const BRAND_CATEGORY_RE = /ブランド\s*品?\s*>|>\s*ブランド\s*品?\s*>|>\s*バッグ|>\s*財布|>\s*時計|>\s*腕時計|>\s*ジュエリー|>\s*アクセサリー|>\s*ベルト|>\s*ネクタイ|>\s*スカーフ|>\s*靴/;
  const NON_IT_CATEGORY_RE = /(化粧品|コスメ|スキンケア|メイク|ファンデーション|香水|フレグランス|オーデコロン|オードトワレ|オードパルファ|サプリ|サプリメント|金券|ギフト券|商品券)/i;

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
  function isCosmeticLike(rowText) {
    const cat = extractCategoryFromRowText(rowText);
    if (cat) return NON_IT_CATEGORY_RE.test(cat);
    return NON_IT_CATEGORY_RE.test(rowText);
  }

  function evaluate(row) {
    const u = window.OKURURU.utils;
    const prices = u.detector.extractRowPrices(row) || {};
    const buyV = u.selectors.parsePriceValue(prices.buy);
    const sellV = u.selectors.parsePriceValue(prices.sell);
    const isPrecious = u.detector.isPreciousMetalRow(row);
    const rowText = (row.textContent || '');
    const cosmetic = isCosmeticLike(rowText);
    const isSmartphone = SMARTPHONE_TABLET_RE.test(rowText);
    const isBrand = BRAND_CATEGORY_RE.test(rowText);
    if (isSmartphone && buyV != null && buyV >= SMARTPHONE_THRESHOLD) return 'smartphone';
    if (buyV != null && buyV >= BUY_THRESHOLD && !cosmetic) return 'buy';
    if (sellV != null && sellV >= SELL_THRESHOLD) return 'sell';
    if (isPrecious && buyV != null && buyV >= BUY_THRESHOLD) return 'precious';
    if (isBrand && !cosmetic) return 'brand';
    return null;
  }

  function markRow(row, strong) {
    if (!enabled || !row || !strong) return;
    const reason = evaluate(row);
    if (!reason) {
      const eb = window.OKURURU.shiwake.rows.getExistingMarkBar(strong);
      const ex = eb && eb.querySelector('.' + BADGE_CLASS);
      if (ex) ex.remove();
      return;
    }
    const bar = window.OKURURU.shiwake.rows.getMarkBar(strong);
    if (!bar) return;
    const existing = bar.querySelector('.' + BADGE_CLASS);
    if (existing) { existing.dataset.reason = reason; return; }
    const b = document.createElement('span');
    b.className = BADGE_CLASS; b.dataset.reason = reason;
    b.textContent = '📌 ITコード'; b.style.cssText = STYLE;
    const labels = {
      smartphone: 'スマホ・タブレットは買取¥1以上でITコード対象',
      buy: '買取¥' + BUY_THRESHOLD.toLocaleString() + '以上（非コスメ系）',
      sell: '販売¥' + SELL_THRESHOLD.toLocaleString() + '以上（全カテゴリ）',
      precious: '貴金属は買取¥' + BUY_THRESHOLD.toLocaleString() + '以上',
      brand: 'ブランド品'
    };
    b.title = 'ITコード対象：' + (labels[reason] || '');
    bar.appendChild(b);
  }

  function countMarked() { return document.querySelectorAll('.' + BADGE_CLASS).length; }
  function removeAll() { document.querySelectorAll('.' + BADGE_CLASS).forEach((e) => e.remove()); }

  async function init() {
    enabled = await window.OKURURU.utils.storage.isFeatureEnabled(FEATURE_KEY);
    if (!enabled) removeAll();
  }

  window.OKURURU.features.s3_itCodeMark = {
    init, markRow, removeAll, countMarked, FEATURE_KEY, BADGE_CLASS,
    isEnabled: () => enabled, setEnabled: (v) => { enabled = v; if (!v) removeAll(); }
  };
})();
