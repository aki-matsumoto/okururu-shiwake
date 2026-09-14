'use strict';
// node-only ブランド判定テスト（playwright不要）
const path = require('path');
global.window = {};
require(path.resolve(__dirname, '..', 'data', 'shiwake_brands.js'));
const sb = global.window.OKURURU.data.shiwakeBrands;
let fail = 0;
function chk(name, expDepa, expBan) {
  const d = !!sb.detectDepacos(name), b = !!sb.detectMercariBan(name);
  const ok = d === expDepa && b === expBan;
  if (!ok) { fail++; console.error('FAIL depa=' + d + ' ban=' + b + ' | ' + name); }
  else console.log('PASS | ' + name);
}
if (sb.counts.depacos !== 58) { fail++; console.error('FAIL depacos count ' + sb.counts.depacos); }
if (sb.counts.ban !== 6) { fail++; console.error('FAIL ban count ' + sb.counts.ban); }
chk('SK-II フェイシャルトリートメントエッセンス', true, false);
chk('資生堂 アルティミューン', true, false);
// 2026-09-14 現場FB#7：エルメス/グッチ/シャネル/プラダ/ディオール/クレドポー/エレガンス はメルカリ禁止判定から除外
chk('CHANEL シャネル ルージュ', true, false);
chk('Dior ディオール リップ', true, false);
chk('GUCCI BEAUTY グッチ ビューティ', true, false);
// エルメスは data 上は HERMÈS BEAUTY にマッチ（デパコス判定はカテゴリ非依存）。カテゴリ絞り込みは s2 側。ここでは ban が消えたことを確認
chk('エルメス ケリー 財布', true, false);
chk('GUCCI グッチ トートバッグ', false, false);
chk('PRADA プラダ ナイロンバッグ', false, false);
chk('クレ・ド・ポー ボーテ ル・フォンダンクレーム', true, false);
chk('LOUIS VUITTON ルイヴィトン 財布', false, true);
chk('NIKE ナイキ エアフォース1', false, true);
chk('COACH コーチ ショルダーバッグ', false, true);
chk('Anker モバイルバッテリー', false, false);
chk('エレガンス ラ プードル', false, false);
chk('BVLGARI ブルガリ プールオム', true, false);
chk('マキアージュ ドラマティック', true, false);
chk('ビハク 美白美容液', false, false);
chk('LUSH バスボム', false, false);
chk('チーク BLUSH ピンク', false, false);
chk('アイラッシュ マスカラ', false, false);
chk('FANCL クレンジング', false, false);
chk('KATE リップモンスター', false, false);
chk('KATE SPADE 財布', false, false);
chk('Tatcha ザ リッチクリーム', false, false);
chk('HAKU メラノフォーカスEV', true, false);
chk('THE BODY SHOP ボディバター', true, false);
chk('LA MER クレーム ドゥ ラ メール', true, false);
chk('CLINIQUE 拭き取り化粧水', true, false);
chk('IPSA ザ・タイムR アクア', true, false);
chk('ジョルジオ アルマーニ リップ マエストロ', true, true);
if (fail) { console.error('\n❌ ' + fail + ' test(s) failed'); process.exit(1); }
console.log('\n✅ all brand-detect tests passed');
