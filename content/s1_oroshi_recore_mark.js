/**
 * content/s1_oroshi_recore_mark.js
 *
 * S1：卸マーク / リコアマーク（商品名の上のマークバーに表示）
 *  - 商品名の先頭「□」→ 📦 卸 ／「■」→ 🏯 リコア
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

  function markRow(row, strong) {
    if (!enabled || !strong) return;
    const name = (strong.textContent || '').trim();
    const kind = classify(name);
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
    init, markRow, removeAll, FEATURE_KEY,
    isEnabled: () => enabled, setEnabled: (v) => { enabled = v; if (!v) removeAll(); }
  };
})();
