/* ═══ 🚩 sim-report.js — 신고 서버 길 · 신고하기 모듈 둘 ═══════════════
   report-api.js(신고 provider — POST /v2/reports · 관리자 /v2/admin/reports*) · report.js(신고 창 · 공용 도우미 · 팝업 칸) · admin/admin-report.js(관리자 신고 목록).
   신고 규칙 · 문구는 sim-report-away.js 가 본다. 여기서는 provider 본문 · 신고 창의 성공 / 실패 · 팝업 칸 나눠 쓰기 · app.js 연결을 본다 — 가짜 DOM · 가짜 통로 위에서 굴린다.
   ・0절: report-api.js — 사유 이름 → 서버 종류 이름 표 · 본문 = { target, kind, note? }(내 이름 · 코드 없음) · 틀린 값은 요청 0 · 실패는 그대로 던짐 ·
          failOf — 기능 표 갈래 · 공통 code · 닿지 못함 → common · 그 밖 → site(진짜 api-errors.js 로)
   ・1절: report.js — 내놓는 이름 · 정보 없는 좌석 · 나 자신 · 기타는 글 필요 · 보내는 동안 [신고] 꺼짐 · 성공 = 숨김 · 창 닫힘 ·
          실패 = 숨김 0 + E-RPT-01 한 번 + [신고] 다시 켬 · REPORT_NO_AWAY_IMAGE · REPORT_NOTE_REQUIRED = 안내(번호 0) · REPORT_SELF = 조용히 닫음 ·
          공통 code(로그인 풀림 · 닿지 못함) = 공통 표 번호(E-NET) — E-RPT-01 아님
   ・2절: 관리자 신고 목록 — provider(서버 줄 → 화면 줄 · 쪽 · 문제없음 · 그림 내리기 · 갈래) · 관리자 아니면 안 염(다시 대입된 isAdmin) ·
          열면 신고 창이 닫히고 팝업 칸을 이어받음 · 받음 / 빈 목록 / 못 받음(E-ADM-30 · [다시 시도]) · 공통 code 는 공통 표 · [더 보기] ·
          [문제없음](E-ADM-31) · [그림 내리기](REPORT_IMAGE_CHANGED → 다시 받기 · 그 밖 E-ADM-32) · 닫은 창에 늦은 답 안 그림 · ESC 로 닫힘
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
if(!RAPI){ say('  ? 원본 못 찾음 — report-api.js'); process.exit(2); }
if(!AERR){ say('  ? 원본 못 찾음 — api-errors.js'); process.exit(2); }
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
  return {
    post: (path, body) => {
      calls.push(['post', path, body]);
      if(st.hold) return new Promise((res, rej) => { st.release = () => (st.fail ? rej(st.fail) : res(null)); });
      if(st.fail) return Promise.reject(st.fail);
      return Promise.resolve(st.postData ? st.postData(path, body) : null);
    },
    /* 관리자 목록 읽기 — st.pages[cursor || ''] 를 돌려준다 · st.getFail 이면 거절 · st.getHold 면 풀어 줄 때까지 붙잡는다 */
    get: (path, opts) => {
      calls.push(['get', path, opts]);
      const m = /[?&]cursor=([^&]*)/.exec(path), key = m ? decodeURIComponent(m[1]) : '';
      const answer = () => (st.getFail ? Promise.reject(st.getFail) : Promise.resolve((st.pages || {})[key]));
      if(st.getHold) return new Promise((res) => { st.getRelease = () => res(answer()); (st.held = st.held || []).push(st.getRelease); });
      return answer();
    },
  };
}
function build(rep, adm, st, rapi){
  const D = makeDom(), calls = [];
  const win = {};
  const hidden = new Set();
  const safe = { safeUrl: (u) => u };   // 진짜 escape 는 sim-safe-html.js 가 본다
  const run = (src, glob) => new Function('window', 'document', 'TwSafeHtml', 'module', src + '\nreturn window.' + glob + ';')(win, D.document, safe, undefined);
  const RA = run(rapi, 'TwReportApi');
  /* 진짜 공통 표 — 번호 토스트만 가짜(어느 번호로 갔는지 적는다) */
  const notifyError = (code, e) => { calls.push(['notifyError', code, e]); return true; };
  const ERRS = new Function('module', AERR + '\nreturn module.exports;')({ exports: {} });
  const R = run(rep, 'TwReport').createReport({ toast: (m) => calls.push(['toast', m]), getMyUserId: () => st.me, seatLabelName: () => '콩떡', awayUrlOk: (u) => !!u,
    reportHiddenSave: () => calls.push(['hiddenSave']), reportHiddenUids: hidden,
    reportApi: RA.createReportApi({ authed: fakeAuthed(st, calls), errs: ERRS }), apiErrors: ERRS.createApiErrors({ notifyError }), notifyError });
  const A = run(adm, 'TwAdminReport').createAdminReport({ toast: (m) => calls.push(['toast', m]), awayUrlOk: (u) => typeof u === 'string' && u.indexOf(OK_IMG) === 0, isAdmin: () => st.admin,
    reportClose: (...a) => R.close(...a), reportBox: (...a) => R.box(...a), kinds: R.KINDS, adminMin: R.ADMIN_MIN,
    reportOv: (...a) => R.ov(...a), setReportOv: (...a) => R.setOv(...a), reportEsc: (...a) => R.esc(...a), setReportEsc: (...a) => R.setEsc(...a),
    adminApi: RA.createAdminReportApi({ authed: fakeAuthed(st, calls), errs: ERRS }), apiErrors: ERRS.createApiErrors({ notifyError }), notifyError });
  return { R, A, D, calls, hidden, RA, ERRS };
}
const find = (D, pred) => D.made.filter(pred);
const OK_IMG = 'https://ok/';
const flush = () => new Promise(r => setImmediate(r));

