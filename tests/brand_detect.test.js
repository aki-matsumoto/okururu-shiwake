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
if (sb.counts.depacos !== 42) { fail++; console.error('FAIL depacos count ' + sb.counts.depacos); }
if (sb.counts.ban !== 13) { fail++; console.error('FAIL ban count ' + sb.counts.ban); }
chk('SK-II フェイシャルトリートメントエッセンス', true, false);
chk('資生堂 アルティミューン', true, false);
chk('CHANEL シャネル ルージュ', true, true);
chk('Dior ディオール リップ', true, true);
chk('GUCCI BEAUTY グッチ ビューティ', true, true);
chk('LOUIS VUITTON ルイヴィトン 財布', false, true);
chk('NIKE ナイキ エアフォース1', false, true);
chk('Anker モバイルバッテリー', false, false);
chk('エレガンス ラ プードル', false, true);
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
if (fail) { console.error('\n❌ ' + fail + ' test(s) failed'); process.exit(1); }
console.log('\n✅ all brand-detect tests passed');
