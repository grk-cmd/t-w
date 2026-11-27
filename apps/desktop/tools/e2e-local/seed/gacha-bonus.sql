-- 시험 계정에 가챠 보너스 뽑기 한 줄 — psql -v uid=<Firebase uid> -v tag=<보상 이름> -v amount=<수>
INSERT INTO gacha_bonus_grant (app_user_id, tag, amount, created_at)
SELECT app_user_id, :'tag', :'amount'::smallint, now() FROM app_user WHERE auth_uid = :'uid'
ON CONFLICT DO NOTHING;
