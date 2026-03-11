'use client';

import { use, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { format } from 'date-fns';
import { toast } from 'sonner';
import Link from 'next/link';

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { Separator } from '@/components/ui/separator';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

const statusBadgeColors: Record<string, string> = {
  open: 'bg-red-100 text-red-800 border-red-200',
  under_review: 'bg-yellow-100 text-yellow-800 border-yellow-200',
  resolved_for_player: 'bg-green-100 text-green-800 border-green-200',
  resolved_for_club: 'bg-blue-100 text-blue-800 border-blue-200',
  dismissed: 'bg-gray-100 text-gray-800 border-gray-200',
};

const statusLabels: Record<string, string> = {
  open: 'Open',
  under_review: 'Under Review',
  resolved_for_player: 'Resolved for Player',
  resolved_for_club: 'Resolved for Club',
  dismissed: 'Dismissed',
};

export default function DisputeDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id: disputeId } = use(params);
  const router = useRouter();
  const queryClient = useQueryClient();

  const [resolutionStatus, setResolutionStatus] = useState('');
  const [resolutionNotes, setResolutionNotes] = useState('');
  const [refundDollars, setRefundDollars] = useState('');

  const { data: dispute, isLoading } = useQuery({
    queryKey: ['dispute', disputeId],
    queryFn: async () => {
      const res = await fetch(`/api/disputes/${disputeId}`);
      if (!res.ok) throw new Error('Dispute not found');
      return res.json();
    },
  });

  const resolveMutation = useMutation({
    mutationFn: async () => {
      const refundCents = refundDollars
        ? Math.round(parseFloat(refundDollars) * 100)
        : 0;
      const res = await fetch(`/api/disputes/${disputeId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          status: resolutionStatus,
          resolution_notes: resolutionNotes || null,
          refund_amount_cents: refundCents,
        }),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || 'Failed to resolve');
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['dispute', disputeId] });
      queryClient.invalidateQueries({ queryKey: ['disputes'] });
      toast.success('Dispute resolved');
      setResolutionStatus('');
      setResolutionNotes('');
      setRefundDollars('');
    },
    onError: (err) => {
      toast.error(err instanceof Error ? err.message : 'Failed to resolve');
    },
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-muted-foreground">Loading dispute...</div>
      </div>
    );
  }

  if (!dispute) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-muted-foreground">Dispute not found.</div>
      </div>
    );
  }

  const booking = dispute.bookings;
  const payment = dispute.payments;
  const filedBy = dispute.filed_by;
  const status = dispute.status as string;
  const isOpen = status === 'open' || status === 'under_review';

  const filerInitials = ((filedBy?.display_name as string) || '?')
    .split(' ')
    .map((n: string) => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => router.back()}
          className="mb-2"
        >
          &larr; Back to Disputes
        </Button>
        <div className="flex items-center gap-3 flex-wrap">
          <h1 className="text-2xl font-bold">Dispute</h1>
          <Badge
            variant="outline"
            className={statusBadgeColors[status] || ''}
          >
            {statusLabels[status] || status}
          </Badge>
        </div>
        <p className="text-muted-foreground">
          Filed on {format(new Date(dispute.created_at), 'MMMM d, yyyy')}
        </p>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Reason & Evidence */}
        <Card>
          <CardHeader>
            <CardTitle>Dispute Details</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Label className="text-sm font-medium">Reason</Label>
              <p className="text-sm mt-1 whitespace-pre-wrap">
                {dispute.reason}
              </p>
            </div>

            {dispute.evidence_urls && dispute.evidence_urls.length > 0 && (
              <div>
                <Label className="text-sm font-medium">Evidence</Label>
                <ul className="mt-1 space-y-1">
                  {dispute.evidence_urls.map(
                    (url: string, idx: number) => (
                      <li key={idx}>
                        <a
                          href={url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-sm text-primary hover:underline"
                        >
                          Evidence {idx + 1}
                        </a>
                      </li>
                    )
                  )}
                </ul>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Filed By */}
        <Card>
          <CardHeader>
            <CardTitle>Filed By</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-4">
              <Avatar className="h-12 w-12">
                <AvatarImage
                  src={filedBy?.avatar_url || undefined}
                />
                <AvatarFallback>{filerInitials}</AvatarFallback>
              </Avatar>
              <div>
                <div className="font-semibold">
                  {filedBy?.display_name || 'Unknown'}
                </div>
                <div className="text-sm text-muted-foreground capitalize">
                  {filedBy?.role || 'Member'}
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Related Booking */}
        {booking && (
          <Card>
            <CardHeader>
              <CardTitle>Related Booking</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <div className="text-muted-foreground">Booking #</div>
                  <div className="font-medium">
                    {booking.booking_number || dispute.booking_id.slice(0, 8)}
                  </div>
                </div>
                <div>
                  <div className="text-muted-foreground">Status</div>
                  <div className="font-medium capitalize">
                    {(booking.status as string).replace('_', ' ')}
                  </div>
                </div>
                <div>
                  <div className="text-muted-foreground">Date</div>
                  <div className="font-medium">
                    {format(
                      new Date(booking.starts_at),
                      'MMM d, yyyy h:mm a'
                    )}
                  </div>
                </div>
                {booking.lesson_types && (
                  <div>
                    <div className="text-muted-foreground">Lesson Type</div>
                    <div className="font-medium">
                      {booking.lesson_types.name}
                    </div>
                  </div>
                )}
              </div>
              <Link href={`/bookings/${dispute.booking_id}`}>
                <Button variant="outline" size="sm" className="mt-2">
                  View Booking
                </Button>
              </Link>
            </CardContent>
          </Card>
        )}

        {/* Payment Info */}
        {payment && (
          <Card>
            <CardHeader>
              <CardTitle>Payment</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Amount</span>
                <span className="font-semibold">
                  ${((payment.amount_cents as number) / 100).toFixed(2)}{' '}
                  {(payment.currency as string)?.toUpperCase() || 'USD'}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Status</span>
                <Badge variant="outline">{payment.status as string}</Badge>
              </div>
            </CardContent>
          </Card>
        )}
      </div>

      {/* Resolution */}
      {dispute.resolution_notes && (
        <>
          <Separator />
          <Card>
            <CardHeader>
              <CardTitle>Resolution</CardTitle>
              <CardDescription>
                Resolved on{' '}
                {dispute.resolved_at
                  ? format(new Date(dispute.resolved_at), 'MMM d, yyyy')
                  : 'Unknown'}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-2">
              <p className="text-sm">{dispute.resolution_notes}</p>
              {dispute.refund_amount_cents > 0 && (
                <p className="text-sm text-muted-foreground">
                  Refund: ${(dispute.refund_amount_cents / 100).toFixed(2)}
                </p>
              )}
            </CardContent>
          </Card>
        </>
      )}

      {/* Resolve Form (for open disputes) */}
      {isOpen && (
        <>
          <Separator />
          <Card>
            <CardHeader>
              <CardTitle>Resolve Dispute</CardTitle>
              <CardDescription>
                Choose a resolution and optionally issue a refund.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label>Resolution</Label>
                <Select
                  value={resolutionStatus}
                  onValueChange={setResolutionStatus}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select resolution" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="resolved_for_player">
                      Resolved for Player
                    </SelectItem>
                    <SelectItem value="resolved_for_club">
                      Resolved for Club
                    </SelectItem>
                    <SelectItem value="dismissed">Dismissed</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Notes</Label>
                <Textarea
                  placeholder="Explain the resolution..."
                  value={resolutionNotes}
                  onChange={(e) => setResolutionNotes(e.target.value)}
                />
              </div>
              {resolutionStatus === 'resolved_for_player' && payment && (
                <div className="space-y-2">
                  <Label>Refund Amount ($)</Label>
                  <Input
                    type="number"
                    min="0"
                    step="0.01"
                    max={((payment.amount_cents as number) / 100).toFixed(2)}
                    placeholder={`Max: $${((payment.amount_cents as number) / 100).toFixed(2)}`}
                    value={refundDollars}
                    onChange={(e) => setRefundDollars(e.target.value)}
                  />
                </div>
              )}
              <Button
                onClick={() => resolveMutation.mutate()}
                disabled={!resolutionStatus || resolveMutation.isPending}
                className="w-full"
              >
                {resolveMutation.isPending
                  ? 'Resolving...'
                  : 'Confirm Resolution'}
              </Button>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}
