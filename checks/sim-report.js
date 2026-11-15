/* ═══ 🚩 sim-report.js — 신고하기 모듈 둘 (2026-10-14 신설 · 앱 FSD 11번) ═══════════════
   app.js «🚩 신고하기» 를 report.js(신고 창 · 공용 도우미 · 팝업 칸)와 admin/admin-report.js(관리자 신고 목록)로 나눠 옮겼다.
   신고 규칙 · 문구는 sim-report-away.js 가 본다. 여기서는 모듈 모양 · 팝업 칸 나눠 쓰기 · app.js 연결을 본다 — 가짜 DOM 위에서 굴린다.
   ・1절: report.js — 내놓는 이름 · 정보 없는 좌석 · 나 자신 · 기타는 글 필요 · 신고 = POST /v2/reports { target, kind, note? }(내 이름 · 코드 없음) · 숨김 · 창 닫힘 ·
          실패 = 숨김 0 + 번호(로그인 안 됨 = 옛 문구 · 그 밖 공통 code 는 E-NET · 그 밖 E-RPT-01) + [신고] 다시 켬 + 다시 안 보냄 · REPORT_NO_AWAY_IMAGE · REPORT_NOTE_REQUIRED = 안내 · REPORT_SELF = 조용히 닫음
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
const AERR = ['api-errors.js', 'parts/shared/api-errors.js', 'app/parts/shared/api-errors.js'].map(read).find(Boolean);
const ADM = ['admin-report.js', 'parts/admin/admin-report.js', 'app/parts/admin/admin-report.js'].map(read).find(Boolean);
if(!REP){ say('  ? 원본 못 찾음 — report.js'); process.exit(2); }
if(!ADM){ say('  ? 원본 못 찾음 — admin-report.js'); process.exit(2); }
if(!RAPI || !AERR){ say('  ? 원본 못 찾음 — report-api.js · api-errors.js'); process.exit(2); }
let RAPI_CUR = RAPI;   // 깨 보기가 report-api.js 를 바꿔 끼우는 자리
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
function build(rep, adm, st){
  const D = makeDom(), calls = [];
  const fb = {
    listReports: async () => { calls.push(['listReports']); return { ok: true, reports: st.reports || {} }; }, getUserBrief: async () => ({}) };
  const win = { firebaseAPI: fb };
  const ls = { getItem: () => 'MATE-AB12' };
  const hidden = new Set();
  const run = (src, glob) => new Function('window', 'document', 'firebaseAPI', 'localStorage', 'module', src + '\nreturn window.' + glob + ';')(win, D.document, fb, ls, undefined);
  const authed = { post: async (path, body) => { calls.push(['post', path, body]); if(st.fail) throw st.fail; return null; } };
  const AE = run(AERR, 'TwApiErrors');
  const notifyError = (code, err) => { calls.push(['notify', code, err && err.code]); return true; };
  const R = run(rep, 'TwReport').createReport({ toast: (m) => calls.push(['toast', m]), getMyUserId: () => st.me, seatLabelName: () => '콩떡', awayUrlOk: (u) => !!u,
    reportHiddenSave: () => calls.push(['hiddenSave']), reportHiddenUids: hidden,
    reportApi: run(RAPI_CUR, 'TwReportApi').createReportApi({ authed, errs: AE }), apiErrors: AE.createApiErrors({ notifyError }), notifyError });
  const A = run(adm, 'TwAdminReport').createAdminReport({ toast: (m) => calls.push(['toast', m]), awayUrlOk: (u) => !!u, isAdmin: () => st.admin,
    reportClose: (...a) => R.close(...a), reportBox: (...a) => R.box(...a), kinds: R.KINDS, adminMin: R.ADMIN_MIN,
    reportOv: (...a) => R.ov(...a), setReportOv: (...a) => R.setOv(...a), reportEsc: (...a) => R.esc(...a), setReportEsc: (...a) => R.setEsc(...a) });
  return { R, A, D, calls, hidden };
}
const run0 = (src, glob) => new Function('window', 'module', src + '\nreturn window.' + glob + ';')({}, undefined);
const find = (D, pred) => D.made.filter(pred);
const flush = () => new Promise(r => setImmediate(r));

async function judgeAll(rep, adm, app, html){
  const r = [];
  const t = (ok, msg) => r.push([!!ok, msg]);
  const st = { me: 'me1', admin: false };
  let B;
  try{ B = build(rep, adm, st); }catch(e){ t(false, '모듈을 만들 수 없다 — ' + e.message); return r; }
  const { R, A, D } = B;
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
  const posts = () => B.calls.filter(c => c[0] === 'post');
  t(posts().length === 0, '기타는 글이 있어야 신고한다(요청 0)');
  const ApiErr = (kind, status, code) => Object.assign(new Error(code), { kind, status, code });
  /* 실패 — 숨김 0 · [신고] 다시 켬 · 번호 한 번 · 다시 안 보냄 */
  st.fail = ApiErr('unavailable', 0, 'NETWORK'); etc.value = ' 욕설 '; await go.onclick();
  t(posts().length === 1 && !B.hidden.has('u9') && !go.disabled && !ov1.removed && B.calls.filter(c => c[0] === 'notify').length === 1 && B.calls.find(c => c[0] === 'notify')[1] === 'E-NET-07',
    '닿지 못함 — 숨기지 않음 · [신고] 다시 켬 · 공통 번호 E-NET-07 한 번 · 요청 한 번(자동 재시도 없음)');
  st.fail = ApiErr('auth', 401, 'AUTH_REQUIRED'); B.calls.length = 0; await go.onclick();
  t(B.calls.some(c => c[0] === 'toast' && c[1] === '로그인한 뒤에 신고할 수 있어요') && !B.calls.some(c => c[0] === 'notify') && !B.hidden.has('u9') && !go.disabled, '로그인 안 됨(AUTH_REQUIRED) — 옛 문구 «로그인한 뒤에 신고할 수 있어요» · 번호 없음 · 숨김 0');
  st.fail = ApiErr('auth', 0, 'NO_TOKEN'); B.calls.length = 0; await go.onclick();
  t(B.calls.some(c => c[0] === 'toast' && c[1] === '로그인한 뒤에 신고할 수 있어요') && !B.calls.some(c => c[0] === 'notify'), '  ↳ 토큰 없음(NO_TOKEN)도 같은 문구');
  st.fail = ApiErr('request', 400, 'SOMETHING_NEW'); B.calls.length = 0; await go.onclick();
  t(B.calls.filter(c => c[0] === 'notify').map(c => c[1]).join() === 'E-RPT-01' && !go.disabled, '표에 없는 서버 오류 — E-RPT-01 · [신고] 다시 켬');
  st.fail = ApiErr('request', 409, 'REPORT_NO_AWAY_IMAGE'); B.calls.length = 0; await go.onclick();
  t(B.calls.some(c => c[0] === 'toast' && /자리비움 그림이 이미 없어요/.test(c[1])) && !B.calls.some(c => c[0] === 'notify') && !B.hidden.has('u9'), 'REPORT_NO_AWAY_IMAGE — 안내 문구 · 번호 없음');
  st.fail = ApiErr('request', 400, 'REPORT_NOTE_REQUIRED'); B.calls.length = 0; await go.onclick();
  t(B.calls.some(c => c[0] === 'toast' && /사유를 적어/.test(c[1])) && !B.calls.some(c => c[0] === 'notify'), 'REPORT_NOTE_REQUIRED — 안내 문구 · 번호 없음');
  st.fail = ApiErr('request', 400, 'REPORT_SELF'); B.calls.length = 0; await go.onclick();
  t(ov1.removed && !R.ov() && !B.calls.some(c => c[0] === 'notify') && !B.hidden.has('u9'), 'REPORT_SELF — 조용히 닫음(숨김 0 · 번호 0)');
  /* 성공 */
  R.openDialog({ friendUserId: 'u9', remoteAwayImg: '' });
  const ov2 = R.ov(), radios2 = find(D, x => x.type === 'radio').slice(-4), go2 = find(D, x => x.textContent === '신고').pop(), etc2 = find(D, x => x.type === 'text').pop();
  st.fail = null; B.calls.length = 0;
  radios2.find(x => x.value === 'etc')._on.change[0](); etc2.value = ' 욕설 '; await go2.onclick();
  const po = posts();
  t(po.length === 1 && po[0][1] === '/v2/reports' && JSON.stringify(po[0][2]) === JSON.stringify({ target: 'u9', kind: 'ETC', note: '욕설' }),
    '신고 = POST /v2/reports { target, kind(서버 이름), note } — 내 이름 · 코드 칸 없음');
  t(B.hidden.has('u9') && B.calls.some(c => c[0] === 'hiddenSave') && ov2.removed && !R.ov(), '성공하면 내 화면에서 숨기고 창을 닫는다(같은 Set · 팝업 칸 비움)');
  /* report-api.js — 틀린 값은 요청 0 */
  {
    const bad = [];
    const RA = run0(RAPI_CUR, 'TwReportApi');
    const api0 = RA.createReportApi({ authed: { post: async () => { bad.push('post'); } }, errs: run0(AERR, 'TwApiErrors') });
    const codes = [];
    for(const args of [['', 'etc', 'x'], ['u1', 'bogus', ''], ['u1', 'etc', 'x'.repeat(41)]]){ try{ await api0.file(...args); }catch(e){ codes.push(e.code); } }
    t(bad.length === 0 && codes.join() === 'INVALID,INVALID,INVALID', '틀린 값(대상 없음 · 모르는 사유 · 40자 넘는 글)은 요청 없이 INVALID 로 던진다');
  }
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
  t(dr.length === 9 && (dr.includes('reportHiddenUids: _reportHiddenUids,') || dr.includes('reportHiddenUids: hiddenSeatsMod._reportHiddenUids,'))   /* 숨김 Set 은 hidden-seats.js 로 옮겼다(앱 FSD 43번) — 모듈이 내놓은 같은 Set */ && dr.some(l => /^reportApi: TwReportApi\.createReportApi\(\{ authed: TwApi\.authed, errs: TwApiErrors \}\),$/.test(l)) && dr.includes('apiErrors: TwApiErrors.store,') && dr.includes('notifyError: (...a)=>TwErrorCodes.notify(...a),'), 'deps — 신고 창 아홉(숨김 Set · 신고 서버 길 · 공통 오류표 · 번호 알림)');
  t(da.length === 11 && da.includes('isAdmin: ()=>isAdmin,') && da.includes('setReportOv: (...a)=>reportMod.setOv(...a),') && da.includes('kinds: reportMod.KINDS,'),
    'deps — 관리자 목록 열하나(isAdmin 은 읽는 함수 · 팝업 칸 · 창 틀은 reportMod 를 거침)');
  const iH = app.indexOf('/* ═══ 🚩 신고하기'), iR = app.indexOf('const reportMod ='), iA2 = app.indexOf('const adminReport =');
  t(iH > 0 && iR > iH && iA2 > iR, '만드는 줄은 원래 자리 · report.js 먼저');
  t(/mk\('🚩 신고하기…', \(\)=>reportMod(?:\(\))?\.openDialog\(seat\)\)/.test(AP) && !/_openReportDialog\(/.test(AP), '좌석 우클릭 메뉴는 reportMod.openDialog');
  const iRep = html.indexOf('<script src="parts/support/report.js"></script>'), iAdm = html.indexOf('<script src="parts/admin/admin-report.js"></script>'), iApp = html.indexOf('<script src="parts/app.js"></script>');
  t(iRep > 0 && iAdm > iRep && iApp > iAdm, 'html — report.js → admin-report.js → app.js');
  return r;
}

