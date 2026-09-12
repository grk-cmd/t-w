/* sim-purikura-rules.js — 📷 스티커사진 규칙이 실제 rules 파일에 제대로 들어갔는가
   실행: node sim-purikura-rules.js
        (firebase-database-rules.json · purikura-net.js 와 같은 폴더에서)

   [왜 이 검사가 따로 필요한가]
     sim-purikura-net.js 는 purikura-net.js 만 본다. 가짜 서버를 쓰기 때문에 **규칙은 안 탄다.**
     그래서 그 검사가 전부 통과해도, 규칙이 병합되면서 어긋나면 실제 서버에서는
     ① 쓰기가 전부 거부되거나(앱이 조용히 멎는다)  ② 정원이 안 걸리거나(요금 사고)
     둘 중 하나가 난다. 둘 다 화면에는 아무 표시가 안 난다.

     병합에서 실제로 밟은 지뢰가 셋 있었다 — 이 파일이 그 셋을 지킨다:
       ⚠️ 조각 파일의 와일드카드 이름이 $code 였다. 기존 rooms 는 $room 이다.
          안 바꾸면 Firebase 가 "정의되지 않은 변수"로 **배포 자체를 거부**한다.
       ⚠️ 조각 파일의 _설명/_읽는_법 은 값이 배열이다. 규칙 JSON 에 배열은 못 들어간다.
          (그래서 설명은 여기와 핸드오프로 옮겼다. rules 파일에는 주석을 못 단다 —
           sim-admin-rules.js 가 그 파일을 JSON.parse 하기 때문이다.)
       ⚠️ rooms/$room 아래에는 이미 $memberId 와일드카드가 있다. photo 는 그보다
          **앞에 있는 이름 있는 자식**이어야 한다(_meta·chatLog 와 같은 방식).

   [보는 것]
     §1 병합이 들어갔는가 · 배포 가능한 모양인가
     §2 하루 정원 규칙을 실제로 실행해 본다 (여기가 요금을 정한다)
     §3 좌표가 별도 노드인가 (세션당 1.7원 ↔ 24.4원이 갈리는 자리)
     §4 프레임은 https URL 만 받는가 (dataURL 이 들어가면 다운로드 단가가 40배)
     §5 기존 앱이 쓰던 길이 안 막혔는가 (잠그는 사고보다 이쪽이 크다) */
'use strict';
const fs = require('fs');
const rules = JSON.parse(fs.readFileSync('firebase-database-rules.json', 'utf8')).rules;
const Purikura = require('./purikura-net.js');

let fail = 0;
const chk = (c, m) => { console.log((c ? '  ✓ ' : '  ✗ ') + m); if (!c) fail++; };
const say = m => console.log('\n' + m);

const at = p => p.split('/').reduce((o, k) => (o && o[k] !== undefined) ? o[k] : undefined, rules);
const w  = p => { const n = at(p); return n && n['.write']; };
const v  = p => { const n = at(p); return n && n['.validate']; };

/* ── 규칙식을 실제로 굴려보기 ────────────────────────────────────────
   규칙식은 === && || ?: % 만 쓰면 거의 그대로 JS 다. 스냅샷만 흉내내면 실행된다.
   눈으로 읽어서 맞는지 세는 것보다 굴려보는 쪽이 낫다 — 200 인지 199 인지는
   읽어서는 잘 안 보인다. */
function snap(val){
  return {
    exists(){ return val !== null && val !== undefined; },
    val(){ return val; },
    isNumber(){ return typeof val === 'number'; },
    isString(){ return typeof val === 'string'; },
    hasChildren(ks){ return ks.every(k => val && val[k] !== undefined); },
    hasChild(k){ return !!(val && val[k] !== undefined); },
    child(k){ return snap(val && val[k] !== undefined ? val[k] : null); }
  };
}
function run(expr, newVal, oldVal, now){
  return new Function('newData', 'data', 'now', 'return (' + expr + ');')(
    snap(newVal), snap(oldVal), now);
}
/* 규칙식 안에 박힌 «값의» 정규식을 꺼내온다 — .matches() 는 JS 에 없으니 이렇게 본다.
   ⚠️ 같은 식에 $i.matches(/^[0-3]$/) 도 들어 있다. 그냥 첫 번째를 집으면 자리 번호
     정규식을 값에 대고 재게 된다 — 그러면 검사가 통과해도 아무 의미가 없다.
     그래서 newData.val().matches(...) 만 골라 집는다. */
