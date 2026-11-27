/* sim-xmas-bgm.js — 🎄 크리스마스 창 배경음악 · 음악 출처(parts/xmas/xmas-bgm.js · xmas-credit.js · xmas-song.js onPlay)를 실제로 돌려 본다
   실행: node checks/run.js sim-xmas-bgm
   ・1절 재생 — 창을 열면 첫 곡 처음부터 · 끝나면 다음 곡 · 마지막 뒤엔 첫 곡 · 닫으면 멈추고 되감음 · 폴더 폴백 · 회사원 모드 무음 · Audio 없음
   ・2절 끄기 — 이 PC 에 기억(tw.xmasBgmMuted) · 꺼 둔 PC 는 소리 없이 · 켜면 멈춘 자리부터
   ・3절 겹치지 않게 — 소리를 낼 때만 듣던 BGM 을 재우고 · 끄거나 닫으면 재웠던 쪽만 되살림 · 추천곡이 나는 동안 물러남(그때 재운 것은 잊음)
   ・4절 출처 글 — 내용 · 올리기 / 걷기 / 끝나면 숨김 · 글은 textContent
   ・5절 추천곡 알림(xmas-song onPlay) · 6절 배선(html · 파일 · 기기 칸 · 글꼴 고지) · 7절 mutation test */
'use strict';
const fs = require('fs');
let pass = 0, fail = 0;
const say = (s) => console.log(s);
const chk = (ok, msg) => { ok ? pass++ : fail++; say('  ' + (ok ? '✓' : '✗') + ' ' + msg); };
const read = (f) => { for(const c of [f, 'parts/' + f, 'app/parts/' + f, 'app/' + f, f.split('/').pop()]) if(fs.existsSync(c)) return fs.readFileSync(c, 'utf8'); return null; };
const has = (f) => [f, 'parts/' + f, 'app/parts/' + f, 'app/' + f, f.split('/').pop()].some(c => fs.existsSync(c));
const SRC = read('xmas/xmas-bgm.js'), CRED = read('xmas/xmas-credit.js'), SONG = read('xmas/xmas-song.js'), HTML = read('desk-companion-prototype.html'), ACC = read('shared/account-store.js'),
  APP = read('app.js'), WIN = read('xmas/xmas-window.js'), OSS = read('licenses/oss-notices.js');
