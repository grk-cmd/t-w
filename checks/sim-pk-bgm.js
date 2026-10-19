/* sim-pk-bgm.js — 🎵 스티커사진 창 BGM(purikura/pk-bgm.js): 창이 열려 있는 동안만 · 끄면 이 PC 에 기억
   실행:  node sim-pk-bgm.js   (pk-bgm.js · desk-companion-prototype.html · smoke.js 가 있는 폴더에서)
   ★ 왜 이 검사가 있는가 — 끈 사람에게 다음에 창을 열 때 또 음악이 나면 끄기가 없는 것과 같다. 회사원 모드 · 자동재생 잠금 · 파일 없음도 예전처럼.
   ・1절: 시작 · 멈춤 — 처음부터 · 되감기 · 회사원 모드 무음 · 파일 경로 폴백 · 재생 막힘은 경고로
   ・2절: 끄기 — 열려 있으면 바로 · 켤 때는 멈춘 자리부터 · 닫혀 있을 때 눌러도 기억만 · 저장 키 · 버튼 글 · 꺼 둔 PC 는 처음부터 무음
   ・3절: 깨 보기 · 4절: 배선(html 순서 · 제목줄 칸 · smoke) */
'use strict';
const fs = require('fs');
let pass = 0, fail = 0;
const say = (s) => console.log(s);
const chk = (ok, msg) => { ok ? pass++ : fail++; say('  ' + (ok ? '✓' : '✗') + ' ' + msg); };
const read = (f) => { for (const c of [f, 'parts/' + f, 'app/parts/' + f, 'app/' + f, 'checks/' + f]) if (fs.existsSync(c)) return fs.readFileSync(c, 'utf8'); return null; };
const MOD = read('pk-bgm.js') || read('purikura/pk-bgm.js'), HTML = read('desk-companion-prototype.html'), SMOKE = read('smoke.js');
if (!MOD || !HTML || !SMOKE) { say('  ? 원본 못 찾음 — pk-bgm.js · desk-companion-prototype.html · smoke.js'); process.exit(2); }

const load = (src) => { const w = {}; new Function('window', 'module', src)(w, undefined); return w.TwPkBgm; };

function world(src, o = {}) {
  const env = { audio: [], warns: [], saved: [], ls: Object.assign({}, o.ls || {}), office: !!o.office };
  class A {
    constructor(s){ this.src = s; this.paused = true; this.currentTime = 0; this.L = {}; env.audio.push(this); }
    addEventListener(t, f){ this.L[t] = f; } load(){}
    play(){ this.paused = false; return o.blocked ? Promise.reject({ name: 'NotAllowedError' }) : Promise.resolve(); }
    pause(){ this.paused = true; }
  }
  const api = load(src);
  const bgm = api.createPkBgm({
    Audio: A, srcs: ['parts/x.mp3', 'x.mp3'], volume: 0.32,
    storage: { getItem: (k) => (k in env.ls ? env.ls[k] : null) },
    save: (k, v) => { env.saved.push([k, v]); env.ls[k] = v; return true; },
    officeMode: () => env.office, warn: (...a) => env.warns.push(a.join(' ')),
  });
  return { api, bgm, env };
}
const flush = () => new Promise((r) => setImmediate(r));

