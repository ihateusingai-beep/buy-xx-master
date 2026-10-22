// 步 4' 驗收測試 — 混合模式：遊戲 ⇄ 題目 交替迴圈
const fs = require('fs');
const path = require('path');
const html = fs.readFileSync(path.join(__dirname, 'index.html'), 'utf8');
const src = /<script(?![^>]*\bsrc=)[^>]*>([\s\S]*?)<\/script>/.exec(html)[1];

function slice(from, to) {
  const a = src.indexOf(from), b = src.indexOf(to, a);
  if (a < 0 || b < 0) throw new Error('slice 失敗: ' + from);
  return src.slice(a, b);
}

const dataBlock = slice('const ITEMS =', 'const LETTERS =');
const pathBlock = slice('const PATH =', 'const NEED_SCENES =');
// 只抽需要嘅函式，唔好撈入 TTS 區塊（node 無 speechSynthesis 會爆）
const fnBlock = [
  slice('function isPathMode(){', 'function updatePathProgress()'),
  slice('function segGoal(', 'function startCatch()')
].join('\n');

function mk(S) {
  return new Function('S', dataBlock + '\n' + pathBlock + '\n' + fnBlock +
    '\nreturn {buildMixPath, isPathMode, segGoal, PATH, PATH_RETRO, MODE_LABEL};')(S);
}

let fail = 0;
const chk = (n, c, x) => { console.log((c ? '  ✅ ' : '  ❌ ') + n + (x ? '  ' + x : '')); if (!c) fail++; };

const ARC = ['catch', 'run', 'cart', 'talk'];

console.log('[1] 混合路徑 = 遊戲 ⇄ 題目 嚴格交替');
{
  const S = { mode: 'mix', qCount: 4, mixArcade: 'catch', mixLang: ['listen', 'build'] };
  const m = mk(S);
  const p = m.buildMixPath();
  chk('4 組 = 8 段', p.length === 8, p.join(' → '));
  chk('偶數位係遊戲', p.filter((_, i) => i % 2 === 0).every(x => ARC.includes(x)));
  chk('奇數位係語言題', p.filter((_, i) => i % 2 === 1).every(x => ['listen', 'build'].includes(x)));
  chk('語言題 listen/build 輪轉', p[1] === 'listen' && p[3] === 'build' && p[5] === 'listen' && p[7] === 'build');
  chk('全部係遊戲開始（先玩後答）', p[0] === 'catch' && p[2] === 'catch');
}

console.log('\n[2] 題數 = 組數');
[1, 2, 4, 8].forEach(n => {
  const S = { mode: 'mix', qCount: n, mixArcade: 'run', mixLang: ['listen', 'build'] };
  const p = mk(S).buildMixPath();
  chk('qCount=' + n + ' → ' + p.length + ' 段', p.length === n * 2);
});

console.log('\n[3] 老師揀遊戲段落會生效');
ARC.forEach(a => {
  const S = { mode: 'mix', qCount: 3, mixArcade: a, mixLang: ['listen', 'build'] };
  const p = mk(S).buildMixPath();
  chk(a.padEnd(6) + ' 每個遊戲位都係佢', p.filter((_, i) => i % 2 === 0).every(x => x === a));
});

console.log('\n[4] 遊戲段落長度：混合模式 = 2 個單位，其他模式維持原值');
{
  const S = { mode: 'mix', qCount: 4 };
  const m = mk(S);
  chk('mix → segGoal = 2', m.segGoal(8) === 2);
  S.mode = 'path';
  chk('path → segGoal 維持原值', m.segGoal(8) === 8);
  S.mode = 'path-retro';
  chk('path-retro → segGoal 維持原值', m.segGoal(6) === 6);
}

console.log('\n[5] isPathMode 包含 mix');
{
  const S = { mode: 'mix' };
  const m = mk(S);
  chk('mix 係 path mode', m.isPathMode() === true);
  S.mode = 'catch';
  chk('單關 arcade 唔係 path mode', m.isPathMode() === false);
}

console.log('\n[6] 規則：答錯唔影響遊戲段落長度');
{
  // 遊戲段落長度只由 segGoal 決定，唔經過任何答題結果變數
  const S = { mode: 'mix', qCount: 4 };
  const m = mk(S);
  const before = m.segGoal(8);
  // 模擬答錯：答題結果只影響 S.correct / S.answered，唔會改 segGoal
  S.correct = 0; S.answered = 3;
  const after = m.segGoal(8);
  chk('答題結果唔會改動遊戲段落長度', before === after && after === 2);
}

console.log('\n[7] 舊 path 冇被破壞');
{
  const m = mk({ mode: 'path' });
  // v5 精簡：PATH 收窄到聽圖選 + 砌短語 2 關（語言模式只留 2 個）
  chk('PATH = 聽圖選 + 砌短語', m.PATH.length === 2 && m.PATH[0] === 'listen' && m.PATH[1] === 'build', m.PATH.join(' → '));
  chk('PATH_RETRO 仍然 3 關', m.PATH_RETRO.length === 3);
  chk('mix 有獨立 MODE_LABEL', m.MODE_LABEL.mix === '遊戲＋答題');
  chk('被砍模式嘅 LABEL 仍喺（方便加返）', !!m.MODE_LABEL.shop && !!m.MODE_LABEL.judge && !!m.MODE_LABEL.need);
}

console.log(fail ? '\n❌ ' + fail + ' 項失敗' : '\n✅ 全部通過');
process.exit(fail ? 1 : 0);