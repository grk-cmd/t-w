/* sim-bgm-diag.js — 🔍 플레이리스트 소리 진단 줄(status/bgm-diag.js) · main.js 광고 게이트가 보내는 값
   ・1절: 순수 함수 — read(모양 맞추기) · suspect(저절로 띄울 때 · 경계값) · line(한 줄 글)
   ・2절: 화면 — 가짜 창에서 돌린다: 이상하면 뜨고 풀리면 숨음 · 아이콘으로 켜고 끔 · 곡이 닫히거나 마이홈이 가져가면 비움 · textContent 로만 · companion 없으면 조용히
   ・3절: main.js 게이트 — 페이지에 넣는 글을 가짜 유튜브 페이지에서 돌려 진단 값이 오는지 · 음소거 판정은 그대로인지 · 보내기는 플레이리스트 모드에서만
   ・4절: 배선 — preload · html(줄 자리 · 아이콘 · 싣는 순서) · app.js 만드는 곳 · smoke
   ・5절: 깨 보기 */
'use strict';
const fs = require('fs');
const path = require('path');

const ROOT = fs.existsSync(path.join(__dirname, 'app')) ? __dirname : path.join(__dirname, '..');
const P = (...a) => path.join(ROOT, ...a);
const find = (rel) => fs.existsSync(P(rel)) ? P(rel) : path.join(__dirname, path.basename(rel));
const need = ['app/parts/status/bgm-diag.js', 'main.js', 'preload.js', 'app/desk-companion-prototype.html', 'app/parts/app.js', 'checks/smoke.js'];
const SRC = {};
for(const r of need){ const f = find(r); if(!fs.existsSync(f)){ console.log('  ? 원본 못 찾음 — ' + r); process.exit(2); } SRC[r] = fs.readFileSync(f, 'utf8'); }

let pass = 0, fail = 0;
const say = (s) => console.log(s);
const chk = (ok, msg) => { if(ok){ pass++; say('  ✓ ' + msg); } else { fail++; say('  ✗ ' + msg); } };

/* 가짜 화면 */
function mkEl(id){
  return { id, hidden: false, textContent: '', _html: null, listeners: {},
    set innerHTML(v){ this._html = v; }, get innerHTML(){ return this._html; },
    addEventListener(t, f){ (this.listeners[t] = this.listeners[t] || []).push(f); },
    fire(t){ (this.listeners[t] || []).forEach(f => f({ stopPropagation(){} })); } };
}
function load(src, o){
  o = o || {};
  const els = { myPlDiag: o.noEl ? null : mkEl('myPlDiag'), myPlVolIco: mkEl('myPlVolIco') };
  const doc = { getElementById: (id) => els[id] || null };
  const w = {};
  new Function('window', 'document', 'module', src)(w, doc, undefined);
  const cb = {};
  const comp = o.noCompanion ? undefined : {
    onBgmDiag: (f) => { cb.diag = f; }, onBgmClosed: (f) => { cb.closed = f; }, onBgmMode: (f) => { cb.mode = f; },
  };
  return { M: w.TwBgmDiag, w, els, cb, mk: () => w.TwBgmDiag.createBgmDiag({ companion: comp }) };
}
const STUCK = { gateMuted: true, audible: false, isAd: false, videos: 1, vol: 0.8, want: 0.8, vMuted: false, paused: false, pVol: 80, pMuted: false, mutedMs: 12000, fail: 0 };
const OK = Object.assign({}, STUCK, { gateMuted: false, audible: true, mutedMs: 0 });

