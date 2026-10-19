#!/usr/bin/env python3
"""하네스 훅 시험 — 가드(ship-gate.py)가 세션의 대신 승인을 막고 읽기는 막지 않는지, 승인 판정(risk.py)이 맞는지, 시작 hook(role-start.py)이 역할 · 판 요약을 언제 붙이는지.
CI 는 돌리지 않는다(.claude/ 는 검사 실행기 대상이 아님) — 훅을 고치면 손으로: python3 .claude/hooks/test_hooks.py
"""
import json, os, subprocess, sys, tempfile

sys.dont_write_bytecode = True
HERE = os.path.dirname(os.path.abspath(__file__))
G = os.path.join(HERE, 'ship-gate.py')
A = '승인 0c4b3e9'
R = 'repos/grk-cmd/t-w'
CWD = tempfile.mkdtemp()
os.makedirs(os.path.join(CWD, 'sub'))
for name, body in (('appr.md', A + '\n'), ('appr.json', json.dumps({'body': A})), ('req.md', '승인 요청 — 붙여 넣기: `' + A + '`\n'),
                   ('rev.json', json.dumps({'event': 'APPROVE'})), ('ev.txt', 'APPROVE\n'),
                   ('q.graphql', 'mutation{addComment(input:{subjectId:"X",body:"' + A + '"}){clientMutationId}}'),
                   ('q2.graphql', 'mutation{addPullRequestReview(input:{pullRequestId:"X",event:APPROVE}){clientMutationId}}'),
                   ('sub/appr.md', A + '\n')):
    open(os.path.join(CWD, name), 'w', encoding='utf-8').write(body)

