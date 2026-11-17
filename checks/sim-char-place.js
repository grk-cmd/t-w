/* ═══ 🧍 sim-char-place.js — 캐릭터 높이 · 깊이 · 자리 · 크기 저장 · 끌기 한계 · 책상 반폭(room/char-place.js · app.js 분리 M7) ═══════════════
   [왜] app.js 의 «캐릭터가 화면 어디에 얼마나 크게 서는가» 를 모듈로 옮겼다. 동작은 그대로여야 한다.
   ・1절: 높이 · 깊이 — clampCharY 표(0 · 음수 · 문자 · NaN · 상한 · 무한) · seatCharZ · 상수
   ・2절: 저장 · 복원 — 처음 값 · 저장된 위치 · 깨진 값 · 크기 맵(id → 지문 → default · 옛 숫자 하나 형식) · saveCharPos · saveCharScale(세 곳에 같이)
   ・3절: 모니터 바뀜 — refreshCharScaleForCurrentDisplay(id · 지문으로 크기 복원 · 줄 배치 알림 · 슬라이더 · 저장 · 실패 길)
   ・4절: 끌기 한계 clampDeskPan — 폴백 여백(0.02) 범위 표 · 세로 모니터 · 동물 여유 · 실측 여백이 있으면 그 값
   ・5절: 책상 반폭 seatDeskHalfWidth — 책상 없음 · 빈 책상 · 치우친 책상 · 책상 위 아이템 · 숨은 것 · 줌 상한
   ・6절: 다시 대입되는 값 읽기 · 쓰기 · attach
   ・7절: 연결 — html · 만드는 줄 · 옛 이름 · app.js 에 해당 코드가 안 남음
   ・8절: 일부러 깨 보기
   [실행] 러너 스테이징 또는 저장소 루트에서. three 는 vendor/three/three.min.js. */
'use strict';
/* 모듈이 저장을 shared/ls-set.js(TwLsSet — JSON 칸은 json-store 를 거친다)로 한다 — 이 검사의 저장소 위에 하나 만든다(안내는 받지 않음) */
const lsSetOn = (ls) => { const src = ['ls-set.js', 'app/parts/shared/ls-set.js'].map((f) => { try{ return require('fs').readFileSync(f, 'utf8'); }catch(_){ return null; } }).find(Boolean); const js = ['json-store.js', 'app/parts/shared/json-store.js'].map((f) => { try{ return require('fs').readFileSync(f, 'utf8'); }catch(_){ return null; } }).find(Boolean); const jm = { exports: {} }; new Function('window', 'module', js)(undefined, jm); const st = jm.exports.createJsonStore({ storage: () => ls }); const w = { TwErrorCodes: { notify(){ return true; } }, TwJsonStore: Object.assign({}, jm.exports, { load: st.load, save: st.save }) }; new Function('window', 'localStorage', 'console', 'module', src)(w, ls, { warn(){} }, undefined); return w.TwLsSet; };
const fs = require('fs');
const path = require('path');
let pass = 0, fail = 0;
const say = (s) => console.log(s);
const chk = (ok, msg) => { ok ? pass++ : fail++; say('  ' + (ok ? '✓' : '✗') + ' ' + msg); };
const read = (f) => { for(const c of [f, 'parts/' + f, 'app/parts/' + f, 'app/' + f, f.split('/').pop()]) if(fs.existsSync(c)) return fs.readFileSync(c, 'utf8'); return null; };
const SRC = read('room/char-place.js'), BM = read('character/body-measure.js'), APP = read('app.js'), HTML = read('desk-companion-prototype.html');
if(!SRC || !BM || !APP || !HTML){ say('  ? 원본 못 찾음 — char-place.js · body-measure.js · app.js · html'); process.exit(2); }
const threePath = ['vendor/three/three.min.js', 'app/vendor/three/three.min.js', 'three.min.js'].find(p => fs.existsSync(p));
if(!threePath){ say('  ? 원본 못 찾음 — three.min.js'); process.exit(2); }
const THREE = require(path.resolve(threePath));
const near = (a, b) => Math.abs(a - b) < 1e-6;
const bw = {}; new Function('THREE', 'window', 'module', BM)(THREE, bw, undefined);
const BMOD = bw.TwBodyMeasure.createBodyMeasure({});

