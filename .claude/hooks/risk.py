#!/usr/bin/env python3
"""PR 위험도 판정 — 세션의 판단이 아니라 diff 로 기계적으로 정한다. /ship 과 가드(ship-gate.py)가 같이 쓴다.

높음 = 데이터 경로 · 권한 · 서버 · 빌드에 닿는 변경 — 머지 전 승인은 받지 않는다(앱 · 규칙 · 함수 · Hosting 은 사람이 내보낸다 ·
승인자는 내보내기 전 `--release` 한 장으로 본다). 단 웹 관리자 길(admin 으로 가는 PR)은 판을 거치지 않아 그 한 장에 안 나오므로 높으면 머지 전 승인.
머지 전 승인자(OWNER) 승인은 **가드 자리(is_guard — 훅 폴더 · 훅 설정 · 훅이 돌리는 스크립트 · 지침 · /ship 안내서)를 바꾸는 PR · 웹 관리자 길의 높음** — 판단은 approval_reason 한 곳 ·
가드가 «컨펌 · 검증 없이 머지 못 함» 을 지키는 마지막 자리라, 세션이 가드를 스스로 풀지 못하게. 승인은 GitHub Approve, 또는 PR 코멘트 한 줄 «승인 <머리 커밋 앞 7자리 이상>»(GitHub 은 작성자가 자기 PR 을 Approve 못 하는데
이 PC 세션들은 OWNER 계정으로 PR 을 올린다). 커밋 번호를 받는 까닭: 시각으로 가리면 승인 뒤 옛 날짜 커밋을 올려도 통과한다.
낮음 = 문구 · 화면 배치 · 스타일 · 데이터 경로가 그대로인 수정 · 문서 — 컨펌자 · 검증자 통과로 머지.

승인 · 판정은 커밋에 걸지만, 그 뒤 판 브랜치를 합치기만 한 머리(PR 자체 변경이 그대로)는 앞 커밋의 승인 · 판정을 이어 받는다(same_change).

  python3 .claude/hooks/risk.py <PR 번호>              → {"high": bool, "reasons": [...]} (gh api REST 만 씀 — 웹 세션에서도 된다)
  python3 .claude/hooks/risk.py --same <PR> <옛 커밋>   → 지금 머리가 그 커밋과 PR 자체 변경이 같은가(true/false)
  python3 .claude/hooks/risk.py --owner <PR>          → 머지 전 승인이 필요한 PR 인가(true/false — 가드 자리를 바꿀 때 · admin 으로 가는 PR 이 위험도가 높을 때)
  python3 .claude/hooks/risk.py --release <판 브랜치>   → 그 판에 머지된 PR 중 위험도 높았던 것 · 이유 한 장(릴리스 직전 승인자가 본다)
  python3 .claude/hooks/risk.py --wait <PR>             → 승인(낮음이면 바로) · CI 가 끝날 때까지 기다렸다가 한 줄로 알린다(/ship 이 뒤에서 돌림)
"""
import base64, json, re, subprocess, sys, time

# Windows 는 표준 입출력이 지역 인코딩(cp949)이라 «·» 같은 글자를 쓰다 죽는다 — hook 입출력은 UTF-8 로 고정
for _s in (sys.stdin, sys.stdout, sys.stderr):
    try:
        _s.reconfigure(encoding='utf-8')
    except Exception:
        pass

