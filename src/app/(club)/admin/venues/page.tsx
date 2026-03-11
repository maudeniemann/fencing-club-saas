'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useClub } from '@/providers/club-provider';
import type { Venue } from '@/types';
import { toast } from 'sonner';

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
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';

interface Strip {
  id: string;
  name: string;
  sort_order: number;
}

export default function VenuesPage() {
  const { club } = useClub();
  const queryClient = useQueryClient();

  const [newVenueName, setNewVenueName] = useState('');
  const [newVenueAddress, setNewVenueAddress] = useState('');

  // Edit dialog state
  const [editVenue, setEditVenue] = useState<Venue | null>(null);
  const [editName, setEditName] = useState('');
  const [editAddress, setEditAddress] = useState('');

  // Strip management state
  const [expandedVenueId, setExpandedVenueId] = useState<string | null>(null);
  const [newStripName, setNewStripName] = useState('');

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

  // Fetch strips for expanded venue
  const { data: strips = [] } = useQuery({
    queryKey: ['strips', expandedVenueId],
    queryFn: async () => {
      const res = await fetch(`/api/venues/${expandedVenueId}/strips`);
      if (!res.ok) return [];
      return (await res.json()) as Strip[];
    },
    enabled: !!expandedVenueId,
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
      toast.success('Venue added');
    },
    onError: () => toast.error('Failed to add venue'),
  });

  const editMutation = useMutation({
    mutationFn: async () => {
      if (!editVenue) throw new Error('No venue selected');
      const res = await fetch(`/api/venues/${editVenue.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: editName, address: editAddress }),
      });
      if (!res.ok) throw new Error('Failed to update venue');
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['venues', club?.id] });
      setEditVenue(null);
      toast.success('Venue updated');
    },
    onError: () => toast.error('Failed to update venue'),
  });

  const deleteMutation = useMutation({
    mutationFn: async (venueId: string) => {
      const res = await fetch(`/api/venues/${venueId}`, { method: 'DELETE' });
      if (!res.ok) throw new Error('Failed to delete venue');
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['venues', club?.id] });
      toast.success('Venue deleted');
    },
    onError: () => toast.error('Failed to delete venue'),
  });

  const addStripMutation = useMutation({
    mutationFn: async (venueId: string) => {
      const res = await fetch(`/api/venues/${venueId}/strips`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: newStripName }),
      });
      if (!res.ok) throw new Error('Failed to add strip');
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['strips', expandedVenueId] });
      setNewStripName('');
      toast.success('Strip added');
    },
    onError: () => toast.error('Failed to add strip'),
  });

  const handleAddVenue = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newVenueName.trim()) return;
    addVenueMutation.mutate();
  };

  const openEdit = (venue: Venue) => {
    setEditVenue(venue);
    setEditName(venue.name);
    setEditAddress(venue.address || '');
  };

  const handleEditSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editName.trim()) return;
    editMutation.mutate();
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
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle>{venue.name}</CardTitle>
                    <CardDescription>
                      {venue.address || 'No address provided'}
                    </CardDescription>
                  </div>
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => openEdit(venue)}
                    >
                      Edit
                    </Button>
                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <Button variant="destructive" size="sm">
                          Delete
                        </Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle>Delete {venue.name}?</AlertDialogTitle>
                          <AlertDialogDescription>
                            This will remove the venue. Existing bookings at this
                            venue will not be affected.
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>Cancel</AlertDialogCancel>
                          <AlertDialogAction
                            onClick={() => deleteMutation.mutate(venue.id)}
                            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                          >
                            Delete
                          </AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() =>
                    setExpandedVenueId(
                      expandedVenueId === venue.id ? null : venue.id
                    )
                  }
                >
                  {expandedVenueId === venue.id
                    ? 'Hide Strips'
                    : 'Manage Strips'}
                </Button>
                {expandedVenueId === venue.id && (
                  <div className="mt-4 space-y-3">
                    {strips.length === 0 ? (
                      <p className="text-sm text-muted-foreground">
                        No strips configured.
                      </p>
                    ) : (
                      <div className="space-y-1">
                        {strips.map((strip) => (
                          <div
                            key={strip.id}
                            className="flex items-center gap-2 rounded border px-3 py-2 text-sm"
                          >
                            <span className="font-medium">{strip.name}</span>
                          </div>
                        ))}
                      </div>
                    )}
                    <form
                      onSubmit={(e) => {
                        e.preventDefault();
                        if (!newStripName.trim()) return;
                        addStripMutation.mutate(venue.id);
                      }}
                      className="flex gap-2"
                    >
                      <Input
                        placeholder="Strip name (e.g. Strip 1)"
                        value={newStripName}
                        onChange={(e) => setNewStripName(e.target.value)}
                        className="flex-1"
                      />
                      <Button
                        type="submit"
                        size="sm"
                        disabled={
                          !newStripName.trim() || addStripMutation.isPending
                        }
                      >
                        {addStripMutation.isPending ? 'Adding...' : 'Add Strip'}
                      </Button>
                    </form>
                  </div>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Edit Dialog */}
      <Dialog open={!!editVenue} onOpenChange={(o) => !o && setEditVenue(null)}>
        <DialogContent className="sm:max-w-[400px]">
          <DialogHeader>
            <DialogTitle>Edit Venue</DialogTitle>
            <DialogDescription>Update venue details.</DialogDescription>
          </DialogHeader>
          <form onSubmit={handleEditSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="edit-name">Name</Label>
              <Input
                id="edit-name"
                value={editName}
                onChange={(e) => setEditName(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-address">Address</Label>
              <Input
                id="edit-address"
                value={editAddress}
                onChange={(e) => setEditAddress(e.target.value)}
              />
            </div>
            <div className="flex gap-2 justify-end">
              <Button
                type="button"
                variant="outline"
                onClick={() => setEditVenue(null)}
              >
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={!editName.trim() || editMutation.isPending}
              >
                {editMutation.isPending ? 'Saving...' : 'Save'}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
