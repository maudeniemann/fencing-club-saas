'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useClub } from '@/providers/club-provider';
import { format } from 'date-fns';
import type { DisputeStatus } from '@/types';

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { Textarea } from '@/components/ui/textarea';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

interface DisputeWithRelations {
  id: string;
  club_id: string;
  booking_id: string;
  payment_id: string | null;
  filed_by_member_id: string;
  reason: string;
  evidence_urls: string[] | null;
  status: DisputeStatus;
  resolved_by: string | null;
  resolved_at: string | null;
  resolution_notes: string | null;
  refund_amount_cents: number;
  created_at: string;
  updated_at: string;
  bookings: {
    booking_number: string;
    starts_at: string;
  } | null;
  filed_by: {
    display_name: string | null;
  } | null;
}

const statusBadgeColors: Record<DisputeStatus, string> = {
  open: 'bg-red-100 text-red-800 border-red-200',
  under_review: 'bg-yellow-100 text-yellow-800 border-yellow-200',
  resolved_for_player: 'bg-green-100 text-green-800 border-green-200',
  resolved_for_club: 'bg-blue-100 text-blue-800 border-blue-200',
  dismissed: 'bg-gray-100 text-gray-800 border-gray-200',
};

const statusLabels: Record<DisputeStatus, string> = {
  open: 'Open',
  under_review: 'Under Review',
  resolved_for_player: 'Resolved for Player',
  resolved_for_club: 'Resolved for Club',
  dismissed: 'Dismissed',
};

