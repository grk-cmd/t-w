# -*- coding: utf-8 -*-
"""
Together Working 릴리스 전 자동 점검 (audit.py)
사용법:  python audit.py   (app.js, desk-companion-prototype.html과 같은 폴더에서)
검사 19개 + node smoke.js
"""
import re, sys, subprocess, os

APP = 'app.js'
HTML = 'desk-companion-prototype.html'
problems = []

def section(title):
    print('\n' + '=' * 8 + ' ' + title + ' ' + '=' * 8)

if not (os.path.exists(APP) and os.path.exists(HTML)):
    print('app.js / desk-companion-prototype.html 이 있는 폴더에서 실행하세요')
    sys.exit(1)

app = open(APP, encoding='utf-8').read()
html = open(HTML, encoding='utf-8').read()

# ── 🔒 CSP(3절)로 인라인 스크립트 둘을 밖으로 뺐다 — 검사들의 시야를 되돌린다 ──────
# [경위] `script-src` 에서 'unsafe-inline' 을 버리려고 HTML 안의 인라인 스크립트 2개를
#   `parts/firebase-init.js`(firebase 초기화 모듈 · 2600여 줄) · `parts/mys-net-bind.js` 로 뺐다.
#   그런데 검사 3·5·8·9 와 html_code 기반 경로 검사들은 **그 코드가 HTML 안에 있다고 가정**하고
#   쓰여 있다. 옮긴 직후 검사 8 이 firebaseAPI 정의를 못 찾아 60여 건을 한꺼번에 토했다 —
#   코드는 멀쩡한데 검사가 눈을 잃은 것이다.
# [지금] 파일이 있으면 원래 있던 형태(스크립트 블록)로 이어 붙여 **외부화 전과 같은 시야**를 만든다.
#   ⚠️ 모듈 쪽은 반드시 type="module" 로 감싼다 — 검사 5 가 그 표식으로 모듈을 찾는다.
#   ⚠️ 파일이 없으면 조용히 넘어간다(아직 외부화하지 않은 사본에서도 그대로 돌아야 한다).
for _ext, _attr in (('firebase-init.js', ' type="module"'), ('mys-net-bind.js', '')):
    for _cand in (_ext, os.path.join('parts', _ext)):
        if os.path.exists(_cand):
            html += '\n<script%s>\n%s\n</script>\n' % (_attr, open(_cand, encoding='utf-8').read())
            break

app_lines = app.split('\n')


def _strip_js_comments(s):
    """주석 제거(가드용 근사) — /*...*/ 블록과 // 줄주석. http:// 는 보존."""
    s = re.sub(r'/\*.*?\*/', '', s, flags=re.S)
    s = re.sub(r'(?<!:)//.*', '', s)
    return s


# ── 🧹 주석 걷어낸 app.js — 「코드에 있는가」를 묻는 검사는 반드시 이쪽을 볼 것 ──────────
# [경위] 이 파일은 여태 원문(app)에 정규식을 걸었다. 그런데 app.js 주석에는 **하지 말라고
#   적어 둔 코드**가 그대로 인용돼 있다. 실제로 검사 2 의 옛 앵커 `closest('#myStatusChip')`
#   는 지금 app.js 전체에서 **37079번 줄 주석 안에만** 있다. 옛 정규식을 조금만 느슨하게
#   풀면 그 주석에 걸려 «찾았다»가 되고, 검사가 아무것도 안 지키면서 초록이 된다.
#   (같은 함정을 `sim-purikura-deco.js` 가 한 번 밟았다 — 핸드오프 §5-③-④.)
# ⚠️ 이 정의를 아래로 다시 내리지 말 것. 검사 2 가 여기 있는 값을 쓴다.
app_code = _strip_js_comments(app)

# ── 검사 1: ID 연결 ─────────────────────────────────────────────
section('검사 1 · JS 참조 ID가 HTML에 존재하는가')
js_ids = set(re.findall(r"getElementById\(['\"]([\w-]+)['\"]\)", app))
html_ids = set(re.findall(r'id="([\w-]+)"', html))
ghosts = []
for i in sorted(js_ids - html_ids):
    if re.search(r'id=\\?["\']' + re.escape(i), app):
        continue
    ghosts.append(i)
if ghosts:
    print('  HTML에 없는 ID (동적 생성 아님):', ', '.join(ghosts))
    for g in ghosts:
        for n, l in enumerate(app_lines):
            if f"getElementById('{g}')" in l or f'getElementById("{g}")' in l:
                after = l.split('getElementById')[1]
                if re.search(r'\)\s*\.', after) and 'if(' not in l and '?.' not in after:
                    problems.append(f'검사1: {g} @app.js:{n+1} 가드 없이 사용 — 크래시 위험')
                    print(f'  ⚠️ 크래시 위험: {g} @ {n+1}')
    print('  (가드된 것은 죽은 코드 — 위험은 아님)')
else:
    print('  통과 ✅')

# ── 검사 2: 마우스 통과 화이트리스트 ────────────────────────────
section('검사 2 · 화이트리스트에 빠진 창 (클릭 뚫림)')
"""
[이 검사가 지키는 것]
  run 모드(전체화면 투명 오버레이)에서 클릭을 받을 UI 목록은 `app.js` 의 **UI_HIT_SEL 한 곳**뿐이다.
  거기 없는 창은 화면에 보여도 커서를 올리는 순간 클릭이 뒤 창으로 뚫린다.
  ⇒ 「HTML 에 run 모드에서 뜨는 창인데 UI_HIT_SEL 에 없는 것」을 찾는다.

[2026-09-13 재설계 — 옛 판은 세 군데가 한꺼번에 낡아 있었다]
  ① 앵커  옛 정규식 `closest\\('(#myStatusChip[^']+)'\\)` 는 목록이 closest() 인자로 **인라인**돼
     있던 시절의 것이다. 지금은 `const UI_HIT_SEL` 로 빠졌고 소비자가 둘이다
     (`_pointHitsInteractive` 의 closest · `_uiRegions()` 의 querySelectorAll).
     ⇒ **이름으로 잡는다.** ★ 「#myStatusChip 으로 시작하는 목록」으로 잡지 말 것 —
       주석을 다 걷어낸 코드에도 그런 문자열이 **둘**이다(`FS_KEEP_OPEN_SEL` 의 첫 항목과 이것).
  ② 수집  `#id{...position:fixed` 는 **붙여 쓴 단일 선택자만** 잡는다. 실물에는
     `#a, #b { ... }` 로 묶인 규칙이 많아 exportOverlay·partRegOverlay·inviteOverlay 등
     **11개를 통째로 놓쳤다.** ⇒ 블록 단위로 뜯어 선택자에 든 id 를 전부 센다.
  ③ 덮임  옛 판은 «화이트리스트 조상이 HTML 에서 4000자 앞에 있는가» 라는 **글자 거리**로
     쟀다. 결론이 우연히 맞았을 뿐 근거가 전부 틀렸다 — myStatusMenu 가 #gachaDrawOverlay 에,
     friendPicker 가 #raceOverlay 에 덮였다고 나왔다(실제 조상은 #myStatusChip · 없음).
     ⇒ **DOM 조상으로 판정한다.** §5-① 의 「인접 앵커」와 같은 부류였다.

★ 옛 판은 이름 필터('Overlay'/'Win'/'Modal'/'Gate')까지 걸어서, 앵커만 고쳐도 후보가 **0개**였다.
  «통과 ✅» 가 찍히는데 잰 것이 없는 상태다. 이름으로 거르지 않는다.

⚠️ 닮은 목록이 `app.js` 에 다섯 더 있다 — 7920 `FS_KEEP_OPEN_SEL`(설정창 바깥클릭 예외) ·
  8373 `OPEN_MODAL_SEL` · 8495(꾸미기창 바깥클릭) · 8505 `modalOpen` · 30209 `bindLauncherDim`.
  **전부 클릭 통과 화이트리스트가 아니다.** 앵커를 옮길 일이 생기면 먼저 이 줄을 읽을 것.
"""
_wl_m = re.search(r"const\s+UI_HIT_SEL\s*=\s*'([^']+)'", app_code)
if not _wl_m:
    problems.append('검사2: UI_HIT_SEL 정의를 찾지 못함 — 개명·이동됐다면 이 검사도 같이 고칠 것')
    print('  ⚠️ UI_HIT_SEL 정의 자체를 못 찾음 (위 주석의 「닮은 목록 다섯」으로 옮기지 말 것)')
