import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { cascadeToNext } from '@/lib/waitlist/cascade';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: entryId } = await params;
  const supabase = await createClient();
  const admin = createAdminClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { data: entry } = await admin
    .from('waitlist_entries')
    .select('*')
    .eq('id', entryId)
    .single();

  if (!entry) return NextResponse.json({ error: 'Entry not found' }, { status: 404 });
  if (entry.status !== 'notified') {
    return NextResponse.json({ error: 'Cannot decline this entry' }, { status: 400 });
  }

  await admin.from('waitlist_entries').update({
    status: 'declined',
    responded_at: new Date().toISOString(),
  }).eq('id', entryId);

  // Cascade to next candidate
  await cascadeToNext(entryId, admin);

  return NextResponse.json({ success: true });
}
