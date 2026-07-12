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
BEGIN
  base_username := 'user_' || replace(new.id::text, '-', '');

  final_username := base_username;
  LOOP
    BEGIN
      INSERT INTO profiles (id, username, display_name)
      VALUES (
        new.id,
        final_username,
        COALESCE(new.raw_user_meta_data->>'display_name', 'New User')
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