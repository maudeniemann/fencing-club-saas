'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useClub } from '@/providers/club-provider';
import { format } from 'date-fns';
import type { ClubMember, CoachPayout } from '@/types';
import type { PayoutPreview } from '@/types';

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
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';

const payoutStatusColors: Record<string, string> = {
  pending: 'bg-yellow-100 text-yellow-800 border-yellow-200',
  approved: 'bg-blue-100 text-blue-800 border-blue-200',
  paid: 'bg-green-100 text-green-800 border-green-200',
  failed: 'bg-red-100 text-red-800 border-red-200',
};

export default function PayoutsPage() {
  const { club } = useClub();
  const queryClient = useQueryClient();

  const [selectedCoach, setSelectedCoach] = useState<string | null>(null);
  const [periodStart, setPeriodStart] = useState('');
  const [periodEnd, setPeriodEnd] = useState('');
  const [preview, setPreview] = useState<PayoutPreview | null>(null);

  // Fetch coaches
  const { data: coaches, isLoading: coachesLoading } = useQuery({
    queryKey: ['coaches', club?.id],
    queryFn: async () => {
      if (!club) return [];
      const res = await fetch('/api/members?role=coach');
      if (!res.ok) throw new Error('Failed to fetch coaches');
      return res.json() as Promise<ClubMember[]>;
    },
    enabled: !!club,
  });

  // Fetch payout history
  const { data: payouts, isLoading: payoutsLoading } = useQuery({
    queryKey: ['payouts', club?.id],
    queryFn: async () => {
      if (!club) return [];
      const res = await fetch('/api/coach-payouts');
      if (!res.ok) throw new Error('Failed to fetch payouts');
      return res.json() as Promise<(CoachPayout & { coach: { display_name: string | null } })[]>;
    },
    enabled: !!club,
  });

  // Calculate payout preview
  const previewMutation = useMutation({
    mutationFn: async (coachMemberId: string) => {
      const params = new URLSearchParams({
        coach_member_id: coachMemberId,
        period_start: periodStart,
        period_end: periodEnd,
      });
      const res = await fetch(`/api/coach-payouts/preview?${params}`);
      if (!res.ok) throw new Error('Failed to calculate payout preview');
      return res.json() as Promise<PayoutPreview>;
    },
    onSuccess: (data) => {
      setPreview(data);
    },
  });

  // Approve payout
  const approveMutation = useMutation({
    mutationFn: async () => {
      if (!preview || !selectedCoach) return;
      const res = await fetch('/api/coach-payouts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          coach_member_id: selectedCoach,
          period_start: periodStart,
          period_end: periodEnd,
        }),
      });
      if (!res.ok) throw new Error('Failed to approve payout');
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['payouts', club?.id] });
      setPreview(null);
      setSelectedCoach(null);
      setPeriodStart('');
      setPeriodEnd('');
    },
  });

  const handleCalculate = (coachId: string) => {
    if (!periodStart || !periodEnd) return;
    setSelectedCoach(coachId);
    previewMutation.mutate(coachId);
  };

  const isLoading = coachesLoading || payoutsLoading;

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <p className="text-muted-foreground">Loading payouts...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Coach Payouts</h1>
        <p className="text-muted-foreground">
          Calculate and manage coach commission payouts.
        </p>
      </div>

      {/* Period Selection */}
      <Card>
        <CardHeader>
          <CardTitle>Payout Period</CardTitle>
          <CardDescription>
            Select the period to calculate payouts for.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-end gap-4">
            <div className="space-y-2">
              <Label htmlFor="period-start">Period Start</Label>
              <Input
                id="period-start"
                type="date"
                value={periodStart}
                onChange={(e) => setPeriodStart(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="period-end">Period End</Label>
              <Input
                id="period-end"
                type="date"
                value={periodEnd}
                onChange={(e) => setPeriodEnd(e.target.value)}
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Coaches List */}
      {!coaches || coaches.length === 0 ? (
        <Card>
          <CardContent className="flex items-center justify-center py-12">
            <p className="text-muted-foreground">No coaches found.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {coaches.map((coach) => (
            <Card key={coach.id}>
              <CardHeader className="pb-3">
                <CardTitle className="text-lg">
                  {coach.display_name ?? 'Unnamed Coach'}
                </CardTitle>
                <CardDescription>
                  Commission Rate: {((coach.commission_rate ?? 0) * 100).toFixed(0)}%
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Button
                  size="sm"
                  onClick={() => handleCalculate(coach.id)}
                  disabled={
                    !periodStart ||
                    !periodEnd ||
                    previewMutation.isPending
                  }
                >
                  {previewMutation.isPending && selectedCoach === coach.id
                    ? 'Calculating...'
                    : 'Calculate Payout'}
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Payout Preview */}
      {preview && (
        <>
          <Separator />
          <Card>
            <CardHeader>
              <CardTitle>Payout Preview</CardTitle>
              <CardDescription>
                {preview.coach_name} | {preview.period_start} to{' '}
                {preview.period_end}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
                <div>
                  <p className="text-sm text-muted-foreground">Total Lessons</p>
                  <p className="text-2xl font-bold">{preview.total_lessons}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Total Revenue</p>
                  <p className="text-2xl font-bold">
                    ${(preview.total_revenue_cents / 100).toFixed(2)}
                  </p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Commission Rate</p>
                  <p className="text-2xl font-bold">
                    {(preview.commission_rate * 100).toFixed(0)}%
                  </p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Coach Amount</p>
                  <p className="text-2xl font-bold text-green-600">
                    ${(preview.coach_amount_cents / 100).toFixed(2)}
                  </p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Club Retained</p>
                  <p className="text-2xl font-bold">
                    ${(preview.club_retained_cents / 100).toFixed(2)}
                  </p>
                </div>
              </div>
              <Button
                onClick={() => approveMutation.mutate()}
                disabled={approveMutation.isPending}
              >
                {approveMutation.isPending ? 'Approving...' : 'Approve Payout'}
              </Button>
            </CardContent>
          </Card>
        </>
      )}

      <Separator />

      {/* Payout History */}
      <div>
        <h2 className="text-xl font-semibold mb-4">Payout History</h2>
        {!payouts || payouts.length === 0 ? (
          <Card>
            <CardContent className="flex items-center justify-center py-12">
              <p className="text-muted-foreground">No payout history yet.</p>
            </CardContent>
          </Card>
        ) : (
          <Card>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Period</TableHead>
                    <TableHead>Coach</TableHead>
                    <TableHead>Amount</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Paid Date</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {payouts.map((payout) => (
                    <TableRow key={payout.id}>
                      <TableCell>
                        {format(new Date(payout.period_start), 'MMM d')} -{' '}
                        {format(new Date(payout.period_end), 'MMM d, yyyy')}
                      </TableCell>
                      <TableCell>
                        {payout.coach?.display_name ?? 'Unknown'}
                      </TableCell>
                      <TableCell className="font-medium">
                        ${(payout.coach_payout_cents / 100).toFixed(2)}
                      </TableCell>
                      <TableCell>
                        <Badge
                          variant="outline"
                          className={payoutStatusColors[payout.status] ?? ''}
                        >
                          {payout.status}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {payout.paid_at
                          ? format(new Date(payout.paid_at), 'MMM d, yyyy')
                          : '-'}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
