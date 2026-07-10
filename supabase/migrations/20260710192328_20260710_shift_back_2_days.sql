UPDATE goals
SET last_completion_date = last_completion_date - 2,
    challenge_start_date = challenge_start_date - interval '2 days',
    grace_period_prompted_date = NULL
WHERE id = '574718d6-ebad-490e-aafe-3045274d47c9';

UPDATE daily_completions
SET completion_date = completion_date - 2
WHERE goal_id = '574718d6-ebad-490e-aafe-3045274d47c9';