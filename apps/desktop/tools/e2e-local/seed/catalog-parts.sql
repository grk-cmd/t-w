-- 시험 파츠 두 줄(모자 카테고리) — psql -v tag=<시험 표지>. 하나는 꾸미기에 진열(GIVEN) · 하나는 가챠(GACHA · 늘 나오는 시즌 ALWAYS).
-- 로컬 묶음은 API 의 Storage 봇이 없어 관리자 등록(파일 올리기)이 안 돈다 — 그래서 줄만 넣는다. model_hash 는 가짜(파일을 받지 않는 가챠 · 목록 판정용).
-- 넣은 뒤 서버 카탈로그 캐시는 관리자 쓰기 하나(이름 고치기 PATCH)가 비운다. 시나리오가 끝에 관리자 단종(ARCHIVED)으로 내린다
INSERT INTO part (part_id, name, icon, category_code, model_hash, thumb_hash, shape_flags, default_transform, listing_state, listing_access, acquisition, season, version, created_at, updated_at)
VALUES
  ('e2eg' || :'tag', 'e2e기본 ' || :'tag', '🎩', 'hat', md5(:'tag' || 'g') || md5(:'tag' || 'g2'), NULL,
   '{"glow":false,"multi":false,"standalone":false,"stackable":false,"rideTop":false,"noColor":true,"animMode":"always","charType":"default"}',
   NULL, 'ACTIVE', '{"kind":"everyone","display":"show"}', 'GIVEN', NULL, 0, now(), now()),
  ('e2ec' || :'tag', 'e2e가챠 ' || :'tag', '🎩', 'hat', md5(:'tag' || 'c') || md5(:'tag' || 'c2'), NULL,
   '{"glow":false,"multi":false,"standalone":false,"stackable":true,"rideTop":false,"noColor":true,"animMode":"always","charType":"default"}',
   NULL, 'ACTIVE', '{"kind":"everyone","display":"show"}', 'GACHA', 'ALWAYS', 0, now(), now())
ON CONFLICT (part_id) DO NOTHING;
