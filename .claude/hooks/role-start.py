#!/usr/bin/env python3
"""세션 시작 hook(SessionStart) — 두 가지를 세션 지침(additionalContext)으로 덧붙인다. 터미널 · 클라우드(웹) 세션 모두에서 돈다.

1. 역할 지침 — `claude -n <이름>` 으로 연 세션이면(입력의 session_title) `.claude/roles/_공통.md` + `<이름>.md`.
   요약(compact) · 이어 열기(resume) 때도 다시 붙인다 — 요약되면 처음 지침이 사라지기 때문이다. 모르는 이름이면 붙이지 않는다.
2. 판 고르기 — 새로 연 세션(startup · clear)이 작업 브랜치 위가 아니면(main · release/* · 떨어진 HEAD) 열린 판 전부의 한 장 요약을 주고
   «어느 버전에 나갈 작업인가요?» 를 묻게 한다. 판은 사람이 고른다. 질문 세션은 묻지 않는다.

git 과 `gh api`(REST)만 쓴다 — 웹 세션은 `gh pr` 이 막혀 있고 이 PC 전용 도구(Orca · 브랜치 장부)는 거기 없다.
무엇이 실패해도 세션은 열린다(요약 자리에 «못 불러옴» 만).
"""
import json, os, re, subprocess, sys, time, unicodedata

REPO = 'grk-cmd/t-w'
HERE = os.path.dirname(os.path.abspath(__file__))
ROLES_DIR = os.path.join(os.path.dirname(HERE), 'roles')
COMMON = '_공통.md'
NO_PICK_ROLES = ('질문',)
PICK_SOURCES = ('startup', 'clear')
STATUS_FILE = 'docs/WORK_STATUS.md'
STATUS_HEAD = '## 진행 중'
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


def rel_name(s):
    """«0.12.0» · «release/0.12.0» · «작업완료(0.12.0)» 안의 판 → «0.12.0». 판이 없으면 그대로(main 등)."""
    m = re.search(r'\d+\.\d+\.\d+', s or '')
    return m.group(0) if m else (s or '').strip()


def parse_status(md):
    """현황판 «진행 중» 머리 아래 첫 표 → [{칸 이름: 값}]. 칸 수가 머리와 다른 줄은 버린다."""
    lines = (md or '').splitlines()
    try:
        i = next(k for k, l in enumerate(lines) if l.strip().startswith(STATUS_HEAD))
    except StopIteration:
        return []
    rows, head = [], None
    for l in lines[i + 1:]:
        s = l.strip()
        if not s.startswith('|'):
            if head is not None or s.startswith('#'):
                break
            continue
        cells = [c.strip() for c in s.strip('|').split('|')]
        if head is None:
            head = cells
        elif set(''.join(cells)) <= set('-: '):
            continue
        elif len(cells) == len(head):
            rows.append(dict(zip(head, cells)))
    return rows


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


def render(facts):
    """모은 사실 → 한 장 요약(마크다운). facts 모양은 gather() 참고."""
    out = ['## 열린 판 한 장 요약']
    for note in facts.get('notes', []):
        out.append(f'- ⚠️ {note}')
    rels = facts.get('releases', {})
    prs = facts.get('prs')
    rows = facts.get('status')
    if not rels:
        out.append('- 열린 판 브랜치(`release/*`)가 없다 — 판 브랜치는 사용자가 연다.')
    for name in sorted(rels):
        r = rels[name]
        out.append(f'\n### release/{name} — main 에 없는 커밋 {r["ahead"]}개')
        out.extend(f'- 들어간 것: {cut(s)}' for s in r['subjects'][:RECENT])
        if prs is not None:
            mine = [p for p in prs if p['base'] == f'release/{name}']
            out.extend(f'- 열린 PR #{p["number"]} {cut(p["title"])} ({p["head"]})' for p in mine)
            if not mine:
                out.append('- 열린 PR 없음')
        if rows is not None:
            mine = [w for w in rows if rel_name(w.get('판', '')) == name or rel_name(w.get('상태', '')) == name]
            out.extend(f'- 현황판: {w.get("상태", "")} · {w.get("담당", "")} · {w.get("브랜치", "")} · {cut(w.get("내용", ""), 40)}' for w in mine)
    others_pr = [p for p in (prs or []) if not p['base'].startswith('release/')]
    others_row = [w for w in (rows or []) if rel_name(w.get('판', '')) not in rels and rel_name(w.get('상태', '')) not in rels]
    if others_pr or others_row:
        out.append('\n### 판 밖(main · hotfix · harness)')
        out.extend(f'- 열린 PR #{p["number"]} → {p["base"]} {cut(p["title"])} ({p["head"]})' for p in others_pr)
        out.extend(f'- 현황판: {w.get("상태", "")} · {w.get("담당", "")} · {w.get("브랜치", "")} · {cut(w.get("내용", ""), 40)}' for w in others_row)
    ov = facts.get('overlaps', [])
    if len(rels) > 1:
        out.append('\n### 판끼리 겹치는 파일')
        out.extend(f'- release/{a} ↔ release/{b}: {", ".join(f[:10])}{" 외" if len(f) > 10 else ""}' for a, b, f in ov)
        if not ov:
            out.append('- 없음')
    return '\n'.join(out)


