'use strict';

const assert = require('node:assert/strict');

global.window = {};
require('../content/s2_brand_mark');
require('../content/s3_itcode_mark');
require('../content/s8_wga_mark');

const { s2_brandMark, s3_itCodeMark, s8_wgaMark } = window.OKURURU.features;
const { isPerfumePath } = s2_brandMark.__test;
const { perfumeItcode } = s3_itCodeMark.__test;
const { decideKind } = s8_wgaMark.__test;

const cosmetic = { buy: 80, sell: 2000, path: '化粧品 / スキンケア', gradeId: 3, sameQty: 1, sortedOrDepa: false };
const supplement = { ...cosmetic, buy: 120, path: 'サプリメント・健康食品' };
const perfume = { sell: 3000, cat: '香水', unsorted: true };

const cases = [
  ['サプリ・買取120・同名6は卸', decideKind, { ...supplement, sameQty: 6 }, 'oroshi'],
  ['サプリ・買取120・同名4はサプリ', decideKind, { ...supplement, sameQty: 4 }, 'supp'],
  ['サプリ・買取30・同名6はサプリ', decideKind, { ...supplement, buy: 30, sameQty: 6 }, 'supp'],
  ['化粧品・販売3,999・中古BはWGA', decideKind, { ...cosmetic, sell: 3999 }, 'wga'],
  ['化粧品・販売4,000・中古Cは対象外', decideKind, { ...cosmetic, sell: 4000, gradeId: 4 }, null],
  ['化粧品・中古Aは対象外', decideKind, { ...cosmetic, gradeId: 2 }, null],
  ['化粧品・グレード不明は対象外', decideKind, { ...cosmetic, gradeId: null }, null],
  ['化粧品・中古D・同名5は卸', decideKind, { ...cosmetic, gradeId: 5, sameQty: 5 }, 'oroshi'],
  ['化粧品・買取不可は対象外', decideKind, { ...cosmetic, gradeId: 9 }, null],
  ['化粧品・中古CはWGA', decideKind, { ...cosmetic, gradeId: 4 }, 'wga'],
  ['化粧品・中古DはWGA', decideKind, { ...cosmetic, gradeId: 5 }, 'wga'],
  ['振り分け済み・デパコスは買取¥1でも対象外', decideKind, { ...cosmetic, buy: 1, sortedOrDepa: true }, null],
  ['デフォルトは同名5でもカテゴリ注意', decideKind, { ...cosmetic, path: 'デフォルト', sameQty: 5 }, 'catwarn'],
  ['香水・販売2,999はITコード対象外', perfumeItcode, { ...perfume, sell: 2999 }, null],
  ['香水・販売3,000はITコード対象', perfumeItcode, perfume, 'perfume50'],
  ['香水・販売額不明はITコード対象外', perfumeItcode, { ...perfume, sell: null }, null],
  ['振り分け済み香水・販売3,000は香水枠の対象外', perfumeItcode, { ...perfume, unsorted: false }, null],
  ['親カテゴリが香水系の経路を検出', isPerfumePath, '化粧品 / フレグランス / その他', true],
  ['化粧品の経路は香水系から除外', isPerfumePath, cosmetic.path, false],
  ['香水を含む化粧品経路は香水', decideKind, { ...cosmetic, path: '化粧品 / 香水' }, 'perfume'],
  ['サプリを含む化粧品経路はサプリ', decideKind, { ...cosmetic, path: '化粧品 / サプリ' }, 'supp'],
  ['育毛剤を含む化粧品経路は育毛剤', decideKind, { ...cosmetic, path: '化粧品 / 育毛剤' }, 'ikumou'],
  ['買取¥1はWGA', decideKind, { ...supplement, buy: 1, sameQty: 6 }, 'wga'],
  ['販売¥1はWGA', decideKind, { ...cosmetic, sell: 1, gradeId: 2 }, 'wga'],
  ['販売未入力はWGA', decideKind, { ...cosmetic, sell: null, gradeId: 2 }, 'wga']
];

for (const [name, rule, input, expected] of cases) {
  assert.equal(rule(input), expected, name);
  console.log('PASS | ' + name);
}
