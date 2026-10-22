// 步 5/6 驗收測試 — 砍語言模式 + D2/D5/D6/D9 修正
const fs = require('fs');
const path = require('path');
const html = fs.readFileSync(path.join(__dirname, 'index.html'), 'utf8');
const src = /<script(?![^>]*\bsrc=)[^>]*>([\s\S]*?)<\/script>/.exec(html)[1];

function slice(from, to) {
  const a = src.indexOf(from), b = src.indexOf(to, a);
  if (a < 0 || b < 0) throw new Error('slice 失敗: ' + from);
  return src.slice(a, b);
}

let fail = 0;
const chk = (n, c, x) => { console.log((c ? '  ✅ ' : '  ❌ ') + n + (x ? '  ' + x : '')); if (!c) fail++; };

console.log('[5] 語言模式收窄到 2 個');
{
  const m = /const PATH = \[([^\]]*)\]/.exec(src);
  const p = m[1].split(',').map(s => s.trim().replace(/'/g, ''));
  chk('PATH = 聽圖選 + 砌短語', p.length === 2 && p[0] === 'listen' && p[1] === 'build', p.join(' → '));

  // 首頁唔應該再出現被砍模式嘅按鈕
  ['shop', 'judge', 'need'].forEach(mode => {
    const has = new RegExp('data-mode="' + mode + '"').test(html);
    chk('首頁冇 ' + mode + ' 模式按鈕', !has);
  });
  // 但保留嘅兩個要喺
  ['listen', 'build'].forEach(mode => {
    const has = new RegExp('data-mode="' + mode + '"').test(html);
    chk('首頁有 ' + mode + ' 模式按鈕', has);
  });
  // 4 個 arcade 都要保留
  ['catch', 'run', 'cart', 'talk'].forEach(mode => {
    const has = new RegExp('data-mode="' + mode + '"').test(html);
    chk('arcade ' + mode + ' 保留', has);
  });
  // 函數本體保留，方便加返
  ['makeShop', 'makeJudge', 'renderShop', 'renderJudge', 'renderNeed', 'NEED_SCENES'].forEach(fn => {
    chk(fn + ' 函數本體保留', src.includes(fn));
  });
}

console.log('\n[6] D9 砌短語唔再顯示答案');
{
  const rb = slice('function renderBuild(', 'function onPick(');
  // 舊 bug：題目提示直接插答案標籤
  const leaks = /砌短語：<mark>買 \+ \$\{/.test(rb);
  chk('題目提示唔會再插答案文字', !leaks);
  chk('有顯示圖片刺激', rb.includes('build-stim') && rb.includes('it.img'));
  chk('圖片來源係 ITEMS 入面嘅 img 路徑', /src="'\s*\+\s*it\.img/.test(rb) || rb.includes("it.img+'\""));
  chk('分類詞路徑出同類成員圖', rb.includes('build-sibs'));
  // 舊 bug：ensurePhraseTiles 切走錯動詞
  const ept = slice('function ensurePhraseTiles(', 'function makeBuild(');
  chk('錯動詞干擾會保留（badFirst）', ept.includes('badFirst'));
  chk('hard 難度 tile 上限提到 6', /hard\?6|:\s*6/.test(ept));
}

console.log('\n[6] D6 選項次序鎖定');
{
  const rl = slice('function renderListen(', 'function renderShop(');
  chk('聽圖選選項 cache 喺 q 上面', rl.includes('q._choices'));
  chk('唔會每次 render 重新 pickChoices', (rl.match(/pickChoices\(/g) || []).length === 1);
}

console.log('\n[6] D5 語音');
{
  const sp = slice('function speak(text){', 'function questionSpeakText');
  chk('語速讀 S.ttsRate', sp.includes('S.ttsRate'));
  chk('唔再硬編碼 0.9', !/u\.rate\s*=\s*0\.9/.test(sp));
  chk('語速選擇器喺頁面', html.includes('id="tts-rate-row"'));
  chk('語音自我檢查掣喺頁面', html.includes('id="btn-voice-test"'));
  chk('有 voiceSelfTest 函式', src.includes('function voiceSelfTest'));
  chk('自我檢查會顯示搵到嘅 voice', src.includes('voice-info'));
}

console.log('\n[6] D2 句式對齊 — 聽同砌目標短語一致');
{
  const ml = slice('function makeListen(', 'function makeShop(');
  const mb = slice('function makeBuild(', 'function nextQuestion(');
  const listenPhrase = /const phrase = '買' \+ ITEMS\[ans\]\.label;/.test(ml);
  const buildPhrase = /phrase:'買'\+ITEMS\[ans\]\.label/.test(mb);
  chk('聽圖選目標短語 = 買 + N', listenPhrase);
  chk('砌短語目標短語 = 買 + N', buildPhrase);
  chk('兩者同一模板（聽音輸入 → 砌句輸出）', listenPhrase && buildPhrase);
}

console.log('\n[6] 記錄層 answerVisible 已跟住 D9 更新');
{
  const rec = slice('const Record = {', '/* TTS */');
  chk('answerVisible 係 false', /answerVisible:\s*false/.test(rec));
  chk('唔再按 build 類型標 true', !/answerVisible:\s*q\.type\s*===\s*'build'/.test(rec));
}

console.log(fail ? '\n❌ ' + fail + ' 項失敗' : '\n✅ 全部通過');
process.exit(fail ? 1 : 0);