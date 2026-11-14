/* sim-gpu-timer.js — 🩺 한 장에 그래픽 칩 · JS 시간(gpu-timer.js · app.js 배선)
   실행:  node sim-gpu-timer.js   (gpu-timer.js · app.js · desk-companion-prototype.html 이 있는 폴더에서)
   ★ 왜 — «노트북에서 켜 두면 블루스크린» · «다른 프로그램이 버벅인다» 를 진단 기록으로 가르려면 그린 장 수 말고
     «한 장이 얼마나 무거운가» 가 있어야 한다. 숫자가 틀리면(0 으로 속임 · 끊긴 답을 섞음 · 질의가 쌓임) 판단이 틀린다.
   ・1절: createStats — 평균 · 최대 · take 뒤 비움 · 이상한 값 버림
   ・2절: createGpuTimerWith(가짜 gl) — 답 거두기 · 아직 안 끝난 답 기다림 · 끊김(disjoint) 때 버림 · 기다리는 질의 상한 ·
          오래 안 오는 답 버림 · 확장이 없으면 아무것도 안 함
   ・3절: suffix · countCasters — 꼬리 모양 · 못 잼은 «GPU 모름» · 숨은 부모 아래는 안 셈
   ・4절: 깨 보기 — 갈래를 하나씩 지운 모듈로 1~3절을 다시 돌려 빨강이 나는지
   ・5절: 배선 — html 이 app.js 앞에 싣는다 · smoke PRELOAD · 그리기를 begin/end 로 감쌈 · 매 장 poll · 1분 줄 꼬리 */
'use strict';
const fs = require('fs');
let pass = 0, fail = 0;
const say = (s) => console.log(s);
const chk = (ok, msg) => { ok ? pass++ : fail++; say('  ' + (ok ? '✓' : '✗') + ' ' + msg); };
const read = (f) => { for (const c of [f, 'parts/' + f, 'parts/shared/' + f, 'app/' + f, 'app/parts/' + f, 'app/parts/shared/' + f, 'checks/' + f]) if (fs.existsSync(c)) return fs.readFileSync(c, 'utf8'); return null; };
const MOD = read('gpu-timer.js'), APP = read('app.js'), HTML = read('desk-companion-prototype.html'), SMOKE = read('smoke.js');
if (!MOD || !APP || !HTML || !SMOKE) { say('  ? 원본 못 찾음 — gpu-timer.js · app.js · desk-companion-prototype.html · smoke.js'); process.exit(2); }
const load = (src) => { const w = {}; new Function('window', 'module', src)(w, undefined); return w.TwGpuTimer; };

/* 가짜 gl — 질의마다 «몇 번 물으면 끝나는가» 와 ns 를 정해 둔다 */
function fakeGl(plan){
  const ext = { TIME_ELAPSED_EXT: 1, GPU_DISJOINT_EXT: 2 };
  let next = 0, disjoint = false, active = null;
  const gl = {
    QUERY_RESULT_AVAILABLE: 10, QUERY_RESULT: 11,
    created: 0, deleted: 0,
    createQuery(){ this.created++; const p = plan[next++] || { after: 0, ns: 1e6 }; return { asked: 0, after: p.after, ns: p.ns }; },
    beginQuery(t, q){ active = q; },
    endQuery(){ active = null; },
    deleteQuery(){ this.deleted++; },
    getParameter(p){ if (p === ext.GPU_DISJOINT_EXT){ const d = disjoint; disjoint = false; return d; } return 0; },
    getQueryParameter(q, p){ if (p === this.QUERY_RESULT_AVAILABLE) return ++q.asked > q.after; if (p === this.QUERY_RESULT) return q.ns; },
    setDisjoint(){ disjoint = true; },
  };
  return { gl, ext };
}

