import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { createRefund } from '@/lib/stripe/payments';
import { z } from 'zod';

const resolveDisputeSchema = z.object({
  status: z.enum(['resolved_for_player', 'resolved_for_club', 'dismissed']),
  resolution_notes: z.string().optional(),
  refund_amount_cents: z.number().min(0).optional(),
});

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: disputeId } = await params;
  const supabase = await createClient();
  const admin = createAdminClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  // Admin only
  const { data: member } = await supabase
    .from('club_members')
    .select('id, club_id, role')
    .eq('user_id', user.id)
    .single();

  if (!member || member.role !== 'admin') {
    return NextResponse.json({ error: 'Admin access required' }, { status: 403 });
  }

  const body = await request.json();
  const parsed = resolveDisputeSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });

  const { data: dispute } = await admin
    .from('disputes')
    .select('*, payments(*)')
    .eq('id', disputeId)
    .single();

  if (!dispute) return NextResponse.json({ error: 'Dispute not found' }, { status: 404 });

  // Process refund if resolved for player
  if (parsed.data.status === 'resolved_for_player' && dispute.payments?.stripe_payment_intent_id) {
    const refundAmount = parsed.data.refund_amount_cents || dispute.payments.amount_cents;
    try {
      await createRefund(
        dispute.payments.stripe_payment_intent_id,
        refundAmount,
        `Dispute resolved for player: ${parsed.data.resolution_notes || ''}`
      );
    } catch (err) {
      return NextResponse.json(
        { error: 'Refund failed: ' + (err instanceof Error ? err.message : 'Unknown') },
        { status: 500 }
      );
    }
  }

  // Update dispute
  await admin.from('disputes').update({
    status: parsed.data.status,
    resolution_notes: parsed.data.resolution_notes || null,
    refund_amount_cents: parsed.data.refund_amount_cents || 0,
    resolved_by: user.id,
    resolved_at: new Date().toISOString(),
  }).eq('id', disputeId);

  // Notify the filer
  await admin.from('notifications').insert({
    club_id: dispute.club_id,
    recipient_member_id: dispute.filed_by_member_id,
    type: 'dispute_resolved',
    title: 'Dispute Resolved',
    body: parsed.data.status === 'resolved_for_player'
      ? 'Your dispute has been resolved in your favor. A refund is being processed.'
      : 'Your dispute has been reviewed and resolved.',
    data: { dispute_id: disputeId },
  });

  return NextResponse.json({ success: true });
}
