/* ═══ 🚩 sim-report.js — 신고 서버 길 · 신고하기 모듈 둘 ═══════════════
   report-api.js(신고 provider — POST /v1/reports) · report.js(신고 창 · 공용 도우미 · 팝업 칸) · admin/admin-report.js(관리자 신고 목록).
   신고 규칙 · 문구는 sim-report-away.js 가 본다. 여기서는 provider 본문 · 신고 창의 성공 / 실패 · 팝업 칸 나눠 쓰기 · app.js 연결을 본다 — 가짜 DOM · 가짜 통로 위에서 굴린다.
   ・0절: report-api.js — 사유 이름 → 서버 종류 이름 표 · 본문 = { target, kind, note? }(내 이름 · 코드 없음) · 틀린 값은 요청 0 · 실패는 그대로 던짐
   ・1절: report.js — 내놓는 이름 · 정보 없는 좌석 · 나 자신 · 기타는 글 필요 · 보내는 동안 [신고] 꺼짐 · 성공 = 숨김 · 창 닫힘 ·
          실패 = 숨김 0 + E-RPT-01 한 번 + [신고] 다시 켬 · REPORT_NO_AWAY_IMAGE = 안내(번호 0) · REPORT_SELF = 조용히 닫음
   ・2절: admin-report.js — 관리자 아니면 안 염(다시 대입된 isAdmin) · 열면 신고 창이 닫히고 팝업 칸을 이어받음 · ESC 로 닫힘 · rows
   ・3절: app.js 연결 — 본문이 안 남음 · 빈 껍데기 둘(관리자 목록은 report.js 없으면 안 만듦) · deps · 원래 자리 · 메뉴는 reportMod.openDialog · html
   ・4절: 일부러 깨 보기
   [실행] app.js · desk-companion-prototype.html · report.js · admin-report.js 가 있는 폴더에서(러너 스테이징이면 깊은 자리에서 끌어올린다). */
