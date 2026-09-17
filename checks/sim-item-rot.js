/* ═══ 🔄 sim-item-rot.js — 책상 위 아이템 회전이 저장을 거쳐 살아남는가 (제보 4 · 2026-09-15) ═══
   [무엇을 지키나] 회전 기즈모로 돌린 값이 미리보기엔 남고 실행 화면(저장 → 복원)에선 틀리던 것.
     저장 모델은 `adj.rot`(Y 하나). 기즈모는 X·Z 고리를 숨기고, 저장은 쿼터니언을 YXZ 로 풀어 y 를 읽는다.
   ・1절: three.js 의 오일러 분해(setFromRotationMatrix)를 그대로 옮긴 모델로 **XYZ 는 왜 틀리고 YXZ 는 왜 맞는지**를 보인다.
   ・2절: 저장이 _itemYaw(YXZ) 를 쓰고 rotation.y 를 직접 읽지 않는다.
   ・3절: 회전 모드에서 X·Z 고리가 꺼진다 — itemGizmo 의 setMode 는 전부 _applyItemGizmoMode 를 지난다.
   ・4절: 복원(applyDeskAdj)은 (0, rot, 0) 그대로다 — 모델이 Y 하나인 채로 양끝이 맞는다.
   [실행] app.js 가 있는 폴더에서. 판정 줄은 맨 끝. */
'use strict';
const fs = require('fs');
const SRC = fs.readFileSync('app.js', 'utf8');

let pass = 0, fail = 0, huhs = 0;
const say = (s) => console.log(s);
const chk = (ok, msg) => { ok ? pass++ : fail++; say('  ' + (ok ? '✓' : '✗') + ' ' + msg); };
const huh = (msg) => { huhs++; say('  ? ' + msg); };
function grabFn(name){
  const i = SRC.indexOf('function ' + name + '(');
  if(i < 0) return null;
  let k = SRC.indexOf('{', i), d = 0;
  for(; k < SRC.length; k++){
    if(SRC[k] === '{') d++;
    else if(SRC[k] === '}' && --d === 0) return SRC.slice(i, k + 1);
  }
  return null;
}

/* ── 1. 모델 — three.js Euler.setFromRotationMatrix 의 XYZ · YXZ 분기를 그대로 옮겼다 ── */
say('── 1. 순수 Y 회전을 오일러로 되읽으면 XYZ 는 90° 를 넘는 순간 틀리고 YXZ 는 항상 맞다');
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
// 열우선 4x4 의 (행,열) → three 의 m11..m33 이름 그대로 (회전만 쓰므로 3x3)
function rotY(t){ const c = Math.cos(t), s = Math.sin(t); return { m11:c, m12:0, m13:s, m21:0, m22:1, m23:0, m31:-s, m32:0, m33:c }; }
function eulerFrom(m, order){
  const e = { x:0, y:0, z:0 };
  if(order === 'XYZ'){
    e.y = Math.asin(clamp(m.m13, -1, 1));
    if(Math.abs(m.m13) < 0.9999999){ e.x = Math.atan2(-m.m23, m.m33); e.z = Math.atan2(-m.m12, m.m11); }
    else { e.x = Math.atan2(m.m32, m.m22); e.z = 0; }
  }else if(order === 'YXZ'){
    e.x = Math.asin(-clamp(m.m23, -1, 1));
    if(Math.abs(m.m23) < 0.9999999){ e.y = Math.atan2(m.m13, m.m33); e.z = Math.atan2(m.m21, m.m22); }
    else { e.y = Math.atan2(-m.m31, m.m11); e.z = 0; }
  }
  return e;
}
const deg = (r) => Math.round(r * 180 / Math.PI);
const near = (a, b) => Math.abs(a - b) < 1e-6;
const t60 = 60 * Math.PI / 180, t120 = 120 * Math.PI / 180, t170 = 170 * Math.PI / 180;
const xyz60 = eulerFrom(rotY(t60), 'XYZ'), xyz120 = eulerFrom(rotY(t120), 'XYZ');
chk(near(xyz60.y, t60) && near(xyz60.x, 0), 'XYZ · 60° → y=60°, x=0 (90° 안쪽은 rotation.y 도 맞는다 — 그래서 늦게 드러났다)');
chk(near(Math.abs(xyz120.x), Math.PI) && near(xyz120.y, t60), '★ XYZ · 120° → (180°, 60°, 180°) — rotation.y 는 60° 를 돌려준다 (예전 저장값)');
chk(!near(xyz120.y, t120), '  그 60° 로 복원하면 120° 가 아니다 — 거울상 (제보의 «적용 안 됨»)');
for(const t of [t60, t120, t170, -t120]){
  const e = eulerFrom(rotY(t), 'YXZ');
  chk(near(e.y, t) && near(e.x, 0) && near(e.z, 0), 'YXZ · ' + deg(t) + '° → y=' + deg(e.y) + '°, x=z=0 (복원 (0,y,0) 과 같은 회전)');
}