function reIn(expr){
  const m = /newData\.val\(\)\.matches\((\/(?:\\.|[^\/])+\/)\)/.exec(String(expr));
  return m ? eval(m[1]) : null;   // eslint-disable-line no-eval
}

/* ══════════════════════════════════════════════════════════════════ */
say('· §1 병합이 들어갔는가 · 배포할 수 있는 모양인가');
{
  chk(!!at('photoQuota'), 'photoQuota 가 최상위에 있다');
  chk(!!at('rooms/$room/_photo'), 'rooms/$room/_photo 가 있다');

  const keys = Object.keys(at('rooms/$room'));
  chk(keys.indexOf('_photo') >= 0 && keys.indexOf('_photo') < keys.indexOf('$memberId'),
      '★ _photo 는 $memberId 와일드카드보다 앞에 있는 이름 있는 자식이다 (_meta·chatLog 와 같은 방식)');

  /* ⚠️ 최상위 secretRooms 에도 $code 가 있다 — 그건 원래부터 있던 것이고 정상이다.
     여기서 보는 건 «이번에 붙인 두 덩어리» 안에 $code 가 남았는가뿐이다. */
  const mine = JSON.stringify([at('photoQuota'), at('rooms/$room/_photo')]);
  chk(mine.indexOf('$code') < 0, '★ 붙인 규칙에 $code 가 남아 있지 않다 ($room 으로 맞췄다 — 안 맞추면 배포가 거부된다)');
  chk(mine.indexOf('$room') > 0, '  ↳ 대신 $room 을 쓴다 (기존 rooms 와일드카드 이름)');

  /* Firebase 가 받는 값은 규칙 문자열(.read/.write/.validate) 아니면 객체뿐이다.
     조각 파일의 _설명·_읽는_법 은 값이 **배열**이라 그대로 넣으면 배포가 거부된다.
     이름이 _ 로 시작하는지가 아니라 «값의 모양»으로 본다 — _meta·_photo 는 정상 노드다. */
  const RULE_KEYS = ['.read', '.write', '.validate', '.indexOn'];
  const bad = [];
  (function walk(o, path){
    if (o === null || typeof o !== 'object' || Array.isArray(o)) return;
    for (const k of Object.keys(o)) {
      const v = o[k];
      if (RULE_KEYS.indexOf(k) >= 0) continue;
      if (Array.isArray(v)) { bad.push(path + '/' + k + ' (배열)'); continue; }
      if (v === null || typeof v !== 'object') { bad.push(path + '/' + k + ' (규칙이 아닌 값)'); continue; }
      walk(v, path + '/' + k);
    }
  })(rules, '');
  chk(bad.length === 0, '★ 설명 키(배열)가 안 남아 있다' + (bad.length ? ' — ' + bad.join(', ') : ''));
}

