/* ═══ 🔒 sim-secret-room-grant.js — 관리자 시크릿룸 발급을 서버 길로(admin/admin-license-bulk.js · 0.13 앱 묶음 D8-5) ═══
   [무엇을 지키나] 발급은 POST /v1/admin/secret-rooms 한 번이다. 친구코드 찾기 · 코드 뽑기 · 끝나는 날 셈 · 옛 코드 끝내기 · 우편은 서버가 한다.
     앱은 «남이 가진 코드» 일 때 서버가 실어 준 주인 · 끝나는 날로 한 번 경고하고, 같은 단추를 다시 누르면 confirmTakeover 로 넘긴다.
   ・1절: 한 번 발급 — 본문 모양(친구코드 · 유저 코드 · 뒷 4자리 → MATE · COZY) · 결과 문구(코드 · 끝나는 날) · Firebase 0
   ・2절: «이미 쓰이는 코드» 경고 — 주인 · 끝나는 날 · 끝난 방 · 같은 조건 다시 누름 = confirmTakeover · 조건을 고치면 다시 경고
   ・3절: requestId — 답 못 받고 다시 누르면 같은 번호 · 답을 받으면 새 번호 · 처리 중 두 번째 누름 = 요청 0
   ・4절: 실패 — 고칠 수 없는 실패 = E-LIC-07 한 번 · 없는 사람 · 입력 오류 문구 · 앱 날짜 셈 0 · 발급 열쇠 칸 없음
   ・5절: 깨 보기 — 아래 고장을 하나씩 넣으면 빨강
   [실행] node checks/run.js sim-secret-room-grant */
'use strict';
const fs = require('fs');
let pass = 0, fail = 0;
const say = (s) => console.log(s);
const chk = (ok, msg) => { ok ? pass++ : fail++; say('  ' + (ok ? '✓' : '✗') + ' ' + msg); };
const read = (f) => { try{ return fs.readFileSync(f, 'utf8'); }catch(_){ return null; } };
const part = (n, d) => [n, 'parts/' + d + '/' + n, 'app/parts/' + d + '/' + n].map(read).find(Boolean);
const LB = part('admin-license-bulk.js', 'admin'), RID = part('request-id.js', 'shared'), HTML = read('desk-companion-prototype.html');
if(!LB || !RID || !HTML){ say('  ? 원본 못 찾음 — admin-license-bulk.js · request-id.js · desk-companion-prototype.html'); process.exit(2); }
const apiErr = (status, code, kind, items) => Object.assign(new Error(code || String(status)), { status, code: code || '', kind, items: items || null });
const flush = () => new Promise((r) => setImmediate(r));

/* 가짜 DOM · 서버 — script 가 시키는 대로 답한다. replies 는 호출마다 하나씩 꺼낸다(함수면 body 를 받는다) */
function build(src, replies){
  const els = {};
  const el = (id) => els[id] || (els[id] = { id, style: {}, value: '', checked: false, disabled: false, textContent: '', innerHTML: '', files: null,
    parentElement: null, firstElementChild: null, offsetWidth: 300, clientWidth: 900, _on: {}, addEventListener(t, f){ (this._on[t] = this._on[t] || []).push(f); }, click(){} });
  const posts = [], toasts = [], notes = [];
  const win = {
    TwApi: { authed: { post: async (path, body) => {
      posts.push({ path, body: JSON.parse(JSON.stringify(body)) });
      const r = replies.shift();
      const v = typeof r === 'function' ? await r(body) : r;
      if(v instanceof Error) throw v;
      return v;
    } } },
    TwErrorCodes: { notify: (c) => { notes.push(c); return true; } },
  };
  new Function('window', 'document', 'module', RID + '\n')(win, undefined, undefined);   // 진짜 request-id.js
  const g = new Function('window', 'document', 'module', src + '\nreturn window.TwAdminLicenseBulk;')(win, { getElementById: el }, undefined);
  g.createAdminLicenseBulk({ escHtml: (s) => String(s), toast: (m) => toasts.push(m), genLicenseKey: () => 'K', saveFailMsg: () => '', renderLicenseGenList(){}, downloadBlob(){},
    srFmtDate: (ms) => new Date(ms).toISOString().slice(0, 10) });
  const set = (code, want, months) => { els.srGrantCode.value = code; els.srGrantWant.value = want || ''; els.srGrantMonths.value = months || ''; };
  const click = async () => { const p = els.srGrantBtn._on.click[0](); await flush(); return p; };
  return { els, posts, toasts, notes, set, click, msg: () => els.srGrantMsg.textContent, win };
}
const OK = (over) => Object.assign({ secretRoomId: 'id1', code: 'SCRT-ABCD', ownerUserCode: 'u1abcdefghijk', name: '', expiresAt: '2027-02-14T14:59:59.999Z', endedAt: null, version: 1 }, over || {});
const TAKEN = (items) => apiErr(409, 'LICENSE_SECRET_ROOM_CODE_TAKEN', 'request', items);

