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
 ('승인 명령 node', 'node scripts/approve.js 401', True),
 ('승인 명령 절대경로 · 여러 PR', 'node /x/tw/scripts/approve.js 396 397', True),
 ('승인 명령 직접 실행', './scripts/approve.js 401', True),
 ('승인 명령 cd 뒤', 'cd sub && node ../scripts/approve.js 401', True),
 ('승인 명령 env 앞', 'FOO=1 node scripts/approve.js 401', True),
 ('승인 명령 확장자 없음', 'node scripts/approve 401', True),
 ('승인 명령 time 앞', 'time node scripts/approve.js 401', True),
 ('승인 명령 nohup 앞', 'nohup node scripts/approve.js 401', True),
 ('승인 명령 ! 앞', '! node scripts/approve.js 401', True),
 ('승인 명령 괄호', '(node scripts/approve.js 401)', True),
 ('승인 명령 xargs', 'echo 401 | xargs node scripts/approve.js', True),
 ('승인 명령 --require 값 뒤', 'node --require ./x.js scripts/approve.js 401', True),
 # 못 막는 것(알려진 한계): bash -c "node scripts/approve.js 1" · node -e "require('./scripts/approve.js')"
 # 막으면 안 되는 것
 ('승인 명령 읽기', 'cat scripts/approve.js', False),
 ('승인 명령 grep', 'grep -n OWNER scripts/approve.js', False),
 ('승인 명령 문법 검사', 'node --check scripts/approve.js', False),
 ('승인 명령 git diff', 'git diff -- scripts/approve.js', False),
 ('다른 node 검사', 'node checks/run.js sim-signup', False),
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
                       capture_output=True, text=True, encoding='utf-8', errors='replace')
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

# 위험도 — 앱에 바깥 주소를 새로 박으면 높음(CSP · Firebase 기본 주소)
real_api = risk.api
def risky(name, files, want_high, want_word=''):
    global ok, bad
    risk.api = lambda p, f=files: [f]
    r = risk.assess(395)
    good = r['high'] == want_high and (not want_word or any(want_word in x for x in r['reasons']))
    if good:
        ok += 1
    else:
        bad += 1
        print(f'  ✗ 위험도 {name}: {r}')
P = lambda name, *added: {'filename': name, 'status': 'modified', 'patch': '@@ -1 +1 @@\n' + '\n'.join('+' + a for a in added)}
risky('CSP 줄이 바뀜', [P('app/desk-companion-prototype.html', '<meta http-equiv="Content-Security-Policy" content="frame-src https://help.together-working.com;">')], True, 'CSP')
risky('web.app 주소를 새로 박음', [P('app/parts/shared/help-site.js', "const HELP_ORIGIN = 'https://together-working.web.app';")], True, 'Firebase 기본 주소')
risky('firebaseapp.com 주소', [P('app/parts/x.js', "fetch2('https://together-working.firebaseapp.com/a')")], True, 'Firebase 기본 주소')
risky('우리 도메인 주소는 높음 아님', [P('app/parts/shared/help-site.js', "const HELP_ORIGIN = 'https://help.together-working.com';")], False)
risky('글자만 바뀜', [P('app/parts/myhome/scheduler.js', "btn.textContent = '📪 알림함 확인';")], False)
risky('검사 · 문서의 web.app 은 빼기', [P('checks/sim-x.js', "!S.isHelpUrl('https://together-working.web.app/help/')"), P('docs/RELEASE.md', 'https://together-working.web.app/admin/')], False)
risky('지운 줄은 안 봄', [{'filename': 'app/a.js', 'status': 'modified', 'patch': "@@ -1 +1 @@\n-const U = 'https://together-working.web.app';"}], False)
risk.api = real_api

