CREATE OR REPLACE FUNCTION get_user_club_id()
RETURNS UUID AS $func$
  SELECT club_id FROM public.club_members WHERE user_id = auth.uid() LIMIT 1;
$func$ LANGUAGE plpgsql SECURITY DEFINER STABLE;
