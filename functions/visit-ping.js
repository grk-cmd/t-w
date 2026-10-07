/*
 * IP 기준 일일 방문자 — 앱이 켜질 때 한 번 부르는 visitPing(호출형) 의 로직. 로그인하지 않은 사람도 센다.
 *   metrics/daily/{YYYY-MM-DD}/ip/{해시} = true   (같은 IP 는 하루 1번 — 키 수가 «IP 기준 방문자»)
 *   metrics/daily/{YYYY-MM-DD}/pings    += 1      (중복 포함 앱 실행 수 · 로그인 안 한 사람 포함)
 * 광고 제휴처가 «IP 기준 하루 1회 방문» 을 요구할 때 쓰는 숫자다.
 * IP 원문은 어디에도 남기지 않는다. 해시는 날짜를 섞어 날마다 바뀌므로 다른 날끼리 같은 사람을 이을 수 없고,
 * 비밀 값(METRICS_IP_SALT)을 섞어 IPv4 전체(약 43억 개)를 돌려 맞춰 보는 것도 막는다.
 * 그래서 IP 기준으로는 주간 · 월간 고유 방문자를 낼 수 없다 — 일부러 그렇게 만든 것이다.
 */
'use strict';
const crypto = require('crypto');
const { kstDateKey, METRICS_DAILY } = require('./daily-active');

const IP_HASH_LEN = 16;
const IPV4_MAPPED = '::ffff:';

// 호출형 함수는 Google 프런트엔드 뒤에서 돈다 — 프런트엔드는 실제 접속 주소를 x-forwarded-for **맨 뒤**에 덧붙인다.
// 맨 앞은 부르는 쪽이 직접 실어 보낸 값일 수 있어서 쓰지 않는다(dev 에서 가짜 헤더 3번으로 방문자가 3 늘어나는 것을 확인).
function clientIp(rawRequest){
  if (!rawRequest) return null;
  const headers = rawRequest.headers || {};
  let xff = headers['x-forwarded-for'];
  if (Array.isArray(xff)) xff = xff.join(',');
  const parts = typeof xff === 'string' ? xff.split(',').map((v) => v.trim()).filter(Boolean) : [];
  let ip = parts.length ? parts[parts.length - 1] : '';
  if (!ip && typeof rawRequest.ip === 'string') ip = rawRequest.ip.trim();
  if (ip.toLowerCase().startsWith(IPV4_MAPPED)) ip = ip.slice(IPV4_MAPPED.length);
  return ip || null;
}

function ipHash(ip, dateKey, secret){
  return crypto.createHmac('sha256', String(secret)).update(dateKey + '|' + ip).digest('hex').slice(0, IP_HASH_LEN);
}

// increment 는 검사에서 바꿔 끼우려고 받는다. firebase-admin/database 는 쓸 때 처음 읽는다(index.js 맨 위 ⚠️).
function visitPingUpdates(ip, nowMs, secret, increment){
  if (typeof ip !== 'string' || !ip) return null;
  const inc = increment || ((n) => require('firebase-admin/database').ServerValue.increment(n));
  const day = kstDateKey(nowMs);
  const base = METRICS_DAILY + '/' + day;
  return {
    [base + '/ip/' + ipHash(ip, day, secret)]: true,
    [base + '/pings']: inc(1),
  };
}

// 비밀 값이 없으면(시크릿 설정 전) 적지 않는다 — 비밀 없는 해시는 IPv4 전체를 돌려 IP 를 되찾을 수 있다.
// 무엇을 받든 같은 { ok: true } 만 돌려준다 — 부른 쪽에 아무것도 알려 주지 않는다. data 의 ver 는 지금 쓰지 않는다.
async function runVisitPing(db, request, nowMs, secret, increment){
  if (!secret) return null;
  const updates = visitPingUpdates(clientIp(request && request.rawRequest), nowMs, secret, increment);
  if (!updates) return null;
  await db.ref().update(updates);
  return updates;
}

module.exports = { clientIp, ipHash, visitPingUpdates, runVisitPing, IP_HASH_LEN };