# 판 브랜치만 합친 머리 — 앞 커밋의 승인 · 판정을 이어 받는가(PR 자체 변경이 같을 때만)
O, H, H2 = 'a1' * 20, 'b2' * 20, 'c3' * 20   # O 승인된 커밋 · H 판 브랜치만 합친 머리 · H2 합치며 코드가 달라진 머리
ROW = lambda h: f'| **smoke.js** | 691 | **{h}** |'
def files(code, row='aaaaaaaaaaaa', extra=()):
    return [{'filename': 'app/a.js', 'status': 'modified', 'patch': f'@@ -1,3 +1,3 @@\n ctx\n-old\n+{code}'},
            {'filename': 'checks/CHECKS.md', 'status': 'modified', 'patch': f'@@ -70 +70 @@\n-{ROW("000000000000")}\n+{ROW(row)}'}, *extra]
CMP = {O: files('new'), H: files('new', row='bbbbbbbbbbbb'), H2: files('new2')}
def fake(reviews=(), comments=(), commits=(O, H), cmp=CMP, runs=None, state='open'):
    risk.api = lambda p: [list(reviews)] if '/reviews' in p else [list(comments)] if '/comments' in p else [[{'sha': c} for c in commits]] if '/commits' in p else [[]]
    def get(p):
        if '/compare/' in p:
            return {'files': cmp[p.rsplit('...', 1)[1]]}
        if '/check-runs' in p:
            return {'check_runs': runs if runs is not None else [{'name': 'npm run check', 'status': 'completed', 'conclusion': 'success'}]}
        return {'base': {'ref': 'release/0.12.0'}, 'head': {'sha': commits[-1]}, 'state': state}
    risk.get = get
carry = [
    ('합치기만 · 옛 커밋 코멘트 승인', dict(comments=[{'user': U, 'body': '승인 ' + O[:7]}]), H, True),
    ('합치기만 · 옛 커밋 리뷰 승인', dict(reviews=[{'user': U, 'state': 'APPROVED', 'commit_id': O}]), H, True),
    ('합치며 코드가 달라짐', dict(comments=[{'user': U, 'body': '승인 ' + O[:7]}], commits=(O, H2)), H2, False),
    ('승인 없음', dict(), H, False),
    ('남이 단 옛 승인', dict(comments=[{'user': X, 'body': '승인 ' + O[:7]}]), H, False),
    ('PR 에 없는 커밋 승인', dict(comments=[{'user': U, 'body': '승인 ' + 'd4' * 3 + 'd'}]), H, False),
    ('옛 승인 뒤 Request changes', dict(reviews=[{'user': U, 'state': 'CHANGES_REQUESTED', 'commit_id': O}], comments=[{'user': U, 'body': '승인 ' + O[:7]}]), H, False),
    ('compare 파일 300개(못 다 봄)', dict(comments=[{'user': U, 'body': '승인 ' + O[:7]}], cmp={O: [{'filename': f'f{i}', 'status': 'added', 'patch': '+x'} for i in range(300)], H: [{'filename': f'f{i}', 'status': 'added', 'patch': '+x'} for i in range(300)]}), H, False),
    ('해시 줄 말고 CHECKS.md 글이 달라짐', dict(comments=[{'user': U, 'body': '승인 ' + O[:7]}], cmp={O: files('new'), H: files('new', extra=[{'filename': 'checks/CHECKS.md', 'status': 'modified', 'patch': '+| **sim-x.js** | 9 | 손 |'}])}), H, False),
    ('합치며 파일 하나가 더 바뀜', dict(comments=[{'user': U, 'body': '승인 ' + O[:7]}], cmp={O: files('new'), H: files('new', extra=[{'filename': 'b.js', 'status': 'modified', 'patch': '+y'}])}), H, False),
]
MOVED = [{'filename': 'app/a.js', 'status': 'modified', 'patch': '@@ -9,3 +9,3 @@ function deleteAll\n ctx2\n-old\n+new'}, files('new')[1]]
ROWDEL = files('new')[:1] + [{'filename': 'checks/CHECKS.md', 'status': 'modified', 'patch': f'@@ -70 +70 @@\n-{ROW("000000000000")}\n+{ROW("aaaaaaaaaaaa")}\n-| **sim-z.js** | 9 | **abcdefabcdef** |'}]
A7 = dict(comments=[{'user': U, 'body': '승인 ' + O[:7]}])
carry += [
    ('같은 줄을 다른 자리(다른 함수)에', dict(A7, cmp={O: files('new'), H: MOVED}), H, False),
    ('줄 번호가 달라짐(같은 글 · 같은 앞뒤 · 다른 자리 — 판 브랜치가 위를 고쳤어도 다시)', dict(A7, cmp={O: files('new'), H: [dict(files('new')[0], patch=files('new')[0]['patch'].replace('-1,3 +1,3', '-41,3 +41,3')), files('new')[1]]}), H, False),
    ('CHECKS.md 의 다른 해시 줄을 지움', dict(A7, cmp={O: files('new'), H: ROWDEL}), H, False),
    ('다른 파일의 해시 줄 모양 줄은 빼지 않음', dict(A7, cmp={O: [{'filename': 'b.md', 'status': 'modified', 'patch': '@@ -1 +1 @@\n+' + ROW('aaaaaaaaaaaa')}], H: [{'filename': 'b.md', 'status': 'modified', 'patch': '@@ -1 +1 @@\n+' + ROW('bbbbbbbbbbbb')}]}), H, False),
    ('두 커밋 다 바꾼 것 없음', dict(A7, cmp={O: [], H: []}), H, False),
    ('patch 없는 파일(머리 판이 같아도 못 봄)', dict(A7, cmp={O: files('new', extra=[{'filename': 'big.js', 'status': 'modified', 'patch': None, 'sha': 'bX'}]),
                                                    H: files('new', extra=[{'filename': 'big.js', 'status': 'modified', 'patch': None, 'sha': 'bX'}])}), H, False),
    ('앞뒤 글은 같고 @@ 꼬리(함수)만 다름', dict(A7, cmp={O: files('new'), H: [dict(files('new')[0], patch=files('new')[0]['patch'].replace('@@ -1,3 +1,3 @@', '@@ -1,3 +1,3 @@ function deleteAll')), files('new')[1]]}), H, False),
]
B = 'e5' * 20   # 승인이 두 번 — O 승인 → B 코드 고침 · 승인 → H 는 B 에 합치기만: 가장 최근 승인(B)과 견준다
carry += [('승인 두 번 · 최근 승인과 견줌', dict(comments=[{'user': U, 'body': '승인 ' + O[:7]}, {'user': U, 'body': '승인 ' + B[:7]}], commits=(O, B, H),
                                           cmp={O: files('old'), B: files('new'), H: files('new', row='bbbbbbbbbbbb')}), H, True)]
