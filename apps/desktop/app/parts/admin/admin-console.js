/* admin-console.js — 🧹 관리자 콘솔 도구 (F12 콘솔에서 부르는 함수 일곱)
   app.js 의 «🧹 관리자 콘솔 도구» 구역을 그대로 옮긴 관리자 모듈이다(관리자 코드 admin 폴더 2번 · 앱 FSD 순서표 12번 — docs/APP_FSD_MAP.md).
   동작은 옮기기 전과 같다.

   ★ 아래 본문은 app.js 에 있던 글 그대로다 — 들여쓰기도 바꾸지 않았다(옮기기 전 줄과 견주어 볼 수 있게).
     바뀐 것은 네 줄뿐이다 — savedParts · savedDesks · savedItems → savedParts() · savedDesks() · savedItems().
     app.js 가 카탈로그를 받을 때마다 다시 대입하는 let 이고 이 모듈을 만드는 줄보다 뒤에 선언되므로 값이 아니라 읽는 함수로 받는다.
   ★ 밖에서 부르는 이름은 예전처럼 window 에 건 콘솔 함수 일곱이다 — previewCatalogCleanup · runCatalogCleanup ·
     migrateCatalogGlbToStorage · analyzeCatalog · cleanupGhostRooms · reclaimInvitesSince · migrateCatalogThumbsToStorage.
     관리자가 F12 콘솔에서 부를 때만 돈다(만들 때는 window 에 걸기만 한다).
   ★ createAdminConsole 은 app.js 의 원래 자리(🧹 관리자 콘솔 도구 머리 아래)에서 부른다.
   ⚠️ window · firebaseAPI · console 은 예전처럼 전역 이름으로 쓴다(이 파일은 app.js 앞에 싣는 classic script).
   ⚠️ 전역 이름은 TwAdminConsole — 크로미움 내장 전역과 겹치지 않게 Tw 접두사(#103).
   검사: checks/sim-admin-console.js — 만들 때 콘솔 함수 일곱 · 읽는 함수(다시 대입돼도 지금 목록) · 미리보기 / 실행 갈래 · app.js 연결 · html 순서. */
