/* ═══ 🧬 sim-my-info-box.js — [내 정보] 보관함 · 휴지통 화면(account/my-info.js) · 서버 원본 옷장 ═══════════════
   보관함 줄 · 휴지통 줄은 서버가 준 머리(섬네일)로 그리고, 올리기 · 옮기기 · 되살리기는 옷장(closetMod) 한 번의 요청이다. 가짜 DOM · 가짜 옷장 위에서 실제로 그려 본다.
   ・1절: 보관함 — 받는 중 / 못 받음(다시 시도) / 빔 / 줄(섬네일 · 날짜) · 개수 n/20 · [슬롯에 올리기](성공 · 실패 문구 · 도는 동안 한 번만)
   ・2절: 줄 휴지통 — 붉은 아이콘 → 줄 안 되묻기(옷장이 준 문구) → [옮기기] 요청 하나 · 실패 문구
   ・3절: 가득 참(20) — 경고 · 체크칸 · 고른 수 · 한꺼번에 휴지통(요청 하나) · 19 면 접힘 · 받기 전엔 경고 없음
   ・4절: 휴지통 탭 — 줄(옮김 / 연동 교체 · 사라지는 날) · 비었을 때 / 못 읽음 · [복원] · 20 이면 붉은 상자(요청 없음) · 옷장이 바뀌면 다시 그림
   ・5절: 깨 보기
   [실행] 저장소 루트에서 node checks/run.js sim-my-info-box */
'use strict';
const path = require('path');
const fs = require('fs');
const vm = require('vm');
let pass = 0, fail = 0, done = false;
const say = (s) => console.log(s);
const chk = (ok, msg) => { ok ? pass++ : fail++; say('  ' + (ok ? '✓' : '✗') + ' ' + msg); };
const find = (n) => [__dirname, process.cwd()].flatMap(d => [n, 'parts/account/' + n, 'parts/shared/' + n, 'app/parts/account/' + n, 'app/parts/shared/' + n, 'apps/desktop/app/parts/account/' + n, 'apps/desktop/app/parts/shared/' + n].map(p => path.join(d, p))).find(p => fs.existsSync(p));
const F = find('my-info.js'), FS = find('safe-html.js'), FN = find('net-ready.js');
if(!F || !FS || !FN){ say('  ? 원본 못 찾음 — my-info.js · safe-html.js · net-ready.js'); process.exit(2); }
const SRC = fs.readFileSync(F, 'utf8');
const flush = () => new Promise(r => setImmediate(r));

/* 가짜 DOM — 아이디로 찾는 칸 · 자식 · 글 · 스타일 · 클릭 */
function mkEl(tag, id){
  const el = { tag, id, style: { setProperty(){} }, children: [], onclick: null, onchange: null, checked: false, disabled: false, _text: '', className: '', title: '', attrs: {},
    appendChild(c){ el.children.push(c); return c; }, setAttribute(k, v){ el.attrs[k] = v; }, getAttribute: (k) => el.attrs[k],
    set textContent(v){ el._text = String(v); el.children = []; }, get textContent(){ return el._text + el.children.map(c => c.textContent).join(''); },
    set innerHTML(v){ el._html = String(v); el.children = []; el._text = ''; }, get innerHTML(){ return el._html || ''; },
    classList: { add(){}, remove(){}, toggle(){}, contains: () => false }, scrollTop: 0,
    click(){ if(el.onclick) return el.onclick({ stopPropagation(){}, preventDefault(){} }); },
    addEventListener(){}, querySelector: () => null, querySelectorAll: () => [] };
  return el;
}
const walk = (el, fn) => { fn(el); el.children.forEach(c => walk(c, fn)); };
const find2 = (root, pred) => { let out = null; walk(root, (e) => { if(!out && pred(e)) out = e; }); return out; };
const all = (root, pred) => { const out = []; walk(root, (e) => { if(pred(e)) out.push(e); }); return out; };
const btn = (root, text) => find2(root, (e) => e.tag === 'button' && e.textContent === text);

