-- 묶음마다 가입에 쓰는 초대 코드 한 줄(이미 있으면 그대로) — psql -v code=<코드>. 다른 묶음과 사용 횟수를 나눠 쓰지 않게 따로 둔다
INSERT INTO invite (invite_id, code, issuer_kind, issuer_auth_uid, max_uses, created_at, updated_at)
VALUES (gen_random_uuid(), :'code', 'admin', 'e2e-seed', 5000, now(), now())
ON CONFLICT (code) DO NOTHING;
