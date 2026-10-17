/* ═══ 💬 채팅 탭(채널) — parts/chat-tabs.js ═══════════════════════════════════════
   투게더룸 · 시크릿룸 대화창의 탭(#일반 + 방장이 만든 최대 2개). 화면 · Firebase 를 안 보는 순수 규칙만.
   ⚠️ 이름 주의 — 코드의 `channel` 은 이미 「워킹룸/투게더룸」 뜻이다(_meta.channel · _activeChannel).
     그래서 여기는 **tab** 으로 부른다. 화면 글자만 「채널」.
   ★ 데이터: rooms/{방}/_meta/tabs/{tabId} = {name, ts}  ·  #일반 기록 = rooms/{방}/chatLog(예전 그대로)
             그 외 탭 기록 = rooms/{방}/_chatTab/{tabId}/{msgId}
     ⚠️ `_chatTab` 은 `_` 로 시작해야 한다. 방 인원을 세는 모든 자리(구버전 포함)가 «`_` 시작 · chatLog 가 아닌 키» 를
       멤버로 센다 — `chatTab` 으로 두면 구버전이 그걸 사람으로 세서 방이 안 사라진다(유령 방).
   ⚠️ app.js 보다 먼저 싣는다(classic script · window.ChatTabs). 검사 sim-chat-tabs.js 가 node 로 돌린다. */
(function(root){
  'use strict';
  const GENERAL = 'general';
  const GENERAL_NAME = '일반';
  /* #일반 제외 최대 2개 — **자리 이름이 곧 상한이다**(s1 · s2). RTDB 규칙에는 자식 수를 세는 함수가 없어서
     (numChildren 없음 — 에뮬레이터가 규칙 전체를 거부한다) 규칙은 `$tabId` 를 s1|s2 로만 받는다. */
  const MAX_EXTRA = 2;
  const SLOTS = ['s1', 's2'];
  const NAME_MAX = 10;
  const LOG_NODE = '_chatTab';

  /* _meta.tabs → [{id, name, ts}] (#일반이 맨 앞, 나머지는 만든 순). 이상한 값은 버린다. */
  function list(metaTabs){
    const out = [{ id: GENERAL, name: GENERAL_NAME, ts: 0 }];
    const t = (metaTabs && typeof metaTabs === 'object') ? metaTabs : {};
    Object.keys(t).filter(id => SLOTS.includes(id) && t[id] && typeof t[id].name === 'string')
      .sort((a, b) => ((t[a].ts || 0) - (t[b].ts || 0)) || (a < b ? -1 : 1))
      .slice(0, MAX_EXTRA)
      .forEach(id => out.push({ id, name: t[id].name.slice(0, NAME_MAX), ts: t[id].ts || 0 }));
    return out;
  }
  /* [+] — 방장만 · #일반 포함 3개가 다 차면 숨긴다. */
  function canAdd(isHost, metaTabs){ return !!isHost && list(metaTabs).length < 1 + MAX_EXTRA; }
  /* 탭 이름 — 앞뒤 공백 · # 를 떼고 10자. 문제가 있으면 { err }. */
  function cleanName(raw, metaTabs, exceptId){
    const n = String(raw == null ? '' : raw).trim().replace(/^#+/, '').trim();
    if(!n) return { err: '이름을 적어 주세요' };
    if(n.length > NAME_MAX) return { err: '이름은 ' + NAME_MAX + '자까지예요' };
    if(n === GENERAL_NAME) return { err: '#' + GENERAL_NAME + '은 이미 있어요' };
    if(list(metaTabs).some(t => t.id !== exceptId && t.name === n)) return { err: '같은 이름의 채널이 있어요' };
    return { name: n };
  }
  /* 지금 있는 탭이 지워졌으면 #일반으로. */
  function resolve(tabId, metaTabs){
    return list(metaTabs).some(t => t.id === tabId) ? tabId : GENERAL;
  }
  /* 사람 한 명의 탭 — presence 에 tab 이 없으면(구버전 포함) #일반. */
  const tabOf = (p) => (p && typeof p.tab === 'string' && p.tab) ? p.tab : GENERAL;
  /* 탭별 인원 — people: [{tab}], 없어진 탭에 있던 사람은 #일반으로 센다. */
  function counts(people, metaTabs){
    const ids = list(metaTabs).map(t => t.id), c = {};
    ids.forEach(id => { c[id] = 0; });
    (people || []).forEach(p => { const t = tabOf(p); c[ids.includes(t) ? t : GENERAL]++; });
    return c;
  }
  /* 기록 경로 — #일반은 예전 chatLog 그대로(구버전이 보는 자리). */
  function logPath(room, tabId){
    return (!tabId || tabId === GENERAL) ? 'rooms/' + room + '/chatLog' : 'rooms/' + room + '/' + LOG_NODE + '/' + tabId;
  }
  /* 읽음 · 입장 컷 · 지우기를 탭마다 따로 두려고 쓰는 키 — #일반은 예전 방 코드 그대로(기존 표식 유지). */
  function markKey(room, tabId){ return (!tabId || tabId === GENERAL) ? room : room + '#' + tabId; }
  /* 빈 자리 — 없으면 null(다 찼다). 지운 탭의 자리는 다시 쓴다(지울 때 기록도 같이 지우므로 섞이지 않는다). */
  function freeSlot(metaTabs){
    const t = (metaTabs && typeof metaTabs === 'object') ? metaTabs : {};
    return SLOTS.find(id => !t[id]) || null;
  }

  const api = { GENERAL, GENERAL_NAME, MAX_EXTRA, SLOTS, NAME_MAX, LOG_NODE, list, canAdd, cleanName, resolve, tabOf, counts, logPath, markKey, freeSlot };
  if(typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.ChatTabs = api;
})(typeof window !== 'undefined' ? window : this);
