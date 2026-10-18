#!/usr/bin/env python3
"""하네스 가드(PreToolUse · Bash) — 터미널 · 클라우드(웹) 세션 모두에서 돈다. 막는 것:

1. 머지 — `gh pr merge` · `gh api …/pulls/N/merge`: 그 PR 머리 커밋에 상태값 `tw/confirm`(컨펌자) · `tw/verify`(검증자)가
   둘 다 success 가 아니면 막는다. 두 상태값은 `/ship` 이 두 에이전트 판정이 «통과» 일 때만 올린다.
   위험도가 높은 PR(risk.py — 데이터 경로 · 규칙 · 서버 · 빌드)은 승인자(mihioon)가 그 머리 커밋을 Approve 해야 한다.
2. 보호 브랜치에 직접 push — `main` · `release/*`. 예외: main 에 `docs/WORK_STATUS.md` 만 바꾼 push.
2-1. 승인을 세션이 대신 남기기 — Approve 리뷰 · «승인 <커밋>» 코멘트. 세션도 승인자 계정으로 GitHub 를 쓰니
   이걸 막지 않으면 승인이 사람 확인이 아니게 된다(사람은 GitHub 화면에서 단다).
3. 판 브랜치 밖에서 새 브랜치 따기 — 작업 전에 «어느 버전에 릴리스될 작업인가» 를 묻고 `release/X.Y.Z` 에서.
   예외: `hotfix/*` · `harness/*`(하네스 · 작업 규칙)는 main 에서.
가드가 스스로 깨지면 막지 않고 알린다.
"""
import json, os, re, shlex, subprocess, sys

REPO = 'grk-cmd/t-w'
PROTECTED = re.compile(r'^(main|release/.+)$')
FROM_MAIN = ('hotfix/', 'harness/')
GATES = ('tw/confirm', 'tw/verify')


def run(*args, cwd=None):
    p = subprocess.run(list(args), cwd=cwd, capture_output=True, text=True)
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


def gate_ok(pr):
    sha = run('gh', 'api', f'repos/{REPO}/pulls/{pr}', '--jq', '.head.sha')
    if not sha:
        return False, 'PR 머리 커밋을 못 읽음'
    raw = run('gh', 'api', f'repos/{REPO}/commits/{sha}/status', '--jq',
              '[.statuses[] | {context, state}]')
    states = {s['context']: s['state'] for s in json.loads(raw or '[]')[::-1]}  # 같은 context 는 최신이 앞
    missing = [g for g in GATES if states.get(g) != 'success']
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
    ok, missing = gate_ok(pr)
    if ok:
        sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
        import risk
        r = risk.assess(pr)
        sha = run('gh', 'api', f'repos/{REPO}/pulls/{pr}', '--jq', '.head.sha')
        if r['high'] and not risk.owner_approved(pr, sha):
            deny(f'#{pr} 은 위험도 높음({"; ".join(r["reasons"][:4])}) — 승인자({risk.OWNER})가 지금 머리 커밋을 GitHub 에서 Approve 하거나 «승인 {(sha or "")[:7]}» 코멘트를 달아야 머지한다. '
                 f'`/ship` 이 PR 에 설계 요약을 남기고 «승인 대기» 로 멈춘다.')
        return
    if not ok:
        deny(f'#{pr} 머리 커밋에 컨펌 · 검증 통과 기록이 없다({missing}). `/ship` 으로 컨펌자(tw-confirmer) · 검증자(tw-verifier)를 돌려 '
             f'둘 다 통과해야 머지할 수 있다. 커밋을 더 올렸으면 다시 돌린다.')


def check_self_approve(cmd, cwd):
    if not re.search(r'\bgh\b', cmd):
        return
    if re.search(r'\bgh\s+pr\s+review\b', cmd) and re.search(r'(^|\s)(--approve|-a)(\s|$)', cmd):
        deny('승인(Approve)은 승인자가 GitHub 화면에서 직접 한다 — 세션이 남기지 않는다.')
    if re.search(r'/reviews\b', cmd) and re.search(r'APPROVE', cmd):
        deny('승인(Approve)은 승인자가 GitHub 화면에서 직접 한다 — 세션이 남기지 않는다.')
    if not re.search(r'/comments\b|\bgh\s+(pr|issue)\s+comment\b', cmd):
        return
    texts = [cmd]
    try:
        toks = shlex.split(cmd)
    except ValueError:
        toks = cmd.split()
    for j, t in enumerate(toks):   # 인자 값만 따로 — 한 줄로 쓴 본문은 명령 글에서는 «한 줄 전체» 가 아니다
        if '=' in t:
            texts.append(t.split('=', 1)[1])
        if t in ('--body', '-b') and j + 1 < len(toks):
            texts.append(toks[j + 1])
    for m in re.finditer(r'(?:body=@|--body-file[ =]|-F\s*\S*=@)(\S+)', cmd):
        path = os.path.join(cwd, os.path.expanduser(m.group(1).strip('\'"')))
        try:
            texts.append(open(path, encoding='utf-8').read())
        except OSError:
            pass
    sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
    import risk
    if any(risk.APPROVE_LINE.search(t) for t in texts):
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
        if toks[0] == 'gh' and (toks[1:3] == ['pr', 'merge'] or
                                (toks[1:2] == ['api'] and re.search(r'/pulls/\d+/merge', ' '.join(toks)))):
            check_merge(toks)
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
