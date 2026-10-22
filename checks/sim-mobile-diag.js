/* sim-mobile-diag.js — 📱 태블릿·폰 연결 진단 줄(focus/mobile-diag.js) · 설정 칸에 잇기(focus-level.js) · 서버 알림(firebase-init.js)
   ・1절: next · line — 신호 하나 = ts · 처음 온 값은 수에 안 넣음 · 같은 ts 는 새 신호 아님 · PC 를 켤 때 꺼짐 · PC 켜짐 표시 없음 · 이상한 값
   ・2절: 잇기를 실제로 돌린다 — _mobileStart 를 가짜 firebaseAPI 로: 다른 키 값은 안 셈 · 부팅 초기화 뒤 같은 ts «꺼짐» 을 버림 · 줄이 칸에 들어감
   ・3절: 배선 — firebase-init 알림 자리 · html 싣는 순서 · 칸 · app.js deps · smoke
   ・4절: 깨 보기 */
'use strict';
const fs = require('fs');
const path = require('path');

const ROOT = fs.existsSync(path.join(__dirname, 'app')) ? __dirname : path.join(__dirname, '..');
const P = (...a) => path.join(ROOT, ...a);
const find = (rel) => fs.existsSync(P(rel)) ? P(rel) : path.join(__dirname, path.basename(rel));
const need = ['app/parts/focus/mobile-diag.js', 'app/parts/focus/focus-level.js', 'app/parts/firebase-init.js', 'app/desk-companion-prototype.html', 'app/parts/app.js', 'checks/smoke.js'];
const SRC = {};
for(const r of need){ const f = find(r); if(!fs.existsSync(f)){ console.log('  ? 원본 못 찾음 — ' + r); process.exit(2); } SRC[r] = fs.readFileSync(f, 'utf8'); }

let pass = 0, fail = 0;
const say = (s) => console.log(s);
const chk = (ok, msg) => { if(ok){ pass++; say('  ✓ ' + msg); } else { fail++; say('  ✗ ' + msg); } };

const load = (src) => { const w = {}; new Function('window', src)(w); return w; };
const fmt = (ts) => 't' + ts;
const st = (on, ts, app) => ({ kind: 'state', v: { on, ts, app, key: 'K' } });

function behave(src){
  const w = load(src), D = w.TwMobileDiag, r = {};
  const run = (evs) => evs.reduce((d, e) => D.next(d, e), D.empty());
  r.only = Object.keys(w).join() === 'TwMobileDiag' && Object.isFrozen(D) && D.HIST_MAX === 2;
  r.none = D.line(D.empty(), fmt) === '🔍 받은 신호 없음 · 이번 실행 0번' && D.line(null, fmt) === '🔍 받은 신호 없음 · 이번 실행 0번';
  const a = run([Object.assign(st(true, 100, 'Procreate'), { first: true })]);
  r.first = a.count === 0 && D.line(a, fmt) === '🔍 마지막 신호 t100 열림(Procreate) · 이번 실행 0번';
  const b = run([Object.assign(st(false, 100), { first: true }), st(true, 200, 'Procreate'), st(false, 201, 'Procreate'), st(true, 300, 'Procreate')]);
  r.count = b.count === 3 && b.hist.length === 2 && D.line(b, fmt) === '🔍 마지막 신호 t300 열림(Procreate) · 그 전 t201 닫힘(Procreate) · 이번 실행 3번';
  const c = run([st(true, 200, 'P'), st(false, 200, 'P'), st(true, 200, 'P')]);
  r.sameTs = c.count === 1 && c.hist.length === 1 && c.hist[0].on === true;
  const e = run([{ kind: 'reset', v: { on: true, ts: 500, app: 'P', key: 'K' } }, Object.assign(st(false, 500, 'P'), { first: true })]);
  r.reset = e.count === 0 && e.hist.length === 1 && e.hist[0].on === true && D.line(e, fmt) === '🔍 마지막 신호 t500 열림(P) · PC 를 켤 때 꺼짐으로 바꿈 · 이번 실행 0번';
  const f = run([{ kind: 'reset', v: { on: true, ts: 500, app: 'P' } }, st(true, 600, 'P')]);
  r.resetOld = D.line(f, fmt) === '🔍 마지막 신호 t600 열림(P) · 그 전 t500 열림(P) · 이번 실행 1번';
  const g = run([{ kind: 'live', has: true }, { kind: 'live', has: false }]);
  const g2 = D.next(g, { kind: 'live', has: true });
  r.live = g.live === false && D.line(g, fmt) === '🔍 ⚠️ PC 켜짐 표시 없음 — 폰 신호가 거절돼요 · 받은 신호 없음 · 이번 실행 0번' && g2.live === true && D.line(g2, fmt).indexOf('⚠️') < 0;
  const h0 = D.empty();
  const h = run([st(true, 0), st(true, NaN), st(true, -1), st(true, 'x'), { kind: 'state', v: null }, null, { kind: 'zzz', v: { ts: 9 } }]);
  r.odd = h.count === 0 && h.hist.length === 0 && D.next(h0, st(true, 5)) !== h0 && h0.count === 0
    && run([st(true, 5, ' <b>x</b>\n')]).hist[0].app === 'bx/b' && run([st(true, 5, 'y'.repeat(60))]).hist[0].app.length === 40 && run([st(true, 5, 7)]).hist[0].app === '';
  r.clock = /^\d\d:\d\d:\d\d$/.test(D.line(run([st(true, 1700000000000)])).replace(/^🔍 마지막 신호 /, '').replace(/ 열림 · 이번 실행 1번$/, ''));
  return r;
}
function report(r){
  say('── 1. next · line');
  chk(r.only, '싣기만 하면 window.TwMobileDiag 하나 · 얼린 표 · 신호 두 개까지');
  chk(r.none, '신호가 없으면 «받은 신호 없음 · 이번 실행 0번»');
  chk(r.first, '구독 뒤 처음 온 값(이번 실행 전 신호)은 보이되 수에 안 넣는다');
  chk(r.count, '새 신호마다 센다 · 마지막과 그 전 신호(시각 · 열림/닫힘 · 앱)');
  chk(r.sameTs, '같은 ts 는 새 신호가 아니다(덮지도 세지도 않는다)');
  chk(r.reset, 'PC 를 켤 때 꺼짐으로 바꿈 — 원래 «열림» 을 남기고 곧 오는 같은 ts «꺼짐» 은 버린다');
  chk(r.resetOld, '  그 뒤 새 신호가 오면 «PC 를 켤 때» 표시는 사라진다');
  chk(r.live, 'PC 켜짐 표시(live)가 없으면 맨 앞에 ⚠️ · 다시 생기면 사라진다');
  chk(r.odd, '이상한 값 — ts 0 · NaN · 음수 · 글자 · null 은 무시 · 앱 이름은 거르고 40자 · 들어온 기록은 안 바꾼다');
  chk(r.clock, '시각 기본 모양 HH:MM:SS');
}
const R = behave(SRC['app/parts/focus/mobile-diag.js']);
report(R);

