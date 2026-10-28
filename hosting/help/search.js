/* 도움말 검색 — 질문을 쳐 넣으면 검색표(/search.json · scripts/build-help-search.js 가 만든다)에서 맞는 FAQ · 소제목을 찾아
   맨 위 하나를 «답» 으로, 나머지를 «관련 내용» 으로 보여 준다. 누르면 그 편의 그 소제목(#sN)으로 간다.
   서버 · 바깥 요청 없이 이 사이트 안에서만 찾는다. 검색어는 연관어 거미줄(words)의 이웃 낱말로 넓혀 찾는다.
   글은 모두 textContent 로 넣는다(검색어 · 검색표 글을 HTML 로 읽지 않는다).
   규칙(아래 core)은 DOM 없이 돌아서 checks/sim-help-search.js 가 그대로 불러 시험한다. */
(function(){
  'use strict';

  var MAX_Q = 100;          // 검색어 글자 상한
  var MAX_TERMS = 8;
  var PREFIX = 0.9;         // 앞만 같은 거미줄 마디(친구추가 → 친구) — 꼭 맞는 것보다 조금 가볍게
  var NEAR = 0.6;           // 연관어로 맞았을 때 무게 — 묶음에 k 가 없을 때(검색어 그대로 = 1)
  var LIST = 5;             // «관련 내용» 줄 수
  var PER_PAGE = 2;         // 한 편에서 보여 줄 조각 수(같은 편이 목록을 채우지 않게)
  var MIN_SCORE = 0.5;      // 이보다 낮으면 «못 찾음»
  var NEAR_ANSWER = 0.35;   // «관련 내용» 은 답 점수의 이만큼은 돼야 — 연관어로 스치기만 한 먼 글은 빼려고

  // 붙은 말끝 — 긴 것부터 본다
  var ENDINGS = ['하는방법', '하려면', '으려면', '하는법', '하나요', '되나요', '있나요', '없나요', '인가요', '할까요',
    '려면', '나요', '까요', '하기', '하는', '하면', '해요', '해서', '어요', '아요', '에서', '으로', '에게', '한테', '까지', '부터',
    '이랑', '에는', '은', '는', '이', '가', '을', '를', '에', '도', '로', '와', '과', '의', '만', '요'];
  var SHORT_ENDINGS = { '은': 1, '는': 1, '을': 1, '를': 1 };   // 두 글자 낱말(옷을 · 귀는)에서도 떼는 것
  var STOP = {};
  ('어떻게 어떡해 어디 어디서 어디에 뭐 뭐야 무엇 무슨 방법 법 왜 좀 수 있어 있나 하나 되나 알려줘 알려 주세요 해줘 하고 싶어 싶은데 ' +
   '그리고 내 제 나 저 확인 보 보기 찾 찾기 하기 하는 하다 할 해 하면 되 돼 돼요 안 가능 할수 있 있어요 원해요 지금 몇 ' +
   '가려면 가는 가기 갈 쓰려면 쓰고 쓰는 쓸 사용 사용하')
    .split(' ').forEach(function(w){ STOP[w] = 1; });

  function norm(s){
    return String(s == null ? '' : s).normalize('NFC').toLowerCase().replace(/[^0-9a-z가-힣]+/g, ' ').trim();
  }
  function compact(s){ return norm(s).replace(/ /g, ''); }
  function stem(w){
    for(var i = 0; i < ENDINGS.length; i++){
      var e = ENDINGS[i];
      if(w.length <= e.length || w.slice(-e.length) !== e) continue;
      var rest = w.slice(0, -e.length);
      if(rest.length >= 2 || (rest.length === 1 && SHORT_ENDINGS[e])) return rest;
    }
    return w;
  }
  /* 질문 → 찾을 낱말들(말끝 떼고 · 군말 빼고 · 겹침 없이) */
  function terms(q){
    var out = [];
    norm(String(q == null ? '' : q).slice(0, MAX_Q)).split(' ').forEach(function(w){
      if(!w || STOP[w] || ENDINGS.indexOf(w) >= 0) return;
      var s = stem(w);
      if(!s || STOP[s] || out.indexOf(s) >= 0) return;
      out.push(s);
    });
    return out.slice(0, MAX_TERMS);
  }

  /* 거미줄: 한 묶음의 낱말끼리 서로 이웃 · 줄 무게는 묶음의 k(없으면 NEAR) — 두 묶음에 같이 있으면 무거운 쪽 */
  function graphOf(words){
    var g = {};
    (words || []).forEach(function(group){
      var list = Array.isArray(group) ? group : (group && group.w) || [];
      var k = Array.isArray(group) || !(group.k > 0 && group.k <= 1) ? NEAR : group.k;
      var ws = list.map(compact).filter(Boolean);
      ws.forEach(function(w){
        if(!g[w]) g[w] = {};
        ws.forEach(function(o){ if(o !== w && !(g[w][o] >= k)) g[w][o] = k; });
      });
    });
    return g;
  }
  /* 낱말 하나 → [{w, k}] — 자기 자신(1)과 거미줄 이웃(줄 무게). 바꾸려 → 바꾸 처럼 앞이 같으면 같은 마디로 본다 */
  function expand(graph, t){
    var best = {}; best[t] = 1;
    Object.keys(graph).forEach(function(key){
      var hit = key === t || (key.length >= 2 && t.indexOf(key) === 0) || (t.length >= 2 && key.indexOf(t) === 0);
      if(!hit) return;
      var via = key === t ? 1 : PREFIX;
      if(!(best[key] >= via)) best[key] = via;
      Object.keys(graph[key]).forEach(function(n){ var k = graph[key][n] * via; if(!(best[n] >= k)) best[n] = k; });
    });
    return Object.keys(best).map(function(w){ return { w: w, k: best[w] }; });
  }
  /* 띄어 친 두 낱말을 붙인 것이 거미줄 마디면 하나로(첫 화면 → 첫화면 · 메인 화면 → 메인화면) */
  function joinSpaced(graph, ts){
    var out = [];
    for(var i = 0; i < ts.length; i++){
      if(i + 1 < ts.length && graph[ts[i] + ts[i + 1]]){ out.push(ts[i] + ts[i + 1]); i++; }
      else out.push(ts[i]);
    }
    return out;
  }

  function bigramHit(w, text){
    if(w.length < 3) return 0;
    var n = 0, all = w.length - 1;
    for(var i = 0; i < all; i++) if(text.indexOf(w.substr(i, 2)) >= 0) n++;
    return n / all;
  }
  function count(text, w){
    var n = 0, i = text.indexOf(w);
    while(i >= 0 && n < 3){ n++; i = text.indexOf(w, i + w.length); }
    return n;
  }
  /* 한 낱말 묶음(낱말 + 이웃)이 한 문서에 얼마나 맞나 — 이웃 가운데 가장 잘 맞는 것 하나만 센다(이웃 수로 부풀지 않게) */
  function termScore(ex, doc, headW){
    var best = 0;
    ex.forEach(function(e){
      var s = 0;
      // 한 글자(방 · 색)는 다른 낱말 속(방향키 · 방법 · 색칠)에도 걸려서 어디서 맞든 가볍게
      var one = e.w.length === 1;
      if(doc.ch.indexOf(e.w) >= 0) s = one ? 1.2 : headW;
      else if(doc.cp.indexOf(e.w) >= 0) s = one ? 0.6 : 1.5;
      else {
        var c = count(doc.cb, e.w);
        if(c) s = one ? 0.4 : 1 + (c - 1) * 0.25;
        else { var f = bigramHit(e.w, doc.cb); if(f >= 0.6) s = f * 0.8; }
      }
      if(s * e.k > best) best = s * e.k;
    });
    return best;
  }

  /* 검색표 → 찾기 좋은 모양(한 번만) */
  function prepare(index){
    var pages = {};
    (index.pages || []).forEach(function(p){ pages[p.s] = p; });
    var docs = [];
    (index.faq || []).forEach(function(f){
      var pg = pages[f.p] || { t: '' };
      docs.push({ faq: true, p: f.p, a: f.a, h: f.q[0], t: f.t, page: pg,
        ch: compact(f.q.join(' ')), cp: compact(pg.t), cb: compact(f.t) });
    });
    (index.chunks || []).forEach(function(c){
      var pg = pages[c.p] || { t: '' };
      docs.push({ faq: false, p: c.p, a: c.a, h: c.h, t: c.t, page: pg,
        ch: compact(c.h), cp: compact(pg.t), cb: compact(c.t) });
    });
    return { docs: docs, graph: graphOf(index.words) };
  }

  /* 질문 → { terms, answer, list } — answer 는 가장 잘 맞는 하나(없으면 null), list 는 같은 자리를 겹치지 않은 나머지 */
  function search(prep, q){
    var ts = terms(q);
    if(!ts.length) return { terms: ts, words: [], answer: null, list: [] };
    ts = joinSpaced(prep.graph, ts);
    // 다른 낱말이 있으면 거미줄에 없는 한 글자(치는 중인 «버전 정» 의 정)는 뺀다 — 설정 · 정해 같은 데 다 걸려 앞 낱말을 덮는다
    if(ts.length > 1) ts = ts.filter(function(t){ return t.length > 1 || prep.graph[t]; });
    var res = { terms: ts, words: [], answer: null, list: [] };
    var exs = ts.map(function(t){ return expand(prep.graph, t); });
    exs.forEach(function(ex){ ex.forEach(function(e){ if(res.words.indexOf(e.w) < 0) res.words.push(e.w); }); });
    var scored = [];
    prep.docs.forEach(function(d){
      var sum = 0, hit = 0;
      exs.forEach(function(ex){ var s = termScore(ex, d, d.faq ? 3 : 2.5); if(s > 0){ sum += s; hit++; } });
      if(!hit) return;
      var cover = hit / exs.length;
      var score = sum * cover * cover * (d.faq ? 1.2 : 1);
      if(score >= MIN_SCORE) scored.push({ d: d, score: score });
    });
    scored.sort(function(x, y){ return y.score - x.score || (x.d.faq === y.d.faq ? 0 : x.d.faq ? -1 : 1); });
    var seen = {}, perPage = {}, top = 0;
    scored.forEach(function(s){
      var key = s.d.p + '#' + s.d.a;
      if(seen[key]) return;
      if(!res.answer){ seen[key] = 1; perPage[s.d.p] = 1; res.answer = s.d; top = s.score; return; }
      if(res.list.length >= LIST || (perPage[s.d.p] || 0) >= PER_PAGE || s.score < top * NEAR_ANSWER) return;
      seen[key] = 1;
      perPage[s.d.p] = (perPage[s.d.p] || 0) + 1;
      res.list.push(s.d);
    });
    return res;
  }

  /* 글 한 토막 — 처음 맞은 곳 둘레 max 자 · 맞은 낱말 표시 조각들 [{t, m}] */
  function snippet(text, words, max){
    text = String(text || '');
    var low = text.toLowerCase(), first = -1;
    words.forEach(function(w){ var i = low.indexOf(w); if(i >= 0 && (first < 0 || i < first)) first = i; });
    var start = 0;
    if(text.length > max && first > max / 3) start = Math.min(first - Math.floor(max / 3), text.length - max);
    var part = text.substr(start, max);
    var pre = start > 0 ? '…' : '', post = start + max < text.length ? '…' : '';
    var marks = [];
    words.forEach(function(w){
      if(!w) return;
      // 낱말은 띄어쓰기를 뺀 모양(프로그램정보)이라 글 속 «프로그램 정보» 에도 표시되게 글자 사이 빈칸을 허용한다 —
      // 짧은 낱말까지 허용하면 «하의 상의» 가 «의상» 으로 잡혀서 네 글자부터
      var re = new RegExp(w.split('').map(function(ch){ return ch.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); }).join(w.length >= 4 ? '\\s*' : ''), 'gi');
      var m;
      while((m = re.exec(part))) marks.push([m.index, m.index + m[0].length]);
    });
    marks.sort(function(a, b){ return a[0] - b[0] || b[1] - a[1]; });
    var segs = [], at = 0;
    if(pre) segs.push({ t: pre, m: false });
    marks.forEach(function(r){
      if(r[0] < at) return;
      if(r[0] > at) segs.push({ t: part.slice(at, r[0]), m: false });
      segs.push({ t: part.slice(r[0], r[1]), m: true });
      at = r[1];
    });
    if(at < part.length) segs.push({ t: part.slice(at), m: false });
    if(post) segs.push({ t: post, m: false });
    return segs;
  }

  function href(p, a, carry){
    return '/' + (p === 'index' ? '' : p) + (carry ? '?' + carry : '') + (a ? '#' + a : '');
  }
  function where(d){
    if(d.p === 'faq') return (d.page && d.page.t) || '자주 묻는 질문';
    var head = d.page && d.page.t ? d.p + '. ' + d.page.t : d.p;
    if(d.faq) return head;
    return d.h ? head + ' › ' + d.h : head;
  }

  var core = { terms: terms, stem: stem, graphOf: graphOf, expand: expand, joinSpaced: joinSpaced, prepare: prepare, search: search,
    snippet: snippet, href: href, where: where, MAX_Q: MAX_Q, LIST: LIST, PER_PAGE: PER_PAGE };
  if(typeof module === 'object' && module.exports) module.exports = core;
  if(typeof window === 'undefined' || typeof document === 'undefined') return;

  /* ── 화면 ── */
  var MSG = {
    loading: '검색 목록을 불러오는 중이에요…',
    failed: '검색 목록을 불러오지 못했어요. 잠시 뒤 다시 해 보거나 목차에서 찾아 주세요.',
    none: '맞는 내용을 찾지 못했어요. 다른 말로 물어보거나 마이홈 › 버그제보에 남겨 주세요.',
  };
  function el(tag, cls, text){
    var e = document.createElement(tag);
    if(cls) e.className = cls;
    if(text != null) e.textContent = text;
    return e;
  }
  function marked(parent, segs){
    segs.forEach(function(s){ parent.appendChild(s.m ? el('mark', null, s.t) : document.createTextNode(s.t)); });
  }
  function mount(){
    // 앱 도움말 탭 안(?embed=1)은 위 띠를 숨기고 왼쪽 목차로 다닌다 — 검색 · FAQ 는 웹에서만
    if(document.documentElement.hasAttribute('data-embed')) return;
    var bar = document.querySelector('.bar');
    if(!bar) return;
    var carry = document.documentElement.getAttribute('data-carry') || '';
    var form = el('form', 'hs');
    form.setAttribute('role', 'search');
    var input = el('input', 'hs-in');
    input.type = 'search';
    input.maxLength = MAX_Q;
    input.autocomplete = 'off';
    input.placeholder = '🔍 궁금한 걸 물어보세요';
    input.setAttribute('aria-label', '도움말 검색');
    var out = el('div', 'hs-out');
    out.hidden = true;
    out.setAttribute('aria-live', 'polite');
    form.appendChild(input);
    form.appendChild(out);
    bar.appendChild(form);

    var prep = null, state = 'idle', timer = null;
    function load(){
      if(state !== 'idle' && state !== 'failed') return;
      state = 'loading';
      fetch('/search.json').then(function(r){ if(!r.ok) throw new Error('HTTP ' + r.status); return r.json(); })
        .then(function(ix){ prep = prepare(ix); state = 'ready'; render(); })
        .catch(function(){ state = 'failed'; render(); });
    }
    function note(text){ out.appendChild(el('p', 'hs-note', text)); }
    function render(){
      var q = input.value.trim();
      out.textContent = '';
      out.hidden = !q;
      if(!q) return;
      if(state === 'loading' || state === 'idle'){ note(MSG.loading); return; }
      if(state === 'failed'){ note(MSG.failed); return; }
      var r = search(prep, q);
      if(!r.answer){ note(MSG.none); return; }
      var d = r.answer;
      var card = el('a', 'hs-ans');
      card.href = href(d.p, d.a, carry);
      card.appendChild(el('span', 'hs-tag', d.faq ? '💡 자주 묻는 질문' : '💡 이 내용이 맞을 것 같아요'));
      card.appendChild(el('b', 'hs-where', d.faq ? d.h : where(d)));
      var body = el('span', 'hs-text');
      marked(body, snippet(d.t, r.words, d.faq ? d.t.length : 180));   // FAQ 답은 짧게 써 둔 것이라 자르지 않는다
      card.appendChild(body);
      card.appendChild(el('span', 'hs-go', d.faq && d.p !== 'faq' ? where(d) + ' 보기 ›' : '이 자리로 가기 ›'));
      out.appendChild(card);
      if(!r.list.length) return;
      out.appendChild(el('p', 'hs-sub', '관련 내용'));
      var ul = el('ul', 'hs-list');
      r.list.forEach(function(x){
        var li = el('li'), a = el('a');
        a.href = href(x.p, x.a, carry);
        a.appendChild(el('b', null, x.faq ? x.h : where(x)));
        var s = el('span');
        marked(s, snippet(x.t, r.words, 70));
        a.appendChild(s);
        li.appendChild(a);
        ul.appendChild(li);
      });
      out.appendChild(ul);
    }
    input.addEventListener('focus', function(){ load(); render(); });
    // 결과 칸은 띠 아래로 떠 있어서 바깥을 누르면 접는다(검색어는 남겨 두고 다시 누르면 펼친다)
    document.addEventListener('click', function(e){ if(!form.contains(e.target)) out.hidden = true; });
    input.addEventListener('input', function(){
      load();
      clearTimeout(timer);
      timer = setTimeout(render, 150);
    });
    input.addEventListener('keydown', function(e){
      if(e.key === 'Escape'){ input.value = ''; render(); }
    });
    form.addEventListener('submit', function(e){
      e.preventDefault();
      clearTimeout(timer);
      render();
      var first = out.querySelector('a');
      if(first) location.href = first.href;
    });
  }
  if(document.readyState === 'loading') document.addEventListener('DOMContentLoaded', mount);
  else mount();
})();