REPO = 'grk-cmd/t-w'
OWNER = 'mihioon'
# 이 자리를 바꾸는(새로 더하기 · 지우기 · 이름 바꾸기 포함) PR 만 머지 전 승인 — 세션이 가드 · 판정을 스스로 풀지 못하게.
#   훅 폴더 전부(가드 옆에 표준 모듈과 같은 이름을 두면 가드가 그걸 불러 죽는다) · 훅 설정 전부(settings.local.json 의 «훅 끄기» 포함) ·
#   훅이 돌리는 스크립트 · 컨펌자 · 검증자 지침 · /ship 안내서. 시험 파일만 뺀다.
GUARD_PREFIXES = ('.claude/hooks/', '.claude/agents/', '.claude/skills/ship/')
GUARD_FILES = ('scripts/todo.js', 'scripts/approve.js')   # 세션 시작 훅이 돌림 · 승인 코멘트를 다는 명령(바꾸면 다른 PR 에 몰래 승인을 달 수 있다)
GUARD_SETTINGS = re.compile(r'^\.claude/settings[^/]*\.json$')
GUARD_SKIP = ('.claude/hooks/test_hooks.py',)
GUARD_LABEL = '.claude/hooks/ · .claude/settings*.json · .claude/agents/ · .claude/skills/ship/ · scripts/todo.js · scripts/approve.js'
# 한 줄 전체가 «승인 <sha 앞자리>» 일 때만 — 승인 요청 코멘트(«승인 요청 — …»)와 섞이지 않게
APPROVE_LINE = re.compile(r'^\s*승인\s+([0-9a-f]{7,40})\s*$', re.M)
# 판 브랜치를 합치면 검사 해시 줄(CHECKS.md §3)의 줄 수 · 해시가 다시 계산돼 바뀐다 — 그 둘만 지우고 파일 이름은 남겨 견준다
# (줄을 더하거나 지우면 그대로 다르게 잡힌다 · 해시가 맞는지는 CI 정본 대조가 본다)
CHECKS_FILE = 'checks/CHECKS.md'
CHECKS_ROW = re.compile(r'^([ +-]\| \*\*[^*|]+\*\* \|) \d+ \| \*\*[0-9a-f]{12}\*\* \|$')
# Firebase 규칙 · 설정 — 위험도 표(RISKY_FILES)와 «같은 변경» 판정(_hunks)이 같이 쓴다
# 0.13 은 firebase/ 아래 · admin 브랜치(웹 관리자 길)는 옛 모양이라 맨 위도 본다
FIREBASE_CONFIG = re.compile(r'^(firebase/)?(firebase-database-rules\.json|storage\.rules|firebase\.json|\.firebaserc)$')
# «같은 변경» 견주기: 규칙 · 설정 · 가드 파일은 줄 번호 그대로(생김새가 같은 묶음이 되풀이돼 덩어리 하나면 상대 줄로는 자리가 안 잡혀서).
# 그 밖은 첫 덩어리에서 잰 상대 줄 — 다른 갈래가 위쪽을 고쳐 통째로 밀린 합치기는 같고, 덩어리 사이가 달라지면 다르다
HUNK_HEAD = re.compile(r'^@@ -(\d+)(,\d+)? \+(\d+)(,\d+)? @@')
# 검사 기준선(줄 수 · 개수 상한) — 판 브랜치를 합친 뒤 --write-baseline 으로 다시 쓰면 숫자가 바뀐다.
# 합친 값이 «옛 머리 · 합친 판 브랜치» 어느 쪽보다도 느슨하지 않으면(숫자는 둘 중 큰 값 이하 · 목록은 둘의 합 안) 같은 변경으로 본다
BASELINE_FILE = re.compile(r'^checks/[\w-]+-baseline\.json$')
COMPARE_MAX = 300   # compare API 가 주는 파일 상한 — 다 차면 못 다 본 것이라 같다고 하지 않는다
WAIT_SEC, WAIT_EVERY = 3600, 30