function behave(src){
  const r = {};
  const { M } = load(src);
  /* 1 */
  r.readBad = M.read(null) === null && M.read('x') === null && M.read(3) === null;
  const g = M.read({ gateMuted: 'yes', videos: -2, vol: NaN, want: 'x', vMuted: 1, mutedMs: -5, fail: 2.7, extra: '<b>' });
  r.readShape = g && g.gateMuted === false && g.videos === 0 && g.vol === null && g.want === null && g.vMuted === null && g.mutedMs === 0 && g.fail === 2 && !('extra' in g);
  const d = (x) => M.read(Object.assign({}, STUCK, x));
  r.suspect = M.suspect(d({})) && M.suspect(d({ mutedMs: M.STUCK_MS })) && !M.suspect(d({ mutedMs: M.STUCK_MS - 1 }))
    && !M.suspect(d({ isAd: true })) && !M.suspect(d({ videos: 0 })) && !M.suspect(d({ gateMuted: false }))
    && M.suspect(d({ gateMuted: false, fail: M.FAIL_MIN })) && M.suspect(d({ videos: 0, noReplyMs: M.NO_REPLY_MS })) && !M.suspect(d({ gateMuted: false, noReplyMs: M.NO_REPLY_MS - 1 })) && !M.suspect(d({ gateMuted: false, fail: M.FAIL_MIN - 1 })) && !M.suspect(null);
  const L = M.line(d({}));
  r.line = L.startsWith('🔍 소리 진단') && L.includes('앱 음소거 켜짐 12초') && L.includes('광고 아님') && L.includes('영상 1개')
    && L.includes('영상 음량 80/80') && L.includes('영상 음소거 꺼짐') && L.includes('플레이어 80') && L.includes('소리 신호 없음') && !L.includes('게이트 답 없음') && !L.includes('확인 실패') && !L.includes('멈춤');
  const L2 = M.line(M.read({ fail: 3, paused: true, pMuted: true, gateMuted: false, noReplyMs: 3400, pending: 14 }));
  r.line2 = L2.includes('앱 음소거 꺼짐') && L2.includes('영상 0개') && L2.includes('영상 음량 —/—') && L2.includes('영상 음소거 —') && L2.includes('멈춤')
    && L2.includes('플레이어 — 음소거') && L2.includes('확인 실패 3회') && L2.includes('게이트 답 없음 3초(기다리는 확인 14)');
  r.lineNone = M.line(null) === '🔍 소리 진단 · 재생 중인 곡이 없어요';

  /* 2 */
  const e = load(src); e.mk(); const el = e.els.myPlDiag;
  const s0 = el.hidden === true;
  e.cb.diag(OK); const s1 = el.hidden === true;
  e.cb.diag(STUCK); const s2 = el.hidden === false && el.textContent.includes('앱 음소거 켜짐 12초');
  e.cb.diag(OK); const s3 = el.hidden === true;
  r.auto = s0 && s1 && s2 && s3;
  e.els.myPlVolIco.fire('click'); const f1 = el.hidden === false && el.textContent.includes('앱 음소거 꺼짐') && el.textContent.includes('소리 신호 있음');
  e.cb.closed(); const f2 = el.hidden === false && el.textContent === M.line(null);
  e.els.myPlVolIco.fire('click'); const f3 = el.hidden === true;
  r.forced = f1 && f2 && f3;
  const mode = (m) => { if(e.cb.mode) e.cb.mode(m); };
  e.cb.diag(STUCK); mode('playlist'); const m1 = el.hidden === false;
  mode('home'); const m2 = el.hidden === true;
  e.cb.diag(STUCK); e.cb.closed(); const m3 = el.hidden === true;
  r.clear = m1 && m2 && m3;
  r.textOnly = el.innerHTML === null;
  let quiet = true;
  try{ load(src, { noCompanion: true }).mk(); load(src, { noEl: true }).mk(); }catch(_){ quiet = false; }
  r.quiet = quiet;
  r.onlyTw = Object.keys(e.w).join() === 'TwBgmDiag';
  return r;
}
function report(r){
  say('── 1. 순수 함수');
  chk(r.readBad, 'read — 객체가 아니면 null');
  chk(r.readShape, '  모양 맞추기 — 틀린 칸은 null · 0 · 음수 버림 · 모르는 칸 버림');
  chk(r.suspect, 'suspect — 광고 아님 · 영상 있음 · 음소거 5초부터(4.999초는 아님) · 확인 실패 8회부터 · 답 없음 2초부터 · 광고 · 영상 없음 · 풀림은 아님');
  chk(r.line, 'line — 앱 음소거(초) · 광고 · 영상 수 · 음량(지금/목표) · 영상 음소거 · 플레이어 · 소리');
  chk(r.line2, '  모르는 값은 «—» · 멈춤 · 플레이어 음소거 · 확인 실패 횟수 · 게이트 답 없음(기다리는 확인 수)');
  chk(r.lineNone, '  값이 없으면 «재생 중인 곡이 없어요»');
  say('── 2. 화면');
  chk(r.auto, '처음엔 숨김 · 정상이면 숨김 · 음소거가 안 풀리면 저절로 뜸 · 풀리면 다시 숨음');
  chk(r.forced, '음량 아이콘으로 켜면 정상이어도 보임 · 곡이 닫히면 «없어요» · 다시 누르면 끔');
  chk(r.clear, '마이홈 BGM 이 창을 가져가거나 곡이 닫히면 낡은 값을 비운다');
  chk(r.textOnly, '  textContent 로만 넣는다(innerHTML 안 씀)');
  chk(r.quiet, '  companion · 줄 자리가 없으면 조용히 물러난다');
  chk(r.onlyTw, '  싣기만 하면 window.TwBgmDiag 하나뿐');
}

