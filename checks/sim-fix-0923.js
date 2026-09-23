/* ═══ 🩹 sim-fix-0923.js — 2026-09-23 제보 다섯 건 (개정 65 신설) ═══════════════════════════════════
   ・1절: 🎰 보관함 모자를 빼면 기본 모자도 빠짐 — 가챠 = stackable(입구 두 곳) · 숫자키 맵 착용 목록의 넣기/빼기
   ・2절: 🖼️ 슬롯 섬네일 = 런처 미리보기 — 파츠 장착 뒤 · 같은 틱 · 눈 뜬 때 · 둥둥 멈춤 · 바뀔 때만 저장 · 로컬 전용
   ・3절: 🎨 게시글 글자 배경색 — 서식 태그(FONT·B·STRONG·I·EM·U)의 style 을 남긴다(값은 다섯 속성만)
   ・4절: 😑 스티커사진 동물 눈 감기 — 원본 재질 하나 → 복제본 하나(Map). 동물은 몸+face1~4 가 한 재질(animal.js)
   ・5절: 🫨 말랑이 제자리 떨림 — 짧은 간격으로 세 번째 돌아서려 하면 쉰다
   [실행] app.js · desk-companion-prototype.html · mallang.js · animal.js 가 있는 폴더에서. */
'use strict';
const fs = require('fs');
let pass = 0, fail = 0;
const say = (s) => console.log(s);
const chk = (ok, msg) => { ok ? pass++ : fail++; say('  ' + (ok ? '✓' : '✗') + ' ' + msg); };
const read = (f) => { try{ return fs.readFileSync(f, 'utf8'); }catch(_){ return null; } };
const SRC = read('app.js'), ML = read('mallang.js'), AN = read('animal.js');
if(!SRC || !ML){ say('  ? 원본 못 찾음 — app.js · mallang.js'); process.exit(2); }
const strip = (s) => s.replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/(^|[^:])\/\/[^\n]*/g, '$1 ');
const CODE = strip(SRC), MLC = strip(ML);
const grab = (src, name) => { const i = src.indexOf('function ' + name + '('); if(i < 0) return ''; let k = src.indexOf('{', i), d = 0;
  for(; k < src.length; k++){ if(src[k] === '{') d++; else if(src[k] === '}' && --d === 0) return src.slice(i, k + 1); } return ''; };

say('── 1. 🎰 가챠 = stackable · 숫자키 맵');
{
  const N = new Function(grab(SRC, '_normPartRec') + ' return _normPartRec;')();
  chk(N({ id:'g', gacha:true, stackable:false }).stackable === true, '옛 가챠 파츠(stackable:false) → true');
  chk(N({ id:'n', stackable:false }).stackable === false, '일반 파츠는 그대로');
  chk(/savedParts\.forEach\(_normPartRec\)/.test(strip(grab(SRC, 'loadSavedParts'))), '입구 ① 로컬 캐시(loadSavedParts)');
  chk(/map\(id=>_normPartRec\(\{ id, \.\.\.catalogObj\[id\], fromCatalog:true \}\)\)/.test(strip(grab(SRC, 'mergeCatalogIntoSavedParts'))), '입구 ② 카탈로그(mergeCatalogIntoSavedParts)');
  const body = ['partEntryId', 'isPartEntryContainer', 'entriesForCat', '_flattenCatContainer', 'addEntryToCat', 'removeEntryFromCat'].map(n => grab(SRC, n)).join('\n');
  const F = new Function(body + ' return { add:addEntryToCat, rm:removeEntryFromCat, list:entriesForCat };')();
  const hat = { id:'hat', xf:{} }, rib = { id:'rib', xf:{} };
  let def = { equippedParts:{ hat:{ 0:hat, 1:rib } } };
  F.add(def, 'hat', { id:'gacha', xf:{} });
  chk(Array.isArray(def.equippedParts.hat) && F.list(def, 'hat').map(e => e.id).join() === 'hat,rib,gacha', '숫자키 맵에 넣기 → 펴서 셋(예전: [맵, 새것] 으로 싸여 모자·리본이 안 보임)');
  def = { equippedParts:{ hat:{ 0:hat, 1:rib } } };
  F.rm(def, 'hat', 'rib');
  chk(def.equippedParts.hat && def.equippedParts.hat.id === 'hat', '숫자키 맵에서 빼기 → 그 하나만 빠지고 기본 모자는 남는다(예전: 아무것도 안 빠짐)');
  def = { equippedParts:{ hat:[hat, { id:'gacha' }] } }; F.rm(def, 'hat', 'gacha');
  chk(def.equippedParts.hat === hat, '배열에서 가챠만 빼기 → 기본 모자 하나로(예전과 같음)');
}

