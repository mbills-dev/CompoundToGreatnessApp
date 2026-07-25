/*
  # Fix watcher_invitations public lookup (security)

  The previous "Anyone can look up an invitation by code" SELECT policy used
  USING (true), which let the anon role read every row in watcher_invitations
  (all invite_codes and invitee_emails). RLS predicates cannot filter by query
  parameters, so the policy could not be tightened to match only the requested
  code.

  Fix: drop the public SELECT policy and replace the public lookup path with a
  SECURITY DEFINER function that returns only the non-sensitive fields the
  public watch page needs, keyed by invite_code. invitee_email and invite_code
  are intentionally excluded from the return set.

  The existing authenticated SELECT/INSERT/UPDATE policies are unchanged.
*/

DROP POLICY IF EXISTS "Anyone can look up an invitation by code"
  ON watcher_invitations;

CREATE OR REPLACE FUNCTION lookup_watcher_invitation(p_code text)
RETURNS TABLE (
  id uuid,
  inviter_id uuid,
  inviter_display_name text,
  goal_title text,
  identity_statement text,
  current_challenge_day integer,
  accepted_by uuid
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT
    wi.id,
    wi.inviter_id,
    COALESCE(NULLIF(TRIM((us.first_name || ' ' || us.last_name)), ''), 'Someone') AS inviter_display_name,
    COALESCE(g.title, 'their journey') AS goal_title,
    g.identity_statement,
    COALESCE(g.current_challenge_day, 1) AS current_challenge_day,
    wi.accepted_by
  FROM watcher_invitations wi
  LEFT JOIN user_settings us ON us.user_id = wi.inviter_id::text
  LEFT JOIN goals g ON g.user_id = wi.inviter_id AND g.is_active = true
  WHERE wi.invite_code = p_code
  LIMIT 1;
END;
$$;

REVOKE EXECUTE ON FUNCTION lookup_watcher_invitation(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION lookup_watcher_invitation(text) TO anon, authenticated;
