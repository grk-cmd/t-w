#!/usr/bin/env python3
"""세션 시작 hook(SessionStart) — 두 가지를 세션 지침(additionalContext)으로 덧붙인다. 터미널 · 클라우드(웹) 세션 모두에서 돈다.

1. 역할 지침 — `claude -n <이름>` 으로 연 세션이면(입력의 session_title) `.claude/roles/_공통.md` + `<이름>.md`.
   요약(compact) · 이어 열기(resume) 때도 다시 붙인다 — 요약되면 처음 지침이 사라지기 때문이다. 모르는 이름이면 붙이지 않는다.
2. 판 고르기 — 새로 연 세션(startup · clear)이 작업 브랜치 위가 아니면(main · release/* · 떨어진 HEAD) 열린 판 전부의 한 장 요약을 주고
   «어느 버전에 나갈 작업인가요?» 를 묻게 한다. 판은 사람이 고른다. 질문 세션은 묻지 않는다.
   이 요약이 현황판이다 — 작업중 = 열린 PR(본문 «건드리는 파일» + 실제 diff) · 검토중 = 라벨 붙은 이슈 · 작업완료 = 머지.
   main 에 현황판 커밋을 쌓지 않으려고 파일 대신 GitHub 를 읽는다. 아무 때나 보기: `python3 .claude/hooks/role-start.py --board`.

git 과 `gh api`(REST)만 쓴다 — 웹 세션은 `gh pr` 이 막혀 있고 이 PC 전용 도구(Orca · 브랜치 장부)는 거기 없다.
무엇이 실패해도 세션은 열린다(요약 자리에 «못 불러옴» 만).
"""
import json, os, re, subprocess, sys, time, unicodedata

# Windows 는 표준 입출력이 지역 인코딩(cp949)이라 «·» 같은 글자를 쓰다 죽는다 — hook 입출력은 UTF-8 로 고정
for _s in (sys.stdin, sys.stdout, sys.stderr):
    try:
        _s.reconfigure(encoding='utf-8')
    except Exception:
        pass

REPO = 'grk-cmd/t-w'
HERE = os.path.dirname(os.path.abspath(__file__))
ROLES_DIR = os.path.join(os.path.dirname(HERE), 'roles')
COMMON = '_공통.md'
NO_PICK_ROLES = ('질문',)
PICK_SOURCES = ('startup', 'clear')
REVIEW_LABEL = 'status:검토중'   # 검토중 이슈 라벨
FILES_HEAD = '## 건드리는 파일'   # PR 본문(.github/pull_request_template.md)에서 겹침을 볼 칸
OWNER_LINE = re.compile(r'^담당:[ \t]*(.*)$', re.M)
NO_FILES = ('없음', '해당 없음')   # «건드리는 파일» 칸에 파일 대신 쓰는 말
OVERLAP_SHOW = 10   # 겹침 한 줄에 보일 파일 수
RECENT = 8          # 판마다 보여 줄 «들어간 것» 수
CUT = 60            # 제목 · 내용 자르는 길이
# main 을 판에 합친 커밋 — 판에 «들어간 일» 이 아니다
FROM_MAIN_MERGE = re.compile(r"^Merge (pull request #\d+ from [\w.-]+/main|branch 'main'|remote-tracking branch 'origin/main')")
GIT_TIMEOUT = 10
FETCH_TIMEOUT = 15
# settings.json 의 hook 상한(40초)보다 짧게 — 상한에 끊기면 «못 불러옴» 줄도 없이 판 질문이 통째로 빠진다
BUDGET = 30


# ── 순수 계산 ──────────────────────────────────────────────

def role_text(title, roles):
    """title 이 역할 이름이면 공통 + 역할 지침, 아니면 None. roles = {이름: 글}(공통 포함)."""
    # 한글 이름은 맥(NFD) · 리눅스(NFC) 파일 이름 · 세션 이름이 다르게 조합될 수 있다
    title = unicodedata.normalize('NFC', (title or '').strip())
    if not title or title == COMMON[:-3] or title not in roles:
        return None
    return '\n\n'.join(t for t in (roles.get(COMMON[:-3], '').rstrip(), roles[title].rstrip()) if t)