say('── 2. 잇기 (focus-level.js 의 _mobileStart 를 실제로 돌린다)');
{
  const J = SRC['app/parts/focus/focus-level.js'];
  const grab = (name) => { const m = new RegExp('function\\s+' + name + '\\s*\\(').exec(J); if(!m) return ''; let i = J.indexOf('{', m.index), d = 0;
    for(let j = i; j < J.length; j++){ if(J[j] === '{') d++; else if(J[j] === '}'){ d--; if(!d) return J.slice(m.index, j + 1); } } return ''; };
  const ms = grab('_mobileStart');
  chk(!!ms, '_mobileStart 를 찾았다');
  const w = load(SRC['app/parts/focus/mobile-diag.js']);
  const env = { applied: [], renders: 0, cb: null, onDiag: null };
  const ctx = new Function('mobileDiag', 'window', 'firebaseAPI', 'getMyUserId', '_mobileGetKey', '_mobileApplyState', '_mobRenderPanel',
    'let _mobileStop = null, _mobDiag = null, _mobDiagFirst = true;\n' + ms + '\nreturn { start: _mobileStart, diag: () => _mobDiag };');
  const api = { mobileLinkStart: (uid, cb, onDiag) => { env.cb = cb; env.onDiag = onDiag; return Promise.resolve(() => {}); } };
  const m = ms ? ctx(w.TwMobileDiag, { firebaseAPI: api }, api, () => 'u1', () => 'K', (v) => env.applied.push(v), () => { env.renders++; }) : null;
  if(m){
    m.start();
    env.onDiag({ kind: 'reset', v: { on: true, ts: 50, app: 'P', key: 'K' } });
    env.cb({ on: false, ts: 50, app: 'P', key: 'K' });
    env.cb({ on: true, ts: 60, app: 'P', key: 'OLD' });
    env.cb({ on: true, ts: 70, app: 'P', key: 'K' });
    env.cb(null);
    const d = m.diag();
    chk(env.applied.length === 4 && env.applied[3] === null, '받은 값은 전부 예전처럼 _mobileApplyState 로 간다(진단은 옆에서 읽기만)');
    chk(d.count === 1 && d.hist[0].ts === 70 && d.hist[1].ts === 50 && d.hist[1].on === true, '다른 키 값은 안 센다 · 부팅 초기화 뒤 같은 ts «꺼짐» 은 버린다 · 다음 신호는 센다');
    env.onDiag({ kind: 'live', has: false });
    chk(m.diag().live === false && env.renders >= 2, '서버 알림(초기화 · live)이 오면 칸을 다시 그린다');
    m.start();
    chk(m.diag().count === 0 && m.diag().hist.length === 0, '다시 시작(키 교체)하면 진단도 처음부터');
  } else chk(false, '_mobileStart 를 돌리지 못했다');
  const rp = grab('_mobRenderPanel');
  chk(/const dg = document\.getElementById\('fsMobDiag'\);/.test(rp) && /dg\.textContent = paired \? mobileDiag\.line\(_mobDiag\) : '';/.test(rp) && /dg\.style\.display = paired \? '' : 'none';/.test(rp),
    '칸 그리기 — 연결했을 때만 보이고 textContent 로만 넣는다');
}

