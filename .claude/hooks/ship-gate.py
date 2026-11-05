#!/usr/bin/env python3
"""하네스 가드(PreToolUse · Bash) — 터미널 · 클라우드(웹) 세션 모두에서 돈다. 막는 것:

1. 머지 — `gh pr merge` · `gh api …/pulls/N/merge`: 그 PR 머리 커밋에 상태값 `tw/confirm`(컨펌자) · `tw/verify`(검증자)가
   둘 다 success 가 아니면 막는다. 저장소는 **분명할 때만** 판정하고 그 밖은 막는다:
   · `gh api` — 위치 인자가 `repos/<주인>/<이름>/pulls/N/merge` 하나(점 마디 · 인코딩 · 자리표시자 없음)이고 그 이름이 앱 저장소(REPO) ·
     서버(GATED_REPOS — 그 저장소 머리 커밋의 두 상태값) · 문서(UNGATED_REPOS — 막지 않음) 중 하나일 때.
   · `gh pr merge` — 앱 저장소 폴더(origin)에서 번호(위치 인자)로만. `-R` · `--repo` · `GH_REPO` · URL 이 있거나 폴더가 앱 저장소가 아니면 막는다
     (다른 저장소 PR 을 앱 저장소의 같은 번호로 판정하지 않게 — 서버 · 문서 머지는 `gh api` 경로 모양으로).
   못 보는 것(실수 막기 범위 밖): `env -i gh …` · `bash -c "gh …"` · GraphQL mergePullRequest. 두 상태값은 `/ship` 이 두 에이전트 판정이 «통과» 일 때만 올린다.
   가드 자리(risk.is_guard — 훅 폴더 · 훅 설정 · 훅이 돌리는 스크립트 · 컨펌자 · 검증자 지침 · /ship 안내서)를 바꾸는 PR 은 승인자(mihioon)가 그 머리 커밋을 승인해야 한다
   (세션이 가드를 스스로 풀지 못하게). 웹 관리자 길(main 으로 가는 admin/*)의 위험도 높은 PR 도 승인 — 판을 거치지 않아 내보내기 전 한 장에 안 나온다.
   나머지는 위험도가 높아도 승인 없이 — 승인자는 내보내기 전 risk.py --release 한 장으로 본다.
   판정 · 승인 뒤 판 브랜치를 합치기만 한 머리(PR 자체 변경이 같음 — risk.same_change)는 앞 커밋의 것을 이어 받는다.
2. 보호 브랜치에 직접 push — `main` · `release/*`. 예외 없음(현황판은 파일이 아니라 열린 PR · 이슈 — role-start.py).
2-1. 승인을 세션이 대신 남기기 — Approve 리뷰 · «승인 <커밋>» 코멘트. 세션도 승인자 계정으로 GitHub 를 쓰니
   이걸 막지 않으면 승인이 사람 확인이 아니게 된다(사람은 GitHub 화면에서 단다).
3. 판 브랜치 밖에서 새 브랜치 따기 — 작업 전에 «어느 버전에 릴리스될 작업인가» 를 묻고 `release/X.Y.Z` 에서.
   예외: `hotfix/*` · `harness/*`(하네스 · 작업 규칙) · `admin/*`(웹 관리자만 — 앱과 나눔)는 main 에서.
   main 으로 가는 PR 중 `hotfix/*` · `harness/*` · `release/*` 가 아닌 것은 web-admin/ 안만 바꿀 수 있다 — 밖을 바꾸면 머지를 막는다
   (브랜치 이름이 아니라 base 로 본다 · 앱 코드가 판을 건너뛰고 main 으로 새지 않게 · risk.admin_outside).
가드가 스스로 깨지면 막지 않고 알린다.
"""
import json, os, re, shlex, subprocess, sys

# Windows 는 표준 입출력이 지역 인코딩(cp949)이라 «·» 같은 글자를 쓰다 죽는다 — hook 입출력은 UTF-8 로 고정
for _s in (sys.stdin, sys.stdout, sys.stderr):
    try:
        _s.reconfigure(encoding='utf-8')
    except Exception:
        pass

sys.dont_write_bytecode = True   # import risk 가 .claude/hooks/__pycache__ 를 만들어 작업 트리를 더럽히지 않게

