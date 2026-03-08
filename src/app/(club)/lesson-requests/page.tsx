'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { format } from 'date-fns';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';

interface LessonRequest {
  id: string;
  coach_member_id: string;
  lesson_type_id: string;
  desired_date: string;
  desired_start_time: string | null;
  desired_end_time: string | null;
  player_member_id: string;
  status: string;
  is_new_time_request: boolean;
  request_notes: string | null;
  priority_score: number;
  created_at: string;
  player: {
    id: string;
    display_name: string;
    avatar_url: string | null;
    phone: string | null;
  };
  lesson_type: {
    id: string;
    name: string;
    duration_minutes: number;
    price_cents: number;
    category: string;
  };
}

export default function LessonRequestsPage() {
  const queryClient = useQueryClient();
  const [selectedRequest, setSelectedRequest] = useState<string | null>(null);
  const [rejectReason, setRejectReason] = useState('');

  const { data: requests, isLoading } = useQuery({
    queryKey: ['lesson-requests'],
    queryFn: async () => {
      const res = await fetch('/api/coaches/lesson-requests');
      if (!res.ok) throw new Error('Failed to fetch requests');
      return res.json() as Promise<LessonRequest[]>;
    },
  });

  const approveMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`/api/waitlist/${id}/approve`, {
        method: 'POST',
      });
      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error || 'Failed to approve');
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['lesson-requests'] });
      toast.success('Request approved');
    },
    onError: (error) => {
      toast.error(error instanceof Error ? error.message : 'Failed to approve');
    },
  });

  const rejectMutation = useMutation({
    mutationFn: async ({ id, reason }: { id: string; reason?: string }) => {
      const res = await fetch(`/api/waitlist/${id}/reject`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reason }),
      });
      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error || 'Failed to reject');
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['lesson-requests'] });
      setSelectedRequest(null);
      setRejectReason('');
      toast.success('Request declined');
    },
    onError: (error) => {
      toast.error(error instanceof Error ? error.message : 'Failed to reject');
    },
  });

  const handleApprove = (id: string) => {
    approveMutation.mutate(id);
  };

  const handleReject = (id: string) => {
    if (selectedRequest === id) {
      rejectMutation.mutate({ id, reason: rejectReason || undefined });
    } else {
      setSelectedRequest(id);
    }
  };

  const waitlistRequests = requests?.filter(r => !r.is_new_time_request) || [];
  const newTimeRequests = requests?.filter(r => r.is_new_time_request) || [];

  const RequestCard = ({ request }: { request: LessonRequest }) => {
    const isRejecting = selectedRequest === request.id;
    const initials = request.player.display_name
      ?.split(' ')
      .map(n => n[0])
      .join('')
      .toUpperCase() || '??';

    return (
      <Card>
        <CardHeader>
          <div className="flex items-start justify-between">
            <div className="flex items-center gap-3">
              <Avatar>
                <AvatarImage src={request.player.avatar_url || undefined} />
                <AvatarFallback>{initials}</AvatarFallback>
              </Avatar>
              <div>
                <CardTitle className="text-base">
                  {request.player.display_name}
                </CardTitle>
                <CardDescription className="text-sm">
                  {request.lesson_type.name} • {request.lesson_type.duration_minutes} min
                </CardDescription>
              </div>
            </div>
            <Badge variant={request.is_new_time_request ? 'default' : 'secondary'}>
              {request.is_new_time_request ? 'New Time Request' : 'Waitlist'}
            </Badge>
          </div>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="text-sm">
            <span className="font-medium">Desired Date:</span>{' '}
            {format(new Date(request.desired_date), 'PPP')}
            {request.desired_start_time && (
              <>
                {' • '}
                <span className="font-medium">Time:</span>{' '}
                {request.desired_start_time}
                {request.desired_end_time && ` - ${request.desired_end_time}`}
              </>
            )}
          </div>

          {request.request_notes && (
            <div className="rounded-md bg-muted p-3 text-sm">
              <div className="font-medium mb-1">Notes:</div>
              <div className="text-muted-foreground">{request.request_notes}</div>
            </div>
          )}

          {request.player.phone && (
            <div className="text-sm text-muted-foreground">
              📞 {request.player.phone}
            </div>
          )}

          {!isRejecting && (
            <div className="flex gap-2 pt-2">
              <Button
                size="sm"
                onClick={() => handleApprove(request.id)}
                disabled={approveMutation.isPending}
              >
                {approveMutation.isPending ? 'Approving...' : 'Approve'}
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={() => handleReject(request.id)}
                disabled={rejectMutation.isPending}
              >
                Decline
              </Button>
            </div>
          )}

          {isRejecting && (
            <div className="space-y-2 pt-2">
              <Label htmlFor="reject-reason">Reason (optional)</Label>
              <Textarea
                id="reject-reason"
                value={rejectReason}
                onChange={(e) => setRejectReason(e.target.value)}
                placeholder="Let the athlete know why..."
                rows={3}
              />
              <div className="flex gap-2">
                <Button
                  size="sm"
                  variant="destructive"
                  onClick={() => handleReject(request.id)}
                  disabled={rejectMutation.isPending}
                >
                  {rejectMutation.isPending ? 'Declining...' : 'Confirm Decline'}
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => {
                    setSelectedRequest(null);
                    setRejectReason('');
                  }}
                >
                  Cancel
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    );
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-muted-foreground">Loading...</div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Lesson Requests</h1>
        <p className="text-muted-foreground">
          Manage waitlist entries and new time slot requests
        </p>
      </div>

      <Tabs defaultValue="all" className="w-full">
        <TabsList>
          <TabsTrigger value="all">
            All ({requests?.length || 0})
          </TabsTrigger>
          <TabsTrigger value="waitlist">
            Waitlist ({waitlistRequests.length})
          </TabsTrigger>
          <TabsTrigger value="new-time">
            New Time Requests ({newTimeRequests.length})
          </TabsTrigger>
        </TabsList>

        <TabsContent value="all" className="space-y-4 mt-6">
          {requests && requests.length > 0 ? (
            requests.map((request) => (
              <RequestCard key={request.id} request={request} />
            ))
          ) : (
            <Card>
              <CardContent className="flex items-center justify-center h-32">
                <p className="text-muted-foreground">No pending requests</p>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="waitlist" className="space-y-4 mt-6">
          {waitlistRequests.length > 0 ? (
            waitlistRequests.map((request) => (
              <RequestCard key={request.id} request={request} />
            ))
          ) : (
            <Card>
              <CardContent className="flex items-center justify-center h-32">
                <p className="text-muted-foreground">No waitlist entries</p>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="new-time" className="space-y-4 mt-6">
          {newTimeRequests.length > 0 ? (
            newTimeRequests.map((request) => (
              <RequestCard key={request.id} request={request} />
            ))
          ) : (
            <Card>
              <CardContent className="flex items-center justify-center h-32">
                <p className="text-muted-foreground">No new time requests</p>
              </CardContent>
            </Card>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
