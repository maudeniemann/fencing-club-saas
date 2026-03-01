CREATE OR REPLACE FUNCTION generate_booking_number()
RETURNS TEXT AS $func$
  SELECT 'BK-' || lpad(nextval('booking_number_seq')::text, 6, '0');
$func$ LANGUAGE plpgsql;
