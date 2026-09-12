/* sim-admin-rules.js — 🔐 관리자 경로가 서버 규칙에서 잠겼는가
   실행: node sim-admin-rules.js  (firebase-database-rules.json · app.js 와 같은 폴더에서)

   [무엇을 보는가] 지금까지 관리자 기능은 화면(isAdmin)에서만 막혀 있었다. 규칙은 누구의 쓰기든
     받았으므로, 앱이 서버와 주고받는 걸 들여다본 사람은 자기한테 라이선스를 발급하거나 카탈로그를
     지울 수 있었다. 이 검사는 그 경로들이 `admins/$uid` 를 요구하는지 확인한다.
   ⚠️ 반대 방향도 같이 본다 — 일반 사용자가 하던 쓰기(라이선스 등록, 신청, 이용자 수)까지
     잠가 버리면 앱이 조용히 멎는다. 잠그는 것보다 이쪽 사고가 더 크다. */
'use strict';
const fs = require('fs');
const rules = JSON.parse(fs.readFileSync('firebase-database-rules.json', 'utf8')).rules;

let fail = 0;
const chk = (c, m) => { console.log((c ? '  ✓ ' : '  ✗ ') + m); if (!c) fail++; };

const at = path => path.split('/').reduce((o,k)=> (o && o[k] !== undefined) ? o[k] : undefined, rules);
const w  = path => { const n = at(path); return n && n['.write']; };
const r  = path => { const n = at(path); return n && n['.read']; };
const isAdmin = v => typeof v === 'string' && /admins.*auth\.uid/.test(v);

console.log('\n── 1. 관리자만 쓸 수 있어야 하는 곳');
[
  ['licenses/$key',              '라이선스 발급·폐기'],
  ['catalog/parts/$partId',      '파츠 등록'],
  ['catalog/gachaParts/$partId', '가챠 파츠'],
  ['catalog/desks/$deskId',      '책상'],
  ['catalog/items/$itemId',      '아이템'],
  ['catalog/customCats/$catId',  '커스텀 카테고리'],
  ['catalog/catOverrides/$catId','카테고리 설정'],
  ['catalog/adBanner',           '광고 배너'],
  ['catalog/gameConfig',         '게임 설정'],
  ['announce/current',           '상단 배너 공지'],
  ['updateNotice/current',       '업데이트 공지'],
  ['bugReport/current',          '버그제보 공지·링크'],
  ['config/minRoomVer',          '최소 버전(전원 접속 차단 가능)'],
  ['inboxBroadcast',             '전체 우편함 발송'],
].forEach(([p, name])=> chk(isAdmin(w(p)), name + '  (' + p + ')'));

console.log('\n── 2. 일반 사용자가 계속 할 수 있어야 하는 것 (잠그면 앱이 멎는다)');
{
  chk(w('licenses/$key/redeemedAt') === "!data.exists() && root.child('licenses').child($key).exists()",
      '라이선스 등록 시 redeemedAt 기록 — 처음 한 번만, 있는 키에만');
  chk(!!at('licenses/$key/redeemedAt') && at('licenses/$key/redeemedAt')['.validate'] === 'newData.isNumber()', '그 값은 숫자여야 한다');
  chk(w('licenseRequests/$reqId') === true, '라이선스 신청은 누구나 넣을 수 있다');
  chk(r('licenseRequests/$reqId') === true, '신청자는 자기 신청 상태를 볼 수 있다');
  chk(w('stats/userCount') === true, '누적 이용자 수는 각 클라이언트가 올린다 (줄이지 못하게 validate 가 막는다)');
  chk(/newData\.val\(\) >= data\.val\(\)/.test(at('stats/userCount')['.validate']), '  ↳ 줄이는 쓰기는 거부된다');
}

console.log('\n── 3. 새는 곳이 없는가');
{
  chk(r('licenseRequests') !== true, '신청자 명단 전체 열람은 막혔다 (이름이 담긴 목록이다)');
  chk(isAdmin(r('licenseRequests')), '  ↳ 관리자만 목록을 본다');
  chk(r('admins') === false, '관리자 명단은 앱에서 읽을 수 없다');
  chk(!!at('admins/$uid') && at('admins/$uid')['.write'] === false, '관리자 명단은 앱에서 쓸 수 없다 (콘솔에서만)');
  chk(r('srKey') === false && w('srKey') === false, '시크릿룸 발급 키는 그대로 잠겨 있다');
  chk(/srKey\/v/.test(String(w('secretRooms/$code'))), '시크릿룸 발급은 기존 키 방식 그대로다');
}

console.log('\n── 4. 앱이 거부를 조용히 넘기지 않는가');
{
  const src = fs.readFileSync('app.js', 'utf8');
  chk(/function _saveFailMsg/.test(src), '권한 거부와 네트워크 오류를 가르는 헬퍼가 있다');
  chk(/permission\[_-\]\?denied/i.test(src), 'PERMISSION_DENIED 를 알아본다');
  chk((src.match(/_saveFailMsg\(/g) || []).length >= 5,
      '관리자 저장 자리들이 그 헬퍼를 쓴다 (' + (src.match(/_saveFailMsg\(/g) || []).length + '곳)');
}

console.log('\n── 5. 관리자 모드 진입 — 화면과 실제 권한이 어긋나지 않는가');
{
  const src = fs.readFileSync('app.js', 'utf8');
  const html = fs.readFileSync('desk-companion-prototype.html', 'utf8');
  const submit = src.slice(src.indexOf('async function _submitAdminPass'), src.indexOf('function exitAdmin'));
  const trigger = src.slice(src.indexOf('function bindAdminTrigger'), src.indexOf('function setFaceMap'));
  const enter = src.slice(src.indexOf('function tryEnterAdmin'), src.indexOf('async function _submitAdminPass'));

  chk(/_myAuthUid\(\)/.test(submit), '비밀번호가 맞아도 로그인 여부를 확인한다');
  chk(submit.indexOf('_myAuthUid()') < submit.indexOf('isAdmin = true'), '  ↳ 확인이 isAdmin 을 켜기 전에 온다');
  chk(/구글 로그인이 필요해요/.test(submit), '로그인이 없으면 무엇이 필요한지 알려준다');
  chk(/authCurrentUid/.test(src) && !/getMyUserId\(\)[^\n]*admins/.test(src),
      '권한 판정에 앱 자체 id(getMyUserId)를 쓰지 않는다');

  chk(!/clicks\.length >= 5/.test(trigger), '5연타 조건이 사라졌다');
  chk(/e\.ctrlKey \|\| e\.metaKey/.test(trigger), 'Ctrl(또는 Meta) + 클릭 한 번으로 연다');
  chk(/e\.preventDefault\(\)/.test(trigger) && /e\.stopPropagation\(\)/.test(trigger),
      '그 클릭의 원래 동작(생성창·꾸미기)은 막는다');

  chk(/id="adminAuthLine"/.test(html), '비밀번호 창에 로그인 상태 줄이 있다');
  chk(/adminAuthLine/.test(enter), '창을 열 때마다 그 줄을 채운다');
  chk(/uid /.test(enter), '  ↳ uid 를 그대로 보여준다 (관리자 추가 등록에 쓰인다)');
}

console.log(fail ? '\n✗ 실패 ' + fail + '건' : '\n✓ 전부 통과');
