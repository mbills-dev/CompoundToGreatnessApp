/*
  # Add authenticated read access for watcher page

  The public journey/watcher page can be viewed by logged-in users watching
  someone else's journey. The existing public read policies are scoped to
  `anon` only, so authenticated users viewing another person's watcher page
  get empty results.

  Changes:
  - goals: add authenticated SELECT policy for any active goal (mirrors anon policy)
  - daily_activities: add authenticated SELECT policy for activities of active goals
  - daily_completions: add authenticated SELECT policy for completions of active goals
*/

CREATE POLICY "Authenticated can view active goals for public journey page"
  ON goals
  FOR SELECT
  TO authenticated
  USING (is_active = true);

CREATE POLICY "Authenticated can view activities for active goals"
  ON daily_activities
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM goals
      WHERE goals.id = daily_activities.goal_id
        AND goals.is_active = true
    )
  );

CREATE POLICY "Authenticated can view completions for active goals"
  ON daily_completions
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM goals
      WHERE goals.id = daily_completions.goal_id
        AND goals.is_active = true
    )
  );