(async () => {
  const rows = await judgeAll(REP, ADM, SRC, HTML);
  const heads = [[0, '── 1. 🚩 신고 창(report.js · report-api.js)'], [rows.findIndex(([, m]) => /^admin-report\.js — rows/.test(m)), '── 2. 🛠️ 관리자 신고 목록(admin-report.js)'],
    [rows.findIndex(([, m]) => /^app\.js 에 옮긴 본문/.test(m)), '── 3. app.js 연결']];
  rows.forEach(([ok, msg], i) => { const h = heads.find(x => x[0] === i); if(h) say(h[1]); chk(ok, msg); });
  say('── 4. 일부러 깨 보기 — 하나라도 못 잡으면 빨강');
  const breaks = [
    ['신고 뒤에 안 숨김', { rep: s => s.replace('_reportHiddenUids.add(target); _reportHiddenSave();', '_reportHiddenSave();') }],
    ['실패해도 숨김', { rep: s => s.replace("      return;\n    }\n    _reportHiddenUids.add(target);", "    }\n    _reportHiddenUids.add(target);") }],
    ['사유 이름 → 서버 이름 표가 틀림', { rapi: s => s.replace("etc: 'ETC'", "etc: 'OTHER'") }],
    ['로그인 안 됨을 옛 문구로 안 보임', { rapi: s => s.replace('  AUTH_REQUIRED: row(FAIL.LOGIN),\n', '') }],
    ['모르는 서버 오류에 번호 없음', { rep: s => s.replace("else notifyError('E-RPT-01', e);", "else{}") }],
    ['보내기 전 검사 없음(빈 대상도 보냄)', { rapi: s => s.replace("if(typeof target !== 'string' || !target) throw invalid('대상 없음');", '') }],
    ['관리자 목록이 팝업 칸을 안 이어받음', { adm: s => s.replace('document.body.appendChild(ov); setReportOv(ov);', 'document.body.appendChild(ov);') }],
    ['관리자 목록이 신고 창을 안 닫음', { adm: s => s.replace('  _reportClose();\n  const { ov, body } = _reportBox(\'🚩 신고 목록\', 460);', "  const { ov, body } = _reportBox('🚩 신고 목록', 460);") }],
    ['관리자 확인을 값으로 붙잡음', { adm: s => s.replace('const isAdmin = deps.isAdmin;', 'const isAdmin = ((v)=>()=>v)(deps.isAdmin());') }],
    ['메뉴가 옛 이름', { app: s => s.replace('()=>reportMod().openDialog(seat)', '()=>_openReportDialog(seat)') }],
    ['html 순서 틀림', { html: s => s.replace('<script src="parts/support/report.js"></script>', '').replace('<script src="parts/app.js"></script>', '<script src="parts/support/report.js"></script>\n<script src="parts/app.js"></script>') }],
    ['deps 하나 빠짐', { app: s => s.replace('  setReportEsc: (...a)=>reportMod.setEsc(...a),\n', '') }],
  ];
  for(const [name, f] of breaks){
    const r2 = f.rep ? f.rep(REP) : REP, a2 = f.adm ? f.adm(ADM) : ADM, p2 = f.app ? f.app(SRC) : SRC, h2 = f.html ? f.html(HTML) : HTML;
    RAPI_CUR = f.rapi ? f.rapi(RAPI) : RAPI;
    const changed = RAPI_CUR !== RAPI || r2 !== REP || a2 !== ADM || p2 !== SRC || h2 !== HTML;
    let rows2; try{ rows2 = await judgeAll(r2, a2, p2, h2); }catch(_){ rows2 = [[false, '던짐']]; }
    chk(changed && rows2.some(([ok]) => !ok), name + (changed ? '' : ' — 바꿀 글을 못 찾음'));
  }
  RAPI_CUR = RAPI;
  say(`\n${fail ? '✗' : '✓'} 통과 ${pass} · 실패 ${fail}`);
  process.exit(fail ? 1 : 0);
})();
