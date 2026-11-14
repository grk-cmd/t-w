/* ═══ 🖱 sim-seat-pointer.js — 캔버스 누르기 · 끌기 · 흔들기 · 쓰다듬기 · 우클릭(room/seat-pointer.js · app.js 분리 M11) ═══════════════
   [왜] DRAG / PET 구역을 모듈로 옮겼다. 동작은 그대로여야 한다.
   ・1절: 듣기 — 캔버스 5개 · window 2개를 만들 때 한 번 건다
   ・2절: 우클릭 — 끄는 중 흔들기면 그 자리 고정(pinned) · 억제 1회 · 조준 취소 · 맞은 좌석이 있으면 메뉴 · 회사원 모드에서 남의 좌석은 메뉴 없음
   ・3절: 누르기 · 끌기 — 조준 가로채기 · 숨긴 좌석 · 캐릭터는 흔들기 · 책상은 슬롯 이동 · 6px 아래는 쓰다듬기
   ・4절: 쓰다듬기 · 어지러움 — 하트 · 남의 좌석 알림 · 내 좌석 알림(쓰로틀) · 어지러움 확정 · 던져도 drag 가 풀린다(try/finally)
   ・5절: 안전망 — blur · pointercancel 로 drag · beingShaken 풀기 · 전역 마우스 NDC
   ・6절: 연결 — html 순서 · 만드는 줄 · 옛 이름 · drag 읽는 곳 · app.js 에 본문이 안 남음
   ・7절: 일부러 깨 보기
   [실행] 러너 스테이징 또는 저장소 루트에서. */
'use strict';
const fs = require('fs');
let pass = 0, fail = 0;
const say = (s) => console.log(s);
const chk = (ok, msg) => { ok ? pass++ : fail++; say('  ' + (ok ? '✓' : '✗') + ' ' + msg); };
const read = (f) => { for(const c of [f, 'parts/' + f, 'app/parts/' + f, 'app/' + f, f.split('/').pop()]) if(fs.existsSync(c)) return fs.readFileSync(c, 'utf8'); return null; };
const SRC = read('room/seat-pointer.js'), APP = read('app.js'), HTML = read('desk-companion-prototype.html');
if(!SRC || !APP || !HTML){ say('  ? 원본 못 찾음 — seat-pointer.js · app.js · desk-companion-prototype.html'); process.exit(2); }