else:
    _sel = [x.strip() for x in _wl_m.group(1).split(',') if x.strip()]
    wl_ids = set(x[1:] for x in _sel if x.startswith('#'))
    wl_cls = set(x[1:] for x in _sel if x.startswith('.'))
    # ⚠️ 클래스 항목을 버리지 말 것 — 목록 57개 중 9개가 class 다(.toast·.seat-ctx-backdrop 등).
    #    옛 판의 `#([\w-]+)` 는 이 아홉을 통째로 못 봤다.

    # ── HTML 을 한 번 훑어 id → (조상, class) 를 만든다. 덮임 판정의 유일한 근거다.
    from html.parser import HTMLParser as _HP
    _VOID = {'br','img','input','hr','meta','link','source','path','circle','rect',
             'use','col','area','base','embed','track','wbr'}
    class _Anc(_HP):
        def __init__(self):
            super().__init__(convert_charrefs=True)
            self.st = []; self.anc = {}; self.cls = {}
        def _reg(self, d):
            i = d.get('id')
            if i and i not in self.anc:
                self.anc[i] = [x for x in self.st if x]; self.cls[i] = d.get('class', '')
        def handle_starttag(self, t, a):
            d = dict(a); self._reg(d)
            if t not in _VOID: self.st.append(d.get('id'))
        def handle_startendtag(self, t, a): self._reg(dict(a))
        def handle_endtag(self, t):
            if t not in _VOID and self.st: self.st.pop()
    _P = _Anc(); _P.feed(html)
    # 태그가 안 맞으면 조상이 어긋나 **가짜 통과**가 난다. 그 경우엔 조용히 넘어가지 않는다.
    if _P.st:
        problems.append('검사2: HTML 태그가 안 닫혀 조상 판정을 믿을 수 없다 (잔여 %d)' % len(_P.st))
        print('  ⚠️ 태그 짝이 안 맞는다 — 덮임 판정을 믿지 말 것 (잔여 %d)' % len(_P.st))

    # ── 후보 수집 = ⓐ position:fixed 규칙 ∪ ⓑ body.desktop 에서 따로 손본 것
    #    ⓑ 를 더하는 이유: run 모드에서 뜨는 모달은 딤 배경을 투명하게 만드는 그 그룹이
    #    사실상의 정의다. ⓐ 만 보면 그 그룹에 있는데 fixed 를 다른 규칙에서 받는 창을 놓친다.
    # ⚠️ **<style> 안만 본다. 그리고 CSS 주석을 먼저 걷는다.**
    #    문서 전체에 `([^{}]+)\{([^}]*)\}` 를 걸면 <script> 의 JS 중괄호까지 규칙으로 읽고,
    #    무엇보다 규칙 앞의 `/* … */` 주석이 **선택자로 붙어 들어온다.** 실제로 그 상태에서
    #    「머리 위 이름표 … 텍스트」 주석 때문에 #seatLabelsLayer 가, 「채팅·커스텀 상태 입력창」
    #    주석 때문에 #myChatBox·#myStatusMenu 가 통과 껍데기로 잘못 면제됐다. 또 주석이다.
    _css = re.sub(r'/\*.*?\*/', '', '\n'.join(
        re.findall(r'<style[^>]*>(.*?)</style>', html, re.S | re.I)), flags=re.S)
    _cand = set(); _pe_none = set(); _pe_live = set()
    for _s, _b in re.findall(r'([^{}]+)\{([^}]*)\}', _css):
        _ids = set(re.findall(r'#([\w-]+)', _s))
        if not _ids: continue
        # 후보 = ⓐ position:fixed ∪ ⓑ body.desktop 에서 따로 손본 것
        if re.search(r'position\s*:\s*fixed', _b) or 'body.desktop' in _s:
            _cand |= _ids
        # 껍데기는 elementFromPoint 에 애초에 안 걸린다. 단 **한 규칙만 보고 정하지 않는다** —
        # `#myChatBox{pointer-events:none}` 뒤에 `#myChatBox:not(.hidden){pointer-events:auto}`
        # 가 오면 열렸을 때는 클릭을 받는다. 그런 id 는 껍데기가 아니다.
        _pm = re.search(r'pointer-events\s*:\s*([\w-]+)', _b)
        if _pm:
            (_pe_none if _pm.group(1) == 'none' else _pe_live).__ior__(_ids)
    _pe_none -= _pe_live

    # 명시 예외 — 왜 빠지는지를 여기 적어 둔다. 늘릴 때는 반드시 이유를 같이 적을 것.
    _EXEMPT = {
        'scene': '3D 캔버스 — 화이트리스트가 아니라 레이캐스트가 판정한다',
    }

    missing, notes = [], []
    for o in sorted(_cand - wl_ids):
        anc = _P.anc.get(o)
        if anc is None:
            continue                                   # HTML 에 요소가 없다 = 검사 1 소관(유령 id)
        if [x for x in anc if x in wl_ids]:
            continue                                   # 화이트리스트 조상이 있다 — closest() 가 잡는다
        if set(_P.cls.get(o, '').split()) & wl_cls:
            continue                                   # 자기 class 가 목록에 있다
        if o in _EXEMPT:
            notes.append('%s — %s' % (o, _EXEMPT[o])); continue
        if o in _pe_none:
            notes.append('%s — pointer-events:none (클릭이 통과하는 껍데기)' % o); continue
        missing.append(o)

    for n in notes:
        print('  · 예외: #%s' % n)
    if missing:
        for m in missing:
            problems.append('검사2: #%s 화이트리스트 누락 — 그 창이 뜨면 클릭이 뒤로 뚫림' % m)
            print('  ⚠️ #%s — UI_HIT_SEL 에 추가 필요' % m)
    else:
        print('  통과 ✅  (검사 대상 %d개 · 화이트리스트 id %d · class %d)'
              % (len(_cand), len(wl_ids), len(wl_cls)))