# 이 파일을 바꾸면 늘 높음
RISKY_FILES = [
    (FIREBASE_CONFIG, 'Firebase 규칙 · 설정'),
    (re.compile(r'^apps/desktop/app/parts/firebase-init\.js$'), 'firebase-init.js(DB 경로)'),
    (re.compile(r'^apps/desktop/app/parts/shared/(data-gateway|api-client|source-switch|remote-config)\.js$'), '서버 · 데이터 통로'),
    (re.compile(r'^firebase/functions/'), 'Cloud Functions'),
    (re.compile(r'^apps/desktop/((main|preload)\.js$|overlay-|sysinput-)'), 'Electron 메인 · IPC · 플랫폼'),
    (re.compile(r'^((apps/[^/]+|packages/[^/]+)/)?package(-lock)?\.json$'), '의존성 · 빌드 설정'),
    (re.compile(r'^\.github/workflows/'), 'CI · 릴리스 워크플로'),
    (re.compile(r'^\.claude/'), '하네스 자체'),
    (re.compile(r'^(apps/admin|web-admin)/src/.*(firebase|db|api)', re.I), '웹 관리자 데이터 접근'),
]
# 더한 줄에 이것이 있으면 높음(데이터 경로가 새로 생기거나 바뀜)
RISKY_LINES = [
    (re.compile(r'\b(onValue|onChildAdded|onChildChanged|onChildRemoved|runTransaction|onDisconnect)\s*\('), 'Firebase 구독 · 트랜잭션'),
    (re.compile(r'\b(get|set|update|push|remove)\s*\(\s*(ref|child|query)\s*\('), 'Firebase 읽기 · 쓰기'),
    (re.compile(r'firebaseAPI\.\w+\s*\('), 'firebaseAPI 호출'),
    (re.compile(r'\bfetch\s*\(|\bapiClient\b|\bnew WebSocket\b|realtime-link'), '서버 호출'),
    (re.compile(r"localStorage\.(setItem|removeItem)\s*\(\s*['\"]tw\."), '저장 키'),
    # 앱이 바깥 주소를 새로 박으면 바꿀 때 앱을 다시 내야 한다 — 사람이 보고, 새 사이트는 우리 도메인(*.together-working.com)으로
    (re.compile(r'Content-Security-Policy', re.I), '앱 보안 설정(CSP)'),   # http-equiv 는 대소문자를 가리지 않는다
    (re.compile(r'[a-z0-9-]+\\?\.(?:web\\?\.app|firebaseapp\\?\.com)\b', re.I), 'Firebase 기본 주소(우리 도메인 대신)'),   # 정규식 안의 \. 도
]


def api(path):
    p = subprocess.run(['gh', 'api', '--paginate', path], capture_output=True, text=True, encoding='utf-8', errors='replace')
    if p.returncode:
        raise RuntimeError(f'gh api {path}: {p.stderr.strip()[:200]}')
    # --paginate 는 배열을 이어 붙여 내보낸다
    return json.loads('[' + p.stdout.replace('][', '],[') + ']') if p.stdout.lstrip().startswith('[') else json.loads(p.stdout)


def get(path):
    """한 쪽만 — compare 처럼 객체를 주는 길은 --paginate 로 이어 붙이면 JSON 이 깨진다."""
    p = subprocess.run(['gh', 'api', path], capture_output=True, text=True, encoding='utf-8', errors='replace')
    if p.returncode:
        raise RuntimeError(f'gh api {path}: {p.stderr.strip()[:200]}')
    return json.loads(p.stdout)


def assess(pr, files=None):
    """files 를 주면 그 목록으로(웹 관리자 길의 자기 변경 — admin_own_files), 없으면 PR 파일 목록으로 잰다."""
    if files is None:
        pages = api(f'repos/{REPO}/pulls/{pr}/files?per_page=100')
        files = [f for page in pages for f in (page if isinstance(page, list) else [page])]
    reasons = set()
    for f in files:
        name = f['filename']
        for rx, why in RISKY_FILES:
            if rx.search(name):
                reasons.add(f'{why}: {name}')
        if f.get('status') == 'added' and name.startswith('apps/desktop/app/parts/') and name.endswith('.js'):
            reasons.add(f'새 모듈: {name}')
        if name.startswith(('checks/', 'apps/admin/tests/', 'docs/')):  # 검사 · 문서의 가짜 호출은 데이터 경로가 아니다
            continue
        for line in (f.get('patch') or '').splitlines():
            if not line.startswith('+') or line.startswith('+++'):
                continue
            for rx, why in RISKY_LINES:
                if rx.search(line):
                    reasons.add(f'{why}: {name}')
        if f.get('patch') is None and f.get('changes', 0) > 0 and not name.endswith(('.png', '.jpg', '.glb', '.svg')):
            reasons.add(f'diff 가 너무 커서 못 읽음: {name}')
    return {'high': bool(reasons), 'reasons': sorted(reasons)}


def _rows(pages):
    return [r for page in pages for r in (page if isinstance(page, list) else [page])]


def comment_approves(body, head_sha):
    return any(head_sha.startswith(m.group(1)) for m in APPROVE_LINE.finditer(body or ''))


