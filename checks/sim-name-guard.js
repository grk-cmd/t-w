/* sim-name-guard.js — 🏷️ 운영진처럼 보이는 이름 막기 검사
   실행:  node sim-name-guard.js   (name-guard.js · app.js · desk-companion-prototype.html · firebase-database-rules.json 과 같은 폴더에서)
   §1 name-guard.js 실행 — 정확히 그 이름만(앞뒤 공백 · 대소문자 무시), 말이 들어 있기만 한 이름은 통과
   §2 연결 — 닉네임 저장 한 곳(commitUserName)이 저장 전에 막는다 · 이미 그 이름 · 관리자는 예외 · html 이 app.js 보다 먼저
   §3 규칙 — users/$userId/profile 의 name 을 같은 목록으로 막되, 이름이 그대로면(옛 사용자) · 관리자면 통과
   ⚠️ 규칙을 실제로 돌린 것은 에뮬레이터(PR 본문)다. 방 이름표 · 채팅 이름은 막지 않는다(들어올 때마다 새로 쓰여 옛 사용자가 막힌다). */
'use strict';
const fs = require('fs');
const say = console.log;
let fail = 0;
const chk = (ok, msg) => { if (!ok) fail++; say((ok ? '  ✓ ' : '  ✗ ') + msg); };
const read = (f) => { for (const c of [f, 'parts/' + f, 'app/parts/' + f, 'app/' + f]) if (fs.existsSync(c)) return fs.readFileSync(c, 'utf8'); return null; };
const NG = read('name-guard.js'), APP = read('app.js'), HTML = read('desk-companion-prototype.html'), RULES = read('firebase-database-rules.json');
if (!NG || !APP || !HTML || !RULES) { say('  ? 원본 못 찾음 — name-guard.js · app.js · HTML · 규칙'); process.exit(2); }

say('§1 name-guard.js (실행)');
const G = new Function(NG + '\nreturn { STAFF_NAMES, isStaffName };')();
const LIST = ['운영자', '관리자', '운영팀', '관리팀', 'admin', 'administrator'];
chk(JSON.stringify([...G.STAFF_NAMES]) === JSON.stringify(LIST), '막는 이름 여섯 — ' + LIST.join(' · '));
chk(['운영자', ' 관리자 ', 'ADMIN', 'Administrator', '관리팀', '운영팀'].every(G.isStaffName), '정확히 그 이름이면(앞뒤 공백 · 대소문자 무시) 막는다');
chk(!['운영체제덕후', '관리자님', 'admin1', '에이', '', null].some(G.isStaffName), '말이 들어 있기만 한 이름 · 빈 이름은 통과');

say('§2 연결');
const ci = APP.indexOf('function commitUserName(raw){');
const body = ci >= 0 ? APP.slice(ci, APP.indexOf('\n}\n', ci)) : '';
const iGuard = body.indexOf('isStaffName(v)'), iSave = body.indexOf('setUserName(');
chk(iGuard > 0 && iSave > iGuard && /return;/.test(body.slice(iGuard, iSave)), '닉네임 저장(commitUserName)이 저장 전에 막고 돌아간다');
chk(/v !== getUserName\(\)\.trim\(\)/.test(body) && /isAdmin/.test(body.slice(iGuard, iSave)), '  ↳ 이미 그 이름인 사람 · 관리자는 예외 (규칙과 같다)');
const iNg = HTML.indexOf('<script src="parts/name-guard.js"></script>'), iApp = HTML.indexOf('<script src="parts/app.js"></script>');
chk(iNg > 0 && iApp > iNg, 'name-guard.js 는 app.js 보다 먼저 싣는다');

say('§3 규칙');
const v = String(JSON.parse(RULES).rules.users.$userId.profile['.validate']);
const m = v.match(/matches\(\/\^ \*\(([^)]*)\) \*\$\/\)/);
chk(!!m && m[1].split('|').sort().join() === LIST.slice().sort().join(), '프로필 name 이 같은 목록을 정확히(^ … $) 막는다 — 포함은 통과');
chk(/toLowerCase\(\)\.matches/.test(v), '  ↳ 대소문자 무시');
chk(/newData\.child\('name'\)\.val\(\) === data\.child\('name'\)\.val\(\)/.test(v) && /admins/.test(v), '  ↳ 이름이 그대로면(옛 사용자) · 관리자면 통과');

say('');
say(fail ? '문제 ' + fail + '건' : '전부 통과 ✅ — 운영진 이름은 새로 정할 수 없고, 이미 쓰던 사람은 그대로');
process.exit(fail ? 1 : 0);