function build(src, o){
  o = o || {};
  const store = Object.assign({}, o.store || {});
  const localStorage = { getItem: (k) => { if(o.storeThrows) throw new Error('x'); return k in store ? store[k] : null; }, setItem: (k, v) => { if(o.storeThrows) throw new Error('x'); store[k] = String(v); } };
  const calls = { layout: 0, slider: null };
  const win = {};
  const sliderEl = { value: '' };
  const document = { getElementById: (id) => (id === 'fsSizeSlider' ? sliderEl : null) };
  const companion = o.noCompanion ? undefined : { getDisplays: async () => { if(o.displaysThrow) throw new Error('x'); return o.displays || []; } };
  win.companion = companion;
  const seats = o.seats || [];
  const camera = new THREE.PerspectiveCamera(34, 1, 0.1, 100); camera.position.set(0, 1, 6); camera.lookAt(0, 0.7, 0); camera.updateMatrixWorld(true); camera.updateProjectionMatrix();
  const names = ['THREE', 'localStorage', 'document', 'window', 'companion', 'innerWidth', 'innerHeight', 'module', 'TwLsSet'];
  const extra = o.cvEl ? { _cvEl: o.cvEl } : {};
  const fn = new Function(...names, ...Object.keys(extra), src);
  fn(THREE, localStorage, document, win, companion, o.iw || 1920, o.ih || 1080, undefined, lsSetOn(localStorage), ...Object.values(extra));
  const mod = win.TwCharPlace.createCharPlace({ camera, bodyMeasureMod: BMOD, seats: () => seats });
  mod.attachLayout({ layoutSeats: () => calls.layout++ });
  return { mod, store, calls, sliderEl, win, seats };
}

