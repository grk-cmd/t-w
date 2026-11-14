/* ═══ 🪑 sim-desk-build.js — 기본 책상 · 소품 · 대신 몸 만들기(room/desk-build.js · app.js 분리 M3) ═══════════════
   [왜] app.js 의 «물건 만들기»(재질 · 기본 책상 · 화분 · 컵 · 책 · 대신 몸)를 모듈로 옮겼다. 동작은 그대로여야 한다.
   ・1절: 재질 — M(색, 거칠기, 금속) 기본값 · 이름 붙은 재질 색(진짜 three)
   ・2절: 기본 책상 — 상판 · 다리 넷 · 소품 자리(deskAnchor) · plain 이면 화분 없음 · 그림자
   ・3절: 소품 셋 — 화분 · 머그컵 · 책(메시 수 · 재질 · 그림자) · 저장 id 글자(예약 책상 id)
   ・4절: 대신 몸 — 몸통 · 머리 · 눈 · 볼 · 입 · 귀 · 팔(자리 · 대칭)
   ・5절: 연결 — html · 만드는 줄 · 옛 이름 여덟 · app.js 에 만들기 함수가 남지 않음
   ・6절: 일부러 깨 보기
   [실행] 러너 스테이징 또는 저장소 루트에서. three 는 vendor/three/three.min.js. */
'use strict';
const fs = require('fs');
const path = require('path');
let pass = 0, fail = 0;
const say = (s) => console.log(s);
const chk = (ok, msg) => { ok ? pass++ : fail++; say('  ' + (ok ? '✓' : '✗') + ' ' + msg); };
const read = (f) => { for(const c of [f, 'parts/' + f, 'app/parts/' + f, 'app/' + f, f.split('/').pop()]) if(fs.existsSync(c)) return fs.readFileSync(c, 'utf8'); return null; };
const SRC = read('room/desk-build.js'), APP = read('app.js'), HTML = read('desk-companion-prototype.html');
if(!SRC || !APP || !HTML){ say('  ? 원본 못 찾음 — desk-build.js · app.js · desk-companion-prototype.html'); process.exit(2); }
const threePath = ['vendor/three/three.min.js', 'app/vendor/three/three.min.js', 'three.min.js'].find(p => fs.existsSync(p));
if(!threePath){ say('  ? 원본 못 찾음 — three.min.js'); process.exit(2); }
const THREE = require(path.resolve(threePath));
function build(src){ const win = {}; new Function('THREE', 'window', 'module', src)(THREE, win, undefined); return win.TwDeskBuild.createDeskBuild({}); }
const near = (a, b) => Math.abs(a - b) < 1e-9;
const meshes = (g) => { const o = []; g.traverse(x => { if(x.isMesh) o.push(x); }); return o; };

