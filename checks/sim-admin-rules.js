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
  ['catalogMeta/$kind',          '카탈로그 버전(앱 캐시 무효화)'],
  ['announce/current',           '상단 배너 공지'],
  ['updateNotice/current',       '업데이트 공지'],
  ['bugReport/current',          '버그제보 공지·링크'],
  ['bugBoard/ans/pub/$id',       '버그제보 공개 답변'],
  ['bugBoard/ans/prv/$id',       '버그제보 비공개 답변'],
  ['config/minRoomVer',          '최소 버전(전원 접속 차단 가능)'],
  ['config/minAppVer',           '앱 최소 버전(옛 앱 전체 차단)'],
  ['config/bugDailyMax',         '버그 제보 하루 상한'],
  ['config/releaseAnswerTpl',    '릴리스 반영 답변 템플릿(웹 관리자)'],
  ['inboxBroadcast',             '전체 우편함 발송'],
  ['inboxBroadcastMeta',         '공용 공지 버전(앱 캐시 무효화)'],
].forEach(([p, name])=> chk(isAdmin(w(p)), name + '  (' + p + ')'));

console.log('\n── 2. 일반 사용자가 계속 할 수 있어야 하는 것 (잠그면 앱이 멎는다)');
{
  chk(w('licenses/$key/redeemedAt') === "!data.exists() && root.child('licenses').child($key).exists()",
      '라이선스 등록 시 redeemedAt 기록 — 처음 한 번만, 있는 키에만');
  chk(!!at('licenses/$key/redeemedAt') && at('licenses/$key/redeemedAt')['.validate'] === 'newData.isNumber()', '그 값은 숫자여야 한다');
  chk(/!data\.exists\(\) && newData\.child\('status'\)\.val\(\) === 'pending'/.test(String(w('licenseRequests/$reqId'))),
      '라이선스 신청은 누구나 새로 넣을 수 있다 (pending · 발급 키 없이) — 승인·거절·수정은 관리자만');
  chk(r('licenseRequests/$reqId') === true, '신청자는 자기 신청 상태를 볼 수 있다');
  {
    const v = String((at('licenseRequests/$reqId') || {})['.validate']);
    chk(/!newData\.child\('friendCode'\)\.exists\(\) \|\|/.test(v), '신청의 친구코드는 없어도 된다 (친구코드를 안 보내는 옛 앱)');
    chk(v.includes("matches(/^(MATE|COZY)-[A-Z0-9]{4}$/)"), '  ↳ 있으면 MATE-XXXX · COZY-XXXX 형식만 (발급 때 그 주인의 수령함으로 보낸다)');
  }
  {
    /* 🐞 버그제보 게시판 — 글쓰기는 누구나(본인 이름으로 새 글만) · 공감은 본인 표시 하나 */
    const lw = String(w('bugBoard/list/$id'));
    chk(/!data\.exists\(\) && newData\.child\('authUid'\)\.val\(\) === auth\.uid/.test(lw) && /userAuth/.test(lw),
        '버그제보 글쓰기 — 본인 uid · 본인 코드로 새 글만 (상태·공지는 관리자)');
    chk(/!data\.exists\(\)/.test(String(w('bugBoard/pub/$id'))) && /auth\.uid === \$authUid/.test(String(w('bugBoard/prv/$authUid/$id'))),
        '  ↳ 공개 · 비공개 내용도 글쓴이가 새로 쓸 수 있다');
    chk(/auth\.uid === \$authUid && !data\.exists\(\)/.test(String(w('bugBoard/likes/$id/$authUid'))), '  ↳ 👍 은 본인 표시 하나만');
  }
  chk(r('licenses/$key') === true, '키 하나는 누구나 읽는다 — 등록(redeemLicense)·재검증·회수 구독이 키 하나로 읽는다 (개정 55)');
  chk(/newData\.val\(\) === \(data\.exists\(\) \? data\.val\(\) : 0\) \+ 1/.test(String(w('stats/userCount'))),
      '누적 이용자 수는 각 클라이언트가 +1 만 올린다 (임의 값은 관리자만)');
  chk(/newData\.val\(\) >= data\.val\(\)/.test(at('stats/userCount')['.validate']), '  ↳ 줄이는 쓰기는 거부된다');
}

