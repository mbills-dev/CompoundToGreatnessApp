/*
# Add watchers table to supabase_realtime publication

1. Realtime
- Adds the existing `watchers` table to the `supabase_realtime` publication
  so INSERT/UPDATE/DELETE events on `watchers` rows are broadcast to
  Supabase Realtime subscribers.
- Idempotent: checks whether `watchers` is already in the publication before
  adding it, so re-running the migration is safe.

2. Security
- No RLS or policy changes. This only affects which tables emit realtime
  events; existing row-level security on `watchers` still governs which
  rows a given client can see over a realtime channel.
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime'
      AND schemaname = 'public'
      AND tablename = 'watchers'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.watchers;
  END IF;
END
$$;
