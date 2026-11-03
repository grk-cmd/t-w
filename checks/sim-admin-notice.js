/* ═══ 📣 sim-admin-notice.js — 확성기 · 업데이트 공지 편집 화면 (0.13 앱 묶음 D11-1) ═══
   [왜] 관리자가 올리는 확성기 · 업데이트 공지가 Firebase 에 쓰이던 것을 서버 길(adminApi)로 바꿨다. 사용자 앱은 공지를 서버에서 읽으므로
     Firebase 에 써서는 아무에게도 안 보였다. 화면은 그대로이고 안쪽만 바뀌었으니 가짜 DOM + 가짜 adminApi 위에서 실제로 굴려 판정한다.
   ・1절: 만들 때 — 버튼 여덟 · 서버 안 부름 · 빈 반환
   ・2절: 확성기 — 빈 글은 안 보냄 · 앞뒤 공백 빼고 보냄 · 성공하면 창을 닫음 · 실패하면 창을 안 닫고 오류 번호 · 끄기 · 보내는 중 두 번 눌러도 한 번
   ・3절: 업데이트 공지 — 열 때 지금 공지를 채움(받는 동안 잠금 → 풀림) · 못 받아도 열림 + 오류 번호 · 제목/본문 둘 다 있어야 올림 · 실패하면 창 유지 ·
        내리기는 확인 후 지금 id 로 · 공지가 없으면 안 내림 · 취소하면 서버 안 부름
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
    chk(X.els.updateNoticeAdminOverlay.classList.contains('on') && !X.els.updateNoticeSaveBtn.disabled && X.shown.length === 1, '못 받아도 창은 열려 새 공지를 쓸 수 있다 + 오류 번호(잠금이 남지 않는다)');

    const S1 = build(S.MOD, {}), s = S1.els;
    s.updateNoticeTitle.value = '0.13'; s.updateNoticeBody.value = ''; await s.updateNoticeSaveBtn.onclick();
    chk(!S1.calls.length, '본문이 비면 안 보낸다');
    s.updateNoticeBody.value = ' 고쳤어요 '; s.updateNoticeTitle.value = ' 0.13 '; s.updateNoticeAdminOverlay.classList.add('on');
    await s.updateNoticeSaveBtn.onclick();
    chk(S1.calls.length === 1 && S1.calls[0][0] === 'publishUpdateNotice' && S1.calls[0][1] === '0.13' && S1.calls[0][2] === '고쳤어요' && !s.updateNoticeAdminOverlay.classList.contains('on'),
      '제목 · 본문(공백 뺌)을 보내고 성공하면 창을 닫는다');
    const SF = build(S.MOD, { publish: apiErr('INVALID_REQUEST') }), sf = SF.els;
    sf.updateNoticeTitle.value = 'a'; sf.updateNoticeBody.value = 'b'; sf.updateNoticeAdminOverlay.classList.add('on');
    await sf.updateNoticeSaveBtn.onclick();
    chk(sf.updateNoticeAdminOverlay.classList.contains('on') && sf.updateNoticeTitle.value === 'a' && SF.shown.length === 1, '올리기 실패 → 창 · 쓴 글 유지 + 오류 번호');

    const C = build(S.MOD, { current: { id: 'u9', title: 't', body: 'b', ts: 1 } }), c = C.els;
    c.updateNoticeTitle.value = 't'; await c.updateNoticeClearBtn.onclick();
    chk(C.calls.map((x) => x[0]).join() === 'currentUpdateNotice,withdrawUpdateNotice' && C.calls[1][1] === 'u9' && c.updateNoticeTitle.value === '' && C.toasts.some((m) => /삭제했어요/.test(m)),
      '내리기 — 확인 뒤 지금 공지를 다시 보고 그 id 로 내린다 · 폼을 비운다');
    const C0 = build(S.MOD, { current: null }); await C0.els.updateNoticeClearBtn.onclick();
    chk(C0.calls.map((x) => x[0]).join() === 'currentUpdateNotice' && C0.toasts.some((m) => /없어요/.test(m)), '내릴 공지가 없으면 내리기 요청을 안 보낸다');
    const CN = build(S.MOD, { confirm: false }); await CN.els.updateNoticeClearBtn.onclick();
    chk(CN.calls.length === 0, '확인 창에서 취소하면 서버를 안 부른다');
    const CE = build(S.MOD, { current: { id: 'u9', title: 't', body: 'b', ts: 1 }, withdraw: apiErr('NOTICE_NOT_FOUND') }); CE.els.updateNoticeTitle.value = '유지';
    await CE.els.updateNoticeClearBtn.onclick();
    chk(CE.shown.length === 1 && CE.shown[0][0] === 'NOTICE_NOT_FOUND' && CE.els.updateNoticeTitle.value === '유지' && !CE.toasts.length, '내리기 실패 → 오류 번호 · 폼은 그대로');
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
    ['못 받으면 잠금이 남음', { MOD: S.MOD.replace("  lockForm(false);\n  setTimeout", "  setTimeout") }, '잠금을 푼다'],
    ['지금 공지를 다시 안 보고 내림', { MOD: S.MOD.replace("const cur = await adminApi.currentUpdateNotice();   // 내릴", "const cur = { id: 'old' };   // 내릴") }, '지금 공지를 다시'],
    ['공지가 없어도 내림', { MOD: S.MOD.replace("if(!cur){ toast('내릴 업데이트 공지가 없어요'); return; }", '') }, '없으면'],
    ['확인 없이 내림', { MOD: S.MOD.replace("if(!confirm('현재 업데이트 공지를 삭제할까요?')){ window.focus(); return; }", '') }, '취소'],
    ['Firebase 로 되돌아감', { MOD: S.MOD.replace("await adminApi.announce(t);", "await firebaseAPI.publishAnnounce(t, 60000);") }, 'Firebase'],
    ['app.js deps 빠짐', { APP: S.APP.replace("  adminApi: adminApi,\n  apiErrors: TwApiErrors.store,\n});\n\n\n// 유저", "});\n\n\n// 유저") }, 'deps'],
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
