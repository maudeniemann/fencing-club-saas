'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useClub } from '@/providers/club-provider';
import type { Venue } from '@/types';

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';

export default function VenuesPage() {
  const { club } = useClub();
  const queryClient = useQueryClient();

  const [newVenueName, setNewVenueName] = useState('');
  const [newVenueAddress, setNewVenueAddress] = useState('');

  const {
    data: venues,
    isLoading,
  } = useQuery({
    queryKey: ['venues', club?.id],
    queryFn: async () => {
      if (!club) return [];
      const res = await fetch('/api/venues');
      if (!res.ok) throw new Error('Failed to fetch venues');
      const data = await res.json();
      return data as Venue[];
    },
    enabled: !!club,
  });

  const addVenueMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch('/api/venues', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: newVenueName,
          address: newVenueAddress,
        }),
      });
      if (!res.ok) throw new Error('Failed to add venue');
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['venues', club?.id] });
      setNewVenueName('');
      setNewVenueAddress('');
    },
  });

  const handleAddVenue = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newVenueName.trim()) return;
    addVenueMutation.mutate();
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <p className="text-muted-foreground">Loading venues...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">Venues</h1>
        <p className="text-muted-foreground">
          Manage your club venues.
        </p>
      </div>

      {/* Add Venue Form */}
      <Card>
        <CardHeader>
          <CardTitle>Add Venue</CardTitle>
          <CardDescription>
            Create a new venue for your club.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleAddVenue} className="flex flex-col sm:flex-row sm:items-end gap-4">
            <div className="space-y-2 flex-1">
              <Label htmlFor="venue-name">Venue Name</Label>
              <Input
                id="venue-name"
                placeholder="e.g. Main Hall"
                value={newVenueName}
                onChange={(e) => setNewVenueName(e.target.value)}
              />
            </div>
            <div className="space-y-2 flex-1">
              <Label htmlFor="venue-address">Address</Label>
              <Input
                id="venue-address"
                placeholder="e.g. 123 Main St"
                value={newVenueAddress}
                onChange={(e) => setNewVenueAddress(e.target.value)}
              />
            </div>
            <Button
              type="submit"
              disabled={!newVenueName.trim() || addVenueMutation.isPending}
              className="w-full sm:w-auto"
            >
              {addVenueMutation.isPending ? 'Adding...' : 'Add Venue'}
            </Button>
          </form>
        </CardContent>
      </Card>

      <Separator />

      {/* Venues List */}
      {!venues || venues.length === 0 ? (
        <Card>
          <CardContent className="flex items-center justify-center py-12">
            <p className="text-muted-foreground">
              No venues yet. Add your first venue above.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4">
          {venues.map((venue) => (
            <Card key={venue.id}>
              <CardHeader>
                <CardTitle>{venue.name}</CardTitle>
                <CardDescription>
                  {venue.address || 'No address provided'}
                </CardDescription>
              </CardHeader>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
