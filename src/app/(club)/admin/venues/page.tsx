'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { createClient } from '@/lib/supabase/client';
import { useClub } from '@/providers/club-provider';
import type { Venue, Strip } from '@/types';

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

interface VenueWithStrips extends Venue {
  strips: Strip[];
}

export default function VenuesPage() {
  const { club } = useClub();
  const queryClient = useQueryClient();

  const [newVenueName, setNewVenueName] = useState('');
  const [newVenueAddress, setNewVenueAddress] = useState('');
  const [newStripNames, setNewStripNames] = useState<Record<string, string>>({});

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
      return data as VenueWithStrips[];
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

  const addStripMutation = useMutation({
    mutationFn: async ({ venueId, name }: { venueId: string; name: string }) => {
      const supabase = createClient();
      const { data, error } = await supabase
        .from('strips')
        .insert({
          club_id: club!.id,
          venue_id: venueId,
          name,
          sort_order: 0,
          is_active: true,
        })
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['venues', club?.id] });
    },
  });

  const handleAddVenue = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newVenueName.trim()) return;
    addVenueMutation.mutate();
  };

  const handleAddStrip = (venueId: string) => {
    const name = newStripNames[venueId]?.trim();
    if (!name) return;
    addStripMutation.mutate({ venueId, name });
    setNewStripNames((prev) => ({ ...prev, [venueId]: '' }));
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
        <h1 className="text-3xl font-bold tracking-tight">Venues & Strips</h1>
        <p className="text-muted-foreground">
          Manage your club venues and fencing strips.
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
          <form onSubmit={handleAddVenue} className="flex items-end gap-4">
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
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle>{venue.name}</CardTitle>
                    <CardDescription>
                      {venue.address || 'No address provided'}
                    </CardDescription>
                  </div>
                  <Badge variant="outline">
                    {venue.strips?.length ?? 0} strip{(venue.strips?.length ?? 0) !== 1 ? 's' : ''}
                  </Badge>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                {/* Strips List */}
                {venue.strips && venue.strips.length > 0 ? (
                  <div className="space-y-2">
                    <Label className="text-sm font-medium">Strips</Label>
                    <ul className="space-y-1">
                      {venue.strips.map((strip) => (
                        <li
                          key={strip.id}
                          className="flex items-center gap-2 text-sm px-3 py-2 bg-muted rounded-md"
                        >
                          <span>{strip.name}</span>
                          <Badge
                            variant={strip.is_active ? 'default' : 'secondary'}
                            className="ml-auto text-xs"
                          >
                            {strip.is_active ? 'Active' : 'Inactive'}
                          </Badge>
                        </li>
                      ))}
                    </ul>
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground">
                    No strips added yet.
                  </p>
                )}

                {/* Add Strip Form */}
                <div className="flex items-end gap-2 pt-2 border-t">
                  <div className="space-y-1 flex-1">
                    <Label className="text-xs">Add Strip</Label>
                    <Input
                      placeholder="e.g. Strip 1"
                      value={newStripNames[venue.id] ?? ''}
                      onChange={(e) =>
                        setNewStripNames((prev) => ({
                          ...prev,
                          [venue.id]: e.target.value,
                        }))
                      }
                    />
                  </div>
                  <Button
                    size="sm"
                    onClick={() => handleAddStrip(venue.id)}
                    disabled={
                      !newStripNames[venue.id]?.trim() ||
                      addStripMutation.isPending
                    }
                  >
                    {addStripMutation.isPending ? 'Adding...' : 'Add Strip'}
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
