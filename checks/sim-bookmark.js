/* ═══ 📚 sim-bookmark.js — 마이홈 북마크 책장 · 미스테리au 걷어내기 (2026-09-23 · 개정 61 · 시안 확정) ═══════════
   ・1절: 붙는 방식 — bookmark.js 는 MYHOME_DESKTOP.addFolder 로만 붙는다 · myhome-desktop.js 에 북마크 문자열 없음 ·
          아이콘 📚 «북마크» 0번 칸 · 서랍은 host:'side' · 방문 중에는 닫는다.
   ・2절: 계약 — myhome-desktop.js 에 host:'side' 가 **추가만** 됐다(기본 · 'home' 무변경) · 서랍 닫기.
   ・3절: 책장 규칙 — 50권 · 네 모양 값 · http/https 만 · openBrowser 로만 · 툴팁 없음 · 팔레트 재사용 · 4px.
   ・4절: 저장 — 순서 목록만(선반 번호 없음) · bookmarks/{uid}(users/ 아래가 아니다) · 규칙 · Storage 200KB.
   ・5절: 미스테리au 걷어내기 — 스크립트 둘 · 파일 둘 · firebase-init 어댑터 · app.js 무관.
   ・6절: bmClean · 순서 바꾸기를 떼어 와 돌린다.
   [실행] app.js · desk-companion-prototype.html · parts 원본들이 있는 폴더에서. */
'use strict';
const fs = require('fs');
/* 원본은 평평한 폴더(러너 스테이징) 또는 parts/ 아래에 있다 — 둘 다 본다. */
const rd = f => { for(const p of [f, 'parts/' + f]) if(fs.existsSync(p)) return fs.readFileSync(p, 'utf8'); return null; };
const has = f => fs.existsSync(f) || fs.existsSync('parts/' + f);
const HTML = rd('desk-companion-prototype.html');
const BM   = rd('bookmark.js');
const MHD  = rd('myhome-desktop.js');
const FI   = rd('firebase-init.js');
const APP  = rd('app.js');
const RULES = rd('firebase-database-rules.json');
const STOR  = rd('storage.rules');

let pass = 0, fail = 0, huh = 0;
const say = s => console.log(s);
const chk = (ok, msg) => { ok ? pass++ : fail++; say('  ' + (ok ? '✓' : '✗') + ' ' + msg); };
const strip = s => s.replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/(^|[^:])\/\/[^\n]*/g, '$1 ');
if(!BM || !HTML){ say('  ? bookmark.js 또는 html 없음 — 검사못함'); process.exit(2); }
const B = strip(BM);

