// TEMP: Add anonymous read policies for demo/preview mode
import { createAdminClient } from './lib/supabase-admin';

const tables = [
  'clubs', 'club_members', 'bookings', 'booking_participants',
  'lesson_types', 'venues', 'strips', 'availability_slots',
  'notifications', 'waitlist_entries', 'disputes', 'payments',
  'coach_payouts', 'lesson_logs',
];

async function main() {
  const supabase = createAdminClient();

  // First, create the exec_sql function so we can run DDL
  const createFnRes = await fetch(
    `${process.env.NEXT_PUBLIC_SUPABASE_URL}/rest/v1/rpc/`,
    {
      method: 'POST',
      headers: {
        'apikey': process.env.SUPABASE_SERVICE_ROLE_KEY!,
        'Authorization': `Bearer ${process.env.SUPABASE_SERVICE_ROLE_KEY!}`,
      },
    }
  );

  // Try using the Supabase SQL API directly
  const projectRef = new URL(process.env.NEXT_PUBLIC_SUPABASE_URL!).hostname.split('.')[0];

  const sql = tables.map(t =>
    `DO $$ BEGIN
      IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = '${t}' AND policyname = 'anon_read_${t}') THEN
        EXECUTE 'CREATE POLICY anon_read_${t} ON ${t} FOR SELECT TO anon USING (true)';
      END IF;
    END $$;`
  ).join('\n');

  // Use the Supabase SQL endpoint
  const resp = await fetch(
    `${process.env.NEXT_PUBLIC_SUPABASE_URL}/rest/v1/rpc/exec_sql`,
    {
      method: 'POST',
      headers: {
        'apikey': process.env.SUPABASE_SERVICE_ROLE_KEY!,
        'Authorization': `Bearer ${process.env.SUPABASE_SERVICE_ROLE_KEY!}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ sql }),
    }
  );

  if (!resp.ok) {
    console.log('exec_sql not available, trying alternative...');

    // Alternative: Use the pg_graphql or direct database connection
    // Let's try creating the function first
    const createFn = `
      CREATE OR REPLACE FUNCTION exec_sql(sql text) RETURNS void AS $$
      BEGIN EXECUTE sql; END;
      $$ LANGUAGE plpgsql SECURITY DEFINER;
    `;

    // We can't create functions through PostgREST...
    // Let's use the Supabase Management API instead
    const mgmtUrl = `https://api.supabase.com/v1/projects/${projectRef}/database/query`;

    // Check if we have an access token
    const accessToken = process.env.SUPABASE_ACCESS_TOKEN;
    if (!accessToken) {
      console.log('No SUPABASE_ACCESS_TOKEN found.');
      console.log('Please run this SQL in the Supabase Dashboard SQL Editor:');
      console.log('');
      for (const t of tables) {
        console.log(`CREATE POLICY "anon_read_${t}" ON ${t} FOR SELECT TO anon USING (true);`);
      }
      return;
    }

    const mgmtResp = await fetch(mgmtUrl, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ query: sql }),
    });

    if (mgmtResp.ok) {
      console.log('Policies created successfully via Management API!');
    } else {
      console.log('Management API error:', mgmtResp.status, await mgmtResp.text());
    }
  } else {
    console.log('Policies created successfully!');
  }
}

main().catch(e => { console.error(e); process.exit(1); });
