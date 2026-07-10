UPDATE goals
SET challenge_start_date = challenge_start_date - interval '1 day'
WHERE id = '574718d6-ebad-490e-aafe-3045274d47c9';

UPDATE daily_completions
SET completion_date = '2026-07-09'
WHERE goal_id = '574718d6-ebad-490e-aafe-3045274d47c9'
  AND completion_date = '2026-07-10';