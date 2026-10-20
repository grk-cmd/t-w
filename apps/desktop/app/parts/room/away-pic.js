/* away-pic.js — 🫧 자리비움 그림 — 내 그림 등록 · 좌석 위 스프라이트 · 크기 · 주소 확인
   app.js «🫧 자리비움 그림» 구역의 본문을 그대로 옮긴 모듈이다(앱 FSD 22번 — docs/APP_FSD_MAP.md). 동작은 옮기기 전과 같다.
   ★ 아래 본문은 app.js 에 있던 글 그대로다(들여쓰기도). 바뀐 줄은 1줄 —
     officeMode 를 이름() 으로 읽는다(모듈을 만드는 줄보다 뒤에 선언되거나 app.js 가 다시 대입하는 값이라 읽는 함수로 받는다).
     받을 이름 · 바꿀 자리는 파서(typescript)로 골랐다 — 주석 · 글자 · 속성 이름은 그대로.
   ★ app.js 함수 6개는 화살표로 받는다(나중에 선언된 함수도 부를 때 찾는다).
   ★ 밖에서 부르는 이름: AWAY_PIC_SCREEN_PX · _awayImgFollow · _awayImgFrame · _awayPicFor · _awayRenderUI · _awaySzOk · _awayUrlOk · awayImgSz · awayImgUrl — app.js 는 awayPicMod.이름 으로 부른다.
   ⚠️ document · window · firebaseAPI · localStorage 등 브라우저 · 다른 모듈 전역은 예전처럼 전역 이름으로 쓴다(app.js 앞에 싣는 classic script).
   ⚠️ 전역 이름은 TwAwayPic — 크로미움 내장 전역과 겹치지 않게 Tw 접두사(#103).
   검사: checks/sim-away-pic.js */