say('§1 높이 · 깊이');
{
  const { mod } = build(SRC);
  chk(mod.CHAR_Z === -0.47 && mod.CHAR_Y_MAX === 0.6 && mod.BASE_PXW === 190 && mod.ANIMAL_RUN_SCALE === 0.4, '상수 — CHAR_Z -0.47 · 높이 상한 0.6 · 월드 1단위 190px · 동물 크기 0.4');
  const t = [[0, 0], [-1, 0], ['0.3', 0.3], [NaN, 0], ['abc', 0], [0.6, 0.6], [5, 0.6], [Infinity, 0], [0.2, 0.2], [null, 0], [undefined, 0]];
  chk(t.every(([i, o]) => near(mod.clampCharY(i), o)), 'clampCharY — 0 · 음수 · NaN · 문자 · 무한은 0 / 0 초과는 상한 0.6 까지');
  chk(mod.seatCharZ({}) === -0.47 && mod.seatCharZ() === -0.47, 'seatCharZ — 좌석이 무엇이든 CHAR_Z 하나');
}
say('§2 저장 · 복원');
{
  let b = build(SRC);
  chk(b.mod.deskPanX() === 0 && b.mod.deskPanY() === 0 && b.mod.focusCharScale() === 1, '저장값이 없으면 위치 (0, 0) · 크기 1');
  b = build(SRC, { store: { 'tw.deskPan': '{"x":0.1,"y":-0.2}' } });
  chk(b.mod.deskPanX() === 0.1 && b.mod.deskPanY() === -0.2, '저장된 위치를 복원');
  for(const bad of ['{"x":"a","y":1}', 'oops', '[]', '{"x":1}']){ b = build(SRC, { store: { 'tw.deskPan': bad } }); if(!(b.mod.deskPanX() === 0 && b.mod.deskPanY() === 0)) chk(false, '깨진 위치 값 ' + bad); }
  chk(true, '깨진 위치 값(숫자 아님 · JSON 아님 · 배열 · y 없음)은 (0, 0)');
  b = build(SRC, { store: { 'tw.focusCharScale': '{"default":0.7}' } });
  chk(b.mod.focusCharScale() === 0.7, '크기 맵의 default 를 처음 값으로');
  b = build(SRC, { store: { 'tw.focusCharScale': '0.55' } });
  chk(b.mod.focusCharScale() === 0.55, '옛 형식(숫자 하나)은 default 로 이어받는다');
  for(const bad of ['{"default":-1}', '{"default":"x"}', '0', '-3', 'abc']){ b = build(SRC, { store: { 'tw.focusCharScale': bad } }); if(b.mod.focusCharScale() !== 1) chk(false, '깨진 크기 값 ' + bad); }
  chk(true, '깨진 크기 값(음수 · 문자 · 0)은 기본 1');
  b = build(SRC, { storeThrows: true });
  chk(b.mod.deskPanX() === 0 && b.mod.focusCharScale() === 1, '저장소를 못 읽어도 처음 값으로 계속');
  b = build(SRC); b.mod.setDeskPanX(0.3); b.mod.setDeskPanY(-0.4); b.mod.saveCharPos();
  chk(JSON.parse(b.store['tw.deskPan']).x === 0.3 && JSON.parse(b.store['tw.deskPan']).y === -0.4, 'saveCharPos — 지금 위치를 {x, y} 로');
  b = build(SRC, { storeThrows: true }); let th = false; try{ b.mod.saveCharPos(); b.mod.saveCharScale(); }catch(_){ th = true; }
  chk(!th, '쓰기 오류는 삼킨다');
  b = build(SRC); b.mod.setFocusCharScale(0.8); b.mod.saveCharScale();
  chk(JSON.parse(b.store['tw.focusCharScale']).default === 0.8, 'saveCharScale — 모니터를 아직 모르면 default 만');
}
say('§3 모니터 바뀜');
(async () => {
  const disp = (id, w, h, cur) => ({ id, isCurrent: cur, bounds: { width: w, height: h } });
  let b = build(SRC, { displays: [disp(7, 2560, 1440, true), disp(8, 1920, 1080, false)], store: { 'tw.focusCharScale': '{"7":0.5,"default":1}' } });
  await b.mod.refreshCharScaleForCurrentDisplay();
  chk(b.mod.focusCharScale() === 0.5 && b.calls.layout === 1 && b.sliderEl.value === '0.5', '이 모니터(id 7) 크기 0.5 를 복원 · 줄 배치 알림 · 슬라이더 값');
  const m = JSON.parse(b.store['tw.focusCharScale']);
  chk(m['7'] === 0.5 && m['sig:2560x1440'] === 0.5 && m.default === 0.5, '  저장은 id · 해상도 지문 · default 세 곳에 같이');
  b = build(SRC, { displays: [disp(99, 2560, 1440, true)], store: { 'tw.focusCharScale': '{"7":0.5,"sig:2560x1440":0.6,"default":1}' } });
  await b.mod.refreshCharScaleForCurrentDisplay();
  chk(b.mod.focusCharScale() === 0.6, 'id 가 바뀌었어도(99) 해상도 지문으로 찾는다');
  b = build(SRC, { displays: [disp(99, 1000, 700, true)], store: { 'tw.focusCharScale': '{"default":0.9}' } });
  await b.mod.refreshCharScaleForCurrentDisplay();
  chk(b.mod.focusCharScale() === 0.9 && b.calls.layout === 0 && JSON.parse(b.store['tw.focusCharScale'])['99'] === 0.9, '둘 다 빗나가면 default · 값이 그대로면 줄 배치를 다시 안 한다 · 그래도 새 열쇠로 채운다');
  b = build(SRC, { displays: [disp(1, 800, 600, false)] }); await b.mod.refreshCharScaleForCurrentDisplay();
  chk(b.calls.layout === 0 && !b.store['tw.focusCharScale'], '현재 모니터를 못 찾으면 아무것도 안 한다');
  b = build(SRC, { noCompanion: true }); let th = false; try{ await b.mod.refreshCharScaleForCurrentDisplay(); }catch(_){ th = true; }
  chk(!th, '데스크톱 연결이 없으면(브라우저 미리보기 · 검사) 조용히 지나간다');
  b = build(SRC, { displaysThrow: true }); th = false; try{ await b.mod.refreshCharScaleForCurrentDisplay(); }catch(_){ th = true; }
  chk(!th, '모니터 목록을 못 받아도 던지지 않는다');
  b = build(SRC, { displays: [{ id: 5, isCurrent: true, bounds: { width: NaN, height: 1 } }], store: { 'tw.focusCharScale': '{"5":0.4}' } }); await b.mod.refreshCharScaleForCurrentDisplay();
  chk(b.mod.focusCharScale() === 0.4 && !Object.keys(JSON.parse(b.store['tw.focusCharScale'])).some(k => k.startsWith('sig:')), '해상도를 못 재면 지문 열쇠는 안 쓴다');

  say('§4 끌기 한계 clampDeskPan');
  b = build(SRC, { seats: [{ isMe: true }] });
  const c = (x, y) => b.mod.clampDeskPan(x, y);
  chk(near(c(0, 0).x, 0) && near(c(0, 0).y, 0), '범위 안은 그대로');
  chk(near(c(-5, 0).x, -0.14) && near(c(5, 0).x, 0.82), '가로 한계 -0.14 ~ 0.82(폴백 여백 0.02 · 기본 오프셋 -0.34)');
  chk(near(c(0, -5).y, -0.81) && near(c(0, 5).y, 0.15), '세로 한계 -0.81(위) ~ 0.15(아래)');
  const p = build(SRC, { seats: [{ isMe: true }], iw: 1000, ih: 1600 });
  chk(near(p.mod.clampDeskPan(0, -5).y, -1.06) && near(p.mod.clampDeskPan(0, 5).y, 0.4), '세로 모니터는 위아래 범위를 0.25 씩 넓힌다');
  const many = build(SRC, { seats: [{ isMe: true }, {}, {}, {}] });
  chk(near(many.mod.clampDeskPan(-5, 0).x, -0.14), '인원이 늘어도 여백은 혼자와 같다');
  const animal = build(SRC, { seats: [{ isMe: true, charDef: { animal: true } }] });
  chk(near(animal.mod.clampDeskPan(-5, 5).x, -0.14) && near(animal.mod.clampDeskPan(-5, 5).y, 0.15), '동물 여유 배수가 0 이므로 사람과 같다');
  const grp = new THREE.Group(); const mesh = new THREE.Mesh(new THREE.BoxGeometry(1, 1.4, 0.5)); mesh.position.y = 0.7; grp.add(mesh);
  const me = { isMe: true, group: grp }; grp.updateMatrixWorld(true);
  const measured = build(SRC, { seats: [me], cvEl: { getBoundingClientRect: () => ({ width: 1000, height: 800 }) } });
  const lim = measured.mod.clampDeskPan(-5, 5);
  chk(lim.x > -0.14 && lim.x < 0.0 && lim.y < 0.15 && lim.y > -0.2, '실측 여백이 있으면(캐릭터가 화면에서 차지하는 만큼) 폴백보다 범위가 좁다');
  const noRect = build(SRC, { seats: [me], cvEl: { getBoundingClientRect: () => ({ width: 0, height: 0 }) } });
  chk(near(noRect.mod.clampDeskPan(-5, 0).x, -0.14), '캔버스 크기가 0 이면 폴백');

  say('§5 책상 반폭 seatDeskHalfWidth');
  const mk = (w, x, extra) => { const grp2 = new THREE.Group(); grp2.position.x = x || 0; const desk = new THREE.Group(); grp2.add(desk); const m2 = new THREE.Mesh(new THREE.BoxGeometry(w, 0.1, 0.5)); desk.add(m2); (extra || []).forEach(e => desk.add(e)); const sc = new THREE.Group(); sc.add(grp2); sc.updateMatrixWorld(true); return { group: grp2, desk, m2 }; };
  const sd = b.mod.seatDeskHalfWidth;
  chk(sd(null) === 0.85 && sd({}) === 0.85, '좌석 · 책상이 없으면 기본 책상 반폭 0.85');
  chk(near(sd(mk(1.7)), 0.85), '1.7 폭 책상 → 0.85');
  chk(near(sd(mk(3)), 1.5) && near(sd(mk(0.1)), 0.15), '큰 책상은 그만큼 · 아주 작으면 하한 0.15');
  const wide = mk(3);
  chk(near(sd(wide, true), 1.1) && near(sd(mk(1), true), 0.5), '줌 계산용(forZoom)은 상한 1.1');
  const off = mk(1.7); off.m2.position.x = 1; off.desk.updateMatrixWorld(true);
  chk(near(sd(off), 1.85), '책상이 좌석 중심에서 치우치면 가장 멀리 뻗은 쪽까지(1 + 0.85)');
  const anchor = new THREE.Group(); anchor.name = 'deskAnchor'; const big = new THREE.Mesh(new THREE.BoxGeometry(9, 1, 1)); anchor.add(big);
  const withItem = mk(1.7, 0, [anchor]);
  chk(near(sd(withItem), 0.85), '책상 위 아이템(deskAnchor)은 폭 계산에서 뺀다');
  const hid = new THREE.Mesh(new THREE.BoxGeometry(9, 1, 1)); hid.visible = false;
  chk(near(sd(mk(1.7, 0, [hid])), 0.85), '숨은 자식은 뺀다');
  const emptySeat = { group: new THREE.Group(), desk: new THREE.Group() };
  chk(sd(emptySeat) === 0.85, '잴 것이 없으면 0.85');
  const moved = mk(1.7, -3.5); moved.group.updateMatrixWorld(true);
  chk(near(sd(moved), 0.85), '좌석이 월드 어디에 있어도 같은 반폭(가장 먼 쪽 = 좌석 중심 기준)');

  say('§6 읽기 · 쓰기 · attach');
  b = build(SRC);
  b.mod.setSizeFactor(1.5); b.mod.setCachedRowCenter(2); b.mod.setCachedRowSpan(3); b.mod.setFocusCharScale(0.4);
  chk(b.mod.sizeFactor() === 1.5 && b.mod._cachedRowCenter() === 2 && b.mod._cachedRowSpan() === 3 && b.mod.focusCharScale() === 0.4, '다시 대입되는 값의 읽기 · 쓰기 함수');
  chk(build(SRC).mod.sizeFactor() === 1 && build(SRC).mod._cachedRowCenter() === 0 && build(SRC).mod._cachedRowSpan() === 1.2, '처음 값 — 배율 1 · 줄 중심 0 · 줄 폭 1.2');
  const bw2 = build(SRC);
  chk(bw2.win.ANIMAL_RUN_SCALE === undefined, '모듈은 window 에 ANIMAL_RUN_SCALE 을 걸지 않는다(그 고리는 app.js 몫 — 도메인 순환 막기)');

  say('§7 연결');
  const iC = HTML.indexOf('<script src="parts/room/char-place.js"></script>'), iA = HTML.indexOf('<script src="parts/app.js"></script>');
  chk(iC > 0 && iA > iC, 'html — char-place.js 를 app.js 보다 먼저 싣는다');
  const code = APP.replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/(^|[^:'"\\])\/\/[^\n]*/g, '$1 ');
  chk(/const charPlaceMod = TwCharPlace\.createCharPlace\(\{[\s\S]*?seats: \(\)=>seats,[\s\S]*?\}\);\s*charPlaceMod\.attachLayout\(\{\s*layoutSeats: \(\)=>layoutSeats\(\),\s*\}\);/.test(code), 'app.js — seats 는 읽는 함수 · 줄 배치는 attach 알림(layoutSeats 는 뒤에서 정의돼 부를 때 찾는다)');
  const names = ['CHAR_Z', 'CHAR_Y_MAX', 'clampCharY', 'seatCharZ', 'BASE_PXW', 'ANIMAL_RUN_SCALE', 'saveCharPos', 'saveCharScale', 'refreshCharScaleForCurrentDisplay', 'clampDeskPan', 'seatDeskHalfWidth'];
  chk(names.every(n => new RegExp('^const ' + n + ' = charPlaceMod\\.' + n + ';', 'm').test(code)), '  옛 이름 열하나를 const 로 받는다');
  chk(/window\.ANIMAL_RUN_SCALE = ANIMAL_RUN_SCALE/.test(code), '  animal.js 가 읽는 window.ANIMAL_RUN_SCALE 은 app.js 가 건다');
  chk(!/\blet (sizeFactor|deskPanX|deskPanY|focusCharScale|_cachedRowCenter|_charScaleMap)\b|function (clampCharY|seatCharZ|clampDeskPan|seatDeskHalfWidth|saveCharPos|saveCharScale|_loadCharScale)\b/.test(code), '  app.js 에 해당 코드 · 다시 대입되는 let 이 남아 있지 않다');
  chk(!/(?<![\w$.])(sizeFactor|deskPanX|deskPanY|focusCharScale|_cachedRowCenter|_cachedRowSpan)(?![\w$:])/.test(code.replace(/charPlaceMod\.\w+/g, '')), '  그 값들은 어디서나 charPlaceMod 로 읽고 쓴다');

  say('§8 일부러 깨 보기');
  const brk = (from, to) => { const m = SRC.replace(from, to); return m === SRC ? null : m; };
  const m1 = brk('return (isFinite(n) && n > 0) ? Math.min(n, CHAR_Y_MAX) : 0;', 'return n;');
  chk(!!m1 && build(m1).mod.clampCharY(9) !== 0.6, 'clampCharY 상한을 빼면 빨강');
  const m2 = brk('const PAN_MARGIN_FALLBACK = 0.02;', 'const PAN_MARGIN_FALLBACK = 0.1;');
  chk(!!m2 && !near(build(m2, { seats: [{ isMe: true }] }).mod.clampDeskPan(-5, 0).x, -0.14), '폴백 여백을 바꾸면 빨강');
  const m3 = brk('_charScaleMap.default = val;', '');
  chk(!!m3 && (() => { const x = build(m3); x.mod.saveCharScale(); return !('default' in (JSON.parse(x.store['tw.focusCharScale'] || '{}'))); })(), 'default 열쇠를 안 쓰면 빨강');
  const m4 = brk("if(ch.name==='deskAnchor' || ch.visible===false) return;", '');
  chk(!!m4 && (() => { const x = build(m4); const a2 = new THREE.Group(); a2.name = 'deskAnchor'; a2.add(new THREE.Mesh(new THREE.BoxGeometry(9, 1, 1))); const s2 = mk(1.7, 0, [a2]); return !near(x.mod.seatDeskHalfWidth(s2), 0.85); })(), '책상 위 아이템을 반폭에 넣으면 빨강');
  const m5 = brk('return forZoom ? Math.min(half, DESK_HALFWIDTH_CAP_FOR_ZOOM) : half;', 'return half;');
  chk(!!m5 && !near(build(m5).mod.seatDeskHalfWidth(mk(3), true), 1.1), '줌 상한을 빼면 빨강');
  const m6 = brk('placeHooks.layoutSeats();   // 즉시 화면에 반영', '');
  chk(!!m6 && await (async () => { const x = build(m6, { displays: [disp(7, 10, 10, true)], store: { 'tw.focusCharScale': '{"7":0.5}' } }); await x.mod.refreshCharScaleForCurrentDisplay(); return x.calls.layout === 0; })(), '크기를 복원하고도 줄 배치 알림을 안 하면 빨강');
  const m7 = brk('const yExtra = isPortrait ? 0.25 : 0;', 'const yExtra = 0;');
  chk(!!m7 && !near(build(m7, { seats: [{ isMe: true }], iw: 1000, ih: 1600 }).mod.clampDeskPan(0, -5).y, -1.06), '세로 모니터 여유를 빼면 빨강');
  say('');
  say((fail ? '✗' : '✓') + ' 통과 ' + pass + ' · 실패 ' + fail);
  process.exit(fail ? 1 : 0);
})();
