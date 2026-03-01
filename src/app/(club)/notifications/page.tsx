'use client';

import { useNotifications } from '@/hooks/use-notifications';
import { useClub } from '@/providers/club-provider';
import { format, formatDistanceToNow, isToday, isYesterday } from 'date-fns';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import type { Notification } from '@/types';

function formatNotificationTime(dateStr: string): string {
  const date = new Date(dateStr);
  if (isToday(date)) {
    return formatDistanceToNow(date, { addSuffix: true });
  }
  if (isYesterday(date)) {
    return `Yesterday at ${format(date, 'h:mm a')}`;
  }
  return format(date, 'MMM d, yyyy h:mm a');
}

function getTypeBadgeVariant(type: string): 'default' | 'secondary' | 'destructive' | 'outline' {
  switch (type) {
    case 'booking_confirmed':
    case 'lesson_completed':
      return 'default';
    case 'booking_cancelled':
    case 'no_show':
    case 'dispute':
      return 'destructive';
    case 'payment':
    case 'payout':
      return 'secondary';
    default:
      return 'outline';
  }
}

function formatType(type: string): string {
  return type.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
}

export default function NotificationsPage() {
  const { isLoading: clubLoading } = useClub();
  const { notifications, unreadCount, isLoading, markAsRead, markAllAsRead } = useNotifications();

  if (clubLoading || isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-muted-foreground">Loading...</div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Notifications</h1>
          <p className="text-muted-foreground">
            {unreadCount > 0
              ? `You have ${unreadCount} unread notification${unreadCount !== 1 ? 's' : ''}.`
              : 'You are all caught up.'}
          </p>
        </div>
        {unreadCount > 0 && (
          <Button variant="outline" onClick={markAllAsRead}>
            Mark all as read
          </Button>
        )}
      </div>

      <Card>
        <CardHeader>
          <CardTitle>All Notifications</CardTitle>
          <CardDescription>
            Recent notifications and updates.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {notifications.length === 0 ? (
            <div className="py-12 text-center text-muted-foreground">
              No notifications.
            </div>
          ) : (
            <div className="space-y-1">
              {notifications.map((notification: Notification, index: number) => (
                <div key={notification.id}>
                  <button
                    onClick={() => {
                      if (!notification.is_read) {
                        markAsRead(notification.id);
                      }
                    }}
                    className="w-full text-left rounded-lg p-4 transition-colors hover:bg-accent"
                  >
                    <div className="flex items-start gap-3">
                      {/* Unread indicator */}
                      <div className="mt-2 flex-shrink-0">
                        {!notification.is_read ? (
                          <div className="h-2 w-2 rounded-full bg-primary" />
                        ) : (
                          <div className="h-2 w-2" />
                        )}
                      </div>

                      <div className="flex-1 min-w-0 space-y-1">
                        <div className="flex items-center gap-2">
                          <span
                            className={`text-sm ${
                              !notification.is_read ? 'font-semibold' : 'font-medium'
                            }`}
                          >
                            {notification.title}
                          </span>
                          <Badge variant={getTypeBadgeVariant(notification.type)} className="text-xs">
                            {formatType(notification.type)}
                          </Badge>
                        </div>

                        {notification.body ? (
                          <p
                            className={`text-sm ${
                              !notification.is_read
                                ? 'text-foreground'
                                : 'text-muted-foreground'
                            }`}
                          >
                            {notification.body as string}
                          </p>
                        ) : null}

                        <p className="text-xs text-muted-foreground">
                          {formatNotificationTime(notification.created_at)}
                        </p>
                      </div>
                    </div>
                  </button>
                  {index < notifications.length - 1 && <Separator />}
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
