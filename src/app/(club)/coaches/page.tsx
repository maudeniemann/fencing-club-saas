'use client';

import { useClub } from '@/providers/club-provider';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'next/navigation';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import { Star } from 'lucide-react';

export default function CoachesPage() {
  const { club, currentMember, role, isLoading: clubLoading, refetch } = useClub();
  const router = useRouter();
  const queryClient = useQueryClient();

  const { data: coaches = [], isLoading: coachesLoading } = useQuery({
    queryKey: ['coaches', club?.id],
    queryFn: async () => {
      if (!club) return [];
      const response = await fetch('/api/members?role=coach');
      if (!response.ok) throw new Error('Failed to fetch coaches');
      return response.json();
    },
    enabled: !!club,
  });

  const toggleFavoriteMutation = useMutation({
    mutationFn: async (coachId: string) => {
      const newFavoriteId = currentMember?.favorite_coach_id === coachId ? null : coachId;
      const response = await fetch('/api/members/favorite-coach', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ coach_id: newFavoriteId }),
      });
      if (!response.ok) throw new Error('Failed to update favorite coach');
      return response.json();
    },
    onSuccess: () => {
      refetch();
      toast.success('Favorite coach updated');
    },
    onError: (error) => {
      toast.error(error instanceof Error ? error.message : 'Failed to update favorite');
    },
  });

  if (clubLoading || coachesLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-muted-foreground">Loading coaches...</div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Coaches</h1>
        <p className="text-muted-foreground">
          Meet our coaching staff
        </p>
      </div>

      {coaches.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground">
            No coaches found for this club.
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {coaches.map((coach: Record<string, unknown>) => {
            const initials = (coach.display_name as string || '?')
              .split(' ')
              .map((n: string) => n[0])
              .join('')
              .toUpperCase()
              .slice(0, 2);
            const specialties = (coach.specialties as string[] | null) || [];
            const bio = coach.bio as string | null;
            const truncatedBio =
              bio && bio.length > 120 ? bio.slice(0, 120) + '...' : bio;

            return (
              <Card key={coach.id as string} className="flex flex-col">
                <CardHeader className="flex-row items-center gap-3">
                  {coach.avatar_url ? (
                    <img
                      src={coach.avatar_url as string}
                      alt={coach.display_name as string}
                      className="w-12 h-12 rounded-full object-cover"
                    />
                  ) : (
                    <div className="flex items-center justify-center w-12 h-12 rounded-full bg-primary text-primary-foreground font-semibold text-sm">
                      {initials}
                    </div>
                  )}
                  <div className="flex-1 min-w-0">
                    <CardTitle className="text-base truncate">
                      {(coach.display_name as string) || 'Coach'}
                    </CardTitle>
                    {coach.phone ? (
                      <CardDescription className="truncate">
                        {coach.phone as string}
                      </CardDescription>
                    ) : null}
                  </div>
                </CardHeader>
                <CardContent className="flex-1 space-y-3">
                  {truncatedBio && (
                    <p className="text-sm text-muted-foreground">{truncatedBio}</p>
                  )}
                  {specialties.length > 0 && (
                    <div className="flex flex-wrap gap-1">
                      {specialties.map((specialty: string) => (
                        <Badge key={specialty} variant="outline" className="text-xs">
                          {specialty}
                        </Badge>
                      ))}
                    </div>
                  )}
                  {specialties.length === 0 && !truncatedBio && (
                    <p className="text-sm text-muted-foreground italic">
                      No additional details available.
                    </p>
                  )}

                  <div className="flex gap-2 pt-2">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => router.push(`/coaches/${coach.id}`)}
                    >
                      Profile
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      className="flex-1"
                      onClick={() => router.push(`/coaches/${coach.id}/availability`)}
                    >
                      View Availability
                    </Button>
                    {role === 'player' && (
                      <Button
                        size="sm"
                        variant={currentMember?.favorite_coach_id === coach.id ? 'default' : 'outline'}
                        onClick={() => toggleFavoriteMutation.mutate(coach.id as string)}
                        disabled={toggleFavoriteMutation.isPending}
                      >
                        <Star className={`h-4 w-4 ${currentMember?.favorite_coach_id === coach.id ? 'fill-current' : ''}`} />
                      </Button>
                    )}
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
