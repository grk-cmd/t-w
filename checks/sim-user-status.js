/* ═══ 🫧 sim-user-status.js — 활동 상태 · 내 칩 · 커스텀 상태 · 좌석 xf 저장(status/user-status.js · app.js 분리 M9) ═══════════════
   [왜] app.js USER STATUS 구역 · 좌석 xf 저장을 모듈로 옮겼다. 동작은 그대로여야 한다.
   ・1절: 상태 바꾸기 — setUserStatus(표에 있는 값 · 없는 값 · 비움) · 저장 · 방 알림 · 칩 다시 그리기 · 불러오기(loadUserStatusFromStorage — 저장소 오류 · 모르는 값)
   ・2절: 상태 풀이 statusConfFor — 상태 없음(오늘 기록 전시는 내 좌석만) · 표에 없는 값 · 커스텀(내 것 · 친구 것 · 문구 없음 · 이모지 비움)
   ・3절: 커스텀 저장 saveCustomStatusConf — 이모지 2자 · 문구 최대 길이 · 저장 · 방 알림 · 메뉴 갱신
   ・4절: 칩 · 메뉴 — refreshMyStatusUI(칩 없음 · 상태 있음 · 없음 · 활성 표시) · refreshCustomStatusMenuItem(프리미엄 아니면 숨김 · 문구 · 표식) · _premiumOn(TDZ 로 던져도 false)
   ・5절: saveSeatXf — 크기 · 높이(상한) · 방향을 def.xf 와 슬롯에 저장
   ・6절: 연결 — html · 만드는 줄 · 알림 걸기 · 옛 이름 · window.setUserStatus 고리(presence.js 가 부름) · app.js 에 해당 코드가 안 남음
   ・7절: 일부러 깨 보기
   [실행] 러너 스테이징 또는 저장소 루트에서. */
'use strict';
/* 모듈이 저장을 shared/ls-set.js(TwLsSet — JSON 칸은 json-store 를 거친다)로 한다 — 이 검사의 저장소 위에 하나 만든다(안내는 받지 않음) */
const lsSetOn = (ls) => { const src = ['ls-set.js', 'app/parts/shared/ls-set.js'].map((f) => { try{ return require('fs').readFileSync(f, 'utf8'); }catch(_){ return null; } }).find(Boolean); const js = ['json-store.js', 'app/parts/shared/json-store.js'].map((f) => { try{ return require('fs').readFileSync(f, 'utf8'); }catch(_){ return null; } }).find(Boolean); const jm = { exports: {} }; new Function('window', 'module', js)(undefined, jm); const st = jm.exports.createJsonStore({ storage: () => ls }); const w = { TwErrorCodes: { notify(){ return true; } }, TwJsonStore: Object.assign({}, jm.exports, { load: st.load, save: st.save }) }; new Function('window', 'localStorage', 'console', 'module', src)(w, ls, { warn(){} }, undefined); return w.TwLsSet; };
const fs = require('fs');
let pass = 0, fail = 0;
const say = (s) => console.log(s);
const chk = (ok, msg) => { ok ? pass++ : fail++; say('  ' + (ok ? '✓' : '✗') + ' ' + msg); };
const read = (f) => { for(const c of [f, 'parts/' + f, 'app/parts/' + f, 'app/' + f, f.split('/').pop()]) if(fs.existsSync(c)) return fs.readFileSync(c, 'utf8'); return null; };
const SRC = read('status/user-status.js'), APP = read('app.js'), HTML = read('desk-companion-prototype.html');
if(!SRC || !APP || !HTML){ say('  ? 원본 못 찾음 — user-status.js · app.js · desk-companion-prototype.html'); process.exit(2); }

