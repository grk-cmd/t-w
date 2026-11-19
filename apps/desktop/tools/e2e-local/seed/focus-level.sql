-- 시험 계정의 포커스 레벨을 정한다 — psql -v uid=<Firebase uid> -v level=<레벨>. 레벨 = 1 + 누적초 / 3600(서버 FocusLevel)
INSERT INTO focus_progress (app_user_id, total_sec, last_accrued_at, star_color, created_at, updated_at)
SELECT app_user_id, (:'level'::int - 1) * 3600, now(), '#ffd34d', now(), now() FROM app_user WHERE auth_uid = :'uid'
ON CONFLICT (app_user_id) DO UPDATE SET total_sec = EXCLUDED.total_sec, updated_at = now();
