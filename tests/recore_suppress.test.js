'use strict';
// node-only：リコアマーク除外判定（中古C以下 × 買取¥1以下）の境界テスト
const path = require('path');
global.window = {};
require(path.resolve(__dirname, '..', 'utils', 'selectors.js'));
require(path.resolve(__dirname, '..', 'content', 's1_oroshi_recore_mark.js'));
const GM = global.window.OKURURU.utils.GRADE_MAP;
const s1 = global.window.OKURURU.features.s1_oroshiRecoreMark;
const idOf = (name) => Number(Object.keys(GM).find((k) => GM[k].name === name));
let fail = 0;
function chk(gradeName, price, exp) {
  const got = s1.shouldSuppressRecore(gradeName == null ? null : idOf(gradeName), price);
  const ok = got === exp;
  if (!ok) fail++;
  console.log((ok ? 'PASS' : 'FAIL') + ' | grade=' + gradeName + ' price=' + JSON.stringify(price) + ' -> ' + (got ? '外す' : '付ける'));
}
const SUP = ['中古C', '中古D(ジャンク)'];
const KEEP = ['中古B', '中古A', '新品', '未使用', '未開封', '開封未使用', '買取不可'];
const PRICES = [[0, true], [1, true], [1.5, false], [2, false], ['', false], [null, false],
  ['0', true], ['1', true], ['1.5', false], ['2', false], ['¥1', true], ['1,000', false], ['abc', false]];
for (const g of SUP) for (const [p, e] of PRICES) chk(g, p, e);
for (const g of KEEP) for (const [p] of PRICES) chk(g, p, false);
chk(null, 1, false); // グレード取得不可 → 外さない
// 定義の確認（GRADE_MAP 4=中古C, 5=中古D(ジャンク)）
if (JSON.stringify(s1.LOW_GRADE_IDS) !== '[4,5]' || GM[4].name !== '中古C' || GM[5].name !== '中古D(ジャンク)') { fail++; console.error('FAIL grade ids'); }
// classify は従来どおり
if (s1.classify('■テスト') !== 'recore' || s1.classify('□テスト') !== 'oroshi' || s1.classify('テスト') !== null) { fail++; console.error('FAIL classify'); }
if (fail) { console.error('\n❌ ' + fail + ' test(s) failed'); process.exit(1); }
console.log('\n✅ all recore-suppress tests passed');
