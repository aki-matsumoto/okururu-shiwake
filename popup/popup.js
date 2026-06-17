(function () {
  'use strict';
  const KEY = 'OKURURU_features';

  function getFeatures() {
    return new Promise((resolve) => {
      chrome.storage.local.get([KEY], (r) => resolve((r && r[KEY]) || {}));
    });
  }
  function setFeature(key, value) {
    return new Promise((resolve) => {
      chrome.storage.local.get([KEY], (r) => {
        const f = (r && r[KEY]) || {};
        f[key] = value;
        chrome.storage.local.set({ [KEY]: f }, resolve);
      });
    });
  }

  document.addEventListener('DOMContentLoaded', async () => {
    const features = await getFeatures();
    document.querySelectorAll('input[data-key]').forEach((cb) => {
      const k = cb.getAttribute('data-key');
      cb.checked = features[k] !== false; // 既定 ON
      cb.addEventListener('change', () => setFeature(k, cb.checked));
    });
  });
})();