REPO = 'grk-cmd/t-w'
GATED_REPOS = ('mihioon/t-w-server',)   # 앱 밖에서 컨펌 · 검증 상태값을 받아야 머지하는 저장소(승인 · 판 규칙은 앱 저장소 몫)
UNGATED_REPOS = ('mihioon/tw-docs',)    # 가드 밖(문서). 이 두 표에 없는 이름 · 모르는 이름은 앱 저장소로 본다(막는 쪽)
PROTECTED = re.compile(r'^(main|release/.+)$')
FROM_MAIN = ('hotfix/', 'harness/', 'admin/')   # admin/* — 웹 관리자만(main 으로 가는 PR 의 범위는 머지 때 risk.admin_outside 가 본다)
GATES = ('tw/confirm', 'tw/verify')


def run(*args, cwd=None):
    p = subprocess.run(list(args), cwd=cwd, capture_output=True, text=True, encoding='utf-8', errors='replace')
    return p.stdout.strip() if p.returncode == 0 else None


def deny(reason):
    print(json.dumps({'hookSpecificOutput': {'hookEventName': 'PreToolUse', 'permissionDecision': 'deny',
                                             'permissionDecisionReason': '[하네스] ' + reason}}, ensure_ascii=False))
    sys.exit(0)


def segments(cmd):
    for part in re.split(r'&&|\|\||;|\n|\|', cmd):
        try:
            toks = shlex.split(part)
        except ValueError:
            toks = part.split()
        if toks:
            yield toks


def gate_missing(sha, repo=REPO):
    raw = run('gh', 'api', f'repos/{repo}/commits/{sha}/status', '--jq',
              '[.statuses[] | {context, state}]')
    states = {s['context']: s['state'] for s in json.loads(raw or '[]')[::-1]}  # 같은 context 는 최신이 앞
    return [g for g in GATES if states.get(g) != 'success']


def gate_ok(pr):
    sha = run('gh', 'api', f'repos/{REPO}/pulls/{pr}', '--jq', '.head.sha')
    if not sha:
        return False, 'PR 머리 커밋을 못 읽음'
    missing = gate_missing(sha)
    if missing:
        # 판 브랜치만 합친 머리 — 두 판정을 받은 가장 최근 커밋과 PR 자체 변경이 같으면 이어 받는다
        import risk
        passed = next((c for c in reversed(risk.pr_commits(pr)) if c != sha and not gate_missing(c)), None)
        if passed and risk.same_change(pr, passed, sha):
            return True, ''
    return not missing, ', '.join(missing)


def norm_repo(v):
    """저장소 값 → 소문자 '주인/이름' — URL · github.com/ 머리 · .git 꼬리를 뗀다. 모양이 아니면(자리표시자 {owner} 등) None."""
    if not v:
        return None
    v = v.strip().lower()
    v = re.sub(r'^(https?://|ssh://|git@)', '', v)
    v = re.sub(r'^(www\.)?github\.com[:/]', '', v)
    v = re.sub(r'(\.git)?/?$', '', v)
    m = re.match(r'^([a-z0-9][a-z0-9-]*)/([a-z0-9._-]+)$', v)
    return m and f'{m.group(1)}/{m.group(2)}'


API_TAKES = {'-X', '--method', '-f', '-F', '--field', '--raw-field', '-H', '--header', '--input', '-q', '--jq', '-t', '--template',
             '--hostname', '--cache', '-p', '--preview'}   # `gh api` 에서 값을 받는 옵션


def api_path(toks):
    """`gh api` 의 첫 위치 인자(경로) — 값을 받는 옵션 뒤 글은 건너뛴다(-f x=repos/… 미끼)."""
    takes = API_TAKES
    j = 2
    while j < len(toks):
        t = toks[j]
        if t in takes:
            j += 2
            continue
        if t.startswith('-'):
            j += 1
            continue
        return t
    return ''


def api_positionals(g):
    """`gh api` 의 위치 인자들 — 값을 받는 옵션 뒤 낱말은 건너뛴다."""
    takes = API_TAKES
    out, j = [], 2
    while j < len(g):
        t = g[j]
        if t in takes:
            j += 2
            continue
        if not t.startswith('-'):
            out.append(t)
        j += 1
    return out


def origin_repo(cwd):
    """그 폴더 origin 의 저장소(소문자 '주인/이름') — 못 읽으면 None"""
    return norm_repo(run('git', 'remote', 'get-url', 'origin', cwd=cwd) or '')


PR_MERGE_TAKES = {'-b', '--body', '-F', '--body-file', '-t', '--subject', '-A', '--author-email', '--match-head-commit'}