# ── 검사 3: runTransaction null-캐시 함정 ──────────────────────
section('검사 3 · runTransaction null-캐시 함정')
found3 = False
for m in re.finditer(r'runTransaction\([^,]+,\s*(?:cur|v)\s*=>\s*\{([^}]{0,400})', html):
    body = m.group(1)
    line = html[:m.start()].count('\n') + 1
    before = html[max(0, m.start()-600):m.start()]
    if re.search(r'if\s*\(\s*!\s*(?:cur|v)\b', body) and 'preSnap' not in before and 'preVal' not in body:
        problems.append(f'검사3: html:{line} runTransaction이 null에서 중단 — 사전 get() 보정 필요')
        print(f'  ⚠️ html:{line} — {body.strip()[:70]}')
        found3 = True
if not found3:
    print('  통과 ✅')

# ── 검사 4: confirm() 포커스 보정 ──────────────────────────────
section('검사 4 · confirm() 뒤 window.focus() 보정')
found4 = False
for n, l in enumerate(app_lines):
    if re.search(r'\bconfirm\(', l) and not l.strip().startswith('//') and 'window.confirm' not in l:
        nearby = l + (app_lines[n+1] if n+1 < len(app_lines) else '')
        if 'window.focus' not in nearby:
            problems.append(f'검사4: app.js:{n+1} confirm() 포커스 보정 없음 — Electron 멈춤 위험')
            print(f'  ⚠️ @{n+1}: {l.strip()[:70]}')
            found4 = True
if not found4:
    print('  통과 ✅')

# ── 검사 6 · const 재대입 ──────────────────────────────────────
print("\n======== 검사 6 · const 재대입 ========")
_creassign = []
for _f in ('app.js','animal.js','mallang.js','main.js','preload.js'):
    try: _src = open(_f, encoding='utf-8').read()
    except Exception: continue
    _consts = set(re.findall(r'\bconst\s+([A-Za-z_$][\w$]*)\s*=', _src))
    _lets   = set(re.findall(r'\b(?:let|var)\s+([A-Za-z_$][\w$]*)', _src))
    _lets  |= set(re.findall(r'\b(?:let|var)\s*\[([^\]]*)\]', _src)) and set(
              n.strip() for grp in re.findall(r'\b(?:let|var)\s*\[([^\]]*)\]', _src) for n in grp.split(','))
    _lets  |= set(n.strip() for grp in re.findall(r'\b(?:let|var)\s*\{([^}]*)\}', _src) for n in grp.split(','))
    """ ⏱ [2026-09-13] **이름마다 한 바퀴 → 파일마다 한 바퀴로 뒤집었다.**
        옛 판은 `_consts - _lets` 의 이름 하나하나마다 1.9MB 원문을 처음부터 다시 훑었다.
        app.js 의 스캔 대상이 2,361개라 그만큼 반복했고, 실측 **약 93초**가 여기서 났다.
        (이전 문서 §1-③ 의 「검사 6 이 약 90초」가 이것이다. 실기기에서 audit.py 가 기본
         60초 상한에 잘려 **결과를 아예 못 보던** 원인도 이 한 군데다.)
        ⇒ 한 바퀴에 «식별자 + 재대입 연산자» 를 전부 모으고 이름은 집합으로 거른다.
          **판정은 옛 판과 완전히 같다** — 앞의 `(?<![\\w$.])` 를 그대로 두었으므로
          `obj.AAA++`(속성) 와 `xAAA--`(더 긴 이름) 는 여전히 안 걸리고, `let` 로 선언된
          이름도 그대로 빠진다. 0.077초. 일부러 `const AAA=1; AAA+=2;` 를 심어 대조했다.
        ⚠️ 줄 번호를 `_src[:m.start()].count('\\n')` 로 세지 말 것 — 적중이 많은 날
          그 슬라이스만으로 다시 느려진다. 앞쪽 줄바꿈 위치를 미리 깔고 이분탐색한다. """
    _nl = [0]
    for _i, _ch in enumerate(_src):
        if _ch == '\n': _nl.append(_i + 1)
    import bisect as _bisect
    _names = _consts - _lets
    for _m in re.finditer(r'(?<![\w$.])([A-Za-z_$][\w$]*)\s*(\+=|-=|\*=|/=|\+\+|--)', _src):
        _n = _m.group(1)
        if _n not in _names: continue
        _creassign.append(_f + ':' + str(_bisect.bisect_right(_nl, _m.start())) + ' — ' + _n)
if _creassign:
    print("  재대입 발견:", ', '.join(_creassign[:8]))
    problems.append('검사6: const 재대입 — 실행 시 TypeError로 앱이 죽습니다: ' + _creassign[0])
else:
    print("  통과 ✅")

# ── 검사 5: 문법 ────────────────────────────────────────────────
section('검사 5 · 문법 (node --check)')
r = subprocess.run(['node', '--check', APP], capture_output=True, text=True)
if r.returncode != 0:
    problems.append('검사5: app.js 문법 오류')
    print(' ', r.stderr.strip()[:200])
else:
    m = re.search(r'<script type="module">(.*?)</script>', html, re.S)
    if m:
        r2 = subprocess.run(['node', '--input-type=module', '--check'], input=m.group(1), capture_output=True, text=True)
        if r2.returncode != 0:
            problems.append('검사5: html 모듈 문법 오류')
            print(' ', r2.stderr.strip()[:200])
        else:
            print('  통과 ✅')
    else:
        print('  통과 ✅ (html 모듈 없음)')

# (v1 요약은 v2 검사 뒤 통합 출력으로 이동)

# ═══════════════════════════════════════════════════════════════
# 이하 v2 추가 검사 — RTDB 비용 패치(roomIndex) 이후 새로 생긴 계약들을 지킨다
# ═══════════════════════════════════════════════════════════════
import json as _json

# _strip_js_comments 는 파일 위(app_lines 바로 아래)로 옮겼다 — 검사 2 가 먼저 쓴다.
html_code = _strip_js_comments(html)

# ── 검사 7: DB 규칙 정합성 ─────────────────────────────────────
section('검사 7 · firebase-database-rules.json 정합성')
RULES = 'firebase-database-rules.json'
if not os.path.exists(RULES):
    print('  (규칙 파일 없음 — 건너뜀. 릴리스 폴더엔 없어도 되지만 레포에선 같이 검사 권장)')
