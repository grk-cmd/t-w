/*
 * 방에 싣는 칸 ↔ 방 포트 짝 맞추기 — presence.js 가 방에 싣는 칸 · 부르는 provider 메서드가 room-rt.js 와 어긋나지 않는지.
 * 서버는 모르는 칸이 하나라도 있으면 patch 를 통째로 거절하고, room-rt.js 는 MEMBER_FIELDS 밖의 칸을 조용히 거른다 —
 * 칸을 새로 실으면서 MEMBER_FIELDS(와 서버 통신 규약 3장)를 안 늘리면 그 칸이 남에게 안 보인다.
 * 1. _basePayload · 입장(provider.join) · setName 이 싣는 칸 ⊆ MEMBER_FIELDS ∪ {def, chat, chatTab} — userId · lic 는 걷었다(서버 badRequest)
 * 2. presence.js 가 부르는 provider 메서드 ⊆ 방 포트 provider 메서드(진짜 room-rt.js 로 만들어 본다)
 */
'use strict';
const { joinRenderer: _joinRenderer } = require('./sim-renderer-src.js');   // 앱 FSD 로 옮긴 모듈을 «옮기기 전 app.js 글» 로 되살려 읽는다
const fs = require('fs');
let pass = 0, fail = 0;
const say = (s) => console.log(s);
const chk = (ok, msg) => { ok ? pass++ : fail++; say('  ' + (ok ? '✓' : '✗') + ' ' + msg); };
const read = (f) => { try{ return fs.readFileSync(f, 'utf8'); }catch(_){ return null; } };
const NET = read('room-rt.js'), APP = _joinRenderer(read('app.js'));
for(const [n, v] of [['room-rt.js', NET], ['app.js', APP]]){
  if(!v){ say('  ? 원본 못 찾음 — ' + n); process.exit(2); }
}

