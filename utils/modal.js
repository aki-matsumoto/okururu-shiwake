/**
 * utils/modal.js (v1.53.1)
 *
 * 警告モーダル汎用UI。
 * showWarningModal({title, body, primaryBtn, secondaryBtn, onPrimary, onSecondary, beginnerNote})
 *
 * v1.53.1: モーダルを開いた時、body スクロール位置を必ず最上部に。
 *   末尾ボタンへの focus() でブラウザが勝手にスクロールし、タイトル/最初の説明が隠れる
 *   現象を解消（bodyEl.scrollTop=0 + focus {preventScroll: true}）。
 */

(function () {
  'use strict';

  if (!window.OKURURU) window.OKURURU = {};
  if (!window.OKURURU.utils) window.OKURURU.utils = {};

  const Z = 100000;

  function el(tag, attrs, children) {
    const e = document.createElement(tag);
    if (attrs) {
      for (const k of Object.keys(attrs)) {
        if (k === 'style' && typeof attrs[k] === 'object') {
          Object.assign(e.style, attrs[k]);
        } else if (k === 'className') {
          e.className = attrs[k];
        } else if (k.startsWith('on') && typeof attrs[k] === 'function') {
          e.addEventListener(k.slice(2).toLowerCase(), attrs[k]);
        } else {
          e.setAttribute(k, attrs[k]);
        }
      }
    }
    if (children) {
      (Array.isArray(children) ? children : [children]).forEach((c) => {
        if (c == null) return;
        if (typeof c === 'string') e.appendChild(document.createTextNode(c));
        else e.appendChild(c);
      });
    }
    return e;
  }

  function showWarningModal(opt) {
    opt = opt || {};
    // v1.62.22: overlay 一意性ガード（クロさん 2026-05-11 ブラックアウト再発報告）。
    //   F2/F25/F36/F38/F3-A 等の保存時チェック feature が同じ「保存」click で各々独立に
    //   showWarningModal を呼ぶと、overlay の rgba(0,0,0,0.45) が 2〜3 枚重なって不透明度
    //   80%+ になり画面真っ黒になる事象（ケース #86345、同一カタログ 63 点で必ず再現）。
    //   v1.61.4〜v1.61.7 で機能側に MODAL_OPEN / isTrusted / overriddenCases の三段ガードを
    //   入れたが、機能間で MODAL_OPEN が共有されない抜け穴が残っていた。
    //   modal util 側で「既に overlay があれば新規表示を抑制」することで完全遮断する。
    //   後発の警告は破棄されるが、ユーザーが「修正する」→ 再保存すれば再評価されるので
    //   情報は失われない。
    //
    // v1.64.4 (2026-05-12): 残置確定。
    //   v1.63.0 の save_check_controller で保存系 feature は単一モーダルに集約されたため、
    //   「保存」click 経由でこのガードが効くケースは原則消えた。
    //   ただし F3a（申込書チェック blur 経路）/ F2 blur / F12 貴金属計算モーダル等、
    //   controller 経由でない独立フローと controller 経由のモーダルが時間差で重なる可能性は
    //   残るので、安全網としてそのまま残す。撤去はしない。
    try {
      if (document.querySelector('.okururu-modal-overlay')) {
        console.warn('[OKURURU] showWarningModal: an overlay is already open, suppressing duplicate', { title: opt.title });
        return null;
      }
    } catch (e) { /* noop */ }
    const variant = opt.variant || 'warning';

    const overlay = el('div', {
      className: 'okururu-modal-overlay',
      style: { zIndex: String(Z) }
    });

    const card = el('div', {
      className: 'okururu-modal-card okururu-modal-' + variant,
      role: 'dialog',
      'aria-modal': 'true'
    });

    const titleEl = el('div', { className: 'okururu-modal-title' }, opt.title || '警告');
    titleEl.classList.add('okururu-modal-drag-handle');

    const closeBtn = el('button', {
      type: 'button',
      className: 'okururu-modal-close',
      'aria-label': '閉じる'
    }, '\u2715');
    titleEl.appendChild(closeBtn);

    (function setupDrag() {
      let dragging = false;
      let startX = 0, startY = 0;
      let originX = 0, originY = 0;
      let initOffsetX = 0, initOffsetY = 0;
      const INTERACTIVE = 'button, input, select, textarea, a, label, summary';
      const parseTranslate = () => {
        const m = /translate\(\s*(-?\d+(?:\.\d+)?)px\s*,\s*(-?\d+(?:\.\d+)?)px/.exec(card.style.transform || '');
        return m ? { x: parseFloat(m[1]), y: parseFloat(m[2]) } : { x: 0, y: 0 };
      };
      const onMouseDown = (ev) => {
        if (ev.button !== 0) return;
        if (ev.target.closest(INTERACTIVE)) return;
        dragging = true;
        const t = parseTranslate();
        initOffsetX = t.x; initOffsetY = t.y;
        startX = ev.clientX; startY = ev.clientY;
        document.body.style.userSelect = 'none';
        ev.preventDefault();
      };
      const onMouseMove = (ev) => {
        if (!dragging) return;
        const dx = ev.clientX - startX;
        const dy = ev.clientY - startY;
        originX = initOffsetX + dx;
        originY = initOffsetY + dy;
        card.style.transform = 'translate(' + originX + 'px, ' + originY + 'px)';
      };
      const onMouseUp = () => {
        if (!dragging) return;
        dragging = false;
        document.body.style.userSelect = '';
      };
      card.addEventListener('mousedown', onMouseDown);
      document.addEventListener('mousemove', onMouseMove);
      document.addEventListener('mouseup', onMouseUp);
      const origRemove = overlay.remove.bind(overlay);
      overlay.remove = function () {
        try {
          document.removeEventListener('mousemove', onMouseMove);
          document.removeEventListener('mouseup', onMouseUp);
        } catch (e) {}
        return origRemove();
      };
    })();

    const bodyEl = el('div', { className: 'okururu-modal-body' });
    if (typeof opt.body === 'string') {
      bodyEl.innerHTML = opt.body;
    } else if (opt.body instanceof HTMLElement) {
      bodyEl.appendChild(opt.body);
    }

    try {
      if (opt.beginnerNote) {
        const note = document.createElement('div');
        note.className = 'okururu-modal-beginner-note';
        note.innerHTML = '<b>\ud83d\udca1 ヒント：</b>' + opt.beginnerNote;
        bodyEl.appendChild(note);
      }
    } catch (e) {}

    const btnRow = el('div', { className: 'okururu-modal-btnrow' });

    const close = () => {
      try { overlay.remove(); } catch (e) {}
    };

    closeBtn.addEventListener('click', function (ev) {
      ev.stopPropagation();
      close();
      try {
        if (opt.onSecondary) opt.onSecondary();
        else if (opt.onClose) opt.onClose();
      } catch (e) {}
    });

    overlay.addEventListener('click', function (ev) {
      if (ev.target !== overlay) return;
      close();
      try {
        if (opt.onSecondary) opt.onSecondary();
        else if (opt.onClose) opt.onClose();
      } catch (e) {}
    });

    const showSecondary = (opt.secondaryBtn !== undefined && opt.secondaryBtn !== null && opt.secondaryBtn !== false && opt.secondaryBtn !== '');
    let secondary = null;
    if (showSecondary) {
      secondary = el('button', {
        type: 'button',
        className: 'okururu-btn okururu-btn-secondary'
      }, opt.secondaryBtn);
      secondary.addEventListener('click', () => {
        close();
        try { opt.onSecondary && opt.onSecondary(); } catch (e) { console.warn('[OKURURU] modal onSecondary error:', e); }
      });
    }

    const primary = el('button', {
      type: 'button',
      className: 'okururu-btn okururu-btn-primary'
    }, opt.primaryBtn || 'このまま保存');
    primary.addEventListener('click', () => {
      close();
      try { opt.onPrimary && opt.onPrimary(); } catch (e) { console.warn('[OKURURU] modal onPrimary error:', e); }
    });

    if (secondary) btnRow.appendChild(secondary);
    btnRow.appendChild(primary);

    card.appendChild(titleEl);
    card.appendChild(bodyEl);
    card.appendChild(btnRow);
    overlay.appendChild(card);

    const onKey = (e) => {
      if (e.key === 'Escape') {
        close();
        try {
          if (secondary) {
            opt.onSecondary && opt.onSecondary();
          } else {
            opt.onPrimary && opt.onPrimary();
          }
        } catch (err) {}
        document.removeEventListener('keydown', onKey, true);
      }
    };
    document.addEventListener('keydown', onKey, true);

    document.body.appendChild(overlay);

    // v1.53.1: モーダルを開いた時、body スクロール位置を必ず最上部に。
    //   旧実装は末尾のボタンに focus() するだけだったため、ブラウザがそのボタンを
    //   見せるためにモーダル内を勝手にスクロールし、タイトル/最初の説明が隠れていた。
    //   解決策：(1) bodyEl.scrollTop = 0、(2) focus に {preventScroll: true}
    setTimeout(() => {
      try { bodyEl.scrollTop = 0; } catch (e) {}
      try { card.scrollTop = 0; } catch (e) {}
      try { (secondary || primary).focus({ preventScroll: true }); } catch (e) {
        try { (secondary || primary).focus(); } catch (_) {}
      }
    }, 0);

    return { close };
  }

  function showInfoModal(opt) {
    opt = opt || {};
    const params = {
      title: opt.title,
      body: opt.body,
      variant: opt.variant || 'info',
      primaryBtn: opt.primaryBtn || 'OK',
      onPrimary: opt.onOK || opt.onClose
    };
    if (opt.secondaryBtn !== undefined) {
      params.secondaryBtn = opt.secondaryBtn;
      params.onSecondary = opt.onClose || opt.onOK;
    }
    return showWarningModal(params);
  }

  window.OKURURU.utils.modal = {
    showWarningModal,
    showInfoModal
  };
})();