else:
    try:
        _rules = _json.load(open(RULES, encoding='utf-8'))['rules']
        _rule_keys = set(k for k in _rules if not k.startswith('.'))
        # ★ 경로 키의 값은 반드시 객체여야 한다. 주석 삼아 "_note":"…" 같은 문자열을 넣으면
        #   JSON 으로는 멀쩡한데 Firebase 콘솔이 'Expected {' 로 저장을 거부한다(실제로 겪음).
        def _bad_nodes(node, path=''):
            out = []
            for k, v in node.items():
                if k.startswith('.'):
                    continue
                if not isinstance(v, dict):
                    out.append((path + '/' + k).lstrip('/'))
                else:
                    out += _bad_nodes(v, path + '/' + k)
            return out
        for _b in _bad_nodes(_rules):
            problems.append('검사7: 규칙 경로 "%s" 의 값이 객체가 아님 — Firebase가 저장을 거부합니다(Expected \'{\')' % _b)
            print('  ⚠️ 객체가 아닌 경로:', _b)
        # 루트가 .read/.write=false 이므로, 코드가 쓰는 최상위 경로는 규칙에 반드시 있어야 함
        _paths = re.findall(r"ref\(db,\s*[`'\"]([^`'\"$]+)", html_code)
        _tops = set(p.split('/')[0].strip() for p in _paths if p and not p.startswith('.'))
        _uncovered = sorted(_tops - _rule_keys)
        ok7 = True
        if _uncovered:
            for t in _uncovered:
                problems.append(f'검사7: 코드가 접근하는 최상위 경로 "{t}" 가 규칙에 없음 — 루트 차단이라 전부 거부됨')
                print(f'  ⚠️ 규칙 누락: {t}')
            ok7 = False
        # roomIndex 특화 — 하트비트(update {lastSeen})가 통과하는 규칙인지
        if 'roomIndex' in _tops:
            _ri = _rules.get('roomIndex') or {}
            _riw = (_ri.get('$room') or {})
            if _riw.get('.write') is not True:
                problems.append('검사7: roomIndex/$room 에 .write 허용 없음 — 하트비트가 전부 거부됨(카운트 0 고정)')
                print('  ⚠️ roomIndex 쓰기 규칙 없음'); ok7 = False
        if ok7:
            print('  통과 ✅ (코드 접근 최상위 경로가 모두 규칙에 존재)')
    except Exception as e:
        problems.append(f'검사7: 규칙 JSON 파싱 실패 — {e}')
        print('  ⚠️ JSON 파싱 실패:', e)

# ── 검사 8: app.js ↔ HTML firebaseAPI 계약 ─────────────────────
section('검사 8 · firebaseAPI 호출-정의 계약 (파일 버전 어긋남 감지)')
_callers = {}
for _cf in ('app.js', 'myhome-desktop.js', 'mallang.js', 'animal.js'):
    try: _cs = _strip_js_comments(open(_cf, encoding='utf-8').read())
    except Exception: continue
    for _mm in set(re.findall(r'firebaseAPI\.(\w+)', _cs)):
        _callers.setdefault(_mm, []).append(_cf)
_undef = {m: fs for m, fs in _callers.items() if not re.search(r'\b' + m + r'\s*[:(]', html)}
if _undef:
    for m, fs in sorted(_undef.items()):
        problems.append(f'검사8: firebaseAPI.{m} — {",".join(fs)}에서 호출하지만 HTML에 정의 없음 (TypeError)')
        print(f'  ⚠️ {m} ← {",".join(fs)}')
else:
    print(f'  통과 ✅ (호출되는 메서드 {len(_callers)}개 전부 정의 존재)')

# ── 검사 9: RTDB 비용 회귀 가드 ────────────────────────────────
section('검사 9 · RTDB 비용 회귀 가드 (rooms 전체 읽기 재발 방지)')
ok9 = True
# (a) 최상위 노드 "통째" 실시간 구독 — rooms는 절대 금지, 그 외도 허용 목록만
_ALLOW_SUB = {'licenseRequests'}   # 기존부터 있던 소형·관리자성 구독
for _mm in re.finditer(r"onValue\(ref\(db,\s*[`'\"]([^`'\"/$]+)[`'\"]", html_code):
    _n = _mm.group(1)
    if _n not in _ALLOW_SUB:
        _ln = html_code[:_mm.start()].count('\n') + 1
        problems.append(f'검사9: 최상위 "{_n}" 전체를 onValue 실시간 구독(html~{_ln}) — 비용 폭탄, 하위 경로/인덱스로 바꿀 것')
        print(f'  ⚠️ onValue 전체 구독: {_n} @~{_ln}')
        ok9 = False
# (b) 최상위 노드 통째 get() — 알려진 기준선 초과 시 경보 (기준: 패치 시점)
_BASELINE_GET = {'rooms': 3, 'users': 2, 'licenses': 2, 'parties': 1, 'roomIndex': 99,
                 'friendCodes': 1}   # rooms 3곳 = 관리자 함수만(카운트 폴백 제거됨)
# friendCodes 1곳 = 🎟️ grantInvitesAll(관리자 전용, 버튼 누를 때 1회).
#   users 전체 읽기는 규칙상 거부되므로(.read는 users/$userId에만 존재) uid 목록을 얻는 대체 인덱스로 사용.
#   code→{userId}만 담겨 유저당 약 50바이트 — users 전체(수 KB/명)보다 훨씬 가볍다.
_gets = {}
for _mm in re.finditer(r"get\(ref\(db,\s*[`'\"]([^`'\"/$]+)[`'\"]", html_code):
    _gets[_mm.group(1)] = _gets.get(_mm.group(1), 0) + 1
for _n, _c in sorted(_gets.items()):
    _b = _BASELINE_GET.get(_n)
    if _b is None:
        problems.append(f'검사9: 최상위 "{_n}" 전체 get()이 새로 생김({_c}곳) — 정말 전체가 필요한지 확인')
        print(f'  ⚠️ 신규 전체 get: {_n} ×{_c}'); ok9 = False
    elif _c > _b:
        problems.append(f'검사9: "{_n}" 전체 get()이 {_b}→{_c}곳으로 늘어남 — 새 호출부가 반복 실행되는지 확인')
        print(f'  ⚠️ 전체 get 증가: {_n} {_b}→{_c}'); ok9 = False
if ok9:
    print('  통과 ✅ (전체 구독 없음 · 전체 get 기준선 이내)')

# ── 검사 10: 문법 — 모든 단독 JS 파일 ──────────────────────────
section('검사 10 · 문법 (모든 .js 파일 node --check)')
ok10 = True
for _f in sorted(f for f in os.listdir('.') if f.endswith('.js')):
    _r = subprocess.run(['node', '--check', _f], capture_output=True, text=True)
    if _r.returncode != 0:
        problems.append(f'검사10: {_f} 문법 오류')
        print(f'  ⚠️ {_f}:', _r.stderr.strip().splitlines()[0][:120] if _r.stderr.strip() else '')
        ok10 = False
if ok10:
    print('  통과 ✅')

# ── 검사 12: 테마 커버리지 ────────────────────────────────────
section('검사 12 · 테마 커버리지 — 베젤 쓰는 CSS 규칙에 radius 토큰이 있는가')
# 테마 블록에 선택자를 하나씩 나열하는 방식은 반드시 빠뜨린다(실제로 마이홈이 통째로 빠졌었다).
# 베젤(border-color:hi/lo/face)을 쓰는 규칙은 예외 없이 --win-radius-el 을 받아야 한다.
_BEVEL = ('border-color:var(--win-hi)','border-color:var(--win-lo)','border-color:var(--win-face)')
_sty = re.search(r'<style>(.*?)</style>', html, re.S)
if not _sty:
    print('  ⚠️ <style> 블록을 못 찾음 — 건너뜀')