def needs_pick(role, branch, source):
    """판을 물을지 — 새로 연 세션 · 질문 세션 아님 · 작업 브랜치 위가 아님(main · release/* · 떨어진 HEAD)."""
    if source not in PICK_SOURCES or role in NO_PICK_ROLES:
        return False
    return branch in ('', 'main') or branch.startswith('release/')


def declared_files(body):
    """PR 본문 «건드리는 파일» 칸 → [경로]. `백틱` 안을 경로로 읽고, 없으면 목록 줄 글 그대로. 주석(<!-- -->)은 뺀다."""
    text = re.sub(r'<!--.*?-->', '', body or '', flags=re.S)
    lines = text.splitlines()
    try:
        i = next(k for k, l in enumerate(lines) if l.strip().startswith(FILES_HEAD))
    except StopIteration:
        return []
    out = []
    for l in lines[i + 1:]:
        s = l.strip()
        if s.startswith('#'):
            break
        ticks = re.findall(r'`([^`]+)`', s)
        if ticks:
            out.extend(t.strip() for t in ticks)
        elif s.startswith(('-', '*')) and s[1:].strip():
            out.append(s[1:].strip())
    # «없음» · «---» 같은 줄은 파일이 아니다 — 가짜 겹침이 되지 않게
    return list(dict.fromkeys(t for t in out if t not in NO_FILES and re.search(r'\w', t)))


def owner(body):
    """PR 본문 «담당:» 줄 → 이름(주석 · 빈 값이면 '')."""
    m = OWNER_LINE.search(re.sub(r'<!--.*?-->', '', body or '', flags=re.S))
    return m.group(1).strip() if m else ''


def pr_overlaps(prs):
    """열린 PR 끼리 같이 건드리는 파일 — [{number, files}] → [(#a, #b, [파일])]. 폴더(끝이 /)는 그 아래 파일과도 겹친다."""
    def hit(f, g):
        return f == g or (f.endswith('/') and g.startswith(f)) or (g.endswith('/') and f.startswith(g))
    out = []
    for i, a in enumerate(prs):
        for b in prs[i + 1:]:
            both = sorted({x for f in a.get('files', []) for g in b.get('files', []) if hit(f, g) for x in (f, g)})
            if both:
                out.append((a['number'], b['number'], both))
    return out


def overlaps(files_by_rel):
    """판끼리 같이 바꾼 파일 — {판: {파일}} → [(판 a, 판 b, [파일])]."""
    names = sorted(files_by_rel)
    out = []
    for a_i, a in enumerate(names):
        for b in names[a_i + 1:]:
            both = sorted(set(files_by_rel[a]) & set(files_by_rel[b]))
            if both:
                out.append((a, b, both))
    return out


def cut(s, n=CUT):
    s = (s or '').replace('\n', ' ').strip()
    return s if len(s) <= n else s[:n - 1] + '…'


def pr_line(p, with_base=False):
    tag = '[초안] ' if p.get('draft') else ''
    to = f' → {p["base"]}' if with_base else ''
    who = f' · 담당 {cut(p["owner"], 30)}' if p.get('owner') else ''
    n = len(p.get('files', []))
    return f'- 열린 PR #{p["number"]}{to} {tag}{cut(p["title"])} ({p["head"]}{who} · 파일 {n}개)'


def render(facts):
    """모은 사실 → 한 장 요약(마크다운). facts 모양은 gather() 참고. 못 읽음(None)과 없음([])을 다르게 그린다."""
    out = ['## 열린 판 한 장 요약(현황판)']
    for note in facts.get('notes', []):
        out.append(f'- ⚠️ {note}')
    rels = facts.get('releases', {})
    prs = facts.get('prs')
    issues = facts.get('issues')
    if not rels:
        out.append('- 열린 판 브랜치(`release/*`)가 없다 — 판 브랜치는 사용자가 연다.')
    for name in sorted(rels):
        r = rels[name]
        out.append(f'\n### release/{name} — main 에 없는 커밋 {r["ahead"]}개')
        out.extend(f'- 들어간 것: {cut(s)}' for s in r['subjects'][:RECENT])
        if prs is not None:
            mine = [p for p in prs if p['base'] == f'release/{name}']
            out.extend(pr_line(p) for p in mine)
            if not mine:
                out.append('- 열린 PR 없음')
    others_pr = [p for p in (prs or []) if not p['base'].startswith('release/')]
    if others_pr:
        out.append('\n### 판 밖(main · hotfix · harness)')
        out.extend(pr_line(p, True) for p in others_pr)
    out.append(f'\n### 검토중(이슈 · 라벨 `{REVIEW_LABEL}`)')
    if issues is None:
        out.append('- 못 읽음')
    else:
        out.extend(f'- #{i["number"]} {cut(i["title"])}' for i in issues)
        if not issues:
            out.append('- 없음')
    if prs is not None:
        out.append('\n### 열린 PR 끼리 겹치는 파일')
        po = pr_overlaps(prs)
        out.extend(f'- #{a} ↔ #{b}: {", ".join(f[:OVERLAP_SHOW])}{" 외" if len(f) > OVERLAP_SHOW else ""}' for a, b, f in po)
        if not po:
            out.append('- 없음')
    ov = facts.get('overlaps', [])
    if len(rels) > 1:
        out.append('\n### 판끼리 겹치는 파일')
        out.extend(f'- release/{a} ↔ release/{b}: {", ".join(f[:OVERLAP_SHOW])}{" 외" if len(f) > OVERLAP_SHOW else ""}' for a, b, f in ov)
        if not ov:
            out.append('- 없음')
    return '\n'.join(out)