function mkWorld(src, opt){
  const o = opt || {};
  const els = {};
  const w = { els, toasts: [], calls: [], curSlot: null, box: o.box === undefined ? [] : o.box, state: o.state || 'ready', rows: o.rows === undefined ? [] : o.rows, trashFail: false,
    render: 0, open: true, ops: {} };
  const get = (id) => els[id] || (els[id] = mkEl(/^(miBoxBulkBtn|miBoxRetry)$/.test(id) ? 'button' : 'div', id));
  const document = { getElementById: get, createElement: (t) => mkEl(t), createElementNS: (ns, t) => mkEl(t), createTextNode: (t) => { const e = mkEl('#text'); e._text = String(t); return e; },
    addEventListener(){}, readyState: 'complete', querySelector: () => null, querySelectorAll: () => [] };
  get('lcMyInfo').style.display = 'block';
  const closet = {
    BOX_MAX: 20,
    state: () => w.state,
    boxItems: () => (w.state === 'ready' ? w.box : null),
    boxCount: () => w.box.length,
    deleteWords: () => ({ ask: '휴지통으로 옮길까요? 3일 뒤 사라져요', done: '휴지통으로 옮겼어요' }),
    reportFail: (r) => { w.toasts.push('문구:' + r.why); },
    pullCloset: (n) => { w.calls.push(['pull', n]); },
    boxToSlot: async (id) => { w.calls.push(['boxToSlot', id]); if(w.ops.boxToSlot) return w.ops.boxToSlot(id); return { ok: true, slot: 2 }; },
    trashBox: async (ids) => { w.calls.push(['trashBox', ids.slice()]); if(w.ops.trashBox) return w.ops.trashBox(ids); w.box = w.box.filter(b => !ids.includes(b.avatarId)); return { ok: true, n: ids.length, fail: 0 }; },
    trashRows: async () => { w.calls.push(['trashRows']); if(w.trashFail) throw new Error('x'); return w.rows; },
    restore: async (id) => { w.calls.push(['restore', id]); if(w.ops.restore) return w.ops.restore(id); return { ok: true, avatarId: 'r' }; },
  };
  w.closet = closet;
  const ctx = { window: {}, document, console: { warn(){}, log(){} }, localStorage: { getItem: () => null, setItem(){}, removeItem(){} }, navigator: {}, setTimeout: (f) => 0, setInterval: () => 0, clearTimeout(){}, clearInterval(){},
    JSON, Object, Array, Promise, Error, Number, String, Math, Date, Set, Map, Proxy, Symbol, isFinite, parseInt, parseFloat, URL, RegExp };
  vm.createContext(ctx);
  vm.runInContext(fs.readFileSync(FS, 'utf8'), ctx);
  ctx.TwSafeHtml = ctx.window.TwSafeHtml;
  vm.runInContext(fs.readFileSync(FN, 'utf8') + '\nvar TwNetReady = window.TwNetReady;\n', ctx);
  const any = new Proxy(function(){}, { get: (t, k) => k === Symbol.toPrimitive ? (() => '') : k === 'then' ? undefined : any, apply: () => any, construct: () => any, set: () => true, has: () => true });
  vm.runInContext(src, ctx);
  const deps = new Proxy({}, { get: (t, k) => (k in t ? t[k] : (typeof k === 'string' ? (() => any) : undefined)) });
  Object.assign(deps, {
    closetMod: () => closet, toast: (m) => w.toasts.push(m), slots: [], renderLauncher: () => { w.render++; }, saveCurSlot: () => { w.calls.push(['saveCur']); },
    setCurSlot: (v) => { w.curSlot = v; }, getMyUserId: () => 'u1', MY_FRIEND_CODE_KEY: 'k', USER_NAME_MAX: 10, plMod: any,
  });
  w.M = ctx.window.TwMyInfo.createMyInfo(deps);
  w.openBox = async () => { w.M.openMyInfo('box'); await flush(); await flush(); };
  return w;
}
const item = (id, mtime, thumb) => ({ avatarId: id, mtime, thumbUrl: thumb === undefined ? 'https://st/t-' + id + '.png' : thumb, faceUrl: null });
const rowsOf = (w) => w.els.miBoxList.children;

