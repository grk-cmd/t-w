/* ═══ 📣 sim-admin-notice.js — 확성기 · 업데이트 공지 편집 화면 (0.13 앱 묶음 D11-1) ═══
   [왜] 관리자가 올리는 확성기 · 업데이트 공지가 Firebase 에 쓰이던 것을 서버 길(adminApi)로 바꿨다. 사용자 앱은 공지를 서버에서 읽으므로
     Firebase 에 써서는 아무에게도 안 보였다. 화면은 그대로이고 안쪽만 바뀌었으니 가짜 DOM + 가짜 adminApi 위에서 실제로 굴려 판정한다.
   ・1절: 만들 때 — 버튼 여덟 · 서버 안 부름 · 빈 반환
   ・2절: 확성기 — 빈 글은 안 보냄 · 앞뒤 공백 빼고 보냄 · 성공하면 창을 닫음 · 실패하면 창을 안 닫고 오류 번호 · 끄기 · 보내는 중 두 번 눌러도 한 번
   ・3절: 업데이트 공지 — 열 때 지금 공지를 채우고 그 id 를 기억(받는 동안 잠금 → 풀림) · 못 받아도 열림 + 오류 번호 + «내리기» 는 잠긴 채 · 제목/본문 둘 다 있어야 올림 ·
        올리면 응답 id 를 기억 · 실패하면 창 유지 · 내리기는 확인 뒤 기억한 id 로 요청 한 번(GET 0번) · 기억한 것이 없으면 안 내림 · 취소하면 서버 안 부름 ·
        창을 빠르게 닫고 다시 열면(openGen) 늦게 온 옛 받기 답이 폼을 덮지도 잠금을 먼저 풀지도 않음
   ・4절: 배선 — Firebase 직접 쓰기가 남지 않음 · app.js deps(adminApi · apiErrors) · 사용자 팝업은 app.js 에 남음
   ・5절: 일부러 깨 보기
   [실행] 러너 스테이징(평면)에서. */
