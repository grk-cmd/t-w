/* ═══ 🐾 sim-animal-cast.js — 동물 생성기 광선이 «지금 자세» 의 얼굴을 맞힌다 (2026-10-04 신설) ═══════════
   [제보] «동물 캐릭터에 이미지를 찍으면 볼 쪽이 다르게 찍힌다» · «동물에서 대칭을 쓰면 한쪽 선이 끊긴다».
     몸·얼굴은 리깅(SkinnedMesh)인데 animal.js 가 three r128 기본 레이캐스트(intersectObjects)를 썼다.
     기본 레이캐스트는 바인드 포즈의 경계 상자로 먼저 거르므로, 얼굴 크기(head 본 배율)를 키우면
     바깥쪽 볼·눈꼬리에 광선이 안 맞아 붓·도장이 빠졌다. 사람 생성기는 10-02 에 _picIntersect 로 고쳤다.
   ・1절: 그리기·스포이드·도장·대칭이 전부 _aCast(→ _picIntersect)를 지난다 · intersectObjects 로 되돌아가지 않는다
   ・2절: 대칭 되쏘기는 같은 부위 메쉬만 — _mirrorMeshes 를 가짜 귀·얼굴로 돌려 본다
   ・3절: app.js 의 _picIntersect 가 여전히 «지금 자세 · 앞면만» 이다
   ⚠️ 실제 동작(좌우 1.4 에서 눈꼬리 바깥까지 그려짐 · 큰 도장의 양옆 띠가 찍힘)은 2026-10-04 헤드리스
     크로미움에서 실제 앱 페이지로 확인했다.
   [실행] app.js · animal.js 가 있는 폴더에서. */
'use strict';
const fs = require('fs');
let pass = 0, fail = 0;
const say = (s) => console.log(s);
const chk = (ok, msg) => { ok ? pass++ : fail++; say('  ' + (ok ? '✓' : '✗') + ' ' + msg); };
const read = (f) => { try{ return fs.readFileSync(f, 'utf8'); }catch(_){ return null; } };
const A = read('animal.js'), APP = read('app.js');
if(!A || !APP){ say('  ? 원본 못 찾음 — ' + (!A ? 'animal.js ' : '') + (!APP ? 'app.js' : '')); process.exit(2); }
const strip = (s) => s.replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/(^|[^:'"])\/\/[^\n]*/g, '$1 ');
const grab = (src, name) => { const i = src.indexOf('function ' + name + '('); if(i < 0) return ''; let k = src.indexOf('{', i), d = 0;
  for(; k < src.length; k++){ if(src[k] === '{') d++; else if(src[k] === '}' && --d === 0) return src.slice(i, k + 1); } return ''; };
const AC = strip(A);

say('── 1. 동물 광선은 전부 _aCast 를 지난다');
const cast = strip(grab(A, '_aCast'));
chk(!!cast, '_aCast 를 찾았다');
chk(/if\(typeof _picIntersect==='function'\) return _picIntersect\(ray, meshes\);/.test(cast), '_aCast → _picIntersect(지금 자세 · 앞면만)');
const n = (AC.match(/\.intersectObjects\(/g) || []).length;
chk(n === 1 && /\.intersectObjects\(/.test(cast), '기본 레이캐스트는 _aCast 의 폴백 한 곳뿐 (지금 ' + n + '곳)');
chk(/return _aCast\(_pRay\.ray, _pTargets\(\)\);/.test(strip(grab(A, 'pHit'))), '붓·스포이드(pHit)');
chk(/const hit=_aCast\(_pRay\.ray, targets\);/.test(strip(grab(A, 'aCommitStamp'))), '도장 격자(aCommitStamp)');
const mh = strip(grab(A, '_pMirrorHit'));
chk(/const ms=_mirrorMeshes\(hit\.object\);/.test(mh) && /_aCast\(_mRay\.ray, ms\)/.test(mh), '대칭 되쏘기(_pMirrorHit) — 같은 부위만');
chk(!/_pTargets\(\)/.test(mh), '대칭 되쏘기가 모든 메쉬를 보지 않는다');

say('── 2. 대칭 상대 메쉬 (가짜 귀·얼굴로 실행)');
const mm = grab(A, '_mirrorMeshes');
chk(!!mm, '_mirrorMeshes 를 찾았다');
if(mm){
  const mk = (name, kids) => { const o = { name, isMesh: !kids, visible: true, kids: kids || [] };
    o.traverse = (f) => { f(o); o.kids.forEach(k => k.traverse(f)); }; return o; };
  const eL = mk('eL'), eR = mk('eR'), eRhid = mk('eRhid'); eRhid.visible = false;
  const wL = mk('wL', [eL]), wR = mk('wR', [eR, eRhid]), face = mk('face'), body = mk('body');
  const run = (L, R, obj) => new Function('earObjL', 'earObjR', mm + '\nreturn _mirrorMeshes;')(L, R)(obj);
  const names = (a) => a.map(o => o.name).join(',');
  chk(names(run(wL, wR, face)) === 'face', '얼굴 → 같은 얼굴');
  chk(names(run(wL, wR, body)) === 'body', '몸 → 같은 몸');
  chk(names(run(wL, wR, eL)) === 'eR', '왼귀 → 오른귀(보이는 메쉬만)');
  chk(names(run(wL, wR, eR)) === 'eL', '오른귀 → 왼귀');
  chk(run(wL, null, eL).length === 0, '반대쪽 귀가 없으면 대칭 획 없음(엉뚱한 곳에 안 찍힘)');
}

say('── 3. app.js _picIntersect 는 «지금 자세 · 앞면만»');
const pi = strip(grab(APP, '_picIntersect')), ps = strip(grab(APP, '_picSkinnedIntersect')), pp = strip(grab(APP, '_picSkinnedPositions'));
chk(!!pi && /if\(_picIsSkinned\(o\)\) h=_picSkinnedIntersect\(ray,o\);/.test(pi), '리깅 메쉬는 직접 교차로 간다');
chk(/bone\.matrixWorld/.test(pp) && /boneInverses/.test(pp), '정점을 지금 본 자세로 옮긴다(바인드 포즈 아님)');
chk(/ray\.intersectTriangle\(_pskA,_pskB,_pskC,true,_pskP\)/.test(ps), '리깅 메쉬 — 뒷면 제외');
chk(/if\(_pskN\.dot\(ray\.direction\) >= 0\) continue;/.test(pi), '리깅 아닌 메쉬(귀) — 뒷면 제외');
chk(/face:\{ normal:/.test(ps), '대칭에 쓸 법선을 돌려준다');

say(`\n${fail ? '✗' : '✓'} 통과 ${pass} · 실패 ${fail}`);
process.exit(fail ? 1 : 0);
