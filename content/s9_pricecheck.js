/**
 * content/s9_pricecheck.js
 *
 * S9：価格確認チェック（クロさん 2026-06-29 確定）
 *
 *  目的：価格確認が必要な商品の見落とし防止。
 *
 *  対象（チェック対象）：
 *    「WGA以外の商品（価格確認が必要な商品）」
 *    = 販売単価が ¥1／未入力（＝WGA相当）以外の、実価格が入った商品。
 *
 *  例外（社員確認が必要な商品）：対象のうち以下は未チェックでも続行可。
 *    (a) 買取単価 ¥3,000 以上（カテゴリ不問）
 *    (b) カテゴリ＝貴金属
 *    (c) カテゴリ＝ブランド品
 *    (d) カテゴリ＝ファッション雑貨
 *
 *  挙動：
 *    - 各対象行に「フロートのマーク」（クリックで ☐⇄☑ トグル）を商品名上のマークバーに表示。
 *      通常＝アンバー、社員確認＝バイオレットで色分け。
 *    - 画面右下のフロート「価格確認 完了」ボタンを押すとバリデーション：
 *        * 通常の未チェックが1件でもあれば → アラートで中断＋未チェック一覧。
 *        * 社員確認のみ未チェック → 一覧＋「社員確認なのでOK」で続行可。
 *        * 全てチェック済 → 完了トースト。
 *    - チェック状態はケース単位で chrome.storage に永続化（再描画/再訪でも復元）。
 *
 *  main.js で s1〜s8 の後に markRow を呼び、ループ後に ensureFloatButton を呼ぶこと。
 */