async function behave(src){
  const r = [];
  const t = (ok, msg) => r.push([!!ok, msg]);
  /* 1. 보관함 */
  let w = mkWorld(src, { state: 'loading' });
  await w.openBox();
  t(w.els.miBoxEmpty.style.display === 'block' && /불러오는 중/.test(w.els.miBoxEmpty.textContent) && rowsOf(w).length === 0 && w.els.miBoxCount.textContent === '0/20', '받는 중 — «불러오는 중» (빈 보관함 문구가 아니다)');
  w = mkWorld(src, { state: 'failed' }); await w.openBox();
  const retry = find2(w.els.miBoxEmpty, (e) => e.id === 'miBoxRetry');
  t(/못 불러왔어요/.test(w.els.miBoxEmpty.textContent) && retry, '못 받음 — «못 불러왔어요» + 다시 시도 단추');
  if(retry) retry.click();
  t(w.calls.some(c => c[0] === 'pull' && c[1] === true), '  다시 시도 = 사용자가 누른 받기(pullCloset(true) — 실패하면 오류 번호)');
  w = mkWorld(src, { box: [] }); await w.openBox();
  t(w.els.miBoxEmpty.style.display === 'block' && /비어 있어요/.test(w.els.miBoxEmpty.textContent), '받았는데 비었다 — «비어 있어요»(받는 중 · 못 받음과 다르다)');
  w = mkWorld(src, { box: [item('x', Date.UTC(2026, 9, 5, 3)), item('y', 0, null)] }); await w.openBox();
  const rows = rowsOf(w);
  t(rows.length === 2 && w.els.miBoxCount.textContent === '2/20' && w.els.miBoxEmpty.style.display === 'none', '줄 — 서버가 준 보관함 머리를 그린다 · 개수 n/20');
  const img = find2(rows[0], (e) => e.tag === 'img');
  t(img && img.src === 'https://st/t-x.png' && /마지막 수정 10\/5/.test(rows[0].textContent) && !find2(rows[1], (e) => e.tag === 'img') && find2(rows[1], (e) => e.textContent === '🙂'), '  섬네일(허용된 주소만) · 마지막 수정 날짜 · 섬네일 없으면 🙂');
  const up = btn(rows[0], '슬롯에 올리기');
  w.ops.boxToSlot = async () => { await flush(); return { ok: true, slot: 3 }; };
  up.click(); up.click();
  await flush(); await flush(); await flush();
  t(w.calls.filter(c => c[0] === 'boxToSlot').length === 1 && w.calls.find(c => c[0] === 'boxToSlot')[1] === 'x', '[슬롯에 올리기] — 옷장에 그 캐릭터를 부탁한다 · 도는 동안 두 번 누르면 한 번만');
  t(w.curSlot === 3 && w.toasts.includes('슬롯에 올렸어요') && w.calls.some(c => c[0] === 'saveCur') && w.render > 0, '  된 칸을 현재 칸으로 · 저장 · 런처 다시 그림 · 안내');
  w = mkWorld(src, { box: [item('x', 1)] }); await w.openBox();
  w.ops.boxToSlot = async () => ({ ok: false, why: 'slotsfull' });
  btn(rowsOf(w)[0], '슬롯에 올리기').click(); await flush(); await flush();
  t(w.toasts.includes('문구:slotsfull') && w.curSlot === null, '  실패 — 옷장이 준 이유 문구 · 현재 칸을 안 바꾼다');
  /* 2. 줄 휴지통 */
  w = mkWorld(src, { box: [item('x', 1), item('y', 2)] }); await w.openBox();
  find2(rowsOf(w)[0], (e) => e.attrs['aria-label'] === '휴지통 이동').click();
  const ask = rowsOf(w)[0];
  t(/휴지통으로 옮길까요\? 3일 뒤 사라져요/.test(ask.textContent) && btn(ask, '옮기기') && btn(ask, '취소') && btn(ask, '슬롯에 올리기').disabled === true, '붉은 아이콘 → 그 줄 안 되묻기(옷장이 준 문구) · 되묻는 동안 [슬롯에 올리기] 잠금');
  t(!w.calls.some(c => c[0] === 'trashBox'), '  되묻는 동안 요청 0');
  btn(rowsOf(w)[0], '취소').click();
  t(!/3일 뒤 사라져요/.test(rowsOf(w)[0].textContent), '  [취소] — 되묻기를 접는다');
  find2(rowsOf(w)[0], (e) => e.attrs['aria-label'] === '휴지통 이동').click();
  btn(rowsOf(w)[0], '옮기기').click(); await flush(); await flush(); await flush();
  t(w.calls.filter(c => c[0] === 'trashBox').length === 1 && JSON.stringify(w.calls.find(c => c[0] === 'trashBox')[1]) === '["x"]' && rowsOf(w).length === 1 && w.toasts.includes('휴지통으로 옮겼어요'), '[옮기기] — 요청 하나(그 캐릭터) · 줄이 사라진다 · 안내');
  t(w.calls.some(c => c[0] === 'trashRows'), '  휴지통 목록을 다시 읽는다(탭 글자 «휴지통 N»)');
  w = mkWorld(src, { box: [item('x', 1)] }); await w.openBox();
  w.ops.trashBox = async () => ({ ok: false, why: 'net', n: 0, fail: 1 });
  find2(rowsOf(w)[0], (e) => e.attrs['aria-label'] === '휴지통 이동').click(); btn(rowsOf(w)[0], '옮기기').click(); await flush(); await flush(); await flush();
  t(rowsOf(w).length === 1 && w.toasts.includes('문구:net'), '  실패 — 줄은 그대로 · 이유 문구');
  /* 3. 가득 참 */
  const twenty = []; for(let i = 0; i < 20; i++) twenty.push(item('b' + i, i + 1));
  w = mkWorld(src, { box: twenty }); await w.openBox();
  t(w.els.miBoxFull.style.display === 'block' && w.els.miBoxFullHead.textContent === '보관함이 가득 찼어요 · 20/20' && /^1개 이상 휴지통으로/.test(w.els.miBoxFullText.textContent) && !/새 캐릭터 만들기/.test(w.els.miBoxFullText.textContent), '20 이면 경고(몇 개 옮겨야 하는지) — 새 캐릭터 만들기는 막지 않으니 문구에 없다');
  const cks = all(w.els.miBoxList, (e) => e.type === 'checkbox' || (e.tag === 'input'));
  t(cks.length === 20 && w.els.miBoxPicked.textContent === '고른 캐릭터 0', '  줄마다 체크칸 · 고른 캐릭터 0');
  cks[0].checked = true; cks[0].onchange(); cks[1].checked = true; cks[1].onchange();
  t(w.els.miBoxPicked.textContent === '고른 캐릭터 2' && /선택한 캐릭터 휴지통으로 \(2\)/.test(w.els.miBoxBulkBtn.textContent), '  고르면 수가 오른다');
  w.els.miBoxBulkBtn.click();
  t(w.els.miBoxBulkAsk.style.display === 'block' && w.els.miBoxBulkAskText.textContent === '2개를 휴지통으로 옮길까요? 3일 뒤 사라져요' && w.els.miBoxBulkBtn.style.display === 'none', '  [선택한 캐릭터 휴지통으로] → 되묻기');
  w.els.miBoxBulkNo.click();
  t(w.els.miBoxBulkAsk.style.display === 'none', '  [아니오] — 접힌다');
  w.els.miBoxBulkBtn.click(); w.els.miBoxBulkYes.click(); await flush(); await flush(); await flush();
  const tb = w.calls.filter(c => c[0] === 'trashBox');
  t(tb.length === 1 && tb[0][1].join() === 'b19,b18' || tb[0] && tb[0][1].length === 2, '  [예] — 요청 하나로 고른 둘 (' + (tb[0] ? tb[0][1].join() : '없음') + ')');
  t(w.toasts.includes('휴지통으로 옮겼어요 (2)') && w.box.length === 18 && w.els.miBoxFull.style.display === 'none', '  된 뒤 18 이면 경고가 접힌다 · 고른 것 비움');
  w = mkWorld(src, { box: twenty.slice(0, 19) }); await w.openBox();
  t(w.els.miBoxFull.style.display === 'none', '19 면 경고 없음(20 문턱은 서버 규격 그대로)');
  w = mkWorld(src, { state: 'loading' }); await w.openBox();
  t(w.els.miBoxFull.style.display === 'none', '받기 전에는 경고도 없다');
  w = mkWorld(src, { box: twenty }); await w.openBox();
  const c0 = all(w.els.miBoxList, (e) => e.tag === 'input')[0]; c0.checked = true; c0.onchange();
  w.ops.trashBox = async () => ({ ok: false, why: 'err', n: 0, fail: 1 });
  w.els.miBoxBulkBtn.click(); w.els.miBoxBulkYes.click(); await flush(); await flush(); await flush();
  t(w.toasts.includes('문구:err') && w.box.length === 20, '  한꺼번에 실패 — 옷장의 실패 알림(reportFail) · 목록 그대로');
  /* 4. 휴지통 탭 */
  const T = (id, why, exp) => ({ trashId: id, avatarId: 'a-' + id, why, thumbUrl: 'https://st/tt-' + id + '.png', faceUrl: null, trashedAt: 1, expiresAt: exp });
  w = mkWorld(src, { box: [], rows: [T('t1', 'deleted', Date.UTC(2026, 8, 25, 3)), T('t2', 'overwritten', Date.UTC(2026, 9, 1, 3))] });
  await w.openBox();
  w.els.miTabTrash.click(); await flush(); await flush();
  const tr = w.els.miTrashList.children;
  t(tr.length === 2 && w.els.miTrashCount.textContent === '2' && w.els.miTabTrash.textContent === '휴지통 2', '휴지통 탭 — 서버가 준 줄 · 개수 · 탭 글자');
  t(/옮김/.test(tr[0].textContent) && /9\/25 사라져요/.test(tr[0].textContent) && /연동 교체/.test(tr[1].textContent) && /10\/1 사라져요/.test(tr[1].textContent), '  이름표(옮김 / 연동 교체) · 사라지는 날');
  t(find2(tr[0], (e) => e.tag === 'img').src === 'https://st/tt-t1.png', '  섬네일');
  btn(tr[0], '복원').click(); await flush(); await flush(); await flush();
  t(w.calls.filter(c => c[0] === 'restore').length === 1 && w.calls.find(c => c[0] === 'restore')[1] === 't1' && w.toasts.includes('보관함으로 복원했어요'), '[복원] — 옷장에 그 줄을 부탁한다 · 안내');
  t(w.calls.filter(c => c[0] === 'trashRows').length >= 2, '  복원 뒤 목록을 다시 읽는다');
  w = mkWorld(src, { box: twenty, rows: [T('t1', 'deleted', 1)] }); await w.openBox();
  w.els.miTabTrash.click(); await flush(); await flush();
  btn(w.els.miTrashList.children[0], '복원').click(); await flush(); await flush();
  t(w.els.miTrashFull.style.display === 'block' && /20\/20/.test(w.els.miTrashFullN.textContent) && !w.calls.some(c => c[0] === 'restore'), '보관함이 20 이면 [복원] 은 붉은 상자만 — 요청 0');
  w = mkWorld(src, { box: [], rows: [T('t1', 'deleted', 1)] }); await w.openBox();
  w.els.miTabTrash.click(); await flush(); await flush();
  w.ops.restore = async () => ({ ok: false, why: 'gone' });
  btn(w.els.miTrashList.children[0], '복원').click(); await flush(); await flush(); await flush();
  t(w.toasts.includes('문구:gone'), '  기한이 지났으면(gone) 옷장의 실패 알림 한 곳으로(my-info 가 문구를 따로 고르지 않는다)');
  w = mkWorld(src, { box: [], rows: [] }); await w.openBox();
  w.els.miTabTrash.click(); await flush(); await flush();
  t(w.els.miTrashEmpty.style.display === 'block' && /3일/.test(w.els.miTrashEmpty.textContent) && /10일/.test(w.els.miTrashEmpty.textContent), '비었을 때 — 기한 안내(옮김 3일 · 연동 교체 10일)');
  w = mkWorld(src, { box: [], rows: [] }); w.trashFail = true; await w.openBox();
  w.els.miTabTrash.click(); await flush(); await flush();
  t(/읽지 못했어요/.test(w.els.miTrashEmpty.textContent), '못 읽었을 때 — «읽지 못했어요»(빈 휴지통이 아니다)');
  w = mkWorld(src, { state: 'loading' }); await w.openBox();
  t(w.els.miTabTrash.style.display === 'none', '받기 전에는 휴지통 탭을 숨긴다');
  /* 옷장이 바뀌면 */
  w = mkWorld(src, { box: [item('x', 1)] }); await w.openBox();
  w.box = [item('x', 1), item('y', 2)]; w.M._miBoxChanged();
  t(rowsOf(w).length === 2, '옷장이 바뀌면(_miBoxChanged) 열려 있는 보관함 줄을 다시 그린다');
  return r;
}

