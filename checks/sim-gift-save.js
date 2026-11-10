/* sim-gift-save.js — 💾 받은 말랑이 선물 그림 저장(myhome/gift-save.js)
   [무엇을 지키나] 선물함 우클릭 [저장] 은 선물 그림을 받은 그대로 «말랑이_보낸사람_받은날짜.확장자» 로 내려받는다.
     친구가 정한 이름 · 주소가 들어오므로 파일 이름에 못 쓰는 글자는 바꾸고, 그림 주소는 safeUrl 을 거친 것만 받는다.
   ・1절: 순수 함수 — fileName · extOf 입력 → 출력 · 경계값(빈 이름 · null · 못 쓰는 글자뿐 · 앞뒤 점 · 긴 이름 · 모르는 형식)
   ・2절: 저장 흐름 — 받기 → a.download 누르기 → 주소 놓기 예약 · 받은 시각이 없으면 지금 · 실패(HTTP · 그림 아님 · 받기 오류 · 주소 없음 · 막힌 주소)
   ・3절: 연결 — html 이 myhome-inbox.js · app.js 보다 먼저 싣는다 · app.js 가 deps 로 넘긴다 · 에러 번호가 표에 있다
   ・4절: 일부러 깨 보기
   선물함 우클릭 창의 버튼([저장] [삭제] [취소] · ⭐ 는 [저장] [취소])은 sim-myhome-inbox.js 5절이 본다.
   [실행] node checks/run.js sim-gift-save */
'use strict';
const fs = require('fs');
const path = require('path');
let pass = 0, fail = 0;
const say = (s) => console.log(s);
const chk = (ok, msg) => { ok ? pass++ : fail++; say('  ' + (ok ? '✓' : '✗') + ' ' + msg); };
const read = (f) => { for (const c of [f, 'parts/' + f, 'app/parts/' + f, 'app/' + f, path.basename(f)]) if (fs.existsSync(c)) return fs.readFileSync(c, 'utf8'); return null; };
const SRC = {
  mod: read('myhome/gift-save.js'), safe: read('shared/safe-html.js'), html: read('desk-companion-prototype.html'),
  app: read('app.js'), codes: read('shared/error-codes.js'),
};
for (const k of Object.keys(SRC)) if (SRC[k] == null) { say('  ? 원본 못 찾음 — ' + k); process.exit(2); }

const load = (src) => { const m = { exports: {} }; new Function('window', 'module', src)(undefined, m); return m.exports; };
const SH = load(SRC.safe);

/* 가짜 환경 — 받기 · 문서 · 주소 · 예약 · 실패 알림을 적어 둔다 */
function mkEnv(M, o){
  const e = { fetched: [], clicked: [], appended: 0, removed: 0, revoked: [], timers: [], fails: [] };
  const res = o.res || { ok: true, status: 200, blob: async () => o.blob };
  const deps = {
    fetch: async (u) => { e.fetched.push(u); if (o.throw) throw new Error('net'); return res; },
    document: {
      createElement: (t) => { const a = { tag: t, click(){ e.clicked.push({ href: a.href, download: a.download }); }, remove(){ e.removed++; } }; return a; },
      body: { appendChild: () => { e.appended++; } },
    },
    URL: { createObjectURL: () => 'blob:x1', revokeObjectURL: (u) => e.revoked.push(u) },
    setTimeout: (fn, ms) => { e.timers.push(ms); fn(); },
    safeUrl: SH.safeUrl,
    now: () => new Date(2026, 10, 1, 9, 5, 7),
    notifyFail: (err) => e.fails.push(String(err && err.message || err)),
  };
  e.gs = M.createGiftSave(deps);
  return e;
}
const PNG = { size: 10, type: 'image/png' };
const TS = new Date(2026, 0, 2, 3, 4, 5).getTime();