if(!SRC || !CRED || !SONG || !HTML || !ACC || !APP || !WIN || !OSS){ say('  ? 원본 못 찾음'); process.exit(2); }
const load = (src, name) => { const w = {}; new Function('window', 'module', src)(w, undefined); return w[name]; };

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
  const M = load(src, 'TwXmasBgm');
  e.M = M;
  e.B = M.createXmasBgm({ Audio: o.noAudio ? null : FakeAudio, tracks: o.tracks, dirs: o.dirs, storage: o.badStore ? { getItem(){ throw new Error('x'); } } : { getItem: (k) => (k in e.store ? e.store[k] : null) },
    save: (k, v) => { e.saves.push([k, v]); e.store[k] = v; return true; }, officeMode: () => e.office, warn: (...a) => e.warns.push(a.join(' ')),
    others: { hush: () => { e.hush++; const p = e.playing; e.playing = null; return p; }, unhush: (h) => { e.unhush.push(h); } } });
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
    '★ 창을 열면 첫 곡(투게더트리)을 처음부터 · 작은 소리(0.32)로 튼다');
  t(e.hush === 1, '★ 소리를 낼 때 듣던 유튜브 BGM 을 재운다(hush 한 번)');
  e.a().currentTime = 33;
  e.B.stop();
  t(e.a().paused === true && e.a().currentTime === 0 && J(e.unhush) === '[{"pl":true,"home":false}]', '★ 닫으면 멈추고 되감는다 · 재웠던 쪽을 되살린다');
  e.B.start();
  t(e.audios.length === 1 && e.a().plays === 2, '  ↳ 다시 열면 같은 Audio 하나를 다시 쓴다');
  /* 곡 넘기기 */
  e = world(src); e.B.start();
  const seen = [e.a().src];
  for(let i = 0; i < 4; i++){ e.a().paused = true; e.a().L.ended(); seen.push(e.a().src + (e.a().paused ? '(멈춤)' : '')); }
  t(seen.join() === 'parts/xmas/xmas-bgm.mp3,parts/xmas/xmas-bgm-noel.mp3,parts/xmas/xmas-bgm-wish.mp3,parts/xmas/xmas-bgm-jingle.mp3,parts/xmas/xmas-bgm.mp3' && e.audios.length === 1,
    '★ 한 곡이 끝나면 다음 곡 · 마지막 곡 뒤에는 첫 곡으로(네 곡을 차례로) — ' + seen.map(x => x.replace('parts/xmas/', '')).join(' → '));
  e.a().L.ended(); e.B.stop(); e.B.start();
  t(e.a().src === 'parts/xmas/xmas-bgm.mp3' && e.a().currentTime === 0 && e.a().paused === false, '  ↳ 창을 다시 열면 첫 곡부터');
  e = world(src); e.B.start(); e.B.toggle(); e.a().L.ended();
  t(e.a().src === 'parts/xmas/xmas-bgm-noel.mp3' && e.a().paused === true, '  ↳ 꺼 둔 사이 곡이 끝나도 소리를 내지 않는다');
  e = world(src, { tracks: ['only.mp3'], dirs: [''] }); e.B.start();
  t(e.a().loop === true, '  곡이 하나뿐이면 그 곡을 되풀이(loop)');
  /* 끄기 */
  e = world(src); e.B.start(); e.a().currentTime = 12;
  e.B.toggle();
  t(e.B.isMuted() === true && e.B.label() === '음악 켜기' && J(e.saves) === '[["tw.xmasBgmMuted","1"]]' && e.a().paused === true && e.a().currentTime === 12, '★ [음악 끄기] — 멈추고(되감지 않음) · 이 PC 에 1 을 적는다 · 글 «음악 켜기»');
  t(e.unhush.length === 1 && e.unhush[0] && e.unhush[0].pl === true, '  ↳ 내가 껐으면 재웠던 쪽을 되살린다');
  e.playing = { pl: true, home: false };
  e.B.toggle();
  t(e.B.isMuted() === false && e.B.label() === '음악 끄기' && e.saves[1][1] === '0' && e.a().paused === false && e.a().currentTime === 12 && e.hush === 2, '  ↳ 다시 켜면 멈춘 자리부터 · 듣던 것을 다시 재운다');
  e = world(src, { store: { 'tw.xmasBgmMuted': '1' } }); e.B.start();
  t(e.B.isMuted() === true && e.audios.every(a => a.plays === 0) && e.hush === 0, '★ 꺼 둔 PC 는 창을 열어도 소리가 없고 · 남의 음악을 재우지 않는다');
  e.B.toggle();
  t(e.a() && e.a().paused === false && e.hush === 1, '  ↳ 열어 둔 채 켜면 바로 난다');
  e = world(src); e.B.toggle();
  t(e.audios.length === 0 && e.saves.length === 1 && e.hush === 0, '창이 닫혀 있을 때 끄기 — 기억만 한다(소리 · 재우기 없음)');
  /* 회사원 모드 · Audio 없음 · 저장소 예외 · 자동재생 막힘 */
  e = world(src, { office: true }); e.B.start();
  t(e.audios.every(a => a.plays === 0) && e.hush === 0, '★ 회사원 모드 — 소리를 내지 않고 남의 음악도 재우지 않는다');
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
  t(e.warns.length === 1 && /BGM 파일을 못 찾았어요/.test(e.warns[0]), '  ↳ 다 떨어지면 경고 한 줄(창은 그대로)');
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
  e = world(src, { store: { 'tw.xmasBgmMuted': '1' } }); e.B.start(); e.B.duck(true); e.B.duck(false);
  t(e.audios.every(a => a.plays === 0), '꺼 둔 채 추천곡이 오가도 소리가 없다');
  e = world(src, { blocked: true }); e.B.start();
  r.push(['async', e]);
  return r;
}

