/* sim-sticker-layer.js — 🎨 마이홈 스티커 보이기(parts/myhome/sticker-layer.js · 이 PC 설정)를 실제로 돌려 본다
   실행: node checks/run.js sim-sticker-layer
   ・1절 값 — 기본 켜짐 · '0' 이면 꺼짐 · 끄고 켜면 tw.mhStickerLayer 에 0 · 1 · 저장소가 없거나 던져도 켜짐으로 돈다
   ・2절 알림 — 바뀔 때만 onChange(같은 값은 안 부름) · 뗀 뒤엔 안 부름
   ・3절 배선 — html · smoke 순서 · app.js 가 설정 창보다 먼저 만들고 그리기에 다시 그리기를 건다 · 설정 줄 · 기기 칸 목록
   ・4절 mutation test */
'use strict';
const fs = require('fs');
let pass = 0, fail = 0;
const say = (s) => console.log(s);
const chk = (ok, msg) => { ok ? pass++ : fail++; say('  ' + (ok ? '✓' : '✗') + ' ' + msg); };
const read = (f) => { for(const c of [f, 'parts/' + f, 'app/parts/' + f, 'app/' + f, f.split('/').pop()]) if(fs.existsSync(c)) return fs.readFileSync(c, 'utf8'); return null; };
const SRC = read('myhome/sticker-layer.js'), APP = read('app.js'), HTML = read('desk-companion-prototype.html'), SMOKE = read('smoke.js'), ACC = read('shared/account-store.js'), SET = read('launcher/settings-panel.js');
if(!SRC || !APP || !HTML || !SMOKE || !ACC || !SET){ say('  ? 원본 못 찾음'); process.exit(2); }
const load = (src) => { const w = {}; new Function('window', 'module', src)(w, undefined); return w.TwStickerLayer; };
const mkStore = (init) => { const m = Object.assign({}, init); return { m, getItem: (k) => (k in m ? m[k] : null), setItem: (k, v) => { m[k] = String(v); } }; };

function judge(src){
  const r = [];
  const t = (ok, msg) => r.push([!!ok, msg]);
  const L = load(src);
  const KEY = 'tw.mhStickerLayer';
  t(L.KEY === KEY, '저장 키는 tw.mhStickerLayer(tw. 접두사)');
  t(L.createStickerLayer({ storage: mkStore({}) }).on() === true, '기본 켜짐(값이 없으면)');
  t(L.createStickerLayer({ storage: mkStore({ [KEY]: '0' }) }).on() === false && L.createStickerLayer({ storage: mkStore({ [KEY]: '1' }) }).on() === true, "'0' 이면 꺼짐 · '1' 이면 켜짐");
  const st = mkStore({}); const a = L.createStickerLayer({ storage: st });
  a.set(false); const s0 = st.m[KEY], on0 = a.on(); a.set(true);
  t(s0 === '0' && on0 === false && st.m[KEY] === '1' && a.on() === true, '끄면 0 · 켜면 1 을 이 PC 에 적는다');
  t(L.createStickerLayer({ storage: mkStore({ [KEY]: '0' }) }).on() === false && L.createStickerLayer({ storage: st }).on() === true, '다음에 켜도 고른 값 그대로');
  const bad = { getItem(){ throw new Error('x'); }, setItem(){ throw new Error('x'); } };
  let threw = false, b = null, n = null;
  try{ b = L.createStickerLayer({ storage: bad }); b.set(false); n = L.createStickerLayer({ storage: null }); n.set(false); }catch(_){ threw = true; }
  t(!threw && b.on() === false && n.on() === false, '저장소가 던지거나 없어도 서지 않는다(이 실행 동안은 고른 값)');
  const c = L.createStickerLayer({ storage: mkStore({}) }); const seen = [];
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
  chk(at(HTML, '<script src="parts/myhome/sticker-layer.js"></script>') > 0 && at(HTML, '<script src="parts/myhome/sticker-layer.js"></script>') < at(HTML, '<script src="parts/app.js"></script>'), 'html — sticker-layer.js 를 app.js 보다 먼저 싣는다');
  chk(at(SMOKE, "PRELOAD.push('sticker-layer.js')") > 0, 'smoke PRELOAD 에 sticker-layer.js');
  const iMk = at(APP, 'const stickerLayerMod = TwStickerLayer.createStickerLayer({ storage: localStorage });'), iSet = at(APP, 'const settingsMod = TwSettingsPanel.createSettingsPanel({');
  chk(iMk > 0 && iSet > iMk, 'app.js — 설정 창보다 먼저 만든다(설정 창이 만들 때 읽어도 TDZ 가 없다)');
  chk(APP.includes('stickerLayerMod.onChange(()=>stickerRenderMod.renderMyHomeStickers());'), 'app.js — 바뀌면 스티커를 다시 그린다(아래 모듈이 위층을 부르지 않고 알림에 건다)');
  chk((APP.match(/^  stickerLayer: stickerLayerMod,$/gm) || []).length === 3, 'app.js — 설정 창 · 스티커 그리기 · 관리 창 셋에 넘긴다');
  chk(/id="fsMhStickerToggle"/.test(HTML) && SET.includes("document.getElementById('fsMhStickerToggle')") && SET.includes('stickerLayer.set(!stickerLayer.on()); refreshToggleBtns();'), '설정 › 디스플레이 «마이홈 스티커» 줄 — 누르면 뒤집고 버튼을 다시 그린다');
  chk(ACC.includes("'tw.mhStickerLayer'"), '기기 칸 목록(account-store.js)에 tw.mhStickerLayer — 계정을 바꿔도 이 PC 설정으로 남는다');
}

say('── 4절 mutation test');
{
  const muts = [
    ['기본을 꺼짐으로', SRC.replace("on = !storage || storage.getItem(KEY) !== '0';", "on = !!storage && storage.getItem(KEY) === '1';")],
    ['저장을 안 함', SRC.replace("try{ if(storage) storage.setItem(KEY, on ? '1' : '0'); }catch(_){}", '')],
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