(function () {
  'use strict';
  if (!window.OKURURU) window.OKURURU = {};
  if (!window.OKURURU.features) window.OKURURU.features = {};

  var FEATURE_KEY = 's9_priceCheck';
  var BADGE_CLASS = 'shiwake-pc-badge';
  var FLOAT_ID = 'shiwake-pc-floatbtn';
  var TOAST_ID = 'shiwake-pc-toast';
  var BUY_EMP_THRESHOLD = 3000;

  var enabled = true;
  var curCaseId = null;
  var checkedSet = new Set();
  var loadingCaseId = null;

  var STYLE_UNCHK = 'padding:2px 9px;background:linear-gradient(180deg,#FBBF24 0%,#D97706 100%);color:#fff;border:1px solid #B45309;border-radius:3px;font-size:11px;font-weight:700;white-space:nowrap;cursor:pointer';
  var STYLE_UNCHK_EMP = 'padding:2px 9px;background:linear-gradient(180deg,#A78BFA 0%,#6D28D9 100%);color:#fff;border:1px solid #5B21B6;border-radius:3px;font-size:11px;font-weight:700;white-space:nowrap;cursor:pointer';
  var STYLE_CHK = 'padding:2px 9px;background:linear-gradient(180deg,#34D399 0%,#059669 100%);color:#fff;border:1px solid #047857;border-radius:3px;font-size:11px;font-weight:700;white-space:nowrap;cursor:pointer';

  function caseId() {
    var m = (location.pathname || '').match(/\/case\/(\d+)/);
    return m ? m[1] : null;
  }
  function storageKey(cid) { return 'OKURURU_shiwake_pc_' + cid; }

  function buyValue(row) {
    try { return window.OKURURU.utils.selectors.parsePriceValue((window.OKURURU.utils.detector.extractRowPrices(row) || {}).buy); }
    catch (e) { return null; }
  }
  function sellValue(row) {
    try { return window.OKURURU.utils.selectors.parsePriceValue((window.OKURURU.utils.detector.extractRowPrices(row) || {}).sell); }
    catch (e) { return null; }
  }

  function categoryPath(rowText) {
    if (!rowText) return '';
    var txt = String(rowText).replace(/\s+/g, ' ');
    var pdIdx = txt.search(/PD[A-Z0-9]{10,12}/);
    var tail = pdIdx >= 0 ? txt.substring(pdIdx) : txt;
    tail = tail.replace(/\s\-\s\/\s/g, ' / ');
    var cut = tail.match(/^([^\[]+?)(?:\[|買取点数|販売単価|グレード|コンディション)/);
    if (cut) tail = cut[1];
    return tail;
  }

  // 対象＝WGA以外（販売¥1/未入力でない＝実価格あり）
  function needsPriceCheck(row) {
    var sell = sellValue(row);
    if (sell === null || sell === 1) return false; // WGA相当（販売¥1/未入力）は対象外
    var buy = buyValue(row);
    if (buy === 1) return false; // 1円まとめ（買取¥1）は対象外
    return true;
  }

  // 例外＝社員確認が必要
  function needsEmployeeCheck(row) {
    var buy = buyValue(row);
    if (buy != null && buy >= BUY_EMP_THRESHOLD) return true;
    try { if (window.OKURURU.utils.detector.isPreciousMetalRow(row)) return true; } catch (e) { /* noop */ }
    var path = categoryPath(row.textContent || '');
    if (/ブランド\s*品/.test(path)) return true;
    if (/ファッション雑貨/.test(path)) return true;
    return false;
  }

  // 行の安定キー：在庫ID優先、無ければ PDコード＋商品名
  function rowKey(row) {
    var t = (row.textContent || '');
    var m = t.match(/\bID[:：]\s*(\d+)/);
    if (m) return 'id:' + m[1];
    var pd = t.match(/PD[A-Z0-9]{10,12}/);
    var name = '';
    try { name = window.OKURURU.utils.detector.extractRowProductName(row) || ''; } catch (e) { /* noop */ }
    return 'pn:' + (pd ? pd[0] : '') + '|' + name.slice(0, 40);
  }

  function productName(row) {
    try { return window.OKURURU.utils.detector.extractRowProductName(row) || '(商品名なし)'; }
    catch (e) { return '(商品名なし)'; }
  }

  function ensureLoaded() {
    var cid = caseId();
    if (cid === curCaseId) return;
    if (cid === loadingCaseId) return;
    loadingCaseId = cid;
    curCaseId = cid;
    checkedSet = new Set();
    if (!cid) { loadingCaseId = null; return; }
    var k = storageKey(cid);
    window.OKURURU.utils.storage.get(k).then(function (r) {
      var arr = r && r[k];
      if (Array.isArray(arr)) checkedSet = new Set(arr);
      loadingCaseId = null;
      try { if (window.OKURURU.shiwake && window.OKURURU.shiwake.evaluateAll) window.OKURURU.shiwake.evaluateAll(); } catch (e) { /* noop */ }
    });
  }

  function persist() {
    if (!curCaseId) return;
    var o = {};
    o[storageKey(curCaseId)] = Array.from(checkedSet);
    try { window.OKURURU.utils.storage.set(o); } catch (e) { /* noop */ }
  }

  function applyBadgeStyle(b) {
    var checked = b.dataset.checked === '1';
    var emp = b.dataset.emp === '1';
    if (checked) { b.textContent = '☑ 確認済'; b.style.cssText = STYLE_CHK; }
    else if (emp) { b.textContent = '☐ 価格確認 ※社員'; b.style.cssText = STYLE_UNCHK_EMP; }
    else { b.textContent = '☐ 価格確認'; b.style.cssText = STYLE_UNCHK; }
    b.title = emp
      ? '社員確認が必要な商品（買取¥3,000以上/貴金属/ブランド品/ファッション雑貨）。未チェックでも「社員確認なのでOK」で続行できます。クリックでチェック切替。'
      : '価格確認が必要な商品。クリックでチェック切替。全てチェックすると完了できます。';
  }

  function markRow(row, strong) {
    if (!enabled || !row || !strong) return;
    ensureLoaded();
    var R = window.OKURURU.shiwake.rows;

    if (!needsPriceCheck(row)) {
      var eb = R.getExistingMarkBar(strong);
      var ex = eb && eb.querySelector('.' + BADGE_CLASS);
      if (ex) ex.remove();
      return;
    }

    var bar = R.getMarkBar(strong);
    if (!bar) return;
    var key = rowKey(row);
    var emp = needsEmployeeCheck(row);
    var checked = checkedSet.has(key);

    var b = bar.querySelector('.' + BADGE_CLASS);
    if (!b) {
      b = document.createElement('span');
      b.className = BADGE_CLASS;
      b.addEventListener('click', function (ev) {
        ev.preventDefault(); ev.stopPropagation();
        var k = b.dataset.key;
        if (checkedSet.has(k)) checkedSet.delete(k); else checkedSet.add(k);
        b.dataset.checked = checkedSet.has(k) ? '1' : '0';
        applyBadgeStyle(b);
        persist();
        ensureFloatButton();
      });
      bar.appendChild(b);
    }
    b.dataset.key = key;
    b.dataset.emp = emp ? '1' : '0';
    b.dataset.checked = checked ? '1' : '0';
    b.dataset.name = productName(row);
    applyBadgeStyle(b);
  }

  function collectBadges() {
    return Array.prototype.slice.call(document.querySelectorAll('.' + BADGE_CLASS));
  }

  function showToast(msg, color) {
    var t = document.getElementById(TOAST_ID);
    if (!t) {
      t = document.createElement('div'); t.id = TOAST_ID;
      t.style.cssText = 'position:fixed;bottom:84px;right:24px;z-index:100100;background:#fff;border:2px solid #059669;border-radius:8px;padding:10px 14px;font-size:13px;font-weight:700;box-shadow:0 4px 12px rgba(0,0,0,0.2);max-width:340px';
      document.body.appendChild(t);
    }
    t.style.borderColor = color || '#059669'; t.style.color = color || '#065F46'; t.textContent = msg;
    clearTimeout(t._timer);
    t._timer = setTimeout(function () { if (t && t.parentElement) t.parentElement.removeChild(t); }, 4000);
  }

  function listHtml(badges) {
    var items = badges.map(function (b) {
      var nm = (b.dataset.name || '(商品名なし)');
      nm = nm.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
      var tag = b.dataset.emp === '1' ? '<span style="color:#6D28D9;font-weight:700">[社員確認]</span> ' : '';
      return '<li style="margin:3px 0">' + tag + nm + '</li>';
    }).join('');
    return '<ul style="margin:6px 0 0;padding-left:20px;max-height:260px;overflow:auto">' + items + '</ul>';
  }

  function finishOK() {
    showToast('✅ 全商品の価格確認が完了しました', '#059669');
  }

  function runValidation() {
    var badges = collectBadges();
    var total = badges.length;
    if (total === 0) { showToast('価格確認の対象商品がありません', '#2563EB'); return; }

    var uncheckedReq = badges.filter(function (b) { return b.dataset.checked !== '1' && b.dataset.emp !== '1'; });
    var uncheckedEmp = badges.filter(function (b) { return b.dataset.checked !== '1' && b.dataset.emp === '1'; });

    var modal = window.OKURURU.utils.modal;

    if (uncheckedReq.length > 0) {
      var body1 = '<div style="font-size:13px">未チェックの商品が <b style="color:#B45309">' + uncheckedReq.length + ' 件</b> あります。価格を確認してチェックを入れてください。</div>' + listHtml(uncheckedReq);
      if (uncheckedEmp.length > 0) {
        body1 += '<div style="margin-top:8px;font-size:12px;color:#6D28D9">※ 社員確認が必要な商品も ' + uncheckedEmp.length + ' 件あります（社員確認で続行可）。</div>';
      }
      if (modal && modal.showWarningModal) {
        modal.showWarningModal({ title: '⚠ 未チェックの商品があります', body: body1, variant: 'warning', primaryBtn: '戻って確認', secondaryBtn: false });
      } else {
        alert('未チェックの商品があります（' + uncheckedReq.length + '件）。価格を確認してチェックを入れてください。');
      }
      return;
    }

    if (uncheckedEmp.length > 0) {
      var body2 = '<div style="font-size:13px">通常の商品は全てチェック済みです。<br>社員確認が必要な商品が <b style="color:#6D28D9">' + uncheckedEmp.length + ' 件</b> 未チェックです。</div>' + listHtml(uncheckedEmp) + '<div style="margin-top:8px;font-size:12px;color:#6b7280">社員確認が済んでいれば「社員確認なのでOK」で続行できます。</div>';
      if (modal && modal.showWarningModal) {
        modal.showWarningModal({
          title: '社員確認が必要な商品が未チェックです',
          body: body2, variant: 'warning',
          primaryBtn: '社員確認なのでOK', secondaryBtn: '戻る',
          onPrimary: function () { finishOK(); },
          onSecondary: function () { /* 戻る：何もしない */ }
        });
      } else {
        if (confirm('社員確認が必要な商品が ' + uncheckedEmp.length + ' 件未チェックです。社員確認済みとして続行しますか？')) finishOK();
      }
      return;
    }

    finishOK();
  }

  function isCaseDetailPage() {
    var ru = window.OKURURU.shiwake && window.OKURURU.shiwake.rows;
    return ru ? ru.isCaseDetailPage() : /\/(bad\/)?case\/\d+/.test(location.pathname);
  }

  function ensureFloatButton() {
    if (!enabled || !isCaseDetailPage()) {
      var old = document.getElementById(FLOAT_ID);
      if (old && old.parentElement) old.parentElement.removeChild(old);
      return;
    }
    var badges = collectBadges();
    var total = badges.length;
    if (total === 0) {
      var o2 = document.getElementById(FLOAT_ID);
      if (o2 && o2.parentElement) o2.parentElement.removeChild(o2);
      return;
    }
    var checked = badges.filter(function (b) { return b.dataset.checked === '1'; }).length;
    var uncheckedReq = badges.filter(function (b) { return b.dataset.checked !== '1' && b.dataset.emp !== '1'; }).length;

    var btn = document.getElementById(FLOAT_ID);
    if (!btn) {
      btn = document.createElement('button');
      btn.id = FLOAT_ID; btn.type = 'button';
      btn.style.cssText = 'position:fixed;bottom:24px;right:24px;z-index:100050;border:none;border-radius:24px;padding:11px 18px;font-size:14px;font-weight:700;color:#fff;box-shadow:0 4px 14px rgba(0,0,0,0.28);cursor:pointer';
      btn.addEventListener('click', function (ev) { ev.preventDefault(); ev.stopPropagation(); runValidation(); });
      document.body.appendChild(btn);
    }
    var allDone = (uncheckedReq === 0);
    btn.innerHTML = (allDone ? '✅' : '🔍') + ' 価格確認 完了（' + checked + '/' + total + '）';
    btn.style.background = allDone ? 'linear-gradient(180deg,#34D399 0%,#059669 100%)' : 'linear-gradient(180deg,#FBBF24 0%,#D97706 100%)';
    btn.title = allDone ? '全ての価格確認チェックが入っています。クリックで完了確認。' : ('未チェックの価格確認商品が ' + uncheckedReq + ' 件あります。');
  }

  function removeAll() {
    document.querySelectorAll('.' + BADGE_CLASS).forEach(function (e) { e.remove(); });
    var b = document.getElementById(FLOAT_ID); if (b && b.parentElement) b.parentElement.removeChild(b);
    var t = document.getElementById(TOAST_ID); if (t && t.parentElement) t.parentElement.removeChild(t);
  }

  function init() {
    return window.OKURURU.utils.storage.isFeatureEnabled(FEATURE_KEY).then(function (v) {
      enabled = v;
      if (!enabled) { removeAll(); return; }
      ensureLoaded();
    });
  }

  window.OKURURU.features.s9_priceCheck = {
    init: init, markRow: markRow, ensureFloatButton: ensureFloatButton, removeAll: removeAll, FEATURE_KEY: FEATURE_KEY,
    isEnabled: function () { return enabled; },
    setEnabled: function (v) { enabled = v; if (!v) removeAll(); else ensureLoaded(); }
  };
})();
