/*
 * 📱 폰 연결 주소에 낀 공백 떼기 — mobileLink/{key}/state 쓰기마다, key 에 공백이 있으면 공백을 뺀 정상 칸으로 옮긴다.
 *   폰 «단축어» 는 우리 앱 · 페이지를 거치지 않고 REST 로 바로 쓴다. 주소를 붙여 넣다 사용자 코드 앞뒤에 공백이 끼면
 *   신호가 mobileLink/« umu…»/state 로 가고, PC 앱은 정상 칸만 지켜보니 포커스 시간이 안 쌓인다(10-17 운영에서 실제로 1건).
 *   규칙이 이런 칸은 «공백 뺀 코드의 연결 키와 맞는 state» 만 받는다. 관리자 SDK 는 규칙을 건너뛰므로 여기서도 똑같이 본다.
 * 옮기는 조건은 폰이 정상 칸에 쓸 때와 같다 — 연결 키가 맞고 PC 가 켜져 있을 때(live). 아니면 공백 칸만 지운다.
 * 공백 없는 칸(거의 전부)은 아무것도 읽지 않고 끝난다. firebase-admin 은 무거워서 index.js 가 부를 때 넘긴다.
 */
'use strict';
const USER_CODE_RE = /^[uU][0-9a-zA-Z]{8,40}$/;   // 규칙 · 앱 _setMyUserId 와 같은 모양
const LINK = 'mobileLink';
const KEYS = 'mobileKeys';

const fixedKey = (key) => String(key).replace(/ /g, '');

/* 돌려주는 것(검사 · 로그용): 'skip' 정상 칸 · 'gone' 지워진 쓰기 · 'bad' 공백을 빼도 사용자 코드가 아님 ·
   'mismatch' 연결 키가 다름 · 'off' PC 꺼짐 · 'moved' 옮김 */
async function runMobileLinkTrim(db, key, val){
  if (typeof key !== 'string') return 'skip';
  const fixed = fixedKey(key);
  if (fixed === key) return 'skip';
  if (val == null) return 'gone';
  const dropSpaced = () => db.ref(`${LINK}/${key}`).remove();
  if (!USER_CODE_RE.test(fixed) || fixed === 'undefined') { await dropSpaced(); return 'bad'; }
  const [want, live] = await Promise.all([
    db.ref(`${KEYS}/${fixed}`).get().then((s) => s.val()),
    db.ref(`${LINK}/${fixed}/live`).get().then((s) => s.exists()),
  ]);
  if (!want || !val || typeof val !== 'object' || val.key !== want) { await dropSpaced(); return 'mismatch'; }
  if (!live) { await dropSpaced(); return 'off'; }
  await db.ref().update({ [`${LINK}/${fixed}/state`]: val, [`${LINK}/${key}`]: null });
  return 'moved';
}

module.exports = { runMobileLinkTrim, fixedKey, USER_CODE_RE };
