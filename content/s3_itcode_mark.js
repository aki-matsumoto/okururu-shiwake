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
 *   (6) 【未振り分けのみ】香水カテゴリ かつ 買取¥50以上
 *   (7) 【未振り分けのみ】非コスメ系（化粧品/香水/サプリ/金券 以外）かつ 買取¥50以上
 *  ※(6)(7)はクロさん 2026-06-17 追加（ややこし商品/香水マークと同条件）。
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
  const BUY_MIN_LOW = 50;
  let enabled = true;

  const STYLE = 'padding:2px 8px;background:linear-gradient(180deg,#60A5FA 0%,#2563EB 100%);color:#fff;border:1px solid #1D4ED8;border-radius:3px;font-size:11px;font-weight:700;white-space:nowrap';

  const SMARTPHONE_TABLET_RE = /スマートフォン[・･]タブレット\s*>|>\s*スマートフォン[・･]タブレット/;
  const BRAND_CATEGORY_RE = /ブランド\s*品?\s*>|>\s*ブランド\s*品?\s*>|>\s*バッグ|>\s*財布|>\s*時計|>\s*腕時計|>\s*ジュエリー|>\s*アクセサリー|>\s*ベルト|>\s*ネクタイ|>\s*スカーフ|>\s*靴/;
  const NON_IT_CATEGORY_RE = /(化粧品|コスメ|スキンケア|メイク|ファンデーション|香水|フレグランス|オーデコロン|オードトワレ|オードパルファ|サプリ|サプリメント|金券|ギフト券|商品券)/i;
  const PERFUME_RE = /香水|フレグランス|オーデコロン|オードトワレ|オードパルファ|オードパルファム|パルファン|パルファム|EAU\s*DE/i;
  const COSMETIC_FAMILY_RE = /化粧品|コスメ|スキンケア|メイク|ファンデーション/i;
  const SUPP_GIFT_RE = /サプリ|サプリメント|金券|ギフト券|商品券/i;
  // 2026-09-14 現場FB：ITコード除外/例外に使うカテゴリ判定（経路全体で見る）
  //  2026-09-18：ReCORE実カテゴリ（カテゴリ設定 ID761/763）に合わせて実名で判定。
  //   親「美容家電・美顔器」＋子（美顔器/脱毛機器・シェーバー/ヘアアイロン・ドライヤー/シャワーヘッド/デンタルケア）を網羅。
  const SUPPLEMENT_RE = /サプリ|サプリメント|健康食品/;
  const IKUMOU_RE = /育毛|養毛/;
  const DAILY_GOODS_RE = /日用雑貨|生活雑貨|日用品/;   // ※実カテゴリ名を要確認（一覧に「日用雑貨」が無い）
  const BEAUTY_APPLIANCE_RE = /美容家電|美顔器|脱毛機器|シェーバー|ヘアアイロン|ドライヤー|シャワーヘッド|デンタルケア|電動歯ブラシ/;
  const RECORE_DAILY_SELL_MIN = 1000;

  // カテゴリ経路（親カテゴリも拾えるよう leaf でなく経路全体）
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
  // s1（卸/リコア）バッジ種別
  function s1Kind(strong) {
    try {
      const bar = window.OKURURU.shiwake.rows.getExistingMarkBar(strong);
      if (!bar) return null;
      const b = bar.querySelector('.shiwake-s1-badge');
      return b ? (b.dataset.kind || null) : null;
    } catch (e) { return null; }
  }
  // s8 が「卸（同一カタログ5個以上）」を出す行か？（有効時のみ）→ ITコードは付けない
  function isOroshiCatalog(row, strong) {
    try {
      const s8 = window.OKURURU.features && window.OKURURU.features.s8_wgaMark;
      if (!s8 || !s8.isEnabled() || typeof s8.computeKind !== 'function') return false;
      return s8.computeKind(row, strong) === 'oroshi';
    } catch (e) { return false; }
  }

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

  function isUnsorted(strong) {
    try {
      const bar = window.OKURURU.shiwake.rows.getExistingMarkBar(strong);
      if (!bar) return true;
      return !(bar.querySelector('.shiwake-s1-badge') || bar.querySelector('.shiwake-depacos-badge'));
    } catch (e) { return true; }
  }

  function evaluate(row, strong) {
    const u = window.OKURURU.utils;
    const prices = u.detector.extractRowPrices(row) || {};
    const buyV = u.selectors.parsePriceValue(prices.buy);
    const sellV = u.selectors.parsePriceValue(prices.sell);
    const isPrecious = u.detector.isPreciousMetalRow(row);
    const rowText = (row.textContent || '');
    const cat = extractCategoryFromRowText(rowText);
    const path = categoryPath(rowText);
    const kind = s1Kind(strong); // 'oroshi' | 'recore' | null

    // ── 2026-09-14 現場FB：ITコード表示の除外条件 ──
    // req#1① 卸商品は表示しない
    if (kind === 'oroshi') return null;
    // req#3 サプリ・育毛剤は表示しない（販売¥4,000以上でも）
    if (SUPPLEMENT_RE.test(path) || IKUMOU_RE.test(path)) return null;
    // req#2 買取¥1（1円まとめ）は表示しない
    if (buyV === 1) return null;
    // req#1① リコア商品は原則表示しない。例外：日用雑貨/美容家電 かつ 販売¥1,000以上のみ可
    if (kind === 'recore') {
      if ((DAILY_GOODS_RE.test(path) || BEAUTY_APPLIANCE_RE.test(path)) && sellV != null && sellV >= RECORE_DAILY_SELL_MIN) return 'recore_daily';
      return null;
    }
    // req#4 卸タグ（同一カタログ5個以上）対象は ITコードを付けない
    if (isOroshiCatalog(row, strong)) return null;

    const cosmetic = cat ? NON_IT_CATEGORY_RE.test(cat) : NON_IT_CATEGORY_RE.test(rowText);
    const isSmartphone = SMARTPHONE_TABLET_RE.test(rowText);
    const isBrand = BRAND_CATEGORY_RE.test(rowText);
    if (isSmartphone && buyV != null && buyV >= SMARTPHONE_THRESHOLD) return 'smartphone';
    if (buyV != null && buyV >= BUY_THRESHOLD && !cosmetic) return 'buy';
    if (sellV != null && sellV >= SELL_THRESHOLD) return 'sell';
    if (isPrecious && buyV != null && buyV >= BUY_THRESHOLD) return 'precious';
    if (isBrand && !cosmetic) return 'brand';
    // 未振り分け＋買取¥50以上（香水 / 非コスメ系）
    if (buyV != null && buyV >= BUY_MIN_LOW && cat && isUnsorted(strong)) {
      if (PERFUME_RE.test(cat)) return 'perfume50';
      if (!COSMETIC_FAMILY_RE.test(cat) && !SUPP_GIFT_RE.test(cat)) return 'misc50';
    }
    return null;
  }

  function markRow(row, strong) {
    if (!enabled || !row || !strong) return;
    const reason = evaluate(row, strong);
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
      brand: 'ブランド品',
      perfume50: '香水カテゴリ 買取¥50以上（未振り分け）',
      misc50: '非コスメ系カテゴリ 買取¥50以上（未振り分け）',
      recore_daily: 'リコア×日用雑貨/美容家電×販売¥1,000以上（例外的にITコード可）'
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