cases=[
 # (이름, 명령, 막아야 하나)
 ('pr review --approve', 'gh pr review 395 --approve', True),
 ('pr review -a', 'gh pr review 395 -a -b ok', True),
 ('pr review --approve=true', 'gh pr review 395 --approve=true', True),
 ('REST reviews APPROVE', f'gh api {R}/pulls/395/reviews -f event=APPROVE', True),
 ('REST reviews approve 소문자', f'gh api {R}/pulls/395/reviews -f event=approve', True),
 ('graphql addPullRequestReview', 'gh api graphql -f query=\'mutation{addPullRequestReview(input:{pullRequestId:"X",event:APPROVE}){clientMutationId}}\'', True),
 ('REST comment -f body=', f'gh api {R}/issues/395/comments -f body="{A}"', True),
 ('REST comment -f "body=..."', f'gh api {R}/issues/395/comments -f "body={A}"', True),
 ('REST comment --raw-field', f'gh api {R}/issues/395/comments --raw-field body="{A}"', True),
 ('gh pr comment --body', f'gh pr comment 395 --body "{A}"', True),
 ('gh pr comment --body=', f'gh pr comment 395 --body="{A}"', True),
 ('gh pr comment -b', f'gh pr comment 395 -b "{A}"', True),
 ('gh issue comment -b', f'gh issue comment 395 -b "{A}"', True),
 ('gh pr comment --body-file', 'gh pr comment 395 --body-file appr.md', True),
 ('gh pr comment -F file', 'gh pr comment 395 -F appr.md', True),
 ('REST body=@file', f'gh api {R}/issues/395/comments -F body=@appr.md', True),
 ('REST --input json', f'gh api {R}/issues/395/comments --input appr.json', True),
 ('heredoc 여러 줄', f"gh pr comment 395 --body-file - <<'EOF'\n봤어요\n{A}\nEOF", True),
 ('heredoc REST body=@-', f"gh api {R}/issues/395/comments -F body=@- <<'EOF'\n{A}\nEOF", True),
 ('echo 파이프 body=@-', f"echo '{A}' | gh api {R}/issues/395/comments -F body=@-", True),
 ('printf 파이프 --body-file -', "printf '%s\\n' '승인 0c4b3e9' | gh pr comment 395 --body-file -", True),
 # 못 막는 것(알려진 한계 — 실행할 때 조립): printf '승인 %s' 0c4b3e9 | gh pr comment … --body-file -
 ('$(cat) 본문', 'gh pr comment 395 --body "$(cat appr.md)"', True),
 ('PATCH 고치기', f'gh api -X PATCH {R}/issues/comments/123 -f body="{A}"', True),
 ('전각 공백', f'gh pr comment 395 -b "승인　0c4b3e9"', True),
 ('대문자 sha(승인 안 됨)', 'gh pr comment 395 -b "승인 0C4B3E9"', False),
 ('graphql addComment', f'gh api graphql -f query=\'mutation{{addComment(input:{{subjectId:"X",body:"{A}"}}){{clientMutationId}}}}\'', True),
 # 막으면 안 되는 것
 ('백틱 승인 요청', f'gh api {R}/issues/395/comments -f body="@mihioon 승인 요청 — 위험도 높음\n다음 한 줄: `{A}`"', False),
 ('백틱 요청 파일', 'gh pr comment 395 --body-file req.md', False),
 ('백틱 요청 heredoc(/ship 모양)', f"gh api {R}/issues/395/comments -F body=@- <<'EOF'\n@mihioon 승인 요청 — 위험도 높음\n다음 한 줄: `{A}`\nEOF", False),
 ('보통 코멘트', 'gh pr comment 395 -b "확인했습니다"', False),
 ('Request changes', 'gh pr review 395 --request-changes -b "고칠 것"', False),
 ('pr review --comment', 'gh pr review 395 --comment -b "메모"', False),
 ('리뷰 읽기', f'gh api {R}/pulls/395/reviews', False),
 ('리뷰 읽기 APPROVED 거르기', f"gh api {R}/pulls/395/reviews --jq '.[] | select(.state==\"APPROVED\")'", False),
 ('리뷰 읽기 grep', f'gh api {R}/pulls/395/reviews | grep APPROVED', False),
 ('코멘트 읽기', f'gh api {R}/issues/395/comments', False),
 ('review 뒤 ls -a', 'gh pr review 395 --comment -b x && ls -a', False),
 ('상태값 올리기', f'gh api {R}/statuses/0c4b3e9 -f state=pending -f context=tw/owner', False),
 ('gh 없는 git log', 'git log --oneline -3', False),
 # gh 앞에 붙는 것 · 묶은 플래그 · 파일 · 표준입력 · cd
 ('-R 앞 review approve', 'gh -R grk-cmd/t-w pr review 395 --approve', True),
 ('--repo 앞 comment', f'gh --repo grk-cmd/t-w pr comment 395 -b "{A}"', True),
 ('env 앞', 'GH_TOKEN=x gh pr review 395 --approve', True),
 ('command gh', 'command gh pr review 395 --approve', True),
 ('절대경로 gh', '/opt/homebrew/bin/gh pr review 395 --approve', True),
 ('-ab 묶음', 'gh pr review 395 -ab ok', True),
 ('reviews --input 파일', f'gh api {R}/pulls/395/reviews --input rev.json', True),
 ('reviews --input 표준입력', f"echo '{{\"event\":\"APPROVE\"}}' | gh api {R}/pulls/395/reviews --input -", True),
 ('reviews -F event=@파일', f'gh api {R}/pulls/395/reviews -F event=@ev.txt', True),
 ('graphql query 파일 addComment', 'gh api graphql -F query=@q.graphql', True),
 ('graphql query 파일 review', 'gh api graphql -F query=@q2.graphql', True),
 ('cd 뒤 상대 파일', 'cd sub && gh pr comment 395 --body-file appr.md', True),
 ('-R 앞 merge(상태값 없음)', 'gh -R grk-cmd/t-w pr merge 395', True),
 # 못 막는 것(알려진 한계): bash -c 'gh pr review 395 --approve'
 ('GET 코멘트 + grep', f'gh api -X GET {R}/issues/395/comments -f per_page=100 | grep "{A}"', False),
 ('코멘트 + 다른 조각 git commit', f'gh pr comment 395 -b "확인" && git commit -m "{A} 반영"', False),
 ('review -b 값이 -a', 'gh pr review 395 --comment -b -a', False),
 ('pr view comments 읽기', f'gh pr view 395 --comments | grep "{A}"', False),
]

ok = bad = 0
for name, cmd, want in cases:
    p = subprocess.run([sys.executable, '-B', G], input=json.dumps({'tool_input': {'command': cmd}, 'cwd': CWD}),
                       capture_output=True, text=True)
    denied = '"deny"' in p.stdout
    if denied == want and not p.stderr:
        ok += 1
    else:
        bad += 1
        print(f'  ✗ 가드 {name}: {"막음" if denied else "통과"}(기대 {"막음" if want else "통과"}) {p.stderr[-200:]}')