def merge_target(raw, cwd):
    """머지 명령 → (저장소, PR 번호) — 분명하지 않으면 deny. raw 는 gh_norm 이 떼기 전 낱말."""
    g = gh_norm(raw)
    if g[1:2] == ['api']:
        pos = api_positionals(g)
        m = None if len(pos) != 1 or re.search(r'\.\.|%|[{}]', pos[0]) else re.match(r'^/?repos/([^/]+/[^/]+)/pulls/(\d+)/merge/?$', pos[0])
        repo = m and norm_repo(m.group(1))
        if not repo or repo not in (REPO,) + GATED_REPOS + UNGATED_REPOS:
            deny('머지할 저장소 · PR 이 분명하지 않다 — `gh api -X PUT repos/<주인>/<이름>/pulls/N/merge` 한 경로로 쓴다(자리표시자 · 위치 인자 여럿 · 표에 없는 저장소는 막음).')
        return repo, m.group(2)
    # gh pr merge — 앱 저장소 폴더에서 번호로만
    if any(t in ('-R', '--repo') or t.startswith('--repo=') or (t.startswith('-R') and len(t) > 2) or t.startswith('GH_REPO=') or '/pull/' in t for t in raw):
        deny('`gh pr merge` 에 -R · --repo · GH_REPO · URL 을 주면 가드가 저장소를 분명히 알 수 없다 — 서버 · 문서 PR 은 `gh api -X PUT repos/<주인>/<이름>/pulls/N/merge` 로.')
    if origin_repo(cwd) != REPO:
        deny('`gh pr merge` 는 앱 저장소 폴더에서만 — 다른 저장소 PR 은 `gh api -X PUT repos/<주인>/<이름>/pulls/N/merge` 로.')
    pos, j = [], 3
    while j < len(g):
        t = g[j]
        if t in PR_MERGE_TAKES:
            j += 2
            continue
        if not t.startswith('-'):
            pos.append(t)
        j += 1
    pr = pos[0] if pos else run('gh', 'pr', 'view', '--json', 'number', '--jq', '.number', cwd=cwd)
    if not pr or not str(pr).isdigit():
        deny('머지할 PR 번호를 알 수 없다 — `/ship` 으로 머지한다.')
    return REPO, str(pr)


def check_merge(raw, cwd=None):
    repo, pr = merge_target(raw, cwd)
    if repo in UNGATED_REPOS:
        return   # 문서 저장소 — 이 가드의 몫이 아니다
    if repo in GATED_REPOS:
        sha = run('gh', 'api', f'repos/{repo}/pulls/{pr}', '--jq', '.head.sha')
        if not sha:
            deny(f'{repo}#{pr} 머리 커밋을 읽지 못해 머지를 막았다 — 잠시 뒤 다시.')
        missing = gate_missing(sha, repo)
        if missing:
            deny(f'{repo}#{pr} 머리 커밋에 컨펌 · 검증 통과 기록이 없다({", ".join(missing)}). 컨펌자(tw-confirmer) · 검증자(tw-verifier)를 돌려 '
                 f'둘 다 통과하면 그 저장소의 머리 커밋에 상태값을 남긴 뒤 머지한다.')
        return
    sys.path.append(os.path.dirname(os.path.abspath(__file__)))   # 뒤에 — 표준 모듈이 먼저(이 폴더에 같은 이름 파일을 둬도 가려지지 않게)
    try:   # 이어 받기를 읽다 API 가 실패하면 판정 없음으로 — 맨 아래 «가드 오류면 통과» 로 새지 않게
        ok, missing = gate_ok(pr)
    except Exception as e:
        deny(f'#{pr} 컨펌 · 검증 기록을 읽지 못해 머지를 막았다({str(e)[:120]}) — 잠시 뒤 다시.')
    if ok:
        import risk
        try:   # 바뀐 파일 · 승인을 못 읽으면 막는다 — 맨 아래 «가드 오류면 통과» 로 새면 승인 없이 머지된다
            sha = run('gh', 'api', f'repos/{REPO}/pulls/{pr}', '--jq', '.head.sha')
            why = risk.approval_reason(pr)   # 'guard' · 'admin'(웹 관리자 길 높음 — 내보내기 전 한 장 대신 머지 전 승인) · ''
            approved = not why or risk.owner_approved(pr, sha)
            outside = risk.admin_outside(pr)
        except Exception as e:
            deny(f'#{pr} 바뀐 파일 · 승인을 읽지 못해 머지를 막았다({str(e)[:120]}) — 잠시 뒤 다시.')
        if outside:
            deny(f'#{pr} 은 main 으로 가는 PR(hotfix/* · harness/* · 판 내기가 아니면 웹 관리자 길)인데 web-admin/ 밖을 바꾼다({", ".join(outside[:5])}). '
                 f'앱 · 규칙 · 검사는 판 브랜치(release/X.Y.Z)로 따로 PR 한다(main 으로 무엇이든 가는 것은 hotfix/* · harness/* · 판 내기뿐).')
        if not approved:
            what = f'가드 자리({risk.GUARD_LABEL})를 바꾼다' if why == 'guard' else '웹 관리자 길(main 에서 바로 내보냄)인데 위험도가 높다(risk.py)'
            deny(f'#{pr} 은 {what} — 승인자({risk.OWNER})가 지금 머리 커밋을 GitHub 에서 Approve 하거나 «승인 {(sha or "")[:7]}» 코멘트를 달아야 머지한다. '
                 f'`/ship` 이 PR 에 설계 요약을 남기고 승인을 기다린다(risk.py --wait).')
        return
    if not ok:
        deny(f'#{pr} 머리 커밋에 컨펌 · 검증 통과 기록이 없다({missing}). `/ship` 으로 컨펌자(tw-confirmer) · 검증자(tw-verifier)를 돌려 '
             f'둘 다 통과해야 머지할 수 있다. 커밋을 더 올렸으면 다시 돌린다(판 브랜치만 합친 커밋은 앞 판정을 이어 받는다).')


