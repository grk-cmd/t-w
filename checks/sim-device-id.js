/* sim-device-id.js — 🖥️ 이 기기 id(shared/device-id.js) 검사
   ・1절: 처음 한 번 만들어 저장 · 그 뒤로는 저장값(다시 만들지 않음) · 저장값이 모양 밖이면 새로 만들어 덮음
   ・2절: 저장이 막혀도(읽기 · 쓰기 던짐 · 저장소 없음) 이번 실행 동안 같은 값 · 만든 값이 모양 밖이면 던짐(조용히 넘어가지 않음)
   ・3절: 모양 — API 머리 · realtime hello 둘 다 받는 규칙 · 저장 키 tw. 접두사
   ・4절: 배선 — window.TwDeviceId · 브라우저 한 벌이 request-id.js newId 로 만든다 · html 차례(request-id → device-id → api-client)
   ・5절: 일부러 깨 보기 */
'use strict';
const fs = require('fs');
let pass = 0, fail = 0, quiet = false, qfail = 0;
const say = (s) => { if(!quiet) console.log(s); };
const chk = (ok, msg) => { if(quiet){ if(!ok) qfail++; return; } ok ? pass++ : fail++; say('  ' + (ok ? '✓' : '✗') + ' ' + msg); };
const read = (f) => { try{ return fs.readFileSync(f, 'utf8'); }catch(_){ return null; } };
const pick = (names) => names.map(read).find((v) => v != null);
const at = (f, dir) => [f, 'parts/' + dir + '/' + f, 'app/parts/' + dir + '/' + f];
const SRC0 = {
  DID: pick(at('device-id.js', 'shared')),
  RID: pick(at('request-id.js', 'shared')),
  HTML: pick(['desk-companion-prototype.html', 'app/desk-companion-prototype.html']),
};
for(const k of Object.keys(SRC0)) if(!SRC0[k]){ console.log('  ? 원본 못 찾음 — ' + k); process.exit(2); }
const mem = (init) => { const o = Object.assign({}, init || {}); const writes = []; return { o, writes, getItem: (k) => (k in o ? o[k] : null), setItem: (k, v) => { writes.push([k, v]); o[k] = String(v); } }; };
const load = (src, win) => { const w = win || {}; new Function('window', 'module', src)(w, undefined); return w; };
const API_RE = /^[A-Za-z0-9_-]{8,64}$/, RT_RE = /^[A-Za-z0-9_.:-]{1,64}$/;   // 서버 쪽 규칙(API 기기 칸 · realtime hello.deviceId)