else:
    _miss = []; _total = 0
    for _rm in re.finditer(r'([^{}]*)\{([^{}]*)\}', _sty.group(1)):
        _sel, _body = _rm.group(1).strip(), _rm.group(2)
        if not any(b in _body for b in _BEVEL): continue
        if 'data-theme' in _sel: continue
        _total += 1
        if 'border-radius' not in _body:
            _miss.append(re.sub(r'\s+',' ',_sel.split('*/')[-1].strip())[:60])
    if _miss:
        problems.append(f'검사12: 베젤 쓰는 CSS 규칙 {len(_miss)}개에 radius 토큰 없음 — 버블 테마에서 각진 채로 남습니다: ' + _miss[0])
        for _m in _miss[:8]: print('  ⚠️', _m)
    else:
        print(f'  통과 ✅ (베젤 규칙 {_total}개 전부 --win-radius-el 수신)')
    # (b) 폴더탭(border-bottom:none)은 '위쪽만' 둥글어야 아래 패널과 이어진다.
    #     네 모서리를 균일하게 둥글리면 탭 밑변이 휘어서 끊겨 보인다.
    _tabs = []
    for _rm in re.finditer(r'([^{}]*)\{([^{}]*)\}', _sty.group(1)):
        _sel = re.sub(r'\s+',' ',_rm.group(1).split('*/')[-1].strip()); _body = _rm.group(2)
        if 'data-theme' in _sel: continue
        # 탭 판별: (a) border-bottom:none 관용구  또는 (b) 선택자 이름에 tab
        _is_tab = ('border-bottom:none' in _body.replace(' ','')) or re.search(r'\btabs? |\btab-btn|-tab\b|\.\w*tab\w*\b', _sel, re.I)
        if not _is_tab: continue
        if 'var(--win-radius-el)' not in _body: continue
        _tabs.append(_sel)
    _themed = re.search(r'폴더탭 계열.*?border-radius:var\(--win-radius-sm\)', html, re.S)
    _blk = _themed.group(0) if _themed else ''
    _tabmiss = [t for t in _tabs if t.split('.on')[0].strip() not in _blk and t not in _blk]
    if _tabmiss:
        problems.append(f'검사12: 폴더탭 {len(_tabmiss)}개가 위쪽만 둥글리는 규칙에 없음 — 탭 밑변이 휘어 패널과 끊겨 보입니다: ' + _tabmiss[0])
        for _m in _tabmiss[:6]: print('  ⚠️ 탭 미처리:', _m[:50])
    elif _tabs:
        print(f'  통과 ✅ (폴더탭 {len(_tabs)}개 전부 위쪽만 둥글림)')

# ── 검사 13: 테마 커버리지 (2) — 하드코딩 타이틀바·그림자 ─────
section('검사 13 · 테마 커버리지 — 타이틀바/그림자를 토큰 없이 하드코딩한 곳')
# 색을 직접 박아두면 테마·색상 축이 그 요소에 절대 닿지 않는다.
# (실제로 프리미엄 디자인 스튜디오 타이틀바가 금색 하드코딩이라 통째로 빠져 있었다)
if not _sty:
    print('  (건너뜀)')
else:
    _t13 = []
    for _rm in re.finditer(r'([^{}]*)\{([^{}]*)\}', _sty.group(1)):
        _sel = re.sub(r'\s+',' ',_rm.group(1).split('*/')[-1].strip()); _body = _rm.group(2)
        if 'data-theme' in _sel: continue
        # (a) 가로 그라데이션 배경 + 흰 글씨 = 타이틀바인데 토큰을 안 씀
        if (re.search(r'background\s*:\s*linear-gradient\(90deg[^)]*#[0-9a-fA-F]{3,6}', _body)
                and 'win-title' not in _body):
            _t13.append('타이틀바 하드코딩: ' + _sel[:44])
        # (b) Win98 각진 그림자를 토큰/폴백 없이 박아둠
        if re.search(r'box-shadow:\s*\d+px \d+px 0 rgba\(0,0,0', _body) and '--win-drop' not in _body:
            _t13.append('각진 그림자 하드코딩: ' + _sel[:44])
    if _t13:
        problems.append(f'검사13: 테마가 닿지 않는 하드코딩 {len(_t13)}곳 — 버블 테마에서 그 요소만 Win98로 남습니다: ' + _t13[0])
        for _m in _t13[:8]: print('  ⚠️', _m)
    else:
        print('  통과 ✅ (타이틀바·그림자 전부 토큰 경유)')

# ── 검사 11: 부팅 스모크 (app.js 최상위 실행) ──────────────────
section('검사 11 · 부팅 스모크 — app.js 최상위가 끝까지 실행되는가')
# node --check(검사5/10)는 '문법'만 본다. 선언 순서(TDZ)나 최상위 호출이 아직 준비 안 된 것을
# 건드리는 경우는 문법상 멀쩡하므로 절대 안 잡히고, 앱이 통째로 안 켜진다.
# smoke.js가 app.js를 실제로 평가해서 그걸 잡는다. (실제로 THEME_COLORS TDZ로 앱이 안 켜진 적 있음)
if not os.path.exists('smoke.js'):
    print('  ⚠️ smoke.js 없음 — 건너뜀 (레포에 같이 두는 걸 권장)')
else:
    _r = subprocess.run(['node', 'smoke.js'], capture_output=True, text=True)
    if _r.returncode != 0:
        _out = (_r.stdout or _r.stderr).strip()
        _first = next((l for l in _out.splitlines() if 'Error' in l), _out.splitlines()[0] if _out.splitlines() else '')
        problems.append('검사11: app.js 최상위 실행이 중단됨 — 앱이 아예 안 켜집니다: ' + _first.strip())
        print(_out)
    else:
        print('  통과 ✅')

# ── 검사 14: 상태칩 버튼 스타일 누락 ──────────────────────────────────
section('검사 14 · 상태칩 버튼이 공용 스타일 규칙에 전부 들어있는가')
# 칩 버튼 스타일은 선택자를 하나씩 나열한다(#myChatBtn, #myDemojiBtn, …). 새 버튼을 추가하면
# 반드시 빠뜨리고, 그러면 그 버튼만 브라우저 기본 스타일로 남아 혼자 따로 논다.
# (실제로 🎵 플레이리스트 버튼이 5개 규칙 전부에서 빠져 크기·배경·모서리가 전부 달랐다)
_gs = html.find('<div id="myChipGroup">')
_ge = html.find('<div id="myStatusMenu"')
_ok14 = True
if _gs == -1 or _ge == -1 or _ge < _gs:
    print('  ⚠️ #myChipGroup 범위를 못 찾음 — 건너뜀')
else:
    _chipBtns = re.findall(r'<button id="([\w-]+)"', html[_gs:_ge])
    _sty14 = re.search(r'<style>(.*?)</style>', html, re.S)
    _rules14 = 0
    if _sty14 and _chipBtns:
        for _rm in re.finditer(r'([^{}]*)\{([^{}]*)\}', _sty14.group(1)):
            _sel = _rm.group(1)
            if '#myChipMoreBtn' not in _sel: continue      # 공용 칩버튼 규칙의 표식
            # 모양을 정하는 규칙만 본다. position:relative 처럼 일부 버튼에만 필요한 규칙은 대상이 아니다.
            if not re.search(r'border-color|border-radius|background|width\s*:', _rm.group(2)): continue
            _rules14 += 1
            _miss14 = [b for b in _chipBtns if ('#' + b) not in _sel]
            if _miss14:
                _ln = _sty14.group(1)[:_rm.start()].count('\n') + 1
                problems.append('검사14: 칩버튼 ' + ','.join(_miss14) + ' 이(가) 공용 스타일 규칙에서 빠짐(style~' + str(_ln) + ') — 그 버튼만 혼자 다르게 보입니다')
                print('  ⚠️ 누락:', ','.join(_miss14), '@style~' + str(_ln), '—', re.sub(r'\s+', ' ', _sel.strip())[:50])
                _ok14 = False
    if _ok14:
        print('  통과 ✅ (버튼 ' + str(len(_chipBtns)) + '개 · 규칙 ' + str(_rules14) + '개 전부 포함)')