/* ══════════════════════════════════════════════════════════════════ */
say('· §2 하루 정원 규칙을 실제로 굴려본다 (요금을 정하는 자리)');
{
  const V = v('photoQuota');
  chk(typeof V === 'string', 'photoQuota 에 .validate 가 있다');
  chk(w('photoQuota') === true,
      '누구나 쓸 수 있다 — 이 앱은 구글 로그인이 선택이다 (stats/userCount 와 같은 등급)');

  const now = Date.UTC(2026, 7, 29, 3, 0, 0);          // 2026-08-29 12:00 KST
  const day = Purikura.kstDay(now);
  const CAP = Purikura.CAP_PER_DAY;

  chk(run(V, { day, n: 1 }, null, now), '아무도 안 찍었을 때 첫 장이 통과한다');
  chk(run(V, { day, n: 6 }, { day, n: 5 }, now), '정확히 1 증가는 통과한다');
  chk(!run(V, { day, n: 7 }, { day, n: 5 }, now), '★ 2 증가는 거부된다 (여러 장을 한 번에 못 태운다)');
  chk(!run(V, { day, n: 4 }, { day, n: 5 }, now), '★ 감소는 거부된다 (정원을 되돌리는 우회로가 없다)');
  chk(!run(V, { day, n: 5 }, { day, n: 5 }, now), '제자리 쓰기도 거부된다');

  chk(run(V, { day, n: CAP }, { day, n: CAP - 1 }, now),
      '마지막 ' + CAP + '번째 한 장은 통과한다');
  chk(!run(V, { day, n: CAP + 1 }, { day, n: CAP }, now),
      '★ ' + CAP + '을 넘기는 쓰기는 거부된다 — 규칙의 상한과 purikura-net.js 의 CAP_PER_DAY 가 같다');

  chk(run(V, { day, n: 1 }, { day: day - 86400000, n: CAP }, now),
      '★ 어제 다 썼어도 오늘은 1 부터 다시 시작한다 (자정에 되살아난다)');
  chk(!run(V, { day: day + 86400000, n: 1 }, { day, n: 5 }, now),
      '★ 내일 칸에 미리 써두는 짓이 막힌다');
  chk(!run(V, { day: day + 12345, n: 1 }, null, now),
      '하루(ms)의 배수가 아닌 day 는 거부된다');
  chk(!run(V, { day: day - 86400000, n: 1 }, null, now),
      '어제 칸에 쓰는 것도 거부된다 (하루가 지나면 그 칸은 닫힌다)');

  /* 자정 경계 — 규칙의 now+9h 조건과 kstDay 가 같은 순간에 넘어가야 한다.
     여기가 어긋나면 자정 전후 몇 분 동안 아무도 못 찍는다. */
  const mid = Purikura.reopenAt(now);                   // 다음 KST 자정(UTC ms)
  chk(run(V, { day: Purikura.kstDay(mid), n: 1 }, null, mid),
      '★ 자정이 되는 그 순간에도 쓰기가 통과한다 (경계에서 앱이 멎지 않는다)');
  chk(run(V, { day: Purikura.kstDay(mid - 1), n: 1 }, null, mid - 1),
      '  ↳ 자정 1ms 전도 통과한다');
}

