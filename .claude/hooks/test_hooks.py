#!/usr/bin/env python3
"""하네스 훅 시험 — 가드(ship-gate.py)가 세션의 대신 승인을 막고 읽기는 막지 않는지, 승인 판정(risk.py)이 맞는지.
CI 는 돌리지 않는다(.claude/ 는 검사 실행기 대상이 아님) — 훅을 고치면 손으로: python3 .claude/hooks/test_hooks.py
"""
import json, os, subprocess, sys, tempfile

sys.dont_write_bytecode = True
HERE = os.path.dirname(os.path.abspath(__file__))
G = os.path.join(HERE, 'ship-gate.py')
A = '승인 0c4b3e9'
R = 'repos/grk-cmd/t-w'
CWD = tempfile.mkdtemp()
for name, body in (('appr.md', A + '\n'), ('appr.json', json.dumps({'body': A})), ('req.md', '승인 요청 — 붙여 넣기: `' + A + '`\n')):
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

print(f'{"✓" if not bad else "✗"} 통과 {ok} · 실패 {bad}')
sys.exit(1 if bad else 0)