# ── 검사 15: 타이틀바 ↔ 버블 테마 목록 ────────────────────────────
section('검사 15 · CSS 타이틀바가 버블 테마 목록에 전부 있는가')
# 인라인 타이틀바는 [style*="--win-title-a"] 선택자가 자동으로 잡는다. 문제는 <style> 안에서
# 타이틀바 그라데이션을 그리는 규칙 — 버블 테마는 그런 선택자를 하나씩 나열하는 목록으로
# 위쪽만 둥글리는데, 새 창을 만들면 반드시 빠뜨린다(보관함 제목줄이 각져서 삐져나온 그 제보).
_sty15 = re.search(r'<style>(.*?)</style>', html, re.S)
if not _sty15:
    print('  ⚠️ <style> 블록을 못 찾음 — 건너뜀')
else:
    _css15 = _sty15.group(1)
    # (a) 버블 목록 블록 — "위쪽만 둥글리는" border-radius 를 가진 data-theme="bubble" 규칙 전부
    _blk15 = ''
    for _rm in re.finditer(r'([^{}]*)\{([^{}]*)\}', _css15):
        if 'data-theme="bubble"' not in _rm.group(1): continue
        if re.search(r'border-radius:\s*calc\(var\(--win-radius\)[^;]*\)\s+calc[^;]*\s+0\s+0', _rm.group(2)):
            _blk15 += _rm.group(1)
    _blk15n = re.sub(r'\s+', ' ', _blk15)
    if not _blk15n:
        problems.append('검사15: 버블 테마의 타이틀바 목록 블록을 못 찾음 — 코드 구조 변경?')
        print('  ⚠️ 목록 블록 자체를 못 찾음')
    else:
        # (b) 타이틀바 판별: 본문이 90deg 그라데이션에 --win-title-a 를 쓰는 규칙
        _miss15 = []; _total15 = 0
        for _rm in re.finditer(r'([^{}]*)\{([^{}]*)\}', _css15):
            _selraw, _body = _rm.group(1), _rm.group(2)
            if not re.search(r'background\s*:\s*linear-gradient\(\s*90deg\s*,\s*var\(--win-title-a\)', _body): continue
            for _sel in _selraw.split(','):
                _sel = re.sub(r'\s+', ' ', _sel.split('*/')[-1].strip())
                if not _sel or 'data-theme' in _sel or '[style' in _sel: continue
                _total15 += 1
                if _sel not in _blk15n:
                    _miss15.append(_sel)
        if _miss15:
            problems.append(f'검사15: 타이틀바 {len(_miss15)}개가 버블 목록에 없음 — 버블 테마에서 제목줄만 각져서 창 모서리 밖으로 삐져나옵니다: ' + _miss15[0])
            for _m in _miss15[:8]: print('  ⚠️ 목록 누락:', _m[:60])
        else:
            print(f'  통과 ✅ (CSS 타이틀바 {_total15}개 전부 버블 목록에 존재)')

# ── 검사 16: HTML 태그 중첩 균형 ────────────────────────────────
section('검사 16 · HTML <div> 여닫이 균형 (창 구조가 통째로 풀리는 사고)')
# node --check(검사 5·10)도 smoke(검사 11)도 **마크업은 안 본다.** JS·CSS 문법만 본다.
# 여는 <div> 를 하나 지우면 그 지점부터 중첩이 통째로 풀려서, 창 안에 있어야 할 것이
# 화면 전체로 튀어나온다(실제로 채팅창 메뉴를 넣다가 chat-memberbar 여는 태그를 지워 그렇게 됐다).
# ⚠️ <script>·<style>·주석 안의 <div> 는 세지 않는다 — JS 문자열로 마크업을 만드는 코드가 많아
#    그대로 세면 거짓 경보가 쏟아진다. 검사 대상은 '문서에 그대로 박힌' 마크업뿐이다.
_h16 = re.sub(r'<script\b.*?</script>', '', html, flags=re.S|re.I)
_h16 = re.sub(r'<style\b.*?</style>',  '', _h16, flags=re.S|re.I)
_h16 = re.sub(r'<!--.*?-->', '', _h16, flags=re.S)
_stack16, _err16 = [], []
for _m in re.finditer(r'<div\b([^>]*)>|</div\s*>', _h16, re.I):
    _ln = _h16[:_m.start()].count('\n') + 1
    if _m.group(0).lower().startswith('</'):
        if not _stack16:
            _err16.append('닫는 </div> 가 더 많음 @html~%d' % _ln); break
        _stack16.pop()
    else:
        _a = _m.group(1) or ''
        _idm = re.search(r'id="([\w-]+)"', _a) or re.search(r'class="([^"]+)"', _a)
        _stack16.append(((_idm.group(1) if _idm else '(이름 없음)'), _ln))
if not _err16 and _stack16:
    for _nm, _ln in _stack16[:3]:
        _err16.append('안 닫힌 <div> — %s @html~%d' % (_nm, _ln))
if _err16:
    for _e in _err16:
        problems.append('검사16: ' + _e + ' — 창 구조가 풀려 내용이 화면 전체로 쏟아집니다')
        print('  ⚠️', _e)
else:
    print('  통과 ✅ (<div> 여닫이 균형)')

# ── 검사 17: 레벨 티어 규칙 존재 ────────────────────────────────
section('검사 17 · JS 가 붙이는 레벨 티어/표식 클래스에 CSS 규칙이 실제로 있는가')
# CSS 는 **조용히 실패한다.** 주석 닫는 줄이 하나 남아 티어 블록이 통째로 무시된 적이 있는데,
# node --check(검사 5·10)도 smoke(검사 11)도 그걸 못 잡는다 — 배지가 '색만 없는 회색 칸'이 되어
# 눈으로 봐야만 발견된다. 그래서 "JS 가 붙이는 클래스"와 "CSS 에 있는 규칙"을 대조한다.
# ⚠️ 티어 개수를 app.js 의 LV_TIERS 에서 읽는다 — 여기에 12 를 박아두면 티어를 늘릴 때
#    검사가 조용히 낡는다(이 검사가 막으려는 실패 양상과 똑같아진다).
_sty17 = re.search(r'<style>(.*?)</style>', html, re.S)
_tbl17 = re.search(r'LV_TIERS\s*=\s*\[(.*?)\]\s*;', app, re.S)
if not _sty17 or not _tbl17:
    problems.append('검사17: <style> 또는 app.js 의 LV_TIERS 표를 못 찾음 — 코드 구조 변경?')
    print('  ⚠️ <style> / LV_TIERS 를 못 찾음')