/* ══════════════════════════════════════════════════════════════════ */
say('· §3 좌표가 별도 노드로 가는가 (세션당 1.7원 ↔ 24.4원)');
{
  chk(!!at('rooms/$room/_photo/p/$i'), '좌표는 rooms/$room/_photo/p 아래에 있다');

  /* ★★ 이번 세션에 실제로 밟은 지뢰 ★★
     방 프리즌스 리스너는 rooms/{방} 전체가 아니라 orderByKey().startAt('m') 으로 걸려 있다.
     "방 자식은 _meta · chatLog · 멤버('m'으로 시작) 세 종류뿐"이라는 전제 위에 선 최적화다.
     노드를 `photo` 라고 이름 붙이면 'p' > 'm' 이라 **방에 있는 사람 전원의 스냅샷에 딸려온다** —
     좌표가 10Hz 로 바뀌므로 그때마다 slots·meta·frames 까지 다시 내려가고,
     별도 노드로 뺀 이유(§2 ①)가 그 자리에서 무효가 된다. 화면에는 아무 표시도 안 난다.
     그래서 주석을 믿지 않고 firebase-init.js 에서 **실제 쿼리 값을 꺼내** 견준다. */
  const initSrc = fs.existsSync('firebase-init.js') ? fs.readFileSync('firebase-init.js', 'utf8') : '';
  chk(!!initSrc, 'firebase-init.js 를 읽었다 (없으면 아래 검사를 못 한다)');
  if (initSrc) {
    const m = /startAt\(\s*'([^']*)'\s*\)/.exec(initSrc);
    chk(!!m, '방 프리즌스 리스너의 startAt 값을 찾았다' + (m ? " — '" + m[1] + "'" : ''));
    if (m) {
      const cut = m[1];
      chk('_photo' < cut,
          "★ '_photo' 가 startAt('" + cut + "') 보다 앞선다 — 방 사람들의 프리즌스 스냅샷에 안 딸려온다");
      chk(!('photo' < cut),
          "  ↳ 밑줄을 빼면 'photo' > '" + cut + "' 라 전원에게 딸려간다 (그래서 밑줄이 필수다)");
      chk('_meta' < cut && 'chatLog' < cut, '  ↳ 같은 기준으로 _meta·chatLog 도 제외된다 (전제가 그대로다)');
    }
    /* 멤버를 세는 자리들은 전부 '_ 로 시작하면 멤버가 아니다' 로 짜여 있다.
       photo 였다면 이 셋을 다 통과해 유령 멤버 한 명으로 세어졌다. */
    chk((initSrc.match(/charAt\(0\) !== '_'|charAt\(0\) === '_'/g) || []).length >= 3,
        "★ 멤버 판정이 '_ 로 시작하면 멤버가 아니다' 규약을 쓰고 있다 — _photo 는 인원수에 안 잡힌다");
  }

  const memberV = v('rooms/$room/$memberId') || '';
  chk(!/photo|'p'|"p"/.test(memberV),
      '★ 프리즌스($memberId) 검증에 좌표가 섞여 들어가지 않았다 — 얹으면 구독자가 방 전원 8명이 된다');

  const pw = String(w('rooms/$room/_photo/p/$i'));
  chk(/slots'\)\.child\(\$i\)/.test(pw), '★ 자기 자리($i)가 있을 때만 그 칸에 쓸 수 있다 (남의 칸에 못 쓴다)');

  const pv = v('rooms/$room/_photo/p/$i');
  const re = reIn(pv);
  chk(!!re, '좌표 값의 모양을 정규식으로 못박아 뒀다');
  chk(re.test(Purikura.encPos(-0.42, 1.31)),
      '★ purikura-net.js 가 실제로 만드는 값이 통과한다 — ' + Purikura.encPos(-0.42, 1.31));
  chk(re.test('0,0') && re.test('-120,340'), '정수 두 개짜리 문자열이 통과한다');
  chk(!re.test('0.5,1.2'), '소수점은 거부된다 (자릿수가 늘면 바이트가 는다)');
  /* 👀🔄 꼬리 셋(시선 yaw·pitch + 몸 회전)이 붙은 다섯 칸도 받는다.
     **셋이 다 있거나 다 없거나**다 — 반쪽을 열어두면 읽는 쪽이 어느 축인지 못 정한다. */
  const five = Purikura.encPos(-0.42, 1.31, 0.35, -0.2, 1.5);
  chk(re.test(five), '★ 시선·몸 회전이 실린 다섯 칸이 통과한다 — ' + five);
  chk(!re.test('1,2,3') && !re.test('1,2,3,4'), '세 칸·네 칸은 거부된다 (꼬리 셋은 한 덩이다)');
  chk(!re.test('1,2,3,4,5,6'), '여섯 칸도 거부된다 — 필드를 더 늘리는 쓰기는 막혀 있다');
  const worst = Purikura.encPos(-2.24, 5.4, -1, -1, -Math.PI);
  chk(worst.length <= 24,
      '★ 꼬리를 다 붙여도 ' + worst.length + '자다 — 길이 상한(24) 안이다');
  chk(/length <= 24/.test(pv), '길이 상한이 있다');

  const evv = v('rooms/$room/_photo/ev/$i');
  chk(!!at('rooms/$room/_photo/ev/$i/$other') && at('rooms/$room/_photo/ev/$i/$other')['.validate'] === false,
      '점프·포즈에 임의의 필드를 못 붙인다');
  chk(/'jump'|'pose'/.test(v('rooms/$room/_photo/ev/$i/k')), '사건 종류는 jump·pose 둘뿐이다');
}

