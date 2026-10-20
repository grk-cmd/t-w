/* admin-asset.js — 📦 책상·아이템 코드 만들기 · 🎁 커미션 캐릭터 등록 · 🔐 암호화 GLB 불러오기 (관리자 — 판매 · 커미션용 코드를 굽는 창)
   app.js 의 세 덩이(«책상·아이템 코드: 생성(판매자)» · «커미션 캐릭터 코드: 생성(관리자만)» · «풀 GLB: 암호화 / 불러오기»)를 그대로 옮긴
   관리자 모듈이다(관리자 코드 admin 폴더 6번 — docs/APP_FSD_MAP.md). 동작은 옮기기 전과 같다.
   ★ 아래 본문은 app.js 에 있던 글 그대로다(세 덩이를 원래 차례대로 · 사이에 빈 줄 하나). 바뀐 줄은 2줄 —
     MAX_GLB_BYTES · MAX_COMMISSION_BYTES 를 이름() 으로 읽는다. 둘 다 이 모듈을 만드는 줄보다 뒤에 선언되는 const 라(TDZ)
     값이 아니라 읽는 함수로 받는다. 받는 쪽 코드(📦 코드로 추가하기 · 🎁 커미션 코드 입력 · 풀 GLB 암호화 함수들)는 app.js 에 남겼다.
   ★ 셋째 덩이의 «암호화(.dcc) 만들기» 창(glbEncOverlay)은 여는 버튼이 예전에 걷혀 지금은 열 수 없다 — 옮기기만 하고 고치지 않았다(손볼 일은 따로).
   ★ app.js 함수 열은 화살표로 받는다(나중에 선언된 함수도 부를 때 찾는다). 밖에서 부르는 이름은 없다 — 버튼 연결을 만들 때 건다.
   ⚠️ document · window · crypto · Blob · URL · FileReader 는 예전처럼 전역 이름으로 쓴다(이 파일은 app.js 앞에 싣는 classic script).
   ⚠️ 전역 이름은 TwAdminAsset — 크로미움 내장 전역과 겹치지 않게 Tw 접두사(#103).
   검사: checks/sim-admin-asset.js */
