/*
# Remove over-permissive anon RLS policy on friendships

1. Security changes (RLS)
- Drops the "Allow all access to friendships" policy, which granted the `anon`
  role full unfiltered access (SELECT/INSERT/UPDATE/DELETE) to every row in
  `friendships` with no ownership check.
- The anon key is embedded in the public client bundle, so this policy allowed
  any unauthenticated caller to read, create, update, or delete friendships.
- The four existing `authenticated` policies remain unchanged and continue to
  scope access to rows where `auth.uid()` is either `user_id` or `friend_id`.

2. Important notes
- No data is modified or deleted; only a policy object is dropped.
- After this change, unauthenticated (anon) requests can no longer read or
  mutate `friendships`. The app's friendship feature requires a signed-in
  user, so the `authenticated` policies fully cover the intended access.
- Idempotent: safe to re-run (uses `IF EXISTS`).
*/

DROP POLICY IF EXISTS "Allow all access to friendships" ON friendships;
