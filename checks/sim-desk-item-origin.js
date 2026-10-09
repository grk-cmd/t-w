/* ═══ 🪑 sim-desk-item-origin.js — 생성기 «⟲ 이동·회전 초기화» 가 처음 자리로 (2026-10-09 신설) ═══════════
   제보: 책상 세팅(5단계)에서 아이템의 «이동·회전 초기화» 가 x · y · z · rot 를 0 으로 박아,
         처음 놓였던 자리가 아니라 엉뚱한 곳(커스텀 아이템은 책상 속)으로 갔다.
   ・1절: pickXf — 위치 · 회전만 · 없는 칸 · 망가진 값은 0
   ・2절: createDeskItemOrigin — 아이템마다 따로 · 덮어쓰기(장착 → 저장값 복원) · 크기는 그대로 ·
          적힌 게 없으면 0 · 다른 아이템을 골라도 유지 · clear
   ・3절: 편집 한 바퀴 흉내 — 불러온 아이템 · 새로 놓은 아이템 · 옮긴 뒤 초기화 · 닫으면 사라짐
   ・4절: app.js 배선 — 장착 직후 · 저장값 복원 직후 · 생성기에서만 · 초기화 버튼 · 닫기 · 다시 깔기 · 크기 초기화는 그대로
   ・5절: html 로드 순서
   [실행] desk-item-origin.js · app.js · desk-companion-prototype.html 이 있는 폴더에서. */
'use strict';
const fs = require('fs');
let pass = 0, fail = 0;
const say = (s) => console.log(s);
const chk = (ok, msg) => { ok ? pass++ : fail++; say('  ' + (ok ? '✓' : '✗') + ' ' + msg); };
const read = (f) => { try{ return fs.readFileSync(f, 'utf8'); }catch(_){ return null; } };
const need = ['desk-item-origin.js', 'app.js', 'desk-companion-prototype.html'];
const SRC = {};
for(const f of need){ SRC[f] = read(f); if(SRC[f] == null){ say('  ? 원본 못 찾음 — ' + f); process.exit(2); } }
const win = {};
new Function('window', 'module', SRC['desk-item-origin.js'])(win, undefined);
const D = win.DeskItemOrigin;
const sorted = (o) => o && typeof o === 'object' ? Object.keys(o).sort().reduce((r, k) => (r[k] = o[k], r), {}) : o;
const same = (a, b) => JSON.stringify(sorted(a)) === JSON.stringify(sorted(b));   // 칸 순서는 안 본다

say('── 1. pickXf');
chk(same(D.pickXf({ x: 1, y: 2, z: 3, rot: 0.5, scale: 9 }), { x: 1, y: 2, z: 3, rot: 0.5 }), '위치 · 회전만 떼어 낸다(scale 빠짐)');
chk(same(D.pickXf({ z: 0 }), { x: 0, y: 0, z: 0, rot: 0 }), '없는 칸은 0');
chk(same(D.pickXf({ x: NaN, y: 'a', z: Infinity, rot: null }), { x: 0, y: 0, z: 0, rot: 0 }), '망가진 값은 0');
chk(same(D.pickXf(null), { x: 0, y: 0, z: 0, rot: 0 }), 'adj 가 없어도 터지지 않는다');

say('── 2. createDeskItemOrigin');
const O = D.createDeskItemOrigin();
const pa = { userData: { adj: { x: 0, y: 1.1, z: 0, scale: 0.4, rot: 0 } } };
const pb = { userData: { adj: { x: 0.3, y: 0, z: -0.2, scale: 1, rot: 1 } } };
O.remember(pa, pa.userData.adj);
O.remember(pb, pb.userData.adj);
chk(O.size() === 2, '아이템마다 따로 적는다');
pa.userData.adj.x = 0.7;
chk(same(O.originOf(pa), { x: 0, y: 1.1, z: 0, rot: 0 }), '적은 뒤 adj 를 바꿔도 처음 자리는 그대로(복사본)');
O.remember(pa, { x: 0.2, y: 0.5, z: 0.1, rot: 0.3, scale: 0.5 });
chk(same(O.originOf(pa), { x: 0.2, y: 0.5, z: 0.1, rot: 0.3 }), '같은 아이템을 다시 적으면 덮어쓴다(장착 → 저장값 복원 순서)');
pa.userData.adj = { x: 9, y: 9, z: 9, rot: 9, scale: 1.7 };
chk(O.resetXf(pa, pa.userData.adj) === true, '처음 자리가 있으면 true');
chk(same(pa.userData.adj, { x: 0.2, y: 0.5, z: 0.1, rot: 0.3, scale: 1.7 }), '초기화는 x · y · z · rot 만 처음 자리로 — 크기(scale)는 그대로');
const pc = { userData: { adj: { x: 4, y: 4, z: 4, rot: 4, scale: 2 } } };
chk(O.resetXf(pc, pc.userData.adj) === false && same(pc.userData.adj, { x: 0, y: 0, z: 0, rot: 0, scale: 2 }), '적힌 게 없으면 예전처럼 0(크기는 그대로)');
chk(same(O.originOf(pb), { x: 0.3, y: 0, z: -0.2, rot: 1 }), '다른 아이템을 다뤄도 각자의 처음 자리는 남는다');
chk(O.resetXf(pa, null) === false, 'adj 가 없으면 아무것도 안 한다');
O.clear();
chk(O.size() === 0 && O.originOf(pb) === null, 'clear 하면 전부 사라진다');

