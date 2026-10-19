#!/usr/bin/env python3
"""PR 위험도 판정 — 세션의 판단이 아니라 diff 로 기계적으로 정한다. /ship 과 가드(ship-gate.py)가 같이 쓴다.

높음 = 데이터 경로 · 권한 · 서버 · 빌드에 닿는 변경. 높으면 머지 전에 승인자(OWNER)의 승인이 있어야 한다 —
GitHub Approve, 또는 PR 코멘트 한 줄 «승인 <머리 커밋 앞 7자리 이상>»(GitHub 은 작성자가 자기 PR 을 Approve 못 하는데
이 PC 세션들은 OWNER 계정으로 PR 을 올린다). 커밋 번호를 받는 까닭: 시각으로 가리면 승인 뒤 옛 날짜 커밋을 올려도 통과한다.
낮음 = 문구 · 화면 배치 · 스타일 · 데이터 경로가 그대로인 수정 · 문서 — 컨펌자 · 검증자 통과로 머지.

승인 · 판정은 커밋에 걸지만, 그 뒤 판 브랜치를 합치기만 한 머리(PR 자체 변경이 그대로)는 앞 커밋의 승인 · 판정을 이어 받는다(same_change).

  python3 .claude/hooks/risk.py <PR 번호>              → {"high": bool, "reasons": [...]} (gh api REST 만 씀 — 웹 세션에서도 된다)
  python3 .claude/hooks/risk.py --same <PR> <옛 커밋>   → 지금 머리가 그 커밋과 PR 자체 변경이 같은가(true/false)
  python3 .claude/hooks/risk.py --wait <PR>             → 승인(낮음이면 바로) · CI 가 끝날 때까지 기다렸다가 한 줄로 알린다(/ship 이 뒤에서 돌림)
"""
import json, re, subprocess, sys, time

# Windows 는 표준 입출력이 지역 인코딩(cp949)이라 «·» 같은 글자를 쓰다 죽는다 — hook 입출력은 UTF-8 로 고정
for _s in (sys.stdin, sys.stdout, sys.stderr):
    try:
        _s.reconfigure(encoding='utf-8')
    except Exception:
        pass

REPO = 'grk-cmd/t-w'
OWNER = 'mihioon'
# 한 줄 전체가 «승인 <sha 앞자리>» 일 때만 — 승인 요청 코멘트(«승인 요청 — …»)와 섞이지 않게
APPROVE_LINE = re.compile(r'^\s*승인\s+([0-9a-f]{7,40})\s*$', re.M)
# 판 브랜치를 합치면 검사 해시 줄(CHECKS.md §3)의 줄 수 · 해시가 다시 계산돼 바뀐다 — 그 둘만 지우고 파일 이름은 남겨 견준다
# (줄을 더하거나 지우면 그대로 다르게 잡힌다 · 해시가 맞는지는 CI 정본 대조가 본다)
CHECKS_FILE = 'checks/CHECKS.md'
CHECKS_ROW = re.compile(r'^([ +-]\| \*\*[^*|]+\*\* \|) \d+ \| \*\*[0-9a-f]{12}\*\* \|$')
COMPARE_MAX = 300   # compare API 가 주는 파일 상한 — 다 차면 못 다 본 것이라 같다고 하지 않는다
WAIT_SEC, WAIT_EVERY = 3600, 30