function behave(src) {
  const r = []; const t = (ok, m) => r.push([!!ok, m]);
  let w = world(src);
  t(w.api && w.api.MUTE_KEY === 'tw.pkBgmMuted' && w.api.LABEL.playing === '음악 끄기' && w.api.LABEL.muted === '음악 켜기', '저장 키 tw. 접두사 · 버튼 글 둘');
  t(w.bgm.label() === '음악 끄기' && !w.bgm.isMuted() && w.env.audio.length === 0, '처음엔 켜짐 · 열기 전엔 파일도 안 만든다');
  w.bgm.start(); const a = w.env.audio[0];
  t(a && a.paused === false && a.loop === true && a.volume === 0.32 && a.src === 'parts/x.mp3', '열면 처음 후보로 반복 재생 · 음량');
  a.currentTime = 42; w.bgm.stop();
  t(a.paused === true && a.currentTime === 0, '닫으면 멈추고 되감는다');
  a.currentTime = 9; w.bgm.start();
  t(a.paused === false && a.currentTime === 0 && w.env.audio.length === 1, '다시 열면 같은 인스턴스를 처음부터');
  w = world(src, { office: true }); w.bgm.start();
  t(w.env.audio.length === 0, '회사원 모드면 소리를 안 낸다');
  w = world(src); w.bgm.start(); w.env.audio[0].L.error(); w.bgm.stop(); w.bgm.start();
  t(w.env.audio.length === 2 && w.env.audio[1].src === 'x.mp3' && w.env.audio[1].paused === false, '파일이 없으면 다음 후보로 갈아탄다');
  w.env.audio[1].L.error();
  t(/BGM 파일을 못 찾았어요/.test(w.env.warns.join()), '  후보가 다 떨어지면 경고만(창은 그대로)');
  /* 끄기 */
  w = world(src); w.bgm.start(); const b = w.env.audio[0]; b.currentTime = 30;
  w.bgm.toggle();
  t(b.paused === true && b.currentTime === 30 && w.bgm.isMuted() && w.bgm.label() === '음악 켜기', '★ 열려 있을 때 끄면 바로 멈춘다(자리는 그대로)');
  t(w.env.saved.length === 1 && w.env.saved[0][0] === 'tw.pkBgmMuted' && w.env.saved[0][1] === '1', '★ 끈 상태를 저장한다');
  w.bgm.toggle();
  t(b.paused === false && b.currentTime === 30 && w.env.saved[1][1] === '0' && w.bgm.label() === '음악 끄기', '★ 다시 켜면 멈춘 자리부터 · 기억도 풀린다');
  w.bgm.toggle(); w.bgm.stop(); w.bgm.start();
  t(b.paused === true, '★ 꺼 둔 채 닫았다 다시 열면 소리 없음');
  w = world(src); w.bgm.toggle();
  t(w.env.audio.length === 0 && w.bgm.isMuted() && w.env.saved.length === 1, '닫혀 있을 때 누르면 기억만(소리 · 파일 없음)');
  w = world(src, { ls: { 'tw.pkBgmMuted': '1' } }); w.bgm.start();
  t(w.env.audio.length === 0 && w.bgm.label() === '음악 켜기', '★ 지난번에 꺼 둔 PC — 처음 열 때부터 소리 없음');
  w = world(src, { ls: { 'tw.pkBgmMuted': 'yes' } });
  t(!w.bgm.isMuted(), '  모르는 값은 켜짐으로 읽는다(\'1\' 만 끔)');
  return r;
}

(async () => {
  say('── 1 · 2. 시작 · 멈춤 · 끄기');
  behave(MOD).forEach(([ok, m]) => chk(ok, m));
  {
    const w = world(MOD, { blocked: true }); w.bgm.start(); await flush();
    chk(/재생이 막혔어요/.test(w.env.warns.join()), '자동재생 잠금은 삼키지 않고 경고로 남긴다');
  }
  say('── 3. 깨 보기 — 하나라도 못 잡으면 빨강');
  const breaks = [
    ['끈 상태를 안 읽음', (s) => s.replace("try{ muted = storage.getItem(MUTE_KEY) === '1'; }catch(_){}", '')],
    ['끈 상태를 안 저장', (s) => s.replace("save(MUTE_KEY, muted ? '1' : '0');", '')],
    ['꺼도 재생 계속', (s) => s.replace('if(muted) halt(false); else play(false);', 'if(!muted) play(false);')],
    ['꺼 둬도 열면 소리', (s) => s.replace('if(muted || officeMode()) return;', 'if(officeMode()) return;')],
    ['켤 때 처음으로 되감음', (s) => s.replace('if(muted) halt(false); else play(false);', 'if(muted) halt(false); else play(true);')],
    ['회사원 모드 무음 빠짐', (s) => s.replace('if(muted || officeMode()) return;', 'if(muted) return;')],
  ];
  for (const [name, f] of breaks) {
    const m2 = f(MOD); const changed = m2 !== MOD;
    let red; try { red = behave(m2).some(([ok]) => !ok); } catch (_) { red = true; }
    chk(changed && red, name + (changed ? '' : ' — 바꿀 글을 못 찾음'));
  }
  say('── 4. 배선');
  const iB = HTML.indexOf('<script src="parts/purikura/pk-bgm.js">'), iU = HTML.indexOf('<script src="parts/purikura/purikura-ui.js">');
  chk(iB > 0 && iB < iU, 'html — pk-bgm.js 를 purikura-ui.js 보다 먼저');
  const tbar = (HTML.match(/<div class="pk-tbar">([\s\S]*?)<\/div>/) || [, ''])[1];
  chk(/id="pkBgmBtn"[^>]*>음악 끄기</.test(tbar) && tbar.indexOf('pkBgmBtn') < tbar.indexOf('pkQuota') && tbar.indexOf('pkQuota') < tbar.indexOf('pkCloseBtn'), 'html — 제목줄에 «음악 끄기» · 남은 횟수 왼쪽');
  const sB = SMOKE.indexOf("PRELOAD.push('pk-bgm.js');"), sU = SMOKE.indexOf("PRELOAD.push('purikura-ui.js');");
  chk(sB > 0 && sB < sU, 'smoke PRELOAD — pk-bgm.js 를 purikura-ui.js 보다 먼저');
  say('');
  say(fail ? ('✗ ' + fail + '건 어긋남 · 통과 ' + pass) : ('✅ 전부 통과 ' + pass + ' — 스티커사진 BGM 은 끄면 기억한다'));
  process.exit(fail ? 1 : 0);
})();