(async () => {
  (await behave(SRC)).forEach(([ok, msg]) => chk(ok, msg));
  say('── 5. 일부러 깨 보기');
  const bb = [
    ['받기 전에도 빈 보관함으로 그림', "const failed = closetMod().state() === 'failed';", "const failed = false;"],
    ['올리기를 두 번 보냄', "if(_miBusy) return;\n  _miBusy = true;\n  if(btn){ btn.disabled = true; btn.textContent = '올리는 중…'; }", "if(btn){ btn.disabled = true; btn.textContent = '올리는 중…'; }"],
    ['복원이 20 문턱을 안 봄', "if(closetMod().boxCount() >= closetMod().BOX_MAX){", "if(false){"],
    ['한꺼번에를 한 줄씩 보냄', "r = await closetMod().trashBox(Array.from(_miPick));", "r = { ok: true, n: 2, fail: 0 }; for(const id of Array.from(_miPick)) await closetMod().trashBox([id]);"],
    ['휴지통을 못 읽어도 빈 목록', "_miTrashErr = (rows === null);", "_miTrashErr = false;"],
  ];
  for(const [name, a, b] of bb){
    const m2 = SRC.replace(a, b);
    let rows2 = []; if(m2 !== SRC){ try{ rows2 = await behave(m2); }catch(_){ rows2 = [[false, '던짐']]; } }
    chk(m2 !== SRC && rows2.some(([ok]) => !ok), name + (m2 !== SRC ? '' : ' — 바꿀 글을 못 찾음'));
  }
  say('');
  say(fail ? ('✗ ' + fail + '건 어긋남 · 통과 ' + pass) : ('✅ 전부 통과 ' + pass));
  console.log(pass + ' · ' + fail);
  done = true;
  process.exit(fail ? 1 : 0);
})();
process.on('exit', () => { if(!done){ console.log('  ✗ 끝까지 못 돌았다\n' + pass + ' · ' + (fail + 1)); process.exitCode = 1; } });
