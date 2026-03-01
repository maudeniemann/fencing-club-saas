'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { createClient } from '@/lib/supabase/client';
import { useClub } from '@/providers/club-provider';
import { format } from 'date-fns';
import type { ClubMember, UserRole } from '@/types';

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

const roleBadgeColors: Record<UserRole, string> = {
  admin: 'bg-purple-100 text-purple-800 border-purple-200',
  coach: 'bg-blue-100 text-blue-800 border-blue-200',
  player: 'bg-green-100 text-green-800 border-green-200',
  parent: 'bg-orange-100 text-orange-800 border-orange-200',
};

export default function MembersPage() {
  const { club } = useClub();
  const [roleFilter, setRoleFilter] = useState<string>('all');

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

  const filteredMembers = members?.filter((member) =>
    roleFilter === 'all' ? true : member.role === roleFilter
  ) ?? [];

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <p className="text-muted-foreground">Loading members...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Members</h1>
        <p className="text-muted-foreground">
          Manage your club members and invitations.
        </p>
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
                {members?.length ?? 0} member{(members?.length ?? 0) !== 1 ? 's' : ''}
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
                  <TableHead>Email</TableHead>
                  <TableHead>Role</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Joined</TableHead>
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
