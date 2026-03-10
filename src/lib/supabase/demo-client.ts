import { createAdminClient } from '@/lib/supabase/admin';
import type { SupabaseClient } from '@supabase/supabase-js';

const DEMO_CLUB_ID = 'da1f8770-aabf-49a2-986c-1e4fb45d2651';

/**
 * TEMP: Force demo mode — always returns admin client with Dynamo Fencing club context.
 * Ignores any auth session so the demo always shows the correct club.
 */
export async function getDemoSafeClient(): Promise<{
  client: SupabaseClient;
  user: { id: string } | null;
  member: { id: string; club_id: string; role: string } | null;
}> {
  const admin = createAdminClient();
  const { data: member } = await admin
    .from('club_members')
    .select('id, club_id, role')
    .eq('club_id', DEMO_CLUB_ID)
    .eq('role', 'admin')
    .eq('is_active', true)
    .limit(1)
    .single();

  return { client: admin, user: null, member };
}
