/**
 * utils/storage.js
 *
 * chrome.storage.local の Promise ラッパ。
 * window.OKURURU.utils.storage 名前空間で公開する。
 */

(function () {
  'use strict';

  if (!window.OKURURU) window.OKURURU = {};
  if (!window.OKURURU.utils) window.OKURURU.utils = {};

  /**
   * 拡張機能コンテキストが有効か（reload直後に古いcontent scriptが残ると無効化される）
   */
  function isExtensionContextValid() {
    try {
      return !!(chrome && chrome.runtime && chrome.runtime.id);
    } catch (e) {
      return false;
    }
  }

  /**
   * 「Extension context invalidated」かどうか判定
   */
  function isContextInvalidatedError(e) {
    if (!e) return false;
    const msg = (e.message || String(e)).toLowerCase();
    return msg.includes('extension context invalidated') || msg.includes('context invalidated');
  }

  /**
   * エラーをログするか（コンテキスト無効化は静かに無視）
   */
  function maybeWarn(label, e) {
    if (isContextInvalidatedError(e)) return; // 拡張更新時の正常な無効化はノイズなのでスキップ
    console.warn(label, e);
  }

  const storage = {
    /**
     * @param {string|string[]|object} keys
     * @returns {Promise<object>}
     */
    get(keys) {
      return new Promise((resolve) => {
        if (!isExtensionContextValid()) { resolve({}); return; }
        try {
          chrome.storage.local.get(keys, (items) => {
            const err = chrome.runtime && chrome.runtime.lastError;
            if (err) {
              maybeWarn('[OKURURU] storage.get error:', err);
              resolve({});
            } else {
              resolve(items || {});
            }
          });
        } catch (e) {
          maybeWarn('[OKURURU] storage.get exception:', e);
          resolve({});
        }
      });
    },

    /**
     * @param {object} obj
     * @returns {Promise<boolean>}
     */
    set(obj) {
      return new Promise((resolve) => {
        if (!isExtensionContextValid()) { resolve(false); return; }
        try {
          chrome.storage.local.set(obj, () => {
            const err = chrome.runtime && chrome.runtime.lastError;
            if (err) {
              maybeWarn('[OKURURU] storage.set error:', err);
              resolve(false);
            } else {
              resolve(true);
            }
          });
        } catch (e) {
          maybeWarn('[OKURURU] storage.set exception:', e);
          resolve(false);
        }
      });
    },

    /**
     * @param {string|string[]} keys
     * @returns {Promise<boolean>}
     */
    remove(keys) {
      return new Promise((resolve) => {
        if (!isExtensionContextValid()) { resolve(false); return; }
        try {
          chrome.storage.local.remove(keys, () => resolve(!(chrome.runtime && chrome.runtime.lastError)));
        } catch (e) {
          maybeWarn('[OKURURU] storage.remove exception:', e);
          resolve(false);
        }
      });
    },

    /**
     * 拡張コンテキスト有効性の外部公開
     */
    isContextValid: isExtensionContextValid,

    /**
     * 機能ON/OFF設定を取得
     * @returns {Promise<object>}
     */
    async getFeatures() {
      const r = await storage.get('OKURURU_features');
      return r.OKURURU_features || {};
    },

    /**
     * 個別機能のON/OFF判定
     * @param {string} featureKey
     * @returns {Promise<boolean>}
     */
    async isFeatureEnabled(featureKey) {
      const features = await storage.getFeatures();
      // デフォルトはON（未設定でも機能を有効）
      return features[featureKey] !== false;
    },

    async getThresholds() {
      const r = await storage.get('OKURURU_thresholds');
      return r.OKURURU_thresholds || {};
    }
  };

  window.OKURURU.utils.storage = storage;
})();
