/* sim-win-bgm.js — 🎵 창 배경음악(parts/shared/win-bgm.js · 스티커사진 창 · 크리스마스 창이 같이 쓴다)을 실제로 돌려 본다
   실행: node checks/run.js sim-win-bgm
   ・1절 재생 — 창을 열면 첫 곡 처음부터 · 끝나면 다음 곡 · 마지막 뒤엔 첫 곡 · 한 곡이면 되풀이 · 닫으면 멈추고 되감음 · 폴더 폴백 · 회사원 모드 무음 · Audio 없음
   ・2절 끄기 — 받은 저장 키에 기억 · 꺼 둔 PC 는 소리 없이 · 켜면 멈춘 자리부터
   ・3절 겹치지 않게 — 소리를 낼 때만 듣던 BGM 을 재우고 · 끄거나 닫으면 재웠던 쪽만 되살림 · 물러남(duck — 그때 재운 것은 잊음) · NO_OTHERS
   ・배선 — html · smoke 순서 · 스티커사진 창이 이 모듈을 쓴다 · 4절 mutation test */
'use strict';
const fs = require('fs');
let pass = 0, fail = 0;
const say = (s) => console.log(s);
const chk = (ok, msg) => { ok ? pass++ : fail++; say('  ' + (ok ? '✓' : '✗') + ' ' + msg); };
const read = (f) => { for(const c of [f, 'parts/' + f, 'app/parts/' + f, 'app/' + f, f.split('/').pop()]) if(fs.existsSync(c)) return fs.readFileSync(c, 'utf8'); return null; };
const SRC = read('shared/win-bgm.js'), HTML = read('desk-companion-prototype.html'), SMOKE = read('smoke.js'), PKUI = read('purikura/purikura-ui.js');
if(!SRC || !HTML || !SMOKE || !PKUI){ say('  ? 원본 못 찾음'); process.exit(2); }
const load = (src, name) => { const w = {}; new Function('window', 'module', src)(w, undefined); return w[name]; };
const TR4 = ['xmas-bgm.mp3', 'b.mp3', 'c.mp3', 'd.mp3'];

/* 가짜 Audio — 부른 것을 적는다. badSrcs 에 든 경로는 load 뒤 error 를 낸다 */
function world(src, o){
  o = o || {};
  const e = { audios: [], store: Object.assign({}, o.store), saves: [], warns: [], office: !!o.office, hush: 0, unhush: [], playing: 'playing' in o ? o.playing : { pl: true, home: false } };
  class FakeAudio {
    constructor(s){ this.src = s; this.paused = true; this.currentTime = 7; this.loop = false; this.volume = 1; this.L = {}; this.plays = 0; e.audios.push(this); }
    addEventListener(t, f){ this.L[t] = f; }
    play(){ this.plays++; this.paused = false; if(o.blocked) return Promise.reject({ name: 'NotAllowedError' }); return Promise.resolve(); }
    pause(){ this.paused = true; }
  }
  const M = load(src, 'TwWinBgm');
  e.M = M;
  e.B = M.createWinBgm({ Audio: o.noAudio ? null : FakeAudio, tracks: o.tracks || TR4, dirs: o.dirs || ['parts/xmas/', 'xmas/', ''], volume: 0.32, muteKey: o.muteKey || 'tw.testBgmMuted', tag: '시험', storage: o.badStore ? { getItem(){ throw new Error('x'); } } : { getItem: (k) => (k in e.store ? e.store[k] : null) },
    save: (k, v) => { e.saves.push([k, v]); e.store[k] = v; return true; }, officeMode: () => e.office, warn: (...a) => e.warns.push(a.join(' ')),
    others: o.noOthers ? M.NO_OTHERS : { hush: () => { e.hush++; const p = e.playing; e.playing = null; return p; }, unhush: (h) => { e.unhush.push(h); } } });
  e.a = () => e.audios[e.audios.length - 1];
  return e;
}
const J = JSON.stringify;

