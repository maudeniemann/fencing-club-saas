'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { createClient } from '@/lib/supabase/client';
import { useClub } from '@/providers/club-provider';
import { format } from 'date-fns';
import { toast } from 'sonner';
import { Trash2 } from 'lucide-react';
import type { ClubMember, UserRole } from '@/types';

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { Textarea } from '@/components/ui/textarea';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';

const roleBadgeColors: Record<UserRole, string> = {
  admin: 'bg-purple-100 text-purple-800 border-purple-200',
  coach: 'bg-blue-100 text-blue-800 border-blue-200',
  player: 'bg-green-100 text-green-800 border-green-200',
  parent: 'bg-orange-100 text-orange-800 border-orange-200',
};

export default function MembersPage() {
  const { club, currentMember } = useClub();
  const queryClient = useQueryClient();
  const [roleFilter, setRoleFilter] = useState<string>('all');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);

  // Add member form state
  const [newName, setNewName] = useState('');
  const [newEmail, setNewEmail] = useState('');
  const [newRole, setNewRole] = useState<'player' | 'coach'>('player');
  const [newPhone, setNewPhone] = useState('');
  const [newBio, setNewBio] = useState('');
  const [newSpecialties, setNewSpecialties] = useState('');

  const {
    data: members,
    isLoading,
  } = useQuery({
    queryKey: ['members', club?.id],
    queryFn: async () => {
      if (!club) return [];
      const supabase = createClient();
      const { data, error } = await supabase
        .from('club_members')
        .select('*')
        .eq('club_id', club.id)
        .order('created_at', { ascending: true });

      if (error) throw error;
      return data as ClubMember[];
    },
    enabled: !!club,
  });

  const addMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch('/api/members', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          display_name: newName,
          email: newEmail,
          role: newRole,
          phone: newPhone || undefined,
          bio: newRole === 'coach' ? (newBio || undefined) : undefined,
          specialties: newRole === 'coach' && newSpecialties.trim()
            ? newSpecialties.split(',').map((s) => s.trim()).filter(Boolean)
            : undefined,
        }),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || 'Failed to add member');
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['members', club?.id] });
      toast.success('Member added successfully');
      resetForm();
      setDialogOpen(false);
    },
    onError: (err: Error) => {
      toast.error(err.message);
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (memberId: string) => {
      const res = await fetch(`/api/members?memberId=${memberId}`, {
        method: 'DELETE',
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || 'Failed to remove member');
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['members', club?.id] });
      toast.success('Member removed');
      setDeleteConfirmId(null);
    },
    onError: (err: Error) => {
      toast.error(err.message);
      setDeleteConfirmId(null);
    },
  });

  function resetForm() {
    setNewName('');
    setNewEmail('');
    setNewRole('player');
    setNewPhone('');
    setNewBio('');
    setNewSpecialties('');
  }

  const handleAdd = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newName.trim() || !newEmail.trim()) return;
    addMutation.mutate();
  };

  const filteredMembers = members?.filter((member) => {
    if (!member.is_active) return false;
    return roleFilter === 'all' ? true : member.role === roleFilter;
  }) ?? [];

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <p className="text-muted-foreground">Loading members...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Members</h1>
          <p className="text-muted-foreground">
            Manage your club members and invitations.
          </p>
        </div>
        <Dialog open={dialogOpen} onOpenChange={(open) => { setDialogOpen(open); if (!open) resetForm(); }}>
          <DialogTrigger asChild>
            <Button>Add Member</Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-[480px]">
            <form onSubmit={handleAdd}>
              <DialogHeader>
                <DialogTitle>Add Member</DialogTitle>
                <DialogDescription>
                  Add a new player or coach to your club.
                </DialogDescription>
              </DialogHeader>
              <div className="grid gap-4 py-4">
                <div className="grid gap-2">
                  <Label htmlFor="name">Display Name *</Label>
                  <Input
                    id="name"
                    placeholder="e.g. Jane Smith"
                    value={newName}
                    onChange={(e) => setNewName(e.target.value)}
                    required
                  />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="email">Email *</Label>
                  <Input
                    id="email"
                    type="email"
                    placeholder="e.g. jane@example.com"
                    value={newEmail}
                    onChange={(e) => setNewEmail(e.target.value)}
                    required
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="grid gap-2">
                    <Label htmlFor="role">Role</Label>
                    <Select value={newRole} onValueChange={(v) => setNewRole(v as 'player' | 'coach')}>
                      <SelectTrigger id="role">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="player">Player</SelectItem>
                        <SelectItem value="coach">Coach</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="grid gap-2">
                    <Label htmlFor="phone">Phone</Label>
                    <Input
                      id="phone"
                      placeholder="Optional"
                      value={newPhone}
                      onChange={(e) => setNewPhone(e.target.value)}
                    />
                  </div>
                </div>
                {newRole === 'coach' && (
                  <>
                    <div className="grid gap-2">
                      <Label htmlFor="bio">Bio</Label>
                      <Textarea
                        id="bio"
                        placeholder="Short biography..."
                        value={newBio}
                        onChange={(e) => setNewBio(e.target.value)}
                        rows={3}
                      />
                    </div>
                    <div className="grid gap-2">
                      <Label htmlFor="specialties">Specialties</Label>
                      <Input
                        id="specialties"
                        placeholder="e.g. Epee, Footwork, Youth"
                        value={newSpecialties}
                        onChange={(e) => setNewSpecialties(e.target.value)}
                      />
                      <p className="text-xs text-muted-foreground">
                        Comma-separated list
                      </p>
                    </div>
                  </>
                )}
              </div>
              <DialogFooter>
                <Button
                  type="submit"
                  disabled={!newName.trim() || !newEmail.trim() || addMutation.isPending}
                >
                  {addMutation.isPending ? 'Adding...' : 'Add Member'}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {/* Invite Member Section */}
      <Card>
        <CardHeader>
          <CardTitle>Invite Members</CardTitle>
          <CardDescription>
            Share this invite code with new members so they can join your club.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            <Label>Invite Code (Club Slug)</Label>
            <div className="flex items-center gap-2">
              <Input
                value={club?.slug ?? ''}
                readOnly
                className="max-w-sm font-mono"
              />
              <Badge variant="secondary">
                {filteredMembers.length} member{filteredMembers.length !== 1 ? 's' : ''}
              </Badge>
            </div>
            <p className="text-sm text-muted-foreground">
              New members enter this code when signing up to join your club.
            </p>
          </div>
        </CardContent>
      </Card>

      <Separator />

      {/* Filters */}
      <div className="flex items-center gap-4">
        <div className="space-y-1">
          <Label>Filter by Role</Label>
          <Select value={roleFilter} onValueChange={setRoleFilter}>
            <SelectTrigger className="w-[180px]">
              <SelectValue placeholder="All roles" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Roles</SelectItem>
              <SelectItem value="admin">Admin</SelectItem>
              <SelectItem value="coach">Coach</SelectItem>
              <SelectItem value="player">Player</SelectItem>
              <SelectItem value="parent">Parent</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="ml-auto">
          <Badge variant="outline">
            {filteredMembers.length} member{filteredMembers.length !== 1 ? 's' : ''} shown
          </Badge>
        </div>
      </div>

      {/* Members Table */}
      {filteredMembers.length === 0 ? (
        <Card>
          <CardContent className="flex items-center justify-center py-12">
            <p className="text-muted-foreground">
              {roleFilter === 'all'
                ? 'No members found.'
                : `No members with role "${roleFilter}" found.`}
            </p>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Phone</TableHead>
                  <TableHead>Role</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Joined</TableHead>
                  <TableHead className="w-[60px]" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredMembers.map((member) => (
                  <TableRow key={member.id}>
                    <TableCell className="font-medium">
                      {member.display_name ?? 'Unnamed'}
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {member.phone ?? '-'}
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant="outline"
                        className={roleBadgeColors[member.role as UserRole]}
                      >
                        {member.role}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant={member.is_active ? 'default' : 'secondary'}
                      >
                        {member.is_active ? 'Active' : 'Inactive'}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {format(new Date(member.created_at), 'MMM d, yyyy')}
                    </TableCell>
                    <TableCell>
                      {member.id !== currentMember?.id && (
                        deleteConfirmId === member.id ? (
                          <div className="flex items-center gap-1">
                            <Button
                              variant="destructive"
                              size="sm"
                              onClick={() => deleteMutation.mutate(member.id)}
                              disabled={deleteMutation.isPending}
                            >
                              {deleteMutation.isPending ? '...' : 'Yes'}
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => setDeleteConfirmId(null)}
                            >
                              No
                            </Button>
                          </div>
                        ) : (
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => setDeleteConfirmId(member.id)}
                            title="Remove member"
                          >
                            <Trash2 className="h-4 w-4 text-muted-foreground" />
                          </Button>
                        )
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