async function judge(src){
  const r = [];
  const t = (ok, msg) => r.push([!!ok, msg]);
  try {
    const M = load(src);
    const D = new Date(2026, 0, 2, 3, 4, 5);
    /* 1절 */
    t(M.fileName('꿀곰', D, 'image/png') === '말랑이_꿀곰_20260102_030405.png', '보통 — 말랑이_보낸사람_날짜.png(두 자리 채움)');
    t(M.fileName('a/b\\c:d*e?f"g<h>i|j', D, 'image/png') === '말랑이_a_b_c_d_e_f_g_h_i_j_20260102_030405.png', '  못 쓰는 글자 \\ / : * ? " < > | 는 _');
    t(M.fileName('x\u0000\u001fy', D, '') === '말랑이_x__y_20260102_030405.png', '  제어 문자도 _');
    t(M.fileName('', D, 'image/png').startsWith('말랑이_친구_') && M.fileName(null, D, '').startsWith('말랑이_친구_') && M.fileName(undefined, D, '').startsWith('말랑이_친구_'), '  빈 이름 · null · undefined → 친구');
    t(M.fileName('///', D, '').startsWith('말랑이_친구_') && M.fileName(' .. ', D, '').startsWith('말랑이_친구_'), '  못 쓰는 글자뿐 · 점과 공백뿐 → 친구');
    t(M.fileName(' .꿀곰. ', D, '').startsWith('말랑이_꿀곰_'), '  앞뒤 점 · 공백은 뗀다');
    t(M.fileName('가'.repeat(30), D, '') === '말랑이_' + '가'.repeat(20) + '_20260102_030405.png', '  이름은 20자까지');
    t(M.extOf('image/gif') === 'gif' && M.extOf('image/jpeg') === 'jpg' && M.extOf('image/webp') === 'webp' && M.extOf('IMAGE/GIF; x=1') === 'gif', 'extOf — gif · jpg · webp · 대문자와 덧붙은 값');
    t(M.extOf('') === 'png' && M.extOf(null) === 'png' && M.extOf('image/svg+xml') === 'png' && M.extOf('text/html') === 'png', '  모르는 형식 · 빈 값은 png');
    t(M.fileName('꿀곰', D, 'image/gif').endsWith('.gif'), '  GIF 선물은 .gif 로(움직임 유지)');

    /* 2절 */
    let e = mkEnv(M, { blob: PNG });
    let ans = await e.gs.save({ imgUrl: 'https://f.example.com/g.png', fromName: '꿀곰', ts: TS });
    t(ans === 'ok' && e.fetched.join() === 'https://f.example.com/g.png' && e.clicked.length === 1, '저장 — 그림을 받아 한 번 누른다');
    t(e.clicked[0] && e.clicked[0].href === 'blob:x1' && e.clicked[0].download === '말랑이_꿀곰_20260102_030405.png', '  파일 이름 · 받은 바이트 주소');
    t(e.appended === 1 && e.removed === 1 && e.revoked.join() === 'blob:x1' && e.timers.join() === '4000', '  링크는 붙였다 떼고 · 주소는 4초 뒤 놓는다');
    t(e.fails.length === 0, '  성공이면 실패 알림 없음');
    e = mkEnv(M, { blob: { size: 3, type: 'image/gif' } });
    await e.gs.save({ imgUrl: 'https://f.example.com/g.gif', fromName: '꿀곰' });
    t(e.clicked[0] && e.clicked[0].download === '말랑이_꿀곰_20261101_090507.gif', '  받은 시각이 없으면 지금 시각 · gif 확장자');
    e = mkEnv(M, { blob: PNG });
    await e.gs.save({ imgUrl: 'data:image/png;base64,iVBORw0KGgo=', fromName: 'a', ts: TS });
    t(e.fetched.length === 1 && e.clicked.length === 1, '  data:image 주소도 저장');

    e = mkEnv(M, { res: { ok: false, status: 404, blob: async () => PNG } });
    ans = await e.gs.save({ imgUrl: 'https://f.example.com/x.png', fromName: 'a', ts: TS });
    t(ans === 'fail' && e.clicked.length === 0 && e.fails.length === 1 && /404/.test(e.fails[0]), '★ HTTP 404 → 실패 알림 · 안 누름');
    e = mkEnv(M, { blob: { size: 50, type: 'text/html' } });
    ans = await e.gs.save({ imgUrl: 'https://f.example.com/x.png', fromName: 'a', ts: TS });
    t(ans === 'fail' && e.clicked.length === 0 && e.fails.length === 1, '  그림이 아닌 응답(오류 페이지) → 실패');
    e = mkEnv(M, { blob: { size: 0, type: 'image/png' } });
    ans = await e.gs.save({ imgUrl: 'https://f.example.com/x.png', fromName: 'a', ts: TS });
    t(ans === 'fail' && e.clicked.length === 0, '  빈 그림(0 바이트) → 실패');
    e = mkEnv(M, { throw: true, blob: PNG });
    ans = await e.gs.save({ imgUrl: 'https://f.example.com/x.png', fromName: 'a', ts: TS });
    t(ans === 'fail' && e.clicked.length === 0 && e.fails.length === 1, '  받기 오류(네트워크 · CSP) → 실패');
    e = mkEnv(M, { blob: PNG });
    const a1 = await e.gs.save({ imgUrl: '', fromName: 'a' }), a2 = await e.gs.save(null), a3 = await e.gs.save({ imgUrl: 'javascript:alert(1)' }), a4 = await e.gs.save({ imgUrl: 'http://f.example.com/x.png' });
    t([a1, a2, a3, a4].every(x => x === 'fail') && e.fetched.length === 0 && e.fails.length === 4, '★ 주소 없음 · null · javascript: · http → 받지 않고 실패');
  } catch (err) {
    t(false, '돌리다 오류 — ' + (err && err.message || err));
  }
  return r;
}