# 이 파일을 바꾸면 늘 높음
RISKY_FILES = [
    (re.compile(r'^firebase-database-rules\.json$|^storage\.rules$|^firebase\.json$'), 'Firebase 규칙 · 설정'),
    (re.compile(r'^app/parts/firebase-init\.js$'), 'firebase-init.js(DB 경로)'),
    (re.compile(r'^app/parts/shared/(data-gateway|api-client|source-switch|remote-config)\.js$'), '서버 · 데이터 통로'),
    (re.compile(r'^functions/'), 'Cloud Functions'),
    (re.compile(r'^(main|preload)\.js$|^overlay-|^sysinput-'), 'Electron 메인 · IPC · 플랫폼'),
    (re.compile(r'^package(-lock)?\.json$|^web-admin/package(-lock)?\.json$'), '의존성 · 빌드 설정'),
    (re.compile(r'^\.github/workflows/'), 'CI · 릴리스 워크플로'),
    (re.compile(r'^\.claude/'), '하네스 자체'),
    (re.compile(r'^web-admin/src/.*(firebase|db|api)', re.I), '웹 관리자 데이터 접근'),
]
# 더한 줄에 이것이 있으면 높음(데이터 경로가 새로 생기거나 바뀜)
RISKY_LINES = [
    (re.compile(r'\b(onValue|onChildAdded|onChildChanged|onChildRemoved|runTransaction|onDisconnect)\s*\('), 'Firebase 구독 · 트랜잭션'),
    (re.compile(r'\b(get|set|update|push|remove)\s*\(\s*(ref|child|query)\s*\('), 'Firebase 읽기 · 쓰기'),
    (re.compile(r'firebaseAPI\.\w+\s*\('), 'firebaseAPI 호출'),
    (re.compile(r'\bfetch\s*\(|\bapiClient\b|\bnew WebSocket\b|realtime-link'), '서버 호출'),
    (re.compile(r"localStorage\.(setItem|removeItem)\s*\(\s*['\"]tw\."), '저장 키'),
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


def assess(pr):
    pages = api(f'repos/{REPO}/pulls/{pr}/files?per_page=100')
    files = [f for page in pages for f in (page if isinstance(page, list) else [page])]
    reasons = set()
    for f in files:
        name = f['filename']
        for rx, why in RISKY_FILES:
            if rx.search(name):
                reasons.add(f'{why}: {name}')
        if f.get('status') == 'added' and name.startswith('app/parts/') and name.endswith('.js'):
            reasons.add(f'새 모듈: {name}')
        if name.startswith(('checks/', 'web-admin/tests/', 'docs/')):  # 검사 · 문서의 가짜 호출은 데이터 경로가 아니다
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
    """diff 덩어리를 줄 번호까지 그대로 — 자리가 고정돼, 생김새가 같은 다른 묶음(규칙 JSON 등)에 넣으면 다르게 잡힌다.
    판 브랜치가 같은 파일 위쪽을 고쳐 번호가 밀리면 다르다고 나온다(다시 판정 · 승인 — 안전한 쪽)."""
    if name != CHECKS_FILE:
        return tuple(patch.splitlines())
    return tuple(CHECKS_ROW.sub(r'\1', l) for l in patch.splitlines())


def own_change(base, sha):
    """그 커밋이 base 에서 갈라진 뒤 PR 이 바꾼 것 — 파일마다 diff 덩어리(줄 번호 그대로). 못 다 보면 None."""
    files = get(f'repos/{REPO}/compare/{base}...{sha}').get('files') or []
    if len(files) >= COMPARE_MAX:
        return None
    out = {}
    for f in files:
        name, patch = f['filename'], f.get('patch')
        if patch is None:   # 그림 · 너무 큰 diff — 머리 판만으로는 판 브랜치 쪽 변경을 되돌렸는지 못 본다
            return None
        out[name] = (f.get('status'), f.get('previous_filename'), _hunks(name, patch))
    return out or None   # 바꾼 것이 하나도 안 보이면 견줄 것이 없다 — 같다고 하지 않는다


_same = {}   # (pr, 옛, 새) → 답 — 기다리는 동안 같은 compare 를 되풀이해 묻지 않게


def same_change(pr, old_sha, new_sha):
    """new 가 old 위에 판 브랜치를 합치기만 했는가 — 두 커밋의 PR 자체 변경이 같으면 true.
    합치며 충돌을 손으로 풀어 코드가 달라졌으면 false(다시 판정 · 승인)."""
    if not old_sha or not new_sha:
        return False
    if old_sha == new_sha:
        return True
    key = (str(pr), old_sha, new_sha)
    if key not in _same:
        base = get(f'repos/{REPO}/pulls/{pr}')['base']['ref']
        a = own_change(base, old_sha)
        _same[key] = a is not None and a == own_change(base, new_sha)
    return _same[key]


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
    seen, high, err = None, True, ''
    for _ in range(max(1, int(limit // every))):
        try:
            pull = get(f'repos/{REPO}/pulls/{pr}')
            sha = pull['head']['sha']
            if pull.get('state') != 'open':
                return 1, f'#{pr} 이 열려 있지 않다({pull.get("state")})'
            if sha != seen:   # 새 커밋이 올라오면 위험도도 다시
                seen, high = sha, assess(pr)['high']
            if not high or owner_approved(pr, sha):
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
    elif a[:1] == ['--wait'] and len(a) == 2:
        code, msg = wait(a[1])
        print(msg)
        sys.exit(code)
    else:
        print(json.dumps(assess(a[0]), ensure_ascii=False, indent=1))