/* ── 2. 저장 ── */
say('── 2. 저장이 _itemYaw(YXZ) 를 지난다');
const yaw = grabFn('_itemYaw') || '';
chk(!!yaw && /setFromQuaternion\(p\.quaternion, 'YXZ'\)/.test(yaw), "★ _itemYaw 가 쿼터니언을 'YXZ' 로 푼다 (XYZ 로 바꾸면 1절의 120° 가 그대로 돌아온다)");
chk(/p\.userData\.adj\.rot = _itemYaw\(p\);/.test(SRC), '기즈모 드래그 끝 저장이 _itemYaw 를 쓴다');
chk(!/p\.userData\.adj\.rot = p\.rotation\.y;/.test(SRC), '★ rotation.y 를 직접 저장하는 자리가 없다');
chk(/'\| rot=', savedAdj\.rot/.test(SRC), '복원 진단 로그 [아이템크기-복원] 에 rot 이 찍힌다');

/* ── 3. 기즈모 ── */
say('── 3. 회전 모드에서는 Y 고리만 보인다');
const am = grabFn('_applyItemGizmoMode') || '';
chk(!!am && /const rot = \(mode === 'rotate'\);/.test(am) && /g\.showX = !rot; g\.showZ = !rot; g\.showY = true;/.test(am), '_applyItemGizmoMode: rotate 면 showX=showZ=false, showY 는 항상 true');
const bareSetMode = [...SRC.matchAll(/\b(itemGizmo|g)\.setMode\(/g)].filter(m => {
  const line = SRC.slice(SRC.lastIndexOf('\n', m.index) + 1, SRC.indexOf('\n', m.index));
  return !/function _applyItemGizmoMode/.test(line) && !/g\.setMode\(mode\)/.test(line);
});
chk(bareSetMode.length === 0, '★ itemGizmo 에 setMode 를 직접 부르는 자리 ' + bareSetMode.length + '곳 (기준 0 — 우회하면 X·Z 고리가 되살아난다)');
chk((SRC.match(/_applyItemGizmoMode\(/g) || []).length - 1 >= 3, '_applyItemGizmoMode 호출 3곳 이상 (attach · 모드 버튼 · 책상 위치 기즈모)');
chk(/_applyItemGizmoMode\(g, 'translate'\)/.test(SRC), '책상 위치 기즈모는 translate — 세 축 다 보인다 (책상은 회전 모델이 없다)');

/* ── 4. 복원 ── */
say('── 4. 복원은 Y 하나 그대로다');
const ada = grabFn('applyDeskAdj') || '';
chk(/p\.rotation\.set\(0,a\.rot\|\|0,0\)/.test(ada), 'applyDeskAdj 가 (0, rot, 0) 으로 세운다 — 모델은 여전히 Y 하나');

say('');
say('통과 ' + pass + ' · 실패 ' + fail + ' · 검사못함 ' + huhs);
process.exit(fail ? 1 : 0);
