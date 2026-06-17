/**
 * utils/detector.js
 *
 * ページタイプ判定・編集モード判定など共通検出ロジック。
 * v1.53.0: extractRowProductName / extractRowQuantity を実 DOM パターンに合わせて修正。
 */

(function () {
  'use strict';

  if (!window.OKURURU) window.OKURURU = {};
  if (!window.OKURURU.utils) window.OKURURU.utils = {};

  /**
   * 貴金属カテゴリ breadcrumb（F11/F12/F17 と同期）。
   *
   * v1.64.26 (2026-05-15) 拡張：クロさん指示「貴金属すべて対応お願い」。
   *   従来は `貴金属\s*>` `^貴金属\s` `>\s*地金` の 3 パターンのみで、地金以外の leaf 表示
   *   （「/ - / リング」「/ - / ネックレス」等）を取りこぼす可能性があった。
   *
   * v1.64.27 (2026-05-15) hotfix：境界文字に `・`（U+30FB）/ `･`（U+FF65）を追加。
   *   理由：複合カテゴリ名（例「ゲーム・ホビー・おもちゃ」）で `・` 連結語の境界判定が
   *   できず、ホビー類で取りこぼしが発生していた。同じ事象は貴金属判定でも `コイン・メダル`
   *   等で起こりうるため、PRECIOUS_CATEGORY_RE / NON_PRECIOUS_CATEGORY_RE 両方で対応。
   *
   * 前後境界：^/$/>/／/空白/スラッシュ/・/･。
   */
  const PRECIOUS_CATEGORY_RE = /(?:^|[>\/／\s・･])\s*貴金属(?:\s|[<>\/／・･]|$)|(?:^|[>\/／\s・･])\s*地金(?:\s|[<>\/／・･]|$)/;

  /**
   * 非貴金属カテゴリ breadcrumb。商品名に「プラチナ」「シルバー」「ゴールド」等の
   * 色・成分表記があっても、このカテゴリでは貴金属とみなさない。
   *
   * v1.64.26 (2026-05-15): クロさん指示で新設。
   *   コスメ商品の名前に「プラチナ」「シルバー」が含まれていて F12 貴金属計算 /
   *   F7 ITコード貼付対象 が誤発火する問題への対策。
   *
   * v1.64.27 (2026-05-15) hotfix：
   *   ・現場報告「ゲーム・ホビー・おもちゃ > フィギュア」のフィギュア商品名「スタープラチナ」
   *     で誤発火し続けていた。原因は (1) 境界文字に `・` が無いため `ゲーム・ホビー・おもちゃ`
   *     の構成語がマッチしない、(2) 辞書に「おもちゃ」「フィギュア」が無い、の 2 つ。
   *   ・修正：境界文字に `・`/`･` を追加、辞書に「おもちゃ」「フィギュア」「ぬいぐるみ」
   *     「プラモデル」「コレクション」「トレカ」「カード」「ボードゲーム」「ミニカー」
   *     「鉄道模型」を追加。
   *
   * 対象カテゴリ：
   *   - 化粧品 / コスメ → プラチナイオン化粧水・シルバーパウダー等の色・成分名で誤発火
   *   - 香水 / フレグランス → 同上
   *   - スマートフォン・タブレット → モデル色名で「シルバー」「ゴールド」多数
   *   - 家電 → カラーバリエーション
   *   - ファッション雑貨 → バッグ金具色等
   *   - 食品 / サプリ / 玩具 / おもちゃ / ホビー / フィギュア / プラモデル / トレカ / ボードゲーム
   *   - 文房具 / 生活雑貨 / 本・CD・DVD・ゲーム / 楽器
   *
   * 前後境界（^/>/space/slash/・/･, $/>/space/slash/・/･）でマッチ。
   * 「・」は U+30FB／U+FF65（半角中黒）両方許容。
   */
  const NON_PRECIOUS_CATEGORY_RE = /(?:^|[>\/／\s・･])\s*(?:化粧品|コスメ|香水|フレグランス|スマートフォン[・･]タブレット|家電|ファッション雑貨|衣類|衣料|アパレル|食品|サプリ|玩具|おもちゃ|ホビー|フィギュア|ぬいぐるみ|プラモデル|コレクション|トレカ|ボードゲーム|ミニカー|鉄道模型|文房具|キッチン|生活雑貨|日用品|書籍|本\s|CD|DVD|ゲーム|楽器)(?:\s|[<>\/／・･]|$)/;

  const detector = {
    detectPageType() {
      const path = location.pathname || '';
      if (path.includes('/case/')) return 'case';
      if (path.includes('/member/detail/')) return 'member';
      return 'other';
    },

    isEditableMode() {
      const inputs = window.OKURURU.utils.selectors.findPriceInputs(document);
      return inputs.length > 0;
    },

    extractRowPrices(row) {
      const sels = window.OKURURU.utils.selectors;
      if (sels && typeof sels.findRowPriceInputs === 'function') {
        const r = sels.findRowPriceInputs(row);
        if (r && r.sell && r.buy) return r;
      }
      const inputs = sels.findPriceInputs(row);
      if (inputs.length === 0) return { sell: null, buy: null };
      let sell = null, buy = null;
      for (const inp of inputs) {
        const label = detector.findLabelText(inp);
        if (/点数|数量|個数/.test(label)) continue;
        if (!/単価|価格/.test(label)) continue;
        if (!sell && /販売/.test(label) && !/買取/.test(label)) {
          sell = inp;
          continue;
        }
        if (!buy && /買取/.test(label) && !/販売/.test(label)) {
          buy = inp;
          continue;
        }
      }
      return { sell, buy };
    },

    findLabelText(el) {
      const LABEL_SELECTOR = 'label, .form-label, .col-form-label, strong, .label-strong';
      try {
        let prev = el.previousElementSibling;
        while (prev) {
          if (prev.matches(LABEL_SELECTOR)) {
            return (prev.textContent || '').trim();
          }
          prev = prev.previousElementSibling;
        }
        let cur = el;
        for (let i = 0; i < 5 && cur; i++) {
          const parent = cur.parentElement;
          if (!parent) break;
          if (parent.tagName === 'TD') {
            const tr = parent.closest('tr');
            const idx = Array.prototype.indexOf.call(tr.children, parent);
            const headRow = tr.closest('table') ? tr.closest('table').querySelector('thead tr') : null;
            const th = headRow ? headRow.children[idx] : null;
            if (th) {
              const txt = (th.textContent || '').trim();
              if (txt) return txt;
            }
          }
          let parentPrev = parent.previousElementSibling;
          while (parentPrev) {
            if (parentPrev.matches(LABEL_SELECTOR)) {
              return (parentPrev.textContent || '').trim();
            }
            parentPrev = parentPrev.previousElementSibling;
          }
          const labels = parent.querySelectorAll(LABEL_SELECTOR);
          let nearestLabel = null;
          for (const lbl of labels) {
            const pos = lbl.compareDocumentPosition(el);
            if (pos & Node.DOCUMENT_POSITION_FOLLOWING) {
              nearestLabel = lbl;
            }
          }
          if (nearestLabel) {
            const txt = (nearestLabel.textContent || '').trim();
            if (txt && txt.length > 1 && !/^(点|円|個|枚|本)$/.test(txt)) {
              return txt;
            }
          }
          cur = parent;
        }
      } catch (e) { /* noop */ }
      return '';
    },

    extractRowGradeSelect(row) {
      const sels = window.OKURURU.utils.selectors.findGradeSelects(row);
      return sels.length > 0 ? sels[0] : null;
    },

    extractRowConditionTextarea(row) {
      const list = window.OKURURU.utils.selectors.findConditionTextareas(row);
      return list.length > 0 ? list[0] : null;
    },

    extractRowGradeId(row) {
      const sel = detector.extractRowGradeSelect(row);
      if (!sel) return null;
      return window.OKURURU.utils.selectors.detectGradeId(sel);
    },

    /**
     * 行から商品名を推定。
     * v1.53.0: リコアの商品名 <strong>（.text-truncate strong）を優先。
     *   従来は input[placeholder*="商品"] のみで、F10 で「(商品名なし)」が並ぶ問題があった。
     */
    extractRowProductName(row) {
      try {
        const strongs = row.querySelectorAll('.text-truncate strong, [class*="text-truncate"] strong');
        for (const s of strongs) {
          if (s.children.length === 0) {
            const txt = (s.textContent || '').trim();
            if (txt && txt.length >= 2 && txt.length < 200) return txt;
          }
        }
        const allStrongs = row.querySelectorAll('strong');
        for (const s of allStrongs) {
          if (s.children.length > 0) continue;
          const txt = (s.textContent || '').trim();
          if (!txt || txt.length < 3) continue;
          if (/^(買取|販売|単価|点数|数量|個数|グレード|コンディション|ITコード|商品コード)/.test(txt)) continue;
          if (txt.length < 200) return txt;
        }
        const inp = row.querySelector('input[placeholder*="商品"]') || row.querySelector('input[type="text"]');
        if (inp && inp.value) return inp.value.trim();
      } catch (e) { /* noop */ }
      return '';
    },

    /**
     * 数量を推定取得。失敗時は 1 を返す（数量なしの行の安全側）。
     * v1.53.0: リコアの DOM 順 [買取点数, 買取単価, 販売単価] パターンを追加。
     *   従来は SELECTORS.quantityInputs のみで、F10 で「総点数=行数」になっていた。
     */
    extractRowQuantity(row) {
      try {
        const sels = window.OKURURU.utils.SELECTORS.quantityInputs;
        for (const s of sels) {
          const inp = row.querySelector(s);
          if (inp && inp.value) {
            const n = parseInt(inp.value.replace(/[^0-9]/g, ''), 10);
            if (!isNaN(n) && n > 0) return n;
          }
        }
        const inputs = row.querySelectorAll('input.form-control.text-right');
        if (inputs.length >= 3) {
          const qtyInput = inputs[0];
          if (qtyInput && qtyInput.value) {
            const n = parseInt(qtyInput.value.replace(/[^0-9]/g, ''), 10);
            if (!isNaN(n) && n > 0) return n;
          }
        }
      } catch (e) { /* noop */ }
      return 1;
    },

    isPreciousMetal(text) {
      if (!text) return false;
      const kw = [
        'K9', 'K10', 'K12', 'K14', 'K15', 'K16', 'K17', 'K18', 'K20', 'K21', 'K22', 'K24',
        'Pt1000', 'Pt950', 'Pt900', 'Pt850', 'PT1000', 'PT950', 'PT900', 'PT850',
        'プラチナ', '純金', '金製',
        'SV925', 'SV950', 'SV1000', 'SV900', '925', '銀製', '純銀',
        'シルバー', 'スターリング', 'スターリングシルバー',
        'Pd', 'Pd900', 'Pd950', 'Pd1000', 'Pd850', 'パラジウム'
      ];
      return kw.some((k) => text.includes(k));
    },

    /**
     * v1.64.27 (2026-05-15): 行 breadcrumb 「カテゴリが貴金属の時だけ」貴金属と判定する。
     *
     * 背景：
     *   v1.64.26 ではカテゴリ不明時に商品名キーワード（isPreciousMetal）にフォールバック
     *   していたが、「スタープラチナ」（ジョジョのキャラ名）のようなフィギュア商品名で
     *   「プラチナ」が誤マッチして発火し続けていた。クロさん 2026-05-15 指示：
     *   「貴金属ボタンを出すのは、カテゴリが貴金属の時だけにして」。
     *
     * 新ロジック：
     *   - breadcrumb に「貴金属」（全サブカテゴリ）または leaf-only「地金」が現れる → true
     *   - それ以外（非貴金属カテゴリ／breadcrumb 不明／商品名のみキーワード）→ すべて false
     *
     * NON_PRECIOUS_CATEGORY_RE は本関数では未使用になったが、他のフィルタ用途で残置。
     *
     * @param {Element} row 査定行要素
     * @returns {boolean}
     */
    isPreciousMetalRow(row) {
      try {
        if (!row) return false;
        const rowText = (row.textContent || '');
        return PRECIOUS_CATEGORY_RE.test(rowText);
      } catch (e) { return false; }
    },

    extractRowConditionDetail(row) {
      try {
        const ta = detector.extractRowConditionTextarea(row);
        if (!ta) return '';
        return (ta.value || '').trim();
      } catch (e) { /* noop */ }
      return '';
    },

    getKycStatus(root) {
      try {
        root = root || document;
        const text = (root === document ? document.body.innerText : root.innerText) || '';
        const lines = text.split('\n').filter((l) => l.includes('本人確認'));
        const joined = lines.join(' ');
        if (/本人確認.*未|本人確認.*NG|未確認/.test(joined)) return 'ng';
        if (/必要なし|確認済|本人確認.*済/.test(joined)) return 'ok';
      } catch (e) { /* noop */ }
      return 'unknown';
    },

    getTotalAssessmentAmount(root) {
      try {
        root = root || document;
        const u = window.OKURURU.utils;
        const rows = u.selectors.findAssessmentRows();
        let total = 0;
        let any = false;
        rows.forEach((row) => {
          const qty = detector.extractRowQuantity(row);
          const { buy } = detector.extractRowPrices(row);
          const buyV = u.selectors.parsePriceValue(buy);
          if (buyV != null && buyV > 0) {
            total += buyV * qty;
            any = true;
          }
        });
        if (any) return total;
        const targetLabels = ['買取合計', '買取小計', '査定額合計', '査定金額合計', '合計金額'];
        const candidates = Array.from(root.querySelectorAll('label, strong, .form-label, span'))
          .filter((e) => e.offsetParent !== null && targetLabels.includes((e.textContent || '').trim()));
        for (const lbl of candidates) {
          let scope = lbl.parentElement;
          for (let i = 0; i < 3 && scope; i++) {
            const inner = scope.innerText || scope.textContent || '';
            const filtered = inner.replace(lbl.textContent || '', '');
            const m = filtered.match(/[¥￥]\s*([0-9,]+)|([0-9,]+)\s*円/);
            if (m) {
              const numStr = (m[1] || m[2] || '').replace(/,/g, '');
              const n = parseInt(numStr, 10);
              if (!isNaN(n) && n > 0) return n;
            }
            scope = scope.parentElement;
          }
        }
        const text = (root === document ? document.body.innerText : root.innerText) || '';
        const strictRe = /(?:買取合計|買取小計|査定額合計|査定金額合計|合計金額)\s*[:：]?\s*[¥￥]?\s*([0-9,]+)/;
        const sm = text.match(strictRe);
        if (sm) {
          const n = parseInt(sm[1].replace(/,/g, ''), 10);
          if (!isNaN(n) && n > 0) return n;
        }
      } catch (e) { /* noop */ }
      return null;
    },

    extractRowQuantityInput(row) {
      try {
        const sels = window.OKURURU.utils.SELECTORS.quantityInputs;
        for (const s of sels) {
          const inp = row.querySelector(s);
          if (inp) return inp;
        }
        const inputs = row.querySelectorAll('input.form-control.text-right');
        if (inputs.length >= 3) return inputs[0];
      } catch (e) { /* noop */ }
      return null;
    }
  };

  window.OKURURU.utils.detector = detector;
})();