risk._same.clear()
for name, kw, head, want in carry:
    kw = dict(kw)
    risk._same.clear()
    fake(commits=kw.pop('commits', (O, head)), **kw)
    got = risk.owner_approved(395, head)
    if got == want:
        ok += 1
    else:
        bad += 1
        print(f'  ✗ 이어 받기 {name}: {got}(기대 {want})')

# 가드 판정 이어 받기 — 머리에 tw/confirm · tw/verify 가 없어도 앞 커밋에 있고 PR 자체 변경이 같으면 머지 길을 연다
import importlib.util, io, contextlib
spec = importlib.util.spec_from_file_location('ship_gate', G)
gate = importlib.util.module_from_spec(spec)
spec.loader.exec_module(gate)
sys.modules['risk'] = risk
GOOD = json.dumps([{'context': 'tw/confirm', 'state': 'success'}, {'context': 'tw/verify', 'state': 'success'}])
for name, head, passed_on, want in (('합치기만 · 앞 커밋 통과', H, O, True), ('합치며 달라짐 · 앞 커밋 통과', H2, O, False),
                                    ('아무 커밋도 통과 없음', H, None, False), ('머리가 통과', H, H, True)):
    fake(commits=(O, head))
    risk._same.clear()
    gate.run = lambda *a, h=head, ps=passed_on, **k: h if a[-1] == '.head.sha' else (GOOD if ps and f'/commits/{ps}/' in a[2] else '[]')
    got = gate.gate_ok(395)[0]
    if got == want:
        ok += 1
    else:
        bad += 1
        print(f'  ✗ 가드 판정 이어 받기 {name}: {got}(기대 {want})')

