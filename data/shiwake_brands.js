/**
 * data/shiwake_brands.js
 *
 * 仕分け支援拡張 ブランドマスタ
 *
 *  - DEPACOS39: マッチバンク_デパコス定義_査定基準_v1.2 の H列「Recoreまとめ出品」=〇 の 39 ブランド
 *               → デパコスマーク（🏬 デパコス）対象
 *  - MERCARI_BAN13: メルカリ出品禁止ブランド（固定13・カテゴリ問わず）
 *               → メルカリ禁止マーク（🚫 メルカリ禁止）対象
 *  - 被るブランド（シャネル/ディオール/クレドポー/エルメスB/プラダB/グッチB）は両マークが付く
 *
 *  出典: 2026-06-15 クロさん確定。検出は商品名（strong）テキストの部分一致（大文字化して比較）。
 */
(function () {
  'use strict';
  if (!window.OKURURU) window.OKURURU = {};
  if (!window.OKURURU.data) window.OKURURU.data = {};

  // H列〇 = デパコスまとめ出品対象（39）。patterns は商品名に出やすい英字/カナ表記。
  const DEPACOS39 = [
    // --- Tier 1 ---
    { id: 'chanel', tier: 1,       label: 'CHANEL（シャネル）',           patterns: ['CHANEL', 'シャネル'] },
    { id: 'dior', tier: 1,         label: 'Dior（ディオール）',            patterns: ['CHRISTIAN DIOR', ' DIOR', 'DIOR ', 'ディオール'] },
    { id: 'skii', tier: 1,         label: 'SK-II',                         patterns: ['SK-II', 'SKII', 'SK 2', 'エスケーツー'] },
    { id: 'cpb', tier: 1,          label: 'Clé de Peau Beauté（クレ・ド・ポー）', patterns: ['CLÉ DE PEAU', 'CLE DE PEAU', 'クレ・ド・ポー', 'クレドポー'] },
    { id: 'tomford', tier: 1,      label: 'TOM FORD BEAUTY（トムフォード）', patterns: ['TOM FORD', 'トム フォード', 'トムフォード'] },
    { id: 'hermesbeauty', tier: 1, label: 'HERMÈS BEAUTY（エルメス）',     patterns: ['HERMÈS', 'HERMES', 'エルメス'] },
    { id: 'guerlain', tier: 1,     label: 'GUERLAIN（ゲラン）',            patterns: ['GUERLAIN', 'ゲラン'] },
    { id: 'ysl', tier: 1,          label: 'YVES SAINT LAURENT（イヴ・サンローラン）', patterns: ['YVES SAINT LAURENT', 'YSL ', ' YSL', 'イヴ・サンローラン', 'イヴサンローラン', 'サンローラン'] },
    { id: 'givenchy', tier: 1,     label: 'GIVENCHY（ジバンシイ）',        patterns: ['GIVENCHY', 'ジバンシイ', 'ジバンシィ', 'ジバンシー'] },
    { id: 'bvlgari', tier: 1,      label: 'BVLGARI（ブルガリ）',           patterns: ['BVLGARI', 'BULGARI', 'ブルガリ'] },
    // --- Tier 2 ---
    { id: 'esteelauder',  label: 'ESTÉE LAUDER（エスティ ローダー）', patterns: ['ESTÉE LAUDER', 'ESTEE LAUDER', 'エスティ ローダー', 'エスティローダー'] },
    { id: 'lancome',      label: 'LANCÔME（ランコム）',           patterns: ['LANCÔME', 'LANCOME', 'ランコム'] },
    { id: 'decorte',      label: 'COSME DECORTÉ（コスメデコルテ）', patterns: ['COSME DECORTÉ', 'COSME DECORTE', 'DECORTÉ', 'DECORTE', 'コスメデコルテ', 'デコルテ'] },
    { id: 'shiseido',     label: 'SHISEIDO（資生堂）',            patterns: ['SHISEIDO', '資生堂'] },
    { id: 'albion',       label: 'ALBION（アルビオン）',          patterns: ['ALBION', 'アルビオン'] },
    { id: 'pola',         label: 'POLA（ポーラ）',                patterns: [' POLA', 'POLA ', 'ポーラ'] },
    { id: 'suqqu',        label: 'SUQQU（スック）',               patterns: ['SUQQU', 'スック'] },
    { id: 'kanebo',       label: 'KANEBO（カネボウ）',            patterns: ['KANEBO', 'カネボウ'] },
    { id: 'addiction',    label: 'ADDICTION（アディクション）',   patterns: ['ADDICTION', 'アディクション'] },
    { id: 'lunasol',      label: 'LUNASOL（ルナソル）',           patterns: ['LUNASOL', 'ルナソル'] },
    { id: 'rmk',          label: 'RMK（アールエムケー）',         patterns: [' RMK', 'RMK ', 'アールエムケー'] },
    { id: 'ayura',        label: 'AYURA（アユーラ）',             patterns: ['AYURA', 'アユーラ'] },
    { id: 'mac',          label: 'M·A·C（マック）',               patterns: ['M·A·C', 'M.A.C', ' MAC ', 'MAC ', 'マック '] },
    { id: 'bobbibrown',   label: 'BOBBI BROWN（ボビイ ブラウン）', patterns: ['BOBBI BROWN', 'ボビイ ブラウン', 'ボビイブラウン', 'ボビーブラウン'] },
    { id: 'nars',         label: 'NARS（ナーズ）',                patterns: [' NARS', 'NARS ', 'ナーズ'] },
    { id: 'shuuemura',    label: 'shu uemura（シュウ ウエムラ）', patterns: ['SHU UEMURA', 'シュウ ウエムラ', 'シュウウエムラ'] },
    { id: 'pradabeauty',  label: 'Prada Beauty（プラダ ビューティ）', patterns: ['PRADA BEAUTY', 'プラダ ビューティ', 'プラダビューティ'] },
    { id: 'guccibeauty',  label: 'GUCCI BEAUTY（グッチ ビューティ）', patterns: ['GUCCI BEAUTY', 'グッチ ビューティ', 'グッチビューティ'] },
    { id: 'jomalone',     label: 'JO MALONE LONDON（ジョー マローン）', patterns: ['JO MALONE', 'ジョー マローン', 'ジョーマローン'] },
    { id: 'maquillage',   label: 'MAQUILLAGE（マキアージュ）',     patterns: ['MAQUILLAGE', 'マキアージュ'] },
    // --- Tier 3 ---
    { id: 'jillstuart',   label: 'JILL STUART（ジル スチュアート）', patterns: ['JILL STUART', 'ジル スチュアート', 'ジルスチュアート'] },
    { id: 'pauljoe',      label: 'PAUL & JOE BEAUTÉ（ポール&ジョー）', patterns: ['PAUL & JOE', 'PAUL&JOE', 'ポール&ジョー', 'ポール＆ジョー', 'ポールアンドジョー'] },
    { id: 'loccitane',    label: "L'OCCITANE（ロクシタン）",       patterns: ["L'OCCITANE", 'LOCCITANE', 'ロクシタン'] },
    { id: 'aesop',        label: 'AESOP（イソップ）',             patterns: ['AESOP', 'イソップ'] },
    { id: 'kiehls',       label: "KIEHL'S（キールズ）",            patterns: ["KIEHL'S", 'KIEHLS', 'キールズ'] },
    { id: 'clarins',      label: 'CLARINS（クラランス）',         patterns: ['CLARINS', 'クラランス'] },
    // --- 対象外区分だが まとめ出品〇 ---
    { id: 'bodyshop',     label: 'THE BODY SHOP（ザ・ボディショップ）', patterns: ['THE BODY SHOP', 'BODY SHOP', 'ボディショップ', 'ザボディショップ'] },
    { id: 'lush',         label: 'LUSH（ラッシュ）',               patterns: ['LUSH'], anti: ['BLUSH', 'PLUSH', 'SLUSH', 'FLUSH'] }, // 'ラッシュ'はアイラッシュ等と衝突→不採用、'LUSH'はBLUSH等をantiで除外
    { id: 'fancl',        label: 'FANCL／無印良品コスメ',          patterns: ['FANCL', 'ファンケル', '無印良品'] },
    { id: 'tatcha',       label: 'Tatcha／Drunk Elephant／The Ordinary', patterns: ['TATCHA', 'タッチャ', 'DRUNK ELEPHANT', 'ドランクエレファント', 'THE ORDINARY', 'ジ・オーディナリー', 'オーディナリー'] },
    { id: 'elixir',       label: 'エリクシール 等（資生堂DS）',    patterns: ['ELIXIR', 'エリクシール'] }, // マキアージュは独立エントリ化、'HAKU'/'ハク'は美白誤一致のため不採用
    // --- 別カテゴリだが まとめ出品〇 ---
    { id: 'lelabo',       label: 'LE LABO（ル ラボ）',            patterns: ['LE LABO', 'ル ラボ', 'ルラボ'] },
    { id: 'margiela',     label: 'Maison Margiela REPLICA（マルジェラ レプリカ）', patterns: ['MAISON MARGIELA', 'MARGIELA', 'REPLICA', 'マルジェラ', 'レプリカ'] },
    { id: 'diptyque',     label: 'DIPTYQUE（ディプティック）',    patterns: ['DIPTYQUE', 'ディプティック'] }
  ];

  // メルカリ出品禁止（固定13・カテゴリ問わず）
  const MERCARI_BAN13 = [
    { id: 'armani',    label: 'ARMANI（アルマーニ）',            patterns: ['ARMANI', 'アルマーニ'] },
    { id: 'vancleef',  label: 'Van Cleef & Arpels（ヴァンクリーフ&アーペル）', patterns: ['VAN CLEEF', 'ヴァン クリーフ', 'ヴァンクリーフ', 'ヴァンクリ'] },
    { id: 'hermes',    label: 'HERMÈS（エルメス）',              patterns: ['HERMÈS', 'HERMES', 'エルメス'] },
    { id: 'gucci',     label: 'GUCCI（グッチ）',                 patterns: ['GUCCI', 'グッチ'] },
    { id: 'coach',     label: 'COACH（コーチ）',                 patterns: ['COACH', 'コーチ'] },
    { id: 'northface', label: 'THE NORTH FACE（ザ・ノース・フェイス）', patterns: ['NORTH FACE', 'ノースフェイス', 'ノース フェイス'] },
    { id: 'chanel', tier: 1,    label: 'CHANEL（シャネル）',              patterns: ['CHANEL', 'シャネル'] },
    { id: 'nike',      label: 'NIKE（ナイキ）',                  patterns: ['NIKE', 'ナイキ'] },
    { id: 'prada',     label: 'PRADA（プラダ）',                 patterns: ['PRADA', 'プラダ'] },
    { id: 'lv',        label: 'LOUIS VUITTON（ルイ・ヴィトン）',  patterns: ['LOUIS VUITTON', 'ルイヴィトン', 'ルイ・ヴィトン', 'ヴィトン'] },
    { id: 'dior', tier: 1,      label: 'Dior（ディオール）',              patterns: ['DIOR', 'ディオール'] },
    { id: 'cpb', tier: 1,       label: 'Clé de Peau Beauté（クレ・ド・ポー）', patterns: ['CLÉ DE PEAU', 'CLE DE PEAU', 'クレ・ド・ポー', 'クレドポー'] },
    { id: 'elegance',  label: 'Elegance（エレガンス）',          patterns: ['ELEGANCE', 'エレガンス'] }
  ];

  // v0.7.0: H欄〇でないのに広い親会社名パターン（資生堂/カネボウ）で誤ってデパコス判定される
  //   量販/ドラッグストアブランドを除外（クロさん 2026-06-17：同ブランド内でも量販店のものは省く）。
  //   ※査定拡張(okuruuru-mistake-prevention)の EXCLUDE_PATTERNS と同一分類で統一。
  const EXCLUDE_DEPACOS = [
    'ウーノ', 'アクアレーベル', 'AQUALABEL',
    'Dプログラム', 'D プログラム', 'dプログラム', 'd プログラム', 'D PROGRAM', 'D-PROGRAM',
    '専科', 'マシェリ', 'フィーノ', 'イハダ', 'IHADA',
    'インテグレート', 'INTEGRATE', 'マジョリカ', 'MAJOLICA', 'プリオール', 'ドゥーエ', 'ツバキ', 'TSUBAKI', 'アネッサ', 'ANESSA',
    'ケイト', 'KATE', 'ヴィセ', 'VISEE', 'セザンヌ', 'CEZANNE', 'キュレル', 'CUREL',
    'メディア', 'フリープラス', 'FREEPLUS', 'スイサイ', 'SUISAI', 'アリィー', 'ALLIE', 'エビータ', 'EVITA'
  ];
  function isExcludedFromDepacos(name) {
    if (!name) return false;
    const u = String(name).toUpperCase();
    for (const p of EXCLUDE_DEPACOS) { if (u.indexOf(p.toUpperCase()) !== -1) return true; }
    return false;
  }

  function matchBrand(productName, list) {
    if (!productName || typeof productName !== 'string') return null;
    const upper = productName.toUpperCase();
    for (const b of list) {
      let hit = false;
      for (const p of b.patterns) { if (upper.indexOf(p.toUpperCase()) !== -1) { hit = true; break; } }
      if (!hit) continue;
      if (b.anti && b.anti.some((a) => upper.indexOf(a.toUpperCase()) !== -1)) continue; // 除外語が含まれればこのブランドは不一致
      return b;
    }
    return null;
  }

  window.OKURURU.data.shiwakeBrands = {
    DEPACOS39,
    MERCARI_BAN13,
    detectDepacos: (name) => isExcludedFromDepacos(name) ? null : matchBrand(name, DEPACOS39),
    detectMercariBan: (name) => matchBrand(name, MERCARI_BAN13),
    counts: { depacos: DEPACOS39.length, ban: MERCARI_BAN13.length }
  };
})();