(async () => {
  say('── 1 · 2. 파일 이름 · 저장 흐름 (진짜 모듈을 돌린다)');
  const r = await judge(SRC.mod);
  r.forEach(([ok, m]) => chk(ok, m));

  say('── 3. 연결');
  const h = SRC.html;
  const iG = h.indexOf('<script src="parts/myhome/gift-save.js"'), iI = h.indexOf('<script src="parts/myhome/myhome-inbox.js"'), iA = h.indexOf('<script src="parts/app.js"'), iS = h.indexOf('parts/shared/safe-html.js'), iE = h.indexOf('parts/shared/error-codes.js');
  chk(iG > 0 && iG < iI && iG < iA, 'html — gift-save.js 를 myhome-inbox.js · app.js 보다 먼저 싣는다');
  chk(iS > 0 && iE > 0, '  safe-html.js · error-codes.js 도 실린다(app.js 가 넘길 때 부른다)');
  const call = (SRC.app.match(/TwMyHomeInbox\.createMyHomeInbox\(\{([\s\S]*?)\n\}\);/) || [])[1] || '';
  chk(/giftSave: TwGiftSave\.createGiftSave\(\{[^\n]*safeUrl: TwSafeHtml\.safeUrl[^\n]*TwErrorCodes\.notify\('E-MH-03', e\)/.test(call), 'app.js — 수령함 모듈에 giftSave 를 넘긴다(safeUrl · E-MH-03)');
  chk(/'E-MH-03': \{ msg: '[^']+', where: 'myhome\/gift-save\.js/.test(SRC.codes), '에러 번호 E-MH-03 이 표에 있다');
  const win = {}; new Function('window', 'module', SRC.mod)(win, undefined);
  chk(Object.keys(win).join() === 'TwGiftSave' && Object.isFrozen(win.TwGiftSave) && Object.keys(win.TwGiftSave).join() === 'fileName,extOf,createGiftSave', '싣기만 하면 window.TwGiftSave 하나 · 얼린 묶음');

  say('── 4. 일부러 깨 보기');
  const BREAKS = [
    [".replace(BAD_CH, '_')", '', '못 쓰는 글자를 안 바꿈'],
    ["if(!who || /^_+$/.test(who)) who = '친구';", '', '빈 이름을 «친구» 로 안 채움'],
    [".slice(0, NAME_MAX)", '', '이름 길이를 안 자름'],
    ["if(!res.ok) throw new Error('HTTP ' + res.status);", '', 'HTTP 오류를 안 봄'],
    ["if(!blob || !blob.size || !/^image\\//.test(blob.type || '')) throw new Error('그림 아님');", '', '그림인지 안 봄'],
    ["safeUrl(gift.imgUrl, 'image')", 'gift.imgUrl', 'safeUrl 을 안 거침'],
    ["'image/gif': 'gif', ", '', 'GIF 를 png 로 저장'],
    ["later(()=>URL.revokeObjectURL(href), REVOKE_MS);", '', '받은 주소를 안 놓음'],
  ];
  for (const [from, to, why] of BREAKS) {
    const broken = SRC.mod.replace(from, to);
    if (broken === SRC.mod) { chk(false, '깨 보기 자리를 못 찾음 — ' + why); continue; }
    const rr = await judge(broken);
    chk(rr.some(([ok]) => !ok), why + ' → 빨강');
  }

  say(`\n${fail ? '✗' : '✓'} 통과 ${pass} · 실패 ${fail}`);
  process.exit(fail ? 1 : 0);
})();