sys.path.insert(0, HERE)
import risk
S = '0c4b3e93f26e8b8a0ff99717d88af4a520a9d9ec'
U, X = {'login': risk.OWNER}, {'login': 'grk-cmd'}
judge = [
    ('리뷰 승인', [{'user': U, 'state': 'APPROVED', 'commit_id': S}], [], True),
    ('옛 커밋 리뷰 승인', [{'user': U, 'state': 'APPROVED', 'commit_id': 'abc'}], [], False),
    ('코멘트 승인 7자', [], [{'user': U, 'body': '승인 0c4b3e9'}], True),
    ('코멘트 승인 40자', [], [{'user': U, 'body': '승인 ' + S}], True),
    ('코멘트 6자', [], [{'user': U, 'body': '승인 0c4b3e'}], False),
    ('옛 커밋 코멘트', [], [{'user': U, 'body': '승인 abcdef0'}], False),
    ('남이 단 코멘트', [], [{'user': X, 'body': '승인 0c4b3e9'}], False),
    ('백틱 줄', [], [{'user': U, 'body': '붙여 넣기: `승인 0c4b3e9`'}], False),
    ('여러 줄 중 한 줄', [], [{'user': U, 'body': '봤어요\r\n승인 0c4b3e9\r\n'}], True),
    ('그 커밋 Request changes 뒤 코멘트', [{'user': U, 'state': 'CHANGES_REQUESTED', 'commit_id': S}], [{'user': U, 'body': '승인 0c4b3e9'}], False),
    ('그 커밋 DISMISSED 뒤 코멘트', [{'user': U, 'state': 'DISMISSED', 'commit_id': S}], [{'user': U, 'body': '승인 0c4b3e9'}], True),
    ('옛 커밋 Request changes · 새 커밋 코멘트', [{'user': U, 'state': 'CHANGES_REQUESTED', 'commit_id': 'abc'}], [{'user': U, 'body': '승인 0c4b3e9'}], True),
    ('본문 없음', [], [{'user': U, 'body': None}], False),
]
for name, reviews, comments, want in judge:
    risk.api = lambda p, r=reviews, c=comments: [r] if '/reviews' in p else [c]
    got = risk.owner_approved(395, S)
    if got == want:
        ok += 1
    else:
        bad += 1
        print(f'  ✗ 판정 {name}: {got}(기대 {want})')
risk.api = lambda p: []
if risk.owner_approved(395, '') is False and risk.owner_approved(395, None) is False:
    ok += 1
else:
    bad += 1
    print('  ✗ 판정 머리 커밋 없음')

# 머지 가드 — 위험도 · 승인을 못 읽으면(GitHub API 실패) 막는가
import importlib.util, io, contextlib
spec = importlib.util.spec_from_file_location('ship_gate', G)
gate = importlib.util.module_from_spec(spec)
spec.loader.exec_module(gate)
gate.gate_ok = lambda pr: (True, '')
gate.run = lambda *a, **k: S
def boom(pr):
    raise RuntimeError('gh api 실패(시험)')
risk.assess = boom
buf = io.StringIO()
try:
    with contextlib.redirect_stdout(buf):
        gate.check_merge(['gh', 'pr', 'merge', '395'])
except SystemExit:
    pass
if '"deny"' in buf.getvalue():
    ok += 1
else:
    bad += 1
    print('  ✗ 머지 가드: API 실패인데 막지 않음')

# 세션 시작 hook(role-start.py) — 역할 지침 · 판 요약을 언제 붙이나
spec = importlib.util.spec_from_file_location('role_start', os.path.join(HERE, 'role-start.py'))
rs = importlib.util.module_from_spec(spec)
spec.loader.exec_module(rs)
ROLES = {'_공통': '공통글', '서버담당': '서버글', '질문': '질문글'}
FACTS = {'notes': [], 'releases': {'0.12.0': {'ahead': 2, 'subjects': ['feat: 가']}, '0.13.0': {'ahead': 1, 'subjects': ['fix: 나']}},
         'prs': [{'number': 7, 'title': '판 PR', 'head': 'fix/a', 'base': 'release/0.12.0'},
                 {'number': 8, 'title': '하네스 PR', 'head': 'harness/b', 'base': 'main'}],
         'status': [{'상태': '작업중', '담당': 'grk', '판': '0.12.0', '브랜치': 'fix/a', '내용': '고침'},
                    {'상태': '작업완료(0.13.0)', '담당': '나', '판': '0.13.0', '브랜치': 'fix/c', '내용': '끝'},
                    {'상태': '검토중', '담당': '오케', '판': 'main', '브랜치': 'harness/b', '내용': '하네스'}],
         'overlaps': [('0.12.0', '0.13.0', ['app/parts/app.js'])]}