'use strict';
const fs = require('fs');
let pass = 0, fail = 0;
const say = (s) => console.log(s);
const chk = (ok, msg) => { ok ? pass++ : fail++; say('  ' + (ok ? '✓' : '✗') + ' ' + msg); };
const read = (f) => { try{ return fs.readFileSync(f, 'utf8'); }catch(_){ return null; } };
/* 좌석 우클릭 메뉴는 room/seat-menu.js 로 옮겼다(C 구역 떼기 w4) — 메뉴 글을 app.js 글에 이어 붙여 읽는다(신고는 읽는 함수 reportMod() 를 거친다) */
const _MENU = ['seat-menu.js', 'parts/room/seat-menu.js', 'app/parts/room/seat-menu.js'].map(read).find(Boolean) || '';
const _APP = read('app.js'), SRC = _APP && (_APP + '\n' + _MENU), HTML = read('desk-companion-prototype.html');
if(!SRC || !HTML){ say('  ? 원본 못 찾음 — app.js · desk-companion-prototype.html'); process.exit(2); }
const REP = ['report.js', 'parts/support/report.js', 'app/parts/support/report.js'].map(read).find(Boolean);
const RAPI = ['report-api.js', 'parts/support/report-api.js', 'app/parts/support/report-api.js'].map(read).find(Boolean);
const ADM = ['admin-report.js', 'parts/admin/admin-report.js', 'app/parts/admin/admin-report.js'].map(read).find(Boolean);
if(!REP){ say('  ? 원본 못 찾음 — report.js'); process.exit(2); }
if(!RAPI){ say('  ? 원본 못 찾음 — report-api.js'); process.exit(2); }
if(!ADM){ say('  ? 원본 못 찾음 — admin-report.js'); process.exit(2); }
const strip = (s) => s.replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/(^|[^:'"])\/\/[^\n]*/g, '$1 ');

/* 가짜 DOM — 만든 요소를 모두 기억해 두고 꺼내 본다 */
function makeDom(){
  const made = [], docOn = {};
  const mk = (tag) => {
    const e = { tagName: tag, style: {}, children: [], _on: {}, textContent: '', value: '', disabled: false, className: '', type: '', name: '',
      setAttribute(){}, appendChild(c){ this.children.push(c); c.parent = this; return c; }, addEventListener(t, f){ (this._on[t] = this._on[t] || []).push(f); },
      remove(){ this.removed = true; }, focus(){} };
    made.push(e); return e;
  };
  const document = { createElement: mk, createTextNode: (t) => ({ textContent: t }), getElementById: (id) => made.find(x => x.id === id) || Object.assign(mk('div'), { id }),
    body: { appendChild(c){ c.attached = true; } },
    addEventListener(t, f){ (docOn[t] = docOn[t] || []).push(f); }, removeEventListener(t, f){ docOn[t] = (docOn[t] || []).filter(x => x !== f); } };
  return { made, docOn, document };
}
/* 가짜 로그인 통로 — 보낸 것을 적고, st.fail 이 있으면 그 오류로 거절 · st.hold 면 풀어 줄 때까지 붙잡는다 */
function fakeAuthed(st, calls){
  return { post: (path, body) => {
    calls.push(['post', path, body]);
    if(st.hold) return new Promise((res, rej) => { st.release = () => (st.fail ? rej(st.fail) : res(null)); });
    return st.fail ? Promise.reject(st.fail) : Promise.resolve(null);
  } };
}
function build(rep, adm, st, rapi){
  const D = makeDom(), calls = [];
  const fb = { listReports: async () => { calls.push(['listReports']); return { ok: true, reports: st.reports || {} }; }, getUserBrief: async () => ({}) };
  const win = { firebaseAPI: fb };
  const hidden = new Set();
  const run = (src, glob) => new Function('window', 'document', 'firebaseAPI', 'module', src + '\nreturn window.' + glob + ';')(win, D.document, fb, undefined);
  const RA = run(rapi, 'TwReportApi');
  const R = run(rep, 'TwReport').createReport({ toast: (m) => calls.push(['toast', m]), getMyUserId: () => st.me, seatLabelName: () => '콩떡', awayUrlOk: (u) => !!u,
    reportHiddenSave: () => calls.push(['hiddenSave']), reportHiddenUids: hidden,
    reportApi: RA.createReportApi({ authed: fakeAuthed(st, calls) }), notifyError: (code, e) => { calls.push(['notifyError', code, e]); return true; } });
  const A = run(adm, 'TwAdminReport').createAdminReport({ toast: (m) => calls.push(['toast', m]), awayUrlOk: (u) => !!u, isAdmin: () => st.admin,
    reportClose: (...a) => R.close(...a), reportBox: (...a) => R.box(...a), kinds: R.KINDS, adminMin: R.ADMIN_MIN,
    reportOv: (...a) => R.ov(...a), setReportOv: (...a) => R.setOv(...a), reportEsc: (...a) => R.esc(...a), setReportEsc: (...a) => R.setEsc(...a) });
  return { R, A, D, calls, hidden, RA };
}
const find = (D, pred) => D.made.filter(pred);
const flush = () => new Promise(r => setImmediate(r));

const errOf = (code) => Object.assign(new Error(code), { code, kind: 'server' });
const posts = (calls) => calls.filter(c => c[0] === 'post');
const errs = (calls) => calls.filter(c => c[0] === 'notifyError');

async function judgeAll(rep, adm, app, html, rapi){
  const r = [];
  const t = (ok, msg) => r.push([!!ok, msg]);
  const st = { me: 'me1', admin: false };
  let B;
  try{ B = build(rep, adm, st, rapi); }catch(e){ t(false, '모듈을 만들 수 없다 — ' + e.message); return r; }
  const { R, A, D, RA } = B;
  /* 0. report-api.js — 진짜 함수를 부른다 */
  const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);
  const kinds = { char: 'CHARACTER', away: 'AWAY_IMAGE', nick: 'NICKNAME', etc: 'ETC' };
  t(Object.keys(kinds).every(k => same(RA.bodyOf('u9', k, ''), { target: 'u9', kind: kinds[k] })) && Object.keys(RA.KIND).length === 4,
    'report-api — 사유 넷 → 서버 종류 이름 표(char → CHARACTER · away → AWAY_IMAGE · nick → NICKNAME · etc → ETC) · 빈 글은 싣지 않음');
  t(same(RA.bodyOf('u9', 'etc', '  욕설  '), { target: 'u9', kind: 'ETC', note: '욕설' }) && same(Object.keys(RA.bodyOf('u9', 'etc', 'x'.repeat(40))), ['target', 'kind', 'note']),
    'report-api — 본문 = { target, kind, note? } 만(글은 앞뒤 공백 걷음 · 40자까지)');
  const thrown = (f) => { try{ f(); return null; }catch(e){ return e.code; } };
  t(thrown(() => RA.bodyOf('u9', 'etc', 'x'.repeat(41))) === 'INVALID' && thrown(() => RA.bodyOf('', 'char', '')) === 'INVALID'
    && thrown(() => RA.bodyOf('u9', 'spam', '')) === 'INVALID' && thrown(() => RA.bodyOf('u9', 'toString', '')) === 'INVALID',
    'report-api — 틀린 값(41자 · 대상 없음 · 모르는 사유)은 INVALID');
  {
    const c0 = [], s0 = {}, api0 = RA.createReportApi({ authed: fakeAuthed(s0, c0) });
    let e0 = null; try{ await api0.file('u9', 'spam', ''); }catch(e){ e0 = e; }
    await api0.file('u9', 'nick', '');
    s0.fail = errOf('REPORT_SELF'); let e1 = null; try{ await api0.file('u9', 'char', ''); }catch(e){ e1 = e; }
    t(e0 && e0.code === 'INVALID' && c0.length === 2 && c0[0][1] === '/v1/reports' && same(c0[0][2], { target: 'u9', kind: 'NICKNAME' }) && e1 === s0.fail,
      'report-api — file: 틀린 값은 요청 0 · POST /v1/reports 한 번 · 실패는 받은 오류 그대로 던짐(다시 보내지 않음)');
  }
  /* 1. report.js */
  t(['openDialog', 'close', 'box', 'KINDS', 'ADMIN_MIN', 'ov', 'setOv', 'esc', 'setEsc'].every(k => k in R) && R.KINDS.length === 4 && R.ADMIN_MIN === 3,
    'report.js — 내놓는 이름(신고 창 · 공용 도우미 · 팝업 칸) · 사유 넷 · 기준 3명');
  R.openDialog({});
  t(B.calls.some(c => c[0] === 'toast') && !R.ov(), '정보 없는 좌석 — 안내만 · 창 안 엶');
  R.openDialog({ friendUserId: 'me1' });
  t(!R.ov(), '나 자신은 신고 창을 안 연다');
  R.openDialog({ friendUserId: 'u9', remoteAwayImg: '' });
  const ov1 = R.ov();
  const radios = find(D, x => x.type === 'radio'), go = find(D, x => x.textContent === '신고').pop(), etc = find(D, x => x.type === 'text').pop();
  t(ov1 && ov1.attached && radios.length === 4 && radios.find(x => x.value === 'away').disabled && go.disabled, '신고 창 — 사유 넷 · 그림 없으면 자리비움 잠김 · 고르기 전엔 [신고] 꺼짐');
  radios.find(x => x.value === 'etc')._on.change[0](); etc.value = '   ';
  await go.onclick();
  t(!posts(B.calls).length, '기타는 글이 있어야 신고한다');
  /* 실패 — 그 밖 오류: 숨기지 않고 E-RPT-01 한 번 · [신고] 다시 켬 · 창은 그대로 */
  st.fail = errOf('INTERNAL_ERROR'); etc.value = ' 욕설 '; await go.onclick();
  t(posts(B.calls).length === 1 && B.hidden.size === 0 && !B.calls.some(c => c[0] === 'hiddenSave') && errs(B.calls).length === 1 && errs(B.calls)[0][1] === 'E-RPT-01'
    && errs(B.calls)[0][2] === st.fail && !go.disabled && R.ov() === ov1 && !ov1.removed,
    '실패 — 숨기지 않음 · E-RPT-01 한 번 · [신고] 다시 켬 · 창 그대로(다시 보내지 않음)');
  /* 실패 — 그림이 이미 없음: 안내 문구 · 번호 없음 */
  B.calls.length = 0; st.fail = errOf('REPORT_NO_AWAY_IMAGE'); await go.onclick();
  t(posts(B.calls).length === 1 && !errs(B.calls).length && B.calls.some(c => c[0] === 'toast' && /자리비움 그림이 이미 없어요/.test(c[1])) && B.hidden.size === 0 && !go.disabled && R.ov() === ov1,
    'REPORT_NO_AWAY_IMAGE — 안내 문구(번호 없음) · 숨기지 않음 · [신고] 다시 켬');
  /* 성공 — 보내는 동안 [신고] 꺼짐 · 본문은 { target, kind, note } 만 */
  B.calls.length = 0; st.fail = null; st.hold = true;
  const pend = go.onclick();
  const busy = go.disabled; st.release(); st.hold = false; await pend;
  const sent = posts(B.calls);
  t(busy && sent.length === 1 && sent[0][1] === '/v1/reports' && same(sent[0][2], { target: 'u9', kind: 'ETC', note: '욕설' }),
    '신고 = POST /v1/reports { target, kind, note } 한 번(내 이름 · 코드 없음) · 보내는 동안 [신고] 꺼짐');
  t(B.hidden.has('u9') && B.calls.some(c => c[0] === 'hiddenSave') && ov1.removed && !R.ov() && !errs(B.calls).length, '신고하면 내 화면에서 숨기고 창을 닫는다(같은 Set · 팝업 칸 비움)');
  /* 나 신고로 거절 — 조용히 닫기만 */
  B.calls.length = 0; st.fail = errOf('REPORT_SELF');
  R.openDialog({ friendUserId: 'u8', remoteAwayImg: '' }); const ov2 = R.ov();
  find(D, x => x.type === 'radio' && x.value === 'nick').pop()._on.change[0]();
  await find(D, x => x.textContent === '신고').pop().onclick();
  t(posts(B.calls).length === 1 && ov2.removed && !R.ov() && !errs(B.calls).length && !B.calls.some(c => c[0] === 'toast') && !B.hidden.has('u8'),
    'REPORT_SELF — 조용히 창만 닫음(번호 · 안내 · 숨김 없음)');
  st.fail = null;
  /* 2. admin-report.js */
  t(A && typeof A.rows === 'function' && A.rows({ a: { 1: { kind: 'away' }, 2: { kind: 'nick' }, 3: { kind: 'char' } }, b: { 1: { kind: 'nick' } } }).length === 1,
    'admin-report.js — rows(서로 다른 3명 이상만)');
  const btn = D.made.find(x => x.id === 'lcReportList');
  t(btn && (btn._on.click || []).length === 1, '관리자 [🚩 신고 목록] 버튼을 만들 때 건다');
  await btn._on.click[0]({ stopPropagation(){} }); await flush();
  t(!B.calls.some(c => c[0] === 'listReports'), '관리자가 아니면 안 연다');
  R.openDialog({ friendUserId: 'u7' }); const ovUser = R.ov();
  st.admin = true; st.reports = { x: { 1: { kind: 'nick' }, 2: { kind: 'nick' }, 3: { kind: 'away' } } };
  await btn._on.click[0]({ stopPropagation(){} }); await flush(); await flush();
  const ovAdm = R.ov();
  t(B.calls.some(c => c[0] === 'listReports') && ovUser.removed && ovAdm && ovAdm !== ovUser && ovAdm.attached, '다시 대입된 isAdmin 을 읽고 · 열면 신고 창은 닫히고 팝업 칸을 이어받는다');
  const esc = R.esc(); t(typeof esc === 'function', 'ESC 처리도 팝업 칸에 걸린다');
  esc({ key: 'Escape', stopPropagation(){} });
  t(ovAdm.removed && !R.ov() && !R.esc(), 'ESC — 관리자 목록을 닫고 팝업 칸을 비운다');
  /* 3. app.js 연결 */
  const AP = strip(app);
  t(!/function _openReportDialog|function _openReportAdmin|function _reportAdminRows|function _reportBox|var REPORT_KINDS|bindReportAdmin/.test(AP), 'app.js 에 옮긴 본문이 남지 않았다');
  t(!/\bREPORT_OFF\b/.test(app) && !/\bADMIN_REPORT_OFF\b/.test(app) && /const adminReport = TwAdminReport\.createAdminReport\(\{/.test(app),
    '빈 껍데기 없음 — 신고 창 · 관리자 목록 모두 늘 만든다(모듈은 늘 싣는다 — 가드 걷기 3차)');
  const block = (name) => ((app.match(new RegExp('const ' + name + ' = [^\\n]*\\{\\n([\\s\\S]*?)\\n\\}\\);')) || [])[1] || '').split('\n').map(l => l.trim()).filter(Boolean);
  const dr = block('reportMod'), da = block('adminReport');
  t(dr.length === 8 && dr.includes('reportHiddenUids: hiddenSeatsMod._reportHiddenUids,') && dr.some(l => l.startsWith('reportApi: TwReportApi.createReportApi({ authed: TwApi.authed }),'))
    && dr.includes('notifyError: (...a)=>TwErrorCodes.notify(...a),') && !dr.some(l => /getDisplayName|myFriendCodeKey/.test(l)),
    'deps — 신고 창 여덟(숨김 Set 은 값 · 신고 서버 길 · 오류 번호 · 내 이름 · 친구 코드 키 없음)');
  t(da.length === 11 && da.includes('isAdmin: ()=>isAdmin,') && da.includes('setReportOv: (...a)=>reportMod.setOv(...a),') && da.includes('kinds: reportMod.KINDS,'),
    'deps — 관리자 목록 열하나(isAdmin 은 읽는 함수 · 팝업 칸 · 창 틀은 reportMod 를 거침)');
  const iH = app.indexOf('/* ═══ 🚩 신고하기'), iR = app.indexOf('const reportMod ='), iA2 = app.indexOf('const adminReport =');
  t(iH > 0 && iR > iH && iA2 > iR, '만드는 줄은 원래 자리 · report.js 먼저');
  t(/mk\('🚩 신고하기…', \(\)=>reportMod(?:\(\))?\.openDialog\(seat\)\)/.test(AP) && !/_openReportDialog\(/.test(AP), '좌석 우클릭 메뉴는 reportMod.openDialog');
  const iApi = html.indexOf('<script src="parts/support/report-api.js"></script>'), iCli = html.indexOf('<script src="parts/shared/api-client.js"></script>');
  const iRep = html.indexOf('<script src="parts/support/report.js"></script>'), iAdm = html.indexOf('<script src="parts/admin/admin-report.js"></script>'), iApp = html.indexOf('<script src="parts/app.js"></script>');
  t(iCli > 0 && iApi > iCli && iRep > iApi && iAdm > iRep && iApp > iAdm, 'html — api-client.js → report-api.js → report.js → admin-report.js → app.js');
  return r;
}

(async () => {
  const rows = await judgeAll(REP, ADM, SRC, HTML, RAPI);
  const heads = { 0: '── 0. 🌐 신고 서버 길(report-api.js)', 4: '── 1. 🚩 신고 창(report.js)', 14: '── 2. 🛠️ 관리자 신고 목록(admin-report.js)', 20: '── 3. app.js 연결' };
  rows.forEach(([ok, msg], i) => { if(heads[i]) say(heads[i]); chk(ok, msg); });
  say('── 4. 일부러 깨 보기 — 하나라도 못 잡으면 빨강');
  const breaks = [
    ['신고 뒤에 안 숨김', { rep: s => s.replace('_reportHiddenUids.add(target); _reportHiddenSave();', '_reportHiddenSave();') }],
    ['실패해도 숨김', { rep: s => s.replace('      go.disabled = false;\n      if(rj)', '      _reportHiddenUids.add(target);\n      go.disabled = false;\n      if(rj)') }],
    ['실패를 번호 없이 삼킴', { rep: s => s.replace("else notifyError('E-RPT-01', e);", 'else {}') }],
    ['실패 뒤 [신고] 안 켬', { rep: s => s.replace('      go.disabled = false;\n      if(rj)', '      if(rj)') }],
    ['보내기 전에 [신고] 안 끔', { rep: s => s.replace('    go.disabled = true;\n    try{', '    try{') }],
    ['그림 없음을 오류 번호로', { rep: s => s.replace("  REPORT_NO_AWAY_IMAGE: { close: false, text: '그 분의 자리비움 그림이 이미 없어요' },\n", '') }],
    ['본문에 내 이름을 실음', { rapi: s => s.replace('const body = { target, kind: KIND[kind] };', "const body = { target, kind: KIND[kind], nick: '나닉' };") }],
    ['종류 이름 표 틀림', { rapi: s => s.replace("nick: 'NICKNAME'", "nick: 'NICK'") }],
    ['실패를 성공으로 삼킴', { rapi: s => s.replace('    await authed.post(PATHS.file, body);', '    try{ await authed.post(PATHS.file, body); }catch(_){}') }],
    ['41자도 보냄', { rapi: s => s.replace('if(n.length > NOTE_MAX) throw', 'if(n.length > NOTE_MAX + 1) throw') }],
    ['관리자 목록이 팝업 칸을 안 이어받음', { adm: s => s.replace('document.body.appendChild(ov); setReportOv(ov);', 'document.body.appendChild(ov);') }],
    ['관리자 목록이 신고 창을 안 닫음', { adm: s => s.replace('  _reportClose();\n  const { ov, body } = _reportBox(\'🚩 신고 목록\', 460);', "  const { ov, body } = _reportBox('🚩 신고 목록', 460);") }],
    ['관리자 확인을 값으로 붙잡음', { adm: s => s.replace('const isAdmin = deps.isAdmin;', 'const isAdmin = ((v)=>()=>v)(deps.isAdmin());') }],
    ['메뉴가 옛 이름', { app: s => s.replace('()=>reportMod().openDialog(seat)', '()=>_openReportDialog(seat)') }],
    ['html 순서 틀림', { html: s => s.replace('<script src="parts/support/report.js"></script>', '').replace('<script src="parts/app.js"></script>', '<script src="parts/support/report.js"></script>\n<script src="parts/app.js"></script>') }],
    ['deps 하나 빠짐', { app: s => s.replace('  setReportEsc: (...a)=>reportMod.setEsc(...a),\n', '') }],
  ];
  for(const [name, f] of breaks){
    const r2 = f.rep ? f.rep(REP) : REP, a2 = f.adm ? f.adm(ADM) : ADM, p2 = f.app ? f.app(SRC) : SRC, h2 = f.html ? f.html(HTML) : HTML, q2 = f.rapi ? f.rapi(RAPI) : RAPI;
    const changed = r2 !== REP || a2 !== ADM || p2 !== SRC || h2 !== HTML || q2 !== RAPI;
    let rows2; try{ rows2 = await judgeAll(r2, a2, p2, h2, q2); }catch(_){ rows2 = [[false, '던짐']]; }
    chk(changed && rows2.some(([ok]) => !ok), name + (changed ? '' : ' — 바꿀 글을 못 찾음'));
  }
  say(`\n${fail ? '✗' : '✓'} 통과 ${pass} · 실패 ${fail}`);
  process.exit(fail ? 1 : 0);
})();
