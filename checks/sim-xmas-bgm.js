/* sim-xmas-bgm.js — 🎄 크리스마스 창 배경음악의 곡 목록 · 음악 출처(parts/xmas/xmas-bgm.js · xmas-credit.js · xmas-song.js onPlay)를 실제로 돌려 본다
   실행: node checks/run.js sim-xmas-bgm
   재생 · 끄기 기억 · 듣던 BGM 재우기 · 물러나기 규칙은 shared/win-bgm.js — sim-win-bgm.js 가 돌린다. 여기는 크리스마스 몫만.
   ・4절 곡 목록 · 출처 글 — 파일이 다 있는지 · 내용 · 올리기 / 걷기 / 끝나면 숨김 · 글은 textContent
   ・5절 추천곡 알림(xmas-song onPlay) · 6절 배선(html · 창이 win-bgm 에 넘기는 값 · 기기 칸 · 글꼴 고지) */
'use strict';
const fs = require('fs');
let pass = 0, fail = 0;
const say = (s) => console.log(s);
const chk = (ok, msg) => { ok ? pass++ : fail++; say('  ' + (ok ? '✓' : '✗') + ' ' + msg); };
const read = (f) => { for(const c of [f, 'parts/' + f, 'app/parts/' + f, 'app/' + f, f.split('/').pop()]) if(fs.existsSync(c)) return fs.readFileSync(c, 'utf8'); return null; };
const has = (f) => [f, 'parts/' + f, 'app/parts/' + f, 'app/' + f, f.split('/').pop()].some(c => fs.existsSync(c));
const SRC = read('xmas/xmas-bgm.js'), CRED = read('xmas/xmas-credit.js'), SONG = read('xmas/xmas-song.js'), HTML = read('desk-companion-prototype.html'), ACC = read('shared/account-store.js'),
  APP = read('app.js'), WIN = read('xmas/xmas-window.js'), OSS = read('licenses/oss-notices.js'), PS = read('launcher/program-settings.js');
if(!SRC || !CRED || !SONG || !HTML || !ACC || !APP || !WIN || !OSS || !PS){ say('  ? 원본 못 찾음'); process.exit(2); }
const load = (src, name) => { const w = {}; new Function('window', 'module', src)(w, undefined); return w[name]; };