class V3 { constructor(x, y, z){ this.x = x || 0; this.y = y || 0; this.z = z || 0; } clone(){ return new V3(this.x, this.y, this.z); } sub(o){ this.x -= o.x; this.y -= o.y; this.z -= o.z; return this; } negate(){ this.x = -this.x; this.y = -this.y; this.z = -this.z; return this; } }
function build(src, o){
  o = o || {};
  const cl = {}, wl = {};
  const hitsHolder = { hits: [] };
  const THREE = {
    Vector3: V3, Vector2: class { constructor(){ this.x = 0; this.y = 0; } },
    Plane: class { constructor(){} setFromNormalAndCoplanarPoint(){ return this; } },
    Raycaster: class { constructor(){ this.ray = { intersectPlane: (pl, pt) => { pt.x = o.planeX == null ? 0 : o.planeX; pt.y = 0; pt.z = 0; return pt; } }; } setFromCamera(){} intersectObjects(){ return hitsHolder.hits; } },
  };
  const canvas = { getBoundingClientRect: () => ({ left: 0, top: 0, width: 100, height: 100 }), addEventListener: (t, f) => { cl[t] = f; }, setPointerCapture(){}, releasePointerCapture(){} };
  const win = { addEventListener: (t, f) => { wl[t] = f; }, TwSeatPin: o.noPin ? undefined : { dragIndex: (i) => i } };
  const st = { t: 1000, suppress: !!o.suppress, office: !!o.office, flyAim: false, bonkAim: false, pokes: [], floaters: [], pets: [], menu: [], selects: [], layouts: 0, tabs: 0, hots: 0, toasts: [], clickSnd: 0, bubble: 0, myPetSent: 0, pokeSelf: 0, presenceActive: true, pokeThrows: !!o.pokeThrows };
  const seats = o.seats || [];
  const mkSeat = (s) => Object.assign({ group: { position: { x: 0 }, updateMatrixWorld(){}, getWorldPosition(v){ v.x = 0; v.y = 0; v.z = 0; } }, rig: { position: { x: 0, y: 0, z: 0 }, getWorldPosition(v){ v.x = 1; v.y = 1; v.z = 1; } }, petStart: -1e9, userData: {} }, s || {});
  const deps = {
    Presence: () => ({ active: () => st.presenceActive, poke(id, k){ if(st.pokeThrows) throw new Error('서버 끊김'); st.pokes.push([id, k]); }, pokeSelf(k){ st.pokeSelf++; } }),
    _uiHot: () => { st.hots++; }, activeItemMixers: new Set(), camera: { getWorldDirection: (v) => v },
    canvas, floatersMod: () => ({ FLOATER_BURST: 2, MY_PET_SEND_GAP_MS: 500, spawnFloater: (e, c, s) => st.floaters.push(e), setMyPetLocalAt(){}, _myPetSentAt: () => st.myPetSent, setMyPetSentAt(v){ st.myPetSent = v; } }),
    hiddenSeatsMod: { _preferVisibleHit: (h) => h, _skipHiddenDesk: (h) => h, _hitsSkipHidden: (h) => h },
    iDeskMod: { findRideTarget: () => null, _rideDenyToastAt: () => 0, setRideDenyToastAt(){} }, layoutSeats: () => { st.layouts++; },
    officeMode: () => st.office, overheadMod: { dismissSeatHeadBubble: () => { st.bubble++; } }, playItemIdle(){},
    rideBenchMod: { unmountRide(){}, findBenchSlot: () => null, mountBench: () => false, unmountBench(){}, mountRide: () => false },
    roomSeatMode: () => 'row', seatLayoutMod: { slotIndexAt: () => (o.slotIdx == null ? 0 : o.slotIdx) },
    seatMenuMod: () => ({ _seatCtxMenu: (e, s) => st.menu.push(s) }),
    seatPanelMod: { selectSeat: (s) => st.selects.push(s), renderSeatTabs: () => { st.tabs++; } }, seats,
    setSuppressNextContextMenu: (v) => { st.suppress = v; }, sfxMod: { _clickSnd: { play: () => { st.clickSnd++; } } },
    suppressNextContextMenu: () => st.suppress, toast: (m) => st.toasts.push(m),
    tricksMod: { _flyAiming: () => st.flyAim, _bonkAiming: () => st.bonkAim, _flyAimClick(){ st.flyAimClick = 1; }, _bonkAimClick(){ st.bonkAimClick = 1; }, setBonkAiming(v){ st.bonkAim = v; } },
    triggerPet: (s) => { st.pets.push(s); s.petStart = st.t; },
  };
  const perf = { now: () => st.t };
  const names = ['THREE', 'window', 'TwSeatLabelDrag', 'TwSeatPin', 'performance', 'setTimeout', 'module'];
  const gw = {};
  new Function(...names, src)(THREE, win, { canGrabSeat: (s) => !!s && !s.fly }, win.TwSeatPin, perf, (f) => { f(); return 0; }, undefined);
  const mod = win.TwSeatPointer.createSeatPointer(deps);
  const ev = (x, y, extra) => Object.assign({ button: 0, clientX: x, clientY: y, pointerId: 1, preventDefault(){} }, extra || {});
  const hitSeat = (seat, obj) => { seat.group.userData = { seat }; const o2 = { userData: { seat }, parent: null }; hitsHolder.hits = [{ object: obj || o2 }]; return o2; };
  return { mod, cl, wl, st, seats, mkSeat, ev, hitsHolder, hitSeat, deps };
}
const charHit = (b, seat) => { const o = { userData: { seat }, parent: seat.rig }; seat.rig.parent = seat.group; seat.group.userData = { seat }; b.hitsHolder.hits = [{ object: o }]; };