function judge(src){
  const r = []; const t = (ok, msg) => r.push([!!ok, msg]);
  let e = world(src);
  t(e.audios.length === 0 && e.hush === 0, '만들기만 해서는 소리도 · 재우기도 없다');
  e.B.start();
  t(e.audios.length === 1 && e.a().src === 'parts/xmas/xmas-bgm.mp3' && e.a().loop === false && e.a().paused === false && e.a().currentTime === 0 && Math.abs(e.a().volume - 0.32) < 1e-9,
    '★ 창을 열면 첫 곡을 처음부터 · 받은 음량(0.32)으로 튼다');
  t(e.hush === 1, '★ 소리를 낼 때 듣던 유튜브 BGM 을 재운다(hush 한 번)');
  e.a().currentTime = 33;
  e.B.stop();
  t(e.a().paused === true && e.a().currentTime === 0 && J(e.unhush) === '[{"pl":true,"home":false}]', '★ 닫으면 멈추고 되감는다 · 재웠던 쪽을 되살린다');
  e.B.start();
  t(e.audios.length === 1 && e.a().plays === 2, '  ↳ 다시 열면 같은 Audio 하나를 다시 쓴다');
  /* 곡 넘기기 */
  e = world(src); e.B.start();
  const seen = [e.a().src];
  const TR = TR4;
  for(let i = 0; i < TR.length; i++){ e.a().paused = true; e.a().L.ended(); seen.push(e.a().src + (e.a().paused ? '(멈춤)' : '')); }
  t(seen.join() === TR.concat(TR[0]).map(f => 'parts/xmas/' + f).join() && e.audios.length === 1,
    '★ 한 곡이 끝나면 다음 곡 · 마지막 곡 뒤에는 첫 곡으로(목록을 차례로) — ' + seen.map(x => x.replace('parts/xmas/', '')).join(' → '));
  e.a().L.ended(); e.B.stop(); e.B.start();
  t(e.a().src === 'parts/xmas/xmas-bgm.mp3' && e.a().currentTime === 0 && e.a().paused === false, '  ↳ 창을 다시 열면 첫 곡부터');
  e.a().L.ended(); e.B.toggle(); e.B.stop(); e.B.start(); e.B.toggle();
  t(e.a().src === 'parts/xmas/xmas-bgm.mp3' && e.a().paused === false, '  ↳ 꺼 둔 채 다시 열었다가 켜도 첫 곡부터');
  e = world(src); e.B.start(); e.B.toggle(); e.a().L.ended();
  t(e.a().src === 'parts/xmas/' + TR4[1] && e.a().paused === true, '  ↳ 꺼 둔 사이 곡이 끝나도 소리를 내지 않는다');
  e = world(src, { tracks: ['only.mp3'], dirs: [''] }); e.B.start();
  t(e.a().loop === true, '  곡이 하나뿐이면 그 곡을 되풀이(loop)');
  /* 끄기 */
  e = world(src); e.B.start(); e.a().currentTime = 12;
  e.B.toggle();
  t(e.B.isMuted() === true && e.B.label() === '음악 켜기' && J(e.saves) === '[["tw.testBgmMuted","1"]]' && e.a().paused === true && e.a().currentTime === 12, '★ [음악 끄기] — 멈추고(되감지 않음) · 이 PC 에 1 을 적는다 · 글 «음악 켜기»');
  t(e.unhush.length === 1 && e.unhush[0] && e.unhush[0].pl === true, '  ↳ 내가 껐으면 재웠던 쪽을 되살린다');
  e.playing = { pl: true, home: false };
  e.B.toggle();
  t(e.B.isMuted() === false && e.B.label() === '음악 끄기' && e.saves[1][1] === '0' && e.a().paused === false && e.a().currentTime === 12 && e.hush === 2, '  ↳ 다시 켜면 멈춘 자리부터 · 듣던 것을 다시 재운다');
  e = world(src, { store: { 'tw.testBgmMuted': '1' } }); e.B.start();
  t(e.B.isMuted() === true && e.audios.every(a => a.plays === 0) && e.hush === 0, '★ 꺼 둔 PC 는 창을 열어도 소리가 없고 · 남의 음악을 재우지 않는다');
  e.B.toggle();
  t(e.a() && e.a().paused === false && e.hush === 1, '  ↳ 열어 둔 채 켜면 바로 난다');
  e = world(src); e.B.toggle();
  t(e.audios.length === 0 && e.saves.length === 1 && e.hush === 0, '창이 닫혀 있을 때 끄기 — 기억만 한다(소리 · 재우기 없음)');
  /* 회사원 모드 · Audio 없음 · 저장소 예외 · 자동재생 막힘 */
  e = world(src, { office: true }); e.B.start();
  t(e.audios.every(a => a.plays === 0) && e.hush === 0, '★ 회사원 모드 — 소리를 내지 않고 남의 음악도 재우지 않는다');
  e = world(src); e.B.start(); e.office = true; e.B.refresh();
  t(e.a().paused === true && e.unhush.length === 1 && e.unhush[0] && e.unhush[0].pl === true, '★ 창을 연 채 회사원 모드를 켜면(refresh) 소리를 멈추고 재웠던 쪽을 되살린다');
  e.office = false; e.playing = null; e.B.refresh();
  t(e.a().paused === false, '  ↳ 모드를 끄면(refresh) 다시 난다');
  e = world(src); e.B.refresh();
  t(e.audios.length === 0 && e.hush === 0, '  창이 닫혀 있으면 refresh 는 아무것도 안 한다');
  e = world(src, { noAudio: true }); let threw = false; try{ e.B.start(); e.B.toggle(); e.B.duck(true); e.B.stop(); }catch(_){ threw = true; }
  t(!threw, 'Audio 가 없는 환경에서도 서지 않는다');
  e = world(src, { badStore: true }); e.B.start();
  t(e.B.isMuted() === false && e.a().paused === false, '저장소가 던지면 켜짐으로 돈다');
  /* 경로 폴백 */
  e = world(src, { tracks: ['x.mp3', 'y.mp3'], dirs: ['a/', 'b/'] }); e.B.start(); e.a().L.error();
  t(e.audios.length === 1 && e.a().src === 'b/x.mp3' && e.a().paused === false && e.warns.length === 0, '폴더 폴백 — 첫 폴더에 없으면 다음 폴더에서 다시 튼다');
  e.a().L.ended();
  t(e.a().src === 'b/y.mp3', '  ↳ 찾은 폴더는 다음 곡에도 그대로 쓴다');
  e.a().L.error();
  t(e.warns.length === 1 && /^\[시험\] BGM 파일을 못 찾았어요/.test(e.warns[0]), '  ↳ 다 떨어지면 경고 한 줄(창은 그대로)');
  /* 추천곡에 물러남 */
  e = world(src); e.B.start(); e.a().currentTime = 20;
  e.B.duck(true);
  t(e.a().paused === true && e.a().currentTime === 20 && e.unhush.length === 0, '★ 편지 추천곡이 나면 물러난다(멈춤 · 되감지 않음) — 재워 둔 것은 되살리지 않는다(재생 창이 추천곡으로 넘어감)');
  e.B.duck(false);
  t(e.a().paused === false && e.a().currentTime === 20 && e.hush === 2, '  ↳ 추천곡이 멈추면 멈춘 자리부터 다시 난다');
  e.B.duck(true); e.B.stop();
  t(e.a().paused === true && e.unhush.filter(Boolean).length === 0, '  ↳ 추천곡이 나는 채로 닫으면 아무것도 되살리지 않는다');
  e.B.duck(false);
  t(e.a().paused === true, '  ↳ 닫힌 뒤 늦게 온 «추천곡 멈춤» 에 다시 켜지지 않는다');
  e = world(src, { store: { 'tw.testBgmMuted': '1' } }); e.B.start(); e.B.duck(true); e.B.duck(false);
  t(e.audios.every(a => a.plays === 0), '꺼 둔 채 추천곡이 오가도 소리가 없다');
  /* 남의 음악을 재우지 않는 창(스티커사진 — NO_OTHERS) · 저장 키는 받은 것 */
  e = world(src, { noOthers: true, tracks: ['purikura-bgm.mp3'], dirs: ['parts/', ''], muteKey: 'tw.pkBgmMuted' }); e.B.start();
  t(e.a().src === 'parts/purikura-bgm.mp3' && e.a().loop === true && e.a().paused === false && e.hush === 0, 'NO_OTHERS — 재우기 없이 한 곡을 되풀이(스티커사진 창)');
  e.B.toggle(); e.B.stop(); e.B.start();
  t(J(e.saves) === '[["tw.pkBgmMuted","1"]]' && e.a().paused === true && e.B.label() === '음악 켜기', '  ↳ 끈 상태는 받은 저장 키에 · 꺼 둔 채 닫았다 다시 열면 소리 없음');
  e = world(src, { store: { 'tw.testBgmMuted': 'yes' } });
  t(e.B.isMuted() === false, "모르는 값은 켜짐으로 읽는다('1' 만 끔)");
  e = world(src, { blocked: true }); e.B.start();
  r.push(['async', e]);
  return r;
}

