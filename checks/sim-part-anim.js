/* ═══ ▶ sim-part-anim.js — 파츠 · 아이템 애니메이션 재생(character/part-anim.js · app.js 분리 M4) ═══════════════
   [왜] app.js BUILDERS 의 «재생» 조각(클립 고르기 · 믹서 · 활동 중에만 재생 · 손 따라가기)을 모듈로 옮겼다. 동작은 그대로여야 한다.
   ・1절: 클립 — _clipHasMotion(정지 포즈 · 움직임 · 빈 것 · 던지는 것) · _pickPartClip(움직이는 클립이 이름보다 먼저 · idle 정확 일치가 포함보다 먼저)
   ・2절: 귀 파츠 클립에서 남이 맡은 본 트랙 걷기(진짜 three 트랙 · 정제된 이름)
   ・3절: 파츠 재생 — 믹서 세우기 · active 모드는 일시정지로 시작 · 좌석이 focus 일 때만 재생 · 되감지 않고 멈춤 · 꾸미기 미리보기는 늘 재생 · 걷기
   ・4절: 아이템 idle 재생 — focus 면 재생 · 아니면 정지 · 빡일중(grind)은 2배속 · 눌러 재생(playItemIdle)
   ・5절: 손 따라가기 — 손 본의 월드 위치를 부모 기준 좌표로
   ・6절: 연결 — html · 만드는 줄 · 옛 이름 · app.js 에 재생 함수가 남지 않음 · 알림(_partAnimNotice)은 꺼져 있다
   ・7절: 일부러 깨 보기
   [실행] 러너 스테이징 또는 저장소 루트에서. three 는 vendor/three/three.min.js. */
'use strict';
const fs = require('fs');
const path = require('path');
let pass = 0, fail = 0;
const say = (s) => console.log(s);
const chk = (ok, msg) => { ok ? pass++ : fail++; say('  ' + (ok ? '✓' : '✗') + ' ' + msg); };
const read = (f) => { for(const c of [f, 'parts/' + f, 'app/parts/' + f, 'app/' + f, f.split('/').pop()]) if(fs.existsSync(c)) return fs.readFileSync(c, 'utf8'); return null; };
const SRC = read('character/part-anim.js'), APP = read('app.js'), HTML = read('desk-companion-prototype.html');
if(!SRC || !APP || !HTML){ say('  ? 원본 못 찾음 — part-anim.js · app.js · desk-companion-prototype.html'); process.exit(2); }
const threePath = ['vendor/three/three.min.js', 'app/vendor/three/three.min.js', 'three.min.js'].find(p => fs.existsSync(p));
if(!threePath){ say('  ? 원본 못 찾음 — three.min.js'); process.exit(2); }
const THREE = require(path.resolve(threePath));

function build(src, o){
  o = o || {};
  const st = { state: {}, seats: [], admin: !!o.admin, userStatus: o.userStatus || null, toasts: [] };
  const win = {};
  new Function('THREE', 'performance', 'window', 'module', src)(THREE, { now: () => 1000 }, win, undefined);
  const mod = win.TwPartAnim.createPartAnim({
    seatState: (h) => (st.state.get ? st.state.get(h) : 'idle'),
    toast: (m) => st.toasts.push(m),
    isAdmin: () => st.admin,
    seats: () => st.seats,
    userStatus: () => st.userStatus,
  });
  return { mod, st };
}
const clip = (name, vals) => new THREE.AnimationClip(name, -1, [new THREE.VectorKeyframeTrack('.position', [0, 1], vals || [0, 0, 0, 1, 1, 1])]);
const still = (name) => clip(name, [0, 0, 0, 0, 0, 0]);
const stateOf = (map) => ({ get: (h) => map.get(h) });

