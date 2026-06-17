/**
 * utils/synthetic_event.js (v1.45.0)
 *
 * 拡張機能内で発火する合成イベント（modal の onPrimary で再 dispatch する click 等）
 * の相互貫通を防ぐ共通マーカー。
 *
 *  背景：
 *   - F10 / F3a / F8 はそれぞれ stage / 保存 ボタンに capture click を attach している
 *   - F10 が PASS_THROUGH 通過のため stage button に再 dispatch すると、
 *     その合成 click は F3a / F8 のキャプチャハンドラにも刺さる
 *   - F10 の WeakSet マーカーは F10 にしか伝わらないため、
 *     F3a / F8 は「これは合成だ」と判定できず、モーダル連鎖発火の余地があった
 *   - F33（v1.39.0で no-op 化）で抑止していたが廃止された分、
 *     共通マーカー方式で再構築する
 *
 *  v1.42.0：input / change にも展開
 *   - F4/F12/F13/F17/F35 等で「ネイティブ setter で値を入れた後に input/change を
 *     発火させる」パターンが多数あったが、これらは共通マーカーが付かないため、
 *     拡張側 capture handler が「ユーザー入力」と区別できなかった。
 *   - dispatchInputChange(target) で input/change を共通マーカー付きで発火するヘルパー追加。
 *
 *  使い方：
 *    const u = window.OKURURU.utils.syntheticEvent;
 *    // 発火側
 *    u.dispatchClick(target);              // 'click' を共通マーカー付きで dispatch
 *    u.dispatch(target, 'change');         // 任意の type
 *    u.dispatchInputChange(target);        // input → change を順に共通マーカー付きで発火
 *    // 受信側（capture handler 内）
 *    if (u.isOkururuSynthetic(ev)) return;
 */

