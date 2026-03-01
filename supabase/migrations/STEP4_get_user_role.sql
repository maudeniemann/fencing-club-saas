CREATE OR REPLACE FUNCTION get_user_role()
RETURNS TEXT AS $func$
  SELECT role FROM public.club_members WHERE user_id = auth.uid() LIMIT 1;
$func$ LANGUAGE plpgsql SECURITY DEFINER STABLE;