'use strict';
const fs = require('fs');
let pass = 0, fail = 0, quiet = false, qfail = 0;
const say = (s) => { if(!quiet) console.log(s); };
const chk = (ok, msg) => { if(quiet){ if(!ok) qfail++; return; } ok ? pass++ : fail++; say('  ' + (ok ? '✓' : '✗') + ' ' + msg); };
const read = (f) => { try{ return fs.readFileSync(f, 'utf8'); }catch(_){ return null; } };
const pick = (names) => names.map(read).find(Boolean);
const SRC0 = {
  MOD: pick(['admin-notice.js', 'parts/admin/admin-notice.js', 'app/parts/admin/admin-notice.js']),
  APP: pick(['app.js', 'parts/app.js', 'app/parts/app.js']),
};
for(const k of Object.keys(SRC0)) if(!SRC0[k]){ console.log('  ? 원본 못 찾음 — ' + k); process.exit(2); }
const strip = (x) => x.replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/(^|[^:'"])\/\/[^\n]*/g, '$1 ');

function makeDom(){
  const els = {};
  const mk = (id) => ({ id, style: {}, value: '', disabled: false, onclick: null,
    classList: { _s: new Set(), add(c){ this._s.add(c); }, remove(c){ this._s.delete(c); }, contains(c){ return this._s.has(c); } }, focus(){} });
  const document = { getElementById: (id) => els[id] || (els[id] = mk(id)) };
  return { els: new Proxy(els, { get: (o, id) => document.getElementById(id) }), document };
}
const gate = () => { let go; const p = new Promise((r) => { go = r; }); return { p, go }; };

function build(src, o){
  const calls = [], toasts = [], shown = [];
  const D = makeDom();
  const rec = (name, ret) => async (...a) => { calls.push([name, ...a]); const v = typeof ret === 'function' ? await ret(...a) : ret; if(v instanceof Error) throw v; return v; };
  const adminApi = { ERRORS: { MARK: 1 },
    announce: rec('announce', o.announce), clearAnnouncement: rec('clearAnnouncement', o.clear),
    currentUpdateNotice: rec('currentUpdateNotice', o.current === undefined ? null : o.current),
    publishUpdateNotice: rec('publishUpdateNotice', o.publish), withdrawUpdateNotice: rec('withdrawUpdateNotice', o.withdraw) };
  const apiErrors = { notify: (e, table) => { shown.push([e && e.code, table && table.MARK]); return { action: 'notice' }; } };
  const win = { focus(){} };
  const api = new Function('window', 'document', 'confirm', 'setTimeout', 'module', src + '\nreturn window.TwAdminNotice;')(
    win, D.document, () => o.confirm !== false, () => 0, undefined);
  const out = api.createAdminNotice({ toast: (m) => toasts.push(m), adminApi, apiErrors });
  return { out, calls, toasts, shown, els: D.els };
}
const apiErr = (code) => Object.assign(new Error(code), { code, status: 400 });
const flush = () => new Promise((r) => setImmediate(r));

async function judge(S, app){
  say('── 1. 만들 때');
  {
    const B = build(S.MOD, {});
    chk(['lcAnnounce', 'announceCloseBtn', 'announceSendBtn', 'announceClearBtn', 'lcUpdateNotice', 'updateNoticeAdminCloseBtn', 'updateNoticeSaveBtn', 'updateNoticeClearBtn']
      .every((id) => typeof B.els[id].onclick === 'function') && B.out && !Object.keys(B.out).length && B.calls.length === 0, '만들 때 버튼 여덟 · 빈 반환 · 서버 안 부름');
  }

  say('── 2. 📣 확성기');
  {
    const B = build(S.MOD, {}), e = B.els;
    e.announceInput.value = '   '; await e.announceSendBtn.onclick();
    chk(!B.calls.length && B.toasts.some((m) => /입력/.test(m)), '빈 글은 서버에 안 보내고 안내만');
    e.announceOverlay.classList.add('on'); e.announceOverlay.style.display = 'flex';
    e.announceInput.value = ' 점검 5분 '; await e.announceSendBtn.onclick();
    chk(B.calls.length === 1 && B.calls[0][0] === 'announce' && B.calls[0][1] === '점검 5분', '앞뒤 공백을 뺀 글을 보낸다(켜는 시간은 서버가 정하니 안 보낸다)');
    chk(!e.announceOverlay.classList.contains('on') && e.announceOverlay.style.display === 'none' && B.toasts.some((m) => /발송/.test(m)), '성공하면 창을 닫고 알린다');

    const F = build(S.MOD, { announce: apiErr('ACCESS_DENIED') }), f = F.els;
    f.announceOverlay.classList.add('on'); f.announceInput.value = '글'; await f.announceSendBtn.onclick();
    chk(f.announceOverlay.classList.contains('on') && F.shown.length === 1 && F.shown[0][0] === 'ACCESS_DENIED' && F.shown[0][1] === 1 && !F.toasts.length,
      '실패하면 창을 안 닫고(쓴 글 유지) 오류 번호로 알린다 — 기능 표를 넘긴다 · 성공 토스트 없음');

    const C = build(S.MOD, {});
    await C.els.announceClearBtn.onclick();
    chk(C.calls.length === 1 && C.calls[0][0] === 'clearAnnouncement' && C.toasts.some((m) => /종료/.test(m)), '끄기 → 서버 한 번 · 알림');
    const CF = build(S.MOD, { clear: apiErr('X') });
    await CF.els.announceClearBtn.onclick();
    chk(CF.shown.length === 1 && !CF.toasts.length, '끄기 실패 → 오류 번호');

    const g = gate(), D = build(S.MOD, { announce: () => g.p }), d = D.els;
    d.announceInput.value = '글';
    const p1 = d.announceSendBtn.onclick(), p2 = d.announceSendBtn.onclick();
    g.go(null); await p1; await p2;
    chk(D.calls.filter((c) => c[0] === 'announce').length === 1, '보내는 중 한 번 더 눌러도 요청은 하나');
    d.announceInput.value = '글2'; await d.announceSendBtn.onclick();
    chk(D.calls.filter((c) => c[0] === 'announce').length === 2, '  끝난 뒤에는 다시 보낼 수 있다(잠금이 남지 않는다)');
  }

  say('── 3. 📰 업데이트 공지');
  {
    const g = gate();
    const B = build(S.MOD, { current: () => g.p }), e = B.els;
    const open = e.lcUpdateNotice.onclick();
    await flush();
    chk(e.updateNoticeAdminOverlay.classList.contains('on') && e.updateNoticeTitle.disabled && e.updateNoticeBody.disabled && e.updateNoticeSaveBtn.disabled && e.updateNoticeClearBtn.disabled,
      '열면 지금 공지를 받는 동안 입력 · 저장 · 삭제를 잠근다');
    g.go({ id: 'u1', title: '0.13', body: '새 버전', ts: 1 }); await open;
    chk(e.updateNoticeTitle.value === '0.13' && e.updateNoticeBody.value === '새 버전' && !e.updateNoticeTitle.disabled && !e.updateNoticeSaveBtn.disabled && !e.updateNoticeClearBtn.disabled,
      '받으면 폼을 채우고 잠금을 푼다');

    const N = build(S.MOD, { current: null }); N.els.updateNoticeTitle.value = '남은 글';
    await N.els.lcUpdateNotice.onclick();
    chk(N.els.updateNoticeTitle.value === '' && N.els.updateNoticeBody.value === '' && !N.els.updateNoticeSaveBtn.disabled, '공지가 없으면(null) 빈 폼 — 실패가 아니다');

    const X = build(S.MOD, { current: apiErr('NETWORK') });
    await X.els.lcUpdateNotice.onclick();
    chk(X.els.updateNoticeAdminOverlay.classList.contains('on') && !X.els.updateNoticeSaveBtn.disabled && !X.els.updateNoticeTitle.disabled && X.shown.length === 1,
      '못 받아도 창은 열려 새 공지를 쓸 수 있다 + 오류 번호(입력 · 올리기 잠금은 풀린다)');
    chk(X.els.updateNoticeClearBtn.disabled && (await X.els.updateNoticeClearBtn.onclick(), !X.calls.some((c) => c[0] === 'withdrawUpdateNotice')),
      '못 받으면 «내리기» 는 가리킬 id 가 없어 잠긴 채 — 눌러도 요청 0');
    chk(N.els.updateNoticeClearBtn.disabled, '공지가 없으면 «내리기» 도 잠긴다');

    const S1 = build(S.MOD, { publish: 'new1' }), s = S1.els;
    s.updateNoticeTitle.value = '0.13'; s.updateNoticeBody.value = ''; await s.updateNoticeSaveBtn.onclick();
    chk(!S1.calls.length, '본문이 비면 안 보낸다');
    s.updateNoticeBody.value = ' 고쳤어요 '; s.updateNoticeTitle.value = ' 0.13 '; s.updateNoticeAdminOverlay.classList.add('on');
    await s.updateNoticeSaveBtn.onclick();
    chk(S1.calls.length === 1 && S1.calls[0][0] === 'publishUpdateNotice' && S1.calls[0][1] === '0.13' && S1.calls[0][2] === '고쳤어요' && !s.updateNoticeAdminOverlay.classList.contains('on'),
      '제목 · 본문(공백 뺌)을 보내고 성공하면 창을 닫는다');
    chk(!s.updateNoticeClearBtn.disabled, '올린 공지의 응답 id 를 기억해 «내리기» 가 켜진다');
    await s.updateNoticeClearBtn.onclick();
    chk(S1.calls.map((x) => x[0]).join() === 'publishUpdateNotice,withdrawUpdateNotice' && S1.calls[1][1] === 'new1', '올린 직후 내리면 그 새 id 로 — 공지를 다시 받지 않는다');
    const SF = build(S.MOD, { publish: apiErr('INVALID_REQUEST') }), sf = SF.els;
    sf.updateNoticeTitle.value = 'a'; sf.updateNoticeBody.value = 'b'; sf.updateNoticeAdminOverlay.classList.add('on');
    await sf.updateNoticeSaveBtn.onclick();
    chk(sf.updateNoticeAdminOverlay.classList.contains('on') && sf.updateNoticeTitle.value === 'a' && SF.shown.length === 1, '올리기 실패 → 창 · 쓴 글 유지 + 오류 번호');

    const C = build(S.MOD, { current: { id: 'u9', title: 't', body: 'b', ts: 1 } }), c = C.els;
    c.updateNoticeTitle.value = 't'; await c.updateNoticeClearBtn.onclick();
    await c.lcUpdateNotice.onclick();
    c.updateNoticeTitle.value = 't';
    C.calls.length = 0;
    await c.updateNoticeClearBtn.onclick();
    chk(C.calls.length === 1 && C.calls[0][0] === 'withdrawUpdateNotice' && C.calls[0][1] === 'u9' && c.updateNoticeTitle.value === '' && C.toasts.some((m) => /삭제했어요/.test(m)),
      '내리기 — 창에서 본 id 로 요청 한 번(공지를 다시 받지 않는다 · 그 사이 올라온 새 공지를 잘못 내리지 않는다) · 폼을 비운다');
    chk(c.updateNoticeClearBtn.disabled, '  내린 뒤에는 «내리기» 가 잠긴다(가리킬 id 없음)');
    const CN = build(S.MOD, { current: { id: 'u9', title: 't', body: 'b', ts: 1 }, confirm: false }); await CN.els.lcUpdateNotice.onclick(); CN.calls.length = 0;
    await CN.els.updateNoticeClearBtn.onclick();
    chk(CN.calls.length === 0, '확인 창에서 취소하면 서버를 안 부른다');
    const CE = build(S.MOD, { current: { id: 'u9', title: 't', body: 'b', ts: 1 }, withdraw: apiErr('NOTICE_NOT_FOUND') }); await CE.els.lcUpdateNotice.onclick(); CE.els.updateNoticeTitle.value = '유지';
    await CE.els.updateNoticeClearBtn.onclick();
    chk(CE.shown.length === 1 && CE.shown[0][0] === 'NOTICE_NOT_FOUND' && CE.els.updateNoticeTitle.value === '유지' && !CE.toasts.length, '내리기 실패 → 오류 번호 · 폼은 그대로');
  }

  say('── 3-1. 창을 빠르게 닫고 다시 엶 (openGen)');
  {
    const g1 = gate(), g2 = gate(); let n = 0;
    const B = build(S.MOD, { current: () => (++n === 1 ? g1.p : g2.p) }), e = B.els;
    const open1 = e.lcUpdateNotice.onclick(); await flush();
    await e.updateNoticeAdminCloseBtn.onclick();
    const open2 = e.lcUpdateNotice.onclick(); await flush();
    g1.go({ id: 'old', title: '옛 제목', body: '옛 본문', ts: 1 }); await open1;
    chk(e.updateNoticeTitle.value !== '옛 제목' && e.updateNoticeTitle.disabled && e.updateNoticeSaveBtn.disabled && e.updateNoticeClearBtn.disabled,
      '늦게 온 옛 답은 폼을 덮지 않고 두 번째 받기가 끝나기 전에 잠금을 풀지도 않는다');
    g2.go({ id: 'new', title: '새 제목', body: '새 본문', ts: 2 }); await open2;
    chk(e.updateNoticeTitle.value === '새 제목' && !e.updateNoticeTitle.disabled && !e.updateNoticeClearBtn.disabled, '두 번째 받기가 끝나면 그 값으로 채우고 잠금을 푼다');
    B.calls.length = 0; await e.updateNoticeClearBtn.onclick();
    chk(B.calls.length === 1 && B.calls[0][1] === 'new', '내리기는 두 번째로 받은 id 로');
    const g3 = gate(), C = build(S.MOD, { current: () => g3.p }), c = C.els;
    const o3 = c.lcUpdateNotice.onclick(); await flush(); await c.updateNoticeAdminCloseBtn.onclick();
    g3.go({ id: 'x', title: 't', body: 'b', ts: 1 }); await o3;
    chk(c.updateNoticeTitle.value !== 't', '닫은 뒤에 온 답도 폼에 쓰지 않는다');
  }

  say('── 4. 배선');
  {
    const M = strip(S.MOD), A = strip(app);
    chk(!/\bfirebaseAPI\b/.test(M), '모듈이 Firebase 를 직접 부르지 않는다(adminApi 로)');
    const dep = (A.match(/const adminNotice = TwAdminNotice\.createAdminNotice\(\{\n([\s\S]*?)\n\}\);/) || [])[1] || '';
    const lines = dep.split('\n').map((l) => l.trim()).filter(Boolean);
    chk(lines.length === 3 && lines.includes('adminApi: adminApi,') && lines.includes('apiErrors: TwApiErrors.store,'), 'app.js deps — toast · adminApi · apiErrors');
    chk(/function _showUpdateNoticeOnce\(/.test(A), '사용자 쪽 업데이트 공지 팝업은 app.js 에 남았다');
  }
}

async function runAll(){
  const S = SRC0;
  await judge(S, S.APP);
  say('── 5. 일부러 깨 보기');
  const breaks = [
    ['빈 글도 보냄', { MOD: S.MOD.replace("if(!t){ toast('공지 문구를 입력해주세요'); return; }", '') }, '빈 글'],
    ['글을 안 다듬음', { MOD: S.MOD.replace("const t=$('announceInput').value.trim();", "const t=$('announceInput').value;") }, '공백'],
    ['실패해도 창을 닫음', { MOD: S.MOD.replace("toast('공지를 발송했어요 (1분간 표시)');\n    hide('announceOverlay');\n  } catch(e){ fail(e); }", "} catch(e){ fail(e); }\n  hide('announceOverlay');") }, '창을 안 닫고'],
    ['오류를 번호 없이 삼킴', { MOD: S.MOD.replace("const fail = (e)=>{ apiErrors.notify(e, adminApi.ERRORS); };", "const fail = ()=>{};") }, '오류 번호'],
    ['기능 표를 안 넘김', { MOD: S.MOD.replace("apiErrors.notify(e, adminApi.ERRORS)", "apiErrors.notify(e)") }, '기능 표'],
    ['보내는 중 잠금 없음', { MOD: S.MOD.replace("if(busy) return;", "") }, '요청은 하나'],
    ['잠금이 실패 뒤 남음', { MOD: S.MOD.replace("finally { busy = false; }", "catch(e){ throw e; }") }, '잠금이 남지'],
    ['받는 동안 안 잠금', { MOD: S.MOD.replace("lockForm(true);", "") }, '잠근다'],
    ['받고 나서 잠금을 안 풂', { MOD: S.MOD.replace("lockForm(false); syncClear();", "syncClear();") }, '잠금을 푼다'],
    ['내리기 직전에 공지를 다시 받음', { MOD: S.MOD.replace("  const id = shownId;\n  if(id == null) return;", "  const cur = await adminApi.currentUpdateNotice();\n  const id = cur ? cur.id : shownId;\n  if(id == null) return;") }, '다시 받지'],
    ['받기 실패에도 내리기 잠금을 풂', { MOD: S.MOD.replace("(load === 'loading' || shownId == null)", "(load === 'loading')") }, '잠긴 채'],
    ['openGen 없음', { MOD: S.MOD.replace("if(gen !== openGen) return;   // 그 사이", "if(false) return;   // 그 사이") }, '옛 답'],
    ['올린 id 를 기억 안 함', { MOD: S.MOD.replace("shownId = id; syncClear();", "") }, '응답 id'],
    ['확인 없이 내림', { MOD: S.MOD.replace("if(!confirm('현재 업데이트 공지를 삭제할까요?')){ window.focus(); return; }", '') }, '취소'],
    ['Firebase 로 되돌아감', { MOD: S.MOD.replace("await adminApi.announce(t);", "await firebaseAPI.publishAnnounce(t, 60000);") }, 'Firebase'],
    ['app.js deps 빠짐', { APP: S.APP.replace("  adminApi: adminApi,\n  apiErrors: TwApiErrors.store,\n});\n\n// 유저", "});\n\n// 유저") }, 'deps'],
  ];
  for(const [name, over, what] of breaks){
    const key = Object.keys(over)[0];
    if(over[key] === S[key]){ chk(false, name + ' — 바꿀 글을 못 찾음'); continue; }
    quiet = true; qfail = 0;
    try{ await judge(Object.assign({}, S, over), over.APP || S.APP); }catch(_){ qfail++; }
    quiet = false;
    chk(qfail > 0, name + ' → 빨강(' + what + ')');
  }
  say('\n통과 ' + pass + ' · 실패 ' + fail);
  process.exit(fail ? 1 : 0);
}
runAll();