function runStats(T){
  const r = [];
  const s = T.createStats();
  [2, 4, 9].forEach(x => s.add(x));
  const a = s.take();
  r.push(!!a && a.n === 3 && Math.abs(a.avg - 5) < 1e-9 && a.max === 9);        // 0 평균 · 최대
  r.push(s.take() === null);                                                   // 1 take 뒤 비움(표본 없음 = null)
  s.add(NaN); s.add(-1); s.add(Infinity); s.add(3);
  const b = s.take();
  r.push(!!b && b.n === 1 && b.max === 3);                                      // 2 이상한 값 버림
  return r;
}
function runTimer(T){
  const r = [];
  { // 0 · 1 — 답 거두기 · 아직 안 끝난 답은 기다린다(순서대로)
    const { gl, ext } = fakeGl([{ after: 0, ns: 2e6 }, { after: 3, ns: 8e6 }]);
    const t = T.createGpuTimerWith(gl, ext);
    t.begin(); t.end(); t.begin(); t.end();
    t.poll();
    const a = t.take();
    r.push(a.ok === true && a.gpu && a.gpu.n === 1 && Math.abs(a.gpu.avg - 2) < 1e-9);
    t.poll(); t.poll(); t.poll();
    const b = t.take();
    r.push(b.gpu && b.gpu.n === 1 && Math.abs(b.gpu.max - 8) < 1e-9 && gl.deleted === 2);
  }
  { // 2 — 끊김(disjoint)이면 기다리던 답을 버린다
    const { gl, ext } = fakeGl([{ after: 0, ns: 5e6 }, { after: 0, ns: 5e6 }]);
    const t = T.createGpuTimerWith(gl, ext);
    t.begin(); t.end(); t.begin(); t.end();
    gl.setDisjoint(); t.poll();
    const a = t.take();
    r.push(a.gpu === null && a.lost === 2 && gl.deleted === 2);
  }
  { // 3 — 기다리는 질의가 상한이면 새로 안 잰다(쌓이지 않게)
    const { gl, ext } = fakeGl(Array.from({ length: 20 }, () => ({ after: 1e9, ns: 1 })));
    const t = T.createGpuTimerWith(gl, ext);
    for (let i = 0; i < 10; i++){ t.begin(); t.end(); }
    r.push(gl.created === T.MAX_PENDING);
  }
  { // 4 — 오래 안 오는 답은 버리고 다시 잰다
    const { gl, ext } = fakeGl([{ after: 1e9, ns: 1 }, { after: 0, ns: 3e6 }]);
    const t = T.createGpuTimerWith(gl, ext);
    t.begin(); t.end();
    for (let i = 0; i <= T.STALE_POLLS; i++) t.poll();
    t.begin(); t.end(); t.poll();
    const a = t.take();
    r.push(a.lost === 1 && a.gpu && a.gpu.n === 1);
  }
  { // 5 — 확장이 없으면 아무것도 안 하고 ok=false
    const { gl } = fakeGl([]);
    const t = T.createGpuTimerWith(gl, null);
    t.begin(); t.end(); t.poll();
    const a = t.take();
    r.push(a.ok === false && a.gpu === null && gl.created === 0);
  }
  { // 6 — begin 두 번이면 질의 하나(그리기 한 번에 한 질의)
    const { gl, ext } = fakeGl([]);
    const t = T.createGpuTimerWith(gl, ext);
    t.begin(); t.begin(); t.end();
    r.push(gl.created === 1);
  }
  return r;
}
function runSuffix(T){
  const r = [];
  const s1 = T.suffix({ gpu: { ok: true, gpu: { n: 3, avg: 3.21, max: 11 } }, js: { n: 3, avg: 1.44, max: 2 }, calls: 42, casters: 31 });
  r.push(s1 === ' · GPU 평균 3.2ms 최대 11.0ms · JS 평균 1.4ms 최대 2.0ms · 그리기 42 · 그림자 31');   // 0 꼬리 모양
  r.push(T.suffix({ gpu: { ok: false, gpu: null } }) === ' · GPU 모름');                              // 1 못 잼 — 0 으로 안 속임
  r.push(T.suffix({ gpu: { ok: true, gpu: null } }) === ' · GPU 표본 없음');                         // 2 잴 수는 있는데 표본 없음
  const scene = { visible: true, children: [
    { isMesh: true, castShadow: true, visible: true },
    { isMesh: true, castShadow: false, visible: true },
    { visible: false, children: [{ isMesh: true, castShadow: true, visible: true }] },
    { visible: true, children: [{ isMesh: true, castShadow: true, visible: true, children: [{ isMesh: true, castShadow: true }] }] },
  ] };
  r.push(T.countCasters(scene) === 3);                                                               // 3 숨은 부모 아래는 안 셈
  r.push(T.countCasters(null) === 0);                                                                // 4 빈 값
  return r;
}