say('── 2. 🖼️ 슬롯 섬네일 = 런처');
{
  const sl = CODE.slice(CODE.indexOf('function setLauncherChar('), CODE.indexOf('function launcherLoop('));
  chk(/function setLauncherChar\(def\)\{_lcThumbJob=null;/.test(CODE), '슬롯을 넘기면 찍기 예약을 먼저 버린다');
  chk(/if\(!def\.equippedParts\) _lcThumbArm\(def\);/.test(sl) && /if\(lChar === base\) _lcThumbArm\(def\);/.test(sl), '파츠 없음 → 바로 · 있음 → 장착이 끝난 뒤(그새 넘겼으면 안 찍음)');
  const lp = strip(grab(SRC, 'launcherLoop'));
  chk(/lRenderer\.render\(lScene,lCam\);\s*if\(_lcThumbJob && lChar && !lBlinkOn && performance\.now\(\) >= _lcThumbJob\.readyAt\) _lcThumbTake\(\);/.test(lp), 'render 와 같은 틱 · 눈 뜬 때 · 자리 잡을 시간 뒤');
  const tk = strip(grab(SRC, '_lcThumbTake'));
  chk(/lChar\.charDef !== job\.def/.test(tk) && /slots\.indexOf\(job\.def\) < 0/.test(tk), '다른 캐릭터·지워진 슬롯이면 안 찍는다');
  chk(/lChar\.group\.position\.y = lCharBaseY;/.test(tk) && /finally\{ try\{ lChar\.group\.position\.y = y;/.test(tk), '둥둥을 멈춘 자리에서 찍고 되돌린다');
  chk(/if\(a < 255 \* 20\) return;/.test(tk), '빈 그림이면 덮지 않는다');
  chk(/if\(url && url !== job\.def\.thumb\)\{ job\.def\.thumb = url; if\(typeof saveSlots === 'function'\) saveSlots\(\); \}/.test(tk), '바뀌었을 때만 저장');
  chk(/const LC_THUMB_SETTLE_MS = 900, LC_THUMB_MAX = 160;/.test(CODE), '크기 상한 160px(칸은 52px)');
  chk(/out\.thumb = null;/.test(CODE), '섬네일은 서버로 안 간다(로컬 전용 — 쓰기가 안 는다)');
}

say('── 3. 🎨 서식 태그의 배경색');
{
  const m = CODE.match(/const _MH_ALLOWED_ATTRS = (\{[\s\S]*?\});/);
  let A = null; try{ A = new Function('return ' + m[1])(); }catch(_){}
  chk(!!A, '허용 속성 표를 읽었다');
  if(A){
    chk(A.FONT.includes('style') && A.FONT.includes('color') && A.FONT.includes('size'), 'FONT — color · size · style');
    chk(['B', 'STRONG', 'I', 'EM', 'U'].every(t => A[t] && A[t].includes('style')), 'B · STRONG · I · EM · U — style');
    chk(!A.A.includes('style') && !A.IMG.includes('style'), 'A · IMG 는 그대로(style 없음)');
  }
  const sn = strip(grab(SRC, '_mhSanitizeNode'));
  chk(/\^\(color\|background-color\|font-size\|font-weight\|font-style\)\\s\*:/.test(sn), 'style 값은 여전히 다섯 속성만(position 등은 지워진다)');
}

say('── 4. 😑 스티커사진 눈 감기 짝');
{
  const cc = strip(grab(SRC, '_pkCloneChar'));
  chk(/const _cl = new Map\(\);/.test(cc) && /let c = _cl\.get\(m\); if\(!c\)\{ c = m\.clone\(\); _cl\.set\(m, c\); \}/.test(cc), '원본 재질 하나 → 복제본 하나');
  chk(/o\.material = Array\.isArray\(o\.material\) \? o\.material\.map\(_clone\) : _clone\(o\.material\);/.test(cc), '배열 재질도 같은 표');
  chk(/if\(srcFace && _cl\.has\(srcFace\)\) out\.faceMat = _cl\.get\(srcFace\);/.test(cc) && !/was === srcFace/.test(cc), '얼굴 짝은 표에서 한 번(«마지막 메시» 판정 없음)');
  chk(/ears\.push\(\{ mat:_cl\.get\(e\.mat\), fT:e\.fT, bT:e\.bT \}\)/.test(cc), '귀도 같은 표');
  /* 표가 정말 공유를 지키는지 — 가짜 재질로 돌려 본다 */
  const mk = () => ({ clone(){ return { from:this }; } });
  const shared = mk(), other = mk();
  const meshes = [{ material:shared }, { material:shared }, { material:[other, shared] }];
  const _cl = new Map(); const _clone = (m)=>{ if(!m || !m.clone) return m; let c = _cl.get(m); if(!c){ c = m.clone(); _cl.set(m, c); } return c; };
  meshes.forEach(o => { o.material = Array.isArray(o.material) ? o.material.map(_clone) : _clone(o.material); });
  chk(meshes[0].material === meshes[1].material && meshes[2].material[1] === meshes[0].material, '같이 쓰던 재질은 복제 뒤에도 같이 쓴다(몸·face1~4)');
  if(AN) chk(/if\(o\.isMesh\)\{ o\.material=mat;/.test(AN), 'animal.js — 몸·표정 메시가 전부 한 재질(이 수정이 필요한 이유)');
  else say('  · animal.js 없음 — 그 한 줄만 건너뜀');
}

say('── 5. 🫨 말랑이 제자리 떨림');
{
  const T = new Function('Math', 'const REST_MIN = 60, REST_MAX = 180; const JITTER_GAP_F = 40, JITTER_TURNS = 3;' + grab(ML, 'turnOrRest') + ' return turnOrRest;')(Object.assign(Object.create(Math), { random:()=>0 }));
  let g = { vx:0.5, rest:0 };
  const walk = (n)=>{ g._sinceTurn = (g._sinceTurn == null) ? 40 : g._sinceTurn + n; };
  walk(1); T(g); chk(g.vx === -0.5 && g.rest === 0, '처음 막힘 → 돌아선다');
  walk(1); T(g); chk(g.vx === 0.5 && g.rest === 0, '바로 또 막힘 → 한 번 더 돌아선다');
  walk(1); T(g); chk(g.vx === 0.5 && g.rest === 60, '세 번째 짧은 간격 → 뒤집지 않고 쉰다');
  g = { vx:0.5, rest:0 }; walk(1); T(g); walk(200); T(g); walk(200); T(g); walk(200); T(g);
  chk(g.rest === 0 && g.vx === 0.5 && g._turnN === 1, '평소 걸음(벽에 가끔 닿음)은 매번 돌아선다(네 번 → 제자리 방향 · 쉬지 않음)');
  const walkSeg = MLC.slice(MLC.indexOf('if(!inst.onGround){'), MLC.indexOf('const fl2 = floorFor(inst);'));
  chk(walkSeg.length > 200 && !/inst\.vx = -inst\.vx/.test(walkSeg), '걷기 중에는 맨몸 반전(inst.vx = -inst.vx)이 없다');
  chk((walkSeg.match(/turnOrRest\(inst\);/g) || []).length === 2, 'turnOrRest 부르는 곳 둘(앞줄 막힘 · 벽/밀기 실패)');
  chk(/inst\._sinceTurn = \(inst\._sinceTurn == null\) \? JITTER_GAP_F : inst\._sinceTurn \+ 1;/.test(MLC), '걸은 프레임을 센다');
}

(async ()=>{

say('── 6. 🎫 라이선스가 계정을 따라간다');
{
  const fns = ['_licenseSnapPushNow', '_licenseSnapForPush', 'activateLicense', 'deactivateLicense'].map(n => (SRC.includes('async function ' + n + '(') ? 'async ' : '') + grab(SRC, n)).join('\n');   // grab 은 async 를 떼어 온다
  chk(fns.split('function ').length - 1 >= 4, '네 함수를 떼어 왔다');
  const mk = (o) => {
    const LS = new Map(Object.entries(o.ls || {}));
    const env = { pushed:[], toasts:[], premium:null, LS };
    const W = { firebaseAPI:{ setAccountSnapshot:(u, s)=>env.pushed.push(s), fetchAccountSnapshot: async ()=>({ license:o.acct || null }) } };
    const f = new Function('env', 'window', 'firebaseAPI', `
      const LICENSE_KEY_STORAGE='tw.licenseKey', LICENSE_OPTOUT_KEY='tw.licenseOptOut';
      const localStorage = { getItem:k=>env.LS.has(k)?env.LS.get(k):null, setItem:(k,v)=>env.LS.set(k,String(v)), removeItem:k=>env.LS.delete(k) };
      const getMyLoginEmail = ()=> ${o.login === false ? 'null' : "'a@b'"}, getMyUserId = ()=>'U1';
      const _loginLocalSnapshot = ()=>({ license: localStorage.getItem(LICENSE_KEY_STORAGE), name:'n' });
      const verifyLicense = async (k)=> (${JSON.stringify(o.verify || { ok:true })});
      const _setPremium = (v)=>{ env.premium = v; };
      const toast = (m)=>env.toasts.push(m); const refreshLicenseUI = ()=>{};
      let userStatus = null; const setUserStatus = ()=>{};
      ${fns}
      return { forPush:_licenseSnapForPush, act:activateLicense, deact:deactivateLicense };`);
    return Object.assign(env, f(env, W, W.firebaseAPI));
  };
  await (async ()=>{
    let e = mk({ acct:'KEY-A' }); let s = await e.forPush();
    chk(s.license === 'KEY-A' && e.LS.get('tw.licenseKey') === 'KEY-A' && e.premium === true && e.toasts.length === 1, '이 PC 에 없고 계정에 있음 → 검증 뒤 이 PC 에서도 켠다 · 알린다');
    e = mk({ acct:'KEY-A', ls:{ 'tw.licenseOptOut':'KEY-A' } }); s = await e.forPush();
    chk(s.license === 'KEY-A' && !e.LS.has('tw.licenseKey') && e.premium === null, '이 기기에서 해제한 키 → 다시 켜지 않지만 계정 것은 지우지 않는다');
    e = mk({ acct:'KEY-B', ls:{ 'tw.licenseOptOut':'KEY-A' } }); s = await e.forPush();
    chk(e.LS.get('tw.licenseKey') === 'KEY-B', '해제한 것과 다른 키(새로 산 것)는 켠다');
    e = mk({ acct:'KEY-A', verify:{ ok:false } }); s = await e.forPush();
    chk(s.license === null && !e.LS.has('tw.licenseKey'), '회수된 키 → 켜지 않고 계정에서도 빠진다');
    e = mk({ acct:'KEY-A', verify:{ ok:false, offline:true } }); s = await e.forPush();
    chk(s.license === 'KEY-A' && !e.LS.has('tw.licenseKey'), '오프라인 → 켜지 않지만 계정 것을 지우지 않는다');
    e = mk({ acct:null }); s = await e.forPush();
    chk(s.license === null, '계정에도 없음 → 예전과 같음');
    e = mk({ acct:'KEY-X', ls:{ 'tw.licenseKey':'KEY-L' } }); s = await e.forPush();
    chk(s.license === 'KEY-L' && e.toasts.length === 0, '이 PC 에 있으면 그게 올라간다(계정 것을 안 읽는다)');
    e = mk({ ls:{ 'tw.licenseOptOut':'KEY-A' } }); await e.act(' key-a ');
    chk(e.LS.get('tw.licenseKey') === 'KEY-A' && !e.LS.has('tw.licenseOptOut') && e.pushed.length === 1 && e.pushed[0].license === 'KEY-A', '등록 즉시 계정에 올린다 · 해제 표시를 지운다');
    e = mk({ login:false }); await e.act('KEY-A'); chk(e.pushed.length === 0, '로그인 안 한 기기는 올리지 않는다');
    e = mk({ ls:{ 'tw.licenseKey':'KEY-A' } }); e.deact();
    chk(!e.LS.has('tw.licenseKey') && e.LS.get('tw.licenseOptOut') === 'KEY-A' && e.premium === false, '이 기기에서 해제 → 해제 표시에 그 키');
    chk(/setTimeout\(async \(\)=>\{ try\{ firebaseAPI\.setAccountSnapshot\(getMyUserId\(\), await _licenseSnapForPush\(\)\); \}catch\(_\)\{\} \}, 6000\);/.test(CODE), '부팅 push 가 _licenseSnapForPush 를 거친다(계정 라이선스를 null 로 덮지 않음)');
    chk(/LICENSE_KEY_STORAGE, LICENSE_REQ_ID_KEY, LICENSE_OPTOUT_KEY,/.test(CODE), '로그아웃이 해제 표시도 지운다(ACCOUNT_LOCAL_KEYS)');
  })();
}

say('── 7. 🗼 탑에서 룰렛 — 나만 빠지고 탑은 한 칸 내려앉는다(A안)');
{
  const leave = grab(SRC, '_rideLeaveTower');
  chk(!!leave, '_rideLeaveTower 를 떼어 왔다');
  /* 흉내: unmountRide 의 본래 규칙(내 위층은 내 아래층으로) · mountRide 는 태우기만 */
  const mk = () => {
    const env = { seats:[] };
    const f = new Function('env', `
      let _rideQuietToast = false; const seats = env.seats;
      const _rideRiders = (s)=> seats.filter(x=>x.ridingOn===s);
      function mountRide(u, h){ u.ridingOn = h; return true; }
      function unmountRide(a){ if(!a || !a.ridingOn) return; const below = a.ridingOn; a.ridingOn = null;
        _rideRiders(a).forEach(up=>{ up.ridingOn = null; if(below){ mountRide(up, below); return; } }); }
      ${leave}
      return { leave:_rideLeaveTower, quiet:()=>_rideQuietToast };`);
    return Object.assign(env, f(env));
  };
  const tower = (e) => { const [A,B,C,D] = ['A','B','C','D'].map(n=>({ n })); B.ridingOn = A; C.ridingOn = B; D.ridingOn = C; e.seats.push(A,B,C,D); return {A,B,C,D}; };
  const shape = (e) => e.seats.map(s => s.n + (s.ridingOn ? '>' + s.ridingOn.n : '')).join(' ');
  let e = mk(), T = tower(e); e.leave(T.B);
  chk(shape(e) === 'A B C>A D>C', '가운데(B)가 빠지면 C·D 가 A 위로 내려앉는다 → ' + shape(e));
  e = mk(); T = tower(e); e.leave(T.A);
  chk(shape(e) === 'A B C>B D>C', '맨 아래(A)가 빠지면 B 가 새 바닥 · C·D 는 탄 채 → ' + shape(e));
  e = mk(); T = tower(e); e.leave(T.D);
  chk(shape(e) === 'A B>A C>B D', '맨 위(D)는 혼자 빠진다 → ' + shape(e));
  chk(e.quiet() === false, '끝나면 조용함 표식을 푼다');
  chk(/function canFly\(seat, allowTower\)/.test(CODE) && /if\(!allowTower && \(seat\.ridingOn \|\| seats\.some\(s=>s\.ridingOn===seat\)\)\)/.test(CODE), 'canFly — 탑 허용은 인자로만');
  chk(/return canFly\(seat, true\)\.ok;/.test(CODE) && /const c = canFly\(mySeat, true\);/.test(CODE), '🎲 · 룰렛은 탑 안에서도 굴린다');
  const tg = CODE.slice(CODE.indexOf("방에 있는 다른 분만 날릴 수 있어요"), CODE.indexOf("방에 있는 다른 분만 날릴 수 있어요") + 600);
  chk(/const c = canFly\(seat\);/.test(tg), '💣(남을 겨눔)은 여전히 탑 안 사람을 못 겨눈다');
  const af = strip(grab(SRC, 'applyRemoteFly'));
  chk(/_rideLeaveTower\(seat\);\s*const ok = startFlight\(/.test(af), '받는 화면마다 «먼저 탑에서 빼고 → 날린다»');
  chk(/if\(seat\.fly\) return;\s*const want = seat\._remoteRidingOn;/.test(CODE), '날아가는 중인 좌석에는 늦게 온 «타고 있음» 을 다시 붙이지 않는다');
  chk(/if\(!_rideQuietToast && typeof toast==='function'\) toast\('🐾 머리 위에 올라탔어요!/.test(CODE), '탑이 내려앉으며 다시 태울 땐 토스트 없음');
}

say('── 8. 🖼️ 자리비움 그림 = 화면 150×150');
{
  chk(/var AWAY_PIC_SCREEN_PX = 150;/.test(CODE), '상수 150px');
  const fn = grab(SRC, '_awayWorldForPx');
  class V{ set(x,y,z){ this.x=x; this.y=y; this.z=z; return this; } applyMatrix4(m){ this.z = this.z - m.camZ; return this; } }
  const run = (px, camZ, fov, vh) => new Function('THREE', 'camera', 'renderer', 'innerHeight', 'var _awayCamV = null;' + fn + ' return _awayWorldForPx;')(
    { Vector3:V }, { fov, zoom:1, updateMatrixWorld(){}, matrixWorldInverse:{ camZ } }, { domElement:{ clientHeight:vh } }, vh)(px, 0, 0, 0);
  const w = run(150, 10, 34, 1000), expect = 150 * 2 * 10 * Math.tan(17 * Math.PI / 180) / 1000;
  chk(Math.abs(w - expect) < 1e-9, '150px → 월드 ' + w.toFixed(4) + '(거리 10 · fov 34 · 화면 1000px)');
  chk(Math.abs(run(150, 20, 34, 1000) - 2 * w) < 1e-9, '두 배 멀면 월드 길이도 두 배 — 화면에서는 같은 150px');
  chk(Math.abs(run(150, 10, 34, 2000) - w / 2) < 1e-9, '화면이 두 배 크면 절반 — 화면 px 고정');
  const fr = strip(grab(SRC, '_awayImgFrame'));
  chk(/const h = _awayWorldForPx\(AWAY_PIC_SCREEN_PX, cx, fy, cz\);/.test(fr) && /sp\.scale\.set\(h, h, 1\);/.test(fr) && !/sp\.scale\.set\(bh/.test(fr), '크기는 경계상자가 아니라 화면 px 에서(인간·동물 같음)');
  chk(/sp\.position\.set\(cx - _awayGW\.x, fy \+ h\/2 - _awayGW\.y, cz - _awayGW\.z\);/.test(fr), '자리는 예전처럼 가운데 · 발밑');
}

say('── 9. 🗼 탑 위 자리비움 그림 — 바로 아래 캐릭터의 꼭대기에(A안)');
{
  const fr = strip(grab(SRC, '_awayImgFrame'));
  chk(/const _host = seat\.ridingOn;\s*if\(_host && _host\.rig && seats\.indexOf\(_host\) >= 0\)\{/.test(fr), '올라탄 동안에만 갈래를 탄다');
  chk(/_awayHostBox\.setFromObject\(_host\.bodyWrap \|\| _host\.rig\);/.test(fr) && /fy = _awayHostBox\.max\.y;/.test(fr), '밑변 = 바로 아래 캐릭터의 꼭대기');
  chk(/cx = \(_awayHostBox\.min\.x \+ _awayHostBox\.max\.x\)\/2;/.test(fr) && /cz = \(_awayHostBox\.min\.z \+ _awayHostBox\.max\.z\)\/2;/.test(fr), '가로·앞뒤 = 그 캐릭터 가운데');
  chk(fr.indexOf('fy = _awayHostBox.max.y;') < fr.indexOf('const h = _awayWorldForPx(AWAY_PIC_SCREEN_PX, cx, fy, cz);'), '크기(150px)는 바뀐 자리의 깊이로 잰다');
  chk(/var _awayBox = null, _awayGW = null, _awayHostBox = null;/.test(CODE), '상자는 하나를 재사용한다(매 측정 new 없음)');
  /* 흉내: 팔 걸치기 자세 — 내 발밑(0.9)이 상대 꼭대기(1.4)보다 아래 → 그림 밑변은 1.4 */
  const place = (rider, host) => { let fy = rider.min; if(host) fy = host.max; return fy; };
  chk(place({ min:0.9 }, { max:1.4 }) === 1.4 && place({ min:0 }, null) === 0, '올라탄 그림은 상대 머리 위 · 땅에 선 그림은 예전처럼 발밑');
}

say(`\n${fail ? '✗' : '✓'} 통과 ${pass} · 실패 ${fail}`);
process.exit(fail ? 1 : 0);
})();
