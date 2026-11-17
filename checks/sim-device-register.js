/* sim-device-register.js — 🖥️ 이 PC 등록(account/device-register.js) — 계정마다 PC 셋 · 넷째 PC 는 묻고 지운다 · 저절로 지우지 않는다
   실행:  node sim-device-register.js   (러너 스테이징 또는 저장소 루트에서)
   ・1절: 이름 · 글 — OS 이름(호스트 이름 없음) · 처음 등록한 날 · 마지막 사용 · 묻는 글 한 줄 · navigator → os
   ・2절: 흐름을 실제로 돌린다 — 바로 됨 · 셋이 다 참(묻기 → [지우고 사용] → 보여 준 그 기기 id 로 다시) · [취소] · 그사이 바뀐 가장 오래된 기기(다시 묻기) ·
          실패(번호 한 번) · 겹쳐 부르기(한 번) · 끝없이 바뀌면 멈춤
   ・3절: 연결 — app.js(등록 → 확인창 · 기기 id · 세션 id · os) · html · smoke PRELOAD
   ・4절: 일부러 깨 보기 */
'use strict';
const fs = require('fs');
const path = require('path');
let pass = 0, fail = 0;
const say = (s) => console.log(s);
const chk = (ok, msg) => { ok ? pass++ : fail++; say('  ' + (ok ? '✓' : '✗') + ' ' + msg); };
const read = (f) => { for (const c of [f, 'parts/' + f, 'app/parts/' + f, 'apps/desktop/app/parts/' + f, path.basename(f), 'apps/desktop/app/' + f, 'app/' + f, 'checks/' + f]) if (fs.existsSync(c)) return fs.readFileSync(c, 'utf8'); return null; };
const MOD = read('account/device-register.js'), APP = read('app.js'), HTML = read('desk-companion-prototype.html'), SMOKE = read('smoke.js');
if (!MOD || !APP || !HTML) { say('  ? 원본 못 찾음 — device-register.js · app.js · desk-companion-prototype.html'); process.exit(2); }

function load(src) { const win = {}; new Function('window', 'module', src)(win, undefined); return win.TwDeviceRegister; }
const OLD = (id, os, claimedAt, lastSeenAt) => ({ deviceId: id, os, claimedAt, lastSeenAt });
const limitErr = (oldest) => Object.assign(new Error('셋'), { kind: 'request', status: 409, code: 'USER_DEVICE_LIMIT', items: [oldest] });
/* 서버 흉내 — answers 를 차례로(없으면 'ok'). 받은 본문을 남긴다 */
function world(src, answers, o) {
  o = o || {};
  const R = load(src);
  const sent = [], asked = [], errs = [];
  let i = 0;
  const mod = R.createDeviceRegister({
    registerDevice: async (body) => { sent.push(body); const a = answers[i++]; if (o.hold && i === 1) await o.hold; if (a instanceof Error) throw a; return { deviceId: body.deviceId }; },
    limitOldestOf: (e) => (e && e.code === 'USER_DEVICE_LIMIT' && Array.isArray(e.items) ? e.items[0] : null),
    deviceId: () => 'pc-mine', session: () => 'sess1', os: () => 'windows',
    ask: async (q, oldest) => { asked.push([q, oldest.deviceId]); return typeof o.yes === 'function' ? o.yes(asked.length) : o.yes !== false; },
    notifyError: (code) => errs.push(code),
  });
  return { R, mod, sent, asked, errs };
}