# 가드 — 이어 받기를 읽다 API 가 실패하면 막는다(맨 아래 «가드 오류면 통과» 로 새지 않게)
fake(commits=(O, H))
gate.run = lambda *a, **k: H if a[-1] == '.head.sha' else '[]'
def boom2(*a, **k):
    raise RuntimeError('gh api 실패(시험)')
risk.api, risk.get = boom2, boom2
buf = io.StringIO()
try:
    with contextlib.redirect_stdout(buf):
        gate.check_merge(['gh', 'pr', 'merge', '395'])
except SystemExit:
    pass
if '"deny"' in buf.getvalue() and '읽지 못해' in buf.getvalue():
    ok += 1
else:
    bad += 1
    print('  ✗ 가드 이어 받기: API 실패인데 막지 않음')

# 기다리기(risk.py --wait) — 승인 · CI 를 세션이 지켜보다 알린다
naps = []
def waiting(name, want_code, want_word, high=True, steps=(), **kw):   # high 가 함수면 그때 머리 커밋으로 정한다
    seq = list(steps)
    def nap(_):
        naps.append(1)
        if seq:
            fake(**seq.pop(0))
    fake(**kw)
    risk._same.clear()
    risk.assess = lambda pr: {'high': high(risk.get('pulls')['head']['sha']) if callable(high) else high, 'reasons': []}
    code, msg = risk.wait(395, limit=60, every=15, sleep=nap)
    global ok, bad
    if code == want_code and want_word in msg:
        ok += 1
    else:
        bad += 1
        print(f'  ✗ 기다리기 {name}: {code} {msg}')
APPR = [{'user': U, 'body': '승인 ' + H[:7]}]
waiting('승인 · CI 초록', 0, '머지할 차례', commits=(O, H), comments=APPR)
waiting('승인이 나중에 달림', 0, '머지할 차례', commits=(O, H), steps=[dict(commits=(O, H)), dict(commits=(O, H), comments=APPR)])
waiting('승인 없음 — 시간 끝', 1, '끝나지 않음', commits=(O, H))
waiting('낮음은 승인 없이 CI 만', 0, '머지할 차례', high=False, commits=(O, H))
waiting('CI 도는 중 — 끝나면', 0, '머지할 차례', commits=(O, H), comments=APPR, runs=[{'name': 'npm run check', 'status': 'in_progress'}],
        steps=[dict(commits=(O, H), comments=APPR)])
waiting('CI 빨강', 1, 'CI 빨강: npm run check', commits=(O, H), comments=APPR, runs=[{'name': 'npm run check', 'status': 'completed', 'conclusion': 'failure'}])
waiting('PR 이 닫힘', 1, '열려 있지 않다', commits=(O, H), state='closed')
waiting('CI 아직 하나도 없음', 1, '끝나지 않음', commits=(O, H), comments=APPR, runs=[])
waiting('새 커밋이 오르면 위험도 다시(낮음 → 높음)', 1, '끝나지 않음', high=lambda sha: sha == H, commits=(O, O), runs=[{'name': 'c', 'status': 'in_progress'}],
        steps=[dict(commits=(O, H))])
def flaky(name, want_code, want_word, fails):
    n = [0]
    real_get = risk.get
    def get(p):
        if n[0] < fails:
            n[0] += 1
            raise RuntimeError('gh api 순간 실패(시험)')
        return real_get(p)
    risk.get = get
    risk.assess = lambda pr: {'high': True, 'reasons': []}
    code, msg = risk.wait(395, limit=60, every=15, sleep=lambda _: None)
    global ok, bad
    if code == want_code and want_word in msg:
        ok += 1
    else:
        bad += 1
        print(f'  ✗ 기다리기 {name}: {code} {msg}')
fake(commits=(O, H), comments=APPR); flaky('한 번 읽기 실패는 넘기고 다음 바퀴', 0, '머지할 차례', 1)
fake(commits=(O, H), comments=APPR); flaky('계속 실패면 끝에 알림', 1, '읽기 실패', 99)

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
    p = subprocess.run([sys.executable, '-B', RS], input=stdin, capture_output=True, text=True, encoding='utf-8', errors='replace', timeout=30)
    try:
        body = json.dumps(json.loads(p.stdout), ensure_ascii=False)
    except ValueError:
        body = ''
    if p.returncode == 0 and want in body:
        ok += 1
    else:
        bad += 1
        print(f'  ✗ 시작 hook: {name} — 종료 {p.returncode} · {p.stdout[:120]!r} {p.stderr[:120]!r}')

