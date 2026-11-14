/* ═══ 🕒 sim-room-order.js — 입장순은 서버 시계로 · 시크릿룸 옛 uid 는 말해 준다 (2026-09-17 제보 2·4) ═══════
   [무엇을 지키나]
   ・(1절 걷음) Firebase 방의 memberId 입장순 — 0.13 방은 realtime 서버가 자리 id 와 입장순을 정한다.
   ・3절: 시크릿룸 방장 판정은 앱에 없다(서버 meta.host) · «버린 uid» 갈래도 없다.
   [실행] app.js · firebase-init.js 가 있는 폴더에서(러너 스테이징이면 깊은 자리에서 끌어올린다). 판정 줄은 맨 끝. */
'use strict';
const { joinRenderer: _joinRenderer } = require('./sim-renderer-src.js');   // 앱 FSD 로 옮긴 모듈을 «옮기기 전 app.js 글» 로 되살려 읽는다
const fs = require('fs');
const SRC = _joinRenderer(fs.readFileSync('app.js', 'utf8'));
const FB  = fs.readFileSync('firebase-init.js', 'utf8');

let pass = 0, fail = 0;
const say = (s) => console.log(s);
const chk = (ok, msg) => { ok ? pass++ : fail++; say('  ' + (ok ? '✓' : '✗') + ' ' + msg); };
const strip = (s) => s.replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/(^|[^:])\/\/[^\n]*/g, '$1 ');

/* ── 3. 입장 — «버린 uid» 안내는 걷었다 (개정 56 · 회원가입 설계 §6-⑥) ──
   예전엔 pub.owner 가 «이 기기가 버린 uid» 면 재발급 안내 토스트를 띄웠다. 그 목록(tw.myPrevUserIds)이 걷혔다 —
   이 기기의 이전 uid 는 이제 다른 계정이다. 방장 판정은 그대로 pub.owner 문자열 하나로 방 전원이 같은 계산을 한다. */
say('── 3. 시크릿룸 방장 — 앱이 판정하지 않는다(서버 meta.host = 발급 대상) · «버린 uid» 갈래 없음');
{
  const code = SRC.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/mg, '');
  chk(!/_iAmSrOwner|_srOwnerUid/.test(code), '앱에 시크릿룸 방장 판정 · 자기 퇴장 게이트 값이 없다(0.13 — 서버가 방장을 고정)');
  chk(!/_isMyPrevUserId/.test(code) && !/function _isMyPrevUserId\(|tw\.myPrevUserIds['"]\)\s*\|\|/.test(code), '  _isMyPrevUserId · 버린 uid 목록이 없다 (개정 56)');
}

say('\n결과: 통과 ' + pass + ' · 실패 ' + fail);
process.exit(fail ? 1 : 0);