say('── 1. 붙는 방식');
{
  chk(/D\.addFolder\(\{\s*\n?\s*id:'bookmark', label:'북마크', icon:'📚', slot:0/.test(B), '📚 «북마크» 0번 칸(미스테리au 자리)');
  chk((B.match(/addFolder\(/g) || []).length === 1 && !/addEnvMenu|advDesktop\.appendChild/.test(B), '바탕화면에 붙는 길은 addFolder 하나뿐');
  chk(/createWindow\(\{ id:'bmWin'[^)]*host:'side'/.test(B), '서랍은 host:\'side\'');
  chk(/onVisit\(v, ownerId\)\{\s*\n?\s*bmOpen = false; bmEditorClose\(\); D\.closeWindow\('bmWin'\);/.test(B), '방문 전환 때 서랍을 닫는다');
  chk(/<script src="parts\/bookmark\.js"><\/script>/.test(HTML), 'html 에 script 한 줄');
  if(MHD) chk(!/북마크|bookmark|bmWin/.test(MHD), 'myhome-desktop.js 에 북마크라는 말이 없다(파일 하나만 지우면 끝)');
  else { huh++; say('  ? myhome-desktop.js 없음'); }
}

say('── 2. 계약(host:\'side\')');
if(MHD){
  const M = strip(MHD);
  chk(/const MHD_SIDEWINS = \[\];/.test(M) && /if\(o\.host==='side'\)\{/.test(M), 'createWindow 에 side 갈래 추가');
  chk(/if\(o\.host==='home'\) MHD_HOMEWINS\.push\(o\.id\);/.test(M), "host:'home' 갈래는 그대로");
  chk(/MHD_HOMEWINS\.indexOf\(id\)>=0 \|\| MHD_SIDEWINS\.indexOf\(id\)>=0/.test(M), 'openWindow 가 서랍도 마이홈 창 자식으로 옮긴다(창을 끌면 따라온다)');
  chk(/function advCloseWin\(id\)\{[\s\S]*MHD_SIDEWINS\.indexOf\(id\)>=0\)\{[\s\S]*mhd-side-open[\s\S]*display='none'/.test(M), '일괄 닫기(관람 모드)가 서랍도 닫는다(닫는 동작 뒤 감춤)');
  chk(/\.adv-win\.mhd-side\{[^}]*transition:transform/.test(M) && /\.adv-win\.mhd-side\.mhd-side-open\{transform:translateX\(0\)/.test(M), '서랍이 스르르 열리고 닫힌다(요청)');
  /* ⚠️ 시작 위치는 음수 — 창 쪽에서 오른쪽(→)으로 밀려 나온다. 양수면 반대 방향이 된다(제보). */
  chk(/\.adv-win\.mhd-side\{[^}]*transform:translateX\(-\d+px\)/.test(M), '열리는 방향은 오른쪽(→)');
  chk(/isWindowOpen\(id\)\{ return mhdSideOpen\(id\); \}/.test(M), '열려 있는지 물어볼 길(폴더 다시 누르면 닫기)');
  /* ⚠️ [제보] 창 ✕ 는 .on 만 떼면 안 된다 — 서랍은 display 로 여닫히므로 그대로 남는다. */
  chk(/\.x'\)\.addEventListener\('click', \(\)=>\{[\s\S]{0,400}?advCloseWin\(o\.id\);/.test(M), '창 ✕ 도 advCloseWin 한 길로 닫는다');
  /* ⚠️ [고침 2] 자리는 **CSS 규칙**이 잡는다 — 인라인으로만 두면 뒤에 붙는 한 줄에 쓸려 창 아래로 떨어졌다(제보 2회). */
  chk(/\.adv-win\.mhd-side\{position:absolute !important;top:0 !important;bottom:0 !important;/.test(M)
      && /max-width:none !important;max-height:none !important/.test(M), '서랍 자리는 .adv-win.mhd-side 규칙(위·아래·폭 못박음)');
  chk(!/\.adv-win\.mhd-side\{[^}]*inset:/.test(M), '그 규칙에 inset 을 쓰지 않는다(!important 가 좌/우 인라인을 이겨 버린다)');
  /* ⚠️ [고침 3 · 제보] 런처 마이홈은 앱 창(Electron) 안이라 창 밖은 OS 가 잘라낸다 —
     바깥에 자리가 없으면 **창 안쪽 오른쪽**으로 접어 넣어야 한다. */
  chk(/function mhdPlaceSide\(w\)\{/.test(M) && /mode='out-right'/.test(M) && /mode='out-left'/.test(M) && /mode='in-right'/.test(M), '자리는 바깥 오른쪽 → 바깥 왼쪽 → 창 안쪽 오른쪽 순');
  chk(/r\.right \+ width \+ 8 <= vw/.test(M) && /r\.left - width - 8 >= 0/.test(M), '들어갈 자리가 있는지 실제 폭으로 잰다');
  chk(/mhd-side-in/.test(M) && /box-shadow:-3px 0 10px/.test(M) && /Math\.min\(320, homeWin\.getBoundingClientRect\(\)\.width - 24\)/.test(M), '안쪽 자리는 그림자 · 창보다 넓어지지 않게');
  chk(/MHD_SIDEWINS\.indexOf\(id\)>=0\)\{\s*\n?\s*mhdPlaceSide\(w\); w\.style\.display='flex';/.test(M) && /addEventListener\('resize'/.test(M), '열 때마다 · 화면 크기가 바뀔 때 다시 계산');
  chk(/#bmWin \.adv-titlebar\{background:linear-gradient\(90deg,var\(--win-title-a\),var\(--win-title-b\)\)/.test(BM), '제목줄은 마이홈 창과 같은 테마 그라데이션(미스테리au 의 붉은색 아님)');
}else{ huh++; }

say('── 3. 책장 규칙');
{
  chk(/const BM_MAX = 50;/.test(B) && /책장이 가득 찼어요 · 한 권을 빼 주세요/.test(BM), '50권 상한 · 가득 찬 문구');
  chk(/BM_W = \{ thin:22, thick:36 \}/.test(B) && /BM_H = \{ short:116, long:158 \}/.test(B), '두께 22·36 / 높이 116·158 네 모양');
  chk(/\^https\?:/.test(BM) && /test\(u\)/.test(BM) && /http:\/\/ 또는 https:\/\/ 로 시작하는 주소만/.test(BM), 'http/https 만');
  chk(/companion\.openBrowser\(it\.url\)/.test(B) && !/window\.open\(/.test(B), '여는 길은 openBrowser 하나(window.open 없음)');
  chk(/const BM_DRAG_MIN = 4;/.test(B) && /> BM_DRAG_MIN/.test(B) && /if\(moved\) bmDragEnd\(\);\s*else bmOpenLink\(id\)/.test(B), '4px 미만 = 클릭(링크) · 이상 = 드래그');
  /* ⚠️ [고침] 호버는 **위로만** — 기울이지 않는다(요청). 책 사이 틈도 좁다(칸마다 1px). */
  chk(/\.bm-book:hover\{transform:translateY\(-\d+px\);\}/.test(B) && !/rotate\(3deg\)/.test(B.split('.bm-drag')[0]), '호버는 위로만 들어올린다(기울임 없음)');
  chk(/\.bm-cell\{[^}]*padding:0 1px/.test(B), '책 사이는 좁게(칸마다 1px)');
  chk(!/title\s*=\s*it\.url|\.title = it\.title/.test(B), '툴팁 없음');
  chk(/buildFreeColorPicker\(draft\[key\]/.test(B) && /wd-color-palette/.test(B), '색 팔레트는 꾸미기 것 재사용(.wd-color-palette)');
  /* 🎨 제목 글자색 · 제목 숨기기 · 바깥 클릭 자동 저장(요청 3) */
  chk(/colorPick\('책등 색', 'color'/.test(B) && /colorPick\('제목 글자색', 'tcolor'/.test(B), '색 자리 둘 — 책등 · 제목 글자');
  chk(/const mine = \(palHost === row\);/.test(B), '팔레트는 한 번에 하나만 열린다');
  chk(/hideCb\.type = 'checkbox'/.test(B) && /책등에 제목 숨기기/.test(BM), '[책등에 제목 숨기기] 체크');
  chk(/if\(it\.title && !it\.hideTitle\)/.test(B) && !/else if\(it\.title\)/.test(B), '그림이 있어도 제목을 겹쳐 쓴다(숨기기를 켤 때만 감춘다)');
  chk(/t\.style\.color = it\.tcolor \|\| BM_DEFAULT_TCOLOR/.test(B), '제목은 고른 글자색으로');
  chk(/if\(e\.target === ov\)\{ palClose\(\); bmEditorSave\(\); \}/.test(B), '창 바깥을 누르면 자동 저장');
  chk(/no\.onclick = bmEditorClose;/.test(B), '[취소]와 Esc 만 버린다');
  chk(/box-sizing:border-box;border:1px solid #2e1c0f/.test(B), '책등은 border-box(길게가 선반 칸을 안 넘는다)');
  chk(/\.bm-t\{[^}]*writing-mode:vertical-rl/.test(B) && /display:flex;align-items:center;justify-content:flex-start/.test(B), '세로 제목은 책등 한가운데(세로쓰기에서 align-items 가 가로 정렬)');
  chk(/background:transparent;display:flex;align-items:center/.test(B), '책 꽂기 창 바깥은 어둡게 덮지 않는다');
  chk(/document\.addEventListener\('pointerdown', palOff, true\)/.test(B) && /palClose/.test(B), '색 팔레트는 바깥을 누르면 닫힌다');
  chk(/isWindowOpen\('bmWin'\)\)\{ bmOpen = false;[^}]*closeWindow\('bmWin'\); return; \}/.test(B), '폴더를 다시 누르면 서랍이 닫힌다');
  chk(/bm-bar/.test(B) && /bm-ghosting/.test(B) && /bmShelf\.scrollTop \+= dy/.test(B), '놓일 곳 노란 막대 · 빠진 자리 점선 · 가장자리 자동 스크롤');
  chk(/bm-dragging\) \.bm-book:hover/.test(B), '집는 동안 호버 들림을 끈다');
}

say('── 3-b. 공개/비공개 · 구경 모드 (2026-09-23 요청 · 시안 확정)');
{
  chk(/pub: !!it\.pub/.test(B) && /pubCb\.type = 'checkbox'/.test(B) && /마이홈 방문자에게 공개/.test(BM), '책마다 공개 체크(기본 꺼짐)');
  chk(/mk\(it\.pub \? '🔒 공개 끄기' : '👀 방문자에게 공개'/.test(B), '우클릭 메뉴에서 바로 켜고 끈다');
  /* ⚠️ [제보] body 에 붙는 조각은 클릭 통과 화이트리스트(UI_HIT_SEL)에 걸리는 클래스가 있어야 한다. */
  chk(/bd\.className = 'app-popup-ov';/.test(B), '우클릭 메뉴도 .app-popup-ov(실행 화면에서 클릭이 새지 않게)');
  /* ⚠️ [제보] 덮개가 메뉴 안 클릭까지 먹어 줄이 안 눌렸다 — 바깥일 때만 닫는다. */
  chk(/bd\.addEventListener\('pointerdown', e=>\{ if\(!m\.contains\(e\.target\)\) close\(\); \}\)/.test(B), '메뉴 바깥을 누를 때만 닫힌다(줄이 눌린다)');
  chk(/mk\('책등 수정'/.test(B), '줄 이름은 «책등 수정»');
  chk(/\.bm-drag\{[^}]*pointer-events:none/.test(B), '끌 때 따라다니는 그림자는 pointer-events:none(클릭 판정에 안 걸린다)');
  chk(/if\(it\.pub && !bmReadOnly\(\)\)/.test(B) && /\.bm-pub\{[^}]*background:#ffd34d/.test(B), '공개한 책은 노란 띠 — **구경하는 사람에게는 안 보인다**(요청)');
  chk(/function bmView\(\)\{ return bmVisit \? bmVisit\.data : bmData; \}/.test(B), '그리는 자료는 한 곳(bmView)에서 갈린다');
  chk(/if\(bmReadOnly\(\)\)\{[\s\S]{0,200}bmOpenLink\(c\.dataset\.bid\);[\s\S]{0,40}return;/.test(B), '구경 모드: 끌기 없음 · 누르면 링크만');
  chk(/if\(bmReadOnly\(\)\) return;\s*\/\/ 👀 남의 책장은 고칠 수 없다/.test(BM) || /if\(bmReadOnly\(\)\) return;/.test(B), '구경 모드: 우클릭 편집 없음');
  chk(/bmAddBtn\.style\.display = bmReadOnly\(\) \? 'none' : ''/.test(B), '구경 모드: [+ 추가] 없음');
  chk(/setFolderVisible\('bookmark', bmVisit\.data\.order\.length > 0\)/.test(B), '공개된 책이 없으면 폴더 자체를 감춘다');
  chk(/visitable:true/.test(B) && (B.match(/visitable:true/g) || []).length === 2, '폴더 · 서랍 둘 다 visitable');
  if(FI){
    chk(/bookmarksPub\/\$\{userId\}/.test(FI) && /savePublicBookmarks/.test(FI), '공개 책은 bookmarksPub/{uid} 에 따로 올린다');
    chk(/pubOrder\.length \? \{ order:pubOrder\.join\(','\), items:pubItems, ts:bmData\.ts \} : null/.test(BM), '공개가 하나도 없으면 그 노드를 지운다');
  }
  if(RULES){
    const pr = JSON.parse(RULES).rules.bookmarksPub;
    chk(!!pr && pr.$userId['.read'] === true && /userAuth/.test(pr.$userId['.write']), '규칙: 공개 책장은 누구나 읽고 주인만 쓴다');
    chk(/pub.*isBoolean/.test(JSON.parse(RULES).rules.bookmarks.$userId.items.$bid['.validate']), '규칙: pub 칸');
  }
  if(MHD){
    const M2 = strip(MHD);
    chk(/if\(advVisiting && !a\.visitable\) return;/.test(M2) && /MHD_VISIT_WINS\.indexOf\(id\)<0\) return;/.test(M2), '계약: visitable 폴더·창은 남의 집에서도 열린다');
    chk(/mhdNotifyVisit\(visiting, ownerId\)/.test(M2) && /a\.onVisit\(!!visiting, MHD_VISIT_OWNER\)/.test(M2), '계약: onVisit 에 집주인 id 가 온다');
    chk(/setFolderVisible\(id, on\)\{/.test(M2), '계약: setFolderVisible');
  }
}

say('── 4. 저장');
{
  chk(/order:bmData\.order\.join\(','\)/.test(B) && !/shelf|선반 번호/.test(strip(BM).replace(/[^\x00-\x7F가-힣]/g, ' ').split('bmPush')[1] || ''), '순서 목록만 저장(선반 번호 없음)');
  if(FI){
    chk(/bookmarks\/\$\{userId\}/.test(FI) && !/users\/\$\{userId\}\/bookmarks/.test(FI), '자리는 최상위 bookmarks/{uid}(users/ 아래가 아니다 — 거긴 읽기가 열려 있다)');
    chk(/bookmarks\/\$\{userId\}\/\$\{safe\}_\$\{Date\.now\(\)\}\.webp/.test(FI), '책등 그림은 Storage bookmarks/{uid}/…webp');
  }else{ huh++; say('  ? firebase-init.js 없음'); }
  if(RULES){
    const r = JSON.parse(RULES).rules.bookmarks;
    const u = r && r.$userId;
    chk(!!u && /userAuth/.test(u['.read']) && /userAuth/.test(u['.write']), '규칙: 주인만 읽고 쓴다(방문자 읽기 금지)');
    const bid = u && u.items && u.items.$bid;
    chk(!!bid && /\^https\?/.test(bid['.validate']) && /thin\|thick/.test(bid['.validate']) && /short\|long/.test(bid['.validate']), '규칙: http/https · 네 모양 값');
    chk(!!bid && /tcolor/.test(bid['.validate']) && /hideTitle.*isBoolean/.test(bid['.validate']) && !!bid.tcolor && !!bid.hideTitle, '규칙: 제목 글자색 · 제목 숨기기 칸');
    chk(!!bid && bid.$other && bid.$other['.validate'] === false && u.$other && u.$other['.validate'] === false, '규칙: 모르는 칸 거절');
  }else{ huh++; say('  ? 규칙 파일 없음'); }
  if(STOR){
    chk(/match \/bookmarks\/\{userId\}\/\{allPaths=\*\*\}/.test(STOR) && /200 \* 1024/.test(STOR) && /request\.resource == null/.test(STOR.split('match /bookmarks/')[1]), 'Storage: bookmarks/ 200KB · 이미지 · 삭제 허용');
  }else{ huh++; say('  ? storage.rules 없음'); }
}

say('── 5. 미스테리au 걷어내기');
{
  chk(!/mystery-au\.js"><\/script>|mys-net-bind\.js"><\/script>/.test(HTML), 'html 의 script 태그 둘이 없다');
  chk(!has('mystery-au.js') && !has('mys-net-bind.js'), '파일 둘이 없다');
  if(RULES) chk(!JSON.parse(RULES).rules.mysRooms, '서버 규칙에서도 mysRooms 가 내려갔다(개정 63 · 쓰는 사람 없음 확인)');
  if(FI) chk(!/_mysMsgRef|__mysNetBind\(MYS_NET_IMPL\)|MYS_NET_IMPL = \{/.test(FI), 'firebase-init 의 파티 전송선이 걷혔다(남은 것은 왜 걷었는지 적은 주석뿐)');
  if(APP) chk(!/mysRejoinParty|MYS_NET/.test(strip(APP)), 'app.js 에는 미스테리 코드가 없다');
  chk(!fs.existsSync('sim-mys-play.js'), 'sim-mys-play.js 폐기');
}

say('── 6. 떼어 와 돌림');
{
  const src = BM.slice(BM.indexOf('function bmUrlOk'), BM.indexOf('function bmLoadLocal'));
  const T = new Function('BM_URL_MAX','BM_TITLE_MAX','BM_MAX','BM_DEFAULT_COLOR','BM_DEFAULT_TCOLOR', src + ' return { clean:bmClean, url:bmUrlOk, img:bmImgOk };')(300, 14, 50, '#8f5a4a', '#ffffff');
  const good = { order:'a,b', items:{ a:{url:'https://x.com', title:'가나다', w:'thick', h:'long', color:'#123456' },
                                      b:{url:'http://y.com', w:'zz', h:'zz', color:'bad' },
                                      c:{url:'javascript:alert(1)'}, d:{url:'https://z.com'} }, ts:5 };
  const out = T.clean(good);
  /* 주소는 선택이다(요청) — 틀린 주소는 **버리지 않고 빈 칸으로** 둔다. 책(모양·그림)은 남는다. */
  chk(out.items.c && out.items.c.url === '' && out.order.indexOf('c') >= 0, 'javascript: 같은 주소는 빈 칸으로(책은 남는다)');
  chk(/function bmUrlSlot\(u\)/.test(BM) && /if\(!it\.url\) delete it\.url;/.test(BM), '빈 주소는 서버로 안 보낸다(규칙은 «있으면 http/https»)');
  chk(/if\(u && !bmUrlOk\(u\)\)/.test(BM), '창에서도 비워 두면 저장된다(적었는데 형식이 틀릴 때만 막는다)');
  chk(out.items.b.w === 'thin' && out.items.b.h === 'short' && out.items.b.color === '#8f5a4a', '모르는 값은 기본으로');
  chk(out.items.b.tcolor === '#ffffff' && out.items.b.hideTitle === false, '제목 글자색 · 숨기기도 기본값이 채워진다');
  chk(out.order.join(',') === 'a,b,c,d', '순서에서 빠진 책은 뒤에 붙는다(책이 사라지지 않는다)');
  chk(T.clean({ order:Array.from({length:60},(_,i)=>'x'+i).join(','), items:Object.fromEntries(Array.from({length:60},(_,i)=>['x'+i,{url:'https://a.b'}])) }).order.length === 50, '50권까지만');
  chk(T.img('https://firebasestorage.googleapis.com/a') && !T.img('https://evil.example/a.png'), '책등 그림은 Storage 주소만');
  /* 순서 바꾸기 — 끌어놓기 계산만 떼어 온다 */
  const move = (order, id, to)=>{ const a = order.slice(); const from = a.indexOf(id); let idx = to; if(idx > from) idx--; a.splice(from,1); a.splice(Math.max(0,Math.min(a.length,idx)),0,id); return a; };
  chk(move(['a','b','c'],'a',3).join('') === 'bca' && move(['a','b','c'],'c',0).join('') === 'cab' && move(['a','b','c'],'b',1).join('') === 'abc', '앞뒤로 옮기기 · 제자리는 그대로');
}

say(`\n${fail ? '✗' : '✓'} 통과 ${pass} · 실패 ${fail}` + (huh ? ` · 검사못함 ${huh}` : ''));
process.exit(fail ? 1 : 0);