def boom_gather():
    raise RuntimeError('fetch 실패(시험)')
STATUS_MD = ('# 현황판\n\n## 진행 중\n\n| 상태 | 판 | 브랜치 |\n|---|---|---|\n| 작업중 | 0.12.0 | fix/a |\n'
             '| 칸이 | 모자람 |\n| 검토중 | main | harness/b |\n\n## 끝난 것\n\n| 상태 | 판 | 브랜치 |\n|---|---|---|\n| x | y | z |\n')
role_cases = [
    # (이름, 실제 값, 기대 값)
    ('역할 이름 → 공통 + 역할', rs.role_text('서버담당', ROLES), '공통글\n\n서버글'),
    ('앞뒤 공백 이름', rs.role_text(' 서버담당 ', ROLES), '공통글\n\n서버글'),
    ('NFD 로 조합된 이름', rs.role_text(__import__('unicodedata').normalize('NFD', '서버담당'), ROLES), '공통글\n\n서버글'),
    ('이름 없음', rs.role_text('', ROLES), None),
    ('None 이름', rs.role_text(None, ROLES), None),
    ('모르는 이름', rs.role_text('아무개', ROLES), None),
    ('공통 파일 이름은 역할 아님', rs.role_text('_공통', ROLES), None),
    ('공통 파일이 없으면 역할 글만', rs.role_text('서버담당', {'서버담당': '서버글'}), '서버글'),
    ('판 묻기: main 새 세션', rs.needs_pick('서버담당', 'main', 'startup'), True),
    ('판 묻기: 이름 없는 세션도', rs.needs_pick(None, 'main', 'startup'), True),
    ('판 묻기: /clear', rs.needs_pick(None, 'release/0.12.0', 'clear'), True),
    ('판 묻기: 떨어진 HEAD', rs.needs_pick(None, '', 'startup'), True),
    ('판 안 물음: 작업 브랜치 위', rs.needs_pick('서버담당', 'fix/a', 'startup'), False),
    ('판 안 물음: 질문 세션', rs.needs_pick('질문', 'main', 'startup'), False),
    ('판 안 물음: resume', rs.needs_pick('서버담당', 'main', 'resume'), False),
    ('판 안 물음: compact', rs.needs_pick(None, 'main', 'compact'), False),
    ('판 이름: release/', rs.rel_name('release/0.12.0'), '0.12.0'),
    ('판 이름: 작업완료(…)', rs.rel_name('작업완료(0.13.0)'), '0.13.0'),
    ('판 이름: main', rs.rel_name(' main '), 'main'),
    ('판 이름: 빈 값', rs.rel_name(None), ''),
    ('현황판: 진행 중 표만 · 칸 모자란 줄 버림', [r['브랜치'] for r in rs.parse_status(STATUS_MD)], ['fix/a', 'harness/b']),
    ('현황판: 머리 없음', rs.parse_status('# 다른 글\n| a |\n'), []),
    ('현황판: 빈 글', rs.parse_status(None), []),
    ('겹침: 같은 파일만', rs.overlaps({'0.12.0': ['a', 'b'], '0.13.0': ['b', 'c'], '0.14.0': ['d']}), [('0.12.0', '0.13.0', ['b'])]),
    ('겹침: 판 하나', rs.overlaps({'0.12.0': ['a']}), []),
    ('자르기: 상한 그대로', rs.cut('가' * 60), '가' * 60),
    ('자르기: 넘치면 …', rs.cut('가' * 61), '가' * 59 + '…'),
    ('build: resume 은 역할만', rs.build('서버담당', 'resume', 'main', ROLES, boom_gather), '공통글\n\n서버글'),
    ('build: 작업 브랜치 · 모르는 이름 → 없음', rs.build('아무개', 'startup', 'fix/a', ROLES, boom_gather), None),
    ('build: 질문 세션은 요약 없이 역할만', rs.build('질문', 'startup', 'main', ROLES, boom_gather), '공통글\n\n질문글'),
]
for name, got, want in role_cases:
    if got == want:
        ok += 1
    else:
        bad += 1
        print(f'  ✗ 시작 hook: {name} — {got!r} (기대 {want!r})')

def has(name, text, *parts, absent=()):
    global ok, bad
    miss = [p for p in parts if p not in text] + [f'(없어야 함) {p}' for p in absent if p in text]
    if miss:
        bad += 1
        print(f'  ✗ 시작 hook: {name} — 빠짐 {miss}')
    else:
        ok += 1