function el(){ const e = { style: {}, title: '', textContent: '', classes: new Set(), dataset: {}, children: {}, classList: { toggle: (c, on) => { on ? e.classes.add(c) : e.classes.delete(c); }, add: (c) => e.classes.add(c) }, querySelector: (q) => e.children[q] || null }; return e; }
function build(src, o){
  o = o || {};
  const store = Object.assign({}, o.store || {}); const writes = [];
  const localStorage = { getItem: (k) => { if(o.storeThrows) throw new Error('x'); return k in store ? store[k] : null; }, setItem: (k, v) => { if(o.storeThrows) throw new Error('x'); store[k] = String(v); writes.push(k); } };
  const els = { myStatusChipBtn: el(), myStatusDot: el(), myCustomStatusBtn: el() };
  if(o.noChip) delete els.myStatusChipBtn;
  if(o.noCustomBtn) delete els.myCustomStatusBtn;
  els.myCustomStatusBtn && (els.myCustomStatusBtn.children['.csEmo'] = el(), els.myCustomStatusBtn.children['.csLabel'] = el());
  const items = ['', 'meal', 'custom'].map(st => { const b = el(); b.dataset.st = st; return b; });
  const document = { getElementById: (id) => els[id] || null, querySelectorAll: (q) => (q.includes('.stItem[data-st]') ? items : []) };
  let conf = o.conf || { emo: '', text: '' };
  const table = {
    USER_STATUSES: { meal: { emo: '🍚', label: '밥', dot: '#e0a050' }, away: { emo: '🫧', label: '자리비움', dot: '#aaa' }, custom: { emo: '', label: '', dot: '#77f' } },
    CUSTOM_STATUS_KEY: 'tw.customStatus', CUSTOM_STATUS_MAXLEN: 5,
    customStatusConf: () => conf, setCustomStatusConf: (c) => { conf = c; },
  };
  const log = { hooks: [], saves: 0, pres: [] };
  const state = { premium: !!o.premium, premiumThrows: !!o.premiumThrows, slots: [], mine: o.mine || null };
  const win = {};
  const names = ['document', 'localStorage', 'TwSafeHtml', 'window', 'module', 'TwLsSet'];
  new Function(...names, src)(document, localStorage, { cssColor: (c) => 'css:' + c }, win, undefined, lsSetOn(localStorage));
  const mod = win.TwUserStatus.createUserStatus({
    clampCharY: (v) => Math.max(0, Math.min(0.6, +v || 0)),
    findMySeat: () => state.mine,
    isPremium: () => { if(state.premiumThrows) throw new ReferenceError('tdz'); return state.premium; },
    slots: () => state.slots, userStatusTableMod: table,
  });
  if(!o.noAttach) mod.attachStatusHooks({
    focusShowMine: () => (o.focusShow === undefined ? null : o.focusShow), hexToRgba: (c, a) => 'rgba(' + c + ',' + a + ')',
    saveSlots: () => log.saves++, setCustomStatus: (c) => log.pres.push(['custom', c]), setUserStatus: (v) => log.pres.push(['status', v]),
  });
  return { mod, store, writes, els, items, log, state, table, getConf: () => conf, win };
}

