/* char-code.js — 📦 캐릭터 복제 코드 — 불러오기 · 내보내기 · 풀 GLB
   app.js «📦 복제 코드 불러오기 · 내보내기 · 풀 GLB» 구역 본문을 그대로 옮긴 모듈이다(앱 FSD 38번 — docs/APP_FSD_MAP.md).
   동작은 옮기기 전과 같다. 섞여 있던 생성기 상태(cDeskGlbB64 · cDeskTemplate)는 app.js 에 남겼다.
   ★ 아래 본문은 app.js 에 있던 글 그대로다(들여쓰기도). 바뀐 줄은 7줄 —
     curSlot · focusLevelMod · gachaMod · isAdmin · isPremium 를 이름() 으로 읽는다(모듈을 만드는 줄보다 뒤에 선언되거나 app.js 가 다시 대입하는 값이라 읽는 함수로 받는다). 대입은 setCurSlot(…).
     받을 이름 · 바꿀 자리는 파서(typescript)로 골랐다 — 주석 · 글자 · 속성 이름은 그대로.
   ★ app.js 함수 13개는 화살표로 받는다(나중에 선언된 함수도 부를 때 찾는다).
   ★ 밖에서 부르는 이름: downloadBlob · importCloneCode · loadEncryptedGlbAsSeat · openCodeModal — app.js 는 charCodeMod.이름 으로 부른다.
   ⚠️ document · window · firebaseAPI · localStorage 등 브라우저 · 다른 모듈 전역은 예전처럼 전역 이름으로 쓴다(app.js 앞에 싣는 classic script).
   ⚠️ 전역 이름은 TwCharCode — 크로미움 내장 전역과 겹치지 않게 Tw 접두사(#103).
   검사: checks/sim-char-code.js */