t = rs.build('서버담당', 'startup', 'main', ROLES, boom_gather)
has('모으기 실패 → 못 불러옴 + 판 질문', t, '서버글', '요약을 못 불러옴', 'fetch 실패(시험)', '어느 버전에 나갈 작업')
t = rs.render(FACTS)
has('요약: 판마다 PR · 현황판 · 겹침', t, '### release/0.12.0', '### release/0.13.0', '열린 PR #7', '현황판: 작업중 · grk · fix/a',
    '현황판: 작업완료(0.13.0)', '열린 PR 없음', '### 판 밖', '열린 PR #8 → main', '현황판: 검토중 · 오케', 'release/0.12.0 ↔ release/0.13.0: app/parts/app.js')
t = rs.render(dict(FACTS, prs=None, notes=['열린 PR 을 못 읽음']))
has('요약: PR 못 읽음 ≠ 열린 PR 없음', t, '⚠️ 열린 PR 을 못 읽음', absent=('열린 PR 없음', '열린 PR #'))
t = rs.render({'notes': [], 'releases': {}, 'prs': [], 'status': []})
has('요약: 판 없음', t, '열린 판 브랜치(`release/*`)가 없다', absent=('판끼리',))
t = rs.render(dict(FACTS, releases={'0.12.0': FACTS['releases']['0.12.0']}, overlaps=[]))
has('요약: 판 하나면 겹침 칸 없음', t, '### release/0.12.0', absent=('판끼리 겹치는',))

# 시간 예산 — 명령 하나에 5초씩 걸리는 셈으로 시계를 돌려, 예산을 넘으면 거기서 멈추고 «못 읽음» 을 남기는가
class FakeTime:
    now = 0.0
    @classmethod
    def monotonic(cls):
        return cls.now
calls = []
def slow_sh(args, cwd, timeout=10):
    calls.append((args[1], timeout))
    FakeTime.now += 5
    if args[1] == 'for-each-ref':
        return 'origin/release/0.12.0\norigin/release/0.13.0\n'
    return '1\n' if args[1] == 'rev-list' else ''
real_time, real_sh = rs.time, rs.sh
rs.time, rs.sh = FakeTime, slow_sh
try:
    f = rs.gather(CWD, budget=12)
finally:
    rs.time, rs.sh = real_time, real_sh
notes = ' '.join(f['notes'])
has('예산: 넘으면 판 읽기를 멈추고 남은 것은 «못 읽음»', notes, 'release/0.12.0 부터 판을 못 읽음', '시간 예산 12초', '열린 PR 을 못 읽음', '현황판을 못 읽음')
if f['releases'] == {} and f['prs'] is None and [c for c, _ in calls] == ['fetch', 'for-each-ref', 'rev-list'] and [t for _, t in calls] == [12, 7, 2]:
    ok += 1
else:
    bad += 1
    print(f'  ✗ 시작 hook: 예산 — 반쯤 읽은 판을 넣었거나 명령을 더 돌림 {f["releases"]} {calls}')

# 실제로 실행 — git 저장소가 아닌 곳 · 깨진 입력에도 세션을 막지 않는가(종료 0 · JSON 한 줄)
RS = os.path.join(HERE, 'role-start.py')
for name, stdin, want in (
        ('실행: 역할 이름 · 저장소 아님', json.dumps({'session_title': '질문', 'source': 'startup', 'cwd': CWD}), '너는 질문 담당이다'),
        ('실행: 이름 없음 · 저장소 아님 → 판 질문', json.dumps({'source': 'startup', 'cwd': CWD}), '판을 못 읽음'),
        ('실행: 깨진 입력 → 오류 안내만', '{깨짐', '세션 시작 hook 오류')):
    p = subprocess.run([sys.executable, '-B', RS], input=stdin, capture_output=True, text=True, timeout=30)
    try:
        body = json.dumps(json.loads(p.stdout), ensure_ascii=False)
    except ValueError:
        body = ''
    if p.returncode == 0 and want in body:
        ok += 1
    else:
        bad += 1
        print(f'  ✗ 시작 hook: {name} — 종료 {p.returncode} · {p.stdout[:120]!r} {p.stderr[:120]!r}')

print(f'{"✓" if not bad else "✗"} 통과 {ok} · 실패 {bad}')
sys.exit(1 if bad else 0)