else:
    _css17 = re.sub(r'/\*.*?\*/', '', _sty17.group(1), flags=re.S)   # 주석 제거 후 대조
    _tiers17 = sorted({int(x) for x in re.findall(r'\[\s*(?:\d+|Infinity)\s*,\s*(\d+)\s*\]', _tbl17.group(1))})
    _miss17 = []
    # (a) 티어마다 '배지 + 바' 를 한 블록에서 내려주는 변수 규칙이 있는가
    for _t in _tiers17:
        _m17 = re.search(r'\.mh-flv\.t%d\s*,\s*\.seat-exp\.t%d\s*\{([^{}]*)\}' % (_t, _t), _css17)
        if not _m17:
            _miss17.append('t%d 변수 블록(.mh-flv.t%d, .seat-exp.t%d) 없음' % (_t, _t, _t)); continue
        for _v in ('--lv-badge', '--lv-bar'):
            if _v not in _m17.group(1):
                _miss17.append('t%d 블록에 %s 가 없음' % (_t, _v))
    # (b) JS 가 붙이는 표식 클래스(lvBadgeClass·lvBarClass 의 문자열 리터럴)에 규칙이 있는가
    _js17 = '\n'.join(re.findall(r'function lv(?:BadgeClass|BarClass)\([^)]*\)\{(.*?)\n\}', app, re.S))
    _marks17 = sorted(set(re.findall(r"'\s+([a-z-]+)'", _js17)))
    for _mk in _marks17:
        if not re.search(r'\.(?:mh-flv|seat-exp)\.%s\b' % re.escape(_mk), _css17):
            _miss17.append("표식 클래스 '%s' 를 JS 가 붙이는데 CSS 규칙이 없음" % _mk)
    # (c) 소비자(.mh-flv / .exp-fill)가 실제로 토큰을 읽고 있는가 — 색을 다시 하드코딩하면 여기서 걸린다
    if not re.search(r'\.mh-flv\s*\{[^{}]*background:\s*var\(--lv-badge\)', _css17):
        _miss17.append('.mh-flv 가 var(--lv-badge) 를 읽지 않음 — 색을 규칙에 직접 적었나?')
    if not re.search(r'\.exp-fill\s*\{[^{}]*background:\s*var\(--lv-bar\)', _css17):
        _miss17.append('.exp-fill 이 var(--lv-bar) 를 읽지 않음 — 색을 규칙에 직접 적었나?')
    # (d) 레벨 쪽 애니메이션이 prefers-reduced-motion 에 전부 걸렸는가
    _red17 = ''.join(re.findall(r'@media\s*\(prefers-reduced-motion:\s*reduce\)\s*\{(.*?)\n\s*\}', _css17, re.S))
    for _rm in re.finditer(r'([^{}]*)\{([^{}]*animation:[^{}]*)\}', _css17):
        _sel17 = re.sub(r'\s+', ' ', _rm.group(1)).strip()
        if not re.search(r'\.(?:mh-flv|seat-exp|np-star)', _sel17): continue
        if '@' in _sel17 or 'animation:none' in _rm.group(2).replace(' ', ''): continue
        _key17 = _sel17.split()[-1]          # 마지막 조각(.lvx / .np-star / .exp-fill …)으로 대조
        if _key17 not in re.sub(r'\s+', ' ', _red17):
            _miss17.append('움직이는 규칙 "%s" 가 prefers-reduced-motion 목록에 없음' % _sel17[:48])
    if _miss17:
        for _m in _miss17:
            problems.append('검사17: ' + _m + ' — 배지/바가 색 없는 회색 칸으로 나옵니다')
            print('  ⚠️', _m)
    else:
        print('  통과 ✅ (티어 %d칸 + 표식 %s 전부 CSS 에 존재)' % (len(_tiers17), '·'.join(_marks17)))


# ── 검사 18: 줄 끝 // 주석이 뒤의 코드를 삼킨 자리 ──────────────
section('검사 18 · 한 줄에 붙여 쓴 코드를 // 주석이 삼키지 않았는가')
# app.js 는 한 줄에 문장이 여러 개 붙어 있는 구간이 많다. 거기에 설명을 // 로 달면
# **그 뒤의 코드가 통째로 주석이 된다.** 문법은 멀쩡하니 node --check(검사 5·10)도
# smoke(검사 11)도 못 잡고, 화면에서 빈 네모로만 드러난다.
# [실제 사고] 친구 추가 창 [＋ 새로 만들기] 의 innerHTML 이 이렇게 먹혀 글자 없는 칸이 됐다.
def _swallowed_line_comments(src):
    out, i, n, line = [], 0, len(src), 1
    while i < n:
        c = src[i]
        if c == '\n':
            line += 1; i += 1; continue
        if c == '/' and i + 1 < n and src[i+1] == '*':          # 블록 주석
            j = src.find('*/', i + 2); j = n if j < 0 else j + 2
            line += src.count('\n', i, j); i = j; continue
        if c == '/' and i + 1 < n and src[i+1] == '/':          # 줄 주석
            j = src.find('\n', i); j = n if j < 0 else j
            before = src[src.rfind('\n', 0, i) + 1:i]
            body = src[i+2:j].strip()
            # 앞에 코드가 있고(=줄 끝 주석) 주석 안에 실행문이 들어 있으면 삼킨 것이다.
            # 줄 전체가 주석인 자리(의도적으로 꺼둔 코드)는 before 가 비어 걸리지 않는다.
            if before.strip() and body and (
                    (re.search(r'[\w$\]\)]\s*=[^=>]', body) and ';' in body)
                    or re.search(r'\b[\w$.]+\s*\([^()]*\)\s*;', body)):
                out.append((line, body))
            i = j; continue
        if c in '"\'`':                                          # 문자열·템플릿
            q = c; i += 1
            while i < n:
                if src[i] == '\\': i += 2; continue
                if src[i] == q: i += 1; break
                if src[i] == '\n': line += 1
                i += 1
            continue
        if c == '/':                                            # 정규식 리터럴
            k = i - 1
            while k >= 0 and src[k] in ' \t': k -= 1
            if k >= 0 and re.match(r'[\w$)\]]', src[k]):
                i += 1; continue
            i += 1
            while i < n:
                if src[i] == '\\': i += 2; continue
                if src[i] == '[':
                    while i < n and src[i] != ']':
                        if src[i] == '\\': i += 1
                        i += 1
                if src[i] == '/': i += 1; break
                if src[i] == '\n': break
                i += 1
            continue
        i += 1
    return out

_hit18 = []
for _f18 in sorted(f for f in os.listdir('.') if f.endswith('.js')):
    try:
        _src18 = open(_f18, encoding='utf-8').read()
    except Exception:
        continue
    for _l18, _b18 in _swallowed_line_comments(_src18):
        _hit18.append('%s:%d — %s' % (_f18, _l18, _b18[:90]))
if _hit18:
    for _h18 in _hit18:
        problems.append('검사18: 줄 끝 주석이 코드를 삼켰습니다 — ' + _h18)
        print('  ⚠️', _h18)
else:
    print('  통과 ✅ (줄 끝 주석에 먹힌 코드 없음)')

