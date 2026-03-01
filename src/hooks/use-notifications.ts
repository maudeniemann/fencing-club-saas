'use client';

import { useEffect, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { createClient } from '@/lib/supabase/client';
import { useClub } from '@/providers/club-provider';
import type { Notification } from '@/types';

export function useNotifications() {
  const { currentMember } = useClub();
  const queryClient = useQueryClient();
  const [unreadCount, setUnreadCount] = useState(0);

  const { data: notifications = [], isLoading } = useQuery({
    queryKey: ['notifications', currentMember?.id],
    queryFn: async () => {
      if (!currentMember) return [];
      const supabase = createClient();
      const { data } = await supabase
        .from('notifications')
        .select('*')
        .eq('recipient_member_id', currentMember.id)
        .order('created_at', { ascending: false })
        .limit(50);
      return (data || []) as Notification[];
    },
    enabled: !!currentMember,
  });

  // Subscribe to real-time notifications
  useEffect(() => {
    if (!currentMember) return;

    const supabase = createClient();
    const channel = supabase
      .channel(`notifications:${currentMember.id}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'notifications',
          filter: `recipient_member_id=eq.${currentMember.id}`,
        },
        () => {
          queryClient.invalidateQueries({ queryKey: ['notifications'] });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [currentMember, queryClient]);

  // Track unread count
  useEffect(() => {
    setUnreadCount(notifications.filter((n) => !n.is_read).length);
  }, [notifications]);

  const markAsRead = async (notificationId: string) => {
    const supabase = createClient();
    await supabase
      .from('notifications')
      .update({ is_read: true, read_at: new Date().toISOString() })
      .eq('id', notificationId);
    queryClient.invalidateQueries({ queryKey: ['notifications'] });
  };

  const markAllAsRead = async () => {
    if (!currentMember) return;
    const supabase = createClient();
    await supabase
      .from('notifications')
      .update({ is_read: true, read_at: new Date().toISOString() })
      .eq('recipient_member_id', currentMember.id)
      .eq('is_read', false);
    queryClient.invalidateQueries({ queryKey: ['notifications'] });
  };

  return {
    notifications,
    unreadCount,
    isLoading,
    markAsRead,
    markAllAsRead,
  };
}