(async () => {
say('── 4절 곡 목록 · 출처 글');
{
  const M = load(SRC, 'TwXmasBgm');
  chk(Array.isArray(M.CREDIT) && M.CREDIT.includes('투게더트리') && M.CREDIT.includes('음악 제작 HADA') && M.CREDIT.includes('CM @hada_msc') && Object.isFrozen(M.CREDIT), '출처 — 제목 «투게더트리» · 음악 제작 HADA · CM @hada_msc');
  chk(['We Wish You A Merry Christmas', 'Silent Night', '공유마당(한국저작권위원회)'].every(x => M.CREDIT.includes(x)) && !M.CREDIT.includes('The First Noel') && !M.CREDIT.includes('Jingle Bell') && !M.CREDIT.includes('Jingle Bells (Jazz)'), '출처 — 캐롤 두 곡 이름 · 공유마당(한국저작권위원회) · 뺀 곡은 없다');
  chk(['Jingle Punks', "E's Jammy Jams", '유튜브 오디오 라이브러리'].every(x => M.CREDIT.includes(x)), '출처 — 유튜브 오디오 라이브러리 두 곡의 만든이 · 출처');
  chk(M.TRACKS.length === 6 && new Set(M.TRACKS).size === 6 && M.TRACKS[0] === 'xmas-bgm.mp3' && M.TRACKS.every(f => has('xmas/' + f)), '★ 곡 목록의 파일 여섯이 모두 앱에 있다(parts/xmas/ · 겹치는 이름 없음) — ' + M.TRACKS.join(' · '));
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
  const mk = (src) => { const seen = [], taken2 = []; const cb = {}; const c = { onBgmMode: (f) => { cb.mode = f; }, onBgmClosed: (f) => { cb.closed = f; }, openXmasSong(){}, pauseBgm(){}, resumeBgm(){}, closeBgm(){} };
    const el = () => ({ textContent: '', classList: { add(){}, remove(){} }, style: { removeProperty(){}, setProperty(){} }, appendChild(){}, scrollWidth: 0, clientWidth: 100, onclick: null });
    const mod = src === SONG ? S : load(src, 'TwXmasSong');
    const sg = mod.createXmasSong({ doc: { createElement: el }, win: { requestAnimationFrame(){} }, companion: () => c, ytVideoId: () => null, asyncPrompt: async () => null, toast(){}, songTitleMax: 40 });
    sg.onPlay((on, taken) => { seen.push(on); taken2.push(taken); });
    const box = el(); const kids = []; box.appendChild = (k) => { kids.push(k); };
    const bar = sg.bar(box, {}); bar.set({ id: 'abcdefghijk', title: '곡' });
    return { sg, seen, taken: taken2, play: kids[0], cb };
  };
  const sj = (src) => { const w = mk(src); const r = [];
    w.play.onclick(); r.push([w.seen.join() === 'true', '추천곡을 틀면 onPlay(true)']);
    w.play.onclick(); r.push([w.seen.join() === 'true,false', '  멈추면(일시정지) onPlay(false)']);
    w.play.onclick(); r.push([w.seen.join() === 'true,false,true', '  다시 틀면 onPlay(true)']);
    w.cb.mode('home'); r.push([w.seen.join() === 'true,false,true,false' && w.taken.join() === 'false,false,false,true', '★ 다른 주인(마이홈 · 플레이리스트)이 재생 창을 가져가면 onPlay(false, taken=true) — 내가 멈춘 것은 taken=false']);
    w.play.onclick(); w.sg.stop(); r.push([w.seen.slice(-2).join() === 'true,false' && w.taken[w.taken.length - 1] === false, '  편지 창을 닫으면(stop) onPlay(false) · taken 아님']);
    w.play.onclick(); w.cb.closed(); r.push([w.seen.slice(-2).join() === 'true,false' && w.taken[w.taken.length - 1] === false, '  재생 창이 닫힌 것도 taken 아님(배경음악이 돌아온다)']);
    const n = w.seen.length; w.sg.stop(); r.push([w.seen.length === n, '  같은 상태로는 다시 알리지 않는다']);
    return r; };
  sj(SONG).forEach(([ok, msg]) => chk(ok, msg));
  const cut = SONG.replace("    if (on !== sounding){ sounding = on; playFns.slice().forEach(fn => fn(on, !!taken)); }\n", '');
  let red = false; try{ red = sj(cut).some(([ok]) => !ok); }catch(_){ red = true; }
  chk(cut !== SONG && red, 'mutation test — 알림을 빼면 위 판정이 빨강');
  const cut2 = SONG.replace("if (mode !== 'xmas') lose(true);", "if (mode !== 'xmas') lose();");
  let red2 = false; try{ red2 = sj(cut2).some(([ok]) => !ok); }catch(_){ red2 = true; }
  chk(cut2 !== SONG && red2, 'mutation test — 가져간 표시(taken)를 빼면 위 판정이 빨강');
}

say('── 6절 배선');
{
  const M0 = load(SRC, 'TwXmasBgm');
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
  chk(/bgmMod: TwXmasBgm, winBgmMod: TwWinBgm, creditMod: TwXmasCredit,/.test(APP) && /onOfficeModeChanged: \(\)=>\{ if\(xmasWinMod\) xmasWinMod\.syncBgm\(\); \},/.test(APP) && /setOfficeMode\(!officeMode\(\)\);\n    onOfficeModeChanged\(\);/.test(PS) && /officeMode: \(\)=>officeModeMod\.officeMode\(\)/.test(APP) && /bgmHush: TwBgmHush\.createBgmHush\(\{/.test(APP), 'app.js — 창에 곡 목록 · 창 배경음악 · 출처 모듈 · 회사원 모드 · 재우기 규칙을 넘긴다 · 회사원 모드가 바뀌면 syncBgm');
  chk(/deps\.winBgmMod\.createWinBgm\(\{ Audio: deps\.Audio, tracks: B\.TRACKS, dirs: B\.DIRS, volume: B\.VOLUME, muteKey: B\.MUTE_KEY, tag: B\.TAG,/.test(WIN), '창 — 재생은 shared/win-bgm 에 크리스마스 값을 넘겨 만든다(재생기를 따로 두지 않는다)');
  chk(M0.MUTE_KEY === 'tw.xmasBgmMuted' && M0.VOLUME > 0 && M0.VOLUME <= 1 && M0.DIRS[0] === 'parts/xmas/' && !('createXmasBgm' in M0), '크리스마스 몫은 값뿐 — 저장 키 · 음량 · 폴더(재생 함수 없음)');
}

say(`\n${fail ? '✗' : '✓'} ${pass} 통과 · ${fail} 실패`);
console.log(pass + ' · ' + fail);
process.exit(fail ? 1 : 0);
})();
