/**
 * content/s2_brand_mark.js
 *
 * S2：デパコスマーク ＋ メルカリ出品禁止マーク（商品名の上のマークバーに表示）
 *  - デパコス39＋化粧品/香水カテゴリ → 🏬 デパコス
 *  - メルカリ禁止13（カテゴリ問わず） → 🚫 メルカリ禁止
 *  - 両方該当なら両バッジ。カテゴリ判定は F73 の breadcrumb 抽出を流用。
 */
(function () {
  'use strict';
  if (!window.OKURURU) window.OKURURU = {};
  if (!window.OKURURU.features) window.OKURURU.features = {};

  const FEATURE_KEY = 's2_brandMark';
  const DEPACOS_CLASS = 'shiwake-depacos-badge';
  const BAN_CLASS = 'shiwake-ban-badge';
  const TTL = 5000;
  let enabled = true;

  const STYLE_DEPACOS = 'padding:2px 8px;background:linear-gradient(180deg,#F9A8D4 0%,#DB2777 100%);color:#fff;border:1px solid #BE185D;border-radius:3px;font-size:11px;font-weight:700;white-space:nowrap';
  const STYLE_BAN = 'padding:2px 8px;background:linear-gradient(180deg,#F87171 0%,#B91C1C 100%);color:#fff;border:1px solid #991B1B;border-radius:3px;font-size:11px;font-weight:700;white-space:nowrap';

  const COSMETIC_CATEGORY_RE = /(化粧品|コスメ|スキンケア|メイク|ファンデーション|香水|フレグランス|オーデコロン|オードトワレ|オードパルファ|EAU\s*DE\s*|【\s*デフォルト\s*】|デフォルト)/i;
  const EXCLUDE_NON_COSMETIC_RE = /(ファッション雑貨|日用雑貨|小物|バッグ|財布|ベルト|スカーフ|時計|腕時計|ジュエリー|宝飾|アクセサリー|スマートフォン[・･]?タブレット|スマホ|家電|オーディオ|カメラ|ゲーム|衣料|アパレル|シャツ|ジャケット|コート|ワンピース|スカート|パンツ|靴|スニーカー|サプリ|食品|飲料)/i;

  const _rowCosmeCache = new WeakMap();

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

  function isCosmeticRow(row) {
    try {
      const now = Date.now();
      const c = _rowCosmeCache.get(row);
      if (c && c.expires > now) return c.value;
      const rowText = (row.textContent || '');
      // 確定ガード：ファッション雑貨は（カテゴリ未取得/デフォルトでも）デパコス非表示
      if (/ファッション雑貨/.test(rowText)) { _rowCosmeCache.set(row, { value: false, expires: now + TTL }); return false; }
      const cat = extractCategoryFromRowText(rowText);
      let value;
      if (!cat) {
        const STRICT = /(化粧品|コスメ|スキンケア|ファンデーション|香水|フレグランス|オーデコロン|オードトワレ|オードパルファ)/i;
        value = STRICT.test(rowText) && !EXCLUDE_NON_COSMETIC_RE.test(rowText);
      } else if (EXCLUDE_NON_COSMETIC_RE.test(cat)) { value = false; }
      else { value = COSMETIC_CATEGORY_RE.test(cat); }
      _rowCosmeCache.set(row, { value, expires: now + TTL });
      return value;
    } catch (e) { return false; }
  }

  function ensureBadge(bar, cls, style, text, title) {
    if (bar.querySelector('.' + cls)) return;
    const b = document.createElement('span');
    b.className = cls; b.textContent = text; b.style.cssText = style; b.title = title;
    bar.appendChild(b);
  }
  function dropBadge(bar, cls) { const e = bar.querySelector('.' + cls); if (e) e.remove(); }

  function markRow(row, strong) {
    if (!enabled || !strong || !row) return;
    const data = window.OKURURU.data && window.OKURURU.data.shiwakeBrands;
    if (!data) return;
    const name = (strong.textContent || '').trim();
    const R = window.OKURURU.shiwake.rows;
    const depa = data.detectDepacos(name);
    const wantDepa = !!(depa && isCosmeticRow(row));
    const ban = data.detectMercariBan(name);
    const wantBan = !!ban;
    if (!wantDepa && !wantBan) {
      const eb = R.getExistingMarkBar(strong);
      if (eb) { dropBadge(eb, DEPACOS_CLASS); dropBadge(eb, BAN_CLASS); }
      return;
    }
    const bar = R.getMarkBar(strong);
    if (!bar) return;
    if (wantDepa) ensureBadge(bar, DEPACOS_CLASS, STYLE_DEPACOS, '🏬 デパコス', depa.label + '：デパコスまとめ出品対象（H列〇）');
    else dropBadge(bar, DEPACOS_CLASS);
    if (wantBan) ensureBadge(bar, BAN_CLASS, STYLE_BAN, '🚫 メルカリ禁止', ban.label + '：メルカリ出品禁止ブランド');
    else dropBadge(bar, BAN_CLASS);
  }

  function removeAll() { document.querySelectorAll('.' + DEPACOS_CLASS + ',.' + BAN_CLASS).forEach((e) => e.remove()); }

  async function init() {
    enabled = await window.OKURURU.utils.storage.isFeatureEnabled(FEATURE_KEY);
    if (!enabled) removeAll();
  }

  window.OKURURU.features.s2_brandMark = {
    init, markRow, removeAll, FEATURE_KEY,
    isEnabled: () => enabled, setEnabled: (v) => { enabled = v; if (!v) removeAll(); },
    __test: { isCosmeticRow, extractCategoryFromRowText }
  };
})();
