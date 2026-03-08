'use client';

import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { formatDistanceToNow } from 'date-fns';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { ConversationView } from '@/components/messaging/conversation-view';
import { cn } from '@/lib/utils';

interface Conversation {
  id: string;
  booking_id: string | null;
  created_at: string;
  updated_at: string;
  other_member: {
    id: string;
    display_name: string;
    avatar_url: string | null;
    role: string;
  };
  latest_message: {
    content: string;
    created_at: string;
    sender_member_id: string;
  } | null;
  unread_count: number;
  last_read_at: string | null;
}

export default function MessagesPage() {
  const [selectedConversationId, setSelectedConversationId] = useState<string | null>(null);
  const queryClient = useQueryClient();

  const { data: conversations, isLoading } = useQuery({
    queryKey: ['conversations'],
    queryFn: async () => {
      const res = await fetch('/api/conversations');
      if (!res.ok) throw new Error('Failed to fetch conversations');
      return res.json() as Promise<Conversation[]>;
    },
    refetchInterval: 5000, // Poll every 5 seconds for new conversations
  });

  const selectedConversation = conversations?.find(c => c.id === selectedConversationId);

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
        <h1 className="text-2xl font-bold">Messages</h1>
        <p className="text-muted-foreground">
          Chat with coaches and athletes
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 h-[calc(100vh-12rem)]">
        {/* Conversations List */}
        <Card className="lg:col-span-1 flex flex-col">
          <CardHeader>
            <CardTitle className="text-base">Conversations</CardTitle>
          </CardHeader>
          <CardContent className="flex-1 overflow-y-auto space-y-2 p-3">
            {conversations && conversations.length > 0 ? (
              conversations.map((conversation) => {
                const initials = conversation.other_member.display_name
                  ?.split(' ')
                  .map(n => n[0])
                  .join('')
                  .toUpperCase() || '??';

                return (
                  <button
                    key={conversation.id}
                    onClick={() => setSelectedConversationId(conversation.id)}
                    className={cn(
                      'w-full text-left p-3 rounded-lg transition-colors',
                      selectedConversationId === conversation.id
                        ? 'bg-accent'
                        : 'hover:bg-accent/50'
                    )}
                  >
                    <div className="flex items-start gap-3">
                      <Avatar className="h-10 w-10">
                        <AvatarImage src={conversation.other_member.avatar_url || undefined} />
                        <AvatarFallback>{initials}</AvatarFallback>
                      </Avatar>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between gap-2 mb-1">
                          <div className="font-medium truncate">
                            {conversation.other_member.display_name}
                          </div>
                          {conversation.unread_count > 0 && (
                            <Badge variant="default" className="shrink-0">
                              {conversation.unread_count}
                            </Badge>
                          )}
                        </div>
                        {conversation.booking_id && (
                          <Badge variant="secondary" className="text-xs mb-1">
                            Booking Thread
                          </Badge>
                        )}
                        {conversation.latest_message && (
                          <>
                            <div className="text-sm text-muted-foreground truncate">
                              {conversation.latest_message.content}
                            </div>
                            <div className="text-xs text-muted-foreground mt-1">
                              {formatDistanceToNow(new Date(conversation.latest_message.created_at), { addSuffix: true })}
                            </div>
                          </>
                        )}
                      </div>
                    </div>
                  </button>
                );
              })
            ) : (
              <div className="text-center py-8 text-muted-foreground">
                No conversations yet
              </div>
            )}
          </CardContent>
        </Card>

        {/* Conversation View */}
        <Card className="lg:col-span-2 flex flex-col">
          {selectedConversation ? (
            <ConversationView
              conversationId={selectedConversation.id}
              otherMember={selectedConversation.other_member}
              onClose={() => setSelectedConversationId(null)}
            />
          ) : (
            <CardContent className="flex items-center justify-center h-full">
              <div className="text-center">
                <p className="text-muted-foreground">
                  Select a conversation to start messaging
                </p>
              </div>
            </CardContent>
          )}
        </Card>
      </div>
    </div>
  );
}
