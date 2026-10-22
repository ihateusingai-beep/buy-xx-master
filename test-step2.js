// 步 2 驗收測試 — 直接跑 index.html 內嘅真實代碼
const fs = require('fs');
const path = require('path');
const html = fs.readFileSync(path.join(__dirname, 'index.html'), 'utf8');
const src = /<script(?![^>]*\bsrc=)[^>]*>([\s\S]*?)<\/script>/.exec(html)[1];

function slice(from, to) {
  const a = src.indexOf(from);
  const b = src.indexOf(to, a);
  if (a < 0 || b < 0) throw new Error(`slice 失敗: ${from} .. ${to} (a=${a}, b=${b})`);
  return src.slice(a, b);
}

const dataBlock = slice('const ITEMS =', 'const LETTERS =');
const fnBlock = [
  slice('function shuffle(a){', 'function nOpts()'),
  slice('function nOpts()', '/* TTS */'),
  slice('function pickChoices(', 'function diffPick(')
].join('\n');

const DEPS = ['ITEMS', 'IDS', 'ALL', 'SELECTABLE', 'WORDONLY', 'byCat', 'PIC_CATS', 'CAT_LABEL'];
const DEFAULTS = new Function(
  dataBlock + '\n' + fnBlock + '\nreturn {' + DEPS.join(',') + '};'
)();

function mk(scope, diff) {
  // 只有 S 需要注入（池函數讀 S.vocabScope / S.diff），
  // 其餘符號由 dataBlock 內嘅 const 宣告提供，唔好重複傳參數。
  const S = { vocabScope: scope, diff };
  return new Function(
    'S',
    dataBlock + '\n' + fnBlock +
    '\nreturn {poolAll,buildPool,pickPool,pickChoices,nOpts,shuffle};'
  )(S);
}

const { ITEMS, WORDONLY, byCat, SELECTABLE } = DEFAULTS;
let fail = 0;
const chk = (n, c, x) => { console.log((c ? '  ✅ ' : '  ❌ ') + n + (x ? '  ' + x : '')); if (!c) fail++; };

console.log('分類統計');
['stationery', 'food', 'toy'].forEach(c => {
  const ids = byCat(c).filter(k => ITEMS[k].img);
  console.log('  ' + c.padEnd(12) + ids.length + ' 件：' + ids.map(k => ITEMS[k].label).join('、'));
});
console.log('  category    ' + WORDONLY.length + ' 件：' + WORDONLY.map(k => ITEMS[k].label).join('、'));
console.log('  有圖合共    ' + SELECTABLE.length + ' 件\n');

console.log('[1] 分類詞絕不入選擇題 pool');
{
  let leak = 0, hits = 0;
  ['all', 'stationery', 'food', 'toy', 'category'].forEach(sc => {
    const m = mk(sc, 'mid');
    for (let i = 0; i < 500; i++) {
      [m.poolAll(), m.pickPool('listen'), m.pickPool('run'), m.pickPool('cart')]
        .forEach(pool => pool.forEach(k => { if (!ITEMS[k].img) leak++; else hits++; }));
    }
  });
  chk('5000 次 × 4 條路徑，零分類詞漏入', leak === 0, '漏出 ' + leak + '／' + (leak + hits) + ' 次');
}

console.log('\n[2] 各範圍鎖定正確');
// 注意：鎖「分類詞」時 poolAll 會 fallback 去全部有圖詞（因為聽圖選需要圖），
// 只有 buildPool() 才會真正收窄到文具。呢個係刻意設計，唔係漏出。
[['all', 11], ['stationery', 4], ['food', 4], ['toy', 3], ['category', 11]].forEach(([sc, n]) => {
  const m = mk(sc, 'mid');
  const a = m.poolAll().length;
  const inScope = m.poolAll().every(k => sc === 'all' || sc === 'category' || ITEMS[k].cat === sc);
  chk(sc.padEnd(11) + 'poolAll=' + a, inScope && a === n, inScope ? '' : '成員超出範圍');
});

console.log('\n[3] build 可出分類詞，listen 不可');
{
  const m = mk('all', 'mid');
  let b = 0, l = 0;
  for (let i = 0; i < 4000; i++) {
    if (m.pickPool('build').includes('wenju')) b++;
    if (m.pickPool('listen').includes('wenju')) l++;
  }
  chk('build 有出文具', b > 0, b + '/4000');
  chk('listen 從不出文具', l === 0, l + '/4000');
}
{
  const m = mk('category', 'mid');
  chk('鎖分類詞 → build 只得文具', m.buildPool().length === 1 && m.buildPool()[0] === 'wenju');
  // 聽圖選需要圖，所以 poolAll() 會 fallback 去全部有圖詞，並喺 UI 提示老師
  chk('鎖分類詞 → poolAll fallback 去有圖詞', m.poolAll().length === 11 && m.poolAll().every(k => ITEMS[k].img),
      m.poolAll().map(k => ITEMS[k].label).join('、'));
}

console.log('\n[4] 難度 × 詞彙量：選項數誠實降級');
['easy', 'mid', 'hard'].forEach(d => {
  ['stationery', 'food', 'toy'].forEach(sc => {
    const m = mk(sc, d);
    const pool = m.pickPool('listen');
    const c = m.pickChoices(pool[0], pool, m.nOpts());
    const maxPossible = byCat(sc).filter(k => ITEMS[k].img).length;
    const expect = Math.min(m.nOpts(), maxPossible);
    const inScope = c.every(k => ITEMS[k].cat === sc);
    chk(
      d.padEnd(5) + sc.padEnd(11) + '→ ' + c.length + ' 選項',
      c.length === expect && inScope,
      c.map(k => ITEMS[k].label).join(' / ')
    );
  });
});

console.log('\n[5] 玩具類 hard 只有 3 選（誠實降級，非漏出）');
{
  const m = mk('toy', 'hard');
  const pool = m.pickPool('listen');
  const c = m.pickChoices(pool[0], pool, m.nOpts());
  chk('3 件詞彙喺 hard 出 3 選而唔係 4', c.length === 3, c.map(k => ITEMS[k].label).join(' / '));
}

console.log(fail ? '\n❌ ' + fail + ' 項失敗' : '\n✅ 全部通過');
process.exit(fail ? 1 : 0);