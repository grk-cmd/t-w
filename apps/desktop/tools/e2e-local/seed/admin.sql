-- 한 계정을 관리자로 — psql -v uid=<Firebase uid>. 시험 계정만(에뮬레이터 안에만 있는 uid)
INSERT INTO admin (auth_uid, granted_at, granted_by) VALUES (:'uid', now(), 'e2e-seed')
ON CONFLICT (auth_uid) DO NOTHING;