# Windows(cp949) 흉내 — 표준 입출력이 지역 인코딩이어도 «» · 한글을 읽고 쓰다 죽지 않는가(hook 이 죽으면 가드 · 판 요약이 조용히 빠진다)
CP = dict(os.environ, PYTHONIOENCODING='cp949')
for name, script, stdin, want in (
        ('가드 거절 문구(«»)', G, json.dumps({'tool_input': {'command': 'gh pr review 395 --approve'}, 'cwd': CWD}), '"deny"'),
        ('시작 hook 역할 지침', RS, json.dumps({'session_title': '질문', 'source': 'startup', 'cwd': CWD}), '너는 질문 담당이다')):
    p = subprocess.run([sys.executable, '-B', script], input=stdin.encode('utf-8'), capture_output=True, env=CP, timeout=30)
    out, err = p.stdout.decode('utf-8', 'replace'), p.stderr.decode('utf-8', 'replace')
    if p.returncode == 0 and not err and want in json.dumps(json.loads(out or 'null'), ensure_ascii=False):
        ok += 1
    else:
        bad += 1
        print(f'  ✗ cp949 {name}: 종료 {p.returncode} · {out[:120]!r} {err[-200:]!r}')

# 실제 cp949 로캘 — 표준 입출력에 더해 gh 출력 해독도 로캘을 따른다. 한글 · «» · — 를 UTF-8 로 내보내는 가짜 gh 를 PATH 앞에.
# 해독이 깨지면 위험도를 못 읽어 승인된 PR 도 막히거나, «가드 오류 — 막지 않았다» 로 새서 승인 없이 머지된다.
FAKE = tempfile.mkdtemp()
open(os.path.join(FAKE, 'gh'), 'w', encoding='utf-8').write('''#!/usr/bin/env python3
import sys, json, os
a = ' '.join(sys.argv[1:])
w = lambda s: sys.stdout.buffer.write(s.encode('utf-8'))
if 'state=open' in a:
    out = [{'number': 7, 'title': '한글 제목 «PR» — 끝', 'head': 'feat/x', 'base': 'release/9.9.9'}]
elif '/files' in a:
    out = [{'filename': 'firebase-database-rules.json', 'status': 'modified', 'changes': 1, 'patch': '+  "한글 «주석» — 끝": 1'}]
elif '/reviews' in a:
    out = []
elif '/comments' in a:
    out = [{'user': {'login': 'mihioon'}, 'body': os.environ.get('FAKE_BODY', '승인 요청 — «대기»')}]
elif a.endswith('.head.sha'):
    w('0c4b3e9aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa\\n'); sys.exit(0)
elif '/status' in a:
    w(json.dumps([{'context': 'tw/confirm', 'state': 'success'}, {'context': 'tw/verify', 'state': 'success'}])); sys.exit(0)
else:
    out = {}
w(json.dumps(out, ensure_ascii=False))
''')
os.chmod(os.path.join(FAKE, 'gh'), 0o755)
LOC = subprocess.run(['locale', '-a'], capture_output=True, text=True).stdout.split() if os.name != 'nt' else []
CPL = next((l for want in ('ko_kr.cp949', 'ko_kr.euckr', 'ko_kr.euc-kr') for l in LOC if l.lower() == want), None)
if CPL:
    env = dict(os.environ, LC_ALL=CPL, LANG=CPL, PATH=FAKE + os.pathsep + os.environ['PATH'])
    env.pop('PYTHONIOENCODING', None); env.pop('PYTHONUTF8', None)
    RK = os.path.join(HERE, 'risk.py')
    merge = json.dumps({'tool_input': {'command': 'gh pr merge 403'}, 'cwd': CWD})
    for name, args, stdin, extra, check in (
            ('위험도 판정', [RK, '403'], '', {}, lambda o: json.loads(o)['high'] is True),
            ('머지 가드 — 승인 없음 → 막음', [G], merge, {}, lambda o: '"deny"' in o and '위험도 높음' in o and '읽지 못해' not in o),
            ('머지 가드 — 승인 코멘트 → 통과', [G], merge, {'FAKE_BODY': '승인 0c4b3e9'}, lambda o: o.strip() == '')):
        p = subprocess.run([sys.executable, '-B'] + args, input=stdin.encode('utf-8'), capture_output=True, env=dict(env, **extra), timeout=30)
        out, err = p.stdout.decode('utf-8', 'replace'), p.stderr.decode('utf-8', 'replace')
        try:
            good = p.returncode == 0 and not err and check(out)
        except ValueError:
            good = False
        if good:
            ok += 1
        else:
            bad += 1
            print(f'  ✗ cp949 로캘 {name}: 종료 {p.returncode} · {out[:160]!r} {err[-200:]!r}')
    # 한글이 든 저장소(bare origin 에 main · release/9.9.9)를 만들어 그 로캘에서 gather — 해독이 깨지면 현황판 · 판 · PR 이 «못 읽음» 으로 빠진다
    ORIG, REPO_DIR = tempfile.mkdtemp(), tempfile.mkdtemp()
    g = lambda *a, cwd=REPO_DIR: subprocess.run(['git', '-c', 'user.name=t', '-c', 'user.email=t@t', *a], cwd=cwd, capture_output=True, check=True)
    g('init', '-q', '--bare', cwd=ORIG)
    g('init', '-q', '-b', 'main')
    os.makedirs(os.path.join(REPO_DIR, 'docs'))
    open(os.path.join(REPO_DIR, 'docs', 'WORK_STATUS.md'), 'w', encoding='utf-8').write(
        '## 진행 중 — 검토중\n| 상태 | 묶음 | 브랜치 | 내용 |\n|---|---|---|---|\n| 작업중 | 우편함 «소식» | feat/x | 한글 — 내용 |\n')
    g('add', '.'); g('commit', '-q', '-m', 'docs: 현황판 «처음» — 시작')
    g('remote', 'add', 'origin', ORIG); g('push', '-q', 'origin', 'main')
    g('checkout', '-q', '-b', 'release/9.9.9'); g('commit', '-q', '--allow-empty', '-m', 'feat: 판에 들어간 «일» — 한글')
    g('push', '-q', 'origin', 'release/9.9.9'); g('checkout', '-q', 'main')
    probe = ("import importlib.util, json, sys; sp = importlib.util.spec_from_file_location('rs', sys.argv[1]); m = importlib.util.module_from_spec(sp); "
             "sp.loader.exec_module(m); print(json.dumps(m.gather(sys.argv[2]), ensure_ascii=False))")
    p = subprocess.run([sys.executable, '-B', '-c', probe, RS, REPO_DIR], capture_output=True, env=env, timeout=60)
    out, err = p.stdout.decode('utf-8', 'replace'), p.stderr.decode('utf-8', 'replace')
    try:
        f = json.loads(out)
        good = (p.returncode == 0 and f['notes'] == [] and f['status'] and '한글 — 내용' in json.dumps(f['status'], ensure_ascii=False)
                and f['releases'].get('9.9.9', {}).get('subjects') == ['feat: 판에 들어간 «일» — 한글'] and f['prs'][0]['title'] == '한글 제목 «PR» — 끝')
    except (ValueError, KeyError, IndexError, TypeError):
        good = False
    if good:
        ok += 1
    else:
        bad += 1
        print(f'  ✗ cp949 로캘 시작 hook 판 요약: 종료 {p.returncode} · {out[:200]!r} {err[-200:]!r}')
else:
    print('  - cp949 로캘이 없어 «gh · git 출력 해독» 시험 4칸은 건너뜀(맥: ko_KR.CP949)')

print(f'{"✓" if not bad else "✗"} 통과 {ok} · 실패 {bad}')
sys.exit(1 if bad else 0)
