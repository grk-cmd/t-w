-- 계정 시나리오(scenarios/account) 묶음의 초대 코드 — 다른 묶음의 INVT-E2E2-TEST 몫을 쓰지 않는다.
-- 여러 번 돌려도 같다. 쓴 횟수가 상한에 가까우면 0 으로 되돌린다(로컬 DB 만 · 시나리오가 켤 때마다 돈다)
INSERT INTO invite (invite_id, code, issuer_kind, issuer_auth_uid, max_uses, memo, created_at, updated_at)
VALUES (gen_random_uuid(), 'INVT-ACCT-E2E5', 'admin', 'e2e-seed', 5000, 'e2e account', now(), now())
ON CONFLICT (code) DO UPDATE SET used_count = CASE WHEN invite.used_count > 4500 THEN 0 ELSE invite.used_count END, paused_at = NULL, expires_at = NULL;
