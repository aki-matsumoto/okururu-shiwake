/**
 * utils/badge.js
 *
 * バッジUI汎用。画面上部または任意要素の隣に表示できる。
 * 閉じるボタン（×）クリックで一時非表示（ケースID単位で記憶）。
 *
 * v1.54.1 (2026-05-08): 同 ID 既存ありなら DOM ノードを reuse して innerHTML だけ更新。
 *   旧版は exist.remove() → 新規 createElement → host.appendChild で末尾に移動するため、
 *   F3-A と F21 のように複数バッジが並ぶ場合、refresh のたびに並び順が入れ替わって
 *   F21 バッジが上下にちらつく（点滅）現象が発生していた（クロさん報告）。
 *   reuse することで wrap の DOM 位置を固定し、host.appendChild による末尾移動を防止する。
 */

(function () {
  'use strict';

  if (!window.OKURURU) window.OKURURU = {};
  if (!window.OKURURU.utils) window.OKURURU.utils = {};

  function showBadge(opt) {
    opt = opt || {};
    const id = opt.id || ('okururu-badge-' + Date.now());
    const level = opt.level || 'info';
    const slot = opt.slot || 'top';
    const wantClass = 'okururu-badge okururu-badge-' + level + ' okururu-badge-' + slot;

    // v1.54.1: 同 ID 既存ありなら reuse
    const exist = document.getElementById(id);
    if (exist) {
      if (exist.className !== wantClass) exist.className = wantClass;
      const existContent = exist.querySelector('.okururu-badge-content');
      if (existContent && typeof opt.html === 'string') existContent.innerHTML = opt.html;
      const existClose = exist.querySelector('.okururu-badge-close');
      if (existClose && opt.onClose) {
        // 旧ハンドラーを置き換え
        const fresh = existClose.cloneNode(true);
        existClose.replaceWith(fresh);
        fresh.addEventListener('click', async () => {
          try { await opt.onClose(); } catch (e) { /* noop */ }
          try { exist.remove(); } catch (e) { /* noop */ }
        });
      }
      return exist;
    }

    const wrap = document.createElement('div');
    wrap.id = id;
    wrap.className = wantClass;

    const content = document.createElement('div');
    content.className = 'okururu-badge-content';
    if (opt.html) content.innerHTML = opt.html;

    const closeBtn = document.createElement('button');
    closeBtn.type = 'button';
    closeBtn.className = 'okururu-badge-close';
    closeBtn.setAttribute('aria-label', '閉じる');
    closeBtn.textContent = '×';
    closeBtn.addEventListener('click', async () => {
      try { if (opt.onClose) await opt.onClose(); } catch (e) { /* noop */ }
      try { wrap.remove(); } catch (e) { /* noop */ }
    });

    wrap.appendChild(content);
    wrap.appendChild(closeBtn);

    if (opt.slot === 'inline' && opt.anchor && opt.anchor.parentElement) {
      opt.anchor.parentElement.insertBefore(wrap, opt.anchor.nextSibling);
    } else {
      let host = document.getElementById('okururu-badge-host');
      if (!host) {
        host = document.createElement('div');
        host.id = 'okururu-badge-host';
        host.className = 'okururu-badge-host';
        document.body.appendChild(host);
      }
      host.appendChild(wrap);
    }
    return wrap;
  }

  function showRowBadge(rowEl, opt) {
    if (!rowEl) return null;
    return showBadge(Object.assign({}, opt, { slot: 'inline', anchor: rowEl.firstElementChild || rowEl }));
  }

  function removeBadge(id) {
    const e = document.getElementById(id);
    if (e) e.remove();
  }

  function highlightField(el, level) {
    if (!el) return function () {};
    const cls = 'okururu-highlight-' + (level || 'warning');
    el.classList.add(cls);
    return function () { el.classList.remove(cls); };
  }

  function clearAllHighlights() {
    ['warning', 'danger', 'info'].forEach(function (lv) {
      document.querySelectorAll('.okururu-highlight-' + lv).forEach(function (e) {
        e.classList.remove('okururu-highlight-' + lv);
      });
    });
  }

  window.OKURURU.utils.badge = {
    showBadge: showBadge,
    showRowBadge: showRowBadge,
    removeBadge: removeBadge,
    highlightField: highlightField,
    clearAllHighlights: clearAllHighlights
  };
})();