LOOSE_APPROVE = re.compile(r'승인[\s\u3000]+[0-9a-f]{7,40}\b')   # 명령 글 · 파일 어디든 — 표준입력 · $(…) 로 들어오는 본문까지
WRITE_FLAGS = ('-f', '-F', '--field', '--raw-field', '--input')


def gh_norm(toks):
    """gh 명령이면 [`gh`, 하위 명령…] 으로 — 앞의 `VAR=값` · env · command, gh 경로, -R/--repo 를 뗀다. 아니면 None."""
    i = 0
    while i < len(toks) and (re.match(r'^[A-Za-z_][A-Za-z0-9_]*=', toks[i]) or toks[i] in ('env', 'command')):
        i += 1
    if i >= len(toks) or os.path.basename(toks[i]) != 'gh':
        return None
    out, rest = ['gh'], toks[i + 1:]
    j = 0
    while j < len(rest):
        t = rest[j]
        if t in ('-R', '--repo'):
            j += 2
            continue
        if t.startswith('--repo=') or (t.startswith('-R') and len(t) > 2):
            j += 1
            continue
        out.append(t)
        j += 1
    return out


def _files_in(text, cwd):
    """글에 나온 파일(@파일 · -F/--body-file/--input 파일 · $(cat 파일) · < 파일)을 읽는다 — 본문이 파일로 들어오는 길."""
    out = []
    for raw in re.findall(r'[^\s\'"`()<>|;&=]+', text):
        path = os.path.join(cwd, os.path.expanduser(raw.lstrip('@')))
        if raw in ('-', '@-') or not os.path.isfile(path) or os.path.getsize(path) > 1_000_000:
            continue
        try:
            body = open(path, encoding='utf-8', errors='replace').read()
        except OSError:
            continue
        out.append(body)
        try:   # --input 파일.json 은 한글을 \\uXXXX 로 적는다
            out.append(json.dumps(json.loads(body), ensure_ascii=False))
        except ValueError:
            pass
    return out


def _no_backticks(text):
    return re.sub(r'`[^`\n]*`', '', text)   # 승인 요청 본문은 붙여 넣을 한 줄을 백틱으로 감싼다


def _review_approves(args):
    """gh pr review 의 인자에 승인이 있는가 — --approve · 묶은 짧은 플래그(-ab ok). 값을 받는 플래그 뒤 글자 · 값은 뺀다."""
    j = 0
    while j < len(args):
        t = args[j]
        if t in ('-b', '--body', '-F', '--body-file'):
            j += 2
            continue
        if t == '--approve' or t.startswith('--approve='):
            return True
        if t.startswith('-') and not t.startswith('--'):
            for ch in t[1:]:
                if ch == 'a':
                    return True
                if ch in 'bF':   # 그 뒤는 값
                    break
        j += 1
    return False