say('§1 듣기');
{
  const b = build(SRC);
  chk(['contextmenu', 'pointerdown', 'pointermove', 'pointerup', 'pointercancel'].every(k => typeof b.cl[k] === 'function') && typeof b.wl.blur === 'function' && typeof b.wl.mousemove === 'function', '캔버스 5개(contextmenu · pointerdown · pointermove · pointerup · pointercancel) · window 2개(blur · mousemove)를 만들 때 건다');
  chk(b.mod.drag() === null && b.mod.mouseNdcX() === 0 && b.mod.mouseNdcY() === 0, '처음엔 끄는 중이 아님 · 마우스 NDC 0');
}
say('§2 우클릭');
{
  let b = build(SRC); const s = b.mkSeat({ isMe: true }); b.seats.push(s);
  let ev = b.ev(0, 0); let pd = 0; ev.preventDefault = () => { pd++; };
  b.st.suppress = true; b.cl.contextmenu(ev);
  chk(pd === 1 && b.st.suppress === false && b.st.menu.length === 0, '이동 모드를 우클릭으로 막 확정한 뒤 1회는 무시하고 억제 깃발을 내린다');
  charHit(b, s); b.cl.contextmenu(b.ev(0, 0));
  chk(b.st.menu.length === 1 && b.st.menu[0] === s, '좌석을 맞히면 좌석 메뉴를 연다');
  b.hitsHolder.hits = []; b.st.menu.length = 0; b.cl.contextmenu(b.ev(0, 0));
  chk(b.st.menu.length === 0, '아무것도 안 맞으면 아무 일 없음');
  b.st.bonkAim = true; charHit(b, s); b.cl.contextmenu(b.ev(0, 0));
  chk(b.st.bonkAim === false && b.st.menu.length === 0, '때리기 조준 중 우클릭은 취소만 · 메뉴 없음');
  b.st.flyAim = true; b.cl.contextmenu(b.ev(0, 0));
  chk(b.st.menu.length === 0, '날리기 조준 중에는 메뉴를 열지 않는다');
  b.st.flyAim = false;
  b.st.office = true; const rs = b.mkSeat({ remote: true }); charHit(b, rs); b.cl.contextmenu(b.ev(0, 0));
  chk(b.st.menu.length === 0, '회사원 모드 — 남의 좌석 우클릭은 메뉴 없음(토스트도 없음)');
  charHit(b, s); b.cl.contextmenu(b.ev(0, 0));
  chk(b.st.menu.length === 1, '  내 좌석은 막지 않는다');
  b.st.office = false;
  // 끄는 중 우클릭 = 고정
  b.st.menu.length = 0; charHit(b, s); b.cl.pointerdown(b.ev(10, 10)); b.cl.pointermove(b.ev(40, 40));
  chk(b.mod.drag() && b.mod.drag().mode === 'shake' && s.beingShaken === true, '(준비) 캐릭터를 잡고 끌면 흔들기');
  b.cl.contextmenu(b.ev(40, 40));
  chk(b.mod.drag() === null && s.pinned === true && s.beingShaken === false && b.st.menu.length === 0, '끄는 중 우클릭 = 그 자리 고정(pinned) · drag 해제 · 메뉴 없음');
}
say('§3 누르기 · 끌기');
{
  let b = build(SRC); const s = b.mkSeat({ isMe: true }); b.seats.push(s);
  b.cl.pointerdown(b.ev(0, 0, { button: 2 }));
  chk(b.mod.drag() === null && b.st.hots === 0, '왼쪽 버튼이 아니면 무시');
  b.st.flyAim = true; b.cl.pointerdown(b.ev(0, 0));
  chk(b.st.flyAimClick === 1 && b.mod.drag() === null, '날리기 조준 중엔 표적 선택으로 가로챈다');
  b.st.flyAim = false; b.st.bonkAim = true; b.cl.pointerdown(b.ev(0, 0));
  chk(b.st.bonkAimClick === 1 && b.mod.drag() === null, '때리기 조준도 가로챈다');
  b.st.bonkAim = false; b.hitsHolder.hits = []; b.cl.pointerdown(b.ev(0, 0));
  chk(b.mod.drag() === null, '아무것도 안 맞으면 drag 없음');
  const fly = b.mkSeat({ fly: true }); charHit(b, fly); b.cl.pointerdown(b.ev(0, 0));
  chk(b.mod.drag() === null, '나는 중인 좌석은 잡히지 않는다(canGrabSeat)');
  charHit(b, s); b.cl.pointerdown(b.ev(5, 5));
  const d = b.mod.drag();
  chk(!!d && d.seat === s && d.targetType === 'char' && d.moved === false && b.st.selects[0] === s && b.st.hots > 0, '캐릭터를 누르면 drag 시작 · 좌석 고르기 · 비포커스 상한 풀기(_uiHot)');
  b.cl.pointermove(b.ev(8, 8));
  chk(b.mod.drag().moved === false, '6px 안쪽은 아직 누르기');
  b.cl.pointermove(b.ev(40, 5));
  chk(b.mod.drag().moved === true && b.mod.drag().mode === 'shake' && s.beingShaken === true && s._wasShaken === true, '6px 넘으면 캐릭터는 흔들기');
  b.cl.pointerup(b.ev(40, 5));
  chk(b.mod.drag() === null && s.beingShaken === false, '손을 떼면 drag 해제');
  // 책상 → 슬롯 이동
  b = build(SRC, { slotIdx: 1 }); const s1 = b.mkSeat({ isMe: true }), s2 = b.mkSeat({}); b.seats.push(s1, s2);
  const deskObj = { userData: {}, parent: s1.group }; b.hitsHolder.hits = [{ object: deskObj }]; s1.group.userData = { seat: s1 }; deskObj.userData = { seat: s1 };
  b.cl.pointerdown(b.ev(0, 0)); b.cl.pointermove(b.ev(30, 0));
  chk(b.mod.drag().mode === 'slot' && b.seats[1] === s1 && b.st.layouts === 1 && b.st.tabs === 1, '책상을 끌면 슬롯 이동 — 좌석 순서 바꾸기 · 줄 배치 · 좌석 탭');
  // 이름표 끌기 시작
  b = build(SRC); const s3 = b.mkSeat({}); b.seats.push(s3);
  chk(b.mod._beginLabelSlotDrag(b.ev(1, 1), s3) === true && b.mod.drag().targetType === 'label' && b.mod._beginLabelSlotDrag(b.ev(1, 1), s3) === false, '이름표 끌기 시작 — drag 가 이미 있으면 거절');
}
say('§4 쓰다듬기 · 어지러움');
{
  let b = build(SRC); const s = b.mkSeat({ isMe: true, isExtra: false }); b.seats.push(s);
  charHit(b, s); b.cl.pointerdown(b.ev(5, 5)); b.cl.pointerup(b.ev(5, 5));
  chk(b.st.pets.length === 1 && b.st.floaters.filter(e => e === '♥').length === 2 && b.st.clickSnd === 1 && b.st.bubble === 1, '누르기만 하면 쓰다듬기 — 하트 · 클릭음 · 말풍선 숨김');
  chk(b.st.pokeSelf === 1, '  내 좌석은 방에 알린다(Presence.pokeSelf)');
  b.st.t += 100; charHit(b, s); b.cl.pointerdown(b.ev(5, 5)); b.cl.pointerup(b.ev(5, 5));
  chk(b.st.pokeSelf === 1, '  0.5초 안에 다시 누르면 알림은 한 번만(쓰로틀)');
  b = build(SRC); const f = b.mkSeat({ remote: true, friendId: 'F1' }); b.seats.push(f);
  charHit(b, f); b.cl.pointerdown(b.ev(5, 5)); b.cl.pointerup(b.ev(5, 5));
  chk(JSON.stringify(b.st.pokes) === '[["F1","pet"]]', '남의 좌석을 쓰다듬으면 그 사람에게 알림');
  b = build(SRC); const pin = b.mkSeat({ pinned: true }); b.seats.push(pin);
  charHit(b, pin); b.cl.pointerdown(b.ev(5, 5)); b.cl.pointerup(b.ev(5, 5));
  chk(b.st.pets.length === 0 && b.st.clickSnd === 0, '고정된 좌석은 쓰다듬기 · 클릭음 없음');
  // 어지러움 확정
  b = build(SRC); const dz = b.mkSeat({ remote: true, friendId: 'F2' }); b.seats.push(dz);
  charHit(b, dz); b.cl.pointerdown(b.ev(0, 0));
  for(let i = 1; i <= 80; i++){ b.st.t += 5; b.cl.pointermove(b.ev(i % 2 ? 200 : 0, 0)); }
  const dizzy = b.mod.drag().dizzy;
  b.cl.pointerup(b.ev(0, 0));
  chk(dizzy >= 60 && dz.dizzyUntil === b.st.t + 2500 && b.st.floaters.filter(e => e === '💫').length >= 2 && b.st.pokes.some(p => p[1] === 'dizzy'), '빠르게 흔들다 놓으면 어지러움 확정(2.5초) · 남의 좌석이면 알림 · 이모지');
  // 던져도 풀린다
  b = build(SRC, { pokeThrows: true }); const ff = b.mkSeat({ remote: true, friendId: 'F3' }); b.seats.push(ff);
  charHit(b, ff); b.cl.pointerdown(b.ev(5, 5)); let th = false; try{ b.cl.pointerup(b.ev(5, 5)); }catch(_){ th = true; }
  chk(th && b.mod.drag() === null, '★ 서버가 끊겨 알림이 던져도 drag 는 반드시 풀린다(안 풀리면 앱이 유령이 된다)');
}
say('§5 안전망');
{
  let b = build(SRC); const s = b.mkSeat({}); const o = b.mkSeat({ beingShaken: true }); b.seats.push(s, o);
  charHit(b, s); b.cl.pointerdown(b.ev(0, 0)); b.cl.pointermove(b.ev(50, 0));
  b.wl.blur();
  chk(b.mod.drag() === null && s.beingShaken === false && o.beingShaken === false, 'blur — drag · 모든 좌석의 흔들림 해제');
  charHit(b, s); b.cl.pointerdown(b.ev(0, 0)); b.cl.pointercancel(b.ev(0, 0));
  chk(b.mod.drag() === null, 'pointercancel 도 같다');
  b.wl.mousemove({ clientX: 50, clientY: 25 });
  chk(Math.abs(b.mod.mouseNdcX() - 0) < 1e-9 && Math.abs(b.mod.mouseNdcY() - 0.5) < 1e-9, '전역 마우스 NDC(가운데 0 · 위쪽 +)');
  b.wl.mousemove({ clientX: 100, clientY: 0 });
  chk(b.mod.mouseNdcX() === 1 && b.mod.mouseNdcY() === 1, '  오른쪽 위 모서리 = (1, 1)');
}
say('§6 연결');
{
  const iP = HTML.indexOf('<script src="parts/room/seat-pointer.js"></script>'), iA = HTML.indexOf('<script src="parts/app.js"></script>');
  chk(iP > 0 && iA > iP, 'html — seat-pointer.js 를 app.js 보다 먼저 싣는다');
  const code = APP.replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/(^|[^:'"\\])\/\/[^\n]*/g, '$1 ');
  chk(/const seatPointerMod = TwSeatPointer\.createSeatPointer\(\{[\s\S]*?triggerPet: triggerPet,\s*\}\);/.test(code), 'app.js — 만든다');
  chk(['ray', 'ndc', 'seatFromObject'].every(n => new RegExp('^const ' + n + ' = seatPointerMod\\.' + n + ';', 'm').test(code)), '  옛 이름 셋을 const 로 받는다');
  chk(!/function (classifyHit|worldX|seatFromObject|clearDragStuck|_beginLabelSlotDrag)\b|\blet (drag|mouseNdcX|mouseNdcY)\b|canvas\.addEventListener\('(pointerdown|pointermove|pointerup|contextmenu)'/.test(code), '  app.js 에 본문 · 다시 대입되던 let · 캔버스 듣기가 안 남음');
  chk(!/(?<![\w$.'"])drag(?![\w$'":])/.test(code.replace(/seatPointerMod\.drag\(\)/g, '')), '  끄는 중 상태는 어디서나 seatPointerMod.drag() 로 읽는다');
  chk(/beginDrag: seatPointerMod\._beginLabelSlotDrag,/.test(code), '  이름표 끌기가 이 모듈의 시작 함수를 쓴다');
}
say('§7 일부러 깨 보기');
{
  const brk = (from, to) => { const m = SRC.replace(from, to); return m === SRC ? null : m; };
  const m1 = brk("seat.pinned=true;", '');
  chk(!!m1 && (() => { const b = build(m1); const s = b.mkSeat({}); b.seats.push(s); charHit(b, s); b.cl.pointerdown(b.ev(0, 0)); b.cl.pointermove(b.ev(50, 0)); b.cl.contextmenu(b.ev(0, 0)); return s.pinned !== true; })(), '우클릭 고정을 빼면 빨강');
  const m3 = brk("  drag=null;\n }finally{\n  /* ★ 위에서 무엇이 던지든 여기는 반드시 지난다. drag 가 남으면 앱이 유령이 된다(위 주석). */\n  drag=null;\n }", "  drag=null;\n }finally{\n }");
  chk(!!m3 && (() => { const b = build(m3, { pokeThrows: true }); const f = b.mkSeat({ remote: true, friendId: 'F' }); b.seats.push(f); charHit(b, f); b.cl.pointerdown(b.ev(5, 5)); try{ b.cl.pointerup(b.ev(5, 5)); }catch(_){} return b.mod.drag() !== null; })(), 'finally 의 drag 해제를 빼면 빨강');
  const m4 = brk("if(Math.hypot(dx,dy) > 6){", "if(Math.hypot(dx,dy) > 0){");
  chk(!!m4 && (() => { const b = build(m4); const s = b.mkSeat({}); b.seats.push(s); charHit(b, s); b.cl.pointerdown(b.ev(0, 0)); b.cl.pointermove(b.ev(2, 0)); return b.mod.drag().moved === true; })(), '6px 문턱을 없애면 빨강');
  const m5 = brk("window.addEventListener('blur', clearDragStuck);", '');
  chk(!!m5 && build(m5).wl.blur === undefined, 'blur 안전망을 빼면 빨강');
  const m6 = brk("if(!TwSeatLabelDrag.canGrabSeat(seat)) return;", '');
  chk(!!m6 && (() => { const b = build(m6); const f = b.mkSeat({ fly: true }); b.seats.push(f); charHit(b, f); b.cl.pointerdown(b.ev(0, 0)); return b.mod.drag() !== null; })(), 'canGrabSeat 판단을 빼면 빨강');
  const m7 = brk("if(officeMode() && seat.remote) return;", '');
  chk(!!m7 && (() => { const b = build(m7, { office: true }); const r = b.mkSeat({ remote: true }); b.seats.push(r); charHit(b, r); b.cl.contextmenu(b.ev(0, 0)); return b.st.menu.length === 1; })(), '회사원 모드 우클릭 잠금을 빼면 빨강');
  const m8 = brk("if(!seat.pinned){   // 액자 고정 캐릭터는 pet도 무시", "if(true){   // 액자 고정 캐릭터는 pet도 무시");
  chk(!!m8 && (() => { const b = build(m8); const p = b.mkSeat({ pinned: true }); b.seats.push(p); charHit(b, p); b.cl.pointerdown(b.ev(5, 5)); b.cl.pointerup(b.ev(5, 5)); return b.st.pets.length === 1; })(), '고정 좌석 쓰다듬기 제외를 빼면 빨강');
}
say('');
say((fail ? '✗' : '✓') + ' 통과 ' + pass + ' · 실패 ' + fail);
process.exit(fail ? 1 : 0);