(function(){

function createCharCode(deps){
const CHAR_SLOT_MAX = deps.CHAR_SLOT_MAX;
const applyCharToSeat = deps.applyCharToSeat;
const charsMod = deps.charsMod;
const closeGearMenu = deps.closeGearMenu;
const createSeat = deps.createSeat;
const curSlot = deps.curSlot;   // 읽는 함수
const decryptCode = deps.decryptCode;
const encryptCode = deps.encryptCode;
const focusLevelMod = deps.focusLevelMod;   // 읽는 함수
const gachaMod = deps.gachaMod;   // 읽는 함수
const isAdmin = deps.isAdmin;   // 읽는 함수
const isPremium = deps.isPremium;   // 읽는 함수
const layoutSeats = deps.layoutSeats;
const loadCharGLB = deps.loadCharGLB;
const overheadMod = deps.overheadMod;
const premiumMod = deps.premiumMod;
const renderLauncher = deps.renderLauncher;
const renderSeatTabs = deps.renderSeatTabs;
const saveCurSlot = deps.saveCurSlot;
const saveSlots = deps.saveSlots;
const scene = deps.scene;
const seats = deps.seats;
const selectSeat = deps.selectSeat;
const slots = deps.slots;
const toast = deps.toast;
const setCurSlot = deps.setCurSlot;   // 쓰는 함수
function downloadBlob(buf,filename){const bl=new Blob([buf],{type:'application/octet-stream'});const u=URL.createObjectURL(bl);
  const a=document.createElement('a');a.href=u;a.download=filename;document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(u),1500);}
function loadEncryptedGlbAsSeat(buf,name){
  if(document.getElementById('launcher').classList.contains('on')){
    [...seats].forEach(s=>{scene.remove(s.group);overheadMod.removeSeatLabels(s);});seats.length=0;
    slots.forEach((def,i)=>{if(def){const st=createSeat();applyCharToSeat(st,def);st.slot=i;}});
    document.getElementById('launcher').classList.remove('on');}
  const seat=createSeat(); loadCharGLB(buf,name,seat); selectSeat(seat); renderSeatTabs(); layoutSeats();}

/* --- 불러오기 (코드 + 암호) --- */
function openCodeModal(){document.getElementById('codeText').value='';document.getElementById('codePass').value='';document.getElementById('codeOverlay').classList.add('on');}
document.getElementById('codeCancel').onclick=()=>document.getElementById('codeOverlay').classList.remove('on');
/* 🔴 [제보 1의 진짜 원인] 복제 코드(DCC1)를 슬롯에 앉히는 **단 하나의 구현**.
   입구가 둘이다 —
     ① [내 정보 › 보관함] 맨 아래 [코드로 캐릭터 불러오기] → #codeOverlay  (개정 16 · 옛 런처 [캐릭터 불러오기] 자리)
     ② 빈 슬롯 [＋] → 종족 선택 창의 [코드 입력하기] 패널 → #raceCommCodePanel
   ②는 원래 **커미션 코드(DCM1)만** 받았다. 거기에 캐릭터 복제 코드(DCC1)를 넣으면
   decryptCommission 이 첫 줄에서 형식 오류를 던지고, 그 catch 가
   "등록 실패: 코드나 비밀번호를 확인해 주세요" 를 띄운다 — 유저가 본 그 문구다.
   그리고 ②는 **빈 슬롯에서만 열리는 창**이라, 증상이 정확히 "슬롯이 비었을 때만 안 된다"로 보였다.
   암호·크립토·이미지는 처음부터 멀쩡했다(그래서 소스를 읽어도 안 좁혀졌다).
   → ②도 DCC1 을 받게 하고, 등록 로직은 여기 한 벌만 둔다. 실패 안내도 여기서 전부 한다
     (문구가 두 벌이 되면 다음 제보 때 또 어느 입구인지 못 가른다).
   forceSlot: [＋]로 칸이 확정된 경우 그 칸. null 이면 예전 규칙(현재 칸 → 없으면 첫 빈 칸)으로 고른다. */
async function importCloneCode(v, p, forceSlot){
  if(!(window.crypto&&crypto.subtle)){toast('이 환경에선 암호화를 쓸 수 없어요 (로컬/앱에서 열어주세요)');return false;}
  /* 🔬 진단 — **이 한 줄이 제보를 못 풀게 하고 있었다.**
     decryptCode() 는 (1) 형식 판별 (2) base64 (3) AES 복호 (4) JSON (5) 얼굴 이미지 로드
     (6) 캔버스 합성 을 순서대로 하는데, 예전엔 그중 **무엇이 실패하든 똑같이**
     "암호가 틀렸거나 코드가 손상됐어요" 라고만 했다. 그래서 "빈 슬롯일 때만 안 된다"는
     제보를 받고도 암호 문제인지 그 뒤 단계 문제인지 가를 방법이 없었다.
     → 이유별로 문구를 나누고 콘솔에 원인을 남긴다. **동작은 그대로다**(실패는 여전히 실패).
     ⚠️ 제보 1의 원인은 결국 여기가 아니라 **입구가 둘이었던 것**이었지만(위 주석), 이 갈래는
       그대로 둔다. 다음에 "코드가 안 먹는다"가 오면 콘솔의 `[복제코드]` 줄이 여전히 첫 단서다. */
  let def=null, _codeErr=null;
  try{ def=await decryptCode(v,p); }
  catch(e){ def=null; _codeErr=e; }
  if(!def){
    const _m = String((_codeErr && _codeErr.message) || '');
    console.warn('[복제코드] 불러오기 실패 —', _m || '(메시지 없음)',
                 '· 코드길이=' + v.length, '· 머리=' + v.slice(0, 12),
                 '· 채워진 슬롯=' + slots.filter(Boolean).length + '/' + CHAR_SLOT_MAX,
                 _codeErr);
    if(_m === 'format') toast('복제 코드 형식이 아니에요 — 파일을 다시 확인해 주세요');
    else if(_m === 'type') toast('캐릭터 복제 코드가 아니에요 (책상·아이템 코드일 수 있어요)');
    else if(/이미지/.test(_m)) toast('코드는 열렸는데 얼굴 그림을 못 읽었어요 — 콘솔의 [복제코드] 줄을 알려주세요');
    else toast('암호가 틀렸거나 코드가 손상됐어요');
    return false;
  }
  // 🐾 동물 캐릭터는 해금 조건(레벨 달성·관리자·숨김 해금)을 갖춰야 불러올 수 있다 —
  //   복제코드로 레벨 제한을 우회해 동물을 얻는 것을 막는다. 함수들은 animal.js에 있어 방어적으로 확인.
  if(def.animal){
    // ★ animal.js는 IIFE로 감싸져 있어 UNLOCK_LEVEL·myLevel 등이 이 파일에서는 보이지 않는다.
    //   그래서 animal.js가 window에 노출한 판정 창구를 쓰고, 없을 때만 같은 기준으로 직접 계산한다.
    //   (typeof 가드만 두면 전부 'undefined'로 떨어져 레벨 0으로 판정 → 모두가 못 불러오게 된다)
    const _ulv = window._animalUnlockLevel || 50;
    const _lv  = (typeof focusLevelMod().getFocusLevel==='function') ? focusLevelMod().getFocusLevel() : 0;
    let _ok;
    if(typeof window._animalUnlocked === 'function') _ok = window._animalUnlocked();
    else{
      let _cheat=false; try{ _cheat = localStorage.getItem('tw.animalCheatUnlock')==='1'; }catch(_){}
      _ok = (_lv >= _ulv) || isAdmin() || _cheat;
    }
    if(!_ok){ toast('🔒 동물 캐릭터는 Lv.'+_ulv+' 달성 후 불러올 수 있어요 (현재 Lv.'+_lv+')'); return false; }
  }
  // ★ 런처7: 라이선스 미발급자가 파츠 포함 캐릭터를 복제 받으면 파츠는 제거하고 저장 (파츠는 라이선스 전용).
  //   원본 파일에는 그대로 두고, 이 유저가 저장하는 슬롯에만 반영.
  /* 🎰 단, **가챠 파츠는 남긴다** — 도감(꾸미기 창 «도감» 탭)과 가챠는 라이선스 없이도 쓸 수 있게 열렸으므로,
       여기서 통째로 지우면 자기가 뽑아서 쓰던 파츠가 코드 한 번 불러왔다고 사라진다.
     ⚠️ savedParts 조회 실패(카탈로그 동기화 직전)는 '남긴다'로 떨어뜨린다 — toggleEquip 의 [안 함]
       분기와 같은 원칙. 못 지운 건 유저가 다시 벗으면 되지만, 지워버린 건 되돌릴 방법이 없다. */
  if(!isPremium() && !isAdmin() && def.equippedParts && Object.keys(def.equippedParts).length){
    let _dropped = false;
    for(const _cat in def.equippedParts){
      const _all  = premiumMod.entriesForCat(def, _cat);
      const _keep = _all.filter(e=>{
        const _r = premiumMod.savedParts().find(p=>p.id===premiumMod.partEntryId(e));
        return !_r || gachaMod().isGachaPart(_r);          // 가챠 · 조회 실패 → 유지
      });
      if(_keep.length !== _all.length) _dropped = true;
      if(_keep.length) def.equippedParts[_cat] = _keep;
      else delete def.equippedParts[_cat];
    }
    if(!Object.keys(def.equippedParts).length){ def.equippedParts = null; def.partXfMemory = null; }
    if(_dropped) toast('꾸미기 파츠는 라이선스 보유자만 사용할 수 있어 제외하고 불러왔어요');
  }
  /* [＋]로 칸이 확정돼 들어왔으면 그 칸이 우선이다 — creatorMode.slot 과 같은 규약
     (저장하는 순간에 각 경로가 제각각 추측하면 다른 칸을 덮어쓴다).
     그 칸이 이미 차 있으면(사이에 다른 경로로 채워진 경우) 예전 규칙으로 떨어뜨린다. */
  const _forced = (typeof forceSlot==='number' && forceSlot>=0 && forceSlot<CHAR_SLOT_MAX && !slots[forceSlot]) ? forceSlot : null;
  const target = (_forced!=null) ? _forced : (slots[curSlot()]?slots.findIndex(s=>!s):curSlot());
  if(target<0){toast('캐릭터가 모두 찼습니다');return false;}
  if(typeof charsMod._charsBoxFull==='function' && charsMod._charsBoxFull()) return false;   // 🧬 보관함 20 문턱
  slots[target]=def;setCurSlot(target);
  try{ if(typeof charsMod._charsOnNew==='function') charsMod._charsOnNew(target); }catch(_){}
  /* 🪑 [제보 2] 공유 코드에 실려 온 전용 책상·아이템을 **저장 전에** 접는다. 받는 쪽(decryptCode)에는
     라이선스 검사가 없어서 deskCatalogId·deskItems 가 그대로 들어온다 — 친구에게 코드를 받은
     미보유자가 전용 책상을 «착용한 것으로 전파되던» 가장 유력한 경로였다.
     ★ saveSlots 앞이라 접힌 상태가 그대로 저장된다. 라이선스를 나중에 등록하면 되돌아온다. */
  try{ if(typeof premiumMod.pruneUnownedLicenseAssets === 'function') premiumMod.pruneUnownedLicenseAssets(); }
  catch(e){ console.warn('[라이선스] 코드 불러오기 후 정리 실패', e); }
  saveSlots();saveCurSlot();renderLauncher();toast('불러왔어요');
  return true;
}
document.getElementById('codeOk').onclick=async()=>{
  const v=document.getElementById('codeText').value.trim();const p=document.getElementById('codePass').value;
  if(!v){toast('코드를 입력해 주세요');return;} if(!p){toast('암호를 입력해 주세요');return;}
  // 런처 입구는 칸을 확정하지 않는다(예전 규칙 그대로) → forceSlot 없음
  if(await importCloneCode(v,p,null)) document.getElementById('codeOverlay').classList.remove('on');
};
document.getElementById('codeFileBtn').onclick=()=>document.getElementById('codeFileInput').click();
document.getElementById('codeFileInput').addEventListener('change', e=>{
  const f=e.target.files[0]; if(!f) return;
  const reader=new FileReader();
  reader.onload=()=>{
    const _txt = String(reader.result||'').trim();
    document.getElementById('codeText').value = _txt;
    /* 🔬 진단 — 파일이 잘려 오거나 다른 파일을 고른 경우를 여기서 가른다.
       DCC1. 로 시작하지 않으면 암호 문제가 아니라 **파일 문제**다. */
    console.log('[복제코드] 파일 읽음 — 이름='+f.name+' 크기='+f.size+
                ' 글자수='+_txt.length+' 머리='+_txt.slice(0,12));
    if(!/^DCC1\./.test(_txt)) toast('파일을 불러왔지만 복제 코드 형식이 아니에요 — 파일이 맞는지 확인해 주세요');
    else toast('파일을 불러왔어요');
  };
  reader.onerror=()=>toast('파일을 읽지 못했어요');
  reader.readAsText(f);
  e.target.value='';
});

/* --- 내보내기 (암호 정하고 코드 생성) --- */
let exportDef=null;
document.getElementById('lcExport').onclick=()=>{closeGearMenu();exportDef=slots[curSlot()];if(!exportDef)return;
  document.getElementById('exportPass').value='';document.getElementById('exportText').value='';document.getElementById('exportOverlay').classList.add('on');};
document.getElementById('exportGen').onclick=async()=>{const p=document.getElementById('exportPass').value;
  if(!p){toast('암호를 정해주세요');return;} if(!exportDef)return;
  if(!(window.crypto&&crypto.subtle)){toast('이 환경에선 암호화를 쓸 수 없어요 (로컬/앱에서 열어주세요)');return;}
  try{const code=await encryptCode(exportDef,p);document.getElementById('exportText').value=code;toast('코드가 생성됐어요');}
  catch(e){toast('암호화 실패');}};
document.getElementById('exportCopy').onclick=async()=>{const v=document.getElementById('exportText').value;if(!v){toast('먼저 코드를 생성하세요');return;}
  try{await navigator.clipboard.writeText(v);toast('복사했어요');}catch(e){document.getElementById('exportText').select();toast('Ctrl+C로 복사해주세요');}};
document.getElementById('exportSave').onclick=()=>{
  const v=document.getElementById('exportText').value; if(!v){toast('먼저 코드를 생성하세요');return;}
  const blob=new Blob([v],{type:'text/plain'});
  const a=document.createElement('a'); a.href=URL.createObjectURL(blob); a.download='복제코드.txt';
  document.body.appendChild(a); a.click(); a.remove();
  toast('파일로 저장했어요 — 채팅보다 파일 전달을 추천해요');
};
document.getElementById('exportCancel').onclick=()=>document.getElementById('exportOverlay').classList.remove('on');

/* 풀 GLB 암호화 · 불러오기 버튼(관리자)은 admin/admin-asset.js 로 옮겼다 — 만드는 줄은 «책상·아이템 코드: 생성(판매자)» 자리. 위 loadEncryptedGlbAsSeat 는 그대로. */

return {
  downloadBlob,
  importCloneCode,
  loadEncryptedGlbAsSeat,
  openCodeModal,
};
}

const api = { createCharCode };
if(typeof window !== 'undefined') window.TwCharCode = api;
if(typeof module !== 'undefined' && module.exports) module.exports = api;
})();