export default function DisputesPage() {
  const { club } = useClub();
  const queryClient = useQueryClient();

  const [resolvingId, setResolvingId] = useState<string | null>(null);
  const [resolutionStatus, setResolutionStatus] = useState<string>('');
  const [resolutionNotes, setResolutionNotes] = useState('');
  const [refundAmountCents, setRefundAmountCents] = useState('');

  const { data: disputes, isLoading } = useQuery({
    queryKey: ['disputes', club?.id],
    queryFn: async () => {
      if (!club) return [];
      const res = await fetch('/api/disputes');
      if (!res.ok) throw new Error('Failed to fetch disputes');
      return res.json() as Promise<DisputeWithRelations[]>;
    },
    enabled: !!club,
  });

  const resolveMutation = useMutation({
    mutationFn: async (disputeId: string) => {
      const res = await fetch(`/api/disputes/${disputeId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          status: resolutionStatus,
          resolution_notes: resolutionNotes || null,
          refund_amount_cents: refundAmountCents
            ? parseInt(refundAmountCents, 10)
            : 0,
        }),
      });
      if (!res.ok) throw new Error('Failed to resolve dispute');
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['disputes', club?.id] });
      setResolvingId(null);
      setResolutionStatus('');
      setResolutionNotes('');
      setRefundAmountCents('');
    },
  });

  const handleResolve = () => {
    if (!resolvingId || !resolutionStatus) return;
    resolveMutation.mutate(resolvingId);
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <p className="text-muted-foreground">Loading disputes...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Disputes</h1>
        <p className="text-muted-foreground">
          Review and resolve member disputes.
        </p>
      </div>

      {!disputes || disputes.length === 0 ? (
        <Card>
          <CardContent className="flex items-center justify-center py-12">
            <p className="text-muted-foreground">No disputes.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4">
          {disputes.map((dispute) => (
            <Card key={dispute.id}>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle className="text-lg">
                      Booking #{dispute.bookings?.booking_number ?? 'Unknown'}
                    </CardTitle>
                    <CardDescription>
                      Filed by {dispute.filed_by?.display_name ?? 'Unknown'} on{' '}
                      {format(new Date(dispute.created_at), 'MMM d, yyyy')}
                    </CardDescription>
                  </div>
                  <Badge
                    variant="outline"
                    className={statusBadgeColors[dispute.status]}
                  >
                    {statusLabels[dispute.status]}
                  </Badge>
                </div>
              </CardHeader>
              <CardContent className="space-y-3">
                <div>
                  <Label className="text-sm font-medium">Reason</Label>
                  <p className="text-sm mt-1">{dispute.reason}</p>
                </div>

                {dispute.bookings?.starts_at && (
                  <div>
                    <Label className="text-sm font-medium">Booking Date</Label>
                    <p className="text-sm text-muted-foreground mt-1">
                      {format(
                        new Date(dispute.bookings!.starts_at),
                        'MMM d, yyyy h:mm a'
                      )}
                    </p>
                  </div>
                )}

                {dispute.evidence_urls && dispute.evidence_urls.length > 0 && (
                  <div>
                    <Label className="text-sm font-medium">Evidence</Label>
                    <ul className="mt-1 space-y-1">
                      {dispute.evidence_urls.map((url, idx) => (
                        <li key={idx}>
                          <a
                            href={url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-sm text-blue-600 hover:underline"
                          >
                            Evidence {idx + 1}
                          </a>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                {dispute.resolution_notes ? (
                  <div>
                    <Label className="text-sm font-medium">Resolution Notes</Label>
                    <p className="text-sm text-muted-foreground mt-1">
                      {dispute.resolution_notes as string}
                    </p>
                  </div>
                ) : null}

                {dispute.refund_amount_cents > 0 && (
                  <div>
                    <Label className="text-sm font-medium">Refund Amount</Label>
                    <p className="text-sm text-muted-foreground mt-1">
                      ${(dispute.refund_amount_cents / 100).toFixed(2)}
                    </p>
                  </div>
                )}

                {/* Resolve action for open disputes */}
                {(dispute.status === 'open' ||
                  dispute.status === 'under_review') && (
                  <div className="pt-2">
                    <Dialog
                      open={resolvingId === dispute.id}
                      onOpenChange={(open) => {
                        if (!open) {
                          setResolvingId(null);
                          setResolutionStatus('');
                          setResolutionNotes('');
                          setRefundAmountCents('');
                        }
                      }}
                    >
                      <DialogTrigger asChild>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => setResolvingId(dispute.id)}
                        >
                          Resolve
                        </Button>
                      </DialogTrigger>
                      <DialogContent>
                        <DialogHeader>
                          <DialogTitle>Resolve Dispute</DialogTitle>
                          <DialogDescription>
                            Choose a resolution for booking #
                            {dispute.bookings?.booking_number ?? 'Unknown'}.
                          </DialogDescription>
                        </DialogHeader>
                        <div className="space-y-4 py-4">
                          <div className="space-y-2">
                            <Label>Resolution Status</Label>
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
                                <SelectItem value="dismissed">
                                  Dismissed
                                </SelectItem>
                              </SelectContent>
                            </Select>
                          </div>
                          <div className="space-y-2">
                            <Label>Resolution Notes</Label>
                            <Textarea
                              placeholder="Add notes about the resolution..."
                              value={resolutionNotes}
                              onChange={(e) =>
                                setResolutionNotes(e.target.value)
                              }
                            />
                          </div>
                          <div className="space-y-2">
                            <Label>Refund Amount (cents)</Label>
                            <Input
                              type="number"
                              min="0"
                              placeholder="0"
                              value={refundAmountCents}
                              onChange={(e) =>
                                setRefundAmountCents(e.target.value)
                              }
                            />
                            {refundAmountCents && (
                              <p className="text-xs text-muted-foreground">
                                ${(parseInt(refundAmountCents, 10) / 100).toFixed(2)}
                              </p>
                            )}
                          </div>
                          <Separator />
                          <Button
                            onClick={handleResolve}
                            disabled={
                              !resolutionStatus || resolveMutation.isPending
                            }
                            className="w-full"
                          >
                            {resolveMutation.isPending
                              ? 'Resolving...'
                              : 'Confirm Resolution'}
                          </Button>
                        </div>
                      </DialogContent>
                    </Dialog>
                  </div>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
