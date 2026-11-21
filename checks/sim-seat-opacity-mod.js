/* ═══ 👻 sim-seat-opacity-mod.js — 캐릭터 투명도(room/seat-opacity.js · app.js 분리 M10) ═══════════════
   [왜] setSeatOpacity 를 모듈로 옮겼다. 동작은 그대로여야 한다.
   ・1절: 같은 값이면 건너뜀 · 자리비움(op<0.001)이면 mesh 를 끄고 원래 visible 을 기억 · 풀리면 복원 · _bodyOff 표시
   ・2절: 파츠 원본 투명도는 «불투명할 때 · 건드리기 전» 에만 잰다(머리가 영영 안 보이던 사고) · transparent · depthWrite
   ・3절: 연결 — html 순서 · 만드는 줄 · 옛 이름 · app.js 에 함수가 안 남음
   ・4절: mutation test
   [실행] 러너 스테이징 또는 저장소 루트에서. */
'use strict';
const fs = require('fs');
let pass = 0, fail = 0;
const say = (s) => console.log(s);
const chk = (ok, msg) => { ok ? pass++ : fail++; say('  ' + (ok ? '✓' : '✗') + ' ' + msg); };
const read = (f) => { for(const c of [f, 'parts/' + f, 'app/parts/' + f, 'app/' + f, f.split('/').pop()]) if(fs.existsSync(c)) return fs.readFileSync(c, 'utf8'); return null; };
const SRC = read('room/seat-opacity.js'), APP = read('app.js'), HTML = read('desk-companion-prototype.html');
if(!SRC || !APP || !HTML){ say('  ? 원본 못 찾음 — seat-opacity.js · app.js · desk-companion-prototype.html'); process.exit(2); }

function build(src){
  const win = {};
  new Function('window', 'module', src)(win, undefined);
  return win.TwSeatOpacity.createSeatOpacity({});
}
const mat = (o) => Object.assign({ userData: {}, opacity: 1, transparent: false, depthWrite: true, needsUpdate: false }, o || {});
const mesh = (m, vis) => ({ isMesh: true, material: m, visible: vis !== false, userData: {} });
const seatOf = (meshes) => ({ bodyWrap: { traverse: (fn) => meshes.forEach(fn) } });

