// Supabase Edge Function: waitlist-deadline-check
// Runs every minute via cron. Expires timed-out waitlist offers
// and cascades to the next candidate.

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const supabase = createClient(
  Deno.env.get('SUPABASE_URL')!,
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
);

Deno.serve(async () => {
  try {
    const now = new Date().toISOString();

    // Find all expired notified entries
    const { data: expired, error } = await supabase
      .from('waitlist_entries')
      .select('*')
      .eq('status', 'notified')
      .lt('accept_deadline', now);

    if (error) throw error;

    let processed = 0;

    for (const entry of expired || []) {
      // Mark as expired
      await supabase
        .from('waitlist_entries')
        .update({ status: 'expired' })
        .eq('id', entry.id);

      // Find next waiting candidate for same coach + date
      const { data: nextCandidates } = await supabase
        .from('waitlist_entries')
        .select('*')
        .eq('club_id', entry.club_id)
        .eq('coach_member_id', entry.coach_member_id)
        .eq('desired_date', entry.desired_date)
        .eq('status', 'waiting')
        .order('priority_score', { ascending: false })
        .limit(1);

      if (nextCandidates?.length) {
        const next = nextCandidates[0];
        const acceptDeadline = new Date(Date.now() + 15 * 60 * 1000);

        // Notify next candidate
        await supabase.from('waitlist_entries').update({
          status: 'notified',
          notified_at: new Date().toISOString(),
          accept_deadline: acceptDeadline.toISOString(),
        }).eq('id', next.id);

        // Create notification
        await supabase.from('notifications').insert({
          club_id: next.club_id,
          recipient_member_id: next.player_member_id,
          type: 'waitlist_offer',
          title: 'A slot opened up!',
          body: `A lesson slot is available. Accept within 15 minutes.`,
          data: {
            waitlist_entry_id: next.id,
            accept_deadline: acceptDeadline.toISOString(),
          },
        });
      }

      processed++;
    }

    return new Response(
      JSON.stringify({ success: true, expired_count: processed }),
      { headers: { 'Content-Type': 'application/json' } }
    );
  } catch (err) {
    console.error('Waitlist deadline check failed:', err);
    return new Response(
      JSON.stringify({ error: (err as Error).message }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
});