say('── 3. 배선');
{
  const F = SRC['app/parts/firebase-init.js'], H = SRC['app/desk-companion-prototype.html'], A = SRC['app/parts/app.js'];
  const a = F.indexOf('async mobileLinkStart('), b = F.indexOf('\n    },', a), st = a > 0 ? F.slice(a, b) : '';
  chk(/async mobileLinkStart\(userId, cb, onDiag\)/.test(st) && /diag\(\{ kind:'reset', v:s \}\)/.test(st), 'firebase-init — 부팅 초기화로 내린 원래 값을 알린다');
  chk(/if\(onDiag\) onValue\(liveRef, onLive, \(\)=>\{\}\);/.test(st) && /off\(liveRef, 'value', onLive\)/.test(st), '  live 는 진단을 받을 때만 구독 · 멈출 때 끊는다');
  chk(!/arm\(\)[^;]*onLive|onLive[^;]*arm\(\)/.test(st), '  live 가 사라져도 다시 걸지 않는다(보이기만 — 동작은 그대로)');
  const iD = H.indexOf('<script src="parts/focus/mobile-diag.js"></script>'), iL = H.indexOf('<script src="parts/focus/focus-level.js"></script>');
  chk(iD > 0 && iL > iD, 'html — mobile-diag.js 가 focus-level.js 보다 먼저');
  const iNote = H.indexOf('id="fsMobNote"'), iDiag = H.indexOf('id="fsMobDiag"'), iEnd = H.indexOf('id="fsTabDisplay"');
  chk(iNote > 0 && iDiag > iNote && iDiag < iEnd && /<div class="fs-hint fs-mob-diag" id="fsMobDiag" style="display:none;"><\/div>/.test(H), '칸 — 📱 안내 줄 아래 · 처음엔 숨김');
  chk((A.match(/mobileDiag: TwMobileDiag,/g) || []).length === 1, 'app.js — 포커스 레벨을 만들 때 deps 로 넘긴다(한 곳)');
  chk(SRC['checks/smoke.js'].indexOf("PRELOAD.push('mobile-diag.js');") > 0
    && SRC['checks/smoke.js'].indexOf("PRELOAD.push('mobile-diag.js');") < SRC['checks/smoke.js'].indexOf("PRELOAD.push('focus-level.js');"), 'smoke PRELOAD 에 mobile-diag.js(focus-level.js 앞)');
}

say('── 4. 깨 보기');
{
  const M = SRC['app/parts/focus/mobile-diag.js'];
  const br = (from, to) => M.includes(from) ? behave(M.replace(from, to)) : null;
  const b1 = br("if(ev.kind !== 'state' || ts === o.lastTs) return o;", "if(ev.kind !== 'state') return o;");
  chk(b1 && !b1.sameTs && !b1.reset, '같은 ts 를 새 신호로 보면(부팅 초기화 «꺼짐» 을 신호로 셈) 1절이 빨강');
  const b2 = br("count: o.count + (ev.first ? 0 : 1)", "count: o.count + 1");
  chk(b2 && !b2.first, '처음 온 값까지 세면 1절이 빨강');
  const b3 = br("if(o.live === false) out.push(", "if(false) out.push(");
  chk(b3 && !b3.live, 'PC 켜짐 표시가 없는데 안 알리면 1절이 빨강');
  const b4 = br("if(o.reset && o.reset === o.hist[0].ts) out.push(", "if(o.reset) out.push(");
  chk(b4 && !b4.resetOld, '«PC 를 켤 때» 표시가 새 신호 뒤에도 남으면 1절이 빨강');
}

say('');
say('결과 ' + pass + ' · ' + fail);
process.exit(fail ? 1 : 0);