const T = load(MOD);
say('── 1. createStats');
const s1 = runStats(T);
chk(s1[0], '평균 · 최대'); chk(s1[1], 'take 뒤 비움 — 표본 없으면 null'); chk(s1[2], 'NaN · 음수 · 무한대는 버림');
say('── 2. createGpuTimerWith(가짜 gl)');
const s2 = runTimer(T);
chk(s2[0], '끝난 답을 ms 로 거둔다');
chk(s2[1], '아직 안 끝난 답은 기다렸다가 거두고, 거둔 질의는 지운다');
chk(s2[2], '끊김(disjoint)이면 기다리던 답을 버리고 «잃음» 으로 센다');
chk(s2[3], '기다리는 질의가 ' + T.MAX_PENDING + '개면 새로 안 잰다');
chk(s2[4], '답이 ' + T.STALE_POLLS + '번 넘게 안 오면 버리고 다시 잰다');
chk(s2[5], '확장이 없으면 ok=false · 질의를 안 만든다');
chk(s2[6], 'begin 을 두 번 해도 질의는 하나');
say('── 3. suffix · countCasters');
const s3 = runSuffix(T);
chk(s3[0], '꼬리: GPU 평균 · 최대 · JS · 그리기 · 그림자');
chk(s3[1], '못 재는 기기는 «GPU 모름»');
chk(s3[2], '표본이 없으면 «GPU 표본 없음»');
chk(s3[3], '그림자 드리우는 보이는 메시만 센다 — 숨은 부모 아래는 빼고');
chk(s3[4], '빈 장면은 0');

say('── 4. 깨 보기');
const BREAKS = [
  ['끊김 때 안 버림', "if(disjoint){ lost += pending.length; pending.forEach(drop); pending = []; return; }", '', () => !runTimer(load(brk))[2]],
  ['기다리는 질의 상한 없앰', "|| pending.length >= MAX_PENDING", '', () => !runTimer(load(brk))[3]],
  ['오래 안 오는 답 안 버림', "if(++waited > STALE_POLLS){ pending.shift(); drop(q); lost++; waited = 0; continue; }", '', () => !runTimer(load(brk))[4]],
  ['못 잼을 0 으로', "if(!g || !g.ok) out.push('GPU 모름');", "if(!g || !g.ok) out.push('GPU 평균 0.0ms 최대 0.0ms');", () => !runSuffix(load(brk))[1]],
  ['숨은 부모 아래도 셈', "if(!o || o.visible === false) return;", 'if(!o) return;', () => !runSuffix(load(brk))[3]],
  ['이상한 값도 받음', "if(!(ms >= 0) || !isFinite(ms)) return;", '', () => !runStats(load(brk))[2]],
];
let brk = '';
for (const [name, from, to, red] of BREAKS){
  if (!MOD.includes(from)){ chk(false, '깨 보기 «' + name + '» — 바꿀 글을 못 찾음'); continue; }
  brk = MOD.replace(from, to);
  let ok = false; try { ok = red(); } catch (_) { ok = true; }
  chk(ok, '깨 보기 «' + name + '» → 빨강');
}

say('── 5. 배선');
const iT = HTML.indexOf('<script src="parts/shared/gpu-timer.js">'), iA = HTML.indexOf('<script src="parts/app.js">');
chk(iT > 0 && iA > iT, 'html 이 gpu-timer.js 를 app.js 보다 먼저 싣는다');
chk(/PRELOAD\.push\('gpu-timer\.js'\)/.test(SMOKE), 'smoke PRELOAD 에 gpu-timer.js');
chk(/_gpuTimer\.begin\(\);\s*renderer\.render\(scene,camera\);\s*_gpuTimer\.end\(\);/.test(APP), '실행 화면 그리기를 begin/end 로 감싼다');
chk(/_gpuTimer\.poll\(\)/.test(APP) && /_frameJsStats\.add\(performance\.now\(\) - _frameT0\)/.test(APP), '매 장 poll · JS 시간 더함');
const APPJ = require('./sim-renderer-src.js').joinRenderer(APP);   // 1분 진단 줄은 run-diag-minute.js 로 옮겼다 — «옮기기 전 app.js 글» 로 되살려 읽는다(판정 무변경)
const iTake = APPJ.indexOf('_gpuTimer.take()'), iRun = APPJ.indexOf("if(!document.body.classList.contains('runmode')) return;", APPJ.indexOf('takeMinute(t)'));
chk(iTake > 0 && iRun > iTake, '1분 몫은 실행 화면이 아니어도 비운다(실행 화면 확인보다 먼저 take)');
chk(/companion\.diagNote\(_FB\.diagLine\(m\) \+ TwGpuTimer\.suffix\(cost\)\)/.test(APPJ), '1분 [프레임] 줄 꼬리에 붙인다');

say('');
say(fail ? '✗ ' + fail + '개 실패 · ' + pass + '개 통과' : '✓ ' + pass + '개 모두 통과');
process.exit(fail ? 1 : 0);
