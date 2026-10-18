#!/usr/bin/env python3
"""PR 위험도 판정 — 세션의 판단이 아니라 diff 로 기계적으로 정한다. /ship 과 가드(ship-gate.py)가 같이 쓴다.

높음 = 데이터 경로 · 권한 · 서버 · 빌드에 닿는 변경. 높으면 머지 전에 승인자(OWNER)의 승인이 있어야 한다 —
GitHub Approve, 또는 PR 코멘트 한 줄 «승인 <머리 커밋 앞 7자리 이상>»(GitHub 은 작성자가 자기 PR 을 Approve 못 하는데
이 PC 세션들은 OWNER 계정으로 PR 을 올린다). 커밋 번호를 받는 까닭: 시각으로 가리면 승인 뒤 옛 날짜 커밋을 올려도 통과한다.
낮음 = 문구 · 화면 배치 · 스타일 · 데이터 경로가 그대로인 수정 · 문서 — 컨펌자 · 검증자 통과로 머지.

  python3 .claude/hooks/risk.py <PR 번호>     → {"high": bool, "reasons": [...]} (gh api REST 만 씀 — 웹 세션에서도 된다)
"""
import json, re, subprocess, sys

REPO = 'grk-cmd/t-w'
OWNER = 'mihioon'
# 한 줄 전체가 «승인 <sha 앞자리>» 일 때만 — 승인 요청 코멘트(«승인 요청 — …»)와 섞이지 않게
APPROVE_LINE = re.compile(r'^\s*승인\s+([0-9a-f]{7,40})\s*$', re.M)

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
    p = subprocess.run(['gh', 'api', '--paginate', path], capture_output=True, text=True)
    if p.returncode:
        raise RuntimeError(f'gh api {path}: {p.stderr.strip()[:200]}')
    # --paginate 는 배열을 이어 붙여 내보낸다
    return json.loads('[' + p.stdout.replace('][', '],[') + ']') if p.stdout.lstrip().startswith('[') else json.loads(p.stdout)


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


def owner_approved(pr, head_sha):
    """승인자가 지금 머리 커밋을 승인했는가 — 마지막 리뷰가 그 커밋의 APPROVED 이거나, «승인 <그 커밋>» 코멘트가 있다."""
    if not head_sha:
        return False
    reviews = [r for r in _rows(api(f'repos/{REPO}/pulls/{pr}/reviews?per_page=100'))
               if (r.get('user') or {}).get('login') == OWNER and r.get('state') in ('APPROVED', 'CHANGES_REQUESTED', 'DISMISSED')]
    if reviews and reviews[-1].get('commit_id') == head_sha:
        return reviews[-1]['state'] == 'APPROVED'   # 그 커밋에 Request changes 를 했으면 코멘트로 덮지 않는다
    comments = _rows(api(f'repos/{REPO}/issues/{pr}/comments?per_page=100'))
    return any((c.get('user') or {}).get('login') == OWNER and comment_approves(c.get('body'), head_sha) for c in comments)


if __name__ == '__main__':
    print(json.dumps(assess(sys.argv[1]), ensure_ascii=False, indent=1))