say('── 3. 편집 한 바퀴 흉내');
{
  const S = D.createDeskItemOrigin();
  // 불러오기: 장착(기본 자리) → 저장값 덮어쓰기
  const mug = { userData: { adj: { x: 0, y: 1.1, z: 0, scale: 0.3, rot: 0 } } };
  S.remember(mug, mug.userData.adj);
  Object.assign(mug.userData.adj, { x: 0.25, y: 0.9, z: -0.1, rot: 0.8, scale: 0.36 });
  S.remember(mug, mug.userData.adj);
  // 편집 중 새로 놓은 아이템
  const lamp = { userData: { adj: { x: 0, y: 1.1, z: 0, scale: 0.5, rot: 0 } } };
  S.remember(lamp, lamp.userData.adj);
  // 둘 다 옮기고 키운다
  Object.assign(mug.userData.adj, { x: -1, y: 2, z: 1, rot: 3, scale: 0.6 });
  Object.assign(lamp.userData.adj, { x: 1, y: 0, z: 1, rot: 2, scale: 0.9 });
  S.resetXf(mug, mug.userData.adj);
  chk(same(mug.userData.adj, { x: 0.25, y: 0.9, z: -0.1, rot: 0.8, scale: 0.6 }), '불러온 아이템 → 불러온 자리로(0 이 아니다) · 키운 크기는 그대로');
  S.resetXf(lamp, lamp.userData.adj);
  chk(same(lamp.userData.adj, { x: 0, y: 1.1, z: 0, rot: 0, scale: 0.9 }), '새로 놓은 아이템 → 처음 놓인 자리로(y 1.1 — 책상 속으로 안 묻힌다)');
  S.clear();
  S.resetXf(mug, mug.userData.adj);
  chk(same(mug.userData.adj, { x: 0, y: 0, z: 0, rot: 0, scale: 0.6 }), '생성기를 닫은 뒤엔 남지 않는다(0 으로 돌아감)');
}

say('── 4. app.js 배선');
const A = SRC['app.js'];
chk(/const deskItemOrigin = \(typeof DeskItemOrigin === 'undefined'\) \? null : DeskItemOrigin\.createDeskItemOrigin\(\);/.test(A), '모듈이 없으면 null(옛 동작)로 만든다');
const remFn = (A.match(/function _rememberCrItemOrigin\(holder, p\)\{[\s\S]*?\n\}/) || [''])[0];
chk(/holder!==cBase\) return;/.test(remFn) && /deskItemOrigin\.remember\(p, p\.userData\.adj\)/.test(remFn), '생성기(cBase) 아이템만 적는다 — 실행 · 런처 좌석은 안 적는다');
const eq = (A.match(/function equipDeskItem\(holder,def,on\)\{[\s\S]*?\n\}\n/) || [''])[0];
chk(/holder\.deskItems\[def\.id\]=pivot; holder\.activeDeskItem=pivot; applyDeskAdj\(pivot\);\s*\n\s*_rememberCrItemOrigin\(holder, pivot\);/.test(eq), '장착 직후 처음 자리를 적는다(새로 놓은 아이템)');
const ap = (A.match(/function applyDeskItemsTo\(holder,data\)\{[\s\S]*?\n  \} \}\); \}/) || [''])[0];
chk(/Object\.assign\(p\.userData\.adj,savedAdj\);applyDeskAdj\(p\);\s*\n\s*_rememberCrItemOrigin\(holder, p\);/.test(ap), '저장값을 덮어쓴 직후 다시 적는다(불러온 아이템)');
const xr = (A.match(/document\.getElementById\('crItemXfReset'\)\.onclick=\(\)=>\{[\s\S]*?\n\};/) || [''])[0];
chk(/deskItemOrigin\.resetXf\(p, p\.userData\.adj\)/.test(xr), '⟲ 이동·회전 초기화가 처음 자리로 되돌린다');
chk(!/adj\.scale/.test(xr), '⟲ 이동·회전 초기화는 크기를 건드리지 않는다');
chk(/처음 자리로 되돌렸어요/.test(xr), '알림 «처음 자리로 되돌렸어요»');
chk(/^function closeCreator\(\)\{[^\n]*\n  if\(deskItemOrigin\) deskItemOrigin\.clear\(\);/m.test(A), '생성기를 닫으면 지운다');
chk(/function clearCreatorItems\(\)\{ clearHolderDeskItems\(cBase\); if\(deskItemOrigin\) deskItemOrigin\.clear\(\); \}/.test(A), '아이템을 다시 깔 때(생성기 열기) 지운다');
const sr = (A.match(/document\.getElementById\('crItemRemove'\)\.onclick=\(\)=>\{[\s\S]*?\n\};/) || [''])[0];
chk(/p\.userData\.adj\.scale = \(p\.userData\.autoScale!=null\) \? p\.userData\.autoScale : 1;/.test(sr) && !/deskItemOrigin/.test(sr), '크기 초기화는 예전 그대로(autoScale)');

say('── 5. html');
{
  const H = SRC['desk-companion-prototype.html'];
  const a = H.indexOf('<script src="parts/desk-item-origin.js"></script>'), b = H.indexOf('<script src="parts/app.js"></script>');
  chk(a > 0 && b > a, 'html 이 desk-item-origin.js 를 app.js 앞에 싣는다');
}

say(`\n결과: ${pass} 통과 · ${fail} 실패`);
process.exit(fail ? 1 : 0);