say('§1 상태 바꾸기');
{
  const b = build(SRC);
  chk(b.mod.userStatus() === null, '처음엔 상태 없음');
  b.mod.setUserStatus('meal');
  chk(b.mod.userStatus() === 'meal' && b.store['tw.userStatus'] === 'meal', '표에 있는 값 — 바꾸고 저장(tw.userStatus)');
  chk(JSON.stringify(b.log.pres) === '[["status","meal"]]', '  방에 알린다(Presence)');
  chk(b.els.myStatusChipBtn.title.includes('밥') && b.items.find(i => i.dataset.st === 'meal').classes.has('active'), '  칩 · 메뉴를 다시 그린다');
  b.mod.setUserStatus('nope');
  chk(b.mod.userStatus() === null && b.store['tw.userStatus'] === '' && b.log.pres[1][1] === null, '표에 없는 값은 상태 없음(null)으로 · 저장은 빈 글');
  b.mod.setUserStatus('away'); b.mod.setUserStatus(null);
  chk(b.mod.userStatus() === null && b.items.find(i => i.dataset.st === '').classes.has('active'), '비우면 «온라인» 항목이 활성');
  const t = build(SRC, { storeThrows: true }); let th = false; try{ t.mod.setUserStatus('meal'); }catch(_){ th = true; }
  chk(!th && t.mod.userStatus() === 'meal', '저장소를 못 써도 상태는 바뀐다');
  let l = build(SRC, { store: { 'tw.userStatus': 'away' } }); l.mod.loadUserStatusFromStorage();
  chk(l.mod.userStatus() === 'away' && l.log.pres.length === 0, '불러오기 — 저장된 값을 쓰되 방에는 알리지 않는다');
  l = build(SRC, { store: { 'tw.userStatus': 'ghost' } }); l.mod.loadUserStatusFromStorage();
  chk(l.mod.userStatus() === null, '모르는 값은 무시');
  l = build(SRC, { storeThrows: true }); th = false; try{ l.mod.loadUserStatusFromStorage(); }catch(_){ th = true; }
  chk(!th && l.mod.userStatus() === null, '저장소 오류는 삼킨다');
  const na = build(SRC, { noAttach: true }); th = false; try{ na.mod.setUserStatus('meal'); }catch(_){ th = true; }
  chk(th, 'attachStatusHooks 전에 바꾸면 던진다(조용히 방 알림을 건너뛰지 않는다)');
}
say('§2 상태 풀이 statusConfFor');
{
  const me = { isMe: true }; let b = build(SRC, { mine: me });
  chk(b.mod.statusConfFor(me, null) === null && b.mod.statusConfFor(null, undefined) === null, '상태가 없고 오늘 기록 전시도 없으면 null');
  b = build(SRC, { mine: me, focusShow: { emo: '📊', text: '오늘 2시간' } });
  const c = b.mod.statusConfFor(me, null);
  chk(c && c.label === '오늘 2시간' && c.emo === '📊' && c.dot === '#77f', '상태가 없으면 내 좌석에만 오늘 기록 전시(커스텀 틀에 얹는다)');
  chk(b.mod.statusConfFor({ remote: true }, null) === null && b.mod.statusConfFor({}, null) === null, '  남의 좌석 · 내 좌석이 아니면 안 띄운다');
  const mine2 = { id: 2 }; b = build(SRC, { mine: mine2, focusShow: { emo: '', text: 'x' } });
  chk(b.mod.statusConfFor(mine2, null) && b.mod.statusConfFor(mine2, null).label === 'x', '  isMe 가 아니어도 findMySeat 이 가리키는 좌석이면 내 좌석(자리추가로 주 캐릭터가 바뀐 판)');
  b = build(SRC, { mine: me, focusShow: { emo: '📊', text: 'z' } });
  chk(b.mod.statusConfFor(me, 'meal').label === '밥', '★ 상태가 하나라도 있으면 그것이 이긴다(전시는 안 띄움)');
  chk(b.mod.statusConfFor(me, 'ghost') === null, '표에 없는 상태는 null');
  b = build(SRC, { mine: me, conf: { emo: '✨', text: '공부' } });
  const cm = b.mod.statusConfFor(me, 'custom');
  chk(cm.label === '공부' && cm.emo === '✨' && cm.dot === '#77f', '커스텀 — 내 등록 문구 · 이모지');
  const cr = b.mod.statusConfFor({ remote: true, remoteCustomStatus: { emo: '', text: '친구' } }, 'custom');
  chk(cr.label === '친구' && cr.emo === '', '친구 좌석은 그 친구가 보낸 값 · 이모지 비워도 문구만');
  chk(b.mod.statusConfFor({ remote: true }, 'custom') === null && build(SRC, { mine: me }).mod.statusConfFor(me, 'custom') === null, '문구가 없으면(등록 안 함) null');
}
say('§3 커스텀 저장');
{
  const b = build(SRC, { premium: true });
  b.mod.saveCustomStatusConf('😀😀😀', '1234567890');
  chk(b.getConf().emo.length === 2 && b.getConf().text === '12345', '이모지 2자 · 문구 최대 길이(5)로 자른다');
  chk(JSON.parse(b.store['tw.customStatus']).text === '12345', '  저장(tw.customStatus)');
  chk(JSON.stringify(b.log.pres[0]) === '["custom",{"emo":"😀","text":"12345"}]', '  방에 알린다');
  chk(b.els.myCustomStatusBtn.children['.csLabel'].textContent === '12345', '  메뉴 항목을 갱신(프리미엄이면)');
  b.mod.saveCustomStatusConf(null, undefined);
  chk(b.getConf().emo === '' && b.getConf().text === '', '빈 값 · null 은 빈 글');
}
say('§4 칩 · 메뉴');
{
  let b = build(SRC, { noChip: true }); let th = false; try{ b.mod.refreshMyStatusUI(); }catch(_){ th = true; }
  chk(!th, '칩 버튼이 없으면(아직 안 그려짐) 조용히 지나간다');
  b = build(SRC); b.mod.refreshMyStatusUI();
  chk(b.els.myStatusChipBtn.title === '상태' && b.els.myStatusDot.style.background === '#9dba8a', '상태가 없으면 title «상태» · 기본 초록 점');
  b.mod.setUserStatus('meal');
  chk(b.els.myStatusDot.style.background === 'css:#e0a050' && b.els.myStatusDot.style.boxShadow.includes('rgba(#e0a050,0.18)') && b.els.myStatusChipBtn.title === '🍚 밥', '상태가 있으면 이모지 + 이름 title · 점 색(cssColor 거침) · 번짐');
  b = build(SRC, { premium: true, conf: { emo: '', text: '' } }); b.mod.refreshCustomStatusMenuItem();
  const cb = b.els.myCustomStatusBtn;
  chk(cb.style.display === '' && cb.children['.csEmo'].textContent === '✨' && cb.children['.csLabel'].textContent === '커스텀 상태' && cb.title === '커스텀 상태 문구 등록', '프리미엄 — 항목을 보이고 등록 전 문구(✨ 커스텀 상태)');
  b = build(SRC, { premium: true, conf: { emo: '🎯', text: '집중' } }); b.mod.refreshCustomStatusMenuItem();
  chk(b.els.myCustomStatusBtn.children['.csEmo'].textContent === '🎯' && b.els.myCustomStatusBtn.title.includes('집중') && !b.els.myCustomStatusBtn.classes.has('on'), '등록한 이모지 · 문구 · 수정 안내 · 지금 상태가 아니면 표식 없음');
  b = build(SRC, { premium: true, conf: { emo: '🎯', text: '집중' }, store: {} }); b.mod.setUserStatus('custom');
  chk(b.els.myCustomStatusBtn.classes.has('on'), '지금 커스텀 상태를 쓰면 ● 표식(on)');
  b = build(SRC, { premium: false }); b.mod.refreshCustomStatusMenuItem();
  chk(b.els.myCustomStatusBtn.style.display === 'none', '프리미엄이 아니면 항목을 숨긴다');
  b = build(SRC, { noCustomBtn: true }); th = false; try{ b.mod.refreshCustomStatusMenuItem(); }catch(_){ th = true; }
  chk(!th, '항목이 없으면 조용히');
  b = build(SRC, { premium: true });
  chk(b.mod._premiumOn() === true && build(SRC, { premium: false }).mod._premiumOn() === false && build(SRC, { premiumThrows: true }).mod._premiumOn() === false, '_premiumOn — 참 · 거짓 · 아직 선언 전이라 던져도 거짓');
}
say('§5 saveSeatXf');
{
  const b = build(SRC);
  b.mod.saveSeatXf(null); b.mod.saveSeatXf({});
  chk(b.log.saves === 0, '좌석 · def 가 없으면 저장하지 않는다');
  const seat = { charDef: {}, userScale: 1.2, userY: 9, userRot: 3, userX: 0.1, slot: 2 };
  b.mod.saveSeatXf(seat);
  chk(JSON.stringify(seat.charDef.xf) === JSON.stringify({ s: 1.2, y: 0.6, z: 0, rot: 3, x: 0.1 }), 'def.xf = 크기 · 높이(상한 0.6) · z 0(폐기) · 방향 · x');
  chk(b.state.slots[2] === seat.charDef && b.log.saves === 1, '슬롯 칸에 def 를 넣고 슬롯 저장');
  const s2 = { charDef: {}, userScale: 1, userY: -1, userRot: 0 }; b.mod.saveSeatXf(s2);
  chk(s2.charDef.xf.x === 0 && s2.charDef.xf.y === 0 && b.log.saves === 2 && b.state.slots.length === 3, 'x 가 없으면 0 · 음수 높이는 0 · 슬롯이 없으면 슬롯 칸은 안 건드림');
}
say('§6 연결');
{
  const iU = HTML.indexOf('<script src="parts/status/user-status.js"></script>'), iA = HTML.indexOf('<script src="parts/app.js"></script>');
  chk(iU > 0 && iA > iU, 'html — user-status.js 를 app.js 보다 먼저 싣는다');
  const code = APP.replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/(^|[^:'"\\])\/\/[^\n]*/g, '$1 ');
  chk(/const userStatusMod = TwUserStatus\.createUserStatus\(\{[\s\S]*?userStatusTableMod: userStatusTableMod,\s*\}\);\s*userStatusMod\.attachStatusHooks\(\{[\s\S]*?setUserStatus: \(v\)=>Presence\.setUserStatus\(v\),\s*\}\);/.test(code), 'app.js — 만들고 다른 도메인은 attachStatusHooks 알림으로 건다(방 · 전시 · 슬롯 · 칩 색)');
  chk(!/createUserStatus\(\{[^}]*(Presence|focusShareMod|slotSaveMod|statusChipMod)/.test(code), '  다른 도메인 모듈은 deps 로 넘기지 않는다(순환 막기)');
  const names = ['_premiumOn', 'saveCustomStatusConf', 'statusConfFor', 'setUserStatus', 'loadUserStatusFromStorage', 'refreshMyStatusUI', 'refreshCustomStatusMenuItem', 'saveSeatXf'];
  chk(names.every(n => new RegExp('^const ' + n + ' = userStatusMod\\.' + n + ';', 'm').test(code)), '  옛 이름 여덟을 const 로 받는다');
  chk(/^window\.setUserStatus = setUserStatus;/m.test(code), '★ window.setUserStatus 고리를 app.js 가 건다(presence.js · room-sync.js 가 window. 로 부른다 — 옛 함수 선언이 걸어 주던 전역)');
  chk(!/function (setUserStatus|statusConfFor|refreshMyStatusUI|saveSeatXf|saveCustomStatusConf|loadUserStatusFromStorage|refreshCustomStatusMenuItem|_premiumOn)\b|\blet userStatus\b/.test(code), '  app.js 에 해당 코드 · let userStatus 가 남아 있지 않다');
  chk(!/(?<![\w$.'"])userStatus(?![\w$'":])/.test(code.replace(/userStatusMod\.userStatus\(\)/g, '')), '  내 상태는 어디서나 userStatusMod.userStatus() 로 읽는다');
  const PRES = read('room/presence.js') || '', RS = read('room/room-sync.js') || '';
  chk(/window\.setUserStatus\(v\)/.test(PRES) && /window\.setUserStatus/.test(RS), '  그 고리를 부르는 쪽(presence.js · room-sync.js)이 그대로 있다');
}
say('§7 일부러 깨 보기');
{
  const brk = (from, to) => { const m = SRC.replace(from, to); return m === SRC ? null : m; };
  const m1 = brk("if(!v || !userStatusTableMod.USER_STATUSES[v]) v=null;", '');
  chk(!!m1 && (() => { const b = build(m1); b.mod.setUserStatus('nope'); return b.mod.userStatus() !== null; })(), '모르는 상태를 거르지 않으면 빨강');
  const m2 = brk("if(seat && !seat.remote && (seat.isMe || seat === _mine))", "if(seat)");
  chk(!!m2 && (() => { const b = build(m2, { mine: { isMe: true }, focusShow: { emo: '', text: 'x' } }); return b.mod.statusConfFor({ remote: true }, null) !== null; })(), '오늘 기록 전시를 남의 좌석에도 띄우면 빨강');
  const m3 = brk("slice(0, userStatusTableMod.CUSTOM_STATUS_MAXLEN)", "slice(0, 100)");
  chk(!!m3 && (() => { const b = build(m3); b.mod.saveCustomStatusConf('', '1234567890'); return b.getConf().text !== '12345'; })(), '커스텀 문구 길이 상한을 빼면 빨강');
  const m4 = brk("if(!_premiumOn()){ btn.style.display = 'none'; return; }", '');
  chk(!!m4 && (() => { const b = build(m4, { premium: false }); b.mod.refreshCustomStatusMenuItem(); return b.els.myCustomStatusBtn.style.display !== 'none'; })(), '프리미엄 아닐 때 항목을 안 숨기면 빨강');
  const m5 = brk("clampCharY(seat.userY)", "seat.userY");
  chk(!!m5 && (() => { const b = build(m5); const s = { charDef: {}, userScale: 1, userY: 9, userRot: 0 }; b.mod.saveSeatXf(s); return s.charDef.xf.y !== 0.6; })(), '높이 상한을 안 걸면 빨강');
  const m6 = brk("try{ return !!isPremium(); }catch(_){ return false; }", "return !!isPremium();");
  chk(!!m6 && (() => { const b = build(m6, { premiumThrows: true }); try{ b.mod._premiumOn(); }catch(_){ return true; } return false; })(), '_premiumOn 이 던지는 걸 삼키지 않으면 빨강');
  const m7 = brk("statusHooks.setUserStatus(v);", '');
  chk(!!m7 && (() => { const b = build(m7); b.mod.setUserStatus('meal'); return b.log.pres.length === 0; })(), '방에 알리지 않으면 빨강');
}
say('');
say((fail ? '✗' : '✓') + ' 통과 ' + pass + ' · 실패 ' + fail);
process.exit(fail ? 1 : 0);