APPROVE_WRAP = ('env', 'command', 'exec', 'time', 'nohup', 'sudo', 'nice', '!', 'xargs', 'npx')
NODE_VALUE_FLAGS = ('-r', '--require', '--import', '--loader', '--experimental-loader', '-e', '--eval', '-p', '--print')


def _is_approve(t):
    t = t.replace('\\', '/')
    return os.path.basename(t) == 'approve.js' or t == 'approve' or t.endswith('scripts/approve')


def _runs_approve(toks):
    """승인 명령(scripts/approve.js)을 실행하는가 — `node …/approve(.js)` · `./scripts/approve.js` · 앞에 time · nohup · ( 등.
    읽기(cat · grep · git)와 문법 검사(node --check)는 막지 않는다. bash -c · node -e 안쪽은 못 본다(실수 막기)."""
    toks = [t.lstrip('(') for t in toks]
    i = 0
    while i < len(toks) and (not toks[i] or re.match(r'^[A-Za-z_][A-Za-z0-9_]*=', toks[i]) or toks[i] in APPROVE_WRAP
                             or (toks[i].startswith('-') and i and toks[i - 1] in APPROVE_WRAP)):
        i += 1
    if i < len(toks) and os.path.basename(toks[i]) in ('node', 'nodejs', 'bun', 'deno'):
        i += 1
        while i < len(toks) and toks[i].startswith('-'):
            if toks[i] in ('--check', '-c'):
                return False
            i += 2 if toks[i] in NODE_VALUE_FLAGS else 1
    return i < len(toks) and _is_approve(toks[i])


STDIN_BODY = re.compile(r'(--body-file|--input)[ =]-(\s|$)|=@-(\s|$)')


def check_self_approve(cmd, cwd):
    """세션이 승인(Approve 리뷰 · «승인 <커밋>» 코멘트)을 남기는 명령을 막는다. 읽기는 막지 않는다.
    실수 막기다 — 본문을 실행할 때 조립하거나(printf 형식 · 변수) bash -c · gh 밖(curl · 스크립트)으로 부르면 못 본다.
    세션도 승인자 계정이라 GitHub 에서도 사람과 가를 수 없다."""
    for pipeline in re.split(r'&&|\|\||;|\n', cmd):
        for part in pipeline.split('|'):
            try:
                toks = shlex.split(part)
            except ValueError:
                toks = part.split()
            if toks and toks[0] == 'cd' and len(toks) > 1:
                cwd = os.path.join(cwd, os.path.expanduser(toks[1]))
                continue
            if toks and _runs_approve(toks):
                deny('승인 명령(scripts/approve.js)은 승인자가 터미널에서 직접(`! node scripts/approve.js <번호>`) 돌린다 — 세션이 돌리지 않는다.')
            g = gh_norm(toks) if toks else None
            if not g:
                continue
            # 이 조각 · 그 파이프라인(echo … |) · 표준입력 본문이면 명령 전체(heredoc) · 나온 파일
            texts = [part, pipeline] + ([cmd] if STDIN_BODY.search(part) else []) + _files_in(part, cwd)
            if g[1:3] == ['pr', 'review'] and _review_approves(g[3:]):
                deny('승인(Approve)은 승인자가 GitHub 화면에서 직접 한다 — 세션이 남기지 않는다.')
            comment = g[1:3] in (['pr', 'comment'], ['issue', 'comment'])
            if g[1:2] == ['api']:
                joined = ' '.join(g)
                reads = re.search(r'(-X|--method)[ =]?GET\b', joined)
                writes = not reads and (any(t in WRITE_FLAGS or t.startswith(('--field=', '--raw-field=', '--input=')) for t in g)
                                        or re.search(r'(-X|--method)[ =]?(POST|PUT|PATCH)', joined))
                if not writes:
                    continue
                every = ' '.join(texts)
                if (re.search(r'/reviews\b', joined) or re.search(r'(add|submit)PullRequestReview', every)) and re.search(r'APPROVE', every, re.I):
                    deny('승인(Approve)은 승인자가 GitHub 화면에서 직접 한다 — 세션이 남기지 않는다.')
                comment = bool(re.search(r'/comments\b', joined) or re.search(r'\b(addComment|updateIssueComment)\b', every))
            if comment and any(LOOSE_APPROVE.search(_no_backticks(t)) for t in texts):
                deny('«승인 <커밋>» 코멘트는 승인자가 GitHub 화면에서 직접 단다 — 세션이 남기지 않는다(승인 요청 본문에는 이 한 줄을 `코드` 로 감싸 적는다).')