PICK_ASK = ('이 세션은 아직 작업 브랜치 위가 아니다. 사용자의 첫 메시지에 답할 때 맨 앞에 위 «열린 판 한 장 요약» 을 보여 주고 '
            '«이 작업은 어느 버전에 나갈 작업인가요?» 를 묻는다(사용자가 판을 이미 말했으면 묻지 않는다). '
            '판은 사람이 고른다 — 세션이 판을 정하거나 판끼리 합치지 않는다(합치기는 시킬 때만). 같은 일이 «검토중» 이슈에 있으면 '
            '«제가 할까요, ○○이 할까요?» 를 묻고, 열린 PR 과 파일이 겹치면 시작 전에 그 PR 담당과 맞춘다.')


def build(title, source, branch, roles, gather_fn):
    """hook 이 덧붙일 글 — 없으면 None."""
    role = unicodedata.normalize('NFC', (title or '').strip())
    parts = []
    text = role_text(role, roles)
    if text:
        parts.append(text)
    if needs_pick(role if text else None, branch, source):
        try:
            parts.append(render(gather_fn()))
        except Exception as e:
            parts.append(f'## 열린 판 한 장 요약\n- ⚠️ 요약을 못 불러옴({cut(str(e), 120)}) — `git fetch origin` 뒤 `git branch -r` · 열린 PR · `status:검토중` 이슈로 직접 본다.')
        parts.append(PICK_ASK)
    return '\n\n'.join(parts) if parts else None


# ── git · gh 로 사실 모으기 ────────────────────────────────

def sh(args, cwd, timeout=GIT_TIMEOUT):
    p = subprocess.run(args, cwd=cwd, capture_output=True, text=True, encoding='utf-8', errors='replace', timeout=timeout)
    if p.returncode != 0:
        raise RuntimeError(f'{" ".join(args[:3])} 실패: {cut(p.stderr, 80)}')
    return p.stdout


def names(out):
    """`git diff --name-only -z` 출력 → [경로]. 한글 · 공백 경로가 따옴표 · 쪼개짐 없이 본문에 적은 이름과 맞게."""
    return [n for n in (out or '').split('\0') if n.strip()]