/* ══════════════════════════════════════════════════════════════════ */
say('· §4 프레임은 https URL 만 (dataURL 이면 다운로드 단가가 40배)');
{
  const fv = v('rooms/$room/_photo/frames/$i');
  const re = reIn(fv);
  chk(!!re, '프레임 값에 모양 검사가 있다');
  chk(re.test('https://firebasestorage.googleapis.com/v0/b/x/o/f.webp?alt=media'),
      'Storage URL 은 통과한다');
  chk(!re.test('data:image/webp;base64,UklGRg'),
      '★ dataURL 은 거부된다 (app.js 의 ROOM_FACE_SEND_DATAURL=false 와 같은 이유)');
  chk(!re.test('http://example.com/f.webp'), 'http 는 거부된다');
  chk(/length <= 512/.test(fv), '★ 길이 상한이 마지막 방어선이다 — 이게 없으면 긴 문자열이 그대로 들어온다');
}

/* ══════════════════════════════════════════════════════════════════ */
say('· §5 기존 앱이 쓰던 길이 안 막혔는가 (잠그는 사고가 더 크다)');
{
  chk(w('rooms/$room/_meta') === true, '방 메타 쓰기는 그대로다');
  chk(w('rooms/$room/chatLog/$msgId') === true, '채팅 로그 쓰기는 그대로다');
  chk(w('rooms/$room/$memberId') === true, '프리즌스 쓰기는 그대로다');
  chk(w('rooms/$room') === '!newData.exists()', '★ 방 삭제 경로가 그대로다 — 이게 photo 노드 청소도 받아준다');
  chk(at('rooms')['.read'] === true, '방 읽기는 그대로다');
  chk(w('stats/userCount') === true, '누적 이용자 수 쓰기는 그대로다');
}

/* ══════════════════════════════════════════════════════════════════ */
say('· §6 어댑터 경계 — null 을 삭제로 읽지 않는가');
{
  /* purikura-net.js 는 "쓰지 않는다"를 null 로 돌려준다. firebase 의 runTransaction 은
     null 을 **삭제**로 읽고 커밋한다(중단은 undefined). 그대로 넘기면 200번째 다음 사람이
     photoQuota 를 지우고 카운터가 0 부터 다시 시작한다 — 규칙도 못 막는다(.validate 는
     삭제에 안 돈다). 화면에는 아무 표시가 안 나고 오히려 "잘 찍힌다".
     firebase-init.js 는 ESM 이라 node 에서 못 굴리므로, 아래 둘을 각각 확인한다. */
  const day = Purikura.kstDay(Date.now());
  chk(Purikura.quotaNext({ day, n: Purikura.CAP_PER_DAY }, day) === null,
      '★ 정원이 다 찼을 때 계층이 null 을 돌려준다 (= 위험이 살아 있다)');

  const src = fs.existsSync('firebase-init.js') ? fs.readFileSync('firebase-init.js', 'utf8') : '';
  const i = src.indexOf('pkTransaction(');
  const body = i >= 0 ? src.slice(i, i + 900) : '';
  chk(i >= 0, 'firebase-init.js 에 pkTransaction 어댑터가 있다');
  chk(/===\s*null\s*\)\s*\?\s*undefined/.test(body),
      '★ 어댑터가 null 을 undefined(중단)로 바꿔서 넘긴다 — 이 한 줄이 하루 정원을 지킨다');
  chk(/committed/.test(body) && /snapshot/.test(body),
      '  ↳ {committed, value} 모양으로 돌려준다 (계층이 그 모양만 본다)');

  const need = ['pkGet', 'pkSet', 'pkUpdate', 'pkRemove', 'pkTransaction', 'pkOnValue', 'pkOnDisconnectRemove'];
  const miss = need.filter(n => src.indexOf(n + '(') < 0);
  chk(miss.length === 0, '어댑터 7개가 전부 있다' + (miss.length ? ' — 빠짐: ' + miss.join(', ') : ''));
  chk(/return \(\) => \{ try\{ un\(\); \}/.test(src),
      '★ pkOnValue 가 해제 함수를 돌려준다 (삼키면 구독이 영영 안 끊긴다)');
}

console.log(fail ? '\n✗ ' + fail + '곳 실패' : '\n전부 통과 ✅ — 병합된 규칙이 요금과 앱 둘 다 지키고 있다');
process.exit(fail ? 1 : 0);