# ── 검사 19: HTML 이스케이프 규약 (헬퍼 통일 · 속성값 보간) ──────
section('검사 19 · 이스케이프 헬퍼가 온전한가 · 속성값에 안 씻은 보간이 있는가')
# [경위] 강도가 다른 이스케이프 헬퍼가 셋 있었다(`_chatEsc` 다섯 문자 · `_mhEsc` 두 문자 ·
#   `_linkifyText` 내부 네 문자). 약한 것이 **속성값 안에서** 쓰이면 닉네임에 `"` 하나로
#   속성을 빠져나와 `on*` 이벤트를 붙일 수 있다 — 친구 목록 `title=` 이 그 구멍이었다.
#   `escHtml` 하나로 합쳤고, 이 검사가 그 상태를 지킨다. app.js 의 innerHTML 은 130곳이 넘어서
#   사람 눈으로는 다시 늘어나는 것을 못 막는다.
_p19 = []

# ① escHtml 이 다섯 문자를 전부 막는가 (구현이 조용히 약해지는 회귀)
_m19 = re.search(r'function\s+escHtml\s*\([^)]*\)\s*\{(.*?)\n\}', app, re.S)
if not _m19:
    _p19.append('escHtml 이 없습니다 — 공용 이스케이프 헬퍼가 사라졌습니다')
else:
    _body19 = _m19.group(1)
    _need19 = [('&', '&amp;'), ('<', '&lt;'), ('>', '&gt;'), ('"', '&quot;'), ("'", '&#39;')]
    _miss19 = [c for c, ent in _need19 if ent not in _body19]
    if _miss19:
        _p19.append('escHtml 이 %s 를 안 막습니다 — 속성값 안에서 뚫립니다' % ' '.join(_miss19))
    else:
        print('  통과 ✅ (escHtml 이 다섯 문자를 전부 막는다)')

# ② 약한 옛 헬퍼가 되살아나지 않았는가 (호출부 0. 주석의 경위 서술은 세지 않는다)
_n19 = len(re.findall(r'_mhEsc\s*\(', app))
if _n19:
    _p19.append('_mhEsc 호출이 %d곳 되살아났습니다 — escHtml 로 바꾸세요' % _n19)
else:
    print('  통과 ✅ (약한 옛 헬퍼 _mhEsc 호출 0곳)')

# ③ _mhLoadRT 가 읽는 쪽 sanitize 를 거치는가 (저장형 XSS 회귀 — 자세한 것은 sim-mh-sanitize.js)
_m19b = re.search(r'function\s+_mhLoadRT\s*\([^)]*\)\s*\{(.*?)\n\}', app, re.S)
if not _m19b or '_mhSanitizeHtml' not in _m19b.group(1):
    _p19.append('_mhLoadRT 가 _mhSanitizeHtml 을 안 거칩니다 — 남의 bio·게시글이 씻기지 않고 그려집니다')
else:
    print('  통과 ✅ (_mhLoadRT 가 읽는 쪽 sanitize 를 거친다)')

# ④ 마크업 속성값 안의 보간 — 씻은 것·숫자·글자리터럴만 통과시킨다.
#   ⚠️ 정규식이라 오탐이 난다. **오탐이 나면 검사를 느슨하게 하지 말고** 그 줄을
#     escHtml 로 감싸거나 setAttribute/프로퍼티로 옮기고, 그래도 아니면 아래 목록에 적는다.
#   아래 목록은 **한 번 눈으로 본 자리**다. (속성|식) 글자로 적으므로 줄번호가 밀려도 안 깨진다.
#   새로 적을 때는 반드시 "그 문자열이 다른 사람에게서 올 수 있는가"를 먼저 답할 것.
_OK19 = {
    'class|lvBadgeClass(n)',      # 우리 함수가 돌려주는 고정 클래스 이름
    'data-url|clean',             # _linkifyText — 이미 이스케이프한 글자에서 잘라낸 조각
    'data-url|safe',              # _chatLinkify — 같음
    'data-c|c', 'style|c',        # 색 견본 — _MH_PALETTE(상수) · 최근색(내 localStorage)
    'style|cur',                  # 내가 고른 색
    'style|curColor', 'value|curColor',
    'src|url', 'src|u',           # 채팅 [emoji:URL] — _renderChatText 가 _chatEsc 를 먼저 걸어 둔다
    'src|d.file', 'style|d.w', 'style|d.h', 'style|bw', 'style|bhh',   # DEMOJI 정적 표
    'value|val',                  # HSV 슬라이더 숫자
    'placeholder|st.totalUsers',  # 관리자 통계 숫자
    'data-a|b.a',                 # 팝업 버튼 id — 부르는 자리의 글자 리터럴
    'class|cls',                  # 계산된 고정 클래스
}
_SINK19 = re.compile(r'(?:^|[\s<])(src|href|title|alt|placeholder|value|style|class|on\w+|data-[\w-]+)\s*=\s*(["\'])((?:(?!\2).)*?)\2', re.I)
_INT19 = re.compile(r'\$\{([^{}]*)\}|\'\s*\+\s*([^+]+?)\s*\+\s*\'|"\s*\+\s*([^+]+?)\s*\+\s*"')
def _safe19(e):
    e = e.strip()
    if re.search(r'escHtml\(|_chatEsc\(|encodeURIComponent\(', e): return True                  # 씻었다
    if re.search(r'\|\s*0\b|Number\(|parseInt|parseFloat|toFixed\(|Math\.', e): return True     # 숫자
    if re.fullmatch(r'[\d.]+', e): return True
    if re.fullmatch(r'\(?\s*[^\'"?]*\?\s*([\'"])[^\'"]*\1\s*:\s*([\'"])[^\'"]*\2\s*\)?', e): return True  # 글자리터럴 삼항
    if re.fullmatch(r'[A-Z][A-Z0-9_]{2,}', e): return True                                      # 대문자 상수
    if re.fullmatch(r'(i|j|k|n|idx|no|ii)', e): return True                                     # 반복 첨자
    return False
_hit19 = []
for _n19b, _l19 in enumerate(app_lines, 1):
    if '<' not in _l19: continue
    for _m in _SINK19.finditer(_l19):
        for _im in _INT19.finditer(_m.group(3)):
            _e19 = (_im.group(1) or _im.group(2) or _im.group(3) or '').strip()
            if not _e19 or _safe19(_e19): continue
            _key19 = _m.group(1).lower() + '|' + _e19
            if _key19 in _OK19: continue
            _hit19.append('app.js:%d — %s' % (_n19b, _key19))
if _hit19:
    for _h19 in _hit19:
        _p19.append('검사19: 속성값에 안 씻은 보간 — ' + _h19)
        print('  ⚠️', _h19)
else:
    print('  통과 ✅ (마크업 속성값 보간 — 안 씻은 자리 0곳 · 검토완료 목록 %d종)' % len(_OK19))

for _x19 in _p19:
    if not _x19.startswith('검사19'):
        print('  ⚠️', _x19)
        _x19 = '검사19: ' + _x19
    problems.append(_x19)


print('\n' + '★' * 30)
if problems:
    print(f'[v2 포함] 문제 {len(problems)}건:')
    for p in problems: print(' -', p)
    sys.exit(1)
print('[v2 포함] 전부 통과 — 릴리스 가능 ✅')
sys.exit(0)