def gather(cwd, budget=BUDGET):
    end = time.monotonic() + budget

    def run(args, timeout=GIT_TIMEOUT):
        left = end - time.monotonic()
        if left < 1:
            raise TimeoutError(f'시간 예산 {budget}초를 넘음')
        return sh(args, cwd, min(timeout, left))

    facts = {'notes': [], 'releases': {}, 'prs': None, 'issues': None, 'overlaps': []}
    try:
        # --prune: 원격에서 지운 판 브랜치가 이 PC 사본에 남아 계속 «열린 판» 으로 보이지 않게
        run(['git', 'fetch', '-q', '--prune', 'origin'], FETCH_TIMEOUT)
    except Exception as e:
        facts['notes'].append(f'git fetch 실패 — 이 PC 에 받아 둔 origin 기준이다({cut(str(e), 60)})')
    refs = run(['git', 'for-each-ref', '--format=%(refname:short)', 'refs/remotes/origin/release/']).split()
    files = {}
    for ref in refs:
        name = ref[len('origin/release/'):]
        span = f'origin/main..{ref}'
        try:
            ahead = int(run(['git', 'rev-list', '--count', '--no-merges', span]).strip() or 0)
            subjects = [s for s in run(['git', 'log', '--first-parent', f'-{RECENT * 2}', '--format=%s', span]).splitlines()
                        if not FROM_MAIN_MERGE.search(s)][:RECENT]
            changed = names(run(['git', 'diff', '--name-only', '-z', f'origin/main...{ref}']))
        except Exception as e:
            facts['notes'].append(f'release/{name} 부터 판을 못 읽음({cut(str(e), 60)})')
            break
        facts['releases'][name] = {'ahead': ahead, 'subjects': subjects}
        files[name] = changed
    facts['overlaps'] = overlaps(files)
    try:
        raw = run(['gh', 'api', f'repos/{REPO}/pulls?state=open&per_page=100', '--jq',
                   f'[.[] | {{number, title, draft, body, head: .head.ref, base: .base.ref, same: (.head.repo.full_name == "{REPO}")}}]'])
        prs = json.loads(raw or '[]')
    except Exception as e:
        prs = None
        facts['notes'].append(f'열린 PR 을 못 읽음 — gh api 실패({cut(str(e), 60)})')
    unread = []
    for p in prs or []:
        # 실제로 바꾼 파일은 받아 둔 브랜치로 — PR 마다 API 를 부르지 않는다. 남의 포크는 적어 둔 파일만.
        changed = []
        if p.pop('same', False):
            try:
                changed = names(run(['git', 'diff', '--name-only', '-z', f'origin/{p["base"]}...origin/{p["head"]}']))
            except Exception:
                unread.append(f'#{p["number"]}')
        body = p.pop('body', None)
        p['owner'] = owner(body)
        p['files'] = list(dict.fromkeys(declared_files(body) + changed))
    facts['prs'] = prs
    if unread:
        # 못 읽은 diff 를 «겹침 없음» 으로 그리지 않게 — 적어 둔 파일만으로 본 것임을 남긴다
        facts['notes'].append(f'{" · ".join(unread)} 실제 diff 를 못 읽음 — 본문에 적은 파일만으로 겹침을 봄')
    try:
        raw = run(['gh', 'api', '-X', 'GET', f'repos/{REPO}/issues', '-f', 'state=open', '-f', f'labels={REVIEW_LABEL}', '-f', 'per_page=100',
                   '--jq', '[.[] | select(.pull_request == null) | {number, title}]'])
        facts['issues'] = json.loads(raw or '[]')
    except Exception as e:
        facts['notes'].append(f'검토중 이슈를 못 읽음 — gh api 실패({cut(str(e), 60)})')
    return facts


def load_roles():
    out = {}
    for f in os.listdir(ROLES_DIR) if os.path.isdir(ROLES_DIR) else []:
        if f.endswith('.md'):
            out[unicodedata.normalize('NFC', f[:-3])] = open(os.path.join(ROLES_DIR, f), encoding='utf-8').read()
    return out


def board():
    """`--board` — 지금 폴더 기준 한 장 요약을 터미널에 찍는다(hook 이 아닌 사람 · 세션이 아무 때나)."""
    print(render(gather(os.getcwd())))


def main():
    if sys.argv[1:] == ['--board']:
        return board()
    data = json.load(sys.stdin)
    cwd = data.get('cwd') or os.getcwd()
    try:
        branch = sh(['git', 'branch', '--show-current'], cwd).strip()
        mine = REPO in sh(['git', 'remote', 'get-url', 'origin'], cwd)
    except Exception:
        branch, mine = '', False
    roles = load_roles()
    gather_fn = (lambda: gather(cwd)) if mine else (lambda: {'notes': [f'origin 이 {REPO} 가 아니라 판을 못 읽음'], 'releases': {}})
    text = build(data.get('session_title'), data.get('source'), branch, roles, gather_fn)
    if text:
        print(json.dumps({'hookSpecificOutput': {'hookEventName': 'SessionStart', 'additionalContext': text}}, ensure_ascii=False))


if __name__ == '__main__':
    try:
        main()
    except Exception as e:
        print(json.dumps({'systemMessage': f'[하네스] 세션 시작 hook 오류 — 역할 · 판 요약을 못 붙였다: {cut(str(e), 120)}'}, ensure_ascii=False))
