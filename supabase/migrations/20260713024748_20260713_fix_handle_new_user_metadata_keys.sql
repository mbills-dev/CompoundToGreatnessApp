/*
# Fix handle_new_user() — Read Correct Metadata Keys

1. Problem
- handle_new_user() reads raw_user_meta_data->>'display_name', but signUp() sends
  first_name and last_name separately. The display_name key never exists, so every
  new user gets the hardcoded 'New User' fallback.

2. Fix
- Update the trigger function to read first_name and last_name from raw_user_meta_data,
  concatenate them, and only fall back to 'New User' when both are genuinely empty.
- Uses COALESCE(NULLIF(TRIM(first_name || ' ' || last_name), ''), 'New User') so the
  fallback only triggers when both name fields are empty or whitespace-only.
- Preserves the search_path = public and SECURITY DEFINER settings from the prior fix.
- Preserves the username collision-safe loop from the prior fix.
*/

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
DECLARE
  base_username text;
  final_username text;
  suffix int := 0;
  full_name text;
BEGIN
  base_username := 'user_' || replace(new.id::text, '-', '');
  final_username := base_username;

  full_name := COALESCE(
    NULLIF(
      TRIM(
        COALESCE(new.raw_user_meta_data->>'first_name', '') || ' ' ||
        COALESCE(new.raw_user_meta_data->>'last_name', '')
      ),
      ''
    ),
    'New User'
  );

  LOOP
    BEGIN
      INSERT INTO profiles (id, username, display_name)
      VALUES (
        new.id,
        final_username,
        full_name
      )
      ON CONFLICT (id) DO NOTHING;
      EXIT;
    EXCEPTION WHEN unique_violation THEN
      suffix := suffix + 1;
      final_username := base_username || '_' || suffix;
    END;
  END LOOP;

  RETURN new;
END;
$function$;