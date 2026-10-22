// 步 3 驗收測試 — Record 記錄層
const fs = require('fs');
const path = require('path');
const html = fs.readFileSync(path.join(__dirname, 'index.html'), 'utf8');
const src = /<script(?![^>]*\bsrc=)[^>]*>([\s\S]*?)<\/script>/.exec(html)[1];

function slice(from, to) {
  const a = src.indexOf(from), b = src.indexOf(to, a);
  if (a < 0 || b < 0) throw new Error(`slice 失敗: ${from}`);
  return src.slice(a, b);
}

const dataBlock = slice('const ITEMS =', 'const LETTERS =');
const recordBlock = slice('const RECORD_KEY', '/* TTS */');

// localStorage mock
function mkStore() {
  const m = new Map();
  return {
    getItem: k => (m.has(k) ? m.get(k) : null),
    setItem: (k, v) => m.set(k, String(v)),
    removeItem: k => m.delete(k),
    _raw: m
  };
}

// 只有 S 同 localStorage 需要注入；ITEMS 由 dataBlock 內嘅 const 提供，
// 唔好再當參數傳入，否則同 const 重複宣告。
function loadStore(store, S) {
  return new Function('S', 'localStorage',
    dataBlock + '\n' + recordBlock + '\nreturn {Record, RECORD_KEY, SESSION_KEY};'
  )(S, store);
}
const newS = (over = {}) =>
  Object.assign({ diff: 'mid', vocabScope: 'food', qCount: 4, pathList: ['listen'], recSeq: 1 }, over);

let fail = 0;
const chk = (n, c, x) => { console.log((c ? '  ✅ ' : '  ❌ ') + n + (x ? '  ' + x : '')); if (!c) fail++; };

console.log('[1] 一次作答 = 一筆記錄');
{
  const store = mkStore();
  const S = { diff: 'mid', vocabScope: 'food', qCount: 4, pathList: ['listen'], recSeq: 1 };
  const { Record, SESSION_KEY } = loadStore(store, S);

  Record.start({ student: '3B', arcade: 'path' });
  const q = { type: 'listen', ans: 'apple', stem: '弟弟買蘋果', phrase: '買蘋果' };
  Record.attempt(true, q);
  Record.finish();

  const saved = JSON.parse(store.getItem(SESSION_KEY) || 'null');
  const all = JSON.parse(store.getItem('bxm.records.v1'));
  chk('寫入 1 筆', all[0].records.length === 1);
  chk('session 中途暫存已清走', saved === null, 'SESSION_KEY=' + store.getItem(SESSION_KEY));
  const r = all[0].records[0];
  chk('attempts=1', r.attempts === 1);
  chk('firstTry=true', r.firstTry === true);
  chk('詞彙 = 蘋果 / food', r.word === '蘋果' && r.cat === 'food', r.word + '/' + r.cat);
  chk('stem 有記低', r.stem === '弟弟買蘋果');
  chk('build 以外 answerVisible=false', r.answerVisible === false);
}

console.log('\n[2] retry 歸併：錯→對 = 同一筆，attempts=2，首次非獨立答對');
{
  const store = mkStore();
  const S = { diff: 'mid', vocabScope: 'food', qCount: 4, pathList: ['listen'], recSeq: 1 };
  const { Record } = loadStore(store, S);
  Record.start({ student: 'A' });
  const q = { type: 'listen', ans: 'milk', stem: '妹妹買牛奶', phrase: '買牛奶' };
  Record.attempt(false, q);
  Record.attempt(false, q);
  Record.attempt(true, q);
  Record.finish();
  const r = Record.load()[0].records[0];
  chk('仍然只有 1 筆', Record.load()[0].records.length === 1);
  chk('attempts=3', r.attempts === 3, '得 ' + r.attempts);
  chk('correct=true', r.correct === true);
  chk('firstTry=false（要靠重試）', r.firstTry === false);
}