def check_push(cwd, sub):
    args = [a for a in sub[1:] if not a.startswith('-')]
    cur = run('git', 'branch', '--show-current', cwd=cwd) or ''
    for rs in args[1:] or [cur]:
        dst = (rs.split(':')[-1] if ':' in rs else rs).replace('refs/heads/', '')
        dst = cur if dst in ('', 'HEAD') else dst
        if not PROTECTED.match(dst):
            continue
        deny(f'{dst} 에 직접 push 하지 않는다. 작업 브랜치에 push 하고 `/ship` 으로 PR · 컨펌 · 검증 · 머지까지.')


def check_new_branch(cwd, name, start):
    base = (start or run('git', 'branch', '--show-current', cwd=cwd) or 'HEAD')
    base = re.sub(r'^(refs/remotes/|refs/heads/)?(origin/)?', '', base)
    if base.startswith('release/') or (name.startswith(FROM_MAIN) and base == 'main'):
        return
    deny(f'새 브랜치 «{name}» 의 시작점이 판 브랜치가 아니다({base}). 먼저 사용자에게 «이 작업은 어느 버전에 릴리스될 작업인가요?» 를 묻고 '
         f'답한 판의 `origin/release/X.Y.Z` 에서 딴다. 그 판 브랜치가 없으면 만들지 말고 사용자에게 알린다. 긴급 수정 `hotfix/*` · 하네스 `harness/*` · 웹 관리자만 바꾸는 `admin/*` 는 main 에서.')


def main():
    data = json.load(sys.stdin)
    cmd = data.get('tool_input', {}).get('command', '')
    cwd = data.get('cwd') or os.getcwd()
    check_self_approve(cmd, cwd)
    for toks in segments(cmd):
        if toks[0] == 'cd' and len(toks) > 1:
            cwd = os.path.join(cwd, os.path.expanduser(toks[1]))
            continue
        g = gh_norm(toks)
        if g and (g[1:3] == ['pr', 'merge'] or (g[1:2] == ['api'] and re.search(r'/pulls/\d+/merge', ' '.join(g)))):
            check_merge(toks, cwd)
            continue
        if toks[0] != 'git':
            continue
        i, where = 1, cwd
        while i < len(toks) and toks[i].startswith('-'):
            if toks[i] in ('-C', '-c') and i + 1 < len(toks):
                if toks[i] == '-C':
                    where = os.path.join(cwd, os.path.expanduser(toks[i + 1]))
                i += 2
            else:
                i += 1
        sub = toks[i:]
        if not sub or REPO not in (run('git', 'remote', 'get-url', 'origin', cwd=where) or ''):
            continue
        if sub[0] == 'push':
            check_push(where, sub)
        elif sub[0] in ('checkout', 'switch'):
            flags = ('-b', '-B') if sub[0] == 'checkout' else ('-c', '-C')
            for j, t in enumerate(sub):
                if t in flags and j + 1 < len(sub):
                    rest = [x for x in sub[j + 2:] if not x.startswith('-')]
                    check_new_branch(where, sub[j + 1], rest[0] if rest else None)
        elif sub[:2] == ['worktree', 'add']:
            for j, t in enumerate(sub):
                if t in ('-b', '-B') and j + 1 < len(sub):
                    pos = [x for x in sub[2:] if not x.startswith('-') and x != sub[j + 1]]
                    check_new_branch(where, sub[j + 1], pos[1] if len(pos) > 1 else None)
        elif sub[0] == 'branch':
            pos = [x for x in sub[1:] if not x.startswith('-')]
            readonly = {'-d', '-D', '--delete', '-m', '-M', '--list', '-l', '-a', '-r', '-v', '-vv',
                        '--unset-upstream', '-u', '--set-upstream-to', '--show-current', '--contains', '--merged'}
            if pos and not readonly.intersection(sub):
                check_new_branch(where, pos[0], pos[1] if len(pos) > 1 else None)


if __name__ == '__main__':
    try:
        main()
    except SystemExit:
        raise
    except Exception as e:
        print(json.dumps({'systemMessage': f'[하네스] 가드 오류 — 이번 명령은 막지 않았다: {e}'}, ensure_ascii=False))
