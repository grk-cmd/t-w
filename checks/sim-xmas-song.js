/* sim-xmas-song.js — 🎄 편지 추천곡 뮤직바(parts/xmas/xmas-song.js · 일회성)를 가짜 화면 · 가짜 재생 창으로 돌려 본다
   실행: node checks/run.js sim-xmas-song
   ・1절 재생 — ▶ 는 공용 배경음악 창을 주인 'xmas' 로 연다(유튜브 주소 · 제목) · ▐▐ 멈춤 · ▶ 이어 듣기 · 다른 편지의 곡을 틀면 그 곡으로
   ・2절 나중에 튼 쪽이 이긴다 — 마이홈 · 플레이리스트 · 같이 듣기가 창을 가져가거나 창이 닫히면 모든 바가 ▶ 로 · 편지 창을 닫으면(stop) 내 곡만 닫는다
   ・3절 ((o — 링크 → 영상 id · 제목(40자) · 비우면 빼기 · 못 알아보는 링크 · 듣던 곡을 바꾸면 멈춤 · 앱 밖(companion 없음) 안내
   ・4절 main.js · preload.js — 'xmas' 는 패널 뒤에 숨는 주인 · 신호 없음(마이홈처럼 되풀이) · 한 곡 반복 안 걸림 · IPC 한 줄
   ・5절 제목은 textContent 로만 · mutation test */
'use strict';
const fs = require('fs');
const path = require('path');
let pass = 0, fail = 0;
const say = (s) => console.log(s);
const chk = (ok, msg) => { ok ? pass++ : fail++; say('  ' + (ok ? '✓' : '✗') + ' ' + msg); };
const find = (c) => c.find(p => fs.existsSync(p));
const SP = find(['xmas-song.js', 'parts/xmas/xmas-song.js', 'app/parts/xmas/xmas-song.js', 'apps/desktop/app/parts/xmas/xmas-song.js']);
const MP = find(['main.js', 'apps/desktop/main.js']);
const PP = find(['preload.js', 'apps/desktop/preload.js']);
if (!SP || !MP || !PP) { say('  ? 원본 못 찾음 — xmas-song.js · main.js · preload.js'); process.exit(2); }
const S = require(path.resolve(SP));
const SRC = fs.readFileSync(SP, 'utf8');
const MAIN = fs.readFileSync(MP, 'utf8');
const PRELOAD = fs.readFileSync(PP, 'utf8');

function el(tag){
  const cls = new Set(), props = {};
  const e = { tagName: String(tag || 'div').toUpperCase(), children: [], className: '', title: '', type: '', scrollWidth: 0, clientWidth: 100,
    get textContent(){ return e._t !== undefined ? e._t : e.children.map(c => c.textContent).join(''); },
    set textContent(v){ e._t = String(v); e.children = []; },
    classList: { add: (c) => cls.add(c), remove: (c) => cls.delete(c), contains: (c) => cls.has(c) },
    style: { setProperty: (k, v) => { props[k] = v; }, removeProperty: (k) => { delete props[k]; }, props },
    appendChild: (c) => { if (e._t !== undefined){ e.children = e._t ? [{ textContent: e._t }] : []; e._t = undefined; } e.children.push(c); return c; } };
  return e;
}
function world(opts){
  const o = opts || {};
  const C = { calls: [], mode: null, closed: null };
  const comp = { openXmasSong: (u, t) => C.calls.push('open ' + u + ' ' + t), pauseBgm: () => C.calls.push('pause'), resumeBgm: () => C.calls.push('resume'),
    closeBgm: () => C.calls.push('close'), onBgmMode: (f) => { C.mode = f; }, onBgmClosed: (f) => { C.closed = f; } };
  const toasts = [], prompts = (o.prompts || []).slice();
  const doc = { createElement: (t) => el(t) };
  const win = { requestAnimationFrame: (f) => f() };
  const api = S.createXmasSong({ doc, win, companion: () => (o.noApp ? undefined : comp), toast: (m) => toasts.push(m), songTitleMax: 40,
    ytVideoId: (u) => { const m = String(u).match(/(?:youtu\.be\/|v=)([\w-]{11})/); return m ? m[1] : null; },
    asyncPrompt: async () => prompts.shift() });
  return { api, C, toasts, prompts };
}
const parts = (box) => ({ play: box.children[0], vp: box.children[1], lab: box.children[1].children[0], set: box.children[2] });
const A = { id: 'aaaaaaaaaaa', title: '고요한 밤' }, B = { id: 'bbbbbbbbbbb', title: '' };