/* 3. main.js 게이트 — 페이지에 넣는 글을 꺼내 가짜 유튜브 페이지에서 돌린다 */
async function gateCheck(MAIN){
  const r = {};
  const g0 = MAIN.indexOf('function bgmStartAdGate(){'), g1 = MAIN.indexOf('\n  }\n', g0);
  const gate = g0 > 0 ? MAIN.slice(g0, g1) : '';
  const e0 = gate.indexOf('executeJavaScript(\n'), e1 = gate.indexOf('\n      ).then(');
  const v0 = MAIN.indexOf('const BGM_SET_VOL_JS ='), v1 = MAIN.indexOf("'}';", v0);
  let run = null;
  try{
    const BGM_SET_VOL_JS = new Function('return ' + MAIN.slice(v0 + 'const BGM_SET_VOL_JS ='.length, v1 + 3).trim())();
    const js = new Function('bgmVolume', 'BGM_SET_VOL_JS', 'return ' + gate.slice(e0 + 'executeJavaScript('.length, e1).trim())(0.8, BGM_SET_VOL_JS);
    run = (page) => new Function('document', 'window', 'localStorage', 'return ' + js)(page.doc, page.win, { setItem(){} });
  }catch(err){ say('  · 게이트 글을 못 꺼냄 — ' + err.message); }
  const mkPage = (o) => {
    const v = { volume: o.vol, muted: !!o.vMuted, paused: !!o.paused, _lock: o.lock };
    if(o.lock) Object.defineProperty(v, 'volume', { get: () => o.vol, set: () => {} });
    const player = { classList: { contains: (c) => c === 'ad-showing' && !!o.ad }, getVolume: () => o.pVol, setVolume: () => {}, isMuted: () => !!o.pMuted };
    const doc = {
      querySelector: (q) => q === 'video' ? (o.noVideo ? null : v) : (/movie_player/.test(q) ? player : null),
      querySelectorAll: (q) => q === 'video' ? (o.noVideo ? [] : [v, v].slice(0, o.videos || 1)) : [],
    };
    return { doc, win: {} };
  };
  if(run){
    try{ run(mkPage({ vol: 1 })); }catch(err){ say('  · 게이트 글이 안 돈다 — ' + err.message); run = null; }
  }
  if(run){
    const a = run(mkPage({ vol: 1, pVol: 100 }));
    r.ok = a.isAd === false && a.volOk === true && a.d && a.d.vol === 0.8 && a.d.want === 0.8 && a.d.videos === 1 && a.d.vMuted === false && a.d.pVol === 100 && a.d.pMuted === false;
    const b = run(mkPage({ vol: 0.42, lock: true, videos: 2, pMuted: true }));
    r.stuck = b.volOk === false && b.d.vol === 0.42 && b.d.videos === 2 && b.d.pMuted === true;
    const c = run(mkPage({ vol: 1, ad: true }));
    r.ad = c.isAd === true && c.d.isAd === true;
    const n = run(mkPage({ noVideo: true }));
    r.noVideo = n.volOk === false && n.d.videos === 0 && !('vol' in n.d);
  }
  r.mute = /const mute = isAd \|\| !volOk;\s*\n\s*bgmView\.webContents\.setAudioMuted\(mute\);/.test(gate) && (gate.match(/setAudioMuted\(/g) || []).length === 2;
  /* 게이트 · 보내기를 꺼내 가짜 창으로 돌린다 — 페이지가 답을 안 할 때도 1초마다 보내는가 */
  const b0 = MAIN.indexOf('  let bgmAdPoll = null;'), b1 = MAIN.indexOf('\n  }\n', MAIN.indexOf('function bgmStartAdGate(){')) + 4;
  const mkRig = async (o) => {
    const t = { now: 1000, timers: [], sent: [], muted: null };
    const wc = { isDestroyed: () => false, setAudioMuted: (m) => { t.muted = m; }, isAudioMuted: () => t.muted, isCurrentlyAudible: () => false,
      executeJavaScript: () => o.reply === 'never' ? new Promise(() => {}) : o.reply === 'fail' ? Promise.reject(new Error('x')) : Promise.resolve(o.reply) };
    const view = { webContents: wc };
    const win = o.noWin ? null : { isDestroyed: () => false, webContents: { isDestroyed: () => false, send: (ch, d) => t.sent.push({ ch, d }) } };
    const BGM_SET_VOL_JS = '';
    const f = new Function('bgmView', 'mainWindow', 'bgmMode', 'bgmVolume', 'BGM_SET_VOL_JS', 'setInterval', 'clearInterval', 'Date',
      MAIN.slice(b0, b1) + '\nreturn bgmStartAdGate;');
    const start = f(view, win, o.mode || 'playlist', 0.8, BGM_SET_VOL_JS, (fn) => { t.timers.push(fn); return 1; }, () => {}, { now: () => t.now });
    start();
    for(let i = 0; i < (o.ticks || 8); i++){ t.now += 250; t.timers.forEach(fn => fn()); await new Promise(r => setImmediate(r)); }
    return t;
  };
  try{
    const page = { isAd: false, volOk: true, d: { isAd: false, videos: 1, want: 0.8, vol: 0.8, vMuted: false } };
    const never = await mkRig({ reply: 'never', ticks: 9 });
    const nd = never.sent.length ? never.sent[never.sent.length - 1].d : {};
    r.never = never.sent.length === 2 && never.sent.every(x => x.ch === 'companion:bgmDiag') && nd.gateMuted === true && nd.pending >= 7 && nd.noReplyMs >= 2000
      && nd.videos === undefined && never.muted === true;
    r.neverShown = !!(R0 && R0.suspect(R0.read(nd))) && R0.line(R0.read(nd)).includes('게이트 답 없음 2초');
    const ok = await mkRig({ reply: page, ticks: 9 });
    const od = ok.sent.length ? ok.sent[ok.sent.length - 1].d : {};
    r.okSend = ok.sent.length === 2 && od.gateMuted === false && od.videos === 1 && od.vol === 0.8 && od.pending <= 1 && od.noReplyMs < 1000 && od.mutedMs === 0 && od.fail === 0
      && !(R0 && R0.suspect(R0.read(od)));
    const bad = await mkRig({ reply: 'fail', ticks: 9 });
    const bd = bad.sent.length ? bad.sent[bad.sent.length - 1].d : {};
    r.failSend = bd.fail >= 7 && bd.pending === 0 && bd.gateMuted === true && bd.mutedMs >= 2000;
    const home = await mkRig({ reply: page, mode: 'home' });
    let noWinOk = true; try{ await mkRig({ reply: page, noWin: true }); }catch(_){ noWinOk = false; }
    r.onlyPl = home.sent.length === 0 && noWinOk;
  }catch(err){ say('  · 게이트를 못 돌림 — ' + err.message); }
  return r;
}
function gateReport(r){
  say('── 3. main.js 게이트');
  chk(r.ok, '정상 페이지 — 음량을 맞추고 volOk · 진단 값(음량 · 목표 · 영상 수 · 음소거 · 플레이어)을 같이 돌려준다');
  chk(r.stuck, '  음량이 안 바뀌는 영상 — volOk 거짓 · 그 음량과 영상 수 · 플레이어 음소거가 진단에 실린다');
  chk(r.ad, '  광고 — isAd 가 진단에도 실린다');
  chk(r.noVideo, '  영상이 없으면 volOk 거짓 · 영상 0개');
  chk(r.mute, '음소거 판정은 그대로(광고이거나 음량이 안 맞으면) — setAudioMuted 는 시작 · 판정 두 곳뿐');
  chk(r.never, '페이지가 답을 안 해도 1초마다 보낸다 — 앱 음소거 켜짐 · 기다리는 확인 수 · 답 없음 2초 · 페이지 값 없음');
  chk(r.neverShown, '  그 값이면 줄이 저절로 뜨고 «게이트 답 없음» 을 쓴다');
  chk(r.okSend, '  정상 — 음소거 풀림 · 페이지 값 실림 · 답 없음 1초 아래 · 줄은 안 뜸');
  chk(r.failSend, '  확인이 실패하면 실패 수 · 음소거 지속이 오른다');
  chk(r.onlyPl, '  마이홈 BGM 일 땐 안 보낸다 · 메인 창이 없어도 안 깨진다');
}

/* 4. 배선 */
function wiring(){
  const H = SRC['app/desk-companion-prototype.html'], A = SRC['app/parts/app.js'];
  const bar = H.indexOf('<div id="myPlBar">'), barEnd = H.indexOf('\n    </div>', bar), diag = H.indexOf('<div id="myPlDiag" hidden></div>'), noise = H.indexOf('id="myPlNoise"');
  chk(/onBgmDiag\(callback\) \{\s*ipcRenderer\.on\('companion:bgmDiag', \(e, d\) => callback\(d\)\);/.test(SRC['preload.js']), 'preload — onBgmDiag 가 companion:bgmDiag 를 받는다');
  chk(bar > 0 && diag > barEnd && diag < noise, 'html — 진단 줄은 음악 줄(#myPlBar) 바로 아래 · 백색소음 줄 위 · 처음엔 숨김');
  chk(H.slice(bar, barEnd).includes('id="myPlVolIco"'), '  음량 아이콘에 id(#myPlVolIco) — 눌러서 켜고 끄기');
  const iS = H.indexOf('<script src="parts/status/bgm-diag.js"></script>'), iA = H.indexOf('<script src="parts/app.js"></script>');
  chk(iS > 0 && iA > iS, '  싣는 순서 — bgm-diag.js 가 app.js 보다 먼저');
  chk((A.match(/TwBgmDiag\.createBgmDiag\(/g) || []).length === 1 && /TwBgmDiag\.createBgmDiag\(\{ companion: window\.companion \}\);/.test(A), 'app.js — 만드는 곳은 한 곳(companion 을 deps 로)');
  const sm = SRC['checks/smoke.js'];
  chk(sm.indexOf("PRELOAD.push('bgm-diag.js');") > 0, 'smoke PRELOAD 에 bgm-diag.js');
}

const MOD = SRC['app/parts/status/bgm-diag.js'];
const R0 = load(MOD).M;
const R = behave(MOD);
report(R);
(async () => {
const G = await gateCheck(SRC['main.js']);
gateReport(G);
say('── 4. 배선');
wiring();

say('── 5. 깨 보기');
{
  const broken = (from, to) => { if(!MOD.includes(from)) return null; return behave(MOD.replace(from, to)); };
  const b1 = broken('return d.gateMuted && !d.isAd &&', 'return d.gateMuted &&');
  chk(b1 && !b1.suspect, '광고 조건을 빼면 1절 suspect 가 빨강');
  const b2 = broken('el.textContent = line(last)', 'el.innerHTML = line(last)');
  chk(b2 && !b2.textOnly, 'innerHTML 로 넣으면 2절이 빨강');
  const b3 = broken("companion.onBgmMode((mode) => { if(mode !== 'playlist'){ last = null; paint(); } });", '');
  chk(b3 && !b3.clear, '마이홈이 창을 가져갈 때 안 비우면 2절이 빨강');
  const M = SRC['main.js'];
  const g1 = await gateCheck(M.replace("if(bgmMode !== 'playlist' || (++bgmDiagTick % 4)) return;", 'if(++bgmDiagTick % 4) return;'));
  chk(!g1.onlyPl, '마이홈 BGM 에도 보내면 3절이 빨강');
  const g4 = await gateCheck(M.replace('      bgmSendDiag();\n      bgmGatePending++;', '      bgmGatePending++;').replace("bgmGateFail = 0; bgmGateLastD = (r && r.d) || null;", "bgmGateFail = 0; bgmGateLastD = (r && r.d) || null; bgmSendDiag();"));
  chk(!g4.never, '답이 올 때만 보내면 3절(답 안 함)이 빨강');
  const g2 = await gateCheck(M.replace('const mute = isAd || !volOk;', 'const mute = isAd;'));
  chk(!g2.mute, '음소거 판정을 바꾸면 3절이 빨강');
  const g3 = await gateCheck(M.replace("'if(v){ d.vol=v.volume; d.vMuted=v.muted; d.paused=v.paused; }'+", "''+"));
  chk(!g3.ok, '진단에 영상 음량을 안 실으면 3절이 빨강');
}

say('');
say('결과 ' + pass + ' · ' + fail);
process.exit(fail ? 1 : 0);
})();
