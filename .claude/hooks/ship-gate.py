#!/usr/bin/env python3
"""하네스 가드(PreToolUse · Bash) — 터미널 · 클라우드(웹) 세션 모두에서 돈다. 막는 것:

1. 머지 — `gh pr merge` · `gh api …/pulls/N/merge`: 그 PR 머리 커밋에 상태값 `tw/confirm`(컨펌자) · `tw/verify`(검증자)가
   둘 다 success 가 아니면 막는다. 두 상태값은 `/ship` 이 두 에이전트 판정이 «통과» 일 때만 올린다.
   가드 자리(risk.is_guard — 훅 폴더 · 훅 설정 · 훅이 돌리는 스크립트 · 컨펌자 · 검증자 지침 · /ship 안내서)를 바꾸는 PR 은 승인자(mihioon)가 그 머리 커밋을 승인해야 한다
   (세션이 가드를 스스로 풀지 못하게). 나머지는 위험도가 높아도 승인 없이 — 승인자는 내보내기 전 risk.py --release 한 장으로 본다.
   판정 · 승인 뒤 판 브랜치를 합치기만 한 머리(PR 자체 변경이 같음 — risk.same_change)는 앞 커밋의 것을 이어 받는다.
2. 보호 브랜치에 직접 push — `main` · `release/*`. 예외: main 에 `docs/WORK_STATUS.md` 만 바꾼 push.
2-1. 승인을 세션이 대신 남기기 — Approve 리뷰 · «승인 <커밋>» 코멘트. 세션도 승인자 계정으로 GitHub 를 쓰니
   이걸 막지 않으면 승인이 사람 확인이 아니게 된다(사람은 GitHub 화면에서 단다).
3. 판 브랜치 밖에서 새 브랜치 따기 — 작업 전에 «어느 버전에 릴리스될 작업인가» 를 묻고 `release/X.Y.Z` 에서.
   예외: `hotfix/*` · `harness/*`(하네스 · 작업 규칙)는 main 에서.
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
PROTECTED = re.compile(r'^(main|release/.+)$')
FROM_MAIN = ('hotfix/', 'harness/')
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


def gate_missing(sha):
    raw = run('gh', 'api', f'repos/{REPO}/commits/{sha}/status', '--jq',
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


def check_merge(toks):
    joined = ' '.join(toks)
    pr = None
    if toks[1:3] == ['pr', 'merge']:
        pr = next((t for t in toks[3:] if t.isdigit()), None)
        if not pr:
            pr = run('gh', 'pr', 'view', '--json', 'number', '--jq', '.number')
    else:
        m = re.search(r'/pulls/(\d+)/merge', joined)
        pr = m and m.group(1)
    if not pr:
        deny('머지할 PR 번호를 알 수 없다 — `/ship` 으로 머지한다.')
    sys.path.append(os.path.dirname(os.path.abspath(__file__)))   # 뒤에 — 표준 모듈이 먼저(이 폴더에 같은 이름 파일을 둬도 가려지지 않게)
    try:   # 이어 받기를 읽다 API 가 실패하면 판정 없음으로 — 맨 아래 «가드 오류면 통과» 로 새지 않게
        ok, missing = gate_ok(pr)
    except Exception as e:
        deny(f'#{pr} 컨펌 · 검증 기록을 읽지 못해 머지를 막았다({str(e)[:120]}) — 잠시 뒤 다시.')
    if ok:
        import risk
        try:   # 바뀐 파일 · 승인을 못 읽으면 막는다 — 맨 아래 «가드 오류면 통과» 로 새면 승인 없이 머지된다
            sha = run('gh', 'api', f'repos/{REPO}/pulls/{pr}', '--jq', '.head.sha')
            approved = not risk.needs_owner(pr) or risk.owner_approved(pr, sha)   # 승인은 가드 자리를 바꾸는 PR 만
        except Exception as e:
            deny(f'#{pr} 바뀐 파일 · 승인을 읽지 못해 머지를 막았다({str(e)[:120]}) — 잠시 뒤 다시.')
        if not approved:
            deny(f'#{pr} 은 가드 자리({risk.GUARD_LABEL})를 바꾼다 — 승인자({risk.OWNER})가 지금 머리 커밋을 GitHub 에서 Approve 하거나 «승인 {(sha or "")[:7]}» 코멘트를 달아야 머지한다. '
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
        if t.startswith('--repo='):
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
        if dst == 'main':
            changed = (run('git', 'diff', '--name-only', 'origin/main...HEAD', cwd=cwd) or '').split()
            if changed and set(changed) <= {'docs/WORK_STATUS.md'}:
                continue
        deny(f'{dst} 에 직접 push 하지 않는다. 작업 브랜치에 push 하고 `/ship` 으로 PR · 컨펌 · 검증 · 머지까지.')


def check_new_branch(cwd, name, start):
    base = (start or run('git', 'branch', '--show-current', cwd=cwd) or 'HEAD')
    base = re.sub(r'^(refs/remotes/|refs/heads/)?(origin/)?', '', base)
    if base.startswith('release/') or (name.startswith(FROM_MAIN) and base == 'main'):
        return
    deny(f'새 브랜치 «{name}» 의 시작점이 판 브랜치가 아니다({base}). 먼저 사용자에게 «이 작업은 어느 버전에 릴리스될 작업인가요?» 를 묻고 '
         f'답한 판의 `origin/release/X.Y.Z` 에서 딴다. 그 판 브랜치가 없으면 만들지 말고 사용자에게 알린다. 긴급 수정만 `hotfix/*` 를 main 에서.')


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
            check_merge(g)
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