def _hunks(name, patch):
    """diff 덩어리 — 규칙 · 설정 · 가드 파일은 줄 번호까지 그대로(생김새가 같은 다른 묶음에 넣으면 다르게 잡히게),
    나머지는 덩어리 머리의 줄 번호를 첫 덩어리에서 잰 상대 줄로 바꾸고 함수 꼬리는 지운다."""
    lines = patch.splitlines()
    if name == CHECKS_FILE:   # 검사 해시 표 — 줄 자리는 뜻이 없고(다른 갈래가 표 가운데에 줄을 더한다) 해시는 CI 정본 대조가 본다
        return tuple('@@' if l.startswith('@@') else CHECKS_ROW.sub(r'\1', l) for l in lines)
    if FIREBASE_CONFIG.match(name) or is_guard(name):
        return tuple(lines)
    out, first = [], None
    for l in lines:
        m = HUNK_HEAD.match(l)
        if m:
            o, n = int(m.group(1)), int(m.group(3))
            first = first or (o, n)
            l = f'@@ -{o - first[0]}{m.group(2) or ""} +{n - first[1]}{m.group(4) or ""} @@'
        out.append(l)
    return tuple(out)


def _compare(base, sha):
    """그 커밋이 base 에서 갈라진 뒤 PR 이 바꾼 것 — (파일마다 diff 덩어리, 갈라진 커밋). 못 다 보면 덩어리는 None."""
    c = get(f'repos/{REPO}/compare/{base}...{sha}')
    files = c.get('files') or []
    mb = (c.get('merge_base_commit') or {}).get('sha')
    if len(files) >= COMPARE_MAX:
        return None, mb
    out = {}
    for f in files:
        name, patch = f['filename'], f.get('patch')
        if patch is None:   # 그림 · 너무 큰 diff — 머리 판만으로는 판 브랜치 쪽 변경을 되돌렸는지 못 본다
            return None, mb
        out[name] = (f.get('status'), f.get('previous_filename'), _hunks(name, patch))
    return out or None, mb   # 바꾼 것이 하나도 안 보이면 견줄 것이 없다 — 같다고 하지 않는다


def own_change(base, sha):
    return _compare(base, sha)[0]


def _json_at(path, ref):
    """그 커밋의 파일을 JSON 으로 — 없으면 None. 못 읽으면 던진다(같다고 하지 않게)."""
    try:
        c = get(f'repos/{REPO}/contents/{path}?ref={ref}')
    except RuntimeError as e:
        if 'HTTP 404' in str(e):
            return None
        raise
    return json.loads(base64.b64decode(c['content']).decode('utf-8'))


def _no_looser(new, old, base):
    """new 의 숫자는 old · base 가운데 큰 값 이하, 목록은 둘의 합 안, 그 밖은 둘 중 하나와 같다 — 합치며 새로 느슨해진 것이 없다."""
    if isinstance(new, dict):
        return all(_no_looser(v, old.get(k) if isinstance(old, dict) else None, base.get(k) if isinstance(base, dict) else None)
                   for k, v in new.items())
    if isinstance(new, list):
        seen = {json.dumps(x, sort_keys=True) for side in (old, base) if isinstance(side, list) for x in side}
        return all(json.dumps(x, sort_keys=True) in seen for x in new)
    if isinstance(new, (int, float)) and not isinstance(new, bool):
        sides = [x for x in (old, base) if isinstance(x, (int, float)) and not isinstance(x, bool)]
        return bool(sides) and new <= max(sides)
    return new in (old, base)


def _baseline_merged(path, old_sha, new_sha, new_base):
    new = _json_at(path, new_sha)
    if new is None or not new_base:
        return False
    return _no_looser(new, _json_at(path, old_sha), _json_at(path, new_base))


_same = {}   # (pr, 옛, 새) → 답 — 기다리는 동안 같은 compare 를 되풀이해 묻지 않게


