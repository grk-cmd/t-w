-- 로그인 uid 하나를 관리자로 — psql -v uid=<Auth uid>. 관리자는 프리미엄 · 초대장 무제한 · 라이선스 발급이 된다
INSERT INTO admin (auth_uid, granted_at, granted_by, name)
VALUES (:'uid', now(), 'e2e-seed', 'e2e')
ON CONFLICT (auth_uid) DO NOTHING;
