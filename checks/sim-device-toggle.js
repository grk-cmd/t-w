/* sim-device-toggle.js — 이 PC 의 켜고 끄는 화면 설정 하나(parts/shared/device-toggle.js)를 실제로 돌려 본다
   실행: node checks/run.js sim-device-toggle
   ・1절 값 — 기본 켜짐 · '0' 이면 꺼짐 · 끄고 켜면 그 키에 0 · 1 · 저장소가 없거나 던져도 돈다 · 키는 tw. 로 시작해야 한다 · 키마다 따로
   ・2절 알림 — 바뀔 때만 onChange(같은 값은 안 부름) · 뗀 뒤엔 안 부름
   ・3절 배선 — html · smoke 순서 · «남의 자리비움 그림»: app.js 가 설정 창보다 먼저 만들어 설정 창 · 자리비움 그림에 넘김 · 설정 줄 · 기기 칸 목록
   ・4절 mutation test */
'use strict';
const fs = require('fs');
let pass = 0, fail = 0;
const say = (s) => console.log(s);
const chk = (ok, msg) => { ok ? pass++ : fail++; say('  ' + (ok ? '✓' : '✗') + ' ' + msg); };
const read = (f) => { for(const c of [f, 'parts/' + f, 'app/parts/' + f, 'app/' + f, f.split('/').pop()]) if(fs.existsSync(c)) return fs.readFileSync(c, 'utf8'); return null; };
const SRC = read('shared/device-toggle.js'), APP = read('app.js'), HTML = read('desk-companion-prototype.html'), SMOKE = read('smoke.js'), ACC = read('shared/account-store.js'), SET = read('launcher/settings-panel.js');
if(!SRC || !APP || !HTML || !SMOKE || !ACC || !SET){ say('  ? 원본 못 찾음'); process.exit(2); }
const load = (src) => { const w = {}; new Function('window', 'module', src)(w, undefined); return w.TwDeviceToggle; };
const mkStore = (init) => { const m = Object.assign({}, init); return { m, getItem: (k) => (k in m ? m[k] : null), setItem: (k, v) => { m[k] = String(v); } }; };

function judge(src){
  const r = [];
  const t = (ok, msg) => r.push([!!ok, msg]);
  const L = load(src);
  const K = 'tw.someToggle';
  const mk = (storage, key) => L.createDeviceToggle({ storage, key: key || K });
  t(mk(mkStore({})).on() === true, '기본 켜짐(값이 없으면)');
  t(mk(mkStore({ [K]: '0' })).on() === false && mk(mkStore({ [K]: '1' })).on() === true, "'0' 이면 꺼짐 · '1' 이면 켜짐");
  const st = mkStore({}); const a = mk(st);
  a.set(false); const s0 = st.m[K], on0 = a.on(); a.set(true);
  t(s0 === '0' && on0 === false && st.m[K] === '1' && a.on() === true, '끄면 0 · 켜면 1 을 그 키에 적는다');
  const two = mkStore({}); const x = mk(two, 'tw.a'), y = mk(two, 'tw.b'); x.set(false);
  t(x.on() === false && y.on() === true && two.m['tw.a'] === '0' && !('tw.b' in two.m), '키마다 따로다(하나를 꺼도 다른 설정은 그대로)');
  const bad = { getItem(){ throw new Error('x'); }, setItem(){ throw new Error('x'); } };
  let threw = false, b = null, n = null;
  try{ b = mk(bad); b.set(false); n = mk(null); n.set(false); }catch(_){ threw = true; }
  t(!threw && b.on() === false && n.on() === false, '저장소가 던지거나 없어도 서지 않는다(이 실행 동안은 고른 값)');
  let badKey = 0;
  for(const k of ['awayPic', '', undefined, 'TW.x']){ try{ L.createDeviceToggle({ storage: mkStore({}), key: k }); }catch(_){ badKey++; } }
  t(badKey === 4, '저장 키가 tw. 로 시작하지 않으면 만들 때 던진다(조용히 다른 칸에 적지 않게) — ' + badKey);
  const c = mk(mkStore({})); const seen = [];
  const off = c.onChange((v) => seen.push(v));
  c.set(true); c.set(false); c.set(false); c.set(true);
  t(seen.join() === 'false,true', '바뀔 때만 알린다(같은 값은 안 알림) — ' + seen.join());
  off(); c.set(false);
  t(seen.length === 2, '뗀 뒤엔 알리지 않는다');
  return r;
}

say('── 1 · 2절 값 · 알림');
judge(SRC).forEach(([ok, msg]) => chk(ok, msg));

say('── 3절 배선');
{
  const at = (s, x) => s.indexOf(x);
  const tag = '<script src="parts/shared/device-toggle.js"></script>';
  chk(at(HTML, tag) > 0 && at(HTML, tag) < at(HTML, '<script src="parts/app.js"></script>'), 'html — device-toggle.js 를 app.js 보다 먼저 싣는다');
  chk(at(SMOKE, "PRELOAD.push('device-toggle.js')") > 0, 'smoke PRELOAD 에 device-toggle.js');
  const iMk = at(APP, "const awayOthersMod = TwDeviceToggle.createDeviceToggle({ storage: localStorage, key: 'tw.awayPicOthers' });"), iSet = at(APP, 'const settingsMod = TwSettingsPanel.createSettingsPanel({');
  chk(iMk > 0 && iSet > iMk, 'app.js — «남의 자리비움 그림» 을 설정 창보다 먼저 만든다(설정 창이 만들 때 읽어도 TDZ 가 없다)');
  chk((APP.match(/^  awayOthers: awayOthersMod,$/gm) || []).length === 2, 'app.js — 설정 창 · 자리비움 그림 둘에 넘긴다');
  chk(/id="fsAwayOthersToggle"/.test(HTML) && SET.includes("document.getElementById('fsAwayOthersToggle')") && SET.includes('awayOthers.set(!awayOthers.on()); refreshToggleBtns();'), '설정 › 디스플레이 «남의 자리비움 그림» 줄 — 누르면 뒤집고 버튼을 다시 그린다');
  chk(ACC.includes("'tw.awayPicOthers'"), '기기 칸 목록(account-store.js)에 tw.awayPicOthers — 계정을 바꿔도 이 PC 설정으로 남는다');
}

say('── 4절 mutation test');
{
  const muts = [
    ['기본을 꺼짐으로', SRC.replace("on = !storage || storage.getItem(key) !== '0';", "on = !!storage && storage.getItem(key) === '1';")],
    ['저장을 안 함', SRC.replace("try{ if(storage) storage.setItem(key, on ? '1' : '0'); }catch(_){}", '')],
    ['키를 안 가림', SRC.replace(/  if\(typeof key !== 'string'[^\n]*\n/, '')],
    ['같은 값에도 알림', SRC.replace('    if(next === on) return;\n', '')],
    ['알리지 않음', SRC.replace('    fns.slice().forEach(fn => fn(on));\n', '')],
    ['떼기가 안 됨', SRC.replace('if(i >= 0) fns.splice(i, 1);', '')],
  ];
  for(const [name, m] of muts){
    let red = false;
    try{ red = judge(m).some(([ok]) => !ok); }catch(_){ red = true; }
    chk(m !== SRC && red, name + ' → 빨강' + (m === SRC ? ' — 바꿀 글을 못 찾음' : ''));
  }
}

say(`\n${fail ? '✗' : '✓'} ${pass} 통과 · ${fail} 실패`);
console.log(pass + ' · ' + fail);
process.exit(fail ? 1 : 0);