say('§1 재질');
{
  const B = build(SRC);
  const m = B.M(0x123456);
  chk(m instanceof THREE.MeshStandardMaterial && m.color.getHex() === 0x123456 && near(m.roughness, 0.85) && m.metalness === 0, 'M(색) — 거칠기 0.85 · 금속 0 이 기본');
  const m2 = B.M(0xffffff, 0.2, 0.7);
  chk(near(m2.roughness, 0.2) && near(m2.metalness, 0.7), 'M(색, 거칠기, 금속) — 넘긴 값을 쓴다');
  chk(B.matWood.color.getHex() === 0xc9a57b && near(B.matWood.roughness, 0.85) && B.matWoodD.color.getHex() === 0xb08a5e, 'matWood · matWoodD — 책상 나무색 둘');
  chk(B.M(1) !== B.M(1), '부를 때마다 새 재질');
}
say('§2 기본 책상');
{
  const B = build(SRC);
  const d = B.buildDesk(false);
  const top = d.children.find(c => c.name === 'deskTop');
  chk(top && top.geometry.parameters.width === 1.7 && near(top.geometry.parameters.height, 0.08) && top.geometry.parameters.depth === 0.6 && near(top.position.y, 0.42) && top.position.z === 0.5, '상판 — 1.7 × 0.08 × 0.6 · 높이 0.42 · 앞뒤 0.5 · 이름 deskTop');
  chk(top.castShadow && top.receiveShadow && top.material === B.matWood, '  그림자 주고 받음 · matWood');
  const legs = d.children.filter(c => c.isMesh && c !== top);
  chk(legs.length === 4 && legs.every(l => l.material === B.matWoodD && l.castShadow) && legs.map(l => l.position.x + ',' + l.position.z).sort().join('|') === '-0.72,0.32|-0.72,0.88|0.72,0.32|0.72,0.88', '다리 넷 — 네 모서리 · matWoodD · 그림자');
  const a = d.userData.deskAnchor;
  chk(a && a.name === 'deskAnchor' && d.children.includes(a) && a.position.x === 0 && near(a.position.y, 0.46) && a.position.z === 0.5, '소품 자리(deskAnchor) — 상판 위 (0, 0.46, 0.5)');
  const groups = d.children.filter(c => c.isGroup && c !== a);
  chk(groups.length === 1 && near(groups[0].position.x, 0.5) && near(groups[0].position.z, 0.44), 'plain 이 아니면 화분이 상판 오른쪽에 놓인다');
  const p = B.buildDesk(true);
  chk(p.children.filter(c => c.isGroup && c !== p.userData.deskAnchor).length === 0 && p.children.length === d.children.length - 1, 'plain 이면 화분 없음');
}
say('§3 소품 셋');
{
  const B = build(SRC);
  chk(B.DESK_ITEMS.map(i => i.id + ':' + i.name).join(',') === 'plant:화분,cup:머그컵,books:책', '소품 셋 — plant · cup · books');
  const n = B.DESK_ITEMS.map(i => { const g = i.build(); return meshes(g).length + ':' + meshes(g)[0].castShadow; }).join(',');
  chk(n === '4:true,2:true,3:true', '메시 수 — 화분 4(분 + 잎 3) · 컵 2(몸통 + 손잡이) · 책 3 · 첫 메시(본체)는 그림자');
  chk(B.DESK_ITEMS[0].build() !== B.DESK_ITEMS[0].build(), '부를 때마다 새 그룹');
  chk(B.DEFAULT_DESK_OVERRIDE_ID === '__default_desk__' && B.NO_DESK_ID === '__no_desk__', '★ 저장되는 예약 책상 id 글자(__default_desk__ · __no_desk__)');
}
say('§4 대신 몸');
{
  const B = build(SRC);
  const r = B.buildPlaceholder();
  chk(['root', 'torso', 'head', 'eyeL', 'eyeR', 'armL', 'armR'].every(k => r[k]) && r.root.children.includes(r.torso) && r.torso.children.includes(r.head), '반환 — root · torso · head · eyeL · eyeR · armL · armR');
  chk(near(r.torso.position.y, 0.46) && near(r.head.position.y, 0.62), '몸통 높이 0.46 · 머리는 몸통 위 0.62');
  chk(near(r.eyeL.position.x, -0.15) && near(r.eyeR.position.x, 0.15) && r.head.children.includes(r.eyeL) && r.head.children.includes(r.eyeR), '눈은 머리 위 좌우 ∓0.15');
  chk(near(r.armL.position.x, -0.38) && near(r.armR.position.x, 0.38) && r.torso.children.includes(r.armL), '팔은 몸통 옆 ∓0.38');
  chk(meshes(r.root).length === 13 && meshes(r.root).every(m => m.material.isMeshStandardMaterial), '메시 13개(몸 · 머리 · 눈 4 · 볼 2 · 입 · 귀 2 · 팔 2)');
}
say('§5 연결');
{
  const iD = HTML.indexOf('<script src="parts/room/desk-build.js"></script>'), iA = HTML.indexOf('<script src="parts/app.js"></script>');
  chk(iD > 0 && iA > iD, 'html — desk-build.js 를 app.js 보다 먼저 싣는다');
  const code = APP.replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/(^|[^:'"\\])\/\/[^\n]*/g, '$1 ');
  chk(/const deskBuildMod = TwDeskBuild\.createDeskBuild\(\{\s*\}\);/.test(code), 'app.js — 재질을 쓰기 전(SETUP)에서 만든다');
  const names = ['M', 'matWood', 'matWoodD', 'DESK_ITEMS', 'DEFAULT_DESK_OVERRIDE_ID', 'NO_DESK_ID', 'buildDesk', 'buildPlaceholder'];
  chk(names.every(n => new RegExp('^const ' + n + ' = deskBuildMod\\.' + n + ';', 'm').test(code)), '  옛 이름 여덟을 const 로 받는다');
  chk(!/function (buildDesk|buildPlaceholder|buildDeskPlant|buildCup|buildBooks)\b|const (matSage|TORSO_Y)\b/.test(code), '  app.js 에 만들기 함수 · 이름 붙은 재질이 남아 있지 않다');
  chk(code.indexOf('const deskBuildMod') < code.indexOf('const floorMat=M('), '  M 을 쓰는 첫 줄(floorMat)보다 앞이다');
}
say('§6 일부러 깨 보기');
{
  const brk = (from, to) => { const m = SRC.replace(from, to); return m === SRC ? null : m; };
  const m1 = brk('if(!plain){ const prop=buildDeskPlant();', 'if(true){ const prop=buildDeskPlant();');
  chk(!!m1 && build(m1).buildDesk(true).children.length === build(SRC).buildDesk(false).children.length, 'plain 에도 화분을 놓으면 빨강');
  const m2 = brk("'__no_desk__'", "'__none__'");
  chk(!!m2 && build(m2).NO_DESK_ID !== '__no_desk__', '예약 id 글자를 바꾸면 빨강');
  const m3 = brk("topM.name='deskTop'", "topM.name='top'");
  chk(!!m3 && !build(m3).buildDesk().children.find(c => c.name === 'deskTop'), '상판 이름을 바꾸면 빨강');
  const m4 = brk('const TORSO_Y=0.46;', 'const TORSO_Y=0.5;');
  chk(!!m4 && !near(build(m4).buildPlaceholder().torso.position.y, 0.46), '몸통 높이를 바꾸면 빨강');
  const m5 = brk('desk.userData.deskAnchor=anchor;', '');
  chk(!!m5 && !build(m5).buildDesk().userData.deskAnchor, '소품 자리를 userData 에 안 걸면 빨강');
  const m6 = brk('leg.castShadow=true; desk.add(leg);', 'desk.add(leg);');
  chk(!!m6 && !build(m6).buildDesk().children.filter(c => c.isMesh && c.name !== 'deskTop').every(l => l.castShadow), '다리 그림자를 빼면 빨강');
}
say('');
say((fail ? '✗' : '✓') + ' 통과 ' + pass + ' · 실패 ' + fail);
process.exit(fail ? 1 : 0);