(function(){

function createAdminAsset(deps){
const toast = deps.toast;
const encryptAssetCode = deps.encryptAssetCode;
const wrapAsset = deps.wrapAsset;
const _b64 = deps._b64;
const encryptCommission = deps.encryptCommission;
const unpackCommissionZip = deps.unpackCommissionZip;
const encryptBytes = deps.encryptBytes;
const decryptBytes = deps.decryptBytes;
const downloadBlob = deps.downloadBlob;
const loadEncryptedGlbAsSeat = deps.loadEncryptedGlbAsSeat;
const MAX_GLB_BYTES = deps.maxGlbBytes;               // 읽는 함수 — GLB 상한(app.js 가 뒤에서 선언하는 const)
const MAX_COMMISSION_BYTES = deps.maxCommissionBytes; // 읽는 함수 — 커미션 zip 상한(뒤에서 선언하는 const)
const assetGenOverlay=document.getElementById('assetGenOverlay');
document.getElementById('lcAssetGen').onclick=()=>{ const o=document.getElementById('assetGenOut'); o.style.display='none'; o.value=''; document.getElementById('assetGenCopy').style.display='none'; document.getElementById('assetGenSave').style.display='none'; assetGenOverlay.classList.add('on'); };
document.getElementById('assetGenCancel').onclick=()=>assetGenOverlay.classList.remove('on');
document.getElementById('assetGenGo').onclick=async()=>{
  if(!(window.crypto&&crypto.subtle)){toast('이 환경에선 암호화를 쓸 수 없어요 (로컬/앱에서 열어주세요)');return;}
  const f=document.getElementById('assetGenFile').files[0], pass=document.getElementById('assetGenPass').value;
  const kind=document.getElementById('assetGenKind').value, name=(document.getElementById('assetGenName').value.trim())||(kind==='desk'?'커스텀 책상':'커스텀 아이템');
  const icon=document.getElementById('assetGenIcon').value;
  if(!f){toast('GLB 파일을 선택해 주세요');return;} if(!pass){toast('비밀번호를 입력해 주세요');return;}
  if(f.size>MAX_GLB_BYTES()){toast('GLB 파일이 1MB를 넘어요 ('+(f.size/1024/1024).toFixed(2)+'MB)');return;}
  try{ const glb=await f.arrayBuffer(); const code=await encryptAssetCode(wrapAsset(name,icon,glb),pass,kind);
    const o=document.getElementById('assetGenOut'); o.value=code; o.style.display='block'; document.getElementById('assetGenCopy').style.display='block'; document.getElementById('assetGenSave').style.display='block'; toast('코드를 생성했어요');
  }catch(e){ toast('생성 실패: '+(e.message||e)); } };
document.getElementById('assetGenCopy').onclick=()=>{ const o=document.getElementById('assetGenOut'); o.select(); try{document.execCommand('copy');toast('복사했어요');}catch(e){} };
document.getElementById('assetGenSave').onclick=()=>{
  const v=document.getElementById('assetGenOut').value; if(!v){toast('먼저 코드를 생성하세요');return;}
  const kind=document.getElementById('assetGenKind').value;
  const nm=(document.getElementById('assetGenName').value.trim())||(kind==='desk'?'책상':'아이템');
  const blob=new Blob([v],{type:'text/plain'});
  const a=document.createElement('a'); a.href=URL.createObjectURL(blob); a.download=nm+'_코드.txt';
  document.body.appendChild(a); a.click(); a.remove();
  toast('파일로 저장했어요 — 채팅보다 파일 전달을 추천해요');
};

const commGenOverlay=document.getElementById('commGenOverlay');
document.getElementById('lcCommissionGen').onclick=()=>{
  const o=document.getElementById('commGenOut'); o.style.display='none'; o.value=''; document.getElementById('commGenCopy').style.display='none';
  document.getElementById('commGenSave').style.display='none';
  document.getElementById('commGenName').value=''; document.getElementById('commGenPass').value='';
  const fi=document.getElementById('commGenFile'); fi.value='';
  commGenOverlay.classList.add('on');
};
document.getElementById('commGenCancel').onclick=()=>commGenOverlay.classList.remove('on');
document.getElementById('commGenGo').onclick=async()=>{
  if(!(window.crypto&&crypto.subtle)){toast('이 환경에선 암호화를 쓸 수 없어요 (로컬/앱에서 열어주세요)');return;}
  const f=document.getElementById('commGenFile').files[0], pass=document.getElementById('commGenPass').value;
  const name=(document.getElementById('commGenName').value.trim())||'커미션 캐릭터';
  if(!f){toast('zip 파일을 선택해 주세요');return;}
  if(!pass){toast('비밀번호를 입력해 주세요');return;}
  if(f.size>MAX_COMMISSION_BYTES()){toast('zip 파일이 2MB를 넘어요 ('+(f.size/1024/1024).toFixed(2)+'MB)');return;}
  try{
    const unpacked=await unpackCommissionZip(f);
    const payload={
      t:'comm',                          // 페이로드 타입
      name: name,
      glb: _b64(unpacked.glbBuf),        // base64 GLB
      face: unpacked.faceDataUrl,        // 데이터 URL (512 PNG)
      blink: unpacked.blinkDataUrl
    };
    const code=await encryptCommission(payload, pass);
    const o=document.getElementById('commGenOut'); o.value=code; o.style.display='block';
    document.getElementById('commGenCopy').style.display='block';
    document.getElementById('commGenSave').style.display='block';
    toast('커미션 캐릭터 코드를 생성했어요 ('+Math.round(code.length/1024)+' KB)');
  }catch(e){ toast('생성 실패: '+(e.message||e)); }
};
document.getElementById('commGenCopy').onclick=()=>{ const o=document.getElementById('commGenOut'); o.select(); try{document.execCommand('copy');toast('복사했어요');}catch(e){} };
document.getElementById('commGenSave').onclick=()=>{
  const v=document.getElementById('commGenOut').value; if(!v){toast('먼저 코드를 생성하세요');return;}
  const nm=(document.getElementById('commGenName').value.trim())||'커미션캐릭터';
  const blob=new Blob([v],{type:'text/plain'});
  const a=document.createElement('a'); a.href=URL.createObjectURL(blob); a.download=nm+'_코드.txt';
  document.body.appendChild(a); a.click(); a.remove();
  toast('파일로 저장했어요 — 채팅보다 파일 전달을 추천해요');
};

/* --- 풀 GLB: 암호화 / 불러오기 --- */
// ★ '기존 캐릭터 수정' 버튼 제거됨 — 핸들러도 함께 제거(존재하지 않는 요소 참조 시 크래시 방지).
//   glbEncOverlay 자체는 다른 진입점(lcGlbLoad 등)에서 계속 쓰이므로 그대로 둔다.
document.getElementById('glbEncCancel').onclick=()=>document.getElementById('glbEncOverlay').classList.remove('on');
document.getElementById('glbEncGo').onclick=async()=>{const fi=document.getElementById('glbEncFile').files[0];const p=document.getElementById('glbEncPass').value;
  if(!fi){toast('GLB 파일을 선택하세요');return;} if(!p){toast('비밀번호를 입력하세요');return;}
  if(!(window.crypto&&crypto.subtle)){toast('이 환경에선 암호화를 쓸 수 없어요 (로컬/앱에서 열어주세요)');return;}
  try{const buf=await fi.arrayBuffer();const enc=await encryptBytes(buf,p);downloadBlob(enc,fi.name.replace(/\.glb$/i,'')+'.dcc');
    toast('암호화 파일(.dcc)을 저장했어요');document.getElementById('glbEncOverlay').classList.remove('on');}
  catch(e){toast('암호화 실패');}};
document.getElementById('lcGlbLoad').onclick=()=>{document.getElementById('glbLoadFile').value='';document.getElementById('glbLoadPass').value='';document.getElementById('glbLoadOverlay').classList.add('on');};
document.getElementById('glbLoadCancel').onclick=()=>document.getElementById('glbLoadOverlay').classList.remove('on');
document.getElementById('glbLoadGo').onclick=async()=>{const fi=document.getElementById('glbLoadFile').files[0];const p=document.getElementById('glbLoadPass').value;
  if(!fi){toast('파일을 선택하세요');return;}
  const nm=fi.name.toLowerCase();
  try{const buf=await fi.arrayBuffer();let glbBuf=buf;
    if(nm.endsWith('.dcc')){ if(!p){toast('비밀번호를 입력하세요');return;}
      if(!(window.crypto&&crypto.subtle)){toast('이 환경에선 복호화를 쓸 수 없어요');return;} glbBuf=await decryptBytes(buf,p); }
    document.getElementById('glbLoadOverlay').classList.remove('on');
    loadEncryptedGlbAsSeat(glbBuf,fi.name.replace(/\.dcc$/i,'')+'.glb');toast('불러왔어요');}
  catch(e){toast('비밀번호가 틀렸거나 파일이 손상됐어요');}};

return {};   // 밖에서 부르는 이름 없음 — 전부 만들 때 건다
}

const api = { createAdminAsset };
if(typeof window !== 'undefined') window.TwAdminAsset = api;
if(typeof module !== 'undefined' && module.exports) module.exports = api;
})();
