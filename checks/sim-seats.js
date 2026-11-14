/* ═══ 🪑 sim-seats.js — 좌석 목록 · 만들기 · 지우기 · 고른 좌석 · 간격 저장(room/seats.js · app.js 분리 M6) ═══════════════
   [왜] app.js SEATS 구역 머리(좌석 배열 · createSeat · removeSeat · 좌석 간격)를 모듈로 옮겼다. 동작은 그대로여야 한다.
   ・1절: 좌석 간격 — 처음 값(솔로 0.3 · 멀티 0.45) · 저장된 값 읽기(범위 -0.3 ~ 1.2 로 자름 · 숫자 아님 · 저장소 오류) · saveGap 이 두 키에 쓴다
   ・2절: createSeat — 진짜 three · 진짜 desk-build 로 좌석 한 칸(책상 · 앵커 · 대신 몸 · 기본 필드)을 만들고 씬 · 배열 · 줄 배치
   ・3절: removeSeat — 한 칸만 남으면 안 지움 · 고른 좌석이면 이웃을 고름 · 모르는 좌석은 무시
   ・4절: 고른 좌석 · 간격 읽기 / 쓰기 함수
   ・5절: 연결 — html · 만드는 줄 · 옛 이름 · 다시 대입되는 셋은 seatsMod 로 읽는다 · app.js 에 좌석 목록 코드가 안 남음
   ・6절: 일부러 깨 보기
   [실행] 러너 스테이징 또는 저장소 루트에서. three 는 vendor/three/three.min.js. */
'use strict';
const fs = require('fs');
const path = require('path');
let pass = 0, fail = 0;
const say = (s) => console.log(s);
const chk = (ok, msg) => { ok ? pass++ : fail++; say('  ' + (ok ? '✓' : '✗') + ' ' + msg); };
const read = (f) => { for(const c of [f, 'parts/' + f, 'app/parts/' + f, 'app/' + f, f.split('/').pop()]) if(fs.existsSync(c)) return fs.readFileSync(c, 'utf8'); return null; };
const SRC = read('room/seats.js'), DESK = read('room/desk-build.js'), BLINK = read('shared/blink-timing.js'), APP = read('app.js'), HTML = read('desk-companion-prototype.html');
if(!SRC || !DESK || !BLINK || !APP || !HTML){ say('  ? 원본 못 찾음 — seats.js · desk-build.js · blink-timing.js · app.js · html'); process.exit(2); }
const threePath = ['vendor/three/three.min.js', 'app/vendor/three/three.min.js', 'three.min.js'].find(p => fs.existsSync(p));
if(!threePath){ say('  ? 원본 못 찾음 — three.min.js'); process.exit(2); }
const THREE = require(path.resolve(threePath));
const near = (a, b) => Math.abs(a - b) < 1e-9;
const dw = {}; new Function('THREE', 'window', 'module', DESK)(THREE, dw, undefined);
const DB = dw.TwDeskBuild.createDeskBuild({});
const bw = {}; new Function('window', 'module', BLINK)(bw, undefined);
const TwBlinkTiming = bw.TwBlinkTiming || (() => { const m = { exports: {} }; new Function('module', 'window', BLINK)(m, undefined); return m.exports; })();

function build(src, o){
  o = o || {};
  const store = Object.assign({}, o.store || {});
  const writes = [];
  const localStorage = { getItem: (k) => { if(o.storeThrows) throw new Error('x'); return k in store ? store[k] : null; }, setItem: (k, v) => { if(o.storeThrows) throw new Error('x'); store[k] = v; writes.push([k, v]); } };
  const calls = { layout: 0, select: [], tabs: 0 };
  const scene = new THREE.Scene();
  const win = {};
  new Function('THREE', 'TwBlinkTiming', 'localStorage', 'performance', 'window', 'module', src)(THREE, TwBlinkTiming, localStorage, performance, win, undefined);
  const mod = win.TwSeats.createSeats({ CHAR_Z: -0.47, buildDesk: DB.buildDesk, buildPlaceholder: DB.buildPlaceholder, scene });
  if(!o.noAttach) mod.attach({ layoutSeats: () => { calls.layout++; }, selectSeat: (s) => calls.select.push(s), renderSeatTabs: () => calls.tabs++ });
  return { mod, store, writes, calls, scene };
}

