CREATE OR REPLACE FUNCTION check_journey_leads_rate_limit()
RETURNS TRIGGER AS $$
BEGIN
  IF (
    SELECT count(*) FROM journey_leads
    WHERE watched_user_id = NEW.watched_user_id
      AND created_at > now() - interval '1 hour'
  ) >= 10 THEN
    RAISE EXCEPTION 'rate limit exceeded';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

DROP TRIGGER IF EXISTS journey_leads_rate_limit ON journey_leads;

CREATE TRIGGER journey_leads_rate_limit
  BEFORE INSERT ON journey_leads
  FOR EACH ROW EXECUTE FUNCTION check_journey_leads_rate_limit();