// from 위치의 { 부터 짝이 맞는 } 까지(문자열 · 주석은 이 자리들에 없어서 괄호만 센다)
function braceBlock(src, from){
  const i = src.indexOf('{', from);
  if(i < 0) return null;
  let d = 0;
  for(let j = i; j < src.length; j++){
    const ch = src[j];
    if(ch === '{' || ch === '(' || ch === '[') d++;
    else if(ch === '}' || ch === ')' || ch === ']'){ d--; if(d === 0) return src.slice(i, j + 1); }
  }
  return null;
}
// 객체 글자 맨 바깥 칸 이름 · 펼치기(...f()) 이름
function topKeys(obj){
  const keys = [], spreads = [];
  let d = 0, start = 1;
  const parts = [];
  for(let j = 1; j < obj.length - 1; j++){
    const ch = obj[j];
    if(ch === '{' || ch === '(' || ch === '[') d++;
    else if(ch === '}' || ch === ')' || ch === ']') d--;
    else if(ch === ',' && d === 0){ parts.push(obj.slice(start, j)); start = j + 1; }
  }
  parts.push(obj.slice(start, obj.length - 1));
  for(const p of parts){
    const t = p.trim();
    if(!t) continue;
    let m;
    if((m = t.match(/^\.\.\.\s*(\w+)\s*\(/))) spreads.push(m[1]);
    else if((m = t.match(/^(\w+)\s*:/))) keys.push(m[1]);
    else if((m = t.match(/^(\w+)$/))) keys.push(m[1]);
    else keys.push('?' + t.slice(0, 20));
  }
  return { keys, spreads };
}
// 펼치기 함수가 돌려주는 객체 칸(두 갈래 return 이면 둘 다)
function spreadKeys(name){
  const at = APP.indexOf('function ' + name + '(');
  if(at < 0) return null;
  const body = braceBlock(APP, at);
  const out = new Set();
  for(const m of body.matchAll(/return\b[^;{]*\{[^{}]*\}/g)){
    const o = m[0].slice(m[0].indexOf('{'));
    for(const k of topKeys(o).keys) out.add(k);
  }
  return [...out];
}
function payloadKeys(obj){
  const { keys, spreads } = topKeys(obj);
  const all = keys.slice();
  for(const s of spreads){ const k = spreadKeys(s); if(k) all.push(...k); else all.push('?...' + s); }
  return all;
}

say('── 1. 방에 싣는 칸 ⊆ 서버 멤버 칸');
const R = (() => { const m = { exports: {} }; new Function('module', 'window', NET)(m, undefined); return m.exports; })();
chk(Array.isArray(R.MEMBER_FIELDS) && R.MEMBER_FIELDS.length >= 10, 'room-rt.js MEMBER_FIELDS 를 받음(' + (R.MEMBER_FIELDS || []).length + ')');
const FIELDS = new Set(R.MEMBER_FIELDS || []);
const ALLOWED = new Set([...FIELDS, 'def', 'chat', 'chatTab']);
const bad = (ks) => ks.filter((k) => !ALLOWED.has(k));

const bpAt = APP.indexOf('function _basePayload(');
const bp = bpAt >= 0 ? braceBlock(APP, APP.indexOf('return', bpAt)) : null;
const bpKeys = bp ? payloadKeys(bp) : [];
chk(bpKeys.length >= 10 && bad(bpKeys).length === 0, '_basePayload 칸 ' + bpKeys.length + '개가 다 서버 멤버 칸' + (bad(bpKeys).length ? ' — 밖: ' + bad(bpKeys).join(', ') : ''));
chk(['cyc', 'clv', 'starC'].every((k) => bpKeys.includes(k)), '  ↳ 펼치기(...myStarOut())의 칸까지 본다');

const jAt = APP.indexOf('provider.join(room, {');
const jp = jAt >= 0 ? braceBlock(APP, jAt) : null;
const jKeys = jp ? payloadKeys(jp) : [];
chk(jKeys.length >= 10 && jKeys.includes('def') && bad(jKeys).length === 0, '입장(provider.join) 칸 ' + jKeys.length + '개가 다 서버 멤버 칸 ∪ {def}' + (bad(jKeys).length ? ' — 밖: ' + bad(jKeys).join(', ') : ''));

const snAt = APP.indexOf('function setName(');
const sn = snAt >= 0 ? braceBlock(APP, snAt) : '';
const snObj = (sn.match(/Object\.assign\(_basePayload\(\), (\{[^{}]*\})\)/) || [])[1];
const snKeys = snObj ? topKeys(snObj).keys : [];
chk(snKeys.length > 0 && bad(snKeys).length === 0, 'setName 이 더 싣는 칸(' + snKeys.join(', ') + ')도 서버 멤버 칸');

const extra = [...APP.matchAll(/provider\.update\(Object\.assign\(_basePayload\(\), (\{[^{}]*\})\)\)/g)].flatMap((m) => topKeys(m[1]).keys);
chk(extra.length >= 3 && bad(extra).length === 0, '_basePayload 에 덧붙여 보내는 칸(' + [...new Set(extra)].join(', ') + ')도 허용 안');

say('── 2. presence 가 부르는 provider 메서드 ⊆ 방 포트 provider 메서드');
const PRES = read('presence.js') || '';
const used = [...new Set([...PRES.matchAll(/\bprovider\.(\w+)\s*\(/g)].map((m) => m[1]))];
const hub = { onMessage(){}, onState(){}, send: () => false, request: () => Promise.resolve(null), state: () => 'off', isReady: () => false, userCode: () => null };
const rt = R.createRoomRt({ hub, STATE: { READY: 'ready', OFF: 'off', SESSION_LOST: 'sessionLost', UPDATE: 'update', AUTH_FAILED: 'authFailed' } });
const prov = rt.makeProvider({}, null);
const missing = used.filter((k) => typeof prov[k] !== 'function');
chk(used.length >= 5 && missing.length === 0, 'presence 가 부르는 ' + used.join(' · ') + ' 를 방 포트 provider 가 다 가진다' + (missing.length ? ' — 없음: ' + missing.join(', ') : ''));

say(fail ? `\n✗ 실패 ${fail}건` : `\n전부 통과 ✅ (${pass}건)`);
process.exit(fail ? 1 : 0);