async function judge(src){
  const r = [];
  const t = (ok, msg) => r.push([!!ok, msg]);
  /* 1. 한 번 발급 */
  {
    const s = build(src, [OK()]);
    s.set('mate-9k2m', 'abcd', '3'); await s.click();
    const p = s.posts[0];
    t(s.posts.length === 1 && p.path === '/v1/admin/secret-rooms', '발급 = POST /v1/admin/secret-rooms 한 번');
    t(p.body.friendCode === 'MATE-9K2M' && p.body.ownerUserCode === undefined && p.body.code === 'SCRT-ABCD' && p.body.months === 3 && p.body.confirmTakeover === false && p.body.name === '',
      '  본문 — friendCode(대문자) · code SCRT-ABCD · months 3 · confirmTakeover false · name 빈 글');
    t(/^[A-Za-z0-9_-]{8,64}$/.test(p.body.requestId), '  requestId 는 서버 규칙 모양');
    t(/SCRT-ABCD/.test(s.msg()) && /2027-02-14/.test(s.msg()) && /3개월/.test(s.msg()) && s.toasts.length === 1 && s.els.srGrantCode.value === '', '  결과 — 코드 · 서버가 센 끝나는 날(앱은 셈 없이 그리기만) · 칸 비움');
    const u = build(src, [OK({ expiresAt: null })]);
    u.set('u1abcdefghijk', '', ''); await u.click();
    t(u.posts[0].body.ownerUserCode === 'u1abcdefghijk' && u.posts[0].body.friendCode === undefined && u.posts[0].body.code === undefined && u.posts[0].body.months === null && /영구/.test(u.msg()),
      '유저 코드(u…) = ownerUserCode · 코드 비움 = 서버가 뽑음 · 기간 비움 = 영구(months null)');
    const f = build(src, [apiErr(404, 'USER_NOT_FOUND', 'request'), OK()]);
    f.set('9k2m', '', ''); await f.click();
    t(f.posts.length === 2 && f.posts[0].body.friendCode === 'MATE-9K2M' && f.posts[1].body.friendCode === 'COZY-9K2M', '뒷 4자리만 넣으면 MATE → COZY 순으로 묻는다');
    const n = build(src, [apiErr(404, 'USER_NOT_FOUND', 'request')]);
    n.set('MATE-0000', '', ''); await n.click();
    t(n.posts.length === 1 && /찾을 수 없어요/.test(n.msg()) && n.notes.length === 0, '없는 친구코드 → 문구(번호 없음) · 다른 접두사로 되묻지 않음');
    t(!('firebaseAPI' in s.win), 'Firebase 를 부르지 않는다(창에 firebaseAPI 없음)');
  }
  /* 2. 이미 쓰이는 코드 */
  {
    const holder = { secretRoomId: 'x', ownerUserCode: 'u9zzzzzzzzzzz', expiresAt: '2027-03-01T14:59:59.999Z', endedAt: null };
    const s = build(src, [TAKEN([holder]), OK()]);
    s.set('MATE-9K2M', 'abcd', '2'); await s.click();
    t(s.posts.length === 1 && /u9zzzzzzzzzzz/.test(s.msg()) && /2027-03-01/.test(s.msg()) && /다시 누르면/.test(s.msg()) && s.notes.length === 0, '남이 가진 코드 → 경고에 지금 주인 · 끝나는 날(서버 items) · 번호 없음');
    await s.click();
    t(s.posts.length === 2 && s.posts[1].body.confirmTakeover === true && /발급했어요/.test(s.msg()), '  같은 조건으로 다시 누르면 confirmTakeover:true 로 보낸다');
    const s2 = build(src, [TAKEN([holder]), TAKEN([holder]), OK()]);
    s2.set('MATE-9K2M', 'abcd', '2'); await s2.click();
    s2.els.srGrantMonths.value = '5'; await s2.click();
    t(s2.posts[1].body.confirmTakeover === false && /다시 누르면/.test(s2.msg()), '  기간을 고치고 누르면 다시 경고(경고에 적힌 조건과 다른 것이 넘어가지 않는다)');
    const s3 = build(src, [TAKEN([Object.assign({}, holder, { expiresAt: null })])]);
    s3.set('MATE-9K2M', 'abcd', ''); await s3.click();
    t(/영구/.test(s3.msg()), '  영구인 방은 «현재 영구»');
    const s4 = build(src, [TAKEN([Object.assign({}, holder, { endedAt: '2026-10-01T00:00:00Z' })])]);
    s4.set('MATE-9K2M', 'abcd', ''); await s4.click();
    t(/이미 끝난/.test(s4.msg()) && /2026-10-01/.test(s4.msg()), '  끝난 방이 든 코드는 «이미 끝난 방 · 끝난 날»');
    const s5 = build(src, [TAKEN(null)]);
    s5.set('MATE-9K2M', 'abcd', ''); await s5.click();
    t(/다시 누르면/.test(s5.msg()), '  items 가 비어도 경고는 나온다');
  }
  /* 3. requestId */
  {
    const s = build(src, [apiErr(0, 'NETWORK', 'unavailable'), OK(), OK()]);
    s.set('MATE-9K2M', 'abcd', '1'); await s.click(); await s.click();
    t(s.posts.length === 2 && s.posts[0].body.requestId === s.posts[1].body.requestId, '답을 못 받고 다시 누르면 같은 requestId(서버가 한 번만 처리)');
    s.set('MATE-9K2M', 'abcd', '1'); await s.click();
    t(s.posts[2].body.requestId !== s.posts[1].body.requestId, '  답을 받은 뒤의 새 발급은 새 requestId');
    const g = build(src, [TAKEN([{ ownerUserCode: 'ux', expiresAt: null, endedAt: null }]), OK()]);
    g.set('MATE-9K2M', 'abcd', ''); await g.click(); await g.click();
    t(g.posts[0].body.requestId !== g.posts[1].body.requestId, '  경고(서버가 거절) 뒤 확인은 새 requestId');
    let release; const slow = build(src, [() => new Promise((res) => { release = () => res(OK()); })]);
    slow.set('MATE-9K2M', 'abcd', ''); const p1 = slow.click(); await flush();
    await slow.click();
    t(slow.posts.length === 1 && slow.els.srGrantBtn.disabled === true, '처리 중 두 번째 누름 = 요청 0 · 단추 잠김');
    release(); await p1; await flush();
    t(slow.els.srGrantBtn.disabled === false, '  끝나면 단추가 열린다');
  }
  /* 4. 실패 */
  {
    const s = build(src, [apiErr(503, 'UNAVAILABLE', 'unavailable')]);
    s.set('MATE-9K2M', '', ''); await s.click();
    t(s.notes.join() === 'E-LIC-07' && !/발급했어요/.test(s.msg()), '고칠 수 없는 실패(5xx · 네트워크) → E-LIC-07 한 번');
    const b = build(src, [apiErr(400, 'INVALID_REQUEST', 'request')]);
    b.set('MATE-9K2M', '', ''); await b.click();
    t(/입력을 확인/.test(b.msg()) && b.notes.length === 0, '입력 오류 → 문구(번호 없음)');
    const a = build(src, [apiErr(403, 'FORBIDDEN', 'auth')]);
    a.set('MATE-9K2M', '', ''); await a.click();
    t(/로그인/.test(a.msg()) && a.notes.length === 0, '로그인 · 권한 → 문구(번호 없음)');
    const v = build(src, []);
    v.set('MATE-9K2M', 'ab', ''); await v.click(); v.set('MATE-9K2M', '', 'x'); await v.click(); v.set('', '', ''); await v.click();
    t(v.posts.length === 0, '입력이 틀리면(코드 3자 · 기간 글자 · 빈 칸) 요청 0');
    const body = src.slice(src.indexOf('(function bindSecretRoomGrant'));
    const code = body.replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/(^|[^:'"])\/\/[^\n]*/g, '$1 ');
    t(!/_srAddMonths|Date\.now\(\)|firebaseAPI|setMonth|getFullYear/.test(code), '앱 날짜 셈 · Firebase 호출이 이 절에 없다');
    t(!/srGrantKey|발급 열쇠/.test(code) && !/id="srGrantKey"/.test(HTML), '발급 열쇠 칸이 없다(html 도)');
    t(['srGrantCode', 'srGrantWant', 'srGrantMonths', 'srGrantBtn', 'srGrantMsg'].every((i) => HTML.includes('id="' + i + '"')), 'html — 발급 칸 다섯이 있다');
  }
  return r;
}

(async () => {
  say('── 1~4. 서버 길 발급 — 실제로 돌려 본다');
  const rows = await judge(LB);
  rows.forEach(([ok, msg]) => chk(ok, msg));
  say('── 5. 깨 보기 — 고장을 넣으면 빨강');
  const BREAKS = [
    ['요청 번호를 매번 새로 만든다', (s) => s.replace('body.requestId = idPool().idFor(key);', 'body.requestId = window.TwRequestId.newId();')],
    ['경고 없이 바로 넘긴다', (s) => s.replace('const confirm = _armed === armKey;', 'const confirm = true;')],
    ['경고를 띄워도 표식을 안 남긴다', (s) => s.replace('_armed = armKey;\n            const h', 'const h')],
    ['표식에서 개월을 뺀다', (s) => s.replace("const armKey = target + '|' + want + '|' + months;", "const armKey = target + '|' + want;")],
    ['앱이 끝나는 날을 셈한다', (s) => s.replace("const exp = r && r.expiresAt ? dayOf(r.expiresAt) : '';", "const exp = months ? _srFmtDate(Date.now() + months * 2592e6) : '';")],
    ['못 고치는 실패에 번호를 안 띄운다', (s) => s.replace("window.TwErrorCodes.notify('E-LIC-07', e);", '')],
    ['뒷 4자리를 MATE 한 가지로만', (s) => s.replace("[{ friendCode: 'MATE-' + target }, { friendCode: 'COZY-' + target }]", "[{ friendCode: 'MATE-' + target }]")],
    ['처리 중 잠금을 뺀다', (s) => s.replace('if(busy) return;', '')],
    ['경고에 주인을 안 보인다', (s) => s.replace("const who = (h && h.ownerUserCode) ? h.ownerUserCode : '다른 사람';", "const who = '다른 사람';")],
    ['답을 받아도 번호를 안 끝낸다', (s) => s.replace(/idPool\(\)\.settle\(key\);\n        _armed = '';/, "_armed = '';")],
  ];
  for(const [what, mut] of BREAKS){
    const broken = mut(LB);
    if(broken === LB){ chk(false, '깨 볼 글을 못 찾음 — ' + what); continue; }
    let caught = false;
    try{ caught = (await judge(broken)).some(([ok]) => !ok); }catch(_){ caught = true; }
    chk(caught, '깨 보기 — ' + what);
  }
  say(`\n${fail ? '✗' : '✓'} 통과 ${pass} · 실패 ${fail}`);
  process.exit(fail ? 1 : 0);
})();