(async () => {
say('── 1 ~ 3절 재생 · 끄기 · 겹치지 않게');
const res = judge(SRC);
for(const [ok, msg] of res){ if(ok === 'async'){ await new Promise(r => setTimeout(r, 0)); chk(msg.warns.some(w => /^\[시험\] BGM 재생이 막혔어요 NotAllowedError/.test(w)), '자동재생이 막히면 삼키지 않고 경고를 남긴다(머리는 받은 tag)'); } else chk(ok, msg); }

say('── 배선');
{
  const M = load(SRC, 'TwWinBgm');
  chk(M.LABEL.playing === '음악 끄기' && M.LABEL.muted === '음악 켜기' && M.NO_OTHERS.hush() === null, '버튼 글 둘 · NO_OTHERS 는 재우지 않는다');
  const at = (s, x) => s.indexOf(x);
  const iW = at(HTML, '<script src="parts/shared/win-bgm.js"></script>');
  chk(iW > 0 && iW < at(HTML, '<script src="parts/purikura/purikura-ui.js"></script>') && iW < at(HTML, '<script src="parts/xmas/xmas-window.js"></script>') && iW < at(HTML, '<script src="parts/app.js"></script>'),
    'html — win-bgm.js 를 purikura-ui.js · xmas-window.js · app.js 보다 먼저');
  const sW = at(SMOKE, "PRELOAD.push('win-bgm.js');");
  chk(sW > 0 && sW < at(SMOKE, "PRELOAD.push('purikura-ui.js');"), 'smoke PRELOAD — win-bgm.js 를 purikura-ui.js 보다 먼저');
  chk(/const pkBgm = TwWinBgm\.createWinBgm\(\{[\s\S]*?tracks: PK_BGM_TRACKS, dirs: PK_BGM_DIRS, volume: PK_BGM_VOL, muteKey: PK_BGM_MUTE_KEY, tag: '스티커사진',[\s\S]*?others: TwWinBgm\.NO_OTHERS,/.test(PKUI)
    && /const PK_BGM_TRACKS = \['purikura-bgm\.mp3'\];/.test(PKUI) && /const PK_BGM_DIRS = \['parts\/', ''\];/.test(PKUI) && /const PK_BGM_MUTE_KEY = 'tw\.pkBgmMuted';/.test(PKUI),
    '★ 스티커사진 창 — 같은 파일 · 같은 폴더 후보 · 같은 저장 키(tw.pkBgmMuted)로 이 모듈을 쓴다');
}

say('── 4절 mutation test');
{
  const muts = [
    ['꺼 둬도 소리를 냄', SRC.replace('const wants = () => open && !muted && !ducked && !officeMode();', 'const wants = () => open && !ducked && !officeMode();')],
    ['회사원 모드에서도 소리', SRC.replace('const wants = () => open && !muted && !ducked && !officeMode();', 'const wants = () => open && !muted && !ducked;')],
    ['추천곡과 겹침', SRC.replace('const wants = () => open && !muted && !ducked && !officeMode();', 'const wants = () => open && !muted && !officeMode();')],
    ['끄기를 기억 안 함', SRC.replace("    save(muteKey, muted ? '1' : '0');\n", '')],
    ['듣던 것을 안 재움', SRC.replace('      if(!hushed) hushed = others.hush();\n', '')],
    ['닫아도 안 되살림', SRC.replace('    if(ducked){ hushed = null; ducked = false; } else wake();\n', '    if(ducked){ hushed = null; ducked = false; }\n')],
    ['추천곡에 물러날 때 재운 것을 되살림', SRC.replace('    if(on) hushed = null;   // 추천곡이 재생 창을 가져갔다 — 재워 둔 것은 되살릴 수 없다\n', '').replace('    if(!ducked) wake();', '    wake();')],
    ['닫을 때 되감지 않음', SRC.replace('    open = false; halt(true);\n', '    open = false; halt(false);\n')],
    ['끝나도 다음 곡으로 안 넘어감', SRC.replace('trackIdx = (trackIdx + 1) % tracks.length; load(); if(wants()) play(false);', '')],
    ['다시 열어도 듣던 곡부터', SRC.replace('if(fromStart){ if(trackIdx !== 0){ trackIdx = 0; load(); } ', 'if(fromStart){ ').replace('    if(trackIdx !== 0){ trackIdx = 0; load(); }   // 다음에 열면(꺼 둔 채 열었다 켜도) 첫 곡부터\n', '')],
    ['회사원 모드를 켜도 안 멈춤', SRC.replace('function refresh(){ if(open) sync(false); }', 'function refresh(){}')],
    ['꺼 둔 사이 곡이 끝나면 소리를 냄', SRC.replace("a.addEventListener('ended', () => { trackIdx = (trackIdx + 1) % tracks.length; load(); if(wants()) play(false); });", "a.addEventListener('ended', () => { trackIdx = (trackIdx + 1) % tracks.length; load(); play(false); });")],
  ];
  for(const [name, m] of muts){
    let red = false;
    try{ red = judge(m).some(([ok]) => ok === false); }catch(_){ red = true; }
    chk(m !== SRC && red, name + ' → 빨강' + (m === SRC ? ' — 바꿀 글을 못 찾음' : ''));
  }
}

say(`\n${fail ? '✗' : '✓'} ${pass} 통과 · ${fail} 실패`);
console.log(pass + ' · ' + fail);
process.exit(fail ? 1 : 0);
})();