(async () => {
say('── 1절 재생');
{
  const w = world();
  const b1 = el(), b2 = el();
  const x = w.api.bar(b1, {}), y = w.api.bar(b2, {});
  x.set(A); y.set(B);
  const p1 = parts(b1), p2 = parts(b2);
  chk(p1.play.textContent === '▶' && p1.lab.textContent === '고요한 밤' && p2.lab.textContent === 'YouTube 추천곡', '처음엔 ▶ · 제목(없으면 «YouTube 추천곡»)');
  p1.play.onclick();
  chk(w.C.calls.join() === 'open https://www.youtube.com/watch?v=aaaaaaaaaaa 고요한 밤' && p1.play.textContent === '▐▐' && w.api.playing() === A.id, '▶ — 공용 창을 주인 xmas 로 연다(유튜브 주소 · 제목) · ▐▐');
  p1.play.onclick(); chk(w.C.calls.pop() === 'pause' && p1.play.textContent === '▶', '▐▐ — 멈춤(창은 그대로)');
  p1.play.onclick(); chk(w.C.calls.pop() === 'resume' && p1.play.textContent === '▐▐', '▶ — 이어 듣기');
  p2.play.onclick();
  chk(w.C.calls.pop() === 'open https://www.youtube.com/watch?v=bbbbbbbbbbb 추천곡' && p2.play.textContent === '▐▐' && p1.play.textContent === '▶', '다른 곡을 틀면 그 곡으로 · 앞 바는 ▶ 로(재생은 한 곡)');
  const b3 = el(); w.api.bar(b3, {}); const p3 = parts(b3);
  const n = w.C.calls.length; p3.play.onclick();
  chk(w.C.calls.length === n && p3.lab.textContent === '추천곡 없음' && !w.toasts.length, '곡 없는 바(받은 편지) — 아무 일 없음 · «추천곡 없음»');
}

say('── 2절 나중에 튼 쪽이 이긴다');
{
  const w = world(); const b = el(); const x = w.api.bar(b, {}); x.set(A); const p = parts(b);
  chk(w.C.mode === null, '재생 창 알림은 처음 틀 때 건다(앱 밖에서 만들 때 companion 을 찾지 않는다)');
  p.play.onclick(); w.C.mode('xmas');
  chk(p.play.textContent === '▐▐', '주인이 xmas 그대로면 표시 유지');
  w.C.mode('home');
  chk(p.play.textContent === '▶' && w.api.playing() === null, '마이홈 BGM 이 창을 가져가면 ▶');
  p.play.onclick(); w.C.closed();
  chk(p.play.textContent === '▶' && w.api.playing() === null, '창이 닫히면 ▶');
  w.C.calls.length = 0; w.api.stop();
  chk(!w.C.calls.length, 'stop — 내가 주인이 아니면 창을 닫지 않는다(남의 곡을 끊지 않음)');
  p.play.onclick(); w.C.calls.length = 0; w.api.stop();
  chk(w.C.calls.join() === 'close' && p.play.textContent === '▶', 'stop — 내 곡이면 창을 닫고 ▶(편지 창을 닫을 때)');
  const wn = world({ noApp: true }); const bn = el(); wn.api.bar(bn, {}).set(A); parts(bn).play.onclick();
  chk(/재시작/.test(wn.toasts.pop() || ''), '앱 밖(companion 없음) — 안내만');
}

say('── 3절 ((o 링크 · 제목');
{
  let changed = 'none';
  const w = world({ prompts: ['https://youtu.be/ccccccccccc?si=x', '  ' + '캐럴'.repeat(30) + ' '] });
  const b = el(); const x = w.api.bar(b, { editable: true, onChange: (s) => { changed = s; } }); const p = parts(b);
  chk(p.set && p.set.textContent === '((o', '쓰기 바에만 ((o');
  p.play.onclick(); chk(/\(\(o/.test(w.toasts.pop() || ''), '곡이 없을 때 ▶ — «((o 를 눌러 링크를 먼저»');
  await p.set.onclick();
  chk(changed && changed.id === 'ccccccccccc' && changed.title.length === 40 && x.get().id === 'ccccccccccc' && p.lab.textContent === changed.title, '링크 → 영상 id · 제목 다듬고 40자 · 바에 보임');
  p.play.onclick(); w.C.calls.length = 0;
  w.prompts.push('https://www.youtube.com/watch?v=ddddddddddd', '');
  await p.set.onclick();
  chk(w.C.calls[0] === 'close' && changed.id === 'ddddddddddd' && changed.title === '' && p.play.textContent === '▶', '듣던 곡을 바꾸면 멈춘다 · 제목은 선택');
  w.prompts.push('   '); await p.set.onclick();
  chk(changed === null && x.get() === null && p.lab.textContent === '추천곡 없음', '비우고 확인 — 곡 빼기');
  changed = 'same'; w.prompts.push('https://example.com/x'); await p.set.onclick();
  chk(changed === 'same' && /인식하지 못했어요/.test(w.toasts.pop() || ''), '유튜브가 아닌 링크 — 안내 · 바꾸지 않음');
  w.prompts.push(null); await p.set.onclick();
  chk(changed === 'same', '취소 — 그대로');
}

say('── 4절 main.js · preload.js');
function cutFn(src, name){
  const m = new RegExp('function\\s+' + name + '\\s*\\(([^)]*)\\)\\s*\\{').exec(src);
  if (!m) return null;
  let d = 0, i = m.index + m[0].length - 1;
  for (let j = i; j < src.length; j++){ if (src[j] === '{') d++; else if (src[j] === '}' && --d === 0) return new Function(m[1], src.slice(i + 1, j)); }
  return null;
}
{
  const panel = cutFn(MAIN, 'bgmPanelMode'), sig = cutFn(MAIN, 'bgmSignalChannel');
  chk(panel && panel('xmas') && panel('playlist') && panel('listen') && !panel('home'), "'xmas' 는 플레이리스트처럼 패널 뒤에 숨는다(마이홈을 따라가지 않음 · 마이홈이 닫혀도 소리)");
  chk(sig && sig('xmas') === null, "  ↳ 곡 끝 신호를 보내지 않는다 → 주입 스크립트가 마이홈처럼 처음으로 되감아 되풀이(PL 아님)");
  const loopSrc = (/function bgmLoopOn\(\)\{([^}]*)\}/.exec(MAIN) || [])[1] || '';
  chk(/bgmMode === 'playlist'/.test(loopSrc), '  ↳ «한 곡 반복» 은 플레이리스트에만(xmas 에 안 걸림)');
  chk(/ipcMain\.on\('companion:openXmasSong', \(e, url, title\) => \{ bgmOpen\(url, title, 'xmas'\); \}\);/.test(MAIN), "IPC companion:openXmasSong → bgmOpen(url, title, 'xmas') — 유튜브 주소 검사(bgmUrlAllowed)를 같은 길로 지난다");
  chk(/openXmasSong\(url, title\) \{\s*ipcRenderer\.send\('companion:openXmasSong', url, title \|\| ''\);/.test(PRELOAD), 'preload — companion.openXmasSong(url, title)');
  chk(/if\(!bgmUrlAllowed\(url\)\)/.test((/function bgmOpen\(url, title, mode\)\{[\s\S]{0,400}/.exec(MAIN) || [''])[0]), '  ↳ bgmOpen 은 유튜브가 아닌 주소를 열지 않는다(받은 편지의 곡 id 는 남이 쓴 값)');
}

say('── 5절 제목 · mutation test');
{
  const w = world(); const b = el(); w.api.bar(b, {}).set({ id: 'eeeeeeeeeee', title: '<img src=x onerror=alert(1)>' });
  chk(parts(b).lab.textContent === '<img src=x onerror=alert(1)>', '남이 쓴 곡 제목은 글자 그대로(textContent)');
  chk(!/innerHTML/.test(SRC.replace(/\/\*[\s\S]*?\*\//g, '')), '뮤직바 모듈에 innerHTML 없음');
  const brokeMain = MAIN.replace("function bgmPanelMode(m){ return m === 'playlist' || m === 'listen' || m === 'xmas'; }", "function bgmPanelMode(m){ return m === 'playlist' || m === 'listen'; }");
  const bp = cutFn(brokeMain, 'bgmPanelMode');
  chk(brokeMain !== MAIN && bp && !bp('xmas'), "mutation test — 'xmas' 를 패널 주인에서 빼면 4절이 빨강(마이홈 좌표를 따라가 마이홈 뒤에 숨는다)");
}

say(`\n${fail ? '✗' : '✓'} ${pass} 통과 · ${fail} 실패`);
process.exit(fail ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(1); });