(function(){

function createAwayPic(deps){
const Presence = deps.Presence;
const _loadImgCors = deps._loadImgCors;
const _premiumOn = deps._premiumOn;
const camera = deps.camera;
const findMySeat = deps.findMySeat;
const getMyUserId = deps.getMyUserId;
const measureBodyBox = deps.measureBodyBox;
const measureHeadBoxNoParts = deps.measureHeadBoxNoParts;
const officeMode = deps.officeMode;   // 읽는 함수
const renderer = deps.renderer;
const seats = deps.seats;
const toast = deps.toast;
var AWAY_IMG_KEY = 'tw.awayImg';
var AWAY_IMG_PX = 500;
var AWAY_IMG_MAX_BYTES = 300 * 1024;
var awayImgUrl = '';
try{ const _a = localStorage.getItem(AWAY_IMG_KEY) || ''; awayImgUrl = _awayUrlOk(_a) ? _a : ''; }catch(_){}
/* 📏 [2026-10-02 · A안 확정] 자리비움 그림 **화면 크기** — 60·80·100 중 그림 주인이 고른다(기본 80 = AWAY_PIC_SCREEN_PX).
   이 기기 tw.awaySz + 서버 users/{uid}/awaySz(계정을 따라감) + 방 payload awaySz(받는 쪽이 이 크기로 그린다).
   ⚠️ 구버전이 보낸 좌석(awaySz 없음)은 기본값으로 그린다. 구버전이 **보는** 화면에서는 그쪽 고정값(60)으로 보인다. */
var AWAY_SZ_KEY = 'tw.awaySz';
var AWAY_SZ_OPTIONS = [60, 80, 100];
function _awaySzOk(v){ return AWAY_SZ_OPTIONS.indexOf(v) >= 0; }
var awayImgSz = 80;
try{ const _z = parseInt(localStorage.getItem(AWAY_SZ_KEY) || '', 10); if(_awaySzOk(_z)) awayImgSz = _z; }catch(_){}
/* 이 좌석의 그림을 화면 몇 px 로 그릴지 — 내 좌석은 내가 고른 값, 남의 좌석은 그 사람이 보낸 값(없으면 기본). */
function _awayPxFor(seat){
  const v = (seat && seat.remote) ? seat.remoteAwaySz : (seat && seat.isMe ? awayImgSz : null);
  return _awaySzOk(v) ? v : AWAY_PIC_SCREEN_PX;
}
var _awayTex = new Map();   // url → { st:'loading'|'ok'|'fail', tex }
var _awayBox = null, _awayGW = null, _awayHostBox = null;
var _awayHostP = null, _awayHostS = null;   // 🫧 아래 캐릭터의 자리비움 그림 위치·크기(탑 위 그림용 · 하나를 재사용)
/* 🩹 [2026-10-02 제보 «자리비움인 사람을 💣 로 날리면 버벅인다»] 비행은 매 프레임 seat.rig.position 만 움직이는데(_updateFlyingSeats),
   그림은 group 에 붙어 0.5초마다만 자리를 다시 잡았다 — 몸은 숨어 있고 그림만 보이니 «0.5초 멈춤 → 순간이동» 이 초당 두 번.
   ⇒ 잴 때 남긴 rig 기준 오프셋(_awayOff)으로 **매 프레임** 그림을 rig 에 붙여 옮긴다. 벡터 덧셈 하나라 비용이 없다.
   ★ 그림을 rig 의 자식으로 옮기지 않는다 — 비행 스핀(rotation.z)·turnY 를 같이 받아 그림이 발을 축으로 돈다.
   ★ _updateFlyingSeats **뒤에** 부른다(frame) — 그래야 이번 프레임의 비행 좌표를 따라간다. */
function _awayImgFollow(){
  for(let i = 0; i < seats.length; i++){
    const s = seats[i], sp = s && s._awaySprite;
    if(!sp || !sp.visible || !s._awayOff || !s.rig) continue;
    sp.position.copy(s.rig.position).add(s._awayOff);
  }
}
var _awayBusy = false;
function _awayUrlOk(u){
  return typeof u === 'string' && u.length <= 500 && u.indexOf('https://firebasestorage.googleapis.com/') === 0;
}
function _awayTexState(url){
  let e = _awayTex.get(url);
  if(e) return e.st;
  if(_awayTex.size > 40){ const k = _awayTex.keys().next().value; _awayTex.delete(k); }
  e = { st:'loading', tex:null }; _awayTex.set(url, e);
  _loadImgCors(url).then(img=>{
    const t = new THREE.Texture(img); t.encoding = THREE.sRGBEncoding; t.needsUpdate = true;
    e.tex = t; e.st = 'ok';
  }).catch(()=>{ e.st = 'fail'; });
  return 'loading';
}
/* 이 좌석이 지금 그림을 세울 URL — 없으면 null(예전 모양). 그림이 **다 불러와졌을 때만** URL 을 준다. */
function _awayPicFor(seat, us, hidden){
  if(us !== 'away' || hidden || !seat) return null;
  if(typeof officeMode() !== 'undefined' && officeMode()) return null;
  const url = seat.remote ? seat.remoteAwayImg : (seat.isMe ? awayImgUrl : null);
  if(!_awayUrlOk(url)) return null;
  return (_awayTexState(url) === 'ok') ? url : null;
}
/* 캐릭터 자리에 그림 스프라이트 — 캐릭터 경계상자 높이에 맞춘 정사각형 · 발밑을 캐릭터 발밑에.
   ★ 경계상자는 0.5초에 한 번만 잰다(매 프레임 setFromObject 는 비싸다). group 은 이동만 하므로 월드 오프셋 = 로컬 오프셋. */
function _awayImgFrame(seat, url, now){
  let sp = seat._awaySprite;
  if(!url){ if(sp && sp.visible) sp.visible = false; return; }
  const e = _awayTex.get(url); if(!e || !e.tex){ if(sp) sp.visible = false; return; }
  if(!sp){
    const mat = new THREE.SpriteMaterial({ map:e.tex, transparent:true, depthTest:true, depthWrite:false });
    sp = new THREE.Sprite(mat); sp.renderOrder = 840; sp.visible = false;
    seat.group.add(sp); seat._awaySprite = sp; seat._awayFitAt = 0;
  }
  if(sp.material.map !== e.tex){ sp.material.map = e.tex; sp.material.needsUpdate = true; }
  /* 🩹 [2026-10-02 제보 «자리비움인 사람을 💣 로 날리면 버벅이며 날아간다»] 비행 중에는 다시 재지 않는다 —
     빙글 도는 몸을 재면 측정마다 크기·가운데가 튄다. 위치는 아래 _awayImgFollow 가 매 프레임 rig 를 따라 옮긴다. */
  if(!seat._awayFitAt || ((now - seat._awayFitAt) > 500 && !seat.fly) || !sp.visible){
    seat._awayFitAt = now;
    try{
      if(!_awayBox){ _awayBox = new THREE.Box3(); _awayGW = new THREE.Vector3(); }
      seat.rig.updateMatrixWorld(true);
      measureBodyBox(seat.bodyWrap || seat.rig, null, _awayBox);
      seat.group.getWorldPosition(_awayGW);
      const bh = _awayBox.max.y - _awayBox.min.y;
      if(!(bh > 0.05 && bh < 10)){ sp.visible = false; return; }
      /* 🖼️ [2026-09-23 제보 «동물이면 자리비움 그림이 엄청 크게 나온다»] 예전엔 캐릭터 경계상자 높이에 맞췄다 —
         동물은 경계상자가 몸보다 훨씬 커서 그림이 따라 커졌다. 이제 **화면에서 주인이 고른 60·80·100px(_awayPxFor) 정사각형**으로
         고정한다(인간·동물 · 캐릭터 크기 설정과 무관). 자리(가운데 · 발밑)는 예전처럼 경계상자에서 잰다. */
      let cx = (_awayBox.min.x + _awayBox.max.x)/2, cz = (_awayBox.min.z + _awayBox.max.z)/2, fy = _awayBox.min.y;
      /* 🩹 [2026-10-02 제보 «가끔 그림이 자기 자리에서 옆으로 벗어나 있다»] 가로·앞뒤는 상자 가운데가 아니라 **rig 원점**
         (= 캐릭터 발밑 피봇 · measureCharBox 주석)에서 잡는다. 이 상자(setFromObject)는 숨은 placeholder·한쪽으로 뻗은
         파츠·바인드포즈 리깅 파츠까지 담아서 가운데가 옆으로 끌려갔다. 높이(발밑 fy)는 예전 그대로다. */
      { const _rw = new THREE.Vector3(); seat.rig.getWorldPosition(_rw); cx = _rw.x; cz = _rw.z; }
      /* 🗼 [2026-09-23 제보 «탑 위에서 자리비움하면 그림이 밑의 캐릭터를 가린다»] 1층으로 올라탄 캐릭터는 상대 머리에
         팔을 걸치고 몸이 얼굴 앞으로 늘어진 자세라 **발밑이 상대 머리보다 아래**다. 그 발밑에 150px 그림을 세우면
         상대를 통째로 덮었다. 올라탄 동안에는 그림 밑변을 **바로 아래 캐릭터의 꼭대기**에, 가로·앞뒤는 그 캐릭터 가운데에
         맞춘다(A안 · 탑 맨 위에 얹힌 모양). 층마다 각자 자기 바로 아래 캐릭터 위에 선다. 2층 이상(묘기)도 같은 규칙이다. */
      const _host = seat.ridingOn;
      if(_host && _host.rig && seats.indexOf(_host) >= 0){
        if(!_awayHostBox) _awayHostBox = new THREE.Box3();
        _host.rig.updateMatrixWorld(true);
        measureBodyBox(_host.bodyWrap || _host.rig, null, _awayHostBox);
        /* 🩹 [2026-10-02 제보 «머리 위에 올리면 연 날리는 것처럼 엄청 떠 있다»] 위 상자는 모자·뿔 파츠, 숨긴 장식,
           바인드포즈 리깅 파츠, 숨은 placeholder 까지 담아 «꼭대기» 가 머리보다 한참 위였다. 탑쌓기(올라타기 높이)가
           이미 쓰는 «맨 머리 꼭대기» 측정(measureHeadBoxNoParts)으로 갈아 끼운다.
           ⚠️ 비어 있으면(아래 캐릭터도 자리비움이라 몸이 숨은 경우) 위 상자를 그대로 쓴다. */
        try{
          const _hb = _host.gltfRoot ? measureHeadBoxNoParts(_host.gltfRoot, null, _host) : null;
          if(_hb && !_hb.isEmpty()) _awayHostBox.copy(_hb);
        }catch(_){}
        if(!_awayHostBox.isEmpty()){
          fy = _awayHostBox.max.y;
          cx = (_awayHostBox.min.x + _awayHostBox.max.x)/2;
          cz = (_awayHostBox.min.z + _awayHostBox.max.z)/2;
        }
        /* 🫧 [2026-10-02] 바로 아래 캐릭터도 자리비움 그림이면 그 몸은 숨어 있다 — 숨은 머리가 아니라 **그 그림 윗변**에 얹는다
           (_positionRideSeat 의 같은 날 수정과 짝 · 안 하면 그림 위에 그림이 공중에 뜬다). */
        const _hsp = _host._awaySprite;
        if(_hsp && _hsp.visible){
          if(!_awayHostP){ _awayHostP = new THREE.Vector3(); _awayHostS = new THREE.Vector3(); }
          _hsp.getWorldPosition(_awayHostP); _hsp.getWorldScale(_awayHostS);
          fy = _awayHostP.y + _awayHostS.y / 2; cx = _awayHostP.x; cz = _awayHostP.z;
        }
      }
      const h = _awayWorldForPx(_awayPxFor(seat), cx, fy, cz);   // 📏 좌석마다 주인이 고른 크기(60·80·100)
      if(!(h > 0)){ sp.visible = false; return; }
      sp.scale.set(h, h, 1);
      sp.position.set(cx - _awayGW.x, fy + h/2 - _awayGW.y, cz - _awayGW.z);
      /* 🩹 [2026-10-02] 위 줄은 group 이 이동만 할 때의 값 — 아래에서 월드 목표점을 group 로컬로 **역변환**해 덮어쓴다. 예전엔 «group 은 이동만 한다» 고 보고 월드 위치만 뺐는데,
         올라탄 좌석은 group 이 고개 기울기·상대 회전을 받아 돈다(mountRide) — 그 회전만큼 그림이 옆·앞뒤로 비껴났다. */
      { const _t = new THREE.Vector3(cx, fy + h/2, cz); seat.group.updateMatrixWorld(true); seat.group.worldToLocal(_t); sp.position.copy(_t); }
      /* rig 기준 오프셋 — 비행·흔들기처럼 rig 만 움직이는 동안 _awayImgFollow 가 매 프레임 이 값으로 따라 옮긴다. */
      if(!seat._awayOff) seat._awayOff = new THREE.Vector3();
      seat._awayOff.copy(sp.position).sub(seat.rig.position);
    }catch(_){ sp.visible = false; return; }
  }
  sp.visible = true;
}
/* 🖼️ 화면 px → 그 깊이에서의 월드 길이(원근 카메라). 0.5초마다 다시 재므로 카메라 줌·창 크기가 바뀌어도 따라간다. */
/* 🖼️ [2026-10-02 요청] 150 → 60 → **기본 80** + 그림 주인이 60·80·100 중 고른다(A안 · _awayPxFor · AWAY_SZ_OPTIONS).
   이 값은 «고른 적 없음 · 구버전 좌석» 의 기본이다. 업로드 원본(AWAY_IMG_PX 500)은 그대로라 다시 올릴 필요 없다. */
var AWAY_PIC_SCREEN_PX = 80;
var _awayCamV = null;
function _awayWorldForPx(px, wx, wy, wz){
  try{
    if(!_awayCamV) _awayCamV = new THREE.Vector3();
    camera.updateMatrixWorld();
    _awayCamV.set(wx, wy, wz).applyMatrix4(camera.matrixWorldInverse);
    const d = Math.max(0.05, -_awayCamV.z);
    const vh = (renderer && renderer.domElement && renderer.domElement.clientHeight) || innerHeight;
    if(!(vh > 0)) return 0;
    return px * (2 * d * Math.tan(camera.fov * Math.PI / 360) / (camera.zoom || 1)) / vh;
  }catch(_){ return 0; }
}
/* 파일 → 500×500 WebP dataURL(투명 유지 · 비율 유지 가운데 맞춤). 300KB 이하가 될 때까지 품질을 내린다. */
function _awayPrepare(file){
  return new Promise(res=>{
    if(!file || !/^image\//.test(file.type || '')) return res({ err:'bad' });
    const fr = new FileReader();
    fr.onerror = ()=>res({ err:'bad' });
    fr.onload = ()=>{
      const img = new Image();
      img.onerror = ()=>res({ err:'bad' });
      img.onload = ()=>{
        if(!img.naturalWidth || !img.naturalHeight) return res({ err:'bad' });
        const cv = document.createElement('canvas'); cv.width = AWAY_IMG_PX; cv.height = AWAY_IMG_PX;
        const g = cv.getContext('2d');
        const k = Math.min(AWAY_IMG_PX / img.naturalWidth, AWAY_IMG_PX / img.naturalHeight);
        const w = Math.round(img.naturalWidth * k), h = Math.round(img.naturalHeight * k);
        g.clearRect(0, 0, AWAY_IMG_PX, AWAY_IMG_PX);
        g.drawImage(img, Math.round((AWAY_IMG_PX - w)/2), AWAY_IMG_PX - h, w, h);   // 발밑 맞춤(아래 정렬)
        for(const q of [0.92, 0.85, 0.75, 0.6, 0.45]){
          const d = cv.toDataURL('image/webp', q);
          if(d.indexOf('data:image/webp') !== 0) return res({ err:'bad' });   // WebP 를 못 굽는 환경
          const bytes = Math.floor((d.length - d.indexOf(',') - 1) * 3 / 4);
          if(bytes <= AWAY_IMG_MAX_BYTES) return res({ dataUrl:d, bytes });
        }
        res({ err:'big' });
      };
      img.src = fr.result;
    };
    fr.readAsDataURL(file);
  });
}
/* 👑 자리비움 그림은 **프리미엄 전용**이다(2026-09-23 요청).
   ★ 등록만 잠근다 — 남이 등록한 그림은 프리미엄이 아니어도 그대로 보인다(보는 쪽은 라이선스와 무관).
   ★ 이미 올려 둔 그림은 라이선스가 끝나도 지우지 않는다. [기본으로]는 언제나 쓸 수 있다(내 것을 되돌리는 길은 막지 않는다).
   ⚠️ 서버는 이걸 못 본다 — Storage · RTDB 규칙에 라이선스 판정이 없다. 여기 게이트는 화면 쪽 약속이다. */
function _awayPremium(){ try{ return _premiumOn(); }catch(_){ return false; } }
function _awayRenderUI(msg, isErr){
  const im = document.getElementById('miAwayImg'), ph = document.getElementById('miAwayPh');
  const rs = document.getElementById('miAwayReset'), m = document.getElementById('miAwayMsg');
  const pk = document.getElementById('miAwayPick');
  const has = _awayUrlOk(awayImgUrl);
  const prem = _awayPremium();
  if(im){ if(has){ im.src = TwSafeHtml.safeUrl(awayImgUrl, 'image'); im.style.display = ''; } else { im.removeAttribute('src'); im.style.display = 'none'; } }
  if(ph) ph.style.display = has ? 'none' : '';
  if(rs) rs.style.display = has ? '' : 'none';
  if(pk) pk.disabled = !!_awayBusy || !prem;
  if(rs) rs.disabled = !!_awayBusy;
  /* 📏 크기 버튼 — 지금 값에 눌림 표시. 그림이 없으면 고를 이유가 없어 줄을 숨긴다(골라 둔 값은 남는다). */
  const szRow = document.getElementById('miAwaySzRow');
  if(szRow) szRow.style.display = has ? 'flex' : 'none';
  document.querySelectorAll('#miAwaySz .mi-away-sz').forEach(b=>{
    b.classList.toggle('on', +b.dataset.sz === awayImgSz);
    b.disabled = !!_awayBusy;
  });
  if(m){
    m.textContent = '';
    if(msg){
      const b = document.createElement(isErr ? 'b' : 'span');
      if(isErr) b.style.color = '#B22222';
      b.textContent = msg; m.appendChild(b);
    }else if(!prem){
      m.textContent = '👑 프리미엄 라이선스가 있어야 등록할 수 있어요.' + (has ? ' 지금 그림은 그대로 보여요.' : '');
    }else if(has){
      m.textContent = '자리비움이면 캐릭터 대신 이 그림이 서요. 방 사람들에게도 보여요.';
    }else{
      m.textContent = '투명 PNG · 500×500 · 300KB 이하. 자리비움이면 캐릭터 대신 이 그림이 서요.';
    }
  }
}
function _awaySetLocal(url){
  awayImgUrl = _awayUrlOk(url) ? url : '';
  try{ if(awayImgUrl) localStorage.setItem(AWAY_IMG_KEY, awayImgUrl); else localStorage.removeItem(AWAY_IMG_KEY); }catch(_){}
  try{ if(typeof Presence !== 'undefined' && Presence.setAwayImg) Presence.setAwayImg(awayImgUrl); }catch(_){}
}
async function _awayPick(file){
  if(_awayBusy || !file) return;
  if(!_awayPremium()){ _awayRenderUI('👑 프리미엄 라이선스가 있어야 등록할 수 있어요.', true); return; }
  const api = window.firebaseAPI, uid = getMyUserId();
  if(!api || !api.uploadAwayImg || !uid){ _awayRenderUI('아직 준비 중이에요 — 잠시 뒤 다시 해 주세요.', true); return; }
  let msg = null, err = false;
  _awayBusy = true; _awayRenderUI('올리는 중…');
  try{
    const prep = await _awayPrepare(file);
    if(prep.err === 'bad'){ msg = '그림 파일을 읽지 못했어요. PNG 를 골라 주세요.'; err = true; return; }
    if(prep.err === 'big'){ msg = '못 올렸어요 — 줄이고 압축해도 300KB 를 넘었어요. 이전 그림 그대로예요.'; err = true; return; }
    const up = await api.uploadAwayImg(uid, prep.dataUrl);
    if(!up || !up.ok){ msg = '못 올렸어요 — ' + ((up && up.reason) || '업로드에 실패했어요') + '. 이전 그림 그대로예요.'; err = true; return; }
    const sv = await api.setAwayImg(uid, up.url);
    if(!sv || !sv.ok){ try{ await api.deleteStorageUrl(up.url); }catch(_){} msg = '못 올렸어요 — 저장에 실패했어요. 이전 그림 그대로예요.'; err = true; return; }
    const old = awayImgUrl;
    _awaySetLocal(up.url);
    if(old && old !== up.url){ try{ await api.deleteStorageUrl(old); }catch(_){} }
    toast('🫧 자리비움 그림을 바꿨어요');
  }catch(e){ msg = '못 올렸어요 — 잠시 뒤 다시 해 주세요.'; err = true; }
  finally{ _awayBusy = false; _awayRenderUI(msg, err); }
}
async function _awayReset(){
  if(_awayBusy || !awayImgUrl) return;
  const api = window.firebaseAPI, uid = getMyUserId();
  if(!api || !api.setAwayImg || !uid){ _awayRenderUI('아직 준비 중이에요 — 잠시 뒤 다시 해 주세요.', true); return; }
  _awayBusy = true; _awayRenderUI('되돌리는 중…');
  try{
    const sv = await api.setAwayImg(uid, null);
    if(!sv || !sv.ok){ _awayBusy = false; _awayRenderUI('되돌리지 못했어요 — 잠시 뒤 다시 해 주세요.', true); return; }
    const old = awayImgUrl;
    _awaySetLocal('');
    try{ await api.deleteStorageUrl(old); }catch(_){}
    _awayBusy = false; _awayRenderUI(null);
    toast('🫧 기본 자리비움으로 돌아왔어요');
  }finally{ _awayBusy = false; }
}
/* 📏 크기 — 이 기기·방에는 바로, 서버에는 뒤에서. 서버 저장이 실패해도 이 기기·방은 바뀐 채로 둔다(다음 부팅 때 서버 값이 이기므로
   실패를 알려 준다). 같은 값이면 아무것도 안 보낸다. */
function _awaySzSetLocal(px){
  if(!_awaySzOk(px)) return;
  awayImgSz = px;
  try{ localStorage.setItem(AWAY_SZ_KEY, String(px)); }catch(_){}
  try{ if(typeof Presence !== 'undefined' && Presence.setAwaySz) Presence.setAwaySz(px); }catch(_){}
  try{ const me = findMySeat(); if(me) me._awayFitAt = 0; }catch(_){}   // 내 화면 즉시 다시 맞춤
}
async function _awaySetSz(px){
  if(!_awaySzOk(px) || px === awayImgSz) return;
  _awaySzSetLocal(px);
  _awayRenderUI(null);
  const api = window.firebaseAPI, uid = getMyUserId();
  if(!api || !api.setAwaySz || !uid) return;
  try{
    const r = await api.setAwaySz(uid, px);
    if(!r || !r.ok) _awayRenderUI('크기를 서버에 저장하지 못했어요 — 이 기기에서만 바뀌었어요.', true);
  }catch(_){ _awayRenderUI('크기를 서버에 저장하지 못했어요 — 이 기기에서만 바뀌었어요.', true); }
}
/* 부팅 — 서버 값이 기준이다(다른 기기에서 바꿈 · 관리자가 내림). 못 읽으면 로컬 그대로. */
function _awayBootSync(tries){
  const api = window.firebaseAPI, uid = getMyUserId();
  if(!api || !api.getAwayImg || !uid){ if((tries||0) < 30) setTimeout(()=>_awayBootSync((tries||0)+1), 2000); return; }
  api.getAwayImg(uid).then(r=>{
    if(!r || !r.ok) return;
    const srv = _awayUrlOk(r.url) ? r.url : '';
    if(srv !== awayImgUrl){ _awaySetLocal(srv); _awayRenderUI(null); }
  }).catch(()=>{});
  /* 📏 크기도 서버가 기준 — 서버에 없으면(고른 적 없음 · 옛 판) 이 기기 값을 그대로 둔다. */
  if(api.getAwaySz) api.getAwaySz(uid).then(r=>{
    if(r && r.ok && _awaySzOk(r.px) && r.px !== awayImgSz){ _awaySzSetLocal(r.px); _awayRenderUI(null); }
  }).catch(()=>{});
}
(function bindAwayImg(){
  const pick = document.getElementById('miAwayPick'), file = document.getElementById('miAwayFile'), rs = document.getElementById('miAwayReset');
  if(pick && file){
    pick.addEventListener('click', e=>{
      e.stopPropagation();
      if(!_awayPremium()){ toast('👑 자리비움 그림은 프리미엄 라이선스가 있어야 등록할 수 있어요'); return; }
      if(!_awayBusy){ file.value = ''; file.click(); }
    });
    file.addEventListener('change', ()=>{ const f = file.files && file.files[0]; if(f) _awayPick(f); });
  }
  if(rs) rs.addEventListener('click', e=>{ e.stopPropagation(); _awayReset(); });
  document.querySelectorAll('#miAwaySz .mi-away-sz').forEach(b=>b.addEventListener('click', e=>{
    e.stopPropagation(); if(!_awayBusy) _awaySetSz(+b.dataset.sz);
  }));
  _awayRenderUI(null);
  _awayBootSync(0);
})();

return {
  AWAY_PIC_SCREEN_PX: ()=>AWAY_PIC_SCREEN_PX,   // 읽는 함수
  _awayImgFollow,
  _awayImgFrame,
  _awayPicFor,
  _awayRenderUI,
  _awaySzOk,
  _awayUrlOk,
  awayImgSz: ()=>awayImgSz,   // 읽는 함수
  awayImgUrl: ()=>awayImgUrl,   // 읽는 함수
};
}

const api = { createAwayPic };
if(typeof window !== 'undefined') window.TwAwayPic = api;
if(typeof module !== 'undefined' && module.exports) module.exports = api;
})();