async function judge(src) {
  const r = [];
  const t = (ok, msg) => r.push([!!ok, msg]);
  let R;
  try { R = load(src); } catch (e) { t(false, '싣다 던짐 — ' + e.message); return r; }
  /* 1 */
  const d = (iso) => R.dateKo(iso);
  const nov3 = new Date(2026, 10, 3, 12).toISOString(), nov10 = new Date(2026, 10, 10, 12).toISOString();
  t(d(nov3) === '11월 3일' && d('없음') === null && d(null) === null, '날짜 — «11월 3일»(이 PC 시간대) · 못 읽으면 null');
  t(R.deviceLabel({ os: 'windows', claimedAt: nov3 }) === 'Windows PC (11월 3일 등록)' && R.deviceLabel({ os: 'mac', claimedAt: nov3 }) === 'Mac (11월 3일 등록)'
    && R.deviceLabel({ os: null, claimedAt: nov3 }) === 'PC (11월 3일 등록)' && R.deviceLabel({ os: 'other', claimedAt: null }) === 'PC',
    '★ 기기 이름 = OS + 처음 등록한 날(Windows PC · Mac · 모르면 PC) — 호스트 이름은 쓰지 않는다');
  t(R.limitQuestion(OLD('a', 'windows', nov3, nov10)) === '가장 오래된 기기 Windows PC (11월 3일 등록) · 마지막 사용 11월 10일 — 이 기기를 지우고 이 PC를 쓸까요?',
    '★ 묻는 글 — «가장 오래된 기기 Windows PC (11월 3일 등록) · 마지막 사용 11월 10일 — 이 기기를 지우고 이 PC를 쓸까요?»');
  t(R.limitQuestion(OLD('a', 'mac', nov3, null)) === '가장 오래된 기기 Mac (11월 3일 등록) — 이 기기를 지우고 이 PC를 쓸까요?', '  마지막 사용을 모르면 그 칸만 뺀다');
  t(!/host|hostname|computerName|os\.hostname/i.test(src.replace(/\/\*[\s\S]*?\*\//g, '')), '  코드에 호스트 이름 읽기가 없다');
  t(R.osOf({ platform: 'Win32' }) === 'windows' && R.osOf({ platform: 'MacIntel' }) === 'mac' && R.osOf({ platform: 'Linux x86_64' }) === 'linux'
    && R.osOf({ platform: '', userAgent: 'Mozilla/5.0 (Windows NT 10.0)' }) === 'windows' && R.osOf({}) === 'other' && R.osOf(null) === 'other', 'navigator → os(windows · mac · linux · other)');
  /* 2 */
  let w = world(src, []);
  let res = await w.mod.ensure();
  t(res === 'ok' && w.sent.length === 1 && JSON.stringify(w.sent[0]) === '{"deviceId":"pc-mine","session":"sess1","os":"windows"}' && !w.asked.length && !w.errs.length,
    '자리가 있으면 바로 등록 — { deviceId, session, os } 한 번 · 묻지 않음');
  const A = OLD('pc-a', 'windows', nov3, nov10), B = OLD('pc-b', 'mac', nov3, nov10);
  w = world(src, [limitErr(A)]);
  res = await w.mod.ensure();
  t(res === 'ok' && w.asked.length === 1 && w.asked[0][1] === 'pc-a' && /Windows PC \(11월 3일 등록\)/.test(w.asked[0][0]) && w.sent.length === 2 && w.sent[1].replaceOldest === 'pc-a' && !('replaceOldest' in w.sent[0]),
    '★ 셋이 다 참 — 가장 오래된 기기를 묻고 [지우고 사용]이면 보여 준 그 기기 id 를 replaceOldest 로 실어 다시(처음엔 싣지 않는다)');
  w = world(src, [limitErr(A)], { yes: false });
  res = await w.mod.ensure();
  t(res === 'canceled' && w.sent.length === 1 && w.asked.length === 1 && !w.errs.length, '★ [취소] — 지우지 않고 등록하지 않는다(canceled · 번호 없음)');
  w = world(src, [limitErr(A), limitErr(B)]);
  res = await w.mod.ensure();
  t(res === 'ok' && w.asked.map((x) => x[1]).join() === 'pc-a,pc-b' && w.sent.map((b) => b.replaceOldest || '-').join() === '-,pc-a,pc-b',
    '★ 그사이 가장 오래된 기기가 바뀌면(서버가 또 409) 새 기기로 다시 묻는다 — 보여 주지 않은 기기는 지우지 않는다');
  w = world(src, [limitErr(A), limitErr(B)], { yes: (n) => n === 1 });
  res = await w.mod.ensure();
  t(res === 'canceled' && w.sent.length === 2, '  두 번째 물음에서 [취소]하면 그대로 멈춘다');
  w = world(src, [Object.assign(new Error('x'), { kind: 'unavailable' })]);
  res = await w.mod.ensure();
  t(res === 'failed' && w.errs.join() === 'E-ACC-04' && !w.asked.length, '실패(닿지 못함 · 그 밖의 거절) — failed · E-ACC-04 한 번 · 묻지 않음');
  w = world(src, Array.from({ length: 20 }, (_, k) => limitErr(OLD('pc-' + k, 'windows', nov3, nov10))));
  res = await w.mod.ensure();
  t(res === 'failed' && w.asked.length === R.MAX_ASKS && w.errs.join() === 'E-ACC-04', '  가장 오래된 기기가 끝없이 바뀌면 ' + R.MAX_ASKS + '번 물은 뒤 멈춘다(끝없이 묻지 않음)');
  let open; const hold = new Promise((x) => { open = x; });
  w = world(src, [], { hold });
  const p1 = w.mod.ensure(), p2 = w.mod.ensure();
  open(); const both = await Promise.all([p1, p2]);
  t(p1 === p2 && both.join() === 'ok,ok' && w.sent.length === 1, '겹쳐 부르면 같은 약속 — 요청 한 번');
  res = await w.mod.ensure();
  t(res === 'ok' && w.sent.length === 2, '  끝난 뒤 다시 부르면 다시 등록한다(«다시 등록»)');
  return r;
}

(async () => {
  say('── 1~2. 실제로 돌려 본다');
  (await judge(MOD)).forEach(([ok, msg]) => chk(ok, msg));

  say('── 3. 연결');
  chk(/const deviceRegisterMod = TwDeviceRegister\.createDeviceRegister\(\{\n  registerDevice: \(o\)=>TwUserApi\.store\.registerDevice\(o\),\n  limitOldestOf: \(e\)=>TwUserApi\.limitOldestOf\(e\),\n  deviceId: \(\)=>TwDeviceId\.store\.get\(\),[^\n]*\n  session: \(\)=>TwRtHub\.store\.session\(\),[^\n]*\n  os: \(\)=>TwDeviceRegister\.osOf\(navigator\),\n  ask: \(question\)=>deviceLimitDialog\.ask\(question\),\n  notifyError: \(\.\.\.a\)=>TwErrorCodes\.notify\(\.\.\.a\),\n\}\);/.test(APP),
    'app.js — 서버 길(user-api) · 기기 id(X-Device-Id 와 같은 값) · 세션 id(hello.session 과 같은 값) · os · 확인창 · 오류 번호');
  chk(/registerDevice: \(\)=>deviceRegisterMod\.ensure\(\),/.test(APP), '  켜는 순서(app-boot)가 realtime 보다 먼저 등록한다');
  const order = [...HTML.replace(/<!--[\s\S]*?-->/g, '').matchAll(/<script\b[^>]*\bsrc="parts\/([^"]+\.js)"/g)].map((x) => x[1]);
  chk(order.indexOf('account/device-register.js') > 0 && order.indexOf('account/device-register.js') < order.indexOf('app.js'), 'html — device-register.js 를 app.js 보다 먼저 싣는다');
  chk(!SMOKE || /PRELOAD\.push\([^)]*'device-register\.js'/.test(SMOKE), 'smoke PRELOAD 에 device-register.js');

  say('── 4. 일부러 깨 보기 — 빨강이 나야 한다');
  const breaks = [
    ['보여 준 기기 대신 아무것도 안 싣고 다시', (m) => m.replace('        replaceOldest = oldest.deviceId;', '        replaceOldest = null;')],
    ['묻지 않고 지움', (m) => m.replace('        try{ yes = (await deps.ask(limitQuestion(oldest), oldest)) === true; }catch(_){ yes = false; }', '        yes = true;')],
    ['취소해도 다시 부름', (m) => m.replace("        if(!yes) return 'canceled';", '')],
    ['실패를 조용히', (m) => m.replace("        if(!oldest){ deps.notifyError('E-ACC-04', e); return 'failed'; }", "        if(!oldest){ return 'failed'; }")],
    ['이름에 등록한 날이 없음', (m) => m.replace("  return reg ? name + ' (' + reg + ' 등록)' : name;", '  return name;')],
    ['마지막 사용을 안 보임', (m) => m.replace("(last ? ' · 마지막 사용 ' + last : '')", "''")],
    ['겹쳐 부르면 두 번', (m) => m.replace('    if(running) return running;\n', '')],
    ['끝없이 물음', (m) => m.replace('        if(asks === MAX_ASKS) break;\n', '').replace('for(let asks = 0; asks <= MAX_ASKS; asks++)', 'for(let asks = 0; asks <= 50; asks++)')],
  ];
  for (const [name, fm] of breaks) {
    const m2 = fm(MOD);
    if (m2 === MOD) { chk(false, name + ' — 바꿀 글을 못 찾음'); continue; }
    let red = false;
    try { red = (await judge(m2)).some(([ok]) => !ok); } catch (_) { red = true; }
    chk(red, name);
  }
  say((fail ? '✗' : '✓') + ' 통과 ' + pass + ' · 실패 ' + fail);
  process.exit(fail ? 1 : 0);
})();
