-- social 시나리오가 쓰는 준비 데이터. psql -v uid=<Auth 에뮬레이터 uid> -f seed/social.sql
-- 그 계정을 관리자로 — 앱은 관리자에게 프리미엄을 붙인다(투게더룸 · 방 초대). 에뮬레이터 안에만 있는 시험 계정에만 쓴다
INSERT INTO admin (auth_uid, granted_at, granted_by) VALUES (:'uid', now(), 'e2e-seed')
ON CONFLICT (auth_uid) DO NOTHING;