(async () => {
say('── 1 ~ 3절 재생 · 끄기 · 겹치지 않게');
const res = judge(SRC);
for(const [ok, msg] of res){ if(ok === 'async'){ await new Promise(r => setTimeout(r, 0)); chk(msg.warns.some(w => /재생이 막혔어요 NotAllowedError/.test(w)), '자동재생이 막히면 삼키지 않고 경고를 남긴다'); } else chk(ok, msg); }

say('── 4절 출처 글');
{
  const M = load(SRC, 'TwXmasBgm');
  chk(Array.isArray(M.CREDIT) && M.CREDIT.includes('투게더트리') && M.CREDIT.includes('음악 제작 HADA') && M.CREDIT.includes('CM @hada_msc') && Object.isFrozen(M.CREDIT), '출처 — 제목 «투게더트리» · 음악 제작 HADA · CM @hada_msc');
  chk(['The First Noel', 'We Wish You A Merry Christmas', 'Jingle Bell', '공유마당(한국저작권위원회)'].every(x => M.CREDIT.includes(x)), '출처 — 캐롤 세 곡 · 공유마당(한국저작권위원회)');
  chk(M.TRACKS.length === 4 && M.TRACKS[0] === 'xmas-bgm.mp3' && M.TRACKS.every(f => has('xmas/' + f)), '★ 곡 목록의 파일 넷이 모두 앱에 있다(parts/xmas/) — ' + M.TRACKS.join(' · '));
  const mkEl = () => { const cls = new Set(), L = {}, st = {}; const el = { children: [], hidden: false, textContent: '', className: '', clientHeight: 480, offsetWidth: 1,
    classList: { add: (c) => cls.add(c), remove: (c) => cls.delete(c), contains: (c) => cls.has(c) }, style: { setProperty: (k, v) => { st[k] = v; } }, st,
    addEventListener: (t, f) => { L[t] = f; }, fire: (t) => L[t] && L[t](), appendChild(c){ this.children.push(c); return c; } }; return el; };
  const cworld = (src) => { const box = mkEl(); box.hidden = true; const C = load(src, 'TwXmasCredit').createXmasCredit({ doc: { createElement: () => mkEl() }, box, lines: ['♪ MUSIC ♪', '<b>곡</b>', '', 'HADA'] }); return { box, C }; };
  const cj = (src) => {
    const r = []; const t = (ok, msg) => r.push([!!ok, msg]);
    const w = cworld(src);
    t(w.box.hidden === true && w.box.children.length === 0 && w.C.showing() === false, '처음엔 숨김 · 글을 만들지 않는다');
    w.C.toggle();
    const roll = w.box.children[0];
    t(w.box.hidden === false && w.C.showing() === true && roll && roll.classList.contains('go') && roll.st['--xmStageH'] === '480px', '★ [음악 출처] — 글 상자를 보이고 올라가기(.go)를 건다 · 올라갈 거리에 화면 높이');
    t(roll.children.length === 4 && roll.children[0].className === 'xm-rhead' && roll.children[1].textContent === '<b>곡</b>' && roll.children[2].className === 'xm-rgap' && roll.children[2].textContent === '', '  ↳ 한 줄에 하나 · 첫 줄은 머리글 · 빈 글은 띄움 · 글은 글자 그대로(textContent)');
    w.C.toggle();
    t(w.box.hidden === true && !roll.classList.contains('go'), '★ 올라가는 중에 다시 누르면 바로 걷는다');
    w.C.toggle(); roll.fire('animationend');
    t(w.box.hidden === true && !roll.classList.contains('go') && w.box.children.length === 1, '★ 다 올라가면(animationend) 스스로 숨는다 · 글은 한 번만 만든다');
    w.C.stop(); w.C.stop();
    t(w.box.hidden === true, '  stop 은 여러 번 불러도 된다');
    return r;
  };
  cj(CRED).forEach(([ok, msg]) => chk(ok, msg));
  chk(!/innerHTML/.test(CRED.replace(/\/\*[\s\S]*?\*\//g, '')), '출처 모듈에 innerHTML 없음');
  const cm = [['끝나도 안 숨김', CRED.replace("    roll.addEventListener('animationend', stop);\n", '')], ['다시 눌러도 안 걷음', CRED.replace('function toggle(){ if(showing()) stop(); else play(); }', 'function toggle(){ play(); }')]];
  for(const [name, m] of cm){ let red = false; try{ red = cj(m).some(([ok]) => !ok); }catch(_){ red = true; } chk(m !== CRED && red, 'mutation test — ' + name + ' → 빨강'); }
}

say('── 5절 추천곡 알림(xmas-song onPlay)');
{
  const S = load(SONG, 'TwXmasSong');
  const mk = (src) => { const seen = []; const cb = {}; const c = { onBgmMode: (f) => { cb.mode = f; }, onBgmClosed: (f) => { cb.closed = f; }, openXmasSong(){}, pauseBgm(){}, resumeBgm(){}, closeBgm(){} };
    const el = () => ({ textContent: '', classList: { add(){}, remove(){} }, style: { removeProperty(){}, setProperty(){} }, appendChild(){}, scrollWidth: 0, clientWidth: 100, onclick: null });
    const mod = src === SONG ? S : load(src, 'TwXmasSong');
    const sg = mod.createXmasSong({ doc: { createElement: el }, win: { requestAnimationFrame(){} }, companion: () => c, ytVideoId: () => null, asyncPrompt: async () => null, toast(){}, songTitleMax: 40 });
    sg.onPlay((on) => seen.push(on));
    const box = el(); const kids = []; box.appendChild = (k) => { kids.push(k); };
    const bar = sg.bar(box, {}); bar.set({ id: 'abcdefghijk', title: '곡' });
    return { sg, seen, play: kids[0], cb };
  };
  const sj = (src) => { const w = mk(src); const r = [];
    w.play.onclick(); r.push([w.seen.join() === 'true', '추천곡을 틀면 onPlay(true)']);
    w.play.onclick(); r.push([w.seen.join() === 'true,false', '  멈추면(일시정지) onPlay(false)']);
    w.play.onclick(); r.push([w.seen.join() === 'true,false,true', '  다시 틀면 onPlay(true)']);
    w.cb.mode('home'); r.push([w.seen.join() === 'true,false,true,false', '★ 다른 주인(마이홈 · 플레이리스트)이 재생 창을 가져가면 onPlay(false)']);
    w.play.onclick(); w.sg.stop(); r.push([w.seen.slice(-2).join() === 'true,false', '  편지 창을 닫으면(stop) onPlay(false)']);
    const n = w.seen.length; w.sg.stop(); r.push([w.seen.length === n, '  같은 상태로는 다시 알리지 않는다']);
    return r; };
  sj(SONG).forEach(([ok, msg]) => chk(ok, msg));
  const cut = SONG.replace("    if (on !== sounding){ sounding = on; playFns.slice().forEach(fn => fn(on)); }\n", '');
  let red = false; try{ red = sj(cut).some(([ok]) => !ok); }catch(_){ red = true; }
  chk(cut !== SONG && red, 'mutation test — 알림을 빼면 위 판정이 빨강');
}

say('── 6절 배선');
{
  const at = (x) => HTML.indexOf(x);
  const iW = at('<script src="parts/xmas/xmas-window.js"></script>');
  chk(at('<script src="parts/xmas/xmas-bgm.js"></script>') > 0 && at('<script src="parts/xmas/xmas-bgm.js"></script>') < iW && at('<script src="parts/xmas/xmas-credit.js"></script>') > 0 && at('<script src="parts/xmas/xmas-credit.js"></script>') < iW,
    'html — xmas-bgm.js · xmas-credit.js 를 xmas-window.js 보다 먼저');
  chk(at('<script src="parts/shared/bgm-hush.js"></script>') > 0 && at('<script src="parts/shared/bgm-hush.js"></script>') < at('<script src="parts/app.js"></script>'), 'html — bgm-hush.js 를 app.js 보다 먼저');
  chk(/<button type="button" class="xm-tbtn" id="xmasBgmBtn"[^>]*>음악 끄기<\/button><button type="button" class="xm-tbtn" id="xmasCreditBtn"[^>]*>음악 출처<\/button>/.test(HTML) && /<div id="xmasCredit" hidden><\/div>/.test(HTML),
    'html — 제목줄 [음악 끄기] [음악 출처](button — 제목줄 끌기에서 빠진다) · 트리 화면 안 글 상자 #xmasCredit');
  const css = (HTML.match(/#xmasCredit\{[^}]*\}/) || [''])[0];
  chk(/pointer-events:none/.test(css) && /overflow:hidden/.test(css), '★ 글 상자는 pointer-events:none · 넘치는 글은 가린다(올라가는 동안에도 트리를 누를 수 있다)');
  chk(/\.xm-roll\{[^}]*color:#fff[^}]*'Galmuri11'[^}]*text-shadow:[^}]*#000/.test(HTML) && /@keyframes xmCredit\{/.test(HTML) && /\.xm-roll\.go\{animation:xmCredit \d+s linear forwards;\}/.test(HTML),
    '출처 글 — 하얀 글자 · 검은 테두리 · 도트 글꼴(Galmuri11) · 아래에서 위로 한 번');
  chk(/@font-face\{font-family:'Galmuri11';[^}]*url\('vendor\/galmuri\/Galmuri11-Bold\.woff2'\)/.test(HTML) && has('vendor/galmuri/Galmuri11-Bold.woff2') && has('vendor/galmuri/LICENSE'), '글꼴 파일 · 라이선스 원문이 앱에 있다(vendor/galmuri)');
  chk(/"name":"Galmuri"/.test(OSS) && /OFL-1\.1/.test(OSS), '★ 오픈소스 라이선스 창에 Galmuri(OFL-1.1) 가 실린다');
  chk(ACC.includes("'tw.xmasBgmMuted'"), '기기 칸 목록에 tw.xmasBgmMuted — 계정을 바꿔도 이 PC 설정으로 남는다');
  chk(/bgmMod: TwXmasBgm, creditMod: TwXmasCredit,/.test(APP) && /officeMode: \(\)=>officeModeMod\.officeMode\(\)/.test(APP) && /bgmHush: TwBgmHush\.createBgmHush\(\{/.test(APP), 'app.js — 창에 배경음악 · 출처 모듈 · 회사원 모드 · 재우기 규칙을 넘긴다');
  chk(/song\.onPlay\(\(on\) => bgm\.duck\(on\)\);/.test(WIN), '창 — 추천곡 알림에 duck 을 건다');
}

say('── 7절 mutation test');
{
  const muts = [
    ['꺼 둬도 소리를 냄', SRC.replace('const wants = () => open && !muted && !ducked && !officeMode();', 'const wants = () => open && !ducked && !officeMode();')],
    ['회사원 모드에서도 소리', SRC.replace('const wants = () => open && !muted && !ducked && !officeMode();', 'const wants = () => open && !muted && !ducked;')],
    ['추천곡과 겹침', SRC.replace('const wants = () => open && !muted && !ducked && !officeMode();', 'const wants = () => open && !muted && !officeMode();')],
    ['끄기를 기억 안 함', SRC.replace("    save(MUTE_KEY, muted ? '1' : '0');\n", '')],
    ['듣던 것을 안 재움', SRC.replace('      if(!hushed) hushed = others.hush();\n', '')],
    ['닫아도 안 되살림', SRC.replace('if(ducked){ hushed = null; ducked = false; } else wake(); }', 'if(ducked){ hushed = null; ducked = false; } }')],
    ['추천곡에 물러날 때 재운 것을 되살림', SRC.replace('    if(on) hushed = null;   // 추천곡이 재생 창을 가져갔다 — 재워 둔 것은 되살릴 수 없다\n', '').replace('    if(!ducked) wake();', '    wake();')],
    ['닫을 때 되감지 않음', SRC.replace('function stop(){ open = false; halt(true);', 'function stop(){ open = false; halt(false);')],
    ['끝나도 다음 곡으로 안 넘어감', SRC.replace('trackIdx = (trackIdx + 1) % tracks.length; load(); if(wants()) play(false);', '')],
    ['다시 열어도 듣던 곡부터', SRC.replace('if(trackIdx !== 0){ trackIdx = 0; load(); } ', '')],
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