PICK_ASK = ('이 세션은 아직 작업 브랜치 위가 아니다. 사용자의 첫 메시지에 답할 때 맨 앞에 위 «열린 판 한 장 요약» 을 보여 주고 '
            '«이 작업은 어느 버전에 나갈 작업인가요?» 를 묻는다(사용자가 판을 이미 말했으면 묻지 않는다). '
            '판은 사람이 고른다 — 세션이 판을 정하거나 판끼리 합치지 않는다(합치기는 시킬 때만). 같은 일이 현황판에 «검토중» 이면 '
            '«제가 할까요, ○○이 할까요?» 를 묻는다.')


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
            parts.append(f'## 열린 판 한 장 요약\n- ⚠️ 요약을 못 불러옴({cut(str(e), 120)}) — `git fetch origin` 뒤 `git branch -r` · 현황판으로 직접 본다.')
        parts.append(PICK_ASK)
    return '\n\n'.join(parts) if parts else None


# ── git · gh 로 사실 모으기 ────────────────────────────────

def sh(args, cwd, timeout=GIT_TIMEOUT):
    p = subprocess.run(args, cwd=cwd, capture_output=True, text=True, timeout=timeout)
    if p.returncode != 0:
        raise RuntimeError(f'{" ".join(args[:3])} 실패: {cut(p.stderr, 80)}')
    return p.stdout


def gather(cwd, budget=BUDGET):
    end = time.monotonic() + budget

    def run(args, timeout=GIT_TIMEOUT):
        left = end - time.monotonic()
        if left < 1:
            raise TimeoutError(f'시간 예산 {budget}초를 넘음')
        return sh(args, cwd, min(timeout, left))

    facts = {'notes': [], 'releases': {}, 'prs': None, 'status': None, 'overlaps': []}
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
            changed = run(['git', 'diff', '--name-only', f'origin/main...{ref}']).split()
        except Exception as e:
            facts['notes'].append(f'release/{name} 부터 판을 못 읽음({cut(str(e), 60)})')
            break
        facts['releases'][name] = {'ahead': ahead, 'subjects': subjects}
        files[name] = changed
    facts['overlaps'] = overlaps(files)
    try:
        raw = run(['gh', 'api', f'repos/{REPO}/pulls?state=open&per_page=100', '--jq',
                   '[.[] | {number, title, head: .head.ref, base: .base.ref}]'])
        facts['prs'] = json.loads(raw or '[]')
    except Exception as e:
        facts['notes'].append(f'열린 PR 을 못 읽음 — gh api 실패({cut(str(e), 60)})')
    try:
        facts['status'] = parse_status(run(['git', 'show', f'origin/main:{STATUS_FILE}']))
    except Exception as e:
        facts['notes'].append(f'현황판을 못 읽음({cut(str(e), 60)})')
    return facts


def load_roles():
    out = {}
    for f in os.listdir(ROLES_DIR) if os.path.isdir(ROLES_DIR) else []:
        if f.endswith('.md'):
            out[unicodedata.normalize('NFC', f[:-3])] = open(os.path.join(ROLES_DIR, f), encoding='utf-8').read()
    return out


def main():
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