say('§1 좌석 간격');
{
  let b = build(SRC);
  chk(b.mod.GAP_MIN === -0.3 && b.mod.GAP_MAX === 1.2 && b.mod.GAP_STEPS === 15, '범위 -0.3 ~ 1.2 · 15 칸');
  chk(b.mod.SPACING() === 0.3 && b.mod.MULTIPLAYER_SPACING() === 0.45, '저장값이 없으면 솔로 0.3 · 멀티 0.45');
  b = build(SRC, { store: { 'tw.gapSolo': '0.8', 'tw.gapMulti': '-0.1' } });
  chk(b.mod.SPACING() === 0.8 && near(b.mod.MULTIPLAYER_SPACING(), -0.1), '저장된 값을 읽는다(tw.gapSolo · tw.gapMulti)');
  b = build(SRC, { store: { 'tw.gapSolo': '9', 'tw.gapMulti': '-5' } });
  chk(b.mod.SPACING() === 1.2 && b.mod.MULTIPLAYER_SPACING() === -0.3, '범위 밖은 끝값으로 자른다(경계값)');
  b = build(SRC, { store: { 'tw.gapSolo': 'abc', 'tw.gapMulti': '' } });
  chk(b.mod.SPACING() === 0.3 && b.mod.MULTIPLAYER_SPACING() === 0.45, '숫자가 아니면 처음 값');
  b = build(SRC, { storeThrows: true });
  chk(b.mod.SPACING() === 0.3 && b.mod.MULTIPLAYER_SPACING() === 0.45, '저장소를 못 읽어도(던져도) 처음 값으로 계속');
  b = build(SRC); b.mod.setSPACING(0.7); b.mod.setMULTIPLAYER_SPACING(0.9); b.mod.saveGap();
  chk(b.store['tw.gapSolo'] === '0.7' && b.store['tw.gapMulti'] === '0.9' && b.writes.length === 2, 'saveGap — 지금 값을 두 키에 문자열로 쓴다');
  b = build(SRC, { storeThrows: true }); let threw = false; try{ b.mod.saveGap(); }catch(_){ threw = true; }
  chk(!threw, '쓰기 오류는 삼킨다');
}
say('§2 createSeat');
{
  const b = build(SRC);
  const s = b.mod.createSeat();
  chk(b.mod.seats.length === 1 && b.mod.seats[0] === s && s.group.parent === b.scene && b.calls.layout === 1, '만들면 배열 · 씬에 올리고 줄 배치를 한 번 부른다');
  chk(s.group.userData.seat === s && s.group.children.includes(s.desk) && s.group.children.includes(s.rig), 'group.userData.seat · 책상 · rig');
  chk(near(s.rig.position.z, -0.47) && s.rig.children.includes(s.bodyWrap) && s.bodyWrap.children.includes(s.placeholder.root), 'rig 는 CHAR_Z · 몸통 틀에 대신 몸');
  chk(s.deskAnchor === s.desk.userData.deskAnchor && s.deskItems && Object.keys(s.deskItems).length === 0 && s.activeDeskItem === null, '책상 앵커 · 빈 아이템 목록');
  chk(s.deskMat && s.deskMat === s.desk.getObjectByName('deskTop').material, '상판 재질은 좌석마다 복제(책상 색을 따로 바꾸려고)');
  const s2 = b.mod.createSeat();
  chk(s.deskMat !== s2.deskMat, '  두 좌석이 재질을 나눠 쓰지 않는다');
  chk(s.isPlaceholder === true && s.userScale === 1 && s.userY === 0 && s.userZ === 0 && near(s.userRot, Math.PI) && s.userX === 0 && s.targetX === 0, '기본 필드 — 대신 몸 · 크기 1 · 방향 π');
  chk(Array.isArray(s.bones.ear) && s.bones.ear.length === 0 && s.hasRig === false && s.pose.eyeOpen === 1, '뼈 목록 비어 있음 · 자세 처음 값');
  chk(near(s.headAnchor.position.y, 1.08) && near(s.bodyAnchor.position.y, 0.46) && s.bodyWrap.children.includes(s.headAnchor) && s.bodyWrap.children.includes(s.bodyAnchor), '머리 · 몸 앵커 자리(1.08 · 0.46)');
  chk(s.equipped.hair === null && s.equippedId.clothes === null && s.earNextAt > performance.now(), '장착 칸 · 귀 까닥임 시각');
  chk(s.smooth >= 0.0016 && s.smooth <= 0.0028 && s.blink, '부드럽기 · 눈 깜빡임 타이머');
}
say('§3 removeSeat');
{
  const b = build(SRC); const a = b.mod.createSeat(), c = b.mod.createSeat(), d = b.mod.createSeat();
  b.calls.layout = 0;
  b.mod.setSelected(c); b.mod.removeSeat(c);
  chk(b.mod.seats.length === 2 && !b.mod.seats.includes(c) && c.group.parent === null, '지우면 배열 · 씬에서 뺀다');
  chk(b.calls.select.length === 1 && b.calls.select[0] === a && b.calls.layout === 1 && b.calls.tabs === 1, '고른 좌석을 지우면 바로 앞 좌석을 고르고 줄 배치 · 탭을 다시 그린다');
  b.mod.setSelected(a); b.calls.select.length = 0; b.mod.removeSeat(d);
  chk(b.calls.select.length === 0 && b.mod.seats.length === 1, '고른 좌석이 아니면 선택은 그대로');
  b.mod.removeSeat(a);
  chk(b.mod.seats.length === 1, '★ 한 칸만 남으면 지우지 않는다');
  b.mod.removeSeat({ group: new THREE.Group() });
  chk(b.mod.seats.length === 1, '목록에 없는 좌석은 무시');
  const b2 = build(SRC); const x = b2.mod.createSeat(), y = b2.mod.createSeat(); b2.mod.setSelected(x); b2.mod.removeSeat(x);
  chk(b2.calls.select[0] === y, '맨 앞을 지우면 새 맨 앞(max(0, i-1))을 고른다');
}
say('§3-b 알림 걸기');
{
  const b = build(SRC, { noAttach: true }); let threw = false; try{ b.mod.createSeat(); }catch(_){ threw = true; }
  chk(threw, 'attach 전에 createSeat 를 부르면 던진다(조용히 줄 배치를 건너뛰지 않는다)');
}
say('§4 고른 좌석 · 간격 함수');
{
  const b = build(SRC); const s = b.mod.createSeat();
  chk(b.mod.selected() === null, '처음엔 고른 좌석 없음');
  b.mod.setSelected(s); chk(b.mod.selected() === s, 'setSelected · selected');
  b.mod.setSPACING(0.11); b.mod.setMULTIPLAYER_SPACING(0.22);
  chk(b.mod.SPACING() === 0.11 && b.mod.MULTIPLAYER_SPACING() === 0.22, '간격 읽기 · 쓰기 함수(다시 대입되는 값이라 함수로 내놓는다)');
}
say('§5 연결');
{
  const iS = HTML.indexOf('<script src="parts/room/seats.js"></script>'), iA = HTML.indexOf('<script src="parts/app.js"></script>');
  chk(iS > 0 && iA > iS, 'html — seats.js 를 app.js 보다 먼저 싣는다');
  const code = APP.replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/(^|[^:'"\\])\/\/[^\n]*/g, '$1 ');
  chk(/const seatsMod = TwSeats\.createSeats\(\{[\s\S]*?scene: scene,\s*\}\);/.test(code) && !/createSeats\(\{[^}]*seatPanelMod/.test(code), 'app.js — 위층(seatPanelMod · layoutSeats)은 deps 로 넘기지 않는다(순환 막기)');
  chk(/seatsMod\.attach\(\{[\s\S]*?layoutSeats: \(\)=>layoutSeats\(\),[\s\S]*?renderSeatTabs:[\s\S]*?selectSeat:[\s\S]*?\}\);/.test(code) && code.indexOf('seatsMod.attach') > code.indexOf('const seatPanelMod'), '  알림은 seatPanelMod 를 만든 뒤 attach 로 걸고 layoutSeats 는 부를 때 찾는다(뒤에서 감싸 다시 대입됨)');
  chk(['seats', 'GAP_MIN', 'GAP_MAX', 'GAP_STEPS', 'saveGap', 'createSeat'].every(n => new RegExp('^const ' + n + ' = seatsMod\\.' + n + ';', 'm').test(code)), '  옛 이름 여섯을 const 로 받는다');
  chk(!/\blet (selected|SPACING|MULTIPLAYER_SPACING)\b|function (createSeat|removeSeat|saveGap|_loadGap)\b/.test(code) && !/(?<![\w$.])(selected|SPACING|MULTIPLAYER_SPACING) *=[^=]/.test(code), '  app.js 에 좌석 목록 코드 · 다시 대입되는 let 이 남아 있지 않다');
  chk(!/(?<![\w$.'"])selected(?![\w$'"]) *[.)\]=;,]/.test(code.replace(/seatsMod\.selected\(\)/g, '')), '  고른 좌석은 어디서나 seatsMod.selected() 로 읽는다');
}
say('§6 일부러 깨 보기');
{
  const brk = (from, to) => { const m = SRC.replace(from, to); return m === SRC ? null : m; };
  const m1 = brk('if(i<0||seats.length<=1) return;', 'if(i<0) return;');
  chk(!!m1 && (() => { const b = build(m1); const s = b.mod.createSeat(); b.mod.removeSeat(s); return b.mod.seats.length === 0; })(), '마지막 좌석을 지우면 빨강');
  const m2 = brk('Math.max(GAP_MIN,Math.min(GAP_MAX,v))', 'v');
  chk(!!m2 && build(m2, { store: { 'tw.gapSolo': '9' } }).mod.SPACING() !== 1.2, '간격을 범위로 안 자르면 빨강');
  const m3 = brk('_dt.material=_dt.material.clone();', '');
  chk(!!m3 && (() => { const b = build(m3); const a = b.mod.createSeat(), c = b.mod.createSeat(); return a.deskMat === c.deskMat; })(), '상판 재질을 복제하지 않으면 빨강');
  const m4 = brk('scene.add(group); seats.push(seat); hooks.layoutSeats(); return seat;', 'seats.push(seat); hooks.layoutSeats(); return seat;');
  chk(!!m4 && (() => { const b = build(m4); const s = b.mod.createSeat(); return s.group.parent === null; })(), '씬에 안 올리면 빨강');
  const m5 = brk("localStorage.setItem(GAP_KEY_MULTI, String(MULTIPLAYER_SPACING));", '');
  chk(!!m5 && (() => { const b = build(m5); b.mod.saveGap(); return b.writes.length === 1; })(), '멀티 간격을 안 쓰면 빨강');
  const m6 = brk('if(selected===seat) hooks.selectSeat(', 'if(false) hooks.selectSeat(');
  chk(!!m6 && (() => { const b = build(m6); const a = b.mod.createSeat(), c = b.mod.createSeat(); b.mod.setSelected(c); b.mod.removeSeat(c); return b.calls.select.length === 0; })(), '고른 좌석을 지워도 이웃을 안 고르면 빨강');
}
say('');
say((fail ? '✗' : '✓') + ' 통과 ' + pass + ' · 실패 ' + fail);
process.exit(fail ? 1 : 0);