say('§1 클립 고르기');
{
  const { mod } = build(SRC);
  chk(mod._clipHasMotion(clip('m')) === true && mod._clipHasMotion(still('s')) === false, '값이 첫 프레임과 다르면 움직임 · 전부 같으면 정지 포즈');
  chk(mod._clipHasMotion(null) === false && mod._clipHasMotion({ tracks: [] }) === false, '클립이 없거나 트랙이 없으면 false');
  chk(mod._clipHasMotion({ tracks: [{ get values(){ throw new Error('x'); } }] }) === true, '못 판단하면 «움직인다» (멀쩡한 클립을 건너뛰지 않는다)');
  chk(mod._clipHasMotion(clip('tiny', [0, 0, 0, 1e-5, 0, 0])) === false && mod._clipHasMotion(clip('ok', [0, 0, 0, 2e-4, 0, 0])) === true, '움직임 문턱 1e-4');
  chk(mod._pickPartClip([]) === null && mod._pickPartClip(null) === null, '클립이 없으면 null');
  const a = still('idle'), b = clip('dou_idle'), c = clip('Walk');
  chk(mod._pickPartClip([a, b, c]) === b, '정지 포즈 idle 보다 실제로 움직이는 클립이 먼저');
  const d = clip('dou_idle'), e = clip('idle');
  chk(mod._pickPartClip([d, e]) === e, 'idle 정확 일치가 idle 포함(dou_idle)보다 먼저');
  chk(mod._pickPartClip([clip('x'), clip('my_idle')]).name === 'my_idle', '정확 일치가 없으면 idle 포함');
  chk(mod._pickPartClip([clip('A'), clip('B')]).name === 'A', '둘 다 없으면 움직이는 첫 클립');
  const s1 = still('Pose'), s2 = still('idle');
  chk(mod._pickPartClip([s1, s2]) === s2, '움직이는 게 하나도 없으면 정지 클립 중 idle → 첫 것');
}
say('§2 남이 맡은 본 트랙 걷기');
{
  const { mod } = build(SRC);
  const obj = new THREE.Group(); obj.name = 'root';
  const head = new THREE.Group(); head.name = 'head'; obj.add(head);
  const ear = new THREE.Group(); ear.name = 'ear.L'; head.add(ear);
  const hand = new THREE.Group(); hand.name = 'hand_L'; obj.add(hand);
  const T = (n) => new THREE.VectorKeyframeTrack(n + '.position', [0, 1], [0, 0, 0, 1, 1, 1]);
  const cl = new THREE.AnimationClip('Arm', -1, [T('head'), T('earL'), T('hand_L')]);
  const log = console.log; const lines = []; console.log = (...x) => lines.push(x.join(' '));
  const out = mod._stripPartClipOwnedTracks(cl, obj, [ear]);
  console.log = log;
  chk(out !== cl && out.tracks.length === 1 && out.tracks[0].name.startsWith('hand_L') && out._twStrippedTracks === 2, '귀 본 + 조상(head, 정제된 이름 earL 포함) 트랙은 걷고 나머지는 둔다 · 원본 클립은 안 건드린다(복제)');
  chk(cl.tracks.length === 3 && lines.some(l => l.includes('[파츠 애니]') && l.includes('2개')), '  원본 트랙 3개 그대로 · 걷은 수를 로그에 남긴다');
  chk(mod._stripPartClipOwnedTracks(cl, obj, []) === cl && mod._stripPartClipOwnedTracks(cl, obj, null) === cl && mod._stripPartClipOwnedTracks(null, obj, [ear]) === null, '귀가 없거나 클립이 없으면 그대로');
  const lone = new THREE.AnimationClip('L', -1, [T('hand_L')]);
  chk(mod._stripPartClipOwnedTracks(lone, obj, [ear]) === lone, '걸 것이 없으면 같은 클립을 돌려준다');
}
say('§3 파츠 재생');
{
  const b = build(SRC);
  const holder = { id: 'seat1' }; b.st.seats.push(holder);
  const mk = () => { const obj = new THREE.Group(); const wrap = new THREE.Group(); wrap.add(obj); return { obj, wrap }; };
  const p = mk(); const map = new Map([[holder, 'idle']]); b.st.state = stateOf(map);
  b.mod._setupPartIdleAnim(p.wrap, p.obj, clip('c'), { animMode: 'active' }, holder);
  const a = p.wrap.userData.idleAction;
  chk(p.wrap.userData.itemMixer instanceof THREE.AnimationMixer && a.paused === true && p.wrap.userData.animHolder === holder, 'active 모드 — 믹서를 세우고 일시정지로 시작');
  chk(!b.mod.activeItemMixers.has(p.wrap.userData.itemMixer), '  재생 판정 전에는 돌릴 믹서에 안 들어간다');
  b.mod.updateActivePartPlayback();
  chk(a.paused === true && !b.mod.activeItemMixers.has(p.wrap.userData.itemMixer), '좌석이 focus 가 아니면 계속 정지');
  map.set(holder, 'focus'); b.mod.updateActivePartPlayback();
  chk(a.paused === false && a.isRunning() && b.mod.activeItemMixers.has(p.wrap.userData.itemMixer), 'focus(활동 중) → 재생 · 믹서 목록에 넣는다');
  a.time = 0.5; map.set(holder, 'sleep'); b.mod.updateActivePartPlayback();
  chk(a.paused === true && a.time === 0.5 && !b.mod.activeItemMixers.has(p.wrap.userData.itemMixer), '활동이 끝나면 되감지 않고 그 자리에 멈춘다(paused · time 유지) · 믹서 목록에서 뺀다');
  const q = mk(); b.mod._setupPartIdleAnim(q.wrap, q.obj, clip('c'), { animMode: 'active' }, { notASeat: true });
  b.mod.updateActivePartPlayback();
  chk(q.wrap.userData.idleAction.paused === false, '꾸미기 미리보기(좌석 아님)는 상태가 없어 계속 재생');
  const r = mk(); b.mod._setupPartIdleAnim(r.wrap, r.obj, clip('c'), { animMode: 'always' }, holder);
  chk(r.wrap.userData.idleAction.isRunning() && b.mod.activeItemMixers.has(r.wrap.userData.itemMixer), 'active 가 아니면 바로 계속 반복 재생');
  b.mod._teardownPartIdleAnim(p.wrap); b.mod._teardownPartIdleAnim(r.wrap);
  chk(!b.mod.activeItemMixers.has(r.wrap.userData.itemMixer) && !b.mod.activeItemMixers.has(p.wrap.userData.itemMixer), '걷기 — 믹서 목록에서 뺀다');
  b.mod._teardownPartIdleAnim(null); b.mod._teardownPartIdleAnim({});
  const z = mk(); b.mod._setupPartIdleAnim(z.wrap, z.obj, clip('c'), { animMode: 'active' }, holder); z.wrap.userData.idleAction = null;
  let threw = false; try{ b.mod.updateActivePartPlayback(); }catch(_){ threw = true; }
  chk(!threw, '걷기 · 빈 입력 · 액션이 사라진 파츠는 조용히 지나간다');
}
say('§4 아이템 idle 재생');
{
  const b = build(SRC);
  const holder = { isMe: true }; const map = new Map([[holder, 'idle']]); b.st.state = stateOf(map);
  const obj = new THREE.Group(); const pivot = new THREE.Group(); pivot.add(obj);
  const mixer = new THREE.AnimationMixer(obj); const action = mixer.clipAction(clip('c'));
  Object.assign(pivot.userData, { idleAction: action, itemMixer: mixer, holder });
  b.mod._idleItemPivots.add(pivot);
  b.mod.updateIdleItemPlayback();
  chk(!action.isRunning() && !b.mod.activeItemMixers.has(mixer), 'focus 가 아니면 정지 상태 유지');
  map.set(holder, 'focus'); b.mod.updateIdleItemPlayback();
  chk(action.isRunning() && b.mod.activeItemMixers.has(mixer) && action.timeScale === 1, 'focus → 재생 · 믹서 목록 · 속도 1');
  b.st.userStatus = 'grind'; b.mod.updateIdleItemPlayback();
  chk(action.timeScale === 2, '내 좌석이 빡일중(grind)이면 2배속');
  b.st.userStatus = null; holder.isMe = false; holder.remote = true; holder.remoteUserStatus = 'grind'; b.mod.updateIdleItemPlayback();
  chk(action.timeScale === 2, '친구 좌석은 remoteUserStatus 를 본다');
  map.set(holder, 'sleep'); b.mod.updateIdleItemPlayback();
  chk(!action.isRunning() && !b.mod.activeItemMixers.has(mixer), 'focus 가 끝나면 정지 · 믹서 목록에서 뺀다');
  const bare = new THREE.Group(); b.mod._idleItemPivots.add(bare);
  let threw = false; try{ b.mod.updateIdleItemPlayback(); }catch(_){ threw = true; }
  chk(!threw, '액션 · 믹서 · 소유 좌석이 없는 pivot 은 건너뛴다');
  const pv2 = new THREE.Group(); const ob2 = new THREE.Group(); pv2.add(ob2); const mx2 = new THREE.AnimationMixer(ob2);
  pv2.userData.idleAction = mx2.clipAction(clip('c')); pv2.userData.itemMixer = mx2;
  chk(b.mod.playItemIdle(pv2) === true && pv2.userData.idleAction.isRunning() && b.mod.activeItemMixers.has(mx2), 'playItemIdle — 처음부터 한 번 재생 · 믹서 목록에 넣는다');
  chk(b.mod.playItemIdle(new THREE.Group()) === false && b.mod.playItemIdle(null) === false, '재생할 액션이 없으면 false');
}
say('§5 손 따라가기');
{
  const b = build(SRC);
  const parent = new THREE.Group(); parent.position.set(10, 0, 0); parent.updateMatrixWorld(true);
  const node = new THREE.Group(); parent.add(node);
  const bone = new THREE.Group(); bone.position.set(3, 4, 5); const scene = new THREE.Group(); scene.add(bone); scene.updateMatrixWorld(true);
  const seat = { deskItems: { a: { userData: { handTrackers: { L: node } } } }, bones: { handL: bone } };
  b.mod.updateItemHandTrackers(seat);
  chk(near3(node.position, [-7, 4, 5]), '손 본의 월드 위치(3,4,5)를 부모 기준 좌표(-7,4,5)로 옮긴다');
  const none = { deskItems: { a: { userData: { handTrackers: { R: node } } } }, bones: {} };
  let threw = false; try{ b.mod.updateItemHandTrackers(none); b.mod.updateItemHandTrackers({}); b.mod.updateItemHandTrackers({ deskItems: { x: null } }); }catch(_){ threw = true; }
  chk(!threw, '손 본이 없거나 아이템이 비었으면 조용히 지나간다');
}
function near3(v, a){ return Math.abs(v.x - a[0]) < 1e-9 && Math.abs(v.y - a[1]) < 1e-9 && Math.abs(v.z - a[2]) < 1e-9; }

