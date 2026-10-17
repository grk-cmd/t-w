/* ═══ 🚩 sim-report.js — 신고하기 모듈 둘 (2026-10-14 신설 · 앱 FSD 11번) ═══════════════
   app.js «🚩 신고하기» 를 report.js(신고 창 · 공용 도우미 · 팝업 칸)와 admin/admin-report.js(관리자 신고 목록)로 나눠 옮겼다.
   신고 규칙 · 문구는 sim-report-away.js 가 본다. 여기서는 모듈 모양 · 팝업 칸 나눠 쓰기 · app.js 연결을 본다 — 가짜 DOM 위에서 굴린다.
   ・1절: report.js — 내놓는 이름 · 정보 없는 좌석 · 나 자신 · 기타는 글 필요 · 신고 = reportUser(대상, 나, 사유 · 닉 · 코드 4) · 숨김 · 창 닫힘
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
const ADM = ['admin-report.js', 'parts/admin/admin-report.js', 'app/parts/admin/admin-report.js'].map(read).find(Boolean);
if(!REP){ say('  ? 원본 못 찾음 — report.js'); process.exit(2); }
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
function build(rep, adm, st){
  const D = makeDom(), calls = [];
  const fb = { reportUser: async (...a) => { calls.push(['reportUser', ...a]); return { ok: true }; },
    listReports: async () => { calls.push(['listReports']); return { ok: true, reports: st.reports || {} }; }, getUserBrief: async () => ({}) };
  const win = { firebaseAPI: fb };
  const ls = { getItem: () => 'MATE-AB12' };
  const hidden = new Set();
  const run = (src, glob) => new Function('window', 'document', 'firebaseAPI', 'localStorage', 'module', src + '\nreturn window.' + glob + ';')(win, D.document, fb, ls, undefined);
  const R = run(rep, 'TwReport').createReport({ toast: (m) => calls.push(['toast', m]), getMyUserId: () => st.me, seatLabelName: () => '콩떡', awayUrlOk: (u) => !!u,
    getDisplayName: () => '나닉', reportHiddenSave: () => calls.push(['hiddenSave']), reportHiddenUids: hidden, myFriendCodeKey: 'tw.myFriendCode' });
  const A = run(adm, 'TwAdminReport').createAdminReport({ toast: (m) => calls.push(['toast', m]), awayUrlOk: (u) => !!u, isAdmin: () => st.admin,
    reportClose: (...a) => R.close(...a), reportBox: (...a) => R.box(...a), kinds: R.KINDS, adminMin: R.ADMIN_MIN,
    reportOv: (...a) => R.ov(...a), setReportOv: (...a) => R.setOv(...a), reportEsc: (...a) => R.esc(...a), setReportEsc: (...a) => R.setEsc(...a) });
  return { R, A, D, calls, hidden };
}
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
  t(!B.calls.some(c => c[0] === 'reportUser'), '기타는 글이 있어야 신고한다');
  etc.value = ' 욕설 '; await go.onclick();
  const ru = B.calls.find(c => c[0] === 'reportUser');
  t(ru && ru[1] === 'u9' && ru[2] === 'me1' && ru[3].kind === 'etc' && ru[3].note === '욕설' && ru[3].nick === '나닉' && ru[3].code4 === 'AB12',
    '신고 = reportUser(대상, 나, { 사유 · 메모 · 닉네임 · 코드 뒷 4자리 })');
  t(B.hidden.has('u9') && B.calls.some(c => c[0] === 'hiddenSave') && ov1.removed && !R.ov(), '신고하면 내 화면에서 숨기고 창을 닫는다(같은 Set · 팝업 칸 비움)');
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
  t(dr.length === 8 && (dr.includes('reportHiddenUids: _reportHiddenUids,') || dr.includes('reportHiddenUids: hiddenSeatsMod._reportHiddenUids,'))   /* 숨김 Set 은 hidden-seats.js 로 옮겼다(앱 FSD 43번) — 모듈이 내놓은 같은 Set */ && dr.includes('myFriendCodeKey: MY_FRIEND_CODE_KEY,'), 'deps — 신고 창 여덟(숨김 Set · 친구 코드 키는 값)');
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
  const heads = { 0: '── 1. 🚩 신고 창(report.js)', 7: '── 2. 🛠️ 관리자 신고 목록(admin-report.js)', 13: '── 3. app.js 연결' };
  rows.forEach(([ok, msg], i) => { if(heads[i]) say(heads[i]); chk(ok, msg); });
  say('── 4. 일부러 깨 보기 — 하나라도 못 잡으면 빨강');
  const breaks = [
    ['신고 뒤에 안 숨김', { rep: s => s.replace('_reportHiddenUids.add(target); _reportHiddenSave();', '_reportHiddenSave();') }],
    ['코드 뒷자리 대신 전체', { rep: s => s.replace(".slice(-4); }catch(_){ return ''; }", "; }catch(_){ return ''; }") }],
    ['관리자 목록이 팝업 칸을 안 이어받음', { adm: s => s.replace('document.body.appendChild(ov); setReportOv(ov);', 'document.body.appendChild(ov);') }],
    ['관리자 목록이 신고 창을 안 닫음', { adm: s => s.replace('  _reportClose();\n  const { ov, body } = _reportBox(\'🚩 신고 목록\', 460);', "  const { ov, body } = _reportBox('🚩 신고 목록', 460);") }],
    ['관리자 확인을 값으로 붙잡음', { adm: s => s.replace('const isAdmin = deps.isAdmin;', 'const isAdmin = ((v)=>()=>v)(deps.isAdmin());') }],
    ['메뉴가 옛 이름', { app: s => s.replace('()=>reportMod().openDialog(seat)', '()=>_openReportDialog(seat)') }],
    ['html 순서 틀림', { html: s => s.replace('<script src="parts/support/report.js"></script>', '').replace('<script src="parts/app.js"></script>', '<script src="parts/support/report.js"></script>\n<script src="parts/app.js"></script>') }],
    ['deps 하나 빠짐', { app: s => s.replace('  setReportEsc: (...a)=>reportMod.setEsc(...a),\n', '') }],
  ];
  for(const [name, f] of breaks){
    const r2 = f.rep ? f.rep(REP) : REP, a2 = f.adm ? f.adm(ADM) : ADM, p2 = f.app ? f.app(SRC) : SRC, h2 = f.html ? f.html(HTML) : HTML;
    const changed = r2 !== REP || a2 !== ADM || p2 !== SRC || h2 !== HTML;
    let rows2; try{ rows2 = await judgeAll(r2, a2, p2, h2); }catch(_){ rows2 = [[false, '던짐']]; }
    chk(changed && rows2.some(([ok]) => !ok), name + (changed ? '' : ' — 바꿀 글을 못 찾음'));
  }
  say(`\n${fail ? '✗' : '✓'} 통과 ${pass} · 실패 ${fail}`);
  process.exit(fail ? 1 : 0);
})();
