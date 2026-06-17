/**
 * content/s6_hide_fields.js
 *
 * S6：仕分けに不要な項目を非表示（棚番号 / 他店価格 / 在庫属性）。
 *  - 各ラベル（small/label）から「そのフィールドだけ」の安全な小容器を選び display:none。
 *  - OFF にすると復元。買取ケース詳細でのみ動作。
 *
 * v0.3.1: closest('.pl-4') が在庫属性等で商品ブロック全体に当たり「商品まるごと消える」
 *   事故を修正。商品名 strong / 価格 input を含まない最小容器のみを隠すよう変更。
 */
(function () {
  'use strict';
  if (window.OKURURU_SHIWAKE_S6_loaded) return;
  window.OKURURU_SHIWAKE_S6_loaded = true;
  if (!window.OKURURU) window.OKURURU = {};
  if (!window.OKURURU.features) window.OKURURU.features = {};

  const FEATURE_KEY = 's6_hideFields';
  const TARGETS = ['棚番号', '他店価格', '在庫属性'];
  const FLAG = 'shiwakeHidden';
  let enabled = true;
  let timer = null;

  function isCaseDetailPage() { return /\/(bad\/)?case\/\d+/.test(location.pathname); }

  // ラベルから親を1段ずつ上り、商品名/価格入力を含まず短い最小容器を選ぶ。
  function pickContainer(labelEl) {
    let e = labelEl.parentElement;
    for (let i = 0; i < 4 && e; i++) {
      const txtLen = (e.textContent || '').trim().length;
      const hasHeavy = !!e.querySelector('.text-truncate strong, input.form-control, select, textarea');
      if (!hasHeavy && txtLen <= 80) return e;
      e = e.parentElement;
    }
    return null; // 安全な対象が無ければ隠さない（誤爆防止）
  }

  function hideCell(labelEl) {
    const cell = pickContainer(labelEl);
    if (!cell || cell.dataset[FLAG] === '1') return;
    cell.dataset[FLAG] = '1';
    cell.dataset.shiwakePrevDisplay = cell.style.display || '';
    cell.style.display = 'none';
  }

  function apply() {
    if (!enabled || !isCaseDetailPage()) return;
    document.querySelectorAll('small, label').forEach((el) => {
      const t = (el.textContent || '').trim();
      if (TARGETS.indexOf(t) !== -1) hideCell(el);
    });
  }

  function restore() {
    document.querySelectorAll('[data-' + FLAG.replace(/([A-Z])/g, '-$1').toLowerCase() + '="1"]').forEach((cell) => {
      cell.style.display = cell.dataset.shiwakePrevDisplay || '';
      delete cell.dataset[FLAG];
      delete cell.dataset.shiwakePrevDisplay;
    });
  }

  async function init() {
    enabled = await window.OKURURU.utils.storage.isFeatureEnabled(FEATURE_KEY);
    if (!enabled) { restore(); return; }
    apply();
    if (!timer) timer = setInterval(apply, 1500);
  }

  window.OKURURU.features.s6_hideFields = {
    init, apply, restore, FEATURE_KEY,
    isEnabled: () => enabled,
    setEnabled: (v) => { enabled = v; if (v) { apply(); } else { restore(); } }
  };
})();
