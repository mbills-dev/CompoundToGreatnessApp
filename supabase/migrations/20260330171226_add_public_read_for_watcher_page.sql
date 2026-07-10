/*
  # Add public read access for watcher page

  The public journey/watcher page is viewed by unauthenticated visitors.
  Goals already have an anon SELECT policy, but daily_activities and
  daily_completions are locked to authenticated users only, causing the
  success stack and completion checks to silently return empty on the
  watcher page.

  Changes:
  - daily_activities: add anon SELECT policy scoped to activities belonging
    to active goals only (mirrors the goal's existing public policy)
  - daily_completions: add anon SELECT policy scoped to completions belonging
    to active goals only
*/

CREATE POLICY "Public can view activities for active goals"
  ON daily_activities
  FOR SELECT
  TO anon
  USING (
    EXISTS (
      SELECT 1 FROM goals
      WHERE goals.id = daily_activities.goal_id
        AND goals.is_active = true
    )
  );

CREATE POLICY "Public can view completions for active goals"
  ON daily_completions
  FOR SELECT
  TO anon
  USING (
    EXISTS (
      SELECT 1 FROM goals
      WHERE goals.id = daily_completions.goal_id
        AND goals.is_active = true
    )
  );