def same_change(pr, old_sha, new_sha):
    """new 가 old 위에 판 브랜치를 합치기만 했는가 — 두 커밋의 PR 자체 변경이 같으면 true.
    합치며 충돌을 손으로 풀어 코드가 달라졌으면 false(다시 판정 · 승인). 기준선 json 은 숫자가 느슨해지지 않았으면 같다고 본다."""
    if not old_sha or not new_sha:
        return False
    if old_sha == new_sha:
        return True
    key = (str(pr), old_sha, new_sha)
    if key not in _same:
        base = get(f'repos/{REPO}/pulls/{pr}')['base']['ref']
        a, _ = _compare(base, old_sha)
        b, new_base = _compare(base, new_sha)
        _same[key] = a is not None and b is not None and all(
            a.get(k) == b.get(k) or (BASELINE_FILE.match(k) and _baseline_merged(k, old_sha, new_sha, new_base))
            for k in set(a) | set(b))
    return _same[key]


def is_guard(path):
    if not path or path in GUARD_SKIP:
        return False
    return path.startswith(GUARD_PREFIXES) or path in GUARD_FILES or bool(GUARD_SETTINGS.match(path))


MAIN_OK = ('hotfix/', 'harness/', 'release/')   # main 으로 무엇이든 가져갈 수 있는 PR — 긴급 수정 · 하네스 · 판 내기
ADMIN_BRANCH = 'admin'   # 웹 관리자 정본 — 작업 PR 은 여기로 · Hosting 은 여기서 내보낸다 · 내보낸 뒤 admin → main 합치기(merge commit)
ADMIN_DIR = 'web-admin/'   # 웹 관리자 길이 main 에 없는 것으로 가져올 수 있는 곳(0.13 은 apps/admin/ — 합칠 때 여기 하나만 바꾼다)


def _refs(info):
    return str((info.get('base') or {}).get('ref') or ''), str((info.get('head') or {}).get('ref') or '')


def admin_path(info):
    """웹 관리자 작업 PR 인가 — base 가 admin(브랜치 이름이 아니라 base 로)."""
    return _refs(info)[0] == ADMIN_BRANCH


def admin_merge(info):
    """내보낸 웹 관리자를 main 으로 합치는 PR 인가 — admin → main."""
    return _refs(info) == ('main', ADMIN_BRANCH)


def main_closed(pr):
    """main 으로 가는데 받을 수 없는 PR 인가 — main 은 낸 것만: hotfix/ · harness/ · 판 내기(release/) · admin 합치기만 받는다.
    웹 관리자 작업도 이제 admin 으로 간다. 읽기 실패는 던진다(가드가 막는다)."""
    base, head = _refs(get(f'repos/{REPO}/pulls/{pr}'))
    return base == 'main' and not (head.startswith(MAIN_OK) or head == ADMIN_BRANCH)


def admin_own_files(info):
    """웹 관리자 길이 main 에 없는 것으로 가져오는 변경 — PR 파일 목록이 아니라 main...머리 를 견준다.
    main 을 admin 에 합쳐 받는 PR 은 main 에 이미 있는 앱 · 규칙 파일을 실어 와도 그것은 이 길의 변경이 아니다.
    견줄 파일이 다 안 왔으면(compare 는 300개에서 끊긴다) None — 못 본 것. 읽기 실패는 던진다(가드가 막는다)."""
    files = get(f'repos/{REPO}/compare/main...{info["head"]["sha"]}').get('files') or []
    return None if len(files) >= COMPARE_MAX else files


def admin_needs_owner(pr):
    """웹 관리자 길(admin 으로 가는 PR)에서 위험도가 높으면 머지 전에 승인 — 이 길은 판을 거치지 않고 admin 에서 바로 내보내서
    «내보내기 전 risk.py --release 한 장» 에 나오지 않는다. 그 확인을 머지 전 승인으로 당긴다. admin → main 합치기는 이미 내보낸 것이라 묻지 않는다.
    위험도는 이 PR 파일 중 main 에 없는 것(admin_own_files 에도 있는 것)으로 잰다 — main 을 합쳐 실어 온 규칙 · 함수도,
    admin 에 먼저 머지된 앞 PR 의 변경도 이 PR 몫이 아니다. 못 다 봤으면 높음."""
    info = get(f'repos/{REPO}/pulls/{pr}')
    if not admin_path(info):
        return False
    own = admin_own_files(info)
    files = [f for page in api(f'repos/{REPO}/pulls/{pr}/files?per_page=100') for f in (page if isinstance(page, list) else [page]) if isinstance(f, dict)]
    if own is None or len(files) < int(info.get('changed_files') or 0):
        return True
    names = {n for f in own for n in (f.get('filename'), f.get('previous_filename')) if n}
    return assess(pr, [f for f in files if f.get('filename') in names or f.get('previous_filename') in names])['high']


