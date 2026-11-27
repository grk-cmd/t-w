-- 묶음 기본 초대 코드 한 줄 — psql -v code=<코드>. 다른 묶음과 사용 횟수를 나눠 쓰지 않게 묶음마다 코드를 따로 둔다.
-- 여러 번 돌려도 같다. 쓴 횟수가 상한에 가까우면 0 으로 되돌리고 멈춤 · 만료를 푼다(로컬 DB 만).
-- 시나리오가 켤 때마다 돈다 — TW_E2E_INVITE 를 주면 돌지 않는다(그 코드는 부른 사람의 것이라 건드리지 않는다 · _shared.js inviteCode)
INSERT INTO invite (invite_id, code, issuer_kind, issuer_auth_uid, max_uses, memo, created_at, updated_at)
VALUES (gen_random_uuid(), :'code', 'admin', 'e2e-seed', 5000, 'e2e', now(), now())
ON CONFLICT (code) DO UPDATE SET used_count = CASE WHEN invite.used_count > 4500 THEN 0 ELSE invite.used_count END, paused_at = NULL, expires_at = NULL;