console.log('\n── 3. 새는 곳이 없는가');
{
  chk(r('licenseRequests') !== true, '신청자 명단 전체 열람은 막혔다 (이름이 담긴 목록이다)');
  chk(isAdmin(r('licenseRequests')), '  ↳ 관리자만 목록을 본다');
  /* 개정 55 (설계 §9-12): licenses 모음이 .read:true 라 `/licenses.json` 한 번으로 발급된 키 전부가 보였고,
     등록은 «있고 valid» 만 보므로 그 키로 누구나 프리미엄이 됐다. 모음 읽기는 관리자만 — 키 하나는 위 2절대로 열려 있다. */
  chk(r('licenses') !== true && isAdmin(r('licenses')), '★ 라이선스 키 목록 전체 열람은 관리자만 (개정 55)');
  chk(isAdmin(r('accountSnap')) && !w('accountSnap'), '계정 요약(accountSnap) 목록은 관리자만 읽는다 — 웹 관리자 사용자 목록 · 쓰기는 본인만 그대로');
  chk(/userAuth/.test(String(r('accountSnap/$userId'))), '  ↳ 한 명분 읽기는 여전히 본인만 (안에 라이선스 키가 있다)');
  {
    let fb = ''; try { fb = fs.readFileSync('firebase-init.js', 'utf8'); } catch (_) {}
    if (!fb) console.log('  ? firebase-init.js 없음 — 모음 읽기 자리 대조 건너뜀');
    else {
      const code = fb.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/mg, '');
      const whole = (code.match(/ref\(db, *'licenses'\)/g) || []).length;
      const owner = s => { const i = code.indexOf(s); return i < 0 ? '' : code.slice(i, code.indexOf('\n    },', i)); };
      const inAdmin = (owner('async listLicenses(').match(/ref\(db, *'licenses'\)/g) || []).length + (owner('async getAdminStats(').match(/ref\(db, *'licenses'\)/g) || []).length;
      chk(whole === 2 && inAdmin === 2, '  ↳ 모음을 읽는 곳은 관리자 통로 둘(listLicenses · getAdminStats)뿐이다 (' + whole + '곳)');
    }
  }
  chk(isAdmin(r('metrics')) && /auth != null/.test(r('metrics')) && !JSON.stringify(Object.assign({}, at('metrics') || {}, { improvements: undefined })).includes('.write'),
      '접속 지표(metrics — DAU · 방문 수) 읽기는 관리자만 · 쓰기 규칙 없음(함수가 Admin SDK 로만) — 개선 기록(improvements)만 빼고');
  {
    const im = at('metrics/improvements/$id') || {};
    const v = (k) => String((im[k] || {})['.validate'] || '');
    const item = String(((im.items || {}).$i || {})['.validate'] || '');
    chk(isAdmin(im['.write']) && Object.keys(at('metrics/improvements') || {}).every(k => k === '$id'),
        '개선 기록(metrics/improvements/$id) 쓰기는 관리자만 · 위 칸에 쓰기 규칙 없음');
    chk(/hasChildren\(\['version','releasedAt','title','items'\]\)/.test(String(im['.validate'])) && /<= 20/.test(v('version')) && /<= 80/.test(v('title'))
        && item.includes('$i.matches(/^1?[0-9]$/)') && /<= 120/.test(item)
        && /<= 30/.test(v('adoptDays')) && /isNumber/.test(v('releasedAt')) && (im.$other || {})['.validate'] === false,
        '  ↳ 모양: 버전 ≤20 · 제목 ≤80 · 항목 0~19번(20개) 각 ≤120 · 적용 일수 0~30 · 모르는 칸 거절');
  }
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
  chk(/e\.ctrlKey \|\| \(isMac && e\.metaKey\)/.test(trigger) && /const isMac = \/Mac\/i\.test\(navigator\.platform/.test(trigger),
      'Ctrl + 클릭 한 번으로 연다 (Meta 는 Mac ⌘ 만 — Windows Win 키로는 안 열림)');
  chk(/e\.preventDefault\(\)/.test(trigger) && /e\.stopPropagation\(\)/.test(trigger),
      '그 클릭의 원래 동작(생성창·꾸미기)은 막는다');

  chk(/id="adminAuthLine"/.test(html), '비밀번호 창에 로그인 상태 줄이 있다');
  chk(/adminAuthLine/.test(enter), '창을 열 때마다 그 줄을 채운다');
  chk(/uid /.test(enter), '  ↳ uid 를 그대로 보여준다 (관리자 추가 등록에 쓰인다)');
}