def admin_outside(pr):
    """웹 관리자 길(admin 으로 가는 PR · admin → main 합치기)의 자기 변경(admin_own_files) 중 web-admin/ 밖의 파일(옮긴 옛 이름도).
    앱 코드가 판을 건너뛰고 admin(→ main)으로 새는 것만 잡는다. 브랜치 이름이 아니라 base 로 본다.
    못 다 봤으면 그 사실을 돌려준다. 읽기 실패는 던진다(가드가 막는다)."""
    info = get(f'repos/{REPO}/pulls/{pr}')
    if not (admin_path(info) or admin_merge(info)):
        return []
    files = admin_own_files(info)
    if files is None:
        return ['(파일 목록을 다 못 봄)']
    return [n for f in files for n in (f.get('filename'), f.get('previous_filename')) if n and not n.startswith(ADMIN_DIR)]


def approval_reason(pr):
    """머지 전에 승인자 승인이 필요한 까닭 — 'guard'(가드 자리를 바꿈) · 'admin'(admin 으로 가는 웹 관리자 PR 이 위험도 높음) · ''(필요 없음).
    가드 · --owner · --wait 가 이 한 곳을 쓴다. 읽기 실패는 던진다(가드가 막는다)."""
    if needs_owner(pr):
        return 'guard'
    return 'admin' if admin_needs_owner(pr) else ''


def must_approve(pr):
    return bool(approval_reason(pr))


def needs_owner(pr):
    """머지 전 승인이 필요한 PR 인가 — 가드 자리를 바꿀 때만(base 와 상관없이 · 옮겨도).
    파일 목록이 다 안 왔으면(API 는 3000개에서 끊긴다) 못 본 것이라 승인을 받는다."""
    files = [f for page in api(f'repos/{REPO}/pulls/{pr}/files?per_page=100') for f in (page if isinstance(page, list) else [page]) if isinstance(f, dict)]
    if len(files) < int(get(f'repos/{REPO}/pulls/{pr}').get('changed_files') or 0):
        return True
    return any(is_guard(f.get('filename')) or is_guard(f.get('previous_filename')) for f in files)


def release_summary(branch):
    """그 판 브랜치에 머지된 PR 중 위험도 높았던 것 — 승인자가 릴리스 직전에 한 번 본다."""
    pulls = [p for p in _rows(api(f'repos/{REPO}/pulls?state=closed&base={branch}&per_page=100')) if isinstance(p, dict) and p.get('merged_at')]
    rows = []
    for p in sorted(pulls, key=lambda x: x['merged_at']):
        r = assess(p['number'])
        if r['high']:
            rows.append((p['number'], p['title'], r['reasons']))
    return len(pulls), rows


def pr_commits(pr):
    return [c['sha'] for c in _rows(api(f'repos/{REPO}/pulls/{pr}/commits?per_page=100')) if isinstance(c, dict) and c.get('sha')]


