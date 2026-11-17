/* ═══ 🕺 sim-rig-anim.js — 몸짓(character/rig-anim.js · app.js 분리 M15) ═══════════════
   ・1절: 상태 표 · targetFor — 상태마다 자세 목표 · 모르는 상태는 기본 · 경계값
   ・2절: boneSide · lerp · setBone(기준 자세에 오일러를 곱한다 · 본이 없으면 아무 일 없음)
   ・3절: animateRig — 허리 기울임(집중 · 호흡 고정) · 본이 없는 좌석도 던지지 않음
   ・4절: setClip — 같은 클립이면 안 건드림 · 바꾸면 이전 것 페이드아웃 · 믹서 없음
   ・5절: 연결 — deps 모양 · 옛 이름 · html 순서
   ・6절: 일부러 깨 보기 */
'use strict';
const fs = require('fs');
let pass = 0, fail = 0;
const say = (s) => console.log(s);
const chk = (ok, msg) => { ok ? pass++ : fail++; say('  ' + (ok ? '✓' : '✗') + ' ' + msg); };
const read = (f) => { for(const c of [f, 'parts/' + f, 'app/parts/' + f, 'app/' + f, f.split('/').pop()]) if(fs.existsSync(c)) return fs.readFileSync(c, 'utf8'); return null; };
const stripC = (s) => s.replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/(^|[^:'"\\])\/\/[^\n]*/g, '$1 ');
const depPairs = (APP, mod, glob, create) => { const m = APP.match(new RegExp('const ' + mod + ' = ' + glob + '\\.' + create + '\\(\\{\\n([\\s\\S]*?)\\n\\}\\);')); return m ? m[1].split('\n').map(l => /^  ([\w$]+): (.+),$/.exec(l)).filter(Boolean).map(x => [x[1], x[2]]) : null; };
const SRC = read('character/rig-anim.js'), APP = read('app.js'), HTML = read('desk-companion-prototype.html');
if(!SRC || !APP || !HTML){ say('  ? 원본 못 찾음'); process.exit(2); }
class Euler { set(x, y, z){ this.x = x; this.y = y; this.z = z; return this; } }
class Quaternion { constructor(){ this.log = []; } setFromEuler(e){ this.e = [e.x, e.y, e.z]; return this; } copy(q){ this.log = ['copy:' + (q.id || '?')]; return this; } multiply(q){ this.log.push('mul:' + (q.e || []).join(',')); this.last = q.e; return this; } }
class Vector3 { setFromMatrixPosition(){ return this; } project(){ return this; } }
function build(src, o){
  o = o || {};
  const win = {};
  new Function('window', 'THREE', 'module', src)(win, { Euler, Quaternion, Vector3 }, undefined);
  return win.TwRigAnim.createRigAnim({ ANIMAL_HAND_REST: -0.7, camera: {}, iDeskMod: {}, rideTuneMod: {}, seatPointerMod: { drag: () => null, mouseNdcX: () => 0, mouseNdcY: () => 0 }, userStatusMod: { userStatus: () => o.status || null } });
}
const mod = build(SRC);
say('§1 targetFor · STATES');
{
  chk(['idle', 'focus', 'pet', 'sleep', 'shaking', 'dizzy'].every(k => mod.STATES[k] && mod.STATES[k].label && /^#/.test(mod.STATES[k].color)), '상태 여섯(평소 · 활동중 · 쓰다듬 · 잠듦 · 흔들림 · 어지러움)에 이름 · 색이 있다');
  const f = mod.targetFor('focus');
  chk(f.arm === 1 && f.eyeOpen === 1 && f.leanX === 0.08, '활동중 — 팔을 쓰고 눈을 뜨고 0.08 숙임');
  chk(mod.targetFor('sleep').eyeOpen === 0 && mod.targetFor('sleep').arm === 0, '잠듦 — 눈 감김 · 팔 안 씀');
  chk(mod.targetFor('dizzy').slumpY === -0.30 && mod.targetFor('dizzy').leanX === 0.35, '어지러움 — 엎드림 값');
  const d = mod.targetFor('모르는상태'), i = mod.targetFor('idle');
  chk(d.leanX === 0 && d.arm !== undefined && JSON.stringify(d) === JSON.stringify(i), '모르는 상태 · idle 은 같은 기본 자세');
}
say('§2 작은 도구');
{
  chk(mod.lerp(0, 10, 0) === 0 && mod.lerp(0, 10, 1) === 10 && mod.lerp(2, 4, 0.5) === 3, 'lerp 경계(0 · 1 · 가운데)');
  chk(mod.boneSide('hand_l') === 'l' && mod.boneSide('hand.r') === 'r' && mod.boneSide('arm_left') === 'l' && mod.boneSide('head') === null, 'boneSide — 왼 · 오른 · 없음');
  const bone = { quaternion: new Quaternion() }, rest = { id: 'rest' };
  mod.setBone(bone, rest, 0.1, 0.2, 0.3);
  chk(bone.quaternion.log.join() === 'copy:rest,mul:0.1,0.2,0.3', 'setBone — 기준 자세를 복사해 오일러 회전을 곱한다');
  const b2 = { quaternion: new Quaternion() }; mod.setBone(null, rest, 1, 1, 1); mod.setBone(b2, null, 1, 1, 1);
  chk(b2.quaternion.log.length === 0, '본이나 기준 자세가 없으면 아무 일 없음');
  chk(mod.SPINE_AXIS === 1 && mod.HEAD_AXIS === 1 && mod.HAND_REST === -1.0, '부호 · 손 기본각 상수');
}
say('§3 animateRig');
{
  const mk = (state) => ({ bones: { spine: { quaternion: new Quaternion() } }, boneRest: { spine: { id: 'rs' } }, pose: Object.assign({}, mod.targetFor(state)), breathePhase: 1.2 });
  const s = mk('focus');
  let threw = null; try{ mod.animateRig(s, 1000, 'focus'); }catch(e){ threw = e; }
  chk(!threw, '허리만 있는 좌석에서도 던지지 않는다' + (threw ? ' — ' + threw.message : ''));
  chk(!threw && Math.abs(s.bones.spine.quaternion.last[0] - (mod.SPINE_AXIS * (0 + s.pose.leanX * 0.8 - 0.03))) < 1e-9, '★ 집중 상태는 호흡 없이 허리 기울임(leanX*0.8 − 0.03)만 — 둥실거리지 않는다');
  const s2 = mk('idle');
  try{ mod.animateRig(s2, 1000, 'idle'); }catch(_){}
  const expect = Math.sin(1.2) * (s2.pose.breAmp * 1.6) + s2.pose.leanX * 0.8 - 0.03;
  chk(s2.bones.spine.quaternion.last && Math.abs(s2.bones.spine.quaternion.last[0] - expect) < 1e-9, '평소엔 호흡이 더해진다(sin(phase) × breAmp × 1.6)');
}
say('§4 setClip');
{
  const log = [];
  const act = (n) => ({ n, reset(){ return this; }, fadeIn(){ return this; }, fadeOut(t){ log.push('out:' + n + ':' + t); }, play(){ log.push('play:' + n); } });
  const a = act('a'), idle = act('idle');
  const seat = { mixer: {}, actions: { a, idle }, current: null };
  mod.setClip(seat, 'a'); chk(seat.current === a && log.join() === 'play:a', '처음엔 그 클립을 재생');
  mod.setClip(seat, 'a'); chk(log.length === 1, '같은 클립이면 다시 안 건드린다');
  mod.setClip(seat, '없는상태'); chk(seat.current === idle && log.join() === 'play:a,out:a:0.3,play:idle', '없는 상태는 idle 클립으로 · 이전 클립은 0.3초 페이드아웃');
  const none = { mixer: null, actions: {}, current: null }; mod.setClip(none, 'a'); chk(none.current === null, '믹서가 없으면 아무 일 없음');
}
say('§5 연결');
{
  const iM = HTML.indexOf('<script src="parts/character/rig-anim.js"></script>'), iA = HTML.indexOf('<script src="parts/app.js"></script>');
  chk(iM > 0 && iA > iM, 'html — rig-anim.js 를 app.js 보다 먼저 싣는다');
  const code = stripC(APP);
  const pairs = depPairs(APP, 'rigAnimMod', 'TwRigAnim', 'createRigAnim');
  chk(!!pairs && pairs.length === 6 && pairs.every(([n, v]) => n === v), '★ deps 6개 모두 값(이미 만들어진 것 — 읽는 함수 · 감싸개가 아님)');
  chk(['STATES', 'targetFor', 'lerp', 'SPINE_AXIS', 'HEAD_AXIS', 'HAND_REST', 'FOCUS_ARM_LIFT', 'SHAKE_ARM_DROOP', 'boneSide', 'setBone', 'animateRig', 'setClip'].every(n => new RegExp('^const ' + n + ' = rigAnimMod\\.' + n + ';', 'm').test(code)), '  옛 이름 열둘을 const 로 받는다');
  chk(!/function (targetFor|animateRig|setClip|setBone|boneSide)\b/.test(code), '  본문이 app.js 에 안 남음');
}
say('§6 일부러 깨 보기');
{
  const brk = (a, c) => { const m = SRC.replace(a, c); return m === SRC ? null : m; };
  const m1 = brk("const breath = _focusLock ? 0 :", "const breath = false ? 0 :");
  chk(!!m1 && (() => { const m = build(m1); const s = { bones: { spine: { quaternion: new Quaternion() } }, boneRest: { spine: { id: 'r' } }, pose: Object.assign({}, m.targetFor('focus')), breathePhase: 1.2 }; try{ m.animateRig(s, 1000, 'focus'); }catch(_){ return true; } return Math.abs(s.bones.spine.quaternion.last[0] - 0.034) > 1e-9; })(), '집중 상태 호흡 고정을 빼면 빨강');
  const m2 = brk("if(!a||a===seat.current)return;", "if(!a)return;");
  chk(!!m2 && (() => { const m = build(m2); const log = []; const a = { reset(){ return this; }, fadeIn(){ return this; }, fadeOut(){ log.push('out'); }, play(){ log.push('play'); } }; const s = { mixer: {}, actions: { a, idle: a }, current: null }; m.setClip(s, 'a'); m.setClip(s, 'a'); return log.length > 2; })(), '같은 클립 건너뛰기를 빼면 빨강');
  const m3 = brk("case 'sleep':return{leanX:0.1,turnY:0.04,slumpY:-0.03,breSpd:0.9,breAmp:0.015,eyeOpen:0,", "case 'sleep':return{leanX:0.1,turnY:0.04,slumpY:-0.03,breSpd:0.9,breAmp:0.015,eyeOpen:1,");
  chk(!!m3 && build(m3).targetFor('sleep').eyeOpen === 1, '잠든 눈을 뜨게 바꾸면 빨강(1절이 잡는다)');
}
say(''); say((fail ? '✗' : '✓') + ' 통과 ' + pass + ' · 실패 ' + fail); process.exit(fail ? 1 : 0);