(function(){

function createAdminConsole(deps){
const savedParts = deps.savedParts;   // 읽는 함수 — app.js 가 다시 대입하는 let(카탈로그 파츠)
const savedDesks = deps.savedDesks;   // 읽는 함수 — 책상
const savedItems = deps.savedItems;   // 읽는 함수 — 아이템
/* 🧹 Storage 이관 뒷정리 콘솔 도구 — DB에 남은 base64 glb만 삭제해 onValue 다운로드 비용을 줄인다.
   1) previewCatalogCleanup() 으로 먼저 몇 개/몇 MB 지울지 확인(아무것도 안 지움)
   2) 결과가 맞으면 runCatalogCleanup() 실행 → 실제 삭제. glbUrl 없는 항목은 자동으로 건너뜀(안전). */
window.previewCatalogCleanup = async function(){
  if(!(window.firebaseAPI && firebaseAPI.cleanupCatalogBase64)){ console.warn('cleanup API 없음 — 앱 새로고침 필요'); return; }
  const r = await firebaseAPI.cleanupCatalogBase64(true);
  console.log('🧹 [미리보기] 삭제 예정:', r.willDelete, '개 /', r.mb, 'MB');
  console.log('   건너뜀(Storage 미이관, 안전 보존):', r.skipNoUrl, '개');
  console.log('   이미 깨끗(base64 없음):', r.alreadyClean, '개');
  console.log('   종류별:', JSON.stringify(r.byKind));
  console.log(r.skipNoUrl>0 ? '⚠️ 미이관 항목이 있어요 — 먼저 migrateCatalogGlbToStorage() 권장' : '✅ 전부 이관 완료 상태 — runCatalogCleanup() 실행해도 안전');
  return r;
};
window.runCatalogCleanup = async function(){
  if(!(window.firebaseAPI && firebaseAPI.cleanupCatalogBase64)){ console.warn('cleanup API 없음 — 앱 새로고침 필요'); return; }
  const r = await firebaseAPI.cleanupCatalogBase64(false);
  console.log('🧹 [완료] 삭제됨:', r.willDelete, '개 /', r.mb, 'MB DB에서 제거. 건너뜀:', r.skipNoUrl, '개');
  console.log('   이제 onValue가 인덱스만 나릅니다. 앱을 새로고침하면 반영됩니다.');
  return r;
};

// ★ 관리자 전용 마이그레이션: 기존 catalog/*의 base64 glb를 Storage로 옮기고 DB엔 glbUrl만 남김.
//   콘솔(F12)에서 `migrateCatalogGlbToStorage()` 실행 — 한 번만 하면 되고, 이후 신규 등록은 자동으로 Storage 사용.
//   진행 상황을 콘솔에 찍고, 성공/실패 카운트 반환. Firebase 규칙에 이 유저가 write 권한이 있어야 함(catalog/*).
window.migrateCatalogGlbToStorage = async function(){
  const results = { parts:0, desks:0, items:0, skipped:0, failed:0 };
  if(!(window.firebaseAPI && firebaseAPI.publishPart)){ console.warn('firebaseAPI 없음'); return results; }
  const kinds = [
    { name:'parts', publish:'publishPart' },
    { name:'desks', publish:'publishDesk' },
    { name:'items', publish:'publishItem' },
  ];
  for(const k of kinds){
    console.log('[마이그레이션] '+k.name+' 시작...');
    // 실시간 캐시로부터 (subscribeCatalog가 이미 앱 시작 시 로드해둠)
    const list = (k.name==='parts' ? savedParts() : (k.name==='desks' ? savedDesks() : savedItems())).filter(x=>x.fromCatalog);
    for(const rec of list){
      if(rec.glbUrl && !rec.glb){ results.skipped++; continue; }   // 이미 Storage에 있음
      if(!rec.glb){ results.failed++; console.warn('  '+rec.id+': glb/glbUrl 둘 다 없음'); continue; }
      try{
        // rec 자체를 그대로 publishXxx에 넘김 → _uploadGlbIfNeeded가 Storage 업로드 후 glbUrl 저장
        const data = { ...rec }; delete data.id; delete data.fromCatalog;
        await firebaseAPI[k.publish](rec.id, data);
        results[k.name]++;
        console.log('  '+rec.id+' → Storage 이관 완료');
      }catch(e){
        results.failed++;
        console.warn('  '+rec.id+' 실패:', e);
      }
    }
  }
  console.log('[마이그레이션] 완료:', results);
  return results;
};

/* 🎟️ 관리자 전용: 특정 날짜 이후 가입자의 초대권 회수 (옛 버전으로 가입해 2장 받은 계정 정리).
   콘솔(F12)에서 사용 — 먼저 미리보기로 대상을 확인하고, 이상 없으면 실행:
     reclaimInvitesSince('2026-07-18')          ← 미리보기(아무것도 바뀌지 않음)
     reclaimInvitesSince('2026-07-18', 2, true) ← 실제 회수(2장씩 차감, 0 밑으로는 안 내려감)
     reclaimInvitesSince('2026-07-18', 2, true, true) ← 음수 허용(1장 쓴 사람은 -1이 됨)
   날짜는 그 날 00:00(현지 시각)부터로 계산됨. */
/* 🔍 카탈로그 용량 진단 — F12 콘솔에서 `analyzeCatalog()`
   DB에 남아있는 큰 문자열(특히 base64)을 찾아준다. 그게 곧 모든 사용자의 다운로드 비용. */
window.analyzeCatalog = async function(){
  if(!(window.firebaseAPI && firebaseAPI.analyzeCatalog)){ console.warn('firebaseAPI 없음'); return null; }
  const r = await firebaseAPI.analyzeCatalog();
  for(const kind in r){
    const k = r[kind];
    console.log('━━━ ' + kind + ' : ' + k.count + '개, 합계 ' + k.totalKB + 'KB, base64 필드 ' + k.base64Fields + '개');
    k.top.forEach(t=>console.log('   ' + t.kb + 'KB  ' + t.id + ' ' + (t.name||'') + (t.heavy.length ? '  ← ' + t.heavy.join(', ') : '')));
  }
  const totalKB = Object.values(r).reduce((s,k)=>s+k.totalKB,0);
  console.log('▶ 카탈로그 총합: ' + Math.round(totalKB) + 'KB — 앱을 켜는 모든 사용자가 이만큼 내려받습니다');
  return r;
};

/* 🧹 유령 방 청소 — 관리자 F12 콘솔에서:
     cleanupGhostRooms()      ← 미리보기(개수와 코드 나열)
     cleanupGhostRooms(true)  ← 실제 삭제 */
window.cleanupGhostRooms = async function(apply){
  if(!(window.firebaseAPI && firebaseAPI.cleanupGhostRooms)){ console.warn('firebaseAPI 없음'); return null; }
  const r = await firebaseAPI.cleanupGhostRooms(!apply);
  if(!r || !r.ok){ console.warn('실패'); return r; }
  if(r.dryRun){
    console.log('[유령 방 · 미리보기] ' + r.count + '개 발견 (아직 삭제 안 함)');
    r.ghosts.forEach(c=>console.log('  ' + c));
    if(r.count) console.log('삭제하려면: cleanupGhostRooms(true)');
  } else {
    console.log('[유령 방 · 완료] ' + r.removed + '개 삭제, 실패 ' + r.failed);
  }
  return r;
};

window.reclaimInvitesSince = async function(dateStr, amount, apply, allowNegative){
  if(!(window.firebaseAPI && firebaseAPI.reclaimInvitesSince)){ console.warn('firebaseAPI 없음'); return null; }
  const n = (typeof amount === 'number') ? amount : 2;
  const since = new Date(String(dateStr) + 'T00:00:00');
  if(isNaN(since.getTime())){ console.warn('날짜 형식이 올바르지 않아요. 예: 2026-07-18'); return null; }
  const dry = !apply;
  const r = await firebaseAPI.reclaimInvitesSince(since.getTime(), n, dry, !!allowNegative);
  if(!r || !r.ok){ console.warn('실패:', r); return r; }
  if(dry){
    console.log('[초대권 회수 · 미리보기] ' + dateStr + ' 이후 가입자 중 대상 ' + r.count + '명 (실제로는 아직 바뀌지 않았어요)');
    r.targets.forEach(t=>console.log('  ' + t.uid + ' | 가입 ' + new Date(t.joinedAt).toLocaleString() + ' | ' + t.before + '장 → ' + t.after + '장'));
    console.log('실행하려면: reclaimInvitesSince(\'' + dateStr + '\', ' + n + ', true)');
  }else{
    console.log('[초대권 회수 · 완료] ' + r.changed + '명 처리, 실패 ' + r.failed + '명');
  }
  return r;
};

/* 💰 관리자 전용 마이그레이션: 카탈로그의 base64 도트 썸네일을 Storage로 옮김.
   예전엔 썸네일 PNG가 Realtime DB 안에 통째로 들어가서, 모든 사용자가 앱을 켤 때마다
   전체 썸네일을 다시 내려받았음(DB 다운로드 비용의 대부분). 옮기고 나면 DB엔 짧은 URL만 남는다.
   콘솔(F12)에서 `migrateCatalogThumbsToStorage()` 한 번만 실행하면 됨. */
window.migrateCatalogThumbsToStorage = async function(){
  const results = { parts:0, desks:0, items:0, skipped:0, failed:0 };
  if(!(window.firebaseAPI && firebaseAPI.publishPart)){ console.warn('firebaseAPI 없음'); return results; }
  const kinds = [
    { name:'parts', publish:'publishPart', list:()=>savedParts() },
    { name:'desks', publish:'publishDesk', list:()=>savedDesks() },
    { name:'items', publish:'publishItem', list:()=>savedItems() },
  ];
  for(const k of kinds){
    console.log('[썸네일 이관] '+k.name+' 시작...');
    let list = [];
    try{ list = (k.list()||[]).filter(x=>x && x.fromCatalog); }catch(_){ list = []; }
    for(const rec of list){
      if(rec.thumbUrl){ results.skipped++; continue; }                      // 이미 이관됨
      if(!rec.thumbnail || !String(rec.thumbnail).startsWith('data:')){ results.skipped++; continue; }
      try{
        const data = { ...rec }; delete data.id; delete data.fromCatalog;
        await firebaseAPI[k.publish](rec.id, data);   // publishXxx 안에서 썸네일이 Storage로 업로드됨
        results[k.name]++;
        console.log('  '+rec.id+' → 썸네일 Storage 이관 완료');
      }catch(e){
        results.failed++;
        console.warn('  '+rec.id+' 실패:', e);
      }
    }
  }
  console.log('[썸네일 이관] 완료:', results);
  return results;
};

return {};   // 밖에서 부르는 이름은 window 의 콘솔 함수 — 만들 때 건다
}

const api = { createAdminConsole };
if(typeof window !== 'undefined') window.TwAdminConsole = api;
if(typeof module !== 'undefined' && module.exports) module.exports = api;
})();
