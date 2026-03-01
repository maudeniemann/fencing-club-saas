'use client';

import { useState } from 'react';
import { useClub } from '@/providers/club-provider';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { createClient } from '@/lib/supabase/client';
import { RoleGate } from '@/components/layout/role-gate';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import type { ClubMember, ParentChildLink } from '@/types';

type ChildLink = ParentChildLink & {
  child: Pick<ClubMember, 'id' | 'display_name' | 'avatar_url' | 'role'>;
};

export default function ChildrenPage() {
  const { club, currentMember, isLoading: clubLoading } = useClub();
  const supabase = createClient();
  const queryClient = useQueryClient();
  const [updatingId, setUpdatingId] = useState<string | null>(null);

  // Fetch parent-child links
  const { data: links = [], isLoading: linksLoading } = useQuery({
    queryKey: ['parent-child-links', currentMember?.id],
    queryFn: async () => {
      if (!currentMember || !club) return [];

      const { data } = await supabase
        .from('parent_child_links')
        .select('*, child:club_members!parent_child_links_child_member_id_fkey(id, display_name, avatar_url, role)')
        .eq('parent_member_id', currentMember.id)
        .eq('club_id', club.id);

      return (data || []) as ChildLink[];
    },
    enabled: !!currentMember && !!club,
  });

  const togglePermission = async (
    linkId: string,
    field: 'can_book' | 'can_pay' | 'can_view_progress',
    currentValue: boolean
  ) => {
    setUpdatingId(linkId);
    try {
      await supabase
        .from('parent_child_links')
        .update({ [field]: !currentValue })
        .eq('id', linkId);

      queryClient.invalidateQueries({ queryKey: ['parent-child-links'] });
    } catch (error) {
      console.error('Error updating permission:', error);
    } finally {
      setUpdatingId(null);
    }
  };

  if (clubLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-muted-foreground">Loading...</div>
      </div>
    );
  }

  return (
    <RoleGate allowedRoles={['parent']} fallback={<div className="p-8 text-center text-muted-foreground">Access restricted to parents.</div>}>
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold">My Children</h1>
          <p className="text-muted-foreground">
            Manage linked children and their permissions.
          </p>
        </div>

        {linksLoading ? (
          <div className="flex items-center justify-center h-32">
            <div className="text-muted-foreground">Loading...</div>
          </div>
        ) : links.length === 0 ? (
          <Card>
            <CardContent className="py-12">
              <div className="text-center space-y-3">
                <div className="text-muted-foreground">
                  No children linked yet.
                </div>
                <p className="text-sm text-muted-foreground">
                  Contact your club admin to link a child to your account.
                </p>
              </div>
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-4 md:grid-cols-2">
            {links.map((link) => (
              <Card key={link.id}>
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      {link.child.avatar_url ? (
                        <img
                          src={link.child.avatar_url}
                          alt={link.child.display_name || 'Child'}
                          className="h-10 w-10 rounded-full object-cover"
                        />
                      ) : (
                        <div className="flex h-10 w-10 items-center justify-center rounded-full bg-muted text-sm font-medium">
                          {(link.child.display_name || '?').charAt(0).toUpperCase()}
                        </div>
                      )}
                      <div>
                        <CardTitle className="text-lg">
                          {link.child.display_name || 'Unnamed'}
                        </CardTitle>
                        <CardDescription>
                          <Badge variant="secondary" className="capitalize text-xs">
                            {link.child.role}
                          </Badge>
                        </CardDescription>
                      </div>
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  <Separator className="mb-4" />
                  <div className="space-y-3">
                    <Label className="text-sm font-medium">Permissions</Label>

                    <div className="flex items-center justify-between">
                      <span className="text-sm">Can book lessons</span>
                      <Button
                        variant={link.can_book ? 'default' : 'outline'}
                        size="sm"
                        disabled={updatingId === link.id}
                        onClick={() => togglePermission(link.id, 'can_book', link.can_book)}
                      >
                        {link.can_book ? 'Enabled' : 'Disabled'}
                      </Button>
                    </div>

                    <div className="flex items-center justify-between">
                      <span className="text-sm">Can make payments</span>
                      <Button
                        variant={link.can_pay ? 'default' : 'outline'}
                        size="sm"
                        disabled={updatingId === link.id}
                        onClick={() => togglePermission(link.id, 'can_pay', link.can_pay)}
                      >
                        {link.can_pay ? 'Enabled' : 'Disabled'}
                      </Button>
                    </div>

                    <div className="flex items-center justify-between">
                      <span className="text-sm">Can view progress</span>
                      <Button
                        variant={link.can_view_progress ? 'default' : 'outline'}
                        size="sm"
                        disabled={updatingId === link.id}
                        onClick={() => togglePermission(link.id, 'can_view_progress', link.can_view_progress)}
                      >
                        {link.can_view_progress ? 'Enabled' : 'Disabled'}
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}

        {/* Info card */}
        <Card>
          <CardContent className="py-4">
            <p className="text-sm text-muted-foreground">
              Need to add or remove a linked child? Please contact your club administrator for assistance.
            </p>
          </CardContent>
        </Card>
      </div>
    </RoleGate>
  );
}