console.log('\n── 6. 관리자 작업 기록(adminLog) — 관리자만, 새로 쓰기만, 오래된 것만 지우기');
{
  /* 규칙식을 실제로 굴려 본다(sim-purikura-rules.js 와 같은 방식). .matches 는 JS 에 없어 문자열에 잠깐 붙인다. */
  const snap = (val) => ({
    exists: () => val !== null && val !== undefined,
    val: () => val,
    isNumber: () => typeof val === 'number',
    isString: () => typeof val === 'string',
    hasChildren: (ks) => ks.every(k => val && val[k] !== undefined),
    child: (k) => snap(val && val[k] !== undefined ? val[k] : null),
  });
  const ADMIN = 'adm1', NOW = Date.UTC(2026, 9, 5);
  const ROOT = snap({ admins: { [ADMIN]: true } });
  const run = (expr, ctx) => {
    if (typeof expr !== 'string') return expr === true;
    String.prototype.matches = function (re) { return re.test(String(this)); };   // eslint-disable-line no-extend-native
    try {
      return !!new Function('newData', 'data', 'now', 'auth', 'root', '$logId', 'return (' + expr + ');')(
        snap(ctx.newVal), snap(ctx.oldVal), NOW, ctx.uid ? { uid: ctx.uid } : null, ROOT, ctx.id || 'a1');
    } finally { delete String.prototype.matches; }
  };
  const node = at('adminLog/$logId') || {};
  // 쓰기 한 건 판정 — $logId 의 .write 와 .validate, 자식 .validate(없는 자식 이름은 $other)까지.
  const allowed = (ctx) => {
    if (!run(node['.write'], ctx)) return false;
    if (ctx.newVal === null) return true;                 // 삭제에는 .validate 가 안 돈다
    if (!run(node['.validate'], ctx)) return false;
    return Object.keys(ctx.newVal).every(k => {
      const c = node[k] || node.$other || {};
      return c['.validate'] === undefined ? true : run(c['.validate'], { ...ctx, newVal: ctx.newVal[k], oldVal: null });
    });
  };
  const good = { at: NOW, by: ADMIN, action: 'license.issue', target: 'ABCD-…', detail: '메모' };
  const as = (uid, newVal, oldVal = null, id) => allowed({ uid, newVal, oldVal, id });

  chk(isAdmin(r('adminLog')) && /auth != null/.test(r('adminLog')), '목록 읽기는 관리자만');
  chk(JSON.stringify((at('adminLog') || {})['.indexOn']) === '["at"]', '  ↳ .indexOn ["at"] — 최근 것부터 getLast 로 필요한 만큼만');
  chk(!w('adminLog'), '모음째 쓰기 · 통째 지우기 규칙은 없다 (루트 .write false 를 그대로 받는다)');
  chk(as(ADMIN, good), '관리자는 새 기록을 쓴다');
  chk(as(ADMIN, { at: NOW, by: ADMIN, action: 'room.closeAll', target: '3개' }), '  ↳ detail 은 없어도 된다');
  chk(!as('user9', { ...good, by: 'user9' }), '★ 관리자가 아니면 못 쓴다');
  chk(!as(null, good), '  ↳ 로그인 안 했으면 못 쓴다');
  chk(!as(ADMIN, { ...good, by: 'someone' }), '★ by 는 쓰는 사람 자신(auth.uid)만');
  chk(!as(ADMIN, { ...good, at: NOW - 1000 }), '★ at 은 서버 시각(now)만 — 기기 시계 값은 거절');
  chk(!as(ADMIN, { ...good, at: String(NOW) }), '  ↳ 숫자가 아니면 거절');
  chk(!as(ADMIN, good, { ...good, at: NOW - 1000 }), '★ 이미 있는 기록은 고치지 못한다');
  chk(!as(ADMIN, { ...good, extra: 1 }), '정해진 칸 밖의 필드는 거절');
  chk(!as(ADMIN, { ...good, action: 'License Issue' }), '  ↳ action 은 «종류.동작» 짧은 식별자만');
  chk(!as(ADMIN, { ...good, target: 'x'.repeat(61) }) && as(ADMIN, { ...good, target: 'x'.repeat(60) }), '  ↳ target 60자까지');
  chk(!as(ADMIN, { ...good, detail: 'x'.repeat(121) }) && as(ADMIN, { ...good, detail: 'x'.repeat(120) }), '  ↳ detail 120자까지');
  chk(!as(ADMIN, good, null, 'a/b c'), '  ↳ 키는 짧은 id 모양만');
  const DAY = 24 * 3600 * 1000;
  chk(!as(ADMIN, null, { ...good, at: NOW - 30 * DAY }), '최근(90일 안) 기록은 지우지 못한다 — 흔적을 지우는 길을 막는다');
  chk(as(ADMIN, null, { ...good, at: NOW - 91 * DAY }), '  ↳ 90일 지난 기록은 관리자가 한 건씩 정리할 수 있다');
  chk(!as('user9', null, { ...good, at: NOW - 91 * DAY }), '  ↳ 관리자가 아니면 오래된 것도 못 지운다');
  // 러너 스테이징에서는 firebase-init.js 가 parts/ 아래에 있다 — 두 곳 다 본다. 못 찾으면 빈 문자열(판정이 빨강으로 드러난다).
  const readFirst = (...names) => { for (const n of names) { try { return fs.readFileSync(n, 'utf8'); } catch (_) {} } return ''; };
  const fbSrc = readFirst('firebase-init.js', 'parts/firebase-init.js', 'app/parts/firebase-init.js');
  {
    const app = readFirst('app.js');
    chk(!!app && !!fbSrc && !/adminLog/.test(app + fbSrc), '앱(app.js · firebase-init.js)은 이 경로를 쓰지 않는다 — 웹 관리자 전용');
  }

  /* 초대 코드 목록 — 웹 관리자가 «이 사람이 초대한 사람» 을 issuedBy 로 찾는다. 앱은 코드 하나씩만 읽고 쓴다. */
  {
    const inv = at('invites') || {};
    chk(!run(inv['.read'], { uid: 'user9' }) && !run(inv['.read'], {}), '★ invites 통째 읽기 — 비관리자 · 로그인 안 한 사람은 거절');
    chk(run(inv['.read'], { uid: ADMIN }), '  ↳ 관리자는 목록을 읽는다');
    chk(JSON.stringify(inv['.indexOn']) === '["issuedBy"]', '  ↳ .indexOn ["issuedBy"] — 한 사람이 낸 코드만 getEqual 로');
    chk(r('invites/$code') === true && w('invites/$code') === true, '코드 하나 읽기 · 쓰기는 그대로 누구나 (가입 게이트가 코드 하나로 확인 · 소진)');
    chk(/ref\(db, *`invites\/\$\{code\}`\)/.test(fbSrc) && !/ref\(db, *['`]invites['`]\)/.test(fbSrc),'  ↳ 앱은 invites 모음을 읽지 않는다 (코드 하나 경로만)');
  }
}

console.log('\n── 7. 관리자 할 일(adminTodos) · 관리자 이름(adminNames) — 관리자 전용 · rev 로 덮어쓰기 막기');
{
  /* 6절처럼 규칙식을 굴린다. 이번엔 $id/$uid 이름과 newData.parent() 가 필요해 흉내를 넓힌다. */
  const snap = (val, parent = null) => {
    const s = {
      exists: () => val !== null && val !== undefined,
      val: () => val,
      isNumber: () => typeof val === 'number',
      isString: () => typeof val === 'string',
      hasChildren: (ks) => ks.every(k => val && val[k] !== undefined),
      parent: () => parent,
    };
    s.child = (k) => snap(val && val[k] !== undefined ? val[k] : null, s);
    return s;
  };
  const A1 = 'adm1', A2 = 'adm2', NOW = Date.UTC(2026, 9, 10);
  const ROOT = snap({ admins: { [A1]: true, [A2]: true } });
  const run = (expr, ctx) => {
    if (typeof expr !== 'string') return expr === true;
    String.prototype.matches = function (re) { return re.test(String(this)); };   // eslint-disable-line no-extend-native
    try {
      return !!new Function('newData', 'data', 'now', 'auth', 'root', '$id', '$uid', '$rid', 'return (' + expr + ');')(
        ctx.newSnap || snap(ctx.newVal), snap(ctx.oldVal), NOW, ctx.uid ? { uid: ctx.uid } : null, ROOT,
        ctx.id || 't1', ctx.key || A1, ctx.rid || '');
    } finally { delete String.prototype.matches; }
  };
  // 한 건 판정 — .write, (지우기가 아니면) 자기 .validate, 자식 .validate(없는 이름은 $other · reports 는 $rid).
  const allowed = (node, ctx) => {
    if (!run(node['.write'], ctx)) return false;
    if (ctx.newVal === null) return true;                 // 지우기에는 .validate 가 안 돈다
    if (!run(node['.validate'], ctx)) return false;
    const me = snap(ctx.newVal);
    return Object.keys(ctx.newVal).every(k => {
      const c = node[k] || node.$other || {};
      if (k === 'reports' && node.reports) {
        return Object.keys(ctx.newVal.reports).every(rid =>
          run(node.reports.$rid['.validate'], { ...ctx, newVal: ctx.newVal.reports[rid], rid, newSnap: undefined }));
      }
      return c['.validate'] === undefined ? true : run(c['.validate'], { ...ctx, newSnap: me.child(k), oldVal: null });
    });
  };
  const todo = at('adminTodos/$id') || {};
  const R1 = '-OaAAAAAAAAAAAAAAAA1';
  const fresh = { title: '고치기', status: 'todo', createdBy: A1, createdAt: NOW, updatedBy: A1, updatedAt: NOW, rev: 0 };
  const saved = { ...fresh, createdAt: NOW - 1000, updatedAt: NOW - 1000, rev: 2 };
  const next = (extra = {}) => ({ ...saved, updatedBy: A1, updatedAt: NOW, rev: 3, ...extra });
  const tw = (uid, newVal, oldVal = null, id) => allowed(todo, { uid, newVal, oldVal, id });

  chk(isAdmin(r('adminTodos')) && /auth != null/.test(r('adminTodos')), '할 일 읽기는 관리자만');
  chk(!w('adminTodos'), '  ↳ 모음째 쓰기 규칙은 없다 (한 건씩)');
  chk(tw(A1, fresh), '관리자는 새 할 일을 만든다 (rev 0 · 만든 사람 = 나 · 서버 시각)');
  chk(!tw('user9', { ...fresh, createdBy: 'user9', updatedBy: 'user9' }), '★ 관리자가 아니면 못 쓴다');
  chk(!tw(null, fresh), '  ↳ 로그인 안 했으면 못 쓴다');
  chk(!tw(A1, { ...fresh, rev: 1 }), '★ 새로 만들 때 rev 는 0 만');
  chk(!tw(A1, { ...fresh, createdBy: A2 }) && !tw(A1, { ...fresh, createdAt: NOW - 5 }), '  ↳ 만든 사람 · 시각을 꾸미지 못한다');
  chk(tw(A1, next(), saved), '고치기 — 지금 rev + 1 이면 받는다');
  chk(!tw(A1, next({ rev: 3 }), { ...saved, rev: 3 }), '★ 화면에서 본 뒤 남이 먼저 고쳤으면(rev 가 이미 올랐으면) 거절 — 덮어쓰지 않는다');
  chk(!tw(A1, next({ rev: 5 }), saved), '  ↳ rev 를 건너뛰어도 거절');
  chk(!tw(A1, next({ createdBy: A2 }), saved) && !tw(A1, next({ createdAt: NOW }), saved), '  ↳ 고칠 때 만든 사람 · 시각은 그대로여야');
  chk(!tw(A1, next({ updatedBy: A2 }), saved) && !tw(A1, next({ updatedAt: NOW - 1 }), saved), '★ 고친 사람은 나 · 고친 시각은 서버 시각만');
  chk(tw(A1, next({ assignee: A2, assigneeName: '이관리' }), saved), '작업자는 관리자 중에서');
  chk(!tw(A1, next({ assignee: 'user9' }), saved), '★ 관리자가 아닌 uid 는 작업자가 될 수 없다');
  chk(!tw(A1, next({ assigneeName: '이관리' }), saved), '  ↳ 작업자 없이 이름만은 거절');
  chk(!tw(A1, next({ assignee: A2, assigneeName: 'x'.repeat(41) }), saved), '  ↳ 이름 40자까지');
  chk(!tw(A1, next({ status: 'closed' }), saved) && tw(A1, next({ status: 'done' }), saved), '상태는 todo · doing · done 만');
  chk(!tw(A1, next({ title: '' }), saved) && !tw(A1, next({ title: 'x'.repeat(121) }), saved) && tw(A1, next({ title: 'x'.repeat(120) }), saved), '  ↳ 제목 1~120자');
  chk(!tw(A1, next({ memo: 'x'.repeat(2001) }), saved) && tw(A1, next({ memo: 'x'.repeat(2000) }), saved), '  ↳ 메모 2000자까지');
  chk(tw(A1, next({ reports: { [R1]: true } }), saved), '제보 연결 — 제보 id(20자 push 키) : true');
  chk(!tw(A1, next({ reports: { 'p1': true } }), saved) && !tw(A1, next({ reports: { [R1]: 'yes' } }), saved), '  ↳ 제보 id 모양이 틀리거나 값이 true 가 아니면 거절');
  chk(tw(A1, next({ release: '0.11.3' }), saved) && tw(A1, next({ release: '0.12.0-beta.1' }), saved) && tw(A1, { ...fresh, release: '1.0.0' }), '릴리스 버전 — 0.11.3 · 0.12.0-beta.1 모양 (칸이 없어도 된다)');
  chk(!tw(A1, next({ release: '' }), saved) && !tw(A1, next({ release: 'v0.11.3' }), saved) && !tw(A1, next({ release: '0.11' }), saved) && !tw(A1, next({ release: '0.11.3 릴리스 대기' }), saved), '  ↳ 빈 값 · v 붙임 · 두 자리 · 글 섞임은 거절');
  chk(!tw(A1, next({ release: '0.11.3-Beta.1' }), saved) && !tw(A1, next({ release: '0.11.3-beta' }), saved) && !tw(A1, next({ release: 11 }), saved), '  ↳ 베타 꼬리는 소문자.숫자 · 숫자값은 거절');
  chk(!tw(A1, next({ release: '1000000.0.0-beta.1000' }), saved) && tw(A1, next({ release: '100000.0.0-beta.10' }), saved), '  ↳ 20자까지');
  chk(tw(A1, next({ type: 'feat' }), saved) && tw(A1, next({ type: 'bug' }), saved) && tw(A1, { ...fresh, type: 'bug' }), '종류(type) — feat · bug (칸이 없어도 된다 · 화면에서 «미분류»)');
  chk(!tw(A1, next({ type: '' }), saved) && !tw(A1, next({ type: 'chore' }), saved) && !tw(A1, next({ type: 'Bug' }), saved) && !tw(A1, next({ type: 1 }), saved), '  ↳ 빈 값 · 다른 종류 · 대문자 · 숫자값은 거절');
  chk(!tw(A1, next({ extra: 1 }), saved), '정해진 칸 밖의 필드는 거절');
  chk(!tw(A1, fresh, null, 'a/b c'), '  ↳ 키는 짧은 id 모양만');
  chk(tw(A1, null, saved) && !tw('user9', null, saved), '지우기는 관리자만');

  const names = at('adminNames/$uid') || {};
  const nw = (uid, key, newVal) => allowed(names, { uid, key, newVal, oldVal: null });
  chk(isAdmin(r('adminNames')) && /auth != null/.test(r('adminNames')), '관리자 이름 읽기는 관리자만');
  chk(nw(A1, A1, { name: '가관리', at: NOW }), '관리자는 자기 이름 칸을 쓴다');
  chk(!nw(A1, A2, { name: '가관리', at: NOW }), '★ 남의 이름 칸은 못 쓴다');
  chk(!nw('user9', 'user9', { name: '사칭', at: NOW }), '★ 관리자가 아니면 자기 칸도 못 만든다 (목록에 끼어들 수 없다)');
  chk(!nw(A1, A1, { name: 'x'.repeat(41), at: NOW }) && !nw(A1, A1, { name: '', at: NOW }), '  ↳ 이름 1~40자');
  chk(!nw(A1, A1, { name: '가', at: NOW - 1 }) && !nw(A1, A1, { name: '가', at: NOW, x: 1 }), '  ↳ 서버 시각 · 정해진 칸만');

  const readFirst = (...ns) => { for (const n of ns) { try { return fs.readFileSync(n, 'utf8'); } catch (_) {} } return ''; };
  const app = readFirst('app.js') + readFirst('firebase-init.js', 'parts/firebase-init.js', 'app/parts/firebase-init.js');
  chk(!!app && !/adminTodos|adminNames/.test(app), '앱(app.js · firebase-init.js)은 이 경로를 쓰지 않는다 — 웹 관리자 전용');

  /* 🏷 릴리스 반영 답변 템플릿 — 관리자끼리 같은 문구를 쓰게 DB 에. 지우면 웹 관리자가 코드 기본 문구를 쓴다. */
  const tpl = at('config/releaseAnswerTpl') || {};
  const tplOk = (uid, v) => run(tpl['.write'], { uid, newVal: v }) && (v === null || run(tpl['.validate'], { uid, newVal: v }));
  chk(tplOk(A1, '{version} 에서 고쳐졌어요') && tplOk(A1, 'x'.repeat(1000)), '릴리스 답변 템플릿(config/releaseAnswerTpl) — 관리자가 1~1000자 글자로 쓴다');
  chk(!tplOk(A1, '') && !tplOk(A1, 'x'.repeat(1001)) && !tplOk(A1, 5), '  ↳ 빈 값 · 1000자 넘음 · 숫자는 거절');
  chk(!tplOk('user9', '{version}') && !tplOk(null, '{version}'), '★ 관리자가 아니면 못 쓴다');
  chk(tplOk(A1, null) && !tplOk('user9', null), '  ↳ 지우기(기본 문구로 되돌리기)도 관리자만');
  chk(tpl['.read'] === undefined && isAdmin(r('config')), '  ↳ 읽기는 config 통째 규칙대로 관리자만 (누구나 읽기 칸을 두지 않는다)');
  chk(!!app && !/releaseAnswerTpl/.test(app), '  ↳ 앱은 이 칸을 쓰지 않는다 — 웹 관리자 전용');
}

console.log(fail ? '\n✗ 실패 ' + fail + '건' : '\n✓ 전부 통과');
