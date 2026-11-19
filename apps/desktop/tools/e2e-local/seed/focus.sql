-- 포커스 누적 시간을 정해 둔다(레벨 식 시험용) — psql -v code=<userCode> -v sec=<누적 초>. 에뮬레이터 시험 계정에만 쓴다
INSERT INTO focus_progress (app_user_id, total_sec, last_accrued_at, star_color, created_at, updated_at)
SELECT app_user_id, :sec, now(), '#ffd76a', now(), now() FROM app_user WHERE user_code = :'code'
ON CONFLICT (app_user_id) DO UPDATE SET total_sec = EXCLUDED.total_sec, updated_at = now();
