/**
 * utils/logger.js
 *
 * 拡張機能のローカルログを chrome.storage.local に蓄積する。
 * 個人情報は記録しない（ケースID・機能ID・操作・タイムスタンプのみ）。
 * 月次レビュー用にCSVエクスポート可能。
 */

(function () {
  'use strict';

  if (!window.OKURURU) window.OKURURU = {};
  if (!window.OKURURU.utils) window.OKURURU.utils = {};

  const STORAGE_KEY = 'OKURURU_log';
  const MAX_LOG_ENTRIES = 5000; // chrome.storage.local 10MB制約に対する安全弁

  const logger = {
    /**
     * ログエントリを追加
     * @param {object} entry { feature, action, caseId?, detail? }
     */
    async append(entry) {
      try {
        const r = await window.OKURURU.utils.storage.get(STORAGE_KEY);
        const log = Array.isArray(r[STORAGE_KEY]) ? r[STORAGE_KEY] : [];
        const item = {
          ts: new Date().toISOString(),
          feature: entry.feature || '',
          action: entry.action || '',
          caseId: entry.caseId || '',
          detail: entry.detail ? String(entry.detail).slice(0, 200) : ''
        };
        log.push(item);
        // サイズ制限：古いものから捨てる
        const trimmed = log.length > MAX_LOG_ENTRIES ? log.slice(-MAX_LOG_ENTRIES) : log;
        await window.OKURURU.utils.storage.set({ [STORAGE_KEY]: trimmed });
      } catch (e) {
        console.warn('[OKURURU] logger.append error:', e);
      }
    },

    async getAll() {
      const r = await window.OKURURU.utils.storage.get(STORAGE_KEY);
      return Array.isArray(r[STORAGE_KEY]) ? r[STORAGE_KEY] : [];
    },

    async clear() {
      await window.OKURURU.utils.storage.set({ [STORAGE_KEY]: [] });
    },

    /**
     * CSV文字列を生成
     * @returns {Promise<string>}
     */
    async toCSV() {
      const log = await logger.getAll();
      const header = 'timestamp,feature,action,caseId,detail';
      const rows = log.map((r) => {
        const escape = (s) => '"' + String(s == null ? '' : s).replace(/"/g, '""') + '"';
        return [r.ts, r.feature, r.action, r.caseId, r.detail].map(escape).join(',');
      });
      return [header].concat(rows).join('\n');
    }
  };

  window.OKURURU.utils.logger = logger;
})();