function judge(S){
  let D = null;
  try{ D = load(S.DID, {}).TwDeviceId; }catch(e){ chk(false, '싣다 던짐 — ' + e.message); return; }
  if(!D || typeof D.createDeviceId !== 'function'){ chk(false, 'window.TwDeviceId.createDeviceId 가 없다'); return; }

  say('── 1. 처음 한 번 · 저장값');
  {
    let n = 0;
    const st = mem();
    const dv = D.createDeviceId({ storage: st, newId: () => 'dev-' + String(++n).padStart(8, '0') });
    const a = dv.get(), b = dv.get();
    chk(a === 'dev-00000001' && b === a && n === 1 && st.writes.length === 1 && st.o[D.STORAGE_KEY] === a, '처음 부를 때 한 번 만들어 저장 · 두 번째는 같은 값(새로 안 만듦)');
    const dv2 = D.createDeviceId({ storage: st, newId: () => 'dev-' + String(++n).padStart(8, '0') });
    chk(dv2.get() === a && n === 1, '  ↳ 다음 실행(새 한 벌)은 저장값 그대로');
    const bad = mem({ [D.STORAGE_KEY]: 'bad id!' });
    const dv3 = D.createDeviceId({ storage: bad, newId: () => 'fresh-0001' });
    chk(dv3.get() === 'fresh-0001' && bad.o[D.STORAGE_KEY] === 'fresh-0001', '  ↳ 저장값이 모양 밖이면 새로 만들어 덮는다');
    const short = D.createDeviceId({ storage: mem({ [D.STORAGE_KEY]: 'abc1234' }), newId: () => 'fresh-0002' });
    chk(short.get() === 'fresh-0002', '  ↳ 7자 저장값도 모양 밖(8자부터)');
  }

  say('── 2. 저장이 막혀도');
  {
    let n = 0;
    const throwing = { getItem(){ throw new Error('blocked'); }, setItem(){ throw new Error('blocked'); } };
    const dv = D.createDeviceId({ storage: throwing, newId: () => 'tmp-' + String(++n).padStart(8, '0') });
    chk(dv.get() === 'tmp-00000001' && dv.get() === 'tmp-00000001' && n === 1, '읽기 · 쓰기가 던져도 이번 실행 동안 같은 값');
    const none = D.createDeviceId({ storage: null, newId: () => 'none-0001' });
    chk(none.get() === 'none-0001' && none.get() === 'none-0001', '  ↳ 저장소가 없어도');
    let threw = false;
    try{ D.createDeviceId({ storage: mem(), newId: () => 'x' }).get(); }catch(_){ threw = true; }
    chk(threw, '  ↳ 만든 값이 모양 밖이면 던진다(틀린 머리를 서버에 보내지 않게)');
  }

  say('── 3. 모양');
  chk(String(D.PATTERN) === String(API_RE), '규칙이 API 기기 칸 규칙과 같은 글 ' + String(D.PATTERN));
  chk(['abcdefgh', 'a'.repeat(64), '0b6c1f4e-2d0b-4b9e-9a7a-1f2e3d4c5b6a'].every((v) => D.PATTERN.test(v) && RT_RE.test(v)), '  ↳ 맞는 값은 realtime hello.deviceId 규칙에도 맞다(API 쪽이 더 좁다)');
  chk(/^tw\./.test(D.STORAGE_KEY) && D.STORAGE_KEY === 'tw.deviceId', '저장 키 tw.deviceId');

  say('── 4. 배선');
  {
    const ls = mem();
    const w = { localStorage: ls, crypto: require('crypto').webcrypto };
    new Function('window', 'module', S.RID)(w, undefined);
    load(S.DID, w);
    const v = w.TwDeviceId && w.TwDeviceId.store ? w.TwDeviceId.store.get() : null;
    chk(typeof v === 'string' && API_RE.test(v) && ls.o['tw.deviceId'] === v && w.TwDeviceId.store.get() === v, '브라우저 한 벌 — request-id.js newId(uuid)로 만들어 localStorage 에 · ' + v);
    const h = S.HTML, iR = h.indexOf('<script src="parts/shared/request-id.js"></script>'), iD = h.indexOf('<script src="parts/shared/device-id.js"></script>'),
      iC = h.indexOf('<script src="parts/shared/api-client.js"></script>'), iA = h.indexOf('<script src="parts/app.js"></script>');
    chk(iR > 0 && iD > iR && iC > iD && iA > iC, 'html — request-id.js → device-id.js → api-client.js → app.js 차례');
  }
}

judge(SRC0);

say('── 5. 일부러 깨 보기');
const BREAKS = [
  ['DID', "    if(cur) return cur;\n", "", '부를 때마다 새로 읽음(저장이 막히면 매번 다른 값)'],
  ['DID', "    if(saved){ cur = saved; return cur; }", "", '저장값을 안 쓰고 매번 새로 만듦'],
  ['DID', "return (typeof v === 'string' && PATTERN.test(v)) ? v : null;", "return (typeof v === 'string') ? v : null;", '모양 밖 저장값을 그대로 씀'],
  ['DID', "    try{ if(storage) storage.setItem(STORAGE_KEY, cur); }catch(_){}", "    if(storage) storage.setItem(STORAGE_KEY, cur);", '저장이 막히면 던짐'],
  ['DID', "    if(typeof made !== 'string' || !PATTERN.test(made)) throw new Error('[기기 id] 만든 값이 모양 밖 — ' + made);\n", "", '모양 밖 값을 그대로 씀'],
  ['DID', "const STORAGE_KEY = 'tw.deviceId';", "const STORAGE_KEY = 'deviceId';", '저장 키에 tw. 이 빠짐'],
  ['HTML', '<script src="parts/shared/device-id.js"></script>', '', 'html 에 안 실음'],
];
const caught = [];
for(const [where, from, to, what] of BREAKS){
  if(SRC0[where].indexOf(from) < 0){ chk(false, '깨 볼 글을 못 찾음 — ' + what); continue; }
  const S = Object.assign({}, SRC0); S[where] = S[where].split(from).join(to);
  quiet = true; qfail = 0;
  try{ judge(S); }catch(_){ qfail++; }
  quiet = false;
  caught.push([what, qfail]);
}
const missed = caught.filter(([, k]) => k === 0).map(([w]) => w);
chk(caught.length === BREAKS.length && !missed.length, '일부러 깨 본 ' + BREAKS.length + '가지를 다 잡는다' + (missed.length ? ' — 못 잡음: ' + missed.join(' · ') : ''));

console.log(`\n${fail ? '✗' : '✓'} 통과 ${pass} · 실패 ${fail}`);
process.exit(fail ? 1 : 0);