say('§1 자리비움 켜고 끄기');
{
  const mod = build(SRC);
  const hid = mesh(mat(), false), shown = mesh(mat(), true);
  const s = seatOf([hid, shown, { isMesh: false }]);
  mod.setSeatOpacity(s, 0);
  chk(s._bodyOff === true && !hid.visible && !shown.visible, '자리비움(op 0) — 모든 mesh 를 끄고 _bodyOff 를 세운다');
  chk(hid.userData._prevVisible === false && shown.userData._prevVisible === true, '  원래 visible 을 기억(파츠 hides 로 숨긴 것을 구분)');
  mod.setSeatOpacity(s, 0);
  chk(s._lastOp === 0, '같은 값이면 건너뛴다(_lastOp)');
  mod.setSeatOpacity(s, 1);
  chk(s._bodyOff === false && hid.visible === false && shown.visible === true && hid.userData._prevVisible === undefined, '풀리면 원래대로 — 숨겼던 건 계속 숨김 · 기억 지움');
  const m = mesh(mat()); const s2 = seatOf([m]); mod.setSeatOpacity(s2, 0.5);
  chk(m.visible === true && m.userData._prevVisible === undefined, '반투명(0.5)에선 visible 을 안 건드린다');
  const arr = mesh([mat(), null, mat()]); const s3 = seatOf([arr]);
  let th = false; try{ mod.setSeatOpacity(s3, 0.5); }catch(_){ th = true; }
  chk(!th && arr.material[0].opacity === 0.5 && arr.material[2].opacity === 0.5, '머티리얼 배열(빈 칸 포함)도 돈다');
}
say('§2 파츠 원본 투명도');
{
  const mod = build(SRC);
  const m = mat({ opacity: 0.4, transparent: true }); const s = seatOf([mesh(m)]);
  mod.setSeatOpacity(s, 1);
  chk(m.userData._baseOpacity === 0.4 && m.userData._baseTransparent === true && m.opacity === 0.4 && m.transparent === true, '불투명할 때 원본(0.4 · 반투명)을 기억하고 곱한다');
  mod.setSeatOpacity(s, 0.5);
  chk(Math.abs(m.opacity - 0.2) < 1e-9 && m.transparent === true && m.depthWrite === false && m.needsUpdate, '상태 투명도 × 원본(0.5 × 0.4) · depthWrite 끔');
  const m2 = mat(); const s2 = seatOf([mesh(m2)]);
  mod.setSeatOpacity(s2, 0);
  chk(m2.userData._baseOpacity === undefined && m2.opacity === 0 && m2.userData._opTouched === true, '★ 숨은 동안 처음 만난 머티리얼은 원본을 안 잰다(0 을 원본으로 굳히지 않음)');
  mod.setSeatOpacity(s2, 1);
  chk(m2.opacity === 1 && m2.userData._baseOpacity === undefined, '★ 풀려 돌아와도(_opTouched) 다시 안 재서 1 로 돌아온다 — 머리가 영영 안 보이던 사고');
  const m3 = mat(); const s3 = seatOf([mesh(m3)]); mod.setSeatOpacity(s3, 1);
  chk(m3.transparent === false && m3.depthWrite === true && m3.userData._baseTransparent === false, '불투명 그대로면 transparent 켜지 않음');
}
say('§3 연결');
{
  const iO = HTML.indexOf('<script src="parts/room/seat-opacity.js"></script>'), iA = HTML.indexOf('<script src="parts/app.js"></script>');
  chk(iO > 0 && iA > iO, 'html — seat-opacity.js 를 app.js 보다 먼저 싣는다');
  const code = APP.replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/(^|[^:'"\\])\/\/[^\n]*/g, '$1 ');
  chk(/const seatOpacityMod = TwSeatOpacity\.createSeatOpacity\(\{\s*\}\);\s*const setSeatOpacity = seatOpacityMod\.setSeatOpacity;/.test(code), 'app.js — 만들고 옛 이름 const 로 받는다');
  chk(!/function setSeatOpacity\b/.test(code), '  app.js 에 setSeatOpacity 본문이 안 남음');
}
say('§4 mutation test');
{
  const brk = (from, to) => { const m = SRC.replace(from, to); return m === SRC ? null : m; };
  const m1 = brk("if(seat._lastOp===op) return;", '');
  chk(!!m1 && (() => { const mod = build(m1); const o = mesh(mat()); const s = seatOf([o]); mod.setSeatOpacity(s, 0); o.visible = true; mod.setSeatOpacity(s, 0); return o.visible === false; })() && (() => { const mod = build(SRC); const o = mesh(mat()); const s = seatOf([o]); mod.setSeatOpacity(s, 0); o.visible = true; mod.setSeatOpacity(s, 0); return o.visible === true; })(), '같은 값 건너뛰기를 빼면 빨강(원본은 건너뜀)');
  const m2 = brk("&& op >= 0.999)", "&& true)");
  chk(!!m2 && (() => { const mod = build(m2); const m = mat(); const s = seatOf([mesh(m)]); mod.setSeatOpacity(s, 0); return m.userData._baseOpacity === 1; })(), '불투명 조건을 빼면 숨은 채로 원본을 재서 빨강');
  const m3 = brk("&& !m.userData._opTouched", '');
  chk(!!m3 && (() => { const mod = build(m3); const m = mat(); const s = seatOf([mesh(m)]); mod.setSeatOpacity(s, 0); mod.setSeatOpacity(s, 1); return m.userData._baseOpacity === 0; })(), '_opTouched 를 빼면 0 이 원본으로 굳어 빨강');
  const m4 = brk("seat._bodyOff = hide;", '');
  chk(!!m4 && (() => { const mod = build(m4); const s = seatOf([]); mod.setSeatOpacity(s, 0); return s._bodyOff === undefined; })(), '_bodyOff 를 안 세우면 빨강');
  const m5 = brk("delete o.userData._prevVisible;", '');
  chk(!!m5 && (() => { const mod = build(m5); const o = mesh(mat()); const s = seatOf([o]); mod.setSeatOpacity(s, 0); mod.setSeatOpacity(s, 1); return o.userData._prevVisible !== undefined; })(), '기억을 안 지우면 빨강');
}
say('');
say((fail ? '✗' : '✓') + ' 통과 ' + pass + ' · 실패 ' + fail);
process.exit(fail ? 1 : 0);
