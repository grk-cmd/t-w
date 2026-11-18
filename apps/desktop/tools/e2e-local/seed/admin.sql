-- 로그인 uid 하나를 관리자로 — 앱은 관리자에게 프리미엄을 붙인다(투게더룸 · 시크릿룸 발급). psql -v uid=<Auth 에뮬레이터 uid>
INSERT INTO admin (auth_uid, granted_at, granted_by) VALUES (:'uid', now(), 'e2e-seed')
ON CONFLICT DO NOTHING;