const errOf = (code) => Object.assign(new Error(code), { code, kind: 'server' });
const posts = (calls) => calls.filter(c => c[0] === 'post');
const gets = (calls) => calls.filter(c => c[0] === 'get');
/* 서버 대상 줄 하나(계약 모양) */
const srvTarget = (code, o) => Object.assign({ target: code, displayName: '이름' + code, friendCode: 'FC-' + code, awayImage: null, openCount: 3, byKind: { NICKNAME: 3 },
  reporters: [
    { userCode: 'ua0001', displayName: '갑', friendCode: 'AAAA-1111', nameSnapshot: '갑옛', kind: 'NICKNAME', note: null, at: '2026-11-10T01:00:00Z' },
    { userCode: 'ub0002', displayName: null, friendCode: null, nameSnapshot: null, kind: 'ETC', note: '욕설', at: '2026-11-11T01:00:00Z' },
    { userCode: 'uc0003', displayName: '병', friendCode: 'CCCC-3333', nameSnapshot: null, kind: 'MYSTERY', note: null, at: '2026-11-09T01:00:00Z' },
  ] }, o || {});
const errs = (calls) => calls.filter(c => c[0] === 'notifyError');

async function judgeAll(rep, adm, app, html, rapi){
  const r = [];
  const t = (ok, msg) => r.push(ok === '§' ? ['§', msg] : [!!ok, msg]);
  const st = { me: 'me1', admin: false };
  let B;
  try{ B = build(rep, adm, st, rapi); }catch(e){ t(false, '모듈을 만들 수 없다 — ' + e.message); return r; }
  const { R, A, D, RA, ERRS } = B;
  /* 0. report-api.js — 진짜 함수를 부른다 */
  t('§', '── 0. 🌐 신고 서버 길(report-api.js)');
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
    const c0 = [], s0 = {}, api0 = RA.createReportApi({ authed: fakeAuthed(s0, c0), errs: ERRS });
    let e0 = null; try{ await api0.file('u9', 'spam', ''); }catch(e){ e0 = e; }
    await api0.file('u9', 'nick', '');
    s0.fail = errOf('REPORT_SELF'); let e1 = null; try{ await api0.file('u9', 'char', ''); }catch(e){ e1 = e; }
    t(e0 && e0.code === 'INVALID' && c0.length === 2 && c0[0][1] === '/v2/reports' && same(c0[0][2], { target: 'u9', kind: 'NICKNAME' }) && e1 === s0.fail,
      'report-api — file: 틀린 값은 요청 0 · POST /v2/reports 한 번 · 실패는 받은 오류 그대로 던짐(다시 보내지 않음)');
  }
  {
    const f = (e) => RA.failOf(e, ERRS);
    t(f(errOf('REPORT_SELF')) === 'self' && f(errOf('REPORT_NO_AWAY_IMAGE')) === 'noAwayImage' && f(errOf('REPORT_NOTE_REQUIRED')) === 'noteRequired'
      && f(Object.assign(new Error('x'), { code: 'INVALID' })) === 'site',
      'report-api — failOf: 서버 거절 code 셋 → self · noAwayImage · noteRequired · 보내기 전 막은 값 → site');
    t(f(errOf('AUTH_REQUIRED')) === 'common' && f(errOf('USER_CODE_NOT_BOUND')) === 'common' && f(errOf('TOO_MANY_REQUESTS')) === 'common'
      && f(Object.assign(new Error('x'), { code: 'NETWORK', kind: 'unavailable' })) === 'common' && f(errOf('INTERNAL_ERROR')) === 'site' && f(errOf('USER_NOT_FOUND')) === 'site',
      'report-api — failOf: 공통 code · 닿지 못함 → common · 기능 표 · 공통 표 둘 다 없는 code → site');
  }
  /* 1. report.js */
  t('§', '── 1. 🚩 신고 창(report.js)');
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
  B.calls.length = 0; st.fail = errOf('REPORT_NOTE_REQUIRED'); await go.onclick();
  t(posts(B.calls).length === 1 && !errs(B.calls).length && B.calls.some(c => c[0] === 'toast' && c[1] === '사유를 적어 주세요') && B.hidden.size === 0 && !go.disabled && R.ov() === ov1,
    'REPORT_NOTE_REQUIRED — 안내 문구(번호 없음) · 숨기지 않음 · [신고] 다시 켬');
  /* 공통 code — 공통 표 번호(로그인 풀림 E-NET-01 · 닿지 못함 E-NET-07)로, E-RPT-01 아님 */
  B.calls.length = 0; st.fail = errOf('AUTH_REQUIRED'); await go.onclick();
  const e1 = errs(B.calls).map(c => c[1]).join();
  B.calls.length = 0; st.fail = Object.assign(new Error('x'), { code: 'NETWORK', kind: 'unavailable' }); await go.onclick();
  const e2 = errs(B.calls).map(c => c[1]).join();
  t(e1 === 'E-NET-01' && e2 === 'E-NET-07' && B.hidden.size === 0 && !go.disabled && R.ov() === ov1,
    '공통 code — 로그인 풀림은 E-NET-01 · 닿지 못함은 E-NET-07(공통 표) · 숨기지 않음 · [신고] 다시 켬');
  /* 성공 — 보내는 동안 [신고] 꺼짐 · 본문은 { target, kind, note } 만 */
  B.calls.length = 0; st.fail = null; st.hold = true;
  const pend = go.onclick();
  const busy = go.disabled; st.release(); st.hold = false; await pend;
  const sent = posts(B.calls);
  t(busy && sent.length === 1 && sent[0][1] === '/v2/reports' && same(sent[0][2], { target: 'u9', kind: 'ETC', note: '욕설' }),
    '신고 = POST /v2/reports { target, kind, note } 한 번(내 이름 · 코드 없음) · 보내는 동안 [신고] 꺼짐');
  t(B.hidden.has('u9') && B.calls.some(c => c[0] === 'hiddenSave') && ov1.removed && !R.ov() && !errs(B.calls).length, '신고하면 내 화면에서 숨기고 창을 닫는다(같은 Set · 팝업 칸 비움)');
  /* 나 신고로 거절 — 조용히 닫기만 */
  B.calls.length = 0; st.fail = errOf('REPORT_SELF');
  R.openDialog({ friendUserId: 'u8', remoteAwayImg: '' }); const ov2 = R.ov();
  find(D, x => x.type === 'radio' && x.value === 'nick').pop()._on.change[0]();
  await find(D, x => x.textContent === '신고').pop().onclick();
  t(posts(B.calls).length === 1 && ov2.removed && !R.ov() && !errs(B.calls).length && !B.calls.some(c => c[0] === 'toast') && !B.hidden.has('u8'),
    'REPORT_SELF — 조용히 창만 닫음(번호 · 안내 · 숨김 없음)');
  st.fail = null;
  /* 2. 관리자 신고 목록 — provider 를 먼저 돌려 보고 화면을 굴린다 */
  t('§', '── 2. 🛠️ 관리자 신고 목록(report-api.js 관리자 길 · admin-report.js)');
  {
    const row = RA.targetOf(srvTarget('ux1', { awayImage: { url: OK_IMG + 'a.webp', size: 80 }, openCount: 4 }));
    t(row && row.target === 'ux1' && row.name === '이름ux1' && row.awayImg === OK_IMG + 'a.webp' && row.count === 4 && row.reporters.length === 3
      && row.reporters.map(x => x.code).join() === 'ub0002,ua0001,uc0003' && row.reporters[0].kind === 'etc' && row.reporters[0].note === '욕설'
      && row.reporters[0].name === null && row.reporters[1].kind === 'nick' && row.reporters[2].kind === null,
      'report-api — 서버 대상 줄 → 화면 줄(이름 · 그림 주소 · 수 = openCount · 신고자 최근 것이 위 · 종류 이름 되돌림 · 모르는 종류는 null)');
    t(row.friendCode === 'FC-ux1' && row.reporters[1].friendCode === 'AAAA-1111' && row.reporters[0].friendCode === null
      && row.reporters[1].name === '갑옛' && row.reporters[2].name === '병' && RA.targetOf(srvTarget('uz', { friendCode: null })).friendCode === null,
      'report-api — 친구 코드(대상 · 신고자 · 탈퇴면 null) · 신고자 이름은 신고할 때 이름(nameSnapshot)이 먼저 · 없으면 지금 이름');
    const pt = RA.pageOf({ items: [], nextCursor: null, total: 7 }), pn = RA.pageOf({ items: [], nextCursor: 'x', total: null });
    t(pt.total === 7 && pn.total === null && RA.pageOf({ items: [], nextCursor: null, total: -1 }).total === null && RA.pageOf({ items: [] }).total === null,
      'report-api — total(첫 쪽의 전체 수) · cursor 쪽 · 빠짐 · 틀린 값은 null');
    const p0 = RA.pageOf({ items: [], nextCursor: null });
    const thrownCode = (f) => { try{ f(); return null; }catch(e){ return e.code; } };
    t(p0.items.length === 0 && p0.next === null && thrownCode(() => RA.pageOf(null)) === 'SHAPE' && thrownCode(() => RA.pageOf({ items: [{ target: 'x' }] })) === 'SHAPE'
      && RA.targetOf(srvTarget('uy', { awayImage: null, displayName: null })).awayImg === null,
      'report-api — 빈 쪽 = 빈 목록 · 모양이 틀리면 SHAPE 로 던짐(«없음» 으로 돌리지 않음) · 그림 · 이름 없으면 null');
    const c1 = [], s1 = { pages: { '': { items: [srvTarget('u1')], nextCursor: 'c/2' }, 'c/2': { items: [], nextCursor: null } } };
    const ad = RA.createAdminReportApi({ authed: fakeAuthed(s1, c1), errs: ERRS });
    const pa = await ad.page(null), pb = await ad.page('c/2');
    t(pa.items.length === 1 && pa.next === 'c/2' && pb.items.length === 0 && c1[0][1] === '/v2/admin/reports' && c1[1][1] === '/v2/admin/reports?cursor=c%2F2'
      && c1.every(c => c[2] && c[2].auth === true && !/minReporters/.test(c[1])),
      'report-api — 목록 = GET /v2/admin/reports(로그인 · minReporters 안 보냄) · 다음 쪽은 ?cursor= (감싸서)');
    c1.length = 0; s1.postData = (path, body) => body.targets.map(id => ({ id, ok: true, code: null }));
    await ad.dismiss('u1');
    s1.postData = (path, body) => [{ id: 'u1', ok: false, code: 'INVALID_REQUEST' }];
    let ed = null; try{ await ad.dismiss('u1'); }catch(e){ ed = e; }
    s1.postData = () => [];
    let es = null; try{ await ad.dismiss('u1'); }catch(e){ es = e; }
    t(c1[0][1] === '/v2/admin/reports/dismissals' && same(c1[0][2], { targets: ['u1'] }) && ed && ed.code === 'INVALID_REQUEST' && es && es.code === 'SHAPE',
      'report-api — 문제없음 = POST …/dismissals { targets:[그 한 명] } · 그 사람 줄이 ok 아니면 그 code 로 · 줄이 없으면 SHAPE 로 던짐');
    c1.length = 0; s1.postData = null;
    await ad.takeDown('u1', OK_IMG + 'a.webp');
    let et = null; try{ await ad.takeDown('u1', ''); }catch(e){ et = e; }
    t(c1.length === 1 && c1[0][1] === '/v2/admin/reports/u1/take-down' && same(c1[0][2], { awayImageUrl: OK_IMG + 'a.webp' }) && et && et.code === 'INVALID',
      'report-api — 그림 내리기 = POST …/{target}/take-down { awayImageUrl: 본 그림 } · 그림 없으면 요청 0');
    const f = (e) => RA.adminFailOf(e, ERRS);
    t(f(errOf('REPORT_IMAGE_CHANGED')) === 'imageChanged' && f(errOf('ACCESS_DENIED')) === 'common' && f(errOf('AUTH_REQUIRED')) === 'common'
      && f(Object.assign(new Error('x'), { code: 'NETWORK', kind: 'unavailable' })) === 'common' && f(errOf('INTERNAL_ERROR')) === 'site'
      && f(errOf('USER_NOT_FOUND')) === 'site' && f(Object.assign(new Error('x'), { code: 'SHAPE' })) === 'site',
      'report-api — 관리자 갈래: 그림 바뀜 → imageChanged · 공통 code · 닿지 못함 → common · 그 밖(모양 틀림 포함) → site');
  }
  const btn = D.made.find(x => x.id === 'lcReportList');
  t(btn && (btn._on.click || []).length === 1, '관리자 [🚩 신고 목록] 버튼을 만들 때 건다');
  const click = async () => { await btn._on.click[0]({ stopPropagation(){} }); await flush(); await flush(); };
  B.calls.length = 0;
  await click();
  t(!gets(B.calls).length, '관리자가 아니면 안 연다(요청 0)');
  const since = (k) => D.made.slice(k);
  const btnsIn = (els, label) => els.filter(x => x.tagName === 'button' && x.textContent === label);
  const texts = (els) => els.map(x => x.textContent).join('\n');
  /* 받음 — 두 사람 · 첫 사람은 그림 있음 */
  R.openDialog({ friendUserId: 'u7' }); const ovUser = R.ov();
  st.admin = true;
  st.pages = { '': { items: [srvTarget('ua', { awayImage: { url: OK_IMG + 'a.webp', size: 80 } }), srvTarget('ub', { awayImage: { url: 'https://evil/x.png', size: 80 } })], nextCursor: 'n2' },
    n2: { items: [srvTarget('uc')], nextCursor: null } };
  let k0 = D.made.length; B.calls.length = 0;
  await click();
  const ovAdm = R.ov(), el1 = since(k0);
  t(gets(B.calls).length === 1 && ovUser.removed && ovAdm && ovAdm !== ovUser && ovAdm.attached, '다시 대입된 isAdmin 을 읽고 · 열면 신고 창은 닫히고 팝업 칸을 이어받는다 · 목록 받기 한 번');
  const T1 = texts(el1);
  t(btnsIn(el1, '문제없음').length === 2 && btnsIn(el1, '그림 내리기').length === 1 && /이름ua/.test(T1) && /🚩 3명/.test(T1)
    && /· \(이름 없음\) #0002 — 기타 · 욕설/.test(T1) && /· 갑옛 #1111 — 닉네임/.test(T1) && /· 병 #3333 — 기타/.test(T1) && /서로 다른 3명 이상이 신고한 사람만 보여요 · 2명 넘게/.test(T1)
    && T1.indexOf('#0002') < T1.indexOf('#1111'),
    '받음 — 사람마다 이름 · 수 · 신고자 줄(최근 것이 위 · 신고할 때 이름 · 친구 코드 뒷자리 — 없으면 사용자 코드 뒷자리 · 이름 없으면 «(이름 없음)») · 우리 Storage 그림만 [그림 내리기] · total 없으면 머리 «2명 넘게»');
  t(el1.some(x => x.textContent === 'FC-ua') && !el1.some(x => x.textContent === 'ua'), '대상 코드 — 친구 코드(사용자 코드 아님)');
  /* 더 보기 */
  const more = btnsIn(el1, '더 보기')[0];
  k0 = D.made.length; B.calls.length = 0;
  await more.onclick(); await flush();
  t(more && gets(B.calls).length === 1 && /cursor=n2/.test(gets(B.calls)[0][1]) && btnsIn(since(k0), '문제없음').length === 1 && more.removed && /· 3명$/.test(el1.find(x => /신고한 사람만/.test(x.textContent)).textContent),
    '[더 보기] — 다음 쪽 한 번 · 줄 더함 · 끝이면 버튼 걷음 · 머리 «3명»');
  /* 문제없음 — 실패 → E-ADM-31 · 다시 켬 / 성공 → 줄 지움 */
  const fineA = btnsIn(el1, '문제없음')[0], rowA = fineA.parent.parent;
  B.calls.length = 0; st.fail = errOf('INTERNAL_ERROR');
  await fineA.onclick();
  t(posts(B.calls).length === 1 && errs(B.calls).map(c => c[1]).join() === 'E-ADM-31' && !fineA.disabled && !rowA.removed, '[문제없음] 실패 — E-ADM-31 한 번 · 버튼 다시 켬 · 줄 그대로(다시 보내지 않음)');
  B.calls.length = 0; st.fail = errOf('ACCESS_DENIED');
  await fineA.onclick();
  t(errs(B.calls).map(c => c[1]).join() === 'E-NET-02' && !fineA.disabled, '[문제없음] 공통 code — 공통 표 번호(E-NET-02) · E-ADM-31 아님');
  B.calls.length = 0; st.fail = null; st.postData = (path, body) => body.targets.map(id => ({ id, ok: true, code: null }));
  await fineA.onclick();
  t(posts(B.calls).length === 1 && same(posts(B.calls)[0][2], { targets: ['ua'] }) && rowA.removed && !errs(B.calls).length && B.calls.some(c => c[0] === 'toast' && c[1] === '신고를 비웠어요'),
    '[문제없음] 성공 — 그 한 명만 보냄 · 줄 지움');
  st.postData = null;
  /* 그림 내리기 — 그 밖 실패 / 그림 바뀜 / 성공 */
  const down = btnsIn(el1, '그림 내리기')[0];
  B.calls.length = 0; st.fail = errOf('INTERNAL_ERROR');
  await down.onclick();
  t(posts(B.calls).length === 1 && same(posts(B.calls)[0][2], { awayImageUrl: OK_IMG + 'a.webp' }) && errs(B.calls).map(c => c[1]).join() === 'E-ADM-32' && !down.disabled && !down.removed,
    '[그림 내리기] 실패 — 본 그림 주소를 보냄 · E-ADM-32 한 번 · 버튼 다시 켬');
  B.calls.length = 0; st.fail = errOf('REPORT_IMAGE_CHANGED');
  await down.onclick(); await flush();
  t(!errs(B.calls).length && B.calls.some(c => c[0] === 'toast' && /그 사이 그림이 바뀌었어요/.test(c[1])) && gets(B.calls).length === 1 && !/cursor/.test(gets(B.calls)[0][1]),
    '[그림 내리기] REPORT_IMAGE_CHANGED — 번호 없이 안내 · 목록 첫 쪽부터 다시 받기 한 번');
  B.calls.length = 0; st.fail = null;
  st.pages = { '': { items: [srvTarget('ua', { awayImage: { url: OK_IMG + 'b.webp', size: 80 } })], nextCursor: null } };
  k0 = D.made.length; await click();
  const down2 = btnsIn(since(k0), '그림 내리기')[0], th2 = down2 && down2.parent.parent.children[0];
  B.calls.length = 0; await down2.onclick();
  t(posts(B.calls).length === 1 && /\/ua\/take-down$/.test(posts(B.calls)[0][1]) && down2.removed && th2.textContent === '그림 없음' && B.calls.some(c => c[0] === 'toast' && c[1] === '자리비움 그림을 내렸어요'),
    '[그림 내리기] 성공 — «그림 없음» · 버튼 걷음');
  /* 빈 목록 — 못 받음과 다른 화면 */
  st.pages = { '': { items: [], nextCursor: null } };
  k0 = D.made.length; B.calls.length = 0; await click();
  const el3 = since(k0);
  t(/확인할 신고가 없어요/.test(texts(el3)) && !btnsIn(el3, '다시 시도').length && !btnsIn(el3, '더 보기').length && !errs(B.calls).length, '빈 목록 — «확인할 신고가 없어요» · 번호 없음 · [다시 시도] 없음');
  /* 못 받음 — E-ADM-30 · [다시 시도] 로 한 번 더 */
  st.getFail = errOf('INTERNAL_ERROR');
  k0 = D.made.length; B.calls.length = 0; await click();
  const el4 = since(k0), again = btnsIn(el4, '다시 시도')[0];
  t(errs(B.calls).map(c => c[1]).join() === 'E-ADM-30' && /못 불러왔어요/.test(texts(el4)) && again && !/확인할 신고가 없어요/.test(texts(el4)) && gets(B.calls).length === 1,
    '못 받음 — «못 불러왔어요» + E-ADM-30 한 번 · [다시 시도] · 빈 목록 문구 아님 · 혼자 다시 받지 않음');
  st.getFail = null; st.pages = { '': { items: [srvTarget('ud')], nextCursor: null } };
  k0 = D.made.length; B.calls.length = 0; again.onclick(); await flush(); await flush();
  t(gets(B.calls).length === 1 && btnsIn(since(k0), '문제없음').length === 1, '[다시 시도] — 한 번 더 받아 그린다');
  st.getFail = errOf('ACCESS_DENIED');
  B.calls.length = 0; await click();
  t(errs(B.calls).map(c => c[1]).join() === 'E-NET-02', '목록 공통 code — 공통 표 번호(E-NET-02) · E-ADM-30 아님');
  st.getFail = null;
  /* total — 첫 쪽 값을 [더 보기] 뒤에도 쓴다 · 친구 코드 없으면 사용자 코드 */
  st.pages = { '': { items: [srvTarget('uf', { friendCode: null })], nextCursor: 'm2', total: 7 }, m2: { items: [srvTarget('ug')], nextCursor: null, total: null } };
  k0 = D.made.length; await click();
  const el5 = since(k0), headOf = (els) => els.find(x => /신고한 사람만/.test(x.textContent)).textContent;
  const h1 = headOf(el5);
  await btnsIn(el5, '더 보기')[0].onclick(); await flush();
  t(/· 7명$/.test(h1) && /· 7명$/.test(headOf(el5)) && el5.some(x => x.textContent === 'uf'), '머리 «n명» 은 첫 쪽 total — [더 보기] 뒤에도 그대로 · 친구 코드가 없으면 사용자 코드');
  /* 같은 창에서 다시 받은 뒤 옛 [더 보기] 답 버림 — 더 보기를 붙잡고 그림 바뀜으로 다시 받기 */
  st.pages = { '': { items: [srvTarget('uh', { awayImage: { url: OK_IMG + 'h.webp', size: 80 } })], nextCursor: 'm3' }, m3: { items: [srvTarget('ui')], nextCursor: null } };
  k0 = D.made.length; await click();
  const el6 = since(k0);
  st.getHold = true; st.held = [];
  const pMore = btnsIn(el6, '더 보기')[0].onclick();
  st.fail = errOf('REPORT_IMAGE_CHANGED');
  await btnsIn(el6, '그림 내리기')[0].onclick(); st.fail = null;
  const kA = D.made.length;
  st.getHold = false; st.held[0](); await pMore; await flush(); await flush();
  const staleDrawn = btnsIn(since(kA), '문제없음').length;
  st.held[1](); await flush(); await flush();
  t(st.held.length === 2 && staleDrawn === 0 && btnsIn(since(kA), '문제없음').length === 1, '다시 받은 뒤(gen 바뀜) — 옛 [더 보기] 답은 그리지 않고 새 첫 쪽만 그린다');
  /* 닫은 창에 늦은 답 — 붙잡아 두고 닫은 뒤 풀어 준다 */
  st.getHold = true; st.pages = { '': { items: [srvTarget('ue')], nextCursor: null } };
  await click();
  const ovLate = R.ov(); k0 = D.made.length;
  R.esc()({ key: 'Escape', stopPropagation(){} });
  st.getHold = false; st.getRelease(); await flush(); await flush();
  t(ovLate.removed && !R.ov() && !btnsIn(since(k0), '문제없음').length, '닫은 창 — 늦게 온 목록을 그리지 않는다');
  await click();
  const esc = R.esc(); t(typeof esc === 'function', 'ESC 처리도 팝업 칸에 걸린다');
  const ovE = R.ov(); esc({ key: 'Escape', stopPropagation(){} });
  t(ovE.removed && !R.ov() && !R.esc(), 'ESC — 관리자 목록을 닫고 팝업 칸을 비운다');
  /* 3. app.js 연결 */
  t('§', '── 3. app.js 연결');
  const AP = strip(app);
  t(!/function _openReportDialog|function _openReportAdmin|function _reportAdminRows|function _reportBox|var REPORT_KINDS|bindReportAdmin/.test(AP), 'app.js 에 옮긴 본문이 남지 않았다');
  t(!/\bREPORT_OFF\b/.test(app) && !/\bADMIN_REPORT_OFF\b/.test(app) && /const adminReport = TwAdminReport\.createAdminReport\(\{/.test(app),
    '빈 껍데기 없음 — 신고 창 · 관리자 목록 모두 늘 만든다(모듈은 늘 싣는다 — 가드 걷기 3차)');
  const block = (name) => ((app.match(new RegExp('const ' + name + ' = [^\\n]*\\{\\n([\\s\\S]*?)\\n\\}\\);')) || [])[1] || '').split('\n').map(l => l.trim()).filter(Boolean);
  const dr = block('reportMod'), da = block('adminReport');
  t(dr.length === 9 && dr.includes('reportHiddenUids: hiddenSeatsMod._reportHiddenUids,') && dr.some(l => l.startsWith('reportApi: TwReportApi.createReportApi({ authed: TwApi.authed, errs: TwApiErrors }),'))
    && dr.includes('apiErrors: TwApiErrors.store,') && dr.includes('notifyError: (...a)=>TwErrorCodes.notify(...a),') && !dr.some(l => /getDisplayName|myFriendCodeKey/.test(l)),
    'deps — 신고 창 아홉(숨김 Set 은 값 · 신고 서버 길 · 공통 표 · 오류 번호 · 내 이름 · 친구 코드 키 없음)');
  t(da.length === 14 && da.includes('isAdmin: ()=>isAdmin,') && da.includes('setReportOv: (...a)=>reportMod.setOv(...a),') && da.includes('kinds: reportMod.KINDS,')
    && da.some(l => l.startsWith('adminApi: TwReportApi.createAdminReportApi({ authed: TwApi.authed, errs: TwApiErrors }),')) && da.includes('apiErrors: TwApiErrors.store,')
    && da.includes('notifyError: (...a)=>TwErrorCodes.notify(...a),'),
    'deps — 관리자 목록 열넷(isAdmin 은 읽는 함수 · 팝업 칸 · 창 틀은 reportMod 를 거침 · 관리자 서버 길 · 공통 표 · 오류 번호)');
  t(!/firebaseAPI|listReports|clearReports|getUserBrief|setAwayImg|deleteStorageUrl/.test(strip(adm)), 'admin-report.js — Firebase 길을 부르지 않는다(목록 · 비우기 · 그림 내리기 모두 서버 길)');
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
  rows.forEach(([ok, msg]) => { if(ok === '§') say(msg); else chk(ok, msg); });
  say('── 4. 일부러 깨 보기 — 하나라도 못 잡으면 빨강');
  const breaks = [
    ['신고 뒤에 안 숨김', { rep: s => s.replace('_reportHiddenUids.add(target); _reportHiddenSave();', '_reportHiddenSave();') }],
    ['실패해도 숨김', { rep: s => s.replace('      go.disabled = false;\n      if(Object', '      _reportHiddenUids.add(target);\n      go.disabled = false;\n      if(Object') }],
    ['실패를 번호 없이 삼킴', { rep: s => s.replace("else notifyError('E-RPT-01', e);", 'else {}') }],
    ['실패 뒤 [신고] 안 켬', { rep: s => s.replace('      go.disabled = false;\n      if(Object', '      if(Object') }],
    ['보내기 전에 [신고] 안 끔', { rep: s => s.replace('    go.disabled = true;\n    try{', '    try{') }],
    ['그림 없음을 오류 번호로', { rep: s => s.replace("  noAwayImage: '그 분의 자리비움 그림이 이미 없어요',\n", '') }],
    ['사유 없음 안내 빠짐', { rep: s => s.replace("  noteRequired: '사유를 적어 주세요',\n", '') }],
    ['공통 code 를 E-RPT-01 로', { rep: s => s.replace("      else if(kind === 'common') apiErrors.notify(e);\n", '') }],
    ['갈래가 공통 code 를 site 로', { rapi: s => s.replace('if(own(errs.COMMON, t.code) || t.action === OFFLINE_ACTION) return FAIL.COMMON;', '') }],
    ['갈래가 닿지 못함을 site 로', { rapi: s => s.replace(' || t.action === OFFLINE_ACTION', '') }],
    ['기능 표에서 사유 없음 빠짐', { rapi: s => s.replace('  REPORT_NOTE_REQUIRED: row(FAIL.NOTE_REQUIRED),\n', '') }],
    ['본문에 내 이름을 실음', { rapi: s => s.replace('const body = { target, kind: KIND[kind] };', "const body = { target, kind: KIND[kind], nick: '나닉' };") }],
    ['종류 이름 표 틀림', { rapi: s => s.replace("nick: 'NICKNAME'", "nick: 'NICK'") }],
    ['실패를 성공으로 삼킴', { rapi: s => s.replace('    await authed.post(PATHS.file, body);', '    try{ await authed.post(PATHS.file, body); }catch(_){}') }],
    ['41자도 보냄', { rapi: s => s.replace('if(n.length > NOTE_MAX) throw', 'if(n.length > NOTE_MAX + 1) throw') }],
    ['관리자 목록이 팝업 칸을 안 이어받음', { adm: s => s.replace('document.body.appendChild(ov); setReportOv(ov);', 'document.body.appendChild(ov);') }],
    ['관리자 목록이 신고 창을 안 닫음', { adm: s => s.replace('  _reportClose();\n  const { ov, body } = _reportBox(\'🚩 신고 목록\', 460);', "  const { ov, body } = _reportBox('🚩 신고 목록', 460);") }],
    ['관리자 확인을 값으로 붙잡음', { adm: s => s.replace('const isAdmin = deps.isAdmin;', 'const isAdmin = ((v)=>()=>v)(deps.isAdmin());') }],
    ['관리자가 아니어도 목록을 엶', { adm: s => s.replace('  if(!isAdmin()) return;\n', '') }],
    ['닫은 창 · 옛 차례 답도 그림(창 gen 빠짐)', { adm: s => s.replace('const live = (g)=>_reportOv() === ov && g === gen;', 'const live = (g)=>true;') }],
    ['목록 실패를 번호 없이 삼킴', { adm: s => s.split("notifyError('E-ADM-30', x)").join('void x') }],
    ['목록 실패를 빈 목록으로', { rapi: s => s.replace("    return pageOf(await authed.get(PATHS.adminList + q, { auth: true }));", "    try{ return pageOf(await authed.get(PATHS.adminList + q, { auth: true })); }catch(_){ return { items: [], next: null }; }") }],
    ['그림 바뀜에 다시 받기 빠짐', { adm: s => s.replace('toast(IMAGE_CHANGED_TEXT); load(); return;', 'toast(IMAGE_CHANGED_TEXT); return;') }],
    ['[문제없음] 실패 뒤 안 켬', { adm: s => s.replace('        _fail(e, (x)=>notifyError(\'E-ADM-31\', x));\n        fine.disabled = false;\n', '        _fail(e, (x)=>notifyError(\'E-ADM-31\', x));\n') }],
    ['관리자 공통 code 를 E-ADM 으로', { adm: s => s.replace("if(kind === 'common') apiErrors.notify(e);\n  else if(kind === 'site') site(e);", "if(kind !== 'imageChanged') site(e);") }],
    ['그림 내리기에 본 주소를 안 실음', { rapi: s => s.replace('{ awayImageUrl: url }', '{}') }],
    ['목록에 minReporters 를 실음', { rapi: s => s.replace("const q = cursor ? '?cursor=' + encodeURIComponent(cursor) : '';", "const q = '?minReporters=3' + (cursor ? '&cursor=' + encodeURIComponent(cursor) : '');") }],
    ['신고자 순서를 안 맞춤', { rapi: s => s.replace('.sort((a, b) => b.at - a.at);', ';') }],
    ['문제없음 거절 줄을 성공으로', { rapi: s => s.replace("    if(it.ok !== true) throw", "    if(false) throw") }],
    ['관리자 갈래에서 그림 바뀜 빠짐', { rapi: s => s.replace('  REPORT_IMAGE_CHANGED: row(ADMIN_FAIL.IMAGE_CHANGED),\n', '') }],
    ['대상에 친구 코드 대신 사용자 코드', { adm: s => s.replace('cd.textContent = r.friendCode || r.target;', 'cd.textContent = r.target;') }],
    ['신고자에 친구 코드 뒷자리 대신 사용자 코드', { adm: s => s.replace('_code4(_codeOf(rc))', '_code4(rc.code)') }],
    ['신고할 때 이름(nameSnapshot) 무시', { rapi: s => s.replace('str(r.nameSnapshot) || str(r.displayName)', 'str(r.displayName)') }],
    ['total 무시', { adm: s => s.replace('const total = pg.total;', 'const total = null;') }],
    ['옛 [더 보기] 답도 그림', { adm: s => s.replace("      if(!live(g)) return;\n      more.disabled = false;\n      add(p2);", "      more.disabled = false;\n      add(p2);") }],
    ['관리자 서버 길 deps 빠짐', { app: s => s.replace(/  adminApi: TwReportApi\.createAdminReportApi[^\n]*\n/, '') }],
    ['메뉴가 옛 이름', { app: s => s.replace('()=>reportMod().openDialog(seat)', '()=>_openReportDialog(seat)') }],
    ['html 순서 틀림', { html: s => s.replace('<script src="parts/support/report.js"></script>', '').replace('<script src="parts/app.js"></script>', '<script src="parts/support/report.js"></script>\n<script src="parts/app.js"></script>') }],
    ['deps 하나 빠짐', { app: s => s.replace('  setReportEsc: (...a)=>reportMod.setEsc(...a),\n', '') }],
  ];
  for(const [name, f] of breaks){
    const r2 = f.rep ? f.rep(REP) : REP, a2 = f.adm ? f.adm(ADM) : ADM, p2 = f.app ? f.app(SRC) : SRC, h2 = f.html ? f.html(HTML) : HTML, q2 = f.rapi ? f.rapi(RAPI) : RAPI;
    const changed = r2 !== REP || a2 !== ADM || p2 !== SRC || h2 !== HTML || q2 !== RAPI;
    let rows2; try{ rows2 = await judgeAll(r2, a2, p2, h2, q2); }catch(_){ rows2 = [[false, '던짐']]; }
    chk(changed && rows2.some(([ok]) => ok === false), name + (changed ? '' : ' — 바꿀 글을 못 찾음'));
  }
  say(`\n${fail ? '✗' : '✓'} 통과 ${pass} · 실패 ${fail}`);
  process.exit(fail ? 1 : 0);
})();