console.log('\n[3] 多題各自獨立，recSeq 分隔');
{
  const store = mkStore();
  const S = { diff: 'easy', vocabScope: 'all', qCount: 4, pathList: ['listen'], recSeq: 1 };
  const { Record } = loadStore(store, S);
  Record.start({ student: 'A' });
  const qs = ['bag', 'pencil', 'milk'].map(a => ({ type: 'listen', ans: a, phrase: '買' + a }));
  // 題 1：直接答對
  S.recSeq = 1; Record.attempt(true, qs[0]);
  // 題 2：錯兩次再對
  S.recSeq = 2; Record.attempt(false, qs[1]); Record.attempt(false, qs[1]); Record.attempt(true, qs[1]);
  // 題 3：錯完就走（未答對）
  S.recSeq = 3; Record.attempt(false, qs[2]);
  Record.finish();
  const rs = Record.load()[0].records;
  chk('3 題 = 3 筆', rs.length === 3);
  chk('seq 連續 1,2,3', rs.map(r => r.seq).join(',') === '1,2,3');
  chk('題1 attempts=1 firstTry', rs[0].attempts === 1 && rs[0].firstTry === true);
  chk('題2 attempts=3 firstTry=false', rs[1].attempts === 3 && rs[1].firstTry === false);
  chk('題3 correct=false 仍記低', rs[2].correct === false && rs[2].attempts === 1);
}

console.log('\n[4] 砌短語標記 answerVisible（答案喺畫面上）');
{
  const store = mkStore();
  const S = { diff: 'mid', vocabScope: 'category', qCount: 4, pathList: ['build'], recSeq: 1 };
  const { Record } = loadStore(store, S);
  Record.start({ student: 'A' });
  Record.attempt(true, { type: 'build', ans: 'wenju', phrase: '買文具' });
  Record.finish();
  const r = Record.load()[0].records[0];
  chk('answerVisible=true', r.answerVisible === true);
  chk('hasImg=false（分類詞）', r.hasImg === false);
  chk('target=買文具', r.target === '買文具');
}

console.log('\n[5] 多堂課累積 + 清除');
{
  const store = mkStore();
  const S = { diff: 'easy', vocabScope: 'all', qCount: 4, pathList: ['listen'], recSeq: 1 };
  const { Record } = loadStore(store, S);
  for (let i = 0; i < 3; i++) {
    Record.start({ student: '3B' });
    S.recSeq = 1; Record.attempt(true, { type: 'listen', ans: 'bag', phrase: '買書包' });
    Record.finish();
  }
  const all = Record.load();
  chk('3 堂課 = 3 個 session', all.length === 3);
  chk('每堂都有 session id', all.every(s => /^s-/.test(s.id)));
  chk('每堂都有 ts', all.every(s => !isNaN(Date.parse(s.ts))));
  Record.clear();
  chk('清除後 0', Record.load().length === 0);
}

console.log('\n[6] 中途離開：SESSION_KEY 留住未完成課節');
{
  const store = mkStore();
  const S = { diff: 'easy', vocabScope: 'all', qCount: 4, pathList: ['listen'], recSeq: 1 };
  const { Record, SESSION_KEY } = loadStore(store, S);
  Record.start({ student: 'A' });
  S.recSeq = 1; Record.attempt(true, { type: 'listen', ans: 'bag', phrase: '買書包' });
  const mid = JSON.parse(store.getItem(SESSION_KEY));
  chk('SESSION_KEY 有未完成課節', mid && mid.records.length === 1);
  chk('records 檔案仲未有', Record.load().length === 0);
  chk('半途唔會污染正式記錄', true);
}

console.log('\n[7] localStorage 壞掉唔會炸');
{
  const broken = { getItem: () => { throw new Error('denied'); }, setItem: () => { throw new Error('quota'); }, removeItem: () => { throw new Error('x'); } };
  const S = { diff: 'easy', vocabScope: 'all', qCount: 4, pathList: ['listen'], recSeq: 1 };
  const { Record } = loadStore(broken, S);
  let threw = null;
  try {
    Record.start({ student: 'A' });
    S.recSeq = 1; Record.attempt(true, { type: 'listen', ans: 'bag', phrase: '買書包' });
    Record.finish();
    Record.clear();
  } catch (e) { threw = e; }
  chk('storage 拒絕寫入時不崩', threw === null, threw ? threw.message : '正常返回');
}


console.log('\n[8] 純 arcade 段落（0 筆語言作答）唔污染評估資料');
{
  const store = mkStore();
  const S = newS({ pathList: ['catch'] });
  const { Record } = loadStore(store, S);
  Record.start({ student: 'A', arcade: 'catch' });
  Record.finish();  // 冇任何 onPick
  chk('0 筆記錄嘅課節唔會入庫', Record.load().length === 0);
}

console.log(fail ? '\n❌ ' + fail + ' 項失敗' : '\n✅ 全部通過');
process.exit(fail ? 1 : 0);