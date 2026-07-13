/*
# Watchers Table RLS Fix

1. Security Changes
- Drop the overly permissive "Allow all access to watchers" policy that granted FOR ALL access.
- Replace with three scoped policies (INSERT, SELECT, DELETE) scoped to authenticated users.
- INSERT: user can only insert rows where they are the watcher (auth.uid() = watcher_id).
- SELECT: user can view rows where they are either the watcher or the watched person.
- DELETE: user can only delete rows where they are the watcher.
- No UPDATE policy needed — watchers rows are never updated, only inserted/deleted.
- No anon policy needed — all real write paths run after an authenticated session exists.
*/

DROP POLICY IF EXISTS "Allow all access to watchers" ON watchers;
DROP POLICY IF EXISTS "Users can insert their own watch relationships" ON watchers;
DROP POLICY IF EXISTS "Users can view their own watch relationships" ON watchers;
DROP POLICY IF EXISTS "Users can delete their own watch relationships" ON watchers;

CREATE POLICY "Users can insert their own watch relationships"
  ON watchers FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = watcher_id);

CREATE POLICY "Users can view their own watch relationships"
  ON watchers FOR SELECT TO authenticated
  USING (auth.uid() = watcher_id OR auth.uid() = watched_id);

CREATE POLICY "Users can delete their own watch relationships"
  ON watchers FOR DELETE TO authenticated
  USING (auth.uid() = watcher_id);