(function () {
  'use strict';

  if (!window.OKURURU) window.OKURURU = {};
  if (!window.OKURURU.utils) window.OKURURU.utils = {};

  // ガード：複数回 import されてもインスタンスは一つに保つ
  if (window.OKURURU.utils.syntheticEvent) return;

  // WeakSet：合成イベントオブジェクト自体を記録する
  //  ※ Event は短命なので WeakSet で十分（参照消失で自動 GC）
  const SYNTHETIC = new WeakSet();

  // フォールバック：MouseEvent 等にプロパティを貼る方式（WeakSet が GC される前に
  //  capture と bubble の両フェーズで参照できるよう、両建て）
  const MARKER = '__okururuSynthetic';

  /**
   * 合成イベントを生成 → ターゲットに dispatch
   * @param {HTMLElement} target
   * @param {string} type  'click' | 'input' | 'change' | 'blur' …
   * @param {EventInit} [init]
   * @returns {boolean} dispatchEvent の戻り値（preventDefault されてなければ true）
   */
  function dispatch(target, type, init) {
    if (!target || typeof target.dispatchEvent !== 'function') return false;
    const opts = Object.assign({ bubbles: true, cancelable: true }, init || {});
    let ev;
    if (type === 'click' || type === 'mousedown' || type === 'mouseup') {
      ev = new MouseEvent(type, opts);
    } else {
      ev = new Event(type, { bubbles: opts.bubbles, cancelable: opts.cancelable });
    }
    try { Object.defineProperty(ev, MARKER, { value: true, enumerable: false, writable: false, configurable: false }); }
    catch (e) { ev[MARKER] = true; }
    SYNTHETIC.add(ev);
    return target.dispatchEvent(ev);
  }

  /** dispatch のショートカット（click 専用） */
  function dispatchClick(target, init) {
    return dispatch(target, 'click', init);
  }

  /**
   * input → change を順に共通マーカー付きで発火する（v1.42.0）。
   * 既存コードの `target.dispatchEvent(new Event('input', { bubbles: true }))`
   * `target.dispatchEvent(new Event('change', { bubbles: true }))` を一括置換用。
   */
  function dispatchInputChange(target) {
    if (!target || typeof target.dispatchEvent !== 'function') return;
    dispatch(target, 'input');
    dispatch(target, 'change');
  }

  /**
   * change → input の順で発火する（v1.42.0）。
   * 旧コードの一部（select 操作）が change 先行で書かれていたため、
   * 既存挙動を完全保存したい場合のヘルパー。通常は dispatchInputChange を使う。
   */
  function dispatchChangeInput(target) {
    if (!target || typeof target.dispatchEvent !== 'function') return;
    dispatch(target, 'change');
    dispatch(target, 'input');
  }

  /**
   * ネイティブ setter で input/textarea/select の value を書き換え、
   * 共通マーカー付きで input/change（必要なら blur）を発火する。
   * v1.45.0：F4/F12/F13/F17/F35 で繰り返されていた「Object.getOwnPropertyDescriptor 経由で
   *   value を入れて dispatchEvent 2 連発」というボイラーを 1 関数に統合。
   *
   * @param {HTMLElement} target  input / textarea / select 要素
   * @param {string|number} value
   * @param {object} [opts]
   *   - events: 'input-change'（既定） | 'change-input'（select 用） |
   *             'input-change-blur'（F4 用）| 'input' | 'change' | 'none'
   *   - silent: true なら events を発火しない（'none' と同義）
   * @returns {boolean} 成功なら true
   */
  function setNativeValue(target, value, opts) {
    if (!target) return false;
    const o = opts || {};
    const events = o.silent ? 'none' : (o.events || 'input-change');
    // ネイティブ setter で値をセット（React/Vue の制御コンポーネント対応）
    try {
      let proto = null;
      if (typeof window.HTMLInputElement !== 'undefined' && target instanceof window.HTMLInputElement) {
        proto = window.HTMLInputElement.prototype;
      } else if (typeof window.HTMLTextAreaElement !== 'undefined' && target instanceof window.HTMLTextAreaElement) {
        proto = window.HTMLTextAreaElement.prototype;
      } else if (typeof window.HTMLSelectElement !== 'undefined' && target instanceof window.HTMLSelectElement) {
        proto = window.HTMLSelectElement.prototype;
      }
      if (proto) {
        const desc = Object.getOwnPropertyDescriptor(proto, 'value');
        if (desc && typeof desc.set === 'function') {
          desc.set.call(target, String(value));
        } else {
          target.value = String(value);
        }
      } else {
        target.value = String(value);
      }
    } catch (e) {
      try { target.value = String(value); } catch (_) { /* noop */ }
    }
    // 合成イベント発火
    switch (events) {
      case 'input-change':       dispatchInputChange(target); break;
      case 'change-input':       dispatchChangeInput(target); break;
      case 'input-change-blur':  dispatchInputChange(target); dispatch(target, 'blur'); break;
      case 'input':              dispatch(target, 'input'); break;
      case 'change':             dispatch(target, 'change'); break;
      case 'none':               /* 何もしない */ break;
      default:                   dispatchInputChange(target); break;
    }
    return true;
  }

  /** イベントがオクルウル拡張機能由来の合成イベントか判定 */
  function isOkururuSynthetic(ev) {
    if (!ev) return false;
    if (SYNTHETIC.has(ev)) return true;
    return ev[MARKER] === true;
  }

  /**
   * 任意の Event オブジェクトに共通マーカーを後付けする（既存コードの段階的移行用）。
   * 例：F10 の旧 PASS_THROUGH WeakSet に追加するときに同時呼び出しすれば
   *     F3a/F8 でも isOkururuSynthetic で検出できる。
   */
  function tagAsSynthetic(ev) {
    if (!ev) return;
    try { Object.defineProperty(ev, MARKER, { value: true, enumerable: false, writable: false, configurable: false }); }
    catch (e) { try { ev[MARKER] = true; } catch (ee) { /* noop */ } }
    SYNTHETIC.add(ev);
  }

  window.OKURURU.utils.syntheticEvent = {
    dispatch,
    dispatchClick,
    dispatchInputChange,
    dispatchChangeInput,
    setNativeValue,
    isOkururuSynthetic,
    tagAsSynthetic
  };
})();
