-- 방 · 채팅 시나리오(scenarios/room · scenarios/chat)가 가입에 쓰는 초대 코드 — 여러 번 돌려도 그대로
INSERT INTO invite (invite_id, code, issuer_kind, issuer_auth_uid, max_uses, created_at, updated_at)
VALUES (gen_random_uuid(), 'INVT-RMRM-E2E3', 'admin', 'e2e-seed', 5000, now(), now())
ON CONFLICT DO NOTHING;