say('§6 연결');
{
  const iP = HTML.indexOf('<script src="parts/character/part-anim.js"></script>'), iA = HTML.indexOf('<script src="parts/app.js"></script>');
  chk(iP > 0 && iA > iP, 'html — part-anim.js 를 app.js 보다 먼저 싣는다');
  const code = APP.replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/(^|[^:'"\\])\/\/[^\n]*/g, '$1 ');
  chk(/const partAnimMod = TwPartAnim\.createPartAnim\(\{[\s\S]*?isAdmin: \(\)=>isAdmin,[\s\S]*?seats: \(\)=>seats,[\s\S]*?userStatus: \(\)=>userStatus,[\s\S]*?\}\);/.test(code), 'app.js — 만들고 다시 대입되는 let(isAdmin · userStatus)과 늦게 선언되는 seats 는 읽는 함수로 넘긴다');
  const names = ['activeItemMixers', '_idleItemPivots', '_clipHasMotion', '_pickPartClip', '_partAnimNotice', '_stripPartClipOwnedTracks', '_setupPartIdleAnim', '_teardownPartIdleAnim', 'updateActivePartPlayback', 'updateIdleItemPlayback', 'updateItemHandTrackers', 'playItemIdle'];
  chk(names.every(n => new RegExp('^const ' + n + ' = partAnimMod\\.' + n + ';', 'm').test(code)), '  옛 이름 열둘을 const 로 받는다');
  chk(!/function (_clipHasMotion|_pickPartClip|_stripPartClipOwnedTracks|_setupPartIdleAnim|_teardownPartIdleAnim|updateActivePartPlayback|updateIdleItemPlayback|updateItemHandTrackers|playItemIdle|_partAnimNotice)\b/.test(code), '  app.js 에 재생 함수가 남아 있지 않다');
  const { mod, st } = build(SRC, { admin: true });
  const r = mod._partAnimNotice({ id: 'p', name: 'n' }, '안내');
  chk(r === undefined && st.toasts.length === 0, '_partAnimNotice — 첫 줄 return 으로 꺼져 있어 관리자에게도 토스트를 안 낸다');
}
say('§7 일부러 깨 보기');
{
  const brk = (from, to) => { const m = SRC.replace(from, to); return m === SRC ? null : m; };
  const m1 = brk("a.paused = true;                 // 그 자리에 정지 — 되감지 않음", "a.stop();");
  chk(!!m1 && (() => { const b = build(m1); const h = {}; b.st.seats.push(h); const mp = new Map([[h, 'focus']]); b.st.state = stateOf(mp); const o = new THREE.Group(), w = new THREE.Group(); w.add(o); b.mod._setupPartIdleAnim(w, o, clip('c'), { animMode: 'active' }, h); b.mod.updateActivePartPlayback(); w.userData.idleAction.time = 0.5; mp.set(h, 'idle'); b.mod.updateActivePartPlayback(); return w.userData.idleAction.paused !== true; })(), '멈출 때 paused 대신 stop 하면 빨강');
  const m2 = brk('(us === \'grind\') ? 2.0 : 1.0', '1.0');
  chk(!!m2 && (() => { const b = build(m2); const h = { isMe: true }; b.st.state = stateOf(new Map([[h, 'focus']])); b.st.userStatus = 'grind'; const o = new THREE.Group(), pv = new THREE.Group(); pv.add(o); const mx = new THREE.AnimationMixer(o); Object.assign(pv.userData, { idleAction: mx.clipAction(clip('c')), itemMixer: mx, holder: h }); b.mod._idleItemPivots.add(pv); b.mod.updateIdleItemPlayback(); return pv.userData.idleAction.timeScale !== 2; })(), '빡일중 2배속을 빼면 빨강');
  const m3 = brk("return moving.find(exact) || moving.find(partial) || moving[0]", "return animations.find(exact) || animations.find(partial) || animations[0]");
  chk(!!m3 && build(m3).mod._pickPartClip([still('idle'), clip('Walk')]).name === 'idle', '움직이는 클립을 이름보다 먼저 보는 규칙을 빼면 빨강');
  const m4 = brk('if(n===obj) break;', '');
  chk(!!m4 && (() => { const lg = console.log; console.log = () => {}; try{ const b = build(m4); const o = new THREE.Group(); o.name = 'root'; const par = new THREE.Group(); par.name = 'outer'; par.add(o); const e = new THREE.Group(); e.name = 'earL'; o.add(e); const T = (n) => new THREE.VectorKeyframeTrack(n + '.position', [0, 1], [0, 0, 0, 1, 1, 1]); const c = new THREE.AnimationClip('x', -1, [T('outer'), T('hand')]); return b.mod._stripPartClipOwnedTracks(c, o, [e]).tracks.length === 1; } finally { console.log = lg; } })(), 'obj 에서 올라가기를 멈추지 않으면(바깥 조상까지 걷으면) 빨강');
  const m5 = brk('if(!a || !m || !holder){ _activePartWraps.delete(wrp); return; }', '');
  chk(!!m5 && (() => { const b = build(m5); const w = new THREE.Group(); const o = new THREE.Group(); w.add(o); b.mod._setupPartIdleAnim(w, o, clip('c'), { animMode: 'active' }, {}); w.userData.idleAction = null; try{ b.mod.updateActivePartPlayback(); }catch(_){ return true; } return false; })(), '사라진 액션을 건너뛰지 않으면 빨강');
  const m6 = brk('node.position.copy(_handWorldTmp);', '');
  chk(!!m6 && (() => { const b = build(m6); const par = new THREE.Group(); const nd = new THREE.Group(); par.add(nd); const bn = new THREE.Group(); bn.position.set(1, 2, 3); const sc = new THREE.Group(); sc.add(bn); sc.updateMatrixWorld(true); b.mod.updateItemHandTrackers({ deskItems: { a: { userData: { handTrackers: { L: nd } } } }, bones: { handL: bn } }); return nd.position.x === 0; })(), '손 위치를 안 옮기면 빨강');
}
say('');
say((fail ? '✗' : '✓') + ' 통과 ' + pass + ' · 실패 ' + fail);
process.exit(fail ? 1 : 0);