def owner_approved(pr, head_sha):
    """승인자가 지금 머리 커밋을 승인했는가 — 마지막 리뷰가 그 커밋의 APPROVED 이거나, «승인 <그 커밋>» 코멘트가 있다.
    없으면 PR 의 옛 커밋에 걸린 승인 중 지금 머리와 PR 자체 변경이 같은 것(판 브랜치만 합침)을 이어 받는다."""
    if not head_sha:
        return False
    reviews = [r for r in _rows(api(f'repos/{REPO}/pulls/{pr}/reviews?per_page=100'))
               if (r.get('user') or {}).get('login') == OWNER and r.get('state') in ('APPROVED', 'CHANGES_REQUESTED', 'DISMISSED')]
    last = reviews[-1] if reviews else {}
    if last.get('commit_id') == head_sha and last.get('state') == 'APPROVED':
        return True
    if last.get('commit_id') == head_sha and last.get('state') == 'CHANGES_REQUESTED':
        return False   # 그 커밋에 Request changes 를 했으면 코멘트로 덮지 않는다
    comments = [c for c in _rows(api(f'repos/{REPO}/issues/{pr}/comments?per_page=100')) if (c.get('user') or {}).get('login') == OWNER]
    if any(comment_approves(c.get('body'), head_sha) for c in comments):
        return True
    if last.get('state') == 'CHANGES_REQUESTED':
        return False   # 마지막 리뷰가 Request changes 면 옛 승인을 이어 받지 않는다
    marks = [r['commit_id'] for r in reviews if r.get('state') == 'APPROVED' and r.get('commit_id')]
    marks += [m.group(1) for c in comments for m in APPROVE_LINE.finditer(c.get('body') or '')]
    olds = [s for s in reversed(pr_commits(pr)) if s != head_sha and any(s.startswith(m) for m in marks)]
    return bool(olds) and same_change(pr, olds[0], head_sha)   # 가장 최근에 승인된 커밋 하나만 견준다


def checks_done(sha):
    """CI 가 다 끝났으면 (True, 빨강 이름 목록), 아직이면 (False, [])."""
    runs = get(f'repos/{REPO}/commits/{sha}/check-runs?per_page=100').get('check_runs') or []
    if not runs or any(r.get('status') != 'completed' for r in runs):
        return False, []
    return True, [r['name'] for r in runs if r.get('conclusion') not in ('success', 'skipped', 'neutral')]


def wait(pr, limit=WAIT_SEC, every=WAIT_EVERY, sleep=time.sleep):
    """승인(낮음이면 건너뜀)과 CI 끝을 기다린다 — 사용자가 /ship 을 다시 치지 않게 세션이 뒤에서 돌린다."""
    seen, need, err = None, True, ''
    for _ in range(max(1, int(limit // every))):
        try:
            pull = get(f'repos/{REPO}/pulls/{pr}')
            sha = pull['head']['sha']
            if pull.get('state') != 'open':
                return 1, f'#{pr} 이 열려 있지 않다({pull.get("state")})'
            if sha != seen:   # 새 커밋이 올라오면 다시 본다
                seen, need = sha, must_approve(pr)   # 승인은 가드 자리 · 웹 관리자 길의 높음만
            if not need or owner_approved(pr, sha):
                done, red = checks_done(sha)
                if done:
                    return (1, f'#{pr} CI 빨강: {", ".join(red)} ({sha[:7]})') if red else (0, f'#{pr} 승인 · CI 초록 — 머지할 차례 ({sha[:7]})')
            err = ''
        except (RuntimeError, KeyError, ValueError) as e:   # 한 번 읽기 실패는 다음 바퀴에 다시
            err = f' · 마지막 읽기 실패: {str(e)[:80]}'
        sleep(every)
    return 1, f'#{pr} {limit // 60}분 동안 승인 · CI 가 끝나지 않음{err}'


if __name__ == '__main__':
    a = sys.argv[1:]
    if a[:1] == ['--same'] and len(a) == 3:
        print(json.dumps(same_change(a[1], get(f'repos/{REPO}/commits/{a[2]}')['sha'], get(f'repos/{REPO}/pulls/{a[1]}')['head']['sha'])))
    elif a[:1] == ['--owner'] and len(a) == 2:
        print(json.dumps(must_approve(a[1])))
    elif a[:1] == ['--release'] and len(a) == 2:
        total, rows = release_summary(a[1])
        print(f'{a[1]} 에 머지된 PR {total}개 중 위험도 높음 {len(rows)}개')
        for n, title, reasons in rows:
            print(f'- #{n} {title}')
            for why in reasons[:6]:
                print(f'    · {why}')
    elif a[:1] == ['--wait'] and len(a) == 2:
        code, msg = wait(a[1])
        print(msg)
        sys.exit(code)
    else:
        print(json.dumps(assess(a[0]), ensure_ascii=False, indent=1))
