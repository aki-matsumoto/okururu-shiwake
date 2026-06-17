/**
 * utils/selectors.js
 *
 * リコア (ReCORE) 画面のDOMセレクタ集約。
 * config/selectors.json の内容を埋め込みつつ、defensive な検出ヘルパを提供。
 *
 * 注意：name 属性はほぼ無く、value IDも店舗依存のため、テキストマッチ中心の設計とする。
 */

(function () {
  'use strict';

  if (!window.OKURURU) window.OKURURU = {};
  if (!window.OKURURU.utils) window.OKURURU.utils = {};

  // selectors.json と同等の内容をJSとして埋め込む（fetch不要にして読み込み速度を稼ぐ）
  const SELECTORS = {
    pageTypes: {
      casePath: '/case/',
      memberPath: '/member/detail/',
      memberLinkPattern: /\/member\/detail\/(\d+)/
    },
    priceInputs: {
      primary: 'input.form-control.text-right',
      fallbacks: ['input[type="text"].text-right', 'input.text-right']
    },
    gradeOptionTextMatch: ['中古A', '中古B', '中古C', '未使用', '未開封', '開封未使用', '買取不可'],
    conditionTextarea: {
      placeholder: 'コンディション詳細',
      fallbacks: ['textarea[placeholder*="コンディション"]']
    },
    caseMemoTextarea: {
      placeholder: 'ケース全体のメモを入力',
      fallbacks: ['textarea[placeholder*="ケース"]']
    },
    couponOptionTextMatch: ['アップ', 'UP', '送料負担', '10%'],
    saveButton: {
      tag: 'button',
      textMatch: ['保存']
    },
    // ステージ遷移系ボタン（行autosaveのため、行ごとの「保存」は無いが、
    // ケース全体のステージを進めるボタンは存在する。F10 で利用。）
    //
    // v1.32.0 (2026-05-06): textMatch を「査定済みとしてマーク」だけに絞った。
    //   旧マッチには '確定' '承認' '確認済み' などの広いキーワードが含まれており、
    //   「買取を確定する」「確認済みとしてマーク」「査定承認待ち」のような
    //   ASSESSED→CONFIRMED / 自動承認フローのボタンを誤って傍受していた。
    //   F10 が synthetic click を再ディスパッチする過程で「全件キャンセル」
    //   ダイアログが現れる不具合の原因と推測。
    //   F10 本来の目的は「査定済みとしてマーク」前の数量確認なので、
    //   それ以外のステージ遷移ボタンは傍受不要。
    stageButton: {
      tag: 'button',
      textMatch: [
        '査定済みとしてマーク'
      ]
    },
    expiryPlaceholderMatch: ['使用期限', '賞味期限', '期限'],
    catalogSearchInput: {
      placeholder: '商品コード・JAN・ASIN・タイトルで検索',
      fallbacks: ['input[placeholder*="JAN"]']
    },
    quantityInputs: [
      'input[name*="quantity"]',
      'input[name*="count"]',
      'input[placeholder*="数量"]'
    ],
    // v1.46.0：行内の商品メモ textarea（F12/F13 で使用）
    productMemoTextarea: {
      placeholder: '商品メモ',
      fallbacks: ['textarea[placeholder*="商品メモ"]']
    },
    // v1.46.0：ReCORE のタブナビゲーション（F31 で使用）
    tabNav: {
      selectors: ['button.nav-link', 'a.nav-link', 'li.nav-item', '.nav-item']
    },
    // v1.47.0：行内の販売・買取単価 input（pricebox-sell / pricebox-buy）。F4/F12/F13/F17 で使用
    rowPriceInputs: {
      sell: 'input.pricebox-sell, input[class*="pricebox-sell"]',
      buy: 'input.pricebox-buy, input[class*="pricebox-buy"]'
    },
    // v1.47.0：行内のグレード select。findGradeSelects は document 全体検索だが、行限定検索も提供
    rowGradeSelect: {
      selectors: ['select.grade-select', 'select[class*="grade"]', 'select']
    }
  };

  // グレードIDマッピング（reference_recore_grade_ids.md 準拠）
  const GRADE_MAP = {
    1: { name: '新品', rate: null },
    2: { name: '中古A', rate: 0.25 },
    3: { name: '中古B', rate: 0.20 },
    4: { name: '中古C', rate: 0.10 },
    5: { name: '中古D(ジャンク)', rate: null },
    6: { name: '未使用', rate: 0.30 },
    7: { name: '未開封', rate: 0.30 },
    8: { name: '開封未使用', rate: 0.25 },
    9: { name: '買取不可', rate: 0 }
  };

  /**
   * 全価格input要素を取得
   * @param {Element} root
   * @returns {HTMLInputElement[]}
   */
  function findPriceInputs(root) {
    root = root || document;
    const list = [];
    try {
      const primary = root.querySelectorAll(SELECTORS.priceInputs.primary);
      primary.forEach((el) => list.push(el));
      if (list.length === 0) {
        for (const sel of SELECTORS.priceInputs.fallbacks) {
          root.querySelectorAll(sel).forEach((el) => {
            if (!list.includes(el)) list.push(el);
          });
          if (list.length > 0) break;
        }
      }
    } catch (e) {
      console.warn('[OKURURU] findPriceInputs error:', e);
    }
    return list;
  }

  /**
   * グレードselect要素を全取得
   * option text に「中古A」「未使用」「未開封」のいずれかを含むselectをグレードselectとみなす。
   * @param {Element} root
   * @returns {HTMLSelectElement[]}
   */
  function findGradeSelects(root) {
    root = root || document;
    const list = [];
    try {
      const selects = root.querySelectorAll('select');
      selects.forEach((sel) => {
        const opts = Array.from(sel.options || []);
        const texts = opts.map((o) => (o.textContent || '').trim());
        const hit = SELECTORS.gradeOptionTextMatch.some((kw) => texts.some((t) => t.includes(kw)));
        if (hit) list.push(sel);
      });
    } catch (e) {
      console.warn('[OKURURU] findGradeSelects error:', e);
    }
    return list;
  }

  /**
   * select 要素から「現在選択されているグレードID（1-9）」を推定する。
   * value がID数字ならそれを優先。だめならoption textから逆引き。
   * @param {HTMLSelectElement} sel
   * @returns {number|null}
   */
  function detectGradeId(sel) {
    if (!sel) return null;
    try {
      const v = sel.value;
      if (v && /^\d+$/.test(v)) {
        const id = parseInt(v, 10);
        if (GRADE_MAP[id]) return id;
      }
      const text = (sel.options[sel.selectedIndex] || {}).text || '';
      // v1.64.6 (2026-05-12): 名前が長いものから順にマッチ判定。
      //   旧実装は Object.keys 昇順（1,2,...,9）でループ → 「開封未使用」option text が
      //   id=6 の「未使用」に先にマッチして id=6 を返す致命バグ（id=8 が正しい）。
      //   名前長い順にすると「開封未使用(5)」 → 「中古D(ジャンク)(9)」 → 「買取不可(4)」 → ... となり、
      //   部分一致による上位 id の取りこぼしが起きない。
      const sortedIds = Object.keys(GRADE_MAP).sort((a, b) =>
        GRADE_MAP[b].name.length - GRADE_MAP[a].name.length
      );
      for (const idStr of sortedIds) {
        if (text.includes(GRADE_MAP[idStr].name)) return parseInt(idStr, 10);
      }
    } catch (e) {
      console.warn('[OKURURU] detectGradeId error:', e);
    }
    return null;
  }

  /**
   * v1.73.0: ReCORE ヘッダから「現在ログイン中のユーザー名」を取得する。
   *   #page-header 内の `.btn-group` ボタンのうち、隣接 dropdown に
   *   「ログアウト／スタッフ切り替え／ラベル印刷」を含むものを担当者名として返す。
   *   担当者名は popup の OKURURU_user_name に依らず ReCORE 側真実を使うため、
   *   現場が popup 設定を忘れていても自動的に正しい名前が記録される。
   * @returns {string} 担当者名（取れなければ空文字）
   */
  function getRecoreOperatorName() {
    try {
      const header = document.getElementById('page-header');
      if (!header) return '';
      const btnGroups = header.querySelectorAll('.btn-group');
      for (const g of btnGroups) {
        const btn = g.querySelector('button.btn-dual-secondary, button.btn-rounded');
        if (!btn) continue;
        const text = (btn.textContent || '').trim();
        if (!text || text.length > 15) continue;
        if (/店$|店舗$/.test(text)) continue;
        const dropdown = g.querySelector('.dropdown-menu');
        const dropText = (dropdown?.textContent || '').trim();
        if (/ログアウト|スタッフ切り替え|ラベル印刷/.test(dropText)) {
          return text;
        }
      }
    } catch (e) {
      console.warn('[OKURURU] getRecoreOperatorName error:', e);
    }
    return '';
  }

  /**
   * クーポンselectを取得（テキストマッチ）
   * @returns {HTMLSelectElement|null}
   */
  function findCouponSelect(root) {
    root = root || document;
    try {
      const selects = root.querySelectorAll('select');
      for (const sel of selects) {
        const opts = Array.from(sel.options || []);
        const texts = opts.map((o) => (o.textContent || '').trim());
        const hit = SELECTORS.couponOptionTextMatch.some((kw) => texts.some((t) => t.includes(kw)));
        if (hit) return sel;
      }
    } catch (e) {
      console.warn('[OKURURU] findCouponSelect error:', e);
    }
    return null;
  }

  /**
   * 保存ボタン (button, テキスト「保存」を含む) を全取得
   * @returns {HTMLButtonElement[]}
   */
  function findSaveButtons(root) {
    root = root || document;
    const list = [];
    try {
      const btns = root.querySelectorAll(SELECTORS.saveButton.tag);
      btns.forEach((b) => {
        const text = (b.textContent || '').trim();
        if (SELECTORS.saveButton.textMatch.some((kw) => text.includes(kw))) {
          list.push(b);
        }
      });
    } catch (e) {
      console.warn('[OKURURU] findSaveButtons error:', e);
    }
    return list;
  }

  /**
   * 「ステージ遷移ボタン」（申込確定／査定済み等）かどうかを判定
   * 2026-04-28 追加：F10 で行autosave仕様に合わせ、ケース全体のステージ遷移時に
   * 数量再確認モーダルを出す。textMatch に該当 + 「保存」だけのボタンは除外。
   * @param {Element} btn
   * @returns {boolean}
   */
  function isStageButton(btn) {
    if (!btn || btn.tagName !== 'BUTTON') return false;
    try {
      const text = (btn.textContent || '').trim();
      if (!text) return false;
      // 「保存」単独はステージ遷移とみなさない（F10では使わない）
      if (text === '保存' || /^保存$/.test(text)) return false;
      return SELECTORS.stageButton.textMatch.some((kw) => text.includes(kw));
    } catch (e) {
      return false;
    }
  }

  /**
   * ケースメモ textarea
   */
  function findCaseMemoTextarea(root) {
    root = root || document;
    try {
      const t = root.querySelector(`textarea[placeholder="${SELECTORS.caseMemoTextarea.placeholder}"]`);
      if (t) return t;
      for (const sel of SELECTORS.caseMemoTextarea.fallbacks) {
        const x = root.querySelector(sel);
        if (x) return x;
      }
    } catch (e) {
      console.warn('[OKURURU] findCaseMemoTextarea error:', e);
    }
    return null;
  }

  /**
   * コンディション詳細 textarea を全取得
   */
  function findConditionTextareas(root) {
    root = root || document;
    const list = [];
    try {
      const primary = root.querySelectorAll(`textarea[placeholder="${SELECTORS.conditionTextarea.placeholder}"]`);
      primary.forEach((el) => list.push(el));
      if (list.length === 0) {
        for (const sel of SELECTORS.conditionTextarea.fallbacks) {
          root.querySelectorAll(sel).forEach((el) => {
            if (!list.includes(el)) list.push(el);
          });
          if (list.length > 0) break;
        }
      }
    } catch (e) {
      console.warn('[OKURURU] findConditionTextareas error:', e);
    }
    return list;
  }

  /**
   * 期限入力欄を取得
   */
  function findExpiryInputs(root) {
    root = root || document;
    const list = [];
    try {
      const inputs = root.querySelectorAll('input[placeholder]');
      inputs.forEach((inp) => {
        const ph = inp.placeholder || '';
        if (SELECTORS.expiryPlaceholderMatch.some((kw) => ph.includes(kw))) {
          list.push(inp);
        }
      });
    } catch (e) {
      console.warn('[OKURURU] findExpiryInputs error:', e);
    }
    return list;
  }

  /**
   * カタログ検索input
   */
  function findCatalogSearchInput(root) {
    root = root || document;
    try {
      const t = root.querySelector(`input[placeholder="${SELECTORS.catalogSearchInput.placeholder}"]`);
      if (t) return t;
      for (const sel of SELECTORS.catalogSearchInput.fallbacks) {
        const x = root.querySelector(sel);
        if (x) return x;
      }
    } catch (e) {
      console.warn('[OKURURU] findCatalogSearchInput error:', e);
    }
    return null;
  }

  /**
   * 価格 input から数値を抽出 (input[type=text] 前提なので非数字を除去)
   * @param {HTMLInputElement} input
   * @returns {number|null}
   */
  function parsePriceValue(input) {
    if (!input) return null;
    const raw = (input.value || '').toString();
    if (raw.trim() === '') return null;
    const numStr = raw.replace(/[^0-9-]/g, '');
    if (numStr === '' || numStr === '-') return null;
    const n = parseInt(numStr, 10);
    if (isNaN(n)) return null;
    return n;
  }

  /**
   * URLパスからケースIDを抽出。/case/86408 → "86408"
   * @returns {string|null}
   */
  function getCaseIdFromUrl() {
    try {
      const m = location.pathname.match(/\/case\/(\d+)/);
      return m ? m[1] : null;
    } catch (e) {
      return null;
    }
  }

  /**
   * 顧客情報タブ等から /member/detail/XXXX へのリンクを抽出してmemberIdを返す
   * @returns {string|null}
   */
  function getMemberIdFromCasePage() {
    try {
      const links = document.querySelectorAll('a[href*="/member/detail/"]');
      for (const a of links) {
        const m = (a.getAttribute('href') || '').match(SELECTORS.pageTypes.memberLinkPattern);
        if (m) return m[1];
      }
    } catch (e) {
      console.warn('[OKURURU] getMemberIdFromCasePage error:', e);
    }
    return null;
  }

  /**
   * 査定行（tr または カードdiv）を推定取得。
   * 2026-04-28 第4版改訂：商品名 strong を seed にする方式（最も正確）
   *
   * リコアの査定行は以下の構造：
   *   <div class="pl-4 flex-grow-1">                ← 1査定行コンテナ
   *     <div class="d-flex line-height-sm mb-15">  ← 商品名行
   *       <div class="flex-grow-1 text-truncate">
   *         <strong>商品名</strong>                 ← seed要素
   *       </div>
   *     </div>
   *     <div class="d-flex line-height-sm mb-5">   ← 買取エリア（買取点数・買取単価・コンディションタグ）
   *       ...
   *     </div>
   *     <div class="d-flex line-height-sm mb-5">   ← 販売エリア（グレード・販売単価・コンディション詳細）
   *       ...
   *     </div>
   *   </div>
   *
   * 旧戦略は買取エリア・販売エリアそれぞれを別行とカウントしていたため過剰計上していた。
   *
   * @returns {Element[]}
   */
  function findAssessmentRows() {
    // 戦略1: 商品名 strong を seed にして 1査定行 = 1コンテナを取得
    const productStrongs = Array.from(document.querySelectorAll('strong'))
      .filter((s) => {
        if (!s.offsetParent || s.children.length > 0) return false;
        const parent = s.parentElement;
        if (!parent) return false;
        const pcls = (parent.className || '').toString();
        return /text-truncate/.test(pcls);
      });

    if (productStrongs.length > 0) {
      const rows = productStrongs.map((s) => {
        // 1査定行コンテナを優先順に試行
        return s.closest('.pl-4.flex-grow-1') ||
               s.closest('[class*="block-content"]') ||
               s.closest('.d-flex.line-height-sm')?.parentElement ||
               s.parentElement.parentElement;
      }).filter(Boolean);
      // 親子関係重複を排除
      return dedupAncestors(rows);
    }

    // 戦略2: 買取エリア／販売エリアコンテナ（mb-5/mb-15 含めた line-height-sm 系）
    const containers = Array.from(document.querySelectorAll(
      '.d-flex.line-height-sm.mb-5, .line-height-sm.mb-5, [class*="line-height-sm"]'
    )).filter((c) => {
      return c.querySelector(
        'input.form-control.text-right, textarea[placeholder*="コンディション"], select'
      );
    });
    if (containers.length > 0) {
      return dedupAncestors(containers);
    }

    // 戦略3: フォールバック（価格input ベース + 親子関係の重複排除）
    const priceInputs = findPriceInputs(document);
    const candidates = new Set();
    for (const pi of priceInputs) {
      const row = findRowAncestor(pi);
      if (row) candidates.add(row);
    }
    return dedupAncestors(Array.from(candidates));
  }

  /**
   * 親子関係にある要素群から、より深い（具体的な）方を残す
   * 例：[grandparent, parent, child] → [child]
   * @param {Element[]} arr
   * @returns {Element[]}
   */
  function dedupAncestors(arr) {
    return arr.filter((a) => !arr.some((b) => b !== a && a.contains(b)));
  }

  /**
   * 任意要素から「査定行」となる祖先を見つける（リコア対応）
   * 2026-04-28 第3版改訂：
   *  - リコアの査定行は <tr> でも .row でもなく、
   *    `div.d-flex.line-height-sm.mb-5` のような構造になっている
   *  - line-height-sm を含むクラスを「査定行のサマリー単位」として認識する
   *  - tr / row / item / line-height / d-table 行など複数候補を順に試す
   * @param {Element} el
   * @returns {Element|null}
   */
  function findRowAncestor(el) {
    if (!el) return null;
    try {
      // 戦略1: テーブル行
      let row = el.closest('tr');
      if (row) return row;

      // 戦略2: リコアの査定行サマリー（d-flex.line-height-sm.mb-5）
      row = el.closest('.line-height-sm, [class*="line-height-sm"]');
      if (row) return row;

      // 戦略3: row / item / line などの一般的な行class
      row = el.closest('[class*="row"], [class*="item"], [class*="line"]');
      if (row) return row;

      // 戦略4: form-group / block / d-flex などのグループ
      row = el.closest('.form-group, [class*="form-group"], [class*="block-content"]');
      if (row) return row;

      // フォールバック：直近の親
      return el.parentElement;
    } catch (e) {
      return null;
    }
  }

  /**
   * v1.46.0：商品メモ textarea（行内）を探す。F12/F13 が utils 経由で呼ぶ。
   * @param {Element} row
   * @returns {HTMLTextAreaElement|null}
   */
  function findProductMemoTextarea(row) {
    if (!row) return null;
    try {
      const t = row.querySelector(`textarea[placeholder="${SELECTORS.productMemoTextarea.placeholder}"]`);
      if (t) return t;
      for (const sel of SELECTORS.productMemoTextarea.fallbacks) {
        const x = row.querySelector(sel);
        if (x) return x;
      }
    } catch (e) { /* noop */ }
    return null;
  }

  /**
   * v1.46.0：ReCORE のタブナビ（候補）。F31 が utils 経由で呼ぶ。
   * @param {Element} root
   * @returns {Element[]}
   */
  function findTabNavCandidates(root) {
    root = root || document;
    try {
      return Array.from(root.querySelectorAll(SELECTORS.tabNav.selectors.join(', ')));
    } catch (e) {
      return [];
    }
  }

  /**
   * v1.47.0：行内の販売・買取単価 input をペアで取得。
   * F4/F12/F13/F17 が utils 経由で呼ぶ。
   * @param {Element} row
   * @returns {{ sell: HTMLInputElement|null, buy: HTMLInputElement|null }}
   */
  function findRowPriceInputs(row) {
    if (!row) return { sell: null, buy: null };
    try {
      return {
        sell: row.querySelector(SELECTORS.rowPriceInputs.sell),
        buy: row.querySelector(SELECTORS.rowPriceInputs.buy)
      };
    } catch (e) {
      return { sell: null, buy: null };
    }
  }

  /**
   * v1.47.0：行内のグレード select を取得（行限定）。
   * findGradeSelects は document 全体検索だが、こちらは row 限定。
   * @param {Element} row
   * @returns {HTMLSelectElement|null}
   */
  function findRowGradeSelect(row) {
    if (!row) return null;
    try {
      for (const sel of SELECTORS.rowGradeSelect.selectors) {
        const found = row.querySelector(sel);
        if (found && found.tagName === 'SELECT') {
          // 値とテキストでグレード select らしさを確認
          const opts = Array.from(found.options || []);
          const looksLikeGrade = opts.some(o => SELECTORS.gradeOptionTextMatch.some(t => (o.text || '').includes(t)));
          if (looksLikeGrade) return found;
        }
      }
    } catch (e) { /* noop */ }
    return null;
  }

  window.OKURURU.utils.SELECTORS = SELECTORS;
  window.OKURURU.utils.GRADE_MAP = GRADE_MAP;
  window.OKURURU.utils.selectors = {
    findPriceInputs,
    findGradeSelects,
    detectGradeId,
    findCouponSelect,
    getRecoreOperatorName,
    findSaveButtons,
    isStageButton,
    findCaseMemoTextarea,
    findConditionTextareas,
    findExpiryInputs,
    findCatalogSearchInput,
    findProductMemoTextarea,
    findTabNavCandidates,
    findRowPriceInputs,
    findRowGradeSelect,
    parsePriceValue,
    getCaseIdFromUrl,
    getMemberIdFromCasePage,
    findAssessmentRows,
    findRowAncestor
  };
})